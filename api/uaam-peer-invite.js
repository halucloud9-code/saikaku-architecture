import { db } from './lib/firebaseAdmin.js';
import {
  isUaamPeerInviteActive,
  isUaamPeerInviteId,
  setUaamPeerNoStoreHeaders,
  timestampIso,
} from './lib/uaamPeer.js';

function notFound(res) {
  return res.status(404).json({ code: 'not_found', error: '招待が見つかりません' });
}

function gone(res) {
  return res.status(410).json({ code: 'gone', error: 'この招待は利用できません' });
}

export default async function handler(req, res) {
  setUaamPeerNoStoreHeaders(res);
  if (req.method !== 'GET') {
    return res.status(405).json({ code: 'method_not_allowed', error: 'GETのみ対応しています' });
  }

  const inviteId = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
  if (!isUaamPeerInviteId(inviteId)) return notFound(res);

  try {
    const inviteSnapshot = await db.collection('uaam_peer_invites').doc(inviteId).get();
    if (!inviteSnapshot.exists) return notFound(res);

    const invite = inviteSnapshot.data();
    if (typeof invite.subjectUid !== 'string' || !invite.subjectUid) return notFound(res);
    const tombstoneSnapshot = await db.collection('uaam_peer_deletions').doc(invite.subjectUid).get();
    if (tombstoneSnapshot.exists) return gone(res);
    if (!isUaamPeerInviteActive(invite)) return notFound(res);
    if (typeof invite.subjectName !== 'string') return notFound(res);

    return res.status(200).json({
      subjectName: invite.subjectName,
      expiresAt: timestampIso(invite.expiresAt),
    });
  } catch (error) {
    console.error('[uaam-peer-invite-public] failed:', error?.message || error);
    return res.status(500).json({ code: 'internal_error', error: '招待を取得できませんでした' });
  }
}
