export function attemptToResultProps(attempt, kind) {
  if (!attempt) return null;

  if (kind === 'saikaku') {
    const result = attempt.full?.result ?? null;
    if (!result) return null;

    return {
      result: {
        ...result,
        selectedKakuchiiki: attempt.full?.selectedKakuchiiki ?? result.kakuchiiki,
      },
    };
  }

  return {
    result: {
      scores: attempt.full?.scores ?? null,
      analysis: attempt.full?.analysis ?? null,
      answers: attempt.raw?.input?.answers ?? {},
      vAnswers: attempt.raw?.input?.vAnswers ?? {},
    },
  };
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
