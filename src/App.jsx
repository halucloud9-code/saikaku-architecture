import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, getRedirectResult, db } from './firebase';
import LoginScreen from './screens/LoginScreen';
import InputScreen from './screens/InputScreen';
import LoadingScreen from './screens/LoadingScreen';
import ResultScreen from './screens/ResultScreen';
import AdminScreen from './screens/AdminScreen';
import SelectScreen from './screens/SelectScreen';
import UAAMScreen from './screens/uaam/UAAMScreen';
import UAAMLoadingScreen from './screens/uaam/UAAMLoadingScreen';
import UAAMResultScreen from './screens/uaam/UAAMResultScreen';
import { calculateScores } from './data/uaam_questions';

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

// URLパラメータ取得
const params = new URLSearchParams(window.location.search);
const devMode = params.get('dev');
const pageParam = params.get('page'); // ?page=uaam-result で直接結果画面へ

/**
 * Firestoreから保存済みUAAM結果を読み込む
 */
async function loadSavedUaamResult(uid) {
  try {
    const docRef = doc(db, 'uaam_results', uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.scores && data.analysis) {
        return { scores: data.scores, analysis: data.analysis };
      }
    }
  } catch (e) {
    console.warn('[UAAM] Failed to load saved result:', e);
  }
  return null;
}

export default function App() {
  const initialScreen = devMode === 'uaam' ? 'uaam-result' : 'login';
  const [screen, setScreen] = useState(initialScreen);
  const [user, setUser] = useState(devMode === 'uaam' ? { displayName: 'Dev User', photoURL: null, email: 'dev@test.com' } : null);
  const [authLoading, setAuthLoading] = useState(devMode ? false : true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [uaamResult, setUaamResult] = useState(() => {
    if (devMode === 'uaam') {
      const dummyAnswers = {};
      for (let i = 1; i <= 48; i++) dummyAnswers[i] = Math.floor(Math.random() * 5) + 1;
      const scores = calculateScores(dummyAnswers);
      return {
        scores,
        analysis: {
          type_name: 'テストタイプ', type_description: '開発テスト用ダミーデータ',
          axis_analysis: {
            mindset: '自己認識が高く、物事の本質を見極める力に優れています。意味を見出す能力と気づきの感度が特に発達しており、深い内省を通じて自己成長を続けるタイプです。',
            literacy: '論理的思考力と学習意欲が高いレベルで両立しています。新しい知識を吸収し、体系的に整理して活用する能力に長けています。',
            competency: '創造性とコミュニケーション能力のバランスが取れています。独自のアイデアを生み出し、それを効果的に伝える力があります。',
            impact: '革新的なアイデアを実行に移す力があります。周囲への影響力も強く、変化を推進するリーダーシップを発揮します。',
          },
          quadrant_analysis: { vision_quadrant: 'テスト', execution_quadrant: 'テスト' },
          strengths: ['物事の本質を見抜く洞察力が非常に高い', '論理と創造性を組み合わせた問題解決ができる', '周囲を巻き込むコミュニケーション力がある'],
          growth_areas: ['行動に移すまでのスピードを上げる余地がある', '完璧主義を手放し、まず試す姿勢を強化できる', 'チームでの協働スキルをさらに伸ばせる'],
          narrative: 'あなたは高い自己認識と論理的思考力を兼ね備えた、バランス型の人材です。物事の本質を見極め、それを体系的に整理して他者に伝える能力に優れています。特に、深い内省を通じて得た気づきを、具体的な行動やイノベーションに繋げる力は、組織や社会に大きな価値をもたらします。',
          action_suggestions: ['毎日15分の振り返りジャーナルを始める', '異分野の人との対話の機会を月2回以上作る', '小さなプロジェクトで実験的な挑戦を行う'],
        },
      };
    }
    return null;
  });
  const [uaamError, setUaamError] = useState('');

  useEffect(() => {
    if (devMode) return;
    // リダイレクトログイン後の結果を処理
    getRedirectResult(auth).then(async (result) => {
      if (result && result.user) {
        const { doc: docFn, setDoc: setDocFn, getDoc: getDocFn, serverTimestamp } = await import('firebase/firestore');
        const user = result.user;
        const docRef = docFn(db, 'results', user.uid);
        const snap = await getDocFn(docRef);
        if (!snap.data()?.consentAt) {
          await setDocFn(docRef, { consentAt: serverTimestamp() }, { merge: true });
        }
      }
    }).catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) {
        // ログイン完了 → 保存済みUAAM結果を読み込み
        const saved = await loadSavedUaamResult(u.uid);
        if (saved) {
          setUaamResult(saved);
          // ?page=uaam-result の場合は直接結果画面へ
          if (pageParam === 'uaam-result') {
            setScreen('uaam-result');
            return;
          }
        }
        // ?page=uaam-result でもデータがない場合は質問画面へ
        if (pageParam === 'uaam-result' && !saved) {
          setScreen('uaam');
          return;
        }
        setScreen((prev) => (prev === 'login' ? 'select' : prev));
      }
    });
    return unsubscribe;
  }, []);

  const handleLogin = async (u) => {
    setUser(u);
    // ログイン時にも保存済みUAAM結果を読み込む
    const saved = await loadSavedUaamResult(u.uid);
    if (saved) {
      setUaamResult(saved);
      if (pageParam === 'uaam-result') {
        setScreen('uaam-result');
        return;
      }
    }
    if (pageParam === 'uaam-result' && !saved) {
      setScreen('uaam');
      return;
    }
    setScreen('select');
  };

  const handleSubmit = async (formData) => {
    setError('');
    setResult(null);
    setScreen('loading');
    try {
      if (!auth.currentUser) {
        throw new Error('ログインセッションが切れました。再度ログインしてください。');
      }
      const idToken = await auth.currentUser.getIdToken(true);

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

  // 開発テスト用：ダミーデータで結果画面に直接遷移
  const handleUaamTestResult = () => {
    const dummyAnswers = {};
    for (let i = 1; i <= 48; i++) {
      dummyAnswers[i] = Math.floor(Math.random() * 5) + 1;
    }
    const scores = calculateScores(dummyAnswers);
    const analysis = {
      type_name: 'テストタイプ',
      type_description: '開発テスト用ダミーデータ',
      axis_analysis: { mindset: 'テスト', literacy: 'テスト', competency: 'テスト', impact: 'テスト' },
      quadrant_analysis: { vision_quadrant: 'テスト', execution_quadrant: 'テスト' },
      strengths: ['強み1', '強み2', '強み3'],
      growth_areas: ['成長1', '成長2', '成長3'],
      narrative: 'これはテスト用のダミーデータです。実際のAI分析は行われていません。ランダムに生成されたスコアで結果画面のレイアウトを確認するためのモードです。',
      action_suggestions: ['アクション1', 'アクション2', 'アクション3'],
    };
    setUaamResult({ scores, analysis });
    setScreen('uaam-result');
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
        onBack={() => setScreen('select')}
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
        onTestResult={handleUaamTestResult}
        onBack={() => setScreen('select')}
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
        onReset={() => { setResult(null); setScreen('select'); }}
        onAdmin={() => setScreen('admin')}
        onLogout={handleLogout}
      />
    );
  }

  if (screen === 'input') {
    return (
      <InputScreen
        user={user}
        error={error}
        isAdmin={isAdmin}
        onSubmit={handleSubmit}
        onAdmin={() => setScreen('admin')}
        onLogout={handleLogout}
        onBack={() => setScreen('select')}
      />
    );
  }

  return (
    <SelectScreen
      user={user}
      isAdmin={isAdmin}
      onSelectSaikaku={() => setScreen('input')}
      onSelectUaam={() => setScreen('uaam')}
      onAdmin={() => setScreen('admin')}
      onLogout={handleLogout}
    />
  );
}
