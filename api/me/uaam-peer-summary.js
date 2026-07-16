import { db } from '../lib/firebaseAdmin.js';
import { serializeTimestamps } from '../lib/serialize.js';
import {
  aggregateUaamPeerScores,
  isUaamPeerInviteActive,
  isUaamPeerInviteId,
  isUaamPeerQuestionVersionMismatch,
  setUaamPeerNoStoreHeaders,
} from '../lib/uaamPeer.js';
import { authenticateMeRequest, withMeHandler } from './_auth.js';

function notFound(res) {
  return res.status(404).json({ code: 'not_found', error: '集計対象が見つかりません' });
}

function gone(res) {
  return res.status(410).json({ code: 'gone', error: '削除済みのユーザーです' });
}

function questionVersionMismatch(res) {
  return res.status(409).json({
    code: 'question_version_mismatch',
    error: '診断内容が更新されたため、招待URLの再発行が必要です',
  });
}

function validSelfSnapshot(value) {
  return !!value
    && typeof value === 'object'
    && typeof value.attemptId === 'string'
    && value.scores
    && typeof value.scores === 'object';
}

export default withMeHandler(async function handler(req, res) {
  setUaamPeerNoStoreHeaders(res);
  if (req.method !== 'GET') {
    return res.status(405).json({ code: 'method_not_allowed', error: 'GETのみ対応しています' });
  }

  const decoded = await authenticateMeRequest(req, res);
  if (!decoded) return undefined;

  const tombstoneSnapshot = await db.collection('uaam_peer_deletions').doc(decoded.uid).get();
  if (tombstoneSnapshot.exists) return gone(res);

  const pointerSnapshot = await db.collection('uaam_peer_invite_index').doc(decoded.uid).get();
  const inviteId = pointerSnapshot.data()?.activeInviteId;
  if (!isUaamPeerInviteId(inviteId)) return notFound(res);

  const inviteSnapshot = await db.collection('uaam_peer_invites').doc(inviteId).get();
  if (!inviteSnapshot.exists) return notFound(res);

  const invite = inviteSnapshot.data();
  if (invite.subjectUid !== decoded.uid || !isUaamPeerInviteActive(invite)) {
    return notFound(res);
  }
  if (isUaamPeerQuestionVersionMismatch(invite)) return questionVersionMismatch(res);
  if (!validSelfSnapshot(invite.selfSnapshot)) return notFound(res);

  const submissionsSnapshot = await db
    .collection('uaam_peer_results')
    .doc(decoded.uid)
    .collection('submissions')
    .where('inviteId', '==', inviteId)
    .get();
  const n = submissionsSnapshot.size;
  if (n < 2) return res.status(200).json({ status: 'insufficient' });

  const scores = submissionsSnapshot.docs.map((snapshot) => snapshot.data()?.scores);
  const aggregate = aggregateUaamPeerScores(scores);
  return res.status(200).json(serializeTimestamps({
    status: 'ready',
    n,
    aggregate,
    selfSnapshot: invite.selfSnapshot,
  }));
});
