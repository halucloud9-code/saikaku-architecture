import { useState, useCallback, useMemo } from 'react';

/**
 * AllPairsTriangle — 才覚発動領域 / Activation Matrix
 * UI Max Edition
 *
 * 16素子 × 120ペア 三角レイアウト
 * padding-left方式: セルj左端 = j×STEP = 底辺jラベル左端 ✓
 */

// ── 定数 ─────────────────────────────────────────────
const CELL = 36, GAP = 2, STEP = CELL + GAP;

const ORDERED = [
  'meaning', 'mindfulness', 'mindshift', 'mastery',
  'learning', 'logical', 'life', 'leadership',
  'critical', 'creativity', 'communication', 'collaboration',
  'idea', 'innovation', 'implementation', 'influence',
];
const N = ORDERED.length;

const CODE_GRP = {};
['meaning','mindfulness','mindshift','mastery'].forEach(k => CODE_GRP[k] = 0);
['learning','logical','life','leadership'].forEach(k => CODE_GRP[k] = 1);
['critical','creativity','communication','collaboration'].forEach(k => CODE_GRP[k] = 2);
['idea','innovation','implementation','influence'].forEach(k => CODE_GRP[k] = 3);

const AXIS_KEYS  = ['mindset', 'literacy', 'competency', 'impact'];
const AXIS_JP    = ['志 MindSet', '知 Literacy', '技 Competency', '衝 Impact'];
const AXIS_SHORT = ['志', '知', '技', '衝'];

export const SUB_JP = {
  meaning:'基軸力', mindfulness:'認知力', mindshift:'転換力', mastery:'熟達力',
  learning:'謙学力', logical:'論理力', life:'活用力', leadership:'統率力',
  critical:'本質力', creativity:'創造力', communication:'伝達力', collaboration:'協働力',
  idea:'構想力', innovation:'変革力', implementation:'実装力', influence:'影響力',
};

// 既存 AXIS_COLORS に統一
const AXIS_HEX   = ['#2C5F8A', '#1E7A4A', '#A07A18', '#8B3A28'];
const AXIS_LIGHT = ['#5A96DC', '#46C382', '#DCAF46', '#DC5F50'];
const AXIS_DIM   = ['rgba(44,95,138,0.12)','rgba(30,122,74,0.12)',
                    'rgba(160,122,24,0.12)','rgba(139,58,40,0.12)'];

export const ZONE_HEX = {
  natural:   '#8B35C8',   // 紫：20×20 完全発動
  pro:       '#1A6FD4',   // 青：両才覚16以上または15以上合計32以上
  active:    '#7CB82F',   // 黄緑：両才覚12以上合計31以下（左）
  potential: '#E07830',   // オレンジ：両才覚10以上合計22以上（左）
  dormant:   '#5A7A8A',   // 無色（非表示）
};
export const ZONE_LABEL = { natural:'NATURAL ✦', pro:'PRO', active:'ACTIVE', potential:'POTENTIAL', dormant:'—' };

// 10ブロック固有カラー（セルの色相を決定）
const BLOCK_HEX = {
  ANCHOR:    '#1A5C9E',  // 志×志  深青
  SAGE:      '#1A7A4A',  // 知×知  深緑
  INVENTOR:  '#B87010',  // 技×技  琥珀
  PIONEER:   '#B83020',  // 衝×衝  深紅
  VISIONARY: '#0A8090',  // 志×知  ティール
  BUILDER:   '#6040A0',  // 志×技  紫
  CATALYST:  '#A02070',  // 志×衝  マゼンタ
  CRAFTER:   '#4A8030',  // 知×技  オリーブ
  NAVIGATOR: '#107060',  // 知×衝  エメラルド
  STRIKER:   '#C05010',  // 技×衝  オレンジ
};
const ZONE_DESC  = {
  full:      '両才覚が満点（20×20）— 完全解放発動状態',
  active:    '両才覚が高水準（16×16以上）— 才覚発動状態',
  potential: '合計スコア30以上 — 潜在才覚発動',
  dormant:   '両才覚が未達（12未満）— 発動待機・潜在状態',
};
// 右側 vs 左側のゾーン割り当て
const RIGHT_ZONES = ['full', 'active'];
const LEFT_ZONES  = ['potential', 'dormant'];

const RANK_NUM = ['1', '2', '3', '4', '5'];

export const BLOCKS = [
  { name:'ANCHOR',    jp:'志×志', axes:[0,0] },
  { name:'SAGE',      jp:'知×知', axes:[1,1] },
  { name:'INVENTOR',  jp:'技×技', axes:[2,2] },
  { name:'PIONEER',   jp:'衝×衝', axes:[3,3] },
  { name:'VISIONARY', jp:'志×知', axes:[0,1] },
  { name:'BUILDER',   jp:'志×技', axes:[0,2] },
  { name:'CATALYST',  jp:'志×衝', axes:[0,3] },
  { name:'CRAFTER',   jp:'知×技', axes:[1,2] },
  { name:'NAVIGATOR', jp:'知×衝', axes:[1,3] },
  { name:'STRIKER',   jp:'技×衝', axes:[2,3] },
];

// ── ペア定義 (120ペア) ────────────────────────────────
const PAIR_DEFS = {
  // ━ 志×志 ANCHOR（基×基）━
  'meaning|mindfulness':     '軸が定まっているから、どんな価値観も受け入れられる力',
  'meaning|mindshift':       'ぶれない軸があるから、状況に応じて判断を即座に切り替える力',
  'meaning|mastery':         '在り方に沿って、同じ道を深く掘り続ける力',
  'mindfulness|mindshift':   '受け取ったものを固定せず、次の形に変える力',
  'mindfulness|mastery':     '時間をかけて受け取り、自分の中に根づかせる力',
  'mindshift|mastery':       '変え続けながらも、確かな技として積み上げる力',
  // ━ 志×知 VISIONARY（基×知）━
  'meaning|learning':        '在り方を磨くために、自分を省みて問い続ける力',
  'meaning|logical':         '在り方の大切さを自分の言葉で整理し、説く力',
  'meaning|life':            '在り方を常に意識し、日々の判断や行動に生かす力',
  'meaning|leadership':      '在り方を旗として掲げ、人と力を束ねる力',
  'mindfulness|learning':    '異なる意見を受け取るほど、自分の問いが深まる力',
  'mindfulness|logical':     '受け取ったものを整理し、自分の論理に組み替える力',
  'mindfulness|life':        '受け取ったものをその場で試し、成果に変える力',
  'mindfulness|leadership':  '相手の立場を受け入れながら、場の方向を整える力',
  'mindshift|learning':      '視点を転換し、自分の偏りに気づく力',
  'mindshift|logical':       '視点を変えながら、新しい論理を構築する力',
  'mindshift|life':          '転換した発想を、即座に現場に投入する力',
  'mindshift|leadership':    '変化の方向をチームと共有し、全員を新しい軸に揃える力',
  'mastery|learning':        '熟達しているからこそ、まだ知らないことに気づける力',
  'mastery|logical':         '長年の経験を解体し、再現できる論理として伝える力',
  'mastery|life':            '体に染みた技を、状況に応じて最適な形で使い切る力',
  'mastery|leadership':      '積み重ねた実績が、言葉より先に人を動かす力',
  // ━ 知×知 SAGE（知×知）━
  'learning|logical':        '自分の知識に慢心せず、より正確な論理を組み立てる力',
  'learning|life':           '学んだことを正解と思わず、現場で検証し続ける力',
  'learning|leadership':     '自分にないものを認めるから、他者の強みを引き出して束ねる力',
  'logical|life':            '論理で整理したことを、実際の行動に変換する力',
  'logical|leadership':      '論理の筋道を共有することで、バラバラな人を一つの方向に揃える力',
  'life|leadership':         '自分が実践して得た知見で、チームを動かす力',
  // ━ 志×技 BUILDER（基×技）━
  'meaning|critical':        '在り方を持つからこそ、何があっても物事の本質を見極める力',
  'meaning|creativity':      '在り方を起点に、まだ存在しないものを生み出す力',
  'meaning|communication':   '在り方に込めた想いを、言葉にして人の心に届ける力',
  'meaning|collaboration':   '在り方を共有することで、自然と人が集まり動く力',
  'mindfulness|critical':    '異なる視点を受け取るほど、本質が浮かび上がる力',
  'mindfulness|creativity':  '受け取った多様な刺激を組み合わせ、独自のものを生み出す力',
  'mindfulness|communication':'相手の言葉を深く受け取り、伝える力へと変える力',
  'mindfulness|collaboration':'相手を丸ごと受け入れることで、協力関係が生まれる力',
  'mindshift|critical':      '視点を変えるたびに、本質の解像度を高める力',
  'mindshift|creativity':    '常識を転換した瞬間に、新しいアイデアが生まれる力',
  'mindshift|communication': '伝わらないと気づいたら、表現を即座に変える力',
  'mindshift|collaboration': 'チームの枠を超えた組み合わせから、予想外の力を引き出す力',
  'mastery|critical':        '積み上げた経験が、本質を瞬時に見抜かせる力',
  'mastery|creativity':      '熟達した先にしか見えない景色から、誰も作れなかったものを創る力',
  'mastery|communication':   '熟達した技と知恵を、次の世代に手渡す力',
  'mastery|collaboration':   '熟達した存在がいることで、チーム全体の底が上がる力',
  // ━ 知×技 CRAFTER（知×技）━
  'learning|critical':       '自分の知識に慢心せず問い続けるから、物事の本質を常に見据えられる力',
  'learning|creativity':     '自分が完全だと思っていないから、まだ見ぬアイデアへの入り口を開ける力',
  'learning|communication':  '自分の理解の限界を知っているから、人から学んだことを本質として届ける力',
  'learning|collaboration':  '足りない自分を認めるから、他者の力を最大限に引き出せる力',
  'logical|critical':        '感情を抜いて論理で整理するから、複雑な問題の核心を掴める力',
  'logical|creativity':      '論理の筋道を丁寧に追うから、矛盾の隙間に新しい解を見つける力',
  'logical|communication':   '思考の道筋を言語化するから、相手の腑に落ちる説明になる力',
  'logical|collaboration':   '論理を共有することで、バラバラな人を同じ方向に揃える力',
  'life|critical':           '実際に試しながら進むから、理論では気づけない本質に触れる力',
  'life|creativity':         '現場の手応えを積み重ねるから、現場からしか生まれないものを生み出す力',
  'life|communication':      '自分が実践したことを言葉にするから、聞いた人が動き出せる話になる力',
  'life|collaboration':      '実践から得た知見を惜しみなく渡すから、チームの行動が加速する力',
  'leadership|critical':     '多様な知識と経験を統合することで、物事のつながりを本質から見抜く力',
  'leadership|creativity':   '異質なものを束ねるから、一つの要素では生まれない突破口を開ける力',
  'leadership|communication':'全体像を把握しているから、誰にとっても意味が通じる言葉で届けられる力',
  'leadership|collaboration':'人の持ち味を見抜いて束ねるから、一人では到達できない場所へチームを導く力',
  // ━ 技×技 INVENTOR（技×技）━
  'critical|creativity':     '表面を削ぎ落とした先にある核から、新しいものを生む力',
  'critical|communication':  '本質だけを抽出して、相手に過不足なく届ける力',
  'critical|collaboration':  '全員が本質を共有することで、協力が自然に加速する力',
  'creativity|communication':'創ったものの価値を言語化して、世界に届ける力',
  'creativity|collaboration':'一人では生まれない創造を、他者との交差から生む力',
  'communication|collaboration':'考えを伝えて理解しあうことで、バラバラな力がひとつに束なる力',
  // ━ 志×衝 CATALYST（基×衝）━
  'meaning|idea':            '在り方が定まっているから、踏み出す一歩が新しい時代の起点になる力',
  'meaning|innovation':      '在り方を軸に持っているから、常識を超えた新しい秩序を生み出す力',
  'meaning|implementation':  '在り方に沿って動き続けるから、思い描いたものを最後まで実現させる力',
  'meaning|influence':       '在り方で生き続けているから、言葉より先に周囲を動かす力',
  'mindfulness|idea':        '相手の言葉を受け取った瞬間に、それを新たな一歩へ変える力',
  'mindfulness|innovation':  '自分と違う価値観を丸ごと受け取ることで、予期しなかった革新が生まれる力',
  'mindfulness|implementation':'受け取ったものを咀嚼し、すぐに動ける形へ変える力',
  'mindfulness|influence':   '相手を深く受け取った状態で動くことで、その姿が周囲に自然と波及する力',
  'mindshift|idea':          '視点が変わった瞬間を逃さず、新しい時代の一歩へ転じる力',
  'mindshift|innovation':    '常識の外側から見続けているから、誰も気づかなかった枠を破る力',
  'mindshift|implementation':'転換した発想を、その熱のまま現実に打ち込む力',
  'mindshift|influence':     '自らの変化を体で示すことで、周囲の変化を促す力',
  'mastery|idea':            '積み上げた経験を土台に、社会を動かす一歩を迷いなく踏み出す力',
  'mastery|innovation':      '深く知り尽くしているからこそ、本質から新たな革新を立ち上げる力',
  'mastery|implementation':  '熟達した技術をもとに、構想を確実に形にしきる力',
  'mastery|influence':       '積み重ねた実績が、言葉を超えて周囲に影響を及ぼす力',
  // ━ 知×衝 NAVIGATOR（知×衝）━
  'learning|idea':           '自分の知識に慢心せず問い続けるから、誰も気づいていない可能性の扉から、世界を動かす一歩を踏み出せる力',
  'learning|innovation':     '自分の理解が不完全だと知っているから、既存の枠を手放して、新しい秩序を生み出せる力',
  'learning|implementation': '過信をせず進むから、試しながら修正しながら最後まで形にしきれる力',
  'learning|influence':      '自分の知識をひけらかさないから、その在り方が静かに周囲の心を動かす力',
  'logical|idea':            '論理で状況を整理しているから、動き出すべき瞬間と方向を見誤らずに一歩を踏み出せる力',
  'logical|innovation':      '論理的に物事を見れるから、感情ではなく根拠で、時代の流れを変えられる力',
  'logical|implementation':  '論理で設計図を引いてから動くから、構想を途中で止めずに、最後まで実装し切る力',
  'logical|influence':       '論理が明快だから、腑に落ちた人から、行動の波が次々と広がる力',
  'life|idea':               '考えるより先に動く習慣があるから、誰より先に、時代の起点に立つ力',
  'life|innovation':         '実際に動いて体感しているから、現場の手応えが、変革の火種になる力',
  'life|implementation':     '手を動かし続けてきたから、止まらずに構想を、現実に落とし込む力',
  'life|influence':          '自分が実際に動いている背中を見て、周囲が動き出す力',
  'leadership|idea':         '知識と経験を束ねているから、踏み出す一歩が時代の大きな流れを起動させる力',
  'leadership|innovation':   '異なる知識と経験を統合しているから、誰も気づかなかった場所に、変革の突破口を開く力',
  'leadership|implementation':'全体像を握っているから、複雑な構想でも矛盾を出さずに完成させる力',
  'leadership|influence':    '人と知識を束ねているから、一人では届かない場所まで、影響の波を広げる力',
  // ━ 技×衝 STRIKER（技×衝）━
  'critical|idea':           '本質が見えているから、未知の世界でも迷わず踏み出せる力',
  'critical|innovation':     '本質を掴んでいるから、表面ではなく根っこから世界を変える力',
  'critical|implementation': '何が核心かを知っているから、余計なものを削ぎ落として最後まで形にしきる力',
  'critical|influence':      '本質だけを届けることで、人の心に深く響く力',
  'creativity|idea':         'まだ誰も見ていない世界を頭の中で描けるから、踏み出す一歩が新しい時代の扉を開ける力',
  'creativity|innovation':   '存在しないものを創り続けることで、革新を起こす力',
  'creativity|implementation':'頭の中のビジョンを鮮明に描き切れるから、そのまま止まらず現実に落とし込む力',
  'creativity|influence':    '世界にまだなかったものを創り出すから、見た人の常識を揺さぶる力',
  'communication|idea':      '相手の心が動く言葉を選び、人の人生を変える一歩を生み出す力',
  'communication|innovation':'相手が受け取れる形で言葉を届けるから、その言葉がその人の在り方を変えていく力',
  'communication|implementation':'思いを言葉に変換することで、迷わず最後まで実装できる力',
  'communication|influence': '相手に届く言葉を選び続けることで、人の行動に変化を生む力',
  'collaboration|idea':      '人の持ち味を見抜いて束ねるから、一人では立てない場所に最初の一歩を踏み出せる力',
  'collaboration|innovation':'異なる強みをひとつに集中させるから、一人では届かない変革の扉をこじ開ける力',
  'collaboration|implementation':'誰が何をすべきかを見極めて配置するから、チームが一体となって構想を最後まで完成させる力',
  'collaboration|influence': '一人ひとりの持ち味を最大限に引き出して束ねるから、その合力が社会を動かす力',
  // ━ 衝×衝 PIONEER（衝×衝）━
  'idea|innovation':         '最初の一歩が、新しい時代のきっかけになる力',
  'idea|implementation':     '動き出す勢いのまま、止まらず形にしきる力',
  'idea|influence':          '自分が動いたことで、周囲が動き出す力',
  'innovation|implementation':'革新したことを、止まらずに形にしきる力',
  'innovation|influence':    '革新的な行動が、影響を与え広げていく力',
  'implementation|influence':'形にしたものが動き始めることで、周囲を巻き込んでいく力',
};

// ── 120ペア 3文字ショートネーム ──────────────────────────
const PAIR_SHORT = {
  // ━ 志×志 ANCHOR（基×基）━
  'meaning|mindfulness':    '基認力', 'meaning|mindshift':      '基転力',
  'meaning|mastery':        '基熟力', 'mindfulness|mindshift':  '認転力',
  'mindfulness|mastery':    '認熟力', 'mindshift|mastery':      '転熟力',
  // ━ 志×知 VISIONARY（基×知）━
  'meaning|learning':       '基謙力', 'meaning|logical':        '基論力',
  'meaning|life':           '基活力', 'meaning|leadership':     '基統力',
  'mindfulness|learning':   '認謙力', 'mindfulness|logical':    '認論力',
  'mindfulness|life':       '認活力', 'mindfulness|leadership': '認統力',
  'mindshift|learning':     '転謙力', 'mindshift|logical':      '転論力',
  'mindshift|life':         '転活力', 'mindshift|leadership':   '転統力',
  'mastery|learning':       '熟謙力', 'mastery|logical':        '熟論力',
  'mastery|life':           '熟活力', 'mastery|leadership':     '熟統力',
  // ━ 志×技 BUILDER（基×技）━
  'meaning|critical':       '基本力', 'meaning|creativity':     '基創力',
  'meaning|communication':  '基伝力', 'meaning|collaboration':  '基協力',
  'mindfulness|critical':   '認本力', 'mindfulness|creativity': '認創力',
  'mindfulness|communication':'認伝力','mindfulness|collaboration':'認協力',
  'mindshift|critical':     '転本力', 'mindshift|creativity':   '転創力',
  'mindshift|communication':'転伝力', 'mindshift|collaboration':'転協力',
  'mastery|critical':       '熟本力', 'mastery|creativity':     '熟創力',
  'mastery|communication':  '熟伝力', 'mastery|collaboration':  '熟協力',
  // ━ 知×知 SAGE（知×知）━
  'learning|logical':       '謙論力', 'learning|life':          '謙活力',
  'learning|leadership':    '謙統力', 'logical|life':           '論活力',
  'logical|leadership':     '論統力', 'life|leadership':        '活統力',
  // ━ 知×技 CRAFTER（知×技）━
  'learning|critical':      '謙本力', 'learning|creativity':    '謙創力',
  'learning|communication': '謙伝力', 'learning|collaboration': '謙協力',
  'logical|critical':       '論本力', 'logical|creativity':     '論創力',
  'logical|communication':  '論伝力', 'logical|collaboration':  '論協力',
  'life|critical':          '活本力', 'life|creativity':        '活創力',
  'life|communication':     '活伝力', 'life|collaboration':     '活協力',
  'leadership|critical':    '統本力', 'leadership|creativity':  '統創力',
  'leadership|communication':'統伝力','leadership|collaboration':'統協力',
  // ━ 技×技 INVENTOR（技×技）━
  'critical|creativity':    '本創力', 'critical|communication': '本伝力',
  'critical|collaboration': '本協力', 'creativity|communication':'創伝力',
  'creativity|collaboration':'創協力','communication|collaboration':'伝協力',
  // ━ 志×衝 CATALYST（基×衝）━
  'meaning|idea':           '基構力', 'meaning|innovation':     '基革力',
  'meaning|implementation': '基装力', 'meaning|influence':      '基響力',
  'mindfulness|idea':       '認構力', 'mindfulness|innovation': '認革力',
  'mindfulness|implementation':'認装力','mindfulness|influence': '認響力',
  'mindshift|idea':         '転構力', 'mindshift|innovation':   '転革力',
  'mindshift|implementation':'転装力', 'mindshift|influence':   '転響力',
  'mastery|idea':           '熟構力', 'mastery|innovation':     '熟革力',
  'mastery|implementation': '熟装力', 'mastery|influence':      '熟響力',
  // ━ 知×衝 NAVIGATOR（知×衝）━
  'learning|idea':          '謙構力', 'learning|innovation':    '謙革力',
  'learning|implementation':'謙装力', 'learning|influence':     '謙響力',
  'logical|idea':           '論構力', 'logical|innovation':     '論革力',
  'logical|implementation': '論装力', 'logical|influence':      '論響力',
  'life|idea':              '活構力', 'life|innovation':        '活革力',
  'life|implementation':    '活装力', 'life|influence':         '活響力',
  'leadership|idea':        '統構力', 'leadership|innovation':  '統革力',
  'leadership|implementation':'統装力','leadership|influence':  '統響力',
  // ━ 技×衝 STRIKER（技×衝）━
  'critical|idea':          '本構力', 'critical|innovation':    '本革力',
  'critical|implementation':'本装力', 'critical|influence':     '本響力',
  'creativity|idea':        '創構力', 'creativity|innovation':  '創革力',
  'creativity|implementation':'創装力','creativity|influence':  '創響力',
  'communication|idea':     '伝構力', 'communication|innovation':'伝革力',
  'communication|implementation':'伝装力','communication|influence':'伝響力',
  'collaboration|idea':     '協構力', 'collaboration|innovation':'協革力',
  'collaboration|implementation':'協装力','collaboration|influence':'協響力',
  // ━ 衝×衝 PIONEER（衝×衝）━
  'idea|innovation':        '構革力', 'idea|implementation':    '構装力',
  'idea|influence':         '構響力', 'innovation|implementation':'革装力',
  'innovation|influence':   '革響力', 'implementation|influence':'装響力',
};

export function pairShort(kA, kB) {
  const ia = ORDERED.indexOf(kA), ib = ORDERED.indexOf(kB);
  const key = ia < ib ? `${kA}|${kB}` : `${kB}|${kA}`;
  return PAIR_SHORT[key] ?? '';
}

export function pairDef(kA, kB) {
  const ia = ORDERED.indexOf(kA), ib = ORDERED.indexOf(kB);
  const key = ia < ib ? `${kA}|${kB}` : `${kB}|${kA}`;
  return PAIR_DEFS[key] ?? '';
}

// ── ユーティリティ ─────────────────────────────────
const toRgba = (hex, a) => {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${(+a).toFixed(2)})`;
};

function getZone(sA, sB) {
  const sum = sA + sB;
  if (sA === 20 && sB === 20)                                         return 'natural';
  if ((sA >= 16 && sB >= 16) || (sA >= 15 && sB >= 15 && sum >= 32)) return 'pro';
  if (sA >= 12 && sB >= 12 && sum <= 31)                             return 'active';
  if (sA >= 10 && sB >= 10 && sum >= 22 && !(sA >= 12 && sB >= 12)) return 'potential'; // 片方12未満のみ
  return 'dormant';
}

function zAlpha(z, sA, sB) {
  if (z === 'natural') return 1.0; // 20×20 — 最大発動

  const sum = sA + sB;
  // リニアスケール: 1点差でも目に見える変化を確保
  const linear = (val, min, max) => Math.max(0, Math.min(1, (val - min) / (max - min)));

  if (z === 'pro') {
    // 合計32（最小）→ 合計40（最大）: 0.18〜1.0（1点差≈0.10変化）
    return 0.18 + linear(sum, 32, 40) * 0.82;
  }
  if (z === 'active') {
    // 合計24=12+12（最小）→ 合計31（最大）: 0.10〜0.88（1点差≈0.11変化）
    return 0.10 + linear(sum, 24, 31) * 0.78;
  }
  if (z === 'potential') {
    // 合計22（最小）→ 合計30（最大）: 0.05〜0.55（1点差≈0.06変化）
    return 0.05 + linear(sum, 22, 30) * 0.50;
  }
  return 0.06;
}

export function getBlock(kA, kB) {
  const gA = CODE_GRP[kA], gB = CODE_GRP[kB];
  const pMin = Math.min(gA,gB), pMax = Math.max(gA,gB);
  return BLOCKS.find(b => {
    const bMin = Math.min(...b.axes), bMax = Math.max(...b.axes);
    return bMin === pMin && bMax === pMax;
  });
}

function buildScoreMap(scores, maxSub) {
  const map = {};
  ORDERED.forEach(k => {
    const axisKey = AXIS_KEYS[CODE_GRP[k]];
    const raw = scores?.[axisKey]?.subs?.[k] ?? 0;
    map[k] = Math.round((raw / maxSub) * 20);
  });
  return map;
}

// ── メインコンポーネント ──────────────────────────────
/**
 * mirror=true  → 左三角（scaleX反転）＋ zones=['potential','dormant']
 * zones        → 表示するゾーン（null = 全表示）
 */
export default function AllPairsTriangle({ scores, maxSub = 20, mirror = false, zones = null }) {
  // ヘッダー表示を zones から派生（mirror に依存しない）
  const isLatent = zones && zones.includes('potential') && !zones.includes('active');
  const smap = useMemo(() => buildScoreMap(scores, maxSub), [scores, maxSub]);
  const [tip, setTip] = useState(null);

  // 16素子 TOP5
  const elemTop5 = useMemo(() =>
    ORDERED.map(k => ({ key: k, score: smap[k] }))
           .sort((a, b) => b.score - a.score)
           .slice(0, 5),
    [smap]
  );

  // 120ペア TOP5
  const pairTop5 = useMemo(() => {
    const pairs = [];
    for (let i = 0; i < N - 1; i++)
      for (let j = i + 1; j < N; j++)
        pairs.push({ kA: ORDERED[i], kB: ORDERED[j], score: smap[ORDERED[i]] * smap[ORDERED[j]] });
    return pairs.sort((a, b) => b.score - a.score).slice(0, 5);
  }, [smap]);

  // 10ブロック合計
  const blockTotals = useMemo(() => BLOCKS.map(b => {
    const bMin = Math.min(...b.axes), bMax = Math.max(...b.axes);
    let total = 0;
    for (let i = 0; i < N - 1; i++)
      for (let j = i + 1; j < N; j++) {
        const gA = CODE_GRP[ORDERED[i]], gB = CODE_GRP[ORDERED[j]];
        if (Math.min(gA,gB) === bMin && Math.max(gA,gB) === bMax)
          total += smap[ORDERED[i]] * smap[ORDERED[j]];
      }
    return total;
  }), [smap]);
  const maxTotal = Math.max(...blockTotals, 1);

  const cellColor = useCallback((kA, kB) => {
    const sA = smap[kA], sB = smap[kB];
    const z  = getZone(sA, sB);
    return toRgba(ZONE_HEX[z], zAlpha(z, sA, sB));
  }, [smap]);

  return (
    <div className="uaam-chart pdf-section" style={{
      background: '#FFFFFF',
      borderRadius: 16,
      padding: '32px 28px',
      marginBottom: 20,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      border: '1px solid #E8E0D4',
    }}>

      {/* ── ヘッダー ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.14em', color: isLatent ? '#7A4A7A' : '#B8960C', textTransform: 'uppercase', marginBottom: 6, fontWeight: 600 }}>
          {isLatent ? 'Activation Matrix — Latent Zone' : 'Activation Matrix — Active Zone'}
        </div>
        <h2 style={{
          fontFamily: "'Noto Serif JP', Georgia, serif",
          fontSize: 22, fontWeight: 700, color: '#1A1A1A',
          margin: 0, letterSpacing: '0.02em',
        }}>才覚発動領域</h2>
        <p style={{ fontSize: 13, color: '#666', margin: '6px 0 0', fontWeight: 400 }}>
          {isLatent
            ? '16素子 × 120ペア — POTENTIAL ゾーン'
            : '16素子 × 120ペア — FULL & ACTIVE ゾーン'}
        </p>
        <div style={{ width: 48, height: 2, background: isLatent ? 'linear-gradient(90deg,#7A4A7A,#C480C4)' : 'linear-gradient(90deg,#B8960C,#E8C547)', marginTop: 12, borderRadius: 1 }} />
      </div>

      {/* ── TOP5 ランキング ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>

        {/* 16素子 TOP5 */}
        <div style={{ background: '#FAFAF8', border: '1px solid #EDEAE4', borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 4, height: 16, background: '#B8960C', borderRadius: 2 }} />
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#555', textTransform: 'uppercase' }}>
              16素子 Top 5
            </div>
          </div>
          {elemTop5.map((e, rank) => {
            const g   = CODE_GRP[e.key];
            const pct = e.score / 20;
            return (
              <div key={e.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: rank < 4 ? 10 : 0 }}>
                <div style={{
                  width: 20, fontSize: 11, fontWeight: 700,
                  color: rank === 0 ? '#B8960C' : '#AAA',
                  flexShrink: 0, textAlign: 'center',
                }}>{RANK_NUM[rank]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: AXIS_HEX[g] }}>
                      {SUB_JP[e.key]}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#333', fontFamily: "'Outfit', sans-serif" }}>
                      {e.score}
                    </span>
                  </div>
                  <div style={{ height: 5, background: '#EDEAE4', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      background: AXIS_HEX[g],
                      width: `${pct * 100}%`,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 120ペア TOP5 */}
        <div style={{ background: '#FAFAF8', border: '1px solid #EDEAE4', borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 4, height: 16, background: '#B8960C', borderRadius: 2 }} />
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#555', textTransform: 'uppercase' }}>
              120ペア Top 5
            </div>
          </div>
          {pairTop5.map((p, rank) => {
            const blk = getBlock(p.kA, p.kB);
            const z   = getZone(smap[p.kA], smap[p.kB]);
            const zc  = ZONE_HEX[z];
            const pct = p.score / 40;
            return (
              <div key={`${p.kA}-${p.kB}`} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: rank < 4 ? 10 : 0 }}>
                <div style={{
                  width: 20, fontSize: 11, fontWeight: 700,
                  color: rank === 0 ? '#B8960C' : '#AAA',
                  flexShrink: 0, textAlign: 'center',
                }}>{RANK_NUM[rank]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: zc }}>
                      {SUB_JP[p.kA]} × {SUB_JP[p.kB]}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#333', fontFamily: "'Outfit', sans-serif" }}>
                      {p.score}
                    </span>
                  </div>
                  <div style={{ height: 5, background: '#EDEAE4', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      background: zc,
                      width: `${pct * 100}%`,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                  {blk && (
                    <div style={{ fontSize: 10, color: '#BBB', marginTop: 2 }}>{blk.name}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── ゾーン凡例 ── */}
      <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #EDEAE4' }}>
        {/* 右側ゾーン */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#AAA', letterSpacing: '0.1em', textTransform: 'uppercase', minWidth: 52 }}>右側</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {RIGHT_ZONES.map(z => (
              <div key={z} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, marginTop: 2, background: toRgba(ZONE_HEX[z], 0.85) }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: ZONE_HEX[z], letterSpacing: '0.05em' }}>{ZONE_LABEL[z]}</div>
                  <div style={{ fontSize: 10, color: '#888', marginTop: 1, lineHeight: 1.4 }}>{ZONE_DESC[z]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* 左側ゾーン */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#AAA', letterSpacing: '0.1em', textTransform: 'uppercase', minWidth: 52 }}>左側</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {LEFT_ZONES.map(z => (
              <div key={z} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, marginTop: 2, background: toRgba(ZONE_HEX[z], z === 'dormant' ? 0.55 : 0.75) }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: ZONE_HEX[z], letterSpacing: '0.05em' }}>{ZONE_LABEL[z]}</div>
                  <div style={{ fontSize: 10, color: '#888', marginTop: 1, lineHeight: 1.4 }}>{ZONE_DESC[z]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 三角マトリックス（右三角 or 左三角） ── */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'inline-block', padding: '4px 2px 8px', transform: mirror ? 'scaleX(-1)' : 'none' }}>
          {Array.from({ length: N - 1 }, (_, i) => (
            <div key={i} style={{ display: 'flex', gap: GAP, marginBottom: GAP, paddingLeft: i * STEP }}>
              {/* 行ラベル */}
              <div style={{
                width: CELL, height: CELL, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, borderRadius: 4,
                color: AXIS_LIGHT[CODE_GRP[ORDERED[i]]],
                background: AXIS_DIM[CODE_GRP[ORDERED[i]]],
                transform: mirror ? 'scaleX(-1)' : 'none',
              }}>
                {SUB_JP[ORDERED[i]].slice(0, 2)}
              </div>
              {/* セル（i+1 〜 N-1） */}
              {Array.from({ length: N - i - 1 }, (_, d) => {
                const j = i + 1 + d;
                const kA = ORDERED[i], kB = ORDERED[j];
                const z = getZone(smap[kA], smap[kB]);
                const visible = !zones || zones.includes(z);
                const cellName = pairShort(kA, kB);
                return (
                  <div key={j} style={{
                    width: CELL, height: CELL, borderRadius: 4, flexShrink: 0,
                    background: visible ? cellColor(kA, kB) : 'rgba(0,0,0,0.05)',
                    cursor: visible ? 'pointer' : 'default',
                    transition: 'transform 0.12s, box-shadow 0.12s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                    onMouseEnter={visible ? e => {
                      e.currentTarget.style.transform = mirror ? 'scaleX(-1) scale(1.3)' : 'scale(1.3)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.22)';
                      e.currentTarget.style.zIndex = '20';
                      setTip({ kA, kB, x: e.clientX, y: e.clientY });
                    } : undefined}
                    onMouseMove={visible ? e => setTip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null) : undefined}
                    onMouseLeave={visible ? e => {
                      e.currentTarget.style.transform = '';
                      e.currentTarget.style.boxShadow = '';
                      e.currentTarget.style.zIndex = '';
                      setTip(null);
                    } : undefined}
                  >
                    {visible && cellName && (
                      <span style={{
                        fontSize: 8, fontWeight: 700, lineHeight: 1,
                        color: 'rgba(255,255,255,0.95)',
                        textAlign: 'center', pointerEvents: 'none',
                        letterSpacing: '0em', whiteSpace: 'nowrap',
                        transform: mirror ? 'scaleX(-1)' : 'none',
                        display: 'inline-block',
                      }}>
                        {cellName}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {/* 底辺ラベル */}
          <div style={{ display: 'flex', gap: GAP, marginTop: 6 }}>
            {ORDERED.map((k, j) => (
              <div key={j} style={{
                width: CELL, flexShrink: 0,
                fontSize: 9, textAlign: 'center', fontWeight: 700,
                color: AXIS_LIGHT[CODE_GRP[k]],
                transform: mirror ? 'scaleX(-1)' : 'none',
              }}>
                {SUB_JP[k].slice(0, 2)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 軸カラー凡例 */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10, marginBottom: 28 }}>
        {AXIS_JP.map((label, g) => (
          <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: AXIS_HEX[g] }} />
            <span style={{ color: AXIS_HEX[g], fontWeight: 600 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── 10ブロック スコア ── */}
      <div style={{ borderTop: '1px solid #EDEAE4', paddingTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ width: 4, height: 16, background: '#B8960C', borderRadius: 2 }} />
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#555', textTransform: 'uppercase' }}>
            10 Blocks Score
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
          {BLOCKS.map((b, idx) => {
            const pct    = blockTotals[idx] / maxTotal;
            const topIdx = blockTotals.indexOf(Math.max(...blockTotals));
            const isTop  = idx === topIdx;
            const color  = AXIS_HEX[b.axes[0]];
            return (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
                background: isTop ? toRgba(color, 0.06) : 'transparent',
                border: isTop ? `1px solid ${toRgba(color, 0.2)}` : '1px solid transparent',
              }}>
                <div style={{ minWidth: 72 }}>
                  <div style={{ fontSize: 10, color: '#999', letterSpacing: '0.04em' }}>{b.name}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isTop ? color : '#333' }}>{b.jp}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 6, background: '#EDEAE4', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      background: color,
                      width: `${pct * 100}%`,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
                <div style={{
                  fontSize: 12, fontWeight: 800, color: isTop ? color : '#888',
                  minWidth: 44, textAlign: 'right',
                  fontFamily: "'Outfit', sans-serif",
                }}>
                  {blockTotals[idx].toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── ツールチップ ── */}
      {tip && (() => {
        const sA  = smap[tip.kA], sB = smap[tip.kB];
        const z   = getZone(sA, sB);
        const zc  = ZONE_HEX[z];
        const blk = getBlock(tip.kA, tip.kB);
        let x = tip.x + 16, y = tip.y - 50;
        if (typeof window !== 'undefined') {
          if (x + 200 > window.innerWidth) x = tip.x - 210;
          if (y < 8) y = tip.y + 16;
        }
        return (
          <div style={{
            position: 'fixed', left: x, top: y, zIndex: 9999,
            background: '#FFFFFF', border: '1px solid #E8E0D4',
            borderRadius: 12, padding: '12px 16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            pointerEvents: 'none', minWidth: 190,
          }}>
            <div style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 15, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
              {SUB_JP[tip.kA]} × {SUB_JP[tip.kB]}
            </div>
            <div style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: 20, marginBottom: 8,
              background: toRgba(zc, 0.1), color: zc,
              border: `1px solid ${toRgba(zc, 0.4)}`,
              fontSize: 11, fontWeight: 700,
            }}>{ZONE_LABEL[z]}</div>
            <div style={{ color: '#555', fontSize: 12, lineHeight: 1.8 }}>
              <div>スコア <span style={{ color: '#1A1A1A', fontWeight: 800, fontFamily: "'Outfit'" }}>{sA}</span> + <span style={{ color: '#1A1A1A', fontWeight: 800, fontFamily: "'Outfit'" }}>{sB}</span> = <span style={{ color: zc, fontWeight: 800, fontSize: 14, fontFamily: "'Outfit'" }}>{sA + sB}</span></div>
              {blk && <div style={{ color: '#AAA', fontSize: 11, marginTop: 2 }}>{blk.name} / {blk.jp}</div>}
              {pairDef(tip.kA, tip.kB) && (
                <div style={{
                  marginTop: 8, paddingTop: 8,
                  borderTop: '1px solid #F0EAE0',
                  color: '#444', fontSize: 12, fontWeight: 500,
                  lineHeight: 1.5,
                }}>
                  {pairDef(tip.kA, tip.kB)}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SymmetricMatrix — 16×16 上三角マトリクス（最適化版）
//   右上▲ = 全ゾーン（NATURAL/PRO/ACTIVE/POTENTIAL）を色強度で表示
//   左下▽ = 非表示（視覚ノイズ除去）
//   対角  = 素子ラベル
// ─────────────────────────────────────────────────────────────
export function SymmetricMatrix({ scores, maxSub = 20 }) {
  const smap = useMemo(() => buildScoreMap(scores, maxSub), [scores, maxSub]);
  const [tip, setTip] = useState(null);

  const SCELL = 28, SGAP = 2;
  const LABEL_W = 36;

  // 全ペアをスコア合計順で取得
  const activePairs = useMemo(() => {
    const pairs = [];
    for (let i = 0; i < N - 1; i++) {
      for (let j = i + 1; j < N; j++) {
        const kA = ORDERED[i], kB = ORDERED[j];
        const sA = smap[kA], sB = smap[kB];
        const z = getZone(sA, sB);
        if (z !== 'dormant') pairs.push({ kA, kB, sA, sB, z, sum: sA + sB });
      }
    }
    return pairs.sort((a, b) => b.sum - a.sum);
  }, [smap]);

  // 右上三角 表示セットを構築:
  // ① NATURAL + PRO → 全て表示（10超えてもOK）
  // ② 10未満なら ACTIVE（sum降順）で埋める
  // ③ それでも10未満なら POTENTIAL（sum降順）で埋める
  const shownRightSet = useMemo(() => {
    const shown = new Set();
    // ① NATURAL + PRO 全部
    for (const p of activePairs) {
      if (p.z === 'natural' || p.z === 'pro') shown.add(`${p.kA}|${p.kB}`);
    }
    // ② ACTIVE で10まで埋める
    if (shown.size < 10) {
      const actives = activePairs.filter(p => p.z === 'active');
      for (const p of actives) {
        if (shown.size >= 10) break;
        shown.add(`${p.kA}|${p.kB}`);
      }
    }
    // ③ POTENTIAL で10まで埋める（activePairsにはpotentialも含まれる）
    if (shown.size < 10) {
      const potentials = [...activePairs].sort((a, b) => b.sum - a.sum).filter(p => p.z === 'potential');
      for (const p of potentials) {
        if (shown.size >= 10) break;
        shown.add(`${p.kA}|${p.kB}`);
      }
    }
    return shown;
  }, [activePairs]);

  const top10Pairs = activePairs.slice(0, 10);

  return (
    <div className="uaam-chart pdf-section" style={{
      background: 'linear-gradient(145deg, #FDFAF5 0%, #FFFFFF 50%, #F8F4EF 100%)',
      borderRadius: 16,
      padding: '28px 24px', marginBottom: 20,
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
      border: '1px solid #E8E0D4',
    }}>
      {/* ── ヘッダー ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.14em', color: '#7A4A9A', textTransform: 'uppercase', marginBottom: 6, fontWeight: 600 }}>
          Unique Ability Activate Matrix
        </div>
        <h2 style={{ fontFamily: "'Noto Serif JP', Georgia, serif", fontSize: 20, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
          才覚発動領域Matrix
        </h2>
        <div style={{ width: 56, height: 2, background: 'linear-gradient(90deg, #8B35C8, #1A6FD4, #7CB82F)', marginTop: 10, borderRadius: 1 }} />
      </div>

      {/* ── コンパクト凡例（1行）── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { z: 'natural',   label: 'NATURAL ✦' },
          { z: 'pro',       label: 'PRO' },
          { z: 'active',    label: 'ACTIVE' },
          { z: 'potential', label: 'POTENTIAL' },
        ].map(({ z, label }) => (
          <div key={z} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: ZONE_HEX[z], flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: ZONE_HEX[z], fontWeight: 700, letterSpacing: '0.04em' }}>{label}</span>
          </div>
        ))}
        <span style={{ fontSize: 10, color: '#BBB', marginLeft: 4 }}>— セルにマウスで詳細</span>
      </div>

      {/* ── マトリクス本体 ── */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'inline-block' }}>

          {/* 列ラベル（上部） */}
          <div style={{ display: 'flex', marginLeft: LABEL_W + SGAP, marginBottom: SGAP }}>
            {ORDERED.map(colKey => (
              <div key={colKey} style={{
                width: SCELL, marginRight: SGAP, flexShrink: 0,
                textAlign: 'center', fontSize: 8, fontWeight: 600,
                color: AXIS_LIGHT[CODE_GRP[colKey]], lineHeight: 1.2, paddingBottom: 2,
              }}>
                {SUB_JP[colKey].slice(0, 2)}
              </div>
            ))}
          </div>

          {/* 行 */}
          {ORDERED.map((rowKey, i) => {
            const grp = CODE_GRP[rowKey];
            return (
              <div key={rowKey} style={{ display: 'flex', marginBottom: SGAP, alignItems: 'center' }}>

                {/* 行ラベル */}
                <div style={{
                  width: LABEL_W, marginRight: SGAP, flexShrink: 0,
                  fontSize: 9, fontWeight: 600,
                  color: AXIS_HEX[grp],
                  textAlign: 'right', paddingRight: 5,
                }}>
                  {SUB_JP[rowKey].slice(0, 3)}
                </div>

                {/* セル */}
                {ORDERED.map((colKey, j) => {

                  // ── 対角 ── スコア強度で枠太さが変わる
                  if (i === j) {
                    const sc = smap[rowKey];
                    const ratio = sc / 20;
                    const borderOpacity = 0.25 + ratio * 0.75;
                    const borderWidth = Math.round(1 + ratio * 2);
                    return (
                      <div key={colKey} style={{
                        width: SCELL, height: SCELL, marginRight: SGAP, flexShrink: 0,
                        background: 'transparent',
                        border: `${borderWidth}px solid ${toRgba(AXIS_HEX[grp], borderOpacity)}`,
                        borderRadius: 4,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 7, fontWeight: 700, color: AXIS_HEX[grp],
                        lineHeight: 1.1, textAlign: 'center',
                      }}>
                        {SUB_JP[rowKey].slice(0, 3)}
                      </div>
                    );
                  }

                  // ── 右上三角（j > i）: shownRightSet に含まれるペアのみ表示 ──
                  if (j > i) {
                    const sA = smap[rowKey], sB = smap[colKey];
                    const z  = getZone(sA, sB);
                    const show = shownRightSet.has(`${rowKey}|${colKey}`);
                    const alpha = show ? zAlpha(z, sA, sB) : 0;
                    const bg = show ? toRgba(ZONE_HEX[z], alpha) : 'rgba(160,152,136,0.03)';
                    return (
                      <div key={colKey} style={{
                        width: SCELL, height: SCELL, marginRight: SGAP, flexShrink: 0,
                        background: bg, borderRadius: 3,
                        cursor: show ? 'pointer' : 'default',
                        transition: 'transform 0.12s',
                      }}
                        onMouseEnter={show ? e => { e.currentTarget.style.transform = 'scale(1.3)'; setTip({ kA: rowKey, kB: colKey, z, sA, sB, x: e.clientX, y: e.clientY }); } : undefined}
                        onMouseMove={show ? e => setTip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null) : undefined}
                        onMouseLeave={show ? e => { e.currentTarget.style.transform = 'none'; setTip(null); } : undefined}
                      />
                    );
                  }

                  // ── 左下三角（j < i）: 全ゾーン表示（dormant=スコア表示）──
                  if (j < i) {
                    const sA = smap[colKey], sB = smap[rowKey];
                    const z  = getZone(sA, sB);
                    const isDormant = z === 'dormant';
                    const bg = isDormant
                      ? 'rgba(160,152,136,0.06)'
                      : toRgba(ZONE_HEX[z], zAlpha(z, sA, sB));
                    return (
                      <div key={colKey} style={{
                        width: SCELL, height: SCELL, marginRight: SGAP, flexShrink: 0,
                        background: bg, borderRadius: 3,
                        cursor: !isDormant ? 'pointer' : 'default',
                        transition: 'transform 0.12s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                        onMouseEnter={!isDormant ? e => { e.currentTarget.style.transform = 'scale(1.3)'; setTip({ kA: colKey, kB: rowKey, z, sA, sB, x: e.clientX, y: e.clientY }); } : undefined}
                        onMouseMove={!isDormant ? e => setTip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null) : undefined}
                        onMouseLeave={!isDormant ? e => { e.currentTarget.style.transform = 'none'; setTip(null); } : undefined}
                      >
                        {isDormant && (
                          <span style={{ fontSize: 6, color: 'rgba(160,152,136,0.45)', fontFamily: "'Outfit', sans-serif", lineHeight: 1, userSelect: 'none' }}>
                            {sA + sB}
                          </span>
                        )}
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── TOP 10 発動ペア ── */}
      {top10Pairs.length > 0 && (
        <div style={{ marginTop: 20, borderTop: '1px solid #EDEAE4', paddingTop: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#AAA', textTransform: 'uppercase', marginBottom: 12 }}>
            Top 10 Active Pairs
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#EDEAE4', borderRadius: 10, overflow: 'hidden', border: '1px solid #EDEAE4' }}>
            {top10Pairs.map((p, rank) => {
              const zc  = ZONE_HEX[p.z];
              const blk = getBlock(p.kA, p.kB);
              const def = pairDef(p.kA, p.kB);
              const maxSum = 40;
              const pct = Math.min((p.sum / maxSum) * 100, 100);
              return (
                <div key={`${p.kA}-${p.kB}`} style={{
                  background: '#FFFFFF', padding: '12px 14px',
                  position: 'relative', overflow: 'hidden',
                }}>
                  {/* 左端ゾーンライン */}
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: zc }} />
                  {/* 順位バッジ */}
                  <div style={{
                    position: 'absolute', top: 8, right: 10,
                    fontSize: 9, fontWeight: 700,
                    color: rank === 0 ? '#B8960C' : '#CCCCCC',
                    fontFamily: "'Outfit', sans-serif",
                  }}>{rank + 1}</div>

                  {/* 名前 + スコア */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 8, marginBottom: 2, paddingRight: 20 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#1A1A1A', letterSpacing: '0.01em' }}>
                      {pairShort(p.kA, p.kB)}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: zc, fontFamily: "'Outfit', sans-serif" }}>
                      {p.sum}pt
                    </span>
                  </div>

                  {/* サブ名 */}
                  <div style={{ paddingLeft: 8, fontSize: 10, color: '#999', marginBottom: 6 }}>
                    {SUB_JP[p.kA]} × {SUB_JP[p.kB]}
                  </div>

                  {/* スコアバー */}
                  <div style={{ paddingLeft: 8, marginBottom: 7 }}>
                    <div style={{ height: 3, borderRadius: 2, background: zc + '22', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg,${zc}88,${zc})`, borderRadius: 2 }} />
                    </div>
                  </div>

                  {/* 説明文 */}
                  {def && (
                    <div style={{ paddingLeft: 8, fontSize: 11, color: '#555', lineHeight: 1.6 }}>
                      {def}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ツールチップ ── */}
      {tip && (() => {
        const zc  = ZONE_HEX[tip.z];
        const blk = getBlock(tip.kA, tip.kB);
        let x = tip.x + 16, y = tip.y - 50;
        if (typeof window !== 'undefined') {
          if (x + 220 > window.innerWidth) x = tip.x - 230;
          if (y < 8) y = tip.y + 16;
        }
        return (
          <div style={{
            position: 'fixed', left: x, top: y, zIndex: 9999,
            background: '#FFFFFF', border: '1px solid #E8E0D4',
            borderRadius: 12, padding: '12px 16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            pointerEvents: 'none', minWidth: 190,
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: zc, marginBottom: 4, fontFamily: "'Noto Serif JP', serif" }}>
              {pairShort(tip.kA, tip.kB)}
            </div>
            <div style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 12, color: '#666', marginBottom: 6 }}>
              {SUB_JP[tip.kA]} × {SUB_JP[tip.kB]}
            </div>
            <div style={{
              display: 'inline-block', padding: '2px 10px', borderRadius: 20, marginBottom: 6,
              background: toRgba(zc, 0.1), color: zc,
              border: `1px solid ${toRgba(zc, 0.4)}`,
              fontSize: 11, fontWeight: 700,
            }}>{ZONE_LABEL[tip.z]}</div>
            <div style={{ color: '#555', fontSize: 12, lineHeight: 1.8 }}>
              <div>{tip.sA} + {tip.sB} = <span style={{ color: zc, fontWeight: 800, fontSize: 14 }}>{tip.sA + tip.sB}</span></div>
              {blk && <div style={{ color: '#AAA', fontSize: 11 }}>{blk.name} / {blk.jp}</div>}
              {pairDef(tip.kA, tip.kB) && (
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #F0EAE0', color: '#444', fontSize: 11, lineHeight: 1.5 }}>
                  {pairDef(tip.kA, tip.kB)}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
