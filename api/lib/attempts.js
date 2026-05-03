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

const RESERVATION_LOCK_ID = 'reservation';
const RESERVATION_LOCK_TTL_MS = 10 * 60 * 1000;

/**
 * @typedef {Object} ProtectedNestedField
 * @property {string} collection - Firestore collection name (e.g. 'uaam_results')
 * @property {string} path - Dot-separated path to the protected subfield (e.g. 'analysis.saikaku_integration')
 */

/**
 * Sub-fields whose existing values must be preserved across commitAttempt() calls.
 *
 * Background: commitAttempt() writes parent docs with tx.set(ref, parentMerge, { merge: true }).
 * Firestore's { merge: true } only deep-merges TOP-LEVEL fields. Nested map values are replaced
 * wholesale. So passing parentMerge.analysis = { type_name: 'X' } silently destroys
 * sibling subfields like analysis.saikaku_integration that were written via field-path notation.
 *
 * To prevent regressions, list any nested subfield owned by a different code path here. The
 * commitAttempt transaction will read the existing value from the parent doc and reinject it
 * into parentMerge before the set, so the subfield survives.
 *
 * @type {ProtectedNestedField[]}
 */
const PROTECTED_NESTED_FIELDS = [
  { collection: 'uaam_results', path: 'analysis.saikaku_integration' },
  // NOTE: api/analyze.js also writes parentMerge.result on the saikaku side. If a separate code
  // path ever writes a sub-field of `result.*` for saikaku, add it here to prevent the same bug.
];

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isObjectMap(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function getByPath(obj, path) {
  return path.split('.').reduce((current, key) => {
    if (!isObjectMap(current) || !hasOwn(current, key)) return undefined;
    return current[key];
  }, obj);
}

function setByPath(target, path, value) {
  const parts = path.split('.');
  let current = target;

  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    current[key] = isObjectMap(current[key]) ? { ...current[key] } : {};
    current = current[key];
  }

  current[parts[parts.length - 1]] = value;
}

function protectNestedFields(collection, parentMerge, existingData) {
  if (!isObjectMap(parentMerge)) return parentMerge;

  let protectedParentMerge = parentMerge;

  for (const { collection: protectedCollection, path } of PROTECTED_NESTED_FIELDS) {
    if (protectedCollection !== collection) continue;

    const [topLevelKey] = path.split('.');
    if (!hasOwn(parentMerge, topLevelKey) || !isObjectMap(parentMerge[topLevelKey])) continue;
    if (getByPath(parentMerge, path) !== undefined) continue;

    const existingValue = getByPath(existingData, path);
    if (existingValue === undefined) continue;

    if (protectedParentMerge === parentMerge) {
      protectedParentMerge = { ...parentMerge };
    }

    setByPath(protectedParentMerge, path, existingValue);
  }

  return protectedParentMerge;
}

function lockExpired(lockData) {
  const acquiredAt = lockData?.acquiredAt;
  if (!acquiredAt) return false;
  const acquiredMs = typeof acquiredAt.toMillis === 'function'
    ? acquiredAt.toMillis()
    : new Date(acquiredAt).getTime();
  if (!Number.isFinite(acquiredMs)) return false;
  return Date.now() - acquiredMs > RESERVATION_LOCK_TTL_MS;
}

export async function reserveAttempt({ collection, uid, kind }) {
  const docRef = db.collection(collection).doc(uid);
  const lockRef = docRef.collection('_locks').doc(RESERVATION_LOCK_ID);

  return await db.runTransaction(async (tx) => {
    const cur = await tx.get(docRef);
    const lockSnap = await tx.get(lockRef);
    const data = cur.exists ? cur.data() : {};

    const lockHeld = lockSnap.exists && !lockExpired(lockSnap.data());
    if (lockHeld || data.pendingAttemptId) {
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
    const lockData = {
      attemptId: newAttemptRef.id,
      acquiredAt: FieldValue.serverTimestamp(),
    };
    if (lockSnap.exists) {
      tx.set(lockRef, lockData);
    } else {
      tx.create(lockRef, lockData);
    }
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

/**
 * Commits a previously-reserved attempt: marks the attempt doc as committed and merges
 * parentMerge into the parent doc.
 *
 * IMPORTANT: parentMerge is written with { merge: true }. Firestore's merge semantics only
 * deep-merge TOP-LEVEL fields. Any nested map you pass as a value (e.g. parentMerge.analysis)
 * REPLACES the existing map at that key, dropping sibling subfields.
 *
 * If you need to preserve a sibling subfield owned by a different writer (e.g. analysis.saikaku_integration
 * written by api/integrate.js via field-path notation), add it to PROTECTED_NESTED_FIELDS at the top of
 * this file. Otherwise it will be silently overwritten on every commit.
 *
 * @param {Object} args
 * @param {string} args.collection
 * @param {string} args.uid
 * @param {string} args.attemptId
 * @param {Object} args.summary
 * @param {Object} args.full
 * @param {Object} args.raw
 * @param {Object} args.parentMerge
 */
export async function commitAttempt({ collection, uid, attemptId, summary, full, raw, parentMerge }) {
  const docRef = db.collection(collection).doc(uid);
  const attemptRef = docRef.collection('attempts').doc(attemptId);
  const lockRef = docRef.collection('_locks').doc(RESERVATION_LOCK_ID);

  await db.runTransaction(async (tx) => {
    const cur = await tx.get(docRef);
    const data = cur.exists ? cur.data() : {};

    if (data.pendingAttemptId !== attemptId) {
      throw new ConflictError('reservation mismatch');
    }

    const protectedParentMerge = protectNestedFields(collection, parentMerge, data);

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
        ...protectedParentMerge,
        pendingAttemptId: null,
        latestAttemptId: attemptId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    tx.delete(lockRef);
  });
}

export async function rollbackAttempt({ collection, uid, attemptId }) {
  const docRef = db.collection(collection).doc(uid);
  const attemptRef = docRef.collection('attempts').doc(attemptId);
  const lockRef = docRef.collection('_locks').doc(RESERVATION_LOCK_ID);

  await db.runTransaction(async (tx) => {
    const cur = await tx.get(docRef);
    const data = cur.exists ? cur.data() : {};

    if (data.pendingAttemptId !== attemptId) {
      return;
    }

    tx.delete(attemptRef);
    tx.delete(lockRef);
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

export function extractSummary(data, kind) {
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

export function extractFull(data, kind) {
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

export function extractRaw(data, kind) {
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
