import Anthropic from '@anthropic-ai/sdk';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './lib/firebaseAdmin.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * スコア計算（サーバーサイド）
 * 逆転項目は 6 - score で反転
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
        subTotal += q.reverse ? 6 - raw : raw;
      }
      subs[sub] = subTotal;
    }

    const total = Object.values(subs).reduce((a, b) => a + b, 0);
    const maxScore = axisDef.subs.length * 3 * 5;
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
  Meaning（意味）：行動の軸をつくる力
  Mindfulness（気づき）：今に意識を向け、変化を受け入れる力
  Mindshift（意識転換）：固定観念を手放し、新しい可能性を見出す力
  Mastery（熟達）：実践と反復で学びを定着させる力

■ 知 -Literacy-（4L）
  Learning（学習）：学び方を学ぶ力
  Logical（論理）：論理的に理解し伝える力
  Life（社会実装）：学びを社会実装へ落とし込む力
  Leadership（リーダーシップ）：知を広げ、他者を導く力

■ 技 -Competency-（4C）
  Critical（批判的思考）：論理的に見抜く力
  Creativity（創造性）：新しいアイデアを生み出す力
  Communication（伝える力）：考えを伝え共感を得る力
  Collaboration（協働）：多様な人と協働する力

■ 衝 -Impact-（4I）
  Idea（アイデア）：熱狂できるテーマを見出す力
  Innovation（変革）：知識と技能を形にする力
  Implementation（実装）：社会に実装する力
  Influence（影響）：変化を広げ文化として根づかせる力

【分析ルール】
・スコアの高低差から、その人固有のパターンを読み取る
・強い軸と弱い軸の組み合わせが生む独自性を言語化する
・サブ項目のスコア差から、より精密な特性を分析する
・4象限マトリックスでのポジション（志×知、技×衝）を解釈する
・読んだ人が「まさに自分だ」と感じる具体性のある表現を使う
・抽象的な美辞麗句は避け、行動レベルで描写する

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

// 48問の質問定義（サーバーサイド用）
const QUESTIONS = [
  // 志 -MindSet- (4M)
  { id: 1,  axis: 'mindset', sub: 'meaning',     reverse: false },
  { id: 2,  axis: 'mindset', sub: 'meaning',     reverse: true },
  { id: 3,  axis: 'mindset', sub: 'meaning',     reverse: false },
  { id: 4,  axis: 'mindset', sub: 'mindfulness',  reverse: false },
  { id: 5,  axis: 'mindset', sub: 'mindfulness',  reverse: true },
  { id: 6,  axis: 'mindset', sub: 'mindfulness',  reverse: false },
  { id: 7,  axis: 'mindset', sub: 'mindshift',    reverse: false },
  { id: 8,  axis: 'mindset', sub: 'mindshift',    reverse: true },
  { id: 9,  axis: 'mindset', sub: 'mindshift',    reverse: false },
  { id: 10, axis: 'mindset', sub: 'mastery',      reverse: false },
  { id: 11, axis: 'mindset', sub: 'mastery',      reverse: true },
  { id: 12, axis: 'mindset', sub: 'mastery',      reverse: false },
  // 知 -Literacy- (4L)
  { id: 13, axis: 'literacy', sub: 'learning',    reverse: false },
  { id: 14, axis: 'literacy', sub: 'learning',    reverse: true },
  { id: 15, axis: 'literacy', sub: 'learning',    reverse: false },
  { id: 16, axis: 'literacy', sub: 'logical',     reverse: false },
  { id: 17, axis: 'literacy', sub: 'logical',     reverse: true },
  { id: 18, axis: 'literacy', sub: 'logical',     reverse: false },
  { id: 19, axis: 'literacy', sub: 'life',        reverse: false },
  { id: 20, axis: 'literacy', sub: 'life',        reverse: true },
  { id: 21, axis: 'literacy', sub: 'life',        reverse: false },
  { id: 22, axis: 'literacy', sub: 'leadership',  reverse: false },
  { id: 23, axis: 'literacy', sub: 'leadership',  reverse: true },
  { id: 24, axis: 'literacy', sub: 'leadership',  reverse: false },
  // 技 -Competency- (4C)
  { id: 25, axis: 'competency', sub: 'critical',      reverse: false },
  { id: 26, axis: 'competency', sub: 'critical',      reverse: true },
  { id: 27, axis: 'competency', sub: 'critical',      reverse: false },
  { id: 28, axis: 'competency', sub: 'creativity',    reverse: false },
  { id: 29, axis: 'competency', sub: 'creativity',    reverse: true },
  { id: 30, axis: 'competency', sub: 'creativity',    reverse: false },
  { id: 31, axis: 'competency', sub: 'communication', reverse: false },
  { id: 32, axis: 'competency', sub: 'communication', reverse: true },
  { id: 33, axis: 'competency', sub: 'communication', reverse: false },
  { id: 34, axis: 'competency', sub: 'collaboration', reverse: false },
  { id: 35, axis: 'competency', sub: 'collaboration', reverse: true },
  { id: 36, axis: 'competency', sub: 'collaboration', reverse: false },
  // 衝 -Impact- (4I)
  { id: 37, axis: 'impact', sub: 'idea',           reverse: false },
  { id: 38, axis: 'impact', sub: 'idea',           reverse: true },
  { id: 39, axis: 'impact', sub: 'idea',           reverse: false },
  { id: 40, axis: 'impact', sub: 'innovation',     reverse: false },
  { id: 41, axis: 'impact', sub: 'innovation',     reverse: true },
  { id: 42, axis: 'impact', sub: 'innovation',     reverse: false },
  { id: 43, axis: 'impact', sub: 'implementation', reverse: false },
  { id: 44, axis: 'impact', sub: 'implementation', reverse: true },
  { id: 45, axis: 'impact', sub: 'implementation', reverse: false },
  { id: 46, axis: 'impact', sub: 'influence',      reverse: false },
  { id: 47, axis: 'impact', sub: 'influence',      reverse: true },
  { id: 48, axis: 'impact', sub: 'influence',      reverse: false },
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { idToken, answers } = req.body;

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
  if (answeredCount < 48) {
    return res.status(400).json({ error: `全48問に回答してください（現在${answeredCount}問）` });
  }

  // スコアの値が1〜5の範囲か確認
  for (const [key, val] of Object.entries(answers)) {
    const n = Number(val);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      return res.status(400).json({ error: `質問${key}の回答が不正です（1〜5の整数）` });
    }
  }

  // スコア計算
  const scores = calculateScores(answers, QUESTIONS);

  // Claude API 呼び出し用のユーザーメッセージ
  const userMsg = `以下のUAAM診断結果を分析してください。

━━━ 志 -MindSet-（4M）━━━
合計スコア: ${scores.mindset.total}/${scores.mindset.max} (${scores.mindset.percentage}%)
サブ項目:
${Object.entries(scores.mindset.subs).map(([k, v]) => `  ${k}: ${v}/15`).join('\n')}

━━━ 知 -Literacy-（4L）━━━
合計スコア: ${scores.literacy.total}/${scores.literacy.max} (${scores.literacy.percentage}%)
サブ項目:
${Object.entries(scores.literacy.subs).map(([k, v]) => `  ${k}: ${v}/15`).join('\n')}

━━━ 技 -Competency-（4C）━━━
合計スコア: ${scores.competency.total}/${scores.competency.max} (${scores.competency.percentage}%)
サブ項目:
${Object.entries(scores.competency.subs).map(([k, v]) => `  ${k}: ${v}/15`).join('\n')}

━━━ 衝 -Impact-（4I）━━━
合計スコア: ${scores.impact.total}/${scores.impact.max} (${scores.impact.percentage}%)
サブ項目:
${Object.entries(scores.impact.subs).map(([k, v]) => `  ${k}: ${v}/15`).join('\n')}`;

  let analysis = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: UAAM_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMsg }],
      });
      const text = message.content[0].text;
      const match =
        text.match(/```json\n?([\s\S]*?)\n?```/) ||
        text.match(/```\n?([\s\S]*?)\n?```/) ||
        text.match(/(\{[\s\S]*\})/);
      const jsonStr = match ? match[1] || match[0] : text;
      const parsed = JSON.parse(jsonStr.trim());

      if (!parsed.type_name || !parsed.narrative) {
        throw new Error('APIレスポンスが不完全です');
      }

      analysis = parsed;
      break;
    } catch (e) {
      if (attempt === 2)
        return res.status(500).json({ error: '分析に失敗しました。もう一度お試しください。' });
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // Firestore保存
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
      scores,
      analysis,
      updatedAt: FieldValue.serverTimestamp(),
      ...(!existing.createdAt ? { createdAt: FieldValue.serverTimestamp() } : {}),
    },
    { merge: true }
  );

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res.status(200).json({ scores, analysis });
}
