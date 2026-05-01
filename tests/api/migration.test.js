import { beforeEach, describe, expect, it } from 'vitest';
import {
  analyzeRequest,
  clearUserState,
  getParent,
  legacySaikakuParent,
  listAttempts,
  resetMockCallCount,
  seedParent,
} from './_helpers.js';

describe('API /api/analyze legacy migration', () => {
  const uid = 'u-migrate1';

  beforeEach(async () => {
    await clearUserState('results', uid);
    await seedParent('results', uid, legacySaikakuParent());
    resetMockCallCount();
  });

  it('creates legacy-v1 and commits the new attempt in one flow', async () => {
    const response = await analyzeRequest(uid);

    expect(response.status).toBe(200);
    expect((await getParent('results', uid)).attemptCount).toBe(2);
    const attempts = await listAttempts('results', uid);
    expect(attempts).toHaveLength(2);

    const legacy = attempts.find((attempt) => attempt.id === 'legacy-v1');
    expect(legacy).toBeTruthy();
    expect(legacy.isLegacy).toBe(true);
    expect(legacy.status).toBe('committed');
  });
});
