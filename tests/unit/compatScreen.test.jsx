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
const recommendationSnapshot = 'a'.repeat(64);

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

const soloSubjectFixture = {
  displayName: 'Aさん',
  uaamMatrix: reportFixture.uaamMatrix,
  generatedAxes: {
    talent: ['構造化'],
    value: ['誠実'],
    passion: ['探究'],
  },
  availability: {
    ...profiles[0].availability,
    uaam: true,
  },
};

function soloSummaryResponse(overrides = {}) {
  return {
    stage: 'summary',
    shortages: [],
    rankingSummary: {
      eligible: true,
      reason: null,
      matchedCount: 1,
      excludedForMissingAxes: 0,
      truncated: 0,
    },
    snapshot: recommendationSnapshot,
    subject: soloSubjectFixture,
    ...overrides,
  };
}

async function runPairAnalysis() {
  await screen.findByText('Aさん');
  fireEvent.click(screen.getByText('Aさん').closest('label').querySelector('input'));
  fireEvent.click(screen.getByText('Bさん').closest('label').querySelector('input'));
  fireEvent.click(screen.getByText(/対象者全員から/).closest('label').querySelector('input'));
  fireEvent.click(screen.getByRole('button', { name: '相性を分析する' }));
}

async function runSoloSearch() {
  await screen.findByText('Aさん');
  fireEvent.click(screen.getByRole('button', { name: '1人' }));
  fireEvent.click(screen.getByText('Aさん').closest('label').querySelector('input'));
  fireEvent.click(screen.getByText(/対象者全員から/).closest('label').querySelector('input'));
  fireEvent.click(screen.getByRole('button', { name: '力マップと相性を見る' }));
}

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
        return { ok: true, json: async () => ({ stage: 'summary', shortages: [], snapshot: recommendationSnapshot }) };
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
    expect(screen.getByRole('heading', { name: 'チーム発動領域Matrix' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'M1 レポート表示名' }), { target: { value: '分析後に入力した別人名' } });
    expect(screen.getAllByText('つかさ').length).toBeGreaterThan(0);
    expect(screen.queryByText('分析後に入力した別人名')).not.toBeInTheDocument();
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
    expect(issueBody.uaamMatrix).toEqual(reportFixture.uaamMatrix);
    expect(issueBody.report).not.toHaveProperty('uaamMatrix');
    expect(issueBody.report.visual.uaam).not.toHaveProperty('memberScores');
  });

  it('revokes an issued share without showing its URL when the response becomes stale', async () => {
    let resolveIssue;
    const issueResponse = new Promise((resolve) => { resolveIssue = resolve; });
    const fetchMock = vi.fn(async (path, options = {}) => {
      if (path === '/api/admin/compat-profiles') {
        return { ok: true, json: async () => ({ profiles, publicImport: { enabled: false, message: '取込無効' } }) };
      }
      if (path === '/api/admin/compat-analyze') {
        return { ok: true, json: async () => reportFixture };
      }
      if (path === '/api/admin/compat-recommend') {
        return { ok: true, json: async () => ({ stage: 'summary', shortages: [], snapshot: recommendationSnapshot }) };
      }
      if (path === '/api/admin/compat-share') {
        const body = JSON.parse(options.body);
        if (body.action === 'revoke') {
          return { ok: true, json: async () => ({ shareId: body.shareId, revoked: true }) };
        }
        return issueResponse;
      }
      throw new Error(`unexpected fetch: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CompatScreen user={{ getIdToken: async () => 'token' }} onBack={() => {}} onLogout={() => {}} />);
    await screen.findByText('Aさん');
    const profileCheckboxes = screen.getAllByRole('checkbox');
    fireEvent.click(profileCheckboxes[0]);
    fireEvent.click(profileCheckboxes[1]);
    fireEvent.click(screen.getByText(/対象者全員から/).closest('label').querySelector('input'));
    fireEvent.click(screen.getByRole('button', { name: '相性を分析する' }));

    const issueButton = await screen.findByRole('button', { name: '共有URLを発行' });
    fireEvent.click(screen.getByText(/本人が入力した言葉はAIには送られません/).closest('label').querySelector('input'));
    fireEvent.click(issueButton);
    await waitFor(() => expect(fetchMock.mock.calls.some(([path, options]) => (
      path === '/api/admin/compat-share'
      && JSON.parse(options.body).consentConfirmed === true
    ))).toBe(true));

    fireEvent.click(profileCheckboxes[1]);
    resolveIssue({
      ok: true,
      json: async () => ({
        shareId: '11111111-1111-4111-8111-111111111111',
        url: 'https://example.com/compat/share/11111111-1111-4111-8111-111111111111',
      }),
    });

    await waitFor(() => expect(fetchMock.mock.calls.some(([path, options]) => {
      if (path !== '/api/admin/compat-share') return false;
      const body = JSON.parse(options.body);
      return body.action === 'revoke'
        && body.shareId === '11111111-1111-4111-8111-111111111111';
    })).toBe(true));
    expect(screen.queryByDisplayValue(/\/compat\/share\/11111111-/)).not.toBeInTheDocument();
  });

  it('discards an analysis response after the selected members have changed', async () => {
    let resolveAnalyze;
    const analyzeResponse = new Promise((resolve) => { resolveAnalyze = resolve; });
    const fetchMock = vi.fn(async (path) => {
      if (path === '/api/admin/compat-profiles') {
        return { ok: true, json: async () => ({ profiles, publicImport: { enabled: false, message: '取込無効' } }) };
      }
      if (path === '/api/admin/compat-analyze') return analyzeResponse;
      if (path === '/api/admin/compat-recommend') {
        return { ok: true, json: async () => ({ stage: 'summary', shortages: [], snapshot: recommendationSnapshot }) };
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
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/admin/compat-analyze', expect.any(Object)));

    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);
    resolveAnalyze({ ok: true, json: async () => reportFixture });

    await waitFor(() => expect(screen.getByRole('button', { name: '相性を分析する' })).toBeEnabled());
    expect(screen.queryByLabelText('相性分析結果')).toBeNull();
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/admin/compat-recommend')).toHaveLength(0);
  });

  it('releases analyzing as soon as the report arrives while recommendation keeps its own loading state', async () => {
    let resolveRecommendation;
    const recommendationResponse = new Promise((resolve) => { resolveRecommendation = resolve; });
    const fetchMock = vi.fn(async (path) => {
      if (path === '/api/admin/compat-profiles') {
        return { ok: true, json: async () => ({ profiles, publicImport: { enabled: false, message: '取込無効' } }) };
      }
      if (path === '/api/admin/compat-analyze') {
        return { ok: true, json: async () => reportFixture };
      }
      if (path === '/api/admin/compat-recommend') return recommendationResponse;
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

    expect(await screen.findByLabelText('相性分析結果')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '相性を分析する' })).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('該当人数を集計しています…');

    resolveRecommendation({
      ok: true,
      json: async () => ({ stage: 'summary', shortages: [], snapshot: recommendationSnapshot }),
    });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('該当人数の集計が完了しました。'));
  });

  it('shows an error when a successful analysis response contains invalid JSON', async () => {
    const fetchMock = vi.fn(async (path) => {
      if (path === '/api/admin/compat-profiles') {
        return { ok: true, json: async () => ({ profiles, publicImport: { enabled: false, message: '取込無効' } }) };
      }
      if (path === '/api/admin/compat-analyze') {
        return {
          ok: true,
          json: async () => { throw new SyntaxError('broken JSON'); },
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

    expect(await screen.findByRole('alert')).toHaveTextContent('通信の応答を読み取れませんでした');
    expect(screen.queryByLabelText('相性分析結果')).toBeNull();
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
              snapshot: recommendationSnapshot,
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
                displayName: 'あべ',
                matchedAxes: [{ axisKey: 'meaning', axisLabel: '基軸力', missing: true, noData: false }],
              },
              {
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
    expect(screen.getByRole('status')).toHaveTextContent('該当人数の集計が完了しました。');

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
    expect(screen.getByRole('status')).toHaveTextContent('氏名の読み込みが完了しました。');

    const recommendRequests = fetchMock.mock.calls
      .filter(([path]) => path === '/api/admin/compat-recommend')
      .map(([, options]) => JSON.parse(options.body));
    expect(recommendRequests).toEqual([
      expect.objectContaining({ action: 'search', consent: true }),
      expect.objectContaining({ action: 'show_names', consent: true, snapshot: recommendationSnapshot }),
    ]);
  });

  it('refreshes the aggregate and unchecks name consent after a stale snapshot response', async () => {
    let searchCount = 0;
    const refreshedSnapshot = 'b'.repeat(64);
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
          searchCount += 1;
          return {
            ok: true,
            json: async () => ({
              stage: 'summary',
              snapshot: searchCount === 1 ? recommendationSnapshot : refreshedSnapshot,
              shortages: [{
                axisKey: 'meaning',
                axisLabel: '基軸力',
                missing: true,
                noData: false,
                candidateCount: searchCount === 1 ? 1 : 2,
              }],
            }),
          };
        }
        return {
          ok: false,
          status: 409,
          json: async () => ({
            code: 'RECOMMENDATION_SNAPSHOT_STALE',
            error: 'データが更新されました。もう一度検索してください',
          }),
        };
      }
      throw new Error(`unexpected fetch: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CompatScreen user={{ getIdToken: async () => 'token' }} onBack={() => {}} onLogout={() => {}} />);
    await screen.findByText('Aさん');
    const profileCheckboxes = screen.getAllByRole('checkbox');
    fireEvent.click(profileCheckboxes[0]);
    fireEvent.click(profileCheckboxes[1]);
    fireEvent.click(screen.getByText(/対象者全員から/).closest('label').querySelector('input'));
    fireEvent.click(screen.getByRole('button', { name: '相性を分析する' }));

    expect(await screen.findByText(/基軸力（チームで12点未満）を16点以上で持つ受講者が 1人 います/)).toBeInTheDocument();
    const namesConsent = screen.getByText(/表示される候補者それぞれについて/).closest('label').querySelector('input');
    fireEvent.click(namesConsent);

    expect(await screen.findByText(/基軸力（チームで12点未満）を16点以上で持つ受講者が 2人 います/)).toBeInTheDocument();
    const refreshedNamesConsent = screen.getByText(/表示される候補者それぞれについて/).closest('label').querySelector('input');
    expect(refreshedNamesConsent).not.toBeChecked();
    expect(screen.getByRole('alert')).toHaveTextContent('データが更新されました。もう一度検索してください');

    const requests = fetchMock.mock.calls
      .filter(([path]) => path === '/api/admin/compat-recommend')
      .map(([, options]) => JSON.parse(options.body));
    expect(requests).toEqual([
      expect.objectContaining({ action: 'search' }),
      expect.objectContaining({ action: 'show_names', snapshot: recommendationSnapshot }),
      expect.objectContaining({ action: 'search' }),
    ]);
  });

  it('uses compat-recommend, never compat-analyze, when running 1-person mode', async () => {
    const fetchMock = vi.fn(async (path) => {
      if (path === '/api/admin/compat-profiles') {
        return { ok: true, json: async () => ({ profiles, publicImport: { enabled: true, message: '取込可能' } }) };
      }
      if (path === '/api/admin/compat-recommend') {
        return { ok: true, json: async () => soloSummaryResponse() };
      }
      throw new Error(`unexpected fetch: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CompatScreen user={{ getIdToken: async () => 'token' }} onBack={() => {}} onLogout={() => {}} />);
    await runSoloSearch();

    expect(await screen.findByRole('heading', { name: '発動領域Matrix' })).toBeInTheDocument();
    expect(screen.getByText('構造化')).toBeInTheDocument();
    expect(screen.queryByText('公開アプリから追加')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([path]) => path === '/api/admin/compat-analyze')).toBe(false);
    const recommendCalls = fetchMock.mock.calls.filter(([path]) => path === '/api/admin/compat-recommend');
    expect(recommendCalls).toHaveLength(1);
    expect(JSON.parse(recommendCalls[0][1].body)).toEqual(expect.objectContaining({
      action: 'search',
      consent: true,
      members: [{ source: 'internal', id: 'member-0' }],
    }));
  });

  it('does not render the share URL section in 1-person mode', async () => {
    const fetchMock = vi.fn(async (path) => {
      if (path === '/api/admin/compat-profiles') {
        return { ok: true, json: async () => ({ profiles, publicImport: { enabled: false, message: '取込無効' } }) };
      }
      if (path === '/api/admin/compat-recommend') {
        return { ok: true, json: async () => soloSummaryResponse() };
      }
      throw new Error(`unexpected fetch: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CompatScreen user={{ getIdToken: async () => 'token' }} onBack={() => {}} onLogout={() => {}} />);
    await runSoloSearch();

    expect(await screen.findByLabelText('Aさんの診断結果')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '分析結果の共有' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '共有URLを発行' })).not.toBeInTheDocument();
  });

  it('removes team-only wording from every rendered recommendation surface in 1-person mode', async () => {
    const fetchMock = vi.fn(async (path, options = {}) => {
      if (path === '/api/admin/compat-profiles') {
        return { ok: true, json: async () => ({ profiles, publicImport: { enabled: false, message: '取込無効' } }) };
      }
      if (path === '/api/admin/compat-recommend') {
        const body = JSON.parse(options.body);
        if (body.action === 'search') {
          return {
            ok: true,
            json: async () => soloSummaryResponse({
              shortages: [
                { axisKey: 'meaning', axisLabel: '基軸力', missing: true, noData: false, candidateCount: 1 },
                { axisKey: 'logical', axisLabel: '論理力', missing: false, noData: true, candidateCount: 1 },
              ],
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            stage: 'names',
            candidates: [{
              displayName: 'Bさん',
              matchedAxes: [
                { axisKey: 'meaning', axisLabel: '基軸力', missing: true, noData: false },
                { axisKey: 'logical', axisLabel: '論理力', missing: false, noData: true },
              ],
            }],
            ranking: [{
              displayName: 'Bさん',
              combinationLearningIndex: 82,
              distinctCells: 47,
              levelGapTenths: 16,
            }],
          }),
        };
      }
      throw new Error(`unexpected fetch: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CompatScreen user={{ getIdToken: async () => 'token' }} onBack={() => {}} onLogout={() => {}} />);
    await runSoloSearch();

    const panel = await screen.findByRole('region', { name: 'この人にない力を持つ受講者を探す' });
    fireEvent.click(screen.getByText(/表示される候補者それぞれについて/).closest('label').querySelector('input'));
    await screen.findByLabelText('氏名を表示した該当者一覧');

    expect(panel).toHaveTextContent('この人が12点（発動の目安）未満');
    expect(panel).toHaveTextContent('基軸力（12点未満）');
    expect(panel).toHaveTextContent('論理力（データなし）');
    expect(panel).not.toHaveTextContent('チームにない');
    expect(panel).not.toHaveTextContent('チームで12点');
    expect(panel).not.toHaveTextContent('チームにデータなし');
  });

  it('preserves team wording across recommendation surfaces for 3-member mode', async () => {
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
              snapshot: recommendationSnapshot,
              shortages: [
                { axisKey: 'meaning', axisLabel: '基軸力', missing: true, noData: false, candidateCount: 1 },
                { axisKey: 'logical', axisLabel: '論理力', missing: false, noData: true, candidateCount: 1 },
              ],
              rankingSummary: {
                eligible: true,
                reason: null,
                matchedCount: 1,
                excludedForMissingAxes: 0,
                truncated: 0,
              },
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            stage: 'names',
            candidates: [{
              displayName: '候補者',
              matchedAxes: [
                { axisKey: 'meaning', axisLabel: '基軸力', missing: true, noData: false },
                { axisKey: 'logical', axisLabel: '論理力', missing: false, noData: true },
              ],
            }],
            ranking: [],
          }),
        };
      }
      throw new Error(`unexpected fetch: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CompatScreen user={{ getIdToken: async () => 'token' }} onBack={() => {}} onLogout={() => {}} />);
    await screen.findByText('Aさん');
    fireEvent.click(screen.getByRole('button', { name: 'チーム（3名以上）' }));
    profiles.forEach((profile) => {
      fireEvent.click(screen.getByText(profile.displayName).closest('label').querySelector('input'));
    });
    fireEvent.change(screen.getByLabelText(/チームの目的/), { target: { value: '相互理解' } });
    fireEvent.click(screen.getByText(/対象者全員から/).closest('label').querySelector('input'));
    fireEvent.click(screen.getByRole('button', { name: '相性を分析する' }));

    const panel = await screen.findByRole('region', { name: 'チームにない力を持つ受講者を探す' });
    fireEvent.click(await screen.findByText(/表示される候補者それぞれについて/).then((node) => node.closest('label').querySelector('input')));
    await screen.findByLabelText('氏名を表示した該当者一覧');

    expect(panel).toHaveTextContent('チームにない');
    expect(panel).toHaveTextContent('チームで12点');
    expect(panel).toHaveTextContent('チームにデータなし');
  });

  it('reveals ranking index values only after per-candidate consent', async () => {
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
              shortages: [{
                axisKey: 'meaning',
                axisLabel: '基軸力',
                missing: true,
                noData: false,
                candidateCount: 1,
              }],
              rankingSummary: {
                eligible: true,
                reason: null,
                matchedCount: 1,
                excludedForMissingAxes: 0,
                truncated: 0,
              },
              snapshot: recommendationSnapshot,
              subject: null,
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            stage: 'names',
            candidates: [{
              displayName: 'Cさん',
              matchedAxes: [{ axisKey: 'meaning', axisLabel: '基軸力', missing: true, noData: false }],
            }],
            ranking: [{
              displayName: 'Cさん',
              combinationLearningIndex: 82,
              distinctCells: 47,
              levelGapTenths: 16,
            }],
            subject: null,
          }),
        };
      }
      throw new Error(`unexpected fetch: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CompatScreen user={{ getIdToken: async () => 'token' }} onBack={() => {}} onLogout={() => {}} />);
    await runPairAnalysis();

    expect(await screen.findByRole('heading', { name: '学び合いやすい組み合わせ' })).toBeInTheDocument();
    expect(screen.queryByText('82点')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/表示される候補者それぞれについて/).closest('label').querySelector('input'));

    const ranking = await screen.findByRole('list', { name: '学び合いやすい組み合わせの候補者ランキング' });
    expect(ranking).toHaveTextContent('Cさん');
    expect(ranking).toHaveTextContent('この組み合わせの学び合い指標82点');
    expect(ranking).toHaveTextContent('120マスのうち47マスが、どちらか片方だけ発動');
    expect(ranking).toHaveTextContent('平均点の差 1.6点');
    expect(ranking).toHaveTextContent('基軸力・チームで12点未満');
  });

  it('renders non-zero ranking notices and omits both notices when their counts are zero', async () => {
    const makeFetchMock = (rankingSummary) => vi.fn(async (path) => {
      if (path === '/api/admin/compat-profiles') {
        return { ok: true, json: async () => ({ profiles, publicImport: { enabled: false, message: '取込無効' } }) };
      }
      if (path === '/api/admin/compat-analyze') {
        return { ok: true, json: async () => reportFixture };
      }
      if (path === '/api/admin/compat-recommend') {
        return {
          ok: true,
          json: async () => ({
            stage: 'summary',
            shortages: [],
            rankingSummary,
            snapshot: recommendationSnapshot,
            subject: null,
          }),
        };
      }
      throw new Error(`unexpected fetch: ${path}`);
    });

    vi.stubGlobal('fetch', makeFetchMock({
      eligible: true,
      reason: null,
      matchedCount: 13,
      truncated: 3,
      excludedForMissingAxes: 2,
    }));
    const firstRender = render(<CompatScreen user={{ getIdToken: async () => 'token' }} onBack={() => {}} onLogout={() => {}} />);
    await runPairAnalysis();
    expect(await screen.findByText('ほかに3人が条件に合いましたが、上位10人まで表示しています')).toBeInTheDocument();
    expect(screen.getByText('詳細診断(UAAM)の16項目がそろっていない2人は、比較の対象外です')).toBeInTheDocument();
    firstRender.unmount();

    vi.stubGlobal('fetch', makeFetchMock({
      eligible: true,
      reason: null,
      matchedCount: 0,
      truncated: 0,
      excludedForMissingAxes: 0,
    }));
    render(<CompatScreen user={{ getIdToken: async () => 'token' }} onBack={() => {}} onLogout={() => {}} />);
    await runPairAnalysis();
    await screen.findByText('現在の選択メンバーと組み合わせて表示できる受講者はいません。');
    expect(screen.queryByText(/上位10人まで表示しています/)).not.toBeInTheDocument();
    expect(screen.queryByText(/比較の対象外です/)).not.toBeInTheDocument();
  });

  it('disables pair preselection when two profiles share the ranking candidate name', async () => {
    const duplicateProfiles = [
      profiles[0],
      { ...profiles[1], id: 'duplicate-1', displayName: '同名さん' },
      { ...profiles[2], id: 'duplicate-2', displayName: '同名さん' },
    ];
    const fetchMock = vi.fn(async (path, options = {}) => {
      if (path === '/api/admin/compat-profiles') {
        return { ok: true, json: async () => ({ profiles: duplicateProfiles, publicImport: { enabled: false, message: '取込無効' } }) };
      }
      if (path === '/api/admin/compat-recommend') {
        const body = JSON.parse(options.body);
        if (body.action === 'search') {
          return { ok: true, json: async () => soloSummaryResponse() };
        }
        return {
          ok: true,
          json: async () => ({
            stage: 'names',
            candidates: [],
            ranking: [{
              displayName: '同名さん',
              combinationLearningIndex: 76,
              distinctCells: 40,
              levelGapTenths: 8,
            }],
            subject: soloSubjectFixture,
          }),
        };
      }
      throw new Error(`unexpected fetch: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CompatScreen user={{ getIdToken: async () => 'token' }} onBack={() => {}} onLogout={() => {}} />);
    await runSoloSearch();
    await screen.findByRole('heading', { name: '学び合いやすい組み合わせ' });
    fireEvent.click(screen.getByText(/表示される候補者それぞれについて/).closest('label').querySelector('input'));

    const pairButton = await screen.findByRole('button', { name: 'この人とペア分析する' });
    expect(pairButton).toBeDisabled();
    expect(pairButton).toHaveAttribute('title', '同名の受講者がいるため、一覧から選んでください');
  });

  it('shows the revised header and recommendation ethics copy verbatim', async () => {
    const fetchMock = vi.fn(async (path) => {
      if (path === '/api/admin/compat-profiles') {
        return { ok: true, json: async () => ({ profiles, publicImport: { enabled: false, message: '取込無効' } }) };
      }
      if (path === '/api/admin/compat-recommend') {
        return { ok: true, json: async () => soloSummaryResponse() };
      }
      throw new Error(`unexpected fetch: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CompatScreen user={{ getIdToken: async () => 'token' }} onBack={() => {}} onLogout={() => {}} />);
    expect(screen.getByText('人物には点数をつけません。組み合わせにだけ指標を出します。「似ているところ」と「違いで補い合えるところ」を見つけ、対話のきっかけにします。')).toBeInTheDocument();
    await runSoloSearch();
    expect(await screen.findByText('この機能は、コミュニティ内のチームづくりと相互理解のためのものです。雇用・人事・採用・査定の判断には使いません。')).toBeInTheDocument();
  });

  it('renders a deterministic map-only report without lenses or a sufficiency summary', () => {
    render(<CompatReport
      result={{ dataSufficiency: { memberAvailability: [{ alias: 'M1', ...soloSubjectFixture.availability }] } }}
      memberLabels={['Aさん']}
      uaamMatrix={soloSubjectFixture.uaamMatrix}
    />);

    expect(screen.getByRole('heading', { name: '発動領域Matrix' })).toBeInTheDocument();
    expect(screen.queryByText('🔎 はじめに：今回確認できること')).not.toBeInTheDocument();
  });

  it('omits shortage chips from a ranking entry when loaded profiles share its display name', async () => {
    const duplicateProfiles = [
      profiles[0],
      { ...profiles[1], id: 'duplicate-1', displayName: '同名さん' },
      { ...profiles[2], id: 'duplicate-2', displayName: '同名さん' },
    ];
    const fetchMock = vi.fn(async (path, options = {}) => {
      if (path === '/api/admin/compat-profiles') {
        return { ok: true, json: async () => ({ profiles: duplicateProfiles, publicImport: { enabled: false, message: '取込無効' } }) };
      }
      if (path === '/api/admin/compat-recommend') {
        const body = JSON.parse(options.body);
        if (body.action === 'search') {
          return { ok: true, json: async () => soloSummaryResponse() };
        }
        return {
          ok: true,
          json: async () => ({
            stage: 'names',
            candidates: [{
              displayName: '同名さん',
              matchedAxes: [{ axisKey: 'meaning', axisLabel: '基軸力', missing: true, noData: false }],
            }],
            ranking: [{
              displayName: '同名さん',
              combinationLearningIndex: 76,
              distinctCells: 40,
              levelGapTenths: 8,
            }],
            subject: soloSubjectFixture,
          }),
        };
      }
      throw new Error(`unexpected fetch: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CompatScreen user={{ getIdToken: async () => 'token' }} onBack={() => {}} onLogout={() => {}} />);
    await runSoloSearch();
    fireEvent.click((await screen.findByText(/表示される候補者それぞれについて/)).closest('label').querySelector('input'));

    const ranking = await screen.findByRole('list', { name: '学び合いやすい組み合わせの候補者ランキング' });
    expect(ranking).toHaveTextContent('同名さん');
    expect(ranking.querySelector('.compat-recommend-axis-chips')).toBeNull();
  });

  it('renders the pair-analysis shortcut in solo mode but omits it in team mode', async () => {
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
          return { ok: true, json: async () => soloSummaryResponse() };
        }
        return {
          ok: true,
          json: async () => ({
            stage: 'names',
            candidates: [],
            ranking: [{
              displayName: 'Bさん',
              combinationLearningIndex: 76,
              distinctCells: 40,
              levelGapTenths: 8,
            }],
            subject: soloSubjectFixture,
          }),
        };
      }
      throw new Error(`unexpected fetch: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const teamRender = render(<CompatScreen user={{ getIdToken: async () => 'token' }} onBack={() => {}} onLogout={() => {}} />);
    await screen.findByText('Aさん');
    fireEvent.click(screen.getByRole('button', { name: 'チーム（3名以上）' }));
    profiles.forEach((item) => {
      fireEvent.click(screen.getByText(item.displayName).closest('label').querySelector('input'));
    });
    fireEvent.change(screen.getByLabelText(/チームの目的/), { target: { value: '相互理解' } });
    fireEvent.click(screen.getByText(/対象者全員から/).closest('label').querySelector('input'));
    fireEvent.click(screen.getByRole('button', { name: '相性を分析する' }));
    fireEvent.click((await screen.findByText(/表示される候補者それぞれについて/)).closest('label').querySelector('input'));
    await screen.findByRole('list', { name: '学び合いやすい組み合わせの候補者ランキング' });
    expect(screen.queryByRole('button', { name: 'この人とペア分析する' })).not.toBeInTheDocument();
    teamRender.unmount();

    render(<CompatScreen user={{ getIdToken: async () => 'token' }} onBack={() => {}} onLogout={() => {}} />);
    await runSoloSearch();
    fireEvent.click((await screen.findByText(/表示される候補者それぞれについて/)).closest('label').querySelector('input'));
    expect(await screen.findByRole('button', { name: 'この人とペア分析する' })).toBeInTheDocument();
  });

  it('uses the captured solo report label without disclosing the server-side name in the report', async () => {
    const fetchMock = vi.fn(async (path) => {
      if (path === '/api/admin/compat-profiles') {
        return { ok: true, json: async () => ({ profiles, publicImport: { enabled: false, message: '取込無効' } }) };
      }
      if (path === '/api/admin/compat-recommend') {
        return { ok: true, json: async () => soloSummaryResponse() };
      }
      throw new Error(`unexpected fetch: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CompatScreen user={{ getIdToken: async () => 'token' }} onBack={() => {}} onLogout={() => {}} />);
    await screen.findByText('Aさん');
    fireEvent.click(screen.getByRole('button', { name: '1人' }));
    fireEvent.click(screen.getByText('Aさん').closest('label').querySelector('input'));
    fireEvent.change(screen.getByRole('textbox', { name: 'M1 レポート表示名' }), { target: { value: '匿名の対象者' } });
    fireEvent.click(screen.getByText(/対象者全員から/).closest('label').querySelector('input'));
    fireEvent.click(screen.getByRole('button', { name: '力マップと相性を見る' }));

    const soloResult = await screen.findByLabelText('匿名の対象者の診断結果');
    expect(soloResult).toHaveTextContent('匿名の対象者の診断で見つかった軸');
    expect(soloResult).toHaveTextContent('匿名の対象者');
    expect(soloResult).not.toHaveTextContent('Aさん');
  });

  it('refreshes the solo subject after stale name disclosure recovery', async () => {
    let searchCount = 0;
    const refreshedSubject = {
      ...soloSubjectFixture,
      generatedAxes: {
        ...soloSubjectFixture.generatedAxes,
        talent: ['更新後の軸'],
      },
    };
    const fetchMock = vi.fn(async (path, options = {}) => {
      if (path === '/api/admin/compat-profiles') {
        return { ok: true, json: async () => ({ profiles, publicImport: { enabled: false, message: '取込無効' } }) };
      }
      if (path === '/api/admin/compat-recommend') {
        const body = JSON.parse(options.body);
        if (body.action === 'search') {
          searchCount += 1;
          return {
            ok: true,
            json: async () => soloSummaryResponse({
              snapshot: searchCount === 1 ? recommendationSnapshot : 'b'.repeat(64),
              subject: searchCount === 1 ? soloSubjectFixture : refreshedSubject,
            }),
          };
        }
        return {
          ok: false,
          status: 409,
          json: async () => ({
            code: 'RECOMMENDATION_SNAPSHOT_STALE',
            error: 'データが更新されました。もう一度検索してください',
          }),
        };
      }
      throw new Error(`unexpected fetch: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CompatScreen user={{ getIdToken: async () => 'token' }} onBack={() => {}} onLogout={() => {}} />);
    await runSoloSearch();
    expect(await screen.findByText('構造化')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/表示される候補者それぞれについて/).closest('label').querySelector('input'));

    expect(await screen.findByText('更新後の軸')).toBeInTheDocument();
    const soloResult = screen.getByLabelText('Aさんの診断結果');
    expect(soloResult).not.toHaveTextContent('構造化');
    expect(searchCount).toBe(2);
  });

  it('marks the ranking disclosure and its consent row as non-printable', async () => {
    const fetchMock = vi.fn(async (path, options = {}) => {
      if (path === '/api/admin/compat-profiles') {
        return { ok: true, json: async () => ({ profiles, publicImport: { enabled: false, message: '取込無効' } }) };
      }
      if (path === '/api/admin/compat-recommend') {
        const body = JSON.parse(options.body);
        if (body.action === 'search') {
          return { ok: true, json: async () => soloSummaryResponse() };
        }
        return {
          ok: true,
          json: async () => ({
            stage: 'names',
            candidates: [],
            ranking: [{
              displayName: 'Bさん',
              combinationLearningIndex: 76,
              distinctCells: 40,
              levelGapTenths: 8,
            }],
            subject: soloSubjectFixture,
          }),
        };
      }
      throw new Error(`unexpected fetch: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CompatScreen user={{ getIdToken: async () => 'token' }} onBack={() => {}} onLogout={() => {}} />);
    await runSoloSearch();
    const consentRow = (await screen.findByText(/表示される候補者それぞれについて/)).closest('label');
    expect(consentRow).toHaveClass('no-print');
    fireEvent.click(consentRow.querySelector('input'));

    const ranking = await screen.findByRole('list', { name: '学び合いやすい組み合わせの候補者ランキング' });
    expect(ranking).toHaveClass('no-print');
  });
});
