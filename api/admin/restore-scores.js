/**
 * restore-scores.js — 管理者用: 正しいUAAMスコアをFirestoreに書き戻す
 * POST /api/admin/restore-scores
 * body: { idToken }
 * 管理者のみ実行可能。自分のスコアを2026/4/4の正データに復元する。
 */
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { db, ADMIN_EMAILS } from '../lib/firebaseAdmin.js';

// 2026/4/4 haru 正式診断結果
const CORRECT_SCORES = {
  mindset: {
    total: 68, max: 80, percentage: 85,
    subs: { meaning: 19, mindfulness: 15, mindshift: 17, mastery: 17 },
  },
  literacy: {
    total: 65, max: 80, percentage: 81,
    subs: { learning: 16, logical: 17, life: 17, leadership: 15 },
  },
  competency: {
    total: 63, max: 80, percentage: 79,
    subs: { critical: 18, creativity: 14, communication: 15, collaboration: 16 },
  },
  impact: {
    total: 63, max: 80, percentage: 79,
    subs: { idea: 18, innovation: 16, implementation: 15, influence: 14 },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { idToken } = req.body;

  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ error: '認証に失敗しました' });
  }

  // 管理者チェック
  if (!ADMIN_EMAILS.includes(decoded.email)) {
    return res.status(403).json({ error: '管理者のみ実行できます' });
  }

  const uid = decoded.uid;
  const docRef = db.collection('uaam_results').doc(uid);

  await docRef.set(
    {
      scores: CORRECT_SCORES,
      restoredAt: FieldValue.serverTimestamp(),
      restoredBy: decoded.email,
      restoredNote: '2026/4/4 正式診断データ復元',
    },
    { merge: true }
  );

  console.log(`[restore-scores] ${decoded.email} (${uid}) scores restored`);
  return res.status(200).json({
    ok: true,
    message: '2026/4/4の正しいスコアに復元しました',
    scores: CORRECT_SCORES,
  });
}
