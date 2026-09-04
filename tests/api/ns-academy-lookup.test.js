import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, Timestamp } from './_helpers.js';
import { db } from '../../api/lib/firebaseAdmin.js';

const SECRET = 'test-ns-academy-secret';
const EMAIL = 'ns-academy-lookup@example.com';
const RESULT_IDS = ['ns-lookup-results-1', 'ns-lookup-results-2'];
const UAAM_IDS = ['ns-lookup-uaam-1', 'ns-lookup-uaam-2'];
const previousSecret = process.env.NS_ACADEMY_LOOKUP_SECRET;

function ts(iso) {
  return Timestamp.fromDate(new Date(iso));
}

function lookup(body = { email: EMAIL }, secret = SECRET) {
  return api
    .post('/api/integrations/ns-academy-lookup')
    .set('Authorization', `Bearer ${secret}`)
    .send(body);
}

async function clearFixtures() {
  await Promise.all([
    ...RESULT_IDS.map((id) => db.collection('results').doc(id).delete()),
    ...UAAM_IDS.map((id) => db.collection('uaam_results').doc(id).delete()),
  ]);
}

async function seedHit() {
  await Promise.all([
    db.collection('results').doc(RESULT_IDS[0]).set({
      uid: RESULT_IDS[0],
      email: EMAIL,
      name: 'Private Name',
      photoURL: 'https://example.com/private.png',
      createdAt: ts('2026-01-01T00:00:00.000Z'),
      updatedAt: ts('2026-01-02T00:00:00.000Z'),
      inputTalentTop5: '観察\n構造化',
      inputPassionTop5: '教育\n対話',
      inputValueTop5: '誠実\n探究',
      inputTalent: 'private talent free text',
      inputPassion: 'private passion free text',
      inputValue: 'private value free text',
      inputTalentOther: 'private talent other',
      inputPassionOther: 'private passion other',
      inputValueOther: 'private value other',
      inputQ1: 'private q1',
      inputQ2: 'private q2',
      inputQ3: 'private q3',
      selectedKakuchiiki: '本質を見抜く人',
      result: {
        kakuchiiki: '本質を見抜く人',
        core_words: { talent_core: '観察' },
        insight: 'private insight',
        what: { offer: 'private offer' },
        reward: { economic: 'private reward' },
        talent: { axis1: 'private' },
        passion: { axis1: 'private' },
        value: { axis1: 'private' },
        name: 'Private Name',
      },
    }),
    db.collection('uaam_results').doc(UAAM_IDS[0]).set({
      uid: UAAM_IDS[0],
      email: EMAIL,
      name: 'Private Name',
      photoURL: 'https://example.com/private.png',
      createdAt: ts('2026-01-03T00:00:00.000Z'),
      updatedAt: ts('2026-01-04T00:00:00.000Z'),
      scores: { will: 80, knowledge: 70 },
      analysis: { type_name: '実証家' },
      leadership_stage: { stage: 4, name: '自律' },
      personality_level: { level: 'L4' },
      answers: { 1: 5 },
      vAnswers: { V1: 5 },
      coaching_answers: { private: true },
      bias_message: { message: 'private bias' },
      three_elements: { private: true },
    }),
  ]);
}

describe('API /api/integrations/ns-academy-lookup', () => {
  let infoSpy;

  beforeEach(async () => {
    process.env.NS_ACADEMY_LOOKUP_SECRET = SECRET;
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    await clearFixtures();
  });

  afterEach(async () => {
    await clearFixtures();
    infoSpy.mockRestore();
  });

  afterAll(() => {
    if (previousSecret === undefined) delete process.env.NS_ACADEMY_LOOKUP_SECRET;
    else process.env.NS_ACADEMY_LOOKUP_SECRET = previousSecret;
  });

  it('returns 401 when the server secret is unset', async () => {
    delete process.env.NS_ACADEMY_LOOKUP_SECRET;

    const response = await lookup();

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'unauthorized' });
  });

  it('returns 401 when the bearer secret is wrong', async () => {
    const response = await lookup(undefined, 'wrong-secret');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'unauthorized' });
  });

  it('returns 405 for methods other than POST', async () => {
    const response = await api
      .get('/api/integrations/ns-academy-lookup')
      .set('Authorization', `Bearer ${SECRET}`);

    expect(response.status).toBe(405);
  });

  it('returns 400 for missing or invalid email', async () => {
    for (const body of [{}, { email: 'not-an-email' }]) {
      const response = await lookup(body);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'invalid_email' });
    }
  });

  it('returns a timestamp-normalized, strictly allowlisted hit', async () => {
    await seedHit();

    const response = await lookup({ email: `  ${EMAIL.toUpperCase()}  ` });

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      contract_version: 1,
      source_updated_at: '2026-01-04T00:00:00.000Z',
      results: {
        uid: RESULT_IDS[0],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        inputTalentTop5: '観察\n構造化',
        inputPassionTop5: '教育\n対話',
        inputValueTop5: '誠実\n探究',
        selectedKakuchiiki: '本質を見抜く人',
        result: {
          kakuchiiki: '本質を見抜く人',
          core_words: { talent_core: '観察' },
        },
      },
      uaam_results: {
        uid: UAAM_IDS[0],
        createdAt: '2026-01-03T00:00:00.000Z',
        updatedAt: '2026-01-04T00:00:00.000Z',
        scores: { will: 80, knowledge: 70 },
        analysis: { type_name: '実証家' },
        leadership_stage: { stage: 4, name: '自律' },
        personality_level: { level: 'L4' },
      },
    });

    const logEntry = JSON.parse(infoSpy.mock.calls.at(-1)[0]);
    expect(logEntry).toEqual({
      method: 'POST',
      status: 200,
      duration_ms: expect.any(Number),
      results_doc_count: 1,
      uaam_results_doc_count: 1,
    });
    expect(JSON.stringify(infoSpy.mock.calls)).not.toContain(EMAIL);
    expect(JSON.stringify(infoSpy.mock.calls)).not.toContain('Private Name');
  });

  it('returns null documents when neither collection matches', async () => {
    const response = await lookup({ email: 'missing-ns-academy-user@example.com' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      contract_version: 1,
      source_updated_at: null,
      results: null,
      uaam_results: null,
    });
  });

  it('returns no data when either collection has an ambiguous identity', async () => {
    await Promise.all(RESULT_IDS.map((id) => db.collection('results').doc(id).set({
      uid: id,
      email: EMAIL,
      updatedAt: ts('2026-01-02T00:00:00.000Z'),
    })));

    const response = await lookup();

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: 'ambiguous_identity' });
  });
});
