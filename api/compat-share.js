import { db } from './lib/firebaseAdmin.js';
import {
  isCompatShareActive,
  isCompatShareId,
  setCompatShareNoStoreHeaders,
  validateCompatSharedMatrix,
  validateCompatShareReport,
} from './lib/compatShare.js';

function notFound(res) {
  return res.status(404).json({ code: 'NOT_FOUND', error: '共有結果が見つかりません' });
}

export default async function handler(req, res) {
  setCompatShareNoStoreHeaders(res);
  if (req.method !== 'GET') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', error: 'GETのみ対応しています' });

  const shareId = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
  if (!isCompatShareId(shareId)) {
    return res.status(400).json({ code: 'INVALID_SHARE_ID', error: '共有IDが不正です' });
  }

  try {
    const snapshot = await db.collection('compat_shares').doc(shareId).get();
    if (!snapshot.exists) return notFound(res);
    const data = snapshot.data();
    if (!isCompatShareActive(data)) return notFound(res);

    const validMetadata = ['pair', 'team'].includes(data.mode)
      && Array.isArray(data.memberLabels)
      && data.memberLabels.length >= 2
      && data.memberLabels.length <= 10
      && data.memberLabels.every((label) => typeof label === 'string' && label.length >= 1 && label.length <= 80)
      && typeof data.goalProvided === 'boolean'
      && data.memberLabels.length === data.report?.dataSufficiency?.memberAvailability?.length
      && (data.mode === 'pair' ? data.memberLabels.length === 2 : data.memberLabels.length >= 3)
      && data.goalProvided === (data.mode === 'team');
    if (!validMetadata) return notFound(res);
    const reportValidation = validateCompatShareReport(data.report, { goalProvided: data.goalProvided });
    if (!reportValidation.ok) return notFound(res);
    const hasSharedMatrix = Object.prototype.hasOwnProperty.call(data, 'sharedMatrix');
    const sharedMatrixValidation = hasSharedMatrix
      ? validateCompatSharedMatrix(
        data.sharedMatrix,
        data.report.dataSufficiency.memberAvailability.map((member) => member.alias),
      )
      : null;
    if (hasSharedMatrix && !sharedMatrixValidation.ok) return notFound(res);

    return res.status(200).json({
      report: reportValidation.value,
      memberLabels: data.memberLabels,
      mode: data.mode,
      goalProvided: data.goalProvided,
      ...(hasSharedMatrix ? { sharedMatrix: sharedMatrixValidation.value } : {}),
    });
  } catch (error) {
    console.error('[compat-share-public] failed:', error?.message || error);
    return res.status(500).json({ code: 'INTERNAL_ERROR', error: '共有結果を取得できませんでした' });
  }
}
