/**
 * 11人ベンチマークデータで calculateBiasMessage を検証する。
 * Notion「3. データセット（11人ベンチマーク）」と「5. 自己評価バイアス3段階表記」の期待値に基づく。
 *
 * 実行: node test_bias_11users.mjs
 */
import { calculateBiasMessage } from './src/data/uaam_questions.js';

const cases = [
  // [name, V1, V2, V3, totalPct, expected.biasPct (null=表示なし), expected.level]
  ['小林桃子',     5, 5, 5, 35, null, null],
  ['幸奈山田',     5, 5, 5, 40, null, null],
  ['KG',           5, 5, 5, 43, null, null],
  ['勝屋裕貴',     5, 5, 5, 51, null, null],
  ['Yu Koji',      5, 5, 5, 52, null, null],
  ['つかさ',        5, 2, 5, 60, 45,   'mild'],
  ['野田健一',      5, 5, 5, 62, null, null],
  ['Natsuki',      5, 5, 2, 68, 45,   'mild'],
  ['玄氣-GENKI',   5, 5, 5, 70, null, null],
  ['ハル(本人)',    2, 2, 2, 81, 65,   'transition'],   // moderate, totalPct 78-94 → transition
  ['藤吹奈都',      2, 2, 1, 97, 75,   'high_stage'],   // moderate, totalPct >= 95 → high_stage
  // 追加のエッジケース（実装手順 Step 5 の表より）
  ['EDGE: 軽度 V1のみ',         2, 5, 5, 50, 45, 'mild'],
  // V[2,2,5] は warning+warning+0 = 2旗 → 55% mild（ハル指定の固定テーブル準拠）。
  // Notion ページ7のテスト表は「65% 中度」と書いてあるが、ページ5の固定テーブルと矛盾する誤記。
  ['EDGE: 軽度 V1+V2 (2旗)',     2, 2, 5, 70, 55, 'mild'],
  // 中度の代表例として V[1,2,5] = critical+warning = 3旗 → 65% moderate を追加
  ['EDGE: 中度 V1+V2 (3旗)',     1, 2, 5, 70, 65, 'moderate'],
  ['EDGE: 強度 critical2以上',   2, 1, 1, 50, 86, 'strong'],   // 旗数=2+2+1=5 → 86%
  ['EDGE: 強度 全critical',      1, 1, 1, 50, 95, 'strong'],   // 旗数=2+2+2=6 → 95%
];

let pass = 0, fail = 0;
const results = [];

for (const [name, v1, v2, v3, totalPct, expBias, expLevel] of cases) {
  const result = calculateBiasMessage({ V1: v1, V2: v2, V3: v3 }, totalPct);

  const actualBias = result === null ? null : result.biasPct;
  const actualLevel = result === null ? null : result.level;

  const ok = (actualBias === expBias) && (actualLevel === expLevel);
  if (ok) pass++; else fail++;

  results.push({
    ok,
    name,
    input: `V[${v1},${v2},${v3}] total=${totalPct}%`,
    expected: expBias === null ? '表示なし' : `${expBias}% / ${expLevel}`,
    actual: result === null ? '表示なし' : `${result.biasPct}% / ${result.level}${result.pattern ? ` (${result.pattern})` : ''}`,
    message: result?.message?.slice(0, 60) || '',
  });
}

console.log('\n=== 11人ベンチマーク + エッジケース：calculateBiasMessage 検証 ===\n');
for (const r of results) {
  const icon = r.ok ? '✅' : '❌';
  console.log(`${icon} ${r.name.padEnd(20)} | ${r.input.padEnd(25)} | exp: ${r.expected.padEnd(20)} | got: ${r.actual}`);
  if (r.message) console.log(`     msg: ${r.message}...`);
}

console.log('\n--- 詳細：強度3分岐の確認 ---');
const strongCases = [
  ['真の天地型 (95%超)',    1, 1, 1, 97],
  ['L5-L6移行期 (78-94%)',   1, 1, 1, 81],
  ['強インフレ警告 (<78%)', 1, 1, 1, 50],
];
for (const [label, v1, v2, v3, pct] of strongCases) {
  const r = calculateBiasMessage({ V1: v1, V2: v2, V3: v3 }, pct);
  console.log(`  ${label}: biasPct=${r.biasPct} level=${r.level} pattern=${r.pattern}`);
}

console.log(`\n=== 結果: ${pass} passed, ${fail} failed (out of ${cases.length}) ===`);
process.exit(fail > 0 ? 1 : 0);
