# 才覚診断: 診断済みバッジ + 履歴 + 2回上限 (issue #1, #2 統合)

> Round 1 + Round 2 フィードバック完全反映済み（v3 final）。Codex/Gemini 両者の指摘を統合。
> **重要設計変更**: Reservation Transaction（事前インクリメント）パターンを採用し、並行リクエスト時のLLM多重発火を完全に防ぐ。

## 概要

- **目的**: SelectScreen に診断済みバッジを表示し、各診断の履歴閲覧と最大2回までの試行制限を実装する
- **対象issue**: #1 (UX: 診断済みバッジ), #2 (Feature: 履歴 + 2回制限)
- **スコープ**:
  - Architecture (`results/{uid}`) と MATRIX (`uaam_results/{uid}`) の両方
  - SelectScreen UI、履歴閲覧 UI、API (`api/analyze.js` / `api/uaam.js`)、Firestore rules
  - **E2E自動テスト**: Playwright（代表3フロー）+ API統合テスト（Transaction/migration厚め）+ rules 単体テスト
- **実装担当**: Codex (assign-codex 経由)。Codex の差分は **必ずクロードが目視レビュー** してからコミット

## ローカル開発・テスト環境

- `npm run emu` — Firebase emulator (auth:9099, firestore:8080, UI:4000)
- `npm run api` — API server (`server.js`)
- `npm run dev` — Vite dev server
- `npm run dev:local` — concurrently で同時起動
- 新規追加: `@playwright/test`, `@firebase/rules-unit-testing`, `supertest`, `msw` (LLM mock)

---

## 設計判断（Round 1 修正版）

### A. データモデル: サブコレクション + Read-Time Fallback + サイズ分離

Codex指摘を受けて、Firestore 1MiB doc 制限を前提に **summary / full / raw** をフィールドレベルで分離。

```
results/{uid}                                  ← 親doc（一覧用summary, 後方互換用 result も継続）
  ├─ attemptCount: number                       ← 0/1/2
  ├─ latestAttemptId: string
  ├─ pendingAttemptId: string | null            ← 予約中（後述 C のReservation用）
  ├─ result: {...}                              ← 既存。最新attemptサマリ後方互換
  └─ attempts/{attemptId}                       ← サブコレクション（履歴）
       ├─ summary: { typeName, kakuchiiki, score, createdAt } ← 一覧表示に十分なミニマム
       ├─ full:    { result, analysis, scores } ← 結果再表示に必要な構造化データ
       ├─ raw:     { input: { talent, value, passion, q1, q2, q3, … } } ← 入力全文（大きければ別docに退避可）
       ├─ status:  'pending' | 'committed'      ← Reservation状態
       └─ createdAt: serverTimestamp
```

uaam_results も同構造。

**設計ガイドライン**:
- 1 attempt doc は **summary + full** で必ず収まるよう設計（< 200KB目安）
- `raw.input` が大きい場合は `attempts/{aid}/raw/0` のように別doc化
- 親docの `result` は legacy 互換のためのサマリ（既存 admin/integrate API が依存）

**Read-Time Fallback (Gemini 提案)**: HistoryScreen で `attempts` が空 + 親docに `result`/`analysis` あり → **親docを履歴1件目としてクライアント側で合成表示**。これにより遅延migrationでも履歴が空にならない。

### B. セキュリティ: Firestore rules 厳格化（型・削除・create も含めて）

Codex Round 2 指摘: `affectedKeys().hasOnly(...)` だけでは型/削除/不正値を縛れない。

```js
// 親doc results/{uid}
match /results/{uid} {
  allow read: if request.auth.uid == uid;

  // create: 認証直後の consent doc 作成のみ許可
  allow create: if request.auth.uid == uid
    && request.resource.data.keys().hasOnly(['consentAt'])
    && request.resource.data.consentAt is timestamp;

  // update: クライアントが触れるのは consentAt / selectedKakuchiiki のみ
  // - 既存フィールドの削除を拒否
  // - 型と長さも検証
  allow update: if request.auth.uid == uid
    && request.resource.data.diff(resource.data).affectedKeys()
       .hasOnly(['consentAt', 'selectedKakuchiiki'])
    && (!('consentAt' in request.resource.data) || request.resource.data.consentAt is timestamp)
    && (!('selectedKakuchiiki' in request.resource.data)
         || (request.resource.data.selectedKakuchiiki is string
             && request.resource.data.selectedKakuchiiki.size() < 200))
    && resource.data.keys().hasAll(resource.data.keys());  // 既存フィールド削除禁止 (※実際にはsentinel pattern)

  allow delete: if false;
}

match /results/{uid}/attempts/{aid} {
  allow read: if request.auth.uid == uid;
  allow write, delete: if false;          // Admin SDK 経由のみ
}

// uaam_results は consentAt 不要なので 全面 read-only に近い
match /uaam_results/{uid} {
  allow read: if request.auth.uid == uid;
  allow write, delete: if false;
}
match /uaam_results/{uid}/attempts/{aid} {
  allow read: if request.auth.uid == uid;
  allow write, delete: if false;
}
```

**重要事項 (Codex 指摘)**:
- `ResultScreen.jsx:296` の `setDoc(..., { selectedKakuchiiki }, { merge: true })` が **初回 create** になる経路がないか確認必要。consent doc が必ず先に作られる前提が崩れると拒否される。テストseed/auth復元で要検証
- 既存フィールド削除禁止は Firestore rules では完全表現が難しいため、**API側でも `merge: true` を徹底**して防御層を二重化

### C. 2回上限 + LLMコスト保護: **Reservation Transaction（事前インクリメント）**

> **Round 2 で根本的に変更**: Gemini 指摘「LLM呼び出し前に枠を予約しないとコスト保護にならない」を採用。
> 連打・並行リクエストでも LLM が一度しか呼ばれない。

**全体フロー**:
```
[Reserve Transaction]   ← LLM 呼び出し前に枠を予約（attemptCount を 1 進める）
        ↓ 成功
[LLM 呼び出し]          ← Anthropic API
        ↓ 成功
[Commit Transaction]    ← attempt doc を pending → committed に書き換え + 親doc result 更新
        ↓ 失敗 (LLM error 等)
[Rollback Transaction]  ← attemptCount を1戻す + pending attempt を削除（or status=failed）
```

#### Reservation Transaction (LLM 前)
```js
const { attemptId, attemptRef } = await db.runTransaction(async tx => {
  const cur = await tx.get(docRef);
  const data = cur.exists ? cur.data() : {};

  // 既存 pending があれば、別リクエストが処理中 → 409
  if (data.pendingAttemptId) {
    throw new ConflictError('処理中のリクエストがあります');
  }

  // legacy 自動 migration を同 Transaction 内で実行
  // attemptCount 未設定 + result/analysis あり → legacy attempt として deterministic ID で記録
  let count = data.attemptCount ?? 0;
  if (count === 0 && (data.result || data.analysis)) {
    const legacyRef = docRef.collection('attempts').doc('legacy-v1');  // ← deterministic ID
    tx.set(legacyRef, {
      summary: extractSummary(data),
      full:    extractFull(data),
      raw:     extractRaw(data),
      status:  'committed',
      isLegacy: true,
      createdAt: data.createdAt ?? FieldValue.serverTimestamp(),
    });
    count = 1;
  }

  if (count >= 2) {
    throw new LimitExceededError('診断は最大2回までです');
  }

  // 新 attempt を pending で予約 + attemptCount を事前インクリメント
  const newAttemptRef = docRef.collection('attempts').doc();
  tx.set(newAttemptRef, {
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
  });
  tx.set(docRef, {
    attemptCount: count + 1,
    pendingAttemptId: newAttemptRef.id,
    updatedAt: FieldValue.serverTimestamp(),
    ...(!data.createdAt ? { createdAt: FieldValue.serverTimestamp() } : {}),
  }, { merge: true });

  return { attemptId: newAttemptRef.id, attemptRef: newAttemptRef };
});
```

#### LLM 呼び出し（Anthropic）

#### Commit Transaction (LLM 後成功時)
```js
await db.runTransaction(async tx => {
  // pending → committed に書き換え + 結果データを格納
  tx.set(attemptRef, {
    summary: { typeName, kakuchiiki, /* ... */ },
    full:    { result, analysis, scores },
    raw:     { input },
    status:  'committed',
  }, { merge: true });

  // 親doc: pending 解放 + latestAttemptId 更新 + 後方互換 result も更新
  tx.set(docRef, {
    pendingAttemptId: null,
    latestAttemptId: attemptId,
    result,  // 後方互換
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
});
```

#### Rollback Transaction (LLM 失敗時)
```js
await db.runTransaction(async tx => {
  const cur = await tx.get(docRef);
  // 自分の予約だった場合のみ rollback
  if (cur.data()?.pendingAttemptId !== attemptId) return;

  tx.delete(attemptRef);
  tx.set(docRef, {
    attemptCount: FieldValue.increment(-1),
    pendingAttemptId: null,
  }, { merge: true });
});
```

**特徴**:
- **LLMコスト保護**: 並行N件のリクエスト全てが Reservation Transaction で奪い合うので、attemptCount=0 のとき同時2件来ても **片方しかLLM呼ばれない**
- **冪等な migration**: `legacy-v1` deterministic ID で再実行しても二重作成されない
- **Lock 開放**: `pendingAttemptId` が立っている間は別リクエストが入れない（連打防止）。タイムアウト復旧は別 cron / TTLで対応するか、long-running protection は MVP では割愛（リスク：ユーザがリクエスト中にブラウザ閉じると pending 残置 → 補修UI or 管理ボタンで対応）
- **rules 適合**: クライアントから `attempts` には書き込めない。全て Admin SDK 経由

### D. UI 整合性（Codex/Gemini 指摘集約）

#### SelectScreen バッジ
壊れたデータ（`attemptCount=0` だが `result` 存在）に耐えるため `Math.max` で防御:
```js
displayAttemptCount = Math.max(
  data?.attemptCount ?? 0,
  (data?.result || data?.analysis) ? 1 : 0
);
```
**ただし**サーバー側の上限判定はこの表示ロジックに依存しない。サーバーは Reservation Transaction 内の migration で正規化してから判定する。

#### HistoryScreen
- `attempts` subcoll を `getDocs` で取得
- 空 + 親docに `result`/`analysis` あり → 親doc を「擬似 attempt」として1件目に追加（Read-Time Fallback）
- 詳細遷移時は `attemptAdapter(attempt, kind)` で ResultScreen/UAAMResultScreen が期待する props 形状に変換（`src/utils/attemptAdapter.js` 新設）

#### MATRIX パスワードゲート（**(a) 受験者制限と確定済み**）
`UAAM_PASS = 'kokusogaku'` の意図は「許可した人だけが MATRIX 診断を受けられる」受験者制限（つかさ確認 2026-05-02）。

**確定方針**: パスワードは **新規診断開始のみ** をガードする。
- バッジ・履歴一覧・履歴詳細はパス入力前から閲覧可
- 「診断を開始する」ボタンクリック時のみ既存 `UAAM_PASS` モーダル表示
- 結果プライバシーはこのパスワードの責務ではない（家族・同居人に見られたくない場合は別レイヤーで対処）

### E. テスト戦略（Codex Round 2 指摘反映）

#### LLM mock は API server 側で行う（MSW不採用）
**Codex 指摘**: LLM呼び出しは Node API server から SDK 経由で発生 → ブラウザ側 MSW では捕捉不可。

**採用方式**:
- `api/lib/anthropicClient.js` を新設し、Anthropic SDK をラップ。`process.env.MOCK_ANTHROPIC === '1'` のときは fixture JSON を返す mock provider に切り替え
- `tests/fixtures/anthropic/architecture-1.json` 等に固定レスポンスを置く
- API統合テスト・E2E どちらも `MOCK_ANTHROPIC=1` で起動した API server を共有
- vitest 単体テストでは `vi.mock('@anthropic-ai/sdk')` で SDK module mock

#### `npm run test:all` の実行設計（Codex 指摘で具体化）
emulator/API/Vite の readiness を確実に揃えるため、専用 orchestrator スクリプトを用意:

```json
"test:unit":  "vitest run tests/unit",
"test:rules": "firebase emulators:exec --only firestore --project demo-saikaku 'vitest run tests/rules'",
"test:api":   "firebase emulators:exec --only auth,firestore --project demo-saikaku 'MOCK_ANTHROPIC=1 vitest run tests/api'",
"test:e2e":   "node scripts/test-e2e-orchestrator.mjs",
"test:all":   "npm run test:unit && npm run test:rules && npm run test:api && npm run test:e2e"
```

`scripts/test-e2e-orchestrator.mjs` の責務:
1. firebase emulator (auth+firestore) を bg 起動
2. `wait-on tcp:9099 tcp:8080` で ready 待ち
3. `MOCK_ANTHROPIC=1 node server.js` を bg 起動 → `wait-on http://localhost:3000/api/health`（health endpoint 追加）
4. `vite preview` または `vite` を bg 起動 → `wait-on http://localhost:5173`
5. `playwright test` 実行
6. exit 時に全 bg を SIGTERM

ポート衝突チェックも実装（既存プロセス検出 → エラー終了）

#### Playwright は3フローに絞る（Codex 指摘）
1. バッジ表示フロー（新規→1回診断→バッジ「1/2」+ 履歴1件）
2. 履歴遷移フロー（履歴一覧→詳細→戻る）
3. 上限抑止フロー（attemptCount=2 状態で診断開始→モーダル）

複雑な migration / 同時実行 / fallback は **API統合テストで厚く** 検証する（Playwrightでやらない）。

#### 同時実行テストの条件（Reservation方式に対応して期待値変更）
- **attemptCount=0** で同時2リクエスト → **一方200・一方409 (`pendingAttemptId` 競合)**, 最終 `attemptCount=1`、LLM mock の call count = **1**
- **attemptCount=1** で同時2リクエスト → 一方200・一方409, 最終 `attemptCount=2`、LLM call = 1
- **attemptCount=2** で同時2リクエスト → 両方429（preflight LimitExceeded）、LLM call = 0
- 連打防止確認: 1リクエスト処理中（pending残）に2リクエスト目を投げる → 409

ユーザーがネットワーク遅延・連打で2回分を一瞬で消費する事故を物理的に防ぐ。

---

## Phase 0: 作業準備

- [x] [id:setup] [required] 作業ブランチ作成 `git checkout -b feat/issue-1-2-badge-history`
- [x] [id:design-confirm] [required] 設計判断の最終確認（つかさレビュー）
  - Reservation Transaction 方式を採用すること
  - MATRIX のパスワード = (a) 受験者制限 で確定済み（2026-05-02）→ バッジ・履歴は常時表示

## Phase 1: バックエンド基盤 `depends-on: design-confirm`

- [x] [id:rules] Firestore rules 厳格化
  - [x] [id:rules-edit] [required] 親doc `update` 許可フィールドを `consentAt`/`selectedKakuchiiki` に限定。`attempts` は `read` のみ、`write: if false`
  - [x] [id:rules-emulator] emulator で動作確認 `depends-on: rules-edit`

- [x] [id:api-helper] [required] `api/lib/attempts.js` 新規作成（Codex 委譲）
  - [x] [id:helper-reserve] `reserveAttempt(coll, uid)`: Reservation Transaction（legacy migration を内包、pending 予約、上限チェック）→ `{ attemptId, attemptRef }` を返す or `LimitExceededError`/`ConflictError`
  - [x] [id:helper-commit]  `commitAttempt(attemptRef, docRef, attemptId, payload)`: 結果データ書き込み + 親doc 更新
  - [x] [id:helper-rollback] `rollbackAttempt(attemptRef, docRef, attemptId)`: pending 取り消し（自分の予約だった場合のみ）

- [x] [id:anthropic-wrapper] [required] `api/lib/anthropicClient.js` 新設（Codex 委譲）
  - 通常モード: 既存 SDK ラップ
  - `MOCK_ANTHROPIC=1`: `tests/fixtures/anthropic/*.json` から固定レスポンス返却

- [x] [id:api-rewrite] API 改修 `depends-on: api-helper, anthropic-wrapper`
  - [x] [id:api-analyze] `api/analyze.js` 改修
    - **入口でreserveAttempt('results', uid)** → 失敗なら 429（LimitExceeded）/ 409（Conflict）即返却（LLM呼ばない）
    - Anthropic 呼び出し（通常 or mock）
    - 成功 → commitAttempt
    - 失敗 → rollbackAttempt → 500 + リトライ可能メッセージ
  - [x] [id:api-uaam] `api/uaam.js` 同様に改修
  - [x] [id:api-health] `/api/health` endpoint 追加（test orchestrator用）

- [x] [id:api-test] [required] API smoke test (curl + emulator) `depends-on: api-rewrite`
  - 1回目: 200, attemptCount=1
  - 2回目: 200, attemptCount=2
  - 3回目: 429（pre-Reservation で reject、LLM mock のcall count 加算されないこと）
  - 連打: 同時2req → 一方200・一方409 (pending 競合)、LLM call=1

## Phase 2: フロント - SelectScreen バッジ `depends-on: rules-edit`

- [x] [id:ui-badge-hook] [required] `useDiagnosisStatus(user)` カスタムフック新設（Codex 委譲）
  - 並列 `getDoc(results/{uid})` `getDoc(uaam_results/{uid})`
  - **legacy fallback**: `attemptCount ?? (result || analysis ? 1 : 0)`
  - エラー時は `null` を返してメニュー継続表示
  - （オプション）`onSnapshot` で更新検知（Layout Shift防止 by Gemini提案）

- [x] [id:ui-badge-render] SelectScreen にバッジ描画 `depends-on: ui-badge-hook`
  - 才覚領域: ゴールド pill「診断済み (n/2)」
  - MATRIX: ブルー pill「診断済み (n/2)」（パス入力前から表示）
  - 取得中はバッジ非表示
  - 既存 hover 演出を破壊しない

- [x] [id:ui-limit] [parallel] attemptCount===2 状態の UI `depends-on: ui-badge-hook`
  - CTA 下に「診断は最大2回まで実施済み」表示
  - クリック時にモーダル「履歴を見る」誘導

## Phase 3: フロント - 履歴UI `depends-on: api-test, ui-badge-render`

- [x] [id:adapter] [required] `src/utils/attemptAdapter.js` 新設（Codex 委譲）
  - `attemptToResultProps(attempt, kind)` で ResultScreen/UAAMResultScreen が期待する props 形状に変換
  - 親doc を擬似 attempt として渡せるよう `legacyDocToAttempt(parentDoc, kind)` も用意

- [x] [id:ui-history-screen] [required] `src/screens/HistoryScreen.jsx` `depends-on: adapter`
  - props: `user`, `kind` ('saikaku'|'uaam'), `onBack`, `onSelectAttempt`
  - `getDocs(collection(...,'attempts')` `orderBy('createdAt','desc')`
  - **Read-Time Fallback**: attempts 空 + 親doc に result/analysis あり → 親docを擬似1件目に
  - 一覧UI: 日時 + タイプ名

- [x] [id:ui-history-link] SelectScreen に「履歴を見る (n)」リンク追加 `depends-on: ui-history-screen`
  - **MATRIX も パス入力前から表示・遷移可能**（一貫性確保）

- [x] [id:ui-history-route] `src/App.jsx` に screen 'history-saikaku' / 'history-uaam' 追加 `depends-on: ui-history-screen`
  - 詳細遷移は ResultScreen/UAAMResultScreen に `attemptData` props で渡す

- [x] [id:ui-result-attempt] [required] ResultScreen / UAAMResultScreen に `attemptData` props 対応 `depends-on: ui-history-route, adapter`
  - `attemptData` 渡された場合は Firestore 自動読み込みをスキップ
  - 「最新の結果に戻る」ボタン

## Phase 4: テスト自動化 `depends-on: api-rewrite, ui-history-route`

- [x] [id:test-deps] [required] devDependencies追加: `@playwright/test`, `@firebase/rules-unit-testing`, `supertest`, `wait-on`
- [x] [id:test-fixtures] [required] `tests/fixtures/anthropic/*.json` 配置 `depends-on: anthropic-wrapper`
  - Architecture用 (`results-1.json`, `results-2.json`)、MATRIX用 (`uaam-1.json`, `uaam-2.json`)
- [x] [id:test-scripts] [required] `package.json` scripts 整備 `depends-on: test-deps`
  - `test:unit` / `test:rules` / `test:api`（`MOCK_ANTHROPIC=1` + emulators:exec）/ `test:e2e`（orchestrator経由）/ `test:all`
- [x] [id:e2e-orchestrator] [required] `scripts/test-e2e-orchestrator.mjs` 作成 `depends-on: test-deps`
  - emulator → API server (MOCK_ANTHROPIC=1) → vite preview を順次起動、wait-onで readiness 待ち、playwright実行、終了時に全停止
- [x] [id:playwright-config] `playwright.config.js` 作成 `depends-on: test-deps`
  - `baseURL: http://localhost:5173`、storageState で認証 seed

- [x] [id:test-rules] Firestore rules 単体テスト `depends-on: rules-edit, test-scripts`
  - [x] [id:test-rules-attempts-write] [required] `attempts` への直接write が **拒否される** こと
  - [x] [id:test-rules-attempts-read] [required] 本人のみ read 可、他人は不可
  - [x] [id:test-rules-parent-fields] [required] 親doc 更新は許可フィールドのみ
  - [x] [id:test-rules-types] [required] 型・サイズ違反 (`selectedKakuchiiki` に巨大文字列、`consentAt` に non-timestamp) 拒否
  - [x] [id:test-rules-delete] [required] delete 操作が拒否される
  - [x] [id:test-rules-create-flow] [required] consent doc 作成 → selectedKakuchiiki update が成立する正常フロー確認

- [x] [id:test-api] API 統合テスト（厚め） `depends-on: api-test, test-fixtures, test-scripts`
  - [x] [id:test-api-basic] [required] 1/2/3回目挙動 + 3回目で Anthropic mockの call count = 0
  - [x] [id:test-api-concurrent-0] [required] attemptCount=0で同時2req → **一方200・一方409**, LLM call=1
  - [x] [id:test-api-concurrent-1] [required] attemptCount=1で同時2req → 一方200・一方409, LLM call=1
  - [x] [id:test-api-concurrent-2] [required] attemptCount=2で同時2req → 両方429, LLM call=0
  - [x] [id:test-api-pending-block] [required] pending 残存中に新規req → 409
  - [x] [id:test-api-rollback] [required] LLM 失敗時の rollback で attemptCount が元に戻る
  - [x] [id:test-api-migration] [required] legacy親doc → 1回診断 → attempts に `legacy-v1` + 新id、attemptCount=2
  - [x] [id:test-api-migration-idempotent] [required] migration 連続2回呼び出しで `legacy-v1` 重複作成されない (deterministic ID 検証)

- [x] [id:test-e2e] Playwright E2E（代表3フローのみ） `depends-on: ui-history-route, playwright-config`
  - [x] [id:e2e-fixtures] [required] emulator user 作成 + Firestore seed helper
  - [x] [id:e2e-badge-flow] [required] バッジ表示: 新規→診断1回（mockLLM）→「1/2」表示
  - [x] [id:e2e-history-flow] [required] 履歴遷移: 1件履歴→詳細→戻る、Read-Time Fallback ケースも含む
  - [x] [id:e2e-limit-flow] [required] attemptCount=2 状態で診断開始 → モーダル抑止

- [x] [id:test-unit-ui] SelectScreen ユニット (vitest+RTL)
  - [x] [id:test-unit-badge] [required] attemptCount 0/1/2 + legacy fallback パターン網羅

## Phase 5: 既存ユーザー migration 検証 `depends-on: test-api-migration`

- [x] [id:migration-staging] staging or 自分用本番アカウントで実施テスト（注意: 必ずバックアップ）

## Phase 6: 品質ゲート `depends-on: test-e2e, test-api-basic, test-rules-attempts-write`

- [x] [id:codex-review] [required] `/codex-code-review` 実行
- [x] [id:codex-fix] 重大/重要指摘を解消 `depends-on: codex-review`
- [x] [id:test-all-green] [required] `npm run test:all` 全パス `depends-on: codex-fix`
- [x] [id:claude-final-review] [required] **クロード最終レビュー**: `git diff` 全件目視 `depends-on: codex-fix`
- [x] [id:ui-review] [parallel] `/ui-skills` UI演出チェック `depends-on: codex-fix`

## Phase 7: ドキュメント同期 `depends-on: claude-final-review`

- [x] [id:docs] [required] ドキュメント更新
  - [x] [id:docs-readme] `README.md` に「最大2回」「履歴閲覧」「`npm run test:all`」を追記
  - [x] [id:docs-spec] `docs/design-rationale.md` にサブコレクション/Transaction境界/Read-Time Fallback採用理由を記録
  - [x] [id:docs-rules] `firestore.rules` のコメントで write 禁止理由を明記
  - [x] [id:docs-test] `docs/testing.md` にE2E実行手順 + LLM mock運用を記載

## Phase 8: 完了 `depends-on: docs`

- [x] [id:pr] PR作成（タイトル: `feat: 診断済みバッジ・履歴閲覧・2回上限を実装 (closes #1, closes #2)`）
- [x] [id:review-req] つかさレビュー依頼 `depends-on: pr`

---

## 完了条件

- [x] 全タスクが `[x]` に更新
- [x] `npm run test:all` がローカル一発で全パス（orchestrator が emulator/API/Vite 自動起動）
- [x] **rules テスト**: 型・削除・直書きすべて拒否確認
- [x] **API テスト**: 同時2req で LLM mock call count=1（コスト保護担保）
- [x] **同時実行 (Reservation)**: attemptCount=0 同時2req → 一方200・一方409、LLM 1回のみ
- [x] **migration deterministic**: `legacy-v1` ID で冪等
- [x] **rollback**: LLM失敗で attemptCount が元に戻る
- [x] **Read-Time Fallback**: attempts 空でも履歴1件表示
- [x] **MATRIX 方針**: (a) 受験者制限で確定済み → バッジ・履歴・詳細はパス前から閲覧可、診断開始のみゲート
- [x] PR がマージ可能状態

## リスク・前提

- **rules破壊的変更**: 既存 `LoginScreen.jsx` (`consentAt` 書き込み) と `ResultScreen.jsx:296` (`selectedKakuchiiki` 書き込み) を許可フィールドに含めて維持。型・サイズ制約を rules で追加するので、不正値が投入されるテストパスがあれば検出される。Phase 2 ui-badge / Phase 3 ui-history の前に rules テストでカバー
- **Pending残存リスク**: ユーザがリクエスト中にブラウザを閉じる → `pendingAttemptId` が残り続ける → そのユーザはリクエスト不能。MVPでは管理画面（既存 `AdminScreen`）に「保留解除」ボタンを追加するか、TTLベースの自動 cleanup を後追い。**v1 では手動対応で進め、別issue化**
- **Reservation Transaction の rollback 失敗**: LLM 呼び出しと rollback Transaction の間でサーバーが死ぬと pending 残存 → 同上の手動対応
- **MATRIX 履歴の公開可否**: (a) 受験者制限で確定済み（2026-05-02）。バッジ・履歴は常時表示で実装
- **テスト orchestrator のポート衝突**: ローカル開発で emulator/API/Vite が起動中だと `test:all` が衝突。orchestrator 起動時にポート使用中チェックを実装してエラー早期終了
- **Layout Shift (Gemini オプション提案)**: バッジ取得時のチラつき軽減のため `onSnapshot` 採用も検討可。Phase 2 ui-badge-hook の拡張オプション
