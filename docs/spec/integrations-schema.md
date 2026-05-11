# Per-Pair Integration Schema

## Document Path

`uaam_results/{uid}/integrations/{saikakuAttemptId}__{uaamAttemptId}`

The document id is produced by `buildPairKey(saikakuAttemptId, uaamAttemptId)`.

## Field Schema

All fields are top-level fields. They are not nested under `analysis`.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `saikakuAttemptId` | string | yes | Doc-id-derived but stored as a field for `where` queries. |
| `uaamAttemptId` | string | yes | Doc-id-derived but stored as a field for `where` queries. |
| `integration` | object | yes | Rich integration body — opaque LLM JSON output. Do not validate shape here. |
| `regenerationCount` | number | yes | Starts at 0. Valid values are `0` and `1`; values greater than 1 must be rejected by the write API in Phase 1-write. |
| `model` | string | yes | Snapshot of the model used at generation time, for example `claude-sonnet-4-20250514`. |
| `source` | object | yes | Snapshot of attempt labels at generation time: `{ saikakuLabel: string, uaamLabel: string }`. |
| `createdAt` | Timestamp | yes | Server timestamp, only set on first write. |
| `updatedAt` | Timestamp | yes | Server timestamp, set on every write. |
| `status` | `'active' \| 'stale'` | yes | `stale` is set by the read API when the latest committed Saikaku attempt diverges from this document's `saikakuAttemptId`. |

## Invariants

- Writes MUST use `update({ field: value })` or nested-object `set({ field: value }, { merge: true })`.
- **BANNED**: dotted-key set with merge — `set({ 'a.b': v }, { merge: true })`. firebase-admin v12.7.0 treats this as a literal top-level field named `'a.b'` (string), NOT a field path. This is the root cause of issue #44. See `tests/api/firestore-merge-debug.test.js` for the reproduction.
- Per-pair uniqueness: doc id derived from `buildPairKey(saikakuAttemptId, uaamAttemptId)`.
- `regenerationCount` cap: 2 attempts max (`regenerationCount` value 0 then 1). Write API rejects 2nd regeneration with HTTP 409.

## Lock Fencing (Phase 1-write + Phase 2 B-1)

- Lock path: `uaam_results/{uid}/_locks/integration-{pairKey}` (admin-only).
- TTL: `LOCK_TTL_MS = 10 * 60 * 1000` (10 min). Stale lock takeover allowed after TTL.
- `acquireIntegrationLock({ uid, pairKey, ownerId? })` returns `{ pairKey, ownerId, lockRef }`. ownerId defaults to `randomUUID()`. The lock document stores `{ pairKey, ownerId, acquiredAt }`.
- `commitIntegration({ ..., ownerId })` runs in a single transaction:
  1. Read lockRef. Verify `lockData.ownerId === ownerId AND !stale(lockData.acquiredAt)`.
  2. On mismatch → throw `IntegrationConflictError` (HTTP 409 `lock_conflict`).
  3. Write integration doc.
  4. `tx.delete(lockRef)` in the same transaction (no race window).
- `releaseIntegrationLock({ uid, pairKey, ownerId })` no-ops if owner mismatch (defensive).
- LLM call wrapped with `AbortSignal.timeout(LOCK_TTL_MS - 30_000)` (9.5 min) so the call cannot outlive the lock window. Timeout → HTTP 504 `upstream_timeout`.

## regenerationCount Cap

- First write: `regenerationCount = 0`.
- Second write: `regenerationCount = 1`. Both `acquireIntegrationLock` and `commitIntegration` re-check the cap.
- Third attempt: `IntegrationLimitExceededError` (HTTP 409 `cap_exceeded`).

## Read-Time Stale Detection

- The `status` field on the doc is always `'active'` at write time.
- The read API (`/api/me/history`, `/api/me/uaam-result`) overrides response `status` to `'stale'` if:
  - For UAAM kind: user's latest committed Saikaku `latestAttemptId` ≠ doc's `saikakuAttemptId`.
  - For Saikaku kind: user's latest committed UAAM `latestAttemptId` ≠ doc's `uaamAttemptId`.
- The doc itself is NOT mutated by reads. Staleness is computed per request.

## Legacy Fallback (read-only)

- When `uaam_results/{uid}/integrations/` is empty, the read API checks the parent doc:
  1. `data['analysis.saikaku_integration']` (literal dotted top-level key — proof: `tests/api/firestore-merge-debug.test.js`)
  2. `data.analysis?.saikaku_integration` (nested fallback)
- If either exists, synthesize a read-only `integrationSummary` with `saikakuAttemptId: 'legacy-fallback'`, `uaamAttemptId: 'legacy-fallback'`, `status: 'active'`, `regenerationCount: 0`.
- The UI uses these `'legacy-fallback'` markers to show a "移行前データ — 再生成してください" banner.
- Reads NEVER write the legacy data to the subcollection. Migration is handled by `scripts/migrate-integrations-to-subcollection.mjs`.

## Pair Key Determinism

- `buildPairKey(saikakuAttemptId, uaamAttemptId)` (in `shared/integrationsKey.js`) joins with `__` separator.
- Throws on: reserved patterns matching `/^__.*__$/`, `/`, `.`, `..`, length > 1500 bytes, null/undefined/empty.
- Pure function (no Firestore SDK import).

## Pair Resolution for Multi-Pair (Phase 2 M-2)

- `selectIntegrationForAttempt(integrations, kind, attemptId)` (in `shared/attemptLogic.js`):
  - For `kind='uaam'`: returns the single integration whose `uaamAttemptId === attemptId`, sorted by `updatedAt` desc with `saikakuAttemptId` asc tiebreak. Returns `null` if none.
  - For `kind='saikaku'`: returns ALL integrations whose `saikakuAttemptId === attemptId` as an array, same sort order.
- Sort is deterministic — Firestore document order is NOT guaranteed.

## Recent Integration Summaries (issue #81)

- `/api/me/uaam-result` レスポンスに `recentIntegrationSummaries: SummaryShape[]` を**常に**含める。
- 構築フロー（`api/me/uaam-result.js`）:
  1. 既取得の `integrationsSnap` (= `listIntegrationDocs(integrationsSnap, data)`) を再利用し、追加の Firestore read は発生させない。
  2. 各 doc に `integrationSummary(doc, latestIds)` を適用する。**body 欠損 doc は `null` を返す既存仕様を保持**。
  3. `.filter(Boolean)` で null を除外。
  4. `generatedAt` (= `updatedAt ?? createdAt`) で**降順 client-side sort** (`timestampToMillis` で正規化、null は `-Infinity` 扱い)。Firestore `orderBy` は使わない (PR #72 [P2] 踏襲)。
  5. `.slice(0, 2)` で最大2件保証。
  6. legacy fallback doc の場合は `isLegacyFallback: true` を含めて返す。
- レスポンスの `serializeTimestamps` を必ず通すこと（Timestamp → ISO 8601 文字列）。
- `recentIntegrationSummaries[].integration` に**統合分析本体を同梱**する（UI 側 modal で表示するため）。レスポンス payload 増加は 2件分 = 数KB で許容範囲。
- 0件 (subcollection 空 / 全 body 欠損) のときは `[]` を返す。

### UI consumer responsibility (`src/screens/uaam/UAAMResultScreen.jsx`)

- `effectiveResult?.recentIntegrationSummaries ?? []` で読み取る（旧キャッシュ shape 防御）。
- `analysis.saikaku_integration?.integration_score === undefined` の **else 分岐**（生成ボタン表示状態）でのみ描画。`isHistoryView` (= `attemptData` あり) では描画しない。
- 行クリック / Enter / Space → `SaikakuIntegrationModal` を `kind="uaam"` + 単数 summary 渡しで起動。

## Migration Script

- File: `scripts/migrate-integrations-to-subcollection.mjs`.
- Default mode: `--dry-run` (no writes). Real writes require `--apply`.
- Idempotent: re-runs after `--apply` produce zero new writes. Existing subcollection docs are skipped with reason `already_migrated`.
- Pair resolution: `inferIntegrationAttemptPair()` in `shared/integrationsAttemptResolver.js` (pure, no I/O).
  - Strategy: latest committed attempt with `createdAt <= integrationUpdatedAt` per kind. Strict `<` was changed to `<=` because ms-precision timestamps make ties realistic.
  - Returns `{ saikakuAttemptId, uaamAttemptId, source: 'inferred' | 'saikaku-fallback' | 'uaam-fallback' | 'both-fallback' }`.
- Migrated docs use `model: 'legacy-migration'` so they are distinguishable from real generation runs.
- Source labels: real attempt label when resolvable; literal string `'legacy-fallback'` otherwise.

## Error Response Shape (Phase 2 M-6)

| HTTP | code | When |
|------|------|------|
| 422 | `invalid_input` | bad attemptId (`/`, `..`, reserved `__...__`), missing diagnosis data |
| 409 | `lock_conflict` | concurrent generation in progress, or stale-lock takeover from a different request |
| 409 | `cap_exceeded` | regenerationCount already 1 |
| 504 | `upstream_timeout` | LLM call exceeded 9.5min (lock window) |
| 500 | `internal_error` | unexpected error. Body contains only `{ code, requestId }`. Stack/message logged server-side with `requestId` for correlation |

## attemptId Validation (Phase 2 M-4)

- Shared predicate `isValidAttemptId(s)` in `shared/attemptLogic.js`.
- Regex: `/^[A-Za-z0-9_-]{1,128}$/`.
- Rejects reserved pattern `/^__.*__$/`.
- Used by `/api/integrate`, `/api/me/uaam-result`, `/api/me/history/[id]`. Bad input → HTTP 422 `invalid_input`.
