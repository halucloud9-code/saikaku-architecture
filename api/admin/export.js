import { getAuth } from 'firebase-admin/auth';
import { db, ADMIN_EMAILS } from '../lib/firebaseAdmin.js';

// 利用可能なフィールド定義
const FIELD_DEFS = {
  name:        { header: '名前',       getValue: (d) => d.name || '' },
  email:       { header: 'メール',     getValue: (d) => d.email || '' },
  kakuchiiki:  { header: '才覚領域',   getValue: (d) => d.selectedKakuchiiki || '' },
  valueAxes:   { header: '価値観軸1,価値観軸2,価値観軸3',
                 multi: true,
                 getValue: (d) => {
                   const v = d.result?.value || {};
                   return [v.axis1?.name || '', v.axis2?.name || '', v.axis3?.name || ''];
                 }},
  valueInput:  { header: '価値観入力(TOP5)', getValue: (d) => d.inputValueTop5 || d.inputValue || '' },
  talentAxes:  { header: '才能軸1,才能軸2,才能軸3',
                 multi: true,
                 getValue: (d) => {
                   const t = d.result?.talent || {};
                   return [t.axis1?.name || '', t.axis2?.name || '', t.axis3?.name || ''];
                 }},
  talentInput: { header: '才能入力(TOP5)', getValue: (d) => d.inputTalentTop5 || d.inputTalent || '' },
  passionAxes: { header: '情熱軸1,情熱軸2,情熱軸3',
                 multi: true,
                 getValue: (d) => {
                   const p = d.result?.passion || {};
                   return [p.axis1?.name || '', p.axis2?.name || '', p.axis3?.name || ''];
                 }},
  passionInput:{ header: '情熱入力(TOP5)', getValue: (d) => d.inputPassionTop5 || d.inputPassion || '' },
  q1:          { header: 'Q1',          getValue: (d) => d.inputQ1 || '' },
  q2:          { header: 'Q2',          getValue: (d) => d.inputQ2 || '' },
  q3:          { header: 'Q3',          getValue: (d) => d.inputQ3 || '' },
  createdAt:   { header: '解析日時',    getValue: (d) =>
                   d.createdAt?._seconds
                     ? new Date(d.createdAt._seconds * 1000).toLocaleString('ja-JP')
                     : '' },
};

const ALL_FIELDS = Object.keys(FIELD_DEFS);

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();

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

  // POST body または GET クエリからフィールド選択を取得
  let selectedFields = ALL_FIELDS; // デフォルト: 全フィールド
  if (req.method === 'POST' && req.body?.fields && Array.isArray(req.body.fields)) {
    selectedFields = req.body.fields.filter((f) => ALL_FIELDS.includes(f));
  }
  if (selectedFields.length === 0) selectedFields = ALL_FIELDS;

  const snapshot = await db.collection('results').orderBy('createdAt', 'desc').get();

  // ヘッダー行を構築
  const headerCells = [];
  for (const key of selectedFields) {
    const def = FIELD_DEFS[key];
    if (def.multi) {
      headerCells.push(...def.header.split(','));
    } else {
      headerCells.push(def.header);
    }
  }

  const rows = [headerCells];

  snapshot.docs.forEach((doc) => {
    const d = doc.data();
    const cells = [];
    for (const key of selectedFields) {
      const def = FIELD_DEFS[key];
      const val = def.getValue(d);
      if (def.multi) {
        cells.push(...val);
      } else {
        cells.push(val);
      }
    }
    rows.push(cells);
  });

  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const bom = '\uFEFF'; // Excel用BOM

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="saikaku_results.csv"');
  return res.status(200).send(bom + csv);
}
