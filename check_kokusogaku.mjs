/**
 * 國創学申込者データ照合スクリプト
 * 実行: node --env-file=.env.local check_kokusogaku.mjs > kokusogaku_result.txt
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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

const TARGET_NAMES = [
  { name: '守永博貴', grade: '品格＋人格' },
  { name: '根木マリサ', grade: '品格＋人格' },
  { name: '峯山政宏', grade: '品格＋人格' },
  { name: '宇田川昌美', grade: '人格' },
  { name: '坂口友亮', grade: '人格' },
  { name: '角井夏宜', grade: '人格' },
  { name: '鈴木栄子', grade: '人格' },
  { name: '鈴木光晴', grade: '人格' },
  { name: '長田広美', grade: '人格' },
  { name: '原田祐介', grade: '人格' },
  { name: '山永彩葵', grade: '人格' },
  { name: '根本輝尚', grade: '人格' },
  { name: '石井裕二', grade: '人格' },
  { name: '澤井洸蕎', grade: '人格' },
  { name: '飯塚玄氣', grade: '人格' },
  { name: '道又正人', grade: '人格' },
  { name: '大嶋律夫', grade: '人格' },
  { name: '島田知幸', grade: '人格' },
  { name: '塚原厚', grade: '人格' },
  { name: '谷口尚子', grade: '人格' },
  { name: '荒井喜一郎', grade: '人格' },
  { name: '藤原宗賢', grade: '人格' },
  { name: '浜口奈々', grade: '人格' },
  { name: '石川優奈', grade: '人格' },
  { name: '藤田由美子', grade: '人格' },
];

function isMatch(dbName, targetName) {
  if (!dbName) return false;
  const d = dbName.replace(/\s/g, '');
  const t = targetName.replace(/\s/g, '');
  return d.includes(t) || t.includes(d);
}

async function main() {
  const resultsSnap = await db.collection('results').get();
  const uaamSnap = await db.collection('uaam_results').get();

  const results = resultsSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
  const uaamUsers = uaamSnap.docs.map(d => ({ uid: d.id, ...d.data() }));

  const output = [];
  output.push(`全ユーザー数: 才覚領域=${results.length}人 / UAAM=${uaamUsers.length}人\n`);
  output.push('='.repeat(70));

  const found = [];
  const notFound = [];

  for (const target of TARGET_NAMES) {
    const saikaku = results.find(r => isMatch(r.name, target.name));
    const uaam = saikaku
      ? uaamUsers.find(u => u.uid === saikaku.uid)
      : uaamUsers.find(u => isMatch(u.name, target.name));

    if (saikaku || uaam) {
      const scores = uaam?.scores;
      found.push({
        ...target,
        dbName: saikaku?.name || uaam?.name || '—',
        hasSaikaku: !!saikaku,
        hasUaam: !!uaam,
        kakuchiiki: saikaku?.selectedKakuchiiki || saikaku?.result?.kakuchiiki || '—',
        passionTop5: saikaku?.inputPassionTop5 || '—',
        scores: scores ? {
          志: scores.mindset?.total ?? '—',
          知: scores.literacy?.total ?? '—',
          技: scores.competency?.total ?? '—',
          衝: scores.impact?.total ?? '—',
        } : null,
      });
    } else {
      notFound.push(target);
    }
  }

  output.push(`\n✅ データあり: ${found.length}人\n`);
  for (const u of found) {
    const s = u.hasSaikaku ? '才覚✅' : '才覚❌';
    const m = u.hasUaam   ? 'UAAM✅' : 'UAAM❌';
    output.push(`▶ ${u.name}【${u.grade}】DB名:${u.dbName}`);
    output.push(`  ${s} ${m}`);
    output.push(`  才覚領域: ${u.kakuchiiki}`);
    output.push(`  情熱Top5: ${u.passionTop5}`);
    if (u.scores) {
      const sc = u.scores;
      output.push(`  4軸: 志${sc['志']} 知${sc['知']} 技${sc['技']} 衝${sc['衝']}`);
    } else {
      output.push(`  4軸: UAAMデータなし`);
    }
    output.push('');
  }

  output.push(`\n❌ データなし: ${notFound.length}人`);
  output.push(notFound.map(t => t.name).join('、'));

  const text = output.join('\n');
  console.log(text);
  writeFileSync('kokusogaku_result.txt', text, 'utf8');
  console.log('\n→ kokusogaku_result.txt に保存しました');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
