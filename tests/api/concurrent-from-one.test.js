import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  Timestamp,
  analyzeRequest,
  clearUserState,
  getMockCallCount,
  getParent,
  resetMockCallCount,
  seedAttempt,
  seedParent,
  setMockDelay,
} from './_helpers.js';

describe('API /api/analyze concurrency from attemptCount=1', () => {
  const uid = 'u-conc-1';

  beforeEach(async () => {
    setMockDelay(1500);
    await clearUserState('results', uid);
    await seedParent('results', uid, { attemptCount: 1, pendingAttemptId: null, createdAt: Timestamp.now() });
    await seedAttempt('results', uid, 'seed-1', { status: 'committed', createdAt: Timestamp.now() });
    resetMockCallCount();
  });

  afterAll(() => setMockDelay(0));

  it('allows one request and rejects the concurrent pending conflict', async () => {
    const responses = await Promise.all([analyzeRequest(uid), analyzeRequest(uid)]);
    const statuses = responses.map((res) => res.status).sort();

    expect(statuses).toEqual([200, 409]);
    expect((await getParent('results', uid)).attemptCount).toBe(2);
    expect(getMockCallCount('saikaku')).toBe(1);
  });
});
