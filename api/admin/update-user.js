import { getAuth } from 'firebase-admin/auth';
import { db, ADMIN_EMAILS } from '../lib/firebaseAdmin.js';

const ALLOWED_FIELDS = [
  'selectedKakuchiiki',
  'inputTalent', 'inputTalentTop5',
  'inputValue',  'inputValueTop5',
  'inputPassion','inputPassionTop5',
  'inputQ1', 'inputQ2', 'inputQ3',
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

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

  const { uid, fields } = req.body;
  if (!uid || !fields) return res.status(400).json({ error: 'uid と fields が必要です' });

  // 許可フィールドのみ受け付ける
  const safeFields = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in fields) safeFields[key] = fields[key];
  }

  if (Object.keys(safeFields).length === 0) {
    return res.status(400).json({ error: '更新可能なフィールドがありません' });
  }

  try {
    await db.collection('results').doc(uid).set(safeFields, { merge: true });
    return res.status(200).json({ success: true, updated: safeFields });
  } catch (e) {
    console.error('[update-user]', e);
    return res.status(500).json({ error: e.message || '更新に失敗しました' });
  }
}
