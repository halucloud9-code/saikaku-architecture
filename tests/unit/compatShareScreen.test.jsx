// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CompatShareScreen from '../../src/compat/CompatShareScreen.jsx';

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
    expect(screen.getByText('Aさん')).toBeInTheDocument();
    expect(screen.getByText(/対象者本人への限定共有/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '相性マンダラ' })).not.toBeInTheDocument();
    expect(screen.queryByText(/本人が入力したTop5の語はLLMに送信されない/)).not.toBeInTheDocument();
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
    expect(screen.getByText(/本人が入力したTop5の語はLLMに送信されない。生成軸名は別名化プロフィールの一部としてLLMに渡る。/)).toBeInTheDocument();
  });
});
