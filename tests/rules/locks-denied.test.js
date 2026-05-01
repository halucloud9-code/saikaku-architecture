import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { authedDb, cleanupRulesTest, seedDoc, setupRulesTest } from './_helpers.js';

describe('Firestore rules: _locks subcollection (Admin SDK only)', () => {
  let testEnv;

  beforeAll(async () => {
    testEnv = await setupRulesTest();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await seedDoc(testEnv, 'results/u1/_locks/reservation', {
      attemptId: 'a1',
      acquiredAt: Timestamp.now(),
    });
    await seedDoc(testEnv, 'uaam_results/u1/_locks/reservation', {
      attemptId: 'a1',
      acquiredAt: Timestamp.now(),
    });
  });

  afterAll(async () => {
    await cleanupRulesTest(testEnv);
  });

  it('denies the owner reading their reservation lock', async () => {
    const db = authedDb(testEnv, 'u1');
    await assertFails(getDoc(doc(db, 'results/u1/_locks/reservation')));
    await assertFails(getDoc(doc(db, 'uaam_results/u1/_locks/reservation')));
  });

  it('denies another user reading the lock', async () => {
    const db = authedDb(testEnv, 'u2');
    await assertFails(getDoc(doc(db, 'results/u1/_locks/reservation')));
    await assertFails(getDoc(doc(db, 'uaam_results/u1/_locks/reservation')));
  });

  it('denies the owner writing a reservation lock', async () => {
    const db = authedDb(testEnv, 'u1');
    await assertFails(setDoc(doc(db, 'results/u1/_locks/reservation'), {
      attemptId: 'evil',
      acquiredAt: Timestamp.now(),
    }));
    await assertFails(setDoc(doc(db, 'uaam_results/u1/_locks/reservation'), {
      attemptId: 'evil',
      acquiredAt: Timestamp.now(),
    }));
  });
});
