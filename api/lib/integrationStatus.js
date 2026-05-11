import { isLegacyFallback } from './legacyIntegration.js';

function shouldCheckSaikaku(kind) {
  return kind === 'uaam' || kind === 'admin';
}

function shouldCheckUaam(kind) {
  return kind === 'saikaku' || kind === 'admin';
}

export function computeStatus(integrationDoc, kind, latestIds = {}) {
  if (isLegacyFallback(integrationDoc)) {
    return { status: 'active', staleSaikaku: false, staleUaam: false };
  }

  const staleSaikaku = shouldCheckSaikaku(kind)
    && typeof latestIds.saikakuAttemptId === 'string'
    && latestIds.saikakuAttemptId !== integrationDoc.saikakuAttemptId;
  const staleUaam = shouldCheckUaam(kind)
    && typeof latestIds.uaamAttemptId === 'string'
    && latestIds.uaamAttemptId !== integrationDoc.uaamAttemptId;

  return {
    status: staleSaikaku || staleUaam ? 'stale' : 'active',
    staleSaikaku,
    staleUaam,
  };
}

export function responseStatusForIntegration(integrationDoc, kind, latestIds = {}) {
  return computeStatus(integrationDoc, kind, latestIds).status;
}
