import { describe, expect, it } from 'vitest';
import { listFromAttempts } from '../../src/utils/attemptLoader';

function timestamp(ms) {
  return { toMillis: () => ms };
}

describe('listFromAttempts', () => {
  it('synthesizes a legacy saikaku attempt when attempts are empty', () => {
    const { committedAttempts, pendingAttempt } = listFromAttempts(
      [],
      { result: { kakuchiiki: '問いに火を灯す人' } },
      'saikaku',
    );

    expect(committedAttempts).toHaveLength(1);
    expect(committedAttempts[0]).toMatchObject({ id: 'legacy-fallback', isLegacy: true });
    expect(pendingAttempt).toBeNull();
  });

  it('does not synthesize legacy data for modern users with attempts', () => {
    const { committedAttempts } = listFromAttempts(
      [{ id: 'uuid', status: 'committed', createdAt: timestamp(1) }],
      { result: { kakuchiiki: '問いに火を灯す人' } },
      'saikaku',
    );

    expect(committedAttempts.map((attempt) => attempt.id)).toEqual(['uuid']);
  });

  it('separates committed and matching pending attempts', () => {
    const pending = { id: 'B', status: 'pending', createdAt: timestamp(2) };
    const { committedAttempts, pendingAttempt } = listFromAttempts(
      [{ id: 'A', status: 'committed', createdAt: timestamp(1) }, pending],
      { pendingAttemptId: 'B' },
      'saikaku',
    );

    expect(committedAttempts.map((attempt) => attempt.id)).toEqual(['A']);
    expect(pendingAttempt).toBe(pending);
  });

  it('returns a pending attempt when no committed attempts exist', () => {
    const pending = { id: 'B', status: 'pending' };
    const { committedAttempts, pendingAttempt } = listFromAttempts(
      [pending],
      { pendingAttemptId: 'B' },
      'saikaku',
    );

    expect(committedAttempts).toEqual([]);
    expect(pendingAttempt).toBe(pending);
  });

  it('surfaces orphan pending state without crashing', () => {
    const { committedAttempts, pendingAttempt } = listFromAttempts(
      [],
      { pendingAttemptId: 'X' },
      'saikaku',
    );

    expect(committedAttempts).toEqual([]);
    expect(pendingAttempt).toBeNull();
  });

  it('sorts missing createdAt values to the end', () => {
    const { committedAttempts } = listFromAttempts(
      [
        { id: 'missing', status: 'committed' },
        { id: 'newer', status: 'committed', createdAt: timestamp(2000) },
        { id: 'older', status: 'committed', createdAt: timestamp(1000) },
      ],
      {},
      'saikaku',
    );

    expect(committedAttempts.map((attempt) => attempt.id)).toEqual(['newer', 'older', 'missing']);
  });

  it('synthesizes a legacy UAAM attempt when attempts are empty', () => {
    const { committedAttempts } = listFromAttempts(
      [],
      {
        scores: { mindset: { total: 60 } },
        analysis: { type_name: '実装する案内人' },
      },
      'uaam',
    );

    expect(committedAttempts).toHaveLength(1);
    expect(committedAttempts[0]).toMatchObject({
      id: 'legacy-fallback',
      isLegacy: true,
      summary: { typeName: '実装する案内人' },
    });
  });
});
