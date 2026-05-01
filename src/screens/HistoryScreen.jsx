import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { db, signOutUser } from '../firebase';
import { legacyDocToAttempt } from '../utils/attemptAdapter';

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
  if (!value) return '日付未設定';
  const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
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
      ?? attempt.full?.analysis?.type_name
      ?? attempt.full?.analysis?.primary_type
      ?? 'MATRIX 診断結果';
  }

  return attempt.summary?.kakuchiiki
    ?? attempt.full?.selectedKakuchiiki
    ?? attempt.full?.result?.kakuchiiki
    ?? '才覚領域 診断結果';
}

function getAttemptOrdinal(attempt, index, total) {
  if (attempt.isLegacy) return '保存済み履歴';
  return `${total - index}回目`;
}

export default function HistoryScreen({ user, kind, onBack, onSelectAttempt, onLogout }) {
  const [attempts, setAttempts] = useState(null);
  const [error, setError] = useState('');
  const [hoveredId, setHoveredId] = useState('');
  const tokens = TOKENS[kind] ?? TOKENS.saikaku;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user?.uid) {
        setAttempts([]);
        return;
      }

      setAttempts(null);
      setError('');

      try {
        const collName = kind === 'uaam' ? 'uaam_results' : 'results';
        const parentRef = doc(db, collName, user.uid);
        const subSnap = await getDocs(query(collection(parentRef, 'attempts'), orderBy('createdAt', 'desc')));
        const list = subSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((attempt) => attempt.status === 'committed');

        if (list.length === 0) {
          const parentSnap = await getDoc(parentRef);
          const synth = legacyDocToAttempt(parentSnap.exists() ? parentSnap.data() : null, kind);
          if (synth) list.push(synth);
        }

        if (!cancelled) setAttempts(list);
      } catch (e) {
        if (!cancelled) {
          setError(e.message || '履歴の読み込みに失敗しました');
          setAttempts([]);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, kind]);

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

        {attempts !== null && attempts.length === 0 && (
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
            {error && (
              <p style={{ color: '#8A8070', fontSize: 12, margin: 0, lineHeight: 1.7 }}>
                {error}
              </p>
            )}
          </div>
        )}

        {attempts !== null && attempts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {attempts.map((attempt, index) => {
              const isHovered = hoveredId === attempt.id;
              const label = getAttemptLabel(attempt, kind);
              const ordinal = getAttemptOrdinal(attempt, index, attempts.length);

              return (
                <button
                  key={attempt.id}
                  onClick={() => onSelectAttempt(attempt)}
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
                  <div style={{
                    marginTop: 14,
                    color: tokens.light,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                  }}>
                    結果を見る →
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
