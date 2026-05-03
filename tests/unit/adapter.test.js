import { describe, expect, it } from 'vitest';
import { attemptToResultProps } from '../../src/utils/attemptAdapter';

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
        name: '山田太郎',
        bias_message: { level: 'moderate' },
        personality_level: { level: 4 },
        leadership_stage: { stage: 3 },
        three_elements: { development_phase: 'strength_focus' },
        coach_confirmed_personality_level: { level: 5 },
        coach_confirmed_leadership_stage: { stage: 4 },
        coach_observation_note: '観察メモ',
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
        name: '山田太郎',
        bias_message: { level: 'moderate' },
        personality_level: { level: 4 },
        leadership_stage: { stage: 3 },
        three_elements: { development_phase: 'strength_focus' },
        coach_confirmed_personality_level: { level: 5 },
        coach_confirmed_leadership_stage: { stage: 4 },
        coach_observation_note: '観察メモ',
      },
    });
  });
});
