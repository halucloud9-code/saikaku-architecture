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
        recentAttempts: [],
      },
      uaam: {
        committedCount: 0,
        attemptCount: 0,
        hasPending: false,
        pendingAttemptId: null,
        hasResult: false,
        isStartBlocked: false,
        recentAttempts: [],
      },
    });
  });

  it('returns empty recentAttempts for a new uid', async () => {
    const uid = 'u-me-status-recent-new';
    await clearUserState('results', uid);
    await clearUserState('uaam_results', uid);

    const response = await api.get('/api/me/diagnosis-status').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body.saikaku.recentAttempts).toEqual([]);
    expect(response.body.uaam.recentAttempts).toEqual([]);
  });

  it('returns one committed recentAttempt per kind with label, createdAt, and isLegacy false', async () => {
    const uid = 'u-me-status-recent-one';
    await clearUserState('results', uid);
    await clearUserState('uaam_results', uid);
    const saikakuCreatedAt = Timestamp.fromDate(new Date('2026-05-01T01:00:00.000Z'));
    const uaamCreatedAt = Timestamp.fromDate(new Date('2026-05-01T02:00:00.000Z'));

    await seedParent('results', uid, {
      attemptCount: 1,
      result: { kakuchiiki: 'Parent Saikaku' },
      createdAt: saikakuCreatedAt,
    });
    await seedAttempt('results', uid, 'saikaku-one', {
      status: 'committed',
      summary: { kakuchiiki: '問いに火を灯す人' },
      createdAt: saikakuCreatedAt,
    });

    await seedParent('uaam_results', uid, {
      attemptCount: 1,
      scores: { mindset: { total: 60 } },
      analysis: { type_name: 'Parent UAAM' },
      createdAt: uaamCreatedAt,
    });
    await seedAttempt('uaam_results', uid, 'uaam-one', {
      status: 'committed',
      summary: { typeName: '実装する案内人' },
      createdAt: uaamCreatedAt,
    });

    const response = await api.get('/api/me/diagnosis-status').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body.saikaku.recentAttempts).toEqual([
      {
        id: 'saikaku-one',
        label: '問いに火を灯す人',
        createdAt: '2026-05-01T01:00:00.000Z',
        isLegacy: false,
      },
    ]);
    expect(response.body.uaam.recentAttempts).toEqual([
      {
        id: 'uaam-one',
        label: '実装する案内人',
        createdAt: '2026-05-01T02:00:00.000Z',
        isLegacy: false,
      },
    ]);
  });

  it('returns two committed recentAttempts per kind in newest-first order', async () => {
    const uid = 'u-me-status-recent-two';
    await clearUserState('results', uid);
    await clearUserState('uaam_results', uid);
    const olderCreatedAt = Timestamp.fromDate(new Date('2026-05-01T00:00:00.000Z'));
    const newerCreatedAt = Timestamp.fromDate(new Date('2026-05-03T00:00:00.000Z'));

    await seedParent('results', uid, {
      attemptCount: 2,
      result: { kakuchiiki: 'Parent Saikaku' },
      createdAt: newerCreatedAt,
    });
    await seedAttempt('results', uid, 'saikaku-old', {
      status: 'committed',
      summary: { kakuchiiki: '古い才覚' },
      createdAt: olderCreatedAt,
    });
    await seedAttempt('results', uid, 'saikaku-new', {
      status: 'committed',
      summary: { kakuchiiki: '新しい才覚' },
      createdAt: newerCreatedAt,
    });

    await seedParent('uaam_results', uid, {
      attemptCount: 2,
      scores: { mindset: { total: 60 } },
      analysis: { type_name: 'Parent UAAM' },
      createdAt: newerCreatedAt,
    });
    await seedAttempt('uaam_results', uid, 'uaam-old', {
      status: 'committed',
      summary: { typeName: '古いUAAM' },
      createdAt: olderCreatedAt,
    });
    await seedAttempt('uaam_results', uid, 'uaam-new', {
      status: 'committed',
      summary: { typeName: '新しいUAAM' },
      createdAt: newerCreatedAt,
    });

    const response = await api.get('/api/me/diagnosis-status').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body.saikaku.recentAttempts).toEqual([
      {
        id: 'saikaku-new',
        label: '新しい才覚',
        createdAt: '2026-05-03T00:00:00.000Z',
        isLegacy: false,
      },
      {
        id: 'saikaku-old',
        label: '古い才覚',
        createdAt: '2026-05-01T00:00:00.000Z',
        isLegacy: false,
      },
    ]);
    expect(response.body.uaam.recentAttempts).toEqual([
      {
        id: 'uaam-new',
        label: '新しいUAAM',
        createdAt: '2026-05-03T00:00:00.000Z',
        isLegacy: false,
      },
      {
        id: 'uaam-old',
        label: '古いUAAM',
        createdAt: '2026-05-01T00:00:00.000Z',
        isLegacy: false,
      },
    ]);
  });

  it('returns a legacy fallback recentAttempt when only legacy parent data exists', async () => {
    const uid = 'u-me-status-recent-legacy';
    await clearUserState('results', uid);
    await clearUserState('uaam_results', uid);
    const saikakuCreatedAt = Timestamp.fromDate(new Date('2026-05-02T01:00:00.000Z'));
    const uaamCreatedAt = Timestamp.fromDate(new Date('2026-05-02T02:00:00.000Z'));

    await seedParent('results', uid, {
      ...legacySaikakuParent(),
      createdAt: saikakuCreatedAt,
    });
    await seedParent('uaam_results', uid, {
      scores: { mindset: { total: 60 } },
      analysis: { type_name: 'Legacy UAAM' },
      createdAt: uaamCreatedAt,
    });

    const response = await api.get('/api/me/diagnosis-status').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body.saikaku.recentAttempts).toEqual([
      {
        id: 'legacy-fallback',
        label: '問いに火を灯す人',
        createdAt: '2026-05-02T01:00:00.000Z',
        isLegacy: true,
      },
    ]);
    expect(response.body.uaam.recentAttempts).toEqual([
      {
        id: 'legacy-fallback',
        label: 'Legacy UAAM',
        createdAt: '2026-05-02T02:00:00.000Z',
        isLegacy: true,
      },
    ]);
  });

  it('excludes pending attempts from recentAttempts when committed attempts also exist', async () => {
    const uid = 'u-me-status-recent-pending-committed';
    await clearUserState('results', uid);
    await clearUserState('uaam_results', uid);
    const committedCreatedAt = Timestamp.fromDate(new Date('2026-05-01T00:00:00.000Z'));
    const pendingCreatedAt = Timestamp.fromDate(new Date('2026-05-04T00:00:00.000Z'));

    await seedParent('results', uid, {
      attemptCount: 2,
      pendingAttemptId: 'pending-saikaku',
      result: { kakuchiiki: 'Parent Saikaku' },
      createdAt: pendingCreatedAt,
    });
    await seedAttempt('results', uid, 'pending-saikaku', {
      status: 'pending',
      summary: { kakuchiiki: '処理中の才覚' },
      createdAt: pendingCreatedAt,
    });
    await seedAttempt('results', uid, 'committed-saikaku', {
      status: 'committed',
      summary: { kakuchiiki: '保存済み才覚' },
      createdAt: committedCreatedAt,
    });

    await seedParent('uaam_results', uid, {
      attemptCount: 2,
      pendingAttemptId: 'pending-uaam',
      scores: { mindset: { total: 60 } },
      analysis: { type_name: 'Parent UAAM' },
      createdAt: pendingCreatedAt,
    });
    await seedAttempt('uaam_results', uid, 'pending-uaam', {
      status: 'pending',
      summary: { typeName: '処理中UAAM' },
      createdAt: pendingCreatedAt,
    });
    await seedAttempt('uaam_results', uid, 'committed-uaam', {
      status: 'committed',
      summary: { typeName: '保存済みUAAM' },
      createdAt: committedCreatedAt,
    });

    const response = await api.get('/api/me/diagnosis-status').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body.saikaku.recentAttempts).toEqual([
      {
        id: 'committed-saikaku',
        label: '保存済み才覚',
        createdAt: '2026-05-01T00:00:00.000Z',
        isLegacy: false,
      },
    ]);
    expect(response.body.uaam.recentAttempts).toEqual([
      {
        id: 'committed-uaam',
        label: '保存済みUAAM',
        createdAt: '2026-05-01T00:00:00.000Z',
        isLegacy: false,
      },
    ]);
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
    expect(response.body).toEqual({
      code: 'internal_error',
      requestId: expect.any(String),
    });
  });
});
