/**
 * UAAM (Universal Ability Assessment Model) 質問データ
 *
 * 4軸 × 4サブ項目 × 3問 = 48問
 * 各問は 1〜5 のリッカート尺度で回答
 * reverse: true の項目はスコア計算時に反転 (6 - score)
 *
 * 4軸:
 *   志 -MindSet-（4M）: Meaning / Mindfulness / Mindshift / Mastery
 *   知 -Literacy-（4L）: Learning / Logical / Life / Leadership
 *   技 -Competency-（4C）: Critical / Creativity / Communication / Collaboration
 *   衝 -Impact-（4I）: Idea / Innovation / Implementation / Influence
 */

export const UAAM_AXES = [
  {
    key: 'mindset',
    label: '志',
    english: 'MindSet',
    code: '4M',
    color: '#4A6FA5',
    description: '行動の軸をつくり、意識を高め、可能性を見出し、学びを定着させる力',
    subs: [
      { key: 'meaning',     label: 'Meaning（意味）',       description: '行動の軸をつくる力' },
      { key: 'mindfulness', label: 'Mindfulness（気づき）',  description: '今に意識を向け、変化を受け入れる力' },
      { key: 'mindshift',   label: 'Mindshift（意識転換）',  description: '固定観念を手放し、新しい可能性を見出す力' },
      { key: 'mastery',     label: 'Mastery（熟達）',        description: '実践と反復で学びを定着させる力' },
    ],
  },
  {
    key: 'literacy',
    label: '知',
    english: 'Literacy',
    code: '4L',
    color: '#2E8B57',
    description: '学び方を学び、論理的に伝え、社会実装し、他者を導く力',
    subs: [
      { key: 'learning',   label: 'Learning（学習）',         description: '学び方を学ぶ力' },
      { key: 'logical',    label: 'Logical（論理）',          description: '論理的に理解し伝える力' },
      { key: 'life',       label: 'Life（社会実装）',         description: '学びを社会実装へ落とし込む力' },
      { key: 'leadership', label: 'Leadership（リーダーシップ）', description: '知を広げ、他者を導く力' },
    ],
  },
  {
    key: 'competency',
    label: '技',
    english: 'Competency',
    code: '4C',
    color: '#C4922A',
    description: '批判的に見抜き、創造し、伝え、協働する力',
    subs: [
      { key: 'critical',      label: 'Critical（批判的思考）', description: '論理的に見抜く力' },
      { key: 'creativity',    label: 'Creativity（創造性）',   description: '新しいアイデアを生み出す力' },
      { key: 'communication', label: 'Communication（伝える力）', description: '考えを伝え共感を得る力' },
      { key: 'collaboration', label: 'Collaboration（協働）',  description: '多様な人と協働する力' },
    ],
  },
  {
    key: 'impact',
    label: '衝',
    english: 'Impact',
    code: '4I',
    color: '#A84432',
    description: '熱狂し、形にし、社会に実装し、文化として根づかせる力',
    subs: [
      { key: 'idea',           label: 'Idea（アイデア）',     description: '熱狂できるテーマを見出す力' },
      { key: 'innovation',     label: 'Innovation（変革）',    description: '知識と技能を形にする力' },
      { key: 'implementation', label: 'Implementation（実装）', description: '社会に実装する力' },
      { key: 'influence',      label: 'Influence（影響）',     description: '変化を広げ文化として根づかせる力' },
    ],
  },
];

export const UAAM_QUESTIONS = [
  // ━━━ 志 -MindSet- (4M) ━━━

  // Meaning（意味）：行動の軸をつくる力
  { id: 1,  axis: 'mindset', sub: 'meaning',     text: '自分の行動には明確な「なぜ」がある', reverse: false },
  { id: 2,  axis: 'mindset', sub: 'meaning',     text: '日々の活動に意味を見出せないことが多い', reverse: true },
  { id: 3,  axis: 'mindset', sub: 'meaning',     text: '自分の価値観に基づいて意思決定ができる', reverse: false },

  // Mindfulness（気づき）：今に意識を向け、変化を受け入れる力
  { id: 4,  axis: 'mindset', sub: 'mindfulness',  text: '自分の感情や思考の変化に敏感に気づける', reverse: false },
  { id: 5,  axis: 'mindset', sub: 'mindfulness',  text: '周囲の変化に気づかず、後から知ることが多い', reverse: true },
  { id: 6,  axis: 'mindset', sub: 'mindfulness',  text: '予想外の出来事も柔軟に受け入れられる', reverse: false },

  // Mindshift（意識転換）：固定観念を手放し、新しい可能性を見出す力
  { id: 7,  axis: 'mindset', sub: 'mindshift',    text: '「こうあるべき」という思い込みを手放せる', reverse: false },
  { id: 8,  axis: 'mindset', sub: 'mindshift',    text: '一度決めた考えを変えることに抵抗がある', reverse: true },
  { id: 9,  axis: 'mindset', sub: 'mindshift',    text: '失敗を新しい視点を得るチャンスと捉えられる', reverse: false },

  // Mastery（熟達）：実践と反復で学びを定着させる力
  { id: 10, axis: 'mindset', sub: 'mastery',      text: '学んだことを何度も実践して自分のものにできる', reverse: false },
  { id: 11, axis: 'mindset', sub: 'mastery',      text: '新しいことを始めても長続きしないことが多い', reverse: true },
  { id: 12, axis: 'mindset', sub: 'mastery',      text: '地道な積み重ねで着実にレベルアップできる', reverse: false },

  // ━━━ 知 -Literacy- (4L) ━━━

  // Learning（学習）：学び方を学ぶ力
  { id: 13, axis: 'literacy', sub: 'learning',    text: '自分に合った学び方を見つけるのが得意だ', reverse: false },
  { id: 14, axis: 'literacy', sub: 'learning',    text: '効率的な学習方法がわからず、やみくもに勉強しがちだ', reverse: true },
  { id: 15, axis: 'literacy', sub: 'learning',    text: '新しい分野でも独学で基礎を身につけられる', reverse: false },

  // Logical（論理）：論理的に理解し伝える力
  { id: 16, axis: 'literacy', sub: 'logical',     text: '複雑な情報を整理して、わかりやすく説明できる', reverse: false },
  { id: 17, axis: 'literacy', sub: 'logical',     text: '論理的に筋道を立てて考えるのが苦手だ', reverse: true },
  { id: 18, axis: 'literacy', sub: 'logical',     text: '矛盾や論理の飛躍にすぐ気づくことができる', reverse: false },

  // Life（社会実装）：学びを社会実装へ落とし込む力
  { id: 19, axis: 'literacy', sub: 'life',        text: '学んだ知識を現実の課題解決に活かせる', reverse: false },
  { id: 20, axis: 'literacy', sub: 'life',        text: '知識は増えても実践に結びつかないことが多い', reverse: true },
  { id: 21, axis: 'literacy', sub: 'life',        text: '理論と実践のギャップを埋める方法を見つけられる', reverse: false },

  // Leadership（リーダーシップ）：知を広げ、他者を導く力
  { id: 22, axis: 'literacy', sub: 'leadership',  text: '自分の知識や経験を周囲に伝え、成長を促せる', reverse: false },
  { id: 23, axis: 'literacy', sub: 'leadership',  text: '人に教えたり導いたりするのは自分には向いていない', reverse: true },
  { id: 24, axis: 'literacy', sub: 'leadership',  text: 'チームの学びの方向性を示すことができる', reverse: false },

  // ━━━ 技 -Competency- (4C) ━━━

  // Critical（批判的思考）：論理的に見抜く力
  { id: 25, axis: 'competency', sub: 'critical',      text: '情報の信頼性を多角的に検証する習慣がある', reverse: false },
  { id: 26, axis: 'competency', sub: 'critical',      text: '提示された情報をそのまま受け入れてしまうことが多い', reverse: true },
  { id: 27, axis: 'competency', sub: 'critical',      text: '問題の本質を見抜き、的確な問いを立てられる', reverse: false },

  // Creativity（創造性）：新しいアイデアを生み出す力
  { id: 28, axis: 'competency', sub: 'creativity',    text: '既存の枠にとらわれず、新しい発想ができる', reverse: false },
  { id: 29, axis: 'competency', sub: 'creativity',    text: 'アイデアを求められると頭が真っ白になることが多い', reverse: true },
  { id: 30, axis: 'competency', sub: 'creativity',    text: '異なる要素を組み合わせて独自の解決策を生み出せる', reverse: false },

  // Communication（伝える力）：考えを伝え共感を得る力
  { id: 31, axis: 'competency', sub: 'communication', text: '自分の考えを相手に伝わる言葉で表現できる', reverse: false },
  { id: 32, axis: 'competency', sub: 'communication', text: '自分の意見を人前で伝えるのが苦手だ', reverse: true },
  { id: 33, axis: 'competency', sub: 'communication', text: '相手の立場に立って、共感を生む伝え方ができる', reverse: false },

  // Collaboration（協働）：多様な人と協働する力
  { id: 34, axis: 'competency', sub: 'collaboration', text: '異なる意見や価値観を持つ人とも協力して成果を出せる', reverse: false },
  { id: 35, axis: 'competency', sub: 'collaboration', text: 'チームで動くより一人で進める方が得意だ', reverse: true },
  { id: 36, axis: 'competency', sub: 'collaboration', text: 'メンバーの強みを活かした役割分担を考えられる', reverse: false },

  // ━━━ 衝 -Impact- (4I) ━━━

  // Idea（アイデア）：熱狂できるテーマを見出す力
  { id: 37, axis: 'impact', sub: 'idea',           text: '「これだ」と感じるテーマに出会うと心が躍る', reverse: false },
  { id: 38, axis: 'impact', sub: 'idea',           text: '何に情熱を注げばいいかわからないことが多い', reverse: true },
  { id: 39, axis: 'impact', sub: 'idea',           text: '自分の中から湧き上がるアイデアを大切にしている', reverse: false },

  // Innovation（変革）：知識と技能を形にする力
  { id: 40, axis: 'impact', sub: 'innovation',     text: 'アイデアを具体的な形にするプロセスが好きだ', reverse: false },
  { id: 41, axis: 'impact', sub: 'innovation',     text: '思いついても形にするまでたどり着けないことが多い', reverse: true },
  { id: 42, axis: 'impact', sub: 'innovation',     text: '既存のやり方を根本から変える発想ができる', reverse: false },

  // Implementation（実装）：社会に実装する力
  { id: 43, axis: 'impact', sub: 'implementation', text: 'アイデアを社会で使える形に落とし込める', reverse: false },
  { id: 44, axis: 'impact', sub: 'implementation', text: '理想はあるが、実現する具体的な方法が見えない', reverse: true },
  { id: 45, axis: 'impact', sub: 'implementation', text: '制約の中でも最善の実装方法を見つけ出せる', reverse: false },

  // Influence（影響）：変化を広げ文化として根づかせる力
  { id: 46, axis: 'impact', sub: 'influence',      text: '自分の行動や発言が周囲に良い影響を与えている', reverse: false },
  { id: 47, axis: 'impact', sub: 'influence',      text: '人を巻き込んで動かすのは自分には難しいと思う', reverse: true },
  { id: 48, axis: 'impact', sub: 'influence',      text: '始めた変化が自然と広がり定着していく実感がある', reverse: false },
];

/** リッカート尺度ラベル */
export const LIKERT_LABELS = [
  { value: 1, label: '全く当てはまらない' },
  { value: 2, label: 'あまり当てはまらない' },
  { value: 3, label: 'どちらともいえない' },
  { value: 4, label: 'やや当てはまる' },
  { value: 5, label: '非常に当てはまる' },
];

/**
 * 回答からスコアを計算する
 * @param {Object} answers - { questionId: score(1-5) }
 * @returns {Object} - { mindset: { total, max, percentage, subs: { meaning: n, ... } }, ... }
 */
export function calculateScores(answers) {
  const result = {};

  for (const axis of UAAM_AXES) {
    const axisQuestions = UAAM_QUESTIONS.filter((q) => q.axis === axis.key);
    const subs = {};

    for (const sub of axis.subs) {
      const subQuestions = axisQuestions.filter((q) => q.sub === sub.key);
      let subTotal = 0;
      for (const q of subQuestions) {
        const raw = answers[q.id] || 3;
        subTotal += q.reverse ? 6 - raw : raw;
      }
      subs[sub.key] = subTotal;
    }

    const total = Object.values(subs).reduce((a, b) => a + b, 0);
    const maxScore = axis.subs.length * 3 * 5;
    result[axis.key] = {
      total,
      max: maxScore,
      percentage: Math.round((total / maxScore) * 100),
      subs,
    };
  }

  return result;
}
