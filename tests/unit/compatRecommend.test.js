import { describe, expect, it } from 'vitest';
import {
  buildCompatRecommendation,
  createCompatRecommendationSnapshot,
  findCompatCandidates,
  findCompatShortages,
} from '../../api/lib/compatRecommend.js';

function profile(id, displayName, uaam = null) {
  return { id, displayName, uaam };
}

describe('compat recommendation facts', () => {
  it('creates the same deterministic snapshot regardless of profile input order', () => {
    const profiles = [
      profile('selected', '選択中', { meaning: 11 }),
      profile('candidate-b', 'いとう', { meaning: 17 }),
      profile('candidate-a', 'あべ', { meaning: 16 }),
    ];
    const first = createCompatRecommendationSnapshot(
      buildCompatRecommendation(profiles, ['selected']),
    );
    const reordered = createCompatRecommendationSnapshot(
      buildCompatRecommendation([...profiles].reverse(), ['selected']),
    );
    const changed = createCompatRecommendationSnapshot(
      buildCompatRecommendation([
        profiles[0],
        profile('candidate-b', 'いとう', { meaning: 15 }),
        profiles[2],
      ], ['selected']),
    );

    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(reordered).toBe(first);
    expect(changed).not.toBe(first);
  });

  it('keeps tied holders below 12 as missing and treats exactly 12 as present', () => {
    const shortages = findCompatShortages([
      profile('a', 'A', { meaning: 11, mindfulness: 12 }),
      profile('b', 'B', { meaning: 11, mindfulness: 12 }),
    ]);

    expect(shortages).toContainEqual({
      axisKey: 'meaning',
      axisLabel: '基軸力',
      missing: true,
      noData: false,
    });
    expect(shortages.some((axis) => axis.axisKey === 'mindfulness')).toBe(false);
  });

  it('uses the same integer normalization at the 12 and 16 point boundaries', () => {
    const shortages = findCompatShortages([
      profile('selected', '選択中', { meaning: 11.6, logical: 11.4 }),
    ]);

    expect(shortages.some((axis) => axis.axisKey === 'meaning')).toBe(false);
    expect(shortages).toContainEqual({
      axisKey: 'logical',
      axisLabel: '論理力',
      missing: true,
      noData: false,
    });

    const candidates = findCompatCandidates([
      profile('selected', '選択中', { logical: 11.4 }),
      profile('rounds-up', '切り上がる候補', { logical: 15.6 }),
      profile('stays-below', '境界未満', { logical: 15.4 }),
    ], ['selected'], shortages);
    expect(candidates.map((candidate) => candidate.profileId)).toEqual(['rounds-up']);
  });

  it('matches 16 or above while excluding a UAAM-less profile and selected profiles', () => {
    const shortages = [{
      axisKey: 'meaning',
      axisLabel: '基軸力',
      missing: true,
      noData: false,
    }];
    const candidates = findCompatCandidates([
      profile('selected', '選択済み', { meaning: 20 }),
      profile('without-uaam', 'UAAMなし'),
      profile('below', '境界未満', { meaning: 15 }),
      profile('at-boundary', '境界', { meaning: 16 }),
    ], ['selected'], shortages);

    expect(candidates.map((candidate) => candidate.profileId)).toEqual(['at-boundary']);
  });

  it('allows partial axes and returns only the shortage axes actually matched', () => {
    const recommendation = buildCompatRecommendation([
      profile('selected', '選択中', { meaning: 11, logical: 11 }),
      profile('partial', '部分データ', { logical: 17 }),
    ], ['selected']);

    expect(recommendation.candidates).toEqual([{
      profileId: 'partial',
      displayName: '部分データ',
      matchedAxes: [{
        axisKey: 'logical',
        axisLabel: '論理力',
        missing: true,
        noData: false,
      }],
    }]);
  });

  it('marks every axis noData when every selected member lacks UAAM and still matches partial candidates', () => {
    const recommendation = buildCompatRecommendation([
      profile('selected-a', 'A'),
      profile('selected-b', 'B'),
      profile('candidate', '候補', { implementation: 16 }),
    ], ['selected-a', 'selected-b']);

    expect(recommendation.summary).toHaveLength(16);
    expect(recommendation.summary.every((axis) => axis.missing === false && axis.noData === true)).toBe(true);
    expect(recommendation.candidates[0].matchedAxes).toEqual([{
      axisKey: 'implementation',
      axisLabel: '実装力',
      missing: false,
      noData: true,
    }]);
  });
});
