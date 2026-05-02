import { db } from '../lib/firebaseAdmin.js';
import { backfillAttemptSummary, getKindConfig } from '../lib/legacy.js';
import { serializeTimestamps } from '../lib/serialize.js';
import { authenticateMeRequest, withMeHandler } from './_auth.js';
import { listFromAttempts, summarizeFromParent } from '../../shared/attemptLogic.js';

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
  const [parentSnap, attemptsSnap] = await Promise.all([
    parentRef.get(),
    parentRef.collection('attempts').get(),
  ]);
  const parentData = parentSnap.exists ? parentSnap.data() : null;
  const attemptDocs = attemptsSnap.docs.map((docSnap) => attemptFromDoc(docSnap, kind));
  const { committedAttempts, pendingAttempt } = listFromAttempts(attemptDocs, parentData, kind);
  const attempts = committedAttempts.map((attempt) => attemptListItem(attempt, kind));
  const pendingListItem = pendingAttempt ? attemptListItem(pendingAttempt, kind) : null;
  const summary = summarizeFromParent(parentData);

  return res.status(200).json(serializeTimestamps({
    attempts,
    pendingAttempt: pendingListItem,
    summary,
  }));
});
