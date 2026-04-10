/**
 * 才覚領域データ → UAAM4軸推定スクリプト
 * 実行: node --env-file=.env.local analyze_4axes.mjs
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

function isMatch(dbName, targetName) {
  if (!dbName) return false;
  return dbName.replace(/\s/g,'').includes(targetName.replace(/\s/g,'')) ||
         targetName.replace(/\s/g,'').includes(dbName.replace(/\s/g,''));
}

async function estimate4Axes(person) {
  const prompt = `あなたはUAAM診断の専門家です。
以下の才覚領域データから、この人のUAAM4軸スコアを推定してください。

【才覚領域名】
${person.kakuchiiki}

【価値観の核（WHY）】
${person.valueCoreWords || person.inputValueTop5 || '—'}

【才能の核（HOW）】
${person.talentCoreWords || person.inputTalentTop5 || '—'}

【情熱の核（WHAT）】
${person.passionCoreWords || person.inputPassionTop5 || '—'}

【UAAM4軸の定義】
- 志軸（Mindset）: 意味・気づき・意識転換・熟達 = WHY（なぜやるか・使命感）の深さ
- 知軸（Literacy）: 学習・論理・活用・統率 = 知識・体系化・論理思考の強さ
- 技軸（Competency）: 批判的思考・創造・伝達・協働 = HOW（どうやるか・スキル）の発揮
- 衝軸（Impact）: 起動・革新・実装・影響 = WHAT（何を動かすか・社会的インパクト）の強さ

各軸を0〜80点で推定してください。
必ず以下のJSON形式のみで返答してください（説明文不要）：
{"志":数値,"知":数値,"技":数値,"衝":数値,"理由":{"志":"1行","知":"1行","技":"1行","衝":"1行"}}`;

  const msg = await ai.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = msg.content[0].text;
  const match = text.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : null;
}

async function main() {
  const snap = await db.collection('results').get();
  const allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }));

  const output = [];
  const results = [];

  output.push('='.repeat(70));
  output.push('才覚領域 → UAAM4軸 推定分析（Claude APIベース）');
  output.push('='.repeat(70));

  for (const targetName of TARGET_NAMES) {
    const u = allUsers.find(r => isMatch(r.name, targetName));
    if (!u) continue;

    const person = {
      name: u.name,
      kakuchiiki: u.selectedKakuchiiki || u.result?.kakuchiiki || '—',
      valueCoreWords: u.result?.core_words?.value_core,
      talentCoreWords: u.result?.core_words?.talent_core,
      passionCoreWords: u.result?.core_words?.passion_core,
      inputValueTop5: u.inputValueTop5,
      inputTalentTop5: u.inputTalentTop5,
      inputPassionTop5: u.inputPassionTop5,
    };

    process.stdout.write(`分析中: ${person.name}... `);
    try {
      const axes = await estimate4Axes(person);
      if (axes) {
        results.push({ name: person.name, kakuchiiki: person.kakuchiiki, ...axes });
        output.push(`\n▶ ${person.name}`);
        output.push(`  才覚領域: ${person.kakuchiiki}`);
        output.push(`  WHY核: ${person.valueCoreWords || '—'} / HOW核: ${person.talentCoreWords || '—'} / WHAT核: ${person.passionCoreWords || '—'}`);
        output.push(`  4軸推定: 志${axes['志']} 知${axes['知']} 技${axes['技']} 衝${axes['衝']}`);
        output.push(`  志: ${axes['理由']['志']}`);
        output.push(`  知: ${axes['理由']['知']}`);
        output.push(`  技: ${axes['理由']['技']}`);
        output.push(`  衝: ${axes['理由']['衝']}`);
        console.log(`完了 志${axes['志']} 知${axes['知']} 技${axes['技']} 衝${axes['衝']}`);
      }
    } catch(e) {
      console.log(`エラー: ${e.message}`);
      output.push(`\n▶ ${person.name}: 分析エラー`);
    }

    await new Promise(r => setTimeout(r, 300));
  }

  // 集計
  if (results.length > 0) {
    output.push('\n' + '='.repeat(70));
    output.push('集計サマリー');
    output.push('='.repeat(70));

    const avg = axis => Math.round(results.reduce((s,r) => s + (r[axis]||0), 0) / results.length);
    output.push(`軸別平均: 志${avg('志')} 知${avg('知')} 技${avg('技')} 衝${avg('衝')}`);

    output.push('\n補完マッチング候補（衝軸の高低）:');
    const sorted = [...results].sort((a,b) => b['衝'] - a['衝']);
    output.push('衝軸高: ' + sorted.slice(0,3).map(r=>`${r.name}(${r['衝']})`).join(' / '));
    output.push('衝軸低: ' + sorted.slice(-3).map(r=>`${r.name}(${r['衝']})`).join(' / '));

    // JSONも保存
    writeFileSync('4axes_result.json', JSON.stringify(results, null, 2), 'utf8');
    output.push('\n→ 4axes_result.json にも保存しました');
  }

  const text = output.join('\n');
  writeFileSync('4axes_result.txt', text, 'utf8');
  console.log('\n→ 4axes_result.txt に保存しました');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
