import { describe, expect, it } from 'vitest';
import {
  compareCompatTeamAverageStrength,
  getCompatTeamAverageScores,
  getCompatTeamAverageZone,
} from '../../src/lib/compatTeamZones.js';
import { getZone } from '../../src/lib/uaamZones.js';

describe('compat team average zones', () => {
  it('uses integer cross multiplication immediately below and at the 16-point boundary', () => {
    expect(getCompatTeamAverageZone({
      sumA: 15_999,
      countA: 1_000,
      sumB: 15_999,
      countB: 1_000,
    })).toBe('dormant');
    expect(getCompatTeamAverageZone({
      sumA: 16_000,
      countA: 1_000,
      sumB: 16_000,
      countB: 1_000,
    })).toBe('pro');
  });

  it('requires measured axes and every relevant member at 20 on both axes for NATURAL', () => {
    const perfectAverages = {
      sumA: 40,
      countA: 2,
      sumB: 20,
      countB: 1,
    };
    expect(getCompatTeamAverageZone({
      ...perfectAverages,
      allMembersNatural: true,
    })).toBe('pro');
    expect(getCompatTeamAverageZone({
      sumA: 40,
      countA: 2,
      sumB: 40,
      countB: 2,
      allMembersNatural: true,
    })).toBe('natural');
    expect(getCompatTeamAverageZone({
      sumA: 0,
      countA: 0,
      sumB: 20,
      countB: 1,
      allMembersNatural: true,
    })).toBeNull();
  });

  it('uses independent per-axis counts and exposes floats only to local presentation logic', () => {
    const aggregate = {
      sumA: 32,
      countA: 2,
      sumB: 16,
      countB: 1,
    };
    expect(getCompatTeamAverageZone(aggregate)).toBe('pro');
    expect(getCompatTeamAverageScores(aggregate)).toEqual({ scoreA: 16, scoreB: 16 });
  });

  it('is identical to personal getZone for a one-person team', () => {
    for (let scoreA = 0; scoreA <= 20; scoreA += 1) {
      for (let scoreB = 0; scoreB <= 20; scoreB += 1) {
        expect(getCompatTeamAverageZone({
          sumA: scoreA,
          countA: 1,
          sumB: scoreB,
          countB: 1,
          allMembersNatural: scoreA === 20 && scoreB === 20,
        }), `${scoreA} × ${scoreB}`).toBe(getZone(scoreA, scoreB));
      }
    }
  });

  it('orders pair strength by exact average sums across different counts', () => {
    const stronger = { sumA: 33, countA: 2, sumB: 17, countB: 1 };
    const weaker = { sumA: 16, countA: 1, sumB: 16, countB: 1 };
    expect(compareCompatTeamAverageStrength(stronger, weaker)).toBeGreaterThan(0);
    expect(compareCompatTeamAverageStrength(weaker, stronger)).toBeLessThan(0);
  });
});
