// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CompatShareScreen from '../../src/compat/CompatShareScreen.jsx';
import { buildCompatSharedMatrix } from '../../api/lib/compatShare.js';

const responseFixture = {
  report: {
    dataSufficiency: {
      summary: '共有範囲',
      memberAvailability: [
        { alias: 'A', source: 'internal', categories: {}, uaam: false },
        { alias: 'B', source: 'internal', categories: {}, uaam: false },
      ],
      limitations: [],
    },
    lenses: [
      { id: 'similarity', status: 'not_detected', summary: '同質は不検出', claims: [] },
      { id: 'complementarity', status: 'not_detected', summary: '補完は不検出', claims: [] },
    ],
    ethicsNotice: '人事評価・採用評価には流用しません。',
  },
  memberLabels: ['Aさん', 'Bさん'],
  mode: 'pair',
  goalProvided: false,
};

function renderShare() {
  return render(
    <MemoryRouter initialEntries={['/compat/share/11111111-1111-4111-8111-111111111111']}>
      <Routes>
        <Route path="/compat/share/:shareId" element={<CompatShareScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('CompatShareScreen', () => {
  it('fetches and renders a v1 share without a visual block or matched-term explanation', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => responseFixture }));
    vi.stubGlobal('fetch', fetchMock);
    const originalTitle = document.title;
    const view = renderShare();

    expect(await screen.findByText('共有範囲')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/compat-share?id=11111111-1111-4111-8111-111111111111',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('Aさん')).toBeInTheDocument();
    expect(screen.getByText('Bさん')).toBeInTheDocument();
    expect(screen.getByText(/対象者本人への限定共有/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '相性マンダラ' })).not.toBeInTheDocument();
    expect(screen.queryByText(/本人が入力した言葉はAIには送られません/)).not.toBeInTheDocument();
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow, noarchive');
    expect(document.querySelector('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
    expect(document.title).toBe('共有された相性診断');

    view.unmount();
    await waitFor(() => expect(document.querySelector('meta[name="robots"]')).toBeNull());
    expect(document.querySelector('meta[name="referrer"]')).toBeNull();
    expect(document.title).toBe(originalTitle);
  });

  it('shows the narrowed LLM disclosure only for a v2 share with matches', async () => {
    const v2Fixture = structuredClone(responseFixture);
    v2Fixture.report.visual = {
      schemaVersion: 2,
      members: [
        { alias: 'A', axes: { talent: ['構造化'], value: [], passion: [] } },
        { alias: 'B', axes: { talent: ['対話'], value: [], passion: [] } },
      ],
      matches: [{ aliases: ['A', 'B'], category: 'talent', sourceKind: 'user_top5', terms: ['観察'] }],
      uaam: { eligible: false, axes: [] },
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => v2Fixture })));

    renderShare();

    expect(await screen.findByRole('heading', { name: '相性マンダラ' })).toBeInTheDocument();
    expect(screen.getByText(/本人が入力した言葉はAIには送られません。診断で見つかった軸の名前は、氏名を除いたプロフィールの一部としてAIに渡ります。/)).toBeInTheDocument();
    expect(screen.getByText('Aさん')).toBeInTheDocument();
    expect(screen.getByText('Bさん')).toBeInTheDocument();
  });

  it('replaces M aliases with stored member labels throughout a shared report', async () => {
    const namedFixture = structuredClone(responseFixture);
    namedFixture.report.dataSufficiency.memberAvailability = [
      { alias: 'M1', source: 'internal', categories: {}, uaam: false },
      { alias: 'M2', source: 'internal', categories: {}, uaam: false },
    ];
    namedFixture.memberLabels = ['つかさ', '野田健一'];
    namedFixture.report.dataSufficiency.summary = 'M1とM2について確認できる範囲です。';
    namedFixture.report.lenses[0].summary = 'M1とM2には似ているところがあります。';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => namedFixture })));

    renderShare();

    expect(await screen.findByText('つかさと野田健一について確認できる範囲です。')).toBeInTheDocument();
    expect(screen.getByText('つかさ')).toBeInTheDocument();
    expect(screen.getByText('野田健一')).toBeInTheDocument();
    expect(screen.getByText('つかさと野田健一には似ているところがあります。')).toBeInTheDocument();
  });

  it('renders a shared matrix from derived data without exposing member scores', async () => {
    const matrixFixture = structuredClone(responseFixture);
    matrixFixture.report.dataSufficiency.memberAvailability = [
      { alias: 'M1', source: 'internal', categories: {}, uaam: true },
      { alias: 'M2', source: 'internal', categories: {}, uaam: true },
    ];
    matrixFixture.memberLabels = ['つかさ', '野田健一'];
    matrixFixture.sharedMatrix = buildCompatSharedMatrix({
      memberScores: {
        M1: { meaning: 16, mindfulness: 16 },
        M2: { meaning: 12, mindfulness: 12 },
      },
    }, ['M1', 'M2']);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => matrixFixture })));

    const { container } = renderShare();

    expect(await screen.findByRole('heading', { name: 'チーム発動領域Matrix' })).toBeInTheDocument();
    expect(container.querySelectorAll('.compat-matrix-cell')).toHaveLength(256);
    expect(container.querySelector('[data-row="0"][data-column="1"]')).toHaveAccessibleName(
      expect.stringContaining('担い手 つかさ'),
    );
    expect(container.querySelector('.compat-matrix')).not.toHaveTextContent(/16点|12点/u);
  });

  it('never renders the admin-only matrix even if member scores are injected into a report', async () => {
    const injectedFixture = structuredClone(responseFixture);
    injectedFixture.report.uaamMatrix = { memberScores: { A: { meaning: 20, mindfulness: 20 } } };
    injectedFixture.report.visual = {
      schemaVersion: 2,
      members: [
        { alias: 'A', axes: { talent: [], value: [], passion: [] } },
        { alias: 'B', axes: { talent: [], value: [], passion: [] } },
      ],
      matches: [],
      uaam: {
        eligible: false,
        axes: [],
        memberScores: { A: { meaning: 20, mindfulness: 20 } },
      },
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => injectedFixture })));

    renderShare();

    expect(await screen.findByText('共有範囲')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'チーム発動領域Matrix' })).not.toBeInTheDocument();
  });
});
