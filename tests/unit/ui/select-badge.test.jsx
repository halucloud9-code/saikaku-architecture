// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

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

function renderSelect() {
  return render(
    <SelectScreen
      user={user}
      isAdmin={false}
      onSelectSaikaku={noop}
      onSelectUaam={noop}
      onSelectHistory={noop}
      onAdmin={noop}
      onLogout={noop}
    />,
  );
}

describe('SelectScreen badge', () => {
  it('hides badges while loading', () => {
    useDiagnosisStatus.mockReturnValue(null);

    renderSelect();

    expect(screen.queryByTestId('badge-saikaku')).toBeNull();
    expect(screen.queryByText(/診断済み/)).toBeNull();
  });

  it('shows 1/2 for saikaku when attemptCount=1', () => {
    useDiagnosisStatus.mockReturnValue({
      saikaku: statusOf({ committedCount: 1, hasResult: true }),
      uaam: statusOf(),
    });

    renderSelect();

    expect(screen.getByTestId('badge-saikaku')).toHaveTextContent('診断済み (1/2)');
    expect(screen.getByTestId('history-link-saikaku')).toHaveTextContent('履歴を見る (1)');
  });

  it('shows 2/2 and the limit notice for saikaku', () => {
    useDiagnosisStatus.mockReturnValue({
      saikaku: statusOf({ committedCount: 2, hasResult: true }),
      uaam: statusOf(),
    });

    renderSelect();

    expect(screen.getByTestId('badge-saikaku')).toHaveTextContent('診断済み (2/2)');
    expect(screen.getByText('診断は最大2回まで実施済み')).toBeInTheDocument();
  });

  it('shows the hook-normalized legacy fallback count', () => {
    useDiagnosisStatus.mockReturnValue({
      saikaku: statusOf({ committedCount: 1, hasResult: true }),
      uaam: statusOf(),
    });

    renderSelect();

    expect(screen.getByTestId('badge-saikaku')).toHaveTextContent('(1/2)');
  });

  it('shows uaam badge independently from saikaku', () => {
    useDiagnosisStatus.mockReturnValue({
      saikaku: statusOf(),
      uaam: statusOf({ committedCount: 1, hasResult: true }),
    });

    renderSelect();

    expect(screen.queryByTestId('badge-saikaku')).toBeNull();
    expect(screen.getByTestId('badge-uaam')).toHaveTextContent('診断済み (1/2)');
  });

  it('shows history area and pending indicator for pending-only state', () => {
    useDiagnosisStatus.mockReturnValue({
      saikaku: statusOf({ hasPending: true }),
      uaam: statusOf(),
    });

    renderSelect();

    expect(screen.queryByTestId('badge-saikaku')).toBeNull();
    expect(screen.getByTestId('history-link-saikaku')).toHaveTextContent('履歴を見る (0)');
    expect(screen.getByText('処理中…')).toBeInTheDocument();
  });
});
