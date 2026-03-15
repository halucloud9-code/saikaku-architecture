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
  { id: 1,  axis: 'mindset', sub: 'meaning',     text: 'SPを起点にした意思決定が、今日も自然に行われている。', reverse: false },
  { id: 2,  axis: 'mindset', sub: 'meaning',     text: '「なぜこれをやるのか」を問わないまま、目の前の作業に流され続けている。', reverse: true },
  { id: 3,  axis: 'mindset', sub: 'meaning',     text: '今日動いた理由が、自分の核心と一致している。', reverse: false },

  // Mindfulness（気づき）：今に意識を向け、変化を受け入れる力
  { id: 4,  axis: 'mindset', sub: 'mindfulness',  text: '感情の乱れをリアルタイムで検知し、その場で行動を修正できている。', reverse: false },
  { id: 5,  axis: 'mindset', sub: 'mindfulness',  text: '防衛反応が出た後、SPに戻れずそのまま動いている。', reverse: true },
  { id: 6,  axis: 'mindset', sub: 'mindfulness',  text: '想定外の事態に直面した瞬間、GOALに沿った解釈に書き換えて動いている。', reverse: false },

  // Mindshift（意識転換）：固定観念を手放し、新しい可能性を見出す力
  { id: 7,  axis: 'mindset', sub: 'mindshift',    text: '品格以降、自分の行動パターンが変わり今も自然に継続している。', reverse: false },
  { id: 8,  axis: 'mindset', sub: 'mindshift',    text: 'Styleγと理解しながら、実際はαのパターンが常態化している。', reverse: true },
  { id: 9,  axis: 'mindset', sub: 'mindshift',    text: '直近の失敗をNarrative構造で解剖し、24時間以内に自己信念のcodeを書き換えている。', reverse: false },

  // Mastery（熟達）：実践と反復で学びを定着させる力
  { id: 10, axis: 'mindset', sub: 'mastery',      text: '才覚領域が、今日も意識せず自然に発動している。', reverse: false },
  { id: 11, axis: 'mindset', sub: 'mastery',      text: '成果が見えない時期に、自分で設計したルーティンが崩れたままになっている。', reverse: true },
  { id: 12, axis: 'mindset', sub: 'mastery',      text: '「在り方」「生き方」「やり方」が、意識せず自然に遂行されている。', reverse: false },

  // ━━━ 知 -Literacy- (4L) ━━━

  // Learning（学習）：学び方を学ぶ力
  { id: 13, axis: 'literacy', sub: 'learning',    text: '未知の領域に入った瞬間、Triad Nexusで構造を理解している。', reverse: false },
  { id: 14, axis: 'literacy', sub: 'learning',    text: '情報を収集し続けているが、現実への還元が止まったままになっている。', reverse: true },
  { id: 15, axis: 'literacy', sub: 'learning',    text: '設定したSNGと今日の行動が一致している。', reverse: false },

  // Logical（論理）：論理的に理解し伝える力
  { id: 16, axis: 'literacy', sub: 'logical',     text: '複雑な事象の本質を即座に理解し、シンプルに言語化できている。', reverse: false },
  { id: 17, axis: 'literacy', sub: 'logical',     text: '思い込みや感情が判断に混入し、本質に辿り着けない状態が続いている。', reverse: true },
  { id: 18, axis: 'literacy', sub: 'logical',     text: '目の前の状況の核心を掴んだ上で、今日も動いている。', reverse: false },

  // Life（社会実装）：学びを社会実装へ落とし込む力
  { id: 19, axis: 'literacy', sub: 'life',        text: '7Sources・Narrative・SPを、今日の現実の場面で具体的に使っている。', reverse: false },
  { id: 20, axis: 'literacy', sub: 'life',        text: '学ぶことが目的になり、現実への還元が止まったままになっている。', reverse: true },
  { id: 21, axis: 'literacy', sub: 'life',        text: '理想と現実の差分を自分の役割と認識し、今日も埋めるために動いている。', reverse: false },

  // Leadership（リーダーシップ）：知を広げ、他者を導く力
  { id: 22, axis: 'literacy', sub: 'leadership',  text: '自分のノウハウを、他者が再現できる形で今日も伝えている。', reverse: false },
  { id: 23, axis: 'literacy', sub: 'leadership',  text: '自分だけが動き続けており、知識や技術が周囲に渡っていない。', reverse: true },
  { id: 24, axis: 'literacy', sub: 'leadership',  text: 'チームの停滞の原因を特定し、対策を打ちGOALに日々近づいている。', reverse: false },

  // ━━━ 技 -Competency- (4C) ━━━

  // Critical（批判的思考）：論理的に見抜く力
  { id: 25, axis: 'competency', sub: 'critical',      text: '目の前の情報をSP（7Colors）で照合し、本質を掴んでから動いている。', reverse: false },
  { id: 26, axis: 'competency', sub: 'critical',      text: '検証せずに他者の解釈をそのまま採用することが常態化している。', reverse: true },
  { id: 27, axis: 'competency', sub: 'critical',      text: '誰も気づいていない本質的な問いを、今日も自分から立てている。', reverse: false },

  // Creativity（創造性）：新しいアイデアを生み出す力
  { id: 28, axis: 'competency', sub: 'creativity',    text: '当たり前を疑い、今日も新しい答えを自分から作り出している。', reverse: false },
  { id: 29, axis: 'competency', sub: 'creativity',    text: 'ゼロから考える場面で、知っているやり方だけに頼り続けている。', reverse: true },
  { id: 30, axis: 'competency', sub: 'creativity',    text: '関係ないと思える領域の法則を繋げて、今日も新しい発見をしている。', reverse: false },

  // Communication（伝える力）：考えを伝え共感を得る力
  { id: 31, axis: 'competency', sub: 'communication', text: '相手の7Sourcesを読み、その人に届く言葉で今日も伝えている。', reverse: false },
  { id: 32, axis: 'competency', sub: 'communication', text: '相手の反応を先読みして、言うべきことを飲み込み続けている。', reverse: true },
  { id: 33, axis: 'competency', sub: 'communication', text: '相手の心が動かない理由を理解し、NSVを遂行している。', reverse: false },

  // Collaboration（協働）：多様な人と協働する力
  { id: 34, axis: 'competency', sub: 'collaboration', text: 'チームで意見がぶつかる場面でも、GOALに向けて全員が動ける答えを今日も作っている。', reverse: false },
  { id: 35, axis: 'competency', sub: 'collaboration', text: '一人で動く方が早いと判断し、他者と組むことを避け続けている。', reverse: true },
  { id: 36, axis: 'competency', sub: 'collaboration', text: '個々の才覚領域を把握し、チーム全体がGOALに向かう配置で動いている。', reverse: false },

  // ━━━ 衝 -Impact- (4I) ━━━

  // Idea（アイデア）：熱狂できるテーマを見出す力
  { id: 37, axis: 'impact', sub: 'idea',           text: 'STUNNING DREAMに向けて、今日のエネルギーが一点に集中している。', reverse: false },
  { id: 38, axis: 'impact', sub: 'idea',           text: '何に力を注ぐべきか曖昧なまま、エネルギーが分散し続けている。', reverse: true },
  { id: 39, axis: 'impact', sub: 'idea',           text: 'SPから生まれた構想が、今日も実行できる形で手の中にある。', reverse: false },

  // Innovation（変革）：知識と技能を形にする力
  { id: 40, axis: 'impact', sub: 'innovation',     text: 'STUNNING DREAMへの道のりの泥臭さに、今日も向き合っている。', reverse: false },
  { id: 41, axis: 'impact', sub: 'innovation',     text: '頭で描いたまま止まり、実際に動き出せない状態が続いている。', reverse: true },
  { id: 42, axis: 'impact', sub: 'innovation',     text: '小手先の改善ではなく、根本から作り直す判断を今日もできている。', reverse: false },

  // Implementation（実装）：社会に実装する力
  { id: 43, axis: 'impact', sub: 'implementation', text: 'GOALから逆算し、今日やるべきことが明確で動いている。', reverse: false },
  { id: 44, axis: 'impact', sub: 'implementation', text: '向かう先はあるが、いつ・何を・どう動くかが決まらないまま動いている。', reverse: true },
  { id: 45, axis: 'impact', sub: 'implementation', text: 'どんな状況でも、今日動くべき最善のルートを自分で選んでいる。', reverse: false },

  // Influence（影響）：変化を広げ文化として根づかせる力
  { id: 46, axis: 'impact', sub: 'influence',      text: '自分の在り方が、今日も誰かの行動を動かしている。', reverse: false },
  { id: 47, axis: 'impact', sub: 'influence',      text: '動かすべき場面で、仕組みづくりや調整を後回しにし続けている。', reverse: true },
  { id: 48, axis: 'impact', sub: 'influence',      text: '「在り方」「生き方」「やり方」が、意識せず自然に他者へ伝播している。', reverse: false },
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
 * @returns {Object} - { mindset: { total, max, percentage, subs, domainSubs, domainTotal }, ... }
 *
 * ■ 軸スコア（total / subs）
 *   通常: そのまま 1〜5、反転: 6-raw
 *   サブ最大15、軸最大60
 *
 * ■ 領域用スコア（domainTotal / domainSubs）
 *   Q1: 回答点数 × 基礎係数
 *   Q2: 反転点数 × 阻害係数
 *   Q3: そのまま
 *   サブ最大15、軸最大60、領域最大3600
 */

/* 基礎係数: 回答1→0.35, 2→0.55, 3→0.75, 4→0.90, 5→1.00 */
const BASE_COEFF = { 1: 0.35, 2: 0.55, 3: 0.75, 4: 0.90, 5: 1.00 };

/* 阻害係数(逆転): 回答1→1.00, 2→0.90, 3→0.75, 4→0.55, 5→0.35 */
const BLOCK_COEFF = { 1: 1.00, 2: 0.90, 3: 0.75, 4: 0.55, 5: 0.35 };

export function calculateScores(answers) {
  const result = {};
  for (const axis of UAAM_AXES) {
    const axisQuestions = UAAM_QUESTIONS.filter((q) => q.axis === axis.key);
    const subs = {};
    const domainSubs = {};
    for (const sub of axis.subs) {
      const subQuestions = axisQuestions.filter((q) => q.sub === sub.key);

      /* --- 軸スコア（単純加算） --- */
      const qScores = subQuestions.map((q) => {
        const raw = answers[q.id] || 3;
        return q.reverse ? 6 - raw : raw;
      });
      subs[sub.key] = qScores.reduce((a, b) => a + b, 0); // 最大15

      /* --- 領域用スコア（係数付き） --- */
      let domainSubTotal = 0;
      subQuestions.forEach((q, i) => {
        const raw = answers[q.id] || 3;
        if (i === 0) {
          // Q1: 回答点数 × 基礎係数
          domainSubTotal += raw * (BASE_COEFF[raw] || 0.75);
        } else if (i === 1) {
          // Q2: 反転点数 × 阻害係数
          const reversed = 6 - raw;
          domainSubTotal += reversed * (BLOCK_COEFF[raw] || 0.75);
        } else {
          // Q3: そのまま
          domainSubTotal += q.reverse ? 6 - raw : raw;
        }
      });
      domainSubs[sub.key] = domainSubTotal; // 最大15
    }
    const total = Object.values(subs).reduce((a, b) => a + b, 0);         // 最大60
    const domainTotal = Object.values(domainSubs).reduce((a, b) => a + b, 0); // 最大60
    const maxScore = 60;
    result[axis.key] = {
      total,
      max: maxScore,
      percentage: Math.round((total / maxScore) * 100),
      subs,
      domainSubs,
      domainTotal,
    };
  }
  return result;
}
