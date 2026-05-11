import { db } from '../../lib/firebaseAdmin.js';
import { backfillAttemptSummary, getKindConfig, legacyDocToAttempt } from '../../lib/legacy.js';
import { listIntegrationDocs } from '../../lib/legacyIntegration.js';
import { recentIntegrationSummaries } from '../../lib/recentIntegrationSummaries.js';
import { serializeTimestamps } from '../../lib/serialize.js';
import { authenticateMeRequest, withMeHandler } from '../_auth.js';
import { isValidAttemptId } from '../../../shared/attemptLogic.js';

function readSingleQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function attemptDetail(docSnap, kind) {
  const data = docSnap.data() ?? {};
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

function uaamRecentIntegrationSummaries(parentSnap, integrationsSnap, saikakuParentSnap) {
  if (!parentSnap?.exists) return [];

  const parentData = parentSnap.data() ?? {};
  const latestIds = {
    saikakuAttemptId: saikakuParentSnap?.exists
      ? saikakuParentSnap.data()?.latestAttemptId ?? null
      : null,
    uaamAttemptId: parentData.latestAttemptId ?? null,
  };
  return recentIntegrationSummaries(
    listIntegrationDocs(integrationsSnap, parentData),
    latestIds,
  );
}

export default withMeHandler(async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');

  if (req.method !== 'GET') return res.status(405).json({ code: 'method_not_allowed' });

  const decoded = await authenticateMeRequest(req, res);
  if (!decoded) return undefined;

  const kind = readSingleQueryValue(req.query.kind);
  const id = readSingleQueryValue(req.query.id);
  const config = getKindConfig(kind);
  if (!config || !isValidAttemptId(id)) {
    return res.status(422).json({ error: 'kind and id are required', code: 'invalid_input', field: !config ? 'kind' : 'id' });
  }

  const parentRef = db.collection(config.collection).doc(decoded.uid);
  const isUaam = kind === 'uaam';

  if (id === 'legacy-fallback') {
    const [parentSnap, integrationsSnap, saikakuParentSnap] = isUaam
      ? await Promise.all([
        parentRef.get(),
        parentRef.collection('integrations').get(),
        db.collection('results').doc(decoded.uid).get(),
      ])
      : [await parentRef.get(), null, null];
    const legacy = parentSnap.exists ? legacyDocToAttempt(parentSnap.data(), kind) : null;
    if (!legacy) return res.status(404).json({ error: 'attempt not found', code: 'not_found' });
    if (isUaam) {
      legacy.recentIntegrationSummaries = uaamRecentIntegrationSummaries(
        parentSnap,
        integrationsSnap,
        saikakuParentSnap,
      );
    }
    return res.status(200).json(serializeTimestamps(legacy));
  }

  const attemptRef = parentRef.collection('attempts').doc(id);
  const attemptSnap = await attemptRef.get();
  if (!attemptSnap.exists) return res.status(404).json({ error: 'attempt not found', code: 'not_found' });
  if (attemptSnap.data()?.status !== 'committed') {
    return res.status(404).json({ error: 'attempt not found', code: 'not_found' });
  }

  const response = attemptDetail(attemptSnap, kind);
  if (isUaam) {
    const [parentSnap, integrationsSnap, saikakuParentSnap] = await Promise.all([
      parentRef.get(),
      parentRef.collection('integrations').get(),
      db.collection('results').doc(decoded.uid).get(),
    ]);
    response.recentIntegrationSummaries = uaamRecentIntegrationSummaries(
      parentSnap,
      integrationsSnap,
      saikakuParentSnap,
    );
  }

  return res.status(200).json(serializeTimestamps(response));
});
