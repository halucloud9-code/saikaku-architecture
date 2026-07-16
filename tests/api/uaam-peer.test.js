import { afterEach, describe, expect, it } from 'vitest';
import { api, FieldValue, Timestamp } from './_helpers.js';
import { db } from '../../api/lib/firebaseAdmin.js';
import { calculateScores, UAAM_QUESTION_VERSION } from '../../shared/uaamQuestions.js';

const uid = 'uaam-peer-api-test';
const answers = Object.fromEntries(Array.from({ length: 64 }, (_value, index) => [String(index + 1), 3]));
const scores = calculateScores(answers);

async function deleteQuery(query) {
  const snapshot = await query.get();
  await Promise.all(snapshot.docs.map((document) => document.ref.delete()));
}

async function cleanup() {
  delete process.env.UAAM_PEER_SUBMISSION_CAP;
  await Promise.all([
    db.recursiveDelete(db.collection('uaam_results').doc(uid)),
    db.recursiveDelete(db.collection('uaam_peer_results').doc(uid)),
    db.collection('uaam_peer_invite_index').doc(uid).delete(),
    db.collection('uaam_peer_deletions').doc(uid).delete(),
    deleteQuery(db.collection('uaam_peer_invites').where('subjectUid', '==', uid)),
    deleteQuery(db.collection('uaam_peer_audits').where('subjectUid', '==', uid)),
  ]);
}

async function seedSelfResult() {
  const answeredAt = Timestamp.fromDate(new Date('2026-07-01T00:00:00.000Z'));
  await db.collection('uaam_results').doc(uid).set({
    uid,
    name: 'Peer Subject',
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

function issue() {
  return api.post('/api/me/uaam-peer-invite').set('x-test-uid', uid).send({ action: 'issue' });
}

function summary() {
  return api.get('/api/me/uaam-peer-summary').set('x-test-uid', uid);
}

describe('UAAM peer assessment APIs', () => {
  afterEach(cleanup);

  it('issues idempotently, accepts anonymous submissions, and aggregates only the current wave', async () => {
    await seedSelfResult();

    const [first, second] = await Promise.all([issue(), issue()]);
    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(first.body.inviteId).toBe(second.body.inviteId);
    expect(new Set([first.body.reused, second.body.reused])).toEqual(new Set([false, true]));
    const inviteId = first.body.inviteId;
    expect(first.body).not.toHaveProperty('submissionCount');
    expect(second.body).not.toHaveProperty('submissionCount');
    const subjectInvites = await db.collection('uaam_peer_invites').where('subjectUid', '==', uid).get();
    expect(subjectInvites.docs.filter((document) => document.data().revoked === false)).toHaveLength(1);
    expect(subjectInvites.docs[0].data().submissionCount).toBe(0);
    expect(subjectInvites.docs[0].data().questionVersion).toBe(UAAM_QUESTION_VERSION);

    // No Authorization or test-bypass identity header: both endpoints are public.
    const publicGet = await api.get(`/api/uaam-peer-invite?id=${inviteId}`);
    expect(publicGet.status).toBe(200);
    expect(publicGet.body.subjectName).toBe('Peer Subject');
    expect(publicGet.body).not.toHaveProperty('submissionCount');
    expect(publicGet.body).not.toHaveProperty('questionVersion');
    expect(publicGet.headers['cache-control']).toContain('no-store');
    expect(publicGet.headers['x-robots-tag']).toContain('noindex');

    const withVQuestion = { ...answers, V1: 3 };
    expect((await api.post('/api/uaam-peer-assess').send({ inviteId, answers: withVQuestion })).status).toBe(400);
    expect((await api.post('/api/uaam-peer-assess').send({ inviteId, answers })).status).toBe(201);
    expect((await summary()).body).toEqual({ status: 'insufficient' });
    expect((await api.post('/api/uaam-peer-assess').send({ inviteId, answers })).status).toBe(201);

    const ready = await summary();
    expect(ready.status).toBe(200);
    expect(ready.body).toMatchObject({
      status: 'ready',
      n: 2,
      aggregate: scores,
      selfSnapshot: { attemptId: 'attempt-latest', scores },
    });
    expect((await db.collection('uaam_peer_invites').doc(inviteId).get()).data().submissionCount).toBe(2);

    const submissions = await db.collection('uaam_peer_results').doc(uid).collection('submissions').get();
    for (const document of submissions.docs) {
      expect(Object.keys(document.data()).sort()).toEqual(['answers', 'createdAt', 'inviteId', 'scores']);
    }

    const revoked = await api.post('/api/me/uaam-peer-invite').set('x-test-uid', uid).send({ action: 'revoke' });
    expect(revoked.status).toBe(200);
    expect((await api.get(`/api/uaam-peer-invite?id=${inviteId}`)).status).toBe(404);
    expect((await api.post('/api/uaam-peer-assess').send({ inviteId, answers })).status).toBe(404);

    const nextWave = await issue();
    expect(nextWave.status).toBe(201);
    expect(nextWave.body.inviteId).not.toBe(inviteId);
    expect((await summary()).body).toEqual({ status: 'insufficient' });
  });

  it('rejects a mismatched question version on GET and POST while accepting a legacy missing version', async () => {
    await seedSelfResult();
    const issued = await issue();
    const inviteId = issued.body.inviteId;
    const inviteRef = db.collection('uaam_peer_invites').doc(inviteId);

    expect((await inviteRef.get()).data().questionVersion).toBe(UAAM_QUESTION_VERSION);
    await inviteRef.update({ questionVersion: 'bogus-question-version' });

    const [publicGet, submission] = await Promise.all([
      api.get(`/api/uaam-peer-invite?id=${inviteId}`),
      api.post('/api/uaam-peer-assess').send({ inviteId, answers }),
    ]);
    expect(publicGet.status).toBe(409);
    expect(publicGet.body).toMatchObject({ code: 'question_version_mismatch' });
    expect(submission.status).toBe(409);
    expect(submission.body).toMatchObject({ code: 'question_version_mismatch' });

    const [unchangedInvite, submissions, audits] = await Promise.all([
      inviteRef.get(),
      db.collection('uaam_peer_results').doc(uid).collection('submissions').get(),
      db.collection('uaam_peer_audits').where('subjectUid', '==', uid).get(),
    ]);
    expect(unchangedInvite.data().submissionCount).toBe(0);
    expect(submissions.empty).toBe(true);
    expect(audits.docs.filter((document) => document.data().type === 'submit')).toHaveLength(0);

    await inviteRef.update({ questionVersion: FieldValue.delete() });
    expect((await api.get(`/api/uaam-peer-invite?id=${inviteId}`)).status).toBe(200);
    expect((await api.post('/api/uaam-peer-assess').send({ inviteId, answers })).status).toBe(201);
  });

  it('does not reuse a stale-version invite and falls back to the token name for a blank parent name', async () => {
    await seedSelfResult();
    await db.collection('uaam_results').doc(uid).update({ name: '   ' });

    const first = await issue();
    expect(first.status).toBe(201);
    const firstInviteRef = db.collection('uaam_peer_invites').doc(first.body.inviteId);
    expect((await firstInviteRef.get()).data().subjectName).toBe('Test');

    await firstInviteRef.update({ questionVersion: 'stale-question-version' });
    const fresh = await issue();
    expect(fresh.status).toBe(201);
    expect(fresh.body).toMatchObject({ reused: false });
    expect(fresh.body.inviteId).not.toBe(first.body.inviteId);
    expect((await db.collection('uaam_peer_invites').doc(fresh.body.inviteId).get()).data())
      .toMatchObject({ subjectName: 'Test', questionVersion: UAAM_QUESTION_VERSION });
  });

  it('rejects stale, version-unknown, and parent-only self results at issuance', async () => {
    await seedSelfResult();
    const attemptRef = db.collection('uaam_results').doc(uid).collection('attempts').doc('attempt-latest');

    await attemptRef.update({ questionVersion: 'stale-question-version' });
    const stale = await issue();
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ code: 'self_question_version_unknown' });

    await attemptRef.update({ questionVersion: FieldValue.delete() });
    const unknown = await issue();
    expect(unknown.status).toBe(409);
    expect(unknown.body).toMatchObject({ code: 'self_question_version_unknown' });

    await attemptRef.delete();
    const parentOnly = await issue();
    expect(parentOnly.status).toBe(409);
    expect(parentOnly.body).toMatchObject({ code: 'self_question_version_unknown' });

    const [invites, pointer, audits] = await Promise.all([
      db.collection('uaam_peer_invites').where('subjectUid', '==', uid).get(),
      db.collection('uaam_peer_invite_index').doc(uid).get(),
      db.collection('uaam_peer_audits').where('subjectUid', '==', uid).get(),
    ]);
    expect(invites.empty).toBe(true);
    expect(pointer.exists).toBe(false);
    expect(audits.empty).toBe(true);
  });

  it('rejects malformed, capped, expired, revoked, and tombstoned requests', async () => {
    await seedSelfResult();
    const issued = await issue();
    const inviteId = issued.body.inviteId;
    const unknownInviteId = '99999999-9999-4999-8999-999999999999';

    expect((await api.get('/api/uaam-peer-invite?id=bad-id')).status).toBe(404);
    expect((await api.get(`/api/uaam-peer-invite?id=${unknownInviteId}`)).status).toBe(404);
    expect((await api.post('/api/uaam-peer-assess').send({ inviteId: unknownInviteId, answers })).status).toBe(404);
    expect((await api.post('/api/uaam-peer-assess').send({
      inviteId: unknownInviteId,
      answers: { 1: 3 },
    })).status).toBe(400);
    expect((await api.post('/api/uaam-peer-assess').send({
      inviteId,
      answers: Object.fromEntries(Object.entries(answers).filter(([id]) => id !== '64')),
    })).status).toBe(400);
    expect((await api.post('/api/uaam-peer-assess').send({ inviteId, answers: { ...answers, V1: 3 } })).status).toBe(400);
    expect((await api.post('/api/uaam-peer-assess').send({ inviteId, answers: { ...answers, extra: 3 } })).status).toBe(400);
    expect((await api.post('/api/uaam-peer-assess').send({ inviteId, answers: { ...answers, 64: 6 } })).status).toBe(400);

    process.env.UAAM_PEER_SUBMISSION_CAP = '1';
    expect((await api.post('/api/uaam-peer-assess').send({ inviteId, answers })).status).toBe(201);
    expect((await api.post('/api/uaam-peer-assess').send({ inviteId, answers })).status).toBe(429);

    await db.collection('uaam_peer_invites').doc(inviteId).update({
      expiresAt: Timestamp.fromDate(new Date('2000-01-01T00:00:00.000Z')),
    });
    expect((await api.get(`/api/uaam-peer-invite?id=${inviteId}`)).status).toBe(404);
    expect((await api.post('/api/uaam-peer-assess').send({ inviteId, answers })).status).toBe(404);

    await db.collection('uaam_peer_deletions').doc(uid).set({ requestedAt: Timestamp.now(), requestedBy: 'admin' });
    expect((await issue()).status).toBe(410);
    const tombstonedSummary = await summary();
    expect(tombstonedSummary.status).toBe(410);
    expect(tombstonedSummary.body).toMatchObject({ code: 'gone' });
    expect((await api.get(`/api/uaam-peer-invite?id=${inviteId}`)).status).toBe(410);
    expect((await api.post('/api/uaam-peer-assess').send({ inviteId, answers })).status).toBe(410);
  });

  it('holds the submission cap under parallel anonymous posts', async () => {
    await seedSelfResult();
    const issued = await issue();
    const inviteId = issued.body.inviteId;
    const cap = 3;
    const requestCount = 10;
    process.env.UAAM_PEER_SUBMISSION_CAP = String(cap);

    const responses = await Promise.all(Array.from({ length: requestCount }, () => (
      api.post('/api/uaam-peer-assess').send({ inviteId, answers })
    )));

    expect(responses.filter((response) => response.status === 201)).toHaveLength(cap);
    expect(responses.filter((response) => response.status === 429)).toHaveLength(requestCount - cap);
    expect(new Set(responses.map((response) => response.status))).toEqual(new Set([201, 429]));

    const [invite, submissions, audits] = await Promise.all([
      db.collection('uaam_peer_invites').doc(inviteId).get(),
      db.collection('uaam_peer_results').doc(uid).collection('submissions').get(),
      db.collection('uaam_peer_audits').where('subjectUid', '==', uid).get(),
    ]);
    expect(invite.data().submissionCount).toBe(cap);
    expect(submissions.size).toBe(cap);
    expect(audits.docs.filter((document) => document.data().type === 'submit')).toHaveLength(cap);
  });
});
