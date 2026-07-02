import fs from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';
import { Timestamp } from 'firebase-admin/firestore';
import {
  clearUser,
  createAuthUser,
  loginAs,
  pendingAttempt,
  saikakuAttempt,
  saikakuParent,
  seedUser,
} from './_helpers.js';

const PASSWORD = 'password123';
const SCREENSHOT_DIR = path.join('screenshots', 'issue-47');
const VIEWPORT_WIDTHS = [375, 414, 430, 520];
const UAAM_TYPE_NAME = '実装する案内人';

function uaamParent(attemptCount = 1) {
  const now = Timestamp.now();

  return {
    attemptCount,
    pendingAttemptId: null,
    latestAttemptId: 'attempt-1',
    analysis: {
      type_name: UAAM_TYPE_NAME,
    },
    scores: {
      mindset: { total: 60 },
    },
    createdAt: now,
    updatedAt: now,
  };
}

function uaamAttempt(typeName = UAAM_TYPE_NAME) {
  const createdAt = Timestamp.now();

  return {
    status: 'committed',
    createdAt,
    summary: {
      typeName,
      createdAt,
    },
    full: {
      result: null,
      analysis: {
        type_name: typeName,
      },
      scores: {
        mindset: { total: 60 },
      },
    },
    raw: { input: { answers: {} } },
  };
}

const states = [
  {
    name: 'state-clean',
    seed: async () => {},
    waitForUi: async (page) => {
      await page.getByTestId('card-saikaku').waitFor({ state: 'visible' });
    },
  },
  {
    name: 'state-count1',
    seed: async (uid) => {
      await seedUser(uid, 'saikaku', {
        parent: saikakuParent(1),
        attempts: { 'attempt-1': saikakuAttempt() },
      });
    },
    waitForUi: async (page) => {
      await page.getByTestId('badge-saikaku').waitFor({ state: 'visible' });
      await page.getByText('診断済み (1/3)').waitFor({ state: 'visible' });
      await page.getByTestId('history-link-saikaku').waitFor({ state: 'visible' });
    },
  },
  {
    name: 'state-count3',
    seed: async (uid) => {
      await seedUser(uid, 'saikaku', {
        parent: saikakuParent(3),
        attempts: {
          'attempt-1': saikakuAttempt(),
          'attempt-2': saikakuAttempt(),
          'attempt-3': saikakuAttempt(),
        },
      });
    },
    waitForUi: async (page) => {
      await page.getByTestId('badge-saikaku').waitFor({ state: 'visible' });
      await page.getByText('診断済み (3/3)').waitFor({ state: 'visible' });
      await page.getByText('診断は最大3回まで実施済み').waitFor({ state: 'visible' });
    },
  },
  {
    name: 'state-pending',
    seed: async (uid) => {
      await seedUser(uid, 'saikaku', {
        parent: {
          ...saikakuParent(2),
          pendingAttemptId: 'pending-1',
        },
        attempts: {
          'attempt-1': saikakuAttempt(),
          'pending-1': pendingAttempt(-2 * 60 * 1000),
        },
      });
    },
    waitForUi: async (page) => {
      await page.getByTestId('badge-saikaku').waitFor({ state: 'visible' });
      await page.getByText('診断済み (1/3)').waitFor({ state: 'visible' });
      await page.getByTestId('history-link-saikaku').waitFor({ state: 'visible' });
      await page.getByText('処理中…').waitFor({ state: 'visible' });
    },
  },
  {
    name: 'state-uaam-count1',
    seed: async (uid) => {
      await seedUser(uid, 'uaam', {
        parent: uaamParent(1),
        attempts: { 'attempt-1': uaamAttempt() },
      });
    },
    waitForUi: async (page) => {
      await page.getByTestId('badge-uaam').waitFor({ state: 'visible' });
      await page.getByText('診断済み (1/3)').waitFor({ state: 'visible' });
      await page.getByTestId('history-link-uaam').waitFor({ state: 'visible' });
    },
  },
  {
    name: 'state-uaam-count3',
    seed: async (uid) => {
      await seedUser(uid, 'uaam', {
        parent: uaamParent(3),
        attempts: {
          'attempt-1': uaamAttempt(),
          'attempt-2': uaamAttempt('探究を実装する人'),
          'attempt-3': uaamAttempt('探究を実装する人'),
        },
      });
    },
    waitForUi: async (page) => {
      await page.getByTestId('badge-uaam').waitFor({ state: 'visible' });
      await page.getByText('診断済み (3/3)').waitFor({ state: 'visible' });
      await page.getByText('診断は最大3回まで実施済み').waitFor({ state: 'visible' });
    },
  },
  {
    name: 'state-uaam-pending',
    seed: async (uid) => {
      await seedUser(uid, 'uaam', {
        parent: {
          ...uaamParent(2),
          pendingAttemptId: 'pending-1',
        },
        attempts: {
          'attempt-1': uaamAttempt(),
          'pending-1': pendingAttempt(-2 * 60 * 1000),
        },
      });
    },
    waitForUi: async (page) => {
      await page.getByTestId('badge-uaam').waitFor({ state: 'visible' });
      await page.getByText('診断済み (1/3)').waitFor({ state: 'visible' });
      await page.getByTestId('history-link-uaam').waitFor({ state: 'visible' });
      await page.getByText('処理中…').waitFor({ state: 'visible' });
    },
  },
];

function createEmail(stateName, testInfo) {
  return [
    'e2e-issue-47',
    stateName,
    Date.now(),
    process.pid,
    testInfo.workerIndex,
    testInfo.retry,
  ].join('-') + '@example.com';
}

async function waitForStatusResponse(page) {
  return page.waitForResponse((response) => {
    return (
      response.url().includes('/api/me/diagnosis-status') &&
      response.request().method() === 'GET' &&
      response.status() === 200
    );
  }, { timeout: 15000 });
}

async function waitForFonts(page) {
  await page.evaluate(async () => {
    await document.fonts?.ready;
  });
}

for (const state of states) {
  test(`captures SelectScreen screenshots for ${state.name}`, async ({ page }, testInfo) => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    const email = createEmail(state.name, testInfo);
    const user = await createAuthUser(email, PASSWORD);
    await clearUser(user.uid);
    await state.seed(user.uid);

    const statusResponse = waitForStatusResponse(page);
    await loginAs(page, email, PASSWORD);
    await statusResponse;
    await state.waitForUi(page);
    await waitForFonts(page);

    for (const width of VIEWPORT_WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${state.name}-${width}.png`),
        fullPage: true,
      });
    }
  });
}
