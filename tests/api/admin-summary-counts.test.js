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

const SAIKAKU_UIDS = ['s-today-1', 's-yesterday-1', 's-old-1'];
const UAAM_UIDS = ['u-today-1', 'u-yesterday-1', 'u-updated-only'];

function ts(iso) {
  return Timestamp.fromDate(new Date(iso));
}

async function deleteQueryDocs(query) {
  const snap = await query.get();
  if (snap.empty) return;

  let batch = db.batch();
  let count = 0;
  for (const docSnap of snap.docs) {
    batch.delete(docSnap.ref);
    count += 1;
    if (count === 500) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }
  if (count > 0) await batch.commit();
}

async function clearCountedData() {
  await deleteQueryDocs(db.collectionGroup('integrations'));
  await Promise.all([
    deleteQueryDocs(db.collection('results')),
    deleteQueryDocs(db.collection('uaam_results')),
  ]);
}

async function clearIntegrationDocs(uid) {
  await deleteQueryDocs(db.collection('uaam_results').doc(uid).collection('integrations'));
}

async function clearFixtures() {
  await Promise.all(UAAM_UIDS.map(clearIntegrationDocs));
  await Promise.all([
    ...SAIKAKU_UIDS.map((uid) => clearUserState('results', uid)),
    ...UAAM_UIDS.map((uid) => clearUserState('uaam_results', uid)),
  ]);
}

async function seedIntegration(uid, pairKey, createdAt) {
  await db.collection('uaam_results').doc(uid).collection('integrations').doc(pairKey).set({
    saikakuAttemptId: `saikaku-${pairKey}`,
    uaamAttemptId: `uaam-${pairKey}`,
    integration: { integration_score: 80, activation_core: pairKey },
    status: 'active',
    createdAt: ts(createdAt),
    updatedAt: ts(createdAt),
  });
}

async function seedSummaryDataset() {
  await Promise.all([
    seedParent('results', 's-today-1', {
      uid: 's-today-1',
      createdAt: ts('2026-05-12T00:00:00Z'),
    }),
    seedParent('results', 's-yesterday-1', {
      uid: 's-yesterday-1',
      createdAt: ts('2026-05-11T10:00:00Z'),
    }),
    seedParent('results', 's-old-1', {
      uid: 's-old-1',
      createdAt: ts('2026-04-30T00:00:00Z'),
    }),
    seedParent('uaam_results', 'u-today-1', {
      uid: 'u-today-1',
      createdAt: ts('2026-05-12T02:00:00Z'),
      updatedAt: ts('2026-05-12T02:00:00Z'),
    }),
    seedParent('uaam_results', 'u-yesterday-1', {
      uid: 'u-yesterday-1',
      createdAt: ts('2026-05-10T00:00:00Z'),
      updatedAt: ts('2026-05-10T00:00:00Z'),
    }),
    seedParent('uaam_results', 'u-updated-only', {
      uid: 'u-updated-only',
      createdAt: ts('2026-04-15T00:00:00Z'),
      updatedAt: ts('2026-05-12T00:00:00Z'),
    }),
  ]);

  await Promise.all([
    seedIntegration('u-today-1', 'pairKey1', '2026-05-12T02:00:00Z'),
    seedIntegration('u-today-1', 'pairKey2', '2026-05-11T05:00:00Z'),
    seedIntegration('u-yesterday-1', 'pairKey3', '2026-04-29T00:00:00Z'),
  ]);
}

function authGet() {
  return api.get('/api/admin/summary-counts').set('Authorization', 'Bearer admin-token');
}

describe('API /api/admin/summary-counts', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-05-12T03:00:00Z'));
    await clearCountedData();
    await clearFixtures();
  });

  afterEach(async () => {
    await clearFixtures();
    vi.useRealTimers();
  });

  it('returns today and thisWeek counts aggregated across 3 collections', async () => {
    await seedSummaryDataset();

    const response = await authGet();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      today: 3,
      thisWeek: 6,
      breakdown: {
        saikaku: { today: 1, thisWeek: 2 },
        uaam: { today: 1, thisWeek: 2 },
        integrations: { today: 1, thisWeek: 2 },
      },
    });
  });

  it('counts each pair separately for integrations', async () => {
    await seedSummaryDataset();

    const response = await authGet();

    expect(response.status).toBe(200);
    expect(response.body.breakdown.integrations).toEqual({ today: 1, thisWeek: 2 });
  });

  it('does not count uaam updated today when createdAt is older', async () => {
    await seedSummaryDataset();

    const response = await authGet();

    expect(response.status).toBe(200);
    expect(response.body.breakdown.uaam).toEqual({ today: 1, thisWeek: 2 });
  });

  it('returns 401 when Authorization is missing', async () => {
    const response = await api.get('/api/admin/summary-counts');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: '認証が必要です' });
  });

  it('returns 403 when token email is not admin', async () => {
    const response = await api
      .get('/api/admin/summary-counts')
      .set('Authorization', 'Bearer user-token');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: '管理者権限が必要です' });
  });

  it('returns 405 for non-GET methods', async () => {
    const response = await api.post('/api/admin/summary-counts').send({});

    expect(response.status).toBe(405);
  });
});
