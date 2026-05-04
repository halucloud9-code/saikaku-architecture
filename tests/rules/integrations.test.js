import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { authedDb, cleanupRulesTest, seedDoc, setupRulesTest } from './_helpers.js';

describe('Firestore rules: integrations subcollection (Admin SDK only)', () => {
  let testEnv;

  beforeAll(async () => {
    testEnv = await setupRulesTest();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seedDoc(testEnv, 'uaam_results/u1/integrations/legacy-v1__legacy-v1', {
      saikakuAttemptId: 'legacy-v1',
      uaamAttemptId: 'legacy-v1',
      integration: { score: 88 },
      regenerationCount: 0,
      model: 'claude-sonnet-4-20250514',
      source: {
        saikakuLabel: 'Legacy Saikaku',
        uaamLabel: 'Legacy UAAM',
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      status: 'active',
    });
  });

  afterAll(async () => {
    await cleanupRulesTest(testEnv);
  });

  it('denies client reads from uaam_results integrations', async () => {
    const db = authedDb(testEnv, 'u1');
    await assertFails(getDoc(doc(db, 'uaam_results/u1/integrations/legacy-v1__legacy-v1')));
  });

  it('denies client writes to uaam_results integrations', async () => {
    const db = authedDb(testEnv, 'u1');
    await assertFails(setDoc(doc(db, 'uaam_results/u1/integrations/abc123__def456'), {
      saikakuAttemptId: 'abc123',
      uaamAttemptId: 'def456',
      integration: { score: 99 },
      regenerationCount: 0,
      model: 'claude-sonnet-4-20250514',
      source: {
        saikakuLabel: 'Saikaku',
        uaamLabel: 'UAAM',
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      status: 'active',
    }));
  });
});

