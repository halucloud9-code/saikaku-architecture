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
  meaning:        '基軸力',
  mindfulness:    '認知力',
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
  idea:           '構想力',
  innovation:     '変革力',
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
// 3. スコア段階判定
// =============================================
function getScoreTier(score) {
  if (score >= 18) return 'peak';  // 最大発動（18-20点）
  if (score >= 14) return 'high';  // 安定発動（14-17点）
  return 'edge';                   // 発動開始（12-13点）
}

// =============================================
// 4. テンプレート定義（英語キー）— 3段階 × 16カテゴリ
// =============================================
const TEMPLATES = {
  meaning: {
    peak: {
      message: '判断の軸が完全に言語化されている。状況が変わっても迷いが出ない。これは才覚の核が全開で動いているサインだ。',
      action: '今の判断基準を3行で書き出して、信頼できる人に見せてフィードバックをもらう',
    },
    high: {
      message: '自分の判断基準が安定して動いている。大半の場面でブレずに選択できている。',
      action: '直近1週間の主要な決断を振り返り、共通する軸を1文で言語化してみる',
    },
    edge: {
      message: '判断の軸が出てきている。まだ全場面では使えていないが、「これだ」という感覚が生まれている。',
      action: '次に迷ったとき、「なぜそっちを選ぶのか」を選ぶ前に1文書いてから動く',
    },
    sleeping: {
      message: '状況ごとに判断が変わっている。軸がまだ言葉になっていない。',
      action: '次に迷ったとき、「なぜそっちを選ぶのか」を1文で書いてから動く',
    },
  },
  mindfulness: {
    peak: {
      message: '気づきの感度が最大値にある。相手の状態変化を言葉より先に読んでいる。この感度が場の空気を変えている。',
      action: 'チームで一番反応が薄い人に、この感度を集中的に向けてみる',
    },
    high: {
      message: '気づきが安定して動いている。自分と違う意見を、反論ではなく情報として受け取れている。',
      action: '次の対話で、相手の言葉をそのまま一度繰り返してから自分の意見を返してみる',
    },
    edge: {
      message: '気づきが発動し始めている。反応する前に少し止まれる瞬間が増えている。',
      action: '今日、違う意見に出会ったとき「なるほど」と言ってから10秒考えて返す',
    },
    sleeping: {
      message: '違う意見に出会うと、反論か回避が先に出ている。',
      action: '次に反論したくなったとき、先に相手の言葉をそのまま繰り返してから話す',
    },
  },
  mindshift: {
    peak: {
      message: '困難が来た瞬間に、チャンスへの変換が自動で動いている。問題の構造そのものが見えている。',
      action: '今抱えている課題を「これがあるから提供できる価値は何か」に言い換えて、誰かに話す',
    },
    high: {
      message: '意識転換が動いている。困難な状況でも、可能性を探す視点に切り替えられている。',
      action: '直近で困った出来事を1つ選んで、「そこから得たもの」だけを3つ書き出す',
    },
    edge: {
      message: '意識転換が始まっている。まだ時間がかかるが、別の見方に気づける瞬間が出てきている。',
      action: '直近の失敗を1つ選んで、「これがあったから次はこうできる」という1文を書く',
    },
    sleeping: {
      message: '問題が来たとき、解決より回避を先に選んでいる。',
      action: '直近の失敗を1つ選んで、そこから得たものだけを書き出す',
    },
  },
  mastery: {
    peak: {
      message: '熟達が深いレベルで動いている。やるたびに限界値が更新されている。天井がまだ見えていない状態だ。',
      action: '今一番得意な領域で、自分が最も苦手とする部分に意図的に挑んでみる',
    },
    high: {
      message: '熟達が安定している。繰り返すたびに精度が上がっていることを自分で確認できている。',
      action: '今週取り組むことに「前回よりここを改善する」という1点の目標を設定してから始める',
    },
    edge: {
      message: '熟達が動き始めている。少しずつ上達の実感が出てきている。',
      action: '今日やることを終えた後、昨日と何が違ったかを30秒で1行メモする',
    },
    sleeping: {
      message: '同じことを繰り返しているが、上達の実感がない。',
      action: '今日やることを終えた後、昨日と何が変わったかを1行メモする',
    },
  },
  learning: {
    peak: {
      message: '学習の吸収速度が最大値にある。優れた人に出会うと、防衛より先に好奇心が動く。',
      action: '最近最も尊敬した人に「何を大切にしているか」を直接聞く機会を今週つくる',
    },
    high: {
      message: '学習が安定している。自分より詳しい人からの情報を素直に受け取れている。',
      action: '最近学んだことを3行で誰かに説明する機会を意図的に作る',
    },
    edge: {
      message: '学習が動き始めている。新しい情報に対して、少しずつ防衛が薄れてきている。',
      action: '今週、自分より若い人から1つ教えてもらう機会をつくる',
    },
    sleeping: {
      message: '新しいことに触れるとき、防衛反応が先に出ている。',
      action: '今週、自分より若い人から1つ教えてもらう機会を作る',
    },
  },
  logical: {
    peak: {
      message: '論理構造を瞬時に組み立てられている。話す前に全体像が見えていて、相手が途中で迷わない。',
      action: '次の提案を「結論→理由→証拠→問い」の1枚に整理して、声に出して話す練習をする',
    },
    high: {
      message: '論理が動いている。話の構造を意識して組み立ててから話せている。',
      action: '次に誰かに説明するとき、最初の1文を必ず結論にしてから始める',
    },
    edge: {
      message: '論理が発動し始めている。話の順番を意識する場面が増えてきている。',
      action: '次の説明の前に、「一番言いたいことは何か」を先に紙に書いてから話す',
    },
    sleeping: {
      message: '話しながら考えているため、言いたいことより先に言葉が出ている。',
      action: '次に誰かに説明するとき、最初の1文を結論にしてから始める',
    },
  },
  life: {
    peak: {
      message: '活用力が全開で動いている。学んだことが、全く別の文脈に自然に応用できている。',
      action: '今使えている知識を、全く異なる領域に当てはめた仮説を1つ立ててみる',
    },
    high: {
      message: '活用力が安定している。学んだことを実際の場面で使えている。',
      action: '最近学んだことを、今週中に実際の課題解決に当てはめてみる',
    },
    edge: {
      message: '活用が動き始めている。知識と実践がつながる瞬間が出てきている。',
      action: '今日学んだことを使う場面を、今週中に1つ意図的に作る',
    },
    sleeping: {
      message: '知識は持っているが、行動に繋げる場面がない。',
      action: '今日学んだことを使う場面を、今週中に1つ意図的に作る',
    },
  },
  leadership: {
    peak: {
      message: 'リーダーシップが最大値で動いている。方向を示すだけで、相手が自分の言葉で動き始めている。',
      action: 'チームに新しいビジョンを話す場をつくり、誰が自分の言葉で動いたかを観察する',
    },
    high: {
      message: 'リーダーシップが安定している。人に方向を示せていて、動かす手応えがある。',
      action: '次のチーム目標を、自分の言葉だけで語る機会を1つ設ける',
    },
    edge: {
      message: 'リーダーシップが発動し始めている。人を動かす場面で少しずつ手応えが出ている。',
      action: '今週、チームや誰かに対して「提案する側」に意図的に立ってみる',
    },
    sleeping: {
      message: '方向を示しているが、相手がついてくる実感がない。',
      action: '指示より先に、相手が今何を大切にしているかを1つ聞いてみる',
    },
  },
  critical: {
    peak: {
      message: '本質力が全開にある。情報の表面より、奥にある構造と意図が先に見えている。問いの立て方が違う。',
      action: '今直面している問題の「本当の問い」を再定義して、チームに問いかけてみる',
    },
    high: {
      message: '批判的思考が安定している。情報を受け取るとき、根拠を確認する習慣がある。',
      action: '今週触れた情報の1つについて「その根拠は何か」まで掘り下げて確認する',
    },
    edge: {
      message: '批判的思考が発動し始めている。「本当にそうか」と問う瞬間が増えてきている。',
      action: '次に誰かの意見を聞いたとき、賛成する前に「なぜそう言えるのか」を1つ聞いてみる',
    },
    sleeping: {
      message: '目の前の現象に反応しているが、その奥まで掘りきれていない。',
      action: '今日気になったことに、「それはなぜ起きているのか」を3回繰り返す',
    },
  },
  creativity: {
    peak: {
      message: '創造力が最大値で動いている。まだない解決策が、既存の枠の外から自然と浮かぶ。',
      action: '今の一番大きな課題に対して「絶対にやらないと思っていた方法」を1つ真剣に検討する',
    },
    high: {
      message: '創造性が安定している。既存の枠にとらわれない発想が出てきている。',
      action: '全く異なる2つの分野を組み合わせたアイデアを今日1つ考えてみる',
    },
    edge: {
      message: '創造性が発動し始めている。普通と違う解決策を試みる回数が増えてきている。',
      action: '日常の「不便・違和感・面白い」を今日3つメモする習慣を始める',
    },
    sleeping: {
      message: '解決策を考えるとき、前例や既存の方法を先に探している。',
      action: '今日1つ、誰もやったことのない方法で問題を解こうとしてみる',
    },
  },
  communication: {
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
    peak: {
      message: '伝達力が最大値にある。相手の理解度に合わせて言葉を変えながら、伝わったかを確認できている。',
      action: '一番難しい相手に、最も複雑な内容を伝える機会を意図的につくってみる',
    },
    high: {
      message: '伝達力が安定している。相手に合わせて表現を調整できている。',
      action: '次の説明後に「どの部分が一番伝わりましたか」と相手に確認してみる',
    },
    edge: {
      message: '伝達力が発動し始めている。「言った」より「伝わったか」を意識し始めている。',
      action: '次に伝えるとき「結論→理由→具体例」の順で1分以内に話す練習をする',
    },
    sleeping: {
      message: '伝えることより、言いたいことを先に出してしまっている。',
      action: '次の会話で、相手の反応を見てから次の言葉を選ぶ',
    },
  },
  collaboration: {
    peak: {
      message: '協働が最大値で動いている。自分一人より、人と組んだときのほうが大きい結果を出せている。',
      action: '今一番苦手なタイプの人と意図的に組んで、相手の強みを最大化する動きをしてみる',
    },
    high: {
      message: '協働が安定している。他者の強みを活かしながら動けている。',
      action: '今週の仕事で「一人でやるより人と組む」を選べる場面を意識的に探す',
    },
    edge: {
      message: '協働が動き始めている。一人でやるより人と組む場面を選ぶことが増えてきている。',
      action: '今日、誰かに「これ一緒にやらないか」と1回声をかけてみる',
    },
    sleeping: {
      message: '一人でやったほうが早いと判断して動いている。',
      action: '今週、誰かに任せたら自分が驚くことを1つ探す',
    },
  },
  idea: {
    peak: {
      message: '構想力が全開にある。日常の違和感が即座に発想の種に変わっている。アイデアが止まらない状態だ。',
      action: '今浮かんでいるアイデアの中から1つ選び、24時間以内に最初の1アクションを起こす',
    },
    high: {
      message: 'アイデアが安定して出ている。既存の枠を超えた発想が浮かんできている。',
      action: '今週出たアイデアの中から1つ選んで、実現可能な最小単位の行動を定義する',
    },
    edge: {
      message: 'アイデアが動き始めている。新しい組み合わせを試みる回数が増えてきている。',
      action: '今感じている「なんか面白そう」を今日1つメモして、誰かに話してみる',
    },
    sleeping: {
      message: '準備が整ってから動こうとして、スタートが遅れている。',
      action: '今日、考え中のことを半分の準備で動かしてみる',
    },
  },
  innovation: {
    peak: {
      message: '変革力が最大値にある。現状への違和感が、即座に行動への衝動に変わっている。止まれない状態だ。',
      action: '今変えたいと思っていることを1つ選んで、今週中に最初の変化を起こす',
    },
    high: {
      message: '変革力が動いている。現状を疑問視して、より良い方法を探せている。',
      action: '今周囲で「おかしい」と感じていることを1つ特定して、改善案を1つ提案してみる',
    },
    edge: {
      message: '変革力が発動し始めている。「もっと良くできる」という視点が出てきている。',
      action: '現状への不満を「改善提案」に変換して、今週中に誰かに話してみる',
    },
    sleeping: {
      message: '現状の問題は見えているが、変えることへの一歩が止まっている。',
      action: '今の仕組みで「なぜそうなっているのか」を誰かに聞いてみる',
    },
  },
  implementation: {
    peak: {
      message: '実装力が最大値にある。頭の中にあるものを、形になるまでやりきっている。完成が当たり前になっている。',
      action: '今最も難しいプロジェクトの次の完了定義を決めて、着手するまでの時間を最短化する',
    },
    high: {
      message: '実装力が安定している。計画から最初の1アクションを72時間以内に踏み出せている。',
      action: '今着手中のプロジェクトの「完了の定義」を1文で書いて、期限を設ける',
    },
    edge: {
      message: '実装力が発動し始めている。アイデアを行動に移す回数が増えてきている。',
      action: '今浮かんでいるアイデアを1つ選んで、今日中に最初の1歩だけ踏み出す',
    },
    sleeping: {
      message: 'アイデアは出るが、形になる前に次のアイデアに移っている。',
      action: '今週、1つだけ選んで最後まで完成させる',
    },
  },
  influence: {
    peak: {
      message: '影響力が最大値で動いている。言葉より行動で示しているから、周囲が自然に動いている。',
      action: '自分が変えたいチームの状態を、まず自分の行動で先に示してみる',
    },
    high: {
      message: '影響力が安定している。自分の言動が周囲の行動を変えている事実が確認できている。',
      action: '自分の言葉や行動で変化した人に直接会って、何が変わったかを聞いてみる',
    },
    edge: {
      message: '影響力が発動し始めている。自分の姿勢が誰かに影響を与えている瞬間を感じている。',
      action: '次の会話で、相手が動いたかどうかを1週間後に確認する約束をする',
    },
    sleeping: {
      message: '影響を与えたいが、相手に届いているかの確認ができていない。',
      action: '次の会話で、相手が動いたかどうかを1週間後に確認する約束をする',
    },
  },
};

// =============================================
// 5. 発動分析メイン関数
// =============================================
// =============================================
// 5b. マトリクスゾーン判定 + ブロック判定
// =============================================
// ブロックグリッド（AllPairsTriangle と同ロジック）
const _AXIS_GRP = {
  meaning:0, mindfulness:0, mindshift:0, mastery:0,
  learning:1, logical:1, life:1, leadership:1,
  critical:2, creativity:2, communication:2, collaboration:2,
  idea:3, innovation:3, implementation:3, influence:3,
};
const _BLOCK_GRID = [
  ['ANCHOR',    'VISIONARY', 'BUILDER',   'CATALYST'],
  ['VISIONARY', 'SAGE',      'CRAFTER',   'NAVIGATOR'],
  ['BUILDER',   'CRAFTER',   'INVENTOR',  'STRIKER'],
  ['CATALYST',  'NAVIGATOR', 'STRIKER',   'PIONEER'],
];
function _getBlockName(kA, kB) {
  const gA = _AXIS_GRP[kA] ?? 0, gB = _AXIS_GRP[kB] ?? 0;
  return _BLOCK_GRID[Math.min(gA, gB)][Math.max(gA, gB)];
}

function _getZone(sA, sB) {
  const sum = sA + sB;
  if (sA === 20 && sB === 20) return 'natural';
  if ((sA >= 16 && sB >= 16) || (sA >= 15 && sB >= 15 && sum >= 32)) return 'pro';
  if (sA >= 12 && sB >= 12) return 'active';
  if (sA >= 10 && sB >= 10) return 'potential';
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

  // ── 🔑 次に動かす力（ゾーン優先・上位10）──
  // NATURAL→PRO→ACTIVE→POTENTIAL 順、同ゾーン内は合計スコア降順で上位10ペアを選ぶ
  const ZONE_ORDER_MAP = { natural: 0, pro: 1, active: 2, potential: 3 };
  const sleepingPairs = [];
  for (let i = 0; i < ALL_KEYS.length - 1; i++) {
    for (let j = i + 1; j < ALL_KEYS.length; j++) {
      const kA = ALL_KEYS[i], kB = ALL_KEYS[j];
      const sA = sc(kA), sB = sc(kB);
      const z = _getZone(sA, sB);
      if (z !== 'dormant') {
        sleepingPairs.push({ kA, kB, zone: z, scoreA: sA, scoreB: sB, sum: sA + sB, isPair: true });
      }
    }
  }
  sleepingPairs.sort((a, b) => {
    const zo = ZONE_ORDER_MAP[a.zone] - ZONE_ORDER_MAP[b.zone];
    return zo !== 0 ? zo : b.sum - a.sum;
  });
  const topSleepingPairs = sleepingPairs.slice(0, 10);

  // ── アイテム生成（✅ 個別キー用）──
  const toItem = (key, status) => {
    const tier = status === 'active' ? getScoreTier(sc(key)) : status;
    // Case B: 最高スコアのペアパートナーを探す
    let partnerKey = null;
    let partnerScore = 0;
    let bestSum = 0;
    for (const k of ALL_KEYS) {
      if (k === key) continue;
      const s = sc(k);
      const sum = sc(key) + s;
      if (sum > bestSum) { bestSum = sum; partnerKey = k; partnerScore = s; }
    }
    return {
      key,
      name:         LABEL_MAP[key] || key,
      block:        BLOCK_MAP[key] || '?',
      score:        sc(key),
      tier,
      status,
      partnerKey,
      partnerScore,
      message: TEMPLATES[key]?.[tier]?.message || TEMPLATES[key]?.active?.message || '',
      action:  TEMPLATES[key]?.[tier]?.action  || TEMPLATES[key]?.active?.action  || '',
    };
  };

  // ── 案C タイプ判定: メイン＋サブ（最上位ペアのブロック） ──
  let mainType = null, subType = null;
  for (const p of sleepingPairs) {
    const bn = _getBlockName(p.kA, p.kB);
    if (!mainType) { mainType = bn; }
    else if (bn !== mainType && !subType) { subType = bn; break; }
  }
  const userType = { main: mainType, sub: subType };

  // フォールバック: ✅ が空の場合
  if (activeKeys.length === 0) {
    return {
      active:   sortDesc(ALL_KEYS.filter(k => sc(k) >= threshold)).slice(0, 3).map(k => toItem(k, 'active')),
      sleeping: topSleepingPairs,
      allPairs: sleepingPairs,
      type:     userType,
    };
  }

  return {
    active:   activeKeys.map(k => toItem(k, 'active')),
    sleeping: topSleepingPairs,
    allPairs: sleepingPairs,
    type:     userType,
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
