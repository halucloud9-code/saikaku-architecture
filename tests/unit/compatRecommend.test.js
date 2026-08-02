import { describe, expect, it } from 'vitest';
import {
  buildCompatRanking,
  buildCompatRecommendation,
  createCompatRecommendationSnapshot,
  findCompatCandidates,
  findCompatShortages,
} from '../../api/lib/compatRecommend.js';
import { COMPAT_VISUAL_UAAM_AXES } from '../../api/lib/compatEvidence.js';

function profile(id, displayName, uaam = null) {
  return { id, displayName, uaam };
}

function fullUaam(value) {
  return Object.fromEntries(COMPAT_VISUAL_UAAM_AXES.map(({ key }, index) => [
    key,
    typeof value === 'function' ? value(index, key) : value,
  ]));
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

describe('compat candidate ranking', () => {
  it('excludes a candidate whose overall mean gap is exactly 4.0', () => {
    const result = buildCompatRanking([
      profile('selected', '選択中', fullUaam(11)),
      profile('candidate', '候補', fullUaam(15)),
    ], ['selected']);

    expect(result.candidates).toEqual([]);
  });

  it('excludes an identical activation map because its index is zero', () => {
    const result = buildCompatRanking([
      profile('selected', '選択中', fullUaam(11)),
      profile('identical', '同一', fullUaam(11)),
    ], ['selected']);

    expect(result.candidates).toEqual([]);
  });

  it('counts and excludes a candidate missing any of the 16 axes', () => {
    const partial = fullUaam(12);
    delete partial.influence;
    const result = buildCompatRanking([
      profile('selected', '選択中', fullUaam(11)),
      profile('partial', '一部未測定', partial),
    ], ['selected']);

    expect(result.excludedForMissingAxes).toBe(1);
    expect(result.candidates).toEqual([]);
  });

  it('creates an order-independent snapshot that changes with one axis', () => {
    const profiles = [
      profile('selected', '選択中', fullUaam(11)),
      profile('candidate-b', '候補B', fullUaam(12)),
      profile('candidate-a', '候補A', fullUaam(13)),
    ];
    const first = createCompatRecommendationSnapshot(buildCompatRanking(profiles, ['selected']));
    const reordered = createCompatRecommendationSnapshot(
      buildCompatRanking([...profiles].reverse(), ['selected']),
    );
    const changedProfiles = profiles.map((item) => (
      item.id === 'candidate-b'
        ? profile(item.id, item.displayName, { ...item.uaam, meaning: 13 })
        : item
    ));
    const changed = createCompatRecommendationSnapshot(
      buildCompatRanking(changedProfiles, ['selected']),
    );

    expect(reordered).toBe(first);
    expect(changed).not.toBe(first);
  });

  it('breaks equal candidate ties by raw profileId code point order', () => {
    const result = buildCompatRanking([
      profile('selected', '選択中', fullUaam(11)),
      profile('ä', '同名', fullUaam(12)),
      profile('z', '同名', fullUaam(12)),
    ], ['selected']);

    expect(result.candidates.map((candidate) => candidate.profileId)).toEqual(['z', 'ä']);
  });

  it('matches the hand-computed all-11 versus all-12 anchor', () => {
    // Target pairs are all potential (not activated); candidate pairs are all active.
    // D = min(1, (120 / 120) / 0.6) = 1, L = 1 - 1 / 4 = 0.75,
    // so round(100 * sqrt(0.75)) = 87.
    const result = buildCompatRanking([
      profile('selected', '選択中', fullUaam(11)),
      profile('candidate', '候補', fullUaam(12)),
    ], ['selected']);

    expect(result.candidates).toEqual([{
      profileId: 'candidate',
      displayName: '候補',
      combinationLearningIndex: 87,
      levelGapTenths: 10,
      distinctCells: 120,
    }]);
  });

  it('keeps complete 16-axis references eligible with the established indices', () => {
    const result = buildCompatRanking([
      profile('selected', '選択中', fullUaam(11)),
      profile('candidate-12', '候補12', fullUaam(12)),
      profile('candidate-13', '候補13', fullUaam(13)),
    ], ['selected']);

    expect(result.eligible).toBe(true);
    expect(result.measuredAxisCount).toBe(16);
    expect(result.candidates.map((candidate) => ({
      profileId: candidate.profileId,
      combinationLearningIndex: candidate.combinationLearningIndex,
    }))).toEqual([
      { profileId: 'candidate-12', combinationLearningIndex: 87 },
      { profileId: 'candidate-13', combinationLearningIndex: 71 },
    ]);
  });

  it('uses per-axis means rather than maxima for a team reference', () => {
    const result = buildCompatRanking([
      profile('selected-low', '低', fullUaam(8)),
      profile('selected-high', '高', fullUaam(14)),
      profile('candidate', '候補', fullUaam(12)),
    ], ['selected-low', 'selected-high']);

    // The per-axis team mean is 11, so all 120 target cells are non-activated.
    // A per-axis max of 14 would activate all target cells and yield zero differences.
    expect(result.candidates[0].distinctCells).toBe(120);
  });

  /*
  it('uses only the eight measured reference axes for every candidate level gap', () => {
  */
  it('rejects a reference with only eight measured axes', () => {
    const measuredReference = Object.fromEntries(
      COMPAT_VISUAL_UAAM_AXES.slice(0, 8).map(({ key }) => [key, 11]),
    );
    const result = buildCompatRanking([
      profile('selected', '選択中', measuredReference),
      profile('candidate-low-unmeasured', '未測定軸が低い候補', fullUaam((index) => (
        index < 8 ? 12 : 4
      ))),
      profile('candidate-high-unmeasured', '未測定軸が高い候補', fullUaam((index) => (
        index < 8 ? 12 : 20
      ))),
    ], ['selected']);

    /*
    expect(result.measuredAxisCount).toBe(8);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.map((candidate) => candidate.levelGapTenths)).toEqual([10, 10]);
    expect(result.candidates.every((candidate) => (
      Object.values(candidate).every((value) => typeof value !== 'number' || Number.isInteger(value))
    ))).toBe(true);
    */
    expect(result.eligible).toBe(false);
    expect(result.measuredAxisCount).toBe(8);
    expect(result.candidates).toEqual([]);
    expect(result.reason).not.toBeNull();
  });

  it('rejects a reference with exactly one of the 16 axes missing', () => {
    const measuredReference = fullUaam(11);
    delete measuredReference.influence;
    const result = buildCompatRanking([
      profile('selected', '選択中', measuredReference),
      profile('candidate', '候補', fullUaam(12)),
    ], ['selected']);

    expect(result).toEqual({
      eligible: false,
      reason: '選択したメンバーの詳細診断（UAAM）は16項目のうち15項目しかそろっていません。16項目そろうと、学び合いやすい組み合わせを表示できます。',
      measuredAxisCount: 15,
      excludedForMissingAxes: 0,
      truncated: 0,
      candidates: [],
    });
  });

  it('counts a candidate with no UAAM as excluded while still skipping selected profiles', () => {
    const result = buildCompatRanking([
      profile('selected', '選択中', fullUaam(11)),
      profile('selected-without-uaam', '選択中・未測定'),
      profile('candidate-without-uaam', '候補・未測定'),
    ], ['selected', 'selected-without-uaam']);

    expect(result.excludedForMissingAxes).toBe(1);
    expect(result.candidates).toEqual([]);
  });
});
