import { getAuth } from 'firebase-admin/auth';
import { db } from '../lib/firebaseAdmin.js';
const T = 'forex.0611@gmail.com';
export default async function handler(req, res) {
  if (req.query.s !== 'haru26') return res.status(403).end();
  try {
    const u = await getAuth().getUserByEmail(T);
    await getAuth().deleteUser(u.uid);
    try { await db.collection('results').where('uid','==',u.uid).get().then(s=>Promise.all(s.docs.map(d=>d.ref.delete()))); } catch(_){}
    return res.status(200).json({ deleted: true, uid: u.uid });
  } catch(e) {
    return res.status(200).json({ deleted: false, reason: e.code });
  }
}
