export function formatAttemptDate(value) {
  if (value === null || value === undefined) return '日付未設定';
  let date;
  if (typeof value === 'string') {
    date = new Date(value);
  } else if (typeof value?.toDate === 'function') {
    date = value.toDate();
  } else if (typeof value?._seconds === 'number') {
    date = new Date(value._seconds * 1000);
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) return '日付未設定';

  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getAttemptDate(attempt) {
  return attempt.summary?.createdAt ?? attempt.createdAt ?? null;
}

export function getAttemptLabel(attempt, kind) {
  if (kind === 'uaam') {
    return attempt.label
      ?? attempt.summary?.typeName
      ?? 'MATRIX 診断結果';
  }

  return attempt.label
    ?? attempt.summary?.kakuchiiki
    ?? '才覚領域 診断結果';
}

export function getAttemptOrdinal(attempt, index, total) {
  if (attempt.isLegacy) return '保存済み履歴';
  return `${total - index}回目`;
}
