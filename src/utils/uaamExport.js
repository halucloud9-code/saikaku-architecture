import { getVFlags, calculateBiasMessage } from '../data/uaam_questions';

export const UAAM_EXPORT_FIELD_DEFS = [
  { key: 'name', label: '名前' },
  { key: 'email', label: 'メール' },
  { key: 'mindset', label: '志(%)' },
  { key: 'literacy', label: '知(%)' },
  { key: 'competency', label: '技(%)' },
  { key: 'impact', label: '衝(%)' },
  { key: 'v1', label: 'V1' },
  { key: 'v2', label: 'V2' },
  { key: 'v3', label: 'V3' },
  { key: 'bias_level', label: 'bias_level' },
  { key: 'bias_message', label: 'bias_message' },
  { key: 'type_name', label: 'タイプ名' },
  { key: 'uaamUpdatedAt', label: '診断日' },
];

export function pct(score) {
  if (score == null) return '';
  return score.percentage ?? Math.round((score.total / (score.max || 1)) * 100);
}

// AdminScreen.getOrCalcBias と同じ三状態 (undefined=legacy→recalc, null=明示的健全, object=保存済み) を保持する。
// CSV と UI の bias 表示を完全一致させるため、UI 側ロジックを inline 複製。
export function resolveBiasMessage(u) {
  if (u.bias_message !== undefined && u.bias_message !== null) return u.bias_message;
  if (u.bias_message === null) return null;
  const v = u.vAnswers || {};
  const s = u.scores || {};
  const totalPct = Math.round(
    ((s.mindset?.total || 0) + (s.literacy?.total || 0) +
      (s.competency?.total || 0) + (s.impact?.total || 0)) / 320 * 100,
  );
  return calculateBiasMessage(v, totalPct);
}

export function formatJpDate(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\//g, '-');
}

export function buildUaamRows(uaamUsers) {
  if (!Array.isArray(uaamUsers)) throw new TypeError('uaamUsers must be an array');

  return uaamUsers.map((u) => {
    const vFlags = getVFlags(u.vAnswers ?? {});

    return {
      name: u.name ?? '',
      email: u.email ?? '',
      mindset: pct(u.scores?.mindset),
      literacy: pct(u.scores?.literacy),
      competency: pct(u.scores?.competency),
      impact: pct(u.scores?.impact),
      v1: vFlags.flags.V1 ?? 'none',
      v2: vFlags.flags.V2 ?? 'none',
      v3: vFlags.flags.V3 ?? 'none',
      bias_level: vFlags.level,
      bias_message: resolveBiasMessage(u)?.message ?? '',
      type_name: u.analysis?.type_name ?? '',
      uaamUpdatedAt: formatJpDate(u.uaamUpdatedAt),
    };
  });
}
