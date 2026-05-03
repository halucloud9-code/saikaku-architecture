import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { buildPairKey } from '../shared/integrationsKey.js';
import { inferIntegrationAttemptPair } from '../shared/integrationsAttemptResolver.js';

dotenv.config({ path: '.env.local', quiet: true });

const REQUIRED_PRODUCTION_ENV = ['FIREBASE_PROJECT_ID', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL'];
const MIGRATION_DIR = path.join('logs', 'migrations');
const LEGACY_FALLBACK = 'legacy-fallback';

function parseArgs(argv) {
  const options = {
    dryRun: true,
    limit: null,
    uid: null,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--apply') {
      options.dryRun = false;
      continue;
    }

    if (arg.startsWith('--limit=')) {
      const raw = arg.slice('--limit='.length);
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error('--limit must be a non-negative integer');
      }
      options.limit = parsed;
      continue;
    }

    if (arg.startsWith('--uid=')) {
      const uid = arg.slice('--uid='.length).trim();
      if (!uid) {
        throw new Error('--uid must be a non-empty string');
      }
      options.uid = uid;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function usage() {
  return [
    'Usage: node scripts/migrate-integrations-to-subcollection.mjs [--dry-run] [--apply] [--limit=N] [--uid=xxx]',
    '',
    'Options:',
    '  --dry-run   Plan writes only. This is the default.',
    '  --apply     Perform writes to uaam_results/{uid}/integrations/{pairKey}.',
    '  --limit=N   Stop after processing N uaam_results docs.',
    '  --uid=xxx   Process only one uid.',
  ].join('\n');
}

function usingFirestoreEmulator() {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

function assertEnv() {
  if (usingFirestoreEmulator()) {
    if (!process.env.FIREBASE_PROJECT_ID) {
      throw new Error('Missing FIREBASE_PROJECT_ID for Firestore emulator run');
    }
    return;
  }

  const missing = REQUIRED_PRODUCTION_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required Firebase Admin env vars: ${missing.join(', ')}. Load .env.local before running this migration.`
    );
  }
}

function initFirebaseAdmin() {
  if (getApps().length) return;

  if (usingFirestoreEmulator()) {
    initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
    return;
  }

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
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

function timestampToMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();

  const seconds = value._seconds ?? value.seconds;
  const nanoseconds = value._nanoseconds ?? value.nanoseconds ?? 0;
  if (typeof seconds === 'number') {
    return (seconds * 1000) + Math.floor(nanoseconds / 1000000);
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const ms = Number(value);
  return Number.isFinite(ms) ? ms : null;
}

function toIsoStringOrNull(value) {
  const millis = timestampToMillis(value);
  return millis === null ? null : new Date(millis).toISOString();
}

function timestampForWrite(value) {
  if (!value) return FieldValue.serverTimestamp();
  if (typeof value.toDate === 'function') return value;
  if (value instanceof Date) return value;

  const millis = timestampToMillis(value);
  if (millis === null) return FieldValue.serverTimestamp();
  return Timestamp.fromMillis(millis);
}

function errorSummary(error) {
  if (!error) return 'unknown error';
  const code = typeof error.code === 'string' ? `${error.code}: ` : '';
  const message = error instanceof Error ? error.message : String(error);
  return `${code}${message}`;
}

function readLegacyIntegration(data) {
  const literalIntegration = data['analysis.saikaku_integration'];
  if (isNonEmptyPlainObject(literalIntegration)) {
    return { integration: literalIntegration, legacySource: 'literal_dotted_key' };
  }

  const nestedIntegration = data.analysis?.saikaku_integration;
  if (isNonEmptyPlainObject(nestedIntegration)) {
    return { integration: nestedIntegration, legacySource: 'nested_analysis' };
  }

  return null;
}

async function loadAttempts(db, collection, uid) {
  const snapshot = await db.collection(collection).doc(uid).collection('attempts').get();
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
}

function findAttempt(attempts, attemptId) {
  if (!attemptId) return null;
  return attempts.find((attempt) => attempt.id === attemptId) ?? null;
}

function labelFromAttempt(kind, attempt) {
  if (!attempt) return LEGACY_FALLBACK;

  if (kind === 'saikaku') {
    return optionalText(
      attempt.summary?.kakuchiiki,
      attempt.full?.selectedKakuchiiki,
      attempt.full?.result?.kakuchiiki
    ) || LEGACY_FALLBACK;
  }

  return optionalText(
    attempt.summary?.typeName,
    attempt.full?.analysis?.type_name
  ) || LEGACY_FALLBACK;
}

function bucketForSource(source) {
  if (source === 'inferred') return 'attempt_inferred';
  if (source === 'saikaku-fallback') return 'saikaku_legacy_fallback';
  if (source === 'uaam-fallback') return 'uaam_legacy_fallback';
  return 'both_legacy_fallback';
}

function initialSummary({ dryRun }) {
  return {
    dryRun,
    processed: 0,
    migrated: 0,
    skipped: {
      already_migrated: 0,
      no_legacy: 0,
    },
    destroyed: 0,
    error: 0,
    dry_run_planned: 0,
    buckets: {
      attempt_inferred: 0,
      saikaku_legacy_fallback: 0,
      uaam_legacy_fallback: 0,
      both_legacy_fallback: 0,
    },
    latestAttemptIdShortcutMatch: {
      pairComparable: 0,
      pairMatches: 0,
      saikakuComparable: 0,
      saikakuMatches: 0,
      uaamComparable: 0,
      uaamMatches: 0,
    },
  };
}

function updateShortcutMatch(summary, record) {
  const latestSaikakuAttemptId = record.latestAttemptIdShortcut?.saikakuAttemptId ?? null;
  const latestUaamAttemptId = record.latestAttemptIdShortcut?.uaamAttemptId ?? null;
  const inferredSaikakuAttemptId = record.inferredAttemptPair?.saikakuAttemptId ?? null;
  const inferredUaamAttemptId = record.inferredAttemptPair?.uaamAttemptId ?? null;

  if (latestSaikakuAttemptId && inferredSaikakuAttemptId) {
    summary.latestAttemptIdShortcutMatch.saikakuComparable += 1;
    if (latestSaikakuAttemptId === inferredSaikakuAttemptId) {
      summary.latestAttemptIdShortcutMatch.saikakuMatches += 1;
    }
  }

  if (latestUaamAttemptId && inferredUaamAttemptId) {
    summary.latestAttemptIdShortcutMatch.uaamComparable += 1;
    if (latestUaamAttemptId === inferredUaamAttemptId) {
      summary.latestAttemptIdShortcutMatch.uaamMatches += 1;
    }
  }

  if (latestSaikakuAttemptId && latestUaamAttemptId && inferredSaikakuAttemptId && inferredUaamAttemptId) {
    summary.latestAttemptIdShortcutMatch.pairComparable += 1;
    if (
      latestSaikakuAttemptId === inferredSaikakuAttemptId
      && latestUaamAttemptId === inferredUaamAttemptId
    ) {
      summary.latestAttemptIdShortcutMatch.pairMatches += 1;
    }
  }
}

function percent(matches, comparable) {
  if (comparable === 0) return 'n/a';
  return `${((matches / comparable) * 100).toFixed(1)}%`;
}

async function maybeWriteIntegration({ db, integrationRef, payload, dryRun }) {
  const existingSnap = await integrationRef.get();
  if (existingSnap.exists) {
    return { status: 'already_migrated' };
  }

  if (dryRun) {
    return { status: 'dry_run_planned' };
  }

  let wrote = false;
  await db.runTransaction(async (tx) => {
    const transactionSnap = await tx.get(integrationRef);
    if (transactionSnap.exists) return;
    tx.create(integrationRef, payload);
    wrote = true;
  });

  return { status: wrote ? 'migrated' : 'already_migrated' };
}

async function processDoc({ db, docSnap, dryRun }) {
  const uid = docSnap.id;
  const data = docSnap.data() || {};
  const legacy = readLegacyIntegration(data);
  const baseRecord = {
    uid,
    integrationUpdatedAt: toIsoStringOrNull(data.integrationUpdatedAt),
    hasSaikakuIntegration: data.hasSaikakuIntegration === true,
  };

  if (!legacy) {
    if (data.hasSaikakuIntegration === true) {
      return {
        ...baseRecord,
        status: 'destroyed',
        reason: 'hasSaikakuIntegration true but no legacy integration body found',
      };
    }

    return {
      ...baseRecord,
      status: 'no_legacy',
      reason: 'no legacy integration body found',
    };
  }

  const [saikakuParentSnap, saikakuAttempts, uaamAttempts] = await Promise.all([
    db.collection('results').doc(uid).get(),
    loadAttempts(db, 'results', uid),
    loadAttempts(db, 'uaam_results', uid),
  ]);
  const saikakuParentData = saikakuParentSnap.exists ? saikakuParentSnap.data() || {} : {};
  const inferredAttemptPair = inferIntegrationAttemptPair({
    uid,
    integrationUpdatedAt: data.integrationUpdatedAt,
    saikakuAttempts,
    uaamAttempts,
  });
  const saikakuAttemptId = inferredAttemptPair.saikakuAttemptId ?? LEGACY_FALLBACK;
  const uaamAttemptId = inferredAttemptPair.uaamAttemptId ?? LEGACY_FALLBACK;
  const pairKey = buildPairKey(saikakuAttemptId, uaamAttemptId);
  const saikakuAttempt = findAttempt(saikakuAttempts, inferredAttemptPair.saikakuAttemptId);
  const uaamAttempt = findAttempt(uaamAttempts, inferredAttemptPair.uaamAttemptId);
  const source = {
    saikakuLabel: labelFromAttempt('saikaku', saikakuAttempt),
    uaamLabel: labelFromAttempt('uaam', uaamAttempt),
  };
  const payload = {
    saikakuAttemptId,
    uaamAttemptId,
    integration: legacy.integration,
    regenerationCount: 0,
    model: 'legacy-migration',
    source,
    createdAt: timestampForWrite(data.integrationUpdatedAt),
    updatedAt: FieldValue.serverTimestamp(),
    status: 'active',
  };
  const integrationRef = db.collection('uaam_results').doc(uid).collection('integrations').doc(pairKey);
  const writeResult = await maybeWriteIntegration({ db, integrationRef, payload, dryRun });

  return {
    ...baseRecord,
    status: writeResult.status,
    legacySource: legacy.legacySource,
    resolverSource: inferredAttemptPair.source,
    inferredAttemptPair,
    migratedAttemptPair: {
      saikakuAttemptId,
      uaamAttemptId,
    },
    pairKey,
    source,
    latestAttemptIdShortcut: {
      saikakuAttemptId: saikakuParentData.latestAttemptId ?? null,
      uaamAttemptId: data.latestAttemptId ?? null,
    },
  };
}

async function listUaamDocs({ db, uid, limit }) {
  if (uid) {
    const snap = await db.collection('uaam_results').doc(uid).get();
    return snap.exists ? [snap] : [];
  }

  const snapshot = await db.collection('uaam_results').get();
  const docs = snapshot.docs.sort((a, b) => a.id.localeCompare(b.id));
  return limit === null ? docs : docs.slice(0, limit);
}

function applyRecordToSummary(summary, record) {
  summary.processed += 1;

  if (record.status === 'migrated') {
    summary.migrated += 1;
  } else if (record.status === 'already_migrated') {
    summary.skipped.already_migrated += 1;
  } else if (record.status === 'dry_run_planned') {
    summary.dry_run_planned += 1;
  } else if (record.status === 'destroyed') {
    summary.destroyed += 1;
  } else if (record.status === 'no_legacy') {
    summary.skipped.no_legacy += 1;
  } else if (record.status === 'error') {
    summary.error += 1;
  }

  if (record.resolverSource) {
    summary.buckets[bucketForSource(record.resolverSource)] += 1;
    updateShortcutMatch(summary, record);
  }
}

function renderTextLog(payload) {
  const lines = [
    'Integrations migration log',
    `Generated at: ${payload.generatedAt}`,
    `Mode: ${payload.options.dryRun ? 'dry-run' : 'apply'}`,
    `UID filter: ${payload.options.uid ?? '(none)'}`,
    `Limit: ${payload.options.limit ?? '(none)'}`,
    '',
    'Summary:',
    `  processed: ${payload.summary.processed}`,
    `  migrated: ${payload.summary.migrated}`,
    `  skipped(already_migrated): ${payload.summary.skipped.already_migrated}`,
    `  skipped(no_legacy): ${payload.summary.skipped.no_legacy}`,
    `  destroyed: ${payload.summary.destroyed}`,
    `  error: ${payload.summary.error}`,
    `  dry_run_planned: ${payload.summary.dry_run_planned}`,
    'Buckets:',
    `  attempt_inferred: ${payload.summary.buckets.attempt_inferred}`,
    `  saikaku_legacy_fallback: ${payload.summary.buckets.saikaku_legacy_fallback}`,
    `  uaam_legacy_fallback: ${payload.summary.buckets.uaam_legacy_fallback}`,
    `  both_legacy_fallback: ${payload.summary.buckets.both_legacy_fallback}`,
    'latestAttemptId shortcut match:',
    `  pair: ${payload.summary.latestAttemptIdShortcutMatch.pairMatches}/${payload.summary.latestAttemptIdShortcutMatch.pairComparable} (${percent(payload.summary.latestAttemptIdShortcutMatch.pairMatches, payload.summary.latestAttemptIdShortcutMatch.pairComparable)})`,
    `  saikaku: ${payload.summary.latestAttemptIdShortcutMatch.saikakuMatches}/${payload.summary.latestAttemptIdShortcutMatch.saikakuComparable} (${percent(payload.summary.latestAttemptIdShortcutMatch.saikakuMatches, payload.summary.latestAttemptIdShortcutMatch.saikakuComparable)})`,
    `  uaam: ${payload.summary.latestAttemptIdShortcutMatch.uaamMatches}/${payload.summary.latestAttemptIdShortcutMatch.uaamComparable} (${percent(payload.summary.latestAttemptIdShortcutMatch.uaamMatches, payload.summary.latestAttemptIdShortcutMatch.uaamComparable)})`,
    '',
    'Records:',
  ];

  for (const record of payload.records) {
    const details = [
      `uid=${record.uid}`,
      `status=${record.status}`,
      record.legacySource ? `legacySource=${record.legacySource}` : null,
      record.resolverSource ? `resolverSource=${record.resolverSource}` : null,
      record.pairKey ? `pairKey=${record.pairKey}` : null,
      record.integrationUpdatedAt ? `integrationUpdatedAt=${record.integrationUpdatedAt}` : null,
      record.reason ? `reason=${record.reason}` : null,
      record.error ? `error=${record.error}` : null,
    ].filter(Boolean);
    lines.push(`  - ${details.join(' ')}`);
  }

  return `${lines.join('\n')}\n`;
}

async function writeLogs({ options, summary, records }) {
  await fs.mkdir(MIGRATION_DIR, { recursive: true });
  const generatedAt = new Date().toISOString();
  const stamp = timestampForFile(new Date(generatedAt));
  const payload = {
    generatedAt,
    options,
    summary,
    records,
  };
  const jsonPath = path.join(MIGRATION_DIR, `integrations-${stamp}.json`);
  const txtPath = path.join(MIGRATION_DIR, `integrations-${stamp}.txt`);

  await Promise.all([
    fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8'),
    fs.writeFile(txtPath, renderTextLog(payload), 'utf8'),
  ]);

  return { jsonPath, txtPath };
}

function printSummary({ options, summary, logPaths }) {
  const match = summary.latestAttemptIdShortcutMatch;
  console.log('Integrations migration complete');
  console.log(`Mode: ${options.dryRun ? 'dry-run' : 'apply'}`);
  console.log(`Logs: ${logPaths.jsonPath}, ${logPaths.txtPath}`);
  console.log(`processed: ${summary.processed}`);
  console.log(`migrated: ${summary.migrated}`);
  console.log(`skipped(already_migrated): ${summary.skipped.already_migrated}`);
  console.log(`skipped(no_legacy): ${summary.skipped.no_legacy}`);
  console.log(`destroyed: ${summary.destroyed}`);
  console.log(`error: ${summary.error}`);
  console.log(`dry_run_planned: ${summary.dry_run_planned}`);
  console.log(`attempt_inferred: ${summary.buckets.attempt_inferred}`);
  console.log(`saikaku_legacy_fallback: ${summary.buckets.saikaku_legacy_fallback}`);
  console.log(`uaam_legacy_fallback: ${summary.buckets.uaam_legacy_fallback}`);
  console.log(`both_legacy_fallback: ${summary.buckets.both_legacy_fallback}`);
  console.log(
    `latestAttemptId shortcut match: pair ${match.pairMatches}/${match.pairComparable} (${percent(match.pairMatches, match.pairComparable)}), `
    + `saikaku ${match.saikakuMatches}/${match.saikakuComparable} (${percent(match.saikakuMatches, match.saikakuComparable)}), `
    + `uaam ${match.uaamMatches}/${match.uaamComparable} (${percent(match.uaamMatches, match.uaamComparable)})`
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  assertEnv();
  initFirebaseAdmin();

  const db = getFirestore();
  const docs = await listUaamDocs({ db, uid: options.uid, limit: options.limit });
  const summary = initialSummary({ dryRun: options.dryRun });
  const records = [];

  for (const docSnap of docs) {
    try {
      const record = await processDoc({ db, docSnap, dryRun: options.dryRun });
      records.push(record);
      applyRecordToSummary(summary, record);
    } catch (error) {
      const record = {
        uid: docSnap.id,
        status: 'error',
        error: errorSummary(error),
      };
      records.push(record);
      applyRecordToSummary(summary, record);
      console.warn(`[migrate-integrations] ${docSnap.id}: ${errorSummary(error)}`);
    }
  }

  const logPaths = await writeLogs({ options, summary, records });
  printSummary({ options, summary, logPaths });
}

main().catch((error) => {
  console.error(`[migrate-integrations] ${errorSummary(error)}`);
  process.exitCode = 1;
});
