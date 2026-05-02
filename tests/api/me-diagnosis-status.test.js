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

describe('API /api/me/diagnosis-status', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns zero attemptCount for a new uid', async () => {
    const uid = 'u-me-status-new';
    await clearUserState('results', uid);
    await clearUserState('uaam_results', uid);

    const response = await api.get('/api/me/diagnosis-status').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      saikaku: {
        committedCount: 0,
        attemptCount: 0,
        hasPending: false,
        pendingAttemptId: null,
        hasResult: false,
        isStartBlocked: false,
      },
      uaam: {
        committedCount: 0,
        attemptCount: 0,
        hasPending: false,
        pendingAttemptId: null,
        hasResult: false,
        isStartBlocked: false,
      },
    });
  });

  it('returns attemptCount 2 after seeding parent counts and committed attempts independently', async () => {
    const uid = 'u-me-status-two';
    await clearUserState('results', uid);
    await clearUserState('uaam_results', uid);
    const createdAt = Timestamp.fromDate(new Date('2026-05-01T00:00:00.000Z'));

    await seedParent('results', uid, {
      attemptCount: 2,
      result: { kakuchiiki: '問いに火を灯す人' },
      createdAt,
    });
    await seedAttempt('results', uid, 'saikaku-1', { status: 'committed', createdAt });
    await seedAttempt('results', uid, 'saikaku-2', { status: 'committed', createdAt });

    await seedParent('uaam_results', uid, {
      attemptCount: 2,
      scores: { mindset: { total: 60 } },
      analysis: { type_name: '実装する案内人' },
      createdAt,
    });
    await seedAttempt('uaam_results', uid, 'uaam-1', { status: 'committed', createdAt });
    await seedAttempt('uaam_results', uid, 'uaam-2', { status: 'committed', createdAt });

    const response = await api.get('/api/me/diagnosis-status').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body.saikaku).toMatchObject({
      committedCount: 2,
      attemptCount: 2,
      hasPending: false,
      pendingAttemptId: null,
      hasResult: true,
      isStartBlocked: true,
    });
    expect(response.body.uaam).toMatchObject({
      committedCount: 2,
      attemptCount: 2,
      hasPending: false,
      pendingAttemptId: null,
      hasResult: true,
      isStartBlocked: true,
    });
  });

  it('returns attemptCount 1 for legacy parents with result data and no attempts', async () => {
    const uid = 'u-me-status-legacy';
    await clearUserState('results', uid);
    await clearUserState('uaam_results', uid);

    await seedParent('results', uid, legacySaikakuParent());
    await seedParent('uaam_results', uid, {
      scores: { mindset: { total: 60 } },
      analysis: { type_name: 'Legacy UAAM' },
      createdAt: Timestamp.fromDate(new Date('2026-05-02T00:00:00.000Z')),
    });

    const response = await api.get('/api/me/diagnosis-status').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body.saikaku).toMatchObject({
      committedCount: 1,
      attemptCount: 1,
      hasPending: false,
      pendingAttemptId: null,
      hasResult: true,
      isStartBlocked: false,
    });
    expect(response.body.uaam).toMatchObject({
      committedCount: 1,
      attemptCount: 1,
      hasPending: false,
      pendingAttemptId: null,
      hasResult: true,
      isStartBlocked: false,
    });
  });

  it('includes pending state per kind without counting pending attempts as committed', async () => {
    const uid = 'u-me-status-pending';
    await clearUserState('results', uid);
    await clearUserState('uaam_results', uid);
    const createdAt = Timestamp.fromDate(new Date('2026-05-03T00:00:00.000Z'));

    await seedParent('results', uid, {
      attemptCount: 1,
      pendingAttemptId: 'pending-saikaku',
      createdAt,
    });
    await seedAttempt('results', uid, 'pending-saikaku', {
      status: 'pending',
      createdAt,
    });

    await seedParent('uaam_results', uid, {
      attemptCount: 1,
      pendingAttemptId: null,
      scores: { mindset: { total: 60 } },
      analysis: { type_name: 'Committed UAAM' },
      createdAt,
    });
    await seedAttempt('uaam_results', uid, 'uaam-1', {
      status: 'committed',
      createdAt,
    });

    const response = await api.get('/api/me/diagnosis-status').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body.saikaku).toMatchObject({
      committedCount: 0,
      attemptCount: 0,
      hasPending: true,
      pendingAttemptId: 'pending-saikaku',
      hasResult: false,
      isStartBlocked: true,
    });
    expect(response.body.uaam).toMatchObject({
      committedCount: 1,
      attemptCount: 1,
      hasPending: false,
      pendingAttemptId: null,
      hasResult: true,
      isStartBlocked: false,
    });
  });

  it('ignores pendingAttemptId when the attempt document is missing', async () => {
    const uid = 'u-me-status-orphan-pending';
    await clearUserState('results', uid);
    await clearUserState('uaam_results', uid);
    const createdAt = Timestamp.fromDate(new Date('2026-05-04T00:00:00.000Z'));

    await seedParent('results', uid, {
      attemptCount: 1,
      pendingAttemptId: 'orphan-id',
      createdAt,
    });

    const response = await api.get('/api/me/diagnosis-status').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body.saikaku).toMatchObject({
      committedCount: 0,
      attemptCount: 0,
      hasPending: false,
      pendingAttemptId: null,
      hasResult: false,
      isStartBlocked: false,
    });
  });

  it('ignores pendingAttemptId when the attempt document is already committed', async () => {
    const uid = 'u-me-status-committed-pending-id';
    await clearUserState('results', uid);
    await clearUserState('uaam_results', uid);
    const createdAt = Timestamp.fromDate(new Date('2026-05-05T00:00:00.000Z'));

    await seedParent('results', uid, {
      attemptCount: 1,
      pendingAttemptId: 'committed-id',
      createdAt,
    });
    await seedAttempt('results', uid, 'committed-id', {
      status: 'committed',
      createdAt,
    });

    const response = await api.get('/api/me/diagnosis-status').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body.saikaku).toMatchObject({
      committedCount: 1,
      attemptCount: 1,
      hasPending: false,
      pendingAttemptId: null,
      hasResult: false,
      isStartBlocked: false,
    });
  });

  it('returns 401 when no x-test-uid and no Authorization header are present', async () => {
    const response = await api.get('/api/me/diagnosis-status');

    expect(response.status).toBe(401);
  });

  it('returns 401 when x-test-uid has an invalid format', async () => {
    const response = await api.get('/api/me/diagnosis-status').set('x-test-uid', '../bad');

    expect(response.status).toBe(401);
  });

  it('disables test bypass in a Vercel runtime even when x-test-uid is present', async () => {
    const previousVercel = process.env.VERCEL;
    process.env.VERCEL = '1';

    try {
      const response = await api.get('/api/me/diagnosis-status').set('x-test-uid', 'u-me-status-vercel');

      expect(response.status).toBe(401);
    } finally {
      if (previousVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = previousVercel;
    }
  });

  it('returns JSON 500 when Firestore throws unexpectedly', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(db, 'collection').mockImplementation(() => {
      throw new Error('boom');
    });

    const response = await api.get('/api/me/diagnosis-status').set('x-test-uid', 'u-me-status-error');

    expect(response.status).toBe(500);
    expect(response.type).toMatch(/json/);
    expect(response.body).toEqual({ error: 'internal_error' });
  });
});
