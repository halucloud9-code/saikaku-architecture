/**
 * validateIntegration.js — AI出力の契約検証＋自動修正層
 *
 * 【存在理由】
 * AIは指示を守らないことがある。
 * 英語名で返してきたり、必須フィールドが欠けたりする。
 * Firestoreに保存する「前」にここで止め、自動修正できるものは直す。
 * これにより「表示側でtoJP()パッチ」だけに依存しない二重防衛になる。
 *
 * 使い方（api/integrate.js）:
 *   import { validateAndFix } from './lib/validateIntegration.js';
 *   const { fixed, errors } = validateAndFix(parsed);
 *   if (errors.length > 0) console.warn('[contract] 修正あり:', errors);
 *   integration = fixed;
 */

// ── 英語才覚名 → 日本語才覚名 マッピング ────────────────────────────────
// ここが唯一の正規マッピング定義。SaikakuIntegration.jsx の EN_TO_JP と同一内容。
// 変更するときは両方を同時に更新すること。
export const EN_TO_JP = {
  Meaning:        '基軸力',
  Mindfulness:    '認知力',
  Mindshift:      '転換力',
  Mastery:        '熟達力',
  Learning:       '謙学力',
  Logical:        '論理力',
  Life:           '活用力',
  Leadership:     '統率力',
  Critical:       '本質力',
  Creativity:     '創造力',
  Communication:  '伝達力',
  Collaboration:  '協働力',
  Idea:           '構想力',
  Innovation:     '変革力',
  Implementation: '実装力',
  Influence:      '影響力',
};

// ── 必須フィールド定義 ──────────────────────────────────────────────────
// AIがこれらを返さなかったらリトライすべきエラー
const REQUIRED_FIELDS = [
  'integration_score',
  'activation_core',
  'activation_equation',
  'leverage_point',
  'ignition_zones',
  'latent_zones',
  'idle_zones',
  'mission_direction',
  'flow_route',
  'hidden_potential',
  'roadmap',
  'coaching_questions',
];

// ── テキスト内の英語才覚名を日本語に置換 ────────────────────────────────
function toJP(text) {
  if (!text || typeof text !== 'string') return text;
  return Object.entries(EN_TO_JP).reduce(
    (s, [en, jp]) => s.replace(new RegExp(en, 'g'), jp),
    text
  );
}

// ── オブジェクトを再帰的に文字列フィールドだけ変換 ────────────────────
function deepToJP(obj) {
  if (typeof obj === 'string') return toJP(obj);
  if (Array.isArray(obj)) return obj.map(deepToJP);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = deepToJP(v);
    }
    return out;
  }
  return obj;
}

// ── 英語才覚名が残っているか検出 ─────────────────────────────────────
function detectEnglishTerms(obj) {
  const str = JSON.stringify(obj);
  return Object.keys(EN_TO_JP).filter((en) => str.includes(en));
}

// ── メイン：検証＆自動修正 ───────────────────────────────────────────
/**
 * @param {object} raw - AIが返したパース済みJSON
 * @returns {{ fixed: object, errors: string[] }}
 *   fixed  = 修正済みの安全なオブジェクト
 *   errors = 何を修正したか（ログ用）。空なら問題なし。
 */
export function validateAndFix(raw) {
  const errors = [];

  // ① 必須フィールド存在チェック
  for (const field of REQUIRED_FIELDS) {
    if (raw[field] === undefined || raw[field] === null) {
      errors.push(`必須フィールド欠落: ${field}`);
    }
  }

  // ② integration_score が 0〜100 の整数かチェック
  if (typeof raw.integration_score !== 'number'
    || raw.integration_score < 0
    || raw.integration_score > 100) {
    errors.push(`integration_score 異常値: ${raw.integration_score}`);
  }

  // ③ 英語才覚名検出 → 自動修正
  const englishFound = detectEnglishTerms(raw);
  if (englishFound.length > 0) {
    errors.push(`英語才覚名を検出・自動修正: ${englishFound.join(', ')}`);
  }

  // ④ deepToJP で全テキストを日本語化（英語が残っていてもここで吸収）
  const fixed = deepToJP(raw);

  return { fixed, errors };
}
