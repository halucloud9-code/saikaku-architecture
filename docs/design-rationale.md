# 設計判断の根拠 (Design Rationale)

> このドキュメントは「なぜこうしたか」を記録する。コード/SETUP は「何をしたか」「どう動かすか」だけ書く。
> 元 Issue: #1 (診断済みバッジ), #2 (履歴 + 2回上限), #36 (履歴空表示), #40 (UAAM 履歴非表示)
> 確定: 2026-05-02 / 追記: 2026-05-03 (Section 6 追加)

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

## 7. Per-Pair Integration サブコレクション (issue #44/#45/#46)

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
