import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../api/lib/firebaseAdmin.js';
import {
  Timestamp,
  api,
  clearUserState,
  legacySaikakuParent,
  seedAttempt,
  seedParent,
} from './_helpers.js';

describe('API /api/me/history', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty attempts for a new uid', async () => {
    const uid = 'u-me-history-empty';
    await clearUserState('results', uid);
    await clearUserState('uaam_results', uid);

    const response = await api.get('/api/me/history?kind=saikaku').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ attempts: [] });
  });

  it('returns one legacy attempt when parent has result data and no committed attempts', async () => {
    const uid = 'u-me-history-legacy';
    await clearUserState('results', uid);
    await seedParent('results', uid, legacySaikakuParent());

    const response = await api.get('/api/me/history?kind=saikaku').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body.attempts).toHaveLength(1);
    expect(response.body.attempts[0]).toMatchObject({
      id: 'legacy-fallback',
      isLegacy: true,
      status: 'committed',
      summary: { kakuchiiki: '問いに火を灯す人' },
    });
    expect(typeof response.body.attempts[0].createdAt).toBe('string');
    expect(response.body.attempts[0]).not.toHaveProperty('full');
    expect(response.body.attempts[0]).not.toHaveProperty('raw');
  });

  it('returns committed attempts in descending order with summary backfilled from full.analysis.type_name', async () => {
    const uid = 'u-me-history-order';
    await clearUserState('uaam_results', uid);
    const older = Timestamp.fromDate(new Date('2026-05-01T00:00:00.000Z'));
    const newer = Timestamp.fromDate(new Date('2026-05-02T00:00:00.000Z'));
    const newestPending = Timestamp.fromDate(new Date('2026-05-03T00:00:00.000Z'));

    await seedParent('uaam_results', uid, { attemptCount: 2, createdAt: older });
    await seedAttempt('uaam_results', uid, 'older', {
      status: 'committed',
      createdAt: older,
      full: { analysis: { type_name: 'Older Type' }, scores: { mindset: { total: 50 } } },
    });
    await seedAttempt('uaam_results', uid, 'newer', {
      status: 'committed',
      createdAt: newer,
      summary: {},
      full: { analysis: { type_name: 'Newer Type' }, scores: { mindset: { total: 60 } } },
      raw: { input: { answers: { 1: 3 } } },
    });
    await seedAttempt('uaam_results', uid, 'pending', {
      status: 'pending',
      createdAt: newestPending,
      full: { analysis: { type_name: 'Pending Type' } },
    });

    const response = await api.get('/api/me/history?kind=uaam').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body.attempts.map((attempt) => attempt.id)).toEqual(['newer', 'older']);
    expect(response.body.attempts[0].summary.typeName).toBe('Newer Type');
    expect(response.body.attempts[1].summary.typeName).toBe('Older Type');
    expect(response.body.attempts[0].createdAt).toBe('2026-05-02T00:00:00.000Z');
    expect(response.body.attempts[0].summary.createdAt).toBe('2026-05-02T00:00:00.000Z');
    expect(response.body.attempts[0]).not.toHaveProperty('full');
    expect(response.body.attempts[0]).not.toHaveProperty('raw');
  });

  it('returns 422 when kind is missing or invalid', async () => {
    const uid = 'u-me-history-invalid-kind';

    const missing = await api.get('/api/me/history').set('x-test-uid', uid);
    const invalid = await api.get('/api/me/history?kind=other').set('x-test-uid', uid);

    expect(missing.status).toBe(422);
    expect(invalid.status).toBe(422);
  });

  it('returns JSON 500 when Firestore throws unexpectedly', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(db, 'collection').mockImplementation(() => {
      throw new Error('boom');
    });

    const response = await api.get('/api/me/history?kind=saikaku').set('x-test-uid', 'u-me-history-error');

    expect(response.status).toBe(500);
    expect(response.type).toMatch(/json/);
    expect(response.body).toEqual({ error: 'internal_error' });
  });
});
