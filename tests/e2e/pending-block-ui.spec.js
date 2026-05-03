import { test, expect } from '@playwright/test';
import { clearUser, createAuthUser, loginAs, pendingAttempt, seedUser } from './_helpers.js';

test('pending residue blocks starting another saikaku diagnosis', async ({ page }) => {
  const email = `e2e-pending-block-${Date.now()}@example.com`;
  const password = 'password123';
  const user = await createAuthUser(email, password);
  await clearUser(user.uid);
  await seedUser(user.uid, 'saikaku', {
    parent: {
      attemptCount: 1,
      pendingAttemptId: 'pending-1',
    },
    attempts: {
      'pending-1': pendingAttempt(-2 * 60 * 1000),
    },
  });

  await loginAs(page, email, password);
  await expect(page.getByTestId('history-link-saikaku')).toContainText('履歴を見る (0)', { timeout: 15000 });
  await expect(page.getByText('処理中…')).toBeVisible();

  const alertMessages = [];
  await page.exposeFunction('__captureAlert', (msg) => alertMessages.push(msg));
  await page.evaluate(() => {
    window.alert = (msg) => window.__captureAlert(String(msg));
  });

  await page.getByTestId('card-saikaku-overlay').click();
  await expect.poll(() => alertMessages.length, { timeout: 5000 }).toBeGreaterThan(0);
  expect(alertMessages[0]).toContain('処理中の診断があります');
  await expect(page.getByText('才覚領域を発見する')).toHaveCount(0);
});
