import { describe, expect, it } from 'vitest';
import { summarizeFromParent } from '../../src/utils/attemptLoader';

describe('summarizeFromParent', () => {
  it('returns zero summary for an empty parent', () => {
    expect(summarizeFromParent({})).toMatchObject({
      committedCount: 0,
      attemptCount: 0,
      hasPending: false,
      isStartBlocked: false,
    });
  });

  it('counts one committed attempt without pending', () => {
    expect(summarizeFromParent({ attemptCount: 1, pendingAttemptId: null })).toMatchObject({
      committedCount: 1,
      hasPending: false,
    });
  });

  it('subtracts a pending attempt from attemptCount', () => {
    expect(summarizeFromParent({ attemptCount: 1, pendingAttemptId: 'X' })).toMatchObject({
      committedCount: 0,
      hasPending: true,
      isStartBlocked: true,
    });
  });

  it('blocks start when two committed attempts exist', () => {
    expect(summarizeFromParent({ attemptCount: 2, pendingAttemptId: null })).toMatchObject({
      committedCount: 2,
      isStartBlocked: true,
    });
  });

  it('keeps one committed attempt when a second attempt is pending', () => {
    expect(summarizeFromParent({ attemptCount: 2, pendingAttemptId: 'X' })).toMatchObject({
      committedCount: 1,
      hasPending: true,
      isStartBlocked: true,
    });
  });

  it('applies a legacy floor from saikaku result', () => {
    expect(summarizeFromParent({ result: { kakuchiiki: '問いに火を灯す人' } })).toMatchObject({
      committedCount: 1,
    });
  });

  it('does not double count legacy floor and attemptCount', () => {
    expect(summarizeFromParent({
      attemptCount: 1,
      pendingAttemptId: null,
      result: { kakuchiiki: '問いに火を灯す人' },
    })).toMatchObject({
      committedCount: 1,
    });
  });

  it('counts UAAM scores as a result', () => {
    expect(summarizeFromParent({ scores: { mindset: { total: 60 } }, attemptCount: 1 })).toMatchObject({
      committedCount: 1,
    });
  });
});
