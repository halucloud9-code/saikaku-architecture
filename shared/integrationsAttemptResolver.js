// Attempt inference treats an integration timestamp equal to an attempt commit
// timestamp as valid because Firestore timestamps are compared at millisecond
// precision here. Invariant: integration is generated at or after the attempts
// it combines.
function timestampToMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();

  const seconds = value._seconds ?? value.seconds;
  const nanoseconds = value._nanoseconds ?? value.nanoseconds ?? 0;
  if (typeof seconds === 'number') {
    return (seconds * 1000) + Math.floor(nanoseconds / 1000000);
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const ms = Number(value);
  return Number.isFinite(ms) ? ms : null;
}

function compareAttemptsByCreatedAtAsc(a, b) {
  const ta = timestampToMillis(a?.createdAt);
  const tb = timestampToMillis(b?.createdAt);
  if (ta === null && tb === null) return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
  if (ta === null) return 1;
  if (tb === null) return -1;
  if (ta !== tb) return ta - tb;
  return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
}

function latestCommittedBefore(attempts, cutoffMillis) {
  if (cutoffMillis === null) return null;

  const committed = (Array.isArray(attempts) ? attempts : [])
    .filter((attempt) => attempt?.status === 'committed')
    .sort(compareAttemptsByCreatedAtAsc);

  let selected = null;
  for (const attempt of committed) {
    const createdAtMillis = timestampToMillis(attempt?.createdAt);
    if (createdAtMillis === null) continue;
    if (createdAtMillis <= cutoffMillis) {
      selected = attempt;
      continue;
    }
    break;
  }

  return selected?.id ?? null;
}

function sourceFor(saikakuAttemptId, uaamAttemptId) {
  if (!saikakuAttemptId && !uaamAttemptId) return 'both-fallback';
  if (!saikakuAttemptId) return 'saikaku-fallback';
  if (!uaamAttemptId) return 'uaam-fallback';
  return 'inferred';
}

export function inferIntegrationAttemptPair({
  uid,
  integrationUpdatedAt,
  saikakuAttempts,
  uaamAttempts,
}) {
  void uid;

  const cutoffMillis = timestampToMillis(integrationUpdatedAt);
  const saikakuAttemptId = latestCommittedBefore(saikakuAttempts, cutoffMillis);
  const uaamAttemptId = latestCommittedBefore(uaamAttempts, cutoffMillis);

  return {
    saikakuAttemptId,
    uaamAttemptId,
    source: sourceFor(saikakuAttemptId, uaamAttemptId),
  };
}
