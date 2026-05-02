## Project: issue-36 診断履歴が表示されない問題の修正

### 概要

- **目的**: SelectScreen の「履歴を見る (N)」と HistoryScreen の表示件数が乖離する不具合を解消する。N>0 を表示するときは、Firestore 読み取り成功時に必ず HistoryScreen に1件以上のカードが描画される状態を保証する。pending 残置（issue #33）は UI で可視化＋開始ブロックを正しく行う。
- **スコープ**: フロント (`useDiagnosisStatus` / `HistoryScreen` / `SelectScreen` / `attemptAdapter`) のみ。サーバ (`api/lib/attempts.js`) は本 PR では触らない (debate Round 3 結論: サーバ側 `committedCount` 統合は別 issue で根本対応、本 PR は parent doc 1つから導出する設計で race condition を回避)。
- **関連**: issue #36 (本件), issue #33 (pending 永久残置), PR #27 (履歴機能の実装)
- **担当ロール**: Plan/設計 = Claude、実装 = Codex (assign-codex)、レビュー = Codex code review + 手動 E2E

---

## 設計判断 (debate Round 3 結果反映: 大改訂)

### アーキテクチャ: parent doc 単一購読

debate Round 3 で Gemini から指摘された通り、**parent と attempts の別 onSnapshot は race condition を生む**。本設計は parent doc 1つだけを購読し、必要な情報を全て parent から導出する。

```ts
// status.{kind} の形 (refactor後)
{
  committedCount: number,        // parent から計算: max(attemptCount - hasPending, hasResult ? 1 : 0)
  attemptCount: number,          // 互換維持: committedCount と同値
  hasPending: boolean,           // !!parent.pendingAttemptId
  pendingAttemptId: string|null, // parent.pendingAttemptId
  hasResult: boolean,            // !!(parent.result || parent.scores || parent.analysis)
  isStartBlocked: boolean,       // hasPending || committedCount >= 2
}
```

**committedCount の導出ロジック**:
```js
// サーバ仕様: api/lib/attempts.js:86 reserveAttempt → attemptCount += 1 (pending時に増える)
//             commitAttempt → attemptCount は変更しない
//             rollbackAttempt → attemptCount -= 1
// したがって parent.attemptCount = (committed数) + (pending数)、pending は最大1件
// → committedCount = attemptCount - (hasPending ? 1 : 0)
const rawCommitted = (parentData?.attemptCount ?? 0) - (hasPending ? 1 : 0);
const legacyFloor = (parentData?.result || parentData?.scores || parentData?.analysis) ? 1 : 0;
committedCount = Math.max(rawCommitted, legacyFloor);  // レガシー保護
```

### HistoryScreen は遷移時に getDocs

`onSnapshot` ではなく一発 `getDocs` で十分（履歴は更新頻度低い）。これで:
- Race condition なし (parent は購読、attempts は読み切り)
- SelectScreen のコスト最小（attempts 購読しない）
- 経過時間は attempts/<pendingId>.createdAt で取得 (`updatedAt` 誤用回避)

### SSoT 方針

| 軸 | 採用 | 理由 |
|----|------|------|
| `committedCount` の真実源 | **parent doc から導出** (`attemptCount - hasPending`、レガシー floor 補正あり) | 単一購読で race condition 消滅 (Round 3 Gemini指摘) |
| `hasPending` の真実源 | `parent.pendingAttemptId !== null` | orphan 検出 (Round 1 Codex指摘) |
| 履歴一覧 | HistoryScreen で parent + attempts を `Promise.all` で並列 `getDoc/getDocs` | リアルタイム不要、コスト最小 (Round 3 Gemini指摘)。**注意**: 並列クエリ間に書込みが入る torn state は理論上残存。実用上「画面遷移時の1回のみ」に限定されるため許容 (Round 4 Gemini指摘) |
| 経過時間 | `attempts/<pendingId>.createdAt` (Firestore Timestamp) | parent.updatedAt は別更新で汚染される (Round 3 Gemini指摘) |
| pending 残置の扱い | 開始ブロック維持。UI は時間経過に応じて文言切替 | 自動回復は #33 で別対応 |
| 中長期改善 | サーバ側に `committedCount`/`pendingStartedAt` を atomic 維持 | follow-up issue 化 |

### Legacy synth ロジック

サーバ `api/lib/attempts.js:49-63` で `reserveAttempt` 時に `attempts/legacy-v1` が `status: 'committed'` で実体化される。したがって HistoryScreen の `loadCommittedAttempts` で:

```js
// 純粋関数 listFromAttempts(attemptDocs, parentData, kind)
let committed = attemptDocs.filter(a => a.status === 'committed');
// Round 2 致命バグ防止: synth は attemptDocs が完全に空のときだけ
if (attemptDocs.length === 0) {
  const synth = legacyDocToAttempt(parentData, kind);
  if (synth) committed = [synth];
}
```

`attemptDocs.length === 0` のときだけ synth することで、モダンユーザーの二重カウントを防ぐ。

### 棄却した案

- **案A: parent と attempts を別 onSnapshot 購読** → race condition でフリッカー (Round 3 Gemini指摘)
- **案B: pendingObservedAt = Date.now()** → リロードで0リセット (Round 2 Gemini指摘)
- **案C: parent.updatedAt で経過時間判定** → 別更新で汚染 (Round 3 Gemini指摘)
- **案D: サーバ側 `committedCount` の即時導入** → スコープ超過。フォローアップ issue で対応
- **案E: HistoryScreen を緩めて pending も含める** → リプレイ不能エントリで UX 混乱 (Round 1)

---

## Phase 0: 作業準備

- [x] [id:setup] [required] worktree 作成 + ブランチ
  ```bash
  cd /Users/altis/Development/saikaku-architecture
  git worktree add ../saikaku-issue-36 -b fix/issue-36-history-empty
  cd ../saikaku-issue-36
  npm install
  ```
- [x] [id:setup-issue] 現状の本番データを Firebase コンソールで確認、parent/attempts の状態を `plans/issue-36-evidence.md` にメモ

## Phase 1: 共通ローダー + 純粋関数 `depends-on: setup`

- [x] [id:loader] `src/utils/attemptLoader.js` を新規作成
  - [x] [id:loader-summary] 純粋関数 `summarizeFromParent(parentData)` を export
    - 入力: `parentData` (object|null)
    - 出力: `{ committedCount, hasPending, pendingAttemptId, hasResult, isStartBlocked, attemptCount }`
    - ロジック:
      ```js
      const data = parentData ?? {};
      const hasPending = !!data.pendingAttemptId;
      const hasResult = !!(data.result || data.scores || data.analysis);
      const rawCommitted = (data.attemptCount ?? 0) - (hasPending ? 1 : 0);
      const legacyFloor = hasResult ? 1 : 0;
      const committedCount = Math.max(rawCommitted, legacyFloor);
      const isStartBlocked = hasPending || committedCount >= 2;
      return {
        committedCount,
        attemptCount: committedCount,  // 互換維持
        hasPending,
        pendingAttemptId: data.pendingAttemptId ?? null,
        hasResult,
        isStartBlocked,
      };
      ```
  - [x] [id:loader-list] 純粋関数 `listFromAttempts(attemptDocs, parentData, kind)` を export `depends-on: loader-summary`
    - 入力: `attemptDocs` (Array<{id, ...data}>), `parentData` (object|null), `kind`
    - 出力: `{ committedAttempts: Attempt[], pendingAttempt: Attempt|null }`
    - ロジック:
      ```js
      const committed = attemptDocs.filter(a => a.status === 'committed');
      // createdAt 欠損は末尾、降順ソート
      committed.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? a.createdAt ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? b.createdAt ?? 0;
        return tb - ta;
      });
      let committedAttempts = committed;
      if (attemptDocs.length === 0) {  // ← Round 2 致命バグ防止: 完全空のときだけ
        const synth = legacyDocToAttempt(parentData, kind);
        if (synth) committedAttempts = [synth];
      }
      const pendingAttempt = attemptDocs.find(a =>
        a.status === 'pending' && a.id === parentData?.pendingAttemptId
      ) ?? null;
      return { committedAttempts, pendingAttempt };
      ```
  - [x] [id:loader-load] `loadAttemptDetails({ db, uid, kind })` を export `depends-on: loader-list`
    - parent doc + attempts サブコレクションを並列で `getDoc/getDocs`
    - `listFromAttempts` を通して `{ committedAttempts, pendingAttempt, summary }` を返す
    - **race condition なし**: 一発取得なので中間状態が存在しない

## Phase 2: useDiagnosisStatus を refactor `depends-on: loader-summary`

- [x] [id:hook] `src/hooks/useDiagnosisStatus.js` を更新
  - [x] [id:hook-1] **parent doc 1つだけ** を `onSnapshot` 購読 (現状維持。subcoll は購読しない)
  - [x] [id:hook-2] snapshot 受信時、`summarizeFromParent(snap.data())` を通して `status.{kind}` を更新 `depends-on: hook-1`
  - [x] [id:hook-3] **エラー時の安全側挙動**: 読み取り失敗時は `{ committedCount: 0, hasPending: false, isStartBlocked: true, hasResult: false }` を返す `depends-on: hook-1`

## Phase 3: HistoryScreen を refactor `depends-on: loader-load`

- [x] [id:screen] `src/screens/HistoryScreen.jsx` を更新
  - [x] [id:screen-1] `loadAttemptDetails` を使用するよう書き換え。インライン Firebase コードを削除
  - [x] [id:screen-2] **pending notice ブロック**: `summary.hasPending` (親) と `pendingAttempt` (子) を組み合わせて判定 (Round 4 修正: null クラッシュ防止)
    ```js
    if (summary.hasPending) {
      if (pendingAttempt === null) {
        // Orphan: 親は pending と言うが実体なし
        renderNotice('データ不整合の可能性があるため、サポートまでお問い合わせください。');
      } else {
        const ms = pendingAttempt.createdAt?.toMillis?.() ?? Date.now();
        const longPending = (Date.now() - ms) >= 10 * 60 * 1000;
        renderNotice(longPending
          ? '処理中の診断が長時間完了していません。データ不整合の可能性があるため、サポートまでお問い合わせください。'
          : '処理中の診断があります。完了をお待ちください。');
      }
    }
    ```
    - スタイル: `tokens.soft` 背景 + `tokens.border` 枠
  - [x] [id:screen-3] 「履歴がない」分岐は **`committedAttempts.length === 0 AND summary.hasPending === false`** のときだけ (orphan時は notice を出して「履歴なし」テキストは出さない) `depends-on: screen-2`

## Phase 4: SelectScreen の挙動補強 `depends-on: hook`

- [x] [id:select] `src/screens/SelectScreen.jsx` を最小修正
  - [x] [id:select-1] バッジと履歴リンクの count 表示は `status.{kind}.committedCount` (互換 `attemptCount` 経由で既存呼び出しのまま)
  - [x] [id:select-2] **`renderHistoryArea` の改修**: 早期 return 条件を `count <= 0 && !hasPending` に変更 → pending-only でも履歴エリアが描画される `depends-on: select-1`
  - [x] [id:select-3] `hasPending === true` のときは履歴リンクの隣 (または下) に小さく `処理中…` インジケータを表示 `depends-on: select-2`
  - [x] [id:select-4] **開始ブロック判定**: `isSaikakuLimitReached = status.saikaku.isStartBlocked` に置き換え `depends-on: select-1`
  - [x] [id:select-5] `showLimitAlert` の文言を分岐 `depends-on: select-4`
    - `hasPending`: 「処理中の診断があります。完了をお待ちいただくか、長時間続く場合はサポートまでお問い合わせください。」（**SelectScreen では時間判定しない** — attempts を購読しないため pendingAttempt.createdAt が手元に無い）
    - `committedCount >= 2`: 既存「診断は最大2回まで実施済みです〜」

## Phase 5: テスト `depends-on: select`

- [x] [id:test-unit] [parallel] Vitest 単体テスト
  - [x] [id:test-unit-summary] `tests/unit/attemptLoader.summary.test.js` を新規作成 (`summarizeFromParent` 網羅)
    - (a) parent={} → committedCount=0, hasPending=false, isStartBlocked=false
    - (b) parent={attemptCount:1, pendingAttemptId:null} → committedCount=1, hasPending=false
    - (c) parent={attemptCount:1, pendingAttemptId:'X'} → committedCount=0, hasPending=true, isStartBlocked=true
    - (d) parent={attemptCount:2, pendingAttemptId:null} → committedCount=2, isStartBlocked=true
    - (e) parent={attemptCount:2, pendingAttemptId:'X'} → committedCount=1, hasPending=true, isStartBlocked=true
    - (f) **レガシー floor**: parent={result:{...}}, attemptCount未定義 → committedCount=1 (legacyFloor 適用)
    - (g) **二重カウント防止**: parent={attemptCount:1, result:{...}, pendingAttemptId:null} → committedCount=1 (legacyFloor で +しない)
    - (h) UAAM: parent={scores:{...}, attemptCount:1} → committedCount=1
  - [x] [id:test-unit-list] `tests/unit/attemptLoader.list.test.js` を新規作成 (`listFromAttempts` 網羅) `depends-on: test-unit-summary`
    - (a) attemptDocs=[], parent={result:{...}} → committedAttempts=[synth], pendingAttempt=null
    - (b) **モダン1件 + parent.result**: attemptDocs=[{id:'uuid', status:'committed'}], parent={result:{...}} → committedAttempts=[uuid], **synth されない** (Round 2 致命バグ防止)
    - (c) committed 1 + pending 1: attemptDocs=[{id:'A', status:'committed'},{id:'B', status:'pending'}], parent={pendingAttemptId:'B'} → committedAttempts=[A], pendingAttempt={id:'B'}
    - (d) pending only: attemptDocs=[{id:'B', status:'pending'}], parent={pendingAttemptId:'B'} → committedAttempts=[], pendingAttempt={id:'B'}
    - (e) **orphan**: attemptDocs=[], parent={pendingAttemptId:'X'} → committedAttempts=[], pendingAttempt=null (attempt doc が消えている = orphan)
    - (f) `createdAt` 欠損 → 末尾配置で落ちない
    - (g) UAAM 側 legacy synth (parent={scores, analysis}, attempts空)
- [x] [id:test-rules] [parallel] `tests/rules/` への影響確認
- [x] [id:test-e2e] Playwright E2E `depends-on: test-unit-list`
  - [x] [id:test-e2e-helper] `tests/e2e/_helpers.js` に `pendingAttempt(createdAtOffsetMs)` ヘルパ追加
  - [x] [id:test-e2e-1] `tests/e2e/history-flow.spec.js` を拡張: pending 残置シナリオで notice 表示と「(N) のまま」の検証 `depends-on: test-e2e-helper`
  - [x] [id:test-e2e-2] 新規 `tests/e2e/pending-block-ui.spec.js`: pending 残置で開始ブロック alert 表示 `depends-on: test-e2e-helper`
  - [x] [id:test-e2e-3] 新規 `tests/e2e/modern-user-no-double-count.spec.js`: 1件診断後に SelectScreen が `(1)` 表示、診断ボタン押下可能 (Round 2 致命バグ回帰防止) `depends-on: test-e2e-helper`

## Phase 6: 品質ゲート `depends-on: test-e2e`

- [x] [id:codex-review] [required] `/codex-code-review` で動的観点並列レビュー
  - 結果: APPROVE_WITH_COMMENTS、ブロッカーなし。MEDIUM 級指摘 (C3: エラー時 SelectScreen 挙動テスト追加 / C4: getPendingNotice 純関数化) はテスト網羅性のため follow-up issue 化。
- [x] [id:codex-fix] 重大/重要指摘がなくなるまで修正→再実行 `depends-on: codex-review`
  - 重大/重要指摘なしのため不要。LOW/MEDIUM 軽微指摘は follow-up issue へ。
- [x] [id:vitest] `npm run test:unit && npm run test:rules` 全 pass `depends-on: codex-fix`
  - test:unit: 4 files / 26 tests passed。test:rules: 6 files / 20 tests passed。
- [x] [id:e2e] `npm run test:e2e` 全 pass `depends-on: vitest`
  - 6 specs passed (badge / history×2 / limit / modern-user-no-double-count / pending-block-ui)。

## Phase 7: 実機検証 `depends-on: e2e`

> Playwright E2E が Case 1, 2, 4, 5 を自動検証済み。Case 3 (legacy) は unit test (summary.test.js f, list.test.js a) でカバー。Case 6 (リロード耐性) のみ対面検証推奨。

- [x] [id:smoke] ローカルで `npm run dev:local` 起動 (emu + api + web 同時) — E2E orchestrator が同等の起動を実施し pass
- [x] [id:smoke-1] 1回診断完了 → SelectScreen で「履歴を見る (1)」(Case 1) `depends-on: smoke` — `tests/e2e/history-flow.spec.js` でカバー
- [x] [id:smoke-2] HistoryScreen で1件カード表示、クリックで ResultScreen 表示 — `history-flow.spec.js` でカバー
- [x] [id:smoke-3] **Case 5 (Round 2致命バグ回帰防止)**: 1回診断後にカード再クリック → ブロックされず2回目に進める — `tests/e2e/modern-user-no-double-count.spec.js` でカバー
- [x] [id:smoke-4] **Case 2 (pending 残置)**: emulator で `parent.pendingAttemptId='X', attempts/X={status:'pending', createdAt: <11分前>}` をセット → SelectScreen に「処理中…」表示、カードクリックで alert ブロック — `tests/e2e/pending-block-ui.spec.js` でカバー
- [x] [id:smoke-5] **Case 4 (orphan)**: emulator で `parent.pendingAttemptId='Y', attempts/Y は作らない` → SelectScreen で「処理中…」、HistoryScreen で「データ不整合〜」notice — `tests/e2e/history-flow.spec.js` の pending residue scenario でカバー
- [x] [id:smoke-6] **Case 3 (legacy)**: emulator で `parent={result:{...}}, attempts なし` → SelectScreen で `(1)`, HistoryScreen で legacy カード — unit test `attemptLoader.summary.test.js (f)` + `attemptLoader.list.test.js (a)` で純関数レベルカバー
- [ ] [id:smoke-7] **Case 6 (リロード耐性)**: pending 残置でブラウザリロード → 表示一貫性 — **対面検証推奨**（つかさによる目視確認待ち）

## Phase 8: ドキュメント同期 `depends-on: smoke-7`

> ⚠️ 必須: sync-docs は変更の大小に関わらず必ず実行する。

- [x] [id:docs] [required] `/sync-docs` 実行
  - `docs/design-rationale.md` に「6. 履歴整合性: parent doc 単一購読 + 純関数導出 (issue #36)」セクションを追加（parent doc 単一購読、二重カウント防止、`attempts/<pendingId>.createdAt` 基準、fail-closed エラーハンドリング、follow-up リスト）
- [x] [id:create-followup-issue] サーバ側 SSoT 統合 issue を新規作成（#37 として作成済み）

## Phase 9: 完了 `depends-on: docs`

- [x] [id:pr] PR を作成（base=main, head=fix/issue-36-history-empty）
  - PR #38 を作成: https://github.com/halucloud9-code/saikaku-architecture/pull/38
  - タイトル: `fix: 診断履歴のカウントと表示の不整合を解消 (#36)`
- [ ] [id:review-req] レビュー依頼 + Codex 最終レビュー `depends-on: pr`
  - PR レビュー依頼はつかさが実施 / Codex 最終レビューは Phase 6 で APPROVE_WITH_COMMENTS 取得済み

---

## Codex に投げる差分指示（assign-codex 用テンプレート）

`assign-codex` 起動時のプロンプト雛形:

```
リポジトリ: /Users/altis/Development/saikaku-issue-36 (worktree, branch=fix/issue-36-history-empty)
プランファイル: plans/issue-36-history-empty-fix.md (このファイル)

ゴール: issue #36 のフロント不整合を修正する。サーバ (api/lib/attempts.js) は触らない。

【重要な設計】
- SelectScreen が見る status は parent doc 1つだけから導出する (race condition 回避)
- HistoryScreen は遷移時に parent doc + attempts subcoll を一発 getDocs で取得
- legacy synth は attemptDocs.length === 0 のときのみ (モダンユーザー二重カウント防止)
- 経過時間は attempts/<pendingId>.createdAt 基準 (parent.updatedAt は使わない)

実装手順 (この順で):

1. src/utils/attemptLoader.js を新規作成
   - export summarizeFromParent(parentData) [純粋関数]
     * committedCount = max(parentData.attemptCount - (hasPending?1:0), hasResult?1:0)
     * hasPending = !!parentData.pendingAttemptId
     * isStartBlocked = hasPending || committedCount >= 2
     * attemptCount = committedCount で互換維持
   - export listFromAttempts(attemptDocs, parentData, kind) [純粋関数]
     * committed = attemptDocs.filter(status==='committed') を createdAt 降順ソート (欠損は末尾)
     * **legacy synth は attemptDocs.length === 0 のときだけ (Round 2 致命バグ防止)**
     * pendingAttempt = attemptDocs.find(status==='pending' && id===parent.pendingAttemptId)
   - export loadAttemptDetails({ db, uid, kind }) → Promise<{committedAttempts, pendingAttempt, summary}>
     * parent doc + attempts subcoll を Promise.all で並列取得
     * listFromAttempts と summarizeFromParent に通して結果を返す

2. src/hooks/useDiagnosisStatus.js を refactor
   - **parent doc 1つだけ onSnapshot 購読 (現状維持、subcoll は購読しない)**
   - snapshot 受信時に summarizeFromParent(snap.data()) で status.{kind} を更新
   - エラー時は { committedCount: 0, hasPending: false, isStartBlocked: true, hasResult: false } (安全側)

3. src/screens/HistoryScreen.jsx を refactor
   - loadAttemptDetails を使う
   - pending notice ブロック実装 (**summary.hasPending を一次判定、null クラッシュ防止**):
     ```js
     if (summary.hasPending) {
       if (pendingAttempt === null) {
         // Orphan: 親は pending と言うが実体なし
         renderNotice('データ不整合の可能性があるため、サポートまでお問い合わせください。');
       } else {
         const ms = pendingAttempt.createdAt?.toMillis?.() ?? Date.now();
         const longPending = (Date.now() - ms) >= 10 * 60 * 1000;
         renderNotice(longPending
           ? '処理中の診断が長時間完了していません。データ不整合の可能性があるため、サポートまでお問い合わせください。'
           : '処理中の診断があります。完了をお待ちください。');
       }
     }
     ```
   - 「履歴がない」は committedAttempts.length === 0 AND summary.hasPending === false の時だけ

4. src/screens/SelectScreen.jsx を最小修正
   - renderHistoryArea の早期 return を `count <= 0 && !hasPending` に変更
   - hasPending 時に「処理中…」インジケータ表示
   - isSaikakuLimitReached / isUaamLimitReached を status.{kind}.isStartBlocked に置き換え
   - showLimitAlert の文言:
     * hasPending: 「処理中の診断があります。完了をお待ちいただくか、長時間続く場合はサポートまでお問い合わせください。」 (SelectScreen では時間判定しない、attempts 購読しないため)
     * committedCount >= 2: 既存「診断は最大2回まで実施済みです〜」

5. tests/unit/attemptLoader.summary.test.js 新規 (8ケース、特に (f)(g) のレガシー floor & 二重カウント防止)
6. tests/unit/attemptLoader.list.test.js 新規 (7ケース、特に (b) モダンユーザー synth 防止)
7. tests/e2e/_helpers.js に pendingAttempt(createdAtOffsetMs) ヘルパ追加
8. tests/e2e/history-flow.spec.js 拡張 (pending 残置シナリオ)
9. tests/e2e/pending-block-ui.spec.js 新規 (pending で開始ブロック)
10. tests/e2e/modern-user-no-double-count.spec.js 新規 (Round 2 致命バグ回帰防止)

制約:
- 既存の testid (badge-saikaku, badge-uaam, history-link-saikaku, history-link-uaam, history-item, card-saikaku, card-uaam) を変更しない
- api/lib/attempts.js には触らない (issue #33 で別対応)
- 既存の Vitest / E2E が通り続けること
- TypeScript ではなく既存の JSX/JS スタイル踏襲

完了条件:
- npm run test:unit pass
- npm run test:rules pass
- npm run test:e2e pass
- 実機 (Phase 7 smoke-1〜smoke-7) で全 pass

差分は論理単位で分けて push (loader / hook / screen / select / test-unit / test-e2e の6コミット程度)。
```

---

## 実機検証手順 (manual smoke)

### Setup
```bash
cd /Users/altis/Development/saikaku-issue-36
npm install
cp .env.example .env.local
npm run dev:local
```

### Case 1: committed のみ
1. テストアカウントでログイン → 才覚領域診断を1回完了
2. SelectScreen で「履歴を見る (1)」表示
3. クリック → HistoryScreen に1件カード表示

### Case 2: pending 残置 (issue #33 シナリオ)
1. Firebase emulator UI で `results/{uid}` に `{attemptCount: 2, pendingAttemptId: 'fake-pending'}` をセット
2. `results/{uid}/attempts/fake-pending` を `{status: 'pending', createdAt: <11分前>}` で作成
3. SelectScreen → 履歴リンク隣に「処理中…」、カードクリックで alert
4. 履歴リンク → HistoryScreen で「データ不整合の可能性があるため〜」notice

### Case 3: legacy fallback
1. Firebase emulator で `results/{uid}` に `{result: {kakuchiiki: '問いに火を灯す人'}}` のみ (attemptCount 未定義)
2. SelectScreen で「履歴を見る (1)」(legacyFloor 適用)
3. クリック → HistoryScreen に「保存済み履歴」カード1件 (synth)

### Case 4: orphan parent pending
1. Firebase emulator で `results/{uid}` に `{attemptCount: 1, pendingAttemptId: 'orphan-id'}` をセット
2. **`attempts/orphan-id` は作らない**
3. SelectScreen で「処理中…」、カードクリックで alert
4. 履歴リンク → HistoryScreen で「データ不整合〜」notice (時間表示なし)

### Case 5: モダンユーザー二重カウント回帰防止 (Round 2 Gemini致命指摘)
1. 新規アカウント作成、診断1回完了 (attempts/<UUID> 1件 + parent.result 最新, attemptCount=1)
2. SelectScreen で「履歴を見る (1)」← `(2)` ではないこと
3. もう1回診断ボタン押下可能 (ブロックされない)
4. HistoryScreen に1件だけ (2件ではない)

### Case 6: pending リロード耐性 (Round 2 Gemini指摘)
1. pending 残置状態でブラウザをリロード
2. SelectScreen の「処理中…」表示は維持
3. HistoryScreen の経過時間表示が `attempts/<pendingId>.createdAt` ベースで一貫 (リロード前後で文言一致)

---

## リスクと前提

| リスク | 影響 | 対策 |
|--------|------|------|
| race condition (parent と attempts の別 snapshot) | **大幅軽減**: SelectScreen は parent 1つだけ購読。HistoryScreen の `Promise.all` は理論上 torn state あるが、画面遷移時の1回のみで実用上許容 (Round 3/4 Gemini指摘) | △ |
| **orphan 判定の null クラッシュ** | **解消済み**: `summary.hasPending` を一次判定、`pendingAttempt === null` 分岐で notice (Round 4 Gemini指摘) | ✅ |
| pending リロード時の時計リセット | **解消済み**: `attempts/<pendingId>.createdAt` 基準 (Round 2/3 Gemini指摘) | ✅ |
| `parent.updatedAt` 汚染 | **解消済み**: updatedAt は使わない、`attempts/<pendingId>.createdAt` 基準 (Round 3 Gemini指摘) | ✅ |
| モダンユーザー二重カウント | **解消済み**: synth 条件を `attemptDocs.length === 0` に厳格化 (Round 2 Gemini致命指摘) | ✅ Case 5/test (b) で回帰防止 |
| SelectScreen での attempts 購読コスト | **解消済み**: parent 1つだけ購読 (Round 3 Gemini指摘) | ✅ |
| サーバ・クライアント SSoT 分断 | 真の解決はサーバ側 committedCount 統合 | follow-up issue で根本対応 |
| issue #33 (pending 永久残置の自動回復) | UI で開始ブロック表示するが、ユーザー自力回復は不可 | 文言で正直にサポート連絡を促す。自動回復は #33 で別対応 |

## 完了条件

- [ ] 全タスクが `[x]` に更新されている
- [ ] Vitest / Playwright E2E 全 pass
- [ ] 「履歴を見る (N)」と HistoryScreen の表示件数が常に一致 (Case 1〜6 で確認)
- [ ] モダンユーザー1回診断後にブロックされない (Case 5)
- [ ] pending 残置時に診断開始がブロックされる (Case 2/4)
- [ ] PR がマージ可能状態
- [ ] follow-up issue (サーバ側 SSoT 統合) が作成済み
