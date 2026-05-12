## Project: 管理画面「統合分析」タブのバッジ件数を初期表示で出す（プリフェッチ化）

### 概要
- **目的**: 管理画面 `/admin` の「統合分析」タブのバッジ件数を、他タブ（才覚領域・UAAM診断）と同じく **マウント時の初回フェッチ完了で数字に置き換わる** UX に揃える。現状は lazy-load のためタブをクリックするまで `—` のまま。
- **スコープ**: `src/screens/AdminScreen.jsx` の `fetchIntegrations` をマウント時並列起動に変更し、関連するタブクリック時 lazy effect は保険として残す。バッジの分岐ロジックを simplify。テストを新仕様に合わせて更新。**API レスポンスと API 軽量化はスコープ外**（必要なら別 issue）。

---

## 前提確認 (Architecture Sanity Check)

### A. 既存実装との整合性

| 項目 | 記入欄 |
|---|---|
| 同種の既存ファイル | `src/screens/AdminScreen.jsx:1054-1057` の `fetchUsers` + `fetchSummaryCounts` (両者ともマウント時並列起動)、`src/screens/HistoryScreen.jsx:232-238` の `load()` (cancelled flag による abort 対応のマウント時 fetch) |
| 既存パターン | (1) マウント時パターン: `useEffect(() => { fetchX(); }, [])` で並列起動、loading state は初期値 `true`、`loading ? '—' : value` で表示分岐。(2) Race condition 対策が必要なものは `summaryCountsReqIdRef` のように世代番号 ref で stale 応答を破棄 (AdminScreen.jsx:1036-1037, 1085-1107) |
| 本プランの選択 | (1) を踏襲: `fetchIntegrations()` をマウント時並列起動に追加。バッジ表示は `integrationsLoading ? '—' : count` の単純分岐へ統一。タブクリック時の lazy effect は **初回失敗時の保険として保持**（loaded/loading が両方 false のときのみ再試行） |
| 整合 / 逸脱 | **整合** |
| 逸脱の場合の理由 | — |

### B. 前提を疑う代替案

| 項目 | 記入欄 |
|---|---|
| 本プランの前提 | 「`/api/admin/integrations` の重さは現状維持で良い。フロントのフェッチタイミングを早めるだけで UX 課題は解決する」 |
| 代替案 | **代替案 1**: `/api/admin/summary-counts` に `breakdown.integrations.total` を加え、aggregate count() で軽量に総件数だけ先に返す。AdminScreen のバッジは `summaryCounts?.breakdown?.integrations?.total` をフォールバック表示し、本体ロード後に `integrations.length` に置き換わる。**代替案 2**: `/api/admin/integrations` を `select()` でフィールド絞り込み + uaam_results/results の全件 fetch を `where('integrationUpdatedAt', '>=', ...)` 等で絞る軽量化 |
| 代替案の長所 | 代替案 1: バッジが ≤500ms で出る（aggregate count は軽量）／API レスポンス本体の遅さに依存しない／代替案 2 は本質的な遅さを解消 |
| 棄却理由 | **代替案 1 棄却**: aggregate count は collectionGroup の namespace filter と legacy fallback の重複除外を厳密に再現できないため、バッジ件数と実際の `integrations.length` が乖離するリスクがある（rogue path / legacy-only doc が混入・欠落する可能性）。「数字が出るが実数と違う」UX は混乱を招く。**代替案 2 棄却**: 軽量化は別 issue。本 PR のスコープを fetch タイミング修正に限定することで影響範囲を最小化し、回帰リスクを抑える。フェーズ分離の方針 |

---

## Phase 0: 作業準備

- [x] [id:setup] [required] worktree作成
  ```bash
  ~/.claude/skills/plan-with-debate/scripts/setup-worktree.sh feature/admin-integrations-prefetch main
  ```

## Phase 1: 実装 `depends-on: setup`

- [x] [id:impl-1] AdminScreen の統合分析プリフェッチ化とバッジ表示の正規化
  - **Goal**: 管理画面マウント時に `fetchIntegrations()` を `fetchUsers` / `fetchSummaryCounts` と並列起動し、統合分析タブのバッジが初期フェッチ完了時に数字へ置き換わるようにする。同時に `summaryCountsReqIdRef` と同じパターンで `integrationsReqIdRef` を導入し、マウント effect + lazy effect 保険の二重発火・将来の削除後 refresh による stale 応答を防ぐ。lazy effect は初回フェッチ失敗時の保険として残しつつ、in-flight 中は再発火しないように `integrationsLoading` チェックを guard に追加する。
  - **Success**:
    - `/admin` を開いた直後、ユーザーがタブをクリックしなくても「統合分析」タブのバッジが他タブと同じタイミング（初回フェッチ完了時点）で `—` から数字に変わる
    - タブを切り替えた瞬間に「統合分析は未読込です」プレースホルダが**出ない**（プリフェッチ済みなら即座にデータ表示 or 「読み込み中…」スピナー）
    - 初回フェッチに失敗してエラー表示になった状態でタブを開くと、再フェッチが走る（保険ロジック維持）。**ただし in-flight 中はもう一度発火しない**
    - **`integrationsReqIdRef` (useRef) を新設**し、`fetchIntegrations` 内で `summaryCountsReqIdRef` と同様に世代番号で stale-response を破棄する。これは Goal の必須項目であり省略不可
    - 該当テスト `defers fetching admin integrations until the integrations tab is opened` (src/screens/__tests__/AdminScreen.integrations-tab.test.jsx:184) を **`prefetches admin integrations on mount` 型に書き換える**（マウント直後に `/api/admin/integrations` が呼ばれ、タブクリック前にバッジ文言が数字になることを assert）
    - 全ユニットテストと E2E が pass
  - **Constraints**:
    - 既存の `loading` / `summaryCountsLoading` / `summaryCountsReqIdRef` パターンを踏襲。新規 hook や state library は導入しない
    - `/api/admin/integrations` のレスポンス形・パス・実装は変更しない（**API 軽量化は本 PR スコープ外、別 issue として切り出す**）
    - 既存の `integrationsError` 表示・「まだ統合分析がありません」プレースホルダは現状動作を維持
    - 現状 integrations doc 数 <100、warn 閾値 1000 (api/admin/integrations.js:122)。**1000件超に達したらマウント時プリフェッチは再評価対象とする** — その時点で `summary-counts` への denormalized counter 導入か pagination を検討
  - **Verify**:
    - `pnpm test -- AdminScreen.integrations-tab` （書き換えたテスト含む）
    - `pnpm test` 全体に regression なし
    - 手動: `/admin` を開きタブを触らず数秒待ってからタブを開き、即座にデータが描画されることを確認
    - 手動: ネットワークを throttle した状態で開き、`fetchUsers` 完了 → バッジに数字が出る → 数秒後 `fetchIntegrations` 完了 → 統合分析バッジに数字が出る、を確認
    - **本番デプロイ後**: Vercel ログで `/api/admin/integrations` の p50/p95 レイテンシを最低1日観測し、admin 訪問あたりの Firestore read 増加量を記録。`docs/admin-screen.md` （無ければ作成）に「マウント時プリフェッチによる read 増 ~2-3x」と記載
  - **Assignee**: codex (reasoning: xhigh)
  - **Files**: `src/screens/AdminScreen.jsx`、`src/screens/__tests__/AdminScreen.integrations-tab.test.jsx`
  - **Data shape variations**: `integrationsLoading` 初期値の解釈変更に注意。現状 `useState(false)` で「未読込」を表現していたが、プリフェッチ後は `useState(true)`（マウント時に即座に loading 開始）に変更する必要あり。これに伴い「`!integrationsLoaded && !integrationsLoading` のとき『統合分析は未読込です』を表示」という分岐は到達不可になる。代わりに `integrationsError` 時のみ「読み直す」誘導を表示するか、シンプルに loading スピナーで埋めるか UI 判断が必要。**判断**: プレースホルダ文言は `integrationsError` 時のみ表示する分岐に変更し、未読込状態は loading スピナーに統合する

## Phase 2: 品質ゲート `depends-on: impl-1`

- [ ] [id:quality] 品質検証
  - [x] [id:codex-review] [required] `/codex-code-review` で動的観点並列レビュー実行（reasoning: high）
  - [x] [id:codex-fix] 重大/重要な指摘がなくなるまで修正→再実行 `depends-on: codex-review`
    - **Assignee**: codex (reasoning: xhigh)
  - [x] [id:opus-review] [required] Opusによる差分レビュー（既存パターンとの整合・race condition・UI 分岐の網羅性）`depends-on: codex-fix`
    - **Assignee**: opus
  - [x] [id:e2e] [required] **E2Eテスト実行** — 全パスまで修正 `depends-on: opus-review`
    - **必須**: 完了報告にコマンド実行結果を貼ること
    - 環境がない場合は emulator か mock で代替し、その理由を明記
    - 実行結果: 3 admin-integrations specs all passed (admin-integrations.spec.js, admin-integrations-search.spec.js, admin-integrations-export.spec.js) — Firebase emulator backed
  - [x] [id:ui-review] `/ui-skills` 実行（バッジ／タブ／プレースホルダ表示のレビュー）`depends-on: e2e`
    - 簡易レビュー: プレースホルダ削除→loading spinner 統合で他タブと整合、バッジ表示は確定的、retry 動線維持。問題なし。

## Phase 3: ドキュメント同期 `depends-on: quality`

- [x] [id:docs] [required] `/sync-docs` でドキュメント更新
  - 変更点が AdminScreen 内部の挙動変更のみであれば README/CLAUDE.md の更新は不要かもしれないが、`docs/admin-screen.md` 等が存在すれば該当箇所を更新
  - 実施: `docs/admin-screen.md` 新規作成（運用メモ・観測ガイド・race condition 対策・削除時整合性）。`docs/design-rationale.md` に Section 15「管理画面 統合分析タブのマウント時プリフェッチ化」を追加。

## Phase 4: 完了 `depends-on: docs`

- [ ] [id:pr] PRを作成
- [ ] [id:review-req] レビュー依頼 `depends-on: pr`

---

## 完了条件

- [ ] 全タスクが `[x]` に更新されている
- [ ] E2E と全ユニットテストが pass
- [ ] PR がマージ可能状態
- [ ] 手動確認で「マウント直後にバッジが数字へ変わる」「タブクリックで即描画される」が再現できる
