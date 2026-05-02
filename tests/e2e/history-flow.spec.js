import { test, expect } from '@playwright/test';
import { clearUser, createAuthUser, loginAs, saikakuAttempt, saikakuParent, seedUser } from './_helpers.js';

test('history list to detail and back', async ({ page }) => {
  const email = `e2e-history-${Date.now()}@example.com`;
  const password = 'password123';
  const user = await createAuthUser(email, password);
  await clearUser(user.uid);
  await seedUser(user.uid, 'saikaku', {
    parent: saikakuParent(1),
    attempts: { 'attempt-1': saikakuAttempt() },
  });

  await loginAs(page, email, password);
  await expect(page.getByTestId('history-link-saikaku')).toContainText('履歴を見る (1)', { timeout: 15000 });
  await page.getByTestId('history-link-saikaku').click();

  await expect(page.getByTestId('history-item')).toHaveCount(1);
  await page.getByTestId('history-item').first().click();

  await expect(page.getByText('問いに火を灯す人').first()).toBeVisible();
  await page.getByRole('button', { name: '最新の結果に戻る' }).first().click();
  await expect(page.getByText('才覚解読プログラム')).toBeVisible();
});
