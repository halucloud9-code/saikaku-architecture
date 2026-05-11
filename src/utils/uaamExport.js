import { getVFlags } from '../data/uaam_questions';

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
      bias_message: u.bias_message?.message ?? '',
      type_name: u.analysis?.type_name ?? '',
      uaamUpdatedAt: formatJpDate(u.uaamUpdatedAt),
    };
  });
}
