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

  const { uid } = req.body;
  if (!uid) return res.status(400).json({ error: 'uid が必要です' });

  try {
    // Firestore の才覚領域結果を削除
    try {
      await db.collection('results').doc(uid).delete();
    } catch (_) {}

    // Firestore の UAAM 結果を削除
    try {
      await db.collection('uaam_results').doc(uid).delete();
    } catch (_) {}

    // Firebase Auth のユーザーを削除
    try {
      await getAuth().deleteUser(uid);
    } catch (_) {}

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('[delete-user]', e);
    return res.status(500).json({ error: e.message || '削除に失敗しました' });
  }
}
