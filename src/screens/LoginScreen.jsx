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
      // signInWithRedirectの場合はresultがnull（リダイレクト後にApp.jsxで処理）
      if (result && result.user) {
        const user = result.user;
        const docRef = doc(db, 'results', user.uid);
        const snap = await getDoc(docRef);
        if (!snap.data()?.consentAt) {
          await setDoc(docRef, { consentAt: serverTimestamp() }, { merge: true });
        }
        onLogin(user);
      }
      // リダイレクト方式の場合はここまで到達しない（ページ遷移が発生）
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        setError('ログインに失敗しました。再度お試しください。');
      }
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F5F0E8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#FDFCFA',
          borderRadius: 16,
          border: '1px solid #D4C9B0',
          padding: '48px 40px',
          boxShadow: '0 4px 24px rgba(42,37,32,0.08)',
        }}
      >
        {/* ヘッダー */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #C4922A, #4A6FA5, #A84432)',
              borderRadius: 12,
              padding: '10px 20px',
              marginBottom: 20,
            }}
          >
            <span
              style={{
                fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif",
                fontSize: 13,
                fontWeight: 600,
                color: '#FDFCFA',
                letterSpacing: '0.15em',
              }}
            >
              Unique Ability
            </span>
          </div>
          <h1
            style={{
              fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif",
              fontSize: 28,
              fontWeight: 700,
              color: '#2A2520',
              margin: '0 0 12px',
              lineHeight: 1.4,
            }}
          >
            才覚領域
            <br />
            Architecture
          </h1>
          <p
            style={{
              fontSize: 13,
              color: '#7A7060',
              lineHeight: 1.8,
              margin: 0,
            }}
          >
            才能 × 価値観 × 情熱
            <br />
            化学反応を起こす
            <br />
            あなただけの才覚領域を見つけだす
          </p>
        </div>

        {/* 区切り線 */}
        <div
          style={{
            height: 1,
            background: '#D4C9B0',
            margin: '0 0 32px',
          }}
        />

        {/* 同意チェックボックス */}
        <label
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            cursor: 'pointer',
            marginBottom: 28,
            padding: '16px',
            background: '#F5F0E8',
            borderRadius: 10,
            border: agreed ? '1px solid #C4922A40' : '1px solid transparent',
            transition: 'border-color 0.2s ease',
          }}
        >
          <div style={{ position: 'relative', marginTop: 2, flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{ position: 'absolute', opacity: 0, width: 18, height: 18, cursor: 'pointer' }}
            />
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                border: `2px solid ${agreed ? '#C4922A' : '#D4C9B0'}`,
                background: agreed ? '#C4922A' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
            >
              {agreed && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
          <span style={{ fontSize: 13, color: '#7A7060', lineHeight: 1.7 }}>
            入力いただいた才能・価値観・情熱および解析結果は、
            <strong style={{ color: '#2A2520' }}>主催者により閲覧される場合</strong>
            があることに同意します。
          </span>
        </label>

        {/* ログインボタン */}
        <button
          onClick={handleLogin}
          disabled={!agreed || loading}
          style={{
            width: '100%',
            padding: '14px 24px',
            borderRadius: 10,
            border: 'none',
            background: agreed && !loading ? '#2A2520' : '#D4C9B0',
            color: '#FDFCFA',
            fontSize: 15,
            fontWeight: 600,
            fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif",
            cursor: agreed && !loading ? 'pointer' : 'not-allowed',
            opacity: agreed && !loading ? 1 : 0.6,
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          {loading ? (
            <>
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: '2px solid #FDFCFA40',
                  borderTopColor: '#FDFCFA',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              ログイン中...
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                <path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z" />
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
              </svg>
              Googleでログイン
            </>
          )}
        </button>

        {error && (
          <p
            style={{
              marginTop: 16,
              fontSize: 13,
              color: '#A84432',
              textAlign: 'center',
            }}
          >
            {error}
          </p>
        )}

        {/* フッター */}
        <p
          style={{
            marginTop: 28,
            fontSize: 11,
            color: '#D4C9B0',
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          Powered by Claude AI × Firebase
        </p>
      </div>
    </div>
  );
}
