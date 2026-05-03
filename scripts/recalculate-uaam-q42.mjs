import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { FieldValue } from 'firebase-admin/firestore';
import { QUESTIONS, calculateScores } from '../shared/uaamQuestions.js';

const COLLECTION = 'uaam_results';
const RECOMPUTE_REASON = 'issue-9-q42-v1';
const UID_BATCH_SIZE = 100;

let cachedDb = null;

async function getDb() {
  if (!cachedDb) {
    ({ db: cachedDb } = await import('../api/lib/firebaseAdmin.js'));
  }
  return cachedDb;
}

function usage() {
  return `Usage:
  node scripts/recalculate-uaam-q42.mjs [options]

Options:
  --commit        Write recomputed scores after interactive confirmation (default: dry-run)
  --uid <uid>     Restrict processing to one uaam_results/{uid} document
  --limit <N>     Process at most N users when --uid is not supplied
  --verbose       Print extra progress logging
  --help, -h      Print this help text and exit
`;
}

function normalizeArgv(argv) {
  const args = Array.from(argv ?? []);
  const first = args[0] ?? '';
  const second = args[1] ?? '';
  if (
    args.length >= 2
    && (first.endsWith('node') || first.endsWith('nodejs') || second.endsWith('.mjs'))
  ) {
    return args.slice(2);
  }
  return args;
}

function readValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

export function parseArgs(argv = []) {
  const args = normalizeArgv(argv);
  const options = {
    commit: false,
    uid: null,
    limit: null,
    verbose: false,
    help: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--commit') {
      options.commit = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--uid') {
      options.uid = readValue(args, i, '--uid');
      i += 1;
    } else if (arg.startsWith('--uid=')) {
      options.uid = arg.slice('--uid='.length);
      if (!options.uid) throw new Error('--uid requires a value');
    } else if (arg === '--limit') {
      options.limit = parseLimit(readValue(args, i, '--limit'));
      i += 1;
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseLimit(arg.slice('--limit='.length));
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function parseLimit(value) {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('--limit must be a positive integer');
  }
  return limit;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object ?? {}, key);
}

function isNonEmptyPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value).length > 0;
}

function getQ42Answer(answers) {
  const value = answers?.['42'] ?? answers?.[42];
  return value ?? '-';
}

function stableScoreString(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableScoreString).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableScoreString(value[key])}`).join(',')}}`;
}

function scoresDiffer(oldScores, newScores) {
  return stableScoreString(oldScores ?? null) !== stableScoreString(newScores);
}

function numberOrDash(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : '-';
}

function competencyTotal(scores) {
  return scores?.competency?.total;
}

function competencyDiff(oldScores, newScores) {
  const oldTotal = competencyTotal(oldScores);
  const newTotal = competencyTotal(newScores);
  if (typeof oldTotal !== 'number' || typeof newTotal !== 'number') return '-';
  return newTotal - oldTotal;
}

function buildMarker(oldScores) {
  return {
    recomputedAt: FieldValue.serverTimestamp(),
    oldScores: oldScores ?? null,
    recomputeReason: RECOMPUTE_REASON,
    narrative_may_be_stale: true,
  };
}

export async function recomputeUaamUid(uid, options = {}) {
  const activeDb = options.db ?? await getDb();
  const parentRef = activeDb.collection(COLLECTION).doc(uid);
  const parentSnapshot = await parentRef.get();
  const parentData = parentSnapshot.exists ? parentSnapshot.data() : {};
  const parentAlreadyRecomputed = hasOwn(parentData, 'q42_recompute');

  const attemptsSnapshot = await parentRef
    .collection('attempts')
    .where('status', '==', 'committed')
    .get();

  const attempts = [];

  for (const docSnap of attemptsSnapshot.docs) {
    const attempt = docSnap.data();
    const answers = attempt?.raw?.input?.answers;
    if (!isNonEmptyPlainObject(answers)) continue;

    const oldScores = attempt?.full?.scores ?? null;
    const newScores = calculateScores(answers, QUESTIONS);
    const skipped = hasOwn(attempt, 'q42_recompute');
    const parentWillUpdate = !skipped
      && parentData?.latestAttemptId === docSnap.id
      && !parentAlreadyRecomputed;

    attempts.push({
      uid,
      aid: docSnap.id,
      attemptId: docSnap.id,
      oldScores,
      newScores,
      parentOldScores: parentData?.scores ?? null,
      q42Answer: getQ42Answer(answers),
      hasDiff: scoresDiffer(oldScores, newScores),
      competencyDiff: competencyDiff(oldScores, newScores),
      parentWillUpdate,
      skipped,
      note: skipped ? 'already-recomputed' : '',
    });
  }

  attempts.sort((a, b) => a.aid.localeCompare(b.aid));
  return { uid, attempts, parentSnapshot };
}

function queuePlan(batch, activeDb, uid, plan) {
  const parentRef = activeDb.collection(COLLECTION).doc(uid);
  let attemptWrites = 0;
  let parentWrites = 0;

  for (const attempt of plan.attempts ?? []) {
    if (attempt.skipped) continue;

    const attemptRef = parentRef.collection('attempts').doc(attempt.aid ?? attempt.attemptId);
    batch.set(
      attemptRef,
      {
        full: { scores: attempt.newScores },
        q42_recompute: buildMarker(attempt.oldScores),
      },
      { merge: true }
    );
    attemptWrites += 1;

    if (attempt.parentWillUpdate) {
      batch.set(
        parentRef,
        {
          scores: attempt.newScores,
          q42_recompute: buildMarker(attempt.parentOldScores),
        },
        { merge: true }
      );
      parentWrites += 1;
    }
  }

  return { attemptWrites, parentWrites };
}

export async function applyRecomputeBatch(uid, plan, { commit = false } = {}) {
  const dryCounts = countWritable(plan);
  if (!commit || dryCounts.attemptWrites === 0) {
    return {
      committed: 0,
      failed: 0,
      parentUpdated: 0,
      plannedAttempts: dryCounts.attemptWrites,
      plannedParents: dryCounts.parentWrites,
    };
  }

  const activeDb = await getDb();
  const batch = activeDb.batch();
  const counts = queuePlan(batch, activeDb, uid, plan);
  await batch.commit();

  return {
    committed: counts.attemptWrites,
    failed: 0,
    parentUpdated: counts.parentWrites,
    plannedAttempts: counts.attemptWrites,
    plannedParents: counts.parentWrites,
  };
}

function countWritable(plan) {
  let attemptWrites = 0;
  let parentWrites = 0;
  for (const attempt of plan.attempts ?? []) {
    if (attempt.skipped) continue;
    attemptWrites += 1;
    if (attempt.parentWillUpdate) parentWrites += 1;
  }
  return { attemptWrites, parentWrites };
}

function summarize(plans) {
  const allAttempts = plans.flatMap((plan) => plan.attempts ?? []);
  return {
    target: allAttempts.length,
    diff: allAttempts.filter((attempt) => attempt.hasDiff).length,
    parentPlanned: allAttempts.filter((attempt) => attempt.parentWillUpdate).length,
    skipped: allAttempts.filter((attempt) => attempt.skipped).length,
    writable: allAttempts.filter((attempt) => !attempt.skipped).length,
  };
}

function toTableRows(plans) {
  return plans.flatMap((plan) => (plan.attempts ?? []).map((attempt) => ({
    uid: plan.uid ?? attempt.uid,
    attemptId: attempt.aid ?? attempt.attemptId,
    q42_answer: attempt.q42Answer ?? '-',
    old_competency_total: numberOrDash(competencyTotal(attempt.oldScores)),
    new_competency_total: numberOrDash(competencyTotal(attempt.newScores)),
    diff: attempt.competencyDiff,
    parent_will_update: Boolean(attempt.parentWillUpdate),
    note: attempt.note ?? '',
  })));
}

function printTable(rows) {
  if (rows.length === 0) {
    console.log('(no candidate attempts)');
    return;
  }
  console.table(rows);
}

async function readUserIds(options) {
  if (options.uid) return [options.uid];

  const activeDb = await getDb();
  const refs = await activeDb.collection(COLLECTION).listDocuments();
  const uids = refs.map((ref) => ref.id).sort((a, b) => a.localeCompare(b));
  return options.limit ? uids.slice(0, options.limit) : uids;
}

function printEnvDetection() {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.log(`emulator: FIRESTORE_EMULATOR_HOST=${process.env.FIRESTORE_EMULATOR_HOST}`);
  } else {
    console.log('PRODUCTION FIRESTORE — be careful');
  }
}

function printSampleDiff(plan) {
  const attempt = plan.attempts.find((item) => !item.skipped);
  if (!attempt) return;

  console.log('sample diff:');
  printTable([{
    uid: plan.uid,
    attemptId: attempt.aid,
    q42_answer: attempt.q42Answer ?? '-',
    old_competency_total: numberOrDash(competencyTotal(attempt.oldScores)),
    new_competency_total: numberOrDash(competencyTotal(attempt.newScores)),
    diff: attempt.competencyDiff,
    parent_will_update: Boolean(attempt.parentWillUpdate),
    note: attempt.note ?? '',
  }]);
}

async function confirmCommit() {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question('この内容で書き込みを進めますか？ (yes/N): ');
    return answer.trim() === 'yes';
  } finally {
    rl.close();
  }
}

async function commitPlans(plans) {
  const writablePlans = plans.filter((plan) => countWritable(plan).attemptWrites > 0);
  const activeDb = await getDb();
  const totals = { committed: 0, failed: 0, parentUpdated: 0 };

  for (let i = 0; i < writablePlans.length; i += UID_BATCH_SIZE) {
    const chunk = writablePlans.slice(i, i + UID_BATCH_SIZE);
    const batch = activeDb.batch();
    let chunkAttemptWrites = 0;
    let chunkParentWrites = 0;

    for (const plan of chunk) {
      const counts = queuePlan(batch, activeDb, plan.uid, plan);
      chunkAttemptWrites += counts.attemptWrites;
      chunkParentWrites += counts.parentWrites;
    }

    try {
      await batch.commit();
      totals.committed += chunkAttemptWrites;
      totals.parentUpdated += chunkParentWrites;
    } catch (error) {
      const firstUid = chunk[0]?.uid ?? '-';
      const lastUid = chunk[chunk.length - 1]?.uid ?? '-';
      console.error(`[commit failed] uid range ${firstUid}..${lastUid}: ${error.message || error}`);
      totals.failed += chunkAttemptWrites;
    }
  }

  return totals;
}

async function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(error.message || error);
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  if (options.help) {
    console.log(usage());
    return;
  }

  printEnvDetection();

  const uids = await readUserIds(options);
  if (options.verbose) {
    console.log(`users: ${uids.length}`);
  }

  const plans = [];
  for (const uid of uids) {
    if (options.verbose) console.log(`reading uid=${uid}`);
    plans.push(await recomputeUaamUid(uid, options));
  }

  printTable(toTableRows(plans));

  const summary = summarize(plans);
  console.log(`対象 ${summary.target} 件 / 差分あり ${summary.diff} 件 / 親 doc 更新予定 ${summary.parentPlanned} 件 / 既処理スキップ ${summary.skipped} 件`);

  if (!options.commit) return;

  if (summary.writable === 0) {
    console.log('書き込み対象がありません。');
    return;
  }

  const samplePlan = plans.find((plan) => plan.attempts.some((attempt) => !attempt.skipped));
  if (samplePlan) printSampleDiff(samplePlan);

  if (!await confirmCommit()) {
    console.log('commit を中止しました。');
    return;
  }

  const commitSummary = await commitPlans(plans);
  console.log(`commit 完了: 成功 ${commitSummary.committed} 件 / 失敗 ${commitSummary.failed} 件 / 親 doc 更新 ${commitSummary.parentUpdated} 件`);
  console.log(`再実行で skip される予定の attempt: ${commitSummary.committed + summary.skipped} 件`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}
