import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { authedDb, cleanupRulesTest, seedDoc, setupRulesTest } from './_helpers.js';

describe('Firestore rules: attempts read', () => {
  let testEnv;

  beforeAll(async () => {
    testEnv = await setupRulesTest();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seedDoc(testEnv, 'results/u1/attempts/x', {
      status: 'committed',
      createdAt: Timestamp.now(),
    });
  });

  afterAll(async () => {
    await cleanupRulesTest(testEnv);
  });

  it('allows the owner to read their attempt', async () => {
    const db = authedDb(testEnv, 'u1');
    await assertSucceeds(getDoc(doc(db, 'results/u1/attempts/x')));
  });

  it('denies another user reading the attempt', async () => {
    const db = authedDb(testEnv, 'u2');
    await assertFails(getDoc(doc(db, 'results/u1/attempts/x')));
  });
});
