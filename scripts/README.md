# scripts/

CLI utilities for one-shot operations on the saikaku-architecture project.

## recalculate-uaam-q42.mjs

UAAM Q42 reverse 修正 (issue #9) のための過去スコア再計算スクリプト。

`shared/uaamQuestions.js` の修正後 `calculateScores` を使って、Firestore に保存済みの全 attempt のスコアを再計算し、attempt と親 doc を atomic に更新する。

### Flags

| Flag | Default | 説明 |
|---|---|---|
| `--commit` | false | dry-run を抜けて実書き込み（インタラクティブ確認あり） |
| `--uid <uid>` | - | 単一ユーザー限定 |
| `--limit <N>` | - | 走査ユーザー数を上限 |
| `--verbose` | false | 詳細ログ |
| `--help`, `-h` | - | ヘルプ表示 |

### 動作

1. `uaam_results/{uid}` を全件 (or `--uid` 指定) 走査
2. 各 uid の `attempts` で `status='committed'` かつ `raw.input.answers` がある attempt を再計算
3. 既に `q42_recompute` 済みの attempt は skip (idempotent)
4. 親 doc の `scores` は **`parent.latestAttemptId === attemptId`** が一致した時だけ更新
5. `analysis.narrative` 等の LLM 生成テキストは触らず、`narrative_may_be_stale: true` フラグのみ書き込み

### 推奨フロー (本番マイグレーション)

```bash
# 1. 事前バックアップ
gcloud firestore export gs://<backup-bucket>/q42-pre-recompute-$(date +%Y%m%d)

# 2. 管理者 uid で 1件 dry-run
node scripts/recalculate-uaam-q42.mjs --uid <admin-uid>

# 3. 1件 commit
node scripts/recalculate-uaam-q42.mjs --uid <admin-uid> --commit

# 4. 5件 dry-run
node scripts/recalculate-uaam-q42.mjs --limit 5

# 5. 全件 commit
node scripts/recalculate-uaam-q42.mjs --commit
```

### 環境変数

- `FIRESTORE_EMULATOR_HOST`: 設定されていれば emulator モード
- 未設定時は `api/lib/firebaseAdmin.js` の本番 service-account credentials を使用

### Idempotency

- `attempt.q42_recompute` フィールドが既存 → 当該 attempt は skip
- `parent.q42_recompute` フィールドが既存 → 親 doc は skip
- 再実行は安全。コミット失敗時の chunk リトライ用に再実行可能

## test-e2e-orchestrator.mjs

`npm run test:e2e` の本体。E2E テストの直列実行制御。

## list-uaam-takers.mjs

UAAM受験者一覧取得スクリプト (admin tool)。
