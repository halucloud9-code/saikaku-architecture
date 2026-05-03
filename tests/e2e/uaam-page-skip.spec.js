import { test, expect } from '@playwright/test';
import {
  clearUser,
  createAuthUser,
  loginAs,
  fillUaamLikertOnPage,
  gotoUaamScreen,
  getCurrentUaamPage,
  clickUaamPageDot,
  clickUaamNext,
  clickUaamJumpIncomplete,
  UAAM_TOTAL_PAGES,
} from './_helpers.js';

test.describe('UAAM page-skip prevention', () => {
  let user;

  test.beforeEach(async () => {
    const email = `e2e-uaam-skip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
    const password = 'password123';
    user = await createAuthUser(email, password);
    await clearUser(user.uid);
  });

  test('next-button-is-aria-disabled-on-page1-when-nothing-answered', async ({ page }) => {
    await loginAs(page, user.email, user.password);
    await gotoUaamScreen(page);

    expect(await getCurrentUaamPage(page)).toBe(0);
    await expect(page.getByTestId('uaam-next-btn')).toHaveAttribute('aria-disabled', 'true');

    await clickUaamNext(page);
    await page.waitForTimeout(250);
    expect(await getCurrentUaamPage(page)).toBe(0);
  });

  test('cannot-dot-jump-beyond-max-reachable-page-when-only-page1-is-complete', async ({ page }) => {
    await loginAs(page, user.email, user.password);
    await gotoUaamScreen(page);

    await fillUaamLikertOnPage(page, 0);
    await clickUaamNext(page);
    await page.waitForTimeout(75);
    expect(await getCurrentUaamPage(page)).toBe(1);

    await expect(page.getByTestId('uaam-page-dot-2')).toHaveAttribute('aria-disabled', 'true');
    await clickUaamPageDot(page, 2);
    await page.waitForTimeout(250);
    expect(await getCurrentUaamPage(page)).toBe(1);
  });

  test('production-incident-page5-unanswered-cannot-reach-page6', async ({ page }) => {
    await loginAs(page, user.email, user.password);
    await gotoUaamScreen(page);

    for (let i = 0; i <= 3; i += 1) {
      await fillUaamLikertOnPage(page, i);
      await clickUaamNext(page);
      await page.waitForTimeout(75);
    }

    expect(await getCurrentUaamPage(page)).toBe(4);
    await expect(page.getByTestId('uaam-page-dot-5')).toHaveAttribute('aria-disabled', 'true');

    await clickUaamPageDot(page, 5);
    await page.waitForTimeout(250);
    expect(await getCurrentUaamPage(page)).toBe(4);
  });

  test('jump-incomplete-button-stays-on-final-page-when-final-page-is-incomplete', async ({ page }) => {
    await loginAs(page, user.email, user.password);
    await gotoUaamScreen(page);

    for (let i = 0; i < UAAM_TOTAL_PAGES - 1; i += 1) {
      await fillUaamLikertOnPage(page, i);
      await clickUaamNext(page);
      await page.waitForTimeout(75);
    }

    expect(await getCurrentUaamPage(page)).toBe(UAAM_TOTAL_PAGES - 1);
    await expect(page.getByTestId('uaam-jump-incomplete-btn')).toHaveCount(1);

    await clickUaamJumpIncomplete(page);
    await page.waitForTimeout(250);
    expect(await getCurrentUaamPage(page)).toBe(UAAM_TOTAL_PAGES - 1);
  });

  test('happy-path-completes-all-67-questions-and-reaches-final-page', async ({ page }) => {
    await loginAs(page, user.email, user.password);
    await gotoUaamScreen(page);

    for (let i = 0; i < UAAM_TOTAL_PAGES - 1; i += 1) {
      await fillUaamLikertOnPage(page, i);
      await clickUaamNext(page);
      await page.waitForTimeout(75);
    }
    await fillUaamLikertOnPage(page, UAAM_TOTAL_PAGES - 1);

    expect(await getCurrentUaamPage(page)).toBe(UAAM_TOTAL_PAGES - 1);
    await expect(page.getByTestId('uaam-next-btn')).toHaveCount(0);
    await expect(page.getByTestId('uaam-jump-incomplete-btn')).toHaveCount(0);
  });
});
