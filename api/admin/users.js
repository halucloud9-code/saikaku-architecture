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

  // 才覚領域の結果
  const snapshot = await db.collection('results').orderBy('createdAt', 'desc').get();

  const users = snapshot.docs.map((doc) => {
    const d = doc.data();
    return {
      uid: d.uid,
      name: d.name,
      email: d.email,
      photoURL: d.photoURL,
      selectedKakuchiiki: d.selectedKakuchiiki,
      talentAxes: d.result?.talent,
      valueAxes: d.result?.value,
      passionAxes: d.result?.passion,
      insight: d.result?.insight,
      inputTalent:  d.inputTalent  || '',
      inputValue:   d.inputValue   || '',
      inputPassion: d.inputPassion || '',
      inputTalentTop5:  d.inputTalentTop5  || '',
      inputValueTop5:   d.inputValueTop5   || '',
      inputPassionTop5: d.inputPassionTop5 || '',
      inputQ1: d.inputQ1 || '',
      inputQ2: d.inputQ2 || '',
      inputQ3: d.inputQ3 || '',
      createdAt: d.createdAt?._seconds
        ? new Date(d.createdAt._seconds * 1000).toISOString()
        : null,
    };
  });

  // UAAM結果（vAnswers含む）
  const uaamSnapshot = await db.collection('uaam_results').orderBy('updatedAt', 'desc').get();

  const uaamUsers = uaamSnapshot.docs.map((doc) => {
    const d = doc.data();
    return {
      uid: d.uid,
      name: d.name || '',
      email: d.email || '',
      photoURL: d.photoURL || '',
      scores: d.scores || null,
      analysis: d.analysis || null,
      // bias_message は undefined / null / object の三状態を区別する（AdminScreen.getOrCalcBias 参照）。
      // undefined = legacy（再計算）、null = 明示的に健全保存、object = 保存済みメッセージ。
      // `|| null` の coercion は legacy を健全と誤認させるため使わない。
      bias_message: d.bias_message,
      answers: d.answers || null,
      vAnswers: d.vAnswers || null,
      uaamCreatedAt: d.createdAt?._seconds
        ? new Date(d.createdAt._seconds * 1000).toISOString()
        : null,
      uaamUpdatedAt: d.updatedAt?._seconds
        ? new Date(d.updatedAt._seconds * 1000).toISOString()
        : null,
    };
  });

  return res.status(200).json({ users, uaamUsers, total: users.length, uaamTotal: uaamUsers.length });
}
