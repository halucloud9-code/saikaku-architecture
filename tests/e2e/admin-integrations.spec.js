import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import {
  clearUser,
  createAuthUser,
  loginAs,
  saikakuParent,
  seedUser,
  uaamParent,
} from './_helpers.js';
import { buildPairKey } from '../../shared/integrationsKey.js';

const password = 'password123';
const screenshotDir = 'screenshots/issue-73';
const adminEmail = (process.env.ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS || 'admin-e2e@example.com')
  .split(',')
  .map((email) => email.trim())
  .filter(Boolean)[0];

const UIDS = {
  active: 'e2e-admin-integrations-active',
  staleSaikaku: 'e2e-admin-integrations-stale-saikaku',
  staleUaam: 'e2e-admin-integrations-stale-uaam',
  legacy: 'e2e-admin-integrations-legacy',
};

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
  return Timestamp.fromDate(new Date(`2026-05-0${day}T00:00:00.000Z`));
}

function integrationBody(score, activationCore) {
  return {
    integration_score: score,
    activation_core: activationCore,
    activation_equation: `${activationCore} equation`,
    coaching_questions: ['E2E admin-only coaching question'],
  };
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

async function seedIntegration(uid, saikakuAttemptId, uaamAttemptId, overrides = {}) {
  const pairKey = buildPairKey(saikakuAttemptId, uaamAttemptId);
  await getDb().collection('uaam_results').doc(uid).collection('integrations').doc(pairKey).set({
    saikakuAttemptId,
    uaamAttemptId,
    integration: overrides.integration ?? integrationBody(88, 'E2E Integration Core'),
    regenerationCount: overrides.regenerationCount ?? 0,
    model: overrides.model ?? 'claude-sonnet-4-20250514',
    source: {
      saikakuLabel: overrides.saikakuLabel ?? `E2E Saikaku ${saikakuAttemptId}`,
      uaamLabel: overrides.uaamLabel ?? `E2E UAAM ${uaamAttemptId}`,
    },
    status: 'active',
    createdAt: overrides.createdAt,
    updatedAt: overrides.updatedAt ?? overrides.createdAt,
  });
}

async function seedParentPair(uid, overrides = {}) {
  await Promise.all([
    seedUser(uid, 'saikaku', {
      parent: {
        ...saikakuParent(1),
        uid,
        name: overrides.saikakuName ?? overrides.name ?? 'E2E Integration User',
        email: overrides.saikakuEmail ?? overrides.email ?? 'integration-user@example.com',
        latestAttemptId: overrides.latestSaikakuAttemptId ?? 'saikaku-current',
      },
    }),
    seedUser(uid, 'uaam', {
      parent: {
        ...uaamParent(1),
        uid,
        name: overrides.uaamName ?? overrides.name ?? 'E2E Integration User',
        email: overrides.uaamEmail ?? overrides.email ?? 'integration-user@example.com',
        latestAttemptId: overrides.latestUaamAttemptId ?? 'uaam-current',
      },
    }),
  ]);
}

async function seedAdminIntegrationsDataset() {
  await seedParentPair(UIDS.active, {
    name: 'E2E Active User',
    email: 'e2e-active@example.com',
    latestSaikakuAttemptId: 'saikaku-active',
    latestUaamAttemptId: 'uaam-active',
  });
  await seedIntegration(UIDS.active, 'saikaku-active', 'uaam-active', {
    regenerationCount: 1,
    integration: integrationBody(92, 'E2E Active Integration Core'),
    saikakuLabel: 'E2E Saikaku Active Label',
    uaamLabel: 'E2E UAAM Active Label',
    createdAt: at(4),
  });

  await seedParentPair(UIDS.staleSaikaku, {
    name: 'E2E Stale Saikaku User',
    email: 'e2e-stale-saikaku@example.com',
    latestSaikakuAttemptId: 'saikaku-new',
    latestUaamAttemptId: 'uaam-current',
  });
  await seedIntegration(UIDS.staleSaikaku, 'saikaku-old', 'uaam-current', {
    integration: integrationBody(63, 'E2E Stale Saikaku Core'),
    createdAt: at(3),
  });

  await seedParentPair(UIDS.staleUaam, {
    name: 'E2E Stale UAAM User',
    email: 'e2e-stale-uaam@example.com',
    latestSaikakuAttemptId: 'saikaku-current',
    latestUaamAttemptId: 'uaam-new',
  });
  await seedIntegration(UIDS.staleUaam, 'saikaku-current', 'uaam-old', {
    integration: integrationBody(58, 'E2E Stale UAAM Core'),
    createdAt: at(2),
  });

  await seedParentPair(UIDS.legacy, {
    name: 'E2E Legacy User',
    email: 'e2e-legacy@example.com',
    latestSaikakuAttemptId: 'saikaku-legacy',
    latestUaamAttemptId: 'uaam-legacy',
  });
  await seedUser(UIDS.legacy, 'uaam', {
    parent: {
      uid: UIDS.legacy,
      name: 'E2E Legacy User',
      email: 'e2e-legacy@example.com',
      latestAttemptId: 'uaam-legacy',
      analysis: {
        type_name: 'Legacy Type',
        saikaku_attempt_label: 'E2E Legacy Saikaku Label',
        uaam_attempt_label: 'E2E Legacy UAAM Label',
        saikaku_integration: integrationBody(77, 'E2E Legacy Integration Core'),
      },
      integrationUpdatedAt: at(5),
      createdAt: at(1),
      updatedAt: at(5),
    },
  });
}

test.beforeEach(async () => {
  await Promise.all(Object.values(UIDS).map(clearFixtureUid));
  await deleteAuthUserByEmail(adminEmail);
});

test.afterEach(async () => {
  await Promise.all(Object.values(UIDS).map(clearFixtureUid));
  await deleteAuthUserByEmail(adminEmail);
});

test('admin can inspect integrations list and shared read-only detail modal', async ({ page }) => {
  await mkdir(screenshotDir, { recursive: true });
  const admin = await createAuthUser(adminEmail, password);
  await clearUser(admin.uid);
  await seedAdminIntegrationsDataset();
  const coachingRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/me/coaching-answers') {
      coachingRequests.push(request.url());
    }
  });

  await loginAs(page, adminEmail, password);
  await page.goto('/admin');

  await expect(page.getByRole('button', { name: '統合分析（—）' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: '統合分析（—）' }).click();

  await expect(page.getByRole('table', { name: '統合分析一覧' })).toBeVisible();
  const table = page.getByRole('table', { name: '統合分析一覧' });
  await expect(table.getByRole('columnheader')).toHaveCount(6);
  await expect(table.getByRole('columnheader', { name: 'ユーザー' })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: '才覚 label' })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'UAAM label' })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: '再生成回数' })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'integration_score' })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: '更新日時' })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'メール' })).toHaveCount(0);
  await expect(table.getByRole('columnheader', { name: 'model' })).toHaveCount(0);
  await expect(table.getByRole('columnheader', { name: 'status' })).toHaveCount(0);
  await expect(table.getByRole('columnheader', { name: 'createdAt' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '統合分析（4）' })).toBeVisible();
  await expect(page.getByText('E2E Active User')).toBeVisible();
  await expect(page.getByText('e2e-active@example.com')).toBeVisible();
  await expect(page.getByText('E2E Saikaku Active Label')).toBeVisible();
  await expect(page.getByText('E2E UAAM Active Label')).toBeVisible();
  const activeRow = page.getByText('E2E Active User').locator('xpath=ancestor::tr');
  await expect(activeRow.getByText('再生成', { exact: true })).toBeVisible();
  await expect(page.getByText('才覚側 stale')).toHaveCount(0);
  await expect(page.getByText('UAAM側 stale')).toHaveCount(0);
  await expect(page.getByText('E2E Legacy User')).toBeVisible();
  await expect(page.getByText('E2E Legacy Saikaku Label')).toBeVisible();
  await expect(page.getByText('(legacy)').first()).toBeVisible();
  await expect(page.getByText('移行前')).toHaveCount(0);
  await page.screenshot({ path: `${screenshotDir}/integrations-tab-list.png`, fullPage: true });

  await activeRow.click();

  const dialog = page.getByRole('dialog', { name: '才覚発動統合分析' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('E2E Active User')).toBeVisible();
  await expect(dialog.getByText('e2e-active@example.com')).toBeVisible();
  await expect(dialog.getByText('E2E Active Integration Core', { exact: true })).toBeVisible();
  await expect(dialog.getByText('E2E Saikaku Active Label')).toBeVisible();
  await expect(dialog.getByText('E2E UAAM Active Label')).toBeVisible();
  await expect(dialog.getByText('コーチングキー質問')).toBeVisible();
  const coachingQuestion = dialog.getByText('E2E admin-only coaching question');
  await expect(coachingQuestion).toBeVisible();
  await expect(coachingQuestion.locator('xpath=preceding-sibling::*[1]')).toHaveText('1');
  await expect(dialog.getByPlaceholder('あなたの考えを書いてみてください')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /回答を保存/ })).toHaveCount(0);
  await expect(dialog.getByText(/保存中|最終保存/)).toHaveCount(0);
  expect(coachingRequests).toHaveLength(0);
  await page.screenshot({ path: `${screenshotDir}/integrations-tab-modal.png`, fullPage: true });

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
