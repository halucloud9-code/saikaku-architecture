// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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

import AdminScreen from '../AdminScreen';

const adminUser = { email: 'admin@example.com' };
const noop = () => {};

function response(status, body = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

function integrationFixture() {
  return [
    {
      uid: 'u-active',
      userName: 'Active User',
      userEmail: 'active@example.com',
      saikakuAttemptId: 'saikaku-active',
      uaamAttemptId: 'uaam-active',
      pairKey: 'saikaku-active__uaam-active',
      regenerationCount: 1,
      model: 'claude-sonnet-4-20250514',
      source: {
        saikakuLabel: 'Saikaku Active Label',
        uaamLabel: 'UAAM Active Label',
      },
      status: 'active',
      staleSaikaku: false,
      staleUaam: false,
      integration: {
        integration_score: 92,
        activation_core: 'Active Integration Core',
        activation_equation: 'Active Integration Core equation',
        coaching_questions: ['Admin should not edit this coaching question'],
      },
      createdAt: '2026-05-04T00:00:00.000Z',
      updatedAt: '2026-05-04T00:00:00.000Z',
      isLegacyFallback: false,
    },
    {
      uid: 'u-stale-saikaku',
      userName: 'Stale Saikaku User',
      userEmail: 'stale-saikaku@example.com',
      saikakuAttemptId: 'saikaku-old',
      uaamAttemptId: 'uaam-current',
      pairKey: 'saikaku-old__uaam-current',
      regenerationCount: 0,
      model: null,
      source: {
        saikakuLabel: 'Stale Saikaku Label',
        uaamLabel: 'Current UAAM Label',
      },
      status: 'stale',
      staleSaikaku: true,
      staleUaam: false,
      integration: {
        integration_score: 63,
        activation_core: 'Stale Saikaku Core',
      },
      createdAt: '2026-05-03T00:00:00.000Z',
      updatedAt: '2026-05-03T00:00:00.000Z',
      isLegacyFallback: false,
    },
    {
      uid: 'u-stale-uaam',
      userName: null,
      userEmail: null,
      saikakuAttemptId: 'saikaku-current',
      uaamAttemptId: 'uaam-old',
      pairKey: 'saikaku-current__uaam-old',
      regenerationCount: 0,
      model: 'model-b',
      source: null,
      status: 'stale',
      staleSaikaku: false,
      staleUaam: true,
      integration: null,
      createdAt: null,
      updatedAt: null,
      isLegacyFallback: false,
    },
    {
      uid: 'u-legacy',
      userName: 'Legacy User',
      userEmail: 'legacy@example.com',
      saikakuAttemptId: 'legacy-fallback',
      uaamAttemptId: 'legacy-fallback',
      pairKey: 'legacy-fallback__legacy-fallback',
      regenerationCount: 0,
      model: 'unknown-legacy',
      source: {
        saikakuLabel: 'Legacy Saikaku Label',
        uaamLabel: 'Legacy UAAM Label',
      },
      status: 'active',
      staleSaikaku: false,
      staleUaam: false,
      integration: {
        integration_score: 77,
        activation_core: 'Legacy Integration Core',
      },
      createdAt: '2026-05-05T00:00:00.000Z',
      updatedAt: '2026-05-05T00:00:00.000Z',
      isLegacyFallback: true,
    },
  ];
}

function installFetchMock(integrations = integrationFixture()) {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (url === '/api/admin/users') {
      return response(200, {
        users: [{ uid: 'u-saikaku', name: 'Saikaku User', email: 'saikaku@example.com' }],
        uaamUsers: [{ uid: 'u-uaam', name: 'UAAM User', email: 'uaam@example.com' }],
      });
    }
    if (url === '/api/admin/integrations') {
      return response(200, { integrations });
    }
    throw new Error(`unexpected fetch: ${url}`);
  }));
}

async function renderAdminAndOpenIntegrations() {
  render(<AdminScreen user={adminUser} onBack={noop} onLogout={noop} />);
  const tab = screen.getByRole('button', { name: '統合分析（—）' });
  await userEvent.click(tab);
  return screen.findByRole('table', { name: '統合分析一覧' });
}

describe('AdminScreen integrations tab', () => {
  beforeEach(() => {
    firebaseMocks.getIdToken.mockResolvedValue('id-token');
    installFetchMock();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('defers fetching admin integrations until the integrations tab is opened', async () => {
    render(<AdminScreen user={adminUser} onBack={noop} onLogout={noop} />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/users', {
        headers: { Authorization: 'Bearer id-token' },
      });
    });

    expect(fetch.mock.calls.map(([url]) => url)).not.toContain('/api/admin/integrations');
    expect(screen.getByRole('button', { name: '統合分析（—）' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '統合分析（—）' }));

    await screen.findByRole('table', { name: '統合分析一覧' });
    expect(fetch).toHaveBeenCalledWith('/api/admin/integrations', {
      headers: { Authorization: 'Bearer id-token' },
    });
    expect(screen.getByRole('button', { name: '統合分析（4）' })).toBeInTheDocument();
  });

  it('fetches admin integrations and renders the integrations tab with six table columns', async () => {
    const table = await renderAdminAndOpenIntegrations();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/integrations', {
        headers: { Authorization: 'Bearer id-token' },
      });
    });

    [
      'ユーザー',
      '才覚 label',
      'UAAM label',
      '再生成回数',
      'integration_score',
      '更新日時',
    ].forEach((header) => {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(6);
    ['メール', 'model', 'status', 'createdAt'].forEach((header) => {
      expect(screen.queryByRole('columnheader', { name: header })).toBeNull();
    });

    const activeRow = screen.getByText('Active User').closest('tr');
    expect(within(activeRow).getByText('active@example.com')).toBeInTheDocument();
    expect(within(activeRow).getByText('Saikaku Active Label')).toBeInTheDocument();
    expect(within(activeRow).getByText('UAAM Active Label')).toBeInTheDocument();
    expect(within(activeRow).getByText('1')).toBeInTheDocument();
    expect(within(activeRow).getByText('再生成')).toBeInTheDocument();
    expect(within(activeRow).getByText('92')).toBeInTheDocument();
    expect(within(activeRow).queryByText('claude-sonnet-4-20250514')).toBeNull();
    expect(within(activeRow).getAllByText(new Date('2026-05-04T00:00:00.000Z').toLocaleString('ja-JP'))).toHaveLength(1);

    const staleSaikakuRow = screen.getByText('Stale Saikaku User').closest('tr');
    expect(within(staleSaikakuRow).queryByText('stale')).toBeNull();
    expect(within(staleSaikakuRow).queryByText('才覚側 stale')).toBeNull();
    expect(within(staleSaikakuRow).getByText('63')).toBeInTheDocument();

    const rows = within(table).getAllByRole('row');
    const staleUaamRow = rows[3];
    expect(within(staleUaamRow).queryByText('UAAM側 stale')).toBeNull();
    expect(within(staleUaamRow).queryByText('model-b')).toBeNull();
    expect(within(staleUaamRow).getAllByText('—').length).toBeGreaterThanOrEqual(4);

    const legacyRow = screen.getByText('Legacy User').closest('tr');
    expect(within(legacyRow).getByText('Legacy Saikaku Label')).toBeInTheDocument();
    expect(within(legacyRow).getByText('Legacy UAAM Label')).toBeInTheDocument();
    expect(within(legacyRow).getAllByText('(legacy)')).toHaveLength(2);
    expect(within(legacyRow).queryByText('移行前')).toBeNull();
  });

  it('refreshes integrations when the update button is clicked', async () => {
    await renderAdminAndOpenIntegrations();

    await waitFor(() => {
      expect(fetch.mock.calls.filter(([url]) => url === '/api/admin/integrations')).toHaveLength(1);
    });

    await userEvent.click(screen.getByRole('button', { name: '更新' }));

    await waitFor(() => {
      expect(fetch.mock.calls.filter(([url]) => url === '/api/admin/integrations')).toHaveLength(2);
    });
  });

  it('opens the shared read-only integration modal in admin mode and closes it with Escape', async () => {
    await renderAdminAndOpenIntegrations();

    await userEvent.click(screen.getByText('Active User').closest('tr'));

    const dialog = await screen.findByRole('dialog', { name: '才覚発動統合分析' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('Active User')).toBeInTheDocument();
    expect(within(dialog).getByText('active@example.com')).toBeInTheDocument();
    expect(within(dialog).getAllByText(/Active Integration Core/).length).toBeGreaterThan(0);
    expect(within(dialog).getByText(/Saikaku Active Label/)).toBeInTheDocument();
    expect(within(dialog).getByText(/UAAM Active Label/)).toBeInTheDocument();
    expect(within(dialog).queryByText('Admin should not edit this coaching question')).toBeNull();
    expect(within(dialog).queryByPlaceholderText('あなたの考えを書いてみてください')).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /保存|削除|再生成/ })).toBeNull();
    expect(fetch.mock.calls.map(([url]) => url)).not.toContain('/api/me/coaching-answers');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '才覚発動統合分析' })).toBeNull();
    });
  });
});
