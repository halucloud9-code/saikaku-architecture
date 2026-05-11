import { db } from '../lib/firebaseAdmin.js';
import { backfillAttemptSummary, getKindConfig, hasParentResult } from '../lib/legacy.js';
import { serializeTimestamps } from '../lib/serialize.js';
import { authenticateMeRequest, withMeHandler } from './_auth.js';
import { legacyDocToAttempt, summarizeFromParent } from '../../shared/attemptLogic.js';

const KINDS = ['saikaku', 'uaam'];

async function countCommittedAttempts(parentRef) {
  const query = parentRef.collection('attempts').where('status', '==', 'committed');

  try {
    if (typeof query.count === 'function') {
      const aggregate = await query.count().get();
      return aggregate.data().count ?? 0;
    }
  } catch {
    // Fall through for SDKs/emulators without aggregate count support.
  }

  const snapshot = await query.get();
  return snapshot.docs.filter((doc) => doc.data()?.status === 'committed').length;
}

async function listRecentCommittedAttempts(parentRef) {
  const snapshot = await parentRef.collection('attempts')
    .where('status', '==', 'committed')
    .orderBy('createdAt', 'desc')
    .limit(2)
    .select('summary', 'full', 'createdAt', 'isLegacy')
    .get();

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() || {};
    return {
      ...data,
      id: docSnap.id,
      isLegacy: !!data.isLegacy,
    };
  });
}

async function hasAttemptDocs(parentRef) {
  const snapshot = await parentRef.collection('attempts').limit(1).get();
  return !snapshot.empty;
}

function recentAttemptItem(attemptData, kind) {
  const summary = backfillAttemptSummary(attemptData, kind);
  const label = kind === 'saikaku'
    ? summary.kakuchiiki ?? null
    : summary.typeName ?? null;

  return {
    id: attemptData.id,
    label,
    createdAt: attemptData.createdAt ?? null,
    isLegacy: !!attemptData.isLegacy,
  };
}

async function buildRecentAttempts(parentRef, parentData, kind, committedAttemptsCount, committedAttempts) {
  if (committedAttempts.length > 0) {
    return committedAttempts.map((attempt) => recentAttemptItem(attempt, kind));
  }

  if (committedAttemptsCount > 0 || await hasAttemptDocs(parentRef)) return [];

  const legacyAttempt = legacyDocToAttempt(parentData, kind);
  return legacyAttempt ? [recentAttemptItem(legacyAttempt, kind)] : [];
}

async function loadKindStatus(kind, uid) {
  const { collection } = getKindConfig(kind);
  const parentRef = db.collection(collection).doc(uid);
  const parentSnap = await parentRef.get();

  if (!parentSnap.exists) {
    return {
      ...summarizeFromParent(null),
      recentAttempts: [],
    };
  }

  const data = parentSnap.data() || {};
  const hasResult = hasParentResult(data, kind);
  const pendingAttemptIdRaw = data.pendingAttemptId ?? null;

  const [committedAttemptsCount, pendingSnap, committedAttempts] = await Promise.all([
    countCommittedAttempts(parentRef),
    pendingAttemptIdRaw
      ? parentRef.collection('attempts').doc(pendingAttemptIdRaw).get()
      : Promise.resolve(null),
    listRecentCommittedAttempts(parentRef),
  ]);

  const hasPending = !!(pendingSnap?.exists && pendingSnap.data()?.status === 'pending');
  const pendingAttemptId = hasPending ? pendingAttemptIdRaw : null;
  const committedCount = Math.max(committedAttemptsCount, hasResult ? 1 : 0);
  const recentAttempts = await buildRecentAttempts(
    parentRef,
    data,
    kind,
    committedAttemptsCount,
    committedAttempts,
  );

  return {
    committedCount,
    attemptCount: committedCount,
    hasPending,
    pendingAttemptId,
    hasResult,
    isStartBlocked: hasPending || committedCount >= 2,
    recentAttempts,
  };
}

export default withMeHandler(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const decoded = await authenticateMeRequest(req, res);
  if (!decoded) return undefined;

  const entries = await Promise.all(
    KINDS.map(async (kind) => [kind, await loadKindStatus(kind, decoded.uid)])
  );

  return res.status(200).json(serializeTimestamps(Object.fromEntries(entries)));
});
