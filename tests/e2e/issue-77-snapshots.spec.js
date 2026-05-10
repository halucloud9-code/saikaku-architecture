import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import {
  clearUser,
  createAuthUser,
  loginAs,
  seedUser,
  uaamAttempt,
  uaamParent,
} from './_helpers.js';

const SCREENSHOT_DIR = 'screenshots/issue-77';
const VIEWPORT_WIDTHS = [375, 414, 430, 520];
const password = 'password123';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
});

async function seedAndOpenResult(page, viewportWidth) {
  await page.setViewportSize({ width: viewportWidth, height: 900 });
  const email = `e2e-issue77-${viewportWidth}-${Date.now()}@example.com`;
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

  return user;
}

for (const width of VIEWPORT_WIDTHS) {
  test(`activation-matrix corner badge snapshot @${width}`, async ({ page }) => {
    await seedAndOpenResult(page, width);
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/state-clean-${width}.png`,
      fullPage: true,
    });
  });
}

test('activation-matrix corner badge print preview', async ({ page }) => {
  await seedAndOpenResult(page, 520);
  await page.waitForTimeout(2000);
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/print.png`,
    fullPage: true,
  });
});

async function seedAdminAndOpenUaamDetail(page, viewportWidth) {
  await page.setViewportSize({ width: viewportWidth, height: 900 });
  const adminEmail = (process.env.ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS || 'admin-e2e@example.com')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)[0];

  try {
    await createAuthUser(adminEmail, password);
  } catch (e) {
    // already exists
  }
  const targetUid = `e2e-issue77-admin-${viewportWidth}`;
  await clearUser(targetUid);
  await seedUser(targetUid, 'uaam', {
    parent: uaamParent(1),
    attempts: { 'attempt-1': uaamAttempt() },
  });

  await loginAs(page, adminEmail, password);
  await page.goto('/admin');

  // Switch to UAAM tab
  await expect(page.getByRole('button', { name: /UAAM診断/ })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /UAAM診断/ }).click();
  await page.waitForTimeout(1000);

  // Click first row in UAAM table
  const firstRow = page.locator('tbody tr').first();
  await expect(firstRow).toBeVisible({ timeout: 10000 });
  await firstRow.click();

  // Wait for ActivationMatrix canvas to appear
  await page.waitForTimeout(2500);
}

for (const width of [375, 520]) {
  test(`activation-matrix admin view snapshot @${width}`, async ({ page }) => {
    await seedAdminAndOpenUaamDetail(page, width);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/admin-${width}.png`,
      fullPage: true,
    });
  });
}
