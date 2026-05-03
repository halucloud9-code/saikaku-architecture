/**
 * Tests for src/api/coachingAnswers.js (client helper).
 * fetch をモックして load / save の挙動を検証する。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../src/firebase', () => ({
  auth: {
    currentUser: null,
  },
}));

import * as firebaseMod from '../src/firebase';
import { loadCoachingAnswers, saveCoachingAnswers } from '../src/api/coachingAnswers.js';

beforeEach(() => {
  globalThis.fetch = vi.fn();
  firebaseMod.auth.currentUser = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function setUser() {
  firebaseMod.auth.currentUser = {
    getIdToken: vi.fn(async () => 'fake-token'),
  };
}

describe('loadCoachingAnswers', () => {
  it('returns {} when not signed in', async () => {
    const result = await loadCoachingAnswers();
    expect(result).toEqual({});
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns {} when fetch fails', async () => {
    setUser();
    globalThis.fetch.mockRejectedValueOnce(new Error('network error'));
    const result = await loadCoachingAnswers();
    expect(result).toEqual({});
  });

  it('returns {} when response is not ok', async () => {
    setUser();
    globalThis.fetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    const result = await loadCoachingAnswers();
    expect(result).toEqual({});
  });

  it('returns answers map on success', async () => {
    setUser();
    const answers = {
      abc123: { questionText: 'Q1', answer: 'A1', answeredAt: '2026-01-01T00:00:00Z' },
    };
    globalThis.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ answers }) });
    const result = await loadCoachingAnswers();
    expect(result).toEqual(answers);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/me/coaching-answers',
      expect.objectContaining({
        headers: { Authorization: 'Bearer fake-token' },
      })
    );
  });
});

describe('saveCoachingAnswers', () => {
  it('throws when not signed in', async () => {
    await expect(saveCoachingAnswers([{ questionText: 'Q', answer: 'A' }])).rejects.toThrow();
  });

  it('throws when items is empty after trimming', async () => {
    setUser();
    await expect(saveCoachingAnswers([])).rejects.toThrow();
    await expect(saveCoachingAnswers([{ questionText: 'Q', answer: '   ' }])).rejects.toThrow();
  });

  it('filters out empty answers before sending', async () => {
    setUser();
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answers: {} }),
    });
    await saveCoachingAnswers([
      { questionText: 'Q1', answer: 'A1' },
      { questionText: 'Q2', answer: '' },
      { questionText: '', answer: 'X' },
    ]);
    expect(globalThis.fetch).toHaveBeenCalled();
    const [, options] = globalThis.fetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.items).toEqual([{ questionText: 'Q1', answer: 'A1' }]);
  });

  it('throws on server error with error message', async () => {
    setUser();
    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'too many items (max 10)' }),
    });
    await expect(
      saveCoachingAnswers([{ questionText: 'Q', answer: 'A' }])
    ).rejects.toThrow(/too many items/);
  });

  it('returns answers map on success', async () => {
    setUser();
    const answers = { qid1: { questionText: 'Q', answer: 'A' } };
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answers }),
    });
    const result = await saveCoachingAnswers([{ questionText: 'Q', answer: 'A' }]);
    expect(result).toEqual(answers);
  });

  it('trims whitespace from items before sending', async () => {
    setUser();
    globalThis.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ answers: {} }) });
    await saveCoachingAnswers([{ questionText: '  Q  ', answer: '  A  ' }]);
    const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
    expect(body.items).toEqual([{ questionText: 'Q', answer: 'A' }]);
  });
});
