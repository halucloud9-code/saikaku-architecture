import { test, expect } from '@playwright/test';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { buildPairKey } from '../../shared/integrationsKey.js';
import {
  clearUser,
  createAuthUser,
  loginAs,
  saikakuAttempt,
  saikakuParent,
  seedUser,
  uaamAttempt,
  uaamParent,
  uaamResult,
} from './_helpers.js';

const password = 'password123';
const createdUserIds = new Set();

function getDb() {
  if (!getApps().length) {
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-saikaku' });
  }
  return getFirestore();
}

function at(day) {
  return Timestamp.fromDate(new Date(`2026-05-0${day}T00:00:00.000Z`));
}

function uniqueEmail(slug, testInfo) {
  const suffix = `${Date.now()}-${testInfo.workerIndex}-${Math.random().toString(36).slice(2, 8)}`;
  return `e2e-uaam-recent-${slug}-${suffix}@example.com`;
}

function integrationBody(score, activationCore) {
  return {
    integration_score: score,
    activation_core: activationCore,
    activation_equation: `${activationCore} equation`,
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

async function clearAllUserData(uid) {
  await clearIntegrationDocs(uid);
  await clearUser(uid);
}

async function createCleanUser(slug, testInfo) {
  const email = uniqueEmail(slug, testInfo);
  const user = await createAuthUser(email, password);
  createdUserIds.add(user.uid);
  await clearAllUserData(user.uid);
  return { email, user };
}

async function seedIntegration(uid, saikakuAttemptId, uaamAttemptId, overrides = {}) {
  const pairKey = buildPairKey(saikakuAttemptId, uaamAttemptId);
  await getDb().collection('uaam_results').doc(uid).collection('integrations').doc(pairKey).set({
    saikakuAttemptId,
    uaamAttemptId,
    integration: overrides.integration ?? integrationBody(88, 'E2E Recent Core'),
    regenerationCount: overrides.regenerationCount ?? 0,
    model: 'e2e-fixture',
    source: {
      saikakuLabel: overrides.saikakuLabel ?? `E2E Saikaku ${saikakuAttemptId}`,
      uaamLabel: overrides.uaamLabel ?? `E2E UAAM ${uaamAttemptId}`,
    },
    status: 'active',
    createdAt: overrides.createdAt ?? at(1),
    updatedAt: overrides.updatedAt ?? overrides.createdAt ?? at(1),
  });
}

async function seedUserWithRecentIntegrations(uid) {
  await Promise.all([
    seedUser(uid, 'saikaku', {
      parent: {
        ...saikakuParent(1),
        latestAttemptId: 'saikaku-current',
      },
      attempts: {
        'saikaku-current': saikakuAttempt(),
      },
    }),
    seedUser(uid, 'uaam', {
      parent: {
        ...uaamParent(1),
        latestAttemptId: 'uaam-current',
      },
      attempts: {
        'uaam-current': uaamAttempt(),
      },
    }),
  ]);
  await seedIntegration(uid, 'saikaku-old-a', 'uaam-old-a', {
    integration: integrationBody(81, 'E2E Recent Core 1'),
    createdAt: at(1),
  });
  await seedIntegration(uid, 'saikaku-old-b', 'uaam-old-b', {
    integration: integrationBody(92, 'E2E Recent Core 2'),
    createdAt: at(2),
  });
}

async function waitForUaamResultResponse(page) {
  return page.waitForResponse((response) => (
    response.url().includes('/api/me/uaam-result')
    && response.request().method() === 'GET'
    && response.status() === 200
  ), { timeout: 15000 });
}

async function openSavedUaamResult(page) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.evaluate(() => {
      window.history.pushState({}, '', '/uaam/result');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    try {
      await expect(page.getByRole('button', { name: /才覚×UAAM 統合発動分析を生成する/ })).toBeVisible({ timeout: 1500 });
      return;
    } catch {
      await page.waitForTimeout(250);
    }
  }

  await expect(page.getByRole('button', { name: /才覚×UAAM 統合発動分析を生成する/ })).toBeVisible({ timeout: 15000 });
}

async function loginAndOpenSavedResult(page, email) {
  const resultResponse = waitForUaamResultResponse(page);
  await loginAs(page, email, password);
  await resultResponse;
  await page.waitForLoadState('networkidle');
  await openSavedUaamResult(page);
}

test.afterEach(async () => {
  const userIds = [...createdUserIds];
  createdUserIds.clear();
  await Promise.all(userIds.map((uid) => clearAllUserData(uid)));
});

test('UAAM result shows two recent integration rows and opens modal by click and Enter', async ({ page }, testInfo) => {
  const { email, user } = await createCleanUser('rows-modal', testInfo);
  await seedUserWithRecentIntegrations(user.uid);

  await loginAndOpenSavedResult(page, email);

  await expect(page.getByRole('button', { name: /才覚×UAAM 統合発動分析を生成する/ })).toBeVisible();
  await expect(page.getByTestId('recent-integration-0')).toBeVisible();
  await expect(page.getByTestId('recent-integration-1')).toBeVisible();
  await expect(page.getByTestId('recent-integration-2')).toHaveCount(0);
  await expect(page.getByTestId('recent-integration-0')).toContainText('E2E Recent Core 2');
  await expect(page.getByTestId('recent-integration-1')).toContainText('E2E Recent Core 1');

  await page.getByTestId('recent-integration-0').click();
  const dialog = page.getByRole('dialog', { name: '才覚発動統合分析' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('E2E Recent Core 2', { exact: true })).toBeVisible();

  await dialog.getByRole('button', { name: '閉じる' }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByTestId('recent-integration-1').focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('E2E Recent Core 1', { exact: true })).toBeVisible();
});

test('UAAM result old cache shape without recentIntegrationSummaries does not crash', async ({ page }, testInfo) => {
  const { email } = await createCleanUser('old-cache', testInfo);
  const cachedShape = uaamResult();
  await page.route('**/api/me/uaam-result', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        scores: cachedShape.scores,
        analysis: cachedShape.analysis,
      }),
    });
  });

  await loginAndOpenSavedResult(page, email);

  await expect(page.getByRole('button', { name: /才覚×UAAM 統合発動分析を生成する/ })).toBeVisible();
  await expect(page.getByTestId('recent-integration-0')).toHaveCount(0);
});

test('UAAM history detail renders recent integration rows and opens modal on click and Enter', async ({ page }, testInfo) => {
  const { email, user } = await createCleanUser('history-rows-modal', testInfo);
  await seedUserWithRecentIntegrations(user.uid);

  await loginAs(page, email, password);
  await expect(page.getByTestId('history-link-uaam')).toContainText('履歴を見る (1)', { timeout: 15000 });
  await page.getByTestId('history-link-uaam').click();
  await expect(page.getByTestId('history-item')).toHaveCount(1);
  await page.getByTestId('history-item').first().click();

  await expect(page.getByText('Unique Ability Activation Matrix').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /才覚×UAAM 統合発動分析を生成する/ })).toBeVisible();
  await expect(page.getByTestId('recent-integration-0')).toBeVisible();
  await expect(page.getByTestId('recent-integration-1')).toBeVisible();
  await expect(page.getByTestId('recent-integration-2')).toHaveCount(0);
  await expect(page.getByTestId('recent-integration-0')).toContainText('E2E Recent Core 2');
  await expect(page.getByTestId('recent-integration-1')).toContainText('E2E Recent Core 1');

  await page.getByTestId('recent-integration-0').click();
  const dialog = page.getByRole('dialog', { name: '才覚発動統合分析' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('E2E Recent Core 2', { exact: true })).toBeVisible();

  await dialog.getByRole('button', { name: '閉じる' }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByTestId('recent-integration-1').focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('E2E Recent Core 1', { exact: true })).toBeVisible();
});
