## Project: 統合分析 per-pair subcollection 移行 (issue #44/#45/#46 root fix)

### 概要

- **目的**: `/api/integrate` の保存先を `uaam_results/{uid}/integrations/{pairKey}` に分離し、UAAM の analysis 配下の `saikaku_integration` (LLM mini integration) との名前空間衝突を構造的に解消する
- **背景**: PR #51 (Phase 0 hotfix) は emulator-backed E2E (`tests/api/firestore-merge-debug.test.js`) で **firebase-admin v12.7.0 の挙動を実機検証した結果、計画前提が誤っていた**ため draft 化済み:
  - `set({a: {b: v}}, {merge: true})` は **deep merge する**（Plan の「nested map 全置換」前提と逆）
  - `set({'a.b': v}, {merge: true})` は **dotted-key を literal top-level field として扱う**（field-path にならない）
  - `update({'a.b': v})` だけが dotted-key を field path として nested に書ける
- **真の原因**: `/api/integrate` (set with dotted key) は **literal top-level key `"analysis.saikaku_integration"`** に書いており、そもそも nested に届いていない。UI が読む `analysis.saikaku_integration` (nested) は UAAM プロンプトが LLM に毎回生成させている mini integration で、commit のたびに上書きされる
- **スコープ**: per-pair subcollection への保存先分離 + 読み取り API 切替 + マイグレーション + UI 出典/再生成対応
- **スコープ外**:
  - UAAM プロンプトから `saikaku_integration` を削除する cleanup → **#54** で別途対応
  - `reserveAttempt`/`rollbackAttempt` の既存コード負債 → **#52** で別途対応
  - Phase 1 MVP 履歴バッジ (#45) → 本 PR でクロス kind 表示は対応済みになるため、別 issue に再整理予定（本プラン完了後）
- **担当**: Plan = Opus、実装 = Codex (xhigh)、レビュー = codex-code-review + Opus、E2E = Opus（emulator-backed）

### 既知の事実（実装調査ベース）

- **firebase-admin v12.7.0 挙動** (`tests/api/firestore-merge-debug.test.js` で確証):
  - `set({a: {b: v}}, {merge:true})` → deep merge
  - `set({'a.b': v}, {merge:true})` → literal top-level field
  - `update({'a.b': v})` → field path として nested
- **本物 `api/integrate.js`** (Vercel route, line 207-214): `set({'analysis.saikaku_integration': v}, {merge:true})` で literal top-level に書いている。production の Firestore document には**ドット入り名前のトップレベルキー**として保存されているはず（実機未確認、本プラン Phase 0 で audit 必須）
- **UAAM の `analysis.saikaku_integration`**: `api/uaam.js:327-331` でプロンプト経由 LLM が毎回生成。commitAttempt の `parentMerge.analysis` に含まれて nested で書かれる
- **既存 subcollection パターン**: `attempts`, `_locks` のみ。新規 `integrations` も同パターン (rules で全面 deny + Admin SDK 経由のみ) で構築可能
- **既存マイグレーション**: dry-run パターン未実装。`scripts/audit-saikaku-integration.mjs` が dotenv 認証パターンの先例
- **rules pattern**: `match /uaam_results/{uid}/{collection}/{docId}` で `allow read, write: if false`
- **2-attempt cap**: Saikaku × UAAM = 最大4 pair。整合分析は最大4組

---

## 前提確認 (Architecture Sanity Check)

### A. 既存実装との整合性

| 項目 | 記入欄 |
|---|---|
| 同種の既存ファイル | `api/lib/attempts.js` の `reserveAttempt`/`commitAttempt` (transaction + lock + merge:true subcollection write) / `api/me/history.js` (subcollection read + serializeTimestamps) / `firestore.rules:43-55` (uaam_results 系全面 deny) |
| 既存パターン | クライアントは `/api/me/*` 経由で `Authorization: Bearer <idToken>` 認証、Admin SDK で Firestore 読み書き、書き込みは transaction + lock、レスポンスは serializeTimestamps 済み JSON |
| 本プランの選択 | **完全整合**: integrations subcollection も同じ rules deny + transaction lock パターン。書き込みは `update()` または nested object set (deep merge) で、dotted-key set は使わない。読み取りは `/api/me/*` 経由 |
| 整合 / 逸脱 | **整合** |

**注意**: dotted-key set のアンチパターンを使っている箇所 (`api/integrate.js:207-214`) は本プランで除去する。

### B. 前提を疑う代替案

| 項目 | 記入欄 |
|---|---|
| 本プランの前提 | 「統合分析は per-pair (Saikaku × UAAM) で正規化し、subcollection に保存する」 |
| 代替案1 | 「`api/integrate.js` のみ `update({'a.b': v})` に変更、保存先は親doc nested のまま」 |
| 代替案1 の長所 | 工数最小（1ファイル数行の修正）、データ構造変更なしでマイグレーション不要 |
| 代替案1 の棄却理由 | UAAM プロンプトが nested `analysis.saikaku_integration` を毎回上書きする問題が残る。UAAM 2回目で消失するバグは止まらない。**真の解決にならない** |
| 代替案2 | 「親doc トップレベルに `saikaku_integration_v2` フィールドとして保存（subcollection 不使用）」 |
| 代替案2 の長所 | 名前空間分離で衝突回避、subcollection より読み取りが軽量 |
| 代替案2 の棄却理由 | per-pair (Saikaku attempt × UAAM attempt) の関係を表現できない。Saikaku 1回目+UAAM 1回目 と Saikaku 1回目+UAAM 2回目 の組合せが上書き合う。再生成回数も追跡不能 |
| 代替案3 | 「top-level コレクション `integrations/{uid}_{saikakuAttemptId}_{uaamAttemptId}`」 |
| 代替案3 の棄却理由 | uaam_results/{uid}/attempts/ の subcollection と非対称。同 uid 所有資源は同 doc 配下に集約する既存パターンに反する |
| 採用判断 | **本プラン (per-pair subcollection) を採用**。代替案1は名前空間衝突を残す band-aid。代替案2は per-pair 関係を表現できない。代替案3は既存パターンと非対称 |

---

## Phase 0: 作業準備 + 本番監査 `[id:setup]`

- [ ] [id:setup] [required] 新ブランチ作成
  - **Goal**: `feat/issue-44-46-per-pair-integrations` を main から切る
  - **Assignee**: opus

- [ ] [id:audit-prod] [required] 本番データ監査（既存 integration の保存形態確認 + Phase 1 進行可否判定）`depends-on: setup`
  - **Goal**: PR #51 ブランチに既にある `scripts/audit-saikaku-integration.mjs` を**本番で1回走らせ**、(a) 何件のユーザーに `hasSaikakuIntegration:true` が立っているか、(b) `analysis.saikaku_integration` (nested) と `data["analysis.saikaku_integration"]` (literal dotted top-level key) の保存分布を実機調査する。**マイグレーション設計と Phase 1 の write 切替判断に必須**
  - **Success**: `logs/audits/saikaku-integration-{timestamp}.json` が生成され、以下が判明する:
    - `hasSaikakuIntegration:true` ユーザー数
    - そのうち **literal top-level dotted key** に integration がある件数
    - そのうち **nested** に integration がある件数
    - 両方欠落（destroyed）件数
  - **Judgment ポイント (audit 完了後に Opus が判定し、つかさに報告)**:
    - destroyed > 0 → migration で `legacy-fallback__legacy-fallback` に集約
    - literal dotted key 主流（emulator 検証通り） → 計画通り進行
    - nested 主流（想定外） → **Phase 1 を停止**し計画再吟味（事前仮説と現実の乖離）
  - **Constraints**: 監査スクリプトを literal dotted top-level key も読むよう拡張（現状は nested のみチェック）
  - **Files**: `scripts/audit-saikaku-integration.mjs` (PR #51 から cherry-pick or 取り込み + 拡張)
  - **Verify**: ユーザー手動実行 → Judgment ポイント判定 → Phase 1 の `id:write` `id:migrate` 着手前にOK判定取得
  - **Assignee**: opus (本番認証情報必須のためユーザー実行)

---

## Phase 1: 実装 `depends-on: setup` `[id:impl]`

> **方針**: コーディングはCodex (GPT-5.5, reasoning=xhigh) に委任。

- [ ] [id:schema] integrations subcollection スキーマ + pairKey 純関数 + firestore.rules 追加
  - **Goal**: 新スキーマと pairKey 生成関数を定義し、rules で Admin SDK 経由のみ許可。reserved naming パターンを純関数で防御
  - **Success**:
    - `firestore.rules` に `match /uaam_results/{uid}/integrations/{pairKey} { allow read, write: if false; }` 追加
    - `shared/integrationsKey.js` に純関数 `buildPairKey(saikakuAttemptId, uaamAttemptId)` 実装。区切り文字は `__` (アンダースコア2つ)。reserved pattern (`^__.*__$`) / `/` / `.` / `..` / 1500B超 を拒否（throw）
    - rules-unit-test 追加 (`tests/rules/integrations.test.js`): emulator で client read/write が拒否されることを確認
    - 純関数テスト追加 (`tests/shared/integrationsKey.test.mjs`): `legacy-v1__legacy-v1` 等の legacy ID も通る、reserved pattern は throw、過長は throw
    - スキーマドキュメント `docs/spec/integrations-schema.md` 新規作成（フィールド定義 + 不変式）
  - **Constraints**:
    - 既存 `attempts/{aid}` の rules パターン継承
    - pairKey 生成関数は副作用なし、Firestore SDK 直接 import 禁止
    - スキーマフィールド: `saikakuAttemptId`, `uaamAttemptId`, `integration` (rich integration 本体), `regenerationCount`, `model`, `source.saikakuLabel`, `source.uaamLabel`, `createdAt`, `updatedAt`, `status` ('active' | 'stale')
    - `saikakuAttemptId` / `uaamAttemptId` は doc ID 由来だが、where クエリ可能にするためトップレベルフィールドとしても保持
  - **Files**:
    - `firestore.rules`
    - `shared/integrationsKey.js` (新規)
    - `tests/rules/integrations.test.js` (新規)
    - `tests/shared/integrationsKey.test.mjs` (新規)
    - `docs/spec/integrations-schema.md` (新規)
  - **Verify**:
    - `firebase emulators:exec --only firestore "npm test -- rules/integrations"` pass
    - `npm test -- integrationsKey` pass
  - **Assignee**: codex (reasoning: xhigh)

- [ ] [id:write] `api/integrate.js` を subcollection 書き込みに切替 `depends-on: schema, audit-prod`
  - **Goal**: `/api/integrate` の保存先を `uaam_results/{uid}/integrations/{pairKey}` に変更、`saikakuAttemptId` / `uaamAttemptId` をリクエストで受付、再生成を `regenerationCount < 2` で許可。並行書き込み防止 lock 追加（**新規 lock 設計、`reserveAttempt` の lock とは別 namespace + 短 TTL**）
  - **Success**:
    - リクエスト body: `{ idToken, saikakuAttemptId?, uaamAttemptId? }`（省略時は各kindの latestAttemptId を採用）
    - 保存先: `uaam_results/{uid}/integrations/{saikakuAttemptId}__{uaamAttemptId}`
    - 既存 pair の再生成は transaction で `regenerationCount` をインクリメント、2 超過で 409 (`LimitExceededError`)
    - **lock 機構（新規設計、attempts.js とは独立）**:
      - 新定数 `INTEGRATION_LOCK_TTL_MS = 180 * 1000` (180秒、Vercel function maxDuration 120秒 + 60秒バッファ)
      - lock doc ID: `integration-{pairKey}` (`uaam_results/{uid}/_locks/integration-{pairKey}`)
      - `RESERVATION_LOCK_ID = 'reservation'` (UAAM/Saikaku attempts 用の単一固定 lock) とは**別 namespace**
      - **異 kind 並走を許容**: UAAM 診断中（`_locks/reservation` 保持）でも integrate は実行可
      - `try/finally` で lock を確実に解放する（function 早期 return 時も解放保証）
    - 親doc `analysis.saikaku_integration` への新規書き込みは**停止**。互換のため `hasSaikakuIntegration: true` フラグは subcollection 書き込み時に親doc に立てる
    - レスポンス shape は既存維持: `{ integration: {...}, pairKey, regenerationCount }`（後方互換のため `integration` キーは残す）
    - 認証は既存どおり `idToken` 検証
  - **Constraints**:
    - `update({'a.b': v})` または nested object `set({merge:true})` のみ使用。**dotted-key set 禁止**（コメントで警告。`tests/api/firestore-merge-debug.test.js` の検証結果に基づく）
    - `validateAndFix()` の契約層は維持
    - lock TTL は `INTEGRATION_LOCK_TTL_MS` 新定数（`RESERVATION_LOCK_TTL_MS` 流用しない）
    - `model` フィールドに `claude-sonnet-4-...` を記録、`source.saikakuLabel` / `source.uaamLabel` は生成時点の値をスナップショット保存
    - emulator-backed E2E test を必ず追加: `tests/api/integrate-subcollection.test.js`（再生成、上限、lock 競合、異 kind 並走、function timeout 後の lock 自動解放）
  - **Files**:
    - `api/integrate.js`
    - `api/lib/integrations.js` (新規、`INTEGRATION_LOCK_TTL_MS` 定数 + reserve/commit/lock パターン)
    - `tests/api/integrate-subcollection.test.js` (新規)
  - **Verify**:
    - emulator E2E:
      - 1回目生成→`regenerationCount: 0` の doc 作成
      - 2回目同pair→`regenerationCount: 1`
      - 3回目→409
      - **同 pair 並行2リクエスト→1件成功+1件 conflict**
      - **異 kind 並走（UAAM commit 中の integrate）→両方成功**
      - **function クラッシュシミュレーション後、180秒経過で次回 integrate が成功**（lock 自動解放）
      - 親doc に `analysis.saikaku_integration` 新規書き込みされない
    - `tests/api/firestore-merge-debug.test.js` を残して回帰防止
  - **Assignee**: codex (reasoning: xhigh)

- [ ] [id:read] read API を subcollection 優先に切替 + `/api/me/history` `/api/me/uaam-result` 拡張 `depends-on: write`
  - **Goal**: `/api/me/history` `/api/me/uaam-result` で integrations subcollection を優先読み、fallback で親doc読み（移行期）。Saikaku 履歴側にも integration を返す。**UI が必要とする shape は「履歴一覧用 summary（軽量）」と「結果画面用 full body（詳細）」の2層**
  - **Success**:
    - **2層 shape を明確に分離**:
      - `IntegrationSummary` (履歴一覧用、軽量): `{ exists, generatedAt, integrationScore, activationCore, saikakuAttemptId, uaamAttemptId, status, regenerationCount }`
      - `IntegrationFullBody` (結果画面用、subcollection doc 全体): `{ integration: {...full LLM output...}, source: {saikakuLabel, uaamLabel}, model, regenerationCount, status, createdAt, updatedAt, saikakuAttemptId, uaamAttemptId }`
      - 既存 UI の `analysis.saikaku_integration?.integration_score !== undefined` 条件 (`UAAMResultScreen.jsx:1992`) と互換になるよう、IntegrationFullBody.integration の中身は LLM 出力 schema をそのまま保つ
    - **`GET /api/me/history?kind=uaam`**:
      - レスポンス追加フィールド `integrationSummaries: IntegrationSummary[]` (UAAM attempt 側に紐づく integration 一覧、複数 pair 対応)
    - **`GET /api/me/history?kind=saikaku`**:
      - レスポンス追加フィールド `integrationSummaries: IntegrationSummary[]` (Saikaku attempt 側に紐づく integration 一覧)
    - **`GET /api/me/uaam-result?attemptId=xxx`**:
      - 既存レスポンス + 追加フィールド `integrations: IntegrationFullBody[]` (該当 UAAM attempt に紐づく integration 全件、複数の Saikaku と pair の場合あり)
      - `attemptId` 省略時は `latestAttemptId` を採用（後方互換）
    - **新規 endpoint なし**: Saikaku 側の full body 取得は `/api/me/history?kind=saikaku&saikakuAttemptId=xxx&includeFullIntegrations=true` で同一 endpoint で対応（クエリパラメータで詳細 / 軽量切替）
    - pair key 解決ロジックは `shared/attemptLogic.js` に純関数で追加: `selectIntegrationsForAttempt(integrations, attemptId, kind)`
    - 既存ユーザー (subcollection 未移行) は親doc fallback で動作。`data["analysis.saikaku_integration"]` (literal dotted top-level key) と `data.analysis.saikaku_integration` (nested) の両方を試行、見つかった方を `legacy-fallback__legacy-fallback` の pseudo-pair として返す
    - 才覚やり直し後の `status: 'stale'` 判定は IntegrationSummary 側で実装
    - subcollection 空でも 500 を返さず `integrationSummaries: []` / `integrations: []` で返す
    - serializeTimestamps を新フィールド (`createdAt`, `updatedAt`) にも適用
  - **Constraints**:
    - 既存の `withMeHandler` / `authenticateMeRequest` パターン継承
    - 既存の `attempts` / `summary` / `pendingAttempt` レスポンス shape は不変（破壊的変更禁止）
    - emulator-backed E2E test 追加: `tests/api/me-history-integration.test.js`（subcollection あり/なし、stale 判定、fallback 動作、IntegrationSummary と IntegrationFullBody の shape 検証）
  - **Files**:
    - `api/me/history.js`
    - `api/me/uaam-result.js`
    - `shared/attemptLogic.js` (`selectIntegrationsForAttempt`, `extractIntegrationSummary` ヘルパー追加)
    - `tests/api/me-history-integration.test.js` (新規)
  - **Verify**:
    - emulator E2E: subcollection 移行済みユーザーで integration が読める / 未移行ユーザーで fallback 動作 (legacy-fallback) / stale ユーザーで status='stale' / saikaku kind でも integrationSummaries 返る / `attemptId` 指定で正しく fullBody 返る
  - **Assignee**: codex (reasoning: xhigh)

- [ ] [id:migrate] マイグレーションスクリプト（dry-run + legacy-fallback 一律集約）`depends-on: read, audit-prod`
  - **Goal**: 既存 `uaam_results/{uid}` の rich integration（literal dotted top-level key 優先、nested フォールバック）を subcollection にコピー。**確証のないペア推定は行わず、すべて `legacy-fallback__legacy-fallback` の単一 pseudo-pair に集約**（誤帰属リスク回避、Gemini #2 採用）
  - **Success**:
    - `scripts/migrate-integrations-to-subcollection.mjs` 新規追加
    - `--dry-run` モード既定（明示的に `--apply` 指定で本番実行）
    - **pairKey: 一律 `legacy-fallback__legacy-fallback`**:
      - 過去データから「どの Saikaku attempt × どの UAAM attempt が pair か」は確定的に決定不能（複数タブ・clock skew・遅延・再診断順序の不確実性、Gemini #2）
      - **タイムスタンプ推定は採用しない**。誤帰属リスク（UI で「才覚 1回目 × UAAM 1回目」と表示されるが実際は別組み合わせ）を排除
      - 既存ユーザーの全 integration を `uaam_results/{uid}/integrations/legacy-fallback__legacy-fallback` に集約
      - **副作用**: 1ユーザー1件のみ移行可能（複数 pair 履歴の保持は不可）。これは過去データの本質的な情報損失で、新規生成からは正しく per-pair で記録される
    - 移行データソース優先順位:
      1. **literal dotted top-level key** `data["analysis.saikaku_integration"]` を最優先（emulator 検証で確認した実際の保存場所）
      2. なければ **nested** `data.analysis.saikaku_integration` をフォールバック
      3. `hasSaikakuIntegration:true` だが両方欠落 → ログに `destroyed` として記録（移行スキップ）
    - subcollection doc に書く内容:
      - `integration`: 抽出した integration 本体
      - `saikakuAttemptId: 'legacy-fallback'`, `uaamAttemptId: 'legacy-fallback'`
      - `regenerationCount: 0`
      - `model: 'unknown-legacy'` (履歴が無いため)
      - `source: { saikakuLabel: 'legacy', uaamLabel: 'legacy' }`
      - `status: 'legacy'` (新規 status 値、UI 側で「過去データ」表示)
      - `createdAt`: 元の `integrationUpdatedAt` を継承（無ければ migration 実行時刻）
    - 冪等性: 既に subcollection に同 pairKey が存在する場合は skip（再実行で副作用なし）
    - ログ: `logs/migrations/integrations-{YYYYMMDD-HHmmss}.{json,txt}`
    - 集計サマリ stdout: `total / migrated_from_literal / migrated_from_nested / destroyed / skipped (already migrated) / error`
  - **Constraints**:
    - 親doc の `analysis.saikaku_integration` (nested) と literal dotted top-level key は**削除しない**（移行期 fallback のため。`id:cleanup-fallback` 完了後に削除）
    - 本番実行は dry-run 結果レビュー後にユーザー承認
    - pairKey 生成は `shared/integrationsKey.js` の `buildPairKey('legacy-fallback', 'legacy-fallback')` を使用（reserved naming 検証通過確認済み）
    - **推定ロジックは実装しない**（Gemini #2、誤帰属リスク回避）
  - **Files**:
    - `scripts/migrate-integrations-to-subcollection.mjs` (新規)
    - `shared/integrationsKey.js` (拡張: `LEGACY_FALLBACK_ID = 'legacy-fallback'` 定数 export)
  - **Verify**:
    - emulator-backed 単体テスト: literal dotted key からの抽出 / nested fallback / destroyed 検出 / 冪等性確認
    - dry-run 実行 (ユーザー手動): 件数照合 + audit 結果と一致確認
  - **Assignee**: codex (reasoning: xhigh)

- [ ] [id:ui] UI: 出典表示 + 再生成 CTA + stale 警告 + Saikaku 側リンク `depends-on: read`
  - **Goal**: UAAMResultScreen の SaikakuIntegration 周辺で `source` 表示、再生成 CTA を残り回数つき、`status:'stale'` 時に警告。HistoryScreen の Saikaku 側にも統合分析リンク（閲覧導線）
  - **Success**:
    - 出典: 「才覚領域: ◯◯（YYYY/MM/DD）× UAAM: ◯◯（YYYY/MM/DD）」をモーダル冒頭に表示
    - 再生成 CTA: 「再生成（残り N 回）」ボタン。N=0 で disabled
    - stale 警告: status='stale' のとき注意ラベル + 「最新の才覚で再生成」リンク
    - HistoryScreen Saikaku 側: 統合分析存在時にバナー、クリックでモーダル（生成 CTA なし、閲覧のみ）
    - HistoryScreen UAAM 側: 既存の MVP バナー（issue #45 の趣旨）も実装。クリックでモーダル
    - SaikakuIntegrationModal は新規、UAAMResultScreen の埋め込み版とコンポーネント共有
  - **Constraints**:
    - 既存 `SaikakuIntegration` コンポーネントの props は後方互換維持（`source` を optional 追加）
    - Firestore 直読み禁止（`/api/me/*` のレスポンスのみ使用）
    - `src/screens/uaam/src/screens/uaam/UAAMResultScreen.jsx` (重複ディレクトリ dead code) は触らない
  - **Files**:
    - `src/screens/HistoryScreen.jsx`
    - `src/screens/uaam/UAAMResultScreen.jsx`
    - `src/screens/uaam/SaikakuIntegration.jsx` (props 拡張)
    - `src/screens/uaam/SaikakuIntegrationModal.jsx` (新規)
  - **Verify**:
    - 開発環境（emulator + テストユーザー）で 4シナリオ目視: 最新 pair / 古い pair / stale / 再生成上限
    - HistoryScreen Saikaku 側でリンク表示
  - **Assignee**: codex (reasoning: xhigh)

---

## Phase 2: 品質ゲート `depends-on: impl` `[id:quality]`

- [ ] [id:codex-review] [required] `/codex-code-review` 動的観点並列レビュー（reasoning: high）
  - **Assignee**: codex
- [ ] [id:codex-fix] 重大/重要な指摘がなくなるまで修正→再実行 `depends-on: codex-review`
  - **Assignee**: codex (reasoning: xhigh)
- [ ] [id:opus-review] [required] Opus による差分レビュー（設計整合性・横断影響・UX）`depends-on: codex-fix`
  - **Assignee**: opus
- [ ] [id:e2e] [required] **emulator-backed E2E 全パス確認** `depends-on: opus-review`
  - **必須**: 完了報告にコマンド実行結果を貼ること
  - 全 emulator test (`npm run test:api`) green
  - 4シナリオ目視: UAAM 1回目→integrate→UAAM 2回目で integration 残存 / pair 再生成 上限 / stale / migration dry-run + apply（emulator 内で）
  - **Assignee**: opus
- [ ] [id:ui-review] `/ui-skills` 実行 `depends-on: e2e`

---

## Phase 3: ドキュメント同期 `depends-on: quality` `[id:docs]`

> ⚠️ **必須**: sync-docs はスキップ禁止

- [ ] [id:docs] [required] `/sync-docs` でドキュメント更新
  - `README.md` (最小限、詳細はリンク)
  - `CLAUDE.md` (AI向けコンテキスト: 統合分析の保存先・再生成ルール・dotted-key set のアンチパターン警告)
  - `docs/design-rationale.md` (per-pair 採用理由・代替案棄却理由・firebase-admin merge 挙動の事実検証ログ参照)
  - `docs/spec/integrations-schema.md` (Phase 1-schema で作成済み)

---

## Phase 4: 完了 + マイグレーション本番適用 `depends-on: docs` `[id:done]`

- [ ] [id:pr] PR 作成（issue #44/#45/#46 を close）
  - **Assignee**: opus
- [ ] [id:review-req] レビュー依頼 `depends-on: pr`
- [ ] [id:staging-dry-run] [required] ステージング環境で migration dry-run `depends-on: pr`
  - **Assignee**: opus (本番認証情報必須)
- [ ] [id:prod-dry-run] [required] 本番環境で migration dry-run `depends-on: staging-dry-run`
  - **Assignee**: opus
- [ ] [id:prod-apply] [required] dry-run 結果レビュー後、本番で `--apply` 実行 `depends-on: prod-dry-run`
  - **Assignee**: opus（つかさ承認後）
- [ ] [id:post-audit] 本番マイグレーション後の audit スクリプト再実行で件数照合 `depends-on: prod-apply`
- [ ] [id:cleanup-fallback-issue] [required] **Read API の親doc fallback 撤去 follow-up issue を起票** `depends-on: post-audit`
  - **Goal**: Phase 1 `id:read` で実装した「親doc から legacy-fallback として読む fallback ロジック」を、本番マイグレーション完了後に撤去するための issue を起票（Gemini #3 採用、Exit Strategy）
  - **Success**:
    - 新規 issue 起票: 「[Cleanup] integration read API の親doc fallback ロジック撤去 (#46 follow-up)」
    - issue 本文に以下を含める:
      - 撤去対象: `api/me/history.js` `api/me/uaam-result.js` の親doc `data["analysis.saikaku_integration"]` / `data.analysis.saikaku_integration` 読み取り経路
      - 前提条件: `id:post-audit` で全件マイグレーション完了確認済み（subcollection に存在しない integration がないこと）
      - 同時に削除対象: 親doc の literal dotted top-level key と nested key（Firestore script で個別削除）
      - 安全マージン: 本番運用 2 週間〜1 ヶ月後に着手（rollback 余地確保のため）
  - **Constraints**:
    - 本タスクは issue 起票のみ。コード削除は別 PR で実施（PR が大きくなりすぎを防ぐ + rollback 余地確保）
    - 別 PR タイトル例: `cleanup: remove parent-doc fallback for integration reads (#46 follow-up)`
  - **Assignee**: opus
- [ ] [id:close-pr-51] PR #51 (Phase 0 hotfix draft) を close、参考実装として `audit-saikaku-integration.mjs` のみ本 PR に取り込む `depends-on: prod-apply`

---

## 完了条件

- [ ] 全タスクが `[x]` 更新
- [ ] emulator E2E 全パス
- [ ] PR がマージ
- [ ] 本番マイグレーション完了 + audit で subcollection データ件数が想定通り
- [ ] PR #51 close、issue #44/#45/#46 close

---

## ロールバック単位

- **schema/rules**: rules revert + subcollection 削除（forward-only でも可、Admin SDK only なので influence なし）
- **write API**: `api/integrate.js` を親doc nested 書きに戻す（ただし dotted-key set ではなく `update({'a.b': v})` を使う）+ subcollection への書き込み停止
- **read API**: subcollection 優先解除、親doc fallback のみに戻す
- **migration**: forward-only。本番適用後は subcollection データを残す。read API revert のみで挙動を戻す

## リスクとミティゲーション

| リスク | ミティゲーション |
|---|---|
| Phase 0 audit で「nested 主流」と判明 → 計画前提が崩れる | `id:audit-prod` の Judgment ポイントで Phase 1 停止判断、計画再吟味 |
| Phase 0 audit で「rich integration 保存ユーザーが想定より多い」 → migration 工数増 | dry-run 結果で件数把握 → 必要なら バッチ分割 / 並列度制限 |
| 同 pair 並行書き込み（ユーザー連打）→ 整合性破壊 | transaction + lock (新規 `INTEGRATION_LOCK_TTL_MS` 180秒) + try/finally 解放、E2E test で並行検証 |
| function クラッシュで lock が永久残置 | TTL 180秒（function maxDuration 120秒 + 60秒バッファ）で自動解放、try/finally で正常 path も解放 |
| migration 推定誤帰属 | **推定ロジック削除**、`legacy-fallback__legacy-fallback` 一律集約で誤帰属リスクをゼロにする (Gemini #2 採用) |
| 親doc fallback コードが永続化し技術的負債 | `id:cleanup-fallback-issue` で post-prod-apply 後に follow-up issue 起票、別 PR で撤去 (Gemini #3 採用) |
| firestore.rules deploy 失敗で integrations 全面拒否のまま停止 | rules-unit-test を CI で必須化、ステージングで rules deploy 検証 |
| Firestore admin SDK の merge 挙動が将来変更される | emulator-backed test (`firestore-merge-debug`) を残し、回帰検出 |

## 同時生成競合の扱い

- 同 pair に対する連打 → transaction 内 lock で 1 リクエストのみ通過、他は 409
- lock TTL: **180秒** (`INTEGRATION_LOCK_TTL_MS = 180 * 1000`)。Vercel function `maxDuration: 120` 秒 + 60秒バッファ
- lock doc ID: `integration-{pairKey}` (`uaam_results/{uid}/_locks/integration-{pairKey}`)
- `RESERVATION_LOCK_ID = 'reservation'` (UAAM/Saikaku attempts 用) とは別 namespace、異 kind 並走を許容
- 期限切れ lock は次のリクエストが奪取（function クラッシュ後の自動回復）
- `try/finally` で正常 path も lock を確実に解放
- E2E test で以下を必須検証:
  - 並行 2 リクエストが片方 200 / 片方 409
  - 異 kind 並走（UAAM commit 中の integrate）が両方成功
  - lock 期限切れ後の再リクエスト成功
