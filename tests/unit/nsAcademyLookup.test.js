import { describe, expect, it } from 'vitest';
import {
  buildNsAcademyLookupResponse,
  shapeResultsDocument,
  shapeUaamResultsDocument,
} from '../../api/lib/nsAcademyLookup.js';

function timestamp(iso) {
  return { toDate: () => new Date(iso) };
}

describe('ns-academy lookup allowlist', () => {
  it('shapes results field by field and excludes sensitive fields', () => {
    const shaped = shapeResultsDocument({
      uid: 'saikaku-user',
      createdAt: timestamp('2026-01-01T00:00:00.000Z'),
      updatedAt: timestamp('2026-01-02T00:00:00.000Z'),
      inputTalentTop5: '観察',
      inputPassionTop5: '教育',
      inputValueTop5: '誠実',
      selectedKakuchiiki: '本質を見抜く人',
      email: 'secret@example.com',
      name: 'Secret Name',
      photoURL: 'https://example.com/secret.png',
      inputQ1: 'secret q1',
      inputQ2: 'secret q2',
      inputQ3: 'secret q3',
      inputTalent: 'secret free text',
      inputTalentOther: 'secret other',
      result: {
        kakuchiiki: '本質を見抜く人',
        core_words: { talent_core: '観察' },
        insight: 'secret insight',
        what: { offer: 'secret offer' },
        reward: { economic: 'secret reward' },
        talent: { axis1: 'secret' },
        passion: { axis1: 'secret' },
        value: { axis1: 'secret' },
        name: 'Secret Name',
      },
    });

    expect(shaped).toEqual({
      uid: 'saikaku-user',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      inputTalentTop5: '観察',
      inputPassionTop5: '教育',
      inputValueTop5: '誠実',
      selectedKakuchiiki: '本質を見抜く人',
      result: {
        kakuchiiki: '本質を見抜く人',
        core_words: { talent_core: '観察' },
      },
    });
  });

  it('shapes UAAM field by field and excludes raw answers and diagnosis extras', () => {
    const shaped = shapeUaamResultsDocument({
      uid: 'uaam-user',
      createdAt: timestamp('2026-01-03T00:00:00.000Z'),
      updatedAt: timestamp('2026-01-04T00:00:00.000Z'),
      scores: { will: 80 },
      analysis: { type_name: '実証家' },
      leadership_stage: { stage: 4, name: '自律' },
      personality_level: { level: 'L4' },
      email: 'secret@example.com',
      name: 'Secret Name',
      answers: { 1: 5 },
      vAnswers: { V1: 5 },
      coaching_answers: { private: true },
      bias_message: { message: 'secret' },
      three_elements: { private: true },
    });

    expect(shaped).toEqual({
      uid: 'uaam-user',
      createdAt: '2026-01-03T00:00:00.000Z',
      updatedAt: '2026-01-04T00:00:00.000Z',
      scores: { will: 80 },
      analysis: { type_name: '実証家' },
      leadership_stage: { stage: 4, name: '自律' },
      personality_level: { level: 'L4' },
    });
  });

  it('uses the latest document updatedAt and returns null documents for misses', () => {
    expect(buildNsAcademyLookupResponse(
      { updatedAt: timestamp('2026-01-02T00:00:00.000Z') },
      { updatedAt: timestamp('2026-01-04T00:00:00.000Z') }
    )).toEqual({
      contract_version: 1,
      source_updated_at: '2026-01-04T00:00:00.000Z',
      results: { updatedAt: '2026-01-02T00:00:00.000Z' },
      uaam_results: { updatedAt: '2026-01-04T00:00:00.000Z' },
    });

    expect(buildNsAcademyLookupResponse(null, null)).toEqual({
      contract_version: 1,
      source_updated_at: null,
      results: null,
      uaam_results: null,
    });
  });
});
