/**
 * normalize.js — スコアデータ正規化の唯一の定義場所
 *
 * 【存在理由】
 * calculateScores() が返す構造と、Firestoreに保存される構造と、
 * コンポーネントが期待する構造がズレると毎回バグになる。
 * このファイルがスコアの「形」を定義する唯一の場所。
 * 変換はここだけで行い、App.jsx / UAAMResultScreen に散らさない。
 *
 * 【スコアの正規形（NormalizedScore）】
 * {
 *   mindset: {
 *     total: number,       // 生合計点
 *     max: number,         // 満点
 *     percentage: number,  // 0〜100 の整数
 *     subs: { [key]: number },      // 才覚ごとの点数（APIキー名）
 *     domainSubs: { [key]: number },// subs と同値（ActivationMatrix が使う）
 *     domainTotal: number,          // total と同値（ActivationMatrix が使う）
 *   },
 *   literacy:   { ...同上 },
 *   competency: { ...同上 },
 *   impact:     { ...同上 },
 * }
 *
 * 【使い方】
 *   import { normalizeScores } from '../utils/normalize';
 *   const scores = normalizeScores(rawFromFirestore);
 */

const DOMAINS = ['mindset', 'literacy', 'competency', 'impact'];

/**
 * 生のスコアオブジェクトを正規形に変換する。
 * domainSubs / domainTotal が欠けていても補完する。
 * null / undefined が渡されたら null を返す（呼び出し側でガードすること）。
 *
 * @param {object|null} raw
 * @returns {object|null}
 */
export function normalizeScores(raw) {
  if (!raw) return null;

  const out = {};
  for (const domain of DOMAINS) {
    const d = raw[domain];
    if (!d) continue;

    out[domain] = {
      total:       d.total       ?? 0,
      max:         d.max         ?? 80,
      percentage:  d.percentage  ?? 0,
      subs:        d.subs        ?? {},
      // domainSubs / domainTotal は subs / total と同値。
      // calculateScores() は両方返すが、Firestore保存時に片方が欠けることがある。
      domainSubs:  d.domainSubs  ?? d.subs  ?? {},
      domainTotal: d.domainTotal ?? d.total ?? 0,
    };
  }
  return out;
}

/**
 * スコアが正規形かどうかを検証する（デバッグ用）。
 * 問題があれば警告配列を返す。
 *
 * @param {object} scores
 * @returns {string[]} 警告メッセージ（空なら正常）
 */
export function auditScores(scores) {
  const warnings = [];
  if (!scores) { warnings.push('scores が null/undefined'); return warnings; }

  for (const domain of DOMAINS) {
    const d = scores[domain];
    if (!d) { warnings.push(`${domain} が欠落`); continue; }
    if (d.domainSubs === undefined) warnings.push(`${domain}.domainSubs が未定義`);
    if (d.domainTotal === undefined) warnings.push(`${domain}.domainTotal が未定義`);
    if (typeof d.percentage !== 'number') warnings.push(`${domain}.percentage が数値でない`);
  }
  return warnings;
}
