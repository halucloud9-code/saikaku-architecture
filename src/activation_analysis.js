/**
 * activation_analysis.js
 * UAAM 発動分析ロジック — v1
 *
 * ルール:
 *   ・4ブロック（志/知/技/衝）から異なるブロックで 発動中TOP2 / 未発動TOP2 を選ぶ
 *   ・合計4項目を1人に渡す
 *   ・AI API不要・ルールベースで完結
 *
 * スコア設計:
 *   1サブカテゴリ = 4問 × 5点 = 20点満点
 *   1軸 = 4サブカテゴリ × 20点 = 80点満点
 *   全体 = 4軸 × 80点 = 320点満点
 *
 * ⚠️ 要確認:
 *   BLOCK_MAP のサブカテゴリ→ブロック対応は仮設計。
 *   設計分析書511行と照合して修正すること。
 */

// =============================================
// 1. ブロック × サブカテゴリ マッピング
// =============================================
// ⚠️ 要確認: 実際のuaam_questions.jsのブロック定義と照合すること
const BLOCK_MAP = {
  根幹力: '志',
  受容力: '志',
  転換力: '志',
  熟達力: '志',
  謙学力: '知',
  論理力: '知',
  活用力: '知',
  統率力: '知',
  本質力: '技',
  創造力: '技',
  伝達力: '技',
  協働力: '技',
  起動力: '衝',
  革新力: '衝',
  実装力: '衝',
  影響力: '衝',
};

// =============================================
// 2. テンプレート定義（16サブカテゴリ）
// =============================================
const TEMPLATES = {
  根幹力: {
    active: {
      message: '自分の判断基準が言語化されているから、状況が変わってもブレずに決断できている。',
      action: 'その判断基準を誰かに伝えて、一致しているか確認してみる',
    },
    sleeping: {
      message: '状況ごとに判断が変わっている。軸がまだ言葉になっていない。',
      action: '次に迷ったとき、「なぜそっちを選ぶのか」を1文で書いてから動く',
    },
  },
  受容力: {
    active: {
      message: '自分と違う意見を、反論せずに情報として受け取れている。',
      action: '反対意見の側に立って、その人の論理を最後まで完成させてみる',
    },
    sleeping: {
      message: '違う意見に出会うと、反論か回避が先に出ている。',
      action: '次に反論したくなったとき、先に相手の言葉をそのまま繰り返してから話す',
    },
  },
  転換力: {
    active: {
      message: '困難な状況を見たとき、問題ではなくチャンスとして捉え返せている。',
      action: '今抱えている課題を、そのまま誰かへの提供価値として言い換えてみる',
    },
    sleeping: {
      message: '問題が来たとき、解決より回避を先に選んでいる。',
      action: '直近の失敗を1つ選んで、そこから得たものだけを書き出す',
    },
  },
  熟達力: {
    active: {
      message: '繰り返すたびに精度が上がっていることを、自分で確認しながら動いている。',
      action: '自分が一番うまくなった領域で、今の限界値を意図的に突いてみる',
    },
    sleeping: {
      message: '同じことを繰り返しているが、上達の実感がない。',
      action: '今日やることを終えた後、昨日と何が変わったかを1行メモする',
    },
  },
  謙学力: {
    active: {
      message: '自分より詳しい人に出会うと、防衛ではなく素直に興味が動いている。',
      action: '最近尊敬した人に、「何を大切にしているか」を直接聞いてみる',
    },
    sleeping: {
      message: '新しいことに触れるとき、防衛反応が先に出ている。',
      action: '今週、自分より若い人から1つ教えてもらう機会を作る',
    },
  },
  論理力: {
    active: {
      message: '話の構造を組み立ててから話しているから、相手が途中で迷わない。',
      action: '次の提案を「結論→理由→証拠→結論」の順で1枚にまとめてみる',
    },
    sleeping: {
      message: '話しながら考えているため、言いたいことより先に言葉が出ている。',
      action: '次に誰かに説明するとき、最初の1文を結論にしてから始める',
    },
  },
  活用力: {
    active: {
      message: '学んだことが、別の場面で自然に使えている。',
      action: '最近学んだことを、全く別の分野に当てはめて考えてみる',
    },
    sleeping: {
      message: '知識は持っているが、行動に繋げる場面がない。',
      action: '今日学んだことを使う場面を、今週中に1つ意図的に作る',
    },
  },
  統率力: {
    active: {
      message: '方向を示したとき、相手が自分の言葉で動き始めている。',
      action: '次のチームの目標を、自分の言葉だけで語る機会を作る',
    },
    sleeping: {
      message: '方向を示しているが、相手がついてくる実感がない。',
      action: '指示より先に、相手が今何を大切にしているかを1つ聞いてみる',
    },
  },
  本質力: {
    active: {
      message: '情報の表面より、その奥にある構造や意図が先に見えている。',
      action: '今取り組んでいる課題の「本当の問いは何か」をもう一度問い直してみる',
    },
    sleeping: {
      message: '目の前の現象に反応しているが、その奥まで掘りきれていない。',
      action: '今日気になったことに、「それはなぜ起きているのか」を3回繰り返す',
    },
  },
  創造力: {
    active: {
      message: 'まだない解決策が、既存の枠外から自然と浮かんでいる。',
      action: '今ある制約を全て外したら、どんな形が生まれるかを紙に描いてみる',
    },
    sleeping: {
      message: '解決策を考えるとき、前例や既存の方法を先に探している。',
      action: '今週1つ、今までやったことのない方法でやってみる',
    },
  },
  伝達力: {
    active: {
      message: '相手の理解度に合わせて言葉を変えながら、伝わっているかを確認しながら話している。',
      action: '普段使っている専門用語を、全く別の言葉で言い換えてみる',
    },
    sleeping: {
      message: '伝えることより、言いたいことを先に出してしまっている。',
      action: '次の会話で、相手の反応を見てから次の言葉を選ぶ',
    },
  },
  協働力: {
    active: {
      message: '自分一人より、人と組んだときのほうが大きい結果を出せている。',
      action: '今のチームで、誰の強みを一番使えていないかを確認する',
    },
    sleeping: {
      message: '一人でやったほうが早いと判断して動いている。',
      action: '今週、誰かに任せたら自分が驚くことを1つ探す',
    },
  },
  起動力: {
    active: {
      message: '十分な情報が揃う前に、最初の1アクションを起こせている。',
      action: '次のアイデアを、考える前に30秒以内に1アクション起こしてみる',
    },
    sleeping: {
      message: '準備が整ってから動こうとして、スタートが遅れている。',
      action: '今日、考え中のことを半分の準備で動かしてみる',
    },
  },
  革新力: {
    active: {
      message: '現状に違和感を感じたとき、不満ではなく変える行動に変換できている。',
      action: '今のやり方の中で、一番変えたいものを選んで今日変えてみる',
    },
    sleeping: {
      message: '現状の問題は見えているが、変えることへの一歩が止まっている。',
      action: '今の仕組みで「なぜそうなっているのか」を誰かに聞いてみる',
    },
  },
  実装力: {
    active: {
      message: '頭の中にあるものを、形になるまでやりきっている。',
      action: '今着手中のものに、完了の定義を1文で書いてみる',
    },
    sleeping: {
      message: 'アイデアは出るが、形になる前に次のアイデアに移っている。',
      action: '今週、1つだけ選んで最後まで完成させる',
    },
  },
  影響力: {
    active: {
      message: '自分の言動が周囲の行動を変えている事実を、確認できている。',
      action: '自分の言葉や行動で変化した人の話を、直接聞いてみる',
    },
    sleeping: {
      message: '影響を与えたいが、相手に届いているかの確認ができていない。',
      action: '次の会話で、相手が動いたかどうかを1週間後に確認する約束をする',
    },
  },
};

// =============================================
// 3. 発動分析メイン関数
// =============================================
/**
 * @param {Object} subcategoryScores
 *   例: { 根幹力: 85, 受容力: 72, 転換力: 91, ... }
 * @param {number} threshold
 *   発動中/未発動の閾値（80点満点中）
 *   設計根拠: 平均層200pt ÷ 16カテゴリ ≒ 12.5pt → 20点満点のサブスコアで → 13点
 *   デフォルト: 13点（平均層200pt相当 / 20点満点）
 *   ⚠️ 要確認: 設計分析書のゾーン閾値と照合して最終値を決定すること
 * @returns {Object} { active: [...], sleeping: [...] }
 */
function getActivationAnalysis(subcategoryScores, threshold = 13) {
  // 各サブカテゴリにブロック情報とスコアを付与
  const items = Object.entries(subcategoryScores).map(([name, score]) => ({
    name,
    score,
    block: BLOCK_MAP[name],
    status: score >= threshold ? 'active' : 'sleeping',
  }));

  // 発動中 TOP2（ブロック重複なし）
  const activeTop2 = pickTopByBlock(
    items.filter(i => i.status === 'active'),
    'desc',
    2
  );

  // 未発動 TOP2（ブロック重複なし）
  const sleepingTop2 = pickTopByBlock(
    items.filter(i => i.status === 'sleeping'),
    'asc',
    2
  );

  return {
    active: activeTop2.map(i => ({
      name: i.name,
      block: i.block,
      score: i.score,
      message: TEMPLATES[i.name].active.message,
      action: TEMPLATES[i.name].active.action,
    })),
    sleeping: sleepingTop2.map(i => ({
      name: i.name,
      block: i.block,
      score: i.score,
      message: TEMPLATES[i.name].sleeping.message,
      action: TEMPLATES[i.name].sleeping.action,
    })),
  };
}

/**
 * ブロック重複なしで上位N件を選ぶ
 * @param {Array}  items  - { name, score, block, status }[]
 * @param {string} order  - 'desc'（高い順）| 'asc'（低い順）
 * @param {number} limit  - 取得件数
 */
function pickTopByBlock(items, order, limit) {
  const sorted = [...items].sort((a, b) =>
    order === 'desc' ? b.score - a.score : a.score - b.score
  );

  const usedBlocks = new Set();
  const result = [];

  for (const item of sorted) {
    if (usedBlocks.has(item.block)) continue;
    usedBlocks.add(item.block);
    result.push(item);
    if (result.length >= limit) break;
  }

  return result;
}

// =============================================
// 4. エクスポート
// =============================================
// CommonJS
if (typeof module !== 'undefined') {
  module.exports = { getActivationAnalysis, TEMPLATES, BLOCK_MAP };
}

// =============================================
// 5. 動作確認用サンプル（開発時のみ使用）
// =============================================
// ブラウザコンソールで動作確認する場合は以下をコピペ
/*
// スコアは20点満点
const testScores = {
  根幹力: 18, 受容力: 12, 転換力: 19, 熟達力: 10,
  謙学力: 16, 論理力: 9,  活用力: 17, 統率力: 13,
  本質力: 20, 創造力: 11, 伝達力: 15, 協働力: 8,
  起動力: 17, 革新力: 13, 実装力: 14, 影響力: 7,
};

const result = getActivationAnalysis(testScores, 13);
console.log('=== 発動中 TOP2 ===');
result.active.forEach(i => {
  console.log(`[${i.block}] ${i.name} (${i.score}点)`);
  console.log(`  → ${i.message}`);
  console.log(`  アクション: ${i.action}`);
});
console.log('=== 未発動 TOP2 ===');
result.sleeping.forEach(i => {
  console.log(`[${i.block}] ${i.name} (${i.score}点)`);
  console.log(`  → ${i.message}`);
  console.log(`  アクション: ${i.action}`);
});
*/
