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
      alias: `M${index + 1}`,
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
  visual: {
    schemaVersion: 2,
    members: [
      { alias: 'M1', axes: { talent: ['構造化'], value: [], passion: [] } },
      { alias: 'M2', axes: { talent: ['対話'], value: [], passion: [] } },
    ],
    matches: [{ aliases: ['M1', 'M2'], category: 'talent', sourceKind: 'user_top5', terms: ['観察'] }],
    uaam: {
      eligible: false,
      axes: [],
      memberScores: { M1: { meaning: 20, mindfulness: 20 } },
    },
  },
  uaamMatrix: { memberScores: { M1: { meaning: 20, mindfulness: 20 } } },
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

  it('renders a clearly labeled hypothesis from claim.kind', () => {
    render(<CompatReport result={{
      dataSufficiency: { summary: '範囲', memberAvailability: [], limitations: [] },
      lenses: [
        { id: 'similarity', status: 'detected', summary: '要約', claims: [{ text: '仮の読み', kind: 'hypothesis', evidenceIds: ['E-001'], verificationQuestion: '本当ですか？' }] },
        { id: 'complementarity', status: 'not_detected', summary: '不検出', claims: [] },
      ],
      ethicsNotice: '人事評価・採用評価には流用しません。',
    }} />);
    expect(screen.getByText('💡 仮説（本人との確認が必要です）')).toBeInTheDocument();
  });

  it('shows real names in every report text surface while keeping aliases as secondary headings', () => {
    const namedReport = {
      dataSufficiency: {
        summary: 'M1とM2について確認できる範囲です。',
        memberAvailability: [
          { alias: 'M1', source: 'internal', categories: {}, uaam: false },
          { alias: 'M2', source: 'internal', categories: {}, uaam: false },
        ],
        limitations: ['M1:72 と M2:41 は別の位置です。'],
      },
      lenses: [
        {
          id: 'similarity',
          status: 'detected',
          summary: 'M1とM2には似ているところがあります。',
          claims: [{
            text: 'M1 の才能と M2 の才能に共通点があります。',
            kind: 'observation',
            evidenceIds: ['E-001'],
            verificationQuestion: 'M1とM2で判断が分かれた場面はありましたか？',
          }],
        },
        { id: 'complementarity', status: 'not_detected', summary: 'M1とM2の違いは不検出です。', claims: [] },
      ],
      evidence: [{ id: 'E-001', lens: 'similarity', kind: 'generated_axis', text: 'M1とM2の才能に生成済み軸があります。' }],
      ethicsNotice: '人事評価・採用評価には流用しません。',
    };

    const { container } = render(
      <CompatReport result={namedReport} memberLabels={['つかさ', '野田健一']} />,
    );

    expect(container).toHaveTextContent('つかさと野田健一について確認できる範囲です');
    expect(container).toHaveTextContent('つかさ:72 と 野田健一:41');
    expect(container).toHaveTextContent('つかさ の才能と 野田健一 の才能に共通点があります');
    expect(container).toHaveTextContent('つかさと野田健一で判断が分かれた場面');
    expect(container).toHaveTextContent('つかさと野田健一の才能に生成済み軸があります');
    expect(container).toHaveTextContent('各内容と根拠データの対応');
    expect(container.querySelector('.compat-availability-row strong')).toHaveTextContent('つかさM1');
  });

  it('gates share issuance by separate consent and shows the URL and revoke action', async () => {
    const fetchMock = vi.fn(async (path, options = {}) => {
      if (path === '/api/admin/compat-profiles') {
        return { ok: true, json: async () => ({ profiles, publicImport: { enabled: false, message: '取込無効' } }) };
      }
      if (path === '/api/admin/compat-analyze') {
        return { ok: true, json: async () => reportFixture };
      }
      if (path === '/api/admin/compat-recommend') {
        return { ok: true, json: async () => ({ stage: 'summary', shortages: [] }) };
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
    fireEvent.change(screen.getByRole('textbox', { name: 'M1 レポート表示名' }), { target: { value: 'つかさ' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'M2 レポート表示名' }), { target: { value: '野田健一' } });
    fireEvent.click(screen.getByText(/対象者全員から/).closest('label').querySelector('input'));
    fireEvent.click(screen.getByRole('button', { name: '相性を分析する' }));

    const issueButton = await screen.findByRole('button', { name: '共有URLを発行' });
    expect(screen.getByRole('heading', { name: 'チームの中にある力の地図' })).toBeInTheDocument();
    expect(issueButton).toBeDisabled();
    fireEvent.click(screen.getByText(/本人が入力した言葉はAIには送られません/).closest('label').querySelector('input'));
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
    const issueBody = JSON.parse(issueRequest[1].body);
    expect(issueBody.memberLabels).toEqual(['つかさ', '野田健一']);
    expect(issueBody.report).not.toHaveProperty('uaamMatrix');
    expect(issueBody.report.visual.uaam).not.toHaveProperty('memberScores');
  });

  it('shows aggregate facts first and reveals name-sorted cards only after the dedicated consent', async () => {
    const fetchMock = vi.fn(async (path, options = {}) => {
      if (path === '/api/admin/compat-profiles') {
        return { ok: true, json: async () => ({ profiles, publicImport: { enabled: false, message: '取込無効' } }) };
      }
      if (path === '/api/admin/compat-analyze') {
        return { ok: true, json: async () => reportFixture };
      }
      if (path === '/api/admin/compat-recommend') {
        const body = JSON.parse(options.body);
        if (body.action === 'search') {
          return {
            ok: true,
            json: async () => ({
              stage: 'summary',
              shortages: [
                { axisKey: 'meaning', axisLabel: '基軸力', missing: true, noData: false, candidateCount: 2 },
                { axisKey: 'logical', axisLabel: '論理力', missing: false, noData: true, candidateCount: 1 },
              ],
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            stage: 'names',
            candidates: [
              {
                profileId: 'candidate-a',
                displayName: 'あべ',
                matchedAxes: [{ axisKey: 'meaning', axisLabel: '基軸力', missing: true, noData: false }],
              },
              {
                profileId: 'candidate-b',
                displayName: 'いとう',
                matchedAxes: [{ axisKey: 'logical', axisLabel: '論理力', missing: false, noData: true }],
              },
            ],
          }),
        };
      }
      throw new Error(`unexpected fetch: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CompatScreen user={{ getIdToken: async () => 'token' }} onBack={() => {}} onLogout={() => {}} />);
    await screen.findByText('Aさん');
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByText(/対象者全員から/).closest('label').querySelector('input'));
    fireEvent.click(screen.getByRole('button', { name: '相性を分析する' }));

    const panel = await screen.findByRole('region', { name: 'チームにない力を持つ受講者を探す' });
    expect(panel).toHaveTextContent('チームで12点（発動の目安）未満、またはデータのない軸を、16点以上で持っている人を、名前の順で表示します');
    expect(panel).toHaveTextContent('人事・採用・配属の判断には使いません');
    expect(await screen.findByText(/基軸力（チームで12点未満）を16点以上で持つ受講者が 2人 います/)).toBeInTheDocument();
    expect(screen.getByText(/論理力（チームにデータなし）を16点以上で持つ受講者が 1人 います/)).toBeInTheDocument();
    expect(screen.queryByText('あべ')).not.toBeInTheDocument();
    expect(screen.queryByText('いとう')).not.toBeInTheDocument();

    const namesConsent = screen.getByText(/表示される候補者それぞれについて/).closest('label').querySelector('input');
    fireEvent.click(namesConsent);

    const candidateList = await screen.findByLabelText('氏名を表示した該当者一覧');
    expect(candidateList).toHaveTextContent('あべ');
    expect(candidateList).toHaveTextContent('いとう');
    expect(candidateList).toHaveTextContent('基軸力・チームで12点未満');
    expect(candidateList).toHaveTextContent('論理力・チームにデータなし');
    expect(candidateList).not.toHaveTextContent('1位');
    expect(candidateList).not.toHaveTextContent('2位');
    expect(candidateList.querySelector('.compat-badge')).toBeNull();
    expect(panel).toHaveTextContent('人事・採用・配属の判断には使いません');

    const recommendRequests = fetchMock.mock.calls
      .filter(([path]) => path === '/api/admin/compat-recommend')
      .map(([, options]) => JSON.parse(options.body));
    expect(recommendRequests).toEqual([
      expect.objectContaining({ action: 'search', consent: true }),
      expect.objectContaining({ action: 'show_names', consent: true }),
    ]);
  });
});
