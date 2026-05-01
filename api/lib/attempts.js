import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firebaseAdmin.js';

export class LimitExceededError extends Error {
  constructor(message = '診断は最大2回までです') {
    super(message);
    this.name = 'LimitExceededError';
    this.status = 429;
  }
}

export class ConflictError extends Error {
  constructor(message = '処理中のリクエストがあります') {
    super(message);
    this.name = 'ConflictError';
    this.status = 409;
  }
}

export async function reserveAttempt({ collection, uid, kind }) {
  const docRef = db.collection(collection).doc(uid);

  return await db.runTransaction(async (tx) => {
    const cur = await tx.get(docRef);
    const data = cur.exists ? cur.data() : {};

    if (data.pendingAttemptId) {
      throw new ConflictError('処理中のリクエストがあります');
    }

    let count = data.attemptCount ?? 0;

    if (count === 0 && (data.result || data.analysis)) {
      const legacyRef = docRef.collection('attempts').doc('legacy-v1');
      const legacySnap = await tx.get(legacyRef);
      if (!legacySnap.exists) {
        tx.set(legacyRef, {
          summary: extractSummary(data, kind),
          full: extractFull(data, kind),
          raw: extractRaw(data, kind),
          status: 'committed',
          isLegacy: true,
          createdAt: data.createdAt ?? FieldValue.serverTimestamp(),
        });
      }
      count = 1;
    }

    if (count >= 2) {
      throw new LimitExceededError('診断は最大2回までです');
    }

    const newAttemptRef = docRef.collection('attempts').doc();
    tx.set(newAttemptRef, {
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.set(
      docRef,
      {
        attemptCount: count + 1,
        pendingAttemptId: newAttemptRef.id,
        updatedAt: FieldValue.serverTimestamp(),
        ...(!data.createdAt ? { createdAt: FieldValue.serverTimestamp() } : {}),
      },
      { merge: true }
    );

    return { attemptId: newAttemptRef.id };
  });
}

export async function commitAttempt({ collection, uid, attemptId, summary, full, raw, parentMerge }) {
  const docRef = db.collection(collection).doc(uid);
  const attemptRef = docRef.collection('attempts').doc(attemptId);

  await db.runTransaction(async (tx) => {
    const cur = await tx.get(docRef);
    const data = cur.exists ? cur.data() : {};

    if (data.pendingAttemptId !== attemptId) {
      throw new ConflictError('reservation mismatch');
    }

    tx.set(
      attemptRef,
      {
        summary,
        full,
        raw,
        status: 'committed',
      },
      { merge: true }
    );

    tx.set(
      docRef,
      {
        ...parentMerge,
        pendingAttemptId: null,
        latestAttemptId: attemptId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

export async function rollbackAttempt({ collection, uid, attemptId }) {
  const docRef = db.collection(collection).doc(uid);
  const attemptRef = docRef.collection('attempts').doc(attemptId);

  await db.runTransaction(async (tx) => {
    const cur = await tx.get(docRef);
    const data = cur.exists ? cur.data() : {};

    if (data.pendingAttemptId !== attemptId) {
      return;
    }

    tx.delete(attemptRef);
    tx.set(
      docRef,
      {
        attemptCount: FieldValue.increment(-1),
        pendingAttemptId: null,
      },
      { merge: true }
    );
  });
}

function extractSummary(data, kind) {
  if (kind === 'saikaku') {
    return {
      kakuchiiki: data?.result?.kakuchiiki ?? data?.selectedKakuchiiki ?? null,
      typeName: null,
      createdAt: data?.createdAt ?? null,
    };
  }

  return {
    typeName: data?.analysis?.type_name ?? null,
    createdAt: data?.createdAt ?? null,
  };
}

function extractFull(data, kind) {
  if (kind === 'saikaku') {
    return {
      result: data?.result ?? null,
      analysis: null,
      scores: null,
      selectedKakuchiiki: data?.selectedKakuchiiki ?? null,
    };
  }

  return {
    result: null,
    analysis: data?.analysis ?? null,
    scores: data?.scores ?? null,
  };
}

function extractRaw(data, kind) {
  if (kind === 'saikaku') {
    return {
      input: {
        talent: data?.inputTalent ?? '',
        value: data?.inputValue ?? '',
        passion: data?.inputPassion ?? '',
        talentTop5: data?.inputTalentTop5 ?? '',
        talentOther: data?.inputTalentOther ?? '',
        valueTop5: data?.inputValueTop5 ?? '',
        valueOther: data?.inputValueOther ?? '',
        passionTop5: data?.inputPassionTop5 ?? '',
        passionOther: data?.inputPassionOther ?? '',
        q1: data?.inputQ1 ?? '',
        q2: data?.inputQ2 ?? '',
        q3: data?.inputQ3 ?? '',
      },
    };
  }

  return {
    input: {
      answers: data?.answers ?? null,
      vAnswers: data?.vAnswers ?? null,
    },
  };
}
