// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PeerAssessScreen, { getShuffledPeerQuestions } from '../../src/peer/PeerAssessScreen.jsx';
import { UAAM_QUESTIONS, VALIDITY_QUESTIONS } from '../../src/data/uaam_questions.js';

const INVITE_ID = '11111111-1111-4111-8111-111111111111';
const STORAGE_KEY = `uaam-peer-submitted:${INVITE_ID}`;
const DRAFT_KEY = `uaam-peer-draft:${INVITE_ID}`;

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function renderPeer() {
  return render(
    <MemoryRouter initialEntries={[`/peer/${INVITE_ID}`]}>
      <Routes>
        <Route path="/peer/:inviteId" element={<PeerAssessScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function answerAllQuestions() {
  const renderedTexts = [];
  for (let page = 0; page < 7; page += 1) {
    renderedTexts.push(
      ...Array.from(document.querySelectorAll('[data-peer-question-text]'), (element) => element.textContent),
    );
    document.querySelectorAll('[data-peer-answer-value="3"]').forEach((button) => fireEvent.click(button));
    if (page < 6) fireEvent.click(screen.getByRole('button', { name: /^次へ/ }));
  }
  return renderedTexts;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PeerAssessScreen', () => {
  it('shuffles exactly the 64 canonical main questions without validity questions or text changes', () => {
    const shuffled = getShuffledPeerQuestions(() => 0);
    const canonicalById = new Map(UAAM_QUESTIONS.map((question) => [question.id, question.text]));

    expect(shuffled).toHaveLength(64);
    expect(shuffled.map((question) => question.id)).not.toEqual(UAAM_QUESTIONS.map((question) => question.id));
    expect(new Set(shuffled.map((question) => question.id))).toEqual(
      new Set(UAAM_QUESTIONS.map((question) => question.id)),
    );
    expect(shuffled.every((question) => canonicalById.get(question.id) === question.text)).toBe(true);
    expect(shuffled.some((question) => /^V[1-3]$/u.test(String(question.id)))).toBe(false);
    expect(shuffled.some((question) => VALIDITY_QUESTIONS.some((validity) => validity.text === question.text))).toBe(false);
  });

  it('renders only the 64 verbatim main questions, submits anonymously, and preserves a non-blocking revisit notice', async () => {
    vi.stubGlobal('scrollTo', vi.fn());
    const fetchMock = vi.fn(async (url, options = {}) => {
      if (url === '/api/uaam-peer-assess' && options.method === 'POST') {
        return jsonResponse(201, { success: true });
      }
      return jsonResponse(200, { subjectName: '山田太郎', expiresAt: '2026-08-01T00:00:00.000Z' });
    });
    vi.stubGlobal('fetch', fetchMock);

    const firstView = renderPeer();
    expect(await screen.findByText('山田太郎さんの直近1ヶ月に当てはまるかでお答えください')).toBeInTheDocument();
    expect(screen.getByText('本評価は人事評価・採用評価には使用されません')).toBeInTheDocument();
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow, noarchive');

    const renderedTexts = await answerAllQuestions();
    expect(renderedTexts).toHaveLength(64);
    expect(new Set(renderedTexts)).toEqual(new Set(UAAM_QUESTIONS.map((question) => question.text)));
    for (const validityQuestion of VALIDITY_QUESTIONS) {
      expect(renderedTexts).not.toContain(validityQuestion.text);
    }

    fireEvent.click(screen.getByRole('button', { name: '回答を送信する' }));
    expect(await screen.findByRole('heading', { name: '回答を送信しました' })).toBeInTheDocument();
    expect(screen.getByText(/ご協力ありがとうございました/)).toBeInTheDocument();

    const submitCall = fetchMock.mock.calls.find(([url]) => url === '/api/uaam-peer-assess');
    expect(submitCall?.[1]?.headers).not.toHaveProperty('Authorization');
    const payload = JSON.parse(submitCall[1].body);
    expect(payload.inviteId).toBe(INVITE_ID);
    expect(Object.keys(payload.answers)).toHaveLength(64);
    expect(new Set(Object.values(payload.answers))).toEqual(new Set([3]));
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();

    firstView.unmount();
    renderPeer();
    expect(await screen.findByText('このブラウザからは回答済みです。再回答すると新しい回答として追加されます')).toBeInTheDocument();
    expect(document.querySelector('[data-peer-question-text]')).toBeInTheDocument();
  });

  it('restores draft answers, question order, and page, then focuses the new page heading', async () => {
    vi.stubGlobal('scrollTo', vi.fn());
    vi.stubGlobal('fetch', vi.fn(async () => (
      jsonResponse(200, { subjectName: '下書き確認', expiresAt: '2026-08-01T00:00:00.000Z' })
    )));

    const firstView = renderPeer();
    await screen.findByText('下書き確認さんの直近1ヶ月に当てはまるかでお答えください');
    const firstPageIds = Array.from(
      document.querySelectorAll('[data-peer-question-id]'),
      (element) => element.getAttribute('data-peer-question-id'),
    );
    document.querySelectorAll('[data-peer-answer-value="3"]').forEach((button) => fireEvent.click(button));

    const nextButton = screen.getByRole('button', { name: /^次へ/ });
    expect(nextButton).not.toHaveAttribute('aria-disabled');
    expect(nextButton).toBeEnabled();
    fireEvent.click(nextButton);

    const secondPageHeading = await screen.findByRole('heading', { name: '質問 11〜20 / 64' });
    await waitFor(() => expect(secondPageHeading).toHaveFocus());
    const secondPageIds = Array.from(
      document.querySelectorAll('[data-peer-question-id]'),
      (element) => element.getAttribute('data-peer-question-id'),
    );
    const storedDraft = JSON.parse(localStorage.getItem(DRAFT_KEY));
    expect(Object.keys(storedDraft.answers)).toHaveLength(10);
    expect(storedDraft.currentPage).toBe(1);
    expect(storedDraft.questionIds.slice(0, 10)).toEqual(firstPageIds);
    expect(storedDraft.questionIds.slice(10, 20)).toEqual(secondPageIds);

    firstView.unmount();
    renderPeer();
    expect(await screen.findByRole('heading', { name: '質問 11〜20 / 64' })).toBeInTheDocument();
    expect(screen.getByText('全体進捗：10/64問')).toBeInTheDocument();
    expect(Array.from(
      document.querySelectorAll('[data-peer-question-id]'),
      (element) => element.getAttribute('data-peer-question-id'),
    )).toEqual(secondPageIds);
  });

  it.each([
    [404, '招待が見つからないか、期限切れです'],
    [410, '対象者のデータは削除処理中です'],
    [500, '招待を読み込めませんでした'],
  ])('shows a clear standalone load error for HTTP %s', async (status, message) => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(status, { code: 'error' })));
    renderPeer();

    expect(await screen.findByRole('heading', { name: message })).toBeInTheDocument();
    expect(screen.queryByText(/ログイン/)).not.toBeInTheDocument();
  });

  it('keeps all answers after a cap response and renders the explicit 429 message', async () => {
    vi.stubGlobal('scrollTo', vi.fn());
    vi.stubGlobal('fetch', vi.fn(async (url) => (
      url === '/api/uaam-peer-assess'
        ? jsonResponse(429, { code: 'submission_cap_reached' })
        : jsonResponse(200, { subjectName: '上限確認', expiresAt: '2026-08-01T00:00:00.000Z' })
    )));
    renderPeer();
    await screen.findByText('上限確認さんの直近1ヶ月に当てはまるかでお答えください');

    await answerAllQuestions();
    fireEvent.click(screen.getByRole('button', { name: '回答を送信する' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('回答の受付上限に達しています');
    expect(screen.getByText('全体進捗：64/64問')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '回答を送信する' })).toBeEnabled();
  });

  it.each([
    [400, '回答内容に不備があります'],
    [404, '招待が見つからないか、期限切れです'],
    [410, '対象者のデータが削除処理中のため、回答を送信できません'],
  ])('renders an actionable submit error for HTTP %s without discarding answers', async (status, message) => {
    vi.stubGlobal('scrollTo', vi.fn());
    vi.stubGlobal('fetch', vi.fn(async (url) => (
      url === '/api/uaam-peer-assess'
        ? jsonResponse(status, { code: 'submit_error' })
        : jsonResponse(200, { subjectName: '送信エラー確認', expiresAt: '2026-08-01T00:00:00.000Z' })
    )));
    renderPeer();
    await screen.findByText('送信エラー確認さんの直近1ヶ月に当てはまるかでお答えください');

    await answerAllQuestions();
    fireEvent.click(screen.getByRole('button', { name: '回答を送信する' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByText('全体進捗：64/64問')).toBeInTheDocument();
  });

  it('restores existing metadata when the standalone page unmounts', async () => {
    const robots = document.createElement('meta');
    robots.setAttribute('name', 'robots');
    robots.setAttribute('content', 'index');
    document.head.appendChild(robots);
    const originalTitle = document.title;
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(404, {})));

    const view = renderPeer();
    await screen.findByRole('heading', { name: '招待が見つからないか、期限切れです' });
    expect(robots).toHaveAttribute('content', 'noindex, nofollow, noarchive');

    view.unmount();
    await waitFor(() => expect(robots).toHaveAttribute('content', 'index'));
    expect(document.title).toBe(originalTitle);
    robots.remove();
  });
});
