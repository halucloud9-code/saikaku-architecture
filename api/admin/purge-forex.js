// 一時的な削除エンドポイント - 使用後に削除すること
import { getAuth } from 'firebase-admin/auth';
import { db } from '../lib/firebaseAdmin.js';

export default async function handler(req, res) {
  // 一時シークレットキーで認証
  const key = req.query.key || req.body?.key;
  if (key !== 'forex_purge_2026_haru') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const TARGETS = ['forex.0611@gmail.com', 'forex0611@gmail.com'];
  const results = [];

  for (const email of TARGETS) {
    const result = { email, authDeleted: false, firestoreDeleted: 0, error: null };
    try {
      // Firebase Auth から UID 取得 → 削除
      let uid = null;
      try {
        const user = await getAuth().getUserByEmail(email);
        uid = user.uid;
        await getAuth().deleteUser(uid);
        result.authDeleted = true;
        result.uid = uid;

        // Firestore UID ドキュメント削除
        for (const col of ['results', 'uaam_results']) {
          try { await db.collection(col).doc(uid).delete(); } catch (_) {}
        }
      } catch (e) {
        result.authNote = e.code || e.message;
      }

      // Firestore email クエリで念のため削除
      for (const col of ['results', 'uaam_results']) {
        try {
          const snap = await db.collection(col).where('email', '==', email).get();
          if (!snap.empty) {
            await Promise.all(snap.docs.map((d) => d.ref.delete()));
            result.firestoreDeleted += snap.size;
          }
        } catch (_) {}
      }
    } catch (e) {
      result.error = e.message;
    }
    results.push(result);
  }

  return res.status(200).json({
    done: true,
    results,
    message: '削除完了。このエンドポイントは削除してください。',
  });
}
