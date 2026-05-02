import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../api/lib/firebaseAdmin.js';
import {
  api,
  clearUserState,
  seedParent,
} from './_helpers.js';

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
    expect(response.body).toEqual({ scores, analysis });
  });

  it('returns null scores and analysis when parent is absent', async () => {
    const uid = 'u-me-uaam-result-absent';
    await clearUserState('uaam_results', uid);

    const response = await api.get('/api/me/uaam-result').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ scores: null, analysis: null });
  });

  it('returns null scores and analysis when saved result data is partial', async () => {
    const uid = 'u-me-uaam-result-partial';
    await clearUserState('uaam_results', uid);
    await seedParent('uaam_results', uid, { scores: { mindset: { total: 60 } } });

    const response = await api.get('/api/me/uaam-result').set('x-test-uid', uid);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ scores: null, analysis: null });
  });

  it('returns JSON 500 when Firestore throws unexpectedly', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(db, 'collection').mockImplementation(() => {
      throw new Error('boom');
    });

    const response = await api.get('/api/me/uaam-result').set('x-test-uid', 'u-me-uaam-result-error');

    expect(response.status).toBe(500);
    expect(response.type).toMatch(/json/);
    expect(response.body).toEqual({ error: 'internal_error' });
  });
});
