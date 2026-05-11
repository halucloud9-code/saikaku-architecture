import { test, expect } from '@playwright/test';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import {
  clearUser,
  createAuthUser,
  downloadCsvAndAssert,
  loginAs,
  saikakuParent,
  seedUser,
  uaamParent,
} from './_helpers.js';
import { buildPairKey } from '../../shared/integrationsKey.js';

const password = 'password123';
const adminEmail = (process.env.ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS || 'admin-e2e@example.com')
  .split(',')
  .map((email) => email.trim())
  .filter(Boolean)[0];

const UIDS = {
  alpha: 'e2e-admin-integrations-search-alpha',
  beta: 'e2e-admin-integrations-search-beta',
  gamma: 'e2e-admin-integrations-search-gamma',
};

const ALPHA_EMAIL = 'e2e-int-search-a1@example.com';
const BETA_EMAIL = 'e2e-int-search-b2@example.com';
const GAMMA_EMAIL = 'e2e-int-search-c3@example.com';

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

function at(day) {
  return Timestamp.fromDate(new Date(`2026-05-${String(day).padStart(2, '0')}T00:00:00.000Z`));
}

async function deleteCollectionDocs(collectionRef) {
  const snap = await collectionRef.get();
  if (snap.empty) return;
  const batch = getDb().batch();
  snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();
}

async function clearIntegrationDocs(uid) {
  await deleteCollectionDocs(getDb().collection('uaam_results').doc(uid).collection('integrations'));
}

async function clearFixtureUid(uid) {
  await clearIntegrationDocs(uid);
  await clearUser(uid);
}

async function deleteAuthUserByEmail(email) {
  try {
    const user = await getAdminAuth().getUserByEmail(email);
    await clearUser(user.uid);
    await getAdminAuth().deleteUser(user.uid);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
  }
}

async function cleanup() {
  await Promise.all(Object.values(UIDS).map(clearFixtureUid));
  await deleteAuthUserByEmail(adminEmail);
}

async function seedParentPair(uid, overrides = {}) {
  await Promise.all([
    seedUser(uid, 'saikaku', {
      parent: {
        ...saikakuParent(1),
        uid,
        name: overrides.name,
        email: overrides.email,
        latestAttemptId: overrides.latestSaikakuAttemptId,
      },
    }),
    seedUser(uid, 'uaam', {
      parent: {
        ...uaamParent(1),
        uid,
        name: overrides.name,
        email: overrides.email,
        latestAttemptId: overrides.latestUaamAttemptId,
      },
    }),
  ]);
}

async function seedIntegration(uid, saikakuAttemptId, uaamAttemptId, overrides = {}) {
  const pairKey = buildPairKey(saikakuAttemptId, uaamAttemptId);
  await getDb().collection('uaam_results').doc(uid).collection('integrations').doc(pairKey).set({
    saikakuAttemptId,
    uaamAttemptId,
    integration: {
      integration_score: overrides.score ?? 80,
      activation_core: `${overrides.name} integration core`,
    },
    regenerationCount: 0,
    model: 'claude-sonnet-4-20250514',
    source: {
      saikakuLabel: overrides.saikakuLabel,
      uaamLabel: overrides.uaamLabel,
    },
    status: 'active',
    createdAt: overrides.createdAt,
    updatedAt: overrides.updatedAt ?? overrides.createdAt,
  });
}

async function seedIntegrationsSearchFixture() {
  await seedParentPair(UIDS.alpha, {
    name: 'E2E Integration Search One',
    email: ALPHA_EMAIL,
    latestSaikakuAttemptId: 'saikaku-search-alpha',
    latestUaamAttemptId: 'uaam-search-alpha',
  });
  await seedIntegration(UIDS.alpha, 'saikaku-search-alpha', 'uaam-search-alpha', {
    name: 'alpha',
    score: 91,
    saikakuLabel: 'ALPHA-LABEL',
    uaamLabel: 'Search UAAM One',
    createdAt: at(11),
  });

  await seedParentPair(UIDS.beta, {
    name: 'E2E Integration Search Two',
    email: BETA_EMAIL,
    latestSaikakuAttemptId: 'saikaku-search-beta',
    latestUaamAttemptId: 'uaam-search-beta',
  });
  await seedIntegration(UIDS.beta, 'saikaku-search-beta', 'uaam-search-beta', {
    name: 'beta',
    score: 82,
    saikakuLabel: 'Search Saikaku Two',
    uaamLabel: 'BETA-LABEL',
    createdAt: at(10),
  });

  await seedParentPair(UIDS.gamma, {
    name: 'E2E Integration Search Three',
    email: GAMMA_EMAIL,
    latestSaikakuAttemptId: 'saikaku-search-gamma',
    latestUaamAttemptId: 'uaam-search-gamma',
  });
  await seedIntegration(UIDS.gamma, 'saikaku-search-gamma', 'uaam-search-gamma', {
    name: 'gamma',
    score: 73,
    saikakuLabel: 'Search Saikaku Three',
    uaamLabel: 'Search UAAM Three',
    createdAt: at(9),
  });
}

test.beforeEach(async () => {
  await cleanup();
});

test.afterEach(async () => {
  await cleanup();
});

test('admin can search integrations by labels without narrowing CSV export', async ({ page }) => {
  const admin = await createAuthUser(adminEmail, password);
  await clearUser(admin.uid);
  await seedIntegrationsSearchFixture();

  await loginAs(page, adminEmail, password);
  await page.goto('/admin');

  await expect(page.getByRole('button', { name: '統合分析（—）' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /統合分析/ }).click();

  await expect(page.getByRole('table', { name: '統合分析一覧' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(ALPHA_EMAIL)).toBeVisible();
  await expect(page.getByText(BETA_EMAIL)).toBeVisible();
  await expect(page.getByText(GAMMA_EMAIL)).toBeVisible();
  await expect(page.getByText('3 件表示 / 総計 3 件')).toBeVisible();

  const searchInput = page.getByPlaceholder('名前・メール・ラベルで検索...');

  await searchInput.fill('ALPHA');
  await expect(page.getByText(ALPHA_EMAIL)).toBeVisible();
  await expect(page.getByText(BETA_EMAIL)).toHaveCount(0);
  await expect(page.getByText(GAMMA_EMAIL)).toHaveCount(0);
  await expect(page.getByText('1 件表示 / 総計 3 件')).toBeVisible();

  const exportButton = page.getByRole('button', { name: 'CSVエクスポート' });
  const { csvText } = await downloadCsvAndAssert(page, exportButton, 'saikaku_integrations.csv');
  expect(csvText).toContain(ALPHA_EMAIL);
  expect(csvText).toContain(BETA_EMAIL);
  expect(csvText).toContain(GAMMA_EMAIL);

  await searchInput.fill('BETA');
  await expect(page.getByText(ALPHA_EMAIL)).toHaveCount(0);
  await expect(page.getByText(BETA_EMAIL)).toBeVisible();
  await expect(page.getByText(GAMMA_EMAIL)).toHaveCount(0);
  await expect(page.getByText('1 件表示 / 総計 3 件')).toBeVisible();

  await searchInput.fill('alpha');
  await expect(page.getByText(ALPHA_EMAIL)).toBeVisible();
  await expect(page.getByText(BETA_EMAIL)).toHaveCount(0);
  await expect(page.getByText(GAMMA_EMAIL)).toHaveCount(0);

  await searchInput.fill('missing-label');
  await expect(page.getByText('該当する統合分析が見つかりません')).toBeVisible();
  await expect(page.getByText('0 件表示 / 総計 3 件')).toBeVisible();

  await searchInput.fill('ALPHA');
  await page.getByRole('button', { name: /才覚領域/ }).click();
  await expect(page.getByPlaceholder('名前・メール・才覚領域で検索...')).toHaveValue('');
});
