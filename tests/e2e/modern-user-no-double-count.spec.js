import { test, expect } from '@playwright/test';
import { clearUser, createAuthUser, loginAs, saikakuAttempt, saikakuParent, seedUser } from './_helpers.js';

test('modern one-attempt user is not double counted and can start a second diagnosis', async ({ page }) => {
  const email = `e2e-modern-count-${Date.now()}@example.com`;
  const password = 'password123';
  const user = await createAuthUser(email, password);
  await clearUser(user.uid);
  await seedUser(user.uid, 'saikaku', {
    parent: saikakuParent(1),
    attempts: {
      'attempt-1': saikakuAttempt(),
    },
  });

  await loginAs(page, email, password);
  await expect(page.getByTestId('badge-saikaku')).toContainText('診断済み (1/2)', { timeout: 15000 });
  await expect(page.getByTestId('history-link-saikaku')).toContainText('履歴を見る (1)');

  await page.getByTestId('card-saikaku').click();
  await expect(page.getByRole('heading', { name: '才覚領域を発見する' })).toBeVisible({ timeout: 15000 });

  await page.getByRole('button', { name: '← 診断選択に戻る' }).click();
  await expect(page.getByText('才覚解読プログラム')).toBeVisible();
  await page.getByTestId('history-link-saikaku').click();

  await expect(page.getByTestId('history-item')).toHaveCount(1);
});
