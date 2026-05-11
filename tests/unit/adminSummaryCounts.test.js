import { describe, it, expect } from 'vitest';
import { jstDayBoundary, weekBoundary } from '../../src/utils/adminSummaryCounts.js';

describe('adminSummaryCounts utility', () => {
  describe('jstDayBoundary', () => {
    it('UTC 01:00 (JST 10:00 same day) returns JST today 0:00 (UTC previous day 15:00)', () => {
      expect(jstDayBoundary(new Date('2026-05-12T01:00:00Z')).toISOString())
        .toBe('2026-05-11T15:00:00.000Z');
    });

    it('UTC 14:59 (JST 23:59 same day) still returns same JST day 0:00', () => {
      expect(jstDayBoundary(new Date('2026-05-12T14:59:59Z')).toISOString())
        .toBe('2026-05-11T15:00:00.000Z');
    });

    it('UTC 15:00 (JST next day 00:00) returns next JST day 0:00', () => {
      expect(jstDayBoundary(new Date('2026-05-12T15:00:00Z')).toISOString())
        .toBe('2026-05-12T15:00:00.000Z');
    });
  });

  describe('weekBoundary', () => {
    it('subtracts 7 days by default', () => {
      expect(weekBoundary(new Date('2026-05-12T00:00:00Z')).toISOString())
        .toBe('2026-05-05T00:00:00.000Z');
    });

    it('respects custom days arg', () => {
      expect(weekBoundary(new Date('2026-05-12T00:00:00Z'), 3).toISOString())
        .toBe('2026-05-09T00:00:00.000Z');
    });
  });
});
