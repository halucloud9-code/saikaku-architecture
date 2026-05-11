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

  async function waitForPendingAttempt() {
    for (let i = 0; i < 40; i += 1) {
      if ((await getParent('results', uid))?.pendingAttemptId) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('pendingAttemptId was not set');
  }

  it('allows one request and rejects the concurrent pending conflict', async () => {
    const firstRequest = analyzeRequest(uid).then((response) => response);
    await waitForPendingAttempt();
    const secondResponse = await analyzeRequest(uid);
    const firstResponse = await firstRequest;
    const responses = [firstResponse, secondResponse];
    const statuses = responses.map((res) => res.status).sort();

    expect(statuses).toEqual([200, 409]);
    expect(responses.find((res) => res.status === 409).body.code).toBe('PENDING_CONFLICT');
    expect((await getParent('results', uid)).attemptCount).toBe(1);
    expect(getMockCallCount('saikaku')).toBe(1);
  });
});
