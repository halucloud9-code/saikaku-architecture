import { describe, expect, it } from 'vitest';
import {
  buildCompatRecommendation,
  findCompatCandidates,
  findCompatShortages,
} from '../../api/lib/compatRecommend.js';

function profile(id, displayName, uaam = null) {
  return { id, displayName, uaam };
}

describe('compat recommendation facts', () => {
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
