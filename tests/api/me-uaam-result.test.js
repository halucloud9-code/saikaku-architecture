import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../api/lib/firebaseAdmin.js';
import { buildPairKey } from '../../shared/integrationsKey.js';
import {
  Timestamp,
  api,
  clearUserState,
  seedParent,
} from './_helpers.js';

const SAIKAKU_CURRENT = 'saikaku-current';
const UAAM_CURRENT = 'uaam-current';

function at(day) {
  return Timestamp.fromDate(new Date(`2026-05-0${day}T00:00:00.000Z`));
}

function scores() {
  return {
    mindset: { total: 60 },
    literacy: { total: 62 },
    competency: { total: 64 },
    impact: { total: 66 },
  };
}

function analysis() {
  return {
    type_name: '実装する案内人',
    narrative: 'analysis',
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

async function seedReadyUser(uid, overrides = {}) {
  await clearAllUserState(uid);
  await Promise.all([
    seedParent('results', uid, {
      latestAttemptId: overrides.latestSaikakuAttemptId ?? SAIKAKU_CURRENT,
      selectedKakuchiiki: 'Saikaku Current',
      result: { kakuchiiki: 'Saikaku Current' },
      createdAt: at(1),
    }),
    seedParent('uaam_results', uid, {
      latestAttemptId: overrides.latestUaamAttemptId ?? UAAM_CURRENT,
      scores: overrides.scores ?? scores(),
      analysis: overrides.analysis ?? analysis(),
      createdAt: at(1),
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

describe('API /api/me/uaam-result', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns scores and analysis from parent', async () => {
    const uid = 'u-me-uaam-result-existing';
    const scores = { mindset: { total: 60 } };
    const analysis = { type_name: '実装する案内人', narrative: 'analysis' };
    await clearUserState('uaam_results', uid);
    await seedParent('uaam_results', uid, { scores, analysis });

    const response = await api.get('/api/me/uaam-result').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ scores, analysis, recentIntegrationSummaries: [] });
  });

  it('returns null scores and analysis when parent is absent', async () => {
    const uid = 'u-me-uaam-result-absent';
    await clearUserState('uaam_results', uid);

    const response = await api.get('/api/me/uaam-result').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ scores: null, analysis: null, recentIntegrationSummaries: [] });
  });

  it('returns empty recentIntegrationSummaries when parent is absent but orphaned subcollection docs exist', async () => {
    // Firestore は親 doc 削除時に subcollection を残すため、orphaned integration が
    // 残存しているケース。「結果は無い」状態と整合させるため空配列で返すこと。
    const uid = 'u-me-uaam-result-absent-with-orphans';
    await clearAllUserState(uid);
    await seedIntegration(uid, 'saikaku-orphan-a', 'uaam-orphan-a', {
      integration: integrationBody(91, 'Orphan Core A'),
      updatedAt: at(2),
    });
    await seedIntegration(uid, 'saikaku-orphan-b', 'uaam-orphan-b', {
      integration: integrationBody(82, 'Orphan Core B'),
      updatedAt: at(1),
    });

    const response = await api.get('/api/me/uaam-result').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ scores: null, analysis: null, recentIntegrationSummaries: [] });
  });

  it('returns null scores and analysis when saved result data is partial', async () => {
    const uid = 'u-me-uaam-result-partial';
    await clearUserState('uaam_results', uid);
    await seedParent('uaam_results', uid, { scores: { mindset: { total: 60 } } });

    const response = await api.get('/api/me/uaam-result').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ scores: null, analysis: null, recentIntegrationSummaries: [] });
  });

  it.each(['a/b', 'a.b', '..', '__reserved__'])(
    'returns 422 for invalid attemptId %s without a Firestore path error',
    async (attemptId) => {
      const response = await api
        .get(`/api/me/uaam-result?attemptId=${encodeURIComponent(attemptId)}`)
        .set('x-test-uid', 'u-me-uaam-result-invalid-attempt');

      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({
        code: 'invalid_input',
        field: 'attemptId',
      });
    },
  );

  it('returns JSON 500 when Firestore throws unexpectedly', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(db, 'collection').mockImplementation(() => {
      throw new Error('boom');
    });

    const response = await api.get('/api/me/uaam-result').set('x-test-uid', 'u-me-uaam-result-error');

    expect(response.status).toBe(500);
    expect(response.type).toMatch(/json/);
    expect(response.body).toEqual({
      code: 'internal_error',
      requestId: expect.any(String),
    });
  });

  it('returns 404 for a missing requested attempt before supporting reads can fail', async () => {
    const uid = 'u-me-uaam-result-missing-attempt-short-circuit';
    await clearAllUserState(uid);
    mockSupportingReadsFail(uid);

    const response = await api.get('/api/me/uaam-result?attemptId=missing-attempt').set('x-test-uid', uid);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'attempt not found', code: 'not_found' });
  });

  describe('recentIntegrationSummaries', () => {
    it('returns the latest two summaries in generatedAt descending order with bodies and excludes body-missing docs', async () => {
      const uid = 'u-me-uaam-result-recent-latest-two';
      await seedReadyUser(uid);
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

      const response = await api.get('/api/me/uaam-result').set('x-test-uid', uid);

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

    it('returns [] when there are no integration docs', async () => {
      const uid = 'u-me-uaam-result-recent-none';
      await seedReadyUser(uid);

      const response = await api.get('/api/me/uaam-result').set('x-test-uid', uid);

      expect(response.status).toBe(200);
      expect(response.body.recentIntegrationSummaries).toEqual([]);
    });

    it('returns [] when all integration docs are missing bodies', async () => {
      const uid = 'u-me-uaam-result-recent-all-body-missing';
      await seedReadyUser(uid);
      await seedIntegration(uid, 'saikaku-old-a', 'uaam-old-a', {
        omitIntegration: true,
        updatedAt: at(1),
      });
      await seedIntegration(uid, 'saikaku-old-b', 'uaam-old-b', {
        omitIntegration: true,
        updatedAt: at(2),
      });

      const response = await api.get('/api/me/uaam-result').set('x-test-uid', uid);

      expect(response.status).toBe(200);
      expect(response.body.recentIntegrationSummaries).toEqual([]);
    });

    it('includes a legacy fallback summary with isLegacyFallback true', async () => {
      const uid = 'u-me-uaam-result-recent-legacy';
      await clearAllUserState(uid);
      await seedParent('uaam_results', uid, {
        scores: scores(),
        analysis: {
          ...analysis(),
          saikaku_attempt_label: 'Legacy Saikaku',
          uaam_attempt_label: 'Legacy UAAM',
          saikaku_integration: integrationBody(77, 'Legacy Core'),
        },
        integrationUpdatedAt: at(3),
        createdAt: at(1),
      });

      const response = await api.get('/api/me/uaam-result').set('x-test-uid', uid);

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
  });
});
