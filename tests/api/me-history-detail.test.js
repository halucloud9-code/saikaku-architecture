import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../api/lib/firebaseAdmin.js';
import { buildPairKey } from '../../shared/integrationsKey.js';
import {
  Timestamp,
  api,
  clearUserState,
  seedAttempt,
  seedParent,
} from './_helpers.js';

function at(day) {
  return Timestamp.fromDate(new Date(`2026-05-0${day}T00:00:00.000Z`));
}

function uaamScores() {
  return {
    mindset: { total: 60 },
    literacy: { total: 62 },
    competency: { total: 64 },
    impact: { total: 66 },
  };
}

function uaamAnalysis(overrides = {}) {
  return {
    type_name: 'History UAAM',
    narrative: 'history analysis',
    ...overrides,
  };
}

function integrationBody(score, activationCore) {
  return {
    integration_score: score,
    activation_core: activationCore,
    activation_equation: `${activationCore} equation`,
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

async function seedUaamReadyUser(uid, attemptId = 'uaam-history') {
  await clearAllUserState(uid);
  await Promise.all([
    seedParent('results', uid, {
      latestAttemptId: 'saikaku-current',
      selectedKakuchiiki: 'Saikaku Current',
      result: { kakuchiiki: 'Saikaku Current' },
      createdAt: at(1),
    }),
    seedParent('uaam_results', uid, {
      latestAttemptId: 'uaam-current',
      scores: uaamScores(),
      analysis: uaamAnalysis(),
      createdAt: at(1),
    }),
    seedAttempt('uaam_results', uid, attemptId, {
      status: 'committed',
      createdAt: at(1),
      summary: { typeName: 'History UAAM', createdAt: at(1) },
      full: {
        scores: uaamScores(),
        analysis: uaamAnalysis(),
        name: 'History User',
      },
      raw: { input: { answers: { 1: 3 }, vAnswers: { V1: 4 } } },
    }),
  ]);
}

async function seedIntegration(uid, saikakuAttemptId, uaamAttemptId, overrides = {}) {
  const pairKey = buildPairKey(saikakuAttemptId, uaamAttemptId);
  const doc = {
    saikakuAttemptId,
    uaamAttemptId,
    regenerationCount: overrides.regenerationCount ?? 0,
    model: 'test-model',
    source: {
      saikakuLabel: `Saikaku ${saikakuAttemptId}`,
      uaamLabel: `UAAM ${uaamAttemptId}`,
    },
    status: 'active',
    createdAt: overrides.createdAt ?? at(1),
    updatedAt: overrides.updatedAt ?? overrides.createdAt ?? at(1),
  };
  if (!overrides.omitIntegration) {
    doc.integration = overrides.integration ?? integrationBody(88, 'Active Core');
  }
  await db.collection('uaam_results').doc(uid).collection('integrations').doc(pairKey).set(doc);
}

function mockSupportingReadsFail(uid) {
  const parentRef = db.collection('uaam_results').doc(uid);
  const saikakuParentRef = db.collection('results').doc(uid);
  const integrationsRef = parentRef.collection('integrations');
  const docGet = Object.getPrototypeOf(parentRef).get;
  const collectionGet = Object.getPrototypeOf(integrationsRef).get;

  vi.spyOn(Object.getPrototypeOf(parentRef), 'get').mockImplementation(function get(...args) {
    if (this.path === parentRef.path || this.path === saikakuParentRef.path) {
      throw new Error(`supporting doc read should not run: ${this.path}`);
    }
    return docGet.apply(this, args);
  });

  vi.spyOn(Object.getPrototypeOf(integrationsRef), 'get').mockImplementation(function get(...args) {
    if (this.path === integrationsRef.path) {
      throw new Error(`supporting integration read should not run: ${this.path}`);
    }
    return collectionGet.apply(this, args);
  });
}

describe('API /api/me/history/:id', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns full, raw, and summary for an existing attempt', async () => {
    const uid = 'u-me-history-detail-existing';
    await clearUserState('results', uid);
    const createdAt = Timestamp.fromDate(new Date('2026-05-01T12:34:56.000Z'));

    await seedAttempt('results', uid, 'attempt-1', {
      status: 'committed',
      createdAt,
      summary: { kakuchiiki: '問いに火を灯す人', typeName: null, createdAt },
      full: {
        result: { kakuchiiki: '問いに火を灯す人', createdAt },
        analysis: null,
        scores: null,
        selectedKakuchiiki: '問いに火を灯す人',
      },
      raw: { input: { nestedCreatedAt: createdAt } },
    });

    const response = await api.get('/api/me/history/attempt-1?kind=saikaku').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: 'attempt-1',
      status: 'committed',
      isLegacy: false,
      summary: { kakuchiiki: '問いに火を灯す人' },
      full: { result: { kakuchiiki: '問いに火を灯す人' } },
      raw: { input: {} },
    });
    expect(response.body.createdAt).toBe('2026-05-01T12:34:56.000Z');
    expect(response.body.summary.createdAt).toBe('2026-05-01T12:34:56.000Z');
    expect(response.body.full.result.createdAt).toBe('2026-05-01T12:34:56.000Z');
    expect(response.body.raw.input.nestedCreatedAt).toBe('2026-05-01T12:34:56.000Z');
  });

  it('returns 404 when id is not found', async () => {
    const uid = 'u-me-history-detail-missing';
    await clearUserState('results', uid);

    const response = await api.get('/api/me/history/missing?kind=saikaku').set('x-test-uid', uid);

    expect(response.status).toBe(404);
  });

  it('returns 404 for pending attempts', async () => {
    const uid = 'u-me-history-detail-pending';
    await clearUserState('results', uid);
    await seedAttempt('results', uid, 'pending-1', {
      status: 'pending',
      createdAt: Timestamp.fromDate(new Date('2026-05-01T00:00:00.000Z')),
      full: { result: { kakuchiiki: '未確定の結果' } },
    });

    const response = await api.get('/api/me/history/pending-1?kind=saikaku').set('x-test-uid', uid);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'attempt not found', code: 'not_found' });
  });

  it('returns 422 when id format is malformed', async () => {
    const response = await api.get('/api/me/history/bad$id?kind=saikaku').set('x-test-uid', 'u-me-history-detail-bad-id');

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ error: 'kind and id are required', code: 'invalid_input', field: 'id' });
  });

  it('synthesizes a legacy attempt when id is legacy-fallback and parent has data', async () => {
    const uid = 'u-me-history-detail-legacy';
    await clearUserState('uaam_results', uid);
    await seedParent('uaam_results', uid, {
      scores: { mindset: { total: 60 } },
      analysis: { type_name: 'Legacy UAAM' },
      answers: { 1: 3 },
      vAnswers: { V1: 4 },
      createdAt: Timestamp.fromDate(new Date('2026-05-02T00:00:00.000Z')),
    });

    const response = await api.get('/api/me/history/legacy-fallback?kind=uaam').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: 'legacy-fallback',
      status: 'committed',
      isLegacy: true,
      summary: { typeName: 'Legacy UAAM' },
      full: {
        result: null,
        analysis: { type_name: 'Legacy UAAM' },
        scores: { mindset: { total: 60 } },
      },
      raw: { input: { answers: { 1: 3 }, vAnswers: { V1: 4 } } },
    });
    expect(response.body.createdAt).toBe('2026-05-02T00:00:00.000Z');
    expect(response.body.summary.createdAt).toBe('2026-05-02T00:00:00.000Z');
  });

  it('returns JSON 500 when Firestore throws unexpectedly', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(db, 'collection').mockImplementation(() => {
      throw new Error('boom');
    });

    const response = await api.get('/api/me/history/attempt-1?kind=saikaku').set('x-test-uid', 'u-me-history-detail-error');

    expect(response.status).toBe(500);
    expect(response.type).toMatch(/json/);
    expect(response.body).toEqual({
      code: 'internal_error',
      requestId: expect.any(String),
    });
  });

  describe('UAAM recentIntegrationSummaries', () => {
    it('returns [] when there are no integration docs', async () => {
      const uid = 'u-me-history-detail-recent-none';
      await seedUaamReadyUser(uid);

      const response = await api.get('/api/me/history/uaam-history?kind=uaam').set('x-test-uid', uid);

      expect(response.status).toBe(200);
      expect(response.body.recentIntegrationSummaries).toEqual([]);
    });

    it('returns 404 for a missing attempt before supporting reads can fail', async () => {
      const uid = 'u-me-history-detail-recent-missing-short-circuit';
      await clearAllUserState(uid);
      mockSupportingReadsFail(uid);

      const response = await api.get('/api/me/history/missing-attempt?kind=uaam').set('x-test-uid', uid);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'attempt not found', code: 'not_found' });
    });

    it('returns the latest two summaries in generatedAt descending order with bodies and excludes body-missing docs', async () => {
      const uid = 'u-me-history-detail-recent-latest-two';
      await seedUaamReadyUser(uid);
      await seedIntegration(uid, 'saikaku-old-a', 'uaam-old-a', {
        integration: integrationBody(71, 'Old Core'),
        updatedAt: at(1),
      });
      await seedIntegration(uid, 'saikaku-old-b', 'uaam-old-b', {
        integration: integrationBody(93, 'Newest Core'),
        regenerationCount: 1,
        updatedAt: at(3),
      });
      await seedIntegration(uid, 'saikaku-old-c', 'uaam-old-c', {
        integration: integrationBody(82, 'Middle Core'),
        updatedAt: at(2),
      });
      await seedIntegration(uid, 'saikaku-old-d', 'uaam-old-d', {
        omitIntegration: true,
        updatedAt: at(4),
      });

      const response = await api.get('/api/me/history/uaam-history?kind=uaam').set('x-test-uid', uid);

      expect(response.status).toBe(200);
      expect(response.body.recentIntegrationSummaries).toHaveLength(2);
      expect(response.body.recentIntegrationSummaries.map((item) => item.generatedAt)).toEqual([
        '2026-05-03T00:00:00.000Z',
        '2026-05-02T00:00:00.000Z',
      ]);
      expect(response.body.recentIntegrationSummaries).toEqual([
        expect.objectContaining({
          exists: true,
          integrationScore: 93,
          activationCore: 'Newest Core',
          saikakuAttemptId: 'saikaku-old-b',
          uaamAttemptId: 'uaam-old-b',
          status: 'stale',
          regenerationCount: 1,
          source: { saikakuLabel: 'Saikaku saikaku-old-b', uaamLabel: 'UAAM uaam-old-b' },
          integration: integrationBody(93, 'Newest Core'),
        }),
        expect.objectContaining({
          exists: true,
          integrationScore: 82,
          activationCore: 'Middle Core',
          saikakuAttemptId: 'saikaku-old-c',
          uaamAttemptId: 'uaam-old-c',
          status: 'stale',
          regenerationCount: 0,
          source: { saikakuLabel: 'Saikaku saikaku-old-c', uaamLabel: 'UAAM uaam-old-c' },
          integration: integrationBody(82, 'Middle Core'),
        }),
      ]);
      expect(response.body.recentIntegrationSummaries).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ uaamAttemptId: 'uaam-old-d' }),
        ]),
      );
    });

    it('returns [] when the UAAM parent doc is missing even if orphaned subcollection docs exist', async () => {
      const uid = 'u-me-history-detail-recent-parent-missing';
      await clearAllUserState(uid);
      await seedAttempt('uaam_results', uid, 'uaam-history', {
        status: 'committed',
        createdAt: at(1),
        summary: { typeName: 'History UAAM', createdAt: at(1) },
        full: {
          scores: uaamScores(),
          analysis: uaamAnalysis(),
        },
        raw: { input: { answers: { 1: 3 }, vAnswers: { V1: 4 } } },
      });
      await seedIntegration(uid, 'saikaku-orphan', 'uaam-orphan', {
        integration: integrationBody(91, 'Orphan Core'),
        updatedAt: at(2),
      });

      const response = await api.get('/api/me/history/uaam-history?kind=uaam').set('x-test-uid', uid);

      expect(response.status).toBe(200);
      expect(response.body.recentIntegrationSummaries).toEqual([]);
    });

    it('includes a legacy fallback summary on the legacy-fallback detail path', async () => {
      const uid = 'u-me-history-detail-recent-legacy';
      await clearAllUserState(uid);
      await seedParent('uaam_results', uid, {
        scores: uaamScores(),
        analysis: uaamAnalysis({
          saikaku_attempt_label: 'Legacy Saikaku',
          uaam_attempt_label: 'Legacy UAAM',
          saikaku_integration: integrationBody(77, 'Legacy Core'),
        }),
        integrationUpdatedAt: at(3),
        createdAt: at(1),
      });

      const response = await api.get('/api/me/history/legacy-fallback?kind=uaam').set('x-test-uid', uid);

      expect(response.status).toBe(200);
      expect(response.body.recentIntegrationSummaries).toEqual([
        {
          exists: true,
          generatedAt: '2026-05-03T00:00:00.000Z',
          integrationScore: 77,
          activationCore: 'Legacy Core',
          saikakuAttemptId: 'legacy-fallback',
          uaamAttemptId: 'legacy-fallback',
          status: 'active',
          regenerationCount: 0,
          source: { saikakuLabel: 'Legacy Saikaku', uaamLabel: 'Legacy UAAM' },
          integration: integrationBody(77, 'Legacy Core'),
          isLegacyFallback: true,
        },
      ]);
    });

    it('does not include recentIntegrationSummaries for saikaku kind', async () => {
      const uid = 'u-me-history-detail-recent-saikaku-absent';
      await clearUserState('results', uid);
      await seedAttempt('results', uid, 'attempt-1', {
        status: 'committed',
        createdAt: at(1),
        summary: { kakuchiiki: '問いに火を灯す人', typeName: null, createdAt: at(1) },
        full: {
          result: { kakuchiiki: '問いに火を灯す人', createdAt: at(1) },
          analysis: null,
          scores: null,
          selectedKakuchiiki: '問いに火を灯す人',
        },
        raw: { input: {} },
      });

      const response = await api.get('/api/me/history/attempt-1?kind=saikaku').set('x-test-uid', uid);

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty('recentIntegrationSummaries');
    });
  });
});
