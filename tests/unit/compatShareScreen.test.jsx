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

afterEach(() => vi.unstubAllGlobals());

describe('CompatShareScreen', () => {
  it('renders the shared report without auth and manages noindex while mounted', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => responseFixture })));
    const originalTitle = document.title;
    const view = render(
      <MemoryRouter initialEntries={['/compat/share/11111111-1111-4111-8111-111111111111']}>
        <Routes>
          <Route path="/compat/share/:shareId" element={<CompatShareScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('共有範囲')).toBeInTheDocument();
    expect(screen.getByText('Aさん')).toBeInTheDocument();
    expect(screen.getByText(/対象者本人への限定共有/)).toBeInTheDocument();
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow, noarchive');
    expect(document.querySelector('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
    expect(document.title).toBe('共有された相性診断');

    view.unmount();
    await waitFor(() => expect(document.querySelector('meta[name="robots"]')).toBeNull());
    expect(document.querySelector('meta[name="referrer"]')).toBeNull();
    expect(document.title).toBe(originalTitle);
  });
});
