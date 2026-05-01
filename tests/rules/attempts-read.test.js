import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, Timestamp } from 'firebase/firestore';
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
    await seedDoc(testEnv, 'results/u1/attempts/y', {
      status: 'committed',
      createdAt: Timestamp.now(),
    });
  });

  afterAll(async () => {
    await cleanupRulesTest(testEnv);
  });

  it('allows the owner to read their attempt (get)', async () => {
    const db = authedDb(testEnv, 'u1');
    await assertSucceeds(getDoc(doc(db, 'results/u1/attempts/x')));
  });

  it('allows the owner to list their attempts', async () => {
    const db = authedDb(testEnv, 'u1');
    await assertSucceeds(getDocs(collection(db, 'results/u1/attempts')));
  });

  it('denies another user reading the attempt (get)', async () => {
    const db = authedDb(testEnv, 'u2');
    await assertFails(getDoc(doc(db, 'results/u1/attempts/x')));
  });

  it('denies another user listing the attempts', async () => {
    const db = authedDb(testEnv, 'u2');
    await assertFails(getDocs(collection(db, 'results/u1/attempts')));
  });
});
