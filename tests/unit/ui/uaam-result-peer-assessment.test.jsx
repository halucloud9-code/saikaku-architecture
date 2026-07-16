// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UAAMResultScreen, { PeerAssessmentSection } from '../../../src/screens/uaam/UAAMResultScreen.jsx';

const user = { getIdToken: vi.fn(async () => 'subject-token') };

function response(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn(async () => data),
  };
}

function scores(value) {
  const definitions = {
    mindset: ['meaning', 'mindfulness', 'mindshift', 'mastery'],
    literacy: ['learning', 'logical', 'life', 'leadership'],
    competency: ['critical', 'creativity', 'communication', 'collaboration'],
    impact: ['idea', 'innovation', 'implementation', 'influence'],
  };
  return Object.fromEntries(Object.entries(definitions).map(([axis, subs]) => [axis, {
    total: value * 4,
    max: 80,
    percentage: value * 5,
    subs: Object.fromEntries(subs.map((sub) => [sub, value])),
  }]));
}

function readySummary() {
  return {
    status: 'ready',
    n: 2,
    aggregate: scores(12.5),
    selfSnapshot: {
      attemptId: 'attempt-self',
      answeredAt: '2026-07-15T12:00:00.000Z',
      scores: scores(10),
    },
  };
}

function canvasContext() {
  const gradient = { addColorStop: vi.fn() };
  return new Proxy({}, {
    get(target, property) {
      if (property in target) return target[property];
      if (property === 'createRadialGradient' || property === 'createLinearGradient') {
        return vi.fn(() => gradient);
      }
      const fn = vi.fn();
      target[property] = fn;
      return fn;
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    },
  });
}

describe('UAAMResultScreen peer assessment section', () => {
  beforeEach(() => {
    user.getIdToken.mockClear();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext());
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async () => {}) },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not mount or fetch the peer section when the prop gate is omitted', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <UAAMResultScreen
        user={{ displayName: '履歴表示', photoURL: '' }}
        result={{
          scores: scores(10),
          analysis: null,
          answers: {},
          vAnswers: {},
          bias_message: null,
          personality_level: { level: 'L3', name: '実践型' },
          leadership_stage: { stage: 3, name: '実践' },
          three_elements: { leadership: 50, teamBuilding: 50, management: 50, development_phase: 'foundation' },
        }}
        isAdmin={false}
        onReset={() => {}}
        onAdmin={() => {}}
        onLogout={() => {}}
      />,
    );

    expect(screen.queryByTestId('uaam-peer-assessment')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps n=0/1 completely hidden behind the insufficient response', async () => {
    const fetchMock = vi.fn(async () => response(200, { status: 'insufficient' }));
    vi.stubGlobal('fetch', fetchMock);

    render(<PeerAssessmentSection user={user} />);

    expect(await screen.findByText('回答が2件以上揃うと表示されます')).toBeInTheDocument();
    expect(screen.queryByText('回答数')).not.toBeInTheDocument();
    expect(screen.queryByText('回答数であり人数ではありません')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('自己回答と他者評価平均の16軸比較レーダー')).not.toBeInTheDocument();
    expect(screen.queryByText('同一の64問・発行時点の自己回答との比較')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/me/uaam-peer-summary', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer subject-token' }),
    }));
  });

  it('asks the owner to reissue when the active invite question version is stale', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response(409, {
      code: 'question_version_mismatch',
      error: '診断内容が更新されたため、招待URLの再発行が必要です',
    })));

    render(<PeerAssessmentSection user={user} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '診断内容が更新されたため、この招待URLの集計は表示できません。招待を再発行してください。',
    );
    expect(screen.queryByTestId('uaam-peer-insufficient')).not.toBeInTheDocument();
    expect(screen.queryByTestId('uaam-peer-ready')).not.toBeInTheDocument();
  });

  it('shows n, snapshot date, overlay legend, and signed axis/sub gaps only when ready', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response(200, readySummary())));
    const ui = userEvent.setup();

    render(<PeerAssessmentSection user={user} />);

    const ready = await screen.findByTestId('uaam-peer-ready');
    expect(within(ready).getByText('2')).toBeInTheDocument();
    expect(screen.getByText('回答数であり人数ではありません')).toBeInTheDocument();
    expect(screen.getByText('2026/07/15')).toBeInTheDocument();
    const radar = screen.getByRole('img', { name: '自己回答と他者評価平均の16軸比較レーダー' });
    expect(radar).toHaveAttribute('aria-describedby', 'uaam-peer-comparison-data');
    expect(screen.getByText('発行時点の自己回答')).toBeInTheDocument();
    expect(screen.getByText('他者評価平均')).toBeInTheDocument();
    expect(screen.getByText('同一の64問・発行時点の自己回答との比較')).toBeInTheDocument();
    expect(screen.getAllByText('+10')).toHaveLength(4);
    expect(screen.getAllByText('+2.5')).toHaveLength(16);
    expect(screen.getAllByRole('table')).toHaveLength(4);
    expect(screen.getAllByRole('columnheader', { name: '自己' })).toHaveLength(4);
    expect(screen.getAllByRole('columnheader', { name: '他者平均' })).toHaveLength(4);
    expect(screen.getAllByRole('columnheader', { name: '差' })).toHaveLength(4);

    await ui.click(screen.getByRole('button', { name: '集計を更新' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('集計を更新しました。回答数は2件です。'));
  });

  it('issues, revokes with confirmation, and reissues into an insufficient fresh wave', async () => {
    const firstInvite = {
      inviteId: '11111111-1111-4111-8111-111111111111',
      url: 'http://localhost:5173/peer/11111111-1111-4111-8111-111111111111',
      expiresAt: '2026-08-15T00:00:00.000Z',
      reused: false,
    };
    const secondInvite = {
      inviteId: '22222222-2222-4222-8222-222222222222',
      url: 'http://localhost:5173/peer/22222222-2222-4222-8222-222222222222',
      expiresAt: '2026-08-15T00:00:00.000Z',
      reused: false,
    };
    let issueCount = 0;
    const actions = [];
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url === '/api/me/uaam-peer-summary') {
        if (issueCount === 0) return response(404, { code: 'not_found', error: '集計対象が見つかりません' });
        return response(200, { status: 'insufficient' });
      }
      const body = JSON.parse(options.body);
      actions.push(body.action);
      if (body.action === 'revoke') return response(200, firstInvite);
      issueCount += 1;
      return response(201, issueCount === 1 ? firstInvite : secondInvite);
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const ui = userEvent.setup();

    render(<PeerAssessmentSection user={user} />);

    await ui.click(await screen.findByRole('button', { name: '招待URLを発行する' }));
    const inviteUrlInput = await screen.findByDisplayValue(firstInvite.url);
    expect(inviteUrlInput).toBeInTheDocument();
    expect(inviteUrlInput.closest('.no-print')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'URLをコピー' }).closest('.no-print')).not.toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: 'URLをコピー' })).toHaveFocus());
    expect(screen.getByRole('status')).toHaveTextContent('招待URLを発行しました');
    expect(screen.getByText('URLを知っている人は誰でも回答できます')).toBeInTheDocument();
    expect(screen.getByText('再発行すると集計がリセットされます')).toBeInTheDocument();
    expect(screen.getByText('回答が2件以上揃うと表示されます')).toBeInTheDocument();

    await ui.click(screen.getByRole('button', { name: '招待URLを失効する' }));
    expect(window.confirm).toHaveBeenCalledOnce();
    const reissueButton = await screen.findByRole('button', { name: '招待URLを再発行する' });
    await waitFor(() => expect(reissueButton).toHaveFocus());
    expect(screen.getByRole('status')).toHaveTextContent('招待URLを失効しました');
    expect(screen.queryByDisplayValue(firstInvite.url)).not.toBeInTheDocument();

    await ui.click(screen.getByRole('button', { name: '招待URLを再発行する' }));
    expect(await screen.findByDisplayValue(secondInvite.url)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'URLをコピー' })).toHaveFocus());
    expect(screen.getByText('回答が2件以上揃うと表示されます')).toBeInTheDocument();
    expect(actions).toEqual(['issue', 'revoke', 'issue']);
  });

  it('disables issue when the API reports that no committed UAAM result exists', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url === '/api/me/uaam-peer-summary') {
        return response(404, { code: 'not_found', error: '集計対象が見つかりません' });
      }
      return response(404, { code: 'self_result_not_found', error: 'UAAM診断結果が見つかりません' });
    });
    vi.stubGlobal('fetch', fetchMock);
    const ui = userEvent.setup();

    render(<PeerAssessmentSection user={user} />);
    const issueButton = await screen.findByRole('button', { name: '招待URLを発行する' });
    await ui.click(issueButton);

    expect(await screen.findByText('UAAM診断の確定結果がないため、招待URLを発行できません。')).toBeInTheDocument();
    expect(issueButton).toBeDisabled();
  });

  it('tells the owner to retake when the self question version cannot be verified', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url === '/api/me/uaam-peer-summary') {
        return response(404, { code: 'not_found', error: '集計対象が見つかりません' });
      }
      return response(409, {
        code: 'self_question_version_unknown',
        error: 'UAAM診断結果の質問版を確認できません',
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const ui = userEvent.setup();

    render(<PeerAssessmentSection user={user} />);
    const issueButton = await screen.findByRole('button', { name: '招待URLを発行する' });
    await ui.click(issueButton);

    expect(await screen.findByText('最新の診断内容で受け直すと、他者評価の招待を発行できます。')).toBeInTheDocument();
    expect(issueButton).toBeDisabled();
  });
});
