import { test, expect } from '@playwright/test';
import { clearUser, createAuthUser, loginAs, seedUser, uaamAttempt, uaamParent } from './_helpers.js';

test('uaam history list to detail and back', async ({ page }) => {
  const email = `e2e-uaam-history-${Date.now()}@example.com`;
  const password = 'password123';
  const user = await createAuthUser(email, password);
  await clearUser(user.uid);
  await seedUser(user.uid, 'uaam', {
    parent: uaamParent(1),
    attempts: { 'attempt-1': uaamAttempt() },
  });

  await loginAs(page, email, password);
  await expect(page.getByTestId('history-link-uaam')).toContainText('履歴を見る (1)', { timeout: 15000 });
  await page.getByTestId('history-link-uaam').click();

  await expect(page.getByTestId('history-item')).toHaveCount(1);
  await page.getByTestId('history-item').first().click();

  await expect(page.getByText('Unique Ability Activation Matrix').first()).toBeVisible();
  await page.getByRole('button', { name: /履歴に戻る/ }).first().click();
  await expect(page.getByTestId('history-item')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: '才覚発動領域 MATRIX' })).toBeVisible();
});
