# テスト実行ガイド

## 4 層テスト

| 層 | コマンド | カバレッジ | 所要時間 |
|----|----------|------------|----------|
| Unit | `npm run test:unit` | バッジ表示ロジック / attemptAdapter / AdminScreen 統合分析タブ (74 tests) | < 5 秒 |
| Rules | `npm run test:rules` | Firestore rules 21 シナリオ (`/api/me/*` 経由化で attempts/uaam_results parent の read deny を反転検証) | 〜2 秒 |
| API | `npm run test:api` | Reservation / Commit / Rollback / migration / concurrency + `/api/me/*` BFF + `/api/admin/integrations` (122 tests) | 〜30 秒 |
| E2E | `npm run test:e2e` | Playwright 29 フロー (badge/history/limit/admin-integrations 等) | 〜100 秒 |
| **All** | `npm run test:all` | 全部直列実行 | 〜140 秒 |

## 前提

- Node.js v22+
- `npm install` 済み
- emulator 用 JDK が `/opt/homebrew/opt/openjdk@21` にあること (test:rules / test:api / test:e2e で必要)
- Playwright ブラウザ: `npx playwright install chromium` (test:e2e 初回のみ)

## ローカル開発時の手動実行

`firebase emulators:exec` を使わず、起動済みエミュレータに直接テストを当てたい場合:

```bash
# emulator を起動 (別ターミナル)
npm run emu

# rules テスト
FIRESTORE_EMULATOR_HOST=localhost:8090 \
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
FIREBASE_PROJECT_ID=demo-saikaku \
GCLOUD_PROJECT=demo-saikaku \
NODE_ENV=test \
npx vitest run tests/rules

# API テスト
FIRESTORE_EMULATOR_HOST=localhost:8090 \
FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
FIREBASE_PROJECT_ID=demo-saikaku \
GCLOUD_PROJECT=demo-saikaku \
MOCK_ANTHROPIC=1 \
TEST_BYPASS_AUTH=1 \
NODE_ENV=test \
npx vitest run tests/api
```

## LLM Mock の運用

`api/lib/anthropicClient.js` の `createMessage()` は環境変数で挙動を切り替える:

| 環境変数 | 値 | 効果 |
|----------|----|------|
| `MOCK_ANTHROPIC` | `1` | fixture JSON を返す (`tests/fixtures/anthropic/{saikaku,uaam}-1.json`) |
| `MOCK_ANTHROPIC` | unset | 実際の Anthropic SDK 呼び出し |
| `MOCK_ANTHROPIC_FAIL` | `1` | mock 中に必ず throw (rollback テスト用) |
| `MOCK_ANTHROPIC_DELAY_MS` | `1500` | mock 応答を 1.5 秒遅らせる (concurrency テスト用) |

`MOCK_ANTHROPIC_DELAY_MS` の用途:
Reservation Tx 間で発生する race を再現するため、最初の reserve→commit 完了前に 2 つ目の reserve がエントリーする時間窓を確保する。production の実 LLM (5-30 秒) では自然に発生する race が、emulator + 即応 mock では再現しない。

## E2E orchestrator (`scripts/test-e2e-orchestrator.mjs`)

`npm run test:e2e` が起動するスクリプト。順序:
1. ポート 3001 / 5173 / 8090 / 9099 が空いているか確認 (使用中なら abort)
2. `firebase emulators:start --only auth,firestore --project demo-saikaku` を bg 起動
3. `wait-on tcp:9099 tcp:8090` で ready 待ち
4. `MOCK_ANTHROPIC=1 NODE_ENV=test TEST_BYPASS_AUTH=1 node server.js` を bg 起動
5. `wait-on http://localhost:3001/api/health` で API ready 待ち
6. `npm run dev -- --port 5173 --strictPort` (Vite) を bg 起動
7. `wait-on http://localhost:5173` で Vite ready 待ち
8. `npx playwright test` を実行 → 結果を exit code に伝搬
9. SIGTERM で全 bg プロセス停止

ローカル開発で emulator/Vite が常駐している場合は orchestrator を使わず直接 `npx playwright test` でも動く (環境変数を手動設定)。

## TEST_BYPASS_AUTH のガード

API テストでは Firebase Admin verifyIdToken をスキップするため `TEST_BYPASS_AUTH=1` を使うが、本番混入を防ぐ三重ガード:

```js
if (
  process.env.TEST_BYPASS_AUTH === '1'
  && process.env.NODE_ENV === 'test'
  && !!process.env.FIRESTORE_EMULATOR_HOST
) {
  // bypass
}
```

`tests/api/_helpers.js` は import 時にこの三条件を assert する。条件を満たさずに `npm run test:api` 以外で実行されると即時 throw する fail-fast 設計。

## トラブルシュート

### `port X is already in use`
ローカルで他のプロセスが emulator/API/Vite ポートを使用中。`lsof -i :8090` で特定して停止するか、各テストスクリプトを emulator 起動済みの環境で個別に走らせる (上記の「手動実行」)。

### `Could not start Firestore Emulator, port taken`
`npm run test:rules` / `test:api` 内の `firebase emulators:exec` が新規 emulator を起動しようとして失敗。既に emulator が起動済みなら、上記の手動実行コマンドで対応。

### concurrency テストが flaky
`MOCK_ANTHROPIC_DELAY_MS` が小さすぎる可能性。`tests/api/concurrent-from-{zero,one}.test.js` で 1500ms に設定しているが、CI 環境が遅い場合は 2000ms 以上に上げる。

issue #73 で追加した deterministic 化（1 本目の `pendingAttemptId` 確認後に 2 本目を投げる）でも race が残る場合は、`waitForPendingAttempt()` のタイムアウト（40 回 × 50ms = 2 秒）を伸ばす。

### admin-integrations フルスイート pollution
`/api/admin/integrations` は `db.collectionGroup('integrations').get()` で全 user の integrations を取得する仕様。`tests/api/admin-integrations.test.js` は他テストの fixture が collectionGroup に混ざることを許容し、`fixtureItems = response.body.integrations.filter((item) => fixtureUids.includes(item.uid))` で自テストの seed のみに絞って検証する。`afterEach` で seed した fixture も完全クリアし、後続テストへの漏れを防ぐ。
