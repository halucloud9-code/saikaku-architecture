import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { LIKERT_LABELS, UAAM_QUESTIONS } from '../data/uaam_questions';

const QUESTIONS_PER_PAGE = 10;
const ACCENT = '#6D5600';
const SUBMITTED_STORAGE_PREFIX = 'uaam-peer-submitted:';
const DRAFT_STORAGE_PREFIX = 'uaam-peer-draft:';
const PEER_QUESTION_BY_ID = new Map(UAAM_QUESTIONS.map((question) => [String(question.id), question]));

const DISCLOSURES = [
  '本評価は人事評価・採用評価には使用されません',
  '対象者には評価者名を出さず集計のみ表示されます。ただし回答人数が少ない場合、誰の回答かが推測される可能性があります',
  'お一人1回の回答にご協力ください',
  '回答は匿名で保存され、個別の取り消しはできません（対象者のデータ削除時に一緒に削除されます）',
];

const shellStyle = {
  minHeight: '100vh',
  background: '#F5F0E8',
  color: '#2A2520',
  fontFamily: "'Noto Sans JP', 'Helvetica Neue', Arial, sans-serif",
};

const contentStyle = {
  width: '100%',
  maxWidth: 800,
  margin: '0 auto',
  padding: '32px 20px 20px',
};

function usePrivateDocumentMetadata() {
  useEffect(() => {
    const previousTitle = document.title;
    const existingRobots = document.querySelector('meta[name="robots"]');
    const robots = existingRobots || document.createElement('meta');
    const previousRobots = existingRobots?.getAttribute('content');
    const existingReferrer = document.querySelector('meta[name="referrer"]');
    const referrer = existingReferrer || document.createElement('meta');
    const previousReferrer = existingReferrer?.getAttribute('content');

    if (!existingRobots) {
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    if (!existingReferrer) {
      referrer.setAttribute('name', 'referrer');
      document.head.appendChild(referrer);
    }

    robots.setAttribute('content', 'noindex, nofollow, noarchive');
    referrer.setAttribute('content', 'no-referrer');
    document.title = '周囲からの評価';

    return () => {
      document.title = previousTitle;
      if (!existingRobots) robots.remove();
      else if (previousRobots === null) robots.removeAttribute('content');
      else robots.setAttribute('content', previousRobots);
      if (!existingReferrer) referrer.remove();
      else if (previousReferrer === null) referrer.removeAttribute('content');
      else referrer.setAttribute('content', previousReferrer);
    };
  }, []);
}

export function getShuffledPeerQuestions(random = Math.random) {
  const questions = [...UAAM_QUESTIONS];
  for (let index = questions.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [questions[index], questions[swapIndex]] = [questions[swapIndex], questions[index]];
  }
  return questions;
}

function emptyDraft() {
  return { answers: {}, currentPage: 0, questionIds: null };
}

function readPeerDraft(inviteId) {
  if (!inviteId) return emptyDraft();
  try {
    const stored = JSON.parse(localStorage.getItem(`${DRAFT_STORAGE_PREFIX}${inviteId}`) || 'null');
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return emptyDraft();

    const answers = {};
    if (stored.answers && typeof stored.answers === 'object' && !Array.isArray(stored.answers)) {
      for (const [questionId, value] of Object.entries(stored.answers)) {
        if (PEER_QUESTION_BY_ID.has(questionId) && Number.isInteger(value) && value >= 1 && value <= 5) {
          answers[questionId] = value;
        }
      }
    }

    const questionIds = Array.isArray(stored.questionIds)
      && stored.questionIds.length === UAAM_QUESTIONS.length
      && new Set(stored.questionIds.map(String)).size === UAAM_QUESTIONS.length
      && stored.questionIds.every((questionId) => PEER_QUESTION_BY_ID.has(String(questionId)))
      ? stored.questionIds.map(String)
      : null;
    const totalPages = Math.ceil(UAAM_QUESTIONS.length / QUESTIONS_PER_PAGE);
    const currentPage = Number.isInteger(stored.currentPage)
      ? Math.max(0, Math.min(stored.currentPage, totalPages - 1))
      : 0;

    return { answers, currentPage, questionIds };
  } catch {
    return emptyDraft();
  }
}

function writePeerDraft(inviteId, draft) {
  if (!inviteId) return;
  try {
    if (Object.keys(draft.answers).length === 0) {
      localStorage.removeItem(`${DRAFT_STORAGE_PREFIX}${inviteId}`);
      return;
    }
    localStorage.setItem(`${DRAFT_STORAGE_PREFIX}${inviteId}`, JSON.stringify(draft));
  } catch {
    // Storage may be unavailable in privacy-restricted browsers. The form remains usable.
  }
}

function DisclosureFooter() {
  return (
    <footer style={{
      maxWidth: 800,
      margin: '20px auto 0',
      padding: '24px 20px 36px',
      borderTop: '1px solid #D4C9B0',
      color: '#62594D',
    }}>
      <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700 }}>回答データの取り扱いについて</p>
      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, lineHeight: 1.8 }}>
        {DISCLOSURES.map((text) => <li key={text}>{text}</li>)}
      </ul>
    </footer>
  );
}

function StateScreen({ title, message, tone = 'neutral' }) {
  const isError = tone === 'error';
  const isSuccess = tone === 'success';
  const color = isError ? '#A84432' : isSuccess ? '#2E6E4D' : '#62594D';
  const background = isError ? '#FFF5F2' : isSuccess ? '#F0F8F3' : '#FDFCFA';

  return (
    <div style={shellStyle}>
      <main style={{ ...contentStyle, paddingTop: 72, paddingBottom: 48 }}>
        <section
          role={isError ? 'alert' : 'status'}
          style={{
            background,
            border: `1px solid ${isError ? '#D9A89E' : isSuccess ? '#A9CDB8' : '#D4C9B0'}`,
            borderRadius: 16,
            padding: '36px 28px',
            textAlign: 'center',
            boxShadow: '0 8px 24px rgba(42,37,32,0.07)',
          }}
        >
          <div aria-hidden="true" style={{ fontSize: 34, marginBottom: 12 }}>
            {isError ? '!' : isSuccess ? '✓' : '…'}
          </div>
          <h1 style={{ margin: '0 0 12px', color, fontSize: 24, lineHeight: 1.5 }}>{title}</h1>
          {message && <p style={{ margin: 0, color: '#62594D', fontSize: 14, lineHeight: 1.8 }}>{message}</p>}
        </section>
      </main>
      <DisclosureFooter />
    </div>
  );
}

function getLoadError(status) {
  if (status === 409) {
    return {
      title: 'この診断は更新されたため、この招待URLは無効になりました',
      message: '対象者に新しいURLの発行を依頼してください。',
    };
  }
  if (status === 410) {
    return {
      title: '対象者のデータは削除処理中です',
      message: 'データ削除中のため、この招待から回答することはできません。',
    };
  }
  if (status === 404) {
    return {
      title: '招待が見つからないか、期限切れです',
      message: 'URLが正しいか、招待を送った方にご確認ください。',
    };
  }
  return {
    title: '招待を読み込めませんでした',
    message: '通信状況を確認して、時間をおいてもう一度お試しください。',
  };
}

function getSubmitError(status) {
  if (status === 429) return '回答の受付上限に達しています。回答は送信されていません。';
  if (status === 410) return '対象者のデータが削除処理中のため、回答を送信できません。';
  if (status === 404) return '招待が見つからないか、期限切れです。回答は送信されていません。';
  if (status === 400) return '回答内容に不備があります。64問すべてに回答して、もう一度お試しください。';
  return '回答を送信できませんでした。通信状況を確認して、もう一度お試しください。';
}

export default function PeerAssessScreen() {
  const { inviteId } = useParams();
  const restoredDraft = useMemo(() => readPeerDraft(inviteId), [inviteId]);
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [answers, setAnswers] = useState(() => restoredDraft.answers);
  const [currentPage, setCurrentPage] = useState(() => restoredDraft.currentPage);
  const [visitedPages, setVisitedPages] = useState(() => new Set([0, restoredDraft.currentPage]));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [answeredInBrowser, setAnsweredInBrowser] = useState(false);
  const previousPageRef = useRef(currentPage);
  const pageHeadingRef = useRef(null);
  const shuffledQuestions = useMemo(() => (
    restoredDraft.questionIds
      ? restoredDraft.questionIds.map((questionId) => PEER_QUESTION_BY_ID.get(questionId))
      : getShuffledPeerQuestions()
  ), [inviteId, restoredDraft]);
  usePrivateDocumentMetadata();

  useEffect(() => {
    setAnswers(restoredDraft.answers);
    setCurrentPage(restoredDraft.currentPage);
    setVisitedPages(new Set([0, restoredDraft.currentPage]));
    previousPageRef.current = restoredDraft.currentPage;
    setSubmitError('');
    setSubmitted(false);
    setInvite(null);
    setLoadError(null);
    setLoading(true);

    try {
      setAnsweredInBrowser(Boolean(localStorage.getItem(`${SUBMITTED_STORAGE_PREFIX}${inviteId || ''}`)));
    } catch {
      setAnsweredInBrowser(false);
    }

    const controller = new AbortController();
    async function loadInvite() {
      try {
        const response = await fetch(`/api/uaam-peer-invite?id=${encodeURIComponent(inviteId || '')}`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
        });
        const body = await response.json().catch(() => null);
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setLoadError(getLoadError(response.status));
          return;
        }
        if (!body || typeof body.subjectName !== 'string') {
          setLoadError(getLoadError(500));
          return;
        }
        setInvite(body);
      } catch (cause) {
        if (cause.name !== 'AbortError') setLoadError(getLoadError(500));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadInvite();
    return () => controller.abort();
  }, [inviteId, restoredDraft]);

  const totalQuestions = shuffledQuestions.length;
  const totalPages = Math.ceil(totalQuestions / QUESTIONS_PER_PAGE);
  const totalAnswered = Object.keys(answers).length;
  const remaining = totalQuestions - totalAnswered;
  const progressPct = Math.round((totalAnswered / totalQuestions) * 100);
  const allAnswered = totalAnswered === totalQuestions;

  const pageCompleteList = useMemo(
    () => Array.from({ length: totalPages }, (_, page) => {
      const start = page * QUESTIONS_PER_PAGE;
      const pageQuestions = shuffledQuestions.slice(start, start + QUESTIONS_PER_PAGE);
      return pageQuestions.every((question) => answers[question.id] !== undefined);
    }),
    [answers, shuffledQuestions, totalPages],
  );

  const firstIncompletePage = pageCompleteList.findIndex((complete) => !complete);
  const maxReachablePage = firstIncompletePage === -1 ? totalPages - 1 : firstIncompletePage;
  const pageQuestions = shuffledQuestions.slice(
    currentPage * QUESTIONS_PER_PAGE,
    (currentPage + 1) * QUESTIONS_PER_PAGE,
  );

  useEffect(() => {
    if (previousPageRef.current !== currentPage) {
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      pageHeadingRef.current?.focus();
      previousPageRef.current = currentPage;
    }
  }, [currentPage]);

  const persistDraft = (nextAnswers, nextPage = currentPage) => {
    writePeerDraft(inviteId, {
      answers: nextAnswers,
      currentPage: nextPage,
      questionIds: shuffledQuestions.map((question) => String(question.id)),
    });
  };

  const handlePageChange = (targetPage) => {
    const nextPage = Math.min(targetPage, maxReachablePage);
    persistDraft(answers, nextPage);
    setVisitedPages((previous) => new Set(previous).add(nextPage));
    setCurrentPage(nextPage);

    if (targetPage > maxReachablePage) {
      const start = nextPage * QUESTIONS_PER_PAGE;
      const firstUnanswered = shuffledQuestions
        .slice(start, start + QUESTIONS_PER_PAGE)
        .find((question) => answers[question.id] === undefined);
      if (firstUnanswered) {
        requestAnimationFrame(() => {
          document.getElementById(`peer-q-${firstUnanswered.id}`)?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        });
      }
    }
  };

  const handleSubmit = async () => {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const response = await fetch('/api/uaam-peer-assess', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inviteId, answers }),
      });
      await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409) {
          setLoadError(getLoadError(409));
          return;
        }
        setSubmitError(getSubmitError(response.status));
        return;
      }

      try {
        localStorage.setItem(`${SUBMITTED_STORAGE_PREFIX}${inviteId}`, new Date().toISOString());
        localStorage.removeItem(`${DRAFT_STORAGE_PREFIX}${inviteId}`);
      } catch {
        // Storage may be unavailable in privacy-restricted browsers. Submission still succeeded.
      }
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setSubmitError(getSubmitError(500));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <StateScreen title="招待を確認しています" message="少しだけお待ちください。" />;
  }
  if (loadError) {
    return <StateScreen title={loadError.title} message={loadError.message} tone="error" />;
  }
  if (submitted) {
    return (
      <StateScreen
        title="回答を送信しました"
        message="ご協力ありがとうございました。回答は匿名で集計されます。"
        tone="success"
      />
    );
  }

  return (
    <div style={shellStyle}>
      <main style={contentStyle}>
        <section style={{ textAlign: 'center', marginBottom: 24 }}>
          <p style={{ margin: '0 0 8px', color: '#7A7060', fontSize: 12, fontWeight: 700, letterSpacing: '0.12em' }}>
            UAAM PEER ASSESSMENT
          </p>
          <h1 style={{ margin: '0 0 10px', fontSize: 28, lineHeight: 1.4 }}>周囲からの評価</h1>
          <p style={{ margin: 0, color: '#62594D', fontSize: 14, lineHeight: 1.8 }}>
            64の質問に、普段の様子を思い浮かべながらお答えください。
          </p>
        </section>

        <section
          aria-label="回答基準"
          style={{
            background: '#FFF9E8',
            border: '1px solid #D8C47A',
            borderRadius: 12,
            padding: '16px 18px',
            marginBottom: answeredInBrowser ? 12 : 24,
            textAlign: 'center',
            color: '#594C24',
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1.7,
          }}
        >
          {invite.subjectName}さんの直近1ヶ月に当てはまるかでお答えください
        </section>

        {answeredInBrowser && (
          <aside
            role="status"
            style={{
              background: '#EFF5FB',
              border: '1px solid #9CB7D1',
              borderRadius: 10,
              padding: '13px 16px',
              marginBottom: 24,
              color: '#315679',
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            このブラウザからは回答済みです。再回答すると新しい回答として追加されます
          </aside>
        )}

        <section aria-label="回答進捗" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7, color: '#62594D', fontSize: 13, fontWeight: 700 }}>
            <span>全体進捗：{totalAnswered}/{totalQuestions}問</span>
            <span>{progressPct}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax={totalQuestions}
            aria-valuenow={totalAnswered}
            style={{ height: 7, background: '#D4C9B0', borderRadius: 4, overflow: 'hidden' }}
          >
            <div style={{
              width: `${progressPct}%`,
              height: '100%',
              borderRadius: 4,
              background: 'linear-gradient(to right, #4A6FA5, #2E8B57, #C4922A, #A84432)',
              transition: 'width 0.2s ease',
            }} />
          </div>
        </section>

        <nav aria-label="質問ページ" style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 20 }}>
          {Array.from({ length: totalPages }, (_, page) => {
            const complete = pageCompleteList[page];
            const active = page === currentPage;
            const reachable = page <= maxReachablePage;
            const visitedIncomplete = visitedPages.has(page) && !complete;
            return (
              <button
                key={page}
                type="button"
                aria-label={reachable
                  ? `${page + 1}ページ目${complete ? '（回答済み）' : ''}`
                  : `${page + 1}ページ目へ進む前に未回答の質問へ移動`}
                aria-current={active ? 'page' : undefined}
                onClick={() => handlePageChange(page)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  border: active
                    ? `2px solid ${ACCENT}`
                    : visitedIncomplete
                      ? '2px solid #A84432'
                      : '1px solid #D4C9B0',
                  background: complete ? '#EAF5EE' : active ? '#FFF9E8' : '#FDFCFA',
                  color: complete ? '#2E6E4D' : active ? ACCENT : '#62594D',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {complete ? '✓' : page + 1}
              </button>
            );
          })}
        </nav>

        <section aria-labelledby="peer-question-page-heading">
          <h2
            id="peer-question-page-heading"
            ref={pageHeadingRef}
            tabIndex={-1}
            style={{ margin: '0 0 12px', color: '#2A2520', fontSize: 16, lineHeight: 1.5 }}
          >
            質問 {currentPage * QUESTIONS_PER_PAGE + 1}〜{Math.min((currentPage + 1) * QUESTIONS_PER_PAGE, totalQuestions)} / {totalQuestions}
          </h2>
          {pageQuestions.map((question, pageIndex) => {
            const displayNumber = currentPage * QUESTIONS_PER_PAGE + pageIndex + 1;
            const selectedValue = answers[question.id];
            return (
              <article
                key={question.id}
                id={`peer-q-${question.id}`}
                data-peer-question-id={question.id}
                style={{
                  background: '#FDFCFA',
                  border: selectedValue === undefined ? '1px solid #D4C9B0' : `1px solid ${ACCENT}80`,
                  borderRadius: 12,
                  padding: '18px 18px 20px',
                  marginBottom: 12,
                  boxShadow: '0 2px 8px rgba(42,37,32,0.06)',
                }}
              >
                <div style={{ marginBottom: 11 }}>
                  <span style={{
                    display: 'inline-block',
                    background: '#7A7060',
                    color: '#fff',
                    borderRadius: 100,
                    padding: '2px 9px',
                    fontSize: 11,
                    fontWeight: 700,
                  }}>
                    {displayNumber}
                  </span>
                </div>
                <p
                  id={`peer-q-${question.id}-text`}
                  data-peer-question-text
                  style={{ margin: '0 0 15px', color: '#2A2520', fontSize: 15, fontWeight: 500, lineHeight: 1.7 }}
                >
                  {question.text}
                </p>
                <div role="group" aria-labelledby={`peer-q-${question.id}-text`} style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {LIKERT_LABELS.map((option) => {
                    const selected = selectedValue === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        data-peer-answer-value={option.value}
                        aria-pressed={selected}
                        onClick={() => setAnswers((previous) => {
                          const nextAnswers = { ...previous, [question.id]: option.value };
                          persistDraft(nextAnswers);
                          return nextAnswers;
                        })}
                        style={{
                          flex: '1 1 56px',
                          minWidth: 48,
                          minHeight: 58,
                          padding: '7px 3px',
                          borderRadius: 8,
                          border: selected ? `2px solid ${ACCENT}` : '1px solid #D4C9B0',
                          background: selected ? ACCENT : '#FDFCFA',
                          color: selected ? '#fff' : '#2A2520',
                          cursor: 'pointer',
                          lineHeight: 1.25,
                        }}
                      >
                        <span style={{ display: 'block', marginBottom: 3, fontSize: 16, fontWeight: 700 }}>{option.value}</span>
                        <span style={{ display: 'block', fontSize: 9 }}>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </section>

        <div style={{ display: 'flex', gap: 12, margin: '24px 0 16px' }}>
          {currentPage > 0 && (
            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              style={{
                flex: 1,
                padding: '14px 18px',
                border: '1px solid #D4C9B0',
                borderRadius: 10,
                background: '#FDFCFA',
                color: '#62594D',
                cursor: 'pointer',
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              ← 前へ
            </button>
          )}
          {currentPage < totalPages - 1 && (
            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              style={{
                flex: 1,
                padding: '14px 18px',
                border: 0,
                borderRadius: 10,
                background: currentPage < maxReachablePage ? ACCENT : '#62594D',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              {currentPage < maxReachablePage
                ? '次へ →'
                : `次へ → (あと${pageQuestions.filter((question) => answers[question.id] === undefined).length}問)`}
            </button>
          )}
        </div>

        {currentPage === totalPages - 1 && (
          <>
            <button
              type="button"
              disabled={!allAnswered || submitting}
              onClick={handleSubmit}
              style={{
                width: '100%',
                padding: '16px 20px',
                border: 0,
                borderRadius: 12,
                background: allAnswered && !submitting
                  ? '#1A3A52'
                  : '#C9C0AE',
                color: '#fff',
                cursor: allAnswered && !submitting ? 'pointer' : 'not-allowed',
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: '0.04em',
              }}
            >
              {submitting ? '送信しています…' : allAnswered ? '回答を送信する' : `あと${remaining}問`}
            </button>
            {!allAnswered && (
              <button
                type="button"
                onClick={() => handlePageChange(firstIncompletePage)}
                style={{
                  width: '100%',
                  marginTop: 12,
                  padding: '12px 18px',
                  border: '1px solid #A84432',
                  borderRadius: 10,
                  background: '#FDFCFA',
                  color: '#A84432',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                未回答ページへ戻る (あと{remaining}問)
              </button>
            )}
          </>
        )}

        {submitError && (
          <div
            role="alert"
            style={{
              marginTop: 16,
              padding: '14px 16px',
              border: '1px solid #D9A89E',
              borderRadius: 10,
              background: '#FFF5F2',
              color: '#A84432',
              fontSize: 14,
              lineHeight: 1.7,
            }}
          >
            {submitError}
          </div>
        )}
      </main>
      <DisclosureFooter />
    </div>
  );
}
