import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/firebaseAdmin.js';
import {
  buildUaamPeerInviteUrl,
  isUaamPeerInviteActive,
  isUaamPeerInviteId,
  makeInviteExpiry,
  setUaamPeerNoStoreHeaders,
  timestampIso,
  timestampMillis,
  UAAM_QUESTION_VERSION,
} from '../lib/uaamPeer.js';
import { authenticateMeRequest, withMeHandler } from './_auth.js';

function apiError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function errorResponse(res, error) {
  return res.status(error.status ?? 500).json({
    code: error.code ?? 'internal_error',
    error: error.status ? error.message : '招待URLの操作に失敗しました',
  });
}

function isScores(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function attemptTime(data) {
  const candidates = [data?.answeredAt, data?.summary?.createdAt, data?.createdAt, data?.updatedAt];
  for (const candidate of candidates) {
    const millis = timestampMillis(candidate);
    if (Number.isFinite(millis)) return millis;
  }
  return Number.NEGATIVE_INFINITY;
}

function latestCommittedAttempt(attemptsSnapshot, preferredId) {
  const attempts = attemptsSnapshot.docs
    .filter((snapshot) => snapshot.data()?.status === 'committed')
    .map((snapshot) => ({ id: snapshot.id, data: snapshot.data() }));
  if (attempts.length === 0) return null;

  const preferred = attempts.find((attempt) => attempt.id === preferredId);
  if (preferred) return preferred;

  attempts.sort((left, right) => (
    attemptTime(right.data) - attemptTime(left.data) || right.id.localeCompare(left.id)
  ));
  return attempts[0];
}

function responsePayload(req, inviteId, expiresAt, reused) {
  return {
    inviteId,
    url: buildUaamPeerInviteUrl(req, inviteId),
    expiresAt: timestampIso(expiresAt),
    reused,
  };
}

async function issueInvite(req, decoded) {
  const subjectUid = decoded.uid;
  const inviteId = randomUUID();
  const expiresAt = makeInviteExpiry();
  const pointerRef = db.collection('uaam_peer_invite_index').doc(subjectUid);
  const tombstoneRef = db.collection('uaam_peer_deletions').doc(subjectUid);
  const resultRef = db.collection('uaam_results').doc(subjectUid);
  const newInviteRef = db.collection('uaam_peer_invites').doc(inviteId);
  const auditRef = db.collection('uaam_peer_audits').doc();

  const result = await db.runTransaction(async (transaction) => {
    const [pointerSnapshot, tombstoneSnapshot] = await Promise.all([
      transaction.get(pointerRef),
      transaction.get(tombstoneRef),
    ]);
    if (tombstoneSnapshot.exists) {
      throw apiError(410, 'gone', '削除済みのユーザーです');
    }

    const activeInviteId = pointerSnapshot.data()?.activeInviteId;
    if (isUaamPeerInviteId(activeInviteId)) {
      const activeSnapshot = await transaction.get(db.collection('uaam_peer_invites').doc(activeInviteId));
      const activeData = activeSnapshot.data();
      if (activeSnapshot.exists
        && activeData?.subjectUid === subjectUid
        && isUaamPeerInviteActive(activeData)) {
        return {
          inviteId: activeSnapshot.id,
          expiresAt: activeData.expiresAt,
          reused: true,
        };
      }
    }

    const [parentSnapshot, attemptsSnapshot] = await Promise.all([
      transaction.get(resultRef),
      transaction.get(resultRef.collection('attempts').where('status', '==', 'committed')),
    ]);
    const parentData = parentSnapshot.data() ?? {};
    const attempt = latestCommittedAttempt(attemptsSnapshot, parentData.latestAttemptId);
    if (!attempt) {
      throw apiError(404, 'self_result_not_found', 'UAAM診断結果が見つかりません');
    }

    const scores = attempt.data?.full?.scores ?? parentData.scores;
    const answeredAt = attempt.data?.answeredAt
      ?? attempt.data?.summary?.createdAt
      ?? attempt.data?.createdAt
      ?? parentData.updatedAt
      ?? parentData.createdAt;
    if (!isScores(scores) || !Number.isFinite(timestampMillis(answeredAt))) {
      throw apiError(404, 'self_result_not_found', 'UAAM診断結果が見つかりません');
    }

    transaction.create(newInviteRef, {
      subjectUid,
      subjectName: typeof parentData.name === 'string' ? parentData.name : (decoded.name || ''),
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
      revoked: false,
      submissionCount: 0,
      questionVersion: UAAM_QUESTION_VERSION,
      selfSnapshot: {
        attemptId: attempt.id,
        answeredAt,
        scores,
      },
    });
    transaction.set(pointerRef, {
      activeInviteId: inviteId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(auditRef, {
      type: 'issue',
      inviteId,
      subjectUid,
      at: FieldValue.serverTimestamp(),
    });

    return { inviteId, expiresAt, reused: false };
  });

  return responsePayload(req, result.inviteId, result.expiresAt, result.reused);
}

async function revokeInvite(req, decoded) {
  const subjectUid = decoded.uid;
  const pointerRef = db.collection('uaam_peer_invite_index').doc(subjectUid);
  const tombstoneRef = db.collection('uaam_peer_deletions').doc(subjectUid);

  const result = await db.runTransaction(async (transaction) => {
    const [pointerSnapshot, tombstoneSnapshot] = await Promise.all([
      transaction.get(pointerRef),
      transaction.get(tombstoneRef),
    ]);
    if (tombstoneSnapshot.exists) {
      throw apiError(410, 'gone', '削除済みのユーザーです');
    }

    const inviteId = pointerSnapshot.data()?.activeInviteId;
    if (!isUaamPeerInviteId(inviteId)) {
      throw apiError(404, 'not_found', '有効な招待が見つかりません');
    }

    const inviteRef = db.collection('uaam_peer_invites').doc(inviteId);
    const inviteSnapshot = await transaction.get(inviteRef);
    const inviteData = inviteSnapshot.data();
    if (!inviteSnapshot.exists || inviteData?.subjectUid !== subjectUid) {
      throw apiError(404, 'not_found', '有効な招待が見つかりません');
    }

    transaction.update(inviteRef, { revoked: true });
    transaction.delete(pointerRef);
    transaction.create(db.collection('uaam_peer_audits').doc(), {
      type: 'revoke',
      inviteId,
      subjectUid,
      at: FieldValue.serverTimestamp(),
    });

    return { inviteId, expiresAt: inviteData.expiresAt };
  });

  return responsePayload(req, result.inviteId, result.expiresAt, false);
}

export default withMeHandler(async function handler(req, res) {
  setUaamPeerNoStoreHeaders(res);
  if (req.method !== 'POST') {
    return res.status(405).json({ code: 'method_not_allowed', error: 'POSTのみ対応しています' });
  }

  const decoded = await authenticateMeRequest(req, res);
  if (!decoded) return undefined;

  const bodyKeys = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? Object.keys(req.body)
    : [];
  if (bodyKeys.length !== 1 || bodyKeys[0] !== 'action' || !['issue', 'revoke'].includes(req.body.action)) {
    return res.status(400).json({ code: 'invalid_request', error: 'actionが不正です' });
  }

  try {
    if (req.body.action === 'revoke') {
      const payload = await revokeInvite(req, decoded);
      return res.status(200).json(payload);
    }
    const payload = await issueInvite(req, decoded);
    return res.status(payload.reused ? 200 : 201).json(payload);
  } catch (error) {
    if (!error?.status) console.error('[uaam-peer-invite] failed:', error?.message || error);
    return errorResponse(res, error);
  }
});
