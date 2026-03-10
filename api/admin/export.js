import { getAuth } from 'firebase-admin/auth';
import { db, ADMIN_EMAILS } from '../lib/firebaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

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

  const snapshot = await db.collection('results').orderBy('createdAt', 'desc').get();

  const rows = [
    [
      '名前', 'メール', '才覚領域',
      '価値観軸1', '価値観軸2', '価値観軸3', '価値観入力',
      '才能軸1', '才能軸2', '才能軸3', '才能入力',
      '情熱軸1', '情熱軸2', '情熱軸3', '情熱入力',
      '解析日時',
    ],
  ];

  snapshot.docs.forEach((doc) => {
    const d = doc.data();
    const t = d.result?.talent || {};
    const v = d.result?.value || {};
    const p = d.result?.passion || {};
    rows.push([
      d.name || '',
      d.email || '',
      d.selectedKakuchiiki || '',
      v.axis1?.name || '',
      v.axis2?.name || '',
      v.axis3?.name || '',
      d.inputValueTop5  || d.inputValue  || '',
      t.axis1?.name || '',
      t.axis2?.name || '',
      t.axis3?.name || '',
      d.inputTalentTop5 || d.inputTalent || '',
      p.axis1?.name || '',
      p.axis2?.name || '',
      p.axis3?.name || '',
      d.inputPassionTop5 || d.inputPassion || '',
      d.createdAt?._seconds
        ? new Date(d.createdAt._seconds * 1000).toLocaleString('ja-JP')
        : '',
    ]);
  });

  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const bom = '\uFEFF'; // Excel用BOM

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="saikaku_results.csv"');
  return res.status(200).send(bom + csv);
}
