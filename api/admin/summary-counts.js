import { getAuth } from 'firebase-admin/auth';
import { Timestamp } from 'firebase-admin/firestore';
import { db, ADMIN_EMAILS } from '../lib/firebaseAdmin.js';
import { jstDayBoundary, weekBoundary } from '../../src/utils/adminSummaryCounts.js';
import { legacyIntegrationFromParent } from '../lib/legacyIntegration.js';

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

function tsToMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts._seconds === 'number') return ts._seconds * 1000;
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return null;
}

// 統合分析カウントは aggregate count では完結しない理由が2つある:
// (1) `collectionGroup('integrations')` は他親 namespace の rogue subcollection も拾う → `uaam_results` 配下のみに絞る必要がある (api/admin/integrations.js と同じ namespace ルール)
// (2) 未移行 legacy UAAM では `uaam_results/{uid}` 親に `analysis.saikaku_integration` が埋め込まれており、admin タブでは legacy fallback として 1件表示される (api/admin/integrations.js の `legacyIntegrationFromParent` 経由)
//
// 両者を含めることで「admin タブの表示件数」と「サマリーカードの統合分析件数」を整合させる。
async function countIntegrationsForBoundaries(todayBoundary, thisWeekBoundary) {
  const todayMs = todayBoundary.getTime();
  const thisWeekMs = thisWeekBoundary.getTime();

  const [cgSnap, uaamParentsSnap] = await Promise.all([
    db.collectionGroup('integrations').get(),
    db.collection('uaam_results').get(),
  ]);

  const uidsWithSubcollection = new Set();
  let subToday = 0;
  let subThisWeek = 0;

  for (const docSnap of cgSnap.docs) {
    // (1) namespace filter: uaam_results/{uid}/integrations/{pairKey} のみ
    if (docSnap.ref.parent.parent?.parent.id !== 'uaam_results') continue;

    const uid = docSnap.ref.parent.parent?.id;
    if (uid) uidsWithSubcollection.add(uid);

    const ms = tsToMillis(docSnap.data().createdAt);
    if (ms === null) continue;
    if (ms >= todayMs) subToday += 1;
    if (ms >= thisWeekMs) subThisWeek += 1;
  }

  let legacyToday = 0;
  let legacyThisWeek = 0;

  for (const docSnap of uaamParentsSnap.docs) {
    // (2) legacy fallback: subcollection に1件もない uid のみ legacy 1件として数える (admin タブと同じ意味論)
    if (uidsWithSubcollection.has(docSnap.id)) continue;
    const parentData = docSnap.data();
    if (!legacyIntegrationFromParent(parentData)) continue;

    const ms = tsToMillis(parentData.integrationUpdatedAt);
    if (ms === null) continue;
    if (ms >= todayMs) legacyToday += 1;
    if (ms >= thisWeekMs) legacyThisWeek += 1;
  }

  return {
    today: subToday + legacyToday,
    thisWeek: subThisWeek + legacyThisWeek,
  };
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

    const [saikakuToday, saikakuThisWeek, uaamToday, uaamThisWeek, integrations] = await Promise.all([
      countQuery(createdAtSince(db.collection('results'), todayBoundary)),
      countQuery(createdAtSince(db.collection('results'), thisWeekBoundary)),
      countQuery(createdAtSince(db.collection('uaam_results'), todayBoundary)),
      countQuery(createdAtSince(db.collection('uaam_results'), thisWeekBoundary)),
      countIntegrationsForBoundaries(todayBoundary, thisWeekBoundary),
    ]);

    const breakdown = {
      saikaku: { today: saikakuToday, thisWeek: saikakuThisWeek },
      uaam: { today: uaamToday, thisWeek: uaamThisWeek },
      integrations,
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
