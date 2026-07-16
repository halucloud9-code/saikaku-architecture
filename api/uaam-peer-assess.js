import { FieldValue } from 'firebase-admin/firestore';
import { db } from './lib/firebaseAdmin.js';
import {
  getUaamPeerSubmissionCap,
  isUaamPeerInviteActive,
  isUaamPeerInviteId,
  setUaamPeerNoStoreHeaders,
  validateUaamPeerAnswers,
} from './lib/uaamPeer.js';
import { calculateScores } from '../shared/uaamQuestions.js';

function notFound(res) {
  return res.status(404).json({ code: 'not_found', error: '招待が見つかりません' });
}

function gone(res) {
  return res.status(410).json({ code: 'gone', error: 'この招待は利用できません' });
}

function requestError(status) {
  const error = new Error(status === 410 ? 'gone' : 'not_found');
  error.status = status;
  return error;
}

async function countSubmissions(query) {
  if (typeof query.count === 'function') {
    const aggregate = await query.count().get();
    return aggregate.data().count ?? 0;
  }
  const snapshot = await query.get();
  return snapshot.size;
}

export default async function handler(req, res) {
  setUaamPeerNoStoreHeaders(res);
  if (req.method !== 'POST') {
    return res.status(405).json({ code: 'method_not_allowed', error: 'POSTのみ対応しています' });
  }

  const bodyKeys = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? Object.keys(req.body).sort()
    : [];
  if (bodyKeys.join('|') !== 'answers|inviteId') {
    return res.status(400).json({ code: 'invalid_request', error: '入力形式が不正です' });
  }

  const { inviteId, answers } = req.body;
  if (!isUaamPeerInviteId(inviteId)) return notFound(res);

  try {
    const inviteSnapshot = await db.collection('uaam_peer_invites').doc(inviteId).get();
    if (!inviteSnapshot.exists) return notFound(res);

    const invite = inviteSnapshot.data();
    if (typeof invite.subjectUid !== 'string' || !invite.subjectUid) return notFound(res);
    const tombstoneSnapshot = await db.collection('uaam_peer_deletions').doc(invite.subjectUid).get();
    if (tombstoneSnapshot.exists) return gone(res);
    if (!isUaamPeerInviteActive(invite)) return notFound(res);

    const submissionsRef = db
      .collection('uaam_peer_results')
      .doc(invite.subjectUid)
      .collection('submissions');
    const inviteSubmissions = submissionsRef.where('inviteId', '==', inviteId);
    const submissionCount = await countSubmissions(inviteSubmissions);
    if (submissionCount >= getUaamPeerSubmissionCap()) {
      return res.status(429).json({ code: 'submission_cap_reached', error: '回答上限に達しました' });
    }

    if (!validateUaamPeerAnswers(answers)) {
      return res.status(400).json({ code: 'invalid_answers', error: '回答は設問1〜64の1〜5の整数で入力してください' });
    }

    const inviteRef = db.collection('uaam_peer_invites').doc(inviteId);
    const tombstoneRef = db.collection('uaam_peer_deletions').doc(invite.subjectUid);
    const submissionRef = submissionsRef.doc();
    const auditRef = db.collection('uaam_peer_audits').doc();
    const scores = calculateScores(answers);

    // Re-read the deletion barrier and invite in the same transaction as the
    // append. A delete starting after the preliminary cap check therefore
    // conflicts/retries instead of resurrecting a submission after its sweep.
    await db.runTransaction(async (transaction) => {
      const [currentInviteSnapshot, currentTombstoneSnapshot] = await Promise.all([
        transaction.get(inviteRef),
        transaction.get(tombstoneRef),
      ]);
      if (currentTombstoneSnapshot.exists) throw requestError(410);
      const currentInvite = currentInviteSnapshot.data();
      if (!currentInviteSnapshot.exists
        || currentInvite?.subjectUid !== invite.subjectUid
        || !isUaamPeerInviteActive(currentInvite)) {
        throw requestError(404);
      }

      transaction.create(submissionRef, {
        inviteId,
        answers,
        scores,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.create(auditRef, {
        type: 'submit',
        inviteId,
        subjectUid: invite.subjectUid,
        at: FieldValue.serverTimestamp(),
      });
    });

    return res.status(201).json({ success: true });
  } catch (error) {
    if (error?.status === 410) return gone(res);
    if (error?.status === 404) return notFound(res);
    console.error('[uaam-peer-assess] failed:', error?.message || error);
    return res.status(500).json({ code: 'internal_error', error: '回答を保存できませんでした' });
  }
}
