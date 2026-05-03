// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../src/firebase', () => ({
  signOutUser: vi.fn(),
}));

vi.mock('../../../src/hooks/useDiagnosisStatus', () => ({
  default: vi.fn(),
}));

import useDiagnosisStatus from '../../../src/hooks/useDiagnosisStatus';
import SelectScreen from '../../../src/screens/SelectScreen';

const user = { uid: 'u1', displayName: 'Test User' };
const noop = () => {};

function statusOf({ committedCount = 0, hasPending = false, hasResult = false } = {}) {
  return {
    committedCount,
    attemptCount: committedCount,
    hasPending,
    pendingAttemptId: hasPending ? 'pending-1' : null,
    hasResult,
    isStartBlocked: hasPending || committedCount >= 2,
  };
}

function hookValue(status, error = null, refresh = vi.fn()) {
  return { status, error, refresh };
}

function renderSelect(overrides = {}) {
  return render(
    <SelectScreen
      user={user}
      isAdmin={false}
      onSelectSaikaku={noop}
      onSelectUaam={noop}
      onSelectHistory={noop}
      onAdmin={noop}
      onLogout={noop}
      {...overrides}
    />,
  );
}

describe('SelectScreen badge', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('hides badges while loading', () => {
    useDiagnosisStatus.mockReturnValue(hookValue(null));

    renderSelect();

    expect(screen.queryByTestId('badge-saikaku')).toBeNull();
    expect(screen.queryByText(/診断済み/)).toBeNull();
  });

  it('shows 1/2 for saikaku when attemptCount=1', () => {
    useDiagnosisStatus.mockReturnValue(hookValue({
      saikaku: statusOf({ committedCount: 1, hasResult: true }),
      uaam: statusOf(),
    }));

    renderSelect();

    expect(screen.getByTestId('badge-saikaku')).toHaveTextContent('診断済み (1/2)');
    expect(screen.getByTestId('history-link-saikaku')).toHaveTextContent('履歴を見る (1)');
  });

  it('shows 2/2 and the limit notice for saikaku', () => {
    useDiagnosisStatus.mockReturnValue(hookValue({
      saikaku: statusOf({ committedCount: 2, hasResult: true }),
      uaam: statusOf(),
    }));

    renderSelect();

    expect(screen.getByTestId('badge-saikaku')).toHaveTextContent('診断済み (2/2)');
    expect(screen.getByText('診断は最大2回まで実施済み')).toBeInTheDocument();
  });

  it('shows the hook-normalized legacy fallback count', () => {
    useDiagnosisStatus.mockReturnValue(hookValue({
      saikaku: statusOf({ committedCount: 1, hasResult: true }),
      uaam: statusOf(),
    }));

    renderSelect();

    expect(screen.getByTestId('badge-saikaku')).toHaveTextContent('(1/2)');
  });

  it('shows uaam badge independently from saikaku', () => {
    useDiagnosisStatus.mockReturnValue(hookValue({
      saikaku: statusOf(),
      uaam: statusOf({ committedCount: 1, hasResult: true }),
    }));

    renderSelect();

    expect(screen.queryByTestId('badge-saikaku')).toBeNull();
    expect(screen.getByTestId('badge-uaam')).toHaveTextContent('診断済み (1/2)');
  });

  it('shows history area and pending indicator for pending-only state', () => {
    useDiagnosisStatus.mockReturnValue(hookValue({
      saikaku: statusOf({ hasPending: true }),
      uaam: statusOf(),
    }));

    renderSelect();

    expect(screen.queryByTestId('badge-saikaku')).toBeNull();
    expect(screen.getByTestId('history-link-saikaku')).toHaveTextContent('履歴を見る (0)');
    expect(screen.getByText('処理中…')).toBeInTheDocument();
  });

  it('starts saikaku diagnosis when clicking the card title', async () => {
    const onSelectSaikaku = vi.fn();
    const onSelectHistory = vi.fn();
    useDiagnosisStatus.mockReturnValue(hookValue({
      saikaku: statusOf(),
      uaam: statusOf(),
    }));

    renderSelect({ onSelectSaikaku, onSelectHistory });

    await userEvent.click(screen.getByText('才覚領域'));

    expect(onSelectSaikaku).toHaveBeenCalledTimes(1);
    expect(onSelectHistory).not.toHaveBeenCalled();
  });

  it('does not start saikaku diagnosis when clicking the history button', async () => {
    const onSelectSaikaku = vi.fn();
    const onSelectHistory = vi.fn();
    useDiagnosisStatus.mockReturnValue(hookValue({
      saikaku: statusOf({ committedCount: 1, hasResult: true }),
      uaam: statusOf(),
    }));

    renderSelect({ onSelectSaikaku, onSelectHistory });

    await userEvent.click(screen.getByTestId('history-link-saikaku'));

    expect(onSelectHistory).toHaveBeenCalledTimes(1);
    expect(onSelectHistory).toHaveBeenCalledWith('saikaku');
    expect(onSelectSaikaku).not.toHaveBeenCalled();
  });

  it('shows a reloadable notice when diagnosis status loading fails', async () => {
    const refresh = vi.fn();
    useDiagnosisStatus.mockReturnValue(hookValue(null, 'fetch', refresh));

    renderSelect();

    expect(screen.getByRole('alert')).toHaveTextContent('読み込みに失敗しました');
    await userEvent.click(screen.getByRole('button', { name: '再読み込み' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('blocks both start buttons while diagnosis status loading has failed', async () => {
    const onSelectSaikaku = vi.fn();
    const onSelectUaam = vi.fn();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    useDiagnosisStatus.mockReturnValue(hookValue(null, 'fetch'));

    renderSelect({ onSelectSaikaku, onSelectUaam });

    await userEvent.click(screen.getByTestId('card-saikaku'));
    await userEvent.click(screen.getByTestId('card-uaam'));

    expect(onSelectSaikaku).not.toHaveBeenCalled();
    expect(onSelectUaam).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText('パスワード')).toBeNull();
    expect(alertSpy).toHaveBeenCalledTimes(2);
    expect(alertSpy).toHaveBeenCalledWith('読み込みに失敗しました。再読み込みしてください。');
  });
});
