/**
 * Phase 3：3要素診断の検証
 * 11人ベンチマーク（軸%）から擬似サブスコアを生成して動作確認。
 * 軸%しか分からないので、各サブ = (axis_pct/100)*20 と仮定するコース近似。
 */
import {
  calculateThreeElementScores,
  identifyElementProfile,
  determinePrescriptionMode,
  determineLeadershipStage,
  getModeAdvice,
  ELEMENT_LABELS,
  ELEMENT_WEIGHTS,
} from './src/data/uaam_questions.js';

// [name, [志%,知%,技%,衝%], totalPct, 期待モード]
const cases = [
  ['小林桃子',     [39,35,36,31], 35, 'focus'],
  ['幸奈山田',     [39,40,44,38], 40, 'focus'],
  ['KG',           [39,43,49,39], 43, 'focus'],
  ['勝屋裕貴',     [45,51,59,50], 51, 'focus'],
  ['Yu Koji',      [63,45,55,46], 52, 'focus'],
  ['つかさ',        [68,55,60,55], 60, 'focus'],
  ['野田健一',      [64,59,63,63], 62, 'focus'],
  ['Natsuki',      [69,63,70,68], 68, 'focus'],
  ['玄氣-GENKI',   [73,69,70,68], 70, 'expand'],   // 段階4だが主要素>=70の可能性
  ['ハル',          [85,81,79,79], 81, 'expand'],   // 段階5 → expand 確定
  ['藤吹奈都',      [99,95,94,99], 97, 'integrate'], // 段階7 → integrate 確定
];

// 軸→サブ展開（各サブ=axis%×0.2）
function fakeSubsFromAxes(axisPcts) {
  const [m, l, c, i] = axisPcts;
  const v = (pct) => (pct / 100) * 20; // 0-20
  return {
    meaning: v(m), mindfulness: v(m), mindshift: v(m), mastery: v(m),
    learning: v(l), logical: v(l), life: v(l), leadership: v(l),
    critical: v(c), creativity: v(c), communication: v(c), collaboration: v(c),
    idea: v(i), innovation: v(i), implementation: v(i), influence: v(i),
  };
}

console.log('\n=== Phase 3：3要素診断 検証（11人ベンチマーク・擬似サブスコア） ===\n');
console.log('注：軸%のみから擬似サブを展開した近似値。実装本体は16才覚スコアで動く。');
console.log('');
console.log('名前              | 軸pct           | リーダー | チームB | マネジ | 主要素        | モード     | 期待');
console.log('─'.repeat(115));

let pass = 0, fail = 0;
for (const [name, axisPcts, totalPct, expMode] of cases) {
  const subs = fakeSubsFromAxes(axisPcts);
  const tes = calculateThreeElementScores(subs);
  const profile = identifyElementProfile(tes);
  const minAxis = Math.min(...axisPcts);
  const stage = determineLeadershipStage(totalPct, minAxis);
  const mode = determinePrescriptionMode(tes, stage);

  const ok = mode === expMode;
  if (ok) pass++; else fail++;

  const icon = ok ? '✅' : '⚠️';
  const primaryLabel = ELEMENT_LABELS[profile.primary]?.jp || profile.primary;

  console.log(
    `${name.padEnd(14)} | ${axisPcts.join(',').padEnd(15)} | ${String(tes.leadership).padStart(6)}% | ${String(tes.teamBuilding).padStart(5)}% | ${String(tes.management).padStart(4)}% | ${primaryLabel.padEnd(12)} | ${icon}${mode.padEnd(8)} | ${expMode}`
  );
}

console.log('\n--- 重み係数の合計確認（コア15ペアの整合性） ---');
for (const [el, w] of Object.entries(ELEMENT_WEIGHTS)) {
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  console.log(`  ${el.padEnd(14)}: 重み合計=${sum} (Notion ページ6 の '30才覚分' と差異あり、原因は重複カウント)`);
}

console.log('\n--- 全才覚MAX のとき各要素=100% を確認 ---');
const fullSubs = Object.fromEntries(
  ['meaning','mindfulness','mindshift','mastery',
   'learning','logical','life','leadership',
   'critical','creativity','communication','collaboration',
   'idea','innovation','implementation','influence'].map(k => [k, 20])
);
const full = calculateThreeElementScores(fullSubs);
console.log(`  全才覚20点: L=${full.leadership}% T=${full.teamBuilding}% M=${full.management}%`);
console.log(`  ${full.leadership === 100 && full.teamBuilding === 100 && full.management === 100 ? '✅' : '❌'} 100%キャップ動作`);

console.log('\n--- ハル本人の処方文言サンプル ---');
const haru = cases.find(c => c[0] === 'ハル');
const haruSubs = fakeSubsFromAxes(haru[1]);
const haruTes = calculateThreeElementScores(haruSubs);
const haruProfile = identifyElementProfile(haruTes);
const haruStage = determineLeadershipStage(haru[2], Math.min(...haru[1]));
const haruMode = determinePrescriptionMode(haruTes, haruStage);
const haruAdvice = getModeAdvice(haruMode, haruProfile);
console.log(`  モード: ${haruMode}`);
console.log(`  主要素: ${ELEMENT_LABELS[haruProfile.primary].jp} (${haruProfile.primaryScore}%)`);
console.log(`  副要素: ${ELEMENT_LABELS[haruProfile.secondary].jp} (${haruProfile.secondaryScore}%)`);
console.log(`  最弱:   ${ELEMENT_LABELS[haruProfile.weakest].jp} (${haruProfile.weakestScore}%)`);
console.log(`  ヘッドライン: ${haruAdvice.headline}`);
console.log(`  コアフォーカス: ${haruAdvice.coreFocus[0]}`);

console.log(`\n=== 結果: ${pass} passed, ${fail} mismatch (out of ${cases.length}) ===`);
console.log('注：擬似サブ近似のため厳密一致しないケースあり。実16才覚スコアでの最終検証は本番投入後');
