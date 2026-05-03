import { describe, expect, it } from 'vitest';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../../api/lib/firebaseAdmin.js';
import { makeCoachingAnswerKey } from '../../api/lib/coachingAnswerKey.js';
import { api, clearUserState, getParent } from './_helpers.js';

const endpoint = '/api/me/coaching-answers';

async function writeIntegration(uid, integration, options = {}) {
  await db.collection('uaam_results').doc(uid).set(
    {
      analysis: { saikaku_integration: integration },
      hasSaikakuIntegration: true,
      ...(options.includeUpdatedAt ? { integrationUpdatedAt: FieldValue.serverTimestamp() } : {}),
    },
    { merge: true }
  );
}

describe('coaching_answers emulator integration', () => {
  it('preserves coaching_answers when /api/integrate-style write overwrites analysis.saikaku_integration', async () => {
    const uid = 'u-coach-survives-integrate';
    await clearUserState('uaam_results', uid);

    await writeIntegration(uid, { integration_score: 50, activation_core: 'v1' });

    const r1 = await api
      .post(endpoint)
      .set('x-test-uid', uid)
      .send({ items: [{ questionText: '質問1', answer: '回答1' }] });
    expect(r1.status).toBe(200);

    const qid = makeCoachingAnswerKey('質問1');
    const before = await getParent('uaam_results', uid);
    expect(before.coaching_answers?.[qid]?.answer).toBe('回答1');
    expect(before.analysis?.saikaku_integration?.integration_score).toBe(50);

    await writeIntegration(
      uid,
      { integration_score: 88, activation_core: 'v2-regenerated' },
      { includeUpdatedAt: true }
    );

    const after = await getParent('uaam_results', uid);

    expect(after.analysis?.saikaku_integration?.integration_score).toBe(88);
    expect(after.analysis?.saikaku_integration?.activation_core).toBe('v2-regenerated');
    expect(after.coaching_answers?.[qid]?.answer).toBe('回答1');
    expect(after.coaching_answers?.[qid]?.questionText).toBe('質問1');
  });

  it('handles parallel POSTs without lost update (Map merge race-free)', async () => {
    const uid = 'u-coach-parallel';
    await clearUserState('uaam_results', uid);

    const [r1, r2] = await Promise.all([
      api
        .post(endpoint)
        .set('x-test-uid', uid)
        .send({ items: [{ questionText: '質問A', answer: '答えA' }] }),
      api
        .post(endpoint)
        .set('x-test-uid', uid)
        .send({ items: [{ questionText: '質問B', answer: '答えB' }] }),
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    const qidA = makeCoachingAnswerKey('質問A');
    const qidB = makeCoachingAnswerKey('質問B');

    const after = await getParent('uaam_results', uid);
    expect(after.coaching_answers?.[qidA]?.answer).toBe('答えA');
    expect(after.coaching_answers?.[qidB]?.answer).toBe('答えB');
    expect(Object.keys(after.coaching_answers)).toHaveLength(2);
  });

  it('keeps answeredAt fixed across resaves while advancing updatedAt', async () => {
    const uid = 'u-coach-answered-at-fixed';
    await clearUserState('uaam_results', uid);

    const r1 = await api
      .post(endpoint)
      .set('x-test-uid', uid)
      .send({ items: [{ questionText: '問1', answer: 'first' }] });
    expect(r1.status).toBe(200);

    const qid = makeCoachingAnswerKey('問1');
    const after1 = await getParent('uaam_results', uid);
    const answeredAt1 = after1.coaching_answers[qid].answeredAt;
    const updatedAt1 = after1.coaching_answers[qid].updatedAt;
    expect(answeredAt1).toBeDefined();

    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });

    const r2 = await api
      .post(endpoint)
      .set('x-test-uid', uid)
      .send({ items: [{ questionText: '問1', answer: 'second' }] });
    expect(r2.status).toBe(200);

    const after2 = await getParent('uaam_results', uid);
    const updatedAt2 = after2.coaching_answers[qid].updatedAt;

    expect(after2.coaching_answers[qid].answer).toBe('second');
    expect(after2.coaching_answers[qid].answeredAt._seconds).toBe(answeredAt1._seconds);
    expect(after2.coaching_answers[qid].answeredAt._nanoseconds).toBe(answeredAt1._nanoseconds);
    expect(
      updatedAt2._seconds > updatedAt1._seconds ||
        (updatedAt2._seconds === updatedAt1._seconds &&
          updatedAt2._nanoseconds >= updatedAt1._nanoseconds)
    ).toBe(true);
  });

  it('upserts to same qid when question differs only in trailing punctuation', async () => {
    const uid = 'u-coach-normalize';
    await clearUserState('uaam_results', uid);

    const r1 = await api
      .post(endpoint)
      .set('x-test-uid', uid)
      .send({ items: [{ questionText: '同じ問い', answer: 'A1' }] });
    expect(r1.status).toBe(200);

    const r2 = await api
      .post(endpoint)
      .set('x-test-uid', uid)
      .send({ items: [{ questionText: '同じ問い？', answer: 'A2' }] });
    expect(r2.status).toBe(200);

    const after = await getParent('uaam_results', uid);
    const keys = Object.keys(after.coaching_answers);

    expect(keys).toHaveLength(1);
    expect(after.coaching_answers[keys[0]].answer).toBe('A2');
    expect(after.coaching_answers[keys[0]].questionText).toBe('同じ問い');
  });
});
