import { test, expect } from '@playwright/test';
import { clearUser, createAuthUser, loginAs, saikakuAttempt, saikakuParent, seedUser } from './_helpers.js';

test('attemptCount=2 blocks starting another saikaku diagnosis', async ({ page }) => {
  const email = `e2e-limit-${Date.now()}@example.com`;
  const password = 'password123';
  const user = await createAuthUser(email, password);
  await clearUser(user.uid);
  await seedUser(user.uid, 'saikaku', {
    parent: saikakuParent(2),
    attempts: {
      'attempt-1': saikakuAttempt(),
      'attempt-2': saikakuAttempt(),
    },
  });

  await loginAs(page, email, password);
  await expect(page.getByTestId('badge-saikaku')).toContainText('診断済み (2/2)', { timeout: 15000 });
  await expect(page.getByText('診断は最大2回まで実施済み')).toBeVisible();

  // window.alert は Playwright が自動 dismiss するため、capture 用に override する
  const alertMessages = [];
  await page.exposeFunction('__captureAlert', (msg) => alertMessages.push(msg));
  await page.evaluate(() => {
    window.alert = (msg) => window.__captureAlert(String(msg));
  });

  await page.getByTestId('card-saikaku').click();
  await expect.poll(() => alertMessages.length, { timeout: 5000 }).toBeGreaterThan(0);
  expect(alertMessages[0]).toContain('診断は最大2回まで実施済みです');

  await expect(page.getByText('才覚領域を発見する')).toHaveCount(0);
});
