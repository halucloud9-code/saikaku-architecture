import { afterEach, describe, expect, it } from 'vitest';
import { api, Timestamp } from './_helpers.js';
import { db } from '../../api/lib/firebaseAdmin.js';
import { calculateScores } from '../../shared/uaamQuestions.js';

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

    const publicGet = await api.get(`/api/uaam-peer-invite?id=${inviteId}`);
    expect(publicGet.status).toBe(200);
    expect(publicGet.body.subjectName).toBe('Peer Subject');
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

    const submissions = await db.collection('uaam_peer_results').doc(uid).collection('submissions').get();
    for (const document of submissions.docs) {
      expect(Object.keys(document.data()).sort()).toEqual(['answers', 'createdAt', 'inviteId', 'scores']);
    }

    const revoked = await api.post('/api/me/uaam-peer-invite').set('x-test-uid', uid).send({ action: 'revoke' });
    expect(revoked.status).toBe(200);
    expect((await api.get(`/api/uaam-peer-invite?id=${inviteId}`)).status).toBe(404);

    const nextWave = await issue();
    expect(nextWave.status).toBe(201);
    expect(nextWave.body.inviteId).not.toBe(inviteId);
    expect((await summary()).body).toEqual({ status: 'insufficient' });
  });

  it('rejects malformed, capped, expired, revoked, and tombstoned requests', async () => {
    await seedSelfResult();
    const issued = await issue();
    const inviteId = issued.body.inviteId;

    expect((await api.get('/api/uaam-peer-invite?id=bad-id')).status).toBe(404);
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
    expect((await api.get(`/api/uaam-peer-invite?id=${inviteId}`)).status).toBe(410);
    expect((await api.post('/api/uaam-peer-assess').send({ inviteId, answers })).status).toBe(410);
  });
});
