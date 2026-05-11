import { db } from '../lib/firebaseAdmin.js';
import { isLegacyFallback, listIntegrationDocs } from '../lib/legacyIntegration.js';
import { integrationSummary, recentIntegrationSummaries } from '../lib/recentIntegrationSummaries.js';
import { serializeTimestamps } from '../lib/serialize.js';
import { authenticateMeRequest, withMeHandler } from './_auth.js';
import { isValidAttemptId, selectIntegrationForAttempt } from '../../shared/attemptLogic.js';

function readSingleQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function readAttemptId(req) {
  const value = readSingleQueryValue(req.query.attemptId);
  if (value === undefined) return null;
  if (!isValidAttemptId(value)) {
    return undefined;
  }
  return value;
}

function legacyFallbackIntegration(integrations) {
  return integrations.find(isLegacyFallback) ?? null;
}

function selectUaamIntegration(integrations, attemptId, attemptIsLegacy) {
  // 全体取得モード（attemptId なし）は subcollection が空のときに legacy
  // fallback synthesize を返す（既存挙動）。
  if (!attemptId) return legacyFallbackIntegration(integrations);
  const pairMatched = selectIntegrationForAttempt(integrations, 'uaam', attemptId);
  if (pairMatched) return pairMatched;
  // attempt-scoped 取得で pair match なし → attempt 自体が legacy のとき
  // のみ legacy-fallback を継承する。real attempt には関係ない legacy
  // integration を attach しない（PR #60 P2 対応）。
  if (attemptIsLegacy) return legacyFallbackIntegration(integrations);
  return null;
}

function emptyResult(includeIntegrationSummary, recent = []) {
  const response = { scores: null, analysis: null, recentIntegrationSummaries: recent };
  if (includeIntegrationSummary) response.integrationSummary = null;
  return response;
}

export default withMeHandler(async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');

  if (req.method !== 'GET') return res.status(405).json({ code: 'method_not_allowed' });

  const decoded = await authenticateMeRequest(req, res);
  if (!decoded) return undefined;

  const requestedAttemptId = readAttemptId(req);
  if (requestedAttemptId === undefined) {
    return res.status(422).json({ error: 'attemptId is invalid', code: 'invalid_input', field: 'attemptId' });
  }

  const parentRef = db.collection('uaam_results').doc(decoded.uid);
  const saikakuParentRef = db.collection('results').doc(decoded.uid);
  let attemptData = null;
  let attemptIsLegacy = false;

  if (requestedAttemptId) {
    // attemptId 指定時は、まず軽量な attempt doc だけを検証する。
    // 存在しない attempt で parent/integrations の重い補助 read を起動しない。
    const attemptSnap = await parentRef.collection('attempts').doc(requestedAttemptId).get();
    if (!attemptSnap.exists || attemptSnap.data()?.status !== 'committed') {
      return res.status(404).json({ error: 'attempt not found', code: 'not_found' });
    }

    attemptData = attemptSnap.data() ?? {};
    attemptIsLegacy = !!attemptData.isLegacy;
  }

  const [snapshot, saikakuParentSnap, integrationsSnap] = await Promise.all([
    parentRef.get(),
    saikakuParentRef.get(),
    parentRef.collection('integrations').get(),
  ]);

  const data = snapshot.exists ? (snapshot.data() ?? {}) : null;
  const integrations = listIntegrationDocs(integrationsSnap, data);
  const latestSaikakuAttemptId = saikakuParentSnap.exists
    ? saikakuParentSnap.data()?.latestAttemptId ?? null
    : null;
  const latestIds = {
    saikakuAttemptId: latestSaikakuAttemptId,
    uaamAttemptId: data?.latestAttemptId ?? null,
  };
  const recent = recentIntegrationSummaries(integrations, latestIds);

  if (!snapshot.exists) {
    // 親 doc が存在しない場合、Firestore の仕様上 subcollection に orphaned
    // integration が残っている可能性がある。ユーザー視点で「結果は無い」状態と
    // 整合させるため、recentIntegrationSummaries は明示的に空配列で返す。
    return res.status(200).json(serializeTimestamps(emptyResult(requestedAttemptId !== null, [])));
  }

  const resolvedAttemptId = requestedAttemptId ?? data.latestAttemptId ?? null;

  let scores = data.scores ?? null;
  let analysis = data.analysis ?? null;

  if (requestedAttemptId) {
    const full = attemptData?.full ?? {};
    scores = full.scores ?? null;
    analysis = full.analysis ?? null;
  }

  const selectedIntegration = selectUaamIntegration(integrations, resolvedAttemptId, attemptIsLegacy);
  const summary = integrationSummary(selectedIntegration, latestIds);
  const includeIntegrationSummary = requestedAttemptId !== null || !!summary;

  if (!scores || !analysis) {
    return res.status(200).json(serializeTimestamps(emptyResult(includeIntegrationSummary, recent)));
  }

  const responseAnalysis = selectedIntegration?.integration
    ? { ...analysis, saikaku_integration: selectedIntegration.integration }
    : analysis;

  const response = {
    scores,
    analysis: responseAnalysis,
    recentIntegrationSummaries: recent,
  };
  if (includeIntegrationSummary) response.integrationSummary = summary;

  return res.status(200).json(serializeTimestamps(response));
});
