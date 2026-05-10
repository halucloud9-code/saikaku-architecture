import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.ADMIN_EMAILS = 'admin@example.com';
vi.resetModules();

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    verifyIdToken: async (token) => {
      if (token === 'admin-token') return { uid: 'admin-user', email: 'admin@example.com' };
      if (token === 'user-token') return { uid: 'normal-user', email: 'user@example.com' };
      throw new Error('invalid token');
    },
  }),
}));

const {
  Timestamp,
  api,
  clearUserState,
  seedParent,
} = await import('./_helpers.js');
const { db } = await import('../../api/lib/firebaseAdmin.js');
const { buildPairKey } = await import('../../shared/integrationsKey.js');

const ACTIVE_UID = 'u-admin-integrations-active';
const STALE_SAIKAKU_UID = 'u-admin-integrations-stale-saikaku';
const LEGACY_UID = 'u-admin-integrations-legacy';
const EMPTY_UID = 'u-admin-integrations-empty';
const FLAG_ONLY_UID = 'u-admin-integrations-flag-only';
const ROGUE_UID = 'u-admin-integrations-rogue';
const FIXTURE_UIDS = [
  ACTIVE_UID,
  STALE_SAIKAKU_UID,
  LEGACY_UID,
  EMPTY_UID,
  FLAG_ONLY_UID,
  ROGUE_UID,
];

const SAIKAKU_A = 'saikaku-a';
const SAIKAKU_B = 'saikaku-b';
const UAAM_A = 'uaam-a';
const UAAM_B = 'uaam-b';
const MODEL = 'claude-sonnet-4-20250514';
const COACHING_QID = 'admin-coaching-qid';

function at(day) {
  return Timestamp.fromDate(new Date(`2026-05-0${day}T00:00:00.000Z`));
}

function iso(day) {
  return `2026-05-0${day}T00:00:00.000Z`;
}

function integrationBody(score, activationCore) {
  return {
    integration_score: score,
    activation_core: activationCore,
    activation_equation: `${activationCore} equation`,
  };
}

async function deleteCollectionDocs(collectionRef) {
  const snap = await collectionRef.get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();
}

async function clearIntegrationDocs(uid) {
  await deleteCollectionDocs(db.collection('uaam_results').doc(uid).collection('integrations'));
}

async function clearAllUserState(uid) {
  await clearIntegrationDocs(uid);
  await Promise.all([
    clearUserState('results', uid),
    clearUserState('uaam_results', uid),
  ]);
}

async function clearFixtures() {
  await Promise.all(
    FIXTURE_UIDS
      .filter((uid) => uid !== ROGUE_UID)
      .map(clearAllUserState)
  );
  await deleteCollectionDocs(db.collection('other_results').doc(ROGUE_UID).collection('integrations'));
  await db.collection('other_results').doc(ROGUE_UID).delete();
}

async function seedIntegration(uid, saikakuAttemptId, uaamAttemptId, overrides = {}) {
  const pairKey = buildPairKey(saikakuAttemptId, uaamAttemptId);
  await db.collection('uaam_results').doc(uid).collection('integrations').doc(pairKey).set({
    saikakuAttemptId,
    uaamAttemptId,
    integration: overrides.integration ?? integrationBody(88, 'Active Core'),
    regenerationCount: overrides.regenerationCount ?? 0,
    model: MODEL,
    source: {
      saikakuLabel: `Saikaku ${saikakuAttemptId}`,
      uaamLabel: `UAAM ${uaamAttemptId}`,
    },
    status: 'active',
    createdAt: overrides.createdAt,
    updatedAt: overrides.updatedAt ?? overrides.createdAt,
  });
}

async function seedAdminDataset() {
  await Promise.all([
    seedParent('results', ACTIVE_UID, {
      uid: ACTIVE_UID,
      name: 'Saikaku Active Name',
      email: 'saikaku-active@example.com',
      latestAttemptId: SAIKAKU_A,
    }),
    seedParent('uaam_results', ACTIVE_UID, {
      uid: ACTIVE_UID,
      name: 'UAAM Active Name',
      email: 'uaam-active@example.com',
      latestAttemptId: UAAM_B,
      coaching_answers: {
        [COACHING_QID]: {
          questionText: 'Admin API coaching question',
          answer: 'Admin API coaching answer',
          answeredAt: at(1),
          updatedAt: at(4),
        },
      },
    }),
    seedParent('results', STALE_SAIKAKU_UID, {
      uid: STALE_SAIKAKU_UID,
      name: 'Stale Saikaku Name',
      email: 'stale-saikaku@example.com',
      latestAttemptId: SAIKAKU_B,
    }),
    seedParent('uaam_results', STALE_SAIKAKU_UID, {
      uid: STALE_SAIKAKU_UID,
      latestAttemptId: UAAM_A,
    }),
    seedParent('results', LEGACY_UID, {
      uid: LEGACY_UID,
      name: 'Legacy Result Name',
      email: 'legacy-result@example.com',
      latestAttemptId: SAIKAKU_B,
    }),
    seedParent('uaam_results', LEGACY_UID, {
      uid: LEGACY_UID,
      name: 'Legacy UAAM Name',
      email: 'legacy-uaam@example.com',
      latestAttemptId: UAAM_B,
      analysis: {
        type_name: 'Legacy Type',
        saikaku_attempt_label: 'Legacy Saikaku',
        uaam_attempt_label: 'Legacy UAAM',
        saikaku_integration: integrationBody(77, 'Legacy Core'),
      },
      integrationUpdatedAt: at(5),
    }),
    seedParent('results', EMPTY_UID, {
      uid: EMPTY_UID,
      latestAttemptId: SAIKAKU_A,
    }),
    seedParent('uaam_results', EMPTY_UID, {
      uid: EMPTY_UID,
      latestAttemptId: UAAM_A,
      analysis: { type_name: 'No Integration' },
    }),
    seedParent('uaam_results', FLAG_ONLY_UID, {
      uid: FLAG_ONLY_UID,
      latestAttemptId: UAAM_A,
      hasSaikakuIntegration: true,
      analysis: { type_name: 'Flag Only' },
    }),
  ]);

  await Promise.all([
    seedIntegration(ACTIVE_UID, SAIKAKU_A, UAAM_A, {
      integration: integrationBody(81, 'Older UAAM Pair'),
      createdAt: at(2),
      regenerationCount: 0,
    }),
    seedIntegration(ACTIVE_UID, SAIKAKU_A, UAAM_B, {
      integration: integrationBody(92, 'Latest Pair'),
      createdAt: at(4),
      regenerationCount: 1,
    }),
    seedIntegration(STALE_SAIKAKU_UID, SAIKAKU_A, UAAM_A, {
      integration: integrationBody(63, 'Stale Saikaku Pair'),
      createdAt: at(3),
    }),
    db.collection('other_results').doc(ROGUE_UID).collection('integrations').doc('rogue').set({
      saikakuAttemptId: SAIKAKU_A,
      uaamAttemptId: UAAM_A,
      integration: integrationBody(99, 'Rogue Namespace'),
      createdAt: at(6),
    }),
  ]);
}

function authGet() {
  return api.get('/api/admin/integrations').set('Authorization', 'Bearer admin-token');
}

describe('API /api/admin/integrations', () => {
  beforeEach(async () => {
    await clearFixtures();
  });

  afterEach(async () => {
    await clearFixtures();
  });

  it('returns integration analyses sorted by createdAt desc with dynamic stale flags and legacy fallback', async () => {
    await seedAdminDataset();

    const response = await authGet();

    expect(response.status).toBe(200);
    const fixtureItems = response.body.integrations.filter((item) => FIXTURE_UIDS.includes(item.uid));
    expect(response.body.total).toBe(response.body.integrations.length);
    expect(fixtureItems).toHaveLength(4);
    expect(fixtureItems.map((item) => `${item.uid}:${item.pairKey}`)).toEqual([
      `${LEGACY_UID}:legacy-fallback__legacy-fallback`,
      `${ACTIVE_UID}:${buildPairKey(SAIKAKU_A, UAAM_B)}`,
      `${STALE_SAIKAKU_UID}:${buildPairKey(SAIKAKU_A, UAAM_A)}`,
      `${ACTIVE_UID}:${buildPairKey(SAIKAKU_A, UAAM_A)}`,
    ]);

    const legacy = fixtureItems[0];
    expect(legacy).toEqual({
      uid: LEGACY_UID,
      userName: 'Legacy UAAM Name',
      userEmail: 'legacy-uaam@example.com',
      saikakuAttemptId: 'legacy-fallback',
      uaamAttemptId: 'legacy-fallback',
      pairKey: 'legacy-fallback__legacy-fallback',
      regenerationCount: 0,
      model: 'unknown-legacy',
      source: { saikakuLabel: 'Legacy Saikaku', uaamLabel: 'Legacy UAAM' },
      status: 'active',
      staleSaikaku: false,
      staleUaam: false,
      coachingAnswers: {},
      integration: integrationBody(77, 'Legacy Core'),
      createdAt: iso(5),
      updatedAt: iso(5),
      isLegacyFallback: true,
    });

    const latestPair = fixtureItems[1];
    expect(latestPair).toMatchObject({
      uid: ACTIVE_UID,
      userName: 'UAAM Active Name',
      userEmail: 'uaam-active@example.com',
      saikakuAttemptId: SAIKAKU_A,
      uaamAttemptId: UAAM_B,
      regenerationCount: 1,
      model: MODEL,
      status: 'active',
      staleSaikaku: false,
      staleUaam: false,
      coachingAnswers: {
        [COACHING_QID]: {
          questionText: 'Admin API coaching question',
          answer: 'Admin API coaching answer',
          answeredAt: { _seconds: 1777593600, _nanoseconds: 0 },
          updatedAt: { _seconds: 1777852800, _nanoseconds: 0 },
        },
      },
      integration: integrationBody(92, 'Latest Pair'),
      createdAt: iso(4),
      updatedAt: iso(4),
      isLegacyFallback: false,
    });

    const staleSaikaku = fixtureItems[2];
    expect(staleSaikaku).toMatchObject({
      uid: STALE_SAIKAKU_UID,
      status: 'stale',
      staleSaikaku: true,
      staleUaam: false,
      coachingAnswers: {},
      createdAt: iso(3),
    });

    const staleUaam = fixtureItems[3];
    expect(staleUaam).toMatchObject({
      uid: ACTIVE_UID,
      status: 'stale',
      staleSaikaku: false,
      staleUaam: true,
      regenerationCount: 0,
      coachingAnswers: {
        [COACHING_QID]: {
          questionText: 'Admin API coaching question',
          answer: 'Admin API coaching answer',
        },
      },
      createdAt: iso(2),
    });

    const uids = fixtureItems.map((item) => item.uid);
    expect(uids).not.toContain(EMPTY_UID);
    expect(uids).not.toContain(FLAG_ONLY_UID);
    expect(uids).not.toContain(ROGUE_UID);
  });

  it('returns 401 when Authorization is missing', async () => {
    const response = await api.get('/api/admin/integrations');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: '認証が必要です' });
  });

  it('returns 403 when the token email is not an admin', async () => {
    const response = await api
      .get('/api/admin/integrations')
      .set('Authorization', 'Bearer user-token');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: '管理者権限が必要です' });
  });

  it('returns 405 for non-GET methods', async () => {
    const response = await api.post('/api/admin/integrations').send({});

    expect(response.status).toBe(405);
  });
});
