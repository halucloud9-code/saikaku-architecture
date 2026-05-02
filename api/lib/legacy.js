import { extractFull, extractRaw, extractSummary } from './attempts.js';

export const KIND_CONFIG = {
  saikaku: { collection: 'results' },
  uaam: { collection: 'uaam_results' },
};

export function getKindConfig(kind) {
  return KIND_CONFIG[kind] ?? null;
}

export function hasParentResult(data, kind) {
  if (!data) return false;
  if (kind === 'saikaku') return !!data.result || !!data.analysis;
  return !!data.scores || !!data.analysis;
}

export function hasLegacyAttemptData(data, kind) {
  if (!data) return false;
  // Saikaku history synthesis requires result because ResultScreen cannot render analysis-only attempts.
  if (kind === 'saikaku') return !!data.result;
  return !!data.scores || !!data.analysis;
}

export function legacyDocToAttempt(parentData, kind) {
  if (!hasLegacyAttemptData(parentData, kind)) return null;

  return {
    id: 'legacy-fallback',
    isLegacy: true,
    status: 'committed',
    summary: extractSummary(parentData, kind),
    full: extractFull(parentData, kind),
    raw: extractRaw(parentData, kind),
    createdAt: parentData?.createdAt ?? null,
  };
}

export function backfillAttemptSummary(attemptData, kind) {
  const summary = attemptData?.summary ?? {};
  const full = attemptData?.full ?? {};
  const createdAt = summary.createdAt ?? attemptData?.createdAt ?? null;

  if (kind === 'saikaku') {
    return {
      kakuchiiki: summary.kakuchiiki
        ?? full?.result?.kakuchiiki
        ?? full?.selectedKakuchiiki
        ?? null,
      typeName: summary.typeName ?? null,
      createdAt,
    };
  }

  return {
    typeName: summary.typeName
      ?? full?.analysis?.type_name
      ?? full?.analysis?.primary_type
      ?? null,
    createdAt,
  };
}
