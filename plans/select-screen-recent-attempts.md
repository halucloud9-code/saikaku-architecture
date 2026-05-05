## Project: SelectScreen 直近診断結果インライン表示

### 概要
- **目的**: SelectScreen の各カード（才覚領域 / 才覚発動領域 MATRIX）の CTA「診断を開始する」直下に、過去の診断結果を最大2件、クリッカブルなサマリー行として表示する。診断済みでも「やっていない」と錯覚して再度開始するリスクを下げる。
- **スコープ**:
  - `api/me/diagnosis-status.js` に `recentAttempts` フィールド追加（最大2件、id/label/createdAt のみ）
  - `src/screens/SelectScreen.jsx` に CTA 直下の表示を追加
  - `src/App.jsx` で SelectScreen からの遷移ハンドラ配線
  - テスト追加（API unit + E2E snapshot 拡張）
- **スコープ外**: HistoryScreen の既存挙動変更、UAAM の Coming Soon カードのレイアウト変更、CTA ラベル文言変更

---

## 前提確認 (Architecture Sanity Check)

### A. 既存実装との整合性

調査ソース: Explore subagent 報告（5観点で関連実装10ファイルを確認）

| 項目 | 記入欄 |
|---|---|
| 同種の既存ファイル①（API: status系） | `api/me/diagnosis-status.js` (1-67) — 軽量 status のみ返す |
| 同種の既存ファイル②（API: 詳細リスト） | `api/me/history.js` (141-209) — `attemptListItem` で id/status/summary/createdAt/isLegacy/integrationSummary を返す |
| 同種の既存ファイル③（UI: 履歴描画） | `src/screens/HistoryScreen.jsx` (439-587) — `attempt.summary?.kakuchiiki ?? '才覚領域 診断結果'` 等で label 取得、`getAttemptOrdinal` で「N回目」/「保存済み履歴」を切替、クリックで `onSelectAttemptId(id, kind)` |
| 既存パターン（ラベル取得） | `backfillAttemptSummary(attempt, kind)` (api/lib/legacy.js:39-62) を共通利用。saikaku は `summary.kakuchiiki`、uaam は `summary.typeName` を抽出 |
| 既存パターン（遷移） | App.jsx:559 で `navigate('/history/{kind}/{attemptId}')` → HistoryDetailRoute が `/api/me/history/:attemptId?kind=X` を fetch して ResultScreen/UAAMResultScreen に attemptData として渡す |
| 既存パターン（serialize） | API は `serializeTimestamps(...)` (api/lib/serialize.js) で Firestore Timestamp → ISO 文字列に変換。HistoryScreen `formatDate` (HistoryScreen.jsx:25-47) は文字列/`toDate`/`_seconds` の3形式に対応済み |
| 本プランの選択 | (1) `diagnosis-status.js` に `recentAttempts: [{id, label, createdAt}]` を追加。`backfillAttemptSummary` で label 抽出を共通化。(2) SelectScreen の表示は HistoryScreen の `getAttemptOrdinal` / `formatDate` ロジックを再利用（共有モジュール化）。(3) クリック時は既存の `/history/{kind}/{attemptId}` ルートへ navigate |
| 整合 / 逸脱 | **整合** |
| 逸脱の場合の理由 | — |

### B. 前提を疑う代替案

| 項目 | 記入欄 |
|---|---|
| 本プランの前提 | 「`diagnosis-status` API を拡張して、SelectScreen 側で履歴データを表示する」 |
| 代替案① | **SelectScreen からは表示せず、CTA ラベルを動的に変える（A 案ベース）**。count>0 なら「もう一度診断する」へ切替、加えてバッジを大きくする |
| 代替案①の長所 | API 変更不要。実装最小。帯域影響ゼロ |
| 代替案①の棄却理由 | ユーザー要望は「履歴が**近くに**表示される」こと。文言変更だけでは「やった結果」の存在感が出ず、根本解決にならない（SelectScreen のスクリーンショット state-count1 を確認した結果、現状でも右上の「診断済み (1/2)」バッジは目に入りにくい） |
| 代替案② | **新規エンドポイント `/api/me/select-screen-overview` を作る** |
| 代替案②の長所 | `diagnosis-status` の責務を膨らませない |
| 代替案②の棄却理由 | エンドポイント増加でメンテ点が増える。SelectScreen 用途は `diagnosis-status` の派生情報のみで、責務分離するほどの差はない（attempt 2件 × 軽量 fields 5 つ = 数十バイト増程度） |
| 代替案③ | **SelectScreen から `/api/me/history?kind=X` を kind ごとに 2 fetch する** |
| 代替案③の長所 | API 拡張不要、HistoryScreen と同じデータが返る |
| 代替案③の棄却理由 | ログイン直後の SelectScreen で 1→3 fetch に増える（latency 体感悪化）。`/api/me/history` は full attempt list + integrations を返すため帯域も大きい。SelectScreen は 2 件のサマリーで十分 |
| **採用** | **本プラン（diagnosis-status 拡張）** |

### C. 該当しそうなアンチパターン

- **E. Seed Variation Bias**: recentAttempts は committed 限定で返すが、legacy fallback (parent に result/scores/analysis のみで attempts コレクションが空) を含めるか/含めないかを **明示的に決定**する必要あり。本プランでは **含める**（HistoryScreen が `legacyDocToAttempt` で同等処理しているのに合わせて整合性確保）。`isLegacy: true` を返し、UI 側で「保存済み履歴」と表示。テストでも 5 パターン（0件 / 1 件 committed / 2件 committed / legacy のみ / pending あり committed あり）を網羅
- **C. Same-Name Different-Contract**: `recentAttempts[i].label` は SelectScreen / HistoryScreen 両方で「文字列としてそのまま描画される」用途のみ。同名フィールドを別 consumer が別形式で使う risk なし。`createdAt` は ISO 文字列にシリアライズ済み（`serializeTimestamps`）で `Intl.DateTimeFormat` に渡る → consumer 一致

### D. UI レイアウト方針

各カードの構造:
```
[CTA "診断を開始する →"] [履歴を見る (1)]   ← 既存
─────────────────────────────────         ← 既存（薄い区切り）
📋 1回目 · 2026/04/30 14:23                ← 新規（本プラン）
   問いに火を灯す人 →
─────────────────────────────────
📋 2回目 · 2026/05/02 09:15                ← 新規（count=2の場合のみ）
   革新する架け橋 →
```
- count=0 のとき: 表示なし（既存挙動と同じ）
- count=1 のとき: 1 行
- count=2 のとき: 2 行（最新→古い順）
- legacy のみ: 1 行（ordinal 表記は「保存済み履歴」）
- pending あり時も committed の recentAttempts は通常通り表示（pending と committed は共存可能）。pending 自体は recentAttempts に含めない。pending 中であることは既存の「処理中…」表示で示す

クリック → `/history/{kind}/{attemptId}` へ navigate。legacy の場合は `/history/{kind}/legacy-fallback`（`shared/attemptLogic.js:24` の `ATTEMPT_ID_RE` で hyphen 許容、`api/me/history/[id].js:42` で legacy-fallback の特別経路あり、`encodeURIComponent` も影響なし、を grep で確認済み）。

---

## Phase 0: 作業準備

- [x] [id:setup] [required] worktree作成（**必ず別ディレクトリで作業すること**。現在のチェックアウト `/Users/altis/Development/saikaku-architecture` は他の人も見ている。`git checkout -b` でカレントディレクトリのブランチを切り替えるのは禁止）
  ```bash
  ~/.claude/skills/plan-with-debate/scripts/setup-worktree.sh feat/select-screen-recent-attempts main
  # → /Users/altis/Development/saikaku-architecture-feat-select-screen-recent-attempts/ が作成される
  # 以降の作業はそのディレクトリで実行
  ```

## Phase 1: 実装 `depends-on: setup`

> **方針**: コーディングは Codex (GPT-5.5, reasoning=xhigh) に委任。タスクは機能単位で 3 つに統合。

- [ ] [id:impl-1] diagnosis-status API に recentAttempts を追加
  - **Goal**: `GET /api/me/diagnosis-status` のレスポンスの各 kind (saikaku/uaam) に `recentAttempts: [{id, label, createdAt, isLegacy}]` を最大2件、最新順で追加する。pending は含めない。legacy fallback は含める（attempts コレクションが空でも親に result/scores/analysis があれば 1 件として返す）。
  - **Success**:
    - `tests/api/me-diagnosis-status.test.js` に 5 パターン (0件 / 1件 committed / 2件 committed / legacy のみ / pending+committed) を追加して全 pass
    - 既存テストの全 pass を維持（`isStartBlocked` 等の挙動は変えない）
  - **Constraints**:
    - 既存パターン継承: ラベル抽出は `backfillAttemptSummary` (api/lib/legacy.js) を再利用。saikaku は `summary.kakuchiiki ?? null`、uaam は `summary.typeName ?? null` を `label` にマップ
    - createdAt は `serializeTimestamps` 経由で ISO 文字列化（既存 history.js と同じ流儀）
    - 既存 `countCommittedAttempts` の aggregate count 最適化を壊さない。recentAttempts 取得は別 query（`orderBy('createdAt', 'desc').limit(2)` で attempts コレクションから取る）。両 query を `Promise.all` で並列化
    - legacy fallback: 既存の `legacyDocToAttempt(parentData, kind)` (shared/attemptLogic.js) を再利用
  - **Verify**: `pnpm vitest run tests/api/me-diagnosis-status.test.js`
  - **Assignee**: codex (reasoning: xhigh)
  - **Data shape variations**:
    - 新 shape 完全: attempts コレクションに committed × N。`summary.kakuchiiki` / `summary.typeName` が入っている → label にそのまま入る
    - 部分欠損 (legacy のみ): attempts コレクション空、parent doc に `result.kakuchiiki` または `analysis.type_name` のみ → `legacyDocToAttempt` 経由で `id: 'legacy-fallback'`, `isLegacy: true`
    - null 明示: `summary.kakuchiiki: null` の場合 → label: null（UI 側でフォールバック文字列 `才覚領域 診断結果` を当てる、HistoryScreen と同じ流儀）
    - undefined 不在: summary フィールド自体ない場合 → `backfillAttemptSummary` が full から拾う、最終的に null
    - pending あり: pending attempt は recentAttempts に含めない（status=='committed' フィルタ）
    - **共存ケース (committed あり + parent に legacy も残存)**: 既存 `listFromAttempts` (shared/attemptLogic.js:170) と揃える。`attemptDocs` に committed が 1 件以上あれば legacy fallback は合成しない（最大 2 件は subcollection からのみ）。attempts が空のときだけ `legacyDocToAttempt` を 1 件として返す。
      - 補足: 2026-05-05 監査で本番に bare legacy parent が saikaku 52名・uaam 1名残存が判明。本プランでは legacy fallback コードを温存する（削除は別 issue 化、後述）。これらの bare legacy ユーザーは attempts コレクションが空なので、recentAttempts は legacy 1件のみ返す挙動になる

- [ ] [id:impl-2] SelectScreen に履歴サマリー行を追加
  - **Goal**: `useDiagnosisStatus` から取得した `status[kind].recentAttempts` を、各カードの CTA 直下にクリッカブル行として描画する。クリック時は親から渡される `onSelectAttempt(attemptId, kind)` を呼ぶ。
  - **Success**:
    - 各カードで count=0/1/2/legacy/pending+committed の各状態が UI 仕様通り表示される（前提確認 D 参照）
    - 既存の `data-testid="badge-saikaku/uaam"` `history-link-saikaku/uaam` テストID は壊さない
    - 新規 `data-testid="recent-attempt-{kind}-{index}"` を各行に付与（E2E から個別検証可能に）
    - キーボード操作可能（Enter/Space で開く）。HistoryScreen の attempt item と同じ `role="button"` `tabIndex={0}` パターンを踏襲
    - 旧 shape の sessionStorage cache が存在する状態（recentAttempts なし）で SelectScreen をマウントしても crash しない unit test を追加（`tests/unit/useDiagnosisStatus.test.jsx` または新規 `tests/unit/SelectScreen.cache-shape.test.jsx`）
  - **Constraints**:
    - ordinal / formatDate ロジックは HistoryScreen.jsx と二重実装しない。`src/utils/attemptDisplay.js`（新規）に `getAttemptOrdinal`, `getAttemptLabel`, `formatAttemptDate` を切り出して両方から import
    - 色は既存カードのアクセント色（saikaku: `#C4922A`/`#E8C47A` 系、uaam: `#4A6FA5`/`#8FB4E0` 系）を踏襲
    - count=0 のとき表示なし（現状挙動を維持）
    - **キャッシュ shape 防御**: `useDiagnosisStatus` は `sessionStorage` に旧 shape をキャッシュしている (`src/hooks/useDiagnosisStatus.js:10-12` の `isValidStatusShape` は新フィールドを要求しないため、`recentAttempts` 不在の旧 cache が pass する)。SelectScreen 側は **必ず `(status[kind]?.recentAttempts ?? [])` を使う** こと。`undefined.map` で crash させない
    - pending あり時の表示: pending 行自体は描画しない。ただし committed の recentAttempts は通常通り表示する（D 節参照）
  - **Verify**: `pnpm playwright test tests/e2e/select-screen-recent-attempts.spec.js` が全 pass + `pnpm playwright test tests/e2e/issue-47-snapshots.spec.js` の baseline 更新後 pass + 旧 cache shape mismatch unit test が pass（実機確認は不要、E2E に統一）
  - **Assignee**: codex (reasoning: xhigh)
  - **Files**: `src/screens/SelectScreen.jsx` / `src/screens/HistoryScreen.jsx`（共通化 import 切替のみ） / `src/utils/attemptDisplay.js`（新規）

- [ ] [id:impl-3] App.jsx で onSelectAttempt 配線
  - **Goal**: SelectRoute から SelectScreen に `onSelectAttempt={(id, kind) => navigate(\`/history/\${kind}/\${encodeURIComponent(id)}\`)}` を渡す。HistoryRoute の `onSelectAttemptId` と同じ navigate ロジック（コードは同一文字列でコピペで OK、共通化は別タスクで判断）。
  - **Success**:
    - SelectScreen から履歴行をクリック → `/history/{kind}/{attemptId}` に遷移し、HistoryDetailRoute が結果を表示する
    - legacy-fallback id でも遷移できる（HistoryDetailRoute の既存挙動に依存。動かない場合は最小限の修正を impl-3 内で行う）
  - **Constraints**:
    - 既存 SelectRoute の他のハンドラ (`onSelectSaikaku` 等) を変更しない
  - **Verify**: `pnpm playwright test tests/e2e/select-screen-recent-attempts.spec.js` のシナリオ1（count=1 で履歴行クリック → ResultScreen 表示）が pass
  - **Assignee**: codex (reasoning: xhigh)

## Phase 2: 品質ゲート `depends-on: impl-3`

- [ ] [id:quality] 品質検証
  - [ ] [id:codex-review] [required] `/codex-code-review` で動的観点並列レビュー実行（reasoning: high）
  - [ ] [id:codex-fix] 重大/重要な指摘がなくなるまで修正→再実行 `depends-on: codex-review`
    - **Assignee**: codex (reasoning: xhigh)
  - [ ] [id:opus-review] [required] Opus による差分レビュー（設計整合性・横断影響・UX）`depends-on: codex-fix`
    - 特に `recentAttempts` の serialize 経路と HistoryScreen との label/createdAt 表示一致を grep で確認
    - **Assignee**: opus
  - [ ] [id:e2e] [required] **E2E テスト実行** — 全パスまで修正 `depends-on: opus-review`
    - `tests/e2e/issue-47-snapshots.spec.js` の各 state（state-clean/count1/count2/pending/uaam-count1/uaam-count2/uaam-pending）でスクリーンショットが「履歴サマリー行を含む or 含まない」状態に更新されることを確認（`state-pending` は committed の履歴行を含む状態を baseline 化）
    - 新規追加: `tests/e2e/select-screen-recent-attempts.spec.js`。**必須シナリオ 4 件**:
      1. count=1 のユーザー → 履歴行が 1 件表示 → クリック → ResultScreen が attemptData 付きで表示
      2. count=2 のユーザー → 履歴行が 2 件表示（最新→古い順） → 古い方をクリック → 該当 attempt の ResultScreen
      3. **legacyOnly** (parent doc に result/scores/analysis のみ、attempts コレクション空) → 「保存済み履歴」ラベルの 1 行表示 → クリック → ResultScreen が `isLegacy=true` で開く
      4. **HistoryScreen 既存挙動の unchanged 検証** — `attemptDisplay.js` 共通化で HistoryScreen を触るため、リグレッションを e2e で防ぐ。具体: count=1 / count=2 / legacy / pending の各 state で HistoryScreen に遷移し、attempt リストの ordinal（「1回目」「保存済み履歴」等）と日付フォーマットが既存スクショと完全一致することを assert。`screenshots/history-screen-baseline/` 配下に baseline 追加
    - **必須**: 完了報告にコマンド実行結果を貼ること
  - [ ] [id:ui-review] `/ui-skills` 実行 `depends-on: e2e`

## Phase 3: ドキュメント同期 `depends-on: quality`

- [ ] [id:docs] [required] `/sync-docs` でドキュメント更新
  - README.md（必要に応じて）
  - CLAUDE.md（recentAttempts API spec を簡潔に追記）
  - `docs/spec/*.md` 該当箇所

## Phase 4: 完了 `depends-on: docs`

- [ ] [id:pr] PR を作成（feat: SelectScreen の各カード CTA 直下に直近診断結果を表示）
- [ ] [id:review-req] レビュー依頼 `depends-on: pr`

---

## 完了条件

- [ ] 全タスクが `[x]` に更新されている
- [ ] E2E テスト（既存 + 新規）が全パス
- [ ] PR がマージ可能状態
- [ ] 実機で SelectScreen の 5 状態（clean/count1/count2/legacy/pending+committed）が意図通り表示

---

## Round 1 Debate のオープン指摘（ユーザー判断）

### Gemini: `diagnosis-status` API の責務（SRP）

Gemini は本プラン（`diagnosis-status` 拡張）を「ステータスAPIにエンティティリストを混ぜるのは責務違反」と批判し、代替案として:
- (A) 新規エンドポイント `/api/me/select-screen-overview` を作る
- (B) `/api/me/history?limit=2&summaryOnly=true` のクエリパラメータで軽量モードを既存APIに追加

を提案している。

**Opus による事実検証結果**（`debate/plan-debate-20260505-select-recent/round-1-fact-check.md`）:
- Gemini の「performance 劣化」「キャッシュ不整合」の根拠は **誤り** と確認（`legacyDocToAttempt` は object 構築のみ、cache lifecycle は現状と同じ）
- ただし「責務」については idealistic に正しい論点。`pendingAttemptId` 等で既に純粋 count API ではないため**ハード違反ではない**が、recentAttempts は確かに「派生情報」として境界線上
- 本プランのメリット: SelectScreen の fetch が 1 回のまま / 実装簡単 / 既存 useDiagnosisStatus にそのまま乗る
- 代替案 (A)(B) のメリット: 責務分離が綺麗 / 将来 recentAttempts の取得粒度を変えやすい
- 代替案のデメリット: SelectScreen ログイン直後の fetch が 1→3 (saikaku, uaam の 2 件 history fetch + status) または 1→2、レイテンシ体感の悪化

**判断**: 本プランで進める。ただしユーザーが SRP 厳守を優先する場合は代替案 (B)（既存 history API に軽量モード追加）に切り替える余地を残す。Opus が独断で確定せずユーザーに明示的に確認する。

**確定**: 2026-05-05、つかさが「A案で進める」を選択。SRP 違反は許容範囲との判断。

---

## Legacy fallback コード削除について（別 issue 化）

2026-05-05 監査結果（`scripts/_audit-legacy-parents.mjs`）:
- 本番 Firestore の `results` コレクションに bare legacy parent doc が **52件** 残存
- `uaam_results` に bare legacy parent doc が **1件** 残存（uid: `zITjss9JV7RuDXtedfGoA005Kqu2`、たぶんふじこさん）

`b930a70 feat(migrate): patch-attempts mode` で migrate された 14名以外に、saikaku 単独診断ユーザー 52名が patch 対象外で残っている。

**本プランでの扱い**: legacy fallback コードを温存する。本プランは SelectScreen 改善に集中し、legacy 削除は **別 issue で後日対応** する。

**別 issue で必要な作業**（参考）:
1. saikaku 52名 + uaam 1名に対する patch-attempts 再実行（または手動 migrate）
2. 監査スクリプト再実行で bare legacy=0 を確認
3. legacy fallback コード削除（`api/me/history/[id].js:42-46`、`legacyDocToAttempt`、`hasLegacyAttemptData`、`legacyIntegrationFromParent`、HistoryScreen の `isLegacy` 分岐、テストヘルパー）
4. 全 E2E pass 確認
