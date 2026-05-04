// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const firebaseMocks = vi.hoisted(() => ({
  getIdToken: vi.fn(),
  signOutUser: vi.fn(),
}));

vi.mock('../../firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: firebaseMocks.getIdToken,
    },
  },
  signOutUser: firebaseMocks.signOutUser,
}));

import HistoryScreen from '../HistoryScreen';

const user = { uid: 'u-history-integration', displayName: 'Test User' };
const noop = () => {};

function response(status, body = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

function historyBody(attempts) {
  return {
    attempts,
    pendingAttempt: null,
    summary: {
      committedCount: attempts.length,
      attemptCount: attempts.length,
      hasPending: false,
      pendingAttemptId: null,
      hasResult: attempts.length > 0,
      isStartBlocked: false,
    },
  };
}

function integration(core, overrides = {}) {
  return {
    exists: true,
    integration: {
      integration_score: 84,
      activation_core: core,
      activation_equation: `${core} equation`,
    },
    integrationScore: 84,
    activationCore: core,
    saikakuAttemptId: 'saikaku-a',
    uaamAttemptId: 'uaam-a',
    status: 'active',
    regenerationCount: 0,
    generatedAt: '2026-05-04T00:00:00.000Z',
    source: {
      saikakuLabel: '才覚A',
      uaamLabel: 'UAAM A',
      saikakuDate: '2026-05-01T00:00:00.000Z',
      uaamDate: '2026-05-02T00:00:00.000Z',
    },
    ...overrides,
  };
}

function renderHistory(kind) {
  return render(
    <HistoryScreen
      user={user}
      kind={kind}
      onBack={noop}
      onSelectAttemptId={noop}
      onLogout={noop}
    />,
  );
}

describe('HistoryScreen integration banners', () => {
  beforeEach(() => {
    firebaseMocks.getIdToken.mockResolvedValue('id-token');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders a banner for a Saikaku item with integrationSummaries and opens the modal', async () => {
    const clicker = userEvent.setup();
    fetch.mockResolvedValueOnce(response(200, historyBody([
      {
        id: 'saikaku-a',
        status: 'committed',
        summary: {
          kakuchiiki: '才覚A',
          createdAt: '2026-05-01T00:00:00.000Z',
        },
        createdAt: '2026-05-01T00:00:00.000Z',
        integrationSummaries: [
          integration('Saikaku Core', {
            generatedAt: '2026-05-04T00:00:00.000Z',
          }),
        ],
      },
    ])));

    renderHistory('saikaku');

    const banner = await screen.findByRole('button', { name: '統合分析あり (1)' });
    await clicker.click(banner);

    expect(await screen.findByRole('dialog', { name: '才覚発動統合分析' })).toBeInTheDocument();
    expect(screen.getByText('Saikaku Core')).toBeInTheDocument();
  });

  it('renders a banner for a UAAM item with integrationSummary.exists and opens the modal', async () => {
    const clicker = userEvent.setup();
    fetch.mockResolvedValueOnce(response(200, historyBody([
      {
        id: 'uaam-a',
        status: 'committed',
        summary: {
          typeName: 'UAAM A',
          createdAt: '2026-05-02T00:00:00.000Z',
        },
        createdAt: '2026-05-02T00:00:00.000Z',
        integrationSummary: integration('UAAM Core'),
      },
    ])));

    renderHistory('uaam');

    const banner = await screen.findByRole('button', { name: '統合分析あり (1)' });
    await clicker.click(banner);

    expect(await screen.findByRole('dialog', { name: '才覚発動統合分析' })).toBeInTheDocument();
    expect(screen.getByText('UAAM Core')).toBeInTheDocument();
  });

  it('does not render a banner for an item without integration data', async () => {
    fetch.mockResolvedValueOnce(response(200, historyBody([
      {
        id: 'saikaku-empty',
        status: 'committed',
        summary: {
          kakuchiiki: '才覚のみ',
          createdAt: '2026-05-01T00:00:00.000Z',
        },
        createdAt: '2026-05-01T00:00:00.000Z',
        integrationSummaries: [],
      },
    ])));

    renderHistory('saikaku');

    expect(await screen.findByText('才覚のみ')).toBeInTheDocument();
    expect(screen.queryByTestId('integration-banner')).toBeNull();
  });
});
