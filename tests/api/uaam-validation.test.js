import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearUserState,
  getMockCallCount,
  minimalUaamBody,
  resetMockCallCount,
  uaamRequest,
} from './_helpers.js';

describe('API /api/uaam validation', () => {
  beforeEach(() => {
    resetMockCallCount();
  });

  async function expectValidationError(uid, mutateBody) {
    await clearUserState('uaam_results', uid);
    const body = minimalUaamBody();
    mutateBody(body);

    const response = await uaamRequest(uid, body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: expect.any(String) });
    expect(getMockCallCount('uaam')).toBe(0);
  }

  it('rejects answers missing a canonical question id even when 64 keys are present', async () => {
    await expectValidationError('u-uaam-validation-missing-answer', (body) => {
      delete body.answers['1'];
      body.answers['999'] = 3;
    });
  });

  it('rejects missing vAnswers keys', async () => {
    await expectValidationError('u-uaam-validation-missing-vanswer', (body) => {
      delete body.vAnswers.V2;
    });
  });

  it('rejects non-object vAnswers', async () => {
    await expectValidationError('u-uaam-validation-non-object-vanswer', (body) => {
      body.vAnswers = null;
    });
  });

  it('rejects unexpected vAnswers keys', async () => {
    await expectValidationError('u-uaam-validation-extra-vanswer', (body) => {
      body.vAnswers.V4 = 3;
    });
  });

  it('rejects out-of-range vAnswers values', async () => {
    await expectValidationError('u-uaam-validation-vanswer-range', (body) => {
      body.vAnswers.V1 = 6;
    });
  });

  it('rejects out-of-range answer values', async () => {
    await expectValidationError('u-uaam-validation-answer-range', (body) => {
      body.answers['1'] = 6;
    });
  });

  it('rejects string answer values without coercion', async () => {
    await expectValidationError('u-uaam-validation-answer-string', (body) => {
      body.answers['1'] = '4';
    });
  });

  it('rejects string vAnswers values without coercion', async () => {
    await expectValidationError('u-uaam-validation-vanswer-string', (body) => {
      body.vAnswers.V1 = '4';
    });
  });
});
