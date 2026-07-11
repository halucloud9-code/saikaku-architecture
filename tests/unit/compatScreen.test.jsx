// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CompatScreen, { CompatReport } from '../../src/compat/CompatScreen.jsx';

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

afterEach(() => vi.unstubAllGlobals());

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

  it('renders [仮説] from claim.kind', () => {
    render(<CompatReport result={{
      dataSufficiency: { summary: '範囲', memberAvailability: [], limitations: [] },
      lenses: [
        { id: 'similarity', status: 'detected', summary: '要約', claims: [{ text: '仮の読み', kind: 'hypothesis', evidenceIds: ['E-001'], verificationQuestion: '本当ですか？' }] },
        { id: 'complementarity', status: 'not_detected', summary: '不検出', claims: [] },
      ],
      ethicsNotice: '人事評価・採用評価には流用しません。',
    }} />);
    expect(screen.getByText('[仮説]')).toBeInTheDocument();
  });
});
