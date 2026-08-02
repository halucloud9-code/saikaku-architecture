import { createHash } from 'node:crypto';
import {
  getZone,
  normalizeUaamZoneScore,
  UAAM_ZONE_THRESHOLDS,
} from '../../src/lib/uaamZones.js';
import {
  getCompatTeamAverageZone,
  isCompatCarrierZone,
} from '../../src/lib/compatTeamZones.js';
import { COMPAT_VISUAL_UAAM_AXES } from './compatEvidence.js';

const COMPAT_PAIR_COUNT = (
  COMPAT_VISUAL_UAAM_AXES.length * (COMPAT_VISUAL_UAAM_AXES.length - 1)
) / 2;
const COMPAT_DIFFERENCE_SATURATION_COUNT = (COMPAT_PAIR_COUNT * 3) / 5;
const TEAM_MEAN_SCALE = 2520;

function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  const entries = Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`);
  return `{${entries.join(',')}}`;
}

export function createCompatRecommendationSnapshot(recommendation) {
  return createHash('sha256')
    .update(stableJson(recommendation), 'utf8')
    .digest('hex');
}

export function findCompatShortages(selectedProfiles) {
  return COMPAT_VISUAL_UAAM_AXES.flatMap((axis) => {
    const measured = selectedProfiles
      .map((profile) => normalizeUaamZoneScore(profile?.uaam?.[axis.key]))
      .filter((value) => value !== null);
    if (measured.length === 0) {
      return [{
        axisKey: axis.key,
        axisLabel: axis.label,
        missing: false,
        noData: true,
      }];
    }
    if (Math.max(...measured) < UAAM_ZONE_THRESHOLDS.activeAxisMin) {
      return [{
        axisKey: axis.key,
        axisLabel: axis.label,
        missing: true,
        noData: false,
      }];
    }
    return [];
  });
}

export function findCompatCandidates(profiles, selectedProfileIds, shortages) {
  const selectedIds = new Set(selectedProfileIds);
  return profiles
    .filter((profile) => !selectedIds.has(profile.id) && profile.uaam)
    .map((profile) => ({
      profileId: profile.id,
      displayName: profile.displayName,
      matchedAxes: shortages.filter((shortage) => (
        (normalizeUaamZoneScore(profile.uaam[shortage.axisKey]) ?? -1)
          >= UAAM_ZONE_THRESHOLDS.proAxisMin
      )),
    }))
    .filter((candidate) => candidate.matchedAxes.length > 0)
    .sort((left, right) => (
      left.displayName.localeCompare(right.displayName, 'ja')
      || left.profileId.localeCompare(right.profileId)
    ));
}

function roundRationalHalfUp(numerator, denominator) {
  const quotient = Math.floor(numerator / denominator);
  const remainder = numerator % denominator;
  return quotient + (remainder * 2 >= denominator ? 1 : 0);
}

function roundLearningIndex(levelNumerator, levelDenominator, distinctCells) {
  const differenceNumerator = Math.min(distinctCells, COMPAT_DIFFERENCE_SATURATION_COUNT);
  if (levelNumerator <= 0 || differenceNumerator === 0) return 0;

  const numerator = levelNumerator * differenceNumerator;
  const denominator = levelDenominator * COMPAT_DIFFERENCE_SATURATION_COUNT;
  for (let rounded = 100; rounded >= 1; rounded -= 1) {
    const doubledMidpoint = (2 * rounded) - 1;
    if (
      40_000 * numerator
      >= denominator * doubledMidpoint * doubledMidpoint
    ) return rounded;
  }
  return 0;
}

export function buildCompatRanking(profiles, selectedProfileIds) {
  const selectedIds = new Set(selectedProfileIds);
  const selectedMeasurements = profiles
    .filter((profile) => selectedIds.has(profile.id))
    .map((profile) => COMPAT_VISUAL_UAAM_AXES.map((axis) => (
      normalizeUaamZoneScore(profile?.uaam?.[axis.key])
    )));
  const referenceAxes = COMPAT_VISUAL_UAAM_AXES.map((_, axisIndex) => {
    const measured = selectedMeasurements
      .map((values) => values[axisIndex])
      .filter((value) => value !== null);
    return {
      sum: measured.reduce((total, value) => total + value, 0),
      count: measured.length,
    };
  });
  const measuredAxisCount = referenceAxes.filter((axis) => axis.count > 0).length;

  if (measuredAxisCount === 0) {
    return {
      eligible: false,
      reason: '選択したメンバーにUAAMの測定データがありません。',
      measuredAxisCount: 0,
      excludedForMissingAxes: 0,
      truncated: 0,
      candidates: [],
    };
  }

  // Each selected axis count is 1..10, so 2520 keeps every per-axis mean exact.
  const referenceScaledTotal = referenceAxes.reduce((total, axis) => (
    axis.count > 0
      ? total + (axis.sum * (TEAM_MEAN_SCALE / axis.count))
      : total
  ), 0);
  const referenceMeanDenominator = TEAM_MEAN_SCALE * measuredAxisCount;
  let excludedForMissingAxes = 0;
  const qualifyingCandidates = [];

  for (const candidate of profiles) {
    if (selectedIds.has(candidate.id)) continue;
    if (!candidate.uaam) {
      excludedForMissingAxes += 1;
      continue;
    }
    const values = COMPAT_VISUAL_UAAM_AXES.map((axis) => (
      normalizeUaamZoneScore(candidate.uaam[axis.key])
    ));
    if (values.some((value) => value === null)) {
      excludedForMissingAxes += 1;
      continue;
    }

    const candidateTotal = values.reduce((total, value, axisIndex) => (
      referenceAxes[axisIndex].count > 0 ? total + value : total
    ), 0);
    const gapNumerator = Math.abs(
      referenceScaledTotal - (candidateTotal * TEAM_MEAN_SCALE),
    );
    const gapDenominator = referenceMeanDenominator;
    const levelNumerator = (4 * gapDenominator) - gapNumerator;
    if (levelNumerator <= 0) continue;

    let distinctCells = 0;
    for (let rowIndex = 0; rowIndex < referenceAxes.length - 1; rowIndex += 1) {
      const row = referenceAxes[rowIndex];
      if (row.count === 0) continue;
      for (let colIndex = rowIndex + 1; colIndex < referenceAxes.length; colIndex += 1) {
        const col = referenceAxes[colIndex];
        if (col.count === 0) continue;
        const relevantMembers = selectedMeasurements.filter((member) => (
          member[rowIndex] !== null || member[colIndex] !== null
        ));
        const allMembersNatural = relevantMembers.length > 0
          && relevantMembers.every((member) => (
            member[rowIndex] === UAAM_ZONE_THRESHOLDS.scoreMax
            && member[colIndex] === UAAM_ZONE_THRESHOLDS.scoreMax
          ));
        const referenceZone = getCompatTeamAverageZone({
          sumA: row.sum,
          countA: row.count,
          sumB: col.sum,
          countB: col.count,
          allMembersNatural,
        });
        const candidateZone = getZone(values[rowIndex], values[colIndex]);
        if (isCompatCarrierZone(referenceZone) !== isCompatCarrierZone(candidateZone)) {
          distinctCells += 1;
        }
      }
    }

    const combinationLearningIndex = roundLearningIndex(
      levelNumerator,
      4 * gapDenominator,
      distinctCells,
    );
    if (combinationLearningIndex === 0) continue;

    qualifyingCandidates.push({
      profileId: candidate.id,
      displayName: candidate.displayName,
      combinationLearningIndex,
      levelGapTenths: roundRationalHalfUp(gapNumerator * 10, gapDenominator),
      distinctCells,
    });
  }

  qualifyingCandidates.sort((left, right) => (
    right.combinationLearningIndex - left.combinationLearningIndex
    || right.distinctCells - left.distinctCells
    || left.levelGapTenths - right.levelGapTenths
    || (left.profileId < right.profileId ? -1 : left.profileId > right.profileId ? 1 : 0)
  ));

  return {
    eligible: true,
    reason: null,
    measuredAxisCount,
    excludedForMissingAxes,
    truncated: Math.max(0, qualifyingCandidates.length - 10),
    candidates: qualifyingCandidates.slice(0, 10),
  };
}

export function buildCompatRecommendation(profiles, selectedProfileIds) {
  const selectedIds = new Set(selectedProfileIds);
  const selectedProfiles = profiles.filter((profile) => selectedIds.has(profile.id));
  const shortages = findCompatShortages(selectedProfiles);
  const candidates = findCompatCandidates(profiles, selectedProfileIds, shortages);
  const summary = shortages.map((shortage) => ({
    ...shortage,
    candidateCount: candidates.filter((candidate) => (
      candidate.matchedAxes.some((axis) => axis.axisKey === shortage.axisKey)
    )).length,
  }));
  return { summary, candidates };
}
