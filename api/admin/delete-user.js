import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { db, ADMIN_EMAILS } from '../lib/firebaseAdmin.js';

const UID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

async function deriveFirestoreUidsByEmail(email) {
  const snapshots = await Promise.all([
    db.collection('results').where('email', '==', email).get(),
    db.collection('uaam_results').where('email', '==', email).get(),
  ]);
  const uids = new Set();
  for (const snapshot of snapshots) {
    for (const document of snapshot.docs) {
      const storedUid = document.data()?.uid;
      const candidate = typeof storedUid === 'string' && UID_RE.test(storedUid)
        ? storedUid
        : document.id;
      if (UID_RE.test(candidate)) uids.add(candidate);
    }
  }
  return [...uids];
}

async function deleteUaamPeerData(uid, requestedBy) {
  // 1. Tombstone is deliberately committed before any destructive write. Public
  // and issue endpoints use it as the authoritative deletion barrier.
  await db.collection('uaam_peer_deletions').doc(uid).set({
    requestedAt: FieldValue.serverTimestamp(),
    requestedBy,
  });

  // 2. Revoke every historical/current invite and remove the active pointer.
  const invites = await db.collection('uaam_peer_invites').where('subjectUid', '==', uid).get();
  await Promise.all([
    ...invites.docs.map((document) => document.ref.update({ revoked: true })),
    db.collection('uaam_peer_invite_index').doc(uid).delete(),
  ]);

  // 3. Remove the root and every anonymous submission below it.
  await db.recursiveDelete(db.collection('uaam_peer_results').doc(uid));

  // 4. Audit documents contain no subcollections and can be removed directly.
  const audits = await db.collection('uaam_peer_audits').where('subjectUid', '==', uid).get();
  await Promise.all(audits.docs.map((document) => document.ref.delete()));
}

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end();

  const idToken = req.headers.authorization?.replace('Bearer ', '');
  if (!idToken) return res.status(401).json({ error: '認証が必要です' });

  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ error: '認証に失敗しました' });
  }

  if (!ADMIN_EMAILS.includes(decoded.email)) {
    return res.status(403).json({ error: '管理者権限が必要です' });
  }

  const { uid, email } = req.body;
  if (!uid && !email) return res.status(400).json({ error: 'uid または email が必要です' });

  try {
    // email が指定された場合は UID を先に取得
    let targetUid = uid;
    const targetUids = new Set();
    if (!targetUid && email) {
      try {
        const userRecord = await getAuth().getUserByEmail(email);
        targetUid = userRecord.uid;
      } catch (e) {
        // Firebase Auth にユーザーが存在しない場合でも Firestore は削除試行
        console.warn('[delete-user] Firebase Auth user not found for email:', email);
      }
    }

    if (targetUid) targetUids.add(targetUid);
    if (!targetUid && email) {
      const derivedUids = await deriveFirestoreUidsByEmail(email);
      derivedUids.forEach((derivedUid) => targetUids.add(derivedUid));
      targetUid = derivedUids[0];
    }

    // UAAM peer data is swept before the existing diagnosis-result deletion.
    // Each sweep enforces tombstone -> invites/pointer -> results -> audits.
    for (const peerUid of targetUids) {
      await deleteUaamPeerData(peerUid, decoded.uid);
    }

    // Firestore の才覚領域結果を UID で削除（ドキュメントID直接 + uid フィールドクエリ）
    for (const resultUid of targetUids) {
      try { await db.collection('results').doc(resultUid).delete(); } catch (_) {}
      try { await db.collection('uaam_results').doc(resultUid).delete(); } catch (_) {}
      // ドキュメントID != uid の場合に備えてフィールドでも検索
      try {
        const snap = await db.collection('results').where('uid', '==', resultUid).get();
        await Promise.all(snap.docs.map((d) => d.ref.delete()));
      } catch (_) {}
      try {
        const snap = await db.collection('uaam_results').where('uid', '==', resultUid).get();
        await Promise.all(snap.docs.map((d) => d.ref.delete()));
      } catch (_) {}
    }

    // email で Firestore を検索して削除（uid が取れなかった場合の保険）
    if (email) {
      try {
        const snap = await db.collection('results').where('email', '==', email).get();
        await Promise.all(snap.docs.map((d) => d.ref.delete()));
      } catch (_) {}
      try {
        const snap = await db.collection('uaam_results').where('email', '==', email).get();
        await Promise.all(snap.docs.map((d) => d.ref.delete()));
      } catch (_) {}
    }

    // Firebase Auth のユーザーを削除
    for (const authUid of targetUids) {
      try { await getAuth().deleteUser(authUid); } catch (_) {}
    }

    return res.status(200).json({ success: true, deletedUid: targetUid || null });
  } catch (e) {
    console.error('[delete-user]', e);
    return res.status(500).json({ error: e.message || '削除に失敗しました' });
  }
}
