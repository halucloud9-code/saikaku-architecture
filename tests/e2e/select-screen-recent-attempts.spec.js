import { test, expect } from '@playwright/test';
import { Timestamp } from 'firebase-admin/firestore';
import {
  clearUser,
  createAuthUser,
  loginAs,
  saikakuAttempt,
  saikakuParent,
  seedUser,
  uaamAttempt,
  uaamParent,
} from './_helpers.js';

const PASSWORD = 'password123';

test('count=1: SelectScreen から直近診断行をクリックして ResultScreen に遷移', async ({ page }) => {
  const email = `e2e-recent-count1-${Date.now()}@example.com`;
  const user = await createAuthUser(email, PASSWORD);
  await clearUser(user.uid);
  await seedUser(user.uid, 'saikaku', {
    parent: saikakuParent(1),
    attempts: { 'attempt-1': saikakuAttempt() },
  });

  await loginAs(page, email, PASSWORD);

  const recentRow = page.getByTestId('recent-attempt-saikaku-0');
  await expect(recentRow).toBeVisible({ timeout: 15000 });
  await expect(recentRow).toContainText('1回目');
  await expect(recentRow).toContainText('問いに火を灯す人');

  await recentRow.click();

  await expect(page).toHaveURL(/\/history\/saikaku\/attempt-1$/);
  await expect(page.getByText('問いに火を灯す人').first()).toBeVisible();
});

test('count=2: 履歴行が最新→古い順で2件表示され、古い行クリックで該当 attempt を開ける', async ({ page }) => {
  const email = `e2e-recent-count2-${Date.now()}@example.com`;
  const user = await createAuthUser(email, PASSWORD);
  await clearUser(user.uid);

  const olderAt = Timestamp.fromDate(new Date('2026-04-30T10:00:00.000Z'));
  const newerAt = Timestamp.fromDate(new Date('2026-05-02T10:00:00.000Z'));

  await seedUser(user.uid, 'saikaku', {
    parent: { ...saikakuParent(2), latestAttemptId: 'attempt-newer' },
    attempts: {
      'attempt-older': {
        ...saikakuAttempt(),
        createdAt: olderAt,
        summary: {
          kakuchiiki: '問いに火を灯す人',
          typeName: null,
          createdAt: olderAt,
        },
      },
      'attempt-newer': {
        ...saikakuAttempt(),
        createdAt: newerAt,
        summary: {
          kakuchiiki: '問いに火を灯す人',
          typeName: null,
          createdAt: newerAt,
        },
      },
    },
  });

  await loginAs(page, email, PASSWORD);

  const newerRow = page.getByTestId('recent-attempt-saikaku-0');
  const olderRow = page.getByTestId('recent-attempt-saikaku-1');
  await expect(newerRow).toBeVisible({ timeout: 15000 });
  await expect(olderRow).toBeVisible();

  // 最新行が 2回目、古い行が 1回目（HistoryScreen と同じ流儀）
  await expect(newerRow).toContainText('2回目');
  await expect(olderRow).toContainText('1回目');

  await olderRow.click();

  await expect(page).toHaveURL(/\/history\/saikaku\/attempt-older$/);
  await expect(page.getByText('問いに火を灯す人').first()).toBeVisible();
});

test('legacy のみ: 「保存済み履歴」が表示され、クリックで legacy-fallback ResultScreen が開く', async ({ page }) => {
  const email = `e2e-recent-legacy-${Date.now()}@example.com`;
  const user = await createAuthUser(email, PASSWORD);
  await clearUser(user.uid);

  // attempts コレクションを seed しない (parent のみ) → legacy fallback 経路
  await seedUser(user.uid, 'saikaku', {
    parent: { ...saikakuParent(0), pendingAttemptId: null, latestAttemptId: null },
    // attempts: なし
  });

  await loginAs(page, email, PASSWORD);

  const recentRow = page.getByTestId('recent-attempt-saikaku-0');
  await expect(recentRow).toBeVisible({ timeout: 15000 });
  await expect(recentRow).toContainText('保存済み履歴');
  await expect(recentRow).toContainText('問いに火を灯す人');

  await recentRow.click();

  await expect(page).toHaveURL(/\/history\/saikaku\/legacy-fallback$/);
  await expect(page.getByText('問いに火を灯す人').first()).toBeVisible();
});

test('UAAM count=1: SelectScreen の UAAM カード recentAttempts も同様に動く', async ({ page }) => {
  const email = `e2e-recent-uaam-${Date.now()}@example.com`;
  const user = await createAuthUser(email, PASSWORD);
  await clearUser(user.uid);
  await seedUser(user.uid, 'uaam', {
    parent: uaamParent(1),
    attempts: { 'attempt-1': uaamAttempt() },
  });

  await loginAs(page, email, PASSWORD);

  const recentRow = page.getByTestId('recent-attempt-uaam-0');
  await expect(recentRow).toBeVisible({ timeout: 15000 });
  await expect(recentRow).toContainText('1回目');
  await expect(recentRow).toContainText('E2Eタイプ');

  await recentRow.click();

  await expect(page).toHaveURL(/\/history\/uaam\/attempt-1$/);
});
