import { describe, expect, it } from 'vitest';
import { QUESTIONS, calculateScores as sharedCalculateScores } from '../../shared/uaamQuestions.js';
import { calculateScores as clientCalculateScores } from '../../src/data/uaam_questions.js';

function answersWithDefault(value = 3) {
  return Object.fromEntries(QUESTIONS.map((question) => [question.id, value]));
}

function stripCompatFields(scores) {
  return Object.fromEntries(
    Object.entries(scores).map(([axisKey, axis]) => {
      const { domainSubs, domainTotal, ...canonical } = axis;
      return [axisKey, canonical];
    }),
  );
}

function expectFiniteScores(scores) {
  for (const axis of Object.values(scores)) {
    expect(Number.isFinite(axis.total)).toBe(true);
    expect(axis.total).not.toBeUndefined();

    for (const subTotal of Object.values(axis.subs)) {
      expect(Number.isFinite(subTotal)).toBe(true);
      expect(subTotal).not.toBeUndefined();
    }
  }
}

describe('UAAM shared/client scoring', () => {
  it('calculates the shared baseline when all answers are 3', () => {
    const scores = sharedCalculateScores(answersWithDefault(3));

    for (const axis of Object.values(scores)) {
      expect(Object.keys(axis).sort()).toEqual(['max', 'percentage', 'subs', 'total']);
      expect(axis.total).toBe(48);
      expect(axis.max).toBe(80);
      expect(axis.percentage).toBe(60);
      expect(Object.values(axis.subs)).toEqual([12, 12, 12, 12]);
    }
  });

  it('reverses Q42 when the raw answer is 5', () => {
    const answers = answersWithDefault(3);
    answers[42] = 5;

    const scores = sharedCalculateScores(answers);

    expect(scores.competency.subs.communication).toBe(10);
    expect(scores.competency.total).toBe(46);
    expect(scores.mindset.total).toBe(48);
    expect(scores.literacy.total).toBe(48);
    expect(scores.impact.total).toBe(48);
  });

  it('reverses Q42 in the opposite direction when the raw answer is 1', () => {
    const answers = answersWithDefault(3);
    answers[42] = 1;

    const scores = sharedCalculateScores(answers);

    expect(scores.competency.subs.communication).toBe(14);
    expect(scores.competency.total).toBe(50);
  });

  it('keeps the reverse-question pattern aligned to each subcategory second question', () => {
    const reverseIds = QUESTIONS.filter((question) => question.reverse).map((question) => question.id);

    expect(reverseIds).toHaveLength(16);
    expect(reverseIds).toEqual([2, 6, 10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 50, 54, 58, 62]);
  });

  it('keeps canonical fields equivalent between client and shared scoring', () => {
    const answers = answersWithDefault(3);
    answers[1] = 4;
    answers[42] = 5;

    const sharedResult = sharedCalculateScores(answers);
    const clientResult = clientCalculateScores(answers);

    expect(stripCompatFields(clientResult)).toEqual(sharedResult);
  });

  it('adds client wrapper back-compat fields without changing their values', () => {
    const answers = answersWithDefault(3);
    answers[1] = 4;
    answers[42] = 5;

    const scores = clientCalculateScores(answers);

    for (const axis of Object.values(scores)) {
      expect(axis.domainSubs).toEqual(axis.subs);
      expect(axis.domainTotal).toBe(axis.total);
    }
  });

  it('casts string values defensively and defaults missing keys to 3', () => {
    const partialAnswers = {
      1: '5',
      2: 3,
      3: 3,
      4: 3,
      42: '5',
    };

    expect(() => sharedCalculateScores(partialAnswers)).not.toThrow();

    const scores = sharedCalculateScores(partialAnswers);
    expectFiniteScores(scores);
    expect(scores.mindset.subs.meaning).toBe(14);
    expect(scores.competency.subs.communication).toBe(10);
  });

  it('tolerates numeric and string answer keys equivalently', () => {
    const numberKeyAnswers = answersWithDefault(5);
    const stringKeyAnswers = Object.fromEntries(
      QUESTIONS.map((question) => [String(question.id), numberKeyAnswers[question.id]]),
    );

    expect(sharedCalculateScores(numberKeyAnswers)).toEqual(sharedCalculateScores(stringKeyAnswers));
  });
});
