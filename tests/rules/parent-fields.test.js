import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, Timestamp, updateDoc } from 'firebase/firestore';
import { authedDb, cleanupRulesTest, seedDoc, setupRulesTest } from './_helpers.js';

describe('Firestore rules: parent fields', () => {
  let testEnv;

  beforeAll(async () => {
    testEnv = await setupRulesTest();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seedDoc(testEnv, 'results/u1', { consentAt: Timestamp.now() });
  });

  afterAll(async () => {
    await cleanupRulesTest(testEnv);
  });

  it('allows selectedKakuchiiki string updates', async () => {
    const db = authedDb(testEnv, 'u1');
    await assertSucceeds(updateDoc(doc(db, 'results/u1'), { selectedKakuchiiki: 'foo' }));
  });

  it('denies selectedKakuchiiki values over the size limit', async () => {
    const db = authedDb(testEnv, 'u1');
    await assertFails(updateDoc(doc(db, 'results/u1'), { selectedKakuchiiki: 'a'.repeat(300) }));
  });

  it('denies selectedKakuchiiki non-string values', async () => {
    const db = authedDb(testEnv, 'u1');
    await assertFails(updateDoc(doc(db, 'results/u1'), { selectedKakuchiiki: 12345 }));
  });

  it('denies consentAt non-timestamp values', async () => {
    const db = authedDb(testEnv, 'u1');
    await assertFails(updateDoc(doc(db, 'results/u1'), { consentAt: 'not-a-date' }));
  });

  it('denies protected result field updates', async () => {
    const db = authedDb(testEnv, 'u1');
    await assertFails(updateDoc(doc(db, 'results/u1'), { result: { kakuchiiki: 'foo' } }));
  });

  it('allows consentAt and selectedKakuchiiki together when valid', async () => {
    const db = authedDb(testEnv, 'u1');
    await assertSucceeds(updateDoc(doc(db, 'results/u1'), {
      consentAt: Timestamp.now(),
      selectedKakuchiiki: 'foo',
    }));
  });
});
