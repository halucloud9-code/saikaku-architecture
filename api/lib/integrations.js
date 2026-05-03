import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { buildPairKey } from '../../shared/integrationsKey.js';
import { db } from './firebaseAdmin.js';

// MUST stay aligned with api/lib/attempts.js RESERVATION_LOCK_TTL_MS.
export const LOCK_TTL_MS = 10 * 60 * 1000;
export const RESERVATION_LOCK_TTL_MS = LOCK_TTL_MS;

export class IntegrationConflictError extends Error {
  constructor(message = '同じ組み合わせの統合分析を生成中です') {
    super(message);
    this.name = 'ConflictError';
    this.status = 409;
  }
}

export class IntegrationLimitExceededError extends Error {
  constructor(message = '統合分析は同じ組み合わせにつき最大2回までです') {
    super(message);
    this.name = 'LimitExceededError';
    this.status = 409;
  }
}

function lockExpired(lockData) {
  const acquiredAt = lockData?.acquiredAt;
  if (!acquiredAt) return false;
  const acquiredMs = typeof acquiredAt.toMillis === 'function'
    ? acquiredAt.toMillis()
    : new Date(acquiredAt).getTime();
  if (!Number.isFinite(acquiredMs)) return false;
  return Date.now() - acquiredMs > LOCK_TTL_MS;
}

export function deriveIntegrationPairKey(saikakuAttemptId, uaamAttemptId) {
  return buildPairKey(saikakuAttemptId, uaamAttemptId);
}

function refsFor(uid, pairKey) {
  const parentRef = db.collection('uaam_results').doc(uid);
  return {
    parentRef,
    integrationRef: parentRef.collection('integrations').doc(pairKey),
    lockRef: parentRef.collection('_locks').doc(`integration-${pairKey}`),
  };
}

export async function acquireIntegrationLock({ uid, pairKey, ownerId = randomUUID() }) {
  const { integrationRef, lockRef } = refsFor(uid, pairKey);

  await db.runTransaction(async (tx) => {
    const lockSnap = await tx.get(lockRef);
    const integrationSnap = await tx.get(integrationRef);

    const lockHeld = lockSnap.exists && !lockExpired(lockSnap.data());
    if (lockHeld) {
      throw new IntegrationConflictError('同じ組み合わせの統合分析を生成中です');
    }

    if (integrationSnap.exists && (integrationSnap.data()?.regenerationCount ?? 0) >= 1) {
      throw new IntegrationLimitExceededError('統合分析は同じ組み合わせにつき最大2回までです');
    }

    const lockData = {
      pairKey,
      ownerId,
      acquiredAt: FieldValue.serverTimestamp(),
    };
    if (lockSnap.exists) {
      tx.set(lockRef, lockData);
    } else {
      tx.create(lockRef, lockData);
    }
  });

  return { pairKey, ownerId, lockRef };
}

export async function releaseIntegrationLock({ uid, pairKey, ownerId }) {
  const { lockRef } = refsFor(uid, pairKey);

  await db.runTransaction(async (tx) => {
    const lockSnap = await tx.get(lockRef);
    if (!lockSnap.exists) return;
    if (lockSnap.data()?.ownerId !== ownerId) return;
    tx.delete(lockRef);
  });
}

export async function commitIntegration({
  uid,
  pairKey,
  saikakuAttemptId,
  uaamAttemptId,
  integration,
  model,
  source,
  ownerId,
}) {
  const expectedPairKey = deriveIntegrationPairKey(saikakuAttemptId, uaamAttemptId);
  if (pairKey !== expectedPairKey) {
    throw new Error('pairKey mismatch');
  }
  if (!ownerId) {
    throw new IntegrationConflictError('統合分析のロックが失効しました。再度お試しください');
  }

  const { parentRef, integrationRef, lockRef } = refsFor(uid, pairKey);

  const regenerationCount = await db.runTransaction(async (tx) => {
    const lockSnap = await tx.get(lockRef);
    const integrationSnap = await tx.get(integrationRef);
    const lockData = lockSnap.exists ? lockSnap.data() : null;
    if (!lockSnap.exists || lockData?.ownerId !== ownerId || lockExpired(lockData)) {
      throw new IntegrationConflictError('統合分析のロックが失効しました。再度お試しください');
    }
    const now = FieldValue.serverTimestamp();

    if (integrationSnap.exists) {
      const currentCount = integrationSnap.data()?.regenerationCount ?? 0;
      if (currentCount >= 1) {
        throw new IntegrationLimitExceededError('統合分析は同じ組み合わせにつき最大2回までです');
      }

      const nextCount = currentCount + 1;
      // Use update() for existing integration docs. Dotted-key set(..., { merge: true }) is banned.
      tx.update(integrationRef, {
        saikakuAttemptId,
        uaamAttemptId,
        integration,
        regenerationCount: nextCount,
        model,
        source,
        status: 'active',
        updatedAt: now,
      });
      // Parent fast-flag only; never write analysis.saikaku_integration here.
      tx.update(parentRef, { hasSaikakuIntegration: true });
      tx.delete(lockRef);
      return nextCount;
    }

    // First write uses a nested-object merge set. Dotted-key set(..., { merge: true }) is banned.
    tx.set(
      integrationRef,
      {
        saikakuAttemptId,
        uaamAttemptId,
        integration,
        regenerationCount: 0,
        model,
        source,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
    // Parent fast-flag only; never write analysis.saikaku_integration here.
    tx.update(parentRef, { hasSaikakuIntegration: true });
    tx.delete(lockRef);
    return 0;
  });

  return { pairKey, regenerationCount };
}
