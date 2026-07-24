import { describe, expect, it } from 'vitest';
import {
  buildCompatEvidence,
  buildCompatUaamMatrix,
  buildCompatVisual,
  COMPAT_VISUAL_UAAM_AXES,
} from '../../api/lib/compatEvidence.js';
import { normalizeInternalProfile, normalizePublicProfile, splitUserTop5 } from '../../api/lib/compatProfiles.js';

function internal(id, top5, axisName = '構造化', uaamData = null) {
  return normalizeInternalProfile(id, {
    uid: id,
    name: `member-${id}`,
    inputTalentTop5: top5,
    inputValueTop5: '誠実',
    inputPassionTop5: '教育',
    result: {
      talent: { axis1: { name: axisName, top5: ['生成語'], items: ['整理'] } },
      value: { axis1: { name: '誠実さ', top5: [], items: [] } },
      passion: { axis1: { name: '学び', top5: [], items: [] } },
    },
  }, uaamData);
}

function uaamScores(value) {
  return {
    scores: {
      mindset: { subs: { meaning: value, mindfulness: value, mindshift: value, mastery: value } },
      literacy: { subs: { learning: value, logical: value, life: value, leadership: value } },
      competency: { subs: { critical: value, creativity: value, communication: value, collaboration: value } },
      impact: { subs: { idea: value, innovation: value, implementation: value, influence: value } },
    },
  };
}

function publicProfile(axisName = '構造化') {
  const axis = (name) => ({ name, english: '', description: 'generated', items: [], percentage: 50 });
  return normalizePublicProfile({
    schemaVersion: 1,
    profileVersion: 'v1',
    profile: {
      sessionId: '11111111-1111-4111-8111-111111111111',
      locale: 'ja',
      complete: true,
      axes: { values: [axis('誠実さ')], talent: [axis(axisName)], passion: [axis('学び')] },
    },
  });
}

describe('compat evidence layer', () => {
  it('splits only the document-root user Top5 string and NFKC-normalizes it', () => {
    expect(splitUserTop5('ＡＢＣ\n観察\r\n観察')).toEqual(['ABC', '観察']);
    const profile = internal('a', '観察');
    expect(profile.categories.talent.user_top5).toEqual(['観察']);
    expect(profile.categories.talent.generated_axis[0].tokens).toContain('生成語');
    expect(profile.categories.talent.user_top5).not.toContain('生成語');
  });

  it('matches exact NFKC terms but never fuzzy substrings', () => {
    const exact = buildCompatEvidence([internal('a', 'ＡＢＣ'), internal('b', 'ABC')], [], 'pair');
    expect(exact.ledger.some((item) => item.kind === 'exact_nfkc_match' && item.details.matches.includes('ABC'))).toBe(true);

    const fuzzy = buildCompatEvidence([internal('a', '観察'), internal('b', '観察力')], [], 'pair');
    expect(fuzzy.ledger.some((item) => item.kind === 'exact_nfkc_match' && item.details.sourceKind === 'user_top5' && item.details.category === 'talent')).toBe(false);
  });

  it('uses only evidence kinds available to both sides for a mixed pair', () => {
    const evidence = buildCompatEvidence([internal('a', '内部だけの語'), publicProfile()], [], 'pair');
    const matches = evidence.ledger.filter((item) => item.kind === 'exact_nfkc_match');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((item) => item.details.sourceKind === 'generated_axis')).toBe(true);
    expect(evidence.dataSufficiency.limitations.join(' ')).toContain('公開アプリから追加したメンバーについては');
  });

  it('uses the public-compatible surface for every pair in a mixed team', () => {
    const evidence = buildCompatEvidence([
      internal('a', '内部共通語'),
      internal('b', '内部共通語'),
      publicProfile(),
    ], [], 'team');
    expect(evidence.ledger.some((item) => item.kind === 'exact_nfkc_match' && item.details.sourceKind === 'user_top5')).toBe(false);
  });

  it('treats thin UAAM coverage as a first-class insufficient result', () => {
    const cohort = Array.from({ length: 30 }, (_unused, index) => uaamScores((index % 20) + 1));
    const evidence = buildCompatEvidence([
      internal('a', '観察', '構造化', uaamScores(5)),
      internal('b', '対話'),
    ], cohort, 'pair');
    expect(evidence.dataSufficiency.uaam.eligible).toBe(false);
    expect(evidence.dataSufficiency.limitations.join(' ')).toContain('パーセンタイル比較は、今回はデータが不足');
    expect(evidence.dataSufficiency.limitations.join(' ')).toContain('16×16の力の地図とは別');

    const visual = buildCompatVisual({
      profiles: evidence.profiles,
      ledger: evidence.ledger,
      uaamDocs: cohort,
      uaamEligible: evidence.dataSufficiency.uaam.eligible,
    });
    expect(visual.uaam.eligible).toBe(false);
    expect(visual.uaam.axes.every((axis) => axis.signal === 'insufficient' && axis.points.length === 0)).toBe(true);
  });

  it('never includes raw exact-match terms in the prompt projection', () => {
    const secret = 'RAW-TOP5-SECRET';
    const evidence = buildCompatEvidence([internal('a', secret), internal('b', secret)], [], 'pair');
    expect(JSON.stringify(evidence.ledger)).toContain(secret);
    expect(JSON.stringify(evidence.promptEvidence)).not.toContain(secret);
  });

  it('builds a deterministic v2 visual block with matched terms and all 16 UAAM axes', () => {
    const secret = '表示専用の共通語';
    const cohort = Array.from({ length: 30 }, (_unused, index) => uaamScores((index % 20) + 1));
    const evidence = buildCompatEvidence([
      internal('a', secret, '構造化', uaamScores(5)),
      internal('b', secret, '対話', uaamScores(15)),
    ], cohort, 'pair');
    const visual = buildCompatVisual({
      profiles: evidence.profiles,
      ledger: evidence.ledger,
      uaamDocs: cohort,
      uaamEligible: evidence.dataSufficiency.uaam.eligible,
    });

    expect(visual.schemaVersion).toBe(2);
    expect(visual.members.map((member) => member.alias)).toEqual(['M1', 'M2']);
    expect(visual.matches.some((match) => match.terms.includes(secret))).toBe(true);
    expect(visual.uaam.axes.map((axis) => axis.key)).toEqual(COMPAT_VISUAL_UAAM_AXES.map((axis) => axis.key));
    expect(visual.uaam.axes).toHaveLength(16);
    expect(JSON.stringify(evidence.promptEvidence)).not.toContain(secret);
  });

  it('uses the canonical Japanese UAAM axis labels in every prompt evidence string', () => {
    const cohort = Array.from({ length: 30 }, (_unused, index) => uaamScores(index < 15 ? 1 : 20));
    const evidence = buildCompatEvidence([
      internal('a', '観察', '構造化', uaamScores(1)),
      internal('b', '対話', '発想', uaamScores(20)),
    ], cohort, 'pair');
    const uaamPromptEvidence = evidence.promptEvidence.filter((item) => item.kind.startsWith('uaam_percentile_'));
    const promptText = uaamPromptEvidence.map((item) => item.text).join('\n');

    expect(uaamPromptEvidence).toHaveLength(COMPAT_VISUAL_UAAM_AXES.length);
    for (const { key, label } of COMPAT_VISUAL_UAAM_AXES) {
      expect(promptText).toContain(`UAAM「${label}」`);
      expect(promptText).not.toMatch(new RegExp(`\\b${key}\\b`));
    }
    expect(evidence.ledger.every((item) => (
      !item.kind.startsWith('uaam_percentile_')
      || COMPAT_VISUAL_UAAM_AXES.some(({ key }) => item.details.sub === key)
    ))).toBe(true);
  });

  it('projects integer UAAM member scores by alias without changing the visual contract', () => {
    const evidence = buildCompatEvidence([
      internal('a', '観察', '構造化', {
        scores: {
          mindset: { subs: { meaning: 11.6 } },
          literacy: { subs: { logical: 19, rogue: 20 } },
        },
      }),
      internal('b', '対話'),
    ], [], 'pair');

    expect(buildCompatUaamMatrix(evidence.profiles)).toEqual({
      memberScores: {
        M1: { meaning: 12, logical: 19 },
      },
    });
  });

  it('caps same-category visual matches at 100 unique terms and truncates each term to 80 characters', () => {
    const longStem = '長'.repeat(80);
    const sharedTerms = [
      `${longStem}A`,
      `${longStem}B`,
      ...Array.from({ length: 100 }, (_unused, index) => `共通語${String(index).padStart(3, '0')}`),
    ];
    const profiles = [internal('a', '観察'), internal('b', '対話')].map((profile) => ({
      ...profile,
      categories: {
        ...profile.categories,
        talent: { ...profile.categories.talent, user_top5: sharedTerms },
      },
    }));
    const evidence = buildCompatEvidence(profiles, [], 'pair');
    const visual = buildCompatVisual({
      profiles: evidence.profiles,
      ledger: evidence.ledger,
      uaamDocs: [],
      uaamEligible: false,
    });
    const talentMatch = visual.matches.find((match) => (
      match.category === 'talent' && match.sourceKind === 'user_top5'
    ));

    expect(talentMatch.terms).toHaveLength(100);
    expect(talentMatch.terms[0]).toBe(longStem);
    expect(talentMatch.terms.every((term) => term.length <= 80)).toBe(true);
    expect(new Set(talentMatch.terms).size).toBe(100);
  });
});
