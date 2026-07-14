# Routing & URL Map

> Issue #50 で導入された `react-router-dom` v6.4+ ベースのルーティング仕様。
> WHY (なぜこの構造にしたか) は `docs/design-rationale.md` の Section 8 を参照。
> このドキュメントは WHAT (どの URL でどう動くか) と開発者向けの実装ノートを扱う。

---

## URL マップ

| Path | コンポーネント | ガード / 前提 | 空 state 時の挙動 |
|---|---|---|---|
| `/` | `SelectScreen` | 認証必須 | — |
| `/input` | `InputScreen` (才覚診断) | 認証必須 | — |
| `/result` | `ResultScreen` (才覚) | 認証必須 + `result` state または `location.state.attemptData` | 空なら `<Navigate to="/input" replace>` |
| `/uaam` | `UAAMScreen` (MATRIX 診断) | 認証必須 + 受験者パスワード (`UAAM_PASS`) は画面内モーダル | — |
| `/uaam/result` | `UAAMResultScreen` | 認証必須 + `uaamResult` state または `location.state.attemptData` | 空なら `<Navigate to="/uaam" replace>` |
| `/history/saikaku` | `HistoryScreen kind="saikaku"` | 認証必須 | — |
| `/history/saikaku/:attemptId` | `ResultScreen` (履歴閲覧モード) | 認証必須 + API 取得成功 | API 失敗 (403/404) → `/history/saikaku` redirect + alert |
| `/history/uaam` | `HistoryScreen kind="uaam"` | 認証必須 | — |
| `/history/uaam/:attemptId` | `UAAMResultScreen` (履歴閲覧モード) | 認証必須 + API 取得成功 | API 失敗 (403/404) → `/history/uaam` redirect + alert |
| `/admin` | `AdminScreen` | `<RequireAdmin>` 経由で `isAdmin` 判定 | 非管理者は `<Navigate to="/" replace>` |
| `/admin/compat` | `CompatScreen` | `<RequireAdmin>` 経由で `isAdmin` 判定。API側も確認済みメール + `ADMIN_EMAILS` を要求 | 取得失敗は画面内エラー。非管理者は `<Navigate to="/" replace>` |
| `/compat/share/:shareId` | `CompatShareScreen` + `CompatReport` | 認証不要。UUID v4のbearer URL、30日で期限切れ、発行者が失効可能。`noindex` / `no-store` / `no-referrer` | 不明・期限切れ・失効済みは同じ「閲覧不可」表示 |
| `*` (それ以外) | — | — | `<Navigate to="/" replace>` |

`loading` は **URL に存在しない**。`isLLMInflight=true` の間、現在 URL の上に `<LoadingOverlay>` (fixed overlay) を被せて表示する。詳細は下記「LLM-inflight ガード」を参照。

---

## 認証ゲーティング (auth gating)

`AppShell` (Outlet レイアウト) が以下の順で render を分岐する:

```
authLoading === true      → <CenteredSpinner />        // Firebase auth 確定まで待つ
!user                     → <LoginScreen onLogin={…}/> // Routes の外で render
otherwise                 → <Outlet context={…} />     // 各 *Route がここで描画される
```

例外として `/compat/share/:shareId` は対象者向けの期限付き共有routeなので、`AppShell` のログイン分岐より先に `<Outlet>` を返す。管理画面の `/admin/compat` と、発行・失効APIの管理者ガードは変わらない。

- `onAuthStateChanged` で `setAuthLoading(false)` を呼ぶまでは Routes を一切 render しない (Outlet を返す前にスピナーで break)。これにより認証確定前の `useNavigate` 競合・redirect ループを防ぐ
- メール認証ユーザーで `emailVerified === false` の場合は `setUser(null)` で LoginScreen に留める (Firebase の sign-out はしない)
- LoginScreen 成功後は `handleLogin(u)` が `setUser(u)` + `loadSavedUaamResult(u.uid)` を実行。即座にログイン状態へ反映してから保存済み UAAM 結果をバックグラウンド読み込み

---

## LLM-inflight ガード

LLM 解析中 (`/api/analyze` または `/api/uaam` の fetch in-flight) は誤って戻る・進む・他リンクをクリック・タブクローズ・リロードされると、(a) ユーザーが結果を失う、(b) サーバー側 reservation slot が無駄になる、の2点が問題になる。これを以下の3レイヤーで防ぐ。

### 1. ルート遷移ガード (`useBlocker`)

```js
const blocker = useBlocker((args) => isLLMInflight);
```

`blocker.state === 'blocked'` のとき `<NavigationGuardDialog>` を表示:

| アクション | ハンドラ | 結果 |
|---|---|---|
| 「中断する」 | `inFlightControllerRef.current?.abort()` + `blocker.proceed()` | fetch を AbortError で中断、目的の URL に遷移 |
| 「続ける」 | `blocker.reset()` | URL は変わらず、解析は継続 |
| ESC キー | `onCancel()` (= `blocker.reset()` 相当) | 同上 |

`<NavigationGuardDialog>` は `role="dialog"` `aria-modal="true"` + focus capture + Tab/Shift+Tab トラップ + ESC ハンドリング + 閉じた後の focus restore を内蔵する (`src/components/NavigationGuardDialog.jsx`)。

### 2. タブクローズ / リロードガード (`beforeunload`)

```js
useEffect(() => {
  if (!isLLMInflight) return undefined;
  const handler = (event) => { event.preventDefault(); event.returnValue = ''; };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, [isLLMInflight]);
```

ブラウザ標準の確認ダイアログ (Chrome/Safari/Firefox 共通) が出る。これは抑制できないので自前モーダル不要。

### 3. 明示キャンセル (`<LoadingOverlay>` 内ボタン)

`<LoadingOverlay>` 右下に「キャンセル」ボタン。押下で `handleLoadingCancel()` が走り:

1. `inFlightControllerRef.current?.abort()` で fetch 中断
2. `flushSync` で `setIsLLMInflight(false)` (Blocker 解除を React 18 batch 外で確定)
3. `navigate('/input' or '/uaam', { replace: true })` で入力画面に戻る (`loadingKind` で kind 判定)

> **注意**: クライアント側 abort は browser fetch のみキャンセルする。サーバー側 `reserveAttempt` が既に attempt slot を消費している可能性がある。サーバー側 cleanup は #50 のスコープ外 (`src/App.jsx:382` のコメント参照)。

---

## 履歴詳細 route の data fetch

`/history/:kind/:attemptId` は `HistoryDetailRoute` 内の `useEffect` で fetch する (data router の `loader` は今回未採用):

```
useEffect → fetch /api/me/history/<id>?kind=<kind> with idToken
  → 200: setAttempt(json) → ResultScreen / UAAMResultScreen に attemptData prop で渡す
  → 非 200 / 例外: navigate(`/history/${kind}`, { replace: true }) + alert
```

`ResultScreen` / `UAAMResultScreen` は `result` または `attemptData` のどちらかが渡れば render する設計 (履歴閲覧モード)。閲覧モードの「戻る」(`onReset`) は `navigate('/history/saikaku')` または `navigate('/history/uaam')` で履歴一覧に戻る (Issue #48/#49 で確立した動線)。

---

## 後方互換 (legacy URL)

直接アクセスされうる旧 URL はクライアント側で透過的に redirect する:

| 旧 URL | 挙動 |
|---|---|
| `/?dev=uaam` | `AppShell` 起動時の `useEffect` で `navigate('/uaam/result', { replace: true })` + 開発用シードデータ (`createSeedUaamResult()`) を `uaamResult` state にセット |
| `/?page=uaam-result` | 同上 (`shouldRedirectToUaamResult` フラグで合流) |

検出は `src/App.jsx:36-39` の `URLSearchParams` で起動時1回のみ実行 (`initialLegacyRedirectHandledRef` で多重発火防止)。

---

## キーソース (cross-reference)

| ファイル | 役割 |
|---|---|
| [`src/main.jsx`](../src/main.jsx) | `<ErrorBoundary>` + `<StrictMode>` の中で `<AppRouter />` (= `RouterProvider`) をマウント |
| [`src/App.jsx`](../src/App.jsx) | `createBrowserRouter` の route 定義 (676-699 行目)。`AppShell` (auth bootstrap + global state + useBlocker + beforeunload + LoadingOverlay + NavigationGuardDialog) と各 `*Route` ラッパー |
| [`src/components/RequireAdmin.jsx`](../src/components/RequireAdmin.jsx) | `/admin` 配下のガード。`authLoading` 中はスピナー、非管理者は `<Navigate to="/" replace>` |
| [`src/compat/CompatScreen.jsx`](../src/compat/CompatScreen.jsx) | `/admin/compat` のペア/チーム選択、同意確認、公開共有URL取込、結果表示 |
| [`src/compat/CompatReport.jsx`](../src/compat/CompatReport.jsx) | 管理画面と共有画面が共用する相性レポート描画 |
| [`src/compat/CompatShareScreen.jsx`](../src/compat/CompatShareScreen.jsx) | `/compat/share/:shareId` の公開取得、共有上の注意、`noindex` meta管理 |
| [`api/admin/compat-share.js`](../api/admin/compat-share.js) | 管理者限定の共有URL発行・失効。共有同意とレポート再検証を要求 |
| [`api/compat-share.js`](../api/compat-share.js) | 認証不要の単一UUID取得。期限切れ・失効・不明を同じ404で返す |
| [`src/components/NavigationGuardDialog.jsx`](../src/components/NavigationGuardDialog.jsx) | LLM-inflight 中のルート遷移確認モーダル (a11y 対応済み) |
| [`src/components/LoadingOverlay.jsx`](../src/components/LoadingOverlay.jsx) | 解析中のフルスクリーンオーバーレイ。`kind` ('saikaku'/'uaam') で `LoadingScreen` か `UaamLoadingScreen` を切り替え + キャンセルボタン |
| [`tests/e2e/history-api-flow.spec.js`](../tests/e2e/history-api-flow.spec.js) | URL 直接アクセス・戻る/進む・モーダル・redirect の 7 シナリオ E2E (Playwright) |

---

## 開発者ノート

- **新 route 追加時**: `createBrowserRouter` の `children` に追記し、必要なら `*Route` ラッパー (内部で `useNavigate` + `useAppContext` を呼ぶ) を作る。子コンポーネントの prop API は不変が原則
- **新ガード追加時**: `RequireAdmin` パターンに倣い、`<Outlet context={…}>` を返すコンポーネントを `path: 'foo', element: <RequireFoo />, children: [...]` の形で配置
- **LLM-inflight 中の新規副作用 (例: 追加の cleanup)**: `handleLoadingCancel` と `handleNavigationConfirm` の両方に追加すること (1箇所に書き忘れると遷移経路で挙動がずれる)
- **直接 URL の新規対応**: state-only な route (`/result`, `/uaam/result`) はその空 state 時の redirect 先 (`<Navigate>`) を必ず明示すること。さもないとリロードで真っ白画面になる
- **react-router を bypass する誘惑への抵抗**: `window.history.pushState` 直叩き、`window.location.href` での遷移は `useBlocker` を通らないため LLM-inflight ガードを破壊する。必ず `useNavigate()` 経由で遷移する
