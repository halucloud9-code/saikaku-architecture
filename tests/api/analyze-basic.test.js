import { beforeEach, describe, expect, it } from 'vitest';
import {
  analyzeRequest,
  clearUserState,
  getMockCallCount,
  getParent,
  listAttempts,
  resetMockCallCount,
} from './_helpers.js';

describe('API /api/analyze basic reservation flow', () => {
  const uid = 'u-api-analyze-basic';

  beforeEach(async () => {
    await clearUserState('results', uid);
    resetMockCallCount();
  });

  it('commits the first two attempts and rejects the third before LLM call', async () => {
    const first = await analyzeRequest(uid);
    expect(first.status).toBe(200);
    expect(first.body.kakuchiiki).toBeTruthy();
    expect((await getParent('results', uid)).attemptCount).toBe(1);
    expect(await listAttempts('results', uid)).toHaveLength(1);
    expect(getMockCallCount('saikaku')).toBe(1);

    const second = await analyzeRequest(uid);
    expect(second.status).toBe(200);
    expect((await getParent('results', uid)).attemptCount).toBe(2);
    expect(await listAttempts('results', uid)).toHaveLength(2);
    expect(getMockCallCount('saikaku')).toBe(2);

    const third = await analyzeRequest(uid);
    expect(third.status).toBe(429);
    expect(third.body.code).toBe('LIMIT_EXCEEDED');
    expect(getMockCallCount('saikaku')).toBe(2);
  });
});
