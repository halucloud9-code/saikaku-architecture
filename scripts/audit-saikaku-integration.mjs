import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local', quiet: true });

const REQUIRED_ENV = ['FIREBASE_PROJECT_ID', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL'];
const AUDIT_DIR = path.join('logs', 'audits');

function assertProductionEnv() {
  const emulatorVars = ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST'].filter((key) => process.env[key]);
  if (emulatorVars.length > 0) {
    throw new Error(`Refusing to audit while emulator env vars are set: ${emulatorVars.join(', ')}`);
  }

  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required Firebase Admin env vars: ${missing.join(', ')}. Load .env.local before running this audit.`
    );
  }
}

function initFirebaseAdmin() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
  }
}

function timestampForFile(date = new Date()) {
  const iso = date.toISOString();
  return `${iso.slice(0, 10).replaceAll('-', '')}-${iso.slice(11, 19).replaceAll(':', '')}`;
}

function isNonEmptyPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
}

function optionalText(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function numberOrZero(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function toIsoStringOrNull(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
}

function errorSummary(error) {
  if (!error) {
    return 'unknown error';
  }

  const code = typeof error.code === 'string' ? `${error.code}: ` : '';
  const message = error instanceof Error ? error.message : String(error);
  return `${code}${message}`;
}

async function resolveIdentity({ db, auth, uid, data }) {
  const warnings = [];
  let name = optionalText(data.name, data.displayName);
  let email = optionalText(data.email);

  if (!name || !email) {
    try {
      const resultsSnap = await db.collection('results').doc(uid).get();
      if (resultsSnap.exists) {
        const resultsData = resultsSnap.data() || {};
        name = name || optionalText(resultsData.name, resultsData.displayName);
        email = email || optionalText(resultsData.email);
      }
    } catch (error) {
      warnings.push(`results lookup failed: ${errorSummary(error)}`);
    }
  }

  if (!name || !email) {
    try {
      const user = await auth.getUser(uid);
      name = name || optionalText(user.displayName);
      email = email || optionalText(user.email);
    } catch (error) {
      warnings.push(`auth lookup failed: ${errorSummary(error)}`);
    }
  }

  return { name, email, warnings };
}

async function buildRecord({ db, auth, docSnap }) {
  const uid = docSnap.id;
  const data = docSnap.data() || {};
  const integration = data.analysis?.saikaku_integration;
  const hasSaikakuIntegration = data.hasSaikakuIntegration === true;
  const hasAnalysisIntegration = isNonEmptyPlainObject(integration);
  const { name, email, warnings } = await resolveIdentity({ db, auth, uid, data });

  const record = {
    uid,
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    hasSaikakuIntegration,
    hasAnalysisIntegration,
    integrationUpdatedAt: toIsoStringOrNull(data.integrationUpdatedAt),
    attemptCount: numberOrZero(data.attemptCount),
    destroyed: hasSaikakuIntegration && !hasAnalysisIntegration,
  };

  return { record, warnings };
}

async function main() {
  assertProductionEnv();
  initFirebaseAdmin();

  const db = getFirestore();
  const auth = getAuth();
  const snapshot = await db.collection('uaam_results').get();
  const records = [];
  let warningCount = 0;

  for (const docSnap of snapshot.docs) {
    try {
      const { record, warnings } = await buildRecord({ db, auth, docSnap });
      records.push(record);

      for (const warning of warnings) {
        warningCount += 1;
        console.warn(`[audit-saikaku-integration] ${docSnap.id}: ${warning}`);
      }
    } catch (error) {
      warningCount += 1;
      console.warn(`[audit-saikaku-integration] ${docSnap.id}: record build failed: ${errorSummary(error)}`);
      records.push({
        uid: docSnap.id,
        hasSaikakuIntegration: false,
        hasAnalysisIntegration: false,
        integrationUpdatedAt: null,
        attemptCount: 0,
        destroyed: false,
      });
    }
  }

  records.sort((a, b) => a.uid.localeCompare(b.uid));

  await fs.mkdir(AUDIT_DIR, { recursive: true });
  const outputPath = path.join(AUDIT_DIR, `saikaku-integration-${timestampForFile()}.json`);
  await fs.writeFile(outputPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');

  const withFlagCount = records.filter((record) => record.hasSaikakuIntegration).length;
  const withAnalysisCount = records.filter((record) => record.hasAnalysisIntegration).length;
  const destroyed = records.filter((record) => record.destroyed);
  const firstDestroyedUids = destroyed.slice(0, 10).map((record) => record.uid);

  console.log('Saikaku integration audit complete');
  console.log(`Output: ${outputPath}`);
  console.log(`Total UAAM users scanned: ${records.length}`);
  console.log(`hasSaikakuIntegration:true: ${withFlagCount}`);
  console.log(`hasAnalysisIntegration:true: ${withAnalysisCount}`);
  console.log(`destroyed: ${destroyed.length}`);
  console.log(`First 10 destroyed uids: ${firstDestroyedUids.length ? firstDestroyedUids.join(', ') : '(none)'}`);

  if (warningCount > 0) {
    console.log(`Per-user warnings: ${warningCount}`);
  }
}

main().catch((error) => {
  console.error(`[audit-saikaku-integration] ${errorSummary(error)}`);
});
