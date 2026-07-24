import { UAAM_ZONE_THRESHOLDS } from '../../src/lib/uaamZones.js';
import { COMPAT_VISUAL_UAAM_AXES } from './compatEvidence.js';

function validAxisValue(value) {
  return Number.isFinite(value) && value >= 0 && value <= 20;
}

export function findCompatShortages(selectedProfiles) {
  return COMPAT_VISUAL_UAAM_AXES.flatMap((axis) => {
    const measured = selectedProfiles
      .map((profile) => profile?.uaam?.[axis.key])
      .filter(validAxisValue);
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
        validAxisValue(profile.uaam[shortage.axisKey])
        && profile.uaam[shortage.axisKey] >= UAAM_ZONE_THRESHOLDS.proAxisMin
      )),
    }))
    .filter((candidate) => candidate.matchedAxes.length > 0)
    .sort((left, right) => (
      left.displayName.localeCompare(right.displayName, 'ja')
      || left.profileId.localeCompare(right.profileId)
    ));
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
