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
      { key: 'meaning',     label: 'Meaning（基軸力）',      description: '行動の軸をつくる力' },
      { key: 'mindfulness', label: 'Mindfulness（認知力）',  description: '今に意識を向け、変化を受け入れる力' },
      { key: 'mindshift',   label: 'Mindshift（転換力）',    description: '固定観念を手放し、新しい可能性を見出す力' },
      { key: 'mastery',     label: 'Mastery（熟達力）',      description: '実践と反復で学びを定着させる力' },
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
      { key: 'learning',   label: 'Learning（謙学力）',        description: '感情を捨てて事実だけを見る力' },
      { key: 'logical',    label: 'Logical（論理力）',         description: '必要なことだけを伝え、相手を正確に動かす力' },
      { key: 'life',       label: 'Life（活用力）',            description: '精神論を捨て、目に見える結果に変える力' },
      { key: 'leadership', label: 'Leadership（統率力）',      description: 'なれ合いを捨て、一人で結果を出せる人間を作る力' },
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
      { key: 'critical',      label: 'Critical（本質力）',     description: '論理的に見抜く力' },
      { key: 'creativity',    label: 'Creativity（創造力）',   description: '新しいアイデアを生み出す力' },
      { key: 'communication', label: 'Communication（伝達力）', description: '考えを伝え共感を得る力' },
      { key: 'collaboration', label: 'Collaboration（協働力）', description: '多様な人と協働する力' },
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
      { key: 'idea',           label: 'Idea（構想力）',        description: '熱狂できるテーマを見出す力' },
      { key: 'innovation',     label: 'Innovation（変革力）',  description: '知識と技能を形にする力' },
      { key: 'implementation', label: 'Implementation（実装力）', description: '社会に実装する力' },
      { key: 'influence',      label: 'Influence（影響力）',   description: '変化を広げ文化として根づかせる力' },
    ],
  },
];

export const UAAM_QUESTIONS = [
  // ━━━ 志 -MindSet- (4M) ━━━

  // ① Meaning（基軸力）：行動の軸をつくる力
  { id: 1,  axis: 'mindset', sub: 'meaning',     text: '今日の行動の多くが、自分の在り方（人生の目的）を起点に選べている。', reverse: false },
  { id: 2,  axis: 'mindset', sub: 'meaning',     text: '目的より、いつもの癖や流れで動くことが多い。', reverse: true },
  { id: 3,  axis: 'mindset', sub: 'meaning',     text: '損得や感情より先に、自分が大切にしている在り方を基準にして選択できている。', reverse: false },
  { id: 4,  axis: 'mindset', sub: 'meaning',     text: '関わりのある人から、目的を持って生きている人だと感じ取られている。', reverse: false },

  // ② Mindfulness（認知力）：今に意識を向け、変化を受け入れる力
  { id: 5,  axis: 'mindset', sub: 'mindfulness',  text: '防衛反応が出たときに気づき、本来の自分のあり方と行動に立ち戻ることが多い。', reverse: false },
  { id: 6,  axis: 'mindset', sub: 'mindfulness',  text: '感情的に反応したまま、その状態を一日中引きずってしまうことがある。', reverse: true },
  { id: 7,  axis: 'mindset', sub: 'mindfulness',  text: '急な変化があっても、文句や不安より先に「じゃあどうするか」に意識が向く。', reverse: false },
  { id: 8,  axis: 'mindset', sub: 'mindfulness',  text: '周囲の人が、自分との対話を通じて「見えていなかった自分」に気づき始めている。', reverse: false },

  // ③ Mindshift（転換力）：固定観念を手放し、新しい可能性を見出す力
  { id: 9,  axis: 'mindset', sub: 'mindshift',    text: '「自分にはどうせ無理」という声が出たとき、それを事実として扱わずにいられる。', reverse: false },
  { id: 10, axis: 'mindset', sub: 'mindshift',    text: '望ましいあり方がわかっていても、つい防衛的な反応で動いてしまうことがある。', reverse: true },
  { id: 11, axis: 'mindset', sub: 'mindshift',    text: '新しいものを生み出すために、あえて今までのやり方を手放すことがある。', reverse: false },
  { id: 12, axis: 'mindset', sub: 'mindshift',    text: '行き詰まった場面で、思考の突破口を求めて最初に相談される立場にいる。', reverse: false },

  // ④ Mastery（熟達力）：実践と反復で学びを定着させる力
  { id: 13, axis: 'mindset', sub: 'mastery',      text: '学んだことを、夢に向けた日々の行動に落とし込み、成果につなげられている。', reverse: false },
  { id: 14, axis: 'mindset', sub: 'mastery',      text: '実践しようと決めたことが、気づけば他の優先事項に埋もれてしまうことがある。', reverse: true },
  { id: 15, axis: 'mindset', sub: 'mastery',      text: '意識せず自然にした行動であっても、誰かにプラスの影響を与えている。', reverse: false },
  { id: 16, axis: 'mindset', sub: 'mastery',      text: '自分のやり方や考え方を、周囲が自発的に取り入れている。', reverse: false },

  // ━━━ 知 -Literacy- (4L) ━━━

  // ⑤ Learning（謙学力）：感情を捨てて事実だけを見る力
  { id: 17, axis: 'literacy', sub: 'learning',    text: '新しい学びに触れるとき、先入観を除いて学ぶ意識がある。', reverse: false },
  { id: 18, axis: 'literacy', sub: 'learning',    text: '人から聞いたことや学んだことを、そのまま受け売りで使ってしまうことがある。', reverse: true },
  { id: 19, axis: 'literacy', sub: 'learning',    text: '学んでも忘却しては意味がないので、必ず自分に落とし込むための行動をする。', reverse: false },
  { id: 20, axis: 'literacy', sub: 'learning',    text: '学び方そのものについて、周囲から継続的に質問や相談が寄せられている。', reverse: false },

  // ⑥ Logical（論理力）：必要なことだけを伝え、相手を正確に動かす力
  { id: 21, axis: 'literacy', sub: 'logical',     text: '目的に応じて、論理で伝えるかストーリーで伝えるかを使い分けることが習慣になっている。', reverse: false },
  { id: 22, axis: 'literacy', sub: 'logical',     text: '相手に合わせすぎたり、情報を詰め込みすぎたりして、かえって要点がぼやけてしまうことがある。', reverse: true },
  { id: 23, axis: 'literacy', sub: 'logical',     text: '自分が出した指示や依頼は、相手が追加の確認をほとんど必要とせず動ける形で伝えられている。', reverse: false },
  { id: 24, axis: 'literacy', sub: 'logical',     text: '自分が説明した後に、相手の表情や行動が明確に変わる場面が繰り返されている。', reverse: false },

  // ⑦ Life（活用力）：精神論を捨て、目に見える結果に変える力
  { id: 25, axis: 'literacy', sub: 'life',        text: '学んだことを、実際の現場や日常で試してみる行動を自然と繰り返している。', reverse: false },
  { id: 26, axis: 'literacy', sub: 'life',        text: '学んだ知識を溜め込むばかりで、現場のやり方は今までどおりのままになっていることがある。', reverse: true },
  { id: 27, axis: 'literacy', sub: 'life',        text: '自分が学んだことが、具体的な現場の成果や変化として現れている。', reverse: false },
  { id: 28, axis: 'literacy', sub: 'life',        text: '理論を現場に落とし込む役割として、周囲から自然と頼りにされている。', reverse: false },

  // ⑧ Leadership（統率力）：なれ合いを捨て、一人で結果を出せる人間を作る力
  { id: 29, axis: 'literacy', sub: 'leadership',  text: 'チームや周囲の人が、自分の目的・方向性を理解した上で動いている状態を作れている。', reverse: false },
  { id: 30, axis: 'literacy', sub: 'leadership',  text: '自分が方向性を示しても、周囲が様子見のまま動き出すのに時間がかかることがある。', reverse: true },
  { id: 31, axis: 'literacy', sub: 'leadership',  text: 'チーム内の人間関係の摩擦をチャンスに変え、関係を築くことができる。', reverse: false },
  { id: 32, axis: 'literacy', sub: 'leadership',  text: '自分が関わることで、チーム全体の方向性が定まり、各メンバーの動きに一貫性が生まれている。', reverse: false },

  // ━━━ 技 -Competency- (4C) ━━━

  // ⑨ Critical（本質力）：論理的に見抜く力
  { id: 33, axis: 'competency', sub: 'critical',      text: '自分の判断について、根拠と仮説を分けて整理しながら説明できている。', reverse: false },
  { id: 34, axis: 'competency', sub: 'critical',      text: '先にネガティブな結論を決めてしまい、その結論に合う理由ばかりを後から集めてしまうことがある。', reverse: true },
  { id: 35, axis: 'competency', sub: 'critical',      text: '周囲が見落としていた論点や本質を、自分が先に整理して言葉にすることがある。', reverse: false },
  { id: 36, axis: 'competency', sub: 'critical',      text: '企画や計画の穴を見つける場面で、自分への検証依頼が真っ先に来ている。', reverse: false },

  // ⑩ Creativity（創造力）：新しいアイデアを生み出す力
  { id: 37, axis: 'competency', sub: 'creativity',    text: '問題を解決するとき、自分の専門外からもヒントを取り入れている。', reverse: false },
  { id: 38, axis: 'competency', sub: 'creativity',    text: '新しい発想が必要でも、過去にうまくいったやり方に頼ってしまうことがある。', reverse: true },
  { id: 39, axis: 'competency', sub: 'creativity',    text: '一見関係のない要素を組み合わせて、新しいアイデアや形を生み出すことがある。', reverse: false },
  { id: 40, axis: 'competency', sub: 'creativity',    text: '突破口が見えない状況で、自分の発想を起点にチームが実際に動き出している。', reverse: false },

  // ⑪ Communication（伝達力）：考えを伝え共感を得る力
  { id: 41, axis: 'competency', sub: 'communication', text: '自分の伝え方によって、相手の理解が深まったり、行動が変わったりすることが続いている。', reverse: false },
  { id: 42, axis: 'competency', sub: 'communication', text: '伝えたいことを一方的に話してしまい、相手がどう受け取ったかの確認が後回しになることがある。', reverse: true },
  { id: 43, axis: 'competency', sub: 'communication', text: '動く意志のある相手に対して、自分の言葉をきっかけに、相手が自発的に動き出す場面が繰り返しある。', reverse: false },
  { id: 44, axis: 'competency', sub: 'communication', text: '大切な話を誰かに届ける場面で、伝え手として自分が選ばれている。', reverse: false },

  // ⑫ Collaboration（協働力）：多様な人と協働する力
  { id: 45, axis: 'competency', sub: 'collaboration', text: '年齢・立場・専門の異なる人とも、目的を共有しながら協力して成果につなげている。', reverse: false },
  { id: 46, axis: 'competency', sub: 'collaboration', text: '自分と価値観や進め方が違う相手とは、お互いに距離を置いたまま終わることがある。', reverse: true },
  { id: 47, axis: 'competency', sub: 'collaboration', text: '自分一人では出せなかった成果を、他者との協働によって実際に生み出せている。', reverse: false },
  { id: 48, axis: 'competency', sub: 'collaboration', text: '対立や分断が起きた場面で、自分が間に入ることで関係が実際に修復されている。', reverse: false },

  // ━━━ 衝 -Impact- (4I) ━━━

  // ⑬ Idea（構想力）：熱狂できるテーマを見出す力
  { id: 49, axis: 'impact', sub: 'idea',           text: '他人の評価とは無関係に、強くエネルギーを注げる対象が明確にある。', reverse: false },
  { id: 50, axis: 'impact', sub: 'idea',           text: '力を注ぐ対象がころころ変わり、目先の出来事に振り回されてエネルギーが分散してしまうことがある。', reverse: true },
  { id: 51, axis: 'impact', sub: 'idea',           text: 'まだ世の中にないものを、ゼロから自分の手で立ち上げることがある。', reverse: false },
  { id: 52, axis: 'impact', sub: 'idea',           text: '自分が関わることで、それまで停滞していたプロジェクトや取り組みが前に進んでいる。', reverse: false },

  // ⑭ Innovation（変革力）：知識と技能を形にする力
  { id: 53, axis: 'impact', sub: 'innovation',     text: '既存のやり方に限界を感じたとき、それを壊して新しい形を作ることができている。', reverse: false },
  { id: 54, axis: 'impact', sub: 'innovation',     text: '問題があるとわかっていても、慣れたやり方にしがみついて現状維持を選んでしまうことがある。', reverse: true },
  { id: 55, axis: 'impact', sub: 'innovation',     text: '自分が変えた仕組みや方法が、周囲から「以前より格段によくなった」と評価されている。', reverse: false },
  { id: 56, axis: 'impact', sub: 'innovation',     text: '古い枠組みを壊して再構築する役割が、周囲から自然と自分に集まっている。', reverse: false },

  // ⑮ Implementation（実装力）：社会に実装する力
  { id: 57, axis: 'impact', sub: 'implementation', text: '自分が生み出したものを自己満足で終わらせず、実際に使われる形まで落とし込んでいる。', reverse: false },
  { id: 58, axis: 'impact', sub: 'implementation', text: '形にしたことで満足し、そこから先の実用化が後回しになってしまうことがある。', reverse: true },
  { id: 59, axis: 'impact', sub: 'implementation', text: 'やると決めたことを、最後までやり抜き、実際に機能する状態まで仕上げることができている。', reverse: false },
  { id: 60, axis: 'impact', sub: 'implementation', text: '自分に託された仕事は確実に形になるという信頼が、周囲の行動に表れている。', reverse: false },

  // ⑯ Influence（影響力）：変化を広げ文化として根づかせる力
  { id: 61, axis: 'impact', sub: 'influence',      text: '自分が関わった場所では、自分の考え方や取り組みが、組織や場の文化として根づいている。', reverse: false },
  { id: 62, axis: 'impact', sub: 'influence',      text: '自分の言葉や関わりが、相手にとってはその場限りの出来事で終わってしまうことがある。', reverse: true },
  { id: 63, axis: 'impact', sub: 'influence',      text: '自分の存在が、関わった人たちの生き方や選択に、長期的な変化を生み出し続けている。', reverse: false },
  { id: 64, axis: 'impact', sub: 'influence',      text: '自分と関わった人たちの生き方や選択が、出会いの前と後で実際に変化し続けている。', reverse: false },
];

/**
 * 妥当性チェック項目（V問）
 * スコア計算には含めない。バイアス検出・一貫性チェック用。
 * シャッフル時に通常問と混ぜて配置する。
 *
 * 【設計思想】
 * 64問とは「異質な次元」—— 行動・成果ではなくメタ認知を問う。
 * 正直な回答者は自然に3〜5をつける。
 * raw 1（全く当てはまらない）= 盲点ゼロ宣言 = インフレ信号（🏴🏴）
 * raw 2（あまり当てはまらない）= 軽微傾向（🏴）
 *
 * V1：自己認知の盲点
 * V2：他者評価とのズレ認識
 * V3：やり方の限界認識
 */
export const VALIDITY_QUESTIONS = [
  { id: 'V1', text: '自分でも気づいていない思い込みや盲点が、まだあると思っている。', type: 'inflation', reverse: true },
  { id: 'V2', text: '自分への評価と、周囲からの評価が、完全には一致していないと感じることがある。', type: 'inflation', reverse: true },
  { id: 'V3', text: '自分のやり方が通じない相手や状況が、確実に存在する。', type: 'consistency', reverse: true },
];

/**
 * V問フラグ計算（raw スコアから🏴/🏴🏴を判定）
 * @param {Object} vAnswers - { V1: score, V2: score, V3: score }
 * @returns {Object} - { flags: {V1,V2,V3}, totalPts, level }
 *
 * 判定ルール（全V問共通）:
 *   raw 1 → 🏴🏴（critical: 2pt）
 *   raw 2 → 🏴（warning: 1pt）
 *   raw 3〜5 → フラグなし（0pt）
 *
 * 合計ポイントによる6段階レベル:
 *   0pt → Lv.1 / 1pt → Lv.2 / 2pt → Lv.3
 *   3pt → Lv.4 / 4〜5pt → Lv.5 / 6pt → Lv.6
 *
 * @deprecated 2026-05より calculateBiasMessage() に移行。
 * 新規のバイアス評価は calculateBiasMessage() を使うこと。
 * Lv.1〜Lv.6 表記は廃止予定。下位互換のためフラグ計算ロジックは残置。
 */
export function getVFlags(vAnswers) {
  const flags = {};
  let totalPts = 0;
  ['V1', 'V2', 'V3'].forEach((id) => {
    const raw = vAnswers?.[id];
    if (raw === 1) { flags[id] = 'critical'; totalPts += 2; }
    else if (raw === 2) { flags[id] = 'warning'; totalPts += 1; }
    else { flags[id] = 'none'; }
  });
  let level;
  if (totalPts === 0) level = 1;
  else if (totalPts === 1) level = 2;
  else if (totalPts === 2) level = 3;
  else if (totalPts === 3) level = 4;
  else if (totalPts <= 5) level = 5;
  else level = 6;
  return { flags, totalPts, level };
}

/**
 * 妥当性チェックの判定ロジック
 * @param {Object} vAnswers - V問の回答 { V1: score, V2: score, V3: score }
 * @param {Object} mainAnswers - 本問の回答 { questionId: score }（後方互換のため残す）
 * @returns {Object} - フラグ情報
 *
 * @deprecated 2026-05より calculateBiasMessage() に移行。
 * Lv.1〜Lv.6 表記は廃止。新規実装は calculateBiasMessage() を使うこと。
 */
export function checkValidity(vAnswers, mainAnswers) {
  const { flags: vFlags, totalPts, level } = getVFlags(vAnswers);
  const flags = [];

  if (level >= 6) {
    flags.push({
      level: 'critical',
      type: 'inflation_strong',
      message: '客観視の精度に課題',
      detail: 'V1・V2・V3すべて最低評価。コーチング介入を強く推奨します。',
    });
  } else if (level >= 5) {
    flags.push({
      level: 'critical',
      type: 'inflation_strong',
      message: '自己評価インフレ傾向強',
      detail: `合計${totalPts}pt。結果の解釈に補正が必要な可能性があります。`,
    });
  } else if (level >= 4) {
    flags.push({
      level: 'warning',
      type: 'inflation',
      message: '自己評価に歪みの可能性',
      detail: `合計${totalPts}pt。客観視をコーチングテーマとして扱うことを推奨します。`,
    });
  } else if (level >= 2) {
    flags.push({
      level: 'info',
      type: 'mild',
      message: 'わずかな傾向あり',
      detail: `合計${totalPts}pt。参考程度に留意してください。`,
    });
  }

  return {
    hasFlags: flags.length > 0,
    flags,
    vFlags,
    totalPts,
    level,
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

/**
 * 自己評価バイアスメッセージ生成（旗カウント・45-95%版）
 *
 * 旧 Lv.1〜Lv.6 表記を廃止し、3段階バイアス% に切り替えた新 API。
 *
 * 【設計】
 * V問の旗カウント方式：
 *   raw 5,4,3 → 0旗（健全）
 *   raw 2     → 1旗（warning）
 *   raw 1     → 2旗（critical）
 *   3問 × 最大2旗 = Max 6旗
 *
 * 旗数 → バイアス% 固定テーブル（線形補間ではない）：
 *   0 → null（健全・表示なし）
 *   1 → 45%（軽度・黄）
 *   2 → 55%（軽度・黄）
 *   3 → 65%（中度・橙）
 *   4 → 75%（中度・橙）
 *   5 → 86%（強度・赤）
 *   6 → 95%（強度・赤）
 *
 * 強度（旗5-6個）／中度+高totalPctの場合、totalPct と組み合わせて3分岐：
 *   totalPct >= 95 → 真の天地型（高段階解釈）
 *   totalPct >= 78 → L5-L6 移行期（移行期解釈）
 *   totalPct <  78 → 強インフレ警告
 *
 * @param {Object} vAnswers - { V1, V2, V3 } raw値（1-5）
 * @param {number} totalPct - 総合% (0-100)
 * @returns {Object|null} - null なら健全（表示なし）、それ以外はバイアス情報オブジェクト
 */
export function calculateBiasMessage(vAnswers, totalPct) {
  // フォールバック：vAnswersが無い場合は健全扱い
  if (!vAnswers || typeof vAnswers !== 'object') return null;

  // 各V問の旗数
  const flagsPerQ = ['V1', 'V2', 'V3'].map((id) => {
    const raw = vAnswers[id];
    if (raw === 1) return 2; // critical = 2旗
    if (raw === 2) return 1; // warning = 1旗
    return 0;
  });

  const flagsCount = flagsPerQ.reduce((a, b) => a + b, 0);

  // 健全 → null（表示なし）
  if (flagsCount === 0) return null;

  // 旗数 → バイアス% 変換テーブル（ハル指定の固定値）
  const BIAS_TABLE = { 1: 45, 2: 55, 3: 65, 4: 75, 5: 86, 6: 95 };
  const biasPct = BIAS_TABLE[flagsCount];

  const activeFlags = ['V1', 'V2', 'V3'].filter((_, i) => flagsPerQ[i] > 0);
  const criticalFlags = ['V1', 'V2', 'V3'].filter((_, i) => flagsPerQ[i] === 2);

  // 段階分類
  let stage, color;
  if (flagsCount <= 2) { stage = 'mild'; color = 'yellow'; }
  else if (flagsCount <= 4) { stage = 'moderate'; color = 'orange'; }
  else { stage = 'strong'; color = 'red'; }

  // 軽度（45-55%）
  if (stage === 'mild') {
    const focus = activeFlags[0];
    const focusMessage = {
      V1: '盲点を意識する習慣を持つことで、さらに深まります',
      V2: '他者からのフィードバックを定期的に取り入れる習慣を',
      V3: '他のやり方も試してみる柔軟性を持つと、可能性が広がります',
    }[focus] || '軽微なバイアス傾向。日常の小さな実践で十分整います。';

    return {
      biasPct,
      level: stage,
      color,
      title: `自己評価バイアス：${biasPct}%（軽度）`,
      message: focusMessage,
      activeFlags,
    };
  }

  // 中度（65-75%）
  if (stage === 'moderate') {
    // 数字95%以上 + 中度 → 高段階解釈
    if (totalPct >= 95) {
      return {
        biasPct,
        level: 'high_stage',
        color: 'red',
        title: `自己評価バイアス：${biasPct}%（高段階解釈）`,
        message: `数字（${totalPct}%）が L7 圏 ＋ フラグ ＝ 高段階到達の証拠。「自分には盲点がほぼない」という感覚は、本物の自己客観視を超えた状態を示しています。`,
        pattern: '真の天地型',
        action: 'コーチによる外部観察での確認を推奨',
        activeFlags,
      };
    }

    // 数字78-94% → 移行期
    if (totalPct >= 78) {
      return {
        biasPct,
        level: 'transition',
        color: 'red',
        title: `自己評価バイアス：${biasPct}%（移行期解釈）`,
        message: `数字（${totalPct}%）は L5-L6 圏。フラグは 2通りの解釈：① 真の高段階への移行 ② 自己評価が実態より高い可能性。`,
        pattern: 'L5-L6 移行期',
        action: 'コーチによる外部観察での確認が必須',
        activeFlags,
      };
    }

    // 通常の中度
    const combo = activeFlags.slice().sort().join('+');
    const baseMessage = {
      'V1+V2': '内省と他者理解の両方を意識する時期',
      'V1+V3': '盲点と硬直化を見直す時期',
      'V2+V3': '他者FBと柔軟性を再構築する時期',
      'V1+V2+V3': '3軸すべてに目を向ける時期',
    }[combo] || '客観視の精度向上をテーマに';

    return {
      biasPct,
      level: stage,
      color,
      title: `自己評価バイアス：${biasPct}%（中度）`,
      message: baseMessage,
      action: '30日間の客観視ワーク：週１回、信頼できる人にFBを求める',
      activeFlags,
      criticalFlags,
    };
  }

  // 強度（86-95%）── 数字連動で3分岐
  if (totalPct >= 95) {
    return {
      biasPct,
      level: 'high_stage',
      color: 'red',
      title: `自己評価バイアス：${biasPct}%（高段階解釈）`,
      message: `数字（${totalPct}%）が L7 圏 ＋ 強度フラグ ＝ 高段階到達の証拠。`,
      pattern: '真の天地型',
      action: 'コーチによる外部観察での確認を推奨',
      activeFlags,
    };
  }

  if (totalPct >= 78) {
    return {
      biasPct,
      level: 'transition',
      color: 'red',
      title: `自己評価バイアス：${biasPct}%（移行期解釈）`,
      message: `数字（${totalPct}%）は L5-L6 圏。① 真の高段階への移行 ② 自己評価が実態より高い可能性。`,
      pattern: 'L5-L6 移行期',
      action: 'コーチによる外部観察での確認が必須',
      activeFlags,
    };
  }

  return {
    biasPct,
    level: stage,
    color,
    title: `自己評価バイアス：${biasPct}%（強度）`,
    message: `数字（${totalPct}%）に対して、客観視の精度に大きな課題。3つの盲点を全方位で抱えています。`,
    pattern: '強インフレ警告',
    action: 'コーチング介入を強く推奨。最初の課題は「謙虚さ」の獲得',
    activeFlags,
  };
}

/* ============================================================
 * Phase 2：人格L＋リーダー段階の自動推定
 *
 * 設計：
 *   - ページ4「判定式」の閾値テーブルを忠実に実装
 *   - 「推定」と「コーチ確定」を分離（confidence で表現）
 *   - 数字だけでは完全自動判定不可能 → 信頼度シグナルで補正
 * ============================================================ */

/**
 * 人格発達レベル推定（L1〜L7）
 * @param {number} totalPct - 総合% (0-100)
 * @param {number} minAxisPct - 最小軸% (0-100)
 * @returns {Object} { level, name, confidence }
 */
export function determinePersonalityLevel(totalPct, minAxisPct) {
  // L7: 天地型 — 95%以上 + 軸バランス
  if (totalPct >= 95 && minAxisPct >= 75) {
    return { level: 'L7', name: '天地型', confidence: 'high' };
  }
  // L6: 共鳴型 — 88%以上 + バランス
  if (totalPct >= 88 && minAxisPct >= 70) {
    return { level: 'L6', name: '共鳴型', confidence: 'medium' };
  }
  // L5: 統合型 — 78%以上
  if (totalPct >= 78) {
    return { level: 'L5', name: '統合型', confidence: 'medium' };
  }
  // L4: 自律型 — 65%以上
  if (totalPct >= 65) {
    return { level: 'L4', name: '自律型', confidence: 'medium' };
  }
  // L3: 適応型 — 55%以上
  if (totalPct >= 55) {
    return { level: 'L3', name: '適応型', confidence: 'medium' };
  }
  // L2: 取引型 — 40%以上
  if (totalPct >= 40) {
    return { level: 'L2', name: '取引型', confidence: 'medium' };
  }
  // L1: 反応型
  return { level: 'L1', name: '反応型', confidence: 'medium' };
}

/**
 * リーダーシップ段階推定（第1〜第7）
 * @param {number} totalPct - 総合% (0-100)
 * @param {number} minAxisPct - 最小軸% (0-100)
 * @returns {Object} { stage, name }
 */
export function determineLeadershipStage(totalPct, minAxisPct) {
  if (totalPct >= 95 && minAxisPct >= 75) return { stage: 7, name: '天導' };
  if (totalPct >= 88 && minAxisPct >= 70) return { stage: 6, name: '総導' };
  if (totalPct >= 78) return { stage: 5, name: '他導' };
  if (totalPct >= 68) return { stage: 4, name: '自導' };
  if (totalPct >= 58) return { stage: 3, name: '自律' };
  if (totalPct >= 48) return { stage: 2, name: '自立' };
  return { stage: 1, name: '自発' };
}

/**
 * 推定の信頼度を再評価（バイアス・軸偏りで降格）
 *
 * 信頼度シグナル：
 *   - V問でフラグ多い（バイアス強度）→ 推定インフレの可能性
 *   - 軸偏り大（最大-最小≧18ptなど）→ ADHD型疑い
 *   - 旗が3個以上 → コーチ観察推奨
 *
 * @param {Object} baseEstimate - determinePersonalityLevel の戻り値
 * @param {Object} biasMessage - calculateBiasMessage の戻り値（null OK）
 * @param {number} axisSpread - 最大軸% - 最小軸%
 * @returns {Object} { ...baseEstimate, confidence, signals: [...] }
 */
export function assessConfidence(baseEstimate, biasMessage, axisSpread) {
  const signals = [];
  let confidence = baseEstimate.confidence;

  if (biasMessage) {
    if (biasMessage.level === 'transition') {
      signals.push('bias_transition'); // L5-L6 移行期
    } else if (biasMessage.level === 'high_stage') {
      signals.push('bias_high_stage'); // 真の天地型
    } else if (biasMessage.level === 'strong') {
      signals.push('bias_inflation'); // 強インフレ警告
      confidence = 'low';
    } else if (biasMessage.level === 'moderate') {
      signals.push('bias_moderate');
      if (confidence === 'high') confidence = 'medium';
    }
  }

  if (axisSpread >= 18) {
    signals.push('axis_imbalance'); // ADHD型疑い
    if (confidence === 'high') confidence = 'medium';
  }

  return {
    ...baseEstimate,
    confidence,
    signals,
  };
}

/**
 * scores オブジェクトから 4軸の totalPct / 最小軸% / 軸スプレッドを抽出するヘルパー
 * @param {Object} scores - calculateScores の戻り値
 * @returns {Object} { totalPct, minAxisPct, maxAxisPct, axisSpread }
 */
export function extractAxisStats(scores) {
  if (!scores) return { totalPct: 0, minAxisPct: 0, maxAxisPct: 0, axisSpread: 0 };
  const axes = ['mindset', 'literacy', 'competency', 'impact'];
  const pcts = axes.map((a) => scores[a]?.percentage ?? 0);
  const totals = axes.map((a) => scores[a]?.total ?? 0);
  const totalPct = Math.round(totals.reduce((s, v) => s + v, 0) / 320 * 100);
  const minAxisPct = Math.min(...pcts);
  const maxAxisPct = Math.max(...pcts);
  return { totalPct, minAxisPct, maxAxisPct, axisSpread: maxAxisPct - minAxisPct };
}

/* ============================================================
 * Phase 3：3要素診断（リーダーシップ／チームビルディング／マネジメント）
 *
 * 設計思想（Notion ページ6）：
 *   - 4軸（志知技衝）はすべての要素に関わる。分配ではなく、コアペアを選ぶ。
 *   - 各要素のコア15ペア（重複なし）に対する才覚出現回数を重み係数とする。
 *   - 16才覚スコアの加重平均で 0-100 の3要素スコアを算出。
 * ============================================================ */

/**
 * 各要素 × 16才覚 の重み係数（コア15ペアでの出現回数）
 * Notion ページ6 の「16才覚のコアセット反映」に準拠
 */
export const ELEMENT_WEIGHTS = {
  // リーダーシップ（人を動かす力）
  // 主軸：志＋衝（在り方×突破）
  leadership: {
    meaning: 4, mindfulness: 0, mindshift: 1, mastery: 2,        // 志=7
    learning: 0, logical: 1, life: 0, leadership: 3,             // 知=4
    critical: 3, creativity: 1, communication: 2, collaboration: 0, // 技=6
    idea: 4, innovation: 4, implementation: 1, influence: 8,     // 衝=17 ★最多
  },
  // チームビルディング（人と人を結ぶ力）
  // 主軸：知＋技（紡ぐ×人と人をつなぐ）
  teamBuilding: {
    meaning: 2, mindfulness: 3, mindshift: 0, mastery: 0,        // 志=5
    learning: 2, logical: 0, life: 1, leadership: 6,             // 知=9
    critical: 1, creativity: 2, communication: 2, collaboration: 9, // 技=14 ★最多
    idea: 1, innovation: 1, implementation: 0, influence: 1,     // 衝=3
  },
  // マネジメント（ものごとを回す力）
  // 主軸：知＋衝（論理×実装×統合）
  management: {
    meaning: 1, mindfulness: 2, mindshift: 1, mastery: 2,        // 志=6
    learning: 1, logical: 6, life: 3, leadership: 4,             // 知=14 ★最多
    critical: 3, creativity: 1, communication: 0, collaboration: 1, // 技=5
    idea: 1, innovation: 1, implementation: 8, influence: 0,     // 衝=10
  },
};

/**
 * 16才覚スコアから 3要素スコアを算出
 * @param {Object} subs - { meaning, mindfulness, ..., influence } 各 0-20
 * @returns {Object} { leadership, teamBuilding, management } 各 0-100
 */
export function calculateThreeElementScores(subs) {
  if (!subs) return { leadership: 0, teamBuilding: 0, management: 0 };
  const compute = (weights) => {
    let sum = 0;
    let totalWeight = 0;
    for (const [key, w] of Object.entries(weights)) {
      sum += w * (subs[key] || 0);
      totalWeight += w;
    }
    if (totalWeight === 0) return 0;
    return Math.round((sum / totalWeight / 20) * 100);
  };
  return {
    leadership:   compute(ELEMENT_WEIGHTS.leadership),
    teamBuilding: compute(ELEMENT_WEIGHTS.teamBuilding),
    management:   compute(ELEMENT_WEIGHTS.management),
  };
}

/**
 * 16才覚の日本語ラベル
 */
export const SUB_LABELS_JP = {
  meaning: '基軸力', mindfulness: '認知力', mindshift: '転換力', mastery: '熟達力',
  learning: '謙学力', logical: '論理力', life: '活用力', leadership: '統率力',
  critical: '本質力', creativity: '創造力', communication: '伝達力', collaboration: '協働力',
  idea: '構想力', innovation: '変革力', implementation: '実装力', influence: '影響力',
};

/**
 * 16才覚を志知技衝の4軸どこに属するかのマップ
 */
export const SUB_TO_AXIS = {
  meaning: '志', mindfulness: '志', mindshift: '志', mastery: '志',
  learning: '知', logical: '知', life: '知', leadership: '知',
  critical: '技', creativity: '技', communication: '技', collaboration: '技',
  idea: '衝', innovation: '衝', implementation: '衝', influence: '衝',
};

/**
 * 各要素の中で「立ってる才覚（強み）」と「弱い才覚（補強すべき）」を抽出
 *
 * その要素の重要才覚（重み2以上）の中から：
 * - 立ってる：個人スコア（subs[k]）が高い順に上位 n 個
 * - 弱い：個人スコアが低い順に上位 n 個（重要才覚の中での弱者）
 *
 * @param {Object} subs - { meaning: 0-20, ..., influence: 0-20 } 各才覚スコア
 * @param {Object} weights - ELEMENT_WEIGHTS[elementKey]（その要素の重み係数）
 * @param {number} [topN=2] - 抽出する個数
 * @returns {Object} { standing: [{key,jp,axis,weight,score}], weak: [...] }
 */
export function extractElementTalents(subs, weights, topN = 2) {
  if (!subs || !weights) return { standing: [], weak: [] };
  const importantThreshold = 2; // 重み2以上を「重要才覚」とみなす
  const items = Object.entries(weights)
    .filter(([_, w]) => w >= importantThreshold)
    .map(([key, w]) => ({
      key,
      jp: SUB_LABELS_JP[key] || key,
      axis: SUB_TO_AXIS[key] || '',
      weight: w,
      score: subs[key] || 0,
    }));
  const standing = items.slice().sort((a, b) => b.score - a.score).slice(0, topN);
  const weak = items.slice().sort((a, b) => a.score - b.score).slice(0, topN);
  return { standing, weak };
}

/**
 * 段階別に「優先する軸の中で立ってる才覚」を抽出（國創学準拠）
 *
 * 段階別の処方軸：
 *   1-3：全軸（高スコア順）
 *   4：志軸を優先（在り方の核）
 *   5：知＋技軸を優先（人を導く・協働）
 *   6：衝軸を優先（社会へ実装）
 *   7：抽出なし（完成段階・天命を全う）
 *
 * @param {Object} subs - 16才覚スコア
 * @param {Object} weights - ELEMENT_WEIGHTS[elementKey]
 * @param {number} stage - リーダー段階 1〜7
 * @param {number} [topN=2]
 * @returns {Object} { stage, axisFilter: ['志'|'知'|...], talents: [...], stageLabel, allEmpty }
 */
export function extractStageTargetedTalents(subs, weights, stage, topN = 2) {
  if (!subs || !weights) return { stage, axisFilter: null, talents: [], stageLabel: '', allEmpty: true };

  // 段階7：抽出なし（完成・天命）
  if (stage >= 7) {
    return { stage, axisFilter: null, talents: [], stageLabel: '完成・天命', allEmpty: true };
  }

  // 段階別の優先軸
  let axisFilter, stageLabel;
  if (stage === 4) { axisFilter = ['志']; stageLabel = '志軸（在り方）を徹底'; }
  else if (stage === 5) { axisFilter = ['知', '技']; stageLabel = '知＋技軸（人を導く）'; }
  else if (stage === 6) { axisFilter = ['衝']; stageLabel = '衝軸（社会へ実装）'; }
  else { axisFilter = null; stageLabel = '才覚を伸ばす'; } // 1-3

  const importantThreshold = 2;
  let items = Object.entries(weights)
    .filter(([_, w]) => w >= importantThreshold)
    .map(([key, w]) => ({
      key,
      jp: SUB_LABELS_JP[key] || key,
      axis: SUB_TO_AXIS[key] || '',
      weight: w,
      score: subs[key] || 0,
    }));

  // 軸フィルタ適用
  if (axisFilter) {
    const filtered = items.filter((t) => axisFilter.includes(t.axis));
    // フィルタ結果が空なら（その要素にはその軸の才覚がない）、フィルタなしにフォールバック
    if (filtered.length > 0) items = filtered;
  }

  const talents = items.slice().sort((a, b) => b.score - a.score).slice(0, topN);
  return { stage, axisFilter, talents, stageLabel, allEmpty: false };
}

/**
 * 段階に応じた処方フェーズを判定
 *
 * 段階別の処方軸（國創学準拠）：
 *   段階1〜3（自発・自立・自律）：全軸の高スコア才覚を伸ばす
 *   段階4（自導）：志軸を伸ばす（在り方の核）
 *   段階5（他導）：知＋技軸を伸ばす（人を導く力）
 *   段階6（総導）：衝軸を伸ばす（社会へ実装）
 *   段階7（天導）：完成・天命を全う（処方なし）
 *
 * @param {Object} leadershipStage - { stage, name }
 * @returns {string} 'foundation' | 'shi' | 'chi_gi' | 'sho' | 'completion'
 */
export function determineDevelopmentPhase(leadershipStage) {
  const stage = leadershipStage?.stage ?? 1;
  if (stage >= 7) return 'completion';
  if (stage === 6) return 'sho';
  if (stage === 5) return 'chi_gi';
  if (stage === 4) return 'shi';
  return 'foundation'; // 1-3
}

/**
 * 要素ごとの段階別処方を生成（國創学準拠）
 *
 * 段階別フェーズ：
 *   foundation（1-3）：才覚を伸ばす
 *   shi（4）：志軸（在り方）を徹底
 *   chi_gi（5）：知＋技軸（人を導く）
 *   sho（6）：衝軸（社会へ実装）
 *   completion（7）：完成・天命を全う（処方なし）
 *
 * @param {string} elementKey - 'leadership' | 'teamBuilding' | 'management'
 * @param {string} phase - 'foundation' | 'shi' | 'chi_gi' | 'sho' | 'completion'
 * @param {Object} subs - 16才覚スコア
 * @param {Object} stageTargeted - extractStageTargetedTalents の戻り値
 * @returns {Object} { phase, action, target, comment }
 */
export function getElementPrescription(elementKey, phase, subs, stageTargeted) {
  const label = ELEMENT_LABELS[elementKey] || { jp: elementKey, short: '' };

  // 完成段階（第7・天導）：処方なし
  if (phase === 'completion') {
    return {
      phase,
      action: null,
      target: [],
      comment: `${label.jp}は完成段階。天命を全う。`,
    };
  }

  const target = stageTargeted?.talents || [];

  // 各フェーズのアクション文言
  const FRAMING = {
    foundation: { verb: '伸ばせ', comment: `${label.jp}を支える中核` },
    shi:        { verb: '徹底せよ', comment: `${label.jp}の在り方の核（志軸）を作る段階` },
    chi_gi:     { verb: '伸ばせ', comment: `${label.jp}で人を導く力（知＋技）` },
    sho:        { verb: '伸ばせ', comment: `${label.jp}を社会へ実装する力（衝軸）` },
  };
  const f = FRAMING[phase] || FRAMING.foundation;

  return {
    phase,
    action: f.verb,
    target,
    comment: f.comment,
  };
}

/**
 * @deprecated 2026-05より要素ごとの独立処方に移行。
 * 主・副・最弱の比較は國創学の処方思想と合わないため廃止。
 * 新規実装は extractElementTalents() / getElementPrescription() を使うこと。
 *
 * 3要素スコアから 主要素・副要素・最弱要素を特定（旧API）
 * @param {Object} threeScores - { leadership, teamBuilding, management }
 * @returns {Object} { primary, primaryScore, secondary, secondaryScore, weakest, weakestScore }
 */
export function identifyElementProfile(threeScores) {
  const entries = Object.entries(threeScores);
  entries.sort((a, b) => b[1] - a[1]);
  return {
    primary: entries[0][0],
    primaryScore: entries[0][1],
    secondary: entries[1][0],
    secondaryScore: entries[1][1],
    weakest: entries[2][0],
    weakestScore: entries[2][1],
  };
}

/**
 * @deprecated 2026-05より要素ごとの独立処方に移行。
 * 「3要素のうち主のものを集中せよ」という比較型の処方思想を廃止。
 * 新規実装は determineDevelopmentPhase() / getElementPrescription() を使うこと。
 *
 * 処方モードを判定（極める／広げる／統合）（旧API）
 * @returns {string} 'focus' | 'expand' | 'integrate'
 */
export function determinePrescriptionMode(threeScores, leadershipStage) {
  const stage = leadershipStage?.stage || 1;
  const profile = identifyElementProfile(threeScores);

  // integrate: 全要素 ≥ 75% または 段階6・7
  if ((threeScores.leadership >= 75 && threeScores.teamBuilding >= 75 && threeScores.management >= 75)
      || stage >= 6) {
    return 'integrate';
  }

  // expand: 主要素 ≥ 70% かつ 副要素 < 60% または 段階5
  if ((profile.primaryScore >= 70 && profile.secondaryScore < 60) || stage === 5) {
    return 'expand';
  }

  // focus: その他
  return 'focus';
}

/**
 * 要素の定義（國創学準拠）
 *
 * 三つの関係性：
 *   リーダーシップ   → 在り方の軸（関数）
 *   マネジメント     → 才覚の設計（変数）
 *   チームビルディング → 関数×変数の統合（一族化）
 */
export const ELEMENT_LABELS = {
  leadership: {
    jp: 'リーダーシップ',
    en: 'Leadership',
    short: '在り方で場を動かす力',
    role: '在り方の軸（関数）',
    essence: '「自分がどう生きるか」が、そのままリーダーシップになっている状態',
    long: '技術でも権力でもない。自分の才覚領域から生きることで、周囲のOSを書き換える存在。役割じゃなく「状態」。ポジションがあるから引っ張るんじゃなく、在り方が定まっているから人が自然と動く。',
    // 朱色：在り方・情熱・人を動かす火
    color: '#B83C3C', colorBg: '#FBEDED', colorText: '#7A2828',
  },
  teamBuilding: {
    jp: 'チームビルディング',
    en: 'Team Building',
    short: '一族が一つの魂で動く状態を創ること',
    role: '関数×変数の統合（一族化）',
    essence: '共に希望に満ちた未来へ一緒に進んでいる状態',
    long: '仲良くでも役割分担でもない。共通の価値観（関数）と各自の才覚（変数）が同時に最大化される場を育てる。組織じゃなく「一族」。在り方で繋がった一族は、どんな嵐でも散らない。',
    // 若草：成長・繋がり・共に進む
    color: '#5C8F5C', colorBg: '#EDF5ED', colorText: '#2E5C2E',
  },
  management: {
    jp: 'マネジメント',
    en: 'Management',
    short: '才覚を最大温度で稼働させる設計力',
    role: '才覚の設計（変数）',
    essence: '内発的動機が最大化される環境の設計者',
    long: '管理でも監視でもない。一人一人の才覚領域を見抜いて、それが一番輝く場に配置する構造を作る。「正しく動かす」じゃなく「自ら動く状態を設計する」。人を動かそうとすれば摩擦が起き、人が動きたくなる場を作れば摩擦が消える。',
    // 藍：設計・論理・冷静な構造
    color: '#3D5A88', colorBg: '#EDF1F7', colorText: '#1F3358',
  },
};

/**
 * @deprecated 2026-05より要素ごとの独立処方に移行。
 * focus/expand/integrate の3モード方式は「3要素を比較する」前提なので廃止。
 * 新規実装は getElementPrescription() を使うこと。
 *
 * モード別の処方文言を生成（旧API・後方互換のため残置）
 * @returns {Object} { mode, headline, coreFocus }
 */
export function getModeAdvice(mode, profile, leadershipStage) {
  const primary = ELEMENT_LABELS[profile.primary] || { jp: profile.primary, short: '' };
  const secondary = ELEMENT_LABELS[profile.secondary] || { jp: profile.secondary, short: '' };

  if (mode === 'focus') {
    return {
      mode,
      headline: `極める ── ${primary.jp}を「型」にする段階`,
      coreFocus: [
        `${primary.jp}は「${primary.short}」。これがあなたの中核`,
        '他2要素は今は気にしなくていい。偏りが、あなたの型を作る',
        '才覚領域から生きる時間を、毎日30分でも積み重ねる',
      ],
    };
  }

  if (mode === 'expand') {
    return {
      mode,
      headline: `広げる ── ${primary.jp}が型になった。次は${secondary.jp}へ`,
      coreFocus: [
        `${primary.jp}は確立。在り方の軸（関数）が定まっている状態`,
        `${secondary.jp}＝「${secondary.short}」を意識的に発動する段階`,
        `${primary.jp} × ${secondary.jp} の交点で、新しい影響圏が広がる`,
      ],
    };
  }

  // integrate モードを段階別に分岐
  const stage = leadershipStage?.stage ?? 5;

  // L7 天地型・第7段階「天導」
  if (stage >= 7) {
    return {
      mode,
      headline: '統合 ── 天地を繋ぐ段階。在り方そのもので、地球が動き出す',
      coreFocus: [
        '3要素の境界はもう存在しない。在り方の一点に統合されている',
        '言葉も行動もいらない。存在の高さが、上方・情報・物理の三空間を貫く',
        '天地を繋ぐ者として、地球を動かす段階（L7 天地型・天導）',
      ],
    };
  }

  // L6 共鳴型・第6段階「総導」
  if (stage === 6) {
    return {
      mode,
      headline: '統合 ── 要素の境界が消える段階。在り方そのものが場を動かす',
      coreFocus: [
        '3要素の境界が消え、状況に応じて在り方そのものが現れる',
        '言葉も行動もいらない。在り方の高さで、一族が一つの魂で動き出す',
        '才覚が社会システムを動かす状態（L6 共鳴型・総導）',
      ],
    };
  }

  // L5 統合型・第5段階「他導」（integrate のデフォルト）
  return {
    mode,
    headline: '統合 ── 3要素が立ち上がった。自分の生き方が、人の才覚を動かし始める段階',
    coreFocus: [
      'リーダーシップ・マネジメント・チームビルディング、3要素すべてが機能している',
      '自分が生きることで、関わる人の才覚が動き出す（L5 統合型・他導の領域）',
      '共通の価値観で繋がる「一族」の輪郭を、ここから育てていく',
    ],
  };
}
