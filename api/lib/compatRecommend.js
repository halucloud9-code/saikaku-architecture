import { createHash } from 'node:crypto';
import { normalizeUaamZoneScore, UAAM_ZONE_THRESHOLDS } from '../../src/lib/uaamZones.js';
import { COMPAT_VISUAL_UAAM_AXES } from './compatEvidence.js';

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
