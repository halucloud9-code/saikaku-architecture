import { beforeEach, describe, expect, it } from 'vitest';
import {
  FieldValue,
  analyzeRequest,
  clearUserState,
  legacySaikakuParent,
  listAttempts,
  resetMockCallCount,
  seedParent,
  stableHash,
  updateParent,
} from './_helpers.js';

describe('API /api/analyze legacy migration idempotency', () => {
  const uid = 'u-migrate-idempotent';

  beforeEach(async () => {
    await clearUserState('results', uid);
    await seedParent('results', uid, legacySaikakuParent());
    resetMockCallCount();
  });

  it('does not rewrite or duplicate legacy-v1 when the parent looks legacy again', async () => {
    const first = await analyzeRequest(uid);
    expect(first.status).toBe(200);

    const before = (await listAttempts('results', uid)).find((attempt) => attempt.id === 'legacy-v1');
    const beforeHash = stableHash(before);

    await updateParent('results', uid, { attemptCount: FieldValue.delete() });

    const second = await analyzeRequest(uid);
    expect(second.status).toBe(200);

    const attempts = await listAttempts('results', uid);
    const legacyDocs = attempts.filter((attempt) => attempt.id === 'legacy-v1');
    expect(legacyDocs).toHaveLength(1);
    expect(stableHash(legacyDocs[0])).toBe(beforeHash);
  });
});
