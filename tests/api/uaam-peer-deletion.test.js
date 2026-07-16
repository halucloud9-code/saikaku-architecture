import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

process.env.ADMIN_EMAILS = 'admin@example.com';
vi.resetModules();

const { api, Timestamp } = await import('./_helpers.js');
const { db } = await import('../../api/lib/firebaseAdmin.js');
const { getAuth } = await import('firebase-admin/auth');
const { calculateScores } = await import('../../shared/uaamQuestions.js');

const ADMIN_UID = 'uaam-peer-delete-admin';
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'password123';
const UID_PATH_SUBJECT = 'uaam-peer-delete-by-uid';
const EMAIL_PATH_SUBJECT = 'uaam-peer-delete-by-email';
const EMAIL_PATH_ADDRESS = 'uaam-peer-orphan@example.com';
const SUBJECT_UIDS = [UID_PATH_SUBJECT, EMAIL_PATH_SUBJECT];
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

async function signInAdmin() {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const response = await fetch(
    `http://${host}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, returnSecureToken: true }),
    },
  );
  const body = await response.json();
  if (!response.ok) throw new Error(`admin emulator sign-in failed: ${JSON.stringify(body)}`);
  return body.idToken;
}

beforeAll(async () => {
  await Promise.all(SUBJECT_UIDS.map(cleanupSubject));
  await getAuth().deleteUser(ADMIN_UID).catch(() => {});
  await getAuth().createUser({
    uid: ADMIN_UID,
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    emailVerified: true,
  });
  adminToken = await signInAdmin();
});

afterEach(async () => {
  await Promise.all(SUBJECT_UIDS.map(cleanupSubject));
});

afterAll(async () => {
  await getAuth().deleteUser(ADMIN_UID).catch(() => {});
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
});
