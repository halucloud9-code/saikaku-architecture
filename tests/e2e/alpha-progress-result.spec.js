import { test, expect } from '@playwright/test';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createAuthUser } from './_helpers.js';

// α進捗報告会：発表者向け集計結果ページ（/alpha-progress/result/{groupId}）の E2E。
// ログイン必須・事業単位・実名表示（生メアドはマスク）を emulator 実データで検証する。

const EVENT_ID = 'retreat-alpha-progress-2026-0606';
const GROUP_ID = 'g01';
const GROUP_NAME = '日常生活に祈りを取り戻すAI大和風水プロジェクト';
const PRESENTER = '長田広美';

function db() {
  if (!getApps().length) {
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-saikaku' });
  }
  return getFirestore();
}

function resonanceCol() {
  return db().collection('alpha_events').doc(EVENT_ID).collection('resonance');
}

const SEED = [
  {
    id: 'seedA__g01',
    fromUid: 'seedA', fromName: '勝屋裕貴',
    toUid: GROUP_ID, toName: GROUP_NAME, presenter: PRESENTER,
    saikaku: ['実行力', '企画力'], domains: ['AI'],
    actions: ['一緒に何かやりたい'],
    help: 'AIチームで開発を巻き取れる', oneworld: '安田講堂のブースでデモを出せる',
    talkLevel: 5,
  },
  {
    id: 'seedB__g01',
    // displayName 未設定のメールログインを想定 → fromName が生メアド。@より前だけ表示されること。
    fromUid: 'seedB', fromName: 'taro@example.com',
    toUid: GROUP_ID, toName: GROUP_NAME, presenter: PRESENTER,
    saikaku: ['共感力'], domains: [],
    actions: ['応援したい'],
    help: '', oneworld: '',
    talkLevel: 3,
  },
  {
    // 別事業の回答。g01 の結果ページには出ないこと（事業の分離）。
    id: 'seedC__g02',
    fromUid: 'seedC', fromName: '別事業さん',
    toUid: 'g02', toName: '學童保育プロジェクト', presenter: '飯塚玄氣',
    saikaku: ['教育力'], domains: ['教育'], actions: ['応援したい'],
    help: 'これは別事業のフィードバック', oneworld: '',
    talkLevel: 4,
  },
];

test.beforeAll(async () => {
  await Promise.all(SEED.map(({ id, ...data }) => resonanceCol().doc(id).set(data)));
});

test.afterAll(async () => {
  await Promise.all(SEED.map(({ id }) => resonanceCol().doc(id).delete()));
});

async function loginToAlphaProgress(page, email, password) {
  await page.getByRole('checkbox').check({ force: true });
  await page.getByPlaceholder('メールアドレス').fill(email);
  await page.getByPlaceholder('パスワード（6文字以上）').fill(password);
  await page.getByPlaceholder('パスワード（6文字以上）').press('Enter');
}

test('発表者向け結果ページ：ログイン後にその事業の共鳴が実名・集計付きで表示される', async ({ page }) => {
  const email = `presenter-${Date.now()}@example.com`;
  await createAuthUser(email, 'pass1234');

  await page.goto(`/alpha-progress/result/${GROUP_ID}`);
  await loginToAlphaProgress(page, email, 'pass1234');

  // 事業名・発表者
  await expect(page.getByText(GROUP_NAME)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(`発表：${PRESENTER}`)).toBeVisible();

  // 実名表示
  await expect(page.getByText('勝屋裕貴')).toBeVisible();

  // 生メアドは @ より前だけ表示される（フルアドレスは出ない）
  await expect(page.getByText('taro', { exact: true })).toBeVisible();
  await expect(page.getByText('taro@example.com')).toHaveCount(0);

  // 自由記述（力になれること）が表示される
  await expect(page.getByText('AIチームで開発を巻き取れる')).toBeVisible();

  // 後で話したい度 平均 = (5+3)/2 = 4.0
  await expect(page.getByText('4.0')).toBeVisible();

  // 別事業（g02）の回答は出ない（事業の分離）
  await expect(page.getByText('これは別事業のフィードバック')).toHaveCount(0);
});

test('存在しない groupId は「事業が見つかりません」を表示する', async ({ page }) => {
  const email = `presenter2-${Date.now()}@example.com`;
  await createAuthUser(email, 'pass1234');

  await page.goto('/alpha-progress/result/nonexistent');
  await loginToAlphaProgress(page, email, 'pass1234');

  await expect(page.getByText('事業が見つかりません')).toBeVisible({ timeout: 15000 });
});
