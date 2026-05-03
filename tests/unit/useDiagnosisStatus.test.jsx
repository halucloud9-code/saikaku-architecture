// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const firebaseMocks = vi.hoisted(() => {
  const getIdToken = vi.fn();
  return {
    auth: {
      currentUser: {
        uid: 'u-status',
        getIdToken,
      },
    },
    getIdToken,
  };
});

vi.mock('../../src/firebase', () => ({
  auth: firebaseMocks.auth,
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

function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function setAuthUid(uid) {
  firebaseMocks.auth.currentUser = uid === null
    ? null
    : { uid, getIdToken: firebaseMocks.getIdToken };
}

describe('useDiagnosisStatus', () => {
  beforeEach(() => {
    firebaseMocks.getIdToken.mockReset();
    setAuthUid(user.uid);
    firebaseMocks.getIdToken.mockResolvedValue('id-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200)));
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  it('returns status, error, and a stable refresh callback', async () => {
    const { result } = renderHook(() => useDiagnosisStatus(user));
    const initialRefresh = result.current.refresh;

    expect(result.current.status).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(initialRefresh).toEqual(expect.any(Function));

    await waitFor(() => expect(result.current.status).toEqual(loadedStatus));
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.refresh).toBe(initialRefresh);
  });

  it('reports loading while the first uncached status request is in flight', async () => {
    const firstFetch = deferred();
    fetch.mockImplementationOnce(() => firstFetch.promise);

    const { result } = renderHook(() => useDiagnosisStatus(user));

    expect(result.current.status).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    await act(async () => {
      firstFetch.resolve(response(200));
    });

    await waitFor(() => expect(result.current.status).toEqual(loadedStatus));
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('does not report loading when the user id is null', () => {
    const { result } = renderHook(() => useDiagnosisStatus(null));

    expect(result.current.status).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
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

  it('keeps the previous status visible while refresh is revalidating', async () => {
    const refreshedStatus = {
      ...loadedStatus,
      saikaku: {
        ...loadedStatus.saikaku,
        committedCount: 2,
      },
    };
    const secondFetch = deferred();
    const { result } = renderHook(() => useDiagnosisStatus(user));

    await waitFor(() => expect(result.current.status).toEqual(loadedStatus));

    fetch.mockImplementationOnce(() => secondFetch.promise);

    let refreshPromise;
    act(() => {
      refreshPromise = result.current.refresh();
    });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(result.current.status).toEqual(loadedStatus);
    expect(result.current.error).toBeNull();

    await act(async () => {
      secondFetch.resolve(response(200, refreshedStatus));
      await refreshPromise;
    });

    expect(result.current.status).toEqual(refreshedStatus);
    expect(result.current.error).toBeNull();
  });

  it('clears status synchronously when the user id changes', async () => {
    const nextStatus = {
      ...loadedStatus,
      saikaku: {
        ...loadedStatus.saikaku,
        committedCount: 2,
        attemptCount: 2,
        isStartBlocked: true,
      },
      uaam: {
        ...loadedStatus.uaam,
        committedCount: 1,
        attemptCount: 1,
        hasResult: true,
      },
    };
    const nextFetch = deferred();
    fetch
      .mockResolvedValueOnce(response(200, loadedStatus))
      .mockImplementationOnce(() => nextFetch.promise);
    setAuthUid('u-status-a');

    const { result, rerender } = renderHook(
      ({ currentUser }) => useDiagnosisStatus(currentUser),
      { initialProps: { currentUser: { uid: 'u-status-a' } } },
    );

    await waitFor(() => expect(result.current.status).toEqual(loadedStatus));

    setAuthUid('u-status-b');
    rerender({ currentUser: { uid: 'u-status-b' } });

    expect(result.current.status).toBeNull();
    expect(result.current.error).toBeNull();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(result.current.status).toBeNull();

    await act(async () => {
      nextFetch.resolve(response(200, nextStatus));
    });

    await waitFor(() => expect(result.current.status).toEqual(nextStatus));
    expect(result.current.error).toBeNull();
  });

  it('clears a previous error before the retry fetch resolves', async () => {
    const secondFetch = deferred();
    fetch
      .mockResolvedValueOnce(response(500))
      .mockImplementationOnce(() => secondFetch.promise);

    const { result } = renderHook(() => useDiagnosisStatus(user));

    await waitFor(() => expect(result.current.error).toBe('fetch'));
    expect(result.current.status).toBeNull();

    let refreshPromise;
    act(() => {
      refreshPromise = result.current.refresh();
    });

    await waitFor(() => expect(result.current.error).toBeNull());
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(result.current.status).toBeNull();

    await act(async () => {
      secondFetch.resolve(response(200));
      await refreshPromise;
    });

    expect(result.current.status).toEqual(loadedStatus);
    expect(result.current.error).toBeNull();
  });

  it('clears status when the user id becomes null', async () => {
    const { result, rerender } = renderHook(
      ({ currentUser }) => useDiagnosisStatus(currentUser),
      { initialProps: { currentUser: user } },
    );

    await waitFor(() => expect(result.current.status).toEqual(loadedStatus));

    rerender({ currentUser: null });

    await waitFor(() => expect(result.current.status).toBeNull());
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

  it('hydrates the initial status from sessionStorage cache on mount', async () => {
    window.sessionStorage.setItem('diag-status:u-status', JSON.stringify(loadedStatus));
    const { result } = renderHook(() => useDiagnosisStatus(user));
    expect(result.current.status).toEqual(loadedStatus);
    expect(result.current.error).toBeNull();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });

  it('persists the status to sessionStorage after a successful fetch', async () => {
    const { result } = renderHook(() => useDiagnosisStatus(user));
    await waitFor(() => expect(result.current.status).toEqual(loadedStatus));
    expect(window.sessionStorage.getItem('diag-status:u-status')).toEqual(
      JSON.stringify(loadedStatus),
    );
  });

  it('does not write a stale successful response to sessionStorage', async () => {
    const staleStatus = {
      ...loadedStatus,
      saikaku: {
        ...loadedStatus.saikaku,
        committedCount: 1,
        isStartBlocked: false,
      },
    };
    const freshStatus = {
      ...loadedStatus,
      saikaku: {
        ...loadedStatus.saikaku,
        committedCount: 2,
        attemptCount: 2,
        isStartBlocked: true,
      },
    };
    const firstFetch = deferred();
    const secondFetch = deferred();
    fetch
      .mockImplementationOnce(() => firstFetch.promise)
      .mockImplementationOnce(() => secondFetch.promise);

    const { result } = renderHook(() => useDiagnosisStatus(user));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    let refreshPromise;
    act(() => {
      refreshPromise = result.current.refresh();
    });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    await act(async () => {
      secondFetch.resolve(response(200, freshStatus));
      await refreshPromise;
    });

    expect(result.current.status).toEqual(freshStatus);
    expect(window.sessionStorage.getItem('diag-status:u-status')).toEqual(
      JSON.stringify(freshStatus),
    );

    const staleResponse = response(200, staleStatus);
    await act(async () => {
      firstFetch.resolve(staleResponse);
      await firstFetch.promise;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(staleResponse.json).toHaveBeenCalledTimes(1);
    expect(result.current.status).toEqual(freshStatus);
    expect(window.sessionStorage.getItem('diag-status:u-status')).toEqual(
      JSON.stringify(freshStatus),
    );
  });

  it('treats an auth uid mismatch after token fetch as an auth error without caching', async () => {
    firebaseMocks.getIdToken.mockImplementationOnce(async () => {
      setAuthUid('u-other');
      return 'id-token';
    });

    const { result } = renderHook(() => useDiagnosisStatus(user));

    await waitFor(() => expect(result.current.error).toBe('auth'));
    expect(result.current.status).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('diag-status:u-status')).toBeNull();
  });

  it.each([
    ['empty object', {}],
    ['null status entry', { saikaku: null, uaam: { ...loadedStatus.uaam } }],
  ])('rejects an invalid response shape: %s', async (_name, body) => {
    fetch.mockResolvedValueOnce(response(200, body));

    const { result } = renderHook(() => useDiagnosisStatus(user));

    await waitFor(() => expect(result.current.error).toBe('fetch'));
    expect(result.current.status).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(window.sessionStorage.getItem('diag-status:u-status')).toBeNull();
  });

  it('hydrates from cache when the user id changes to a previously cached user', async () => {
    window.sessionStorage.setItem(
      'diag-status:u-status-b',
      JSON.stringify({
        ...loadedStatus,
        saikaku: { ...loadedStatus.saikaku, committedCount: 2, isStartBlocked: true },
      }),
    );
    fetch.mockResolvedValue(response(200, loadedStatus));
    setAuthUid('u-status-a');

    const { result, rerender } = renderHook(
      ({ currentUser }) => useDiagnosisStatus(currentUser),
      { initialProps: { currentUser: { uid: 'u-status-a' } } },
    );

    await waitFor(() => expect(result.current.status).toEqual(loadedStatus));

    setAuthUid('u-status-b');
    rerender({ currentUser: { uid: 'u-status-b' } });

    expect(result.current.status).toEqual({
      ...loadedStatus,
      saikaku: { ...loadedStatus.saikaku, committedCount: 2, isStartBlocked: true },
    });
    expect(result.current.error).toBeNull();
  });

  it('refreshes on focus and visible visibilitychange after user id changes', async () => {
    const { rerender } = renderHook(
      ({ currentUser }) => useDiagnosisStatus(currentUser),
      { initialProps: { currentUser: user } },
    );

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    setAuthUid('u-status-2');
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
