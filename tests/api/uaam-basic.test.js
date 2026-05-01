import { beforeEach, describe, expect, it } from 'vitest';
import {
  Timestamp,
  clearUserState,
  getMockCallCount,
  getParent,
  listAttempts,
  minimalUaamBody,
  resetMockCallCount,
  seedAttempt,
  seedParent,
  uaamRequest,
} from './_helpers.js';

describe('API /api/uaam basic reservation coverage', () => {
  beforeEach(() => {
    resetMockCallCount();
  });

  it('enforces the two-attempt limit', async () => {
    const uid = 'u-uaam-basic';
    await clearUserState('uaam_results', uid);

    expect((await uaamRequest(uid, minimalUaamBody())).status).toBe(200);
    expect((await uaamRequest(uid, minimalUaamBody())).status).toBe(200);
    const third = await uaamRequest(uid, minimalUaamBody());

    expect(third.status).toBe(429);
    expect(third.body.code).toBe('LIMIT_EXCEEDED');
    expect((await getParent('uaam_results', uid)).attemptCount).toBe(2);
    expect(getMockCallCount('uaam')).toBe(2);
  });

  it('handles concurrent requests with one commit and one conflict', async () => {
    const uid = 'u-uaam-concurrent';
    await clearUserState('uaam_results', uid);
    resetMockCallCount();

    const responses = await Promise.all([uaamRequest(uid), uaamRequest(uid)]);

    expect(responses.map((res) => res.status).sort()).toEqual([200, 409]);
    expect((await getParent('uaam_results', uid)).attemptCount).toBe(1);
    expect(getMockCallCount('uaam')).toBe(1);
  });

  it('migrates a legacy uaam parent before committing a new attempt', async () => {
    const uid = 'u-uaam-migrate';
    await clearUserState('uaam_results', uid);
    await seedParent('uaam_results', uid, {
      scores: { mindset: { total: 60, max: 80, percentage: 75, subs: {} } },
      analysis: { type_name: 'Legacy UAAM', narrative: 'legacy narrative' },
      createdAt: Timestamp.now(),
    });
    resetMockCallCount();

    const response = await uaamRequest(uid);

    expect(response.status).toBe(200);
    expect((await getParent('uaam_results', uid)).attemptCount).toBe(2);
    const attempts = await listAttempts('uaam_results', uid);
    expect(attempts.some((attempt) => attempt.id === 'legacy-v1' && attempt.isLegacy)).toBe(true);
  });

  it('rejects over-limit uaam requests before mock LLM calls', async () => {
    const uid = 'u-uaam-limit';
    await clearUserState('uaam_results', uid);
    await seedParent('uaam_results', uid, { attemptCount: 2, pendingAttemptId: null });
    await seedAttempt('uaam_results', uid, 'seed-1', { status: 'committed', createdAt: Timestamp.now() });
    await seedAttempt('uaam_results', uid, 'seed-2', { status: 'committed', createdAt: Timestamp.now() });
    resetMockCallCount();

    const responses = await Promise.all([uaamRequest(uid), uaamRequest(uid)]);

    expect(responses.map((res) => res.status).sort()).toEqual([429, 429]);
    expect(getMockCallCount('uaam')).toBe(0);
  });
});
