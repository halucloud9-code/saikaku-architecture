import { beforeEach, describe, expect, it } from 'vitest';
import {
  Timestamp,
  analyzeRequest,
  clearUserState,
  getMockCallCount,
  resetMockCallCount,
  seedAttempt,
  seedParent,
} from './_helpers.js';

describe('API /api/analyze concurrency from attemptCount=3', () => {
  const uid = 'u-conc-3';

  beforeEach(async () => {
    await clearUserState('results', uid);
    await seedParent('results', uid, { attemptCount: 3, pendingAttemptId: null, createdAt: Timestamp.now() });
    await seedAttempt('results', uid, 'seed-1', { status: 'committed', createdAt: Timestamp.now() });
    await seedAttempt('results', uid, 'seed-2', { status: 'committed', createdAt: Timestamp.now() });
    await seedAttempt('results', uid, 'seed-3', { status: 'committed', createdAt: Timestamp.now() });
    resetMockCallCount();
  });

  it('rejects both requests before the LLM call', async () => {
    const responses = await Promise.all([analyzeRequest(uid), analyzeRequest(uid)]);

    expect(responses.map((res) => res.status).sort()).toEqual([429, 429]);
    expect(responses.every((res) => res.body.code === 'LIMIT_EXCEEDED')).toBe(true);
    expect(getMockCallCount('saikaku')).toBe(0);
  });
});
