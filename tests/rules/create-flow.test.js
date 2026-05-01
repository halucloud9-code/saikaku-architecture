import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { authedDb, cleanupRulesTest, setupRulesTest } from './_helpers.js';

describe('Firestore rules: create flow', () => {
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

  it('allows creating a consent-only parent doc', async () => {
    const db = authedDb(testEnv, 'u1');
    await assertSucceeds(setDoc(doc(db, 'results/u1'), { consentAt: Timestamp.now() }));
  });

  it('denies creating parent docs with extra fields', async () => {
    const db = authedDb(testEnv, 'u2');
    await assertFails(setDoc(doc(db, 'results/u2'), { consentAt: Timestamp.now(), foo: 'bar' }));
  });

  it('denies creating parent docs with non-timestamp consentAt', async () => {
    const db = authedDb(testEnv, 'u3');
    await assertFails(setDoc(doc(db, 'results/u3'), { consentAt: 'not-a-date' }));
  });
});
