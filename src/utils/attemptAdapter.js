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
