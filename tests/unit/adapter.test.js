import { describe, expect, it } from 'vitest';
import { attemptToResultProps, legacyDocToAttempt } from '../../src/utils/attemptAdapter';

describe('attemptAdapter', () => {
  it('returns null when attempt is null', () => {
    expect(attemptToResultProps(null, 'saikaku')).toBeNull();
  });

  it('maps a saikaku attempt to ResultScreen props', () => {
    const attempt = {
      full: {
        result: {
          kakuchiiki: '問いに火を灯す人',
          kakuchiiki_options: ['問いに火を灯す人'],
        },
        selectedKakuchiiki: '本音を形にする案内人',
      },
    };

    expect(attemptToResultProps(attempt, 'saikaku')).toEqual({
      result: {
        kakuchiiki: '問いに火を灯す人',
        kakuchiiki_options: ['問いに火を灯す人'],
        selectedKakuchiiki: '本音を形にする案内人',
      },
    });
  });

  it('maps a uaam attempt to UAAMResultScreen props', () => {
    const attempt = {
      full: {
        scores: { mindset: { total: 60 } },
        analysis: { type_name: '実装する案内人' },
      },
      raw: {
        input: {
          answers: { 1: 3 },
          vAnswers: { V1: 4 },
        },
      },
    };

    expect(attemptToResultProps(attempt, 'uaam')).toEqual({
      result: {
        scores: { mindset: { total: 60 } },
        analysis: { type_name: '実装する案内人' },
        answers: { 1: 3 },
        vAnswers: { V1: 4 },
      },
    });
  });

  it('creates a synthetic legacy saikaku attempt from a parent doc', () => {
    const attempt = legacyDocToAttempt({
      result: { kakuchiiki: '問いに火を灯す人' },
      selectedKakuchiiki: '問いに火を灯す人',
      createdAt: '2026-05-01',
    }, 'saikaku');

    expect(attempt).toMatchObject({
      id: 'legacy-fallback',
      isLegacy: true,
      status: 'committed',
      summary: { kakuchiiki: '問いに火を灯す人' },
      full: {
        result: { kakuchiiki: '問いに火を灯す人' },
        selectedKakuchiiki: '問いに火を灯す人',
      },
    });
  });

  it('returns null for empty legacy saikaku parents', () => {
    expect(legacyDocToAttempt({}, 'saikaku')).toBeNull();
  });
});
