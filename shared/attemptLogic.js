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

  const ms = Number(value);
  return Number.isFinite(ms) ? ms : null;
}

function createdAtMillis(attempt) {
  return timestampToMillis(attempt?.createdAt);
}

export function legacyDocToAttempt(parentData, kind) {
  if (!parentData) return null;

  if (kind === 'saikaku') {
    if (!parentData.result) return null;

    return {
      id: 'legacy-fallback',
      isLegacy: true,
      status: 'committed',
      createdAt: parentData.createdAt ?? null,
      summary: {
        kakuchiiki: parentData.result?.kakuchiiki ?? parentData.selectedKakuchiiki ?? null,
        createdAt: parentData.createdAt ?? null,
      },
      full: {
        result: parentData.result,
        analysis: null,
        scores: null,
        selectedKakuchiiki: parentData.selectedKakuchiiki ?? null,
      },
      raw: { input: {} },
    };
  }

  if (!parentData.scores && !parentData.analysis) return null;

  return {
    id: 'legacy-fallback',
    isLegacy: true,
    status: 'committed',
    createdAt: parentData.createdAt ?? null,
    summary: {
      typeName: parentData.analysis?.type_name ?? null,
      createdAt: parentData.createdAt ?? null,
    },
    full: {
      result: null,
      analysis: parentData.analysis ?? null,
      scores: parentData.scores ?? null,
    },
    raw: {
      input: {
        answers: parentData.answers ?? {},
        vAnswers: parentData.vAnswers ?? {},
      },
    },
  };
}

export function summarizeFromParent(parentData) {
  const data = parentData ?? {};
  const hasPending = !!data.pendingAttemptId;
  const hasResult = !!(data.result || data.scores || data.analysis);
  const rawCommitted = (data.attemptCount ?? 0) - (hasPending ? 1 : 0);
  const legacyFloor = hasResult ? 1 : 0;
  const committedCount = Math.max(rawCommitted, legacyFloor);
  const isStartBlocked = hasPending || committedCount >= 2;

  return {
    committedCount,
    attemptCount: committedCount,
    hasPending,
    pendingAttemptId: data.pendingAttemptId ?? null,
    hasResult,
    isStartBlocked,
  };
}

export function listFromAttempts(attemptDocs, parentData, kind) {
  const committed = attemptDocs
    .filter((attempt) => attempt.status === 'committed')
    .sort((a, b) => {
      const ta = createdAtMillis(a);
      const tb = createdAtMillis(b);
      if (ta === null && tb === null) return 0;
      if (ta === null) return 1;
      if (tb === null) return -1;
      return tb - ta;
    });

  let committedAttempts = committed;
  if (attemptDocs.length === 0) {
    const synth = legacyDocToAttempt(parentData, kind);
    if (synth) committedAttempts = [synth];
  }

  const pendingAttempt = attemptDocs.find((attempt) => (
    attempt.status === 'pending' && attempt.id === parentData?.pendingAttemptId
  )) ?? null;

  return { committedAttempts, pendingAttempt };
}

export { timestampToMillis };
