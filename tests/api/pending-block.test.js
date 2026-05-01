import { beforeEach, describe, expect, it } from 'vitest';
import { analyzeRequest, clearUserState, seedParent } from './_helpers.js';

describe('API /api/analyze pending block', () => {
  const uid = 'u-pending-block';

  beforeEach(async () => {
    await clearUserState('results', uid);
    await seedParent('results', uid, { attemptCount: 0, pendingAttemptId: 'dangling-id' });
  });

  it('returns 409 when a pending reservation exists', async () => {
    const response = await analyzeRequest(uid);

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('PENDING_CONFLICT');
  });
});
