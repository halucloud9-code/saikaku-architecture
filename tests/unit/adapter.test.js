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
    // Consumer contracts (確認済み):
    //   personality_level: object { level, name, confidence, signals } — UAAMResultScreen が ?.level/.name 参照
    //   coach_confirmed_personality_level: string scalar 'L5' — ActivationPanel:468-470 で .replace('L', '')
    //   leadership_stage: object { stage, name } — UAAMResultScreen:1534 で ?.stage 参照
    //   coach_confirmed_leadership_stage: number scalar 4 — ActivationPanel:480-482 で `第${...}`/(... - 1)
    const attempt = {
      full: {
        scores: { mindset: { total: 60 } },
        analysis: { type_name: '実装する案内人' },
        name: '山田太郎',
        bias_message: { level: 'moderate' },
        personality_level: { level: 'L4', name: '自律型', confidence: 'medium' },
        leadership_stage: { stage: 3, name: '自律' },
        three_elements: { development_phase: 'strength_focus' },
        coach_confirmed_personality_level: 'L5',
        coach_confirmed_leadership_stage: 4,
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
        personality_level: { level: 'L4', name: '自律型', confidence: 'medium' },
        leadership_stage: { stage: 3, name: '自律' },
        three_elements: { development_phase: 'strength_focus' },
        coach_confirmed_personality_level: 'L5',
        coach_confirmed_leadership_stage: 4,
        coach_observation_note: '観察メモ',
        recentIntegrationSummaries: null,
      },
    });
  });

  it('preserves null bias_message as the saved "healthy" signal (UAAM)', () => {
    // bias_message: null は「自己評価バイアスなし＝健全」を意味する保存値で、
    // UI 側で fallback 計算に流してはいけない。
    const attempt = {
      full: { scores: {}, analysis: null, bias_message: null },
      raw: { input: {} },
    };
    const out = attemptToResultProps(attempt, 'uaam');
    expect(out.result.bias_message).toBeNull();
  });

  it('leaves bias_message undefined when not stored (UAAM legacy)', () => {
    // 古い committedAttempt は bias_message を保存していない (key 自体が無い)。
    // adapter が ?? null で潰すと UI 側で「未保存」と「健全」の区別がつかなくなる。
    const attempt = {
      full: { scores: {}, analysis: null }, // bias_message 不在
      raw: { input: {} },
    };
    const out = attemptToResultProps(attempt, 'uaam');
    expect(out.result.bias_message).toBeUndefined();
  });

  it('normalizes string leadership_stage but keeps coach scalar fields raw (UAAM)', () => {
    // leadership_stage: object { stage, name } を期待する UAAMResultScreen.jsx:1534 のため、
    // 文字列形式 '第3段階' は normalize する。
    // 一方 coach_confirmed_leadership_stage は ActivationPanel:480-482 が `第${...}` と算術で
    // scalar を期待するため正規化しない。
    const attempt = {
      full: {
        scores: {},
        analysis: null,
        leadership_stage: '第3段階',
        coach_confirmed_leadership_stage: 4,
        coach_confirmed_personality_level: 'L5',
      },
      raw: { input: {} },
    };
    const out = attemptToResultProps(attempt, 'uaam');
    expect(out.result.leadership_stage).toEqual({ stage: 3, name: '第3段階' });
    expect(out.result.coach_confirmed_leadership_stage).toBe(4);
    expect(out.result.coach_confirmed_personality_level).toBe('L5');
  });

  it.each([
    [undefined, null],
    [[], []],
    [[{ activationCore: 'Recent Core' }], [{ activationCore: 'Recent Core' }]],
  ])('bridges UAAM recentIntegrationSummaries %s without collapsing the shape', (input, expected) => {
    const attempt = {
      full: { scores: {}, analysis: null },
      raw: { input: {} },
    };
    if (input !== undefined) {
      attempt.recentIntegrationSummaries = input;
    }

    const out = attemptToResultProps(attempt, 'uaam');

    expect(out.result.recentIntegrationSummaries).toEqual(expected);
    if (Array.isArray(input)) {
      expect(out.result.recentIntegrationSummaries).toBe(input);
    }
  });
});
