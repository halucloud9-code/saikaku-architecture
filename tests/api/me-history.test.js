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
    expect(response.body).toEqual({
      attempts: [],
      pendingAttempt: null,
      summary: {
        committedCount: 0,
        attemptCount: 0,
        hasPending: false,
        pendingAttemptId: null,
        hasResult: false,
        isStartBlocked: false,
      },
    });
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
    expect(response.body.pendingAttempt).toBeNull();
    expect(response.body.summary).toMatchObject({
      committedCount: 1,
      attemptCount: 1,
      hasPending: false,
      pendingAttemptId: null,
      hasResult: true,
      isStartBlocked: false,
    });
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
    expect(response.body.pendingAttempt).toBeNull();
    expect(response.body.summary).toMatchObject({
      committedCount: 2,
      attemptCount: 2,
      hasPending: false,
      pendingAttemptId: null,
      isStartBlocked: true,
    });
  });

  it('builds summary from committed attempt docs when parent attemptCount is stale', async () => {
    const uid = 'u-me-history-summary-divergence';
    await clearUserState('results', uid);
    const older = Timestamp.fromDate(new Date('2026-05-01T00:00:00.000Z'));
    const newer = Timestamp.fromDate(new Date('2026-05-02T00:00:00.000Z'));

    await seedParent('results', uid, {
      attemptCount: 0,
      pendingAttemptId: null,
      createdAt: older,
    });
    await seedAttempt('results', uid, 'older', {
      status: 'committed',
      createdAt: older,
      summary: { kakuchiiki: '古い結果', createdAt: older },
    });
    await seedAttempt('results', uid, 'newer', {
      status: 'committed',
      createdAt: newer,
      summary: { kakuchiiki: '新しい結果', createdAt: newer },
    });

    const response = await api.get('/api/me/history?kind=saikaku').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body.attempts.map((attempt) => attempt.id)).toEqual(['newer', 'older']);
    expect(response.body.summary).toMatchObject({
      committedCount: 2,
      attemptCount: 2,
      hasPending: false,
      pendingAttemptId: null,
      isStartBlocked: true,
    });
  });

  it('limits committed history to the latest 20 and loads pending by id', async () => {
    const uid = 'u-me-history-query-limit';
    await clearUserState('results', uid);

    await seedParent('results', uid, {
      attemptCount: 26,
      pendingAttemptId: 'pending-1',
    });

    await Promise.all(Array.from({ length: 25 }, async (_, index) => {
      const createdAt = Timestamp.fromDate(new Date(Date.UTC(2026, 4, index + 1)));
      await seedAttempt('results', uid, `attempt-${index}`, {
        status: 'committed',
        createdAt,
        summary: { kakuchiiki: `結果 ${index}`, createdAt },
      });
    }));
    const pendingCreatedAt = Timestamp.fromDate(new Date('2026-05-30T00:00:00.000Z'));
    await seedAttempt('results', uid, 'pending-1', {
      status: 'pending',
      createdAt: pendingCreatedAt,
      summary: { createdAt: pendingCreatedAt },
    });

    const response = await api.get('/api/me/history?kind=saikaku').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body.attempts).toHaveLength(20);
    expect(response.body.attempts.map((attempt) => attempt.id)).toEqual(
      Array.from({ length: 20 }, (_, index) => `attempt-${24 - index}`),
    );
    expect(response.body.attempts.map((attempt) => attempt.id)).not.toContain('attempt-4');
    expect(response.body.pendingAttempt).toMatchObject({
      id: 'pending-1',
      status: 'pending',
      createdAt: '2026-05-30T00:00:00.000Z',
    });
    expect(response.body.summary).toMatchObject({
      hasPending: true,
      pendingAttemptId: 'pending-1',
      isStartBlocked: true,
    });
  });

  it('returns pendingAttempt and pending summary when parent references a pending attempt', async () => {
    const uid = 'u-me-history-pending';
    await clearUserState('results', uid);
    const createdAt = Timestamp.fromDate(new Date('2026-05-03T00:00:00.000Z'));

    await seedParent('results', uid, {
      attemptCount: 1,
      pendingAttemptId: 'pending-1',
      createdAt,
    });
    await seedAttempt('results', uid, 'pending-1', {
      status: 'pending',
      createdAt,
      summary: { createdAt },
      full: { result: { kakuchiiki: '未確定' } },
      raw: { input: { q1: 'pending input' } },
    });

    const response = await api.get('/api/me/history?kind=saikaku').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body.attempts).toEqual([]);
    expect(response.body.pendingAttempt).toMatchObject({
      id: 'pending-1',
      status: 'pending',
      createdAt: '2026-05-03T00:00:00.000Z',
      summary: { createdAt: '2026-05-03T00:00:00.000Z' },
      isLegacy: false,
    });
    expect(response.body.pendingAttempt).not.toHaveProperty('full');
    expect(response.body.pendingAttempt).not.toHaveProperty('raw');
    expect(response.body.summary).toMatchObject({
      committedCount: 0,
      attemptCount: 0,
      hasPending: true,
      pendingAttemptId: 'pending-1',
      hasResult: false,
      isStartBlocked: true,
    });
  });

  it('normalizes orphan pending summary when parent pendingAttemptId has no matching attempt doc', async () => {
    const uid = 'u-me-history-orphan';
    await clearUserState('results', uid);

    await seedParent('results', uid, {
      attemptCount: 1,
      pendingAttemptId: 'missing-pending',
    });

    const response = await api.get('/api/me/history?kind=saikaku').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body.attempts).toEqual([]);
    expect(response.body.pendingAttempt).toBeNull();
    expect(response.body.summary).toMatchObject({
      committedCount: 0,
      attemptCount: 0,
      hasPending: false,
      pendingAttemptId: null,
      hasResult: false,
      isStartBlocked: false,
    });
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
