import request from 'supertest';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import app from '../../api/_app.js';
import { db } from '../../api/lib/firebaseAdmin.js';
import { getMockCallCount, resetMockCallCount } from '../../api/lib/anthropicClient.js';

if (
  process.env.TEST_BYPASS_AUTH !== '1'
  || process.env.NODE_ENV !== 'test'
  || !process.env.FIRESTORE_EMULATOR_HOST
) {
  throw new Error(
    '[tests/api] TEST_BYPASS_AUTH=1 + NODE_ENV=test + FIRESTORE_EMULATOR_HOST が必要です。npm run test:api 経由で実行してください。'
  );
}

export const api = request(app);
export { FieldValue, Timestamp, getMockCallCount, resetMockCallCount };

export function minimalAnalyzeBody(overrides = {}) {
  return {
    idToken: 'stub',
    name: 'Test User',
    talent_top5: '観察\n対話\n構造化\n伴走\n説明',
    talent_other: '文章化\n設計',
    value_top5: '誠実\n成長\n貢献\n自由\n探究',
    value_other: '調和\n美意識',
    passion_top5: '教育\n対話\n旅\n創作\n起業',
    passion_other: '読書\n音楽',
    q1: '本音で生きる人を増やせなかったこと',
    q2: '小さな学びの場を開く',
    q3: '人が自分の言葉で進み始めている',
    ...overrides,
  };
}

export function minimalUaamBody(overrides = {}) {
  const answers = {};
  for (let i = 1; i <= 64; i += 1) answers[String(i)] = 3;
  return {
    idToken: 'stub',
    answers,
    vAnswers: { V1: 3, V2: 3, V3: 3 },
    ...overrides,
  };
}

export function analyzeRequest(uid, body = minimalAnalyzeBody()) {
  return api.post('/api/analyze').set('x-test-uid', uid).send(body);
}

export function uaamRequest(uid, body = minimalUaamBody()) {
  return api.post('/api/uaam').set('x-test-uid', uid).send(body);
}

export async function clearUserState(collection, uid) {
  const parentRef = db.collection(collection).doc(uid);
  const [attempts, locks] = await Promise.all([
    parentRef.collection('attempts').get(),
    parentRef.collection('_locks').get(),
  ]);
  const batch = db.batch();
  attempts.docs.forEach((snap) => batch.delete(snap.ref));
  locks.docs.forEach((snap) => batch.delete(snap.ref));
  batch.delete(parentRef);
  await batch.commit();
}

export async function seedParent(collection, uid, data) {
  await db.collection(collection).doc(uid).set(data, { merge: true });
}

export async function updateParent(collection, uid, data) {
  await db.collection(collection).doc(uid).update(data);
}

export async function seedAttempt(collection, uid, attemptId, data) {
  await db.collection(collection).doc(uid).collection('attempts').doc(attemptId).set(data, { merge: true });
}

export async function getParent(collection, uid) {
  const snap = await db.collection(collection).doc(uid).get();
  return snap.exists ? snap.data() : null;
}

export async function listAttempts(collection, uid) {
  const snap = await db.collection(collection).doc(uid).collection('attempts').get();
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

export function setMockFail(enabled) {
  if (enabled) process.env.MOCK_ANTHROPIC_FAIL = '1';
  else delete process.env.MOCK_ANTHROPIC_FAIL;
}

export function setMockDelay(ms) {
  if (ms > 0) process.env.MOCK_ANTHROPIC_DELAY_MS = String(ms);
  else delete process.env.MOCK_ANTHROPIC_DELAY_MS;
}

export function legacySaikakuParent() {
  return {
    uid: 'legacy-user',
    name: 'Legacy User',
    email: 'legacy@example.com',
    inputTalent: '観察',
    inputValue: '誠実',
    inputPassion: '探究',
    selectedKakuchiiki: '問いに火を灯す人',
    result: {
      name: 'Legacy User',
      talent: { axis1: { name: '言語化', items: ['観察'], percentage: 100 } },
      value: { axis1: { name: '誠実', items: ['誠実'], percentage: 100 } },
      passion: { axis1: { name: '探究', items: ['探究'], percentage: 100 } },
      kakuchiiki: '問いに火を灯す人',
      kakuchiiki_options: ['問いに火を灯す人'],
      insight: 'legacy',
      what: { products: [], actions: '', offer: '' },
      reward: { economic: '', social: '', intrinsic: '', model: '' },
    },
    createdAt: Timestamp.now(),
  };
}

export function stableHash(data) {
  return JSON.stringify(data, (_key, value) => {
    if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
    return value;
  });
}
