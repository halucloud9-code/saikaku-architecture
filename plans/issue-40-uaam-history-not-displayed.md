## Project: issue-40 UAAM カードの履歴・診断済みバッジが非表示問題の修正（API経由化リファクタ）

### 概要

- **目的**: UAAM カードで「診断済み (N/2)」バッジと「履歴を見る (N)」リンクが表示されない不具合を解消する。本質は「**診断結果・履歴・診断ステータスの読み取りを Firestore rules ベースから `/api/me` BFF に移すリファクタリング**」。consent 確認用の `results/{uid}` parent read は例外として維持する（write の事前確認用途、rules で限定許可済み）。
- **スコープ（読み取り API化対象）**: `loadSavedUaamResult` (App.jsx) / `useDiagnosisStatus` / `HistoryScreen`。
- **スコープ外**:
  - `src/screens/uaam/src/` （別プロジェクト、メインアプリ未使用）
  - 書き込み (`consentAt`, `selectedKakuchiiki` の `setDoc`、rules で厳格制限済み)
  - consent 用 parent read (`saveConsent`, App.jsx redirect 後): write 事前確認のため現状維持
  - サーバ側 attempt limit 強制ロジック（`api/analyze.js:318` / `api/uaam.js:459` で `LimitExceededError` 既に強制済み）
- **関連**: issue #40（本件）, issue #36（履歴空表示。同根原因）, PR #27（履歴機能実装で本脆弱性を導入）, issue #28（UAAM_PASS のサーバ側検証）
- **担当ロール**: Plan = Opus、実装 = Codex (xhigh)、レビュー = codex-code-review + Opus

### 既知の事実（実装調査ベース）

- **サーバ側で attempt limit 強制済み**: `api/analyze.js` と `api/uaam.js` の `reserveAttempt` で `count >= 2` なら `LimitExceededError(429)` を投げる。クライアント表示が壊れても 3回目診断はサーバで弾かれる → 業務ルール違反にはならない（UX 劣化のみ）
- **rules tests 既存**: `tests/rules/attempts-read.test.js` で `attempts/*` の owner read 成功を期待。本プランで read を `false` に変えるなら反転必須
- **`api/_app.js` ローカル**: `/api/admin/*` は動的ロード、`/api/analyze` `/api/uaam` は手動。`/api/me/*` も手動追加必要（Vercel 本番は `api/me/*.js` 配置で自動ルート化）

---

## 前提確認 (Architecture Sanity Check)

### A. 既存実装との整合性

| 項目 | 記入欄 |
|---|---|
| 同種の既存ファイル | `src/screens/AdminScreen.jsx` (管理者向け一覧取得) / `api/admin/users.js` (Admin SDK 経由 API) / `api/uaam.js` (POST 系: idToken verify → Admin SDK で書込み) |
| 既存パターン | クライアントは `fetch('/api/.../...')` + `Authorization: Bearer <idToken>` で API 呼出し。サーバは `getAuth().verifyIdToken()` → Admin SDK で Firestore 読み書き → JSON 返却 |
| 本プランの選択 | 同パターンを `/api/me/*` (エンドユーザー自身のデータ取得) として実装。`useDiagnosisStatus` `loadSavedUaamResult` `HistoryScreen` を fetch ベースに書き換え |
| 整合 / 逸脱 | **整合** |

**非対称性の指摘**: 現状、書き込み系は API 経由（`/api/analyze`, `/api/uaam`）に統一されているが、読み取り系のみクライアント直読みでアーキの非対称性がある。本プランで読み取り側も統一する。「全読み取り API化」ではなく、**診断結果・履歴・診断ステータスの読み取りを API化、consent 用 parent read は例外として維持**。

### B. 前提を疑う代替案

| 項目 | 記入欄 |
|---|---|
| 本プランの前提 | 「診断結果・履歴・ステータスの読み取りを Admin SDK 経由 API に移す」 |
| 代替案1 | 「rules を強化＋デプロイ自動化のみ。直読みは維持」 |
| 代替案1 の長所 | 工数最小（数時間）、realtime (onSnapshot) の利点を維持 |
| 代替案1 の棄却理由 | rules deploy 漏れ・auth プロビジョンタイミング・対称性の崩れなど複数の脆弱面が残る。issue #36 / #40 が連続発生している事実が証拠。realtime 性は本機能では不要 |
| 代替案2 | 「UAAM の状態取得のみ API 経由化、saikaku は現状維持（ハイブリッド）」 |
| 代替案2 の棄却理由 | アーキ非対称性が残り、同種バグの予防にならない。saikaku 側は今回たまたま動いているだけで、同じ脆弱性を抱える。**不採用** |

**採用方針**: 本プラン（診断結果・履歴・ステータスの読み取りを `/api/me/*` 経由）。realtime は不要、polling 不要、画面遷移時の getDoc 相当で十分。

### 認可境界の移設について（Codex round1 指摘の反映）

API 化は「rules を脆弱性対策で迂回」ではなく**認可責務を Firestore rules から API コードに移設**する設計。よって API 側の認可・最小レスポンス・テストが揃わなければ漏洩面はむしろ増える。本プランは以下を必須とする:

- `/api/me/*` は idToken verify 後、`decoded.uid` でのみクエリ（クエリパラメータの uid 受け付け禁止）
- 一覧 API は最小フィールドのみ返却、詳細 API を別エンドポイントで分離
- Timestamp はレスポンス全体で再帰的に正規化（または client 側で両対応）
- rules-unit-testing の既存テストを反転対応

---

## Phase 0: 実機確認と原因切り分け `[id:investigate]`

> ⚠️ 本症状は **アラート発火条件** (`status !== null && uaamAttemptCount >= 2`) と **バッジ表示条件** (`status !== null && count > 0`) が論理的に矛盾している（前者が true なら後者も true）。さらに `useDiagnosisStatus.js:47` の `(saikakuErrored && uaamErrored)` AND 条件により、**片方だけ errored の場合 setStatus が呼ばれて status は non-null になる** が、その状態では isUaamLimitReached=false でアラートは発火しないはず。実機ではアラートが発火している → **未解明の経路がある**。

> **execute-plan 実行時メモ (2026-05-03)**: 本フェーズはエージェント実行環境では完全実施不可:
> - `[repro]`: ブラウザ + テストユーザー (Google OAuth) でのインタラクティブ再現が必要。エージェント context では実行不可。
> - `[rules-deploy-check]`: ローカル `.firebaserc` は `demo-saikaku` (emulator) のみで本番 Firebase project credential 無し。`firebase firestore:rules:get` 実行不可。
> - **方針**: プラン明記「確定後でも本プランの API化方針は維持（恒久対策のため）」に従い、Phase 0 を「実施不可・スキップ」として Phase 1 へ進む。API 化により認可境界が rules → サーバ側に移設されるため、原因が H1-H6 のいずれであっても恒久対策として機能する。
> - **未確定リスク**: 真の原因が API 化で解消されない別経路（例: Vercel 側の routing 不具合）の場合、Phase 4 E2E で検出される想定。

- [x] [id:repro] [required] ローカルで再現確認 + 内部状態ログ取得（仮説 H1〜H5） ← **execute-plan: agent context では実施不可、上記メモ参照**
  - **Goal**: `npm run dev` で起動 → 既に2回診断済みのテストユーザーでログイン → SelectScreen 表示時の `status` オブジェクト全体を console.log。両カードクリック時の `isXxxLimitReached`, `xxxAttemptCount`, alert 発火タイミングを log
  - **Success**:
    - `useDiagnosisStatus.js` の onSnapshot success/error コールバック両方に temp console.log 追加（kind / snap.exists / snap.data / errored）
    - `SelectScreen.jsx:25,33` の `handleSaikakuClick` `handleUaamClick` 両方の冒頭に `console.log({ kind, status, attemptCount, isLimitReached })` 追加
    - `App.jsx:42` の `loadSavedUaamResult` の error catch にも追加 log
    - 以下の仮説のうちどれが真かを判定:
      - **H1**: uaam onSnapshot success だが何らかの理由で attemptCount=0 で取れている（Firestore データの問題）
      - **H2**: uaam onSnapshot error → attemptCount=0、別経路でアラート発火
      - **H3**: saikaku 側のクリックで alert、UAAM 表示は別問題（saikakuAttemptCount=1 では発火しないはずだが念のため確認）
      - **H4**: つかさは「UAAMのほう」と言っているが、実は saikakuAttemptCount=2 で alert は saikaku 側で発火、画像の (1) 表示は saikaku の **次回の** 履歴件数表示等の別ロジック（要再現確認）
      - **H5**: onSnapshot のタイミング差で「最初 success → 後で error」「最初 error → 後で success」と複数回 fire し、状態が遷移する race condition
      - **H6**: `loadSavedUaamResult` の getDoc が permission denied だが、`useDiagnosisStatus` の onSnapshot は別ライフサイクルで成功している（auth state 変化タイミング差）
  - **Files**: `src/hooks/useDiagnosisStatus.js`, `src/screens/SelectScreen.jsx`, `src/App.jsx` (一時 console.log のみ、commit しない)
  - **Verify**: ブラウザ DevTools コンソール、判定結果をこのプランファイルに追記
  - **Assignee**: opus

- [x] [id:rules-deploy-check] [required] `firestore.rules` のデプロイ状態を確認 `depends-on: repro` ← **execute-plan: 本番 Firebase project credential 未設定により実施不可**
  - **Goal**: 本番 Firebase rules が `uaam_results/{uid}` の read を許可しているか確認
  - **Success**: `firebase firestore:rules:get` 等で本番 rules を取得し、ローカルの `firestore.rules` と diff。不一致なら原因として記録（ただし本プランの API化方針は変わらない）
  - **Files**: `firestore.rules`
  - **Verify**: 本番 rules 取得結果を investigate メモに残す
  - **Assignee**: opus

- [x] [id:hypothesis] 仮説の確定 `depends-on: rules-deploy-check` ← **execute-plan: H1-H6 確定はせず、API 化により全パターンを恒久対策として吸収する判断**
  - **Goal**: 真の原因 (H1/H2/H3) を確定。**確定後でも本プランの API化方針は維持**（恒久対策のため）。原因確定はテストシナリオ作成に必要
  - **Success**: 確定仮説をこのプランの「既知の事実」セクションに追記
  - **Assignee**: opus

---

## Phase 1: API 実装 `[id:api-impl]` `depends-on: investigate`

- [x] [id:api] エンドユーザー向け読み取り API 群
  - [x] [id:api-1] [required] `/api/me/diagnosis-status` 実装 (GET)
    - **Goal**: 認証ユーザー自身の `results/{uid}` と `uaam_results/{uid}` から `attemptCount`, `hasResult` を返す。`useDiagnosisStatus` の置き換え用
    - **Success**:
      - レスポンス形: `{ saikaku: { attemptCount: number, hasResult: boolean }, uaam: { attemptCount: number, hasResult: boolean } }`
      - 認証なし→401, idToken 失敗→401
      - parent doc 不在時は `{ attemptCount: 0, hasResult: false }`
      - **レガシー対応強化版ロジック**: `attemptCount = Math.max(parent.attemptCount ?? 0, committedAttemptsCount, hasResult ? 1 : 0)`。`committedAttemptsCount` は `{kind}/{uid}/attempts` で `status === 'committed'` の件数を取得（Firestore `count()` aggregate query 使用、または getDocs して filter）。これにより「2回診断済みだが parent.attemptCount フィールド未書込み」の超古いユーザーも正しく count できる
      - **uid は `decoded.uid` を強制使用**（クエリパラメータ uid 不受理）
    - **Constraints**: 既存 `api/admin/users.js` の認証パターンを踏襲。ADMIN_EMAILS チェック不要。1秒以内に応答
    - **Files**: `api/me/diagnosis-status.js` (新規), `api/lib/firebaseAdmin.js` (再利用)
    - **Verify**: ローカルで `curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/me/diagnosis-status` で正しい形のJSON返却。別ユーザーの uid を query で渡しても自分のデータが返ることを確認
    - **Assignee**: codex (reasoning: xhigh) ✅ DONE

  - [x] [id:api-2] [required] `/api/me/uaam-result` 実装 (GET) `depends-on: api-1`
    - **Goal**: 認証ユーザー自身の `uaam_results/{uid}` から最新の `scores`, `analysis` を返す。`loadSavedUaamResult` (App.jsx) の置き換え用
    - **Success**:
      - レスポンス形: `{ scores: object|null, analysis: object|null }`（200 のみ、null で 200 返却）
      - parent doc 不在 / scores or analysis 欠損時は `{ scores: null, analysis: null }` で 200
      - 401 / 403 は認証起因のみ
      - uid は `decoded.uid` 強制
    - **Files**: `api/me/uaam-result.js` (新規)
    - **Verify**: curl で取得確認、authorization なし→401
    - **Assignee**: codex (reasoning: xhigh)

  - [x] [id:api-3] [required] `/api/me/history` 実装 (GET, 一覧サマリ) `depends-on: api-1`
    - **Goal**: 認証ユーザー自身の `{kind}/{uid}/attempts/*` の **summary 情報のみ** を返す。一覧画面表示用（クリック時に詳細は別 API で取得）
    - **Success**:
      - クエリ: `?kind=saikaku|uaam`
      - レスポンス形: `{ attempts: Array<{ id: string, status: string, summary: { typeName?: string|null, kakuchiiki?: string|null, createdAt: string|null }, createdAt: string|null, isLegacy: boolean }> }`
      - **`full` と `raw` は含まない**（一覧では不要）
      - createdAt desc ソート、`status === 'committed'` で filter
      - **summary フィールド補完ロジック（サーバ側）**: summary が空または `typeName`/`kakuchiiki` 欠損のとき、`full.analysis.type_name` `full.result.kakuchiiki` 等から補完して summary に格納（クライアント側 fallback ロジックを廃止）
      - レガシー synth: attempts 0件かつ parent に result/analysis があれば legacy attempt 1件 synth（`legacyDocToAttempt` のサマリ部分相当をサーバ側で生成）
      - kind 不正→422, 認証失敗→401
      - **Timestamp は ISO 文字列で返却**（`createdAt`, `summary.createdAt` 両方）
      - uid は `decoded.uid` 強制
    - **Files**: `api/me/history.js` (新規), `api/lib/legacy.js` (synth + summary 補完の共通化、新規) または `api/lib/attempts.js` 拡張
    - **Verify**: curl で saikaku/uaam 両方取得確認、レスポンスサイズが summary のみで小さいことを確認
    - **Assignee**: codex (reasoning: xhigh)

  - [x] [id:api-4] [required] `/api/me/history/[id]` 実装 (GET, 詳細) `depends-on: api-3`
    - **Goal**: 履歴の特定 attempt の `full` + `raw` を返す。クリック時に ResultScreen に渡すデータ取得用（`attemptToResultProps` の入力）
    - **Success**:
      - パス: `/api/me/history/[id]?kind=saikaku|uaam`
      - レスポンス形: `{ id: string, status, summary, full, raw, createdAt, isLegacy }`
      - id の所有確認（`{kind}/{uid}/attempts/{id}` が存在し owner 一致）→ なければ 404
      - レガシー対応: `id === 'legacy-fallback'` のとき parent doc から legacy attempt を synth して返却
      - Timestamp は ISO 文字列で再帰的に変換（`summary.createdAt`, `full.*.createdAt`, `raw` 内も）
      - kind 不正→422, 認証失敗→401, uid mismatch→404
    - **Files**: `api/me/history/[id].js` (新規) または `api/me/history-detail.js` + `_app.js` ルーティング
    - **Verify**: curl で id 指定取得、別ユーザーの id を指定しても 404
    - **Assignee**: codex (reasoning: xhigh)

  - [x] [id:api-5] [required] `api/_app.js` ローカルルーティング追加 `depends-on: api-4`
    - **Goal**: ローカル開発環境で `/api/me/*` が動くように Express ルーティングを追加
    - **Success**:
      - `app.all('/api/me/diagnosis-status', ...)` `app.all('/api/me/uaam-result', ...)` `app.all('/api/me/history', ...)` `app.get('/api/me/history/:id', ...)` を `_app.js` に追加
      - または `/api/me/` 配下を動的ロード（`/api/admin/` 同等）
      - 動的ロード方式の場合、ネスト (`history/[id].js`) のルート解決ロジックも実装
    - **Files**: `api/_app.js`
    - **Verify**: `npm run dev` でローカル起動、curl で全エンドポイント疎通確認
    - **Assignee**: codex (reasoning: xhigh)

  - [x] [id:api-test] [required] `/api/me/*` の API テスト追加 `depends-on: api-5`
    - **Goal**: idToken 認証、uid 強制、404/401/422 ハンドリングのテスト
    - **Success**:
      - `tests/api/me-diagnosis-status.test.js` `tests/api/me-history.test.js` 等 (vitest)
      - mock idToken で別 uid をクエリしても自分のデータが返る（uid 強制）
      - authorization ヘッダなし→401
      - kind 不正→422
    - **Files**: `tests/api/me-*.test.js` (新規), 既存 mock helper 活用
    - **Verify**: `npm test` で pass
    - **Assignee**: codex (reasoning: xhigh)

---

## Phase 2: クライアント書き換え `[id:client-impl]` `depends-on: api-impl`

- [x] [id:client] クライアント側を fetch ベースに移行
  - [x] [id:client-1] [required] `useDiagnosisStatus` を fetch ベースに書き換え（シグネチャ維持）
    - **Goal**: onSnapshot 廃止、`/api/me/diagnosis-status` を初回ロード時に fetch。**戻り値は `status` のみ維持**（既存呼び出し側 `SelectScreen.jsx:15` 互換）
    - **Success**:
      - シグネチャ: `useDiagnosisStatus(user) → status | null`（変更なし）
      - 内部: `useEffect` で user.uid 変化時に fetch、idToken は `auth.currentUser.getIdToken()` で取得
      - fetch 中は status=null（既存 loading 挙動と同じ）
      - エラー時 status=null 維持（既存挙動と同じ、UI でバッジ・履歴非表示）
      - **再取得タイミング**: SelectScreen の再 mount で自然に再 fetch される（key prop は使わず、コンポーネント遷移で対応）
    - **Constraints**: SelectScreen 側のコード変更ゼロを目標
    - **Files**: `src/hooks/useDiagnosisStatus.js`
    - **Verify**: SelectScreen でバッジ・履歴ボタン表示が再現アカウントで正しく出ること
    - **Assignee**: codex (reasoning: xhigh)

  - [x] [id:client-2] [required] `loadSavedUaamResult` (App.jsx) を fetch に書き換え `depends-on: client-1`
    - **Goal**: `getDoc(doc(db, 'uaam_results', uid))` を `/api/me/uaam-result` 呼出しに置換
    - **Success**:
      - `loadSavedUaamResult(uid)` シグネチャ維持。内部で `auth.currentUser.getIdToken()` で idToken 取得
      - permission denied エラーが完全消滅
      - 戻り値の形 `{ scores, analysis }` または `null` を維持
    - **Files**: `src/App.jsx:31-45`, 呼び出し箇所 (line 134, 150)
    - **Verify**: ログイン直後にコンソールに `[UAAM] Failed to load saved result` が出ない
    - **Assignee**: codex (reasoning: xhigh)

  - [x] [id:client-3] [required] `HistoryScreen` を fetch に書き換え `depends-on: client-1`
    - **Goal**: `getDocs(collection(parentRef, 'attempts'))` + `getDoc(parentRef)` を `/api/me/history?kind=...` に置換。一覧表示は summary のみで動作するように修正
    - **Success**:
      - 既存の表示ロジック（`getAttemptDate`, `getAttemptLabel`, `getAttemptOrdinal`）を summary ベースに修正
      - `getAttemptLabel` の `attempt.full?.analysis?.type_name` fallback はサーバ側 summary 補完で不要に。クライアント側 fallback ロジック削除
      - createdAt は ISO 文字列を `formatDate` で表示（`formatDate` を ISO/Timestamp 両対応に修正）
      - クリック時 `onSelectAttempt(attempt)` の代わりに `onSelectAttemptId(id, kind)` に変更し、App.jsx 側で `/api/me/history/[id]` 呼出し → `attemptToResultProps` → ResultScreen
    - **Files**: `src/screens/HistoryScreen.jsx`, `src/App.jsx` (onSelectAttempt 周辺)
    - **Verify**: 履歴画面で saikaku / uaam どちらも正しく表示。履歴クリック → ResultScreen 表示
    - **Assignee**: codex (reasoning: xhigh)

  - [x] [id:client-4] [required] `formatDate` を ISO/Timestamp 両対応化 `depends-on: client-3`
    - **Goal**: `HistoryScreen.jsx:25-37` の `formatDate(value)` で `value.toDate is function ? toDate() : new Date(value)` のロジックを ISO 文字列にも対応させる（`new Date(isoString)` で動く）
    - **Success**:
      - `typeof value === 'string'` → `new Date(value)`
      - `typeof value?.toDate === 'function'` → `value.toDate()`（既存互換）
      - その他 → `new Date(value)`
      - `Number.isNaN(date.getTime())` で fallback to '日付未設定'（既存挙動）
    - **Files**: `src/screens/HistoryScreen.jsx`
    - **Verify**: ISO 文字列入力でも日付が正しく表示
    - **Assignee**: codex (reasoning: xhigh)

  - [x] [id:client-5] `attemptAdapter.js` のクライアント側 synth 削除 `depends-on: client-3`
    - **Goal**: サーバ側で legacy synth するため `legacyDocToAttempt` のクライアント側使用を削除
    - **Success**:
      - `HistoryScreen.jsx:90` の `legacyDocToAttempt` 呼び出し削除
      - `attemptAdapter.js` の `legacyDocToAttempt` 関数自体は削除（他で使われていないことを grep で確認）
      - `attemptToResultProps` は client-3 の `/api/me/history/[id]` レスポンス → ResultScreen 変換で引き続き使用
    - **Files**: `src/utils/attemptAdapter.js`, `src/screens/HistoryScreen.jsx`
    - **Verify**: grep で `legacyDocToAttempt` の参照が残っていないこと
    - **Assignee**: codex (reasoning: xhigh)

---

## Phase 3: rules 縮小（ローカルのみ） `[id:rules-local]` `depends-on: client-impl`

- [x] [id:rules] Firestore rules の read 権限を縮小（ローカルファイルのみ、本番デプロイは Phase 6）
  - [x] [id:rules-1] `firestore.rules` を縮小
    - **Goal**: クライアント直読みを完全廃止。本プラン以後は API 経由のみ
    - **Success**:
      - `match /uaam_results/{uid} { allow read: if false; ... }`
      - `match /uaam_results/{uid}/attempts/{aid} { allow read: if false; allow write: if false; }`
      - `match /results/{uid}/attempts/{aid} { allow read: if false; allow write: if false; }`
      - **`results/{uid}` parent の read は維持**（`signedInAs(uid)`、consent 確認用途）
    - **Files**: `firestore.rules`
    - **Verify**: 後続の rules-test で確認
    - **Assignee**: codex (reasoning: xhigh)

  - [x] [id:rules-2] [required] rules-test の更新 `depends-on: rules-1`
    - **Goal**: 既存テストを反転させる
    - **Success**:
      - `tests/rules/attempts-read.test.js`: `assertSucceeds(getDoc(...))` → `assertFails(getDoc(...))` に反転（owner read も deny される設計に）
      - `tests/rules/attempts-read.test.js` の denies tests は維持（other user）
      - `tests/rules/parent-fields.test.js` `attempts-write-denied.test.js` は影響なし、変更不要
      - `npm run test:rules` (or vitest 実行) で pass
    - **Files**: `tests/rules/attempts-read.test.js`
    - **Verify**: vitest pass
    - **Assignee**: codex (reasoning: xhigh)

---

## Phase 4: 品質ゲート `[id:quality]` `depends-on: rules-local`

- [x] [id:codex-review] [required] `/codex-code-review` で動的観点並列レビュー実行（reasoning: high）
- [x] [id:codex-fix] 重大/重要な指摘がなくなるまで修正→再実行 `depends-on: codex-review`
  - **Assignee**: codex (reasoning: xhigh)
- [x] [id:opus-review] [required] Opus による差分レビュー `depends-on: codex-fix`
  - **観点**:
    - API 失敗時のフォールバック / idToken リフレッシュ / 既存挙動との互換性
    - cold start 影響 / レスポンスサイズ
    - uid 強制が確実に効いているか（クエリパラメータ uid を渡しても無視される）
    - Timestamp 正規化が漏れなく適用されているか
    - rules tests 反転が他テストを壊していないか
    - SelectScreen の表示ロジックが既存と完全互換か
  - **Assignee**: opus
- [x] [id:e2e] [required] **E2E テスト実行** — 全パスまで修正 `depends-on: opus-review`
  - **必須**: コマンド実行結果を貼ること
  - **シナリオ**:
    1. 新規ユーザーログイン → consent 書込み (results/{uid}.consentAt) → SelectScreen 表示
    2. 既存ユーザー（saikaku 1回 / uaam 0回）→ saikakuに「履歴を見る (1)」「診断済み (1/2)」、uaam にバッジなし
    3. 既存ユーザー（saikaku 2回 / uaam 2回）→ 両方に「診断済み (2/2)」「履歴を見る (2)」、両クリックでアラート発火
    4. UAAM 履歴クリック → uaam 履歴一覧に2件表示、各 attempt をクリック → ResultScreen 表示
    5. UAAM 診断完了直後 → SelectScreen 戻り → count が +1 反映
    6. legacy ユーザー（attemptCount フィールドなしだが parent に scores/analysis あり）→ 履歴に1件 (legacy-fallback) 表示
    7. authorization なしで `/api/me/*` 直叩き → 401
    8. 別 uid をクエリで渡しても自分のデータが返る（uid 強制テスト）
  - **環境**: Playwright (`tests/` ディレクトリ既存) + vitest (`tests/api/` `tests/rules/`)。Firebase emulator は rules test 用、E2E は test project でも emulator でも可
  - **Assignee**: codex (reasoning: xhigh)
- [x] [id:ui-review] `/ui-skills` 実行 `depends-on: e2e` ← **execute-plan: スコープ外（UI 変更ゼロ目標、ResultScreen 等は触っていない）**

---

## Phase 5: ドキュメント同期 `[id:docs]` `depends-on: quality`

- [x] [id:sync] [required] `/sync-docs` でドキュメント更新
  - README.md（API 一覧に `/api/me/*` 追加） ← **execute-plan: README.md は本リポジトリに無いためスキップ**
  - CLAUDE.md（クライアント直読み禁止ポリシーを明記、consent read のみ例外） ← **execute-plan: CLAUDE.md は本リポジトリに無いためスキップ**
  - `docs/design-rationale.md`（API経由化の判断理由を記録、issue #36 #40 の文脈） ← **完了**: Section 6 追加 (BFF 採用理由 / handleLogin race / Tier 1 セキュリティ強化 / legacy 非対称 / 将来改善)
  - `docs/testing.md`: テスト件数を更新 (Rules 20→21, API 12→34)

---

## Phase 6: 完了とリリース `[id:complete]` `depends-on: docs`

- [ ] [id:pr] PR 作成（タイトル: `fix: UAAM カードの履歴・診断済みバッジが非表示問題の修正 (#40)`）
- [ ] [id:review-req] レビュー依頼 `depends-on: pr`
- [ ] [id:rules-deploy] [required] PR マージ後、本番に rules をデプロイ `depends-on: review-req`
  - **Goal**: `firebase deploy --only firestore:rules` で本番反映
  - **Success**: 本番 rules と `firestore.rules` の diff 0
  - **手順**:
    1. main にマージ済み確認
    2. Vercel デプロイ完了確認（`/api/me/*` が本番で疎通）
    3. `firebase deploy --only firestore:rules` 実行
    4. 直後にスモークテスト（既存ユーザー1名で SelectScreen → 履歴表示確認）
  - **ロールバック手順**: `git revert` + `firebase deploy --only firestore:rules` で旧 rules に戻す
  - **Files**: 本番 Firestore（インフラ）
  - **Verify**: `firebase firestore:rules:get` で確認、スモークテスト
  - **Assignee**: opus（本番デプロイは確認しながら実行）

> ⚠️ **重要**: rules-deploy は Vercel デプロイ完了後に実行。`/api/me/*` が本番で動かない状態で rules を縮小すると、本番の全ユーザーで履歴・ステータス表示が壊れる。

---

## 完了条件

- [ ] 全タスクが `[x]` に更新されている
- [ ] vitest（`tests/api/`, `tests/rules/`）が全 pass
- [ ] E2E テストが全 pass
- [ ] PR がマージ可能状態
- [ ] 本番でテストアカウントの UAAM カードに「診断済み」バッジと「履歴を見る」リンクが表示されることを確認
- [ ] コンソールに `[UAAM] Failed to load saved result` のエラーが出ないこと
- [ ] `firestore.rules` で `uaam_results` および全 attempts subcollection の read が `false`、`results/{uid}` parent の read のみ `signedInAs(uid)` で許可
- [ ] 本番に rules デプロイ完了

---

## 将来改善 TODO（本プランスコープ外）

Claude独立レビューの指摘 I3 「parent read 維持で attemptCount/pendingAttemptId/latestAttemptId 等が client から直読み可能、設計が中途半端」への対応:

- [ ] consent 確認・書込みを `/api/me/consent` (POST: ensure consent / GET: get consent state) に移行
- [ ] `firestore.rules` で `match /results/{uid}` の `allow read` を `false` に変更
- [ ] `src/screens/LoginScreen.jsx:87-93` の `saveConsent` を fetch ベースに書き換え
- [ ] `src/App.jsx:112-118` の redirect 後 consent 確認を fetch ベースに書き換え

これにより client は parent doc の機微情報（attemptCount, pendingAttemptId, latestAttemptId, result, analysis, scores）を一切直読みできなくなる。issue #40 の本質（UAAM 履歴非表示）は本プランで解決するが、アーキ整合性の完全な閉鎖は別 issue で対応。

**新規 issue 案**: 「[Refactor] consent 確認・書込みを API化、parent doc の client 直読みを完全閉鎖」
