import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/firebaseAdmin.js';
import { buildCompatRecommendation } from '../lib/compatRecommend.js';
import { normalizeInternalProfile } from '../lib/compatProfiles.js';
import { requireAdmin } from '../lib/requireAdmin.js';

const INTERNAL_ID_RE = /^[^/]{1,128}$/u;
const ACTIONS = new Set(['search', 'show_names']);

function invalid(message, code = 'INVALID_REQUEST') {
  const error = new Error(message);
  error.code = code;
  error.status = 400;
  return error;
}

function validateBody(body) {
  if (!ACTIONS.has(body?.action)) throw invalid('操作の種類が不正です');
  if (!Array.isArray(body.members) || body.members.length < 2 || body.members.length > 10) {
    throw invalid('選択メンバーは2〜10名で指定してください');
  }
  if (body.consent !== true) throw invalid('対象者の同意確認が必要です', 'CONSENT_REQUIRED');
  if (body.members.some((member) => member?.source !== 'internal')) {
    throw invalid('受講者さがしは内部メンバーのみで実行できます');
  }

  const seen = new Set();
  for (const member of body.members) {
    const identity = member.id;
    if (typeof identity !== 'string' || !identity || seen.has(`internal:${identity}`)) {
      throw invalid('選択メンバーが重複または不正です');
    }
    if (!INTERNAL_ID_RE.test(identity)) {
      throw invalid('内部プロフィールIDが不正です');
    }
    seen.add(`internal:${identity}`);
  }

  return {
    action: body.action,
    members: body.members,
    selectedProfileIds: body.members.map((member) => member.id),
  };
}

async function loadInternalProfiles(selectedProfileIds) {
  const [resultsSnapshot, uaamSnapshot] = await Promise.all([
    db.collection('results').get(),
    db.collection('uaam_results').get(),
  ]);
  const uaamById = new Map(uaamSnapshot.docs.map((doc) => [doc.id, doc.data()]));
  const profiles = resultsSnapshot.docs.map((doc) => (
    normalizeInternalProfile(doc.id, doc.data(), uaamById.get(doc.id))
  ));
  const availableIds = new Set(profiles.map((profile) => profile.id));
  if (selectedProfileIds.some((id) => !availableIds.has(id))) {
    const error = new Error('選択したプロフィールが見つかりません');
    error.code = 'PROFILE_NOT_FOUND';
    error.status = 404;
    throw error;
  }
  return profiles;
}

async function writeAudit(admin, action, memberCount, candidateCount) {
  await db.collection('compat_audits').add({
    action,
    actorUid: admin.uid,
    memberCount,
    candidateCount,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', error: 'POSTのみ対応しています' });
  }
  const admin = await requireAdmin(req, res);
  if (!admin) return undefined;

  try {
    const input = validateBody(req.body);
    const profiles = await loadInternalProfiles(input.selectedProfileIds);
    const recommendation = buildCompatRecommendation(profiles, input.selectedProfileIds);
    const auditAction = input.action === 'search' ? 'recommend_search' : 'recommend_names_shown';
    await writeAudit(admin, auditAction, input.members.length, recommendation.candidates.length);

    if (input.action === 'search') {
      return res.status(200).json({
        stage: 'summary',
        shortages: recommendation.summary,
      });
    }
    return res.status(200).json({
      stage: 'names',
      candidates: recommendation.candidates.map(({ profileId: _profileId, ...candidate }) => candidate),
    });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ code: error.code, error: error.message });
    console.error('[compat-recommend] failed:', error?.message || error);
    return res.status(500).json({ code: 'INTERNAL_ERROR', error: '受講者を検索できませんでした' });
  }
}
