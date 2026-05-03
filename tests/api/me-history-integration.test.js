import { describe, expect, it } from 'vitest';
import { db } from '../../api/lib/firebaseAdmin.js';
import { buildPairKey } from '../../shared/integrationsKey.js';
import {
  Timestamp,
  api,
  clearUserState,
  seedAttempt,
  seedParent,
} from './_helpers.js';

const SAIKAKU_A = 'saikaku-a';
const SAIKAKU_B = 'saikaku-b';
const UAAM_A = 'uaam-a';
const UAAM_B = 'uaam-b';
const GENERATED_AT = Timestamp.fromDate(new Date('2026-05-03T12:00:00.000Z'));

function at(day) {
  return Timestamp.fromDate(new Date(`2026-05-0${day}T00:00:00.000Z`));
}

function integrationBody(score = 88, activationCore = 'Active Core') {
  return {
    integration_score: score,
    activation_core: activationCore,
    activation_equation: `${activationCore} equation`,
  };
}

function scoresFor(id) {
  return {
    mindset: { total: id === UAAM_A ? 61 : 72 },
    literacy: { total: 60 },
    competency: { total: 70 },
    impact: { total: 80 },
  };
}

function analysisFor(id) {
  return {
    type_name: `UAAM ${id}`,
    narrative: `Analysis for ${id}`,
  };
}

async function clearIntegrationDocs(uid) {
  const snap = await db.collection('uaam_results').doc(uid).collection('integrations').get();
  if (snap.empty) return;

  const batch = db.batch();
  snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();
}

async function clearAllUserState(uid) {
  await clearIntegrationDocs(uid);
  await Promise.all([
    clearUserState('results', uid),
    clearUserState('uaam_results', uid),
  ]);
}

async function seedReadyUser(uid, options = {}) {
  await clearAllUserState(uid);

  const saikakuAttemptIds = options.saikakuAttemptIds ?? [SAIKAKU_A];
  const uaamAttemptIds = options.uaamAttemptIds ?? [UAAM_A];
  const latestSaikakuAttemptId = options.latestSaikakuAttemptId ?? saikakuAttemptIds.at(-1);
  const latestUaamAttemptId = options.latestUaamAttemptId ?? uaamAttemptIds.at(-1);

  await Promise.all([
    seedParent('results', uid, {
      latestAttemptId: latestSaikakuAttemptId,
      attemptCount: saikakuAttemptIds.length,
      pendingAttemptId: null,
      selectedKakuchiiki: 'Saikaku Label',
      result: { kakuchiiki: 'Saikaku Label' },
      createdAt: at(1),
    }),
    seedParent('uaam_results', uid, {
      latestAttemptId: latestUaamAttemptId,
      attemptCount: uaamAttemptIds.length,
      pendingAttemptId: null,
      scores: scoresFor(latestUaamAttemptId),
      analysis: analysisFor(latestUaamAttemptId),
      createdAt: at(1),
    }),
  ]);

  await Promise.all([
    ...saikakuAttemptIds.map((attemptId, index) => seedAttempt('results', uid, attemptId, {
      status: 'committed',
      createdAt: at(index + 1),
      summary: { kakuchiiki: `Saikaku ${attemptId}`, createdAt: at(index + 1) },
      full: {
        result: { kakuchiiki: `Saikaku ${attemptId}` },
        analysis: null,
        scores: null,
        selectedKakuchiiki: `Saikaku ${attemptId}`,
      },
      raw: { input: {} },
    })),
    ...uaamAttemptIds.map((attemptId, index) => seedAttempt('uaam_results', uid, attemptId, {
      status: 'committed',
      createdAt: at(index + 1),
      summary: { typeName: `UAAM ${attemptId}`, createdAt: at(index + 1) },
      full: {
        result: null,
        analysis: analysisFor(attemptId),
        scores: scoresFor(attemptId),
      },
      raw: { input: { answers: {}, vAnswers: {} } },
    })),
  ]);
}

async function seedIntegration(uid, saikakuAttemptId, uaamAttemptId, overrides = {}) {
  const pairKey = buildPairKey(saikakuAttemptId, uaamAttemptId);
  const body = overrides.integration ?? integrationBody();
  await db.collection('uaam_results').doc(uid).collection('integrations').doc(pairKey).set({
    saikakuAttemptId,
    uaamAttemptId,
    integration: body,
    regenerationCount: overrides.regenerationCount ?? 0,
    model: 'claude-sonnet-4-20250514',
    source: { saikakuLabel: `Saikaku ${saikakuAttemptId}`, uaamLabel: `UAAM ${uaamAttemptId}` },
    status: 'active',
    createdAt: overrides.createdAt ?? GENERATED_AT,
    updatedAt: overrides.updatedAt ?? GENERATED_AT,
  });
}

async function seedLegacyUaamParent(uid, mode) {
  await clearAllUserState(uid);

  const body = integrationBody(77, mode === 'literal' ? 'Literal Core' : 'Nested Core');
  const data = {
    scores: scoresFor(UAAM_A),
    analysis: { type_name: 'Legacy UAAM', narrative: 'legacy' },
    integrationUpdatedAt: GENERATED_AT,
    createdAt: at(1),
  };

  if (mode === 'literal') {
    data['analysis.saikaku_integration'] = body;
  } else {
    data.analysis.saikaku_integration = body;
  }

  await seedParent('uaam_results', uid, data);
}

describe('API /api/me history integration summaries', () => {
  it('returns an active UAAM integrationSummary from the subcollection', async () => {
    const uid = 'u-me-history-integration-active';
    await seedReadyUser(uid);
    await seedIntegration(uid, SAIKAKU_A, UAAM_A, {
      integration: integrationBody(91, 'Active Pair'),
    });

    const response = await api.get('/api/me/history?kind=uaam').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body.attempts).toHaveLength(1);
    expect(response.body.attempts[0].integrationSummary).toEqual({
      exists: true,
      generatedAt: '2026-05-03T12:00:00.000Z',
      integrationScore: 91,
      activationCore: 'Active Pair',
      saikakuAttemptId: SAIKAKU_A,
      uaamAttemptId: UAAM_A,
      status: 'active',
      regenerationCount: 0,
    });
  });

  it('marks a UAAM integrationSummary stale when Saikaku latestAttemptId has moved on', async () => {
    const uid = 'u-me-history-integration-stale';
    await seedReadyUser(uid, {
      saikakuAttemptIds: [SAIKAKU_A, SAIKAKU_B],
      latestSaikakuAttemptId: SAIKAKU_B,
    });
    await seedIntegration(uid, SAIKAKU_A, UAAM_A);

    const response = await api.get('/api/me/history?kind=uaam').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body.attempts[0].integrationSummary.status).toBe('stale');
    expect(response.body.attempts[0].integrationSummary.saikakuAttemptId).toBe(SAIKAKU_A);
  });

  it('synthesizes a legacy fallback summary from nested parent-doc integration data', async () => {
    const uid = 'u-me-history-integration-legacy-nested';
    await seedLegacyUaamParent(uid, 'nested');

    const response = await api.get('/api/me/history?kind=uaam').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body.attempts).toHaveLength(1);
    expect(response.body.attempts[0].id).toBe('legacy-fallback');
    expect(response.body.attempts[0].integrationSummary).toMatchObject({
      exists: true,
      generatedAt: '2026-05-03T12:00:00.000Z',
      integrationScore: 77,
      activationCore: 'Nested Core',
      saikakuAttemptId: 'legacy-fallback',
      uaamAttemptId: 'legacy-fallback',
      status: 'active',
      regenerationCount: 0,
    });
  });

  it('synthesizes a legacy fallback summary from literal dotted parent-doc integration data', async () => {
    const uid = 'u-me-history-integration-legacy-literal';
    await seedLegacyUaamParent(uid, 'literal');

    const response = await api.get('/api/me/history?kind=uaam').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body.attempts).toHaveLength(1);
    expect(response.body.attempts[0].id).toBe('legacy-fallback');
    expect(response.body.attempts[0].integrationSummary).toMatchObject({
      exists: true,
      integrationScore: 77,
      activationCore: 'Literal Core',
      saikakuAttemptId: 'legacy-fallback',
      uaamAttemptId: 'legacy-fallback',
      status: 'active',
      regenerationCount: 0,
    });
  });

  it('returns null integrationSummary without a 500 when neither source exists', async () => {
    const uid = 'u-me-history-integration-empty';
    await seedReadyUser(uid);

    const response = await api.get('/api/me/history?kind=uaam').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body.attempts).toHaveLength(1);
    expect(response.body.attempts[0].integrationSummary).toBeNull();
  });

  it('returns all matching integrationSummaries for a Saikaku attempt', async () => {
    const uid = 'u-me-history-integration-saikaku';
    await seedReadyUser(uid, {
      uaamAttemptIds: [UAAM_A, UAAM_B],
      latestUaamAttemptId: UAAM_B,
    });
    await seedIntegration(uid, SAIKAKU_A, UAAM_A, {
      integration: integrationBody(81, 'First UAAM'),
    });
    await seedIntegration(uid, SAIKAKU_A, UAAM_B, {
      integration: integrationBody(92, 'Second UAAM'),
      regenerationCount: 1,
    });

    const response = await api.get('/api/me/history?kind=saikaku').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    const attempt = response.body.attempts.find((item) => item.id === SAIKAKU_A);
    expect(attempt.integrationSummaries).toHaveLength(2);
    expect(attempt.integrationSummaries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        saikakuAttemptId: SAIKAKU_A,
        uaamAttemptId: UAAM_A,
        integrationScore: 81,
        activationCore: 'First UAAM',
        status: 'stale',
      }),
      expect.objectContaining({
        saikakuAttemptId: SAIKAKU_A,
        uaamAttemptId: UAAM_B,
        integrationScore: 92,
        activationCore: 'Second UAAM',
        status: 'active',
        regenerationCount: 1,
      }),
    ]));
  });

  it('returns the single matching UAAM integrationSummary when attemptId is queried', async () => {
    const uid = 'u-me-history-integration-uaam-result-attempt';
    await seedReadyUser(uid, {
      uaamAttemptIds: [UAAM_A, UAAM_B],
      latestUaamAttemptId: UAAM_B,
    });
    await seedIntegration(uid, SAIKAKU_A, UAAM_A, {
      integration: integrationBody(71, 'Queried Attempt'),
    });
    await seedIntegration(uid, SAIKAKU_A, UAAM_B, {
      integration: integrationBody(99, 'Latest Attempt'),
    });

    const response = await api.get(`/api/me/uaam-result?attemptId=${UAAM_A}`).set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body.analysis.type_name).toBe(`UAAM ${UAAM_A}`);
    expect(response.body.analysis.saikaku_integration).toMatchObject({
      integration_score: 71,
      activation_core: 'Queried Attempt',
    });
    expect(response.body.integrationSummary).toEqual({
      exists: true,
      generatedAt: '2026-05-03T12:00:00.000Z',
      integrationScore: 71,
      activationCore: 'Queried Attempt',
      saikakuAttemptId: SAIKAKU_A,
      uaamAttemptId: UAAM_A,
      status: 'active',
      regenerationCount: 0,
    });
  });
});
