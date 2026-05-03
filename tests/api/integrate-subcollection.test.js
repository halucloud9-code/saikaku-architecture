import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../api/lib/firebaseAdmin.js';
import {
  IntegrationConflictError,
  acquireIntegrationLock,
  commitIntegration,
} from '../../api/lib/integrations.js';
import { buildPairKey } from '../../shared/integrationsKey.js';
import {
  Timestamp,
  api,
} from './_helpers.js';

const SAIKAKU_ATTEMPT_ID = 'saikaku-a';
const UAAM_ATTEMPT_ID = 'uaam-a';
const SAIKAKU_LABEL = '問いに火を灯す人';
const UAAM_LABEL = '実装する案内人';
const MODEL = 'claude-sonnet-4-20250514';

function authBase() {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
  return host.startsWith('http') ? host : `http://${host}`;
}

async function createAuthSession() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const response = await fetch(`${authBase()}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `integrate-${suffix}@example.test`,
      password: 'password-123',
      returnSecureToken: true,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`auth signUp failed: ${JSON.stringify(data)}`);
  return { uid: data.localId, idToken: data.idToken };
}

function saikakuResult() {
  return {
    kakuchiiki: SAIKAKU_LABEL,
    core_words: {
      talent_core: '観察と構造化',
      value_core: '誠実な貢献',
      passion_core: '問いを深める',
    },
    insight: 'まだ言葉にならない願いを見つけ、次の一歩へ変えていく力があります。',
  };
}

function uaamScores() {
  return {
    mindset: { percentage: 78, subs: { meaning: 16, mindfulness: 14 } },
    literacy: { percentage: 72, subs: { learning: 15, logical: 14 } },
    competency: { percentage: 81, subs: { critical: 17, communication: 16 } },
    impact: { percentage: 69, subs: { idea: 14, implementation: 15 } },
  };
}

function uaamAnalysis() {
  return {
    type_name: UAAM_LABEL,
    narrative: '見えにくい可能性を整理し、最初の行動へ変える力があります。',
  };
}

async function seedReadyUser() {
  const { uid, idToken } = await createAuthSession();
  const createdAt = Timestamp.fromDate(new Date('2026-05-01T00:00:00.000Z'));
  const pairKey = buildPairKey(SAIKAKU_ATTEMPT_ID, UAAM_ATTEMPT_ID);
  const result = saikakuResult();
  const scores = uaamScores();
  const analysis = uaamAnalysis();

  await Promise.all([
    db.collection('results').doc(uid).set({
      latestAttemptId: SAIKAKU_ATTEMPT_ID,
      attemptCount: 1,
      pendingAttemptId: null,
      selectedKakuchiiki: SAIKAKU_LABEL,
      result,
      inputTalentTop5: '観察\n対話\n構造化\n伴走\n説明',
      inputValueTop5: '誠実\n成長\n貢献\n自由\n探究',
      inputPassionTop5: '教育\n対話\n旅\n創作\n起業',
      createdAt,
      updatedAt: createdAt,
    }, { merge: true }),
    db.collection('results').doc(uid).collection('attempts').doc(SAIKAKU_ATTEMPT_ID).set({
      status: 'committed',
      createdAt,
      summary: { kakuchiiki: SAIKAKU_LABEL, typeName: null, createdAt },
      full: { result, analysis: null, scores: null, selectedKakuchiiki: SAIKAKU_LABEL },
      raw: {
        input: {
          talentTop5: '観察\n対話\n構造化\n伴走\n説明',
          valueTop5: '誠実\n成長\n貢献\n自由\n探究',
          passionTop5: '教育\n対話\n旅\n創作\n起業',
        },
      },
    }, { merge: true }),
    db.collection('uaam_results').doc(uid).set({
      latestAttemptId: UAAM_ATTEMPT_ID,
      attemptCount: 1,
      pendingAttemptId: null,
      scores,
      analysis,
      createdAt,
      updatedAt: createdAt,
    }, { merge: true }),
    db.collection('uaam_results').doc(uid).collection('attempts').doc(UAAM_ATTEMPT_ID).set({
      status: 'committed',
      createdAt,
      summary: { typeName: UAAM_LABEL, createdAt },
      full: { result: null, analysis, scores },
      raw: { input: { answers: {}, vAnswers: {} } },
    }, { merge: true }),
  ]);

  return { uid, idToken, pairKey };
}

function integrationRef(uid, pairKey) {
  return db.collection('uaam_results').doc(uid).collection('integrations').doc(pairKey);
}

function lockRef(uid, pairKey) {
  return db.collection('uaam_results').doc(uid).collection('_locks').doc(`integration-${pairKey}`);
}

async function postIntegrate(idToken, body = {}) {
  return api.post('/api/integrate').send({ idToken, ...body });
}

async function waitForPairLock(uid, pairKey) {
  for (let i = 0; i < 40; i += 1) {
    if ((await lockRef(uid, pairKey).get()).exists) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`lock was not acquired for ${pairKey}`);
}

describe('API /api/integrate per-pair subcollection writes', () => {
  beforeEach(() => {
    delete process.env.MOCK_ANTHROPIC_DELAY_MS;
    delete process.env.MOCK_ANTHROPIC_FAIL;
  });

  afterEach(() => {
    delete process.env.MOCK_ANTHROPIC_DELAY_MS;
    delete process.env.MOCK_ANTHROPIC_FAIL;
  });

  it('writes first generation to the integration subcollection and only fast-flags the parent', async () => {
    const { uid, idToken, pairKey } = await seedReadyUser();

    const response = await postIntegrate(idToken);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      pairKey,
      regenerationCount: 0,
      saikakuAttemptId: SAIKAKU_ATTEMPT_ID,
      uaamAttemptId: UAAM_ATTEMPT_ID,
      integration: { integration_score: 88 },
    });

    const integrationSnap = await integrationRef(uid, pairKey).get();
    expect(integrationSnap.exists).toBe(true);
    expect(integrationSnap.data()).toMatchObject({
      saikakuAttemptId: SAIKAKU_ATTEMPT_ID,
      uaamAttemptId: UAAM_ATTEMPT_ID,
      integration: { integration_score: 88 },
      regenerationCount: 0,
      model: MODEL,
      source: { saikakuLabel: SAIKAKU_LABEL, uaamLabel: UAAM_LABEL },
      status: 'active',
    });
    expect(integrationSnap.data().createdAt).toBeTruthy();
    expect(integrationSnap.data().updatedAt).toBeTruthy();

    const parentSnap = await db.collection('uaam_results').doc(uid).get();
    const parent = parentSnap.data();
    expect(parent.hasSaikakuIntegration).toBe(true);
    expect(parent.analysis?.saikaku_integration).toBeUndefined();
    expect(parent['analysis.saikaku_integration']).toBeUndefined();
    expect(parent.integrationUpdatedAt).toBeUndefined();
  });

  it('regenerates the same pair once and increments regenerationCount to 1', async () => {
    const { uid, idToken, pairKey } = await seedReadyUser();

    expect((await postIntegrate(idToken, {
      saikakuAttemptId: SAIKAKU_ATTEMPT_ID,
      uaamAttemptId: UAAM_ATTEMPT_ID,
    })).status).toBe(200);
    const firstDoc = (await integrationRef(uid, pairKey).get()).data();

    const response = await postIntegrate(idToken, {
      saikakuAttemptId: SAIKAKU_ATTEMPT_ID,
      uaamAttemptId: UAAM_ATTEMPT_ID,
    });

    expect(response.status).toBe(200);
    expect(response.body.regenerationCount).toBe(1);
    const secondDoc = (await integrationRef(uid, pairKey).get()).data();
    expect(secondDoc.regenerationCount).toBe(1);
    expect(secondDoc.createdAt.toMillis()).toBe(firstDoc.createdAt.toMillis());
    expect(secondDoc.integration.integration_score).toBe(88);
  });

  it('rejects the third same-pair generation with LimitExceededError and leaves the doc unchanged', async () => {
    const { uid, idToken, pairKey } = await seedReadyUser();
    const body = {
      saikakuAttemptId: SAIKAKU_ATTEMPT_ID,
      uaamAttemptId: UAAM_ATTEMPT_ID,
    };

    expect((await postIntegrate(idToken, body)).status).toBe(200);
    expect((await postIntegrate(idToken, body)).status).toBe(200);
    const beforeThird = (await integrationRef(uid, pairKey).get()).data();

    const third = await postIntegrate(idToken, body);

    expect(third.status).toBe(409);
    expect(third.body.code).toBe('cap_exceeded');
    expect(third.body.error).toContain('最大2回');
    const afterThird = (await integrationRef(uid, pairKey).get()).data();
    expect(afterThird.regenerationCount).toBe(1);
    expect(afterThird.updatedAt.toMillis()).toBe(beforeThird.updatedAt.toMillis());
    expect(afterThird.integration).toEqual(beforeThird.integration);
  });

  it('allows only one concurrent generation for the same pair', async () => {
    const { uid, idToken, pairKey } = await seedReadyUser();
    process.env.MOCK_ANTHROPIC_DELAY_MS = '1500';

    const firstRequest = postIntegrate(idToken);
    await waitForPairLock(uid, pairKey);
    const secondResponse = await postIntegrate(idToken);
    const firstResponse = await firstRequest;

    const statuses = [firstResponse.status, secondResponse.status].sort();
    expect(statuses).toEqual([200, 409]);
    const conflict = [firstResponse, secondResponse].find((response) => response.status === 409);
    expect(conflict.body.code).toBe('lock_conflict');
    const doc = (await integrationRef(uid, pairKey).get()).data();
    expect(doc.regenerationCount).toBe(0);
  });

  it('takes over a stale lock older than the 10 minute TTL', async () => {
    const { uid, idToken, pairKey } = await seedReadyUser();
    await lockRef(uid, pairKey).set({
      pairKey,
      ownerId: 'stale-owner',
      acquiredAt: Timestamp.fromMillis(Date.now() - (11 * 60 * 1000)),
    });

    const response = await postIntegrate(idToken, {
      saikakuAttemptId: SAIKAKU_ATTEMPT_ID,
      uaamAttemptId: UAAM_ATTEMPT_ID,
    });

    expect(response.status).toBe(200);
    expect(response.body.regenerationCount).toBe(0);
    expect((await integrationRef(uid, pairKey).get()).data().regenerationCount).toBe(0);
    expect((await lockRef(uid, pairKey).get()).exists).toBe(false);
  });

  it('rejects stale owner commit after another request takes over and commits', async () => {
    const { uid, pairKey } = await seedReadyUser();
    const ownerA = 'owner-a';
    const ownerB = 'owner-b';

    const lockA = await acquireIntegrationLock({ uid, pairKey, ownerId: ownerA });
    expect(lockA.ownerId).toBe(ownerA);
    await lockA.lockRef.update({
      acquiredAt: Timestamp.fromMillis(Date.now() - (11 * 60 * 1000)),
    });

    const lockB = await acquireIntegrationLock({ uid, pairKey, ownerId: ownerB });
    expect(lockB.ownerId).toBe(ownerB);
    await commitIntegration({
      uid,
      pairKey,
      saikakuAttemptId: SAIKAKU_ATTEMPT_ID,
      uaamAttemptId: UAAM_ATTEMPT_ID,
      integration: { integration_score: 91, activation_core: 'Owner B', activation_equation: 'Owner B equation' },
      model: MODEL,
      source: { saikakuLabel: SAIKAKU_LABEL, uaamLabel: UAAM_LABEL },
      ownerId: ownerB,
    });

    const afterB = (await integrationRef(uid, pairKey).get()).data();
    await expect(commitIntegration({
      uid,
      pairKey,
      saikakuAttemptId: SAIKAKU_ATTEMPT_ID,
      uaamAttemptId: UAAM_ATTEMPT_ID,
      integration: { integration_score: 66, activation_core: 'Owner A', activation_equation: 'Owner A equation' },
      model: MODEL,
      source: { saikakuLabel: SAIKAKU_LABEL, uaamLabel: UAAM_LABEL },
      ownerId: ownerA,
    })).rejects.toBeInstanceOf(IntegrationConflictError);

    const afterA = (await integrationRef(uid, pairKey).get()).data();
    expect(afterA.integration.integration_score).toBe(91);
    expect(afterA.integration.activation_core).toBe('Owner B');
    expect(afterA.regenerationCount).toBe(0);
    expect(afterA.updatedAt.toMillis()).toBe(afterB.updatedAt.toMillis());
  });

  it.each([
    ['saikakuAttemptId', 'a/b'],
    ['saikakuAttemptId', 'a.b'],
    ['saikakuAttemptId', '..'],
    ['uaamAttemptId', '__reserved__'],
  ])('rejects invalid %s with 422 instead of a Firestore 500', async (field, value) => {
    const response = await postIntegrate('stub-token', { [field]: value });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      code: 'invalid_input',
      field,
    });
  });

  it('does not leak unexpected internal error messages to the client', async () => {
    const { idToken } = await seedReadyUser();
    process.env.MOCK_ANTHROPIC_FAIL = '1';

    const response = await postIntegrate(idToken);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      code: 'internal_error',
      requestId: expect.any(String),
    });
    expect(JSON.stringify(response.body)).not.toContain('mock LLM failure');
  });

  it('falls back to legacy parent-doc data when attempts subcollection is empty', async () => {
    const { uid, idToken } = await createAuthSession();
    const createdAt = Timestamp.fromDate(new Date('2026-04-01T00:00:00.000Z'));

    await Promise.all([
      db.collection('results').doc(uid).set({
        selectedKakuchiiki: SAIKAKU_LABEL,
        result: saikakuResult(),
        inputTalentTop5: '観察\n対話\n構造化\n伴走\n説明',
        inputValueTop5: '誠実\n成長\n貢献\n自由\n探究',
        inputPassionTop5: '教育\n対話\n旅\n創作\n起業',
        createdAt,
        updatedAt: createdAt,
      }),
      db.collection('uaam_results').doc(uid).set({
        scores: uaamScores(),
        analysis: uaamAnalysis(),
        createdAt,
        updatedAt: createdAt,
      }),
    ]);

    const response = await postIntegrate(idToken);

    expect(response.status).toBe(200);
    expect(response.body.saikakuAttemptId).toBe('legacy-fallback');
    expect(response.body.uaamAttemptId).toBe('legacy-fallback');
    expect(response.body.pairKey).toBe(buildPairKey('legacy-fallback', 'legacy-fallback'));
    expect(response.body.regenerationCount).toBe(0);

    const stored = await integrationRef(uid, response.body.pairKey).get();
    expect(stored.exists).toBe(true);
    expect(stored.data().saikakuAttemptId).toBe('legacy-fallback');
    expect(stored.data().uaamAttemptId).toBe('legacy-fallback');
  });
});
