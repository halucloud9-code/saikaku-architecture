import { beforeEach, describe, expect, it } from 'vitest';
import {
  FieldValue,
  Timestamp,
  clearUserState,
  db,
  getParent,
  listAttempts,
  seedAttempt,
  seedParent,
} from './_helpers.js';
import { applyRecomputeBatch, recomputeUaamUid } from '../../scripts/recalculate-uaam-q42.mjs';
import { QUESTIONS, calculateScores } from '../../shared/uaamQuestions.js';

const COLLECTION = 'uaam_results';
const RECOMPUTE_REASON = 'issue-9-q42-v1';
const TEST_UIDS = [
  'u-q42-mig-1',
  'u-q42-mig-2',
  'u-q42-mig-3',
  'u-q42-mig-4',
  'u-q42-mig-5',
  'u-q42-mig-6a',
  'u-q42-mig-6b',
];

function answersWithQ42Five(overrides = {}) {
  const answers = Object.fromEntries(QUESTIONS.map((question) => [String(question.id), 3]));
  return { ...answers, 42: 5, ...overrides };
}

function correctScores(answers) {
  return calculateScores(answers, QUESTIONS);
}

function staleBuggyScores(answers) {
  const buggyQuestions = QUESTIONS.map((question) => (
    question.id === 42 ? { ...question, reverse: false } : question
  ));
  return calculateScores(answers, buggyQuestions);
}

async function seedRecomputableAttempt(
  uid,
  {
    attemptId = 'a1',
    latestAttemptId = attemptId,
    answers = answersWithQ42Five(),
    parentNarrative = 'old narrative',
    attemptNarrative = 'old narrative',
    createdAt = Timestamp.fromDate(new Date('2026-05-01T00:00:00.000Z')),
  } = {},
) {
  const oldScores = staleBuggyScores(answers);

  await seedParent(COLLECTION, uid, {
    uid,
    name: `Q42 ${uid}`,
    email: `${uid}@example.com`,
    latestAttemptId,
    attemptCount: 1,
    scores: oldScores,
    analysis: { narrative: parentNarrative },
    createdAt,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await seedAttempt(COLLECTION, uid, attemptId, {
    status: 'committed',
    createdAt,
    summary: { typeName: 'Seeded UAAM' },
    raw: {
      input: {
        answers,
        vAnswers: { V1: 3, V2: 3, V3: 3 },
      },
    },
    full: {
      result: { type: 'seeded' },
      analysis: { narrative: attemptNarrative },
      scores: oldScores,
    },
  });

  return { answers, oldScores };
}

async function readAttempt(uid, attemptId) {
  const attempts = await listAttempts(COLLECTION, uid);
  return attempts.find((attempt) => attempt.id === attemptId);
}

describe('UAAM Q42 migration script', () => {
  beforeEach(async () => {
    await Promise.all(TEST_UIDS.map((uid) => clearUserState(COLLECTION, uid)));
  });

  it('commit updates attempt + parent for latest attempt', async () => {
    const uid = 'u-q42-mig-1';
    const { oldScores } = await seedRecomputableAttempt(uid);

    const plan = await recomputeUaamUid(uid, { db });
    expect(plan.attempts).toHaveLength(1);
    expect(plan.attempts[0]).toMatchObject({
      aid: 'a1',
      competencyDiff: 46 - oldScores.competency.total,
      parentWillUpdate: true,
      skipped: false,
    });

    const result = await applyRecomputeBatch(uid, plan, { commit: true });
    expect(result).toMatchObject({ committed: 1, parentUpdated: 1 });

    const attempt = await readAttempt(uid, 'a1');
    expect(attempt.full.scores.competency.total).toBe(46);
    expect(attempt.full.scores.competency.subs.communication).toBe(10);
    expect(attempt.q42_recompute.narrative_may_be_stale).toBe(true);
    expect(attempt.q42_recompute.recomputeReason).toBe(RECOMPUTE_REASON);
    expect(attempt.q42_recompute.oldScores).toEqual(oldScores);

    const parent = await getParent(COLLECTION, uid);
    expect(parent.scores.competency.total).toBe(46);
    expect(parent.q42_recompute.narrative_may_be_stale).toBe(true);
  });

  it('dry-run does not write', async () => {
    const uid = 'u-q42-mig-2';
    const { oldScores } = await seedRecomputableAttempt(uid);

    const plan = await recomputeUaamUid(uid, { db });
    expect(plan.attempts[0].hasDiff).toBe(true);

    const result = await applyRecomputeBatch(uid, plan, { commit: false });
    expect(result.committed).toBe(0);
    expect(result.plannedAttempts).toBeGreaterThanOrEqual(1);

    const attempt = await readAttempt(uid, 'a1');
    expect(attempt.full.scores).toEqual(oldScores);
    expect(attempt).not.toHaveProperty('q42_recompute');

    const parent = await getParent(COLLECTION, uid);
    expect(parent.scores).toEqual(oldScores);
    expect(parent).not.toHaveProperty('q42_recompute');
  });

  it('idempotent re-run skips already-recomputed', async () => {
    const uid = 'u-q42-mig-3';
    const { oldScores } = await seedRecomputableAttempt(uid);
    await seedAttempt(COLLECTION, uid, 'a1', {
      q42_recompute: {
        narrative_may_be_stale: true,
        recomputeReason: RECOMPUTE_REASON,
        oldScores: null,
        recomputedAt: Timestamp.now(),
      },
    });

    const plan = await recomputeUaamUid(uid, { db });
    expect(plan.attempts).toHaveLength(1);
    expect(plan.attempts[0]).toMatchObject({
      skipped: true,
      note: 'already-recomputed',
      oldScores,
    });

    const result = await applyRecomputeBatch(uid, plan, { commit: true });
    expect(result).toMatchObject({ committed: 0, plannedAttempts: 0 });
  });

  it('parent doc only updated for latestAttemptId match', async () => {
    const uid = 'u-q42-mig-4';
    const oldAnswers = answersWithQ42Five({ 41: 5 });
    const newAnswers = answersWithQ42Five();
    const oldCreatedAt = Timestamp.fromDate(new Date('2026-05-01T00:00:00.000Z'));
    const newCreatedAt = Timestamp.fromDate(new Date('2026-05-02T00:00:00.000Z'));

    await seedRecomputableAttempt(uid, {
      attemptId: 'a-old',
      latestAttemptId: 'a-new',
      answers: oldAnswers,
      createdAt: oldCreatedAt,
    });
    await seedAttempt(COLLECTION, uid, 'a-new', {
      status: 'committed',
      createdAt: newCreatedAt,
      raw: { input: { answers: newAnswers, vAnswers: { V1: 3, V2: 3, V3: 3 } } },
      full: {
        analysis: { narrative: 'new attempt narrative' },
        scores: staleBuggyScores(newAnswers),
      },
    });

    const plan = await recomputeUaamUid(uid, { db });
    expect(plan.attempts).toHaveLength(2);
    expect(plan.attempts.find((attempt) => attempt.aid === 'a-old').parentWillUpdate).toBe(false);
    expect(plan.attempts.find((attempt) => attempt.aid === 'a-new').parentWillUpdate).toBe(true);

    const result = await applyRecomputeBatch(uid, plan, { commit: true });
    expect(result).toMatchObject({ committed: 2, parentUpdated: 1 });

    const oldAttempt = await readAttempt(uid, 'a-old');
    const newAttempt = await readAttempt(uid, 'a-new');
    expect(oldAttempt.full.scores).toEqual(correctScores(oldAnswers));
    expect(newAttempt.full.scores).toEqual(correctScores(newAnswers));

    const parent = await getParent(COLLECTION, uid);
    expect(parent.scores).toEqual(correctScores(newAnswers));
    expect(parent.scores.competency.total).toBe(46);
  });

  it('narrative text is NOT modified', async () => {
    const uid = 'u-q42-mig-5';
    await seedRecomputableAttempt(uid, {
      parentNarrative: 'old narrative',
      attemptNarrative: 'old attempt narrative',
    });

    const plan = await recomputeUaamUid(uid, { db });
    await applyRecomputeBatch(uid, plan, { commit: true });

    const parent = await getParent(COLLECTION, uid);
    expect(parent.analysis.narrative).toBe('old narrative');

    const attempt = await readAttempt(uid, 'a1');
    expect(attempt.full.analysis.narrative).toBe('old attempt narrative');
  });

  it('uid filter keeps separate uids from interfering', async () => {
    const uidA = 'u-q42-mig-6a';
    const uidB = 'u-q42-mig-6b';
    const { oldScores: oldScoresA } = await seedRecomputableAttempt(uidA);
    const { oldScores: oldScoresB } = await seedRecomputableAttempt(uidB);

    const plan = await recomputeUaamUid(uidA, { db });
    await applyRecomputeBatch(uidA, plan, { commit: true });

    const attemptA = await readAttempt(uidA, 'a1');
    expect(attemptA.full.scores).toEqual(correctScores(answersWithQ42Five()));
    expect(attemptA.full.scores).not.toEqual(oldScoresA);
    expect(attemptA).toHaveProperty('q42_recompute');

    const attemptB = await readAttempt(uidB, 'a1');
    expect(attemptB.full.scores).toEqual(oldScoresB);
    expect(attemptB).not.toHaveProperty('q42_recompute');
  });
});
