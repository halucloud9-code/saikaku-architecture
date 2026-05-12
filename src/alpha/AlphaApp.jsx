import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle, signOutUser } from '../firebase';
import AlphaInput from './pages/AlphaInput';
import AlphaAdmin from './pages/AlphaAdmin';
import AlphaMap from './pages/AlphaMap';

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',').map(e => e.trim()).filter(Boolean);

const pathname = window.location.pathname;
const isAdminPath = pathname === '/alpha/admin';
const isMapPath = pathname === '/alpha/map';

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

function AlphaLogin({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithGoogle();
      onLogin(result.user);
    } catch (e) {
      setError('ログインに失敗しました');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: T.fontFamily,
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        background: T.card, border: `1px solid ${T.border}`,
        borderRadius: 16, padding: 40, width: '100%', maxWidth: 360,
        textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: T.accent,
          letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 16,
        }}>
          Retreat α 2026
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.text, marginBottom: 8 }}>
          α共鳴シート
        </div>
        <div style={{ fontSize: 13, color: T.muted, marginBottom: 32 }}>
          Googleアカウントでログイン
        </div>

        {error && (
          <div style={{
            fontSize: 13, color: '#a84432', marginBottom: 16,
            background: '#a8443210', padding: '10px 14px', borderRadius: 8,
            border: '1px solid #a8443220',
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleGoogle}
          disabled={loading}
          style={{
            width: '100%', padding: '14px 20px',
            background: loading ? T.border : T.accent,
            color: '#fff', border: 'none', borderRadius: 10,
            fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'background 0.2s',
          }}
        >
          {loading ? (
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              border: `2px solid rgba(255,255,255,0.3)`, borderTopColor: '#fff',
              animation: 'spin 1s linear infinite',
            }} />
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
        <a href="/alpha" style={{ color: T.accent, marginTop: 16, display: 'block', fontSize: 13 }}>
          入力画面へ戻る
        </a>
      </div>
    </div>
  );
}

export default function AlphaApp() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  const handleLogout = () => {
    signOutUser().then(() => setUser(null));
  };

  if (isMapPath) return <AlphaMap />;

  if (authLoading) return <Spinner />;
  if (!user) return <AlphaLogin onLogin={setUser} />;

  const isAdmin = ADMIN_EMAILS.includes(user.email);

  if (isAdminPath) {
    if (!isAdmin) return <Unauthorized />;
    return <AlphaAdmin user={user} onLogout={handleLogout} />;
  }

  return <AlphaInput user={user} onLogout={handleLogout} />;
}
