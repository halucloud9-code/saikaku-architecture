import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { authedDb, cleanupRulesTest, seedDoc, setupRulesTest } from './_helpers.js';

describe('Firestore rules: delete deny', () => {
  let testEnv;

  beforeAll(async () => {
    testEnv = await setupRulesTest();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seedDoc(testEnv, 'results/u1', { consentAt: Timestamp.now() });
    await seedDoc(testEnv, 'results/u1/attempts/x', {
      status: 'committed',
      createdAt: Timestamp.now(),
    });
  });

  afterAll(async () => {
    await cleanupRulesTest(testEnv);
  });

  it('denies deleting a parent result doc', async () => {
    const db = authedDb(testEnv, 'u1');
    await assertFails(deleteDoc(doc(db, 'results/u1')));
  });

  it('denies deleting an attempt doc', async () => {
    const db = authedDb(testEnv, 'u1');
    await assertFails(deleteDoc(doc(db, 'results/u1/attempts/x')));
  });
});
