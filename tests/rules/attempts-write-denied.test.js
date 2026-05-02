import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { authedDb, cleanupRulesTest, setupRulesTest } from './_helpers.js';

describe('Firestore rules: attempts write deny', () => {
  let testEnv;

  beforeAll(async () => {
    testEnv = await setupRulesTest();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await cleanupRulesTest(testEnv);
  });

  it('denies owner writes to results attempts', async () => {
    const db = authedDb(testEnv, 'u1');
    await assertFails(setDoc(doc(db, 'results/u1/attempts/x'), { foo: 1 }));
  });

  it('denies owner writes to uaam_results attempts', async () => {
    const db = authedDb(testEnv, 'u1');
    await assertFails(setDoc(doc(db, 'uaam_results/u1/attempts/x'), { foo: 1 }));
  });
});
