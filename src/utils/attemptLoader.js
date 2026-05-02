import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { legacyDocToAttempt } from './attemptAdapter';

function createdAtMillis(attempt) {
  const value = attempt?.createdAt;
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();

  const ms = Number(value);
  return Number.isFinite(ms) ? ms : null;
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

export async function loadAttemptDetails({ db, uid, kind }) {
  const collName = kind === 'uaam' ? 'uaam_results' : 'results';
  const parentRef = doc(db, collName, uid);

  const [parentSnap, attemptsSnap] = await Promise.all([
    getDoc(parentRef),
    getDocs(collection(parentRef, 'attempts')),
  ]);

  const parentData = parentSnap.exists() ? parentSnap.data() : null;
  const attemptDocs = attemptsSnap.docs.map((attempt) => ({
    id: attempt.id,
    ...attempt.data(),
  }));
  const { committedAttempts, pendingAttempt } = listFromAttempts(attemptDocs, parentData, kind);
  const summary = summarizeFromParent(parentData);

  return { committedAttempts, pendingAttempt, summary };
}
