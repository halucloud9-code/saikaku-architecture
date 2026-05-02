import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../api/lib/firebaseAdmin.js';
import {
  Timestamp,
  api,
  clearUserState,
  seedAttempt,
  seedParent,
} from './_helpers.js';

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
    expect(response.body).toEqual({ error: 'attempt not found' });
  });

  it('returns 422 when id format is malformed', async () => {
    const response = await api.get('/api/me/history/bad$id?kind=saikaku').set('x-test-uid', 'u-me-history-detail-bad-id');

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ error: 'kind and id are required' });
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
    expect(response.body).toEqual({ error: 'internal_error' });
  });
});
