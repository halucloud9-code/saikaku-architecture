import { test, expect } from '@playwright/test';
import { clearUser, createAuthUser, fillSaikakuForm, loginAs } from './_helpers.js';

test('badge display after a saikaku diagnosis', async ({ page }) => {
  const email = `e2e-badge-${Date.now()}@example.com`;
  const password = 'password123';
  const user = await createAuthUser(email, password);
  await clearUser(user.uid);

  await loginAs(page, email, password);
  await expect(page.getByTestId('badge-saikaku')).toHaveCount(0);

  await page.getByTestId('card-saikaku').click();
  await expect(page.getByRole('heading', { name: '才覚領域を発見する' })).toBeVisible({ timeout: 15000 });
  await fillSaikakuForm(page);

  await expect(page.getByText('問いに火を灯す人').first()).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'もう一度解析する' }).click();

  await expect(page.getByTestId('badge-saikaku')).toContainText('診断済み (1/2)', { timeout: 15000 });
  await expect(page.getByTestId('history-link-saikaku')).toContainText('履歴を見る (1)');
});
