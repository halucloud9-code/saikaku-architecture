/**
 * UAAM (Universal Ability Assessment Model) 質問データ
 *
 * 4軸 × 4サブ項目 × 3問 = 48問 + 妥当性チェック3問 = 計51問
 * 各問は 1〜5 のリッカート尺度で回答
 * reverse: true の項目はスコア計算時に反転 (6 - score)
 * validity: true の項目はスコア計算に含めない（バイアス検出用）
 *
 * 回答基準：すべての質問は「直近1ヶ月の自分」を基準に回答
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
    description: '事実を見抜き、正確に伝え、結果に変え、人を育てる力',
    subs: [
      { key: 'learning',   label: 'Learning（学習）',         description: '感情を捨てて事実だけを見る力' },
      { key: 'logical',    label: 'Logical（論理）',          description: '必要なことだけを伝え、相手を正確に動かす力' },
      { key: 'life',       label: 'Life（社会実装）',         description: '精神論を捨て、目に見える結果に変える力' },
      { key: 'leadership', label: 'Leadership（リーダーシップ）', description: 'なれ合いを捨て、一人で結果を出せる人間を作る力' },
    ],
  },
  {
    key: 'competency',
    label: '技',
    english: 'Competency',
    code: '4C',
    color: '#C4922A',
    description: '論理的に見抜き、創造し、伝え、協働する力',
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

  // ① Meaning（意味）：行動の軸をつくる力
  { id: 1,  axis: 'mindset', sub: 'meaning',     text: '今日の全ての行動の起点が、SPから来ていると言い切れる。', reverse: false },
  { id: 2,  axis: 'mindset', sub: 'meaning',     text: '「とりあえず動いた」「なんとなく続けた」日が今週もあった。', reverse: true },
  { id: 3,  axis: 'mindset', sub: 'meaning',     text: 'SPに反する選択肢を、損得を考えず今日も即座に手放した事実がある。', reverse: false },

  // ② Mindfulness（気づき）：今に意識を向け、変化を受け入れる力
  { id: 4,  axis: 'mindset', sub: 'mindfulness',  text: '防衛反応が出た瞬間に気づき、その場でStyleγに戻せている。', reverse: false },
  { id: 5,  axis: 'mindset', sub: 'mindfulness',  text: '感情的に反応した後、修正できないままその日が終わった日がある。', reverse: true },
  { id: 6,  axis: 'mindset', sub: 'mindfulness',  text: '自分にとって不都合な変化を、今日も抵抗なく受け入れて動いた事実がある。', reverse: false },

  // ③ Mindshift（意識転換）：固定観念を手放し、新しい可能性を見出す力
  { id: 7,  axis: 'mindset', sub: 'mindshift',    text: '「自分はこういう人間だ」という思い込みを、今日も疑えている。', reverse: false },
  { id: 8,  axis: 'mindset', sub: 'mindshift',    text: 'Styleγと頭でわかっていながら、αかβのパターンで動いた日が今週あった。', reverse: true },
  { id: 9,  axis: 'mindset', sub: 'mindshift',    text: '新しいものを生み出すために、あえて今までやってきたことをやらないことを定期的にやっている。', reverse: false },

  // ④ Mastery（熟達）：実践と反復で学びを定着させる力 ★本丸：学び→行動化
  { id: 10, axis: 'mindset', sub: 'mastery',      text: '学んだことが今日の行動に出ていると、具体的な場面で言い切れる。', reverse: false },
  { id: 11, axis: 'mindset', sub: 'mastery',      text: '実践しようと決めたことが、気づけばやらなくなっている。', reverse: true },
  { id: 12, axis: 'mindset', sub: 'mastery',      text: '意識せず自然に動いた結果が、今日も周囲から見える形で出ている。', reverse: false },

  // ━━━ 知 -Literacy- (4L) ━━━

  // ⑤ Learning（学習）：感情を捨てて事実だけを見る力
  { id: 13, axis: 'literacy', sub: 'learning',    text: '新しい情報に触れたとき、感情や先入観を排除し、事実だけを正確に抽出することが習慣になっている。', reverse: false },
  { id: 14, axis: 'literacy', sub: 'learning',    text: '「わかった気分」になるだけで満足し、事実の検証や裏取りを飛ばしていることがある。', reverse: true },
  { id: 15, axis: 'literacy', sub: 'learning',    text: '自分が抽出した事実と、他者が同じ情報から得る結論に、明確な精度の差が出ている。', reverse: false },

  // ⑥ Logical（論理）：必要なことだけを伝え、相手を正確に動かす力
  { id: 16, axis: 'literacy', sub: 'logical',     text: '相手と仲良くなるためではなく、目的をもち、必要なことを伝えることが習慣になっている。', reverse: false },
  { id: 17, axis: 'literacy', sub: 'logical',     text: '相手に共感しようとしたり、余計なことを話しすぎたりして、かえって相手を混乱させていることがある。', reverse: true },
  { id: 18, axis: 'literacy', sub: 'logical',     text: '自分が出した指示や依頼に対して、相手から確認や質問が戻ってくることがほぼない。', reverse: false },

  // ⑦ Life（社会実装）：精神論を捨て、目に見える結果に変える力
  { id: 19, axis: 'literacy', sub: 'life',        text: '学んだことの成果を、気持ちや感覚ではなく、数字・期限・成果物など目に見える形で定義している。', reverse: false },
  { id: 20, axis: 'literacy', sub: 'life',        text: '成果を「手応えがあった」「反応がよかった」という感覚で評価し、具体的な数字で測定していないことがある。', reverse: true },
  { id: 21, axis: 'literacy', sub: 'life',        text: '自分の学びの成果を、第三者が見ても測定できる数字や結果として、継続的に提示できている。', reverse: false },

  // ⑧ Leadership（リーダーシップ）：なれ合いを捨て、一人で結果を出せる人間を作る力
  { id: 22, axis: 'literacy', sub: 'leadership',  text: 'なれ合いや同情を一切捨て、相手が一人で戦って結果を出せるように、自分のやり方をそのまま渡している。', reverse: false },
  { id: 23, axis: 'literacy', sub: 'leadership',  text: '相手の気持ちに寄り添いすぎた結果、自分がいないと何もできない「甘えた人間」を作ってしまっている。', reverse: true },
  { id: 24, axis: 'literacy', sub: 'leadership',  text: '自分が教えた相手が、さらに別の相手に同じことを教え、その相手も結果を出している。', reverse: false },

  // ━━━ 技 -Competency- (4C) ━━━

  // ⑨ Critical Thinking（批判的思考）：論理的に見抜く力
  { id: 25, axis: 'competency', sub: 'critical',      text: '自分の判断について、根拠と仮説を分けて構造的に説明することが習慣になっている。', reverse: false },
  { id: 26, axis: 'competency', sub: 'critical',      text: '結論を先に決めてから、それに合う理由を後から集めてしまうことがある。', reverse: true },
  { id: 27, axis: 'competency', sub: 'critical',      text: '周囲が見落としていた論点や本質を、自分が先に整理して言葉にする場面が繰り返しある。', reverse: false },

  // ⑩ Creativity（創造性）：新しいアイデアを生み出す力
  { id: 28, axis: 'competency', sub: 'creativity',    text: '問題解決の際に、自分の業界や専門分野以外からヒントを取り入れることが習慣になっている。', reverse: false },
  { id: 29, axis: 'competency', sub: 'creativity',    text: '新しい発想が必要な場面でも、過去にうまくいったやり方に頼り続けてしまうことがある。', reverse: true },
  { id: 30, axis: 'competency', sub: 'creativity',    text: '一見関係のない要素を組み合わせて、新しいアイデアや形を実際に生み出すことが日常的にある。', reverse: false },

  // ⑪ Communication（伝える力）：考えを伝え共感を得る力 ★本丸：伝えて相手を動かす
  { id: 31, axis: 'competency', sub: 'communication', text: '自分の伝え方によって、相手の理解や行動に変化が起こることが継続している。', reverse: false },
  { id: 32, axis: 'competency', sub: 'communication', text: '相手に伝わらなかったときも、伝え方を大きく変えずに終えてしまうことがある。', reverse: true },
  { id: 33, axis: 'competency', sub: 'communication', text: '自分の言葉がきっかけとなって、相手が自発的に動き出す場面が繰り返しある。', reverse: false },

  // ⑫ Collaboration（協働）：多様な人と協働する力
  { id: 34, axis: 'competency', sub: 'collaboration', text: '年齢・立場・専門の異なる人とも、目的を持って協力しながら成果を出すことが定着している。', reverse: false },
  { id: 35, axis: 'competency', sub: 'collaboration', text: '自分と価値観や進め方が違う相手とは、うまく噛み合わないまま終わってしまうことがある。', reverse: true },
  { id: 36, axis: 'competency', sub: 'collaboration', text: '自分一人では出せなかった成果を、他者との協働によって再現できている。', reverse: false },

  // ━━━ 衝 -Impact- (4I) ━━━

  // ⑬ Idea（アイデア）：熱狂できるテーマを見出す力
  { id: 37, axis: 'impact', sub: 'idea',           text: '他人からの指示や評価とは無関係に、すべてのエネルギーを注ぎ込める対象が明確に存在する。', reverse: false },
  { id: 38, axis: 'impact', sub: 'idea',           text: '何に力を注ぐべきかが定まらず、目先の出来事に振り回されてエネルギーを無駄に分散させていることがある。', reverse: true },
  { id: 39, axis: 'impact', sub: 'idea',           text: '自分の熱量に共鳴した人間が、指示ではなく自分ごととしてそのテーマを引き受けていることが今の日常になっている。', reverse: false },

  // ⑭ Innovation（変革）：知識と技能を形にする力
  { id: 40, axis: 'impact', sub: 'innovation',     text: '頭の中の構想をそのままにせず、必ず目に見える形や結果として現実に出力することが習慣になっている。', reverse: false },
  { id: 41, axis: 'impact', sub: 'innovation',     text: '構想やアイデアを持ちながら、プロトタイプや試作すら作らずに時間が過ぎていることがある。', reverse: true },
  { id: 42, axis: 'impact', sub: 'innovation',     text: '知識と技術を組み合わせて現実に形を生み出すことが、今の自分のデフォルトの動き方になっている。', reverse: false },

  // ⑮ Implementation（実装）：社会に実装する力
  { id: 43, axis: 'impact', sub: 'implementation', text: '自分が作ったものを自己満足で終わらせず、組織や社会の仕組みの一部として実際に稼働させている。', reverse: false },
  { id: 44, axis: 'impact', sub: 'implementation', text: '成果物を作っただけで満足し、それが誰にも使われず現実の何の役にも立っていないことがある。', reverse: true },
  { id: 45, axis: 'impact', sub: 'implementation', text: '自分が構築した仕組みが、当初の想定を超えて、別の領域や組織にも転用されていることが今の当たり前になっている。', reverse: false },

  // ⑯ Influence（影響）：変化を広げ文化として根づかせる力 ★本丸：自分不在でも機能する
  { id: 46, axis: 'impact', sub: 'influence',      text: '自分が持ち込んだ基準に周囲が染まり、以前のやり方に戻れなくなっていることが今の日常になっている。', reverse: false },
  { id: 47, axis: 'impact', sub: 'influence',      text: '自分が直接言わなくなった途端、空気が緩み、以前の低い基準に戻る場面がある。', reverse: true },
  { id: 48, axis: 'impact', sub: 'influence',      text: '自分が直接関与しなくても、自分が持ち込んだ変化が当たり前のルールとして機能し続けることが今の現実になっている。', reverse: false },
];

/**
 * 妥当性チェック項目（V問）
 * スコア計算には含めない。バイアス検出・一貫性チェック用。
 * シャッフル時に通常問と混ぜて配置する。
 */
export const VALIDITY_QUESTIONS = [
  { id: 'V1', text: '過去1ヶ月で、自分の判断や言動に一度も後悔がなかった。', type: 'inflation' },
  { id: 'V2', text: '周囲の誰からも、自分の改善点を指摘されたことがない。', type: 'inflation' },
  { id: 'V3', text: '自分の行動が周囲に良い影響を与えていると、自信を持って言える。', type: 'consistency', compareWith: { questionId: 46 } },
];

/**
 * 妥当性チェックの判定ロジック
 * @param {Object} answers - V問の回答 { V1: score, V2: score, V3: score }
 * @param {Object} mainAnswers - 本問の回答 { questionId: score }
 * @returns {Object} - フラグ情報
 */
export function checkValidity(vAnswers, mainAnswers) {
  const flags = [];
  const v1is5 = vAnswers['V1'] === 5;
  const v2is5 = vAnswers['V2'] === 5;
  const bothInflated = v1is5 && v2is5;

  // 盛り検出：critical（両方5）が出たらwarning（片方5）は吸収される
  if (bothInflated) {
    flags.push({
      level: 'critical',
      type: 'inflation_strong',
      message: '客観視の精度に課題',
      detail: 'V1・V2ともに最高評価。フィードバック時に「客観視の精度」をコーチングテーマとして扱うことを推奨します。',
    });
  } else if (v1is5 || v2is5) {
    flags.push({
      level: 'warning',
      type: 'inflation',
      message: '自己評価が高め傾向',
      detail: `${v1is5 ? 'V1' : 'V2'}が最高評価。回答に社会的望ましさバイアスの可能性があります。`,
    });
  }

  // 一貫性検出：V3 と Influence Q1 (id:46) の差が±2以上
  const v3Score = vAnswers['V3'];
  const influenceQ1Score = mainAnswers[46];
  if (v3Score != null && influenceQ1Score != null) {
    const diff = Math.abs(v3Score - influenceQ1Score);
    if (diff >= 2) {
      flags.push({
        level: 'info',
        type: 'consistency',
        message: '回答一貫性にブレあり',
        detail: `V3(${v3Score}) と Influence Q1(${influenceQ1Score}) の差が${diff}。回答の集中度にばらつきがある可能性があります。`,
      });
    }
  }

  return {
    hasFlags: flags.length > 0,
    flags,
  };
}

/** リッカート尺度ラベル */
export const LIKERT_LABELS = [
  { value: 1, label: '全く当てはまらない' },
  { value: 2, label: 'あまり当てはまらない' },
  { value: 3, label: 'どちらともいえない' },
  { value: 4, label: 'よく当てはまる' },
  { value: 5, label: '常に当てはまる' },
];

/**
 * 回答シャッフル用：48問＋V3問を混ぜてランダム配列にする
 * V問は前半・中盤・後半に1問ずつ散らす
 * @returns {Array} - シャッフルされた51問の配列
 */
export function getShuffledQuestions() {
  // 48問をシャッフル
  const mainQs = [...UAAM_QUESTIONS];
  for (let i = mainQs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mainQs[i], mainQs[j]] = [mainQs[j], mainQs[i]];
  }

  // V問を前半・中盤・後半に1問ずつ挿入
  const third = Math.floor(mainQs.length / 3);
  const vQs = VALIDITY_QUESTIONS.map((vq) => ({ ...vq, validity: true }));

  // 各セクション内のランダムな位置に挿入
  const pos1 = Math.floor(Math.random() * third);
  const pos2 = third + Math.floor(Math.random() * third);
  const pos3 = third * 2 + Math.floor(Math.random() * (mainQs.length - third * 2));

  // 後ろから挿入（indexがずれないように）
  const positions = [pos3, pos2, pos1].sort((a, b) => b - a);
  const vIndices = [2, 1, 0];
  positions.forEach((pos, i) => {
    mainQs.splice(pos, 0, vQs[vIndices[i]]);
  });

  return mainQs;
}

/**
 * 回答からスコアを計算する
 * @param {Object} answers - { questionId: score(1-5) }
 * @returns {Object} - { mindset: { total, max, percentage, subs }, ... }
 *
 * ■ スコアリング
 *   通常項目: そのまま 1〜5
 *   逆転項目（Q2）: 6 - raw
 *   サブカテゴリ最大15、軸最大60
 *
 * ※ 領域スコア（係数付き）は領域専用の質問で別途算出する
 * ※ V問（validity: true）はスコア計算に含まれない
 */
export function calculateScores(answers) {
  const result = {};
  for (const axis of UAAM_AXES) {
    const axisQuestions = UAAM_QUESTIONS.filter((q) => q.axis === axis.key);
    const subs = {};
    for (const sub of axis.subs) {
      const subQuestions = axisQuestions.filter((q) => q.sub === sub.key);
      const qScores = subQuestions.map((q) => {
        const raw = answers[q.id] || 3;
        return q.reverse ? 6 - raw : raw;
      });
      subs[sub.key] = qScores.reduce((a, b) => a + b, 0); // 最大15
    }
    const total = Object.values(subs).reduce((a, b) => a + b, 0); // 最大60
    const maxScore = 60;
    result[axis.key] = {
      total,
      max: maxScore,
      percentage: Math.round((total / maxScore) * 100),
      subs,
      // 後方互換: 領域チャート・タイプ判定が参照するため残す（将来は領域専用質問に置き換え）
      domainSubs: { ...subs },
      domainTotal: total,
    };
  }
  return result;
}
