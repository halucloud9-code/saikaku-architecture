import Anthropic from '@anthropic-ai/sdk';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './lib/firebaseAdmin.js';

/**
 * 自己評価バイアスメッセージ生成（旗カウント・45-95%版）
 * src/data/uaam_questions.js の calculateBiasMessage と同一ロジック。
 * APIは自己完結を保つため、ロジックをインライン化している。
 *
 * @param {Object} vAnswers - { V1, V2, V3 } raw値（1-5）
 * @param {number} totalPct - 総合% (0-100)
 * @returns {Object|null} - null なら健全（表示なし）
 */
function calculateBiasMessage(vAnswers, totalPct) {
  if (!vAnswers || typeof vAnswers !== 'object') return null;

  const flagsPerQ = ['V1', 'V2', 'V3'].map((id) => {
    const raw = vAnswers[id];
    if (raw === 1) return 2;
    if (raw === 2) return 1;
    return 0;
  });

  const flagsCount = flagsPerQ.reduce((a, b) => a + b, 0);
  if (flagsCount === 0) return null;

  const BIAS_TABLE = { 1: 45, 2: 55, 3: 65, 4: 75, 5: 86, 6: 95 };
  const biasPct = BIAS_TABLE[flagsCount];

  const activeFlags = ['V1', 'V2', 'V3'].filter((_, i) => flagsPerQ[i] > 0);
  const criticalFlags = ['V1', 'V2', 'V3'].filter((_, i) => flagsPerQ[i] === 2);

  let stage, color;
  if (flagsCount <= 2) { stage = 'mild'; color = 'yellow'; }
  else if (flagsCount <= 4) { stage = 'moderate'; color = 'orange'; }
  else { stage = 'strong'; color = 'red'; }

  if (stage === 'mild') {
    const focus = activeFlags[0];
    const focusMessage = {
      V1: '盲点を意識する習慣を持つことで、さらに深まります',
      V2: '他者からのフィードバックを定期的に取り入れる習慣を',
      V3: '他のやり方も試してみる柔軟性を持つと、可能性が広がります',
    }[focus] || '軽微なバイアス傾向。日常の小さな実践で十分整います。';

    return { biasPct, level: stage, color,
      title: `自己評価バイアス：${biasPct}%（軽度）`,
      message: focusMessage, activeFlags };
  }

  if (stage === 'moderate') {
    if (totalPct >= 95) {
      return { biasPct, level: 'high_stage', color: 'red',
        title: `自己評価バイアス：${biasPct}%（高段階解釈）`,
        message: `数字（${totalPct}%）が L7 圏 ＋ フラグ ＝ 高段階到達の証拠。「自分には盲点がほぼない」という感覚は、本物の自己客観視を超えた状態を示しています。`,
        pattern: '真の天地型',
        action: 'コーチによる外部観察での確認を推奨',
        activeFlags };
    }
    if (totalPct >= 78) {
      return { biasPct, level: 'transition', color: 'red',
        title: `自己評価バイアス：${biasPct}%（移行期解釈）`,
        message: `数字（${totalPct}%）は L5-L6 圏。フラグは 2通りの解釈：① 真の高段階への移行 ② 自己評価が実態より高い可能性。`,
        pattern: 'L5-L6 移行期',
        action: 'コーチによる外部観察での確認が必須',
        activeFlags };
    }
    const combo = activeFlags.slice().sort().join('+');
    const baseMessage = {
      'V1+V2': '内省と他者理解の両方を意識する時期',
      'V1+V3': '盲点と硬直化を見直す時期',
      'V2+V3': '他者FBと柔軟性を再構築する時期',
      'V1+V2+V3': '3軸すべてに目を向ける時期',
    }[combo] || '客観視の精度向上をテーマに';

    return { biasPct, level: stage, color,
      title: `自己評価バイアス：${biasPct}%（中度）`,
      message: baseMessage,
      action: '30日間の客観視ワーク：週１回、信頼できる人にFBを求める',
      activeFlags, criticalFlags };
  }

  if (totalPct >= 95) {
    return { biasPct, level: 'high_stage', color: 'red',
      title: `自己評価バイアス：${biasPct}%（高段階解釈）`,
      message: `数字（${totalPct}%）が L7 圏 ＋ 強度フラグ ＝ 高段階到達の証拠。`,
      pattern: '真の天地型',
      action: 'コーチによる外部観察での確認を推奨',
      activeFlags };
  }
  if (totalPct >= 78) {
    return { biasPct, level: 'transition', color: 'red',
      title: `自己評価バイアス：${biasPct}%（移行期解釈）`,
      message: `数字（${totalPct}%）は L5-L6 圏。① 真の高段階への移行 ② 自己評価が実態より高い可能性。`,
      pattern: 'L5-L6 移行期',
      action: 'コーチによる外部観察での確認が必須',
      activeFlags };
  }
  return { biasPct, level: stage, color,
    title: `自己評価バイアス：${biasPct}%（強度）`,
    message: `数字（${totalPct}%）に対して、客観視の精度に大きな課題。3つの盲点を全方位で抱えています。`,
    pattern: '強インフレ警告',
    action: 'コーチング介入を強く推奨。最初の課題は「謙虚さ」の獲得',
    activeFlags };
}

/* ============================================================
 * Phase 2：人格L＋リーダー段階の自動推定
 * src/data/uaam_questions.js の同関数群と同一ロジック（API自己完結のためインライン）
 * ============================================================ */

function determinePersonalityLevel(totalPct, minAxisPct) {
  if (totalPct >= 95 && minAxisPct >= 75) return { level: 'L7', name: '天地型', confidence: 'high' };
  if (totalPct >= 88 && minAxisPct >= 70) return { level: 'L6', name: '共鳴型', confidence: 'medium' };
  if (totalPct >= 78) return { level: 'L5', name: '統合型', confidence: 'medium' };
  if (totalPct >= 65) return { level: 'L4', name: '自律型', confidence: 'medium' };
  if (totalPct >= 55) return { level: 'L3', name: '適応型', confidence: 'medium' };
  if (totalPct >= 40) return { level: 'L2', name: '取引型', confidence: 'medium' };
  return { level: 'L1', name: '反応型', confidence: 'medium' };
}

function determineLeadershipStage(totalPct, minAxisPct) {
  if (totalPct >= 95 && minAxisPct >= 75) return { stage: 7, name: '天導' };
  if (totalPct >= 88 && minAxisPct >= 70) return { stage: 6, name: '総導' };
  if (totalPct >= 78) return { stage: 5, name: '他導' };
  if (totalPct >= 68) return { stage: 4, name: '自導' };
  if (totalPct >= 58) return { stage: 3, name: '自律' };
  if (totalPct >= 48) return { stage: 2, name: '自立' };
  return { stage: 1, name: '自発' };
}

function assessConfidence(baseEstimate, biasMessage, axisSpread) {
  const signals = [];
  let confidence = baseEstimate.confidence;

  if (biasMessage) {
    if (biasMessage.level === 'transition') signals.push('bias_transition');
    else if (biasMessage.level === 'high_stage') signals.push('bias_high_stage');
    else if (biasMessage.level === 'strong') {
      signals.push('bias_inflation');
      confidence = 'low';
    } else if (biasMessage.level === 'moderate') {
      signals.push('bias_moderate');
      if (confidence === 'high') confidence = 'medium';
    }
  }

  if (axisSpread >= 18) {
    signals.push('axis_imbalance');
    if (confidence === 'high') confidence = 'medium';
  }

  return { ...baseEstimate, confidence, signals };
}

/* ============================================================
 * Phase 3：3要素診断（リーダーシップ／チームビルディング／マネジメント）
 * src/data/uaam_questions.js の同関数群と同一ロジック（API自己完結のためインライン）
 * ============================================================ */

const ELEMENT_WEIGHTS = {
  leadership: {
    meaning: 4, mindfulness: 0, mindshift: 1, mastery: 2,
    learning: 0, logical: 1, life: 0, leadership: 3,
    critical: 3, creativity: 1, communication: 2, collaboration: 0,
    idea: 4, innovation: 4, implementation: 1, influence: 8,
  },
  teamBuilding: {
    meaning: 2, mindfulness: 3, mindshift: 0, mastery: 0,
    learning: 2, logical: 0, life: 1, leadership: 6,
    critical: 1, creativity: 2, communication: 2, collaboration: 9,
    idea: 1, innovation: 1, implementation: 0, influence: 1,
  },
  management: {
    meaning: 1, mindfulness: 2, mindshift: 1, mastery: 2,
    learning: 1, logical: 6, life: 3, leadership: 4,
    critical: 3, creativity: 1, communication: 0, collaboration: 1,
    idea: 1, innovation: 1, implementation: 8, influence: 0,
  },
};

function calculateThreeElementScores(subs) {
  if (!subs) return { leadership: 0, teamBuilding: 0, management: 0 };
  const compute = (weights) => {
    let sum = 0, total = 0;
    for (const [k, w] of Object.entries(weights)) {
      sum += w * (subs[k] || 0);
      total += w;
    }
    return total === 0 ? 0 : Math.round((sum / total / 20) * 100);
  };
  return {
    leadership:   compute(ELEMENT_WEIGHTS.leadership),
    teamBuilding: compute(ELEMENT_WEIGHTS.teamBuilding),
    management:   compute(ELEMENT_WEIGHTS.management),
  };
}

function identifyElementProfile(threeScores) {
  const entries = Object.entries(threeScores);
  entries.sort((a, b) => b[1] - a[1]);
  return {
    primary: entries[0][0], primaryScore: entries[0][1],
    secondary: entries[1][0], secondaryScore: entries[1][1],
    weakest: entries[2][0], weakestScore: entries[2][1],
  };
}

function determinePrescriptionMode(threeScores, leadershipStage) {
  const stage = leadershipStage?.stage || 1;
  const profile = identifyElementProfile(threeScores);
  if ((threeScores.leadership >= 75 && threeScores.teamBuilding >= 75 && threeScores.management >= 75)
      || stage >= 6) return 'integrate';
  if ((profile.primaryScore >= 70 && profile.secondaryScore < 60) || stage === 5) return 'expand';
  return 'focus';
}

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
  "primary_type": "ANCHOR/SAGE/INVENTOR/PIONEER/VISIONARY/BUILDER/CATALYST/CRAFTER/NAVIGATOR/STRIKERから最も近い1つ",
  "secondary_type": "2番目に近い1つ",
  "type_name": "あなたの能力タイプ名（8〜20文字）",
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
  "action_suggestions": ["今日からできるアクション1", "アクション2", "アクション3"],
  "saikaku_integration": {
    "activation_core": "才覚発動の核心（2〜3行）",
    "mission_direction": "使命の方向性（2〜3行）",
    "flow_route": "最短フロールート（2〜3行）"
  }
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
  // 64問チェックを維持（67問はVスコアを含む別カウントのため、ここは64問基準）
  if (answeredCount < 64) {
    return res.status(400).json({ error: `全64問に回答してください（現在${answeredCount}問）` });
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

  // 自己評価バイアスメッセージ生成（旗カウント方式・45-95%版）
  // 4軸合計 / 320（最大スコア） * 100 で総合%を算出（旧 Lv.1〜Lv.6 廃止後の判定基準）
  const totalPct = Math.round(
    (scores.mindset.total + scores.literacy.total +
     scores.competency.total + scores.impact.total) / 320 * 100
  );
  const biasMessage = calculateBiasMessage(vAnswers, totalPct);
  console.log('[UAAM] biasMessage:', biasMessage ? `${biasMessage.biasPct}% (${biasMessage.level})` : 'null（健全）');

  // Phase 2：人格L＋リーダー段階の自動推定
  const axisPcts = [
    scores.mindset.percentage, scores.literacy.percentage,
    scores.competency.percentage, scores.impact.percentage,
  ];
  const minAxisPct = Math.min(...axisPcts);
  const maxAxisPct = Math.max(...axisPcts);
  const axisSpread = maxAxisPct - minAxisPct;

  const baseLevel = determinePersonalityLevel(totalPct, minAxisPct);
  const personalityLevel = assessConfidence(baseLevel, biasMessage, axisSpread);
  const leadershipStage = determineLeadershipStage(totalPct, minAxisPct);
  console.log(`[UAAM] personality_level: ${personalityLevel.level} (${personalityLevel.confidence}) leadership_stage: 第${leadershipStage.stage}（${leadershipStage.name}） axisSpread:${axisSpread} signals:[${personalityLevel.signals.join(',')}]`);

  // Phase 3：3要素診断（16才覚スコアの加重平均）
  // 國創学方針：3要素は比較しない。各要素ごとに独立した処方を出す。
  // 主・副・最弱の比較やfocus/expand/integrateモードは廃止（UI側で要素別に処方生成）。
  const subs = {
    ...scores.mindset.subs,
    ...scores.literacy.subs,
    ...scores.competency.subs,
    ...scores.impact.subs,
  };
  const threeElementScores = calculateThreeElementScores(subs);
  const developmentPhase = leadershipStage.stage >= 5 ? 'balance_4axis' : 'strength_focus';
  const threeElements = {
    ...threeElementScores,
    development_phase: developmentPhase,
  };
  console.log(`[UAAM] three_elements: L=${threeElementScores.leadership}% T=${threeElementScores.teamBuilding}% M=${threeElementScores.management}% phase=${developmentPhase}`);

  // 才覚領域データを取得
  let saikakuData = null;
  try {
    const saikakuDoc = await db.collection('results').doc(decoded.uid).get();
    if (saikakuDoc.exists) {
      const d = saikakuDoc.data();
      saikakuData = {
        kakuchiiki: d.selectedKakuchiiki || '',
        value: d.inputValueTop5 || d.inputValue || '',
        talent: d.inputTalentTop5 || d.inputTalent || '',
        passion: d.inputPassionTop5 || d.inputPassion || '',
      };
    }
  } catch (e) { console.warn('[UAAM] 才覚データ取得失敗:', e.message); }

  const saikakuSection = saikakuData && saikakuData.kakuchiiki ? `
━━━ 才覚領域データ ━━━
才覚領域名: ${saikakuData.kakuchiiki}
価値観: ${saikakuData.value}
才能: ${saikakuData.talent}
情熱: ${saikakuData.passion}
` : '';

  // Claude API 呼び出し用のユーザーメッセージ
  const userMsg = `以下のUAAM診断結果を分析してください。
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
      console.error(`[UAAM] attempt ${attempt + 1} failed:`, e.message || e);
      if (e.status) console.error(`[UAAM] API status: ${e.status}`);
      if (attempt === 2)
        return res.status(500).json({ error: `分析に失敗しました: ${e.message}` });
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
      vAnswers: vAnswers || {},
      scores,
      analysis,
      bias_message: biasMessage,           // 新：3段階バイアス表記（null=健全）
      personality_level: personalityLevel, // Phase 2：自動推定L1〜L7（confidence/signals 付き）
      leadership_stage: leadershipStage,   // Phase 2：自動推定 第1〜第7
      three_elements: threeElements,       // Phase 3：3要素診断＋処方モード
      // coach_confirmed_personality_level / coach_confirmed_leadership_stage / coach_observation_note は
      // AdminScreen でハル本人が編集する領域（自動上書き禁止）
      updatedAt: FieldValue.serverTimestamp(),
      ...(!existing.createdAt ? { createdAt: FieldValue.serverTimestamp() } : {}),
    },
    { merge: true }
  );

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res.status(200).json({
    scores,
    analysis,
    bias_message: biasMessage,
    personality_level: personalityLevel,
    leadership_stage: leadershipStage,
    three_elements: threeElements,
  });
}
