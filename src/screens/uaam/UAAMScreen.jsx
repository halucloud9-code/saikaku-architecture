import { useState, useMemo, useEffect, useRef } from 'react';
import { UAAM_QUESTIONS, LIKERT_LABELS, VALIDITY_QUESTIONS, getShuffledQuestions } from '../../data/uaam_questions';
import { signOutUser } from '../../firebase';

const QUESTIONS_PER_PAGE = 10;
const ACCENT = '#B8960C';

export default function UAAMScreen({ user, isAdmin, onSubmit, onBack, onAdmin, onLogout, error }) {
  const [answers, setAnswers] = useState({});       // 本問 { id(number): score }
  const [vAnswers, setVAnswers] = useState({});      // V問 { 'V1'|'V2'|'V3': score }
  const [currentPage, setCurrentPage] = useState(0);
  const [visitedPages, setVisitedPages] = useState(() => new Set([0]));
  const [focusTarget, setFocusTarget] = useState(null);
  const previousPageRef = useRef(currentPage);
  const focusNonceRef = useRef(0);

  // 初回マウント時に1回だけシャッフル
  const shuffledQuestions = useMemo(() => getShuffledQuestions(), []);

  const totalQuestions = shuffledQuestions.length; // 67
  const totalPages = Math.ceil(totalQuestions / QUESTIONS_PER_PAGE);

  const pageCompleteList = useMemo(() => {
    const pageCount = Math.ceil(shuffledQuestions.length / QUESTIONS_PER_PAGE);

    return Array.from({ length: pageCount }, (_, i) => {
      const pageStart = i * QUESTIONS_PER_PAGE;
      const pageEnd = Math.min((i + 1) * QUESTIONS_PER_PAGE, shuffledQuestions.length);
      const pageQs = shuffledQuestions.slice(pageStart, pageEnd);

      return pageQs.every((q) =>
        q.validity ? vAnswers[q.id] !== undefined : answers[q.id] !== undefined
      );
    });
  }, [answers, vAnswers, shuffledQuestions]);

  const firstIncompletePage = useMemo(
    () => pageCompleteList.findIndex((isComplete) => !isComplete),
    [pageCompleteList]
  );

  const maxReachablePage = useMemo(
    () => firstIncompletePage === -1 ? totalPages - 1 : firstIncompletePage,
    [firstIncompletePage, totalPages]
  );

  // 現在ページの質問
  const pageQuestions = shuffledQuestions.slice(
    currentPage * QUESTIONS_PER_PAGE,
    (currentPage + 1) * QUESTIONS_PER_PAGE
  );

  // 全回答数（本問 + V問）
  const totalAnswered = Object.keys(answers).length + Object.keys(vAnswers).length;
  const remaining = totalQuestions - totalAnswered;
  const progressPct = Math.round((totalAnswered / totalQuestions) * 100);

  // 回答ハンドラ：V問と本問を自動分離
  const handleAnswer = (question, value) => {
    if (question.validity) {
      setVAnswers((prev) => ({ ...prev, [question.id]: value }));
    } else {
      setAnswers((prev) => ({ ...prev, [question.id]: value }));
    }
  };

  // 回答済みかどうかの判定
  const getAnswerValue = (question) => {
    return question.validity ? vAnswers[question.id] : answers[question.id];
  };

  const allAnswered = totalAnswered === totalQuestions;

  const handleSubmit = () => {
    if (!allAnswered) return;
    onSubmit(answers, vAnswers);
  };

  // impl-2/3: 質問カード側はこの形式の DOM id を付与する。
  const getFirstUnansweredQuestionId = (page) => {
    const pageStart = page * QUESTIONS_PER_PAGE;
    const pageEnd = Math.min((page + 1) * QUESTIONS_PER_PAGE, totalQuestions);
    const firstUnanswered = shuffledQuestions.slice(pageStart, pageEnd).find((q) =>
      !(q.validity ? vAnswers[q.id] !== undefined : answers[q.id] !== undefined)
    );

    return firstUnanswered ? `uaam-q-${firstUnanswered.id}` : null;
  };

  const createFocusTarget = (id) => {
    const now = Date.now();
    const nonce = now <= focusNonceRef.current ? focusNonceRef.current + 1 : now;
    focusNonceRef.current = nonce;
    return { id, nonce };
  };

  const handlePageChange = (target) => {
    if (target > maxReachablePage) {
      setVisitedPages((prev) => new Set(prev).add(maxReachablePage));

      if (currentPage !== maxReachablePage) {
        setCurrentPage(maxReachablePage);
      }

      const firstUnansweredId = getFirstUnansweredQuestionId(maxReachablePage);
      setFocusTarget(firstUnansweredId ? createFocusTarget(firstUnansweredId) : null);
      return;
    }

    setVisitedPages((prev) => new Set(prev).add(target));
    setCurrentPage(target);

    const firstUnansweredId = getFirstUnansweredQuestionId(target);
    setFocusTarget(firstUnansweredId ? createFocusTarget(firstUnansweredId) : null);
  };

  useEffect(() => {
    const pageChanged = previousPageRef.current !== currentPage;

    if (focusTarget) {
      document.getElementById(focusTarget.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      previousPageRef.current = currentPage;
      setFocusTarget(null);
      return;
    }

    if (pageChanged) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      previousPageRef.current = currentPage;
    }
  }, [currentPage, focusTarget?.nonce]);

  // 通し番号（シャッフル後の表示順）
  const getDisplayNumber = (pageIdx) => currentPage * QUESTIONS_PER_PAGE + pageIdx + 1;

  const nextEnabled = currentPage < maxReachablePage;
  const nextLabel = nextEnabled
    ? '次へ →'
    : `次へ → (あと${pageQuestions.filter((q) => getAnswerValue(q) === undefined).length}問)`;

  return (
    <div style={{ minHeight: '100vh', background: '#F5F0E8' }}>
      {/* ヘッダー */}
      <div
        style={{
          background: '#FDFCFA',
          borderBottom: '1px solid #D4C9B0',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onBack}
            style={{
              padding: '6px 12px', borderRadius: 6, border: '1px solid #D4C9B0',
              background: 'transparent', color: '#7A7060', fontSize: 13, cursor: 'pointer',
            }}
          >
            ← 戻る
          </button>
          <span style={{
            fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
            fontSize: 16, fontWeight: 700, color: '#2A2520',
          }}>
            才覚発動領域
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isAdmin && (
            <button
              onClick={onAdmin}
              style={{
                padding: '6px 12px', borderRadius: 6, border: '1px solid #D4C9B0',
                background: 'transparent', color: '#7A7060', fontSize: 13, cursor: 'pointer',
              }}
            >
              管理画面
            </button>
          )}
          {user.photoURL && (
            <img
              src={user.photoURL} alt={user.displayName}
              style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid #D4C9B0' }}
            />
          )}
          <button
            onClick={async () => { await signOutUser(); onLogout(); }}
            style={{
              padding: '6px 12px', borderRadius: 6, border: '1px solid #D4C9B0',
              background: 'transparent', color: '#7A7060', fontSize: 13, cursor: 'pointer',
            }}
          >
            ログアウト
          </button>
        </div>
      </div>

      {/* 全体進捗バー */}
      <div style={{ padding: '16px 24px 0', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: '#7A7060', fontWeight: 600 }}>
            全体進捗：{totalAnswered}/{totalQuestions}問
          </span>
          <span style={{ fontSize: 13, color: '#7A7060', fontWeight: 700 }}>{progressPct}%</span>
        </div>
        <div style={{ height: 6, background: '#D4C9B0', borderRadius: 3, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              background: 'linear-gradient(to right, #4A6FA5, #2E8B57, #C4922A, #A84432)',
              borderRadius: 3,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* ページインジケーター */}
      <div style={{ padding: '16px 24px 0', maxWidth: 800, margin: '0 auto' }}>
        <span data-testid="uaam-current-page" data-current-page={currentPage} style={{ display: 'none' }} />
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          {Array.from({ length: totalPages }, (_, i) => {
            const isComplete = pageCompleteList[i];
            const isActive = i === currentPage;
            const isReachable = i <= maxReachablePage;
            const isVisitedIncomplete = visitedPages.has(i) && !isComplete;

            return (
              <button
                key={i}
                data-testid={`uaam-page-dot-${i}`}
                aria-disabled={!isReachable}
                onClick={() => handlePageChange(i)}
                style={{
                  width: 40, height: 40,
                  borderRadius: 10,
                  border: isActive
                    ? `2px solid ${ACCENT}`
                    : isVisitedIncomplete
                      ? '2px solid #A84432'
                      : '1px solid #D4C9B0',
                  background: isComplete ? '#2E8B5720' : isActive ? `${ACCENT}15` : '#FDFCFA',
                  cursor: isReachable ? 'pointer' : 'not-allowed',
                  opacity: isReachable ? 1 : 0.4,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{
                  fontSize: 14, fontWeight: 700,
                  color: isComplete ? '#2E8B57' : isActive ? ACCENT : '#7A7060',
                }}>
                  {isComplete ? '✓' : i + 1}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 質問リスト */}
      <div style={{ padding: '20px 24px', maxWidth: 800, margin: '0 auto' }}>
        <div style={{
          fontSize: 12, color: '#7A7060', marginBottom: 16, textAlign: 'center',
        }}>
          すべての質問は「直近1ヶ月の自分」を基準にお答えください
        </div>

        {pageQuestions.map((q, qi) => {
          const displayNum = getDisplayNumber(qi);
          const selectedValue = getAnswerValue(q);

          return (
            <div
              key={q.id}
              id={`uaam-q-${q.id}`}
              style={{
                background: '#FDFCFA',
                border: selectedValue !== undefined ? `1px solid ${ACCENT}60` : '1px solid #D4C9B0',
                borderRadius: 12,
                padding: '18px 20px',
                marginBottom: 12,
                boxShadow: '0 1px 4px rgba(42,37,32,0.06)',
                transition: 'border-color 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                <span style={{
                  background: '#7A7060',
                  color: '#fff',
                  fontSize: 11, fontWeight: 700,
                  padding: '2px 8px', borderRadius: 100, flexShrink: 0,
                }}>
                  {displayNum}
                </span>
              </div>
              <p style={{ fontSize: 15, color: '#2A2520', margin: '0 0 14px', lineHeight: 1.6, fontWeight: 500 }}>
                {q.text}
              </p>

              {/* リッカート尺度ボタン */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {LIKERT_LABELS.map((opt) => {
                  const isSelected = selectedValue === opt.value;
                  return (
                    <button
                      key={opt.value}
                      data-testid={`uaam-likert-${displayNum}-${opt.value}`}
                      onClick={() => handleAnswer(q, opt.value)}
                      style={{
                        flex: 1, minWidth: 50, padding: '8px 4px', borderRadius: 8,
                        border: isSelected ? `2px solid ${ACCENT}` : '1px solid #D4C9B0',
                        background: isSelected ? ACCENT : '#FDFCFA',
                        color: isSelected ? '#fff' : '#2A2520',
                        fontSize: 11, fontWeight: isSelected ? 700 : 400,
                        cursor: 'pointer', transition: 'all 0.15s',
                        textAlign: 'center', lineHeight: 1.3,
                      }}
                    >
                      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{opt.value}</div>
                      <div style={{ fontSize: 9 }}>{opt.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* ナビゲーションボタン */}
        <div style={{ display: 'flex', gap: 12, marginTop: 24, marginBottom: 16 }}>
          {currentPage > 0 && (
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              style={{
                flex: 1, padding: '14px 20px', borderRadius: 10,
                border: '1px solid #D4C9B0', background: '#FDFCFA',
                color: '#7A7060', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              }}
            >
              ← 前へ
            </button>
          )}
          {currentPage < totalPages - 1 && (
            <button
              data-testid="uaam-next-btn"
              aria-disabled={!nextEnabled}
              onClick={() => handlePageChange(currentPage + 1)}
              style={{
                flex: 1, padding: '14px 20px', borderRadius: 10,
                border: 'none', background: nextEnabled ? ACCENT : '#D4C9B0',
                color: '#fff', fontSize: 15, fontWeight: 600,
                cursor: nextEnabled ? 'pointer' : 'not-allowed',
              }}
            >
              {nextLabel}
            </button>
          )}
        </div>

        {/* 送信ボタン（最終ページ） */}
        {currentPage === totalPages - 1 && (
          <>
            <button
              onClick={handleSubmit}
              disabled={!allAnswered}
              style={{
                width: '100%', padding: '16px 20px', borderRadius: 12, border: 'none',
                background: allAnswered
                  ? 'linear-gradient(135deg, #4A6FA5, #2E8B57, #C4922A, #A84432)'
                  : '#D4C9B0',
                color: '#fff', fontSize: 18, fontWeight: 700,
                cursor: allAnswered ? 'pointer' : 'not-allowed',
                letterSpacing: '0.05em', marginBottom: 16,
              }}
            >
              {allAnswered ? '診断結果を見る' : `あと${remaining}問`}
            </button>
            {!allAnswered && (
              <button
                type="button"
                data-testid="uaam-jump-incomplete-btn"
                aria-label="最初の未回答ページへ移動"
                onClick={() => handlePageChange(firstIncompletePage)}
                style={{
                  width: '100%', padding: '12px 20px', borderRadius: 10,
                  border: '1px solid #A84432', background: '#FDFCFA',
                  color: '#A84432', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', marginBottom: 12,
                }}
              >
                {`未回答ページへ戻る (あと${remaining}問)`}
              </button>
            )}
          </>
        )}

        {error && (
          <div style={{
            background: '#FFF0F0', border: '1px solid #A84432', borderRadius: 10,
            padding: '12px 16px', color: '#A84432', fontSize: 14, marginBottom: 16,
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
