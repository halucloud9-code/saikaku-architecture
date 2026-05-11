import { getAuth } from 'firebase-admin/auth';
import { Timestamp } from 'firebase-admin/firestore';
import { db, ADMIN_EMAILS } from '../lib/firebaseAdmin.js';
import { jstDayBoundary, weekBoundary } from '../../src/utils/adminSummaryCounts.js';

// `query.count()` は本番 Firebase Admin SDK で aggregate count を返し doc 取得を回避する。
// emulator や旧 SDK で未実装/失敗のときのみ全件 fetch にフォールバックする (api/me/diagnosis-status.js と同じパターン)。
async function countQuery(query) {
  try {
    if (typeof query.count === 'function') {
      const aggregate = await query.count().get();
      return aggregate.data().count ?? 0;
    }
  } catch {
    // fall through to full-fetch fallback (emulator-only path)
  }

  const snapshot = await query.get();
  return snapshot.docs.length;
}

function createdAtSince(ref, boundary) {
  return ref.where('createdAt', '>=', Timestamp.fromDate(boundary));
}

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

  try {
    const now = new Date();
    const todayBoundary = jstDayBoundary(now);
    const thisWeekBoundary = weekBoundary(now);

    const [saikakuToday, saikakuThisWeek, uaamToday, uaamThisWeek, integrationsToday, integrationsThisWeek] =
      await Promise.all([
        countQuery(createdAtSince(db.collection('results'), todayBoundary)),
        countQuery(createdAtSince(db.collection('results'), thisWeekBoundary)),
        countQuery(createdAtSince(db.collection('uaam_results'), todayBoundary)),
        countQuery(createdAtSince(db.collection('uaam_results'), thisWeekBoundary)),
        countQuery(createdAtSince(db.collectionGroup('integrations'), todayBoundary)),
        countQuery(createdAtSince(db.collectionGroup('integrations'), thisWeekBoundary)),
      ]);

    const breakdown = {
      saikaku: { today: saikakuToday, thisWeek: saikakuThisWeek },
      uaam: { today: uaamToday, thisWeek: uaamThisWeek },
      integrations: { today: integrationsToday, thisWeek: integrationsThisWeek },
    };

    return res.status(200).json({
      today: breakdown.saikaku.today + breakdown.uaam.today + breakdown.integrations.today,
      thisWeek: breakdown.saikaku.thisWeek + breakdown.uaam.thisWeek + breakdown.integrations.thisWeek,
      breakdown,
    });
  } catch (e) {
    console.error('[api/admin/summary-counts] aggregation failed:', e);
    return res.status(500).json({ error: '集計に失敗しました' });
  }
}
