/**
 * Phase 2：人格L＋リーダー段階の判定式を 11人ベンチマークで検証する。
 * Notion ページ4 の検証結果テーブル準拠。
 */
import {
  determinePersonalityLevel,
  determineLeadershipStage,
  assessConfidence,
  calculateBiasMessage,
} from './src/data/uaam_questions.js';

// [name, [志%,知%,技%,衝%], totalPct, V[1,2,3], 期待L, 期待第N段階, 備考]
const cases = [
  ['小林桃子',     [39,35,36,31], 35, [5,5,5], 'L1', 1, '実L2/-1差'],
  ['幸奈山田',     [39,40,44,38], 40, [5,5,5], 'L2', 1, '実L2 ✓ / 実第1 ✓'],
  ['KG',           [39,43,49,39], 43, [5,5,5], 'L2', 1, '実L1/+1差'],
  ['勝屋裕貴',     [45,51,59,50], 51, [5,5,5], 'L3', 2, '実L2/+1差'],
  ['Yu Koji',      [63,45,55,46], 52, [5,5,5], 'L3', 2, '実L4/-1差 ADHD型'],
  ['つかさ',        [68,55,60,55], 60, [5,2,5], 'L3', 3, '実L4 / バイアス45%mild'],
  ['野田健一',      [64,59,63,63], 62, [5,5,5], 'L3', 3, '実L3 ✓'],
  ['Natsuki',      [69,63,70,68], 68, [5,5,2], 'L4', 4, '実L2/+2 インフレ'],
  ['玄氣-GENKI',   [73,69,70,68], 70, [5,5,5], 'L4', 4, '実L2/+2 観察必須'],
  ['ハル本人',      [85,81,79,79], 81, [2,2,2], 'L5', 5, '実L5-L6 ✓ / バイアス65%transition'],
  ['藤吹奈都',      [99,95,94,99], 97, [2,2,1], 'L7', 7, '実L7 ✓ / バイアス75%high_stage'],
];

let pass = 0, fail = 0;

console.log('\n=== Phase 2：人格L＋リーダー段階 判定式 検証（11人ベンチマーク） ===\n');
console.log('名前              | 軸pct           | total | minAxis | spread | 推定L | 期待L | 段階 | 期待 | 信頼度 | シグナル');
console.log('─'.repeat(140));

for (const [name, axisPcts, totalPct, vAns, expL, expStage, note] of cases) {
  const minAxis = Math.min(...axisPcts);
  const maxAxis = Math.max(...axisPcts);
  const spread = maxAxis - minAxis;

  const baseLevel = determinePersonalityLevel(totalPct, minAxis);
  const bias = calculateBiasMessage({V1: vAns[0], V2: vAns[1], V3: vAns[2]}, totalPct);
  const personality = assessConfidence(baseLevel, bias, spread);
  const stage = determineLeadershipStage(totalPct, minAxis);

  const lOk = personality.level === expL;
  const sOk = stage.stage === expStage;
  const ok = lOk && sOk;
  if (ok) pass++; else fail++;

  const lIcon = lOk ? '✅' : '❌';
  const sIcon = sOk ? '✅' : '❌';

  console.log(
    `${name.padEnd(14)} | ${axisPcts.join(',').padEnd(15)} | ${String(totalPct).padStart(5)}% | ${String(minAxis).padStart(7)}% | ${String(spread).padStart(6)} | ${lIcon}${personality.level} | ${expL.padEnd(5)} | ${sIcon}第${stage.stage} | 第${expStage} | ${personality.confidence.padEnd(6)} | ${personality.signals.join(',') || '-'}`
  );
  console.log(`   ↳ ${note}`);
}

console.log('\n--- 強度バイアス→信頼度 low の確認 ---');
const lowConfTest = cases.filter(([_, __, ___, v]) => {
  const flags = v.map(r => r === 1 ? 2 : r === 2 ? 1 : 0).reduce((a,b)=>a+b,0);
  return flags >= 5;
});
if (lowConfTest.length === 0) {
  // テストデータには強度（5-6旗）はいないので人工データを追加
  const synth = ['SYNTH(全critical)', [50,50,50,50], 50, [1,1,1]];
  const baseLevel = determinePersonalityLevel(synth[2], Math.min(...synth[1]));
  const bias = calculateBiasMessage({V1:1,V2:1,V3:1}, synth[2]);
  const personality = assessConfidence(baseLevel, bias, 0);
  console.log(`  ${synth[0]}: 信頼度=${personality.confidence}, シグナル=[${personality.signals.join(',')}]`);
  if (personality.confidence !== 'low') console.log('  ❌ 強インフレ時に低信頼度にならない');
  else console.log('  ✅ 強インフレ時に低信頼度になる');
}

console.log('\n--- 軸偏り>=18 → axis_imbalance シグナルの確認（Yu Koji ADHD型） ---');
const yk = cases.find(c => c[0] === 'Yu Koji');
const ykMinAxis = Math.min(...yk[1]);
const ykMaxAxis = Math.max(...yk[1]);
const ykSpread = ykMaxAxis - ykMinAxis;
const ykBias = calculateBiasMessage({V1:5,V2:5,V3:5}, yk[2]);
const ykP = assessConfidence(determinePersonalityLevel(yk[2], ykMinAxis), ykBias, ykSpread);
console.log(`  Yu Koji: spread=${ykSpread}, signals=[${ykP.signals.join(',')}], confidence=${ykP.confidence}`);
console.log(`  ${ykP.signals.includes('axis_imbalance') ? '✅' : '❌'} axis_imbalance シグナル検知`);

console.log(`\n=== 結果: ${pass} passed, ${fail} failed (out of ${cases.length}) ===`);
console.log('注：±1差は Notion ページ4 で「許容範囲」と記載済み（コーチ確定で補正）');
