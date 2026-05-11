import { test, expect } from '@playwright/test';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import {
  clearUser,
  createAuthUser,
  downloadCsvAndAssert,
  loginAs,
  saikakuParent,
  seedUser,
  uaamParent,
} from './_helpers.js';
import { buildPairKey } from '../../shared/integrationsKey.js';

const password = 'password123';
const adminEmail = (process.env.ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS || 'admin-e2e@example.com')
  .split(',')
  .map((email) => email.trim())
  .filter(Boolean)[0];

const UIDS = {
  normal: 'e2e-admin-integrations-export-normal',
  legacy: 'e2e-admin-integrations-export-legacy',
};
const NORMAL_EMAIL = 'e2e-integrations-export-normal@example.com';
const LEGACY_EMAIL = 'e2e-integrations-export-legacy@example.com';
const COACHING_SECRET = 'e2e_integrations_export_secret_coaching_answer';
const SUMMARY_SECRET = 'e2e_integrations_export_secret_summary';
const RECS_SECRET = 'e2e_integrations_export_secret_recs';
const EXPECTED_HEADER = [
  '名前',
  'メール',
  'pairKey',
  'saikakuAttemptId',
  'uaamAttemptId',
  'saikakuLabel',
  'uaamLabel',
  'regenerationCount',
  'integration_score',
  'status',
  'staleSaikaku',
  'staleUaam',
  'model',
  'isLegacyFallback',
  'createdAt',
  'updatedAt',
].join(',');

function getDb() {
  if (!getApps().length) {
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-saikaku' });
  }
  return getFirestore();
}

function getAdminAuth() {
  if (!getApps().length) {
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-saikaku' });
  }
  return getAuth();
}

function at(day) {
  return Timestamp.fromDate(new Date(`2026-05-${String(day).padStart(2, '0')}T00:00:00.000Z`));
}

async function deleteCollectionDocs(collectionRef) {
  const snap = await collectionRef.get();
  if (snap.empty) return;
  const batch = getDb().batch();
  snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();
}

async function clearIntegrationDocs(uid) {
  await deleteCollectionDocs(getDb().collection('uaam_results').doc(uid).collection('integrations'));
}

async function clearFixtureUid(uid) {
  await clearIntegrationDocs(uid);
  await clearUser(uid);
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
  await Promise.all(Object.values(UIDS).map(clearFixtureUid));
  await deleteAuthUserByEmail(adminEmail);
}

async function seedParentPair(uid, overrides = {}) {
  await Promise.all([
    seedUser(uid, 'saikaku', {
      parent: {
        ...saikakuParent(1),
        uid,
        name: overrides.name,
        email: overrides.email,
        latestAttemptId: overrides.latestSaikakuAttemptId,
      },
    }),
    seedUser(uid, 'uaam', {
      parent: {
        ...uaamParent(1),
        uid,
        name: overrides.name,
        email: overrides.email,
        latestAttemptId: overrides.latestUaamAttemptId,
        coaching_answers: overrides.coachingAnswers,
      },
    }),
  ]);
}

async function seedIntegration(uid, saikakuAttemptId, uaamAttemptId) {
  const pairKey = buildPairKey(saikakuAttemptId, uaamAttemptId);
  await getDb().collection('uaam_results').doc(uid).collection('integrations').doc(pairKey).set({
    saikakuAttemptId,
    uaamAttemptId,
    integration: {
      integration_score: 91,
      activation_core: 'E2E Export Core',
      summary: SUMMARY_SECRET,
      recommendations: RECS_SECRET,
    },
    regenerationCount: 0,
    model: 'claude-sonnet-4-20250514',
    source: {
      saikakuLabel: 'E2E Export Saikaku Label',
      uaamLabel: 'E2E Export UAAM Label',
    },
    status: 'active',
    createdAt: at(6),
    updatedAt: at(7),
  });
}

async function seedIntegrationsExportFixture() {
  await seedParentPair(UIDS.normal, {
    name: 'E2E Integrations Export Normal',
    email: NORMAL_EMAIL,
    latestSaikakuAttemptId: 'saikaku-export-normal',
    latestUaamAttemptId: 'uaam-export-normal',
    coachingAnswers: {
      leakGuard: {
        answer: COACHING_SECRET,
      },
    },
  });
  await seedIntegration(UIDS.normal, 'saikaku-export-normal', 'uaam-export-normal');

  await seedUser(UIDS.legacy, 'saikaku', {
    parent: {
      ...saikakuParent(1),
      uid: UIDS.legacy,
      name: 'E2E Integrations Export Legacy',
      email: LEGACY_EMAIL,
      latestAttemptId: 'saikaku-export-legacy',
    },
  });
  await seedUser(UIDS.legacy, 'uaam', {
    parent: {
      ...uaamParent(1),
      uid: UIDS.legacy,
      name: 'E2E Integrations Export Legacy',
      email: LEGACY_EMAIL,
      latestAttemptId: 'uaam-export-legacy',
      analysis: {
        type_name: 'Legacy Type',
        saikaku_attempt_label: 'E2E Export Legacy Saikaku Label',
        uaam_attempt_label: 'E2E Export Legacy UAAM Label',
        saikaku_integration: {
          integration_score: 76,
          activation_core: 'E2E Legacy Export Core',
        },
      },
      integrationUpdatedAt: at(5),
      createdAt: at(1),
      updatedAt: at(5),
    },
  });
}

test.beforeEach(async () => {
  await cleanup();
});

test.afterEach(async () => {
  await cleanup();
});

test('admin can export integrations as CSV', async ({ page }) => {
  const admin = await createAuthUser(adminEmail, password);
  await clearUser(admin.uid);
  await seedIntegrationsExportFixture();

  await loginAs(page, adminEmail, password);
  await page.goto('/admin');

  await expect(page.getByRole('button', { name: '統合分析（—）' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: '統合分析（—）' }).click();
  await expect(page.getByText(NORMAL_EMAIL)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(LEGACY_EMAIL)).toBeVisible({ timeout: 15000 });

  const exportButton = page.getByRole('button', { name: 'CSVエクスポート' });
  await expect(exportButton).toBeVisible();

  const { csvText } = await downloadCsvAndAssert(page, exportButton, 'saikaku_integrations.csv');
  const lines = csvText.split('\r\n');
  const bodyRows = lines.slice(1).filter(Boolean);
  const normalRow = bodyRows.find((line) => line.includes(NORMAL_EMAIL));
  const legacyRow = bodyRows.find((line) => line.includes(LEGACY_EMAIL));

  expect(lines[0]).toBe(`\uFEFF${EXPECTED_HEADER}`);
  expect(bodyRows.length).toBeGreaterThanOrEqual(2);
  expect(normalRow).toBeTruthy();
  expect(legacyRow).toBeTruthy();
  expect(legacyRow.split(',')[13]).toBe('true');
  expect(csvText).not.toContain(COACHING_SECRET);
  expect(csvText).not.toContain(SUMMARY_SECRET);
  expect(csvText).not.toContain(RECS_SECRET);
  expect(csvText).not.toContain('coachingAnswers');
  expect(csvText).not.toContain('recommendations');
});
