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
      background: '#09090B',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* ブランド */}
        <div style={{ marginBottom: 64 }}>
          <p style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.2em',
            color: '#71717A', textTransform: 'uppercase', margin: '0 0 16px',
          }}>Saikaku Architecture</p>
          <h1 style={{
            fontFamily: "'Noto Serif JP', 'Times New Roman', serif",
            fontSize: 44, fontWeight: 900, color: '#FAFAFA',
            margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em',
          }}>才覚領域</h1>
          <p style={{
            fontSize: 15, color: '#A1A1AA', lineHeight: 1.9,
            margin: '20px 0 0', maxWidth: 300,
          }}>
            才能・価値観・情熱の交差点から、<br />
            あなただけの才覚領域を導き出す。
          </p>
        </div>

        {/* 同意 */}
        <label style={{
          display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer',
          marginBottom: 24, padding: '16px 0',
          borderTop: '1px solid #27272A', borderBottom: '1px solid #27272A',
        }}>
          <div style={{ position: 'relative', marginTop: 2, flexShrink: 0 }}>
            <input type="checkbox" checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{ position: 'absolute', opacity: 0, width: 18, height: 18, cursor: 'pointer' }}
            />
            <div style={{
              width: 18, height: 18, borderRadius: 4,
              border: `1.5px solid ${agreed ? '#FAFAFA' : '#3F3F46'}`,
              background: agreed ? '#FAFAFA' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}>
              {agreed && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="#09090B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
          <span style={{ fontSize: 13, color: '#71717A', lineHeight: 1.7 }}>
            入力情報および解析結果が<span style={{ color: '#A1A1AA' }}>主催者に共有される</span>ことに同意します
          </span>
        </label>

        {/* ログインボタン */}
        <button
          onClick={handleLogin}
          disabled={!agreed || loading}
          style={{
            width: '100%', padding: '14px 24px', borderRadius: 6,
            border: 'none',
            background: agreed && !loading ? '#FAFAFA' : '#27272A',
            color: agreed && !loading ? '#09090B' : '#52525B',
            fontSize: 14, fontWeight: 600,
            cursor: agreed && !loading ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          {loading ? (
            <>
              <div style={{
                width: 16, height: 16, borderRadius: '50%',
                border: '2px solid #A1A1AA',
                borderTopColor: '#09090B',
                animation: 'spin 0.8s linear infinite',
              }} />
              ログイン中
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 48 48">
                <path fill={agreed ? '#09090B' : '#52525B'} d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
              </svg>
              Googleでログイン
            </>
          )}
        </button>

        {error && (
          <p style={{ marginTop: 12, fontSize: 13, color: '#EF4444', textAlign: 'center' }}>{error}</p>
        )}
      </div>
    </div>
  );
}
