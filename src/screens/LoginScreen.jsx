import { useState, useEffect } from 'react';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { signInWithGoogle, db } from '../firebase';

/* ============================================================
 * LoginScreen — System 1 を撃つ直感UI
 * ============================================================ */

const GOLD = '#FFD700';
const GOLD_DIM = '#C4922A';
const GOLD_GLOW = 'rgba(255,215,0,0.3)';

// CSSアニメーション挿入
const injectStyles = () => {
  if (document.getElementById('login-screen-styles')) return;
  const style = document.createElement('style');
  style.id = 'login-screen-styles';
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800;900&family=Noto+Serif+JP:wght@400;600;700;900&display=swap');

    @keyframes loginSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    @keyframes loginFloat {
      0%,100% { transform: translateY(0px); }
      50% { transform: translateY(-8px); }
    }
    @keyframes loginPulseGold {
      0%,100% { box-shadow: 0 0 20px rgba(255,215,0,0.15), 0 4px 30px rgba(0,0,0,0.4); }
      50% { box-shadow: 0 0 40px rgba(255,215,0,0.25), 0 4px 30px rgba(0,0,0,0.4); }
    }
    @keyframes loginFadeUp {
      from { opacity: 0; transform: translateY(24px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes loginShimmer {
      0% { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    @keyframes loginOrbitSlow {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes loginBtnHover {
      0%,100% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
    }
    .login-btn-gold:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 0 30px rgba(255,215,0,0.3), 0 8px 40px rgba(0,0,0,0.4) !important;
    }
    .login-btn-gold:active:not(:disabled) {
      transform: translateY(0px) scale(0.99);
    }
  `;
  document.head.appendChild(style);
};

export default function LoginScreen({ onLogin }) {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    injectStyles();
    requestAnimationFrame(() => setMounted(true));
  }, []);

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

  // フェードインアニメーションの遅延
  const fadeStyle = (delay) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(24px)',
    transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(170deg, #0A0A0F 0%, #12101A 30%, #0E0C14 60%, #0A0A0F 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* === 背景パーティクル装飾 === */}
      {/* 回転するゴールドリング */}
      <div style={{
        position: 'absolute',
        top: '15%', left: '50%',
        width: 500, height: 500,
        marginLeft: -250, marginTop: -250,
        borderRadius: '50%',
        border: '1px solid rgba(255,215,0,0.04)',
        animation: 'loginOrbitSlow 60s linear infinite',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        top: '15%', left: '50%',
        width: 380, height: 380,
        marginLeft: -190, marginTop: -190,
        borderRadius: '50%',
        border: '1px solid rgba(255,215,0,0.06)',
        animation: 'loginOrbitSlow 45s linear infinite reverse',
        pointerEvents: 'none',
      }} />

      {/* 上部グラデーション光彩 */}
      <div style={{
        position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 400,
        background: 'radial-gradient(ellipse, rgba(255,215,0,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* 下部アンビエント */}
      <div style={{
        position: 'absolute', bottom: -80, left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 300,
        background: 'radial-gradient(ellipse, rgba(196,146,42,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* === メインカード === */}
      <div style={{
        width: '100%', maxWidth: 420,
        position: 'relative', zIndex: 1,
      }}>

        {/* ── ブランドエリア ── */}
        <div style={{ textAlign: 'center', marginBottom: 48, ...fadeStyle(0.1) }}>

          {/* ロゴマーク — 六角形＋Gシンボル */}
          <div style={{
            width: 80, height: 80, margin: '0 auto 28px',
            position: 'relative',
            animation: 'loginFloat 4s ease-in-out infinite',
          }}>
            {/* ゴールド六角形外枠 */}
            <svg width="80" height="80" viewBox="0 0 80 80" style={{ position: 'absolute', top: 0, left: 0 }}>
              <polygon
                points="40,4 72,22 72,58 40,76 8,58 8,22"
                fill="none"
                stroke={GOLD}
                strokeWidth="1.5"
                opacity="0.5"
              />
              <polygon
                points="40,12 64,26 64,54 40,68 16,54 16,26"
                fill="rgba(255,215,0,0.05)"
                stroke={GOLD}
                strokeWidth="0.5"
                opacity="0.3"
              />
            </svg>
            {/* 中央 G */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 28, fontWeight: 800,
              color: GOLD,
              textShadow: `0 0 20px rgba(255,215,0,0.4)`,
            }}>G</div>
          </div>

          {/* タイトル */}
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.35em',
            color: GOLD_DIM, textTransform: 'uppercase', marginBottom: 12,
            fontFamily: "'SF Mono', Consolas, monospace",
          }}>GRIFFON PRESENTS</div>

          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 16, fontWeight: 600, color: GOLD,
            margin: '0 0 6px', letterSpacing: '0.25em',
            textShadow: `0 0 30px rgba(255,215,0,0.2)`,
          }}>Unique Ability Architecture</h1>

          <h2 style={{
            fontFamily: "'Noto Serif JP', Georgia, serif",
            fontSize: 38, fontWeight: 900, color: '#FFFFFF',
            margin: '0 0 4px', lineHeight: 1.15, letterSpacing: '0.08em',
          }}>才覚領域</h2>

          <div style={{
            width: 60, height: 2, margin: '16px auto',
            background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
          }} />

          <p style={{
            fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 2,
            margin: 0,
            fontFamily: "'Noto Serif JP', serif",
          }}>
            才能・価値観・情熱の交差点から<br />
            あなただけの才覚領域を導き出す
          </p>
        </div>

        {/* ── カード本体 ── */}
        <div style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
          borderRadius: 20,
          padding: '32px 28px',
          border: '1px solid rgba(255,215,0,0.12)',
          backdropFilter: 'blur(20px)',
          animation: mounted ? 'loginPulseGold 4s ease-in-out infinite' : 'none',
          ...fadeStyle(0.3),
        }}>

          {/* 装飾コーナー */}
          <div style={{ position: 'relative' }}>
            {['top-left','top-right','bottom-left','bottom-right'].map(pos => (
              <div key={pos} style={{
                position: 'absolute', width: 16, height: 16,
                [pos.includes('top') ? 'top' : 'bottom']: -32,
                [pos.includes('left') ? 'left' : 'right']: -28,
                borderTop: pos.includes('top') ? `1.5px solid ${GOLD}30` : 'none',
                borderBottom: pos.includes('bottom') ? `1.5px solid ${GOLD}30` : 'none',
                borderLeft: pos.includes('left') ? `1.5px solid ${GOLD}30` : 'none',
                borderRight: pos.includes('right') ? `1.5px solid ${GOLD}30` : 'none',
                borderRadius: 2,
              }} />
            ))}
          </div>

          {/* 3つのキーワード */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 28,
          }}>
            {[
              { label: '価値観', en: 'Values', color: '#60A5FA' },
              { label: '才能', en: 'Talent', color: '#FBBF24' },
              { label: '情熱', en: 'Passion', color: '#F87171' },
            ].map((item, i) => (
              <div key={item.en} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: `${item.color}0A`,
                border: `1px solid ${item.color}25`,
                borderRadius: 20, padding: '5px 14px',
                ...fadeStyle(0.4 + i * 0.1),
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', background: item.color,
                  boxShadow: `0 0 8px ${item.color}60`,
                }} />
                <span style={{ fontSize: 11, color: '#FFFFFF', fontWeight: 600 }}>{item.label}</span>
                <span style={{ fontSize: 9, color: `${item.color}AA`, fontWeight: 500 }}>{item.en}</span>
              </div>
            ))}
          </div>

          {/* 同意チェック */}
          <label style={{
            display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer',
            marginBottom: 24, padding: '14px 16px',
            borderRadius: 12,
            background: agreed ? 'rgba(255,215,0,0.04)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${agreed ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.06)'}`,
            transition: 'all 0.3s ease',
            ...fadeStyle(0.5),
          }}>
            <div style={{ position: 'relative', marginTop: 1, flexShrink: 0 }}>
              <input type="checkbox" checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ position: 'absolute', opacity: 0, width: 20, height: 20, cursor: 'pointer' }}
              />
              <div style={{
                width: 20, height: 20, borderRadius: 6,
                border: `2px solid ${agreed ? GOLD : 'rgba(255,255,255,0.15)'}`,
                background: agreed ? GOLD : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.25s ease',
                boxShadow: agreed ? `0 0 12px rgba(255,215,0,0.3)` : 'none',
              }}>
                {agreed && (
                  <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                    <path d="M1 4.5L4 7.5L10 1" stroke="#0A0A0F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8 }}>
              入力情報および解析結果が<span style={{ color: '#FFFFFF', fontWeight: 600 }}>主催者に共有される</span>ことに同意します
            </span>
          </label>

          {/* ログインボタン */}
          <button
            className="login-btn-gold"
            onClick={handleLogin}
            disabled={!agreed || loading}
            style={{
              width: '100%', padding: '16px 24px', borderRadius: 14,
              border: agreed && !loading ? `1.5px solid ${GOLD}60` : '1.5px solid rgba(255,255,255,0.06)',
              background: agreed && !loading
                ? `linear-gradient(135deg, #8B6914 0%, #C4922A 30%, #FFD700 60%, #C4922A 100%)`
                : 'rgba(255,255,255,0.03)',
              backgroundSize: '200% 200%',
              animation: agreed && !loading ? 'loginBtnHover 3s ease infinite' : 'none',
              color: agreed && !loading ? '#0A0A0F' : 'rgba(255,255,255,0.2)',
              fontSize: 15, fontWeight: 800, letterSpacing: '0.05em',
              cursor: agreed && !loading ? 'pointer' : 'not-allowed',
              transition: 'all 0.3s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: agreed && !loading
                ? `0 0 20px rgba(255,215,0,0.15), 0 4px 30px rgba(0,0,0,0.4)`
                : 'none',
              ...fadeStyle(0.6),
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  border: `2.5px solid rgba(10,10,15,0.3)`,
                  borderTopColor: '#0A0A0F',
                  animation: 'loginSpin 0.7s linear infinite',
                }} />
                <span>ログイン中...</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill={agreed ? '#0A0A0F' : 'rgba(255,255,255,0.2)'}
                    d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                </svg>
                Googleでログイン
              </>
            )}
          </button>

          {error && (
            <div style={{
              marginTop: 16, padding: '10px 16px', borderRadius: 10,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              fontSize: 12, color: '#F87171', textAlign: 'center',
            }}>{error}</div>
          )}
        </div>

        {/* ── フッター ── */}
        <div style={{
          textAlign: 'center', marginTop: 32,
          ...fadeStyle(0.7),
        }}>
          <p style={{
            fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.15)',
            fontFamily: "'SF Mono', Consolas, monospace",
          }}>
            Powered by GRIFFON × Firebase
          </p>
        </div>

      </div>
    </div>
  );
}
