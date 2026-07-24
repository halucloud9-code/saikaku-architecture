import { randomUUID } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { db } from '../lib/firebaseAdmin.js';
import {
  buildCompatSharedMatrix,
  COMPAT_SHARE_TTL_MS,
  isCompatShareId,
  setCompatShareNoStoreHeaders,
  validateCompatSharedMatrix,
  validateCompatShareIssueInput,
  validateCompatShareUaamMatrix,
} from '../lib/compatShare.js';
import { requireAdmin } from '../lib/requireAdmin.js';

function errorResponse(res, status, code, error) {
  return res.status(status).json({ code, error });
}

function requestOrigin(req) {
  const configured = process.env.COMPAT_SHARE_ORIGIN?.trim();
  if (configured) {
    const url = new URL(configured);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('COMPAT_SHARE_ORIGIN is invalid');
    }
    return url.origin;
  }

  const requestOriginHeader = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;
  if (requestOriginHeader) {
    const url = new URL(requestOriginHeader);
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) {
      return url.origin;
    }
  }

  const forwardedHost = req.headers['x-forwarded-host'];
  const rawHost = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost)?.split(',')[0].trim()
    || req.headers.host;
  if (typeof rawHost !== 'string' || !/^[a-z0-9.-]+(?::\d{1,5})?$/iu.test(rawHost)) {
    throw new Error('request host is invalid');
  }
  const forwardedProto = req.headers['x-forwarded-proto'];
  const rawProto = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto)?.split(',')[0].trim();
  const protocol = rawProto === 'http' || rawProto === 'https'
    ? rawProto
    : (rawHost.startsWith('localhost') || rawHost.startsWith('127.0.0.1') ? 'http' : 'https');
  return `${protocol}://${rawHost}`;
}

async function issueShare(req, res, admin) {
  const shareInput = structuredClone(req.body);
  const hasUaamMatrix = !!shareInput
    && typeof shareInput === 'object'
    && Object.prototype.hasOwnProperty.call(shareInput, 'uaamMatrix');
  const uaamMatrix = shareInput?.uaamMatrix;
  if (shareInput && typeof shareInput === 'object') delete shareInput.uaamMatrix;
  if (shareInput?.report && typeof shareInput.report === 'object') {
    delete shareInput.report.uaamMatrix;
    if (shareInput.report.visual?.uaam && typeof shareInput.report.visual.uaam === 'object') {
      delete shareInput.report.visual.uaam.memberScores;
    }
  }
  const validation = validateCompatShareIssueInput(shareInput);
  if (!validation.ok) return errorResponse(res, validation.status, validation.code, validation.error);
  const memberAliases = validation.value.report.dataSufficiency.memberAvailability
    .map((member) => member.alias);
  let sharedMatrix;
  if (hasUaamMatrix) {
    const uaamValidation = validateCompatShareUaamMatrix(uaamMatrix, memberAliases);
    if (!uaamValidation.ok) {
      return errorResponse(res, 400, 'UAAM_MATRIX_INVALID', '共有する地図データの安全性を確認できませんでした');
    }
    const builtSharedMatrix = buildCompatSharedMatrix(uaamValidation.value, memberAliases);
    const sharedMatrixValidation = validateCompatSharedMatrix(builtSharedMatrix, memberAliases);
    if (!sharedMatrixValidation.ok) {
      return errorResponse(res, 422, 'SHARED_MATRIX_INVALID', '共有する地図データの安全性を確認できませんでした');
    }
    sharedMatrix = sharedMatrixValidation.value;
  }

  const shareId = randomUUID();
  const url = `${requestOrigin(req)}/compat/share/${shareId}`;
  const nowMs = Date.now();
  const shareRef = db.collection('compat_shares').doc(shareId);
  const auditRef = db.collection('compat_audits').doc();
  const batch = db.batch();
  batch.create(shareRef, {
    ...validation.value,
    ...(hasUaamMatrix ? { sharedMatrix } : {}),
    actorUid: admin.uid,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(nowMs + COMPAT_SHARE_TTL_MS),
    revoked: false,
  });
  batch.create(auditRef, {
    action: 'share_issued',
    shareId,
    actorUid: admin.uid,
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  return res.status(hasUaamMatrix ? 201 : 200).json({
    shareId,
    url,
  });
}

async function revokeShare(req, res, admin) {
  if (!req.body
    || Object.keys(req.body).sort().join('|') !== ['action', 'shareId'].join('|')
    || req.body.action !== 'revoke'
    || !isCompatShareId(req.body.shareId)) {
    return errorResponse(res, 400, 'INVALID_REQUEST', '失効する共有IDが不正です');
  }

  let alreadyRevoked = false;
  await db.runTransaction(async (transaction) => {
    const shareRef = db.collection('compat_shares').doc(req.body.shareId);
    const snapshot = await transaction.get(shareRef);
    if (!snapshot.exists) {
      const error = new Error('共有結果が見つかりません');
      error.code = 'SHARE_NOT_FOUND';
      error.status = 404;
      throw error;
    }
    if (snapshot.data().revoked === true) {
      alreadyRevoked = true;
      return;
    }
    transaction.update(shareRef, { revoked: true });
    transaction.create(db.collection('compat_audits').doc(), {
      action: 'share_revoked',
      shareId: req.body.shareId,
      actorUid: admin.uid,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return res.status(200).json({ shareId: req.body.shareId, revoked: true, alreadyRevoked });
}

export default async function handler(req, res) {
  setCompatShareNoStoreHeaders(res);
  if (req.method !== 'POST') return errorResponse(res, 405, 'METHOD_NOT_ALLOWED', 'POSTのみ対応しています');
  const admin = await requireAdmin(req, res);
  if (!admin) return undefined;

  try {
    if (req.body?.action === 'revoke') return await revokeShare(req, res, admin);
    return await issueShare(req, res, admin);
  } catch (error) {
    if (error?.status) return errorResponse(res, error.status, error.code, error.message);
    console.error('[compat-share] failed:', error?.message || error);
    return errorResponse(res, 500, 'INTERNAL_ERROR', '共有URLの操作に失敗しました');
  }
}
