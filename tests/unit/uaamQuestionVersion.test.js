import { describe, expect, it } from 'vitest';
import {
  computeUaamQuestionVersion,
  QUESTIONS,
  UAAM_QUESTION_VERSION,
} from '../../shared/uaamQuestions.js';

describe('UAAM question version', () => {
  it('is stable for identical data and changes with every instrument field', () => {
    expect(computeUaamQuestionVersion(QUESTIONS.map((question) => ({ ...question }))))
      .toBe(UAAM_QUESTION_VERSION);

    for (const [field, value] of [
      ['id', 1001],
      ['text', `${QUESTIONS[0].text}変更`],
      ['reverse', !QUESTIONS[0].reverse],
      ['axis', 'changed-axis'],
      ['sub', 'changed-sub'],
    ]) {
      const changed = QUESTIONS.map((question, index) => (
        index === 0 ? { ...question, [field]: value } : { ...question }
      ));
      expect(computeUaamQuestionVersion(changed)).not.toBe(UAAM_QUESTION_VERSION);
    }
  });
});
