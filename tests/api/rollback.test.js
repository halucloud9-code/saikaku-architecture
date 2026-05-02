import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  analyzeRequest,
  clearUserState,
  getParent,
  listAttempts,
  resetMockCallCount,
  setMockFail,
} from './_helpers.js';

describe('API /api/analyze rollback', () => {
  const uid = 'u-rollback';

  beforeEach(async () => {
    await clearUserState('results', uid);
    resetMockCallCount();
    setMockFail(true);
  });

  afterEach(() => {
    setMockFail(false);
  });

  it('rolls the reservation back when the LLM fails', async () => {
    const response = await analyzeRequest(uid);

    expect(response.status).toBe(500);
    expect((await getParent('results', uid)).attemptCount).toBe(0);
    expect(await listAttempts('results', uid)).toHaveLength(0);
  });
});
