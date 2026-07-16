// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(() => () => {}),
}));

vi.mock('../../src/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  getRedirectResult: vi.fn(async () => null),
  signOutUser: vi.fn(async () => {}),
}));

const INVITE_ID = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState({}, '', '/');
});

describe('App peer public route', () => {
  it('renders a direct logged-out peer URL before auth resolves and is not swallowed by the catch-all', async () => {
    window.history.replaceState({}, '', `/peer/${INVITE_ID}`);
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ subjectName: 'ログアウト検証', expiresAt: '2026-08-01T00:00:00.000Z' }),
    })));
    const { default: AppRouter } = await import('../../src/App.jsx');

    render(<AppRouter />);

    expect(await screen.findByText('ログアウト検証さんの直近1ヶ月に当てはまるかでお答えください')).toBeInTheDocument();
    expect(screen.queryByText('Googleでログイン')).not.toBeInTheDocument();
    expect(window.location.pathname).toBe(`/peer/${INVITE_ID}`);
  });
});
