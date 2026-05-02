import { db } from '../lib/firebaseAdmin.js';
import { getKindConfig, hasParentResult } from '../lib/legacy.js';
import { authenticateMeRequest, withMeHandler } from './_auth.js';
import { summarizeFromParent } from '../../shared/attemptLogic.js';

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

async function loadKindStatus(kind, uid) {
  const { collection } = getKindConfig(kind);
  const parentRef = db.collection(collection).doc(uid);
  const parentSnap = await parentRef.get();

  if (!parentSnap.exists) return summarizeFromParent(null);

  const data = parentSnap.data() || {};
  const hasResult = hasParentResult(data, kind);
  const pendingAttemptIdRaw = data.pendingAttemptId ?? null;

  const [committedAttemptsCount, pendingSnap] = await Promise.all([
    countCommittedAttempts(parentRef),
    pendingAttemptIdRaw
      ? parentRef.collection('attempts').doc(pendingAttemptIdRaw).get()
      : Promise.resolve(null),
  ]);

  const hasPending = !!(pendingSnap?.exists && pendingSnap.data()?.status === 'pending');
  const pendingAttemptId = hasPending ? pendingAttemptIdRaw : null;
  const committedCount = Math.max(committedAttemptsCount, hasResult ? 1 : 0);

  return {
    committedCount,
    attemptCount: committedCount,
    hasPending,
    pendingAttemptId,
    hasResult,
    isStartBlocked: hasPending || committedCount >= 2,
  };
}

export default withMeHandler(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const decoded = await authenticateMeRequest(req, res);
  if (!decoded) return undefined;

  const entries = await Promise.all(
    KINDS.map(async (kind) => [kind, await loadKindStatus(kind, decoded.uid)])
  );

  return res.status(200).json(Object.fromEntries(entries));
});
