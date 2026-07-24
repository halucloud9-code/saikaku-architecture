import { describe, expect, it } from 'vitest';
import {
  isCompatShareActive,
  isCompatShareId,
  validateCompatShareIssueInput,
  validateCompatShareReport,
} from '../../api/lib/compatShare.js';
import { COMPAT_VISUAL_UAAM_AXES } from '../../api/lib/compatEvidence.js';

const ethicsNotice = '本結果は相互理解のための対話素材です。人事評価・採用評価には流用しません。';

function availability(alias) {
  return {
    alias,
    source: 'internal',
    categories: {
      talent: { userTop5: true, generatedAxes: true },
      value: { userTop5: true, generatedAxes: true },
      passion: { userTop5: true, generatedAxes: true },
    },
    uaam: true,
  };
}

function v1Report() {
  return {
    dataSufficiency: {
      summary: '範囲',
      memberAvailability: [availability('A'), availability('B')],
      limitations: [],
      uaam: { eligible: true, availableProfiles: 2, requiredProfiles: 2, minimumCohort: 30 },
    },
    lenses: [
      { id: 'similarity', status: 'not_detected', summary: 'この診断データでは不検出です。', claims: [] },
      { id: 'complementarity', status: 'not_detected', summary: 'この診断データでは不検出です。', claims: [] },
    ],
    evidence: [],
    ethicsNotice,
    model: 'claude-sonnet-4-6',
  };
}

function v2Report() {
  const legacy = v1Report();
  return {
    ...legacy,
    dataSufficiency: {
      ...legacy.dataSufficiency,
      memberAvailability: [availability('M1'), availability('M2')],
    },
    unmetFunctionCandidate: null,
    visual: {
      schemaVersion: 2,
      members: [
        { alias: 'M1', axes: { talent: ['構造化'], value: ['誠実'], passion: ['教育'] } },
        { alias: 'M2', axes: { talent: ['対話'], value: ['誠実'], passion: ['学び'] } },
      ],
      matches: [{ aliases: ['M1', 'M2'], category: 'value', sourceKind: 'user_top5', terms: ['誠実'] }],
      uaam: {
        eligible: true,
        axes: COMPAT_VISUAL_UAAM_AXES.map(({ key, label }) => ({
          key,
          label,
          cohortSize: 51,
          signal: 'complementarity',
          points: [{ alias: 'M1', percentile: 10 }, { alias: 'M2', percentile: 60 }],
        })),
      },
    },
  };
}

describe('compat share expiry', () => {
  const now = 1_800_000_000_000;
  const active = (expiresAt, overrides = {}) => ({
    consentConfirmed: true,
    revoked: false,
    expiresAt: { toMillis: () => expiresAt },
    ...overrides,
  });

  it('accepts only UUID v4 share IDs', () => {
    expect(isCompatShareId('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(isCompatShareId('11111111-1111-1111-8111-111111111111')).toBe(false);
    expect(isCompatShareId('not-a-uuid')).toBe(false);
  });

  it('is active only before the deadline with consent and no revocation', () => {
    expect(isCompatShareActive(active(now + 1), now)).toBe(true);
    expect(isCompatShareActive(active(now), now)).toBe(false);
    expect(isCompatShareActive(active(now - 1), now)).toBe(false);
    expect(isCompatShareActive(active(now + 1, { revoked: true }), now)).toBe(false);
    expect(isCompatShareActive(active(now + 1, { consentConfirmed: false }), now)).toBe(false);
  });

  it('rejects malformed evidence without throwing', () => {
    const validation = validateCompatShareReport({
      dataSufficiency: {
        summary: '範囲',
        memberAvailability: [],
        limitations: [],
        uaam: {},
      },
      lenses: [],
      evidence: [null],
      ethicsNotice,
      model: 'claude-sonnet-4-6',
    });
    expect(validation.ok).toBe(false);
    expect(validation.errors).toEqual(expect.arrayContaining([expect.stringContaining('report.evidence[0]')]));
  });

  it('accepts stored v1 reports and deterministic v2 visual reports', () => {
    expect(validateCompatShareReport(v1Report(), { goalProvided: false }).ok).toBe(true);
    expect(validateCompatShareReport(v2Report(), { goalProvided: false }).ok).toBe(true);
  });

  it('issues new pair shares only with M aliases while retaining A/B read compatibility', () => {
    const input = {
      report: v2Report(),
      mode: 'pair',
      goal: '',
      memberLabels: ['つかさ', '野田健一'],
      consentConfirmed: true,
    };
    expect(validateCompatShareIssueInput(input).ok).toBe(true);

    const legacy = v1Report();
    expect(validateCompatShareReport(legacy, { goalProvided: false }).ok).toBe(true);
    expect(legacy.dataSufficiency.memberAvailability.map((member) => member.alias)).toEqual(['A', 'B']);

    const legacyV2 = v2Report();
    const legacyAlias = (alias) => ({ M1: 'A', M2: 'B' })[alias] || alias;
    legacyV2.dataSufficiency.memberAvailability.forEach((member) => {
      member.alias = legacyAlias(member.alias);
    });
    legacyV2.visual.members.forEach((member) => {
      member.alias = legacyAlias(member.alias);
    });
    legacyV2.visual.matches.forEach((match) => {
      match.aliases = match.aliases.map(legacyAlias);
    });
    legacyV2.visual.uaam.axes.forEach((axis) => {
      axis.points.forEach((point) => {
        point.alias = legacyAlias(point.alias);
      });
    });
    expect(validateCompatShareReport(legacyV2, { goalProvided: false }).ok).toBe(true);
    expect(validateCompatShareIssueInput({ ...input, report: legacyV2 }).ok).toBe(false);
  });

  it('rejects a v2 visual block whose axis order or signal does not match its points', () => {
    const wrongAxis = v2Report();
    wrongAxis.visual.uaam.axes[0].label = '改ざん';
    expect(validateCompatShareReport(wrongAxis, { goalProvided: false }).errors.join(' ')).toContain('軸名または順序');

    const wrongSignal = v2Report();
    wrongSignal.visual.uaam.axes[0].signal = 'similarity';
    expect(validateCompatShareReport(wrongSignal, { goalProvided: false }).errors.join(' ')).toContain('決定論的判定');
  });
});
