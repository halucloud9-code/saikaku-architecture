export const INTEGRATIONS_EXPORT_FIELD_DEFS = [
  { key: 'userName', label: '名前' },
  { key: 'userEmail', label: 'メール' },
  { key: 'pairKey', label: 'pairKey' },
  { key: 'saikakuAttemptId', label: 'saikakuAttemptId' },
  { key: 'uaamAttemptId', label: 'uaamAttemptId' },
  { key: 'saikakuLabel', label: 'saikakuLabel' },
  { key: 'uaamLabel', label: 'uaamLabel' },
  { key: 'regenerationCount', label: 'regenerationCount' },
  { key: 'integration_score', label: 'integration_score' },
  { key: 'status', label: 'status' },
  { key: 'staleSaikaku', label: 'staleSaikaku' },
  { key: 'staleUaam', label: 'staleUaam' },
  { key: 'model', label: 'model' },
  { key: 'isLegacyFallback', label: 'isLegacyFallback' },
  { key: 'createdAt', label: 'createdAt' },
  { key: 'updatedAt', label: 'updatedAt' },
];

export function buildIntegrationsRows(integrations) {
  if (!Array.isArray(integrations)) throw new TypeError('integrations must be an array');

  return integrations.map((item) => ({
    userName: item.userName ?? '',
    userEmail: item.userEmail ?? '',
    pairKey: item.pairKey ?? '',
    saikakuAttemptId: item.saikakuAttemptId ?? '',
    uaamAttemptId: item.uaamAttemptId ?? '',
    saikakuLabel: item.source?.saikakuLabel ?? '',
    uaamLabel: item.source?.uaamLabel ?? '',
    regenerationCount: item.regenerationCount ?? 0,
    integration_score: item.integration?.integration_score ?? '',
    status: item.status ?? '',
    staleSaikaku: item.staleSaikaku ? 'true' : 'false',
    staleUaam: item.staleUaam ? 'true' : 'false',
    model: item.model ?? '',
    isLegacyFallback: item.isLegacyFallback ? 'true' : 'false',
    createdAt: item.createdAt ?? '',
    updatedAt: item.updatedAt ?? '',
  }));
}
