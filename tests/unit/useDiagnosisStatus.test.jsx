// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const firebaseMocks = vi.hoisted(() => ({
  getIdToken: vi.fn(),
}));

vi.mock('../../src/firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: firebaseMocks.getIdToken,
    },
  },
}));

import useDiagnosisStatus from '../../src/hooks/useDiagnosisStatus';

const user = { uid: 'u-status' };
const loadedStatus = {
  saikaku: {
    committedCount: 1,
    attemptCount: 1,
    hasPending: false,
    pendingAttemptId: null,
    hasResult: true,
    isStartBlocked: false,
  },
  uaam: {
    committedCount: 0,
    attemptCount: 0,
    hasPending: false,
    pendingAttemptId: null,
    hasResult: false,
    isStartBlocked: false,
  },
};

function response(status, body = loadedStatus) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

describe('useDiagnosisStatus', () => {
  beforeEach(() => {
    firebaseMocks.getIdToken.mockResolvedValue('id-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200)));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns status, error, and a stable refresh callback', async () => {
    const { result } = renderHook(() => useDiagnosisStatus(user));
    const initialRefresh = result.current.refresh;

    expect(result.current.status).toBeNull();
    expect(result.current.error).toBeNull();
    expect(initialRefresh).toEqual(expect.any(Function));

    await waitFor(() => expect(result.current.status).toEqual(loadedStatus));
    expect(result.current.error).toBeNull();
    expect(result.current.refresh).toBe(initialRefresh);
  });

  it('refresh re-fetches for the same user id and clears a previous error', async () => {
    fetch
      .mockResolvedValueOnce(response(500))
      .mockResolvedValueOnce(response(200));

    const { result } = renderHook(() => useDiagnosisStatus(user));

    await waitFor(() => expect(result.current.error).toBe('fetch'));
    expect(result.current.status).toBeNull();

    await act(async () => {
      await result.current.refresh();
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.current.status).toEqual(loadedStatus);
    expect(result.current.error).toBeNull();
  });

  it.each([
    ['auth', async () => {
      firebaseMocks.getIdToken.mockRejectedValueOnce(new Error('token failed'));
    }],
    ['fetch', async () => {
      fetch.mockResolvedValueOnce(response(503));
    }],
    ['network', async () => {
      fetch.mockRejectedValueOnce(new Error('offline'));
    }],
  ])('persists %s errors', async (expectedError, arrange) => {
    await arrange();

    const { result } = renderHook(() => useDiagnosisStatus(user));

    await waitFor(() => expect(result.current.error).toBe(expectedError));
    expect(result.current.status).toBeNull();
  });

  it('refreshes on focus and visible visibilitychange after user id changes', async () => {
    const { rerender } = renderHook(
      ({ currentUser }) => useDiagnosisStatus(currentUser),
      { initialProps: { currentUser: user } },
    );

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    rerender({ currentUser: { uid: 'u-status-2' } });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    const tokenCallsBeforeFocus = firebaseMocks.getIdToken.mock.calls.length;
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(firebaseMocks.getIdToken).toHaveBeenCalledTimes(tokenCallsBeforeFocus + 1);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));

    const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(4));
    if (originalVisibilityState) {
      Object.defineProperty(document, 'visibilityState', originalVisibilityState);
    }
  });
});
