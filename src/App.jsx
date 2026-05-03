import { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { onAuthStateChanged } from 'firebase/auth';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useBlocker,
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from 'react-router-dom';
import { auth, getRedirectResult, db } from './firebase';
import LoginScreen from './screens/LoginScreen';
import InputScreen from './screens/InputScreen';
import ResultScreen from './screens/ResultScreen';
import AdminScreen from './screens/AdminScreen';
import SelectScreen from './screens/SelectScreen';
import HistoryScreen from './screens/HistoryScreen';
import UAAMScreen from './screens/uaam/UAAMScreen';
import UAAMResultScreen from './screens/uaam/UAAMResultScreen';
import LoadingOverlay from './components/LoadingOverlay';
import NavigationGuardDialog from './components/NavigationGuardDialog';
import RequireAdmin from './components/RequireAdmin';
import { calculateScores } from './data/uaam_questions';
import { normalizeScores } from './utils/normalize';

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

// URLパラメータ取得
const params = new URLSearchParams(window.location.search);
const devMode = params.get('dev');
const pageParam = params.get('page'); // ?page=uaam-result で直接結果画面へ
const shouldRedirectToUaamResult = devMode === 'uaam' || pageParam === 'uaam-result';

function createSeedUaamResult() {
  // ── haru固定シードデータ（2026/4/4 診断結果） ──
  const scores = {
    mindset: {
      total: 68, max: 80, percentage: 85,
      subs: { meaning: 19, mindfulness: 15, mindshift: 17, mastery: 17 },
      domainSubs: { meaning: 19, mindfulness: 15, mindshift: 17, mastery: 17 },
      domainTotal: 68,
    },
    literacy: {
      total: 65, max: 80, percentage: 81,
      subs: { learning: 16, logical: 17, life: 17, leadership: 15 },
      domainSubs: { learning: 16, logical: 17, life: 17, leadership: 15 },
      domainTotal: 65,
    },
    competency: {
      total: 63, max: 80, percentage: 79,
      subs: { critical: 18, creativity: 14, communication: 15, collaboration: 16 },
      domainSubs: { critical: 18, creativity: 14, communication: 15, collaboration: 16 },
      domainTotal: 63,
    },
    impact: {
      total: 63, max: 80, percentage: 79,
      subs: { idea: 18, innovation: 16, implementation: 15, influence: 14 },
      domainSubs: { idea: 18, innovation: 16, implementation: 15, influence: 14 },
      domainTotal: 63,
    },
  };
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

/**
 * 保存済みUAAM結果を読み込む
 */
async function loadSavedUaamResult(uid) {
  void uid;
  try {
    if (!auth.currentUser) return null;

    const idToken = await auth.currentUser.getIdToken();
    const res = await fetch('/api/me/uaam-result', {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.scores || !data.analysis) return null;

    return { scores: data.scores, analysis: data.analysis };
  } catch (e) {
    console.warn('[UAAM] Failed to load saved result:', e);
  }
  return null;
}

function CenteredSpinner() {
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

function useAppContext() {
  return useOutletContext();
}

function AppShell() {
  const navigate = useNavigate();
  const initialLegacyRedirectHandledRef = useRef(false);
  const [user, setUser] = useState(devMode === 'uaam' ? { displayName: 'Dev User', photoURL: null, email: 'dev@test.com' } : null);
  const [authLoading, setAuthLoading] = useState(devMode ? false : true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [uaamResult, setUaamResult] = useState(() => (shouldRedirectToUaamResult ? createSeedUaamResult() : null));
  const [uaamError, setUaamError] = useState('');
  const [isLLMInflight, setIsLLMInflight] = useState(false);
  const [loadingKind, setLoadingKind] = useState(null);
  const inFlightControllerRef = useRef(null);
  const blocker = useBlocker((args) => {
    void args;
    return isLLMInflight;
  });

  useEffect(() => {
    if (!isLLMInflight) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isLLMInflight]);

  useEffect(() => {
    if (!shouldRedirectToUaamResult || initialLegacyRedirectHandledRef.current) return;
    initialLegacyRedirectHandledRef.current = true;
    navigate('/uaam/result', { replace: true });
  }, [navigate]);

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
        // ログイン完了 → 保存済みUAAM結果を読み込み
        const saved = await loadSavedUaamResult(u.uid);
        if (saved) {
          setUaamResult(saved);
        }
      } else {
        setUser(null);
      }
    });
    return unsubscribe;
  }, []);

  const handleLogin = async (u) => {
    setUser(u);
    // 即座にログイン状態へ反映してから、保存済みUAAM結果をバックグラウンド読み込み
    const saved = await loadSavedUaamResult(u.uid);
    if (saved) {
      setUaamResult(saved);
    }
  };

  const handleSubmit = async (formData) => {
    setError('');
    setResult(null);
    setLoadingKind('saikaku');
    let shouldNavigateToResult = false;
    let nextResult = null;
    try {
      if (!auth.currentUser) {
        throw new Error('ログインセッションが切れました。再度ログインしてください。');
      }
      const idToken = await auth.currentUser.getIdToken(true);

      inFlightControllerRef.current = new AbortController();
      const controller = inFlightControllerRef.current;
      const timeoutId = setTimeout(() => controller.abort(), 90_000);
      try {
        setIsLLMInflight(true);
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, ...formData }),
          signal: controller.signal,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '解析に失敗しました');
        nextResult = data;
        shouldNavigateToResult = true;
      } finally {
        clearTimeout(timeoutId);
        if (inFlightControllerRef.current === controller) {
          inFlightControllerRef.current = null;
        }
        flushSync(() => {
          if (nextResult !== null) {
            setResult(nextResult);
          }
          setIsLLMInflight(false);
        });
      }
      if (shouldNavigateToResult) {
        navigate('/result');
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        setError('解析がタイムアウトしました。時間をおいて再度お試しください。');
      } else if (!navigator.onLine) {
        setError('通信エラーが発生しました。インターネット接続を確認してください。');
      } else {
        setError(e.message || '解析に失敗しました。もう一度お試しください。');
      }
    } finally {
      setLoadingKind(null);
    }
  };

  const handleUaamSubmit = async (answers, vAnswers = {}) => {
    setUaamError('');
    setUaamResult(null);
    setLoadingKind('uaam');
    let shouldNavigateToResult = false;
    let nextUaamResult = null;
    try {
      if (!auth.currentUser) {
        throw new Error('ログインセッションが切れました。再度ログインしてください。');
      }
      const idToken = await auth.currentUser.getIdToken(true);
      inFlightControllerRef.current = new AbortController();
      const controller = inFlightControllerRef.current;
      const timeoutId = setTimeout(() => controller.abort(), 90_000);
      try {
        setIsLLMInflight(true);
        const res = await fetch('/api/uaam', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, answers, vAnswers }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '診断に失敗しました');
        // vAnswers と answers を結果に含める（結果画面でV問表示に使う）
        nextUaamResult = { ...data, vAnswers, answers };
        shouldNavigateToResult = true;
      } finally {
        clearTimeout(timeoutId);
        if (inFlightControllerRef.current === controller) {
          inFlightControllerRef.current = null;
        }
        flushSync(() => {
          if (nextUaamResult !== null) {
            setUaamResult(nextUaamResult);
          }
          setIsLLMInflight(false);
        });
      }
      if (shouldNavigateToResult) {
        navigate('/uaam/result');
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        setUaamError('診断がタイムアウトしました。時間をおいて再度お試しください。');
      } else if (!navigator.onLine) {
        setUaamError('通信エラーが発生しました。インターネット接続を確認してください。');
      } else {
        setUaamError(e.message || '診断に失敗しました。もう一度お試しください。');
      }
    } finally {
      setLoadingKind(null);
    }
  };

  // 開発テスト用：ダミーデータで結果画面に直接遷移
  const handleUaamTestResult = () => {
    const dummyAnswers = {};
    for (let i = 1; i <= 48; i++) {
      dummyAnswers[i] = Math.floor(Math.random() * 5) + 1;
    }
    const dummyVAnswers = {
      V1: Math.floor(Math.random() * 5) + 1,
      V2: Math.floor(Math.random() * 5) + 1,
      V3: Math.floor(Math.random() * 5) + 1,
    };
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
    setUaamResult({ scores, analysis, vAnswers: dummyVAnswers, answers: dummyAnswers });
    navigate('/uaam/result');
  };

  const handleLogout = () => {
    setUser(null);
    setResult(null);
    setUaamResult(null);
    navigate('/', { replace: true });
  };

  const handleSelectHistory = (kind) => {
    navigate(kind === 'uaam' ? '/history/uaam' : '/history/saikaku');
  };

  // 管理者スコア復元：APIレスポンスのスコアでReact stateを直接更新（リロード不要）
  // normalizeScores が domainSubs/domainTotal を補完する（src/utils/normalize.js に定義）
  const handleScoresRestored = (newScores) => {
    const normalized = normalizeScores(newScores);
    setUaamResult((prev) => ({ ...prev, scores: normalized }));
  };

  const handleLoadingCancel = () => {
    const target = loadingKind === 'uaam' ? '/uaam' : '/input';
    // Note: this aborts the browser fetch only. Server-side reserveAttempt may have already
    // consumed an attempt slot. Tracking server-side cleanup is out of scope for #50.
    inFlightControllerRef.current?.abort();
    flushSync(() => {
      setIsLLMInflight(false);
    });
    navigate(target, { replace: true });
  };

  const handleNavigationConfirm = () => {
    inFlightControllerRef.current?.abort();
    blocker.proceed();
  };

  const handleNavigationCancel = () => {
    blocker.reset();
  };

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);
  const context = {
    user,
    authLoading,
    isAdmin,
    isLLMInflight,
    inFlightControllerRef,
    result,
    setResult,
    uaamResult,
    setUaamResult,
    error,
    uaamError,
    handleLogin,
    handleSubmit,
    handleUaamSubmit,
    handleUaamTestResult,
    handleLogout,
    handleSelectHistory,
    handleScoresRestored,
  };

  if (authLoading) {
    return <CenteredSpinner />;
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <>
      <Outlet context={context} />
      {isLLMInflight && (
        <LoadingOverlay
          kind={loadingKind}
          onCancel={handleLoadingCancel}
        />
      )}
      <NavigationGuardDialog
        open={blocker.state === 'blocked'}
        onConfirm={handleNavigationConfirm}
        onCancel={handleNavigationCancel}
      />
    </>
  );
}

function SelectRoute() {
  const { user, isAdmin, handleSelectHistory, handleLogout } = useAppContext();
  const navigate = useNavigate();

  return (
    <SelectScreen
      user={user}
      isAdmin={isAdmin}
      onSelectSaikaku={() => navigate('/input')}
      onSelectUaam={() => navigate('/uaam')}
      onSelectHistory={handleSelectHistory}
      onAdmin={() => navigate('/admin')}
      onLogout={handleLogout}
    />
  );
}

function InputRoute() {
  const { user, error, isAdmin, handleSubmit, handleLogout } = useAppContext();
  const navigate = useNavigate();

  return (
    <InputScreen
      user={user}
      error={error}
      isAdmin={isAdmin}
      onSubmit={handleSubmit}
      onAdmin={() => navigate('/admin')}
      onLogout={handleLogout}
      onBack={() => navigate('/')}
    />
  );
}

function ResultRoute() {
  const { user, result, setResult, isAdmin, handleLogout } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const attemptData = location.state?.attemptData ?? null;

  if (result == null && !attemptData) {
    return <Navigate to="/input" replace />;
  }

  return (
    <ResultScreen
      key={attemptData ? attemptData.id : result?.updatedAt || result?.kakuchiiki || 'result'}
      user={user}
      result={attemptData ? null : result}
      attemptData={attemptData}
      isAdmin={isAdmin}
      onReset={() => {
        if (attemptData) {
          navigate('/history/saikaku');
          return;
        }
        setResult(null);
        navigate('/');
      }}
      onAdmin={() => navigate('/admin')}
      onLogout={handleLogout}
    />
  );
}

function UaamRoute() {
  const { user, isAdmin, uaamError, handleUaamSubmit, handleUaamTestResult, handleLogout } = useAppContext();
  const navigate = useNavigate();

  return (
    <UAAMScreen
      user={user}
      isAdmin={isAdmin}
      error={uaamError}
      onSubmit={handleUaamSubmit}
      onTestResult={handleUaamTestResult}
      onBack={() => navigate('/')}
      onAdmin={() => navigate('/admin')}
      onLogout={handleLogout}
    />
  );
}

function UaamResultRoute() {
  const { user, uaamResult, setUaamResult, isAdmin, handleLogout, handleScoresRestored } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const attemptData = location.state?.attemptData ?? null;

  if (!uaamResult && !attemptData) {
    return <Navigate to="/uaam" replace />;
  }

  return (
    <UAAMResultScreen
      user={user}
      result={attemptData ? null : uaamResult}
      attemptData={attemptData}
      isAdmin={isAdmin}
      onReset={() => {
        if (attemptData) {
          navigate('/history/uaam');
          return;
        }
        setUaamResult(null);
        navigate('/uaam');
      }}
      onAdmin={() => navigate('/admin')}
      onLogout={handleLogout}
      onScoresRestored={handleScoresRestored}
    />
  );
}

function HistoryRoute({ kind }) {
  const { user, handleLogout } = useAppContext();
  const navigate = useNavigate();

  return (
    <HistoryScreen
      user={user}
      kind={kind}
      onBack={() => navigate('/')}
      onSelectAttemptId={(id, selectedKind) => {
        navigate(`/history/${selectedKind}/${encodeURIComponent(id)}`);
      }}
      onLogout={handleLogout}
    />
  );
}

function HistoryDetailRoute({ kind }) {
  const { user, isAdmin, handleLogout, handleScoresRestored } = useAppContext();
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadAttempt() {
      setLoading(true);
      try {
        if (!attemptId) {
          throw new Error('履歴の読み込みに失敗しました');
        }
        if (!auth.currentUser) {
          throw new Error('ログインセッションが切れました。再度ログインしてください。');
        }

        const idToken = await auth.currentUser.getIdToken();
        const res = await fetch(`/api/me/history/${encodeURIComponent(attemptId)}?kind=${encodeURIComponent(kind)}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) {
          throw new Error('履歴の読み込みに失敗しました');
        }

        const nextAttempt = await res.json();
        if (!cancelled) {
          setAttempt(nextAttempt);
        }
      } catch (e) {
        if (!cancelled) {
          navigate(`/history/${kind}`, { replace: true });
          alert(e.message || '履歴の読み込みに失敗しました');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAttempt();
    return () => {
      cancelled = true;
    };
  }, [attemptId, kind, navigate]);

  if (loading || !attempt) {
    return <CenteredSpinner />;
  }

  if (kind === 'uaam') {
    return (
      <UAAMResultScreen
        user={user}
        result={null}
        attemptData={attempt}
        isAdmin={isAdmin}
        onReset={() => navigate('/history/uaam')}
        onAdmin={() => navigate('/admin')}
        onLogout={handleLogout}
        onScoresRestored={handleScoresRestored}
      />
    );
  }

  return (
    <ResultScreen
      key={attempt?.id || attemptId}
      user={user}
      result={null}
      attemptData={attempt}
      isAdmin={isAdmin}
      onReset={() => navigate('/history/saikaku')}
      onAdmin={() => navigate('/admin')}
      onLogout={handleLogout}
    />
  );
}

function AdminRoute() {
  const { user, handleLogout } = useAppContext();
  const navigate = useNavigate();

  return (
    <AdminScreen
      user={user}
      onBack={() => navigate('/')}
      onLogout={handleLogout}
    />
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <SelectRoute /> },
      { path: 'input', element: <InputRoute /> },
      { path: 'result', element: <ResultRoute /> },
      { path: 'uaam', element: <UaamRoute /> },
      { path: 'uaam/result', element: <UaamResultRoute /> },
      { path: 'history/saikaku', element: <HistoryRoute kind="saikaku" /> },
      { path: 'history/saikaku/:attemptId', element: <HistoryDetailRoute kind="saikaku" /> },
      { path: 'history/uaam', element: <HistoryRoute kind="uaam" /> },
      { path: 'history/uaam/:attemptId', element: <HistoryDetailRoute kind="uaam" /> },
      {
        path: 'admin',
        element: <RequireAdmin />,
        children: [
          { index: true, element: <AdminRoute /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
