import { describe, expect, it } from 'vitest';
import { buildCompatEvidence } from '../../api/lib/compatEvidence.js';
import { normalizeInternalProfile, normalizePublicProfile, splitUserTop5 } from '../../api/lib/compatProfiles.js';

function internal(id, top5, axisName = '構造化') {
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
  });
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
    expect(evidence.dataSufficiency.limitations.join(' ')).toContain('公開アプリから追加したメンバーは');
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
    const evidence = buildCompatEvidence([internal('a', '観察'), internal('b', '対話')], [], 'pair');
    expect(evidence.dataSufficiency.uaam.eligible).toBe(false);
    expect(evidence.dataSufficiency.limitations.join(' ')).toContain('くわしい診断（UAAM）の数字での比較は');
  });

  it('never includes raw exact-match terms in the prompt projection', () => {
    const secret = 'RAW-TOP5-SECRET';
    const evidence = buildCompatEvidence([internal('a', secret), internal('b', secret)], [], 'pair');
    expect(JSON.stringify(evidence.ledger)).toContain(secret);
    expect(JSON.stringify(evidence.promptEvidence)).not.toContain(secret);
  });
});
