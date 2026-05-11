import { responseStatusForIntegration } from './integrationStatus.js';
import { timestampToMillis } from '../../shared/attemptLogic.js';
import { buildPairKey } from '../../shared/integrationsKey.js';

export function integrationSummary(integrationDoc, latestIds) {
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
    status: responseStatusForIntegration(integrationDoc, 'uaam', latestIds),
    regenerationCount: integrationDoc.regenerationCount ?? 0,
    source: integrationDoc.source ?? null,
    integration: body,
  };
}

export function recentIntegrationSummary(integrationDoc, latestIds) {
  const summary = integrationSummary(integrationDoc, latestIds);
  if (!summary) return null;
  if (integrationDoc?.isLegacyFallback === true) {
    return { ...summary, isLegacyFallback: true };
  }
  return summary;
}

export function compareRecentIntegrationSummaries(a, b) {
  const aTime = timestampToMillis(a?.generatedAt) ?? Number.NEGATIVE_INFINITY;
  const bTime = timestampToMillis(b?.generatedAt) ?? Number.NEGATIVE_INFINITY;
  if (aTime !== bTime) return bTime - aTime;
  // generatedAt ties use ASC pairKey ordering so Firestore return order cannot affect rows.
  return buildPairKey(a.saikakuAttemptId, a.uaamAttemptId)
    .localeCompare(buildPairKey(b.saikakuAttemptId, b.uaamAttemptId));
}

export function recentIntegrationSummaries(integrations, latestIds) {
  return integrations
    .map((integrationDoc) => recentIntegrationSummary(integrationDoc, latestIds))
    .filter(Boolean)
    .sort(compareRecentIntegrationSummaries)
    .slice(0, 2);
}
