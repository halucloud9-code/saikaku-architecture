export { legacyDocToAttempt } from '../../shared/attemptLogic.js';

function normalizeLeadershipStage(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  const match = String(value).match(/\d+/);
  const stage = match ? Number(match[0]) : 1;
  return { stage, name: String(value) };
}

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
      name: attempt.full?.name ?? null,
      // bias_message は null（= 健全、表示なし）と undefined（= 未保存 legacy、要再計算）を
      // UI 側で区別する。`?? null` で潰すと健全の null と legacy の undefined を区別できなくなる。
      bias_message: attempt.full?.bias_message,
      personality_level: attempt.full?.personality_level ?? null,
      leadership_stage: normalizeLeadershipStage(attempt.full?.leadership_stage),
      three_elements: attempt.full?.three_elements ?? null,
      coach_confirmed_personality_level: attempt.full?.coach_confirmed_personality_level ?? null,
      // ActivationPanel が `第${coachConfirmed.leadership_stage}` のように scalar として参照するため正規化しない
      coach_confirmed_leadership_stage: attempt.full?.coach_confirmed_leadership_stage ?? null,
      coach_observation_note: attempt.full?.coach_observation_note ?? null,
      recentIntegrationSummaries: attempt.recentIntegrationSummaries ?? null,
    },
  };
}
