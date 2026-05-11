import { useCallback, useEffect, useState } from 'react';
import { auth, signOutUser } from '../firebase';
import { summarizeFromParent, timestampToMillis } from '../../shared/attemptLogic.js';
import SaikakuIntegrationModal from './uaam/SaikakuIntegrationModal';

const TOKENS = {
  saikaku: {
    title: '才覚領域',
    subtitle: 'Architecture History',
    accent: '#C4922A',
    light: '#E8C47A',
    border: 'rgba(196,146,42,0.22)',
    soft: 'rgba(196,146,42,0.09)',
  },
  uaam: {
    title: '才覚発動領域 MATRIX',
    subtitle: 'Activation Matrix History',
    accent: '#4A6FA5',
    light: '#8FB4E0',
    border: 'rgba(74,111,165,0.24)',
    soft: 'rgba(74,111,165,0.10)',
  },
};

function formatDate(value) {
  if (value === null || value === undefined) return '日付未設定';
  let date;
  if (typeof value === 'string') {
    date = new Date(value);
  } else if (typeof value?.toDate === 'function') {
    date = value.toDate();
  } else if (typeof value?._seconds === 'number') {
    date = new Date(value._seconds * 1000);
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) return '日付未設定';

  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getAttemptDate(attempt) {
  return attempt.summary?.createdAt ?? attempt.createdAt ?? null;
}

function getAttemptLabel(attempt, kind) {
  if (kind === 'uaam') {
    return attempt.summary?.typeName
      ?? 'MATRIX 診断結果';
  }

  return attempt.summary?.kakuchiiki
    ?? '才覚領域 診断結果';
}

function getAttemptOrdinal(attempt, index, total) {
  if (attempt.isLegacy) return '保存済み履歴';
  return `${total - index}回目`;
}

function emptyDetails() {
  return {
    attempts: [],
    pendingAttempt: null,
    summary: summarizeFromParent(null),
  };
}

function getPendingNotice(summary, pendingAttempt) {
  if (!summary?.hasPending) return '';
  if (pendingAttempt === null) {
    return 'データ不整合の可能性があるため、サポートまでお問い合わせください。';
  }

  const ms = timestampToMillis(pendingAttempt.createdAt) ?? Date.now();
  const longPending = (Date.now() - ms) >= 10 * 60 * 1000;
  return longPending
    ? '処理中の診断が長時間完了していません。データ不整合の可能性があるため、サポートまでお問い合わせください。'
    : '処理中の診断があります。完了をお待ちください。';
}

function historyErrorMessage(status) {
  if (status === 401) return 'ログイン状態を確認できませんでした。再ログインしてください。';
  if (status === 422) return 'リクエストが不正です。';
  return '履歴を読み込めませんでした。時間をおいて再度お試しください。';
}

function isLegacyIntegration(summary) {
  return summary?.saikakuAttemptId === 'legacy-fallback'
    || summary?.uaamAttemptId === 'legacy-fallback';
}

function needsRegeneration(summary) {
  return summary?.status === 'stale' || isLegacyIntegration(summary);
}

function sortIntegrationSummaries(summaries) {
  return [...summaries].sort((a, b) => {
    const ta = timestampToMillis(a?.generatedAt ?? a?.updatedAt ?? a?.createdAt);
    const tb = timestampToMillis(b?.generatedAt ?? b?.updatedAt ?? b?.createdAt);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return tb - ta;
  });
}

function sourceFromAttempt(summary, attempt, kind) {
  const source = summary?.source ?? {};

  return {
    saikakuLabel:
      source.saikakuLabel
      ?? summary?.saikakuLabel
      ?? summary?.saikakuAttemptLabel
      ?? (kind === 'saikaku' ? getAttemptLabel(attempt, 'saikaku') : null)
      ?? summary?.saikakuAttemptId
      ?? '',
    uaamLabel:
      source.uaamLabel
      ?? summary?.uaamLabel
      ?? summary?.uaamAttemptLabel
      ?? (kind === 'uaam' ? getAttemptLabel(attempt, 'uaam') : null)
      ?? summary?.uaamAttemptId
      ?? '',
    saikakuDate:
      source.saikakuDate
      ?? source.saikakuCreatedAt
      ?? summary?.saikakuDate
      ?? summary?.saikakuCreatedAt
      ?? (kind === 'saikaku' ? getAttemptDate(attempt) : null),
    uaamDate:
      source.uaamDate
      ?? source.uaamCreatedAt
      ?? summary?.uaamDate
      ?? summary?.uaamCreatedAt
      ?? (kind === 'uaam' ? getAttemptDate(attempt) : null),
  };
}

function withAttemptSource(summary, attempt, kind) {
  return {
    ...summary,
    source: sourceFromAttempt(summary, attempt, kind),
  };
}

function getIntegrationSummaries(attempt, kind) {
  if (kind === 'uaam') {
    return attempt.integrationSummary?.exists
      ? [withAttemptSource(attempt.integrationSummary, attempt, kind)]
      : [];
  }

  return sortIntegrationSummaries(attempt.integrationSummaries ?? [])
    .map((summary) => withAttemptSource(summary, attempt, kind));
}

export default function HistoryScreen({ user, kind, onBack, onSelectAttemptId, onLogout }) {
  const [details, setDetails] = useState(null);
  const [error, setError] = useState('');
  const [hoveredId, setHoveredId] = useState('');
  const [integrationModal, setIntegrationModal] = useState(null);
  const tokens = TOKENS[kind] ?? TOKENS.saikaku;
  const attempts = details?.attempts ?? null;
  const summary = details?.summary ?? null;
  const pendingNotice = getPendingNotice(summary, details?.pendingAttempt ?? null);

  const load = useCallback(async (isCancelled = () => false) => {
    const apply = (update) => {
      if (!isCancelled()) update();
    };

    if (!user?.uid) {
      apply(() => {
        setError('');
        setDetails(emptyDetails());
      });
      return;
    }

    apply(() => {
      setDetails(null);
      setError('');
    });

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        apply(() => {
          setError(historyErrorMessage(401));
          setDetails(emptyDetails());
        });
        return;
      }

      const res = await fetch(`/api/me/history?kind=${encodeURIComponent(kind)}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        apply(() => {
          setError(historyErrorMessage(res.status));
          setDetails(emptyDetails());
        });
        return;
      }

      const data = await res.json();
      apply(() => {
        setError('');
        setDetails({
          attempts: data.attempts ?? [],
          pendingAttempt: data.pendingAttempt ?? null,
          summary: data.summary ?? summarizeFromParent(null),
        });
      });
    } catch {
      apply(() => {
        setError('通信エラーが発生しました。');
        setDetails(emptyDetails());
      });
    }
  }, [user?.uid, kind]);

  useEffect(() => {
    let cancelled = false;
    load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0D0B09 0%, #1A1610 42%, #0D0B09 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -120, right: -120,
        width: 400, height: 400, borderRadius: '50%',
        background: `radial-gradient(circle, ${tokens.soft} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -100, left: -100,
        width: 340, height: 340, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.035) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        background: 'rgba(13,11,9,0.6)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${tokens.border}`,
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        zIndex: 1,
      }}>
        <button onClick={onBack} style={{
          fontSize: 12,
          color: tokens.light,
          background: tokens.soft,
          border: `1px solid ${tokens.border}`,
          borderRadius: 8,
          padding: '7px 13px',
          cursor: 'pointer',
          fontWeight: 700,
          letterSpacing: '0.04em',
        }}>
          ← 戻る
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user?.photoURL && (
            <img src={user.photoURL} alt="" style={{
              width: 30, height: 30, borderRadius: '50%',
              border: `2px solid ${tokens.border}`,
            }} />
          )}
          <span style={{ fontSize: 12, color: '#FFFFFF', fontWeight: 600 }}>{user?.displayName}</span>
          <button onClick={async () => { await signOutUser(); onLogout(); }} style={{
            fontSize: 11,
            color: '#8A8070',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6,
            padding: '5px 12px',
            cursor: 'pointer',
            fontWeight: 500,
          }}>
            ログアウト
          </button>
        </div>
      </div>

      <main style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: '52px 20px 72px',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: tokens.soft,
            border: `1px solid ${tokens.border}`,
            borderRadius: 100,
            padding: '5px 16px',
            marginBottom: 16,
          }}>
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.18em',
              color: tokens.light,
              textTransform: 'uppercase',
            }}>
              History
            </span>
          </div>
          <h1 style={{
            fontSize: 28,
            fontWeight: 800,
            color: '#F5F0E8',
            margin: 0,
            fontFamily: "'Noto Serif JP', Georgia, serif",
            letterSpacing: '0.07em',
          }}>
            {tokens.title}
          </h1>
          <p style={{
            fontSize: 12,
            color: tokens.light,
            margin: '10px 0 0',
            letterSpacing: '0.14em',
            fontWeight: 700,
          }}>
            {tokens.subtitle}
          </p>
        </div>

        {attempts === null && (
          <div style={{
            border: `1px solid ${tokens.border}`,
            background: 'rgba(26,22,16,0.72)',
            borderRadius: 16,
            padding: '36px 24px',
            textAlign: 'center',
            color: '#8A8070',
            fontSize: 13,
          }}>
            読み込み中...
          </div>
        )}

        {attempts !== null && pendingNotice && (
          <div
            data-testid="pending-notice"
            style={{
              border: `1px solid ${tokens.border}`,
              background: tokens.soft,
              borderRadius: 16,
              padding: '18px 20px',
              color: '#F5F0E8',
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1.8,
              marginBottom: 14,
            }}
          >
            {pendingNotice}
          </div>
        )}

        {attempts !== null && error && (
          <div
            role="alert"
            style={{
              border: `1px solid ${tokens.border}`,
              background: 'rgba(26,22,16,0.86)',
              borderRadius: 16,
              padding: '22px 24px',
              textAlign: 'center',
              color: '#F5F0E8',
              marginBottom: 14,
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px', lineHeight: 1.7 }}>
              {error}
            </p>
            <button
              onClick={() => load()}
              style={{
                fontSize: 12,
                color: tokens.light,
                background: tokens.soft,
                border: `1px solid ${tokens.border}`,
                borderRadius: 8,
                padding: '8px 14px',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              再読み込み
            </button>
          </div>
        )}

        {attempts !== null && attempts.length === 0 && !error && !summary?.hasPending && (
          <div style={{
            border: `1px solid ${tokens.border}`,
            background: 'rgba(26,22,16,0.72)',
            borderRadius: 16,
            padding: '36px 24px',
            textAlign: 'center',
          }}>
            <p style={{ color: '#F5F0E8', fontSize: 15, fontWeight: 700, margin: '0 0 8px' }}>
              まだ診断履歴がありません
            </p>
          </div>
        )}

        {attempts !== null && attempts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {attempts.map((attempt, index) => {
              const isHovered = hoveredId === attempt.id;
              const label = getAttemptLabel(attempt, kind);
              const ordinal = getAttemptOrdinal(attempt, index, attempts.length);
              const integrationSummaries = getIntegrationSummaries(attempt, kind);
              const hasIntegrations = integrationSummaries.length > 0;
              const showRegenerationBadge = integrationSummaries.some(needsRegeneration);
              const openAttempt = () => onSelectAttemptId(attempt.id, kind);
              const handleKeyDown = (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                openAttempt();
              };

              return (
                <div
                  data-testid="history-item"
                  key={attempt.id}
                  role="button"
                  tabIndex={0}
                  onClick={openAttempt}
                  onKeyDown={handleKeyDown}
                  onMouseEnter={() => setHoveredId(attempt.id)}
                  onMouseLeave={() => setHoveredId('')}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: `1px solid ${isHovered ? tokens.light : tokens.border}`,
                    borderRadius: 16,
                    background: isHovered
                      ? `linear-gradient(145deg, ${tokens.soft} 0%, rgba(26,22,16,0.96) 100%)`
                      : 'rgba(26,22,16,0.78)',
                    padding: '22px 22px 20px',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: isHovered ? `0 18px 52px ${tokens.soft}` : '0 4px 24px rgba(0,0,0,0.28)',
                    transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                    transition: 'all 0.28s ease',
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    background: `linear-gradient(90deg, transparent 8%, ${tokens.accent} 50%, transparent 92%)`,
                    opacity: isHovered ? 0.9 : 0.45,
                  }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: tokens.soft,
                      border: `1px solid ${tokens.border}`,
                      borderRadius: 100,
                      padding: '4px 11px',
                      color: tokens.light,
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '0.12em',
                    }}>
                      {ordinal}
                    </span>
                    <span style={{
                      color: '#8A8070',
                      fontSize: 11,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      paddingTop: 4,
                    }}>
                      {formatDate(getAttemptDate(attempt))}
                    </span>
                  </div>
                  <div style={{
                    fontFamily: "'Noto Serif JP', Georgia, serif",
                    color: '#FFFFFF',
                    fontSize: 21,
                    fontWeight: 800,
                    lineHeight: 1.5,
                    letterSpacing: '0.04em',
                    wordBreak: 'break-word',
                  }}>
                    {label}
                  </div>
                  {hasIntegrations && (
                    <button
                      type="button"
                      data-testid="integration-banner"
                      onClick={(event) => {
                        event.stopPropagation();
                        setIntegrationModal({
                          kind,
                          summaries: integrationSummaries,
                        });
                      }}
                      style={{
                        marginTop: 14,
                        width: '100%',
                        border: `1px solid ${tokens.border}`,
                        borderRadius: 10,
                        background: tokens.soft,
                        color: '#F5F0E8',
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: 12,
                        fontWeight: 800,
                        letterSpacing: '0.03em',
                      }}
                    >
                      <span>統合分析あり ({integrationSummaries.length})</span>
                      {showRegenerationBadge && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          border: '1px solid rgba(245,211,106,0.38)',
                          background: 'rgba(184,150,12,0.16)',
                          color: '#F5D36A',
                          borderRadius: 999,
                          padding: '3px 9px',
                          fontSize: 10,
                          fontWeight: 800,
                          whiteSpace: 'nowrap',
                        }}>
                          要再生成
                        </span>
                      )}
                    </button>
                  )}
                  <div style={{
                    marginTop: 14,
                    color: tokens.light,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                  }}>
                    結果を見る →
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <SaikakuIntegrationModal
        open={!!integrationModal}
        onClose={() => setIntegrationModal(null)}
        kind={integrationModal?.kind ?? kind}
        integrationSummary={integrationModal?.summaries?.[0] ?? null}
        integrationSummaries={integrationModal?.summaries ?? []}
      />
    </div>
  );
}
