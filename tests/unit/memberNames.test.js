import { describe, expect, it } from 'vitest';
import { memberNameForAlias, replaceMemberAliases } from '../../src/compat/memberNames.js';

const members = ['M1', 'M2', 'M10'].map((alias) => ({ alias }));
const labels = ['つかさ', '野田健一', '十人目'];

describe('compat member name display', () => {
  it('replaces only complete M tokens across evidence punctuation and parallel forms', () => {
    expect(replaceMemberAliases('（M1:72, M2:41）', members, labels))
      .toBe('（つかさ:72, 野田健一:41）');
    expect(replaceMemberAliases('M1 の talent に生成済み軸がある: 構造化', members, labels))
      .toBe('つかさ の talent に生成済み軸がある: 構造化');
    expect(replaceMemberAliases('M1とM2の才能に共通点がある', members, labels))
      .toBe('つかさと野田健一の才能に共通点がある');
  });

  it('distinguishes M1 from M10 and handles line boundaries', () => {
    expect(replaceMemberAliases('M1 / M10\nM2', members, labels))
      .toBe('つかさ / 十人目\n野田健一');
    expect(replaceMemberAliases('M10', members, labels)).toBe('十人目');
  });

  it('does not replace alphanumeric substrings or legacy A/B aliases', () => {
    expect(replaceMemberAliases('xM1y M10x xM2 AとB', members, labels))
      .toBe('xM1y M10x xM2 AとB');
    expect(memberNameForAlias('A', ['A', 'B'], ['旧A氏', '旧B氏'])).toBe('A');
    expect(memberNameForAlias('B', ['A', 'B'], ['旧A氏', '旧B氏'])).toBe('B');
  });
});
