import { describe, expect, it } from 'vitest';
import { summarizeFromAttemptsAndParent, summarizeFromParent } from '../../shared/attemptLogic.js';

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

  it('does not block start when only two committed attempts exist', () => {
    expect(summarizeFromParent({ attemptCount: 2, pendingAttemptId: null })).toMatchObject({
      committedCount: 2,
      isStartBlocked: false,
    });
  });

  it('blocks start when three committed attempts exist', () => {
    expect(summarizeFromParent({ attemptCount: 3, pendingAttemptId: null })).toMatchObject({
      committedCount: 3,
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

describe('summarizeFromAttemptsAndParent', () => {
  it('prefers actual committed attempts over stale parent attemptCount', () => {
    expect(summarizeFromAttemptsAndParent(
      [
        { id: 'attempt-1', status: 'committed' },
        { id: 'attempt-2', status: 'committed' },
        { id: 'attempt-3', status: 'committed' },
      ],
      { attemptCount: 0, pendingAttemptId: null },
    )).toMatchObject({
      committedCount: 3,
      attemptCount: 3,
      hasPending: false,
      pendingAttemptId: null,
      isStartBlocked: true,
    });
  });

  it('keeps the legacy result floor when committed attempts are missing', () => {
    expect(summarizeFromAttemptsAndParent(
      [],
      { attemptCount: 0, result: { kakuchiiki: '問いに火を灯す人' } },
    )).toMatchObject({
      committedCount: 1,
      attemptCount: 1,
      hasResult: true,
      isStartBlocked: false,
    });
  });

  it('keeps pending state only when the parent id resolves to a pending attempt', () => {
    expect(summarizeFromAttemptsAndParent(
      [
        { id: 'pending-1', status: 'pending' },
        { id: 'attempt-1', status: 'committed' },
      ],
      { pendingAttemptId: 'pending-1' },
    )).toMatchObject({
      hasPending: true,
      pendingAttemptId: 'pending-1',
      isStartBlocked: true,
    });
  });

  it('clears orphan or non-pending parent pendingAttemptId values', () => {
    expect(summarizeFromAttemptsAndParent(
      [{ id: 'pending-1', status: 'committed' }],
      { pendingAttemptId: 'pending-1' },
    )).toMatchObject({
      committedCount: 1,
      hasPending: false,
      pendingAttemptId: null,
      isStartBlocked: false,
    });
  });
});
