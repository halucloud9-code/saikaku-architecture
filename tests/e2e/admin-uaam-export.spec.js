import { test, expect } from '@playwright/test';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Timestamp } from 'firebase-admin/firestore';
import {
  clearUser,
  createAuthUser,
  downloadCsvAndAssert,
  loginAs,
  seedUser,
  uaamParent,
} from './_helpers.js';

const password = 'password123';
const adminEmail = (process.env.ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS || 'admin-e2e@example.com')
  .split(',')
  .map((email) => email.trim())
  .filter(Boolean)[0];

const UAAM_UID = 'e2e-admin-uaam-export-1';
const UAAM_EMAIL = 'e2e-admin-uaam-export-1@example.com';
const UAAM_NAME = 'E2E UAAM Export User';
const UAAM_TYPE_NAME = 'E2E Export Type';
const BIAS_MESSAGE = 'E2E bias message';
const COACHING_ANSWER_SECRET = 'e2e_export_secret_coaching_answer';
const UPDATED_AT = Timestamp.fromDate(new Date('2026-05-07T12:00:00.000Z'));
const EXPECTED_HEADER =
  '名前,メール,志(%),知(%),技(%),衝(%),基軸力,認知力,転換力,熟達力,謙学力,論理力,活用力,統率力,本質力,創造力,伝達力,協働力,構想力,変革力,実装力,影響力,V1,V2,V3,bias_level,bias_message,タイプ名,診断日';

function getAdminAuth() {
  if (!getApps().length) {
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-saikaku' });
  }
  return getAuth();
}

async function deleteAuthUserByEmail(email) {
  try {
    const user = await getAdminAuth().getUserByEmail(email);
    await clearUser(user.uid);
    await getAdminAuth().deleteUser(user.uid);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
  }
}

async function cleanup() {
  await clearUser(UAAM_UID);
  await deleteAuthUserByEmail(adminEmail);
}

function axisScore(total, max, percentage, subs = {}) {
  return {
    total,
    max,
    percentage,
    subs,
    domainSubs: {},
    domainTotal: total,
  };
}

async function seedUaamExportFixture() {
  await seedUser(UAAM_UID, 'uaam', {
    parent: {
      ...uaamParent(1),
      uid: UAAM_UID,
      name: UAAM_NAME,
      email: UAAM_EMAIL,
      scores: {
        mindset: axisScore(70, 80, 88, {
          meaning: 1,
          mindfulness: 2,
          mindshift: 3,
          mastery: 4,
        }),
        literacy: axisScore(40, 60, 67, {
          learning: 5,
          logical: 6,
          life: 7,
          leadership: 8,
        }),
        competency: axisScore(30, 50, 60, {
          critical: 9,
          creativity: 10,
          communication: 11,
          collaboration: 12,
        }),
        impact: axisScore(21, 50, 42, {
          idea: 13,
          innovation: 14,
          implementation: 15,
          influence: 16,
        }),
      },
      vAnswers: {
        V1: 1,
        V2: 2,
        V3: 3,
      },
      analysis: {
        type_name: UAAM_TYPE_NAME,
      },
      bias_message: {
        message: BIAS_MESSAGE,
      },
      coaching_answers: {
        exportLeakGuard: {
          answer: COACHING_ANSWER_SECRET,
        },
      },
      createdAt: UPDATED_AT,
      updatedAt: UPDATED_AT,
    },
  });
}

test.beforeEach(async () => {
  await cleanup();
});

test.afterEach(async () => {
  await cleanup();
});

test('admin can export UAAM results as CSV', async ({ page }) => {
  const admin = await createAuthUser(adminEmail, password);
  await clearUser(admin.uid);
  await seedUaamExportFixture();

  await loginAs(page, adminEmail, password);
  await page.goto('/admin');

  await expect(page.getByRole('button', { name: /UAAM診断/ })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /UAAM診断/ }).click();
  await expect(page.getByText(UAAM_EMAIL)).toBeVisible({ timeout: 15000 });

  const exportButton = page.getByRole('button', { name: 'CSVエクスポート' });
  await expect(exportButton).toBeVisible();

  const { csvText } = await downloadCsvAndAssert(page, exportButton, 'uaam_results.csv');
  const lines = csvText.split('\r\n');
  const bodyRow = lines.find((line) => line.includes(UAAM_EMAIL));

  expect(lines[0]).toContain(EXPECTED_HEADER);
  expect(bodyRow).toBeTruthy();
  expect(bodyRow).not.toContain(COACHING_ANSWER_SECRET);
  expect(csvText).not.toContain(COACHING_ANSWER_SECRET);
  expect(csvText).not.toContain('coaching_answers');
  const bodyColumns = bodyRow.split(',');
  expect(bodyColumns.length).toBe(EXPECTED_HEADER.split(',').length);
  expect(bodyColumns).toEqual([
    UAAM_NAME,
    UAAM_EMAIL,
    '88',
    '67',
    '60',
    '42',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
    '12',
    '13',
    '14',
    '15',
    '16',
    'critical',
    'warning',
    'none',
    '4',
    BIAS_MESSAGE,
    UAAM_TYPE_NAME,
    '2026-05-07',
  ]);
});
