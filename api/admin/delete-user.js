import { getAuth } from 'firebase-admin/auth';
import { db, ADMIN_EMAILS } from '../lib/firebaseAdmin.js';

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
    if (!targetUid && email) {
      try {
        const userRecord = await getAuth().getUserByEmail(email);
        targetUid = userRecord.uid;
      } catch (e) {
        // Firebase Auth にユーザーが存在しない場合でも Firestore は削除試行
        console.warn('[delete-user] Firebase Auth user not found for email:', email);
      }
    }

    // Firestore の才覚領域結果を UID で削除（ドキュメントID直接 + uid フィールドクエリ）
    if (targetUid) {
      try { await db.collection('results').doc(targetUid).delete(); } catch (_) {}
      try { await db.collection('uaam_results').doc(targetUid).delete(); } catch (_) {}
      // ドキュメントID != uid の場合に備えてフィールドでも検索
      try {
        const snap = await db.collection('results').where('uid', '==', targetUid).get();
        await Promise.all(snap.docs.map((d) => d.ref.delete()));
      } catch (_) {}
      try {
        const snap = await db.collection('uaam_results').where('uid', '==', targetUid).get();
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
    if (targetUid) {
      try { await getAuth().deleteUser(targetUid); } catch (_) {}
    }

    return res.status(200).json({ success: true, deletedUid: targetUid || null });
  } catch (e) {
    console.error('[delete-user]', e);
    return res.status(500).json({ error: e.message || '削除に失敗しました' });
  }
}
