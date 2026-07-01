## Project: 才覚領域を「実用版」に置き換え（既存フィールド一本化・analyzeのみ Sonnet 4.6）

### 概要
- **目的**: 才覚領域の生成トーンを実用版（才能=動詞／情熱=領域／文末は平易な人名詞／20〜35字）に変える。**新規フィールドは足さず、既存の `kakuchiiki`（メイン）・`kakuchiiki_options`（3候補）の中身を実用版にする**（フィールド名は維持）。モデルは `api/analyze.js` のみ Sonnet 4.6。
- **スコープ**: 今後の新規診断のみ。`api/analyze.js`（モデル＋プロンプト）・`tests/fixtures/anthropic/saikaku-1.json`・`src/screens/ResultScreen.jsx`（文言/ラベルの微調整のみ）。詩的版は新規では生成しない（過去データはそのまま残存）。uaam/integrate は対象外（Sonnet 4 据え置き）。

---

## 前提確認 (Architecture Sanity Check) — 必須

### A. 既存実装との整合性

| 項目 | 記入欄 |
|---|---|
| 同種の既存ファイル | `api/analyze.js`（SYSTEM_PROMPT で kakuchiiki/kakuchiiki_options を掛け算生成 → `result` 丸ごと保存）。消費側: `ResultScreen.jsx:535`(kakuchiiki_options を選択カードで描画)、`:312`(選択を selectedKakuchiiki 保存)、`integrate.js:287-290`(selectedKakuchiiki→統合入力)、`summary.kakuchiiki`(履歴) |
| 既存パターン | kakuchiiki/kakuchiiki_options は「表示・選択・統合・履歴」の全経路で使われる**単一の才覚領域データ**。zod無し・`result` 丸ごと merge・fixture 応答 |
| 本プランの選択 | **新フィールドを足さず、`kakuchiiki`/`kakuchiiki_options` の生成トーンを実用版に変更**。既存の掛け算演算(WHY×HOW×WHAT)は基盤として維持し、最終文言だけ実用版（才能=動詞／情熱=領域／人名詞締め）にする。消費経路(表示/選択/integrate/履歴)は**フィールド名不変なので変更最小**で実用版に移行 |
| 整合 / 逸脱 | **整合**（既存の消費経路をそのまま使う。ロジック変更なし、生成トーンとモデルのみ変更） |
| 逸脱の場合の理由 | — |

### B. 前提を疑う代替案 — 最低 1 案

| 項目 | 記入欄 |
|---|---|
| 本プランの前提 | 「既存 `kakuchiiki`/`kakuchiiki_options` の中身を実用版に上書きする（フィールド一本化）」 |
| 代替案 新フィールド追加 | `kakuchiiki_practical(_options)` を別途足し、詩的版と併存。長所: 詩的版を残せる。**棄却**: つかさ判断（置き換え＋実用版options選択式＋selected/integrateも実用版）により、詩的版は表示・選択・統合のどこでも使われなくなり死蔵。二重管理と「詩的/実用どちらを selected とするか」の responsibility 分離（Codex/Claude独立が指摘）を生む。一本化が一貫かつ変更最小 |
| round-1 debateで解消済み | ① responsibility 分離(Codex#1/Claude独立#2)＝一本化で消滅 ② fallback二重管理＝同一フィールドで過去(詩的)/新規(実用)が自然共存、専用fallback不要 ③ Gemini「zod/型がクラッシュ」＝**棄却**（zod非存在・adapterは`...result`透過・JSリポで型なし、`fact-check.md#6`） |

**未確定の一次確認事項（実装前に必須）**: 「Sonnet 4.6」の正確なAPIモデルID。現行pinは `claude-sonnet-4-20250514`。4.6のIDは `claude-api` スキル/Anthropic公式docsで確認してから使う（**推測でpinしない**。未確認pinは 404 で診断全停止 = Gemini#1）。

---

## Phase 0: 作業準備

- [x] [id:setup] [required] worktree作成
  ```bash
  ~/.claude/skills/plan-with-debate/scripts/setup-worktree.sh feature/practical-kakuchiiki staging
  ```
  （実行時は `staging` ブランチが存在しなかったため `main` をベースに作成）
- [x] [id:modelid] [required] Sonnet 4.6 の正確なモデルIDを一次ソースで確認 `depends-on: setup`
  - **Assignee**: opus（`claude-api` スキルで確認。実装に渡す確定IDを1つ決める）
  - 確定値: `claude-sonnet-4-6`

## Phase 1: 実装 `depends-on: modelid`

- [x] [id:impl-1] `api/analyze.js`: モデル4.6化＋才覚領域の生成トーンを実用版に
  - **Goal**: `api/analyze.js` の `model` を Sonnet 4.6（`[id:modelid]` 確定値）に更新し、`SYSTEM_PROMPT` の `kakuchiiki` / `kakuchiiki_options` 命名ルールを**実用版トーン**に書き換える。方針は `docs/才覚領域_実用版_生成プロンプトv2.md`（才能=動詞／情熱=領域／文末は平易な人名詞／20〜35字／才能TOP5・情熱TOP5を織り込む）。掛け算演算(WHY×HOW×WHAT)は基盤として維持。fixture `saikaku-1.json` の `kakuchiiki`/`kakuchiiki_options` を実用版の例文に更新。
  - **Success**: 新規診断の `kakuchiiki`/`kakuchiiki_options` が実用版トーンになる。`insight`/`what`/`reward`/軸データは従来どおり生成される（**干渉なし**）。テスト緑。
  - **Constraints**: **フィールド名・JSON構造は変えない**（消費側を壊さない）。`insight`/`what`/`reward` の生成指示は変更しない（才覚領域トーン変更が他項目に波及しないこと）。zod等は導入しない。`max_tokens:8192`(`:349`) が実用版options で不足しないか**実生成で1回実測**し、必要なら引き上げ（rules『出力長を増やしたら予算再計算』）。
  - **Verify**: `pnpm test`（analyze系 + adapter）。実機/emulatorで1回生成し、(a)`kakuchiiki`が実用版トーン (b)`insight/what/reward`が壊れていない (c)出力が `max_tokens` 内に収まる、を確認。
  - **Assignee**: codex (reasoning: xhigh)
  - **Files**: `api/analyze.js`, `tests/fixtures/anthropic/saikaku-1.json`

- [x] [id:impl-2] `src/screens/ResultScreen.jsx`: 才覚領域まわりの文言/ラベル調整
  - **Goal**: フィールド名は不変なので**表示ロジックは原則変更なし**。「才覚領域」の見出し・選択カードの説明文（例「3つのパターンから選ぶ」）が詩的版前提の言い回しなら実用版向けに調整。PDFサマリー(`:717-722`)も同様に見た目確認。
  - **Success**: 実用版の kakuchiiki_options が選択カードに表示され選択・PDF・共有が従来どおり動く。過去データ（詩的版）も同じUIで問題なく表示される。
  - **Constraints**: 選択保存(`selectedKakuchiiki`)・`integrate.js` 連携・`attemptAdapter` は触らない（フィールド不変のため不要）。
  - **Verify**: 実データ/E2Eで新規(実用版)・過去(詩的)両方の結果画面とPDFを確認。
  - **Assignee**: codex (reasoning: xhigh)
  - **Files**: `src/screens/ResultScreen.jsx`

## Phase 2: 品質ゲート（ローカル）`depends-on: impl`

- [x] [id:quality] 品質検証
  - [x] [id:codex-review] [required] `/codex-code-review` で動的観点並列レビュー（reasoning: high）
    - Phase1差分自体への重大/重要指摘はゼロ。検出された指摘は全て既存の技術的負債（issue #109 へ切り出し）。レビュースクリプト自体のバグ（analyzeIssues()のNoneパターン誤マッチ）も発見・修正済み
  - [x] [id:codex-fix] 重大/重要指摘がなくなるまで修正→再実行 `depends-on: codex-review`
    - **Assignee**: codex (reasoning: xhigh)
    - Phase1差分への指摘なし（修正対象なし）
  - [x] [id:opus-review] [required] Opusによる差分レビュー（他項目への干渉・消費経路の整合・実用版トーン品質）`depends-on: codex-fix`
    - **Assignee**: opus
  - [x] [id:e2e] [required] **E2Eテスト実行**（emulator-backed、mock単体だけで済ませない）`depends-on: opus-review`
    - 新規診断で実用版 kakuchiiki/options が生成・表示・選択・PDF されること、過去データ(詩的)も表示できることを観測
    - test:api(143件)・unit(84件)・実API1回生成（output_tokens 1813/8192）・Playwright e2e（history-api-flow/history-flow/選択+PDFの一時spec）全パス

## Phase 3: ドキュメント同期 `depends-on: quality`

- [x] [id:docs] [required] `/sync-docs` でドキュメント更新
  - README.md / CLAUDE.md / `docs/spec/*`（才覚領域の生成トーンが実用版に、analyze.jsのモデル4.6化、`docs/才覚領域_実用版_生成プロンプトv2.md` へのリンク）
  - 実際にはこのリポジトリに `CLAUDE.md`/`README.md`/`.docs/spec/`は存在せず（汎用テンプレートとの構成ミスマッチ）、実際の規約（`docs/design-rationale.md` #16 追加、`SETUP.md` のモデル参照更新）で対応

## Phase 4: PR 作成 → Codex bot レビューループ → マージ `depends-on: docs`

- [x] [id:pr] PR を作成（`gh pr create`）— PR #110
- [x] [id:codex-loop] [required] `/codex-review-loop` で Codex bot レビューを回す（👍まで最大3周）`depends-on: pr`
- [ ] [id:merge] つかさがマージ `depends-on: codex-loop`（Opusは自動実行しない）

---

## 完了条件

- [ ] 全タスクが `[x]`（マージのみ未実施、つかさの判断待ち）
- [x] E2E 全パス（新規=実用版の生成/表示/選択/PDF、過去=詩的の表示）
- [x] `insight`/`what`/`reward`/軸・integrate.js に致命的 regression なし
- [x] PR マージ可能状態
