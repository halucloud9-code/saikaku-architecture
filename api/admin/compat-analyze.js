import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/firebaseAdmin.js';
import { buildCompatEvidence } from '../lib/compatEvidence.js';
import { normalizeInternalProfile } from '../lib/compatProfiles.js';
import { COMPAT_MODEL, generateCompatOutput } from '../lib/compatPrompt.js';
import { COMPAT_ETHICS_NOTICE } from '../lib/compatShare.js';
import { fetchPublicCompatProfile } from '../lib/publicCompatImport.js';
import { requireAdmin } from '../lib/requireAdmin.js';

const INTERNAL_ID_RE = /^[^/]{1,128}$/u;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/giu;

function invalid(message, code = 'INVALID_REQUEST') {
  const error = new Error(message);
  error.code = code;
  error.status = 400;
  return error;
}

function validateBody(body) {
  const mode = body?.mode;
  if (!['pair', 'team'].includes(mode)) throw invalid('分析モードが不正です');
  if (!Array.isArray(body.members)) throw invalid('対象者を選択してください');
  if (mode === 'pair' && body.members.length !== 2) throw invalid('ペア分析は2名を選択してください');
  if (mode === 'team' && (body.members.length < 3 || body.members.length > 10)) throw invalid('チーム分析は3〜10名を選択してください');
  if (mode === 'team' && (typeof body.goal !== 'string' || !body.goal.trim())) throw invalid('チーム分析には目的が必要です', 'TEAM_GOAL_REQUIRED');
  if (typeof body.goal === 'string' && body.goal.length > 500) throw invalid('目的は500文字以内で入力してください');
  if (body.consent !== true) throw invalid('対象者全員の同意確認が必要です', 'CONSENT_REQUIRED');

  const seen = new Set();
  for (const member of body.members) {
    if (!member || !['internal', 'public'].includes(member.source)) throw invalid('対象者の形式が不正です');
    const key = member.source === 'internal' ? member.id : member.shareUrl;
    if (typeof key !== 'string' || !key || seen.has(`${member.source}:${key}`)) throw invalid('対象者が重複または不正です');
    seen.add(`${member.source}:${key}`);
    if (member.source === 'internal' && !INTERNAL_ID_RE.test(member.id)) throw invalid('内部プロフィールIDが不正です');
    if (typeof member.profileVersion !== 'string' || !member.profileVersion || member.profileVersion.length > 160) throw invalid('profileVersion が必要です');
  }
  return { mode, members: body.members, goal: body.goal?.trim() || '', consent: true };
}

async function loadProfiles(members) {
  return Promise.all(members.map(async (member) => {
    if (member.source === 'public') return fetchPublicCompatProfile(member.shareUrl);
    const [resultSnap, uaamSnap] = await Promise.all([
      db.collection('results').doc(member.id).get(),
      db.collection('uaam_results').doc(member.id).get(),
    ]);
    if (!resultSnap.exists) {
      const error = new Error('選択したプロフィールが見つかりません');
      error.code = 'PROFILE_NOT_FOUND';
      error.status = 404;
      throw error;
    }
    // profileVersion は将来の楽観ロック用に受け取るが、単一運営者MVPでは比較しない。
    return normalizeInternalProfile(member.id, resultSnap.data(), uaamSnap.exists ? uaamSnap.data() : null);
  }));
}

function redactText(value, identifiers) {
  let text = value;
  for (const identifier of identifiers) {
    if (identifier.length < 2) continue;
    text = text.split(identifier).join('[識別子]');
  }
  return text.replace(EMAIL_RE, '[メール]').replace(UUID_RE, '[識別子]');
}

function redactDeep(value, identifiers) {
  if (typeof value === 'string') return redactText(value, identifiers);
  if (Array.isArray(value)) return value.map((item) => redactDeep(item, identifiers));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, redactDeep(child, identifiers)]));
  return value;
}

async function writeAudit(admin, input, status, errorCode = null) {
  await db.collection('compat_audits').add({
    actorUid: admin.uid,
    mode: input.mode,
    memberCount: input.members.length,
    memberSources: input.members.map((member) => member.source),
    consentConfirmed: true,
    goalProvided: input.mode === 'team',
    model: COMPAT_MODEL,
    status,
    errorCode,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', error: 'POSTのみ対応しています' });
  const admin = await requireAdmin(req, res);
  if (!admin) return undefined;

  let input;
  try {
    input = validateBody(req.body);
    const profiles = await loadProfiles(input.members);
    const uaamSnapshot = await db.collection('uaam_results').get();
    const uaamDocs = uaamSnapshot.docs.map((doc) => doc.data());
    const evidence = buildCompatEvidence(profiles, uaamDocs, input.mode);
    const identifiers = [...new Set(profiles.flatMap((profile) => profile.identifiers).filter(Boolean))]
      .sort((left, right) => right.length - left.length);
    const promptEvidence = redactDeep(evidence.promptEvidence, identifiers);
    const promptSufficiency = redactDeep(evidence.dataSufficiency, identifiers);
    const goal = redactText(input.goal, identifiers);
    const generated = await generateCompatOutput({
      mode: input.mode,
      goal,
      promptEvidence,
      dataSufficiency: promptSufficiency,
      evidenceLedger: evidence.ledger,
    });

    const result = {
      dataSufficiency: evidence.dataSufficiency,
      lenses: generated.lenses,
      evidence: evidence.promptEvidence,
      ethicsNotice: COMPAT_ETHICS_NOTICE,
      model: COMPAT_MODEL,
    };
    await writeAudit(admin, input, 'completed');
    return res.status(200).json(result);
  } catch (error) {
    if (input) {
      try {
        await writeAudit(admin, input, 'failed', error?.code || 'INTERNAL_ERROR');
      } catch (auditError) {
        console.error('[compat-analyze] audit write failed:', auditError?.message || auditError);
      }
    }
    if (error?.status) return res.status(error.status).json({ code: error.code, error: error.message });
    if (error?.code === 'COMPAT_OUTPUT_INVALID') {
      return res.status(502).json({ code: 'COMPAT_OUTPUT_INVALID', error: '分析結果の安全性を確認できませんでした。時間をおいて再度お試しください。' });
    }
    console.error('[compat-analyze] failed:', error?.message || error);
    return res.status(500).json({ code: 'INTERNAL_ERROR', error: '相性分析に失敗しました' });
  }
}
