/**
 * 一時的な削除エンドポイント - 使用後に削除すること
 */
import { getAuth } from 'firebase-admin/auth';
import { db } from '../lib/firebaseAdmin.js';

const SECRET = 'forex_purge2_2026_haru';
const TARGET = 'forex.0611@gmail.com';

export default async function handler(req, res) {
  if (req.query.secret !== SECRET) return res.status(403).json({ error: 'forbidden' });

  const result = { email: TARGET, authDeleted: false, firestoreDeleted: 0, authError: null };

  // Firebase Auth から削除
  try {
    const user = await getAuth().getUserByEmail(TARGET);
    result.uid = user.uid;
    await getAuth().deleteUser(user.uid);
    result.authDeleted = true;

    // Firestore UID で削除
    try { await db.collection('results').doc(user.uid).delete(); } catch (_) {}
    try { await db.collection('uaam_results').doc(user.uid).delete(); } catch (_) {}

    // Firestore uid フィールドで削除
    const s1 = await db.collection('results').where('uid', '==', user.uid).get();
    await Promise.all(s1.docs.map(d => d.ref.delete()));
    result.firestoreDeleted += s1.size;

    const s2 = await db.collection('uaam_results').where('uid', '==', user.uid).get();
    await Promise.all(s2.docs.map(d => d.ref.delete()));
    result.firestoreDeleted += s2.size;
  } catch (e) {
    result.authError = e.code || e.message;
  }

  // Firestore email フィールドで削除（保険）
  try {
    const s3 = await db.collection('results').where('email', '==', TARGET).get();
    await Promise.all(s3.docs.map(d => d.ref.delete()));
    result.firestoreDeleted += s3.size;
  } catch (_) {}

  return res.status(200).json(result);
}
