import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { buildPairKey } from '../shared/integrationsKey.js';
import { inferIntegrationAttemptPair } from '../shared/integrationsAttemptResolver.js';

dotenv.config({ path: '.env.local', quiet: true });

const REQUIRED_PRODUCTION_ENV = ['FIREBASE_PROJECT_ID', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL'];
const MIGRATION_DIR = path.join('logs', 'migrations');
const LEGACY_FALLBACK = 'legacy-fallback';
const LEGACY_ATTEMPT_ID = 'legacy-v1';
const PATCH_ATTEMPTS_PAIR_KEY = buildPairKey(LEGACY_ATTEMPT_ID, LEGACY_ATTEMPT_ID);
const MODES = new Set(['integrations-only', 'patch-attempts']);
const PATCH_ATTEMPTS_SKIPPED_REASONS = [
  'already_patched',
  'pending_attempt',
  'no_legacy',
  'has_attempts',
  'pending_attempt_appeared',
  'attempts_appeared',
  'legacy_integration_missing',
  'concurrent_modification',
];

class PatchAttemptsTransactionError extends Error {
  constructor(reason, message, details = {}) {
    super(message);
    this.name = 'PatchAttemptsTransactionError';
    this.reason = reason;
    this.details = details;
  }
}

function isPatchAttemptsTransactionError(error) {
  return error?.name === 'PatchAttemptsTransactionError' && typeof error.reason === 'string';
}

function parseArgs(argv) {
  const options = {
    dryRun: true,
    limit: null,
    uid: null,
    mode: 'integrations-only',
    snapshot: null,
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

    if (arg.startsWith('--mode=')) {
      const mode = arg.slice('--mode='.length).trim();
      if (!MODES.has(mode)) {
        throw new Error('--mode must be one of: integrations-only, patch-attempts');
      }
      options.mode = mode;
      continue;
    }

    if (arg.startsWith('--snapshot=')) {
      const snapshot = arg.slice('--snapshot='.length).trim();
      if (!snapshot) {
        throw new Error('--snapshot must be a non-empty path');
      }
      options.snapshot = snapshot;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.snapshot && !options.dryRun) {
    throw new Error('--snapshot is dry-run only; remove --apply before writing a rollback snapshot');
  }

  return options;
}

function usage() {
  return [
    'Usage: node scripts/migrate-integrations-to-subcollection.mjs [--mode=integrations-only|patch-attempts] [--dry-run] [--apply] [--limit=N] [--uid=xxx] [--snapshot=PATH]',
    '',
    'Options:',
    '  --mode=integrations-only  Migrate parent legacy integrations into integrations subcollections. This is the default.',
    '  --mode=patch-attempts     Create legacy-v1 attempts plus legacy-v1__legacy-v1 integration docs for legacy users.',
    '  --dry-run                 Plan writes only. This is the default.',
    '  --apply                   Perform writes. Required for actual writes in every mode.',
    '  --limit=N                 Stop after processing N uaam_results docs.',
    '  --uid=xxx                 Process only one uid.',
    '  --snapshot=PATH           Dry-run only. Write matched patch-attempts pre-state JSON for rollback planning.',
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

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function removeUndefined(value) {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value
      .map((item) => removeUndefined(item))
      .filter((item) => item !== undefined);
  }
  if (!isPlainObject(value)) return value;

  const cleaned = {};
  for (const [key, entry] of Object.entries(value)) {
    const cleanedEntry = removeUndefined(entry);
    if (cleanedEntry !== undefined) {
      cleaned[key] = cleanedEntry;
    }
  }
  return cleaned;
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

function initialSummary({ dryRun, mode }) {
  if (mode === 'patch-attempts') {
    return {
      dryRun,
      mode,
      processed: 0,
      patched: 0,
      skipped: {
        ...Object.fromEntries(PATCH_ATTEMPTS_SKIPPED_REASONS.map((reason) => [reason, 0])),
      },
      error: 0,
      dry_run_planned: 0,
    };
  }

  return {
    dryRun,
    mode,
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

function hasPendingAttempt(data) {
  return data?.pendingAttemptId !== undefined && data.pendingAttemptId !== null;
}

function extractLegacySummary(data, kind) {
  if (kind === 'saikaku') {
    return {
      kakuchiiki: data?.result?.kakuchiiki ?? data?.selectedKakuchiiki ?? null,
      typeName: null,
      createdAt: data?.createdAt ?? null,
    };
  }

  return {
    typeName: data?.analysis?.type_name ?? null,
    createdAt: data?.createdAt ?? null,
  };
}

function extractLegacyFull(data, kind) {
  if (kind === 'saikaku') {
    return {
      result: data?.result ?? null,
      analysis: null,
      scores: null,
      selectedKakuchiiki: data?.selectedKakuchiiki ?? null,
    };
  }

  // Keep this aligned with api/lib/attempts.js extractFull plus the legacy
  // UAAM parent fields consumed by shared/attemptLogic.js legacyDocToAttempt.
  return {
    result: null,
    analysis: data?.analysis ?? null,
    scores: data?.scores ?? null,
    bias_message: data?.bias_message,
    personality_level: data?.personality_level ?? null,
    leadership_stage: data?.leadership_stage ?? null,
    three_elements: data?.three_elements ?? null,
    name: data?.name ?? null,
    coach_confirmed_personality_level: data?.coach_confirmed_personality_level ?? null,
    coach_confirmed_leadership_stage: data?.coach_confirmed_leadership_stage ?? null,
    coach_observation_note: data?.coach_observation_note ?? null,
  };
}

function extractLegacyRaw(data, kind) {
  if (kind === 'saikaku') {
    return {
      input: {
        talent: data?.inputTalent ?? '',
        value: data?.inputValue ?? '',
        passion: data?.inputPassion ?? '',
        talentTop5: data?.inputTalentTop5 ?? '',
        talentOther: data?.inputTalentOther ?? '',
        valueTop5: data?.inputValueTop5 ?? '',
        valueOther: data?.inputValueOther ?? '',
        passionTop5: data?.inputPassionTop5 ?? '',
        passionOther: data?.inputPassionOther ?? '',
        q1: data?.inputQ1 ?? '',
        q2: data?.inputQ2 ?? '',
        q3: data?.inputQ3 ?? '',
      },
    };
  }

  return {
    input: {
      answers: data?.answers ?? null,
      vAnswers: data?.vAnswers ?? null,
    },
  };
}

function legacyAttemptPayload(data, kind) {
  return removeUndefined({
    summary: extractLegacySummary(data, kind),
    full: extractLegacyFull(data, kind),
    raw: extractLegacyRaw(data, kind),
    status: 'committed',
    isLegacy: true,
    createdAt: data?.createdAt ?? FieldValue.serverTimestamp(),
  });
}

function legacyParentPatch() {
  return removeUndefined({
    latestAttemptId: LEGACY_ATTEMPT_ID,
    attemptCount: 1,
    pendingAttemptId: null,
    hasSaikakuIntegration: true,
  });
}

function legacyIntegrationPayload({ integration, uaamParentData, saikakuParentData }) {
  return removeUndefined({
    saikakuAttemptId: LEGACY_ATTEMPT_ID,
    uaamAttemptId: LEGACY_ATTEMPT_ID,
    integration,
    regenerationCount: 0,
    model: 'legacy-migration',
    source: {
      saikakuLabel: saikakuParentData?.selectedKakuchiiki ?? null,
      uaamLabel: uaamParentData?.analysis?.type_name ?? null,
    },
    status: 'active',
    createdAt: timestampForWrite(uaamParentData?.integrationUpdatedAt ?? uaamParentData?.createdAt),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

function throwPatchAttemptsTransactionError(reason, message, details = {}) {
  throw new PatchAttemptsTransactionError(reason, message, details);
}

function serializeFirestoreValue(value) {
  if (value === undefined) return { __type: 'undefined' };
  if (value === null) return null;
  if (typeof value !== 'object') return value;

  if (typeof value.toDate === 'function' && typeof value.toMillis === 'function') {
    const date = value.toDate();
    return {
      __type: 'timestamp',
      iso: date.toISOString(),
      millis: value.toMillis(),
      seconds: value.seconds ?? value._seconds ?? null,
      nanoseconds: value.nanoseconds ?? value._nanoseconds ?? null,
    };
  }

  if (value instanceof Date) {
    return { __type: 'date', iso: value.toISOString(), millis: value.getTime() };
  }

  if (typeof value._methodName === 'string') {
    return { __type: 'field_value', method: value._methodName };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeFirestoreValue(entry));
  }

  if (!isPlainObject(value)) {
    return String(value);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, serializeFirestoreValue(entry)])
  );
}

async function snapshotPreState({ uid, saikakuParentSnap, uaamParentSnap, saikakuAttemptsSnap, uaamAttemptsSnap }) {
  return {
    uid,
    results: {
      exists: saikakuParentSnap.exists,
      fields: saikakuParentSnap.exists ? serializeFirestoreValue(saikakuParentSnap.data() || {}) : null,
      attemptsSize: saikakuAttemptsSnap.size,
    },
    uaam_results: {
      exists: uaamParentSnap.exists,
      fields: uaamParentSnap.exists ? serializeFirestoreValue(uaamParentSnap.data() || {}) : null,
      attemptsSize: uaamAttemptsSnap.size,
    },
  };
}

function plannedWrite(pathSegments, op, data, options = null) {
  return {
    op,
    path: pathSegments.join('/'),
    data: serializeFirestoreValue(data),
    ...(options ? { options } : {}),
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
    tx.create(integrationRef, removeUndefined(payload));
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

async function processPatchAttemptsDoc({ db, docSnap, dryRun }) {
  const uid = docSnap.id;
  const uaamParentRef = db.collection('uaam_results').doc(uid);
  const saikakuParentRef = db.collection('results').doc(uid);
  const saikakuLegacyAttemptRef = saikakuParentRef.collection('attempts').doc(LEGACY_ATTEMPT_ID);
  const uaamLegacyAttemptRef = uaamParentRef.collection('attempts').doc(LEGACY_ATTEMPT_ID);
  const integrationRef = uaamParentRef.collection('integrations').doc(PATCH_ATTEMPTS_PAIR_KEY);

  const [
    saikakuParentSnap,
    uaamAttemptsSnap,
    saikakuAttemptsSnap,
    uaamAttemptsProbeSnap,
    saikakuAttemptsProbeSnap,
    saikakuLegacyAttemptSnap,
    uaamLegacyAttemptSnap,
    integrationSnap,
  ] = await Promise.all([
    saikakuParentRef.get(),
    uaamParentRef.collection('attempts').get(),
    saikakuParentRef.collection('attempts').get(),
    uaamParentRef.collection('attempts').limit(1).get(),
    saikakuParentRef.collection('attempts').limit(1).get(),
    saikakuLegacyAttemptRef.get(),
    uaamLegacyAttemptRef.get(),
    integrationRef.get(),
  ]);

  const uaamParentData = docSnap.data() || {};
  const saikakuParentData = saikakuParentSnap.exists ? saikakuParentSnap.data() || {} : {};
  const preState = await snapshotPreState({
    uid,
    saikakuParentSnap,
    uaamParentSnap: docSnap,
    saikakuAttemptsSnap,
    uaamAttemptsSnap,
  });
  const baseRecord = {
    uid,
    pairKey: PATCH_ATTEMPTS_PAIR_KEY,
    preState,
  };
  const legacy = readLegacyIntegration(uaamParentData);

  if (!legacy) {
    return {
      ...baseRecord,
      status: 'no_legacy',
      decision: 'skipped',
      reason: 'no legacy integration body found',
    };
  }

  if (hasPendingAttempt(saikakuParentData) || hasPendingAttempt(uaamParentData)) {
    return {
      ...baseRecord,
      status: 'pending_attempt',
      decision: 'skipped',
      reason: 'parent pendingAttemptId is non-null',
      pendingAttemptId: {
        results: saikakuParentData.pendingAttemptId ?? null,
        uaam_results: uaamParentData.pendingAttemptId ?? null,
      },
      legacySource: legacy.legacySource,
    };
  }

  if (saikakuLegacyAttemptSnap.exists || uaamLegacyAttemptSnap.exists || integrationSnap.exists) {
    return {
      ...baseRecord,
      status: 'already_patched',
      decision: 'skipped',
      reason: 'legacy-v1 attempt or legacy-v1__legacy-v1 integration already exists',
      existing: {
        resultsAttemptLegacyV1: saikakuLegacyAttemptSnap.exists,
        uaamAttemptLegacyV1: uaamLegacyAttemptSnap.exists,
        integrationLegacyPair: integrationSnap.exists,
      },
      legacySource: legacy.legacySource,
    };
  }

  if (!saikakuAttemptsProbeSnap.empty || !uaamAttemptsProbeSnap.empty) {
    return {
      ...baseRecord,
      status: 'has_attempts',
      decision: 'skipped',
      reason: 'attempts subcollection is not empty',
      attemptsSize: {
        results: saikakuAttemptsSnap.size,
        uaam_results: uaamAttemptsSnap.size,
      },
      legacySource: legacy.legacySource,
    };
  }

  if (!saikakuParentSnap.exists) {
    return {
      ...baseRecord,
      status: 'error',
      decision: 'error',
      error: 'results parent doc is missing',
      legacySource: legacy.legacySource,
    };
  }

  const saikakuAttempt = legacyAttemptPayload(saikakuParentData, 'saikaku');
  const uaamAttempt = legacyAttemptPayload(uaamParentData, 'uaam');
  const saikakuParentPatch = legacyParentPatch();
  const uaamParentPatch = legacyParentPatch();
  const integration = legacyIntegrationPayload({
    integration: legacy.integration,
    uaamParentData,
    saikakuParentData,
  });
  const plannedWrites = [
    plannedWrite(['results', uid, 'attempts', LEGACY_ATTEMPT_ID], 'create', saikakuAttempt),
    plannedWrite(['uaam_results', uid, 'attempts', LEGACY_ATTEMPT_ID], 'create', uaamAttempt),
    plannedWrite(['results', uid], 'set', saikakuParentPatch, { merge: true }),
    plannedWrite(['uaam_results', uid], 'set', uaamParentPatch, { merge: true }),
    plannedWrite(['uaam_results', uid, 'integrations', PATCH_ATTEMPTS_PAIR_KEY], 'create', integration),
  ];

  if (dryRun) {
    return {
      ...baseRecord,
      status: 'dry_run_planned',
      decision: 'planned',
      legacySource: legacy.legacySource,
      plannedWrites,
    };
  }

  let transactionLegacySource = legacy.legacySource;
  try {
    await db.runTransaction(async (tx) => {
      const [
        txSaikakuParentSnap,
        txUaamParentSnap,
        txSaikakuAttemptsProbeSnap,
        txUaamAttemptsProbeSnap,
        txSaikakuLegacyAttemptSnap,
        txUaamLegacyAttemptSnap,
        txIntegrationSnap,
      ] = await Promise.all([
        tx.get(saikakuParentRef),
        tx.get(uaamParentRef),
        tx.get(saikakuParentRef.collection('attempts').limit(1)),
        tx.get(uaamParentRef.collection('attempts').limit(1)),
        tx.get(saikakuLegacyAttemptRef),
        tx.get(uaamLegacyAttemptRef),
        tx.get(integrationRef),
      ]);

      const txSaikakuParentData = txSaikakuParentSnap.exists ? txSaikakuParentSnap.data() || {} : {};
      const txUaamParentData = txUaamParentSnap.exists ? txUaamParentSnap.data() || {} : {};

      // Firestore Admin SDK retries transactions for SDK-detected contention and
      // transient failures. These user-thrown errors are intentional fail-fast
      // eligibility failures, so they are not retried; a later migration run can
      // re-evaluate the user from fresh state.
      if (!txSaikakuParentSnap.exists || !txUaamParentSnap.exists) {
        throwPatchAttemptsTransactionError(
          'concurrent_modification',
          'parent doc disappeared before patch-attempts transaction could write',
          {
            resultsExists: txSaikakuParentSnap.exists,
            uaamResultsExists: txUaamParentSnap.exists,
          }
        );
      }

      const txLegacy = readLegacyIntegration(txUaamParentData);
      if (!txLegacy) {
        throwPatchAttemptsTransactionError(
          'legacy_integration_missing',
          'legacy integration body disappeared before patch-attempts transaction could write'
        );
      }
      transactionLegacySource = txLegacy.legacySource;

      if (hasPendingAttempt(txSaikakuParentData) || hasPendingAttempt(txUaamParentData)) {
        throwPatchAttemptsTransactionError(
          'pending_attempt_appeared',
          'parent pendingAttemptId appeared before patch-attempts transaction could write',
          {
            results: txSaikakuParentData.pendingAttemptId ?? null,
            uaam_results: txUaamParentData.pendingAttemptId ?? null,
          }
        );
      }

      if (!txSaikakuAttemptsProbeSnap.empty || !txUaamAttemptsProbeSnap.empty) {
        throwPatchAttemptsTransactionError(
          'attempts_appeared',
          'attempts subcollection became non-empty before patch-attempts transaction could write',
          {
            resultsEmpty: txSaikakuAttemptsProbeSnap.empty,
            uaamResultsEmpty: txUaamAttemptsProbeSnap.empty,
          }
        );
      }

      if (txSaikakuLegacyAttemptSnap.exists || txUaamLegacyAttemptSnap.exists || txIntegrationSnap.exists) {
        throwPatchAttemptsTransactionError(
          'concurrent_modification',
          'legacy-v1 attempt or legacy-v1__legacy-v1 integration appeared before patch-attempts transaction could write',
          {
            resultsAttemptLegacyV1: txSaikakuLegacyAttemptSnap.exists,
            uaamAttemptLegacyV1: txUaamLegacyAttemptSnap.exists,
            integrationLegacyPair: txIntegrationSnap.exists,
          }
        );
      }

      const txSaikakuAttempt = legacyAttemptPayload(txSaikakuParentData, 'saikaku');
      const txUaamAttempt = legacyAttemptPayload(txUaamParentData, 'uaam');
      const txIntegration = legacyIntegrationPayload({
        integration: txLegacy.integration,
        uaamParentData: txUaamParentData,
        saikakuParentData: txSaikakuParentData,
      });

      tx.create(saikakuLegacyAttemptRef, removeUndefined(txSaikakuAttempt));
      tx.create(uaamLegacyAttemptRef, removeUndefined(txUaamAttempt));
      tx.set(saikakuParentRef, removeUndefined(saikakuParentPatch), { merge: true });
      tx.set(uaamParentRef, removeUndefined(uaamParentPatch), { merge: true });
      tx.create(integrationRef, removeUndefined(txIntegration));
    });
  } catch (error) {
    if (!isPatchAttemptsTransactionError(error)) {
      throw error;
    }

    return {
      ...baseRecord,
      status: error.reason,
      decision: 'skipped',
      reason: error.message,
      error: errorSummary(error),
      errorDetails: error.details,
      legacySource: transactionLegacySource,
    };
  }

  return {
    ...baseRecord,
    status: 'patched',
    decision: 'patched',
    legacySource: transactionLegacySource,
    actualWriteCount: plannedWrites.length,
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

  if (summary.mode === 'patch-attempts') {
    if (record.status === 'patched') {
      summary.patched += 1;
    } else if (record.status === 'error') {
      summary.error += 1;
    } else if (record.status === 'dry_run_planned') {
      summary.dry_run_planned += 1;
    } else {
      summary.skipped[record.status] = (summary.skipped[record.status] ?? 0) + 1;
    }
    return;
  }

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
  if (payload.options.mode === 'patch-attempts') {
    const lines = [
      'Patch-attempts migration log',
      `Generated at: ${payload.generatedAt}`,
      `Mode: ${payload.options.dryRun ? 'dry-run' : 'apply'}`,
      `UID filter: ${payload.options.uid ?? '(none)'}`,
      `Limit: ${payload.options.limit ?? '(none)'}`,
      `Snapshot: ${payload.options.snapshot ?? '(none)'}`,
      '',
      'Summary:',
      `  processed: ${payload.summary.processed}`,
      `  patched: ${payload.summary.patched}`,
      ...renderPatchAttemptsSkippedLines(payload.summary),
      `  error: ${payload.summary.error}`,
      `  dry_run_planned: ${payload.summary.dry_run_planned}`,
      '',
      'Records:',
    ];

    for (const record of payload.records) {
      const details = [
        `uid=${record.uid}`,
        `status=${record.status}`,
        record.legacySource ? `legacySource=${record.legacySource}` : null,
        record.pairKey ? `pairKey=${record.pairKey}` : null,
        record.actualWriteCount ? `actualWriteCount=${record.actualWriteCount}` : null,
        record.reason ? `reason=${record.reason}` : null,
        record.error ? `error=${record.error}` : null,
      ].filter(Boolean);
      lines.push(`  - ${details.join(' ')}`);
    }

    return `${lines.join('\n')}\n`;
  }

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

async function writeSnapshot({ snapshotPath, records }) {
  if (!snapshotPath) return null;

  const snapshotPayload = {
    generatedAt: new Date().toISOString(),
    records: records
      .filter((record) => record.status !== 'no_legacy')
      .map((record) => record.preState),
  };
  await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
  await fs.writeFile(snapshotPath, `${JSON.stringify(snapshotPayload, null, 2)}\n`, 'utf8');
  return snapshotPath;
}

function renderPatchAttemptsSkippedLines(summary) {
  const skipped = summary.skipped || {};
  const orderedReasons = [
    ...PATCH_ATTEMPTS_SKIPPED_REASONS,
    ...Object.keys(skipped)
      .filter((reason) => !PATCH_ATTEMPTS_SKIPPED_REASONS.includes(reason))
      .sort(),
  ];
  return orderedReasons.map((reason) => `  skipped(${reason}): ${skipped[reason] ?? 0}`);
}

async function writeLogs({ options, summary, records }) {
  await fs.mkdir(MIGRATION_DIR, { recursive: true });
  const generatedAt = new Date().toISOString();
  const stamp = timestampForFile(new Date(generatedAt));
  const prefix = options.mode === 'patch-attempts' ? 'patch-attempts' : 'integrations';
  const payload = {
    generatedAt,
    options,
    summary,
    records,
  };
  const jsonPath = path.join(MIGRATION_DIR, `${prefix}-${stamp}.json`);
  const txtPath = path.join(MIGRATION_DIR, `${prefix}-${stamp}.txt`);

  await Promise.all([
    fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8'),
    fs.writeFile(txtPath, renderTextLog(payload), 'utf8'),
  ]);

  return { jsonPath, txtPath };
}

function printSummary({ options, summary, logPaths }) {
  if (options.mode === 'patch-attempts') {
    console.log('Patch-attempts migration complete');
    console.log(`Mode: ${options.dryRun ? 'dry-run' : 'apply'}`);
    console.log(`Logs: ${logPaths.jsonPath}, ${logPaths.txtPath}`);
    if (logPaths.snapshotPath) {
      console.log(`Snapshot: ${logPaths.snapshotPath}`);
    }
    console.log(`processed: ${summary.processed}`);
    console.log(`patched: ${summary.patched}`);
    for (const line of renderPatchAttemptsSkippedLines(summary)) {
      console.log(line.trimStart());
    }
    console.log(`error: ${summary.error}`);
    console.log(`dry_run_planned: ${summary.dry_run_planned}`);
    return;
  }

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

export async function runMigration(options) {
  const normalizedOptions = {
    dryRun: options.dryRun ?? true,
    limit: options.limit ?? null,
    uid: options.uid ?? null,
    mode: options.mode ?? 'integrations-only',
    snapshot: options.snapshot ?? null,
  };
  if (!MODES.has(normalizedOptions.mode)) {
    throw new Error('--mode must be one of: integrations-only, patch-attempts');
  }
  if (normalizedOptions.snapshot && !normalizedOptions.dryRun) {
    throw new Error('--snapshot is dry-run only; remove --apply before writing a rollback snapshot');
  }

  assertEnv();
  initFirebaseAdmin();

  const db = getFirestore();
  const docs = await listUaamDocs({
    db,
    uid: normalizedOptions.uid,
    limit: normalizedOptions.limit,
  });
  const summary = initialSummary({
    dryRun: normalizedOptions.dryRun,
    mode: normalizedOptions.mode,
  });
  const records = [];

  for (const docSnap of docs) {
    try {
      const record = normalizedOptions.mode === 'patch-attempts'
        ? await processPatchAttemptsDoc({ db, docSnap, dryRun: normalizedOptions.dryRun })
        : await processDoc({ db, docSnap, dryRun: normalizedOptions.dryRun });
      records.push(record);
      applyRecordToSummary(summary, record);
    } catch (error) {
      const record = {
        uid: docSnap.id,
        status: 'error',
        decision: 'error',
        error: errorSummary(error),
      };
      records.push(record);
      applyRecordToSummary(summary, record);
      console.warn(`[migrate-integrations] ${docSnap.id}: ${errorSummary(error)}`);
    }
  }

  const logPaths = await writeLogs({ options: normalizedOptions, summary, records });
  const snapshotPath = normalizedOptions.mode === 'patch-attempts'
    ? await writeSnapshot({ snapshotPath: normalizedOptions.snapshot, records })
    : null;
  const result = {
    options: normalizedOptions,
    summary,
    records,
    logPaths: {
      ...logPaths,
      ...(snapshotPath ? { snapshotPath } : {}),
    },
  };
  return result;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const result = await runMigration(options);
  printSummary({ options: result.options, summary: result.summary, logPaths: result.logPaths });
}

function isDirectRun() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isDirectRun()) {
  main().catch((error) => {
    console.error(`[migrate-integrations] ${errorSummary(error)}`);
    process.exitCode = 1;
  });
}
