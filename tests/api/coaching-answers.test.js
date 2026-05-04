import { describe, expect, it } from 'vitest';
import { makeCoachingAnswerKey } from '../../api/lib/coachingAnswerKey.js';
import {
  Timestamp,
  api,
  clearUserState,
  getParent,
  seedParent,
} from './_helpers.js';

const endpoint = '/api/me/coaching-answers';

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function expectTimestamp(value) {
  expect(value).toBeInstanceOf(Timestamp);
}

describe('API /api/me/coaching-answers', () => {
  it('returns 401 for GET without Authorization or test uid', async () => {
    const response = await api.get(endpoint);

    expect(response.status).toBe(401);
  });

  it('returns 401 for POST with invalid test uid', async () => {
    const response = await api
      .post(endpoint)
      .set('x-test-uid', '../bad')
      .send({ items: [{ questionText: '問い1', answer: 'A1' }] });

    expect(response.status).toBe(401);
  });

  it('returns 405 for unsupported methods', async () => {
    const response = await api.put(endpoint).set('x-test-uid', 'u-coaching-answers-method');

    expect(response.status).toBe(405);
  });

  it('returns empty answers for a new user without a parent document', async () => {
    const uid = 'u-coaching-answers-empty-new';
    await clearUserState('uaam_results', uid);

    const response = await api.get(endpoint).set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ answers: {} });
  });

  it('returns empty answers when the parent has no coaching_answers field', async () => {
    const uid = 'u-coaching-answers-empty-field';
    await clearUserState('uaam_results', uid);
    await seedParent('uaam_results', uid, {
      scores: { mindset: { total: 60 } },
      analysis: { type_name: '実装する案内人' },
    });

    const response = await api.get(endpoint).set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ answers: {} });
  });

  it('stores a single answer under coaching_answers', async () => {
    const uid = 'u-coaching-answers-single';
    await clearUserState('uaam_results', uid);

    const response = await api
      .post(endpoint)
      .set('x-test-uid', uid)
      .send({ items: [{ questionText: '問い1', answer: 'A1' }] });

    const qid = makeCoachingAnswerKey('問い1');
    const parent = await getParent('uaam_results', uid);
    const saved = parent.coaching_answers[qid];

    expect(response.status).toBe(200);
    expect(response.body.answers[qid]).toMatchObject({
      questionText: '問い1',
      answer: 'A1',
    });
    expect(typeof response.body.answers[qid].answeredAt).toBe('string');
    expect(typeof response.body.answers[qid].updatedAt).toBe('string');
    expect(saved.questionText).toBe('問い1');
    expect(saved.answer).toBe('A1');
    expectTimestamp(saved.answeredAt);
    expectTimestamp(saved.updatedAt);
  });

  it('updates only answer and updatedAt when saving the same question again', async () => {
    const uid = 'u-coaching-answers-resave';
    await clearUserState('uaam_results', uid);

    await api
      .post(endpoint)
      .set('x-test-uid', uid)
      .send({ items: [{ questionText: '問い1', answer: 'A1' }] });

    const qid = makeCoachingAnswerKey('問い1');
    const first = (await getParent('uaam_results', uid)).coaching_answers[qid];

    await delay(150);

    const response = await api
      .post(endpoint)
      .set('x-test-uid', uid)
      .send({ items: [{ questionText: '問い1', answer: 'A1更新' }] });

    const second = (await getParent('uaam_results', uid)).coaching_answers[qid];

    expect(response.status).toBe(200);
    expect(second.answer).toBe('A1更新');
    expect(second.questionText).toBe('問い1');
    expect(second.answeredAt._seconds).toBe(first.answeredAt._seconds);
    expect(second.updatedAt.toMillis()).toBeGreaterThan(first.updatedAt.toMillis());
  });

  it('stores multiple questions in one request', async () => {
    const uid = 'u-coaching-answers-multiple';
    await clearUserState('uaam_results', uid);

    const response = await api
      .post(endpoint)
      .set('x-test-uid', uid)
      .send({
        items: [
          { questionText: '問い1', answer: 'A1' },
          { questionText: '問い2', answer: 'A2' },
        ],
      });

    const parent = await getParent('uaam_results', uid);
    const qid1 = makeCoachingAnswerKey('問い1');
    const qid2 = makeCoachingAnswerKey('問い2');

    expect(response.status).toBe(200);
    expect(parent.coaching_answers[qid1]).toMatchObject({ questionText: '問い1', answer: 'A1' });
    expect(parent.coaching_answers[qid2]).toMatchObject({ questionText: '問い2', answer: 'A2' });
    expect(qid1).not.toBe(qid2);
  });

  it.each([
    ['missing items', {}, 'items must be an array'],
    ['empty items', { items: [] }, 'items is empty'],
    [
      'too many items',
      { items: Array.from({ length: 11 }, (_, i) => ({ questionText: `問い${i}`, answer: 'A' })) },
      'too many items (max 10)',
    ],
    [
      'non-string questionText',
      { items: [{ questionText: 1, answer: 'A1' }] },
      'questionText must be a string',
    ],
    ['empty answer', { items: [{ questionText: '問い1', answer: '' }] }, 'answer is empty'],
    [
      'non-string answer',
      { items: [{ questionText: '問い1', answer: 1 }] },
      'answer must be a string',
    ],
    [
      'too long answer',
      { items: [{ questionText: '問い1', answer: 'A'.repeat(2001) }] },
      'answer is too long (max 2000)',
    ],
    ['empty questionText', { items: [{ questionText: '', answer: 'A1' }] }, 'questionText is empty'],
    [
      'too long questionText',
      { items: [{ questionText: '問'.repeat(501), answer: 'A1' }] },
      'questionText is too long (max 500)',
    ],
  ])('returns 400 for %s', async (_name, body, error) => {
    const response = await api
      .post(endpoint)
      .set('x-test-uid', 'u-coaching-answers-validation')
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error });
  });

  it('normalizes a trailing question mark into the same qid', async () => {
    const uid = 'u-coaching-answers-normalized';
    await clearUserState('uaam_results', uid);

    await api
      .post(endpoint)
      .set('x-test-uid', uid)
      .send({ items: [{ questionText: '問い1', answer: 'A1' }] });

    const response = await api
      .post(endpoint)
      .set('x-test-uid', uid)
      .send({ items: [{ questionText: '問い1？', answer: 'A1更新' }] });

    const parent = await getParent('uaam_results', uid);
    const qid = makeCoachingAnswerKey('問い1');

    expect(response.status).toBe(200);
    expect(Object.keys(parent.coaching_answers)).toHaveLength(1);
    expect(parent.coaching_answers[qid]).toMatchObject({
      questionText: '問い1',
      answer: 'A1更新',
    });
  });

  it('returns all saved answers with ISO timestamps from GET', async () => {
    const uid = 'u-coaching-answers-get-all';
    await clearUserState('uaam_results', uid);

    await api
      .post(endpoint)
      .set('x-test-uid', uid)
      .send({
        items: [
          { questionText: '問い1', answer: 'A1' },
          { questionText: '問い2', answer: 'A2' },
        ],
      });

    const response = await api.get(endpoint).set('x-test-uid', uid);
    const qid1 = makeCoachingAnswerKey('問い1');
    const qid2 = makeCoachingAnswerKey('問い2');

    expect(response.status).toBe(200);
    expect(response.body.answers[qid1]).toMatchObject({ questionText: '問い1', answer: 'A1' });
    expect(response.body.answers[qid2]).toMatchObject({ questionText: '問い2', answer: 'A2' });
    expect(response.body.answers[qid1].answeredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(response.body.answers[qid1].updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(response.body.answers[qid2].answeredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(response.body.answers[qid2].updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
