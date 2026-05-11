export function integrationFromDoc(docSnap) {
  return {
    id: docSnap.id,
    ...docSnap.data(),
  };
}

export function legacyIntegrationFromParent(parentData) {
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

export function listIntegrationDocs(integrationsSnap, uaamParentData) {
  if (!integrationsSnap.empty) return integrationsSnap.docs.map(integrationFromDoc);
  const legacy = legacyIntegrationFromParent(uaamParentData);
  return legacy ? [legacy] : [];
}

export function isLegacyFallback(integrationDoc) {
  return integrationDoc?.saikakuAttemptId === 'legacy-fallback'
    || integrationDoc?.uaamAttemptId === 'legacy-fallback';
}
