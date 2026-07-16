import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { authedDb, cleanupRulesTest, seedDoc, setupRulesTest } from './_helpers.js';

const protectedDocuments = [
  'uaam_peer_invites/invite-1',
  'uaam_peer_invite_index/subject-1',
  'uaam_peer_results/subject-1',
  'uaam_peer_results/subject-1/submissions/submission-1',
  'uaam_peer_audits/audit-1',
  'uaam_peer_deletions/subject-1',
];

const protectedCollections = [
  'uaam_peer_invites',
  'uaam_peer_invite_index',
  'uaam_peer_results',
  'uaam_peer_results/subject-1/submissions',
  'uaam_peer_audits',
  'uaam_peer_deletions',
];

describe('Firestore rules: UAAM peer assessment is Admin SDK only', () => {
  let testEnv;

  beforeAll(async () => {
    testEnv = await setupRulesTest();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await Promise.all(protectedDocuments.map((path) => seedDoc(testEnv, path, { seeded: true })));
  });

  afterAll(async () => {
    await cleanupRulesTest(testEnv);
  });

  it.each(protectedDocuments)('denies authenticated client get/update/delete at %s', async (path) => {
    const db = authedDb(testEnv, 'subject-1');
    const ref = doc(db, path);

    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, { clientWrite: true }, { merge: true }));
    await assertFails(deleteDoc(ref));
  });

  it.each(protectedCollections)('denies authenticated client list at %s', async (path) => {
    const db = authedDb(testEnv, 'subject-1');
    await assertFails(getDocs(collection(db, path)));
  });

  it.each(protectedDocuments)('denies authenticated client create at %s', async (path) => {
    const db = authedDb(testEnv, 'subject-1');
    await assertFails(setDoc(doc(db, `${path}-client-create`), { clientWrite: true }));
  });
});
