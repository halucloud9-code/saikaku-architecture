/**
 * 才覚領域データ → UAAM16項目採点スクリプト v2
 * 16サブカテゴリの定義基準で採点
 * 実行: node --env-file=.env.local analyze_4axes_v2.mjs
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync } from 'fs';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

const db = getFirestore();
const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TARGET_NAMES = [
  '守永博貴','根木マリサ','峯山政宏',
  '宇田川昌美','坂口友亮','角井夏宜','鈴木栄子','鈴木光晴',
  '長田広美','原田祐介','山永彩葵','根本輝尚','石井裕二',
  '澤井洸蕎','飯塚玄氣','道又正人','大嶋律夫','島田知幸',
  '塚原厚','谷口尚子','荒井喜一郎','藤原宗賢','浜口奈々',
  '石川優奈','藤田由美子',
];

// 16サブカテゴリの採点基準（発動状態 vs 未発動状態）
const SCORING_CRITERIA = `
【採点基準：各項目0〜20点】
0〜5点 = テキストにこの状態の証拠がほぼない
6〜10点 = わずかに兆候がある
11〜15点 = 明確な証拠がある
16〜20点 = 核心にあり、テキスト全体を貫いている

【16サブカテゴリ定義】

■志軸（Mindset）
1. meaning（根幹力）
  高い状態: 自分の判断基準が言語化されている。状況が変わってもブレずに決断できる。
  低い状態: 状況ごとに判断が変わる。軸がまだ言葉になっていない。

2. mindfulness（受容力）
  高い状態: 自分と違う意見を反論せずに情報として受け取れる。
  低い状態: 違う意見に出会うと反論か回避が先に出る。

3. mindshift（転換力）
  高い状態: 困難な状況を問題ではなくチャンスとして捉え返せる。
  低い状態: 問題が来たとき解決より回避を先に選んでいる。

4. mastery（熟達力）
  高い状態: 繰り返すたびに精度が上がっていることを自分で確認しながら動いている。
  低い状態: 同じことを繰り返しているが上達の実感がない。

■知軸（Literacy）
5. learning（謙学力）
  高い状態: 自分より詳しい人に出会うと防衛でなく素直に興味が動く。
  低い状態: 新しいことに触れるとき防衛反応が先に出る。

6. logical（論理力）
  高い状態: 話の構造を組み立ててから話しているので相手が途中で迷わない。
  低い状態: 話しながら考えているため言いたいことより先に言葉が出る。

7. life（活用力）
  高い状態: 学んだことが別の場面で自然に使えている。
  低い状態: 知識は持っているが行動に繋げる場面がない。

8. leadership（統率力）
  高い状態: 方向を示したとき相手が自分の言葉で動き始めている。
  低い状態: 方向を示しているが相手がついてくる実感がない。

■技軸（Competency）
9. critical（本質力）
  高い状態: 情報の表面より奥にある構造や意図が先に見えている。
  低い状態: 目の前の現象に反応しているが奥まで掘りきれていない。

10. creativity（創造力）
  高い状態: まだない解決策が既存の枠外から自然と浮かんでいる。
  低い状態: 解決策を考えるとき前例や既存の方法を先に探している。

11. communication（伝達力）
  高い状態: 相手の理解度に合わせて言葉を変えながら伝わっているか確認しながら話している。
  低い状態: 伝えることより言いたいことを先に出してしまっている。

12. collaboration（協働力）
  高い状態: 自分一人よりも人と組んだときのほうが大きい結果を出せている。
  低い状態: 一人でやったほうが早いと判断して動いている。

■衝軸（Impact）
13. idea（起動力）
  高い状態: 十分な情報が揃う前に最初の1アクションを起こせている。
  低い状態: 準備が整ってから動こうとしてスタートが遅れている。

14. innovation（革新力）
  高い状態: 現状に違和感を感じたとき不満ではなく変える行動に変換できている。
  低い状態: 問題は見えているが変えることへの一歩が止まっている。

15. implementation（実装力）
  高い状態: 頭の中にあるものを形になるまでやりきっている。
  低い状態: アイデアは出るが形になる前に次のアイデアに移っている。

16. influence（影響力）
  高い状態: 自分の言動が周囲の行動を変えている事実を確認できている。
  低い状態: 影響を与えたいが相手に届いているかの確認ができていない。
`;

function isMatch(dbName, targetName) {
  if (!dbName) return false;
  return dbName.replace(/\s/g,'').includes(targetName.replace(/\s/g,'')) ||
         targetName.replace(/\s/g,'').includes(dbName.replace(/\s/g,''));
}

async function score16Items(person) {
  const prompt = `あなたはUAAM診断の専門家です。
以下の才覚領域データを読んで、16サブカテゴリを採点してください。

【才覚領域名】${person.kakuchiiki}
【価値観の核（WHY）】${person.valueCore || '—'}
【才能の核（HOW）】${person.talentCore || '—'}
【情熱の核（WHAT）】${person.passionCore || '—'}
【才能Top5】${person.talentTop5 || '—'}
【価値観Top5】${person.valueTop5 || '—'}
【情熱Top5】${person.passionTop5 || '—'}

${SCORING_CRITERIA}

【採点の注意】
- テキストに証拠がある項目だけ高く採点する
- 証拠がない項目は低く採点する（才覚領域を持っていても全項目が高いわけではない）
- 志軸は全員高くなりがちだが、テキストの言葉の密度で差をつける

必ず以下のJSON形式のみで返答してください：
{
  "meaning":数値,"mindfulness":数値,"mindshift":数値,"mastery":数値,
  "learning":数値,"logical":数値,"life":数値,"leadership":数値,
  "critical":数値,"creativity":数値,"communication":数値,"collaboration":数値,
  "idea":数値,"innovation":数値,"implementation":数値,"influence":数値
}`;

  const msg = await ai.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = msg.content[0].text;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('JSON parse failed');
  return JSON.parse(match[0]);
}

function calcAxes(scores) {
  return {
    志: scores.meaning + scores.mindfulness + scores.mindshift + scores.mastery,
    知: scores.learning + scores.logical + scores.life + scores.leadership,
    技: scores.critical + scores.creativity + scores.communication + scores.collaboration,
    衝: scores.idea + scores.innovation + scores.implementation + scores.influence,
  };
}

async function main() {
  const snap = await db.collection('results').get();
  const allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }));

  const output = [];
  const results = [];

  output.push('='.repeat(70));
  output.push('才覚領域 → UAAM16項目採点（定義基準ベース）v2');
  output.push('='.repeat(70));

  for (const targetName of TARGET_NAMES) {
    const u = allUsers.find(r => isMatch(r.name, targetName));
    if (!u) continue;

    const person = {
      name: u.name,
      kakuchiiki: u.selectedKakuchiiki || u.result?.kakuchiiki || '—',
      valueCore:  u.result?.core_words?.value_core  || '',
      talentCore: u.result?.core_words?.talent_core || '',
      passionCore:u.result?.core_words?.passion_core|| '',
      valueTop5:  u.inputValueTop5  || '',
      talentTop5: u.inputTalentTop5 || '',
      passionTop5:u.inputPassionTop5|| '',
    };

    process.stdout.write(`採点中: ${person.name}... `);
    try {
      const scores = await score16Items(person);
      const axes = calcAxes(scores);
      results.push({ name: person.name, kakuchiiki: person.kakuchiiki, scores, axes });

      output.push(`\n▶ ${person.name}`);
      output.push(`  才覚領域: ${person.kakuchiiki}`);
      output.push(`  WHY:${person.valueCore} / HOW:${person.talentCore} / WHAT:${person.passionCore}`);
      output.push(`  ─── 志軸 ${axes['志']}/80 ───`);
      output.push(`  根幹力:${scores.meaning} 受容力:${scores.mindfulness} 転換力:${scores.mindshift} 熟達力:${scores.mastery}`);
      output.push(`  ─── 知軸 ${axes['知']}/80 ───`);
      output.push(`  謙学力:${scores.learning} 論理力:${scores.logical} 活用力:${scores.life} 統率力:${scores.leadership}`);
      output.push(`  ─── 技軸 ${axes['技']}/80 ───`);
      output.push(`  本質力:${scores.critical} 創造力:${scores.creativity} 伝達力:${scores.communication} 協働力:${scores.collaboration}`);
      output.push(`  ─── 衝軸 ${axes['衝']}/80 ───`);
      output.push(`  起動力:${scores.idea} 革新力:${scores.innovation} 実装力:${scores.implementation} 影響力:${scores.influence}`);
      output.push(`  → 合計: 志${axes['志']} 知${axes['知']} 技${axes['技']} 衝${axes['衝']}`);

      console.log(`完了 志${axes['志']} 知${axes['知']} 技${axes['技']} 衝${axes['衝']}`);
    } catch(e) {
      console.log(`エラー: ${e.message}`);
    }

    await new Promise(r => setTimeout(r, 400));
  }

  // 集計
  if (results.length > 0) {
    output.push('\n' + '='.repeat(70));
    output.push('集計サマリー（軸別）');
    output.push('='.repeat(70));

    const avg = axis => Math.round(results.reduce((s,r) => s + r.axes[axis], 0) / results.length);
    output.push(`軸別平均: 志${avg('志')} 知${avg('知')} 技${avg('技')} 衝${avg('衝')}\n`);

    // 表形式
    output.push('名前           志  知  技  衝  合計');
    output.push('-'.repeat(45));
    const sorted = [...results].sort((a,b) =>
      (b.axes['志']+b.axes['知']+b.axes['技']+b.axes['衝']) -
      (a.axes['志']+a.axes['知']+a.axes['技']+a.axes['衝'])
    );
    for (const r of sorted) {
      const total = r.axes['志']+r.axes['知']+r.axes['技']+r.axes['衝'];
      const name = r.name.padEnd(8);
      output.push(`${name}  ${String(r.axes['志']).padStart(2)} ${String(r.axes['知']).padStart(2)} ${String(r.axes['技']).padStart(2)} ${String(r.axes['衝']).padStart(2)}  ${total}`);
    }

    output.push('\n衝軸トップ3:');
    const byImpact = [...results].sort((a,b) => b.axes['衝'] - a.axes['衝']);
    for (const r of byImpact.slice(0,3)) {
      output.push(`  ${r.name}: ${r.axes['衝']}点 (${r.kakuchiiki})`);
    }

    output.push('\n衝軸ワースト3:');
    for (const r of byImpact.slice(-3)) {
      output.push(`  ${r.name}: ${r.axes['衝']}点 (${r.kakuchiiki})`);
    }

    writeFileSync('4axes_v2_result.json', JSON.stringify(results, null, 2), 'utf8');
    output.push('\n→ 4axes_v2_result.json にも保存しました');
  }

  const text = output.join('\n');
  writeFileSync('4axes_v2_result.txt', text, 'utf8');
  console.log('\n→ 4axes_v2_result.txt に保存しました');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
