# 設計判断の根拠 (Design Rationale)

> このドキュメントは「なぜこうしたか」を記録する。コード/SETUP は「何をしたか」「どう動かすか」だけ書く。
> 元 Issue: #1 (診断済みバッジ), #2 (履歴 + 2回上限), #36 (履歴空表示), #40 (UAAM 履歴非表示), #48 #49 (履歴戻り導線), #47 (SelectScreen レイアウト刷新)
> 確定: 2026-05-02 / 追記: 2026-05-03 (Section 6 追加, Section 7 追加 履歴戻り導線, Section 8 追加 SelectScreen Block Link/透過オーバーレイ)

---

## 1. データモデル: サブコレクション + 親doc サマリ + Read-Time Fallback

### 採用案
```
results/{uid}                       // 親doc
  attemptCount: 0 | 1 | 2
  pendingAttemptId: string | null   // 予約中のattemptId
  latestAttemptId: string | null
  result: {...}                     // 既存後方互換用サマリ
  selectedKakuchiiki, consentAt, createdAt, updatedAt
  attempts/{aid}                    // サブコレクション (Admin SDK のみ書込)
    summary: { kakuchiiki?, typeName?, createdAt }
    full:    { result?, analysis?, scores?, selectedKakuchiiki? }
    raw:     { input: {...} }
    status:  'pending' | 'committed'
    isLegacy?: boolean
  _locks/reservation                // Reservation Transaction 用ロック
    attemptId, acquiredAt
```
uaam_results も同構造。

### なぜこうしたか
- **サブコレクション**: 1 attempt が summary+full+raw で 200KB になる可能性があるため、Firestore の 1 MiB doc 上限を 1 attempt 単位で消費しない構造にした。1 attempt が肥大化したら `attempts/{aid}/raw/0` のように更に分離可能 (将来オプション)
- **summary/full/raw の分離**: 一覧 (HistoryScreen) では summary だけ読めば良く、詳細遷移時のみ full を解決する設計余地を残す。今回の MVP では HistoryScreen も attempt 全体を読んでいるが、件数が増えた時に summary だけ取る最適化が可能
- **親doc に `result` を残す (後方互換)**: `api/integrate.js` 等の既存 admin 系 API が `result` を直接読んでいる。サブコレクションへの完全移行は破壊的変更になるため、commit 時に親docの `result` も同期更新して両対応
- **Read-Time Fallback**: legacy ユーザー (attempts サブコレ未作成 + 親docに result/analysis あり) で履歴画面が空にならないよう、`HistoryScreen` で attempts 空 + 親doc に result/analysis がある場合に親docを擬似 attempt として 1 件目に合成する (`legacyDocToAttempt`)。これにより遅延 migration でも履歴が即時表示される

### なぜ別案を採らなかったか
- **単一 doc に attempts 配列を埋め込む**: doc 上限 1 MiB と部分更新が難しい (配列要素単位の atomic update が Firestore では制約あり)
- **完全フラット (results/{uid}/{attempt-1}) で attempts と diagnostic 結果を分離**: 既存 query パターンとの互換性が崩れ、admin 画面の改修コストが大きい

---

## 2. 並行リクエスト保護: Reservation Transaction + Pending Lock

### 問題
LLM (Anthropic API) は 5-30 秒かかる高コスト呼び出し。ユーザーが連打した場合や、ネットワーク遅延でクライアントがリトライした場合に、同一 UID で複数の LLM 呼び出しが並列発火するとコストが膨らむ。最大 2 回上限の判定もこの並行性下で正確に動かなければならない。

### 採用案
```
[Reserve Transaction]   ← LLM 呼び出し前に枠を予約
        ↓ 成功
[LLM 呼び出し]          ← Anthropic API
        ↓ 成功
[Commit Transaction]    ← attempt doc を pending → committed に書き換え
        ↓ 失敗
[Rollback Transaction]  ← attemptCount を1戻す + pending attempt を削除
```

ガード:
- Reservation Tx 内で `_locks/reservation` を `tx.create` する。同時 2 リクエストで両方 reserve しようとすると、tx.create が write-write conflict を発生させる
- 同時に `pendingAttemptId` を親docにセットすることで二重防御
- TTL 10 分: 期限切れの lock は次の reserve で `tx.set` 上書き (LLM タイムアウト等で lock が残っても自動回復)

### なぜこうしたか
- **Pending Lock (`_locks/reservation`)**: Firestore Admin SDK transaction の OCC は production では正しく動くが、Firestore Emulator は write-write conflict 検出が緩い。テスト環境でも production と同じ挙動を担保するため、`tx.create` で「doc が存在したら必ず失敗」する仕組みを追加。これは pessimistic lock として機能する
- **TTL 10 分**: Vercel serverless function の最大実行時間 (10 秒〜60 秒) より大幅に長く設定。 lock が永続残置するケースはサーバー死亡時のみ。10 分後に自動失効するので運用ブロックは発生しない
- **deterministic legacy migration ID `legacy-v1`**: migration 処理が並列で走っても同じ ID で書くため、二重作成されない。`tx.get` で existence チェック → 存在しなければ書き込む冪等性を保証

### なぜ別案を採らなかったか
- **In-memory lock (Map[uid] = Promise)**: serverless 環境では各リクエストが別インスタンスで走るため、プロセス内ロックは効果なし
- **Counter + transaction without lock**: emulator の OCC が緩く、テストで race を再現できない。production への自信が下がる

---

## 3. Firestore rules: 厳格な allow-list

### 採用案
- `results/{uid}`: `consentAt` (timestamp) と `selectedKakuchiiki` (string < 200 字) の **only** クライアント update 可
- `attempts/*`: 全 write 禁止 (Admin SDK のみ)
- `_locks/*`: read/write 完全禁止 (Admin SDK のみ)
- `delete`: 親doc/サブコレクション全て禁止
- `create`: `consentAt` のみ含む doc を本人 UID で作成のみ許可

### なぜこうしたか
- **fields allow-list with `affectedKeys().hasOnly([...])`**: 既存の `LoginScreen.jsx` (consentAt) と `ResultScreen.jsx:296` (selectedKakuchiiki) のみが直書きするフィールドなので、それ以外は API 経由のみ。攻撃者が devtools から `result` 等を改ざんできない
- **type/size validation**: 攻撃者が巨大文字列で 1 MiB 制限を圧迫する DoS 防御。timestamp 型強制で型混在防止
- **delete: false**: 履歴を恣意的に消されない監査保証

---

## 4. MATRIX (UAAM) パスワード方針: (a) 受験者制限

### 採用案
`UAAM_PASS = 'kokusogaku'` の意図は **「許可した人だけが MATRIX 診断を受けられる」受験者制限** と確定 (つかさ確認 2026-05-02)。

- バッジ・履歴一覧・履歴詳細は **パス入力前から表示**
- 「診断を開始する」ボタンクリック時のみ既存パスワードモーダル

### なぜこうしたか
- 結果プライバシー (家族・同居人に見られたくない) はこのパスワードの責務ではない。それは別レイヤー (端末ロック等) で対処
- バッジ/履歴は「自分が過去にやったか」の事実情報で、再受験 (新規 LLM 呼び出し) ほど機密ではない
- 受験のみゲートする方が UX が良い (既受験者が再ログインで履歴を見るたびにパス入力するのは面倒)

### 既知の限界 (別 issue 化)
- `UAAM_PASS` がフロント bundle に含まれるため、curl で `/api/uaam` を叩けば受験者制限はバイパス可能
- 真の受験者制限が必要なら `ADMIN_EMAILS` allowlist or Firebase custom claims でサーバー側検証する別 issue

---

## 5. テスト戦略

### 4 層構成
- `tests/unit`: SelectScreen バッジ表示 + attemptAdapter のロジック
- `tests/rules`: Firestore rules を `@firebase/rules-unit-testing` で 20 シナリオ検証
- `tests/api`: `supertest(app)` で Reservation/Commit/Rollback/migration/concurrency を 12 シナリオ検証
- `tests/e2e`: Playwright で 3 フロー (badge / history / limit)

### LLM Mock を API server 側に
- ブラウザ MSW では Node 側の Anthropic SDK 呼び出しを捕捉できない
- `api/lib/anthropicClient.js` に MOCK_ANTHROPIC=1 wrapper を実装
- fixture JSON (`tests/fixtures/anthropic/{saikaku,uaam}-1.json`) を返す
- 副次機能: MOCK_ANTHROPIC_FAIL=1 で LLM 失敗を模擬 (rollback テスト用)、MOCK_ANTHROPIC_DELAY_MS で遅延注入 (concurrency テストで reserve→commit 窓を確保)

### TEST_BYPASS_AUTH ガード
本番混入を防ぐため三重ガード: `TEST_BYPASS_AUTH=1` AND `NODE_ENV=test` AND `FIRESTORE_EMULATOR_HOST` セット時のみ有効。
さらに `/api/me/*` は `VERCEL` env または `NODE_ENV=production` が立っている場合は bypass を強制 false にする多重防御 (PR #40 追加)。

---

## 6. 読み取りパスの API 化 (BFF / `/api/me/*`) — issue #36, #40

### 採用案
診断結果・履歴・診断ステータスの読み取りを **すべて `/api/me/*` BFF 経由に統一**。Firestore client SDK での直読みは `results/{uid}` 親ドキュメントの consent 確認用途のみ残す。

```
クライアント → /api/me/diagnosis-status   (バッジ・履歴件数)
         → /api/me/uaam-result        (保存済み UAAM 結果)
         → /api/me/history?kind=...   (履歴一覧、summary のみ)
         → /api/me/history/<id>?kind=...  (履歴詳細、full + raw)
         → /results/{uid} 直読み      (consent 確認のみ、rules: signedInAs(uid))
```

`firestore.rules` は `uaam_results/*` および全 attempts subcollection を `read: if false` に縮小。`results/{uid}` 親のみ `signedInAs(uid)` を維持。

### なぜこうしたか
1. **rules デプロイ漏れ・auth プロビジョンタイミングへの脆さ**: issue #36 (履歴空表示) と issue #40 (UAAM バッジ非表示) は、いずれも client onSnapshot が permission denied で silent fail → 状態が `null` のまま badge/履歴が非表示になる経路で発生。Firestore rules → デプロイ → client SDK の三段リレーが壊れやすい。
2. **書き込み系との対称性**: 書き込みは既に Admin SDK 経由 (`/api/analyze`, `/api/uaam`) で統一されていたが、読み取りだけ rules ベースの client 直読みでアーキテクチャが非対称だった。本 PR で読み取りも API に揃えた。
3. **認可境界をサーバー側に集約**: rules で「迂回」するのではなく、認可責務を Firestore rules → API ハンドラに **移設**。各ハンドラは `decoded.uid` のみで Firestore path を組み立て、`req.query.uid` / `req.body.uid` を信用しない。`api/me/_auth.js` の `withMeHandler` で try/catch + JSON 500 を統一。
4. **UAAM 結果のスナップショット性**: 履歴詳細の `full`/`raw` をサーバー側で凍結することで、後日ロジック変更があっても過去の attempt の表示は変わらない（current behavior と同等）。

### realtime/onSnapshot を捨てた根拠
バッジ・履歴は画面遷移時に getDoc 相当の一回読み取りで十分。realtime 性は本機能では不要。むしろ onSnapshot の error コールバックが silent fail する設計が #36 #40 を生んだ。

### 履歴整合性: parent doc + attempts を共有純粋関数で導出
issue #36 の pending attempt 対応は `shared/attemptLogic.js` に集約し、BFF 側で再利用する。

```
results/{uid} / uaam_results/{uid}
  attemptCount
  pendingAttemptId
  result/scores/analysis
        ↓ summarizeFromParent
  { committedCount, attemptCount, hasPending, pendingAttemptId, hasResult, isStartBlocked }

attempts/{aid}[]
        ↓ listFromAttempts
  { committedAttempts, pendingAttempt }
```

`/api/me/diagnosis-status` は kind ごとに `hasPending` / `pendingAttemptId` を返し、`/api/me/history?kind=...` は `{ attempts, pendingAttempt, summary }` を返す。`HistoryScreen` は `summary.hasPending` と `pendingAttempt.createdAt` を組み合わせ、10分未満・10分以上・orphan (`pendingAttemptId` はあるが attempt doc がない) の3状態 notice を表示する。

この設計により、main の pendingAttempt UX は残しつつ、データアクセスは PR #41 の `/api/me/*` BFF に統一される。旧 `/api/history` は `/api/me/history` に supersede されるため保持しない。

### issue #36 から引き継いだ判断
- **二重カウント防止**: `legacyFloor` は `Math.max(rawCommitted, legacyFloor)` で適用し、modern user (`attemptCount=1, result有`) を2回扱いにしない
- **legacy synth の条件**: `listFromAttempts` は `attemptDocs.length === 0` のときだけ legacy attempt を合成し、attempts と legacy synth を共存させない
- **pending 経過時間の基準**: `parent.updatedAt` は他フィールド更新で汚染されるため使わず、`attempts/<pendingId>.createdAt` を使う
- **orphan の扱い**: `pendingAttemptId` が残っていて attempt doc がない場合は「履歴なし」ではなくデータ不整合 notice を表示する

### consent read の例外維持
`src/App.jsx:118` と `src/screens/LoginScreen.jsx` の `saveConsent` で `results/{uid}` 親を直読みして `consentAt` 有無を確認している。この「書き込み前の事前確認」用途のみ rules で `signedInAs(uid)` を残す。完全な閉鎖は別 issue (`/api/me/consent` 追加) で対応予定。

### handleLogin race condition の修正 (PR 中で発覚)
`handleLogin` が `await loadSavedUaamResult` の **後に** `setScreen('select')` を呼ぶ実装だったため、await 中にユーザーが他画面 (HistoryScreen 等) に遷移すると遅延した `setScreen('select')` で SelectScreen に強制的に戻されていた。E2E `history-flow.spec.js` の失敗で発覚 → `setScreen((prev) => prev === 'login' ? 'select' : prev)` (prev guard) + 即座に画面遷移してから `await` する順序に変更。

### Tier 1 セキュリティ強化 (codex-code-review 指摘)
- `/api/me/_auth.js`: `VERCEL`/`NODE_ENV=production` での bypass 強制無効化、`x-test-uid` 形式バリデーション (`/^[a-zA-Z0-9_-]{1,128}$/`)
- `/api/me/history/[id].js`: `status === 'committed'` 必須化、`id` 形式バリデーション
- 全 `/api/me/*`: `withMeHandler` で top-level try/catch + JSON 500 wrapper

### legacy 判定の意図的な非対称
`hasLegacyAttemptData(saikaku)` は `!!data.result` のみで判定（`data.analysis` を見ない）。理由: `attemptToResultProps(.., 'saikaku')` が `full.result` 必須のため、analysis のみ存在する legacy parent は ResultScreen で render 不能。`api/lib/legacy.js` にコメントで明示。

### 将来改善 (本 PR スコープ外)
- consent 確認・書込みを `/api/me/consent` (POST/GET) に移行 → `results/{uid}` 親 read も完全に `false` 化
- attempts.js の `reserveAttempt` の stale pending 復旧不能バグ
- attempts.js の `rollbackAttempt` 重複 rollback 時の負数化
- クライアント `loading/error/data` 三状態化 (現状は permission error も「データなし」に潰れる)

---

## 7. 履歴戻り導線の統一 — issue #48, #49

### 採用案
履歴一覧から結果画面に遷移した後、UAAM・才覚の両画面で「← 履歴に戻る」UIを2箇所（タイトル下リンク + フッターボタン）に表示し、戻り先を「最新結果」ではなく「履歴一覧 (`history-saikaku` / `history-uaam`)」に統一。`onReset` prop は通常モードと履歴モードを `selectedAttemptKind` で分岐する既存パターンを保持。

### なぜこうしたか
1. **遷移の予測可能性**: 履歴一覧→詳細→「戻る」で履歴一覧に戻る、という標準的なナビゲーションを提供。`最新の結果に戻る` だと現在地と異なる文脈に放り出される。
2. **才覚側既存パターンの再利用**: `ResultScreen.jsx:285-295` の `attemptToResultProps + effectiveResult + isHistoryView` は既に確立済み。UAAM側 (`UAAMResultScreen.jsx`) にも同一構造を導入することで認知負荷を最小化。
3. **prop 名は変えない (YAGNI)**: 「履歴から戻る用の `onBackToHistory` を別 prop として作る」案は棄却。`onReset` の意味を「閲覧モードを抜ける」に再定義し、App.jsx 側で `selectedAttemptKind` 分岐で吸収する方が現状の単一 prop 構造を維持できる。将来複雑化したら分離リファクタすれば良い。

### UAAM 履歴閲覧モードのクラッシュ防止
`UAAMResultScreen` は `const { vAnswers, answers } = result` のように `result` を即時分解していたため、`uaamResult=null` 状態で `attemptData` のみを渡される履歴閲覧経路で即時クラッシュしていた。才覚側と同じ `effectiveResult = attemptProps?.result ?? result` パターンを導入し、`!effectiveResult` 時のフォールバックUIも追加。

### attempt.full への UAAM フィールド追加（書き込み + 読み取り両方）
`bias_message`、`personality_level`、`leadership_stage`、`three_elements`、`name` は従来 `parentMerge` 経由で**親doc のみ** に書かれており、`attempt.full` には入っていなかった。このため履歴詳細表示時にこれらが欠落し、`UAAMResultScreen` が**フォールバック計算**（`assessConfidence`、`determineLeadershipStage` 等）で再構築していた。結果として保存値と表示値がずれる可能性があった。

修正:
- `api/uaam.js` の `commitAttempt` 呼び出しの `full` に上記5フィールドを追加（新attempts用）
- `shared/attemptLogic.js` の `legacyDocToAttempt` UAAM 分岐に上記5フィールド + `coach_*` 3フィールドを追加（legacy fallback 用）
- `src/utils/attemptAdapter.js` の UAAM 分岐で `attempt.full?.<field>` から拾う

`coach_*` フィールド (`coach_confirmed_personality_level` 等) は admin が `AdminScreen` で編集する parent-level の値で attempt 時には存在しない。新attempts時の `commitAttempt` の `full` には入れず、`legacyDocToAttempt` と `attemptAdapter` の読み取り経路でのみ拾う非対称運用。

### `leadership_stage` の正規化（防御的）
UI (`UAAMResultScreen.jsx:1534`) は `leadershipStage?.stage` を期待するが、過去の保存データに文字列形式 (`'第3段階'` 等) が混入する可能性があるため `attemptAdapter.js` の `normalizeLeadershipStage` で `{ stage: number, name: string }` 形式に統一。

### onReset 分岐の対称化 (App.jsx:401-409, 429-437)
- 履歴閲覧時 (`selectedAttemptKind === 'uaam'/'saikaku'`): `clearSelectedAttempt()` + `setScreen('history-uaam'|'history-saikaku')`
- 通常モード (`selectedAttemptKind` null): 従来通り `setUaamResult(null)` + `setScreen('uaam')` / `setResult(null)` + `setScreen('select')`

`uaamResult` / `result` state は履歴閲覧時には消さない（最新結果を戻った後に再表示できるように）。

### スコープ外
- ブラウザ戻るボタン対応 (issue #50)
- UAAM 結果画面の巨大化 (2129 行) を分割するリファクタ（codex-code-review 指摘）

---

## 8. SelectScreen レイアウト刷新 (issue #47): 透過オーバーレイ Block Link + SWR + 固定高さ

### 採用案 (最終形)
- **透過オーバーレイ button パターン** (Gemini 独立レビュー提案):
  - カード `<div data-testid="card-saikaku/uaam">` は完全に**非インタラクティブ** (`role`/`tabIndex`/`onKeyDown`/`onClick` 一切なし、`position: relative` のみ)
  - 子要素として **透過 `<button data-testid="card-saikaku-overlay" / "card-uaam-overlay">`** を配置（`position: absolute; inset: 0; zIndex: 1; transparent`、`aria-label` 付き）。これがカード全体クリックを担当
  - 既存 CTA pill は `<div aria-hidden="true">` + `pointerEvents: 'none'` の視覚装飾に降格（クリックは overlay に貫通）
  - 履歴 `<button>`・badge・パスワードアイコンは `position: relative; zIndex: 2` で overlay より前面（DOM 上は **兄弟要素 (Sibling)**、ARIA 違反なし）
- **下部メタ領域は全状態で固定高さ** (28px、`visibility: hidden + aria-hidden` プレースホルダでレイアウトジャンプ根絶)
- **`useDiagnosisStatus` を stale-while-revalidate 化** (refresh 中も前回値を保持、tab 復帰時のチラつき解消)
- **uid 切替時は同期クリア** (statusUidRef で前回 uid を記録、変化検知時に `setStatus(null)` + `requestSeq++` で in-flight 破棄 + render-time guard)
- **スマホでバッジ被り解消**: サブラベル wrapper に `paddingRight: 112` で badge スロット予約

### 棄却した代替案
**(A) カード `<button>` 直接化 (初期実装)**
- 棄却: button-in-button 問題（履歴ボタン・lock アイコンを内包できない）

**(B) `<div role="button" tabIndex={0} onKeyDown>` (P1#1 で却下)**
- 棄却: ARIA widget role に focusable button 子要素は仕様違反 (Codex review bot P1#1)。SR がフォーカス位置を判別不能になる

**(C) `<div onClick>` のみ (P1#2-3 で却下)**
- 棄却: カード body のキーボード操作不可。CTA button だけが keyboard activatable で「視覚的にクリック可能に見えるのにキーボードで届かない」 false promise (Codex review bot P1#2-3)

**(D) カード全体クリック廃止 (CTA full-width 化)**
- 棄却: モバイル UX 退化（Fitts 法則違反、タップ領域大幅縮小）。Round 1 debate で Codex+Gemini 両者が「明らかな改悪」と批判。Codex review bot 対応で一時実装したが、Gemini 独立レビューで「A11y vs UX は二項対立ではなく、適切な DOM 構造で両立可能」と再棄却

**(E) AdminScreen パターン追従 (非クリックカード + 内部 button のみ)**
- 棄却: 管理画面 data row 用途で、ユーザー向けプライマリ操作カードには不適。「hover リフトはあるが非クリック」は UX 上の虚偽表示

**(F) `flex-wrap` でバッジ被り解消**
- 棄却: 絶対配置のバッジは flex flow 外なので flex-wrap は効かない (Round 1 で Gemini が CSS 仕様無視と指摘)

### 透過オーバーレイパターンの実装ディテール
- カード `<div>` に `position: relative` (子の absolute origin)
- 透過 overlay button の z-index 設計:
  - overlay = z-index 1（背面）
  - 履歴 button / badge / lock indicator = z-index 2（前面、DOM 兄弟）
- overlay button の hover/focus 時に既存 `hoverSaikaku/Uaam` state を駆動 → カード div の視覚 lift・gradient はそのまま機能
- 履歴 button / lock indicator は `pointerEvents: 'none'` を持つ要素（badge 等）を経由して overlay クリック貫通を妨げない
- overlay の `aria-label` で SR ユーザーに「才覚領域の診断を開始する」と明示（カード内テキストの組み合わせよりも明確）

### A11y vs UX のジレンマ解消
Codex review bot から3回連続で受けた P1 指摘:
1. nested-interactive (`role="button"` + 内部 button)
2. キーボード操作不可 (`<div onClick>`)
3. 同上

二項対立に見えたが Gemini 独立レビューで第3の道が判明:
> 「A11y か UX か」ではなく、「両者を成立させる適切な DOM 構造（透過オーバーレイ）」を提示できなかったことに起因する誤ったトレードオフ

兄弟要素として配置することで親子ネストを回避しつつ、overlay は real `<button>` で WCAG 2.1.1/4.1.2 を満たす。

### 固定高さメタ領域の WHY
Round 1 debate で「`status=null` だけプレースホルダ + `count=0` で領域消滅」案は**結局ジャンプを起こす**と判明。loaded&count=0/loaded&count>=1/hasPending=true/status=null の **4状態すべて同じ高さ** を確保することで物理的にジャンプを根絶。空白の見た目は許容 (ジャンプ防止 > 余白の見た目)。

### SWR + uid 切替時の同期クリア
SWR 化 (`setStatus(null)` 削除) で focus 復帰時のチラつきは消えたが、uid 変化時に**他ユーザーの status が一瞬表示される**バグが新たに生じる (codex-code-review B1)。`statusUidRef = useRef(uid)` で前回 uid を記録し、`useEffect([uid])` で変化検知 → `setStatus(null) + requestSeq++` で in-flight invalidation。**さらに**返値で `statusUidRef.current === uid ? status : null` の render-time guard を追加し、effect 反映前の 1 frame でも漏れない二重防御。

### スマホ対応 (375px-430px)
バッジは絶対配置 (`top:18 right:18`) でフローから外れるため、サブラベル側に `paddingRight: 112` で恒久的に badge スロットを予約。`maxWidth: '100%'` でサブラベル文言が長くなっても折り返す。`@media` クエリは使わず fluid layout (プロジェクト慣習)。

### マルチ AI レビューが効いた事例
- Round 1 debate (Codex + Gemini + Claude): 「カード全体クリック維持」を方針決定
- Codex review bot: 3回連続で a11y P1 指摘、ジレンマを顕在化
- Codex 実装案 (canonical full-width CTA): a11y は解決するが Round 1 方針を覆す
- **Gemini 独立レビュー**: 第3の道（透過オーバーレイ）で a11y と UX を両立

「Codex 実装 → Codex review → Gemini レビュー」のクロスチェックで、単一 LLM の盲点（二項対立の罠）を回避できた。

### 観測結果
- vitest unit: 47/47 pass (新規 Block Link テスト 2件 + SWR テスト 4件)
- test:rules: 21/21 pass
- test:api: 41/41 pass
- test:e2e (Playwright): 13/13 pass (badge-flow / history-flow×2 / limit-flow / modern-user-no-double-count / pending-block-ui / issue-47-snapshots×7)
- スクリーンショット 28枚 (4 状態 × 4 幅 × saikaku/uaam) を `screenshots/issue-47/` に保存

---

## 9. Routing & Browser History (Issue #50)

### 背景
本機能以前は `src/App.jsx` で `useState('screen')` を使った単一 state ベースの画面遷移を採用しており、ブラウザ戻る/進む・直接URL アクセス・スワイプバック・リロードのいずれも壊れていた。`window.history.pushState` 利用箇所はゼロ件、URL は `?dev` `?page` パラメータが部分的に参照されるだけだった。これを修正するため Issue #50 を起票。

### 採用案
`react-router-dom` v6.4+ (`createBrowserRouter` + `RouterProvider`) を導入し、画面遷移を URL に同期させる。
`src/App.jsx` を `useState('screen')` ベースの単一分岐から `<Routes>` 構造に置換し、`AppShell` (Outlet レイアウト) の中で auth bootstrap・グローバル state・`useBlocker`・`beforeunload` を集中管理する。子コンポーネントの prop 名 (`onBack`/`onReset`/`onSelectXxx` 等) は不変で、`*Route` ラッパー (`SelectRoute`/`InputRoute`/...) が `useNavigate()` を呼ぶ変換層になる。
ソース: `plans/issue-50-history-api.md` (本 worktree のみ — main にはまだ存在しない)。

### なぜ `react-router-dom` (案B) を採用したか — 自前 navigation store (案A) の致命穴
当初、依存を増やさない自前 navigation store (案A) を提案したが、debate (Gemini + Codex + Claude 独立レビュー) で以下5点の致命穴が露呈し、棄却された。

1. **`history.pushState` は popstate を発火しない** — 案A の "navigate=URL+state 同期更新" 実装は popstate ハンドラ単体では動かず、結局 `pushState` 直後の手動 state 同期が必要になる。最終的に react-router 相当の複雑度になり、自前実装の優位性が消える
2. **`replaceState('/loading')` は遷移元 URL を破壊する** — `/input` から `/loading` に replace すると戻るで `/input` に帰れない。「loading=URL 昇格」前提自体が成り立たないことが debate で発覚
3. **popstate 内 `pushState` で「留まる」は不可能** — 戻る確認モーダルの Cancel で URL を維持する API が標準にない。`history.go(1)` で復帰させる workaround は二重 popstate を引き起こすため、cancel 経路が実装不能
4. **`history.state` の cancelGuard は永続化される** — リロード後も guard 状態が残り、解除タイミングを自前で管理する必要が生じる。状態管理が指数関数的に複雑化
5. **iOS Safari は PWA / swipe-back で `window.confirm()` をブロックする** — 自前案で前提していた confirm-on-popstate 経路が iOS で機能しない (実機で確認済み)

これらは 11 画面 + 動的 param + 認証ガード + LLM-inflight guard のスケールでは個別に対処不可能。`useBlocker` + `data router` + `<Navigate>` を備えた枯れた実装に乗ったほうが最終コードが小さく、エッジケースのバグも踏みにくい。bundle 増加 (`vendor-react` で +約 30KB gzip) は許容範囲と判断。

### なぜ loading を URL に昇格しないか (オーバーレイ採用)
当初の自前案では LLM 解析中の画面を `/loading` という URL にする設計だったが、debate で以下3点の問題が露呈した。

1. **ErrorBoundary reload との相性が悪い** — `window.location.reload()` で `/loading` に戻ってきても解析 state は消えており、空画面になる
2. **戻るボタンで `/loading` を traverse できる** — 二重発火・state 不整合・abort 経路の二重起動が起きる
3. **`replaceState` で遷移元を上書きするしかない** — 前述 (2) の理由で破綻する

代替として `loadingKind` state ('saikaku' | 'uaam' | null) を `AppShell` に持ち、`isLLMInflight===true` の間 `<LoadingOverlay>` を fixed position (`z-index: 10000`) で被せる。URL は遷移元 (`/input` または `/uaam`) のまま — 戻るは「解析をキャンセルして元の入力画面に戻る」という直感的挙動になる。`LoadingOverlay` 内の「キャンセル」ボタンも同じ動線で abort + navigate を実行し、3つのキャンセル経路 (戻る・タブクローズ・明示ボタン) を1箇所のハンドラに集約できる。

### なぜ `useBlocker` + React モーダル (`window.confirm` ではなく)
LLM-inflight ガードの確認 UI を `window.confirm()` で実装する案もあったが、以下3点で棄却した。

1. **iOS Safari PWA / swipe-back で `confirm()` がブロックされる** — 実機テストで確認済み。confirm-on-popstate 経路が動かないため、iOS ユーザーが解析中に誤って戻るとガードなしで結果が消える
2. **スタイル不可能** — アプリのデザインシステム (`#F5F0E8` 背景 + `#A84432` アクセント) と整合しない
3. **同期 API なので abort + navigate の連鎖が組みづらい** — `confirm()` の戻り値で分岐すると Promise との合流が不自然

採用した実装は `useBlocker((args) => isLLMInflight)` でブロッキング状態を取得し、`blocker.state === 'blocked'` のときだけ `<NavigationGuardDialog>` を render する。「中断する」で `inFlightControllerRef.current.abort()` + `blocker.proceed()`、「続ける」で `blocker.reset()`、ESC で `onCancel()` (= reset) という対称構造。focus capture/restore + Tab/Shift+Tab トラップ + `role="dialog"` `aria-modal="true"` の a11y 対応を内蔵 (codex-code-review の指摘で追加)。
タブクローズ・リロードは `beforeunload` ハンドラで `event.preventDefault() + event.returnValue = ''` を返し、ブラウザ標準の確認ダイアログに委譲する (これはどのブラウザでも抑制できないため、自前モーダル不要)。

### スコープと不変条件
- **子コンポーネントの prop 名は不変** — `onBack`/`onReset`/`onSelectXxx`/`onAdmin`/`onLogout`/`onSelectAttemptId`/`onSubmit` 等。`AppShell` 配下の `*Route` ラッパーで `useNavigate()` を呼び出す変換層を挟むだけで、子コンポーネントは routing 非依存のまま保つ
- **ErrorBoundary は `RouterProvider` の外側に配置** — `src/main.jsx` の `StrictMode` 直下。reload 時に URL は保持され、loading が URL でないため自然に解消される
- **`?dev=uaam` / `?page=uaam-result` の後方互換** — `AppShell` の起動時 `useEffect` で `navigate('/uaam/result', { replace: true })` に変換 (`initialLegacyRedirectHandledRef` で多重発火防止)
- **履歴詳細 (`/history/:kind/:attemptId`)** — `useEffect` ベースの fetch で `/api/me/history/<id>?kind=<kind>` を取得し、403/404 は `/history/<kind>` へ redirect + alert。data router の `loader` は今回未採用 (Suspense との相性検証コストを避けた)
- **直接 URL アクセス時の空 state 対応** — `/result`, `/uaam/result` は state 必須なので、空のときは `<Navigate to="/input" replace>` または `<Navigate to="/uaam" replace>` で入力画面に戻す

### debate を経て確定した「隠れた前提」
debate ラウンドで以下の前提が当初は不明確だったが、明文化することで実装方針が一意に定まった。

- `pushState` は popstate を発火しない (案A 致命傷の根拠)
- `replaceState('/loading')` は遷移元を上書きする (loading=URL 昇格を撤回した根拠)
- popstate 内 `pushState` で「留まる」ことは標準 API で不可能 (cancel 経路が組めない根拠)
- `history.state` への書き込みは reload で永続化される (state ベース guard を撤回した根拠)
- iOS Safari は PWA / swipe-back コンテキストで `window.confirm()` をサイレントに無視する (React モーダル採用の根拠)
- `onAuthStateChanged` 確定前に Routes を render すると `useNavigate` 競合が起きる (`authLoading` 中はスピナーで break する根拠)

### スコープ外
- 入力途中値の sessionStorage 永続化 (別 issue)
- 重い子コンポーネントの遅延ロード
- SSR / SEO 対応 (現状 SPA で要件なし)
- サーバー側 `reserveAttempt` のキャンセル時 cleanup (クライアント abort のみで attempt slot は消費される。`src/App.jsx:382` のコメント参照)
- HistoryScreen の scroll position 復元 (戻り時の UX 改善は次フェーズ)

### URL マップ・実装詳細・移行ガイドの一次ソース
URL 一覧表・直接アクセス時の挙動・`RequireAdmin` ガード・空 state redirect・LLM-inflight ガードの実装詳細は `docs/routing.md` を参照。本ドキュメントは「なぜ案B にしたか」の判断記録のみを保持する。

---

## UAAM page-skip prevention (issue #55)

### 背景
production で UAAM 回答者が 57/67 のまま結果送信できず、調査すると 5 ページ目が未回答だった。従来 UI はページドットから任意ページへジャンプできたため、途中ページを飛ばして最終ページまで進めてしまう。一方、最終ページでは未回答が残っている理由や戻るべきページが十分に見えず、ユーザーには「全部進んだのに送信できない」状態として見えていた。

これは API validation だけでは解決しない。サーバー側で 67 問すべての回答を必須にしても、クライアントが「どこが未回答か」「どう戻るか」を示さなければ、同じ詰まり方が残る。したがって `src/screens/uaam/UAAMScreen.jsx` 側で、未完了ページを飛ばせないナビゲーションと、未回答ページへ戻す明示導線を同時に入れる必要があった。

### 採用案
`maxReachablePage` を UI 上の到達可能範囲として持ち、現在ページまでの回答完了状態から次に進める上限を決める。これにより、ページドットで未回答ページの先へ直接飛ぶ経路を閉じつつ、既に訪問・回答済みのページへ戻る操作は維持する。

ページドットは HTML の `disabled` ではなく `aria-disabled` 表現にした。見た目と支援技術には「現在は無効」を伝えるが、クリックハンドラ自体は常に発火させる。到達不能ページを押した場合も `handlePageChange` が一度受け取り、先頭の未完了ページへリダイレクトするためである。plan-with-debate の 3-AI consensus でも、この設計は「onClick must always fire」を満たすため `aria-disabled + force-click in E2E` として合意した。

さらに、最終ページに到達しているが `allAnswered` ではない場合だけ「未回答ページへ戻る」ヘルパーボタンを出す。通常の回答中は余計な導線を増やさず、production incident と同じ「最後まで来たが送信できない」局面にだけ、次の一手を明示するためである。

### なぜ別案を採らなかったか
HTML の `disabled` は棄却した。ブラウザがクリックイベントを抑止するため、到達不能ページを押した時に `handlePageChange` で未回答ページへ戻す redirect path 自体が動かない。今回の目的は単に操作を無視することではなく、誤ったジャンプ操作を「戻るべき未回答ページ」へ変換することだった。

sessionStorage による回答ドラフト保存も同時対応しなかった。入力途中のリロード・離脱耐性は Critical UX issue だが、今回の根本原因はページスキップによる未回答の不可視化であり、保存戦略とは責務が違う。ドラフト永続化は設計範囲と副作用が大きいため、別 issue の関心として切り分けた。
