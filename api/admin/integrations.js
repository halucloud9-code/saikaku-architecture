import { getAuth } from 'firebase-admin/auth';
import { db, ADMIN_EMAILS } from '../lib/firebaseAdmin.js';
import { computeStatus } from '../lib/integrationStatus.js';
import {
  integrationFromDoc,
  isLegacyFallback,
  legacyIntegrationFromParent,
} from '../lib/legacyIntegration.js';

function tsToMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts._seconds === 'number') return ts._seconds * 1000;
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return null;
}

function tsToIso(ts) {
  const ms = tsToMillis(ts);
  return typeof ms === 'number' ? new Date(ms).toISOString() : null;
}

function firstStringOrNull(...values) {
  const value = values.find((item) => typeof item === 'string' && item.trim() !== '');
  return value ?? null;
}

function snapshotDataByUid(snapshot) {
  return new Map(snapshot.docs.map((docSnap) => [docSnap.id, docSnap.data() || {}]));
}

function integrationUid(docSnap) {
  return docSnap.ref.parent.parent?.id ?? null;
}

function addIntegrationDoc(map, uid, integrationDoc) {
  if (!uid) return;
  const current = map.get(uid) ?? [];
  current.push(integrationDoc);
  map.set(uid, current);
}

function responseItem(uid, integrationDoc, uaamParentData, saikakuParentData) {
  const latestIds = {
    saikakuAttemptId: saikakuParentData?.latestAttemptId ?? null,
    uaamAttemptId: uaamParentData?.latestAttemptId ?? null,
  };
  const status = computeStatus(integrationDoc, 'admin', latestIds);
  const pairKey = integrationDoc.id
    ?? `${integrationDoc.saikakuAttemptId ?? ''}__${integrationDoc.uaamAttemptId ?? ''}`;

  return {
    uid,
    userName: firstStringOrNull(uaamParentData?.name, saikakuParentData?.name),
    userEmail: firstStringOrNull(uaamParentData?.email, saikakuParentData?.email),
    saikakuAttemptId: integrationDoc.saikakuAttemptId ?? '',
    uaamAttemptId: integrationDoc.uaamAttemptId ?? '',
    pairKey,
    regenerationCount: integrationDoc.regenerationCount ?? 0,
    model: integrationDoc.model ?? null,
    source: integrationDoc.source ?? null,
    status: status.status,
    staleSaikaku: status.staleSaikaku,
    staleUaam: status.staleUaam,
    integration: integrationDoc.integration ?? {},
    createdAt: tsToIso(integrationDoc.createdAt),
    updatedAt: tsToIso(integrationDoc.updatedAt),
    isLegacyFallback: isLegacyFallback(integrationDoc),
    _createdAtMillis: tsToMillis(integrationDoc.createdAt) ?? Number.NEGATIVE_INFINITY,
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

  const [cgSnap, uaamParentsSnap, resultsParentsSnap] = await Promise.all([
    db.collectionGroup('integrations').get(),
    db.collection('uaam_results').get(),
    db.collection('results').get(),
  ]);

  // Path: uaam_results/{uid}/integrations/{pairKey}
  const integrationDocs = cgSnap.docs.filter(
    (d) => d.ref.parent.parent?.parent.id === 'uaam_results'
  );
  const uaamParentsByUid = snapshotDataByUid(uaamParentsSnap);
  const resultsParentsByUid = snapshotDataByUid(resultsParentsSnap);
  const integrationsByUid = new Map();

  integrationDocs.forEach((docSnap) => {
    addIntegrationDoc(integrationsByUid, integrationUid(docSnap), integrationFromDoc(docSnap));
  });

  uaamParentsByUid.forEach((parentData, uid) => {
    if (integrationsByUid.has(uid)) return;
    const legacy = legacyIntegrationFromParent(parentData);
    if (legacy) addIntegrationDoc(integrationsByUid, uid, legacy);
  });

  if (integrationsByUid.size > 1000) {
    console.warn('[api/admin/integrations] integration user count exceeded 1000', {
      totalUsers: integrationsByUid.size,
    });
  }

  const integrations = [];
  integrationsByUid.forEach((docs, uid) => {
    const uaamParentData = uaamParentsByUid.get(uid) ?? null;
    const saikakuParentData = resultsParentsByUid.get(uid) ?? null;
    docs.forEach((integrationDoc) => {
      integrations.push(responseItem(uid, integrationDoc, uaamParentData, saikakuParentData));
    });
  });

  integrations.sort((a, b) => b._createdAtMillis - a._createdAtMillis);
  const responseIntegrations = integrations.map(({ _createdAtMillis, ...item }) => item);

  return res.status(200).json({
    integrations: responseIntegrations,
    total: responseIntegrations.length,
  });
}
