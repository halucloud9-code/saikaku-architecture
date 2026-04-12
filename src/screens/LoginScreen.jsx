import { useState, useEffect } from 'react';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, sendVerificationEmail, sendPasswordReset, signOutUser, db } from '../firebase';
import griffonImg from '../assets/griffon.png';

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
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=Playfair+Display:wght@400;600;700;800;900&family=Noto+Serif+JP:wght@400;600;700;900&display=swap');

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
  const [authMode, setAuthMode] = useState('google'); // 'google' | 'email'
  const [emailMode, setEmailMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [verificationSent, setVerificationSent] = useState(false); // 確認メール送信済み
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  useEffect(() => {
    injectStyles();
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const saveConsent = async (user) => {
    const docRef = doc(db, 'results', user.uid);
    const snap = await getDoc(docRef);
    if (!snap.data()?.consentAt) {
      await setDoc(docRef, { consentAt: serverTimestamp() }, { merge: true });
    }
  };

  const handleLogin = async () => {
    if (!agreed) return;
    setLoading(true);
    setError('');
    try {
      const result = await signInWithGoogle();
      if (result && result.user) {
        await saveConsent(result.user);
        onLogin(result.user);
      }
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        setError('ログインに失敗しました。再度お試しください。');
      }
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!agreed || !email || !password) return;
    setLoading(true);
    setError('');
    try {
      let result;
      if (emailMode === 'signup') {
        if (!displayName) { setError('お名前を入力してください'); setLoading(false); return; }
        result = await signUpWithEmail(email, password, displayName);
        // 確認メール送信（失敗してもアカウント作成は成功として扱う）
        try {
          const res = await fetch('/api/send-verification-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, uid: result.user.uid }),
          });
          const data = await res.json().catch(() => ({}));
          // カスタム API 未設定またはエラー → Firebase デフォルトで送信
          if (!res.ok || data.method === 'firebase_default') {
            try { await sendVerificationEmail(result.user); } catch (_) {}
          }
        } catch (_) {
          // フォールバック: Firebase デフォルト（こちらも失敗を許容）
          try { await sendVerificationEmail(result.user); } catch (_) {}
        }
        await signOutUser();
        setVerificationSent(true);
        setLoading(false);
        return;
      } else {
        result = await signInWithEmail(email, password);
        // メールアドレス未確認チェック
        if (!result.user.emailVerified) {
          await signOutUser();
          setError('メールアドレスの確認が完了していません。登録時に届いた確認メールのリンクをクリックしてください。');
          setLoading(false);
          return;
        }
      }
      await saveConsent(result.user);
      onLogin(result.user);
    } catch (e) {
      const msgs = {
        'auth/email-already-in-use': 'このメールアドレスはすでに登録されています。「ログイン」タブからサインインするか、パスワードをお忘れの場合はリセットしてください。',
        'auth/invalid-email': 'メールアドレスの形式が正しくありません',
        'auth/weak-password': 'パスワードは6文字以上で設定してください',
        'auth/user-not-found': 'メールアドレスが見つかりません',
        'auth/wrong-password': 'パスワードが正しくありません',
        'auth/invalid-credential': 'メールアドレスまたはパスワードが正しくありません',
      };
      setError(msgs[e.code] || 'エラーが発生しました。再度お試しください。');
      setLoading(false);
    }
  };

  // 確認メール再送信
  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendMsg('');
    try {
      // 再送信のためにサインインしてメール送信
      const result = await signInWithEmail(email, password);
      await sendVerificationEmail(result.user);
      await signOutUser();
      setResendMsg('✅ 確認メールを再送しました');
    } catch (e) {
      setResendMsg('❌ 再送信に失敗しました。しばらく経ってから再度お試しください。');
    }
    setResendLoading(false);
  };

  // フェードインアニメーションの遅延
  const fadeStyle = (delay) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(24px)',
    transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
  });

  // ── 確認メール送信済み画面 ──
  if (verificationSent) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(170deg, #0A0A0F 0%, #12101A 30%, #0E0C14 60%, #0A0A0F 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px',
      }}>
        <div style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
          {/* アイコン */}
          <div style={{ fontSize: 64, marginBottom: 20 }}>✉️</div>

          <h2 style={{
            fontFamily: "'Noto Serif JP', serif",
            fontSize: 22, fontWeight: 700, color: '#FFFFFF',
            margin: '0 0 12px',
          }}>確認メールを送信しました</h2>

          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.9, margin: '0 0 6px' }}>
            <span style={{ color: GOLD, fontWeight: 700 }}>{email}</span>
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, margin: '0 0 20px' }}>
            に確認メールを送りました。<br />
            リンクをクリックしてから、ログイン画面に戻ってください。
          </p>

          {/* ⚠️ 迷惑メールの注意 */}
          <div style={{
            background: 'rgba(255,193,7,0.08)',
            border: '1px solid rgba(255,193,7,0.25)',
            borderRadius: 12,
            padding: '14px 18px',
            marginBottom: 20,
            textAlign: 'left',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#FFD700', marginBottom: 8 }}>
              📂 メールが見つからない場合
            </div>
            <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 2 }}>
              <li><strong style={{ color: 'rgba(255,255,255,0.85)' }}>迷惑メール・スパムフォルダ</strong>をご確認ください</li>
              <li>送信元：<code style={{ color: '#FFD700', fontSize: 11 }}>noreply@saikaku-architecture.firebaseapp.com</code></li>
              <li>件名：<strong style={{ color: 'rgba(255,255,255,0.85)' }}>「メールアドレスを確認」</strong></li>
              <li>届くまで<strong style={{ color: 'rgba(255,255,255,0.85)' }}>数分かかる</strong>場合があります</li>
            </ul>
          </div>

          {/* 再送信 */}
          {resendMsg && (
            <div style={{
              marginBottom: 14, padding: '10px 16px', borderRadius: 10,
              background: resendMsg.startsWith('✅') ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${resendMsg.startsWith('✅') ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
              fontSize: 12, color: resendMsg.startsWith('✅') ? '#4ADE80' : '#F87171',
            }}>{resendMsg}</div>
          )}

          <button onClick={handleResendVerification} disabled={resendLoading}
            style={{
              width: '100%', padding: '14px', borderRadius: 12, marginBottom: 12,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
              color: resendLoading ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.8)',
              fontSize: 14, fontWeight: 600, cursor: resendLoading ? 'not-allowed' : 'pointer',
            }}>
            {resendLoading ? '送信中...' : '🔄 確認メールを再送信'}
          </button>

          <button onClick={() => { setVerificationSent(false); setEmailMode('login'); setPassword(''); }}
            style={{
              width: '100%', padding: '14px', borderRadius: 12,
              background: `linear-gradient(135deg, #8B6914, #C4922A, #FFD700, #C4922A)`,
              border: 'none', color: '#0A0A0F',
              fontSize: 14, fontWeight: 800, cursor: 'pointer',
            }}>
            ログイン画面に戻る
          </button>
        </div>
      </div>
    );
  }

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

          {/* グリフォンロゴ */}
          <div style={{
            width: 160, height: 160, margin: '0 auto 24px',
            position: 'relative',
            animation: 'loginFloat 4s ease-in-out infinite',
          }}>
            <img
              src={griffonImg}
              alt="GRIFFON"
              style={{
                width: '100%', height: '100%',
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 24px rgba(255,215,0,0.3))',
              }}
            />
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
            価値観・才能・情熱の交差点から<br />
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

          {/* 認証方法切り替え */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, ...fadeStyle(0.55) }}>
            {['google', 'email'].map(mode => (
              <button key={mode} onClick={() => { setAuthMode(mode); setError(''); }}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s',
                  background: authMode === mode ? 'rgba(196,146,42,0.15)' : 'rgba(255,255,255,0.03)',
                  border: authMode === mode ? '1px solid rgba(196,146,42,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  color: authMode === mode ? '#C4922A' : 'rgba(255,255,255,0.3)',
                }}>
                {mode === 'google' ? 'Googleで入る' : 'メールで入る'}
              </button>
            ))}
          </div>

          {/* メール認証フォーム */}
          {authMode === 'email' && (
            <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10, ...fadeStyle(0.0) }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {['login', 'signup'].map(m => (
                  <button key={m} onClick={() => { setEmailMode(m); setError(''); }}
                    style={{
                      flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.2s',
                      background: emailMode === m ? 'rgba(255,255,255,0.08)' : 'transparent',
                      border: emailMode === m ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.05)',
                      color: emailMode === m ? '#F5F0E8' : 'rgba(255,255,255,0.3)',
                    }}>
                    {m === 'login' ? 'ログイン' : '新規登録'}
                  </button>
                ))}
              </div>
              {emailMode === 'signup' && (
                <input type="text" placeholder="お名前（表示名）" value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 10, boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#F5F0E8', fontSize: 14, outline: 'none',
                  }} />
              )}
              <input type="email" placeholder="メールアドレス" value={email}
                onChange={e => setEmail(e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10, boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                  color: '#F5F0E8', fontSize: 14, outline: 'none',
                }} />
              <input type="password" placeholder="パスワード（6文字以上）" value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10, boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                  color: '#F5F0E8', fontSize: 14, outline: 'none',
                }} />
            </div>
          )}

          {/* ログインボタン */}
          <button
            className="login-btn-gold"
            onClick={authMode === 'google' ? handleLogin : handleEmailAuth}
            disabled={!agreed || loading || (authMode === 'email' && (!email || !password))}
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
                {authMode === 'google' ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 48 48">
                      <path fill={agreed ? '#0A0A0F' : 'rgba(255,255,255,0.2)'}
                        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                    </svg>
                    Googleでログイン
                  </>
                ) : (
                  <>{emailMode === 'signup' ? '新規登録' : 'ログイン'}</>
                )}
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
