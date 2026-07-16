import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

process.env.ADMIN_EMAILS = 'admin@example.com,unverified-admin@example.com';
vi.resetModules();

const { api, Timestamp } = await import('./_helpers.js');
const { db } = await import('../../api/lib/firebaseAdmin.js');
const { getAuth } = await import('firebase-admin/auth');
const { calculateScores, UAAM_QUESTION_VERSION } = await import('../../shared/uaamQuestions.js');

const ADMIN_UID = 'uaam-peer-delete-admin';
const ADMIN_EMAIL = 'admin@example.com';
const UNVERIFIED_ADMIN_UID = 'uaam-peer-delete-unverified-admin';
const UNVERIFIED_ADMIN_EMAIL = 'unverified-admin@example.com';
const ADMIN_PASSWORD = 'password123';
const UID_PATH_SUBJECT = 'uaam-peer-delete-by-uid';
const EMAIL_PATH_SUBJECT = 'uaam-peer-delete-by-email';
const EMAIL_PATH_ADDRESS = 'uaam-peer-orphan@example.com';
const MULTI_AUTH_UID = 'uaam-peer-delete-auth-uid';
const MULTI_ORPHAN_UID = 'uaam-peer-delete-orphan-uid';
const MULTI_EMAIL = 'uaam-peer-multi@example.com';
const PARTIAL_FAILURE_UID = 'uaam-peer-delete-partial';
const RETRY_UID = 'uaam-peer-delete-retry';
const TOMBSTONE_WRITE_FAILURE_UID = 'uaam-peer-delete-tombstone-write-failure';
const TOMBSTONE_WRITE_FAILURE_EMAIL = 'tombstone-write-failure@example.com';
const EMAIL_SWEEP_FAILURE_UID = 'uaam-peer-delete-email-sweep-failure';
const EMAIL_SWEEP_FAILURE_EMAIL = 'email-sweep-failure@example.com';
const SUBJECT_UIDS = [
  UID_PATH_SUBJECT,
  EMAIL_PATH_SUBJECT,
  MULTI_AUTH_UID,
  MULTI_ORPHAN_UID,
  PARTIAL_FAILURE_UID,
  RETRY_UID,
  TOMBSTONE_WRITE_FAILURE_UID,
  EMAIL_SWEEP_FAILURE_UID,
];
const answers = Object.fromEntries(Array.from({ length: 64 }, (_value, index) => [String(index + 1), 4]));
const scores = calculateScores(answers);
let adminToken;

async function deleteQuery(query) {
  const snapshot = await query.get();
  await Promise.all(snapshot.docs.map((document) => document.ref.delete()));
}

async function cleanupSubject(uid) {
  await Promise.all([
    db.recursiveDelete(db.collection('results').doc(uid)),
    db.recursiveDelete(db.collection('uaam_results').doc(uid)),
    db.recursiveDelete(db.collection('uaam_peer_results').doc(uid)),
    db.collection('uaam_peer_invite_index').doc(uid).delete(),
    db.collection('uaam_peer_deletions').doc(uid).delete(),
    deleteQuery(db.collection('uaam_peer_invites').where('subjectUid', '==', uid)),
    deleteQuery(db.collection('uaam_peer_audits').where('subjectUid', '==', uid)),
  ]);
}

async function seedSubject(uid, email) {
  const answeredAt = Timestamp.fromDate(new Date('2026-07-01T00:00:00.000Z'));
  await db.collection('uaam_results').doc(uid).set({
    uid,
    email,
    name: 'Deletion Subject',
    latestAttemptId: 'attempt-latest',
    scores,
    updatedAt: answeredAt,
  });
  await db.collection('uaam_results').doc(uid).collection('attempts').doc('attempt-latest').set({
    status: 'committed',
    createdAt: answeredAt,
    questionVersion: UAAM_QUESTION_VERSION,
    full: { scores },
  });
}

async function issueAndSubmit(uid) {
  const issued = await api.post('/api/me/uaam-peer-invite')
    .set('x-test-uid', uid)
    .send({ action: 'issue' });
  expect(issued.status).toBe(201);

  const submitted = await api.post('/api/uaam-peer-assess').send({
    inviteId: issued.body.inviteId,
    answers,
  });
  expect(submitted.status).toBe(201);

  const [invite, pointer, submissions, audits] = await Promise.all([
    db.collection('uaam_peer_invites').doc(issued.body.inviteId).get(),
    db.collection('uaam_peer_invite_index').doc(uid).get(),
    db.collection('uaam_peer_results').doc(uid).collection('submissions').get(),
    db.collection('uaam_peer_audits').where('subjectUid', '==', uid).get(),
  ]);
  expect(invite.exists).toBe(true);
  expect(pointer.data()?.activeInviteId).toBe(issued.body.inviteId);
  expect(submissions.size).toBe(1);
  expect(audits.docs.map((document) => document.data().type).sort()).toEqual(['issue', 'submit']);
  return issued.body.inviteId;
}

async function assertCascade(uid, inviteId) {
  const [
    invites,
    pointer,
    resultRoot,
    submissions,
    audits,
    tombstone,
  ] = await Promise.all([
    db.collection('uaam_peer_invites').where('subjectUid', '==', uid).get(),
    db.collection('uaam_peer_invite_index').doc(uid).get(),
    db.collection('uaam_peer_results').doc(uid).get(),
    db.collection('uaam_peer_results').doc(uid).collection('submissions').get(),
    db.collection('uaam_peer_audits').where('subjectUid', '==', uid).get(),
    db.collection('uaam_peer_deletions').doc(uid).get(),
  ]);

  expect(invites.empty).toBe(true);
  expect(pointer.exists).toBe(false);
  expect(resultRoot.exists).toBe(false);
  expect(submissions.empty).toBe(true);
  expect(audits.empty).toBe(true);
  expect(tombstone.exists).toBe(true);

  expect((await api.post('/api/me/uaam-peer-invite')
    .set('x-test-uid', uid)
    .send({ action: 'issue' })).status).toBe(410);
  expect((await api.get(`/api/uaam-peer-invite?id=${inviteId}`)).status).toBe(410);
  expect((await api.post('/api/uaam-peer-assess').send({ inviteId, answers })).status).toBe(410);
}

async function signInAdmin(email = ADMIN_EMAIL) {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const response = await fetch(
    `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: ADMIN_PASSWORD, returnSecureToken: true }),
    },
  );
  const body = await response.json();
  if (!response.ok) throw new Error(`admin emulator sign-in failed: ${JSON.stringify(body)}`);
  return body.idToken;
}

beforeAll(async () => {
  await Promise.all(SUBJECT_UIDS.map(cleanupSubject));
  await Promise.all([
    getAuth().deleteUser(ADMIN_UID).catch(() => {}),
    getAuth().deleteUser(UNVERIFIED_ADMIN_UID).catch(() => {}),
    ...SUBJECT_UIDS.map((subjectUid) => getAuth().deleteUser(subjectUid).catch(() => {})),
  ]);
  await getAuth().createUser({
    uid: ADMIN_UID,
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    emailVerified: true,
  });
  await getAuth().createUser({
    uid: UNVERIFIED_ADMIN_UID,
    email: UNVERIFIED_ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    emailVerified: false,
  });
  adminToken = await signInAdmin();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(SUBJECT_UIDS.map(cleanupSubject));
  await Promise.all(SUBJECT_UIDS.map((subjectUid) => getAuth().deleteUser(subjectUid).catch(() => {})));
});

afterAll(async () => {
  await Promise.all([
    getAuth().deleteUser(ADMIN_UID).catch(() => {}),
    getAuth().deleteUser(UNVERIFIED_ADMIN_UID).catch(() => {}),
  ]);
});

describe('UAAM peer deletion cascade', () => {
  it('deletes every peer artifact through the uid path and leaves a 410 barrier', async () => {
    await seedSubject(UID_PATH_SUBJECT, 'uid-path@example.com');
    const inviteId = await issueAndSubmit(UID_PATH_SUBJECT);

    const deleted = await api.delete('/api/admin/delete-user')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ uid: UID_PATH_SUBJECT });

    expect(deleted.status).toBe(200);
    expect(deleted.body).toMatchObject({ success: true, deletedUid: UID_PATH_SUBJECT });
    await assertCascade(UID_PATH_SUBJECT, inviteId);
  });

  it('derives the uid from Firestore email, deletes every peer artifact, and leaves a 410 barrier', async () => {
    await seedSubject(EMAIL_PATH_SUBJECT, EMAIL_PATH_ADDRESS);
    const inviteId = await issueAndSubmit(EMAIL_PATH_SUBJECT);

    await expect(getAuth().getUserByEmail(EMAIL_PATH_ADDRESS)).rejects.toThrow();
    const deleted = await api.delete('/api/admin/delete-user')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: EMAIL_PATH_ADDRESS });

    expect(deleted.status).toBe(200);
    expect(deleted.body).toMatchObject({ success: true, deletedUid: EMAIL_PATH_SUBJECT });
    await assertCascade(EMAIL_PATH_SUBJECT, inviteId);
  });

  it('rejects unverified admin email tokens through the shared admin guard', async () => {
    const unverifiedToken = await signInAdmin(UNVERIFIED_ADMIN_EMAIL);

    const denied = await api.delete('/api/admin/delete-user')
      .set('Authorization', `Bearer ${unverifiedToken}`)
      .send({ uid: UID_PATH_SUBJECT });

    expect(denied.status).toBe(403);
    expect(denied.body).toMatchObject({ code: 'EMAIL_UNVERIFIED' });
    expect((await db.collection('uaam_peer_deletions').doc(UID_PATH_SUBJECT).get()).exists).toBe(false);
  });

  it('requires exactly one of uid or email', async () => {
    const [neither, both] = await Promise.all([
      api.delete('/api/admin/delete-user')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({}),
      api.delete('/api/admin/delete-user')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ uid: UID_PATH_SUBJECT, email: 'same@example.com' }),
    ]);

    for (const response of [neither, both]) {
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('どちらか一方だけ');
    }
  });

  it('sweeps both the Auth uid and every Firestore uid derived from the same email', async () => {
    await getAuth().createUser({
      uid: MULTI_AUTH_UID,
      email: MULTI_EMAIL,
      password: ADMIN_PASSWORD,
      emailVerified: true,
    });
    await Promise.all([
      seedSubject(MULTI_AUTH_UID, MULTI_EMAIL),
      seedSubject(MULTI_ORPHAN_UID, MULTI_EMAIL),
    ]);
    const [authInviteId, orphanInviteId] = await Promise.all([
      issueAndSubmit(MULTI_AUTH_UID),
      issueAndSubmit(MULTI_ORPHAN_UID),
    ]);

    const deleted = await api.delete('/api/admin/delete-user')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: MULTI_EMAIL });

    expect(deleted.status).toBe(200);
    expect(deleted.body).toMatchObject({ success: true, deletedUid: MULTI_AUTH_UID });
    await Promise.all([
      assertCascade(MULTI_AUTH_UID, authInviteId),
      assertCascade(MULTI_ORPHAN_UID, orphanInviteId),
    ]);
    await expect(getAuth().getUser(MULTI_AUTH_UID)).rejects.toMatchObject({ code: 'auth/user-not-found' });
  });

  it('reports a requestId partial_failure and continues independent deletion steps', async () => {
    await seedSubject(PARTIAL_FAILURE_UID, 'partial-failure@example.com');
    await db.collection('results').doc(PARTIAL_FAILURE_UID).set({
      uid: PARTIAL_FAILURE_UID,
      email: 'partial-failure@example.com',
    });

    const referencePrototype = Object.getPrototypeOf(db.collection('results').doc(PARTIAL_FAILURE_UID));
    const originalDelete = referencePrototype.delete;
    vi.spyOn(referencePrototype, 'delete').mockImplementation(function deleteWithInjectedFailure(...args) {
      if (this.path === `results/${PARTIAL_FAILURE_UID}`) {
        return Promise.reject(Object.assign(new Error('forced emulator deletion failure'), { code: 'internal' }));
      }
      return originalDelete.apply(this, args);
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const deleted = await api.delete('/api/admin/delete-user')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ uid: PARTIAL_FAILURE_UID });

    expect(deleted.status).toBe(500);
    expect(deleted.body).toMatchObject({
      success: false,
      code: 'partial_failure',
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/u),
      failedUids: [PARTIAL_FAILURE_UID],
    });
    expect(consoleError).toHaveBeenCalledWith(
      '[delete-user] partial failure',
      expect.objectContaining({ requestId: deleted.body.requestId }),
    );
    expect((await db.collection('results').doc(PARTIAL_FAILURE_UID).get()).exists).toBe(true);
    expect((await db.collection('uaam_results').doc(PARTIAL_FAILURE_UID).get()).exists).toBe(false);
    expect((await db.collection('uaam_peer_deletions').doc(PARTIAL_FAILURE_UID).get()).exists).toBe(true);
  });

  it('keeps invites and account roots when tombstone invite-id recording fails, then retries safely', async () => {
    await getAuth().createUser({
      uid: TOMBSTONE_WRITE_FAILURE_UID,
      email: TOMBSTONE_WRITE_FAILURE_EMAIL,
      password: ADMIN_PASSWORD,
      emailVerified: true,
    });
    await seedSubject(TOMBSTONE_WRITE_FAILURE_UID, TOMBSTONE_WRITE_FAILURE_EMAIL);
    await db.collection('results').doc(TOMBSTONE_WRITE_FAILURE_UID).set({
      uid: TOMBSTONE_WRITE_FAILURE_UID,
      email: TOMBSTONE_WRITE_FAILURE_EMAIL,
    });
    const inviteId = await issueAndSubmit(TOMBSTONE_WRITE_FAILURE_UID);

    const referencePrototype = Object.getPrototypeOf(
      db.collection('uaam_peer_deletions').doc(TOMBSTONE_WRITE_FAILURE_UID),
    );
    const originalSet = referencePrototype.set;
    vi.spyOn(referencePrototype, 'set').mockImplementation(function setWithInjectedFailure(...args) {
      if (this.path === `uaam_peer_deletions/${TOMBSTONE_WRITE_FAILURE_UID}`
        && Object.prototype.hasOwnProperty.call(args[0], 'inviteIds')) {
        return Promise.reject(Object.assign(new Error('forced tombstone invite-id failure'), { code: 'internal' }));
      }
      return originalSet.apply(this, args);
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const firstAttempt = await api.delete('/api/admin/delete-user')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ uid: TOMBSTONE_WRITE_FAILURE_UID });

    expect(firstAttempt.status).toBe(500);
    expect(firstAttempt.body.failedUids).toEqual([TOMBSTONE_WRITE_FAILURE_UID]);
    expect((await db.collection('uaam_peer_invites').doc(inviteId).get()).exists).toBe(true);
    expect((await db.collection('results').doc(TOMBSTONE_WRITE_FAILURE_UID).get()).exists).toBe(true);
    expect((await db.collection('uaam_results').doc(TOMBSTONE_WRITE_FAILURE_UID).get()).exists).toBe(true);
    await expect(getAuth().getUser(TOMBSTONE_WRITE_FAILURE_UID)).resolves.toMatchObject({
      uid: TOMBSTONE_WRITE_FAILURE_UID,
    });

    vi.restoreAllMocks();
    const retry = await api.delete('/api/admin/delete-user')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ uid: TOMBSTONE_WRITE_FAILURE_UID });
    expect(retry.status).toBe(200);
    expect((await db.collection('uaam_peer_invites').doc(inviteId).get()).exists).toBe(false);
    expect((await api.get(`/api/uaam-peer-invite?id=${inviteId}`)).status).toBe(410);
    await expect(getAuth().getUser(TOMBSTONE_WRITE_FAILURE_UID)).rejects.toMatchObject({
      code: 'auth/user-not-found',
    });
  });

  it('keeps result roots and Auth discoverable after an email-path peer sweep failure', async () => {
    await getAuth().createUser({
      uid: EMAIL_SWEEP_FAILURE_UID,
      email: EMAIL_SWEEP_FAILURE_EMAIL,
      password: ADMIN_PASSWORD,
      emailVerified: true,
    });
    await seedSubject(EMAIL_SWEEP_FAILURE_UID, EMAIL_SWEEP_FAILURE_EMAIL);
    await db.collection('results').doc(EMAIL_SWEEP_FAILURE_UID).set({
      uid: EMAIL_SWEEP_FAILURE_UID,
      email: EMAIL_SWEEP_FAILURE_EMAIL,
    });
    const inviteId = await issueAndSubmit(EMAIL_SWEEP_FAILURE_UID);

    const referencePrototype = Object.getPrototypeOf(
      db.collection('uaam_peer_invite_index').doc(EMAIL_SWEEP_FAILURE_UID),
    );
    const originalDelete = referencePrototype.delete;
    vi.spyOn(referencePrototype, 'delete').mockImplementation(function deleteWithInjectedFailure(...args) {
      if (this.path === `uaam_peer_invite_index/${EMAIL_SWEEP_FAILURE_UID}`) {
        return Promise.reject(Object.assign(new Error('forced peer pointer failure'), { code: 'internal' }));
      }
      return originalDelete.apply(this, args);
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const firstAttempt = await api.delete('/api/admin/delete-user')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: EMAIL_SWEEP_FAILURE_EMAIL });

    expect(firstAttempt.status).toBe(500);
    expect(firstAttempt.body.failedUids).toEqual([EMAIL_SWEEP_FAILURE_UID]);
    expect((await db.collection('results').doc(EMAIL_SWEEP_FAILURE_UID).get()).exists).toBe(true);
    expect((await db.collection('uaam_results').doc(EMAIL_SWEEP_FAILURE_UID).get()).exists).toBe(true);
    await expect(getAuth().getUserByEmail(EMAIL_SWEEP_FAILURE_EMAIL)).resolves.toMatchObject({
      uid: EMAIL_SWEEP_FAILURE_UID,
    });

    vi.restoreAllMocks();
    const retry = await api.delete('/api/admin/delete-user')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: EMAIL_SWEEP_FAILURE_EMAIL });
    expect(retry.status).toBe(200);
    expect((await db.collection('results').doc(EMAIL_SWEEP_FAILURE_UID).get()).exists).toBe(false);
    expect((await db.collection('uaam_results').doc(EMAIL_SWEEP_FAILURE_UID).get()).exists).toBe(false);
    expect((await api.get(`/api/uaam-peer-invite?id=${inviteId}`)).status).toBe(410);
    await expect(getAuth().getUserByEmail(EMAIL_SWEEP_FAILURE_EMAIL)).rejects.toMatchObject({
      code: 'auth/user-not-found',
    });
  });

  it('preserves every tombstoned invite id across a partial-failure retry', async () => {
    await seedSubject(RETRY_UID, 'retry@example.com');
    const firstInviteId = await issueAndSubmit(RETRY_UID);
    expect((await api.post('/api/me/uaam-peer-invite')
      .set('x-test-uid', RETRY_UID)
      .send({ action: 'revoke' })).status).toBe(200);
    const secondInviteId = (await api.post('/api/me/uaam-peer-invite')
      .set('x-test-uid', RETRY_UID)
      .send({ action: 'issue' })).body.inviteId;

    const referencePrototype = Object.getPrototypeOf(db.collection('uaam_peer_invites').doc(firstInviteId));
    const originalDelete = referencePrototype.delete;
    let failedOnce = false;
    vi.spyOn(referencePrototype, 'delete').mockImplementation(function deleteWithInjectedFailure(...args) {
      if (!failedOnce && this.path === `uaam_peer_invites/${firstInviteId}`) {
        failedOnce = true;
        return Promise.reject(Object.assign(new Error('forced invite deletion failure'), { code: 'internal' }));
      }
      return originalDelete.apply(this, args);
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const firstAttempt = await api.delete('/api/admin/delete-user')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ uid: RETRY_UID });
    expect(firstAttempt.status).toBe(500);
    expect(firstAttempt.body.failedUids).toEqual([RETRY_UID]);
    expect((await db.collection('uaam_peer_deletions').doc(RETRY_UID).get()).data().inviteIds.sort())
      .toEqual([firstInviteId, secondInviteId].sort());

    vi.restoreAllMocks();
    const retry = await api.delete('/api/admin/delete-user')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ uid: RETRY_UID });
    expect(retry.status).toBe(200);

    const tombstone = await db.collection('uaam_peer_deletions').doc(RETRY_UID).get();
    expect(tombstone.data().inviteIds.sort()).toEqual([firstInviteId, secondInviteId].sort());
    expect((await api.get(`/api/uaam-peer-invite?id=${firstInviteId}`)).status).toBe(410);
    expect((await api.get(`/api/uaam-peer-invite?id=${secondInviteId}`)).status).toBe(410);
  });
});
