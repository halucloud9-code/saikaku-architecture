/**
 * Phase 2：コーチによる人格L＋リーダー段階の確定値を uaam_results に保存する。
 *
 * 自動推定値（personality_level / leadership_stage）は API 側で計算済みなので
 * 上書きしない。コーチ確定は別フィールドに分けて、推定との差分を分析できるようにする。
 *
 * 受け付けるフィールド：
 *   - coach_confirmed_personality_level: 'L1' 〜 'L7' or null
 *   - coach_confirmed_leadership_stage:   1〜7 or null
 *   - coach_observation_note:             string (free text) or ''
 */
import { getAuth } from 'firebase-admin/auth';
import { db, ADMIN_EMAILS } from '../lib/firebaseAdmin.js';
import { FieldValue } from 'firebase-admin/firestore';

const VALID_LEVELS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

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

  const { uid, fields } = req.body;
  if (!uid || !fields) return res.status(400).json({ error: 'uid と fields が必要です' });

  // バリデーション + 許可フィールドのみ
  const safeFields = {};

  if ('coach_confirmed_personality_level' in fields) {
    const v = fields.coach_confirmed_personality_level;
    if (v === null || v === '') {
      safeFields.coach_confirmed_personality_level = null;
    } else if (VALID_LEVELS.includes(v)) {
      safeFields.coach_confirmed_personality_level = v;
    } else {
      return res.status(400).json({ error: 'coach_confirmed_personality_level は L1〜L7 または null' });
    }
  }

  if ('coach_confirmed_leadership_stage' in fields) {
    const v = fields.coach_confirmed_leadership_stage;
    if (v === null || v === '') {
      safeFields.coach_confirmed_leadership_stage = null;
    } else {
      const n = Number(v);
      if (Number.isInteger(n) && n >= 1 && n <= 7) {
        safeFields.coach_confirmed_leadership_stage = n;
      } else {
        return res.status(400).json({ error: 'coach_confirmed_leadership_stage は 1〜7 または null' });
      }
    }
  }

  if ('coach_observation_note' in fields) {
    const v = fields.coach_observation_note;
    if (typeof v === 'string' && v.length <= 2000) {
      safeFields.coach_observation_note = v;
    } else if (v === null) {
      safeFields.coach_observation_note = null;
    } else {
      return res.status(400).json({ error: 'coach_observation_note は文字列（2000字以内）または null' });
    }
  }

  if (Object.keys(safeFields).length === 0) {
    return res.status(400).json({ error: '更新可能なフィールドがありません' });
  }

  // 監査用：誰が・いつ確定したかも保存
  safeFields.coach_confirmed_by = decoded.email;
  safeFields.coach_confirmed_at = FieldValue.serverTimestamp();

  try {
    await db.collection('uaam_results').doc(uid).set(safeFields, { merge: true });
    return res.status(200).json({ success: true, updated: safeFields });
  } catch (e) {
    console.error('[update-uaam-coach]', e);
    return res.status(500).json({ error: e.message || '更新に失敗しました' });
  }
}
