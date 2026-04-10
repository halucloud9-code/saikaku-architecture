import Anthropic from '@anthropic-ai/sdk';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './lib/firebaseAdmin.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * スコア計算（サーバーサイド）
 * クライアントと同じスケール: 1〜5点、逆転項目は 6 - raw
 * サブカテゴリ最大15、軸最大60
 */
function calculateScores(answers, questions) {
  const axes = {
    mindset:    { subs: ['meaning', 'mindfulness', 'mindshift', 'mastery'] },
    literacy:   { subs: ['learning', 'logical', 'life', 'leadership'] },
    competency: { subs: ['critical', 'creativity', 'communication', 'collaboration'] },
    impact:     { subs: ['idea', 'innovation', 'implementation', 'influence'] },
  };

  const result = {};

  for (const [axisKey, axisDef] of Object.entries(axes)) {
    const axisQuestions = questions.filter((q) => q.axis === axisKey);
    const subs = {};

    for (const sub of axisDef.subs) {
      const subQuestions = axisQuestions.filter((q) => q.sub === sub);
      let subTotal = 0;
      for (const q of subQuestions) {
        const raw = answers[String(q.id)] || 3;
        // 通常: そのまま1〜5、逆転: 6 - raw（5→1, 4→2, 3→3, 2→4, 1→5）
        subTotal += q.reverse ? 6 - raw : raw;
      }
      subs[sub] = subTotal; // 最大20（4問 × 5点）
    }

    const total = Object.values(subs).reduce((a, b) => a + b, 0);
    const maxScore = 80; // 4サブ × 4問 × 5点
    result[axisKey] = {
      total,
      max: maxScore,
      percentage: Math.round((total / maxScore) * 100),
      subs,
    };
  }

  return result;
}

const UAAM_SYSTEM_PROMPT = `あなたはUAAM（Universal Ability Assessment Model）の分析AIです。
4軸（志・知・技・衝）の診断スコアから、その人の能力特性を多面的に分析します。

【4軸の定義】
■ 志 -MindSet-（4M）
  Meaning（基軸力）：行動の軸をつくる力
  Mindfulness（認知力）：今に意識を向け、変化を受け入れる力
  Mindshift（転換力）：固定観念を手放し、新しい可能性を見出す力
  Mastery（熟達力）：実践と反復で学びを定着させる力

■ 知 -Literacy-（4L）
  Learning（謙学力）：学び方を学ぶ力
  Logical（論理力）：論理的に理解し伝える力
  Life（活用力）：学びを社会実装へ落とし込む力
  Leadership（統率力）：知を広げ、他者を導く力

■ 技 -Competency-（4C）
  Critical（本質力）：論理的に見抜く力
  Creativity（創造力）：新しいアイデアを生み出す力
  Communication（伝達力）：考えを伝え共感を得る力
  Collaboration（協働力）：多様な人と協働する力

■ 衝 -Impact-（4I）
  Idea（構想力）：熱狂できるテーマを見出す力
  Innovation（変革力）：知識と技能を形にする力
  Implementation（実装力）：社会に実装する力
  Influence（影響力）：変化を広げ文化として根づかせる力

【分析ルール】
・スコアの高低差から、その人固有のパターンを読み取る
・強い軸と弱い軸の組み合わせが生む独自性を言語化する
・サブ項目のスコア差から、より精密な特性を分析する
・4象限マトリックスでのポジション（志×知、技×衝）を解釈する
・読んだ人が「まさに自分だ」と感じる具体性のある表現を使う
・抽象的な美辞麗句は避け、行動レベルで描写する
・才覚領域データが提供されている場合は、その人の本質（WHY/HOW/WHAT）と
　UAAMスコアを対応させ、才覚とスコアの一致・ズレを読み取って分析に反映させる

【出力フォーマット】
必ず以下のJSON形式のみで返答すること。
余分なテキスト・マークダウン・コードブロック禁止。

{
  "type_name": "あなたの能力タイプ名（8〜20文字、映像的表現）",
  "type_description": "タイプの一行説明（30文字以内）",
  "axis_analysis": {
    "mindset": "志(MindSet)の分析（2〜3行、4Mサブ項目のスコア差に言及）",
    "literacy": "知(Literacy)の分析（2〜3行）",
    "competency": "技(Competency)の分析（2〜3行）",
    "impact": "衝(Impact)の分析（2〜3行）"
  },
  "quadrant_analysis": {
    "vision_quadrant": "志×知の交差分析（ビジョン象限：2〜3行）",
    "execution_quadrant": "技×衝の交差分析（実行象限：2〜3行）"
  },
  "strengths": ["強み1", "強み2", "強み3"],
  "growth_areas": ["成長ポイント1", "成長ポイント2", "成長ポイント3"],
  "narrative": "総合的なナラティブ（5〜8行。この人だけの物語を描く。スコアのパターンから読み取れる行動傾向、思考パターン、潜在的な可能性を具体的に描写する）",
  "action_suggestions": ["今日からできるアクション1", "アクション2", "アクション3"]
}`;

// ============================================================
// 才覚×UAAM 統合発動分析プロンプト（McKinsey級）
// ============================================================
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

// 64問の質問定義（サーバーサイド用）— 各サブカテゴリ4問（Q1通常, Q2逆転, Q3通常, Q4通常）
const QUESTIONS = [
  // 志 -MindSet- (4M)
  { id: 1,  axis: 'mindset', sub: 'meaning',     reverse: false },
  { id: 2,  axis: 'mindset', sub: 'meaning',     reverse: true },
  { id: 3,  axis: 'mindset', sub: 'meaning',     reverse: false },
  { id: 4,  axis: 'mindset', sub: 'meaning',     reverse: false },
  { id: 5,  axis: 'mindset', sub: 'mindfulness',  reverse: false },
  { id: 6,  axis: 'mindset', sub: 'mindfulness',  reverse: true },
  { id: 7,  axis: 'mindset', sub: 'mindfulness',  reverse: false },
  { id: 8,  axis: 'mindset', sub: 'mindfulness',  reverse: false },
  { id: 9,  axis: 'mindset', sub: 'mindshift',    reverse: false },
  { id: 10, axis: 'mindset', sub: 'mindshift',    reverse: true },
  { id: 11, axis: 'mindset', sub: 'mindshift',    reverse: false },
  { id: 12, axis: 'mindset', sub: 'mindshift',    reverse: false },
  { id: 13, axis: 'mindset', sub: 'mastery',      reverse: false },
  { id: 14, axis: 'mindset', sub: 'mastery',      reverse: true },
  { id: 15, axis: 'mindset', sub: 'mastery',      reverse: false },
  { id: 16, axis: 'mindset', sub: 'mastery',      reverse: false },
  // 知 -Literacy- (4L)
  { id: 17, axis: 'literacy', sub: 'learning',    reverse: false },
  { id: 18, axis: 'literacy', sub: 'learning',    reverse: true },
  { id: 19, axis: 'literacy', sub: 'learning',    reverse: false },
  { id: 20, axis: 'literacy', sub: 'learning',    reverse: false },
  { id: 21, axis: 'literacy', sub: 'logical',     reverse: false },
  { id: 22, axis: 'literacy', sub: 'logical',     reverse: true },
  { id: 23, axis: 'literacy', sub: 'logical',     reverse: false },
  { id: 24, axis: 'literacy', sub: 'logical',     reverse: false },
  { id: 25, axis: 'literacy', sub: 'life',        reverse: false },
  { id: 26, axis: 'literacy', sub: 'life',        reverse: true },
  { id: 27, axis: 'literacy', sub: 'life',        reverse: false },
  { id: 28, axis: 'literacy', sub: 'life',        reverse: false },
  { id: 29, axis: 'literacy', sub: 'leadership',  reverse: false },
  { id: 30, axis: 'literacy', sub: 'leadership',  reverse: true },
  { id: 31, axis: 'literacy', sub: 'leadership',  reverse: false },
  { id: 32, axis: 'literacy', sub: 'leadership',  reverse: false },
  // 技 -Competency- (4C)
  { id: 33, axis: 'competency', sub: 'critical',      reverse: false },
  { id: 34, axis: 'competency', sub: 'critical',      reverse: true },
  { id: 35, axis: 'competency', sub: 'critical',      reverse: false },
  { id: 36, axis: 'competency', sub: 'critical',      reverse: false },
  { id: 37, axis: 'competency', sub: 'creativity',    reverse: false },
  { id: 38, axis: 'competency', sub: 'creativity',    reverse: true },
  { id: 39, axis: 'competency', sub: 'creativity',    reverse: false },
  { id: 40, axis: 'competency', sub: 'creativity',    reverse: false },
  { id: 41, axis: 'competency', sub: 'communication', reverse: false },
  { id: 42, axis: 'competency', sub: 'communication', reverse: false },
  { id: 43, axis: 'competency', sub: 'communication', reverse: false },
  { id: 44, axis: 'competency', sub: 'communication', reverse: false },
  { id: 45, axis: 'competency', sub: 'collaboration', reverse: false },
  { id: 46, axis: 'competency', sub: 'collaboration', reverse: true },
  { id: 47, axis: 'competency', sub: 'collaboration', reverse: false },
  { id: 48, axis: 'competency', sub: 'collaboration', reverse: false },
  // 衝 -Impact- (4I)
  { id: 49, axis: 'impact', sub: 'idea',           reverse: false },
  { id: 50, axis: 'impact', sub: 'idea',           reverse: true },
  { id: 51, axis: 'impact', sub: 'idea',           reverse: false },
  { id: 52, axis: 'impact', sub: 'idea',           reverse: false },
  { id: 53, axis: 'impact', sub: 'innovation',     reverse: false },
  { id: 54, axis: 'impact', sub: 'innovation',     reverse: true },
  { id: 55, axis: 'impact', sub: 'innovation',     reverse: false },
  { id: 56, axis: 'impact', sub: 'innovation',     reverse: false },
  { id: 57, axis: 'impact', sub: 'implementation', reverse: false },
  { id: 58, axis: 'impact', sub: 'implementation', reverse: true },
  { id: 59, axis: 'impact', sub: 'implementation', reverse: false },
  { id: 60, axis: 'impact', sub: 'implementation', reverse: false },
  { id: 61, axis: 'impact', sub: 'influence',      reverse: false },
  { id: 62, axis: 'impact', sub: 'influence',      reverse: true },
  { id: 63, axis: 'impact', sub: 'influence',      reverse: false },
  { id: 64, axis: 'impact', sub: 'influence',      reverse: false },
];

// ============================================================
// ユーティリティ: JSON パース（コードブロック対応）
// ============================================================
function parseJsonFromText(text) {
  const match =
    text.match(/```json\n?([\s\S]*?)\n?```/) ||
    text.match(/```\n?([\s\S]*?)\n?```/) ||
    text.match(/(\{[\s\S]*\})/);
  const jsonStr = match ? match[1] || match[0] : text;
  return JSON.parse(jsonStr.trim());
}

export default async function handler(req, res) {
  console.log('[UAAM] handler called, method:', req.method);
  console.log('[UAAM] ANTHROPIC_API_KEY set:', !!process.env.ANTHROPIC_API_KEY);
  console.log('[UAAM] FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID);
  if (req.method !== 'POST') return res.status(405).end();

  const { idToken, answers, vAnswers } = req.body;

  // 認証
  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ error: '認証に失敗しました。再度ログインしてください。' });
  }

  // バリデーション
  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: '回答データが不正です' });
  }

  const answeredCount = Object.keys(answers).length;
  if (answeredCount < 64) {
    return res.status(400).json({ error: `全64問に回答してください（現在${answeredCount}問）` });
  }

  for (const [key, val] of Object.entries(answers)) {
    const n = Number(val);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      return res.status(400).json({ error: `質問${key}の回答が不正です（1〜5の整数）` });
    }
  }

  // ============================================================
  // OPTION 1: 才覚領域データを事前読み込み → UAAM分析に文脈注入
  // ============================================================
  let saikakuData = null;
  try {
    const saikakuDoc = await db.collection('results').doc(decoded.uid).get();
    if (saikakuDoc.exists) {
      const d = saikakuDoc.data();
      if (d.result && d.result.kakuchiiki) {
        saikakuData = {
          kakuchiiki: d.selectedKakuchiiki || d.result.kakuchiiki,
          core_words: d.result.core_words || {},
          insight: d.result.insight || '',
          talent_top5: d.inputTalentTop5 || d.inputTalent || '',
          value_top5:  d.inputValueTop5  || d.inputValue  || '',
          passion_top5: d.inputPassionTop5 || d.inputPassion || '',
        };
        console.log('[UAAM] 才覚領域データ取得成功:', saikakuData.kakuchiiki);
      }
    }
  } catch (e) {
    console.warn('[UAAM] 才覚領域データ取得失敗（スキップ）:', e.message);
  }

  // スコア計算
  const scores = calculateScores(answers, QUESTIONS);

  // UAAMスコアメッセージ構築
  const scoreMsg = `以下のUAAM診断結果を分析してください。
━━━ 志 -MindSet-（4M）━━━
合計スコア: ${scores.mindset.total}/${scores.mindset.max} (${scores.mindset.percentage}%)
サブ項目:
${Object.entries(scores.mindset.subs).map(([k, v]) => `  ${k}: ${v}/20`).join('\n')}
━━━ 知 -Literacy-（4L）━━━
合計スコア: ${scores.literacy.total}/${scores.literacy.max} (${scores.literacy.percentage}%)
サブ項目:
${Object.entries(scores.literacy.subs).map(([k, v]) => `  ${k}: ${v}/20`).join('\n')}
━━━ 技 -Competency-（4C）━━━
合計スコア: ${scores.competency.total}/${scores.competency.max} (${scores.competency.percentage}%)
サブ項目:
${Object.entries(scores.competency.subs).map(([k, v]) => `  ${k}: ${v}/20`).join('\n')}
━━━ 衝 -Impact-（4I）━━━
合計スコア: ${scores.impact.total}/${scores.impact.max} (${scores.impact.percentage}%)
サブ項目:
${Object.entries(scores.impact.subs).map(([k, v]) => `  ${k}: ${v}/20`).join('\n')}`;

  // 才覚文脈をUAAMメッセージに追加（Option 1の核心）
  const userMsg = saikakuData
    ? `${scoreMsg}

━━━ このユーザーの才覚領域データ（分析に反映させること）━━━
才覚領域（KAKUCHIIKI）: ${saikakuData.kakuchiiki}
才能の核（HOW）: ${saikakuData.core_words.talent_core || '未設定'}
価値観の核（WHY）: ${saikakuData.core_words.value_core || '未設定'}
情熱の核（WHAT）: ${saikakuData.core_words.passion_core || '未設定'}
才能TOP5: ${saikakuData.talent_top5}
価値観TOP5: ${saikakuData.value_top5}
情熱TOP5: ${saikakuData.passion_top5}

上記才覚領域の本質（WHY/HOW/WHAT）とUAAMスコアを照合し、
才覚とスコアの一致・ズレを読み取って分析のnarrativeとstrengthsに必ず反映させること。`
    : scoreMsg;

  // ── UAAM分析 AI呼び出し ──
  let analysis = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: UAAM_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMsg }],
      });
      const parsed = parseJsonFromText(message.content[0].text);
      if (!parsed.type_name || !parsed.narrative) throw new Error('APIレスポンスが不完全です');
      analysis = parsed;
      break;
    } catch (e) {
      console.error(`[UAAM] attempt ${attempt + 1} failed:`, e.message || e);
      if (e.status) console.error(`[UAAM] API status: ${e.status}`);
      if (attempt === 2)
        return res.status(500).json({ error: `分析に失敗しました: ${e.message}` });
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // ============================================================
  // OPTION 2: 才覚×UAAM 統合発動分析（McKinsey級）
  // ============================================================
  let saikaku_integration = null;
  if (saikakuData) {
    const integrationMsg = `以下の2つのデータを統合して分析してください。

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
志(MindSet):   ${scores.mindset.percentage}%  [${Object.entries(scores.mindset.subs).map(([k,v])=>`${k}:${v}`).join(', ')}]
知(Literacy):  ${scores.literacy.percentage}% [${Object.entries(scores.literacy.subs).map(([k,v])=>`${k}:${v}`).join(', ')}]
技(Competency):${scores.competency.percentage}%[${Object.entries(scores.competency.subs).map(([k,v])=>`${k}:${v}`).join(', ')}]
衝(Impact):    ${scores.impact.percentage}%   [${Object.entries(scores.impact.subs).map(([k,v])=>`${k}:${v}`).join(', ')}]

才覚発動タイプ: ${analysis.type_name}
ナラティブ要約: ${analysis.narrative}`;

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
        saikaku_integration = parsed;
        console.log('[UAAM] 統合分析完了 score:', parsed.integration_score);
        break;
      } catch (e) {
        console.error(`[UAAM] integration attempt ${attempt + 1} failed:`, e.message || e);
        if (attempt === 2) {
          console.warn('[UAAM] 統合分析失敗（スキップ、UAAM結果は保存）');
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  // 統合分析をanalysisに付与
  if (saikaku_integration) {
    analysis.saikaku_integration = saikaku_integration;
  }

  // ── Firestore保存 ──
  const docRef = db.collection('uaam_results').doc(decoded.uid);
  const existingDoc = await docRef.get();
  const existing = existingDoc.data() || {};

  await docRef.set(
    {
      uid: decoded.uid,
      name: decoded.name || '',
      email: decoded.email || '',
      photoURL: decoded.picture || '',
      answers,
      vAnswers: vAnswers || {},
      scores,
      analysis,
      hasSaikakuIntegration: !!saikaku_integration,
      updatedAt: FieldValue.serverTimestamp(),
      ...(!existing.createdAt ? { createdAt: FieldValue.serverTimestamp() } : {}),
    },
    { merge: true }
  );

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res.status(200).json({ scores, analysis });
}
