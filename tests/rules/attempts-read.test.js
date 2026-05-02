import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
    await seedDoc(testEnv, 'uaam_results/u1/attempts/x', {
      status: 'committed',
      createdAt: Timestamp.now(),
    });
  });

  afterAll(async () => {
    await cleanupRulesTest(testEnv);
  });

  it('denies the owner reading their result attempt (get)', async () => {
    const db = authedDb(testEnv, 'u1');
    await assertFails(getDoc(doc(db, 'results/u1/attempts/x')));
  });

  it('denies the owner listing their result attempts', async () => {
    const db = authedDb(testEnv, 'u1');
    await assertFails(getDocs(collection(db, 'results/u1/attempts')));
  });

  it('denies the owner reading their uaam attempt (get)', async () => {
    const db = authedDb(testEnv, 'u1');
    await assertFails(getDoc(doc(db, 'uaam_results/u1/attempts/x')));
  });

  it('denies the owner listing their uaam attempts', async () => {
    const db = authedDb(testEnv, 'u1');
    await assertFails(getDocs(collection(db, 'uaam_results/u1/attempts')));
  });

  it('denies another user reading the attempt (get)', async () => {
    const db = authedDb(testEnv, 'u2');
    await assertFails(getDoc(doc(db, 'results/u1/attempts/x')));
  });

  it('denies another user listing the attempts', async () => {
    const db = authedDb(testEnv, 'u2');
    await assertFails(getDocs(collection(db, 'results/u1/attempts')));
  });

  it('allows server-side bypass reads used by Admin SDK routes', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const snap = await getDoc(doc(context.firestore(), 'results/u1/attempts/x'));
      expect(snap.exists()).toBe(true);
    });
  });
});
