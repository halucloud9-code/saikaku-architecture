import { describe, expect, it } from 'vitest';
import {
  isValidAttemptId,
  selectIntegrationForAttempt,
} from '../../shared/attemptLogic.js';

describe('selectIntegrationForAttempt', () => {
  it('returns Saikaku integration matches ordered by updatedAt desc then uaamAttemptId asc', () => {
    const integrations = [
      {
        id: 'older',
        saikakuAttemptId: 'saikaku-a',
        uaamAttemptId: 'uaam-z',
        updatedAt: new Date('2026-05-01T00:00:00.000Z'),
      },
      {
        id: 'tie-b',
        saikakuAttemptId: 'saikaku-a',
        uaamAttemptId: 'uaam-b',
        updatedAt: new Date('2026-05-03T00:00:00.000Z'),
      },
      {
        id: 'other-saikaku',
        saikakuAttemptId: 'saikaku-b',
        uaamAttemptId: 'uaam-a',
        updatedAt: new Date('2026-05-04T00:00:00.000Z'),
      },
      {
        id: 'tie-a',
        saikakuAttemptId: 'saikaku-a',
        uaamAttemptId: 'uaam-a',
        updatedAt: new Date('2026-05-03T00:00:00.000Z'),
      },
    ];

    const selected = selectIntegrationForAttempt(integrations, 'saikaku', 'saikaku-a');

    expect(Array.isArray(selected)).toBe(true);
    expect(selected.map((integration) => integration.id)).toEqual(['tie-a', 'tie-b', 'older']);
  });
});

describe('isValidAttemptId', () => {
  it.each(['attempt-1', 'attempt_2', 'ABC123'])('accepts valid attempt id %s', (value) => {
    expect(isValidAttemptId(value)).toBe(true);
  });

  it.each(['', 'a/b', 'a.b', '..', '__reserved__', 'x'.repeat(129)])(
    'rejects invalid attempt id %s',
    (value) => {
      expect(isValidAttemptId(value)).toBe(false);
    },
  );
});
