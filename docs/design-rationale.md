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

## 10. Per-Pair Integration サブコレクション (issue #44/#45/#46)

> 確定: 2026-05-04 (Phase 1 実装完了)

### 採用案

統合分析の保存先を親 doc のネストフィールドから専用サブコレクションに移設。

```
uaam_results/{uid}                           // 親 doc (既存)
  integrations/{pairKey}                     // サブコレクション (新設)
    pairKey = "${saikakuAttemptId}__${uaamAttemptId}"
    saikakuAttemptId, uaamAttemptId
    regenerationCount: 0 | 1
    status: 'active'                         // 書込時は常に active
    analysisResult: { ... }
    createdAt, updatedAt
    _locks/integration                       // 統合ロック (Admin SDK 専用)
      pairKey, ownerId, acquiredAt
```

クライアントからは `/api/integrate` (POST) でリクエスト → `/api/me/integrations` (GET) で一覧取得。読み取り時に `status: 'stale'` をオーバーライドして返す (DB 上は `active` のまま)。

### なぜ per-pair サブコレクションか

1. **診断履歴の保全**: Saikaku 再受験 / UAAM 再受験のたびに「Saikaku attempt × UAAM attempt」の組み合わせが増える。単一スロットに上書きすると過去の統合結果が消滅し、履歴表示 (issue #45 HistoryScreen バナー) が成立しない
2. **Stale 検出の自然な導出**: 読み取りパスでユーザーの最新 attemptId と統合 doc に保存された attemptId を比較するだけで `status: 'stale'` が計算できる。状態フラグを能動的に更新する必要がない
3. **Firestore インデックス活用**: サブコレクションは doc 単位でインデックスが効く。将来的に `createdAt` 降順ページネーションや `status` フィルタも容易

### 棄却案: 親 doc の `analysis.saikaku_integration` フィールド (移設前の構造)

issue #44 の根本原因がこの構造にある。firebase-admin v12.7.0 は `set({'a.b': v}, {merge: true})` のドット付きキーを **フィールドパス** として解釈せず、`'a.b'` というリテラルトップレベルフィールドとして書き込む。これは `analysis.saikaku_integration` というネストフィールドを期待していた下流読み取りと衝突し、サイレントに壊れる。実証: `tests/api/firestore-merge-debug.test.js` (リグレッションテストとして保持)。

### 棄却案: 親 doc に pairs 配列を埋め込む

- 配列要素の atomic update が Firestore では制約あり (Section 1 と同じ理由)
- 親 doc 全体を read しないと 1 pair を更新できない
- per-doc インデックスが効かない

### Phase 1 不変条件

| 区分 | 内容 |
|------|------|
| **禁止** | ドットキー `set({'a.b': v}, {merge: true})`。`update({field: value})` または ネストオブジェクト `set({field: value}, {merge: true})` を使う |
| **再生成上限** | 1 pair につき合計 2 回 (`regenerationCount` が `0` → `1` まで)。2 回目以降は HTTP 409 `cap_exceeded` |
| **ロックフェンシング** | `acquireIntegrationLock` が `{ pairKey, ownerId, lockRef }` を返す。`commitIntegration` は同一 transaction 内で `ownerId` 検証 + stale チェックを行い、`tx.delete(lockRef)` もその transaction に含める (race window なし) |
| **LLM タイムアウト** | `AbortSignal.timeout(LOCK_TTL_MS - 30_000)` (9.5 分) で wrap し、LLM 呼び出しがロック有効期間を超えられない |
| **読み取り時 stale** | DB 上の `status` は常に `'active'`。読み取り API がユーザーの最新 Saikaku/UAAM attemptId と比較し、乖離があれば `'stale'` に差し替えて返す |
| **Legacy fallback** | サブコレクションが空の場合、読み取り API が親 doc のリテラルドットキーまたはネスト `analysis.saikaku_integration` から `integrationSummary` を合成 (`saikakuAttemptId: 'legacy-fallback'` / `uaamAttemptId: 'legacy-fallback'`)。UI は「移行前データ」バナーを表示 |
| **マイグレーション** | `scripts/migrate-integrations-to-subcollection.mjs --dry-run` (デフォルト) / `--apply`。冪等。attempt pair の解決はタイムスタンプ推論 (`shared/integrationsAttemptResolver.js`) で行い、`latestAttemptId` ショートカットは使わない |

### エラーレスポンス形状 (Phase 2 hardening)

`/api/integrate` および `/api/me/*` の全エラーはコードベース:

| 例外クラス | HTTP | `code` |
|---|---|---|
| `IntegrationConflictError` | 409 | `lock_conflict` |
| `IntegrationLimitExceededError` | 409 | `cap_exceeded` |
| `InvalidIntegrationRequestError` | 422 | `invalid_input` (+ `field`) |
| Timeout / AbortError | 504 | `upstream_timeout` |
| その他 | 500 | `internal_error` (+ `requestId`) |

スタック/メッセージはサーバー側ログに `requestId` 付きで記録。クライアントには `requestId` のみ返す。

### 参照

- スキーマ定義: `docs/spec/integrations-schema.md`
- ドットキーバグの実証: `tests/api/firestore-merge-debug.test.js`
- 純粋ヘルパー: `shared/integrationsKey.js` (pairKey 生成), `shared/integrationsAttemptResolver.js` (タイムスタンプ推論)
- E2E: `tests/api/integrate-subcollection.test.js`, `tests/api/me-history-integration.test.js`
- マイグレーション: `scripts/migrate-integrations-to-subcollection.mjs`

### 既存セクションとの関係

- **Section 1** — サブコレクション + 親 doc サマリの基本設計を踏襲。統合サブコレクション (`integrations/`) は attempts と同じ「サブコレクション分離で doc 上限回避」方針の延長
- **Section 2** — ロックフェンシング (Reservation Transaction) の設計パターンを統合ロック (`acquireIntegrationLock` / `commitIntegration`) に転用。TTL・tx.create による衝突検出・冪等コミットは同一原則
- **Section 5** — テスト戦略の emulator E2E 層 (`tests/api/`) に統合 E2E (`integrate-subcollection.test.js`, `me-history-integration.test.js`) を追加。ドットキーバグは `tests/api/firestore-merge-debug.test.js` でリグレッション防止
- **Section 6** — BFF `/api/me/*` の読み取り統一方針に準拠。統合一覧も `/api/me/integrations` として同じ認可ゲート (`withMeHandler`) を通す

---

## 11. UAAM page-skip prevention (issue #55)

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

## コーチングキー質問への回答保存 (issue #62)

### 背景
`/api/integrate` が生成する `saikaku_integration` には 3〜5 件の `coaching_questions`（コーチがユーザーに最初に投げかけるべき問い）が含まれる。これまでは「問いが提示されるが回答する場が無い」状態で、問い→回答→振り返りのループが閉じていなかった。各質問に textarea を出し、Firestore に永続化することで統合分析がコーチング素材として機能するようにした。

### 採用案
`uaam_results/{uid}` の **top-level に `coaching_answers` Map(Object)** を置く。形は `{ [qid]: { questionText, answer, answeredAt, updatedAt } }`、`qid = sha1(normalize(questionText)).slice(0,16)`。読み書きは `GET/POST /api/me/coaching-answers`（Bearer 認証 + Admin SDK）を経由し、`firestore.rules` は無変更。

`qid` を normalize+hash で算出する理由は、`/api/integrate` の Anthropic 呼び出しが `temperature` 明示なしで動いており、再生成のたびに質問文が軽く揺らぐためである。末尾の `？` 有無や全角/半角空白などの軽微な揺らぎは normalize で吸収し、同一意図の問いを同じ qid に上書き保存する。

`coaching_answers` を `analysis` の外側に置いた理由は、`/api/integrate` が `analysis.saikaku_integration` を merge:true で再生成する経路で、`analysis` 直下のサブツリーが置換される可能性があるため。top-level field なら再生成と独立に保持される。これは emulator integration test (`tests/api/coaching-answers-emulator.test.js`) で `/api/integrate` 相当の書き込み後も `coaching_answers` が残ることを実証している。

### なぜこうしたか
配列ではなく Map(Object) を選んだ理由は3点。第一に、Firestore の `set({merge:true})` で nested map に書く際、key 単位でアトミックに上書きされるため、並列 POST でも lost update が起きない（emulator 並列 POST テストで実証済）。第二に、`FieldValue.serverTimestamp()` が Map value 内では使えるが、Array 要素内では使えない。第三に、再生成後の orphan 質問（normalize でも吸収できないほど大きく変わった問い）は別 qid として残るだけで、上限管理や eviction が不要になる。クライアントは現在の `coaching_questions[i]` から qid を計算して hit したものだけ表示するので、orphan は UI から自然に消える。

UI は明示「保存」ボタン1つに集約した。autosave は debounce/競合制御のコストに対して得るものが少なく、`InputScreen` / `AdminScreen` の流儀とも揃える。draft 状態は `dirtyIndexes: Set<number>` で追跡し、非同期 load 完了時の `setDraftAnswers` でユーザーが触った欄を上書きしないようにした（codex review の Critical 指摘を反映）。

### なぜ別案を採らなかったか
Array 形式 + runTransaction は棄却した。Read-Modify-Write を毎回回す必要があり、20件上限管理・自前 upsert ロジック・`serverTimestamp()` の制約が増える。設計議論段階で 3-AI debate (Gemini + Claude独立) が「Map にすれば全部消える」と収斂した。

サブコレクション `uaam_results/{uid}/coaching_answers/{qid}` も棄却した。Map(Object) で十分シンプルに表現でき、現状のクエリ要件（最新統合分析 1 件分の往復）にコレクション分離はオーバーキル。将来 attempt 単位の history が必要になれば再検討する。

### 既知の限界 (別 issue 化)
- 過去 attempt 単位での回答管理は未対応（最新統合分析の coaching_questions に紐づく回答のみ。過去 attempt の `analysis.saikaku_integration` 自体が空であることが多い）
- AdminScreen からのコーチ閲覧 UI は別 issue
- 累積 orphan の明示削除 UI は v2（現状は UI に出ないだけで doc に残置）
- `/api/integrate` の `set({'analysis.saikaku_integration': X}, {merge:true})` が emulator では literal key として扱われる挙動を impl-5 で発見した。本 issue の影響範囲外（`coaching_answers` は top-level なので無関係）だが、issue-44 hotfix の前提認識と異なるため別 issue で再点検する価値がある

## 12. 管理画面 統合分析一覧タブ (issue #73)

### 背景
従来、ユーザー側 UI（`HistoryScreen` のバナー / `UAAMResultScreen` / `SaikakuIntegrationModal`）からのみ `saikaku_integration` を閲覧可能で、管理者が全ユーザーの統合分析品質を横断レビューする手段がなかった。`AdminScreen` には「才覚領域」「UAAM診断」の 2 タブが存在したが、両者をペアリングした統合分析だけ admin から見る経路が欠けていた。

### 採用案
`/api/admin/integrations` を新設し、`AdminScreen` に第 3 タブ「統合分析」を追加。読み取り専用、編集・削除・再生成 UI なし。

**取得戦略 (Round 1+2 debate で確定)**:

```js
const [cgSnap, uaamParentsSnap, resultsParentsSnap] = await Promise.all([
  db.collectionGroup('integrations').get(),
  db.collection('uaam_results').get(),
  db.collection('results').get(),
]);
```

3 つの root-level クエリを並列実行し、インメモリで集約する。`collectionGroup('integrations')` の名前空間は `d.ref.parent.parent?.parent.id === 'uaam_results'` ガードで防御。subcollection が空でも親 doc に `analysis.saikaku_integration` があれば legacy fallback を合成する。`status` は kind 別 stale 判定（saikaku/uaam 両方の latestId 比較）でレスポンス時計算。

**列構成 (10 列)**: ユーザー名 / メール / **才覚 label** / **UAAM label** / 再生成回数 / integration_score / model / status バッジ / createdAt / updatedAt。一覧主表示は `source.saikakuLabel` / `source.uaamLabel`（人間可読）、識別子（`saikakuAttemptId` / `uaamAttemptId` / `pairKey`）は詳細モーダルのみで表示。

**詳細モーダル**: AdminScreen 内インラインの軽量実装。`SaikakuIntegrationModal.jsx` を再利用しない。

**遅延取得**: 統合分析タブ初回表示時にのみ fetch。「更新」ボタンで強制再取得。

### なぜこうしたか

**取得戦略 B 案 (collectionGroup + 全件 collection get) を採用**した理由:
- A 案（親 doc を `where('hasSaikakuIntegration','==',true)` でフィルタ → N 並列取得）は古い legacy ユーザーで `hasSaikakuIntegration` flag が欠落している実データを `backup/uaam-20260504-0145.jsonl` で確認済みのため棄却
- `db.getAll()` は 500 件制約があり、件数増で破綻する可能性
- collectionGroup 1 + 全件 get 2 = root-level 3 クエリだけで完結、Read コストは数円/月（admin レビュー専用、頻度低）
- インデックス追加なし・Rules 変更なし

**legacy fallback 合成は必須**: `hasSaikakuIntegration` flag 欠落 + subcollection 空でも、parent doc にネスト or ドット記法で `analysis.saikaku_integration` が残っているケースがある（migration 前データ）。flag に頼らず実データ存在で判定する。

**SaikakuIntegrationModal を再利用しない理由**: 既存モーダルは `loadCoachingAnswers()` / `saveCoachingAnswers()` 副作用を持ち、admin 文脈で開くと管理者が他人のコーチング回答を上書きするリスクがある。AdminScreen 内インライン軽量モーダル（読み取り専用、coaching answer UI / 呼び出し一切なし）を新設した。

**列の人間可読 label を主表示にした理由**: UUID の `saikakuAttemptId` / `uaamAttemptId` は管理者にとってノイズ。`source.saikakuLabel` / `source.uaamLabel`（生成時に attempt 内容から algorithmically 抽出された label）を主表示にすることで、admin が「誰のどの分析か」を直感的に把握できる。識別子は詳細モーダルでのみ露出。

**遅延取得**: codex-review (performance High #2) で指摘。saikaku タブが初期表示なのに mount 時に 3 つの全件 collection get を走らせると、統合分析タブを開かない admin にも JSON パース・state 保持コストが発生する。`integrationsLoaded` state で初回のみ fetch、再表示では再取得しない（更新ボタンは強制再取得）。

**共通化リファクタ採用 (Codex 判断)**: `api/me/history.js` と `api/me/uaam-result.js` に重複していた `legacyIntegrationFromParent` / `isLegacyFallback` / `responseStatusForIntegration` を `api/lib/legacyIntegration.js` と `api/lib/integrationStatus.js` に切り出した。`responseStatusForIntegration` のシグネチャを 3 引数版 `(integrationDoc, kind, latestIds)` に統一し、`uaam-result.js` の 2 引数呼び出しも合わせて修正。`kind === 'admin'` で両 side の stale を判定する admin 用フラグを追加。me-history (22) / me-uaam-result (8) 全テスト保持で regression 防止。

### なぜ別案を採らなかったか

**棄却 1**: 「集計用 `admin_integration_index` ルートコレクションを書き込み時に同期更新（denormalize）」案。1 root-level クエリで完結する利点はあるが、書き込みパス（`api/lib/integrations.js`）に副作用追加が必要、commit/regenerate/migration の 3 経路すべて修正、初回 backfill スクリプト必要。read-only 機能のために write path を変更するのは技術的負債。

**棄却 2**: 親 doc 絞り込み + N+1 並列 (Round 1)。flag 欠落で legacy ユーザーが取りこぼされる。

**棄却 3**: flag 限定 + `db.getAll()` chunk (Round 2 採用版の前段)。500 件制約と flag 欠落の二重欠陥。

**棄却 4**: 詳細モーダルの `SaikakuIntegrationModal` 再利用。coaching answer 副作用で他人のデータを上書きするリスクがある。

### Round 1+2 debate での主要修正 (合計 11 指摘)

**Round 1 (5 指摘採用)**:
- 取得戦略を A 案（親 doc 絞り込み + N+1 並列）→ B 案（collectionGroup + インメモリ filter/sort）に変更
- 一覧主列を attemptId UUID から `source.saikakuLabel` / `source.uaamLabel` に変更
- legacy fallback 合成、動的 status 計算、`where('status','==','active')` 削除を反映

**Round 2 (6 指摘採用)**:
- 取得戦略に `results` collection 追加（saikaku stale 判定用）
- legacy fallback 候補は `hasSaikakuIntegration` flag に頼らず全件取得
- 詳細モーダルは `SaikakuIntegrationModal` 再利用禁止 → AdminScreen 内インライン
- 共通化リファクタは Codex 判断委ね、シグネチャ統一必須
- collectionGroup の `parent.parent.parent.id === 'uaam_results'` ガード追加

詳細: `debate/plan-debate-20260510-issue-73-admin-integration-list/round-{1,2}/fact-check.md`

### 既知の限界 (別 issue 化)

- AdminScreen.jsx 全体のリファクタ（2,355 行肥大化、3 タブの全件 table 描画、HARU_GRADES 個人名のクライアント埋め込み）は別 issue。本 PR は新規タブの追加に閉じる
- 統合分析の編集・削除・再生成 admin UI は未実装（読み取り専用に限定）
- 1000 件超のユーザーで警告ログは出すが、ページング・rate limit は未実装。admin 数名のレビュー専用、現状の規模では不要

### 参照
- API: `api/admin/integrations.js`
- 共通 helper: `api/lib/legacyIntegration.js`, `api/lib/integrationStatus.js`
- UI: `src/screens/AdminScreen.jsx`（IntegrationDetailModal インライン component）
- 認証パターン: `api/admin/users.js`（既存統一パターン踏襲）
- テスト: `tests/api/admin-integrations.test.js`, `tests/e2e/admin-integrations.spec.js`, `src/screens/__tests__/AdminScreen.integrations-tab.test.jsx`
- screenshot: `screenshots/issue-73/integrations-tab-list.png`, `integrations-tab-modal.png`

---

## 13. 才覚レーダー四隅バッジのパーセント主役化 (issue #77)

> 確定: 2026-05-10 (plan-with-debate Round 1 後実装)

### 背景
`ActivationMatrix.jsx` の四隅バッジ（衝/志/技/知）は `XX/80` 表記のみで、「100点満点中XX点」と誤読される視覚バイアスがあった。中央 `TOTAL %` および activePoint ツールチップは既にパーセント主役だが、四隅だけ raw 値主役で表示階層が非一貫だった。

### 採用案
`CornerBadge`（L47-115）のスコア表示部のみ、2行レイアウトに変更:
- **上行**: `XX%` — `clamp(15px, 3.6vw, 22px)` weight 700 α=0.9（主役）。`%` は `0.55em` weight 400 α=0.55（従属）
- **下行**: `XX/80` — `clamp(10px, 2vw, 12px)` weight 400 α=0.45（補足注記）

色は既存の軸 RGB tuple を維持し、α 値だけで階層化。kanji・EN ラベル・ミニバー・canvas 描画・hover ツールチップ・groupTotals.map カードはすべて非変更。

### なぜこうしたか
1. **既存3パターンとの整合性**: 中央 canvas の `pct + TOTAL %` 注記、activePoint ツールチップの `pct% + 灰色 %`、groupTotals.map カードの `total/max + pct%` 別行 — いずれも「pct 主役・raw 従属」階層。CornerBadge だけが逆転していたのを揃えた
2. **色階調を維持**: `c = g.color` の RGB tuple を流用して α 値で hierarchy 表現。新規色定数を導入しないことで既存の軸別カラー体系（mindset 青 / literacy 緑 / competency 黄 / impact 赤）を保つ
3. **`g.pct` を再計算しない**: `groupTotals` で既に `Math.round(total / (maxSub*4) * 100)` が算出されている。再計算は浮動小数誤差の温床
4. **prop interface 不変**: `CornerBadge` は `UAAMResultScreen` (L2195) と `AdminScreen` (L920) で共用。表示分岐を component 内に持ち込まず、両 consumer で同一 render を保証

### なぜ別案を採らなかったか

**代替案1（棄却）**: `XX/80` を完全置き換えて `XX%` のみ
- issue 完了条件で「`XX/80` も従来通り残る」と明示。要件違反

**代替案2（Round 1 debate で棄却）**: `XX% (XX/80)` の1行併記
- 漢字 `clamp(22px, 5vw, 32px)` + ミニバー `clamp(28px, 6vw, 40px)` で形成される縦長シルエットに横幅 60-80px のテキストを1行で詰めると、視覚バランス崩壊と隣接要素（segLabel 外周ラベル）への突出が発生
- Gemini Round 1 で「空間設計破綻・視覚階層ノイズ」と独立指摘
- 4ブレークポイント（375/414/430/520）で破綻が確定

### plan-with-debate Round 1 で確定した制約
- DOM 距離閾値で衝突判定: `getBoundingClientRect()` で segLabel・対角バッジ・自バッジ内部要素との矩形交差を排除
- pct 行 fontSize ≥ raw 行 fontSize の **1.4倍以上**（hierarchy が壊れない最小比）
- AdminScreen と印刷プレビュー（A4縦 210mm）も明示的に検証対象に追加

### codex-code-review (REQUEST_CHANGES) のスコープ判定
codex-code-review は High 6件を指摘したが、以下はすべて既存コードの問題で issue #77 のスコープ外と判定し、フォローアップ issue 候補として記録:
- canvas RAF 無限ループ・`canvas.width/height` 毎フレーム再設定（perf）
- canvas / クリック可能 div の ARIA・キーボード対応（a11y, WCAG 1.1.1 / 2.1.1 / 4.1.2）
- 1106 行の単一ファイル分割（maintainability）
- `setTimeout` cleanup（maintainability）
- `prefers-reduced-motion` 未対応（a11y, WCAG 2.2.2 / 2.3.3）
- `scores`/`maxSub` の数値バリデーション（error-handling）

スコープ内で唯一の指摘 — raw α=0.45 の WCAG 1.4.3 コントラスト不足 — はプラン Constraints で確定済みの仕様（既存 groupTotals.map カードと整合）。プランごと再評価しない判断は、つかさ確認 (2026-05-10) で承認。

### 観測結果
- vitest unit: 新規 `ActivationMatrix.test.jsx` 1 件 pass（4軸バッジ全てに `XX%` と `XX/80` が DOM 上に存在することと、font-size 比率・α 値・weight を検証）
- e2e (Playwright): `uaam-history-flow.spec.js` `uaam-page-skip.spec.js` 6 件全 pass（regression check）
- e2e snapshot: `issue-77-snapshots.spec.js` 7 件 pass（4ブレークポイント + 印刷プレビュー + 管理画面 2幅）
- スクリーンショット: `screenshots/issue-77/state-clean-{375,414,430,520}.png` + `print.png` + `admin-{375,520}.png`

### 参照
- 実装: `src/screens/uaam/ActivationMatrix.jsx:83-105` (CornerBadge スコア部のみ)
- ユニットテスト: `src/screens/uaam/__tests__/ActivationMatrix.test.jsx`
- snapshot e2e: `tests/e2e/issue-77-snapshots.spec.js`
- debate fact-check: `debate/plan-debate-20260510-issue-77/round-1/fact-check.md`
- codex review (スコープ外として保留): `codex/codex-review-20260510/`

---

## 14. UAAM 4グループカードのパーセント主役化

> 確定: 2026-05-12 (issue #77 の続編、内部 UI 整合化)

### 背景
`ActivationMatrix.jsx` の detailOpen 2x2 グリッドカード（旧 L892-915）は、右側スコアブロックで `total/max` を `fontSize: 22` 主表示、`g.pct%` をバー下のフッターに `fontSize: 10` 従表示 — つまり「raw 主・pct 従」だった。issue #77 で CornerBadge が「pct 主・raw 従」に揃えられた後、同ファイル内で 4 グループカードだけ階層が逆転したまま残り、視覚的に非一貫になっていた。

### 採用案
右側スコアブロックを `flexDirection: 'column'` の縦並びに変更し、CornerBadge (L83-105) と同型の 2 行レイアウトに揃えた:
- **上行 (主)**: `XX%` — `fontSize: 22` weight 800 α=0.9。`%` は別 span で `0.55em` weight 400 α=0.55
- **下行 (従)**: `XX/80` — `fontSize: 10` weight 400 α=0.45。`/{g.max}` も別 span で `1em` weight 400 α=0.45

バー下にあった旧フッター `<div>{g.pct}%</div>` は削除。進捗バー `width: ${g.pct}%` のロジック・左側 kanji/EN ラベル・配色 RGB tuple は非変更。

### なぜこうしたか
1. **同ファイル・同コンポーネント内の整合性**: CornerBadge（L83-105）、Strengths/Growth Areas（L1041-1093）、16軸詳細カード（L834-836）はすべて pct 主役階層。4 グループカードだけが逆転していたのを揃えた
2. **F1 (`%` 別 span)**: CornerBadge L97 の `<span style={{ fontSize: '0.55em', fontWeight: 400, color: rgba(..,0.55), marginLeft: 1 }}>%</span>` パターンを完全踏襲。`{g.pct}%` 素朴記法だと baseline 揺らぎが出る
3. **F3 (column 配置)**: 主表示と従表示の縦並びは `flexDirection: 'column'` で物理的に baseline 衝突を防ぐ。値の桁数差（0%/100% など）でレイアウトが崩れない設計
4. **F4 (従素点スタイル)**: 従表示の `/{g.max}` は CornerBadge L98-104 と同じく `fontSize: '1em', fontWeight: 400, color: rgba(..,0.45)` に統一
5. **フォントサイズ比 22/10 = 2.2 (≥1.4)**: issue #77 で確定した「pct 行 ≥ raw 行の 1.4 倍」基準を満たす

### スコープ
- 編集: `src/screens/uaam/ActivationMatrix.jsx` (旧 L892-915 周辺のみ、21+ / 10- diff)
- 編集: `src/screens/uaam/__tests__/ActivationMatrix.test.jsx` (4グループカード回帰テスト 89 行追加)
- 非変更: CornerBadge (L83-105) / Strengths/Growth Areas (L1041-1093) / 16軸詳細カード (L834-836) / 進捗バー幅ロジック / 左側 kanji/EN ラベル

### 観測結果
- vitest unit: `ActivationMatrix.test.jsx` 2 件 pass (既存 CornerBadge + 新規 4グループカード)
- npm run build: pass
- minified bundle に `fontSize:22,fontWeight:800` / `flexDirection:"column",alignItems:"flex-end"` / `fontSize:"0.55em"` の出力確認

### 参照
- 実装: `src/screens/uaam/ActivationMatrix.jsx` (4グループカード右側スコアブロック)
- ユニットテスト: `src/screens/uaam/__tests__/ActivationMatrix.test.jsx` (4 カード全件で pct/raw 主従、span 分離、alpha、column 配置、進捗バー幅検証)
- プラン: `plans/uaam-group-card-percentage-primary.md`
- Codex 委任応答: `~/codex/assign-codex-20260511----Goal---src-screens-uaam-Act/`

## 15. Alpha 画面 メール認証ログイン追加 + useEmailAuth hook 抽出 (issue #105)

### 背景
alpha (リトリート 共鳴シート) 画面のログインは Google 認証のみだった。saikaku 側 (`/login`) にはメール認証が既に実装済み (`LoginScreen.jsx` L58-225) で、新規登録・確認メール送信・60秒再送クールダウン・未確認ユーザー救済・利用規約同意などのフルセットが揃っていた。alpha でもメール認証で参加できるようにする要望に対し、saikaku 側のロジックを **両画面で共有** しつつ、各画面の theme を維持する必要があった。

### 設計判断: UI 共通化を諦めて **headless hook** に抽出
| 検討案 | 採否 | 理由 |
|---|---|---|
| (A) LoginScreen の UI ごとコピー | 棄却 | 二箇所メンテで中長期負債、バグ修正・UI 改善が二箇所必要 |
| (B) `AuthForm` 共通コンポーネント抽出 (UI 含む) | 棄却 | saikaku は dark theme + Playfair Display、alpha は light theme + Noto Serif JP で **theme conflict 不可避**。「LoginScreen の DOM を 1px も変えない」要件と両立不能 |
| (C) **headless hook `useEmailAuth` 抽出 + UI は画面ごとに独立** | **採用** | ロジックは hook で DRY、UI は各画面で theme 適応可能。React 公式の hook ルール準拠 |

判断ソース: Round 1 debate (Gemini 3.1 Pro + Claude 独立サブエージェント) で両方が独立に theme conflict を指摘。

### 実装

#### 認証ロジックの抽出
`src/hooks/useEmailAuth.js` に以下を集約 (LoginScreen から削除):
- state: `agreed`, `loading`, `error`, `authMode` ('google'|'email'), `emailMode` ('login'|'signup'), `email`, `password`, `passwordConfirm`, `displayName`, `verificationSent`, `fromEmail`, `resendLoading`, `resendMsg`, `resendCooldown`
- handlers: `handleLogin` (Google), `handleEmailAuth` (signup/signin), `handleResendVerification`、各 setter
- 内部 helper: `requestVerificationEmail`, `requestVerificationEmailWithFallback` (Resend → Firebase デフォルトの段階的フォールバック)
- `saveConsent` (results/{uid} に consentAt を merge)
- `AUTH_ERROR_MESSAGES` (Firebase エラーコードの日本語マッピング)
- `auth/email-already-in-use` の未確認ユーザー救済フロー (サインインして確認メール再送)

公開インターフェイス: `useEmailAuth({ onLogin, continueUrl }) => { state, handlers }` の headless 形式。UI 描画は consumer 側が theme 適応する。

#### continueUrl パラメータ + origin allowlist
alpha 側からのメール認証では `continueUrl: window.location.origin + '/alpha'` を渡し、確認メールリンクから `/alpha` に戻れるようにした。`api/send-verification-email.js` の `resolveContinueUrl` に **origin allowlist** を実装してオープンリダイレクトを防止:

```js
const ALLOWED_ORIGINS = [
  'https://saikaku-architecture.vercel.app',
  'http://localhost:5173', 'http://localhost:3000',
  'http://127.0.0.1:5173', 'http://127.0.0.1:3000',
];
// process.env.VERCEL_URL があれば https:// プレフィックスで動的追加 (Vercel preview 対応)
```

非許可 URL は `console.warn` でログを残しつつ DEFAULT_CONTINUE_URL (`https://saikaku-architecture.vercel.app/`) に静かにフォールバック (UX を壊さない)。

#### emailVerified ガード
`src/alpha/AlphaApp.jsx` の `onAuthStateChanged` に saikaku 側 `App.jsx:202-221` と同じパターンを追加:

```js
const isEmailProvider = u.providerData.some(p => p.providerId === 'password');
if (isEmailProvider && !u.emailVerified) {
  setUser(null);  // ログイン画面に留める (サインアウトはしない)
  return;
}
```

メール認証直後・未確認のまま再アクセスしたユーザーが `/alpha` 入力画面に到達することを防ぐ。

#### firestore.rules 重複削除
既存の `alpha_events/{eventId}/resonance/{docId}` ルールが 2 箇所に重複定義されていた (L18-22 と L26-30) のを 1 つに統合。誤コメント「その他のコレクションへのアクセスはすべて拒否」も削除。`match /{document=**} { allow read, write: if false; }` のデフォルト拒否ルールは保持。

### 制約と維持
- **LoginScreen の DOM を 1px も変えない**: JSX レンダリング部分は import / hook 呼び出しに置換するのみで未変更 (Codex 実装 + Opus diff 確認)
- **`/api/send-verification-email` の後方互換**: saikaku 側既存呼び出しは `continueUrl` を渡さなくても従来通り動く (resolveContinueUrl で空/未指定は DEFAULT にフォールバック)
- **alpha light theme 維持**: `T.bg = #F5F0E8`, `T.accent = #C4922A`, Noto Serif JP 系 (Playwright で実画面確認済み)

### Codex code review 指摘の対応
本 issue で導入した変更で High と判定された問題:
- **continueUrl オープンリダイレクト** → origin allowlist 追加で対応

スコープ外として後続対応 (既存問題):
- admin API ルートの認可ゲート不足 (`api/_app.js`)
- send-verification-email の Bearer token 認証不足
- `/alpha/map` の認証前表示
- React ErrorBoundary 不在
- 外部 API (Resend/Gmail) のタイムアウト不足

### 検証
- vitest unit: 84 件 全パス (新規 `tests/send-verification-email.test.js` で許可5origin/preview/拒否3パターン/空値/handler 統合)
- vitest api (emulator): 143 件 全パス
- Playwright e2e: 42 件 全パス (saikaku 系 E2E 回帰なし)
- vitest rules: 8 件失敗 — main ブランチでも同じ既存失敗 (本 issue 起因ではない)
- Playwright で実画面確認: `/alpha` light theme、Google ボタン + メールフォーム、同意前後の disabled、signup タブ4入力欄

### 参照
- 実装: `src/hooks/useEmailAuth.js` (新規)、`src/screens/LoginScreen.jsx` (リファクタ)、`src/alpha/AlphaApp.jsx` (AlphaLogin 書き換え + emailVerified ガード)、`api/send-verification-email.js` (continueUrl + allowlist)、`firestore.rules` (重複削除)
- テスト: `tests/send-verification-email.test.js` (新規)
- プラン: `plans/issue-105-alpha-email-login.md`
- Debate: `debate/plan-debate-20260513-issue-105/round-1/fact-check.md`

## 16. 才覚領域の生成トーンを実用版に変更 + analyze.js を Sonnet 4.6 化

### 背景
才覚領域診断が生成する `kakuchiiki` / `kakuchiiki_options`（才覚領域名）は、従来「脚本家・コピーライターが書くような洗練された言葉」を志向する詩的トーンで生成していた（例:「天地を繋ぎ、地球を動かす者」）。象徴性は高い一方、本人が翌日から行動に移すには抽象度が高すぎるという課題があった。過去に別途 85 名分の才覚領域フレーズを詩的→実用版に手動翻訳する検証（`docs/才覚領域_実用版_生成プロンプトv2.md` に翻訳原則をまとめ済み）を行っており、今回はその原則を診断時の**一次生成プロンプト自体**に組み込んだ。

### 設計判断: フィールド一本化（新規フィールド追加を棄却）
| 検討案 | 採否 | 理由 |
|---|---|---|
| (A) `kakuchiiki_practical` 等の新規フィールドを追加し詩的版と併存 | 棄却 | 表示・選択・統合(`integrate.js`)のどこでも使われず死蔵になる。「詩的/実用どちらを selected とするか」の責任分離が発生（Codex・Claude独立サブエージェント双方が round-1 debate で指摘） |
| (B) **既存 `kakuchiiki` / `kakuchiiki_options` の生成トーンだけ差し替え（フィールド不変）** | **採用** | 消費経路（`ResultScreen.jsx` 表示・選択、`api/integrate.js` の文字列連結）はいずれも kakuchiiki を opaque な文字列として扱うため、フィールド不変なら変更が生成プロンプトの一箇所に閉じる。過去データ（詩的版）も同一フィールド・同一UIでそのまま表示可能 |

### 実装
- `api/analyze.js` の `SYSTEM_PROMPT` 内「■ STEP2：才覚領域名の生成」区間のみ書き換え。**掛け算演算の骨格（WHY×HOW×WHAT / STEP1核ワード抽出→STEP2生成）は維持**し、STEP2 の出力トーン規則だけ実用版に変更:
  - 才能（HOW）＝動詞で表す（例: 言語化して／整理して／つないで）
  - 情熱（WHAT）＝狭めすぎない領域名（例: 教育、地域づくり、探究の学び）
  - 文末＝平易な人名詞で締める（例: 〜人／〜支援者／〜案内人）。凝った造語の役職名（魂の航路を拓く者、等）は禁止例として明記
  - 文章型 20〜35 字程度
  - `insight` / `what` / `reward` / 各軸の生成指示には波及させない旨を明記（トーン変更の影響範囲を STEP2 に限定）
- `model` を `claude-sonnet-4-20250514`（2026-06-15 廃止予定）から `claude-sonnet-4-6` に更新（`claude-api` スキルで一次ソース確認済み）。**このモデル更新は `api/analyze.js` のみが対象、`api/uaam.js` / `api/integrate.js` は Sonnet 4 据え置き**（スコープ外）。
- `tests/fixtures/anthropic/saikaku-1.json` の `kakuchiiki` / `kakuchiiki_options` を実用版トーンの例文に更新。
- `src/screens/ResultScreen.jsx` の WHAT セクション補助ラベル2箇所（「才覚領域から自然に生まれること」→「才覚領域を活かす活動」等）を実用版トーンに合わせて調整。選択保存(`selectedKakuchiiki`)・カード選択ロジック・PDF/印刷ロジックは無変更。

### 検証
- `node --check` / fixture JSON parse: OK
- vitest api (emulator, MOCK_ANTHROPIC): 23 ファイル 143 件 全パス
- vitest unit (UI): 12 ファイル 84 件 全パス
- **実 API 検証**（`claude-sonnet-4-6` に実際に1回生成させて確認）: `output_tokens` 1813 / `max_tokens` 8192（余裕あり、引き上げ不要）、`stop_reason: end_turn`、`kakuchiiki` は動詞＋領域＋人名詞締めの実用版トーン（24〜27字）、`insight` / `what` / `reward` とも正常出力
- Playwright e2e: `history-api-flow.spec.js`（生成→表示、既存1件は flaky でリトライ後成功・本変更と無関係と確認）、`history-flow.spec.js`（過去データ=詩的版の表示）全パス。選択カードクリック + PDF(`window.print`)トリガーは一時 spec で個別検証（コミット対象外）

### スコープ外として切り出し（既存問題）
`/codex-code-review` が検出した以下は本 PR の差分とは無関係な既存の技術的負債のため issue #109 として切り出し: Firestore rules によるクライアント直接書き込みの改ざん余地（`ResultScreen.jsx` の `setDoc`）、`ResultScreen.jsx` の責務過多（906行）、キーボードフォーカス不可視（`outline: 'none'`）、AI レスポンス必須フィールド検証の甘さ（軸データのネスト欠損を検出できない）。

### 参照
- 方針ドキュメント: `docs/才覚領域_実用版_生成プロンプトv2.md`
- 実装: `api/analyze.js`、`src/screens/ResultScreen.jsx`、`tests/fixtures/anthropic/saikaku-1.json`
- プラン: `plans/saikaku-practical-kakuchiiki.md`
- 切り出しissue: #109

## 17. 管理者向け相性診断 MVP

### なぜ相性スコアを持たないか

相性は人物の固定属性ではなく、目的・場面・関係の運用で変わる。単一の点数は説明可能性を落とし、人事評価・採用評価への流用を誘発するため採用しない。出力は「同質」「補完」の2レンズとし、各主張を `observation | hypothesis`、証拠ID、本人が反証できる確認質問に結び付ける。証拠がない場合の「不検出」と、入力が足りない場合の「データ不足」は正常な結果として扱う。

### 証拠の非対称性をどう扱うか

内部診断の本人入力Top5は、ドキュメント直下の `inputTalentTop5` / `inputValueTop5` / `inputPassionTop5`（改行区切り文字列）だけである。`result.{talent,value,passion}.axisN.top5[]` と軸名は生成結果なので `generated_axis` として分離する。文字比較はNFKC正規化後の完全一致だけで、部分一致・類義語推定は行わない。

公開アプリのプロフィールには本人入力Top5、`core_words`、UAAMがない。混成分析では両者に存在する `generated_axis` だけを比較し、内部側だけにある情報を有利な証拠として加えない。画面とレポートは可用性を先に表示し、欠落を人物の欠如に言い換えず「この診断データでは不検出」と書く。

### UAAMの適格条件

UAAMは内部結果の一部にだけ存在し、公開プロフィールには存在しない。各サブ指標のpercentileは実行時の `uaam_results` から計算し、当該サブ指標の有効コホートが30件以上の場合だけ使う。ペアは2名ともUAAMあり、チームは `max(2, ceil(人数 × 0.6))` 名以上を必要とする。同質の観察はpercentile幅15pt以下、補完の観察は30pt以上とし、この間は数値証拠を生成しない。実データではUAAMが51/94件、公開取込は0件のため、UAAMの「データ不足」は例外ではなく主要なフォールバックである。

### 外部LLMへの最小化と出力ゲート

Anthropicへ送る識別子は A/B または M1…だけとする。氏名、メール、UID、自由記述、生Top5、exact-matchした語そのものは送らない。送るのは生成済み軸名、完全一致の件数と分類、UAAM percentile由来の証拠である。入力データは命令ではないことをsystem promptで明示し、出力後は未知の証拠ID、claim契約違反、相性スコア、人事・採用・査定語を決定論的に拒否する。修復再試行は1回だけで、再失敗時はレポートを返さない。

互換分析のモデルは `COMPAT_MODEL` で上書きでき、既定値を `claude-sonnet-4-6` に明示固定する。リポジトリ内の他診断のモデル設定には追従させない。

### 公開共有URL取込と監査

共有URLは `https://app.saikaku-architecture.com/share/<UUID>` だけを受け付け、upstream URLはサーバ側で固定組み立てする。`COMPAT_IMPORT_TOKEN` をBearerで送り、redirectを拒否し、レスポンスはschema version・完全なキー集合・型・長さを検証する。トークン未設定時は取込UIを無効表示し、APIも503でfail closedする。公開アプリ側の `/api/compat-import/[id]` は別リポジトリの責務である。

レポート本文は保存しない。倫理監査として `compat_audits` に、実行者UID、モード、人数、内部/公開の別、同意確認、目的入力の有無、モデル、成功/失敗だけを書く。対象者ID、氏名、目的本文は保存しない。

### profileVersionの競合検査を延期した理由

クライアントpayloadには将来の楽観ロック用に `profileVersion` を必須で残す。一方、MVPは単一運営者でレポートを保存せず、選択から生成までの競合影響が限定的なため、変更時409 (`PROFILE_CHANGED`) のhard checkは延期する。複数運営者またはレポート永続化を導入する時点で再評価する。
