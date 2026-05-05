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

const SAIKAKU_INTEGRATION = {
  integration_score: 75,
  activation_core: 'E2Eコア',
  activation_equation: 'E2E方程式',
  leverage_point: 'E2Eレバレッジ',
  ignition_zones: [],
  latent_zones: [],
  idle_zones: [],
  mission_direction: 'E2Eミッション',
  flow_route: 'E2Eフロー',
  hidden_potential: 'E2E隠れポテンシャル',
  roadmap: { now: 'now', year1: '1y', year3: '3y', year10: '10y' },
  coaching_questions: ['問い1', '問い2', '問い3'],
};

function attemptWithIntegration() {
  const att = uaamAttempt();
  return {
    ...att,
    full: {
      ...att.full,
      analysis: { ...att.full.analysis, saikaku_integration: SAIKAKU_INTEGRATION },
    },
  };
}

function parentWithIntegration() {
  const result = uaamResult();
  return {
    ...uaamParent(1),
    analysis: { ...result.analysis, saikaku_integration: SAIKAKU_INTEGRATION },
    hasSaikakuIntegration: true,
    integrationUpdatedAt: Timestamp.now(),
  };
}

function getDb() {
  if (!getApps().length) {
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-saikaku' });
  }
  return getFirestore();
}

async function seedIntegration(uid, saikakuAttemptId, uaamAttemptId, overrides = {}) {
  const pairKey = buildPairKey(saikakuAttemptId, uaamAttemptId);
  const now = Timestamp.now();
  await getDb()
    .collection('uaam_results')
    .doc(uid)
    .collection('integrations')
    .doc(pairKey)
    .set({
      saikakuAttemptId,
      uaamAttemptId,
      integration: overrides.integration ?? SAIKAKU_INTEGRATION,
      regenerationCount: overrides.regenerationCount ?? 0,
      model: 'e2e-fixture',
      source: overrides.source ?? {
        saikakuLabel: 'E2E才覚',
        uaamLabel: 'E2Eタイプ',
      },
      status: 'active',
      createdAt: overrides.createdAt ?? now,
      updatedAt: overrides.updatedAt ?? now,
    });
}

test('coaching-answers: enter, save, reload restore', async ({ page }) => {
  const email = `e2e-coaching-${Date.now()}@example.com`;
  const password = 'password123';
  const user = await createAuthUser(email, password);
  await clearUser(user.uid);
  await seedUser(user.uid, 'uaam', {
    parent: parentWithIntegration(),
    attempts: { 'attempt-1': attemptWithIntegration() },
  });

  await loginAs(page, email, password);

  // 履歴経由でUAAMResultScreenに遷移（attemptData経路）
  await expect(page.getByTestId('history-link-uaam')).toContainText('履歴を見る (1)', { timeout: 15000 });
  await page.getByTestId('history-link-uaam').click();
  await expect(page.getByTestId('history-item')).toHaveCount(1);
  await page.getByTestId('history-item').first().click();

  // SaikakuIntegrationのアコーディオンヘッダー（button化されている）をクリック
  await expect(page.getByRole('button', { name: /INTEGRATION|才覚発動統合分析/ })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: /INTEGRATION|才覚発動統合分析/ }).click();

  // 「コーチングキー質問」セクションが見える
  await expect(page.getByText('コーチングキー質問')).toBeVisible({ timeout: 10000 });

  // textareaが3つ表示される（質問数=3）
  const textareas = page.getByPlaceholder('あなたの考えを書いてみてください');
  await expect(textareas).toHaveCount(3);

  // 入力
  await textareas.nth(0).fill('回答A');
  await textareas.nth(1).fill('回答B');

  // 保存ボタンクリック
  const saveBtn = page.getByRole('button', { name: /💾 回答を保存/ });
  await saveBtn.click();

  // 「最終保存」が出るまで待つ（保存成功シグナル）
  await expect(page.getByText(/最終保存:/)).toBeVisible({ timeout: 10000 });

  // リロード（history detail URL のまま再描画される）
  await page.reload();

  // SaikakuIntegrationのアコーディオンが再描画される
  await expect(page.getByRole('button', { name: /INTEGRATION|才覚発動統合分析/ })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /INTEGRATION|才覚発動統合分析/ }).click();
  await expect(page.getByText('コーチングキー質問')).toBeVisible({ timeout: 10000 });

  const textareasAfterReload = page.getByPlaceholder('あなたの考えを書いてみてください');
  await expect(textareasAfterReload.nth(0)).toHaveValue('回答A');
  await expect(textareasAfterReload.nth(1)).toHaveValue('回答B');
  await expect(textareasAfterReload.nth(2)).toHaveValue('');
});

test('coaching-answers: history integration modal edit, save, reopen restore', async ({ page }) => {
  const email = `e2e-coaching-modal-${Date.now()}@example.com`;
  const password = 'password123';
  const saikakuAttemptId = 'saikaku-attempt-1';
  const uaamAttemptId = 'attempt-1';
  const user = await createAuthUser(email, password);
  await clearUser(user.uid);
  await seedUser(user.uid, 'saikaku', {
    parent: {
      ...saikakuParent(1),
      latestAttemptId: saikakuAttemptId,
    },
    attempts: { [saikakuAttemptId]: saikakuAttempt() },
  });
  await seedUser(user.uid, 'uaam', {
    parent: uaamParent(1),
    attempts: { [uaamAttemptId]: uaamAttempt() },
  });
  await seedIntegration(user.uid, saikakuAttemptId, uaamAttemptId);

  await loginAs(page, email, password);

  await expect(page.getByTestId('history-link-uaam')).toContainText('履歴を見る (1)', { timeout: 15000 });
  await page.getByTestId('history-link-uaam').click();
  await expect(page.getByTestId('history-item')).toHaveCount(1);

  const banner = page.getByTestId('integration-banner');
  await expect(banner).toBeVisible({ timeout: 10000 });
  await banner.click();

  const dialog = page.getByRole('dialog', { name: '才覚発動統合分析' });
  await expect(dialog).toBeVisible({ timeout: 10000 });
  await expect(dialog.getByText('コーチングキー質問')).toBeVisible({ timeout: 10000 });

  const textareas = dialog.getByPlaceholder('あなたの考えを書いてみてください');
  await expect(textareas).toHaveCount(3);
  await textareas.nth(0).fill('履歴Modal回答A');
  await textareas.nth(1).fill('履歴Modal回答B');

  await dialog.getByRole('button', { name: /💾 回答を保存/ }).click();
  await expect(dialog.getByText(/最終保存:/)).toBeVisible({ timeout: 10000 });

  await dialog.getByRole('button', { name: '閉じる' }).click();
  await expect(page.getByTestId('saikaku-integration-modal-backdrop')).toBeHidden();

  await banner.click();
  await expect(dialog).toBeVisible({ timeout: 10000 });
  const textareasAfterReopen = dialog.getByPlaceholder('あなたの考えを書いてみてください');
  await expect(textareasAfterReopen.nth(0)).toHaveValue('履歴Modal回答A');
  await expect(textareasAfterReopen.nth(1)).toHaveValue('履歴Modal回答B');
  await expect(textareasAfterReopen.nth(2)).toHaveValue('');
});
