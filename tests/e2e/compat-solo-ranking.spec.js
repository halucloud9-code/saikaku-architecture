import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  clearUser,
  createAuthUser,
  loginAs,
  seedUser,
  uaamResult,
} from './_helpers.js';

const password = 'password123';
const screenshotDir = 'screenshots/compat-solo-ranking';
const adminEmail = (process.env.ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS || 'admin-e2e@example.com')
  .split(',')
  .map((email) => email.trim())
  .filter(Boolean)[0];

const FIXTURES = [
  {
    uid: 'e2e-compat-solo-ranking-subject',
    email: 'e2e-compat-solo-ranking-subject@example.com',
    name: 'E2E Solo基準 11',
    score: 11,
  },
  {
    uid: 'e2e-compat-solo-ranking-close-a',
    email: 'e2e-compat-solo-ranking-close-a@example.com',
    name: 'E2E Solo差分 12',
    score: 12,
  },
  {
    uid: 'e2e-compat-solo-ranking-close-b',
    email: 'e2e-compat-solo-ranking-close-b@example.com',
    name: 'E2E Solo差分 13',
    score: 13,
  },
  {
    uid: 'e2e-compat-solo-ranking-identical',
    email: 'e2e-compat-solo-ranking-identical@example.com',
    name: 'E2E Solo同一 11',
    score: 11,
  },
];

const SUBJECT = FIXTURES[0];
const CLOSE_CANDIDATE = FIXTURES[1];
const SECOND_CLOSE_CANDIDATE = FIXTURES[2];
const ZERO_INDEX_CANDIDATE = FIXTURES[3];
const UAAM_GROUPS = {
  mindset: ['meaning', 'mindfulness', 'mindshift', 'mastery'],
  literacy: ['learning', 'logical', 'life', 'leadership'],
  competency: ['critical', 'creativity', 'communication', 'collaboration'],
  impact: ['idea', 'innovation', 'implementation', 'influence'],
};

function getAdminAuth() {
  if (!getApps().length) {
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-saikaku' });
  }
  return getAuth();
}

async function ensureAdminUser() {
  try {
    return await createAuthUser(adminEmail, password);
  } catch (error) {
    if (!String(error?.message).includes('EMAIL_EXISTS')) throw error;
    const existing = await getAdminAuth().getUserByEmail(adminEmail);
    await getAdminAuth().updateUser(existing.uid, {
      password,
      emailVerified: true,
    });
    return existing;
  }
}

function saikakuDocument({ uid, email, name }) {
  const now = new Date().toISOString();
  return {
    uid,
    email,
    name,
    inputTalentTop5: '観察\n構造化',
    inputValueTop5: '誠実\n探究',
    inputPassionTop5: '学習\n実践',
    result: {
      talent: {
        axis1: {
          name: '構造化',
          english: 'Structure',
          description: '情報を整理して形にする',
          items: ['観察'],
          percentage: 80,
        },
      },
      value: {
        axis1: {
          name: '誠実さ',
          english: 'Integrity',
          description: '事実と行動をそろえる',
          items: ['誠実'],
          percentage: 75,
        },
      },
      passion: {
        axis1: {
          name: '学び',
          english: 'Learning',
          description: '試して確かめ続ける',
          items: ['実践'],
          percentage: 70,
        },
      },
    },
    createdAt: now,
    updatedAt: now,
  };
}

function uaamDocument({ uid, email, name, score }) {
  const base = uaamResult();
  const scores = Object.fromEntries(Object.entries(UAAM_GROUPS).map(([group, keys]) => {
    const subs = Object.fromEntries(keys.map((key) => [key, score]));
    return [group, {
      total: score * keys.length,
      max: 80,
      percentage: Math.round((score / 20) * 100),
      subs,
      domainSubs: { ...subs },
      domainTotal: score * keys.length,
    }];
  }));
  return {
    ...base,
    uid,
    email,
    name,
    scores,
    updatedAt: new Date().toISOString(),
  };
}

async function seedProfile(fixture) {
  await Promise.all([
    seedUser(fixture.uid, 'saikaku', { parent: saikakuDocument(fixture) }),
    seedUser(fixture.uid, 'uaam', { parent: uaamDocument(fixture) }),
  ]);
}

function profileCheckbox(page, displayName) {
  return page.locator('.compat-profile', { hasText: displayName }).getByRole('checkbox');
}

async function revealCandidateNames(page) {
  const disclosureConsent = page.getByRole('checkbox', {
    name: /表示される候補者それぞれについて/u,
  });
  const ranking = page.getByRole('list', {
    name: '学び合いやすい組み合わせの候補者ランキング',
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await expect(disclosureConsent).toBeEnabled();
    await disclosureConsent.check();
    try {
      await expect(ranking).toBeVisible({ timeout: 5000 });
      return ranking;
    } catch (error) {
      const staleAlert = page.getByRole('alert').filter({
        hasText: 'データが更新されました。もう一度検索してください',
      });
      if (await staleAlert.count() === 0 || attempt === 2) throw error;
      await expect(disclosureConsent).not.toBeChecked();
    }
  }
  throw new Error('候補者ランキングを表示できませんでした');
}

test.beforeEach(async () => {
  await mkdir(screenshotDir, { recursive: true });
  await Promise.all(FIXTURES.map((fixture) => clearUser(fixture.uid)));
  await ensureAdminUser();
  await Promise.all(FIXTURES.map(seedProfile));
});

test.afterEach(async () => {
  await Promise.all(FIXTURES.map((fixture) => clearUser(fixture.uid)));
});

test('solo mode renders the matrix and consent-gated learning ranking without LLM or sharing, then pair mode still analyzes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const compatRequests = [];
  await page.route('**/api/admin/compat-**', async (route) => {
    compatRequests.push(new URL(route.request().url()).pathname);
    await route.continue();
  });

  await loginAs(page, adminEmail, password);
  await page.goto('/admin/compat');
  await expect(page.getByRole('heading', { name: '相性診断' })).toBeVisible({ timeout: 15000 });

  await page.getByRole('button', { name: '1人' }).click();
  await profileCheckbox(page, SUBJECT.name).check();
  await page.getByRole('checkbox', { name: /対象者全員から/u }).check();
  await page.getByRole('button', { name: '力マップと相性を見る' }).click();

  await expect(page.getByRole('heading', { name: '発動領域Matrix', exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('table', { name: 'UAAM 16軸の発動領域マップ' })).toBeVisible();
  await expect(page.locator('.compat-matrix').getByText('チーム')).toHaveCount(0);
  expect(compatRequests.filter((path) => path === '/api/admin/compat-analyze')).toHaveLength(0);
  expect(compatRequests.filter((path) => path === '/api/admin/compat-recommend').length).toBeGreaterThanOrEqual(1);

  const rankingRegion = page.locator('.compat-ranking-summary, .compat-ranking-list');
  await expect(page.getByRole('heading', { name: '学び合いやすい組み合わせ' })).toBeVisible();
  await expect(rankingRegion.getByText(/\d+点/u)).toHaveCount(0);
  await expect(page.getByRole('region', { name: '分析結果の共有' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '共有URLを発行' })).toHaveCount(0);

  const ranking = await revealCandidateNames(page);
  await expect(ranking.getByText(CLOSE_CANDIDATE.name, { exact: true })).toBeVisible();
  await expect(ranking.getByText(SECOND_CLOSE_CANDIDATE.name, { exact: true })).toBeVisible();
  await expect(ranking.getByText(/^\d+点$/u).first()).toBeVisible();
  await expect(ranking.getByText(/120マスのうち/u).first()).toBeVisible();
  await expect(ranking.getByText(/平均点の差/u).first()).toBeVisible();
  await expect(ranking.getByText(ZERO_INDEX_CANDIDATE.name, { exact: true })).toHaveCount(0);

  await page.screenshot({
    path: `${screenshotDir}/solo-after-consent.png`,
    fullPage: true,
  });

  await page.getByRole('button', { name: 'ペア（2名）' }).click();
  await profileCheckbox(page, SUBJECT.name).check();
  await profileCheckbox(page, CLOSE_CANDIDATE.name).check();
  await page.getByRole('checkbox', { name: /対象者全員から/u }).check();
  await page.getByRole('button', { name: '相性を分析する' }).click();

  const pairReport = page.getByRole('region', { name: '相性分析結果' });
  await expect(pairReport).toBeVisible({ timeout: 15000 });
  await expect(pairReport.getByText('この診断データでは同質性を示す証拠は不検出です。')).toBeVisible();
  expect(compatRequests.filter((path) => path === '/api/admin/compat-analyze').length).toBeGreaterThanOrEqual(1);
});
