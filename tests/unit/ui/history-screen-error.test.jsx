// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const firebaseMocks = vi.hoisted(() => ({
  getIdToken: vi.fn(),
  signOutUser: vi.fn(),
}));

vi.mock('../../../src/firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: firebaseMocks.getIdToken,
    },
  },
  signOutUser: firebaseMocks.signOutUser,
}));

import HistoryScreen from '../../../src/screens/HistoryScreen';

const user = { uid: 'u-history-error', displayName: 'Test User' };
const noop = () => {};

function emptyHistory() {
  return {
    attempts: [],
    pendingAttempt: null,
    summary: {
      committedCount: 0,
      attemptCount: 0,
      hasPending: false,
      pendingAttemptId: null,
      hasResult: false,
      isStartBlocked: false,
    },
  };
}

function renderHistory() {
  return render(
    <HistoryScreen
      user={user}
      kind="saikaku"
      onBack={noop}
      onSelectAttemptId={noop}
      onLogout={noop}
    />,
  );
}

function response(status, body = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

describe('HistoryScreen error handling', () => {
  beforeEach(() => {
    firebaseMocks.getIdToken.mockResolvedValue('id-token');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it.each([
    [401, 'ログイン状態を確認できませんでした。再ログインしてください。'],
    [422, 'リクエストが不正です。'],
    [500, '履歴を読み込めませんでした。時間をおいて再度お試しください。'],
  ])('shows a reloadable alert for %i responses', async (status, message) => {
    fetch.mockResolvedValueOnce(response(status));

    renderHistory();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: '再読み込み' })).toBeInTheDocument();
    expect(screen.queryByText('まだ診断履歴がありません')).toBeNull();
  });

  it('shows a communication error for network failures', async () => {
    fetch.mockRejectedValueOnce(new Error('network down'));

    renderHistory();

    expect(await screen.findByRole('alert')).toHaveTextContent('通信エラーが発生しました。');
    expect(screen.queryByText('まだ診断履歴がありません')).toBeNull();
  });

  it('reuses the load path when the reload button is clicked', async () => {
    fetch
      .mockResolvedValueOnce(response(500))
      .mockResolvedValueOnce(response(200, emptyHistory()));

    renderHistory();

    const reload = await screen.findByRole('button', { name: '再読み込み' });
    await userEvent.click(reload);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await screen.findByText('まだ診断履歴がありません');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
