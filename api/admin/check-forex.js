import { getAuth } from 'firebase-admin/auth';
import { db } from '../lib/firebaseAdmin.js'; // Firebase Admin 初期化のため必須
const TARGET = 'forex.0611@gmail.com';
export default async function handler(req, res) {
  if (req.query.secret !== 'check2026haru') return res.status(403).end();
  try {
    const user = await getAuth().getUserByEmail(TARGET);
    await getAuth().deleteUser(user.uid);
    return res.status(200).json({ existed: true, deleted: true, uid: user.uid });
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      return res.status(200).json({ existed: false, message: 'Firebase Auth には存在しない' });
    }
    return res.status(500).json({ error: e.message });
  }
}
