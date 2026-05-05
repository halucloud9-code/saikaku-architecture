// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const firebaseMocks = vi.hoisted(() => {
  const getIdToken = vi.fn();
  const signOutUser = vi.fn();
  return {
    auth: {
      currentUser: {
        uid: 'u-1',
        getIdToken,
      },
    },
    getIdToken,
    signOutUser,
  };
});

vi.mock('../../../src/firebase', () => ({
  auth: firebaseMocks.auth,
  signOutUser: firebaseMocks.signOutUser,
}));

import SelectScreen from '../../../src/screens/SelectScreen';

const user = { uid: 'u-1', displayName: 'Test User' };
const noop = () => {};

const cachedStatusWithoutRecentAttempts = {
  saikaku: {
    committedCount: 1,
    attemptCount: 1,
    hasPending: false,
    pendingAttemptId: null,
    hasResult: true,
    isStartBlocked: false,
  },
  uaam: {
    committedCount: 1,
    attemptCount: 1,
    hasPending: false,
    pendingAttemptId: null,
    hasResult: true,
    isStartBlocked: false,
  },
};

function response(status, body = cachedStatusWithoutRecentAttempts) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

function renderSelect() {
  return render(
    <SelectScreen
      user={user}
      isAdmin={false}
      onSelectSaikaku={noop}
      onSelectUaam={noop}
      onSelectHistory={noop}
      onSelectAttempt={noop}
      onAdmin={noop}
      onLogout={noop}
    />,
  );
}

describe('SelectScreen recent attempts cache shape', () => {
  beforeEach(() => {
    firebaseMocks.getIdToken.mockReset();
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

  it('does not crash when cached status does not include recentAttempts', () => {
    window.sessionStorage.setItem('diag-status:u-1', JSON.stringify(cachedStatusWithoutRecentAttempts));

    expect(() => renderSelect()).not.toThrow();

    expect(screen.getByTestId('history-link-saikaku')).toHaveTextContent('履歴を見る (1)');
    expect(screen.getByTestId('history-link-uaam')).toHaveTextContent('履歴を見る (1)');
    expect(screen.queryByTestId('recent-attempt-saikaku-0')).toBeNull();
    expect(screen.queryByTestId('recent-attempt-uaam-0')).toBeNull();
  });
});
