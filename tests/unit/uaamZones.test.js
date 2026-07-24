import { describe, expect, it } from 'vitest';
import {
  getZone,
  normalizeUaamZoneScore,
  UAAM_ZONE_THRESHOLDS,
  zAlpha,
} from '../../src/lib/uaamZones.js';

function legacyGetZone(sA, sB) {
  const sum = sA + sB;
  if (sA === 20 && sB === 20) return 'natural';
  if ((sA >= 16 && sB >= 16) || (sA >= 15 && sB >= 15 && sum >= 32)) return 'pro';
  if (sA >= 12 && sB >= 12 && sum <= 31) return 'active';
  if (sA >= 10 && sB >= 10 && sum >= 22 && !(sA >= 12 && sB >= 12)) return 'potential';
  return 'dormant';
}

function legacyZAlpha(zone, sA, sB) {
  if (zone === 'natural') return 1;
  const sum = sA + sB;
  const linear = (value, min, max) => Math.max(0, Math.min(1, (value - min) / (max - min)));
  if (zone === 'pro') return 0.18 + linear(sum, 32, 40) * 0.82;
  if (zone === 'active') return 0.10 + linear(sum, 24, 31) * 0.78;
  if (zone === 'potential') return 0.05 + linear(sum, 22, 30) * 0.50;
  return 0.06;
}

describe('UAAM zone extraction', () => {
  it('normalizes absolute-threshold inputs to bounded 0-20 integers', () => {
    expect(normalizeUaamZoneScore(11.6)).toBe(12);
    expect(normalizeUaamZoneScore(11.4)).toBe(11);
    expect(normalizeUaamZoneScore(15.6)).toBe(16);
    expect(normalizeUaamZoneScore(-0.1)).toBeNull();
    expect(normalizeUaamZoneScore(20.1)).toBeNull();
    expect(normalizeUaamZoneScore('12')).toBeNull();
  });

  it('keeps the existing zone and opacity behavior over the full 21 x 21 score domain', () => {
    for (let scoreA = 0; scoreA <= 20; scoreA += 1) {
      for (let scoreB = 0; scoreB <= 20; scoreB += 1) {
        const expectedZone = legacyGetZone(scoreA, scoreB);
        expect(getZone(scoreA, scoreB), `${scoreA} x ${scoreB}`).toBe(expectedZone);
        expect(zAlpha(expectedZone, scoreA, scoreB), `${scoreA} x ${scoreB}`).toBe(
          legacyZAlpha(expectedZone, scoreA, scoreB),
        );
      }
    }
  });

  it('exports the unchanged thresholds as the shared contract', () => {
    expect(UAAM_ZONE_THRESHOLDS).toEqual({
      scoreMax: 20,
      proAxisMin: 16,
      proFallbackAxisMin: 15,
      proSumMin: 32,
      activeAxisMin: 12,
      activeSumMax: 31,
      potentialAxisMin: 10,
      potentialSumMin: 22,
    });
  });
});
