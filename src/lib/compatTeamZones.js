import { UAAM_ZONE_THRESHOLDS } from './uaamZones.js';

const COMPAT_CARRIER_ZONES = new Set(['natural', 'pro', 'active']);

function isValidAggregate(sum, count) {
  return Number.isSafeInteger(sum)
    && sum >= 0
    && Number.isSafeInteger(count)
    && count > 0
    && sum <= UAAM_ZONE_THRESHOLDS.scoreMax * count;
}

function axisAtLeast(sum, count, threshold) {
  return sum >= threshold * count;
}

function pairSumComparedTo(sumA, countA, sumB, countB, threshold) {
  return (sumA * countB) + (sumB * countA) - (threshold * countA * countB);
}

export function getCompatTeamAverageZone({
  sumA,
  countA,
  sumB,
  countB,
  allMembersNatural = false,
}) {
  if (!isValidAggregate(sumA, countA) || !isValidAggregate(sumB, countB)) return null;

  if (
    allMembersNatural
    && countA === countB
    && sumA === UAAM_ZONE_THRESHOLDS.scoreMax * countA
    && sumB === UAAM_ZONE_THRESHOLDS.scoreMax * countB
  ) return 'natural';

  if (
    (
      axisAtLeast(sumA, countA, UAAM_ZONE_THRESHOLDS.proAxisMin)
      && axisAtLeast(sumB, countB, UAAM_ZONE_THRESHOLDS.proAxisMin)
    )
    || (
      axisAtLeast(sumA, countA, UAAM_ZONE_THRESHOLDS.proFallbackAxisMin)
      && axisAtLeast(sumB, countB, UAAM_ZONE_THRESHOLDS.proFallbackAxisMin)
      && pairSumComparedTo(
        sumA,
        countA,
        sumB,
        countB,
        UAAM_ZONE_THRESHOLDS.proSumMin,
      ) >= 0
    )
  ) return 'pro';

  if (
    axisAtLeast(sumA, countA, UAAM_ZONE_THRESHOLDS.activeAxisMin)
    && axisAtLeast(sumB, countB, UAAM_ZONE_THRESHOLDS.activeAxisMin)
    && pairSumComparedTo(
      sumA,
      countA,
      sumB,
      countB,
      UAAM_ZONE_THRESHOLDS.activeSumMax,
    ) <= 0
  ) return 'active';

  if (
    axisAtLeast(sumA, countA, UAAM_ZONE_THRESHOLDS.potentialAxisMin)
    && axisAtLeast(sumB, countB, UAAM_ZONE_THRESHOLDS.potentialAxisMin)
    && pairSumComparedTo(
      sumA,
      countA,
      sumB,
      countB,
      UAAM_ZONE_THRESHOLDS.potentialSumMin,
    ) >= 0
    && !(
      axisAtLeast(sumA, countA, UAAM_ZONE_THRESHOLDS.activeAxisMin)
      && axisAtLeast(sumB, countB, UAAM_ZONE_THRESHOLDS.activeAxisMin)
    )
  ) return 'potential';

  return 'dormant';
}

export function getCompatTeamAverageScores({ sumA, countA, sumB, countB }) {
  if (!isValidAggregate(sumA, countA) || !isValidAggregate(sumB, countB)) return null;
  return {
    scoreA: sumA / countA,
    scoreB: sumB / countB,
  };
}

export function compareCompatTeamAverageStrength(left, right) {
  const leftNumerator = (left.sumA * left.countB) + (left.sumB * left.countA);
  const leftDenominator = left.countA * left.countB;
  const rightNumerator = (right.sumA * right.countB) + (right.sumB * right.countA);
  const rightDenominator = right.countA * right.countB;
  return (leftNumerator * rightDenominator) - (rightNumerator * leftDenominator);
}

export function isCompatCarrierZone(zone) {
  return COMPAT_CARRIER_ZONES.has(zone);
}
