import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { expect } from '@playwright/test';

const AUTH_BASE = 'http://localhost:9099/identitytoolkit.googleapis.com/v1';
const API_KEY = 'fake-api-key';

function getDb() {
  if (!getApps().length) {
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-saikaku' });
  }
  return getFirestore();
}

function getAdminAuth() {
  if (!getApps().length) {
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-saikaku' });
  }
  return getAuth();
}

function collectionFor(kind) {
  return kind === 'uaam' ? 'uaam_results' : 'results';
}

export async function createAuthUser(email, password) {
  const signUp = await fetch(`${AUTH_BASE}/accounts:signUp?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await signUp.json();
  if (!signUp.ok) throw new Error(`auth signUp failed: ${JSON.stringify(data)}`);

  await getAdminAuth().updateUser(data.localId, {
    emailVerified: true,
    displayName: 'E2E User',
  });

  return {
    uid: data.localId,
    localId: data.localId,
    idToken: data.idToken,
    email,
    password,
  };
}

export async function clearUser(uid) {
  await Promise.all([
    clearKind(uid, 'saikaku'),
    clearKind(uid, 'uaam'),
  ]);
}

export async function clearKind(uid, kind) {
  const db = getDb();
  const parentRef = db.collection(collectionFor(kind)).doc(uid);
  const attempts = await parentRef.collection('attempts').get();
  const batch = db.batch();
  attempts.docs.forEach((snap) => batch.delete(snap.ref));
  batch.delete(parentRef);
  await batch.commit();
}

export async function seedUser(uid, kind, data) {
  const db = getDb();
  const parentRef = db.collection(collectionFor(kind)).doc(uid);
  const parent = data.parent ?? data;
  await parentRef.set(parent, { merge: true });

  if (data.attempts) {
    const writes = Object.entries(data.attempts).map(([id, attempt]) => {
      return parentRef.collection('attempts').doc(id).set(attempt, { merge: true });
    });
    await Promise.all(writes);
  }
}

export async function loginAs(page, email, password) {
  await page.goto('/');
  await page.getByRole('checkbox').check({ force: true });
  await page.getByText('メールで入る').click();
  await page.getByPlaceholder('メールアドレス').fill(email);
  await page.getByPlaceholder('パスワード（6文字以上）').fill(password);
  await page.locator('.login-btn-gold').click();
  await expect(page.getByText('才覚解読プログラム')).toBeVisible({ timeout: 15000 });
}

export async function fillSaikakuForm(page) {
  await page.getByPlaceholder('山田 太郎').fill('E2E User');
  await page.getByPlaceholder('例：人の話を聞く、分かりやすく説明する、人の心を動かす...').fill('観察\n対話\n構造化\n伴走\n説明');
  await page.getByPlaceholder('例：家族、誠実さ、自由、成長、貢献').fill('誠実\n成長\n貢献\n自由\n探究');
  await page.getByPlaceholder('例：教育、コーチング、旅、音楽、起業...').fill('教育\n対話\n旅\n創作\n起業');
  await page.getByPlaceholder('思いのままに書いてください').fill('本音で生きる人を増やせなかったこと');
  await page.getByPlaceholder('具体的なシーン・行動・場所・誰といるか...').fill('小さな学びの場を開く');
  await page.getByPlaceholder('人・組織・社会・世界...どんな変化が起きているか').fill('人が自分の言葉で進み始めている');
  await page.getByRole('button', { name: /才覚領域を解析する/ }).click();
}

export function saikakuParent(attemptCount = 1) {
  return {
    attemptCount,
    pendingAttemptId: null,
    latestAttemptId: 'attempt-1',
    selectedKakuchiiki: '問いに火を灯す人',
    result: saikakuResult(),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

export function saikakuAttempt() {
  return {
    status: 'committed',
    createdAt: Timestamp.now(),
    summary: {
      kakuchiiki: '問いに火を灯す人',
      typeName: null,
      createdAt: Timestamp.now(),
    },
    full: {
      result: saikakuResult(),
      analysis: null,
      scores: null,
      selectedKakuchiiki: '問いに火を灯す人',
    },
    raw: { input: {} },
  };
}

function saikakuResult() {
  return {
    name: 'E2E User',
    talent: {
      axis1: { name: '言語化', english: 'Articulation', description: '言葉にする力', items: ['観察'], percentage: 40 },
      axis2: { name: '設計力', english: 'Design', description: '組み立てる力', items: ['構造化'], percentage: 35 },
      axis3: { name: '共感力', english: 'Empathy', description: '願いを読む力', items: ['伴走'], percentage: 25 },
    },
    value: {
      axis1: { name: '誠実', english: 'Integrity', description: '本音と行動をそろえる', items: ['誠実'], percentage: 45 },
      axis2: { name: '成長', english: 'Growth', description: '変化を歓迎する', items: ['成長'], percentage: 35 },
      axis3: { name: '貢献', english: 'Contribution', description: '一歩を支える', items: ['貢献'], percentage: 20 },
    },
    passion: {
      axis1: { name: '探究', english: 'Inquiry', description: '問いを深める', items: ['探究'], percentage: 42 },
      axis2: { name: '発信', english: 'Expression', description: '外へ届ける', items: ['発信'], percentage: 33 },
      axis3: { name: '実践', english: 'Practice', description: '試しながら形にする', items: ['実践'], percentage: 25 },
    },
    kakuchiiki: '問いに火を灯す人',
    kakuchiiki_options: ['問いに火を灯す人', '本音を形にする案内人', '探究を道に変える人'],
    insight: 'まだ言葉にならない願いを見つけ、次の一歩へ変えていく力があります。',
    what: { products: ['対話メモを作る'], actions: '問いを書く', offer: '本音から動き出す人を増やす' },
    reward: { economic: '講座化', social: '決断に立ち会う', intrinsic: '問いを見つける', model: '問いで支える' },
  };
}
