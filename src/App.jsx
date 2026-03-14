import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, getRedirectResult, db } from './firebase';
import LoginScreen from './screens/LoginScreen';
import InputScreen from './screens/InputScreen';
import LoadingScreen from './screens/LoadingScreen';
import ResultScreen from './screens/ResultScreen';
import AdminScreen from './screens/AdminScreen';
import UAAMScreen from './screens/uaam/UAAMScreen';
import UAAMLoadingScreen from './screens/uaam/UAAMLoadingScreen';
import UAAMResultScreen from './screens/uaam/UAAMResultScreen';

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

export default function App() {
  const [screen, setScreen] = useState('login');
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [uaamResult, setUaamResult] = useState(null);
  const [uaamError, setUaamError] = useState('');

  useEffect(() => {
    // リダイレクトログイン後の結果を処理
    getRedirectResult(auth).then(async (result) => {
      if (result && result.user) {
        const { doc, setDoc, getDoc, serverTimestamp } = await import('firebase/firestore');
        const user = result.user;
        const docRef = doc(db, 'results', user.uid);
        const snap = await getDoc(docRef);
        if (!snap.data()?.consentAt) {
          await setDoc(docRef, { consentAt: serverTimestamp() }, { merge: true });
        }
      }
    }).catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) {
        setScreen((prev) => (prev === 'login' ? 'input' : prev));
      }
    });
    return unsubscribe;
  }, []);

  const handleLogin = (u) => {
    setUser(u);
    setScreen('input');
  };

  const handleSubmit = async (formData) => {
    setError('');
    setResult(null);   // ← 必ず旧データをクリアしてから新規分析
    setScreen('loading');
    try {
      // セッション切れチェック
      if (!auth.currentUser) {
        throw new Error('ログインセッションが切れました。再度ログインしてください。');
      }
      // トークンを強制リフレッシュして確実に有効なものを取得
      const idToken = await auth.currentUser.getIdToken(true);

      // タイムアウト付きfetch（90秒）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90_000);
      let res;
      try {
        res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, ...formData }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '解析に失敗しました');
      setResult(data);
      setScreen('result');
    } catch (e) {
      if (e.name === 'AbortError') {
        setError('解析がタイムアウトしました。時間をおいて再度お試しください。');
      } else if (!navigator.onLine) {
        setError('通信エラーが発生しました。インターネット接続を確認してください。');
      } else {
        setError(e.message || '解析に失敗しました。もう一度お試しください。');
      }
      setScreen('input');
    }
  };

  const handleUaamSubmit = async (answers) => {
    setUaamError('');
    setUaamResult(null);
    setScreen('uaam-loading');
    try {
      if (!auth.currentUser) {
        throw new Error('ログインセッションが切れました。再度ログインしてください。');
      }
      const idToken = await auth.currentUser.getIdToken(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90_000);
      let res;
      try {
        res = await fetch('/api/uaam', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, answers }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '診断に失敗しました');
      setUaamResult(data);
      setScreen('uaam-result');
    } catch (e) {
      if (e.name === 'AbortError') {
        setUaamError('診断がタイムアウトしました。時間をおいて再度お試しください。');
      } else if (!navigator.onLine) {
        setUaamError('通信エラーが発生しました。インターネット接続を確認してください。');
      } else {
        setUaamError(e.message || '診断に失敗しました。もう一度お試しください。');
      }
      setScreen('uaam');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setResult(null);
    setUaamResult(null);
    setScreen('login');
  };

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  if (authLoading) {
    return (
      <div
        style={{
          background: '#F5F0E8',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '3px solid #D4C9B0',
            borderTopColor: '#C4922A',
            animation: 'spin 1s linear infinite',
          }}
        />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (screen === 'admin' && isAdmin) {
    return (
      <AdminScreen
        user={user}
        onBack={() => setScreen('input')}
        onLogout={handleLogout}
      />
    );
  }

  if (screen === 'uaam') {
    return (
      <UAAMScreen
        user={user}
        isAdmin={isAdmin}
        error={uaamError}
        onSubmit={handleUaamSubmit}
        onBack={() => setScreen('input')}
        onAdmin={() => setScreen('admin')}
        onLogout={handleLogout}
      />
    );
  }

  if (screen === 'uaam-loading') {
    return <UAAMLoadingScreen />;
  }

  if (screen === 'uaam-result' && uaamResult) {
    return (
      <UAAMResultScreen
        user={user}
        result={uaamResult}
        isAdmin={isAdmin}
        onReset={() => { setUaamResult(null); setScreen('uaam'); }}
        onAdmin={() => setScreen('admin')}
        onLogout={handleLogout}
      />
    );
  }

  if (screen === 'loading') {
    return <LoadingScreen />;
  }

  if (screen === 'result' && result) {
    return (
      <ResultScreen
        key={result.updatedAt || result.kakuchiiki || 'result'}
        user={user}
        result={result}
        isAdmin={isAdmin}
        onReset={() => { setResult(null); setScreen('input'); }}
        onAdmin={() => setScreen('admin')}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <InputScreen
      user={user}
      error={error}
      isAdmin={isAdmin}
      onSubmit={handleSubmit}
      onAdmin={() => setScreen('admin')}
      onLogout={handleLogout}
      onUaam={() => setScreen('uaam')}
    />
  );
}
