/**
 * UAAM (Universal Ability Assessment Model) 質問データ
 *
 * 4軸 × 4サブ項目 × 4問 = 64問 + 妥当性チェック3問 = 計67問
 * 各問は 1〜5 のリッカート尺度で回答
 * reverse: true の項目はスコア計算時に反転 (6 - score)
 * validity: true の項目はスコア計算に含めない（バイアス検出用）
 *
 * 回答基準：すべての質問は「直近1ヶ月の自分」を基準に回答
 *
 * 各サブカテゴリ4問構成:
 *   Q1（通常）: 自己の行動・習慣に対する自覚
 *   Q2（逆転）: ネガティブ表現 → reverse: true で反転スコア
 *   Q3（通常）: 自己の行動・成果の発現
 *   Q4（通常）: 他者からの評価・認知（外部視点）
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
  { id: 1,  axis: 'mindset', sub: 'meaning',     text: '今日の行動の多くが、SPを起点に選べている。', reverse: false },
  { id: 2,  axis: 'mindset', sub: 'meaning',     text: '目的（SP）より、いつもの癖や流れで動くことが多い。', reverse: true },
  { id: 3,  axis: 'mindset', sub: 'meaning',     text: '損得や感情より先に目的（SP）を基準にして、とるべき選択を選んでいる。', reverse: false },
  { id: 4,  axis: 'mindset', sub: 'meaning',     text: '関わりのある人から、目的を持って生きている人だと感じ取られている。', reverse: false },

  // ② Mindfulness（気づき）：今に意識を向け、変化を受け入れる力
  { id: 5,  axis: 'mindset', sub: 'mindfulness',  text: '防衛反応が出たときに気づき、本来の自分のあり方と行動に立ち戻ることが多い。', reverse: false },
  { id: 6,  axis: 'mindset', sub: 'mindfulness',  text: '感情が動いたとき、その勢いのまま言葉や行動に出ることが多い。', reverse: true },
  { id: 7,  axis: 'mindset', sub: 'mindfulness',  text: '急な変化があっても、文句や不安より先に「じゃあどうするか」に意識が向く。', reverse: false },
  { id: 8,  axis: 'mindset', sub: 'mindfulness',  text: 'あなたと話していると、自分が見えていなかったことに気づく、という反応が周りから返ってくる。', reverse: false },

  // ③ Mindshift（意識転換）：固定観念を手放し、新しい可能性を見出す力
  { id: 9,  axis: 'mindset', sub: 'mindshift',    text: '「自分にはどうせ無理」「自分はそういうタイプじゃない」という声が出たとき、それを事実として扱わずにいられる。', reverse: false },
  { id: 10, axis: 'mindset', sub: 'mindshift',    text: '頭ではわかっていても、慣れ親しんだパターンで反応してしまうことが多い。', reverse: true },
  { id: 11, axis: 'mindset', sub: 'mindshift',    text: '新しいものを生み出すために、あえて今までのやり方を手放すことがある。', reverse: false },
  { id: 12, axis: 'mindset', sub: 'mindshift',    text: '行き詰まった場面で、視点を切り替えるきっかけを求めて相談が集まってくる。', reverse: false },

  // ④ Mastery（熟達）：実践と反復で学びを定着させる力
  { id: 13, axis: 'mindset', sub: 'mastery',      text: '学んだことを、夢（SD）に向けた日々の行動に落とし込み、成果につなげられている。', reverse: false },
  { id: 14, axis: 'mindset', sub: 'mastery',      text: '日常の忙しさの中で、新しく始めたことより慣れた行動を優先しがちだ。', reverse: true },
  { id: 15, axis: 'mindset', sub: 'mastery',      text: '意識せず自然にした行動であっても、誰かにプラスの影響を与えている。', reverse: false },
  { id: 16, axis: 'mindset', sub: 'mastery',      text: '自分の取り組み方や習慣が、周囲の人の参考になっている。', reverse: false },

  // ━━━ 知 -Literacy- (4L) ━━━

  // ⑤ Learning（学習）：感情を捨てて事実だけを見る力
  { id: 17, axis: 'literacy', sub: 'learning',    text: '新しい情報に触れたとき、感情や先入観に引っ張られず、事実を正確に捉えようとしている。', reverse: false },
  { id: 18, axis: 'literacy', sub: 'learning',    text: '学んだことを、まず形だけ取り入れて満足してしまうことがある。', reverse: true },
  { id: 19, axis: 'literacy', sub: 'learning',    text: '同じ情報を見ても、自分は事実をより正確に整理できていると感じることがある。', reverse: false },
  { id: 20, axis: 'literacy', sub: 'learning',    text: '学び方そのものに興味を持たれ、方法を聞かれることが増えている。', reverse: false },

  // ⑥ Logical（論理）：必要なことだけを伝え、相手を正確に動かす力
  { id: 21, axis: 'literacy', sub: 'logical',     text: '目的に応じて、論理で伝えるかストーリーで伝えるかを使い分けることが習慣になっている。', reverse: false },
  { id: 22, axis: 'literacy', sub: 'logical',     text: '伝えたい気持ちが先走り、情報量や言葉数が多くなりがちだ。', reverse: true },
  { id: 23, axis: 'literacy', sub: 'logical',     text: '自分が出した指示や依頼は、相手が追加の確認をほとんど必要とせず動ける形で伝えられている。', reverse: false },
  { id: 24, axis: 'literacy', sub: 'logical',     text: '自分が説明した後に、相手の表情や行動が明らかに変わる場面がある。', reverse: false },

  // ⑦ Life（社会実装）：精神論を捨て、目に見える結果に変える力
  { id: 25, axis: 'literacy', sub: 'life',        text: '学んだことを、まず小さくてもいいから現場で試すことを自分に課している。', reverse: false },
  { id: 26, axis: 'literacy', sub: 'life',        text: '学びの場では理解できても、実際の現場では別の判断軸で動いていることが多い。', reverse: true },
  { id: 27, axis: 'literacy', sub: 'life',        text: '自分の学びの成果は、第三者が見てもわかる数字・期限・成果物として示せている。', reverse: false },
  { id: 28, axis: 'literacy', sub: 'life',        text: '抽象的な概念を現場で使える形にする役回りが、自然と自分に集まっている。', reverse: false },

  // ⑧ Leadership（リーダーシップ）：なれ合いを捨て、一人で結果を出せる人間を作る力
  { id: 29, axis: 'literacy', sub: 'leadership',  text: '相手が自立して結果を出せるように、再現できる形で自分のやり方を渡している。', reverse: false },
  { id: 30, axis: 'literacy', sub: 'leadership',  text: '自分のビジョンを伝えても、周囲の温度感との間にギャップを感じることがある。', reverse: true },
  { id: 31, axis: 'literacy', sub: 'leadership',  text: '自分が教えた相手が、さらに別の相手にも再現できる形で伝え、結果につなげている。', reverse: false },
  { id: 32, axis: 'literacy', sub: 'leadership',  text: '自分がチームに加わると、全体の方向性が自然とまとまり始める手応えがある。', reverse: false },

  // ━━━ 技 -Competency- (4C) ━━━

  // ⑨ Critical Thinking（批判的思考）：論理的に見抜く力
  { id: 33, axis: 'competency', sub: 'critical',      text: '自分の判断について、根拠と仮説を分けて整理しながら説明できている。', reverse: false },
  { id: 34, axis: 'competency', sub: 'critical',      text: '先にネガティブな結論を決めてしまい、その結論に合う理由ばかりを後から集めてしまうことがある。', reverse: true },
  { id: 35, axis: 'competency', sub: 'critical',      text: '周囲が見落としていた論点や本質を、自分が先に整理して言葉にすることがある。', reverse: false },
  { id: 36, axis: 'competency', sub: 'critical',      text: '企画や計画の精度を上げたいとき、チェック役として自分に声がかかる場面がある。', reverse: false },

  // ⑩ Creativity（創造性）：新しいアイデアを生み出す力
  { id: 37, axis: 'competency', sub: 'creativity',    text: '問題を解決するとき、自分の専門外からもヒントを取り入れている。', reverse: false },
  { id: 38, axis: 'competency', sub: 'creativity',    text: '新しい発想が必要でも、過去にうまくいったやり方に頼ってしまうことがある。', reverse: true },
  { id: 39, axis: 'competency', sub: 'creativity',    text: '一見関係のない要素を組み合わせて、新しいアイデアや形を生み出すことがある。', reverse: false },
  { id: 40, axis: 'competency', sub: 'creativity',    text: '行き詰まった状況で、新しい切り口を期待されて声がかかることが増えている。', reverse: false },

  // ⑪ Communication（伝える力）：考えを伝え共感を得る力
  { id: 41, axis: 'competency', sub: 'communication', text: '自分の伝え方によって、相手の理解が深まったり、行動が変わったりすることが続いている。', reverse: false },
  { id: 42, axis: 'competency', sub: 'communication', text: '自分の意図が正確に伝わっていると思ったのに、相手には違う意味で受け取られていたことがある。', reverse: true },
  { id: 43, axis: 'competency', sub: 'communication', text: '動く意志のある相手に対して、自分の言葉をきっかけに、相手が自発的に動き出す場面が繰り返しある。', reverse: false },
  { id: 44, axis: 'competency', sub: 'communication', text: '大事な内容を届けたいとき、伝え手として自分が選ばれる場面がある。', reverse: false },

  // ⑫ Collaboration（協働）：多様な人と協働する力
  { id: 45, axis: 'competency', sub: 'collaboration', text: '年齢・立場・専門の異なる人とも、目的を共有しながら協力して成果につなげている。', reverse: false },
  { id: 46, axis: 'competency', sub: 'collaboration', text: '自分と進め方が異なる相手とは、合わせるより自分のやり方を通すことが多い。', reverse: true },
  { id: 47, axis: 'competency', sub: 'collaboration', text: '自分一人では出せなかった成果を、他者との協働によって実際に生み出せている。', reverse: false },
  { id: 48, axis: 'competency', sub: 'collaboration', text: '意見の対立が起きた場面で、橋渡し役として自然と自分の存在が求められる。', reverse: false },

  // ━━━ 衝 -Impact- (4I) ━━━

  // ⑬ Idea（アイデア）：熱狂できるテーマを見出す力
  { id: 49, axis: 'impact', sub: 'idea',           text: '他人の評価とは無関係に、強くエネルギーを注げる対象が明確にある。', reverse: false },
  { id: 50, axis: 'impact', sub: 'idea',           text: '目の前に面白そうなことがあると、つい手を広げてエネルギーが分散しがちだ。', reverse: true },
  { id: 51, axis: 'impact', sub: 'idea',           text: '誰も手をつけていない領域で、ゼロから形を立ち上げることがある。', reverse: false },
  { id: 52, axis: 'impact', sub: 'idea',           text: '自分が関わり始めると、それまで止まっていたことが動き出す現象が起きている。', reverse: false },

  // ⑭ Innovation（変革）：知識と技能を形にする力
  { id: 53, axis: 'impact', sub: 'innovation',     text: '頭の中の構想を止めたままにせず、見える形や結果として表に出している。', reverse: false },
  { id: 54, axis: 'impact', sub: 'innovation',     text: '構想やアイデアがあっても、試作まで進まないまま時間が過ぎることがある。', reverse: true },
  { id: 55, axis: 'impact', sub: 'innovation',     text: '知識と技術を組み合わせて現実に形を生み出すことが、自然にできている。', reverse: false },
  { id: 56, axis: 'impact', sub: 'innovation',     text: '既存の仕組みを根本から見直す役割が、自然と自分に回ってきている。', reverse: false },

  // ⑮ Implementation（実装）：社会に実装する力
  { id: 57, axis: 'impact', sub: 'implementation', text: '自分が生み出したものを自己満足で終わらせず、実際に使われる形まで落とし込んでいる。', reverse: false },
  { id: 58, axis: 'impact', sub: 'implementation', text: '形にするところまでは得意だが、運用・定着のフェーズは別の人に任せがちだ。', reverse: true },
  { id: 59, axis: 'impact', sub: 'implementation', text: 'やると決めたことを、実際に機能する状態まで粘り強く仕上げている。', reverse: false },
  { id: 60, axis: 'impact', sub: 'implementation', text: '自分に任されたことは、最終的に使える形になって届けられている実感がある。', reverse: false },

  // ⑯ Influence（影響）：変化を広げ文化として根づかせる力
  { id: 61, axis: 'impact', sub: 'influence',      text: '自分が関わった場所では、自分の考え方や姿勢が組織や場の文化として根づいている。', reverse: false },
  { id: 62, axis: 'impact', sub: 'influence',      text: '自分の言葉や関わりがあっても、相手の認識や行動が大きくは変わらないことがある。', reverse: true },
  { id: 63, axis: 'impact', sub: 'influence',      text: '自分が直接関与しなくても、自分が持ち込んだ変化が仕組みやルールとして機能し続けている。', reverse: false },
  { id: 64, axis: 'impact', sub: 'influence',      text: '関わった人から、自分との出会いがきっかけで人生の方向が変わったと伝えられたことがある。', reverse: false },
];

/**
 * 妥当性チェック項目（V問）
 * スコア計算には含めない。バイアス検出・一貫性チェック用。
 * シャッフル時に通常問と混ぜて配置する。
 * reverse: true の項目はスコア解釈時に反転（score 1 = 実質的な高自己評価 = インフレーション信号）
 */
export const VALIDITY_QUESTIONS = [
  { id: 'V1', text: '自分が正しいと思って行動したのに、あとから振り返ると的外れだったことがある。', type: 'inflation', reverse: true },
  { id: 'V2', text: '良かれと思ってやったことが、結果的に誰かの迷惑になっていたことがある。', type: 'inflation', reverse: true },
  { id: 'V3', text: '自分が影響を与えたつもりでいたが、相手にとってはそこまで大きな存在ではなかったと気づいたことがある。', type: 'consistency', reverse: true, compareWith: { questionId: 61 } },
];

/**
 * 妥当性チェックの判定ロジック
 * @param {Object} answers - V問の回答 { V1: score, V2: score, V3: score }
 * @param {Object} mainAnswers - 本問の回答 { questionId: score }
 * @returns {Object} - フラグ情報
 *
 * V1・V2 は reverse: true のため、raw score 1（=「全く当てはまらない」）が
 * 実質的な最高自己評価（ミスを一切認識しない）= インフレーション信号となる。
 */
export function checkValidity(vAnswers, mainAnswers) {
  const flags = [];

  // reverse: true の V 問は有効スコアを反転して評価する（score 1 → effective 5）
  const effectiveV1 = VALIDITY_QUESTIONS.find((v) => v.id === 'V1').reverse
    ? 6 - (vAnswers['V1'] ?? 3)
    : (vAnswers['V1'] ?? 3);
  const effectiveV2 = VALIDITY_QUESTIONS.find((v) => v.id === 'V2').reverse
    ? 6 - (vAnswers['V2'] ?? 3)
    : (vAnswers['V2'] ?? 3);

  const v1is5 = effectiveV1 === 5;
  const v2is5 = effectiveV2 === 5;
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

  // 一貫性検出：V3 と Influence Q1 (id:61) の差が±2以上
  // V3 も reverse: true のため有効スコアで比較する
  const v3Raw = vAnswers['V3'];
  const v3Score = v3Raw != null
    ? (VALIDITY_QUESTIONS.find((v) => v.id === 'V3').reverse ? 6 - v3Raw : v3Raw)
    : null;
  const influenceQ1Score = mainAnswers[61];
  if (v3Score != null && influenceQ1Score != null) {
    const diff = Math.abs(v3Score - influenceQ1Score);
    if (diff >= 2) {
      flags.push({
        level: 'info',
        type: 'consistency',
        message: '回答一貫性にブレあり',
        detail: `V3(有効:${v3Score}) と Influence Q1 id:61(${influenceQ1Score}) の差が${diff}。回答の集中度にばらつきがある可能性があります。`,
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
 * 回答シャッフル用：64問＋V3問を混ぜてランダム配列にする
 * V問は前半・中盤・後半に1問ずつ散らす
 * @returns {Array} - シャッフルされた67問の配列
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
 *   サブカテゴリ最大20（4問×5点）、軸最大80（4サブ×20）
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
      subs[sub.key] = qScores.reduce((a, b) => a + b, 0); // 最大20（4問×5点）
    }
    const total = Object.values(subs).reduce((a, b) => a + b, 0); // 最大80（4サブ×20）
    const maxScore = 80;
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
