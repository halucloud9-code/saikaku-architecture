import { test, expect } from '@playwright/test';
import {
  clearUser,
  createAuthUser,
  fillSaikakuForm,
  loginAs,
  saikakuAttempt,
  saikakuParent,
  seedUser,
} from './_helpers.js';

const password = 'password123';
const createdUserIds = new Set();

test.afterEach(async () => {
  const userIds = [...createdUserIds];
  createdUserIds.clear();
  await Promise.all(userIds.map((uid) => clearUser(uid)));
});

function uniqueEmail(slug, testInfo) {
  const suffix = `${Date.now()}-${testInfo.workerIndex}-${Math.random().toString(36).slice(2, 8)}`;
  return `e2e-history-api-${slug}-${suffix}@example.com`;
}

async function createCleanUser(slug, testInfo) {
  const email = uniqueEmail(slug, testInfo);
  const user = await createAuthUser(email, password);
  createdUserIds.add(user.uid);
  await clearUser(user.uid);
  return { email, user };
}

async function loginCleanUser(page, slug, testInfo) {
  const { email, user } = await createCleanUser(slug, testInfo);
  await loginAs(page, email, password);
  return user;
}

async function expectPath(page, path, options) {
  await expect.poll(() => new URL(page.url()).pathname, options).toBe(path);
}

function mockSaikakuResult() {
  return saikakuAttempt().full.result;
}

async function mockAnalyze(page, { delayMs = 0 } = {}) {
  let resolveResponseAttempted;
  const responseAttempted = new Promise((resolve) => {
    resolveResponseAttempted = resolve;
  });
  let requestCount = 0;

  await page.route('**/api/analyze', async (route) => {
    requestCount += 1;
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    try {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSaikakuResult()),
      });
    } catch {
      // AbortController cancellation can close the intercepted request before the delayed mock replies.
    } finally {
      resolveResponseAttempted();
    }
  });

  return {
    responseAttempted,
    requestCount: () => requestCount,
  };
}

async function installPathRecorder(page) {
  await page.addInitScript(() => {
    window.__historyApiFlowPaths = [];
    const record = () => window.__historyApiFlowPaths.push(window.location.pathname);
    record();

    for (const method of ['pushState', 'replaceState']) {
      const original = window.history[method];
      window.history[method] = function patchedHistoryMethod(...args) {
        const result = original.apply(this, args);
        record();
        return result;
      };
    }

    window.addEventListener('popstate', record);
  });
}

async function prepareInputWithDelayedAnalyze(page, testInfo, slug, routeOptions) {
  const analyze = await mockAnalyze(page, routeOptions);
  await loginCleanUser(page, slug, testInfo);
  await page.goto('/input');
  await expectPath(page, '/input');
  await fillSaikakuForm(page);
  await expect.poll(analyze.requestCount, { timeout: 5000 }).toBe(1);
  await expect(page.getByRole('button', { name: 'キャンセル' })).toBeVisible();
  return analyze;
}

test('saikaku full happy path traces URLs', async ({ page }, testInfo) => {
  await installPathRecorder(page);
  await mockAnalyze(page);
  await loginCleanUser(page, 'happy-path', testInfo);

  await expectPath(page, '/');
  await page.getByTestId('card-saikaku').click();
  await expectPath(page, '/input');

  await fillSaikakuForm(page);
  await expectPath(page, '/result', { timeout: 15000 });
  await expect(page.getByText('問いに火を灯す人').first()).toBeVisible();

  const paths = await page.evaluate(() => window.__historyApiFlowPaths);
  expect(paths).not.toContain('/loading');

  await page.goBack();
  await expectPath(page, '/input');
});

test('history detail direct URL renders result content', async ({ page }, testInfo) => {
  const attemptId = 'attempt-1';
  const { email, user } = await createCleanUser('history-detail', testInfo);
  await seedUser(user.uid, 'saikaku', {
    parent: saikakuParent(1),
    attempts: { [attemptId]: saikakuAttempt() },
  });

  await loginAs(page, email, password);
  await page.goto(`/history/saikaku/${attemptId}`);

  await expectPath(page, `/history/saikaku/${attemptId}`);
  await expect(page.getByText('問いに火を灯す人').first()).toBeVisible({ timeout: 15000 });
});

test('/admin redirects for non-admin users', async ({ page }, testInfo) => {
  await loginCleanUser(page, 'admin-redirect', testInfo);

  await page.goto('/admin');

  await expectPath(page, '/', { timeout: 15000 });
});

test('empty /result direct access redirects to /input', async ({ page }, testInfo) => {
  await loginCleanUser(page, 'empty-result', testInfo);

  await page.goto('/result');

  await expectPath(page, '/input', { timeout: 15000 });
});

test('cancel mid-analysis with NavigationGuardDialog aborts and stays on input', async ({ page }, testInfo) => {
  const analyze = await mockAnalyze(page, { delayMs: 4000 });
  await loginCleanUser(page, 'guard-cancel', testInfo);
  await page.goto('/input');
  await page.goto('/input?guard=1');
  await fillSaikakuForm(page);
  await expect.poll(analyze.requestCount, { timeout: 5000 }).toBe(1);

  const goBack = page.goBack({ timeout: 10000 }).catch(() => null);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('中断');

  await page.getByRole('button', { name: '中断する' }).click();
  await goBack;

  await expectPath(page, '/input', { timeout: 15000 });
  await analyze.responseAttempted;
  await expectPath(page, '/input');
});

test('cancel button on LoadingOverlay aborts and returns to input', async ({ page }, testInfo) => {
  const analyze = await prepareInputWithDelayedAnalyze(page, testInfo, 'overlay-cancel', { delayMs: 4000 });

  await page.getByRole('button', { name: 'キャンセル' }).click();

  await expectPath(page, '/input', { timeout: 15000 });
  await analyze.responseAttempted;
  await expectPath(page, '/input');
});

test('unknown path catch-all redirects to root', async ({ page }, testInfo) => {
  await loginCleanUser(page, 'catch-all', testInfo);

  await page.goto('/foo/bar/baz');

  await expectPath(page, '/', { timeout: 15000 });
});
