import { db } from '../../lib/firebaseAdmin.js';
import { backfillAttemptSummary, getKindConfig, legacyDocToAttempt } from '../../lib/legacy.js';
import { serializeTimestamps } from '../../lib/serialize.js';
import { authenticateMeRequest, withMeHandler } from '../_auth.js';

const ATTEMPT_ID_RE = /^[A-Za-z0-9_-]+$/;

function readSingleQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function attemptDetail(docSnap, kind) {
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    status: data.status ?? null,
    summary: backfillAttemptSummary(data, kind),
    full: data.full ?? null,
    raw: data.raw ?? null,
    createdAt: data.createdAt ?? null,
    isLegacy: !!data.isLegacy,
  };
}

export default withMeHandler(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const decoded = await authenticateMeRequest(req, res);
  if (!decoded) return undefined;

  const kind = readSingleQueryValue(req.query.kind);
  const id = readSingleQueryValue(req.query.id);
  const config = getKindConfig(kind);
  if (!config || typeof id !== 'string' || id.length > 128 || !ATTEMPT_ID_RE.test(id)) {
    return res.status(422).json({ error: 'kind and id are required' });
  }

  const parentRef = db.collection(config.collection).doc(decoded.uid);

  if (id === 'legacy-fallback') {
    const parentSnap = await parentRef.get();
    const legacy = parentSnap.exists ? legacyDocToAttempt(parentSnap.data(), kind) : null;
    if (!legacy) return res.status(404).json({ error: 'attempt not found' });
    return res.status(200).json(serializeTimestamps(legacy));
  }

  const attemptSnap = await parentRef.collection('attempts').doc(id).get();
  if (!attemptSnap.exists) return res.status(404).json({ error: 'attempt not found' });
  if (attemptSnap.data()?.status !== 'committed') {
    return res.status(404).json({ error: 'attempt not found' });
  }

  return res.status(200).json(serializeTimestamps(attemptDetail(attemptSnap, kind)));
});
