import { db } from '../lib/firebaseAdmin.js';
import { backfillAttemptSummary, getKindConfig } from '../lib/legacy.js';
import { serializeTimestamps } from '../lib/serialize.js';
import { authenticateMeRequest, withMeHandler } from './_auth.js';
import { listFromAttempts, summarizeFromAttemptsAndParent } from '../../shared/attemptLogic.js';

function readKind(req) {
  const value = Array.isArray(req.query.kind) ? req.query.kind[0] : req.query.kind;
  return typeof value === 'string' ? value : null;
}

function attemptFromDoc(docSnap, kind) {
  const data = docSnap.data() || {};
  return {
    ...data,
    id: docSnap.id,
    summary: backfillAttemptSummary(data, kind),
    isLegacy: !!data.isLegacy,
  };
}

function attemptListItem(attempt, kind) {
  return {
    id: attempt.id,
    status: attempt.status ?? null,
    summary: backfillAttemptSummary(attempt, kind),
    createdAt: attempt.createdAt ?? null,
    isLegacy: !!attempt.isLegacy,
  };
}

export default withMeHandler(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const decoded = await authenticateMeRequest(req, res);
  if (!decoded) return undefined;

  const kind = readKind(req);
  const config = getKindConfig(kind);
  if (!config) return res.status(422).json({ error: 'kind must be saikaku or uaam' });

  const parentRef = db.collection(config.collection).doc(decoded.uid);
  const attemptsRef = parentRef.collection('attempts');
  const parentSnapPromise = parentRef.get();
  const committedSnapPromise = attemptsRef
    .where('status', '==', 'committed')
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();
  const pendingSnapPromise = parentSnapPromise.then((parentSnap) => {
    const pendingAttemptId = parentSnap.exists ? parentSnap.data()?.pendingAttemptId : null;
    return pendingAttemptId ? attemptsRef.doc(pendingAttemptId).get() : null;
  });

  const [parentSnap, committedSnap, pendingSnap] = await Promise.all([
    parentSnapPromise,
    committedSnapPromise,
    pendingSnapPromise,
  ]);
  const parentData = parentSnap.exists ? parentSnap.data() : null;
  const committedDocs = committedSnap.docs.map((docSnap) => attemptFromDoc(docSnap, kind));
  const pendingAttemptDoc = pendingSnap?.exists ? attemptFromDoc(pendingSnap, kind) : null;
  const attemptDocs = pendingAttemptDoc?.status === 'pending'
    ? [...committedDocs, pendingAttemptDoc]
    : committedDocs;
  const { committedAttempts, pendingAttempt } = listFromAttempts(attemptDocs, parentData, kind);
  const attempts = committedAttempts.map((attempt) => attemptListItem(attempt, kind));
  const pendingListItem = pendingAttempt ? attemptListItem(pendingAttempt, kind) : null;
  const summary = summarizeFromAttemptsAndParent(attemptDocs, parentData);

  return res.status(200).json(serializeTimestamps({
    attempts,
    pendingAttempt: pendingListItem,
    summary,
  }));
});
