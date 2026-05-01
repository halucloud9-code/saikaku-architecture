import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  analyzeRequest,
  clearUserState,
  getMockCallCount,
  getParent,
  resetMockCallCount,
  setMockDelay,
} from './_helpers.js';

describe('API /api/analyze concurrency from attemptCount=0', () => {
  const uid = 'u-conc-0';

  beforeEach(async () => {
    setMockDelay(1500);
    await clearUserState('results', uid);
    resetMockCallCount();
  });

  afterAll(() => setMockDelay(0));

  it('allows one request and rejects the concurrent pending conflict', async () => {
    const responses = await Promise.all([analyzeRequest(uid), analyzeRequest(uid)]);
    const statuses = responses.map((res) => res.status).sort();

    expect(statuses).toEqual([200, 409]);
    expect(responses.find((res) => res.status === 409).body.code).toBe('PENDING_CONFLICT');
    expect((await getParent('results', uid)).attemptCount).toBe(1);
    expect(getMockCallCount('saikaku')).toBe(1);
  });
});
