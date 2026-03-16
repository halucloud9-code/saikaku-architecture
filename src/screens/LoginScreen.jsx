import { useState } from 'react';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { signInWithGoogle, db } from '../firebase';

export default function LoginScreen({ onLogin }) {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!agreed) return;
    setLoading(true);
    setError('');
    try {
      const result = await signInWithGoogle();
      if (result && result.user) {
        const user = result.user;
        const docRef = doc(db, 'results', user.uid);
        const snap = await getDoc(docRef);
        if (!snap.data()?.consentAt) {
          await setDoc(docRef, { consentAt: serverTimestamp() }, { merge: true });
        }
        onLogin(user);
      }
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        setError('ログインに失敗しました。再度お試しください。');
      }
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(170deg, #0A0908 0%, #14110D 30%, #1A1610 60%, #0D0B09 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* 背景の光のアクセント */}
      <div style={{
        position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(196,146,42,0.04) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', right: '-10%',
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(74,111,165,0.03) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%', maxWidth: 440,
        position: 'relative', zIndex: 1,
      }}>
        {/* ロゴ・タイトルエリア */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          {/* グラデーションバッジ */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(196,146,42,0.15), rgba(74,111,165,0.15), rgba(168,68,50,0.15))',
            border: '1px solid rgba(196,146,42,0.2)',
            borderRadius: 12, padding: '10px 24px', marginBottom: 24,
          }}>
            <span style={{
              fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif",
              fontSize: 12, fontWeight: 600, color: '#C4922A',
              letterSpacing: '0.2em', textTransform: 'uppercase',
            }}>Unique Ability</span>
          </div>

          <h1 style={{
            fontFamily: "'Noto Serif JP', Georgia, serif",
            fontSize: 36, fontWeight: 800, color: '#F5F0E8',
            margin: '0 0 8px', lineHeight: 1.3, letterSpacing: '0.1em',
          }}>才覚領域</h1>
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 16, fontWeight: 600, color: 'rgba(196,146,42,0.7)',
            letterSpacing: '0.2em', marginBottom: 20,
          }}>Architecture</div>

          {/* 装飾ライン */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 48, height: 1, background: 'linear-gradient(90deg, transparent, rgba(196,146,42,0.4))' }} />
            <div style={{ width: 6, height: 6, borderRadius: '50%', border: '1px solid rgba(196,146,42,0.4)', background: 'rgba(196,146,42,0.1)' }} />
            <div style={{ width: 48, height: 1, background: 'linear-gradient(90deg, rgba(196,146,42,0.4), transparent)' }} />
          </div>

          <p style={{
            fontSize: 14, color: '#8A8070', lineHeight: 2, margin: 0, letterSpacing: '0.02em',
          }}>
            才能 × 価値観 × 情熱<br />
            化学反応を起こす<br />
            あなただけの才覚領域を見つけだす
          </p>
        </div>

        {/* カードエリア */}
        <div style={{
          background: 'rgba(20,17,13,0.8)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(196,146,42,0.12)',
          borderRadius: 20, padding: '36px 32px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
        }}>
          {/* 区切り */}
          <div style={{
            height: 1, background: 'linear-gradient(90deg, transparent, rgba(196,146,42,0.2), transparent)',
            marginBottom: 28,
          }} />

          {/* 同意チェックボックス */}
          <label style={{
            display: 'flex', gap: 14, alignItems: 'flex-start', cursor: 'pointer',
            marginBottom: 28, padding: '16px 18px',
            background: agreed ? 'rgba(196,146,42,0.06)' : 'rgba(255,255,255,0.02)',
            borderRadius: 14,
            border: agreed ? '1px solid rgba(196,146,42,0.2)' : '1px solid rgba(255,255,255,0.05)',
            transition: 'all 0.3s ease',
          }}>
            <div style={{ position: 'relative', marginTop: 2, flexShrink: 0 }}>
              <input
                type="checkbox" checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ position: 'absolute', opacity: 0, width: 20, height: 20, cursor: 'pointer' }}
              />
              <div style={{
                width: 20, height: 20, borderRadius: 6,
                border: `2px solid ${agreed ? '#C4922A' : 'rgba(255,255,255,0.15)'}`,
                background: agreed ? '#C4922A' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}>
                {agreed && (
                  <svg width="11" height="9" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <span style={{ fontSize: 13, color: '#9A9080', lineHeight: 1.8 }}>
              入力いただいた才能・価値観・情熱および解析結果は、
              <strong style={{ color: '#BFB5A0' }}>主催者により閲覧される場合</strong>
              があることに同意します。
            </span>
          </label>

          {/* ログインボタン */}
          <button
            onClick={handleLogin}
            disabled={!agreed || loading}
            style={{
              width: '100%', padding: '16px 24px', borderRadius: 14,
              border: 'none',
              background: agreed && !loading
                ? 'linear-gradient(135deg, #C4922A, #A87A1E)'
                : 'rgba(255,255,255,0.05)',
              color: agreed && !loading ? '#0D0B09' : '#5A5040',
              fontSize: 15, fontWeight: 700,
              fontFamily: "'Noto Serif JP', Georgia, serif",
              cursor: agreed && !loading ? 'pointer' : 'not-allowed',
              transition: 'all 0.3s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: agreed && !loading ? '0 6px 24px rgba(196,146,42,0.3)' : 'none',
              letterSpacing: '0.04em',
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  border: '2px solid rgba(13,11,9,0.2)',
                  borderTopColor: '#0D0B09',
                  animation: 'spin 0.8s linear infinite',
                }} />
                ログイン中...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill={agreed ? '#0D0B09' : '#5A5040'} fillOpacity="0.6" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                </svg>
                Googleでログイン
              </>
            )}
          </button>

          {error && (
            <p style={{ marginTop: 16, fontSize: 13, color: '#DC4444', textAlign: 'center' }}>{error}</p>
          )}
        </div>

        {/* フッター */}
        <p style={{
          marginTop: 32, fontSize: 10, color: 'rgba(138,128,112,0.3)',
          textAlign: 'center', letterSpacing: '0.1em',
        }}>
          Powered by Claude AI × Firebase
        </p>
      </div>
    </div>
  );
}
