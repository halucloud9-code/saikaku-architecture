// Server (api/lib/coachingAnswerKey.js) と同じ手順で質問文を正規化する純関数。
// hash 計算は不要 — normalize 結果同士の string equality で qid 同一性を判定できる。
// （同じ normalize を経るので、サーバ側 sha1(normalized) と client 側 sha1(normalized) は必ず一致する）
export function normalizeQuestionText(text) {
  if (typeof text !== 'string') return null;
  let s = text.normalize('NFKC').trim();
  s = s.replace(/　/g, ' ');
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/[？！?!．。.]+$/, '');
  return s.length === 0 ? null : s;
}
