// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CompatScreen from '../../src/compat/CompatScreen.jsx';
import CompatReport from '../../src/compat/CompatReport.jsx';

const profiles = ['Aさん', 'Bさん', 'Cさん'].map((displayName, index) => ({
  id: `member-${index}`,
  source: 'internal',
  displayName,
  profileVersion: 'v1',
  availability: {
    categories: {
      talent: { userTop5: true, generatedAxes: true },
      value: { userTop5: true, generatedAxes: true },
      passion: { userTop5: true, generatedAxes: true },
    },
    uaam: false,
  },
}));

function mockProfiles() {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ profiles, publicImport: { enabled: false, message: '取込無効' } }),
  })));
}

const reportFixture = {
  dataSufficiency: {
    summary: '範囲',
    memberAvailability: profiles.slice(0, 2).map((_profile, index) => ({
      alias: index === 0 ? 'A' : 'B',
      source: 'internal',
      categories: {
        talent: { userTop5: true, generatedAxes: true },
        value: { userTop5: true, generatedAxes: true },
        passion: { userTop5: true, generatedAxes: true },
      },
      uaam: false,
    })),
    limitations: [],
    uaam: { eligible: false, availableProfiles: 0, requiredProfiles: 2, minimumCohort: 30, reason: 'データ不足' },
  },
  lenses: [
    { id: 'similarity', status: 'not_detected', summary: '不検出', claims: [] },
    { id: 'complementarity', status: 'not_detected', summary: '不検出', claims: [] },
  ],
  evidence: [],
  ethicsNotice: '本結果は相互理解のための対話素材です。人事評価・採用評価には流用しません。',
  model: 'claude-sonnet-4-6',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('CompatScreen', () => {
  it('requires a team goal and consent before analysis', async () => {
    mockProfiles();
    render(<CompatScreen user={{ getIdToken: async () => 'token' }} onBack={() => {}} onLogout={() => {}} />);
    await screen.findByText('Aさん');
    fireEvent.click(screen.getByRole('button', { name: 'チーム（3名以上）' }));
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);
    fireEvent.click(screen.getByText(/対象者全員から/).closest('label').querySelector('input'));
    expect(screen.getByRole('button', { name: '相性を分析する' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/チームの目的/), { target: { value: '新規事業の検証' } });
    await waitFor(() => expect(screen.getByRole('button', { name: '相性を分析する' })).toBeEnabled());
  });

  it('keeps pair analysis disabled until consent is checked', async () => {
    mockProfiles();
    render(<CompatScreen user={{ getIdToken: async () => 'token' }} onBack={() => {}} onLogout={() => {}} />);
    await screen.findByText('Aさん');
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    expect(screen.getByRole('button', { name: '相性を分析する' })).toBeDisabled();
    fireEvent.click(screen.getByText(/対象者全員から/).closest('label').querySelector('input'));
    expect(screen.getByRole('button', { name: '相性を分析する' })).toBeEnabled();
  });

  it('renders 💡 もしかして？ from claim.kind', () => {
    render(<CompatReport result={{
      dataSufficiency: { summary: '範囲', memberAvailability: [], limitations: [] },
      lenses: [
        { id: 'similarity', status: 'detected', summary: '要約', claims: [{ text: '仮の読み', kind: 'hypothesis', evidenceIds: ['E-001'], verificationQuestion: '本当ですか？' }] },
        { id: 'complementarity', status: 'not_detected', summary: '不検出', claims: [] },
      ],
      ethicsNotice: '人事評価・採用評価には流用しません。',
    }} />);
    expect(screen.getByText('💡 もしかして？')).toBeInTheDocument();
  });

  it('gates share issuance by separate consent and shows the URL and revoke action', async () => {
    const fetchMock = vi.fn(async (path, options = {}) => {
      if (path === '/api/admin/compat-profiles') {
        return { ok: true, json: async () => ({ profiles, publicImport: { enabled: false, message: '取込無効' } }) };
      }
      if (path === '/api/admin/compat-analyze') {
        return { ok: true, json: async () => reportFixture };
      }
      if (path === '/api/admin/compat-share') {
        const body = JSON.parse(options.body);
        if (body.action === 'revoke') return { ok: true, json: async () => ({ revoked: true }) };
        return {
          ok: true,
          json: async () => ({
            shareId: '11111111-1111-4111-8111-111111111111',
            url: 'https://example.com/compat/share/11111111-1111-4111-8111-111111111111',
          }),
        };
      }
      throw new Error(`unexpected fetch: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<CompatScreen user={{ getIdToken: async () => 'token' }} onBack={() => {}} onLogout={() => {}} />);
    await screen.findByText('Aさん');
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByText(/対象者全員から/).closest('label').querySelector('input'));
    fireEvent.click(screen.getByRole('button', { name: '相性を分析する' }));

    const issueButton = await screen.findByRole('button', { name: '共有URLを発行' });
    expect(issueButton).toBeDisabled();
    fireEvent.click(screen.getByText('本結果の共有について、対象者全員の同意を確認しました').closest('label').querySelector('input'));
    expect(issueButton).toBeEnabled();
    fireEvent.click(issueButton);

    expect(await screen.findByDisplayValue(/\/compat\/share\/11111111-/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'コピー' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '失効させる' }));
    expect(await screen.findByText('この共有URLは失効しました。')).toBeInTheDocument();

    const issueRequest = fetchMock.mock.calls.find(([path, options]) => (
      path === '/api/admin/compat-share' && JSON.parse(options.body).consentConfirmed === true
    ));
    expect(issueRequest).toBeTruthy();
  });
});
