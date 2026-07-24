export const UAAM_ZONE_THRESHOLDS = Object.freeze({
  scoreMax: 20,
  proAxisMin: 16,
  proFallbackAxisMin: 15,
  proSumMin: 32,
  activeAxisMin: 12,
  activeSumMax: 31,
  potentialAxisMin: 10,
  potentialSumMin: 22,
});

export function normalizeUaamZoneScore(value) {
  if (!Number.isFinite(value) || value < 0 || value > UAAM_ZONE_THRESHOLDS.scoreMax) return null;
  return Math.round(value);
}

export function getZone(sA, sB) {
  const sum = sA + sB;
  if (sA === UAAM_ZONE_THRESHOLDS.scoreMax && sB === UAAM_ZONE_THRESHOLDS.scoreMax) return 'natural';
  if (
    (sA >= UAAM_ZONE_THRESHOLDS.proAxisMin && sB >= UAAM_ZONE_THRESHOLDS.proAxisMin)
    || (
      sA >= UAAM_ZONE_THRESHOLDS.proFallbackAxisMin
      && sB >= UAAM_ZONE_THRESHOLDS.proFallbackAxisMin
      && sum >= UAAM_ZONE_THRESHOLDS.proSumMin
    )
  ) return 'pro';
  if (
    sA >= UAAM_ZONE_THRESHOLDS.activeAxisMin
    && sB >= UAAM_ZONE_THRESHOLDS.activeAxisMin
    && sum <= UAAM_ZONE_THRESHOLDS.activeSumMax
  ) return 'active';
  if (
    sA >= UAAM_ZONE_THRESHOLDS.potentialAxisMin
    && sB >= UAAM_ZONE_THRESHOLDS.potentialAxisMin
    && sum >= UAAM_ZONE_THRESHOLDS.potentialSumMin
    && !(sA >= UAAM_ZONE_THRESHOLDS.activeAxisMin && sB >= UAAM_ZONE_THRESHOLDS.activeAxisMin)
  ) return 'potential';
  return 'dormant';
}

export function zAlpha(zone, sA, sB) {
  if (zone === 'natural') return 1.0;

  const sum = sA + sB;
  const linear = (value, min, max) => Math.max(0, Math.min(1, (value - min) / (max - min)));

  if (zone === 'pro') return 0.18 + linear(sum, 32, 40) * 0.82;
  if (zone === 'active') return 0.10 + linear(sum, 24, 31) * 0.78;
  if (zone === 'potential') return 0.05 + linear(sum, 22, 30) * 0.50;
  return 0.06;
}
