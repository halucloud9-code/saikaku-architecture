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
  if (Number.isFinite(ms)) return ms;

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

const ATTEMPT_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const RESERVED_ATTEMPT_ID_RE = /^__.*__$/;

export function isValidAttemptId(value) {
  return typeof value === 'string'
    && ATTEMPT_ID_RE.test(value)
    && !RESERVED_ATTEMPT_ID_RE.test(value);
}

function createdAtMillis(attempt) {
  return timestampToMillis(attempt?.createdAt);
}

function integrationUpdatedMillis(integration) {
  return timestampToMillis(integration?.updatedAt)
    ?? timestampToMillis(integration?.createdAt)
    ?? Number.NEGATIVE_INFINITY;
}

function compareIntegrationMatches(a, b, attemptIdField) {
  const ta = integrationUpdatedMillis(a);
  const tb = integrationUpdatedMillis(b);
  if (ta !== tb) return tb - ta;

  const attemptCompare = String(a?.[attemptIdField] ?? '')
    .localeCompare(String(b?.[attemptIdField] ?? ''));
  if (attemptCompare !== 0) return attemptCompare;

  return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
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
      // bias_message は null（健全）と undefined（未保存）を区別するため `?? null` で潰さない
      bias_message: parentData.bias_message,
      personality_level: parentData.personality_level ?? null,
      leadership_stage: parentData.leadership_stage ?? null,
      three_elements: parentData.three_elements ?? null,
      name: parentData.name ?? null,
      coach_confirmed_personality_level: parentData.coach_confirmed_personality_level ?? null,
      coach_confirmed_leadership_stage: parentData.coach_confirmed_leadership_stage ?? null,
      coach_observation_note: parentData.coach_observation_note ?? null,
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

export function summarizeFromAttemptsAndParent(attemptDocs, parentData) {
  const data = parentData ?? {};
  const attempts = Array.isArray(attemptDocs) ? attemptDocs : [];
  const pendingAttemptId = data.pendingAttemptId ?? null;
  const hasPending = !!pendingAttemptId && attempts.some((attempt) => (
    attempt.id === pendingAttemptId && attempt.status === 'pending'
  ));
  const hasResult = !!(data.result || data.scores || data.analysis);
  const legacyFloor = hasResult ? 1 : 0;
  const committedCount = Math.max(
    attempts.filter((attempt) => attempt.status === 'committed').length,
    legacyFloor,
  );

  return {
    committedCount,
    attemptCount: committedCount,
    hasPending,
    pendingAttemptId: hasPending ? pendingAttemptId : null,
    hasResult,
    isStartBlocked: hasPending || committedCount >= 2,
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

export function selectIntegrationForAttempt(integrations, kind, attemptId) {
  const list = Array.isArray(integrations) ? integrations : [];

  if (kind === 'uaam') {
    return list
      .filter((integration) => integration?.uaamAttemptId === attemptId)
      .sort((a, b) => compareIntegrationMatches(a, b, 'saikakuAttemptId'))[0]
      ?? null;
  }

  if (kind === 'saikaku') {
    return list
      .filter((integration) => integration?.saikakuAttemptId === attemptId)
      .sort((a, b) => compareIntegrationMatches(a, b, 'uaamAttemptId'));
  }

  return kind === 'saikaku' ? [] : null;
}

export { timestampToMillis };
