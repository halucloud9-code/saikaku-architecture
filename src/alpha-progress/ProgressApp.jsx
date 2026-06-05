import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, signOutUser } from '../firebase';
import { useEmailAuth } from '../hooks/useEmailAuth';
import { EVENT_TITLE } from './data';
import ProgressInput from './pages/ProgressInput';
import ProgressAdmin from './pages/ProgressAdmin';

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',').map(e => e.trim()).filter(Boolean);

const pathname = window.location.pathname;
const isAdminPath = pathname === '/alpha-progress/admin';

const T = {
  bg: '#F5F0E8',
  card: '#FFFFFF',
  border: '#E0D8CE',
  text: '#2A2520',
  muted: '#8A7A6A',
  accent: '#C4922A',
  fontFamily: "'Noto Serif JP', 'Hiragino Sans', sans-serif",
};

function Spinner() {
  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: `3px solid ${T.border}`, borderTopColor: T.accent,
        animation: 'spin 1s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ProgressLogin({ onLogin }) {
  const {
    state: {
      agreed,
      loading,
      error,
      authMode,
      emailMode,
      email,
      password,
      passwordConfirm,
      displayName,
      verificationSent,
      fromEmail,
      resendLoading,
      resendMsg,
      resendCooldown,
    },
    handlers: {
      setAgreed,
      setError,
      setAuthMode,
      setEmailMode,
      setEmail,
      setPassword,
      setPasswordConfirm,
      setDisplayName,
      setVerificationSent,
      handleLogin: handleGoogleLogin,
      handleEmailAuth,
      handleResendVerification,
    },
  } = useEmailAuth({
    onLogin,
    continueUrl: `${window.location.origin}/alpha-progress`,
  });

  const disabled = !agreed || loading;
  const inputStyle = {
    width: '100%',
    padding: '12px 13px',
    borderRadius: 8,
    boxSizing: 'border-box',
    border: `1px solid ${T.border}`,
    background: '#FFFDF9',
    color: T.text,
    fontSize: 14,
    outline: 'none',
    fontFamily: T.fontFamily,
  };
  const mutedButtonStyle = {
    width: '100%',
    padding: '13px 16px',
    borderRadius: 8,
    border: `1px solid ${T.border}`,
    background: '#FFFDF9',
    color: T.text,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: T.fontFamily,
  };
  const primaryButtonStyle = {
    width: '100%',
    padding: '14px 18px',
    background: disabled ? T.border : T.accent,
    color: disabled ? T.muted : '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    transition: 'background 0.2s, opacity 0.2s',
    fontFamily: T.fontFamily,
  };

  const selectAuthMode = mode => {
    setAuthMode(mode);
    setError('');
  };

  const selectEmailMode = mode => {
    setAuthMode('email');
    setEmailMode(mode);
    setError('');
    setPasswordConfirm('');
  };

  const handleEmailSubmit = e => {
    e.preventDefault();
    handleEmailAuth();
  };

  if (verificationSent) {
    return (
      <div style={{
        minHeight: '100vh',
        background: T.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: T.fontFamily,
      }}>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          .alpha-login-input::placeholder { color: ${T.muted}; opacity: 0.72; }
        `}</style>
        <div style={{
          width: '100%',
          maxWidth: 440,
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 8,
          padding: '34px 28px',
          textAlign: 'center',
          boxShadow: '0 10px 34px rgba(42,37,32,0.08)',
        }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            margin: '0 auto 18px',
            border: `1px solid ${T.accent}`,
            color: T.accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="25" height="20" viewBox="0 0 25 20" fill="none" aria-hidden="true">
              <path d="M2.5 2.5h20v15h-20v-15z" stroke="currentColor" strokeWidth="1.8" />
              <path d="M3 3l9.5 8L22 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h1 style={{
            color: T.text,
            fontSize: 22,
            fontWeight: 700,
            lineHeight: 1.45,
            margin: '0 0 10px',
          }}>
            確認メールを送信しました
          </h1>
          <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.9, margin: '0 0 20px' }}>
            <span style={{ color: T.accent, fontWeight: 700 }}>{email}</span><br />
            に確認メールを送りました。リンクをクリックしてから、ログイン画面に戻ってください。
          </p>

          <div style={{
            background: '#FFF8EA',
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: '14px 16px',
            marginBottom: 18,
            textAlign: 'left',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 8 }}>
              メールが見つからない場合
            </div>
            <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 12, color: T.muted, lineHeight: 1.9 }}>
              <li>迷惑メール・スパムフォルダをご確認ください</li>
              <li>送信元：<code style={{ color: T.accent, fontSize: 11 }}>{fromEmail || 'noreply@saikaku-architecture.firebaseapp.com'}</code></li>
              <li>件名：「メールアドレスを確認」</li>
              <li>届くまで数分かかる場合があります</li>
            </ul>
          </div>

          {resendMsg && (
            <div style={{
              marginBottom: 14,
              padding: '10px 14px',
              borderRadius: 8,
              background: resendMsg.startsWith('✅') ? 'rgba(34,197,94,0.08)' : 'rgba(168,68,50,0.08)',
              border: `1px solid ${resendMsg.startsWith('✅') ? 'rgba(34,197,94,0.22)' : 'rgba(168,68,50,0.22)'}`,
              fontSize: 12,
              color: resendMsg.startsWith('✅') ? '#2F855A' : '#a84432',
              lineHeight: 1.6,
            }}>
              {resendMsg}
            </div>
          )}

          <button
            onClick={handleResendVerification}
            disabled={resendLoading || resendCooldown > 0}
            style={{
              ...mutedButtonStyle,
              marginBottom: 10,
              color: (resendLoading || resendCooldown > 0) ? T.muted : T.text,
              cursor: (resendLoading || resendCooldown > 0) ? 'not-allowed' : 'pointer',
              opacity: (resendLoading || resendCooldown > 0) ? 0.65 : 1,
            }}
          >
            {resendLoading ? '送信中...' : resendCooldown > 0 ? `再送信可能まで ${resendCooldown}秒` : '確認メールを再送信'}
          </button>

          <button
            onClick={() => {
              setVerificationSent(false);
              setEmailMode('login');
              setAuthMode('email');
              setPassword('');
              setPasswordConfirm('');
            }}
            style={{ ...primaryButtonStyle, color: '#fff', background: T.accent, cursor: 'pointer' }}
          >
            ログイン画面に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: T.fontFamily,
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .alpha-login-input::placeholder { color: ${T.muted}; opacity: 0.72; }
      `}</style>
      <div style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: '34px 28px',
        width: '100%',
        maxWidth: 440,
        boxSizing: 'border-box',
        boxShadow: '0 10px 34px rgba(42,37,32,0.08)',
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: 24,
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: T.accent,
            marginBottom: 12,
          }}>
            Retreat α 2026 ・ 進捗報告会 6/6
          </div>
          <div style={{ fontSize: 23, fontWeight: 700, color: T.text, lineHeight: 1.4, marginBottom: 6 }}>
            {EVENT_TITLE}
          </div>
          <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.7 }}>
            Google またはメールアドレスでログイン
          </div>
        </div>

        <label style={{
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          cursor: 'pointer',
          marginBottom: 18,
          padding: '13px 14px',
          borderRadius: 8,
          background: agreed ? '#FFF8EA' : '#FFFDF9',
          border: `1px solid ${agreed ? 'rgba(196,146,42,0.42)' : T.border}`,
          transition: 'all 0.2s ease',
        }}>
          <span style={{ position: 'relative', marginTop: 1, flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              style={{ position: 'absolute', opacity: 0, width: 20, height: 20, cursor: 'pointer' }}
            />
            <span style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              border: `2px solid ${agreed ? T.accent : T.border}`,
              background: agreed ? T.accent : '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
            }}>
              {agreed && (
                <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden="true">
                  <path d="M1 4.5L4 7.5L10 1" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
          </span>
          <span style={{ fontSize: 12, color: T.muted, lineHeight: 1.8 }}>
            入力情報および解析結果が<span style={{ color: T.text, fontWeight: 700 }}>主催者に共有される</span>ことに同意します
          </span>
        </label>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          marginBottom: 18,
        }}>
          {[
            { mode: 'google', label: 'Google' },
            { mode: 'email', label: 'メール' },
          ].map(item => (
            <button
              key={item.mode}
              type="button"
              onClick={() => selectAuthMode(item.mode)}
              style={{
                padding: '9px 10px',
                borderRadius: 8,
                border: authMode === item.mode ? `1px solid ${T.accent}` : `1px solid ${T.border}`,
                background: authMode === item.mode ? '#FFF8EA' : '#FFFDF9',
                color: authMode === item.mode ? T.text : T.muted,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: T.fontFamily,
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && (
          <div style={{
            fontSize: 13,
            color: '#a84432',
            marginBottom: 16,
            background: '#a8443210',
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid #a8443220',
            lineHeight: 1.6,
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        <div style={{
          border: `1px solid ${authMode === 'google' ? 'rgba(196,146,42,0.38)' : T.border}`,
          borderRadius: 8,
          padding: 16,
          marginBottom: 14,
          background: authMode === 'google' ? '#FFF8EA' : '#FFFDF9',
        }}>
          <button
            onClick={() => {
              selectAuthMode('google');
              handleGoogleLogin();
            }}
            disabled={disabled}
            style={primaryButtonStyle}
          >
            {loading && authMode === 'google' ? (
              <div style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.35)',
                borderTopColor: '#fff',
                animation: 'spin 1s linear infinite',
              }} />
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Googleでログイン
              </>
            )}
          </button>
        </div>

        <form
          onSubmit={handleEmailSubmit}
          style={{
            border: `1px solid ${authMode === 'email' ? 'rgba(196,146,42,0.38)' : T.border}`,
            borderRadius: 8,
            padding: 16,
            background: authMode === 'email' ? '#FFF8EA' : '#FFFDF9',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[
              { mode: 'login', label: 'ログイン' },
              { mode: 'signup', label: '新規登録' },
            ].map(item => (
              <button
                key={item.mode}
                type="button"
                onClick={() => selectEmailMode(item.mode)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: emailMode === item.mode ? `1px solid ${T.accent}` : `1px solid ${T.border}`,
                  background: emailMode === item.mode ? T.card : '#F8F3EA',
                  color: emailMode === item.mode ? T.text : T.muted,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: T.fontFamily,
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {emailMode === 'signup' && (
              <input
                className="alpha-login-input"
                type="text"
                placeholder="お名前（表示名）"
                value={displayName}
                onFocus={() => selectAuthMode('email')}
                onChange={e => setDisplayName(e.target.value)}
                style={inputStyle}
              />
            )}
            <input
              className="alpha-login-input"
              type="email"
              placeholder="メールアドレス"
              value={email}
              onFocus={() => selectAuthMode('email')}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
            />
            <input
              className="alpha-login-input"
              type="password"
              placeholder="パスワード（6文字以上）"
              value={password}
              onFocus={() => selectAuthMode('email')}
              onChange={e => setPassword(e.target.value)}
              style={inputStyle}
            />
            {emailMode === 'signup' && (
              <>
                <input
                  className="alpha-login-input"
                  type="password"
                  placeholder="パスワード（確認のため再入力）"
                  value={passwordConfirm}
                  onFocus={() => selectAuthMode('email')}
                  onChange={e => setPasswordConfirm(e.target.value)}
                  style={{
                    ...inputStyle,
                    border: passwordConfirm && password !== passwordConfirm
                      ? '1px solid rgba(168,68,50,0.52)'
                      : inputStyle.border,
                  }}
                />
                {passwordConfirm && password !== passwordConfirm && (
                  <div style={{ fontSize: 11, color: '#a84432', marginTop: -4, paddingLeft: 2 }}>
                    パスワードが一致しません
                  </div>
                )}
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={disabled}
            onClick={() => selectAuthMode('email')}
            style={{ ...primaryButtonStyle, marginTop: 14 }}
          >
            {loading && authMode === 'email' ? (
              <>
                <div style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.35)',
                  borderTopColor: '#fff',
                  animation: 'spin 1s linear infinite',
                }} />
                <span>処理中...</span>
              </>
            ) : (
              emailMode === 'signup' ? '新規登録' : 'ログイン'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function Unauthorized() {
  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: T.muted, fontFamily: T.fontFamily,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
        <div style={{ color: T.text }}>この画面へのアクセス権限がありません</div>
        <a href="/alpha-progress" style={{ color: T.accent, marginTop: 16, display: 'block', fontSize: 13 }}>
          入力画面へ戻る
        </a>
      </div>
    </div>
  );
}

export default function ProgressApp() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      setAuthLoading(false);
      if (u) {
        // メール認証ユーザーはメールアドレス確認が必要
        const isEmailProvider = u.providerData.some(p => p.providerId === 'password');
        if (isEmailProvider && !u.emailVerified) {
          // 未確認ユーザーはログイン画面に留める（サインアウトしない）
          setUser(null);
          return;
        }
        setUser(u);
      } else {
        setUser(null);
      }
    });
  }, []);

  const handleLogout = () => {
    signOutUser().then(() => setUser(null));
  };

  if (authLoading) return <Spinner />;
  if (!user) return <ProgressLogin onLogin={setUser} />;

  const isAdmin = ADMIN_EMAILS.includes(user.email);

  if (isAdminPath) {
    if (!isAdmin) return <Unauthorized />;
    return <ProgressAdmin user={user} onLogout={handleLogout} />;
  }

  return <ProgressInput user={user} onLogout={handleLogout} />;
}
