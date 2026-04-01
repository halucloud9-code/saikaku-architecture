/**
 * activation_analysis.js
 * UAAM 発動分析ロジック — v2（英語subキー対応）
 *
 * スコア設計:
 *   1サブカテゴリ = 4問 × 5点 = 20点満点
 *   1軸 = 4サブカテゴリ × 20点 = 80点満点
 *   全体 = 4軸 × 80点 = 320点満点
 *   threshold = 13（平均層200pt ÷ 16カテゴリ ÷ 320 × 20 ≒ 12.5 → 13点）
 */

// =============================================
// 1. 英語subキー → 日本語表示名
// =============================================
const LABEL_MAP = {
  meaning:        '根幹力',
  mindfulness:    '受容力',
  mindshift:      '転換力',
  mastery:        '熟達力',
  learning:       '謙学力',
  logical:        '論理力',
  life:           '活用力',
  leadership:     '統率力',
  critical:       '本質力',
  creativity:     '創造力',
  communication:  '伝達力',
  collaboration:  '協働力',
  idea:           '起動力',
  innovation:     '革新力',
  implementation: '実装力',
  influence:      '影響力',
};

// =============================================
// 2. 英語subキー → ブロック（志/知/技/衝）
// =============================================
const BLOCK_MAP = {
  meaning:        '志',
  mindfulness:    '志',
  mindshift:      '志',
  mastery:        '志',
  learning:       '知',
  logical:        '知',
  life:           '知',
  leadership:     '知',
  critical:       '技',
  creativity:     '技',
  communication:  '技',
  collaboration:  '技',
  idea:           '衝',
  innovation:     '衝',
  implementation: '衝',
  influence:      '衝',
};

// =============================================
// 3. テンプレート定義（英語キー）
// =============================================
const TEMPLATES = {
  meaning: {
    active: {
      message: '自分の判断基準が言語化されているから、状況が変わってもブレずに決断できている。',
      action: 'その判断基準を誰かに伝えて、一致しているか確認してみる',
    },
    sleeping: {
      message: '状況ごとに判断が変わっている。軸がまだ言葉になっていない。',
      action: '次に迷ったとき、「なぜそっちを選ぶのか」を1文で書いてから動く',
    },
  },
  mindfulness: {
    active: {
      message: '自分と違う意見を、反論せずに情報として受け取れている。',
      action: '反対意見の側に立って、その人の論理を最後まで完成させてみる',
    },
    sleeping: {
      message: '違う意見に出会うと、反論か回避が先に出ている。',
      action: '次に反論したくなったとき、先に相手の言葉をそのまま繰り返してから話す',
    },
  },
  mindshift: {
    active: {
      message: '困難な状況を見たとき、問題ではなくチャンスとして捉え返せている。',
      action: '今抱えている課題を、そのまま誰かへの提供価値として言い換えてみる',
    },
    sleeping: {
      message: '問題が来たとき、解決より回避を先に選んでいる。',
      action: '直近の失敗を1つ選んで、そこから得たものだけを書き出す',
    },
  },
  mastery: {
    active: {
      message: '繰り返すたびに精度が上がっていることを、自分で確認しながら動いている。',
      action: '自分が一番うまくなった領域で、今の限界値を意図的に突いてみる',
    },
    sleeping: {
      message: '同じことを繰り返しているが、上達の実感がない。',
      action: '今日やることを終えた後、昨日と何が変わったかを1行メモする',
    },
  },
  learning: {
    active: {
      message: '自分より詳しい人に出会うと、防衛ではなく素直に興味が動いている。',
      action: '最近尊敬した人に、「何を大切にしているか」を直接聞いてみる',
    },
    sleeping: {
      message: '新しいことに触れるとき、防衛反応が先に出ている。',
      action: '今週、自分より若い人から1つ教えてもらう機会を作る',
    },
  },
  logical: {
    active: {
      message: '話の構造を組み立ててから話しているから、相手が途中で迷わない。',
      action: '次の提案を「結論→理由→証拠→結論」の順で1枚にまとめてみる',
    },
    sleeping: {
      message: '話しながら考えているため、言いたいことより先に言葉が出ている。',
      action: '次に誰かに説明するとき、最初の1文を結論にしてから始める',
    },
  },
  life: {
    active: {
      message: '学んだことが、別の場面で自然に使えている。',
      action: '最近学んだことを、全く別の分野に当てはめて考えてみる',
    },
    sleeping: {
      message: '知識は持っているが、行動に繋げる場面がない。',
      action: '今日学んだことを使う場面を、今週中に1つ意図的に作る',
    },
  },
  leadership: {
    active: {
      message: '方向を示したとき、相手が自分の言葉で動き始めている。',
      action: '次のチームの目標を、自分の言葉だけで語る機会を作る',
    },
    sleeping: {
      message: '方向を示しているが、相手がついてくる実感がない。',
      action: '指示より先に、相手が今何を大切にしているかを1つ聞いてみる',
    },
  },
  critical: {
    active: {
      message: '情報の表面より、その奥にある構造や意図が先に見えている。',
      action: '今取り組んでいる課題の「本当の問いは何か」をもう一度問い直してみる',
    },
    sleeping: {
      message: '目の前の現象に反応しているが、その奥まで掘りきれていない。',
      action: '今日気になったことに、「それはなぜ起きているのか」を3回繰り返す',
    },
  },
  creativity: {
    active: {
      message: 'まだない解決策が、既存の枠外から自然と浮かんでいる。',
      action: '今ある制約を全て外したら、どんな形が生まれるかを紙に描いてみる',
    },
    sleeping: {
      message: '解決策を考えるとき、前例や既存の方法を先に探している。',
      action: '今週1つ、今までやったことのない方法でやってみる',
    },
  },
  communication: {
    active: {
      message: '相手の理解度に合わせて言葉を変えながら、伝わっているかを確認しながら話している。',
      action: '普段使っている専門用語を、全く別の言葉で言い換えてみる',
    },
    sleeping: {
      message: '伝えることより、言いたいことを先に出してしまっている。',
      action: '次の会話で、相手の反応を見てから次の言葉を選ぶ',
    },
  },
  collaboration: {
    active: {
      message: '自分一人より、人と組んだときのほうが大きい結果を出せている。',
      action: '今のチームで、誰の強みを一番使えていないかを確認する',
    },
    sleeping: {
      message: '一人でやったほうが早いと判断して動いている。',
      action: '今週、誰かに任せたら自分が驚くことを1つ探す',
    },
  },
  idea: {
    active: {
      message: '十分な情報が揃う前に、最初の1アクションを起こせている。',
      action: '次のアイデアを、考える前に30秒以内に1アクション起こしてみる',
    },
    sleeping: {
      message: '準備が整ってから動こうとして、スタートが遅れている。',
      action: '今日、考え中のことを半分の準備で動かしてみる',
    },
  },
  innovation: {
    active: {
      message: '現状に違和感を感じたとき、不満ではなく変える行動に変換できている。',
      action: '今のやり方の中で、一番変えたいものを選んで今日変えてみる',
    },
    sleeping: {
      message: '現状の問題は見えているが、変えることへの一歩が止まっている。',
      action: '今の仕組みで「なぜそうなっているのか」を誰かに聞いてみる',
    },
  },
  implementation: {
    active: {
      message: '頭の中にあるものを、形になるまでやりきっている。',
      action: '今着手中のものに、完了の定義を1文で書いてみる',
    },
    sleeping: {
      message: 'アイデアは出るが、形になる前に次のアイデアに移っている。',
      action: '今週、1つだけ選んで最後まで完成させる',
    },
  },
  influence: {
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
// 4. 発動分析メイン関数
// =============================================
// =============================================
// 4b. マトリクスゾーン判定（AllPairsTriangle と同ロジック）
// =============================================
function _getZone(sA, sB) {
  const sum = sA + sB;
  if (sA === 20 && sB === 20) return 'natural';
  if ((sA >= 16 && sB >= 16) || (sA >= 15 && sB >= 15 && sum >= 32)) return 'pro';
  if (sA >= 12 && sB >= 12 && sum <= 31) return 'active';
  return 'dormant';
}

/**
 * @param {Object} subcategoryScores  英語キー { meaning: 18, mindfulness: 15, ... }
 * @param {number} threshold          フォールバック用閾値（デフォルト13）
 * @returns {Object} { active: [...], sleeping: [...] }
 *
 * 判定ルール:
 *
 * ✅ 今、発動している力（3つ）
 *   STEP1: 右側（Natural/Pro）からスコア高い順に最大3つ
 *   STEP2: 3つ未満なら左側（Active TOP10）で不足分を補充
 *   STEP3: 右側ゼロの場合は左側から3つ
 *
 * 🔑 次に動かす力（3つ）
 *   左側（Active TOP10）からスコア高い順に3つ
 *   ✅ で左側が選ばれた場合はその分をスキップし次点を選ぶ
 *
 * フォールバック: 左右どちらも空 → スコア閾値（13点）判定に切り替え
 */
function getActivationAnalysis(subcategoryScores, threshold = 13) {
  const ALL_KEYS = Object.keys(LABEL_MAP).filter(k => subcategoryScores[k] != null);
  const sc = (k) => subcategoryScores[k] ?? 0;

  // ── 右側（Natural + Pro）素子を収集 ──
  const rightSet = new Set();
  for (const kA of ALL_KEYS) {
    for (const kB of ALL_KEYS) {
      if (kA === kB) continue;
      const z = _getZone(sc(kA), sc(kB));
      if (z === 'natural' || z === 'pro') { rightSet.add(kA); rightSet.add(kB); }
    }
  }

  // ── 左側（Active TOP10）素子を収集 ──
  const activePairs = [];
  for (let i = 0; i < ALL_KEYS.length - 1; i++) {
    for (let j = i + 1; j < ALL_KEYS.length; j++) {
      const kA = ALL_KEYS[i], kB = ALL_KEYS[j];
      if (_getZone(sc(kA), sc(kB)) === 'active')
        activePairs.push({ kA, kB, sum: sc(kA) + sc(kB) });
    }
  }
  activePairs.sort((a, b) => b.sum - a.sum);
  const leftSet = new Set();
  if (activePairs.length > 0) {
    const cutoff = activePairs[Math.min(9, activePairs.length - 1)].sum;
    activePairs.filter(p => p.sum >= cutoff).forEach(p => { leftSet.add(p.kA); leftSet.add(p.kB); });
  }

  // スコア降順ソート
  const sortDesc = (keys) => [...keys].sort((a, b) => sc(b) - sc(a));
  const rightSorted = sortDesc(rightSet);
  const leftSorted  = sortDesc(leftSet);

  // ── ✅ 今、発動している力（3つ）──
  let activeKeys = [];
  if (rightSorted.length === 0) {
    // 右ゼロ → 左から3つ
    activeKeys = leftSorted.slice(0, 3);
  } else {
    // 右から最大3つ
    activeKeys = rightSorted.slice(0, 3);
    // 不足分を左から補充
    if (activeKeys.length < 3) {
      const need = 3 - activeKeys.length;
      const fill = leftSorted.filter(k => !activeKeys.includes(k)).slice(0, need);
      activeKeys = [...activeKeys, ...fill];
    }
  }

  // ── 🔑 次に動かす力（3つ）──
  // ✅ で左から選ばれたキーを除外して次点を選ぶ
  const activeFromLeft = new Set(activeKeys.filter(k => leftSet.has(k)));
  const sleepingKeys = leftSorted.filter(k => !activeFromLeft.has(k)).slice(0, 3);

  // ── アイテム生成 ──
  const toItem = (key, status) => ({
    key,
    name:    LABEL_MAP[key] || key,
    block:   BLOCK_MAP[key] || '?',
    score:   sc(key),
    status,
    message: TEMPLATES[key]?.[status]?.message || '',
    action:  TEMPLATES[key]?.[status]?.action  || '',
  });

  // フォールバック: 左右どちらも空
  if (activeKeys.length === 0 && sleepingKeys.length === 0) {
    return {
      active:   sortDesc(ALL_KEYS.filter(k => sc(k) >= threshold)).slice(0, 3).map(k => toItem(k, 'active')),
      sleeping: sortDesc(ALL_KEYS.filter(k => sc(k) <  threshold)).slice(0, 3).map(k => toItem(k, 'sleeping')),
    };
  }

  return {
    active:   activeKeys.map(k => toItem(k, 'active')),
    sleeping: sleepingKeys.map(k => toItem(k, 'sleeping')),
  };
}

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
// 5. エクスポート（ESM）
// =============================================
export { getActivationAnalysis, TEMPLATES, BLOCK_MAP, LABEL_MAP };
