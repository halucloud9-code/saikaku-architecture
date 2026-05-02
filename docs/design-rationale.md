# 設計判断の根拠 (Design Rationale)

> このドキュメントは「なぜこうしたか」を記録する。コード/SETUP は「何をしたか」「どう動かすか」だけ書く。
> 元 Issue: #1 (診断済みバッジ), #2 (履歴 + 2回上限)
> 確定: 2026-05-02

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

---

## 6. 履歴整合性: parent doc 単一購読 + 純関数導出 (issue #36)

### 採用案
`SelectScreen` (バッジ + 履歴リンク) と `HistoryScreen` (履歴一覧) が表示する診断回数を、**parent doc 1つだけから純関数で導出する**設計に統一した。

```
results/{uid} (parent doc)
  attemptCount      ← reserve で +1, commit で不変, rollback で -1
  pendingAttemptId  ← reserve で set, commit/rollback で null
  result/scores/analysis ← legacy 互換用サマリ
        ↓ summarizeFromParent (純関数)
  { committedCount, hasPending, pendingAttemptId, hasResult, isStartBlocked }
```

導出ロジック (`src/utils/attemptLoader.js#summarizeFromParent`):
```js
const hasPending = !!data.pendingAttemptId;
const hasResult  = !!(data.result || data.scores || data.analysis);
const rawCommitted = (data.attemptCount ?? 0) - (hasPending ? 1 : 0);
const legacyFloor  = hasResult ? 1 : 0;
const committedCount = Math.max(rawCommitted, legacyFloor);
const isStartBlocked = hasPending || committedCount >= 2;
```

`HistoryScreen` は遷移時に `loadAttemptDetails` で **parent doc + attempts subcoll を一発 `Promise.all` 取得** する (`onSnapshot` 不使用)。

### なぜこうしたか
- **race condition 回避**: parent と attempts を別々に `onSnapshot` 購読すると、reserve/commit/rollback の中間状態を捉えてフリッカー (Round 3 Gemini 指摘)。SelectScreen は parent 1つだけ購読することで購読間レースを根絶
- **二重カウント防止 (Round 2 Gemini 致命指摘)**: `legacyFloor` を `Math.max(rawCommitted, legacyFloor)` で適用することで、modern user (`attemptCount=1, result有`) でも `committedCount=1` を維持。`legacyDocToAttempt` による synth は `attemptDocs.length === 0` のときだけに厳格化し、attempts と legacy synth が共存しない
- **経過時間は `attempts/<pendingId>.createdAt` 基準**: `parent.updatedAt` は他フィールド更新で汚染されるため使わない。リロード後も一貫した経過時間表示を保証 (Round 3 Gemini 指摘)
- **fail-closed エラーハンドリング**: hook が onSnapshot エラーを受けたら `isStartBlocked: true` を返す。読めないときは新規開始させない安全側設計
- **HistoryScreen の `Promise.all` torn state**: 並列クエリ間に書込みが入る理論上の torn state は残存するが、画面遷移時の1回のみで実用上許容 (Round 4 Gemini 指摘)

### 中長期 follow-up (別 issue)
- サーバ側に `committedCount` / `pendingStartedAt` を atomic 維持する SSoT 統合 (issue 化済み)
- `getPendingNotice` を純関数に外出し + unit test 追加 (codex review C4)
- `useDiagnosisStatus` のエラー経路 unit test 追加 (codex review C3)
- `createdAtMillis` ヘルパー共通化 (codex review C1)

### なぜ別案を採らなかったか
- **parent と attempts を別 onSnapshot 購読**: race condition でフリッカー (Round 3)
- **`pendingObservedAt = Date.now()` で経過時間管理**: リロードで0リセットされ一貫性を失う (Round 2)
- **`parent.updatedAt` で経過時間判定**: 別フィールド更新で汚染される (Round 3)
- **サーバ側 `committedCount` の本 PR 内導入**: スコープ超過。フロント側の整合だけ先に解消し、サーバ SSoT 統合は follow-up issue へ
- **HistoryScreen を緩めて pending も含める**: replay 不能エントリで UX 混乱 (Round 1)
