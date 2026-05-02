import { db } from '../lib/firebaseAdmin.js';
import { backfillAttemptSummary, getKindConfig, legacyDocToAttempt } from '../lib/legacy.js';
import { serializeTimestamps } from '../lib/serialize.js';
import { authenticateMeRequest, withMeHandler } from './_auth.js';

function readKind(req) {
  const value = Array.isArray(req.query.kind) ? req.query.kind[0] : req.query.kind;
  return typeof value === 'string' ? value : null;
}

function attemptListItem(docSnap, kind) {
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    status: data.status ?? null,
    summary: backfillAttemptSummary(data, kind),
    createdAt: data.createdAt ?? null,
    isLegacy: !!data.isLegacy,
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
  const attemptsSnap = await parentRef.collection('attempts').orderBy('createdAt', 'desc').get();
  const attempts = attemptsSnap.docs
    .filter((docSnap) => docSnap.data()?.status === 'committed')
    .map((docSnap) => attemptListItem(docSnap, kind));

  if (attempts.length === 0) {
    const parentSnap = await parentRef.get();
    const legacy = parentSnap.exists ? legacyDocToAttempt(parentSnap.data(), kind) : null;
    if (legacy) {
      attempts.push({
        id: legacy.id,
        status: legacy.status,
        summary: legacy.summary,
        createdAt: legacy.createdAt,
        isLegacy: legacy.isLegacy,
      });
    }
  }

  return res.status(200).json(serializeTimestamps({ attempts }));
});
