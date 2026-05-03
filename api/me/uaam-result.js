import { db } from '../lib/firebaseAdmin.js';
import { serializeTimestamps } from '../lib/serialize.js';
import { authenticateMeRequest, withMeHandler } from './_auth.js';
import { isValidAttemptId, selectIntegrationForAttempt } from '../../shared/attemptLogic.js';

function readSingleQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function readAttemptId(req) {
  const value = readSingleQueryValue(req.query.attemptId);
  if (value === undefined) return null;
  if (!isValidAttemptId(value)) {
    return undefined;
  }
  return value;
}

function integrationFromDoc(docSnap) {
  return {
    id: docSnap.id,
    ...docSnap.data(),
  };
}

function legacyIntegrationFromParent(parentData) {
  if (!parentData) return null;

  const integration =
    parentData['analysis.saikaku_integration']
    ?? parentData.analysis?.saikaku_integration
    ?? null;

  if (!integration) return null;

  const generatedAt = parentData.integrationUpdatedAt ?? null;
  const legacySource = {
    saikakuLabel: parentData.analysis?.saikaku_attempt_label ?? null,
    uaamLabel: parentData.analysis?.uaam_attempt_label ?? null,
  };

  return {
    id: 'legacy-fallback__legacy-fallback',
    saikakuAttemptId: 'legacy-fallback',
    uaamAttemptId: 'legacy-fallback',
    integration,
    regenerationCount: 0,
    model: 'unknown-legacy',
    source: legacySource,
    createdAt: generatedAt,
    updatedAt: generatedAt,
    status: 'active',
    isLegacyFallback: true,
  };
}

function listIntegrationDocs(integrationsSnap, uaamParentData) {
  if (!integrationsSnap.empty) return integrationsSnap.docs.map(integrationFromDoc);
  const legacy = legacyIntegrationFromParent(uaamParentData);
  return legacy ? [legacy] : [];
}

function isLegacyFallbackIntegration(integrationDoc) {
  return integrationDoc?.saikakuAttemptId === 'legacy-fallback'
    && integrationDoc?.uaamAttemptId === 'legacy-fallback';
}

function responseStatusForIntegration(integrationDoc, latestSaikakuAttemptId) {
  if (isLegacyFallbackIntegration(integrationDoc)) return 'active';

  return typeof latestSaikakuAttemptId === 'string'
    && latestSaikakuAttemptId !== integrationDoc.saikakuAttemptId
    ? 'stale'
    : 'active';
}

function integrationSummary(integrationDoc, latestSaikakuAttemptId) {
  if (!integrationDoc?.integration) return null;

  const body = integrationDoc.integration;
  const integrationScore = typeof body.integration_score === 'number'
    ? body.integration_score
    : null;
  const activationCore = typeof body.activation_core === 'string'
    ? body.activation_core
    : null;

  return {
    exists: true,
    generatedAt: integrationDoc.updatedAt ?? integrationDoc.createdAt ?? null,
    integrationScore,
    activationCore,
    saikakuAttemptId: integrationDoc.saikakuAttemptId,
    uaamAttemptId: integrationDoc.uaamAttemptId,
    status: responseStatusForIntegration(integrationDoc, latestSaikakuAttemptId),
    regenerationCount: integrationDoc.regenerationCount ?? 0,
    source: integrationDoc.source ?? null,
    integration: body,
  };
}

function legacyFallbackIntegration(integrations) {
  return integrations.find(isLegacyFallbackIntegration) ?? null;
}

function selectUaamIntegration(integrations, attemptId) {
  if (!attemptId) return legacyFallbackIntegration(integrations);
  return selectIntegrationForAttempt(integrations, 'uaam', attemptId)
    ?? legacyFallbackIntegration(integrations);
}

function emptyResult(includeIntegrationSummary) {
  const response = { scores: null, analysis: null };
  if (includeIntegrationSummary) response.integrationSummary = null;
  return response;
}

export default withMeHandler(async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');

  if (req.method !== 'GET') return res.status(405).json({ code: 'method_not_allowed' });

  const decoded = await authenticateMeRequest(req, res);
  if (!decoded) return undefined;

  const requestedAttemptId = readAttemptId(req);
  if (requestedAttemptId === undefined) {
    return res.status(422).json({ error: 'attemptId is invalid', code: 'invalid_input', field: 'attemptId' });
  }

  const parentRef = db.collection('uaam_results').doc(decoded.uid);
  const saikakuParentRef = db.collection('results').doc(decoded.uid);
  const [snapshot, saikakuParentSnap, integrationsSnap] = await Promise.all([
    parentRef.get(),
    saikakuParentRef.get(),
    parentRef.collection('integrations').get(),
  ]);

  if (!snapshot.exists) {
    return res.status(200).json(emptyResult(requestedAttemptId !== null));
  }

  const data = snapshot.data() || {};
  const integrations = listIntegrationDocs(integrationsSnap, data);
  const latestSaikakuAttemptId = saikakuParentSnap.exists
    ? saikakuParentSnap.data()?.latestAttemptId ?? null
    : null;
  const resolvedAttemptId = requestedAttemptId ?? data.latestAttemptId ?? null;

  let scores = data.scores ?? null;
  let analysis = data.analysis ?? null;

  if (requestedAttemptId && requestedAttemptId !== 'legacy-fallback') {
    const attemptSnap = await parentRef.collection('attempts').doc(requestedAttemptId).get();
    if (!attemptSnap.exists || attemptSnap.data()?.status !== 'committed') {
      return res.status(404).json({ error: 'attempt not found', code: 'not_found' });
    }

    const full = attemptSnap.data()?.full ?? {};
    scores = full.scores ?? null;
    analysis = full.analysis ?? null;
  }

  const selectedIntegration = selectUaamIntegration(integrations, resolvedAttemptId);
  const summary = integrationSummary(selectedIntegration, latestSaikakuAttemptId);
  const includeIntegrationSummary = requestedAttemptId !== null || !!summary;

  if (!scores || !analysis) {
    return res.status(200).json(emptyResult(includeIntegrationSummary));
  }

  const responseAnalysis = selectedIntegration?.integration
    ? { ...analysis, saikaku_integration: selectedIntegration.integration }
    : analysis;

  const response = {
    scores,
    analysis: responseAnalysis,
  };
  if (includeIntegrationSummary) response.integrationSummary = summary;

  return res.status(200).json(serializeTimestamps(response));
});
