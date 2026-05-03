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
