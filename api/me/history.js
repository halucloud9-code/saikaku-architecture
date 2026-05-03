import { db } from '../lib/firebaseAdmin.js';
import { backfillAttemptSummary, getKindConfig } from '../lib/legacy.js';
import { serializeTimestamps } from '../lib/serialize.js';
import { authenticateMeRequest, withMeHandler } from './_auth.js';
import {
  listFromAttempts,
  selectIntegrationForAttempt,
  summarizeFromAttemptsAndParent,
} from '../../shared/attemptLogic.js';

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

function responseStatusForIntegration(integrationDoc, kind, latestIds) {
  if (isLegacyFallbackIntegration(integrationDoc)) return 'active';

  if (kind === 'uaam') {
    const latestSaikakuAttemptId = latestIds.saikakuAttemptId;
    return typeof latestSaikakuAttemptId === 'string'
      && latestSaikakuAttemptId !== integrationDoc.saikakuAttemptId
      ? 'stale'
      : 'active';
  }

  const latestUaamAttemptId = latestIds.uaamAttemptId;
  return typeof latestUaamAttemptId === 'string'
    && latestUaamAttemptId !== integrationDoc.uaamAttemptId
    ? 'stale'
    : 'active';
}

function integrationSummary(integrationDoc, kind, latestIds) {
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
    status: responseStatusForIntegration(integrationDoc, kind, latestIds),
    regenerationCount: integrationDoc.regenerationCount ?? 0,
    source: integrationDoc.source ?? null,
    integration: body,
  };
}

function legacyFallbackIntegration(integrations) {
  return integrations.find(isLegacyFallbackIntegration) ?? null;
}

function selectUaamIntegration(integrations, attempt) {
  const pairMatched = selectIntegrationForAttempt(integrations, 'uaam', attempt.id);
  if (pairMatched) return pairMatched;
  // legacy 由来の attempt のみ legacy-fallback synthesis を継承する。
  // real attempt の場合「この attempt 単独で integration なし」を null で表現し、
  // 関係ない legacy parent integration を attach しない（PR #60 P2 対応）。
  if (attempt.isLegacy) return legacyFallbackIntegration(integrations);
  return null;
}

function selectSaikakuIntegrations(integrations, attempt) {
  const selected = selectIntegrationForAttempt(integrations, 'saikaku', attempt.id);
  if (selected.length > 0) return selected;

  if (!attempt.isLegacy) return [];
  const legacy = legacyFallbackIntegration(integrations);
  return legacy ? [legacy] : [];
}

function attemptListItem(attempt, kind, integrations, latestIds) {
  const item = {
    id: attempt.id,
    status: attempt.status ?? null,
    summary: backfillAttemptSummary(attempt, kind),
    createdAt: attempt.createdAt ?? null,
    isLegacy: !!attempt.isLegacy,
  };

  if (kind === 'uaam') {
    item.integrationSummary = integrationSummary(
      selectUaamIntegration(integrations, attempt),
      kind,
      latestIds
    );
  } else {
    item.integrationSummaries = selectSaikakuIntegrations(integrations, attempt)
      .map((integrationDoc) => integrationSummary(integrationDoc, kind, latestIds))
      .filter(Boolean);
  }

  return item;
}

export default withMeHandler(async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');

  if (req.method !== 'GET') return res.status(405).json({ code: 'method_not_allowed' });

  const decoded = await authenticateMeRequest(req, res);
  if (!decoded) return undefined;

  const kind = readKind(req);
  const config = getKindConfig(kind);
  if (!config) return res.status(422).json({ error: 'kind must be saikaku or uaam', code: 'invalid_input', field: 'kind' });

  const parentRef = db.collection(config.collection).doc(decoded.uid);
  const saikakuParentRef = db.collection('results').doc(decoded.uid);
  const uaamParentRef = db.collection('uaam_results').doc(decoded.uid);
  const [parentSnap, attemptsSnap, saikakuParentSnap, uaamParentSnap, integrationsSnap] = await Promise.all([
    parentRef.get(),
    parentRef.collection('attempts').get(),
    saikakuParentRef.get(),
    uaamParentRef.get(),
    uaamParentRef.collection('integrations').get(),
  ]);
  const parentData = parentSnap.exists ? parentSnap.data() : null;
  const saikakuParentData = saikakuParentSnap.exists ? saikakuParentSnap.data() : null;
  const uaamParentData = uaamParentSnap.exists ? uaamParentSnap.data() : null;
  const integrations = listIntegrationDocs(integrationsSnap, uaamParentData);
  const latestIds = {
    saikakuAttemptId: saikakuParentData?.latestAttemptId ?? null,
    uaamAttemptId: uaamParentData?.latestAttemptId ?? null,
  };
  const attemptDocs = attemptsSnap.docs.map((docSnap) => attemptFromDoc(docSnap, kind));
  const { committedAttempts, pendingAttempt } = listFromAttempts(attemptDocs, parentData, kind);
  const attempts = committedAttempts.map((attempt) => (
    attemptListItem(attempt, kind, integrations, latestIds)
  ));
  const pendingListItem = pendingAttempt
    ? {
        id: pendingAttempt.id,
        status: pendingAttempt.status ?? null,
        summary: backfillAttemptSummary(pendingAttempt, kind),
        createdAt: pendingAttempt.createdAt ?? null,
        isLegacy: !!pendingAttempt.isLegacy,
      }
    : null;
  const summary = summarizeFromAttemptsAndParent(attemptDocs, parentData);

  return res.status(200).json(serializeTimestamps({
    attempts,
    pendingAttempt: pendingListItem,
    summary,
  }));
});
