/**
 * integrate.js — 才覚×UAAM 統合発動分析 バックフィルAPI
 *
 * 既存のUAAM診断結果 + 才覚領域データを使って
 * 統合発動分析（saikaku_integration）を単体で生成・保存する。
 * 67問のやり直し不要。
 *
 * POST /api/integrate
 * body: { idToken }
 */
import Anthropic from '@anthropic-ai/sdk';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './lib/firebaseAdmin.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function parseJsonFromText(text) {
  const match =
    text.match(/```json\n?([\s\S]*?)\n?```/) ||
    text.match(/```\n?([\s\S]*?)\n?```/) ||
    text.match(/(\{[\s\S]*\})/);
  const jsonStr = match ? match[1] || match[0] : text;
  return JSON.parse(jsonStr.trim());
}

const INTEGRATION_SYSTEM_PROMPT = `あなたは「才覚発動統合分析」の専門AIです。
才覚領域データ（WHY/HOW/WHAT）とUAAM才覚発動スコア（志/知/技/衝）を統合し、
その人の「最高発動状態」への最短経路を特定します。

【2つのデータの意味】
才覚領域 = アイデンティティ（誰であるか・何のために生きるか）
才覚発動スコア = ケイパビリティ（現在の能力発動レベル）

この2つを掛け合わせると4つのゾーンが浮かぶ：

■ 超発動ゾーン（才覚×スコア：両方高い）
  アイデンティティと能力が一致して全開になっている領域。
  今すぐここに時間・エネルギーを集中すべき領域。

■ 潜在ゾーン（才覚高い×スコア低い）
  才覚としての本質はあるが、まだ能力として現れていない領域。
  最大成長機会。意識的に磨けば最大のレバレッジを生む。

■ 遊休ゾーン（才覚低い×スコア高い）
  能力は高いが才覚（WHY/HOW/WHAT）と接続していない領域。
  能力が才覚の外側で使われているため、消耗しやすい。
  才覚への再接続か、意識的な委任を検討すべき。

■ 探索ゾーン（両方低い）
  今は優先度を下げ、才覚が強い領域に集中すべき。

【才覚×UAAM マッピングルール】
才覚の3軸とUAAMの4軸を以下のように対応させて分析すること：

WHY（価値観）× 志（MindSet） → 存在意義の発動度
WHY（価値観）× 衝（Impact）  → 社会的使命の実装度
HOW（才能）  × 技（Competency）→ 固有能力の発揮度
HOW（才能）  × 知（Literacy）  → 才能の知的深化度
WHAT（情熱） × 衝（Impact）   → 情熱の社会貢献度
WHAT（情熱） × 志（MindSet）  → 情熱の内的充足度

この6つのクロスポイントをスコア化し、高低を判定すること。
（才覚の「高さ」= TOP5に含まれる関連キーワードの強度で判断）
（UAAMの「高さ」= 該当軸のpercentage >= 70%を「高い」と判定）

【出力原則】
・読んだ瞬間に「これは自分のことだ」と感じる具体性で書く
・コンサルティングレポートの水準：事実→洞察→提言の構造
・ポジティブな洞察だけでなく、盲点・注意すべき点も正直に書く
・才覚領域の言葉を積極的に引用して、その人固有の言葉で描写する
・抽象論は禁止。全て行動と状態レベルで描写する

【出力フォーマット】
必ず以下のJSON形式のみで返答すること。
余分なテキスト・マークダウン・コードブロック禁止。

{
  "integration_score": 0〜100の整数（才覚とUAAMの総合一致度）,
  "activation_core": "才覚発動の核心ワード（15文字以内・映像的）",
  "ignition_zones": [
    { "label": "ゾーン名", "axis_uaam": "mindset|literacy|competency|impact", "axis_saikaku": "WHY|HOW|WHAT", "insight": "なぜここが超発動ゾーンなのか（2行）" }
  ],
  "latent_zones": [
    { "label": "ゾーン名", "axis_uaam": "...", "axis_saikaku": "...", "potential": "覚醒したら何が起きるか（2行）", "action": "具体的な磨き方（1行）" }
  ],
  "idle_zones": [
    { "label": "ゾーン名", "axis_uaam": "...", "warning": "このまま使い続けると何が起きるか（1行）", "reframe": "才覚との再接続方法（1行）" }
  ],
  "activation_equation": "あなたの才覚発動方程式（20〜40文字。才覚領域の言葉を使って一文に凝縮）",
  "leverage_point": "今すぐ最大ROIを生む一手（行動レベルで30文字以内）",
  "mission_direction": "使命の方向性（3〜5行。才覚×UAAMが全開になったときに社会に何が起きるか）",
  "flow_route": "フロー状態への道筋（2〜3行。どの状況でこの人は最高の状態に入るか）",
  "hidden_potential": "まだ本人が気づいていない才覚のポテンシャル（3〜4行）",
  "roadmap": {
    "now": "今すぐ始めるべき最初の一手（行動レベル・1文）",
    "year1": "1年後：どんな状態になっているか（1〜2文）",
    "year3": "3年後：どんな影響を生み出しているか（1〜2文）",
    "year10": "10年後：世界に何を残しているか（1〜2文）"
  },
  "coaching_questions": [
    "コーチが最初に投げかけるべき問い1（才覚の核心を突く）",
    "問い2（UAAMの潜在ゾーンを開く）",
    "問い3（10年後のビジョンに接続する）"
  ]
}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { idToken } = req.body;

  // 認証
  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ error: '認証に失敗しました。再度ログインしてください。' });
  }

  const uid = decoded.uid;

  // 才覚領域データ取得
  const saikakuDoc = await db.collection('results').doc(uid).get();
  if (!saikakuDoc.exists || !saikakuDoc.data()?.result?.kakuchiiki) {
    return res.status(404).json({ error: '才覚領域データがありません。先に才覚領域診断を完了してください。' });
  }

  // UAAMデータ取得
  const uaamDoc = await db.collection('uaam_results').doc(uid).get();
  if (!uaamDoc.exists || !uaamDoc.data()?.scores) {
    return res.status(404).json({ error: 'UAAM診断データがありません。先にUAAM診断を完了してください。' });
  }

  const sd = saikakuDoc.data();
  const ud = uaamDoc.data();
  const scores = ud.scores;

  const saikakuData = {
    kakuchiiki: sd.selectedKakuchiiki || sd.result.kakuchiiki,
    core_words: sd.result.core_words || {},
    insight: sd.result.insight || '',
    talent_top5: sd.inputTalentTop5 || sd.inputTalent || '',
    value_top5:  sd.inputValueTop5  || sd.inputValue  || '',
    passion_top5: sd.inputPassionTop5 || sd.inputPassion || '',
  };

  // 16才覚の日本語名マッピング（AIが英語名を使わないよう日本語で渡す）
  const SUB_JP = {
    meaning:'基軸力', mindfulness:'認知力', mindshift:'転換力', mastery:'熟達力',
    learning:'謙学力', logical:'論理力',    life:'活用力',     leadership:'統率力',
    critical:'本質力', creativity:'創造力', communication:'伝達力', collaboration:'協働力',
    idea:'構想力',    innovation:'変革力',  implementation:'実装力', influence:'影響力',
  };
  const subStr = (subs) => Object.entries(subs||{}).map(([k,v])=>`${SUB_JP[k]||k}:${v}`).join(', ');

  const integrationMsg = `以下の2つのデータを統合して分析してください。
※ 16才覚の能力名は必ず日本語（基軸力・認知力・転換力・熟達力・謙学力・論理力・活用力・統率力・本質力・創造力・伝達力・協働力・構想力・変革力・実装力・影響力）で記述すること。英語名（Meaning, Critical等）は絶対に使わないこと。

━━━ 才覚領域データ（アイデンティティ）━━━
才覚領域: ${saikakuData.kakuchiiki}
才能の核（HOW）: ${saikakuData.core_words.talent_core || '未設定'}
価値観の核（WHY）: ${saikakuData.core_words.value_core || '未設定'}
情熱の核（WHAT）: ${saikakuData.core_words.passion_core || '未設定'}
才能TOP5: ${saikakuData.talent_top5}
価値観TOP5: ${saikakuData.value_top5}
情熱TOP5: ${saikakuData.passion_top5}
才覚インサイト: ${saikakuData.insight}

━━━ UAAM才覚発動スコア（ケイパビリティ）━━━
志(MindSet):    ${scores.mindset?.percentage}%  [${subStr(scores.mindset?.subs)}]
知(Literacy):   ${scores.literacy?.percentage}% [${subStr(scores.literacy?.subs)}]
技(Competency): ${scores.competency?.percentage}%[${subStr(scores.competency?.subs)}]
衝(Impact):     ${scores.impact?.percentage}%   [${subStr(scores.impact?.subs)}]

才覚発動タイプ: ${ud.analysis?.type_name || ''}
ナラティブ: ${ud.analysis?.narrative || ''}`;

  let integration = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: INTEGRATION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: integrationMsg }],
      });
      const parsed = parseJsonFromText(message.content[0].text);
      if (!parsed.activation_core || !parsed.activation_equation) throw new Error('統合分析レスポンスが不完全です');
      integration = parsed;
      break;
    } catch (e) {
      console.error(`[integrate] attempt ${attempt + 1} failed:`, e.message);
      if (attempt === 2) return res.status(500).json({ error: `統合分析に失敗しました: ${e.message}` });
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Firestore保存
  const docRef = db.collection('uaam_results').doc(uid);
  await docRef.set(
    {
      'analysis.saikaku_integration': integration,
      hasSaikakuIntegration: true,
      integrationUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`[integrate] ${uid} score: ${integration.integration_score}`);
  return res.status(200).json({ integration });
}
