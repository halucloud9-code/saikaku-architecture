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
export const ZONE_LABEL = { natural:'NATURAL ✦', pro:'PRO', active:'ACTIVE', potential:'POTENTIAL', dormant:'DORMANT' };

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
  // ━ 志×志 ANCHOR（6ペア）━
  'meaning|mindfulness': { d1: '軸が定まっているから、どんな価値観も受け入れられる力', d2: '自分の核心が安定しているからこそ他者の異質さを脅威と感じないという構造であり、基軸の深さが認知の幅を決める。', d3: '揺るがない者だけが、揺れを恐れずに受け取れる。' },
  'meaning|mindshift': { d1: 'ぶれない軸があるから、状況に応じて判断を即座に切り替える力', d2: '軸が固定されているからこそ視点を自在に動かせるという逆説であり、基軸の深さが転換の速度と精度を決める。', d3: '芯がある者だけが、柔軟になれる。' },
  'meaning|mastery': { d1: '在り方に沿って、同じ道を深く掘り続ける力', d2: 'WHYが明確だから同じ場所に何度でも戻れるという持続構造であり、在り方と習熟の一致が熟達の密度を決める。', d3: 'なぜやるかが決まった者だけが、深く掘れる。' },
  'mindfulness|mindshift': { d1: '受け取ったものを固定せず、次の形に変える力', d2: '感じた瞬間に更新する反射神経であり、認知の精度が転換の質と速さを決める。', d3: '受け取った分だけ、変えられる。' },
  'mindfulness|mastery': { d1: '時間をかけて受け取り、自分の中に根づかせる力', d2: '感じることと習熟することが螺旋を描きながら深まる構造であり、認知の深さが熟達の質を決める。', d3: '受け取り続けた者だけが、本物になる。' },
  'mindshift|mastery': { d1: '変え続けながらも、確かな技として積み上げる力', d2: '変化を繰り返すなかで本質だけを残す蒸留プロセスであり、転換の回数が熟達の精度を決める。', d3: '変えることを恐れない者だけが、積み上げられる。' },
  // ━ 志×知 VISIONARY（16ペア）━
  'meaning|learning': { d1: '在り方を磨くために、自分を省みて問い続ける力', d2: 'WHYが深いから学びの方向が定まり、謙虚さが在り方に直結するという強化構造であり、問い続ける姿勢が基軸を彫り深める。', d3: '在り方のために学ぶ者は、止まらない。' },
  'meaning|logical': { d1: '在り方の大切さを自分の言葉で整理し、説く力', d2: '信じることを言語化し構造化することで他者に届く説得力が生まれるという発火構造であり、軸と論理の一致が発信の信頼性を決める。', d3: '整合した者の言葉だけが、人を動かす。' },
  'meaning|life': { d1: '在り方を常に意識し、日々の判断や行動に生かす力', d2: 'WHYを日常の選択に持ち込む変換回路であり、在り方の意識化が行動の一貫性と精度を決める。', d3: '在り方を使う者だけが、在り方を生きる。' },
  'meaning|leadership': { d1: '在り方を旗として掲げ、人と力を束ねる力', d2: 'WHYが共鳴軸になり人を自然に集める引力を生むという統率の本質であり、基軸の明確さが束ねる力の規模を決める。', d3: '旗を持った者だけが、人を束ねられる。' },
  'mindfulness|learning': { d1: '異なる意見を受け取るほど、自分の問いが深まる力', d2: '感じることが学びの入り口になる相互強化の構造であり、認知の幅が謙学の深さを決める。', d3: '受け取れる者だけが、問いを深められる。' },
  'mindfulness|logical': { d1: '受け取ったものを整理し、自分の論理に組み替える力', d2: '感じたことを構造に変換するという思考の錬金術であり、認知の精度が論理の独自性を決める。', d3: '感じて整理した者の論理は、自分だけのものになる。' },
  'mindfulness|life': { d1: '受け取ったものをその場で試し、成果に変える力', d2: '感知と実行の間に時間を置かない即時変換の力であり、認知と活用の速度が一致するほど成果が高まる。', d3: '感じた瞬間に動く者だけが、場を変えられる。' },
  'mindfulness|leadership': { d1: '相手の立場を受け入れながら、場の方向を整える力', d2: '個別の感情と集合の方向性を同時に扱う二重処理の力であり、認知の深さが統率の温かさを決める。', d3: '受け取った者だけが、場を整えられる。' },
  'mindshift|learning': { d1: '視点を転換し、自分の偏りに気づく力', d2: '見方を変える力が自己認識の盲点を照らすという内省回路であり、転換の速度が謙虚さの深さを決める。', d3: '変えられる者だけが、自分を見られる。' },
  'mindshift|logical': { d1: '視点を変えながら、新しい論理を構築する力', d2: 'パラダイムの切り替えが既存の論理の限界を超える突破口になるという創造的思考の構造であり、転換の角度が論理の新しさを決める。', d3: '視点を変えた数だけ、論理は新しくなる。' },
  'mindshift|life': { d1: '転換した発想を、即座に現場に投入する力', d2: '視点の切り替えと行動への着地が一体になった即応の力であり、転換から行動までの時間が短いほどインパクトが大きくなる。', d3: '考えが変わった瞬間に動く者だけが、場を変える。' },
  'mindshift|leadership': { d1: '変化の方向をチームと共有し、全員を新しい軸に揃える力', d2: 'パラダイムシフトをチームの共通言語に変換するという転換の社会化プロセスであり、変化を伝える速度が組織変容の規模を決める。', d3: '自分が変われた者だけが、チームを変えられる。' },
  'mastery|learning': { d1: '熟達しているからこそ、まだ知らないことに気づける力', d2: '深さが新たな問いの地平を開くという逆説的な学習構造であり、熟達の密度が謙虚さの質を決める。', d3: '本物だけが、まだ足りないと知っている。' },
  'mastery|logical': { d1: '長年の経験を解体し、再現できる論理として伝える力', d2: '暗黙知を明示知に変換して他者が使える形にする技術であり、熟達の年輪が論理の信頼性を決める。', d3: '経験を言語化できた者だけが、技を世界に残せる。' },
  'mastery|life': { d1: '体に染みた技を、状況に応じて最適な形で使い切る力', d2: '無意識の熟達を意識的な判断で変奏するという最高レベルの応用力であり、熟達の深さが活用の自在性を決める。', d3: '技が体になった者だけが、状況を読んで使い切れる。' },
  'mastery|leadership': { d1: '積み重ねた実績が、言葉より先に人を動かす力', d2: '存在そのものが説得力になるという非言語統率の力であり、熟達の実績が統率の深さを決める。', d3: '歩みが長い者は、語らずに束ねる。' },
  // ━ 知×知 SAGE（6ペア）━
  'learning|logical': { d1: '自分の知識に慢心せず、より正確な論理を組み立てる力', d2: '謙虚さが思考の精度を守る防腐剤になるという認識論的構造であり、慢心しない姿勢が論理の純度を決める。', d3: '知っていると思った瞬間、論理は鈍る。' },
  'learning|life': { d1: '学んだことを正解と思わず、現場で検証し続ける力', d2: '仮説として保持し続ける知的誠実さが行動の質を高めるという実践構造であり、謙虚さの深さが現場での学習速度を決める。', d3: '正解を疑える者だけが、本物の知識を手に入れる。' },
  'learning|leadership': { d1: '自分にないものを認めるから、他者の強みを引き出して束ねる力', d2: '弱さの自覚が他者の力の発見につながるという統率の逆説的構造であり、自己認識の深さが集合知の規模を決める。', d3: '足りないと知っている者だけが、他者の力を借りられる。' },
  'logical|life': { d1: '論理で整理したことを、実際の行動に変換する力', d2: '思考と行動の間に一貫性を保つ実行の論理であり、論理の精度が行動の迷いのなさを決める。', d3: '理解した者だけが、迷わず動ける。' },
  'logical|leadership': { d1: '論理の筋道を共有することで、バラバラな人を一つの方向に揃える力', d2: '共通の構造が合意の基盤になるという集合知の結晶化プロセスであり、論理の明快さが統率の広さを決める。', d3: '理解できる言葉で語る者だけが、多様な人を束ねられる。' },
  'life|leadership': { d1: '自分が実践して得た知見で、チームを動かす力', d2: '自分が動いた事実が言葉の重さを増すという実践的リーダーシップ構造であり、活用の深さが統率の説得力を決める。', d3: 'やった者の言葉だけが、人を動かす。' },
  // ━ 志×技 BUILDER（16ペア）━
  'meaning|critical': { d1: '在り方を持つからこそ、何があっても物事の本質を見極める力', d2: 'WHYの深さが表面の雑音を消し本質を浮かび上がらせるという認識の濾過作用であり、在り方の明確さが本質力の精度を決める。', d3: '軸がある者だけが、本質に到達できる。' },
  'meaning|creativity': { d1: '在り方を起点に、まだ存在しないものを生み出す力', d2: 'WHYが創造の意味と方向を与えるという創造の根拠構造であり、在り方の深さが生み出すものの価値と方向を決める。', d3: 'なぜ創るかが決まった者だけが、世界を変えるものを作れる。' },
  'meaning|communication': { d1: '在り方に込めた想いを、言葉にして人の心に届ける力', d2: 'WHYが言葉に熱を与えるという伝達の根拠構造であり、在り方の深さが言葉の響きと届く深さを決める。', d3: '想いがある者の言葉だけが、心に届く。' },
  'meaning|collaboration': { d1: '在り方を共有することで、自然と人が集まり動く力', d2: 'WHYへの共鳴が自発的な協力を引き出すという共鳴型協働の構造であり、在り方の明確さが集まる人の質を決める。', d3: '在り方が同じ者は、呼ばなくても集まる。' },
  'mindfulness|critical': { d1: '異なる視点を受けるほど、本質が浮かび上がる力', d2: '多様な視点の交差点に本質が現れるという認識の結晶化プロセスであり、受け取る数が多いほど本質の輪郭が鮮明になる。', d3: '受け取れる者だけが、本質を見れる。' },
  'mindfulness|creativity': { d1: '受け取った多様な刺激を組み合わせ、独自のものを生み出す力', d2: '感知した素材を創造の原料に変換する錬金術であり、認知の幅が創造の独自性と意外性を決める。', d3: '多く受け取った者ほど、新しいものを作れる。' },
  'mindfulness|communication': { d1: '相手の言葉を深く受け取り、伝える力へと変える力', d2: '聴くことが伝えることの精度を高めるという双方向伝達の構造であり、認知の深さが言葉の的確さを決める。', d3: '深く聴ける者だけが、深く伝えられる。' },
  'mindfulness|collaboration': { d1: '相手を丸ごと受け入れることで、協力関係が生まれる力', d2: '受容が協働の入り口になるという信頼構築の基礎構造であり、認知の温かさが協働の深さを決める。', d3: '受け入れた者だけが、共に動ける。' },
  'mindshift|critical': { d1: '視点を変えるたびに、本質の解像度を高める力', d2: '多角的な見方が本質への近道になるという思考の収束プロセスであり、転換の角度と回数が本質力の精度を決める。', d3: '見方を変え続ける者だけが、本質に近づける。' },
  'mindshift|creativity': { d1: '常識を転換した瞬間に、新しいアイデアが生まれる力', d2: 'パラダイムの破壊が創造の着火点になるという革新的創造の構造であり、転換の鋭さが生まれるアイデアの新しさを決める。', d3: '常識を壊した者だけが、新しいものを生める。' },
  'mindshift|communication': { d1: '伝わらないと気づいたら、表現を即座に変える力', d2: '相手の反応を感知して伝達の角度を変える適応型コミュニケーションであり、転換の速度が言葉の到達率を決める。', d3: '伝わっていないと気づける者だけが、届けられる。' },
  'mindshift|collaboration': { d1: 'チームの枠を超えた組み合わせから、予想外の力を引き出す力', d2: '固定された関係性を組み替えることで新たな化学反応を起こすという創造的協働の構造であり、転換の大胆さが協働の可能性を決める。', d3: '枠を外した者だけが、思わぬ力を引き出せる。' },
  'mastery|critical': { d1: '積み上げた経験が、本質を瞬時に見抜かせる力', d2: '習熟した感覚が本質への直感を鋭くする経験則の力であり、熟達の深さが本質力の速度と精度を決める。', d3: '積み上げた者だけが、一瞬で本質を掴める。' },
  'mastery|creativity': { d1: '熟達した先にしか見えない景色から、誰も作れなかったものを創る力', d2: '習熟の深みが創造の素材と視点を豊かにするという熟達者の特権的創造力であり、熟達の年輪が創造の唯一性を決める。', d3: '辿り着いた者だけが、その先に何かを創れる。' },
  'mastery|communication': { d1: '熟達した技と知恵を、次の世代に手渡す力', d2: '自分の習熟を他者が再現できる言語に変換するという知の継承プロセスであり、熟達の深さが伝達の普遍性を決める。', d3: '極めた者だけが、本質を次の世代に手渡せる。' },
  'mastery|collaboration': { d1: '熟達した存在がいることで、チーム全体の底が上がる力', d2: '個人の熟達が集合の水準を引き上げる基準点効果であり、熟達の高さがチームの可能性の天井を決める。', d3: '極めた者の存在が、まわりを本物にする。' },
  // ━ 知×技 CRAFTER（16ペア）━
  'learning|critical': { d1: '自分の知識に慢心せず問い続けるから、物事の本質を常に見据えられる力', d2: '謙虚さが本質への視野を常にクリアに保つという認識の防衛構造であり、慢心しない問い続けが本質力の精度を決める。', d3: '知っていると思わない者だけが、本質を見続けられる。' },
  'learning|creativity': { d1: '自分が完全だと思っていないから、まだ見ぬアイデアへの入り口を開ける力', d2: '不完全さの自覚が創造の余白を生み出すという逆説的創造力であり、謙虚さの深さが創造の可能性の広さを決める。', d3: '完成していないと知っている者だけが、新しいものを生める。' },
  'learning|communication': { d1: '自分の理解の限界を知っているから、人から学んだことを本質として届ける力', d2: '自らの限界の自覚が他者の知を誠実に伝える触媒になるという謙学的伝達の構造であり、謙虚さの深さが伝達の正確性を決める。', d3: '知らないと言える者だけが、本物を伝えられる。' },
  'learning|collaboration': { d1: '足りない自分を認めるから、他者の力を最大限に引き出せる力', d2: '自己の不足の承認が他者の強みを活かす空間を生むという開放型協働の構造であり、謙虚さの深さが協働の質を決める。', d3: '足りないと認めた者だけが、他者の力を最大化できる。' },
  'logical|critical': { d1: '感情を抜いて論理で整理するから、複雑な問題の核心を掴める力', d2: '論理的な解体が複雑さの奥にある核心を浮かび上がらせるという分析的本質力であり、論理の精度が本質への到達速度を決める。', d3: '感情を除いた思考だけが、本質に届く。' },
  'logical|creativity': { d1: '論理の筋道を丁寧に追うから、矛盾の瞬間に新しい解を見つける力', d2: '論理の限界点が創造の出発点になるという矛盾突破型創造力であり、論理の精度が飛躍の鋭さを決める。', d3: '丁寧に考えた者だけが、論理の先を見つけられる。' },
  'logical|communication': { d1: '思考の道筋を言語化するから、相手の腑に落ちる説明になる力', d2: '思考の透明化が説得力の源泉になるという論理的伝達の構造であり、論理の明快さが相手への届き方を決める。', d3: '構造を見せた者の言葉だけが、腑に落ちる。' },
  'logical|collaboration': { d1: '論理を共有することで、バラバラな人を同じ方向に揃える力', d2: '共通の思考フレームが協働の基盤になるという論理的結束力であり、論理の共有精度が協働の一体感を決める。', d3: '同じ論理を持つ者は、自然に同じ方向を向く。' },
  'life|critical': { d1: '実際に試しながら進むから、理論では気づけない本質に触れる力', d2: '行動が認識を更新し続ける実践的本質力であり、活用の回数が本質への近接度を決める。', d3: '動いた者だけが、動いてわかる本質に触れられる。' },
  'life|creativity': { d1: '現場の手応えを積み重ねるから、現場からしか生まれないものを生み出す力', d2: '実践の積み重ねが創造の素材になるという現場型創造力であり、活用の深さが創造の独自性を決める。', d3: '現場にいた者だけが、現場にしかないものを創れる。' },
  'life|communication': { d1: '自分が実践したことを言葉にするから、聞いた人が動き出せる話になる力', d2: '体験が言葉に実体を与えるという実践的伝達力であり、活用の深さが言葉の動かす力を決める。', d3: 'やった者だけが、聞いた人を動かせる。' },
  'life|collaboration': { d1: '実践から得た知見を惜しみなく渡すから、チームの行動が加速する力', d2: '自分の活用経験を共有財産にする開放型協働の推進力であり、渡す知見の深さがチームの加速度を決める。', d3: '惜しみなく渡した者だけが、チームを加速させられる。' },
  'leadership|critical': { d1: '多様な知識と経験を統合することで、物事のつながりを本質から見抜く力', d2: '統合された視野が表面的な繋がりの奥にある本質的な構造を照らすという複眼的本質力であり、統率の幅が本質力の深さを決める。', d3: '全体を束ねた者だけが、つながりの本質を見抜ける。' },
  'leadership|creativity': { d1: '異質なものを束ねるから、一つの要素では生まれない突破口を開ける力', d2: '異質の統合が新結合を生む創造の化学反応であり、統率の多様性が創造の爆発力を決める。', d3: '異なるものを束ねた者だけが、一人では生めないものを創れる。' },
  'leadership|communication': { d1: '全体像を把握しているから、誰にとっても意味が通じる言葉で届けられる力', d2: '全体把握が言葉の普遍性を生むという統率的伝達の構造であり、統率の幅が伝達の届く範囲を決める。', d3: '全体を知っている者だけが、誰にでも伝えられる。' },
  'leadership|collaboration': { d1: '人の持ち味を見抜いて束ねるから、一人では到達できない場所へチームを導く力', d2: '個の強みの最大化と集合の方向付けを同時に行う高次の協働力であり、統率の精度が協働の到達点を決める。', d3: '持ち味を知っている者だけが、チームを遠くへ連れていける。' },
  // ━ 技×技 INVENTOR（6ペア）━
  'critical|creativity': { d1: '表面を削ぎ落とした先にある核から、新しいものを生む力', d2: '本質の把握が創造の純度を高めるという核心的創造力であり、本質の深さが創るものの普遍性を決める。', d3: '本質を掴んだ者だけが、時代を超えるものを作れる。' },
  'critical|communication': { d1: '本質だけを抽出して、相手に過不足なく届ける力', d2: '余剰を削ぎ落とした言葉だけが持つ貫通力であり、本質の把握が伝達の密度を決める。', d3: '本質だけを語る者の言葉は、過不足なく届く。' },
  'critical|collaboration': { d1: '全員が本質を共有することで、協力が自然に加速する力', d2: '本質の共有が協働の摩擦を減らすという本質的協働の構造であり、本質の明確さが協働の速度を決める。', d3: '本質がそろった者たちは、話さなくても動ける。' },
  'creativity|communication': { d1: '創ったものの価値を言語化して、世界に届ける力', d2: '創造と伝達が一体になることで生まれる普及の力であり、伝える精度が創造の価値が届く範囲を決める。', d3: '創れるだけでは足りない。届けた者だけが、世界を変えられる。' },
  'creativity|collaboration': { d1: '一人では生まれない創造を、他者との交差から生む力', d2: '異なる創造力の化学反応が一人では不可能な突破口を開くという協創の本質であり、協働の多様性が創造の可能性を決める。', d3: '一人の創造には限界がある。交差した者だけが、それを超えられる。' },
  'communication|collaboration': { d1: '考えを伝えて理解しあうことで、バラバラな力がひとつに束なる力', d2: '言葉による相互理解が協働の基盤を作るという伝達的協働の構造であり、伝達の深さが協働の結束力を決める。', d3: '伝わった者同士だけが、本当に共に動ける。' },
  // ━ 志×衝 CATALYST（16ペア）━
  'meaning|idea': { d1: '在り方が定まっているから、踏み出す一歩が新しい時代の起点になる力', d2: 'WHYが構想の方向と意味を確定させるという起点の力であり、在り方の深さが構想の射程と確信を決める。', d3: '軸が決まった者だけが、新時代を起点にできる。' },
  'meaning|innovation': { d1: '在り方を軸に持っているから、常識を超えた新しい秩序を生み出す力', d2: 'WHYが変革の根拠になるという存在論的変革力であり、在り方の明確さが変革の正当性と持続力を決める。', d3: '在り方のある者の変革だけが、長く続く。' },
  'meaning|implementation': { d1: '在り方に沿って動き続けるから、思い描いたものを最後まで実現させる力', d2: 'WHYが実装のエネルギー源になるという動因的実装力であり、在り方の深さが最後まで止まらない力を決める。', d3: 'なぜやるかが決まった者だけが、最後まで形にできる。' },
  'meaning|influence': { d1: '在り方で生き続けているから、言葉より先に周囲を動かす力', d2: '存在そのものが波及源になるという在り方的影響力であり、基軸の深さが影響の自然さと広さを決める。', d3: '在り方が一致した者だけが、黙って場を変えられる。' },
  'mindfulness|idea': { d1: '相手の言葉を受け取った瞬間に、それを新たな一歩へ変える力', d2: '感知した情報を即座に行動の起点に変換する認知的構想力であり、認知の鋭さが構想の速度と新鮮さを決める。', d3: '感じた者だけが、その瞬間を起点にできる。' },
  'mindfulness|innovation': { d1: '自分と違う価値観を丸ごと受け取ることで、予期しなかった革新が生まれる力', d2: '受容が革新の触媒になるという感知的変革力であり、認知の幅が変革の意外性を決める。', d3: '受け取った者だけが、想定外の革新を起こせる。' },
  'mindfulness|implementation': { d1: '受け取ったものを咀嚼し、すぐに動ける形へ変える力', d2: '感知から実装への変換速度が際立つ即応型実装力であり、認知の精度が実装の的確さを決める。', d3: '感じて即動く者だけが、現実を変えられる。' },
  'mindfulness|influence': { d1: '相手を深く受け取った状態で動くことで、その姿が周囲に自然と波及する力', d2: '深い受容が存在の影響力を増幅させるという共鳴型影響力であり、認知の深さが影響の波紋の広がりを決める。', d3: '深く受け取った者の動きは、黙って場を変える。' },
  'mindshift|idea': { d1: '視点が変わった瞬間を逃さず、新しい時代の一歩へ転じる力', d2: 'パラダイムの切り替えが新たな構想の出発点になるという転換的構想力であり、転換の鋭さが構想の新しさを決める。', d3: '見方が変わった瞬間を掴んだ者だけが、時代を先取れる。' },
  'mindshift|innovation': { d1: '常識の外側から見続けているから、誰も気づかなかった枠を破る力', d2: '視点の転換が変革の突破口を発見させるという外側的変革力であり、転換の角度が変革の革新性を決める。', d3: '外から見た者だけが、枠の外に出られる。' },
  'mindshift|implementation': { d1: '転換した発想を、その熱のまま現実に打ち込む力', d2: '転換の勢いを実装のエネルギーに転換する即動型実装力であり、転換の熱が実装の速度を決める。', d3: '変わった瞬間に動ける者だけが、世界を変えられる。' },
  'mindshift|influence': { d1: '自らの変化を体で示すことで、周囲の変化を促す力', d2: '自己変容が他者変容の触媒になるという体現型影響力であり、転換の深さが影響の説得力を決める。', d3: '自分が変わった者だけが、他者を変えられる。' },
  'mastery|idea': { d1: '積み上げた経験を土台に、社会を動かす一歩を迷わず踏み出す力', d2: '熟達の重さが構想への確信を生む実績的構想力であり、熟達の深さが踏み出す一歩の影響の重さを決める。', d3: '積み上げた者の一歩は、世界を動かす。' },
  'mastery|innovation': { d1: '深く知り尽くしているからこそ、本質から新たな革新を立ち上げる力', d2: '熟達の深さが変革の根拠と正確さを保証する本質的変革力であり、熟達の年輪が変革の持続性を決める。', d3: '知り尽くした者だけが、本質から変えられる。' },
  'mastery|implementation': { d1: '熟達した技術をもとに、構想を確実に形にしきる力', d2: '習熟の確かさが実装の品質を保証する熟達的実装力であり、熟達の深さが形にしきる確実性を決める。', d3: '極めた者だけが、構想を確実に現実にできる。' },
  'mastery|influence': { d1: '積み重ねた実績が、言葉を超えて周囲に影響を及ぼす力', d2: '熟達の事実が言語を超えた説得力を生む実績的影響力であり、熟達の深さが影響の不可抗力を決める。', d3: '積み上げた者は、語らずとも場を変える。' },
  // ━ 知×衝 NAVIGATOR（16ペア）━
  'learning|idea': { d1: '自分の知識に慢心せず問い続けるから、誰も気づいていない可能性の扉から、世界を動かす一歩を踏み出せる力', d2: '謙虚な問いが未発見の可能性を照らし構想の出発点を生む学習的構想力であり、慢心しない姿勢が構想の独自性を決める。', d3: 'わかっていないと知っている者だけが、誰も見ていない扉を開ける。' },
  'learning|innovation': { d1: '自分の理解が不完全だと知っているから、既存の枠を手放して、新しい秩序を生み出せる力', d2: '不完全さの自覚が変革への開放性を生む謙学的変革力であり、謙虚さの深さが変革の柔軟性を決める。', d3: '完成していないと知る者だけが、枠を手放せる。' },
  'learning|implementation': { d1: '過信をせずに進むから、試しながら修正しながら最後まで形にしきれる力', d2: '謙虚さが修正ループを維持し最後まで走り切らせる持続的実装力であり、慢心しない姿勢が実装の完成度を決める。', d3: '過信しない者だけが、最後まで修正できる。' },
  'learning|influence': { d1: '自分の知識をひけらかさないから、その在り方が静かに周囲の心を動かす力', d2: '謙虚さそのものが影響の源泉になるという在り方的影響力であり、ひけらかさない姿勢が影響の深さを決める。', d3: '持っていても見せない者の在り方だけが、静かに場を動かす。' },
  'logical|idea': { d1: '論理で状況を整理しているから、動き出すべき瞬間と方向を見誤らずに一歩を踏み出せる力', d2: '論理が構想の精度と方向性を保証する論理的構想力であり、論理の明確さが踏み出すタイミングの正確さを決める。', d3: '整理できた者だけが、迷わず踏み出せる。' },
  'logical|innovation': { d1: '論理的に物事を見れるから、感情ではなく根拠で、時代の流れを変えられる力', d2: '論理が変革の根拠と説得力を担保する理論的変革力であり、論理の精度が変革の持続力を決める。', d3: '根拠のある変革だけが、時代を動かせる。' },
  'logical|implementation': { d1: '論理で設計図を引いてから動くから、構想を途中で止めずに、最後まで実装し切れる力', d2: '論理的設計が実装の迷走を防ぐという設計的実装力であり、論理の精度が実装の完成確率を決める。', d3: '設計した者だけが、途中で止まらない。' },
  'logical|influence': { d1: '論理が明快だから、腑に落ちた人から、行動の波が次々と広がる力', d2: '論理的な明快さが理解と行動の連鎖を起こす理論的影響力であり、論理の透明さが影響の波及速度を決める。', d3: '腑に落ちた者は動く。動いた者は広げる。' },
  'life|idea': { d1: '考えるより先に動く習慣があるから、誰より先に、時代の起点に立つ力', d2: '行動の先行性が構想の実証と洗練を加速する実践的構想力であり、活用の速度が構想の時代的優位を決める。', d3: '先に動いた者だけが、起点に立てる。' },
  'life|innovation': { d1: '実際に動いて体感しているから、現場の手応えが、変革の火種になる力', d2: '実践の体感が変革への確信と具体性を生む現場的変革力であり、活用の深さが変革の説得力を決める。', d3: '動いた者だけが、現場から変革を起こせる。' },
  'life|implementation': { d1: '手を動かし続けてきたから、止まらずに構想を、現実に落とし込む力', d2: '行動の継続性が実装の完遂力を生む実践的実装力であり、活用の習慣が実装の最後まで止まらない力を決める。', d3: '動き続けた者だけが、最後まで形にできる。' },
  'life|influence': { d1: '自分が実際に動いている背中を見て、周囲が動き出す力', d2: '実践の背中が言葉より先に影響を与える体現的影響力であり、活用の実績が影響の説得力を決める。', d3: '動いている背中だけが、人を動かせる。' },
  'leadership|idea': { d1: '知識と経験を束ねているから、踏み出す一歩が時代の大きな流れを起動させる力', d2: '統率の重さが構想の時代的インパクトを保証する統率的構想力であり、束ねた力の大きさが構想の波及力を決める。', d3: '束ねた者の一歩は、時代を動かす。' },
  'leadership|innovation': { d1: '異なる知識と経験を統合しているから、誰も気づかなかった場所に、変革の突破口を開く力', d2: '統合的視野が変革の盲点を照らす統率的変革力であり、統率の多様性が変革の場所の意外性を決める。', d3: '全体を束ねた者だけが、誰も気づかない突破口を見つける。' },
  'leadership|implementation': { d1: '全体像を握っているから、複雑な構想でも矛盾を出さずに完成させる力', d2: '全体把握が実装の矛盾を事前に解消する統率的実装力であり、統率の精度が実装の完成度を決める。', d3: '全体を知っている者だけが、矛盾なく完成させられる。' },
  'leadership|influence': { d1: '人と知識を束ねているから、一人では届かない場所まで、影響の波を広げる力', d2: '統率の広さが影響の射程を拡大する統率的影響力であり、束ねた力の規模が影響の届く距離を決める。', d3: '束ねた者だけが、一人では届かない場所まで影響できる。' },
  // ━ 技×衝 STRIKER（16ペア）━
  'critical|idea': { d1: '本質が見えているから、未知の世界でも迷わず踏み出せる力', d2: '本質の把握が構想の方向性への確信を生む本質的構想力であり、本質の深さが踏み出す一歩の迷いのなさを決める。', d3: '本質を掴んだ者だけが、未知の世界で迷わない。' },
  'critical|innovation': { d1: '本質を掴んでいるから、表面ではなく根っこから世界を変える力', d2: '本質の把握が変革の根拠と的確さを保証する本質的変革力であり、本質の深さが変革の持続性を決める。', d3: '根っこを知っている者だけが、本当に変えられる。' },
  'critical|implementation': { d1: '何が核心かを知っているから、余計なものを削ぎ落として最後まで形にしきれる力', d2: '本質の明確さが実装の優先順位を正確に定める本質的実装力であり、本質の把握が実装のシンプルさと完成度を決める。', d3: '核心を知っている者だけが、余計なものを捨てられる。' },
  'critical|influence': { d1: '本質だけを届けることで、人の心に深く響く力', d2: '余剰を削ぎ落とした本質の言葉だけが持つ貫通型影響力であり、本質の純度が影響の深さを決める。', d3: '本質だけを語る者の言葉が、最も深く刺さる。' },
  'creativity|idea': { d1: 'まだ誰も見ていない世界を頭の中で描けるから、踏み出す一歩が新しい時代の扉を開ける力', d2: '創造の過程で生まれるイメージが構想の具体性と熱量を生む創造的構想力であり、創造の鮮明さが構想の説得力を決める。', d3: '頭の中で創れる者だけが、世界の扉を開ける。' },
  'creativity|innovation': { d1: '存在しないものを創り続けることで、革新を起こす力', d2: '継続的な創造行為が既存の枠組みを書き換えていく創造的変革力であり、創造の持続性が変革の規模を決める。', d3: '創り続けた者だけが、革新になれる。' },
  'creativity|implementation': { d1: '頭の中のビジョンを鮮明に描けるから、そのまま止まらず現実に落とし込む力', d2: '創造のイメージの鮮明さが実装のブレを最小化する創造的実装力であり、創造の具体性が実装の完成度を決める。', d3: '鮮明に描ける者だけが、そのまま形にできる。' },
  'creativity|influence': { d1: '世界にまだなかったものを創り出すから、見た人の常識を揺さぶる力', d2: '創造物そのものが常識の更新を促す存在型影響力であり、創造の独自性が影響の衝撃度を決める。', d3: 'まだない世界を創った者だけが、常識を変えられる。' },
  'communication|idea': { d1: '相手の心が動く言葉を選び、人の人生を変える一歩を生み出す力', d2: '言葉の選択が相手の行動の起点になる伝達的構想力であり、伝達の精度が引き出す一歩の重さを決める。', d3: '心に届いた言葉だけが、人生を変える一歩を生む。' },
  'communication|innovation': { d1: '相手が受け取れる形で言葉を届けるから、その言葉がその人の在り方を変えていく力', d2: '届いた言葉が意識を書き換える伝達的変革力であり、伝達の的確さが変革の深さを決める。', d3: '届いた言葉だけが、人を変える。' },
  'communication|implementation': { d1: '想いを言葉に変換することで、迷わず最後まで実装できる力', d2: '言語化が実装の方向性と動機を明確にする伝達的実装力であり、伝達の明確さが実装の確実性を決める。', d3: '言葉にした者だけが、最後まで実装できる。' },
  'communication|influence': { d1: '相手に届く言葉を選び続けることで、人の行動に変化を生む力', d2: '言葉の継続的な最適化が影響の連鎖を生む言語的影響力であり、伝達の積み重ねが影響の波及力を決める。', d3: '届け続けた言葉だけが、行動を変える。' },
  'collaboration|idea': { d1: '人の持ち味を見抜いて束ねるから、一人では立てない場所に最初の一歩を踏み出せる力', d2: '協働による力の集結が構想の実現可能性を高める協働的構想力であり、束ねた多様性が構想の大きさを決める。', d3: '人を束ねた者だけが、一人では立てない場所に立てる。' },
  'collaboration|innovation': { d1: '異なる強みをひとつに集中させるから、一人では届かない変革の扉をこじ開ける力', d2: '異質の協働が変革のレバレッジを生む協働的変革力であり、集結の多様性が変革の突破力を決める。', d3: '力を束ねた者だけが、一人では開かない扉を開ける。' },
  'collaboration|implementation': { d1: '誰が何をすべきかを見極めて配置するから、チームが一体となって構想を最後まで完成させる力', d2: '最適配置が実装の効率と完成度を最大化する協働的実装力であり、配置の精度がチームの実装完遂力を決める。', d3: '適切に配置した者だけが、チームを最後まで走らせられる。' },
  'collaboration|influence': { d1: '一人ひとりの持ち味を最大限に引き出して束ねるから、その合力が社会を動かす力', d2: '個の最大化と集合の方向付けが社会的影響を生む協働的影響力であり、束ねた力の総量が影響の社会的規模を決める。', d3: '全員が輝いた合力だけが、社会を動かせる。' },
  // ━ 衝×衝 PIONEER（6ペア）━
  'idea|innovation': { d1: '最初の一歩が、新しい時代のきっかけになる力', d2: '熱狂できるテーマの発見と既存の枠を壊す力が交差することで、構想が即座に時代変革の起点になるという点火型変革力であり、構想の熱量', d3: '踏み出した一歩が、世界の扉を開ける。' },
  'idea|implementation': { d1: '動き出す勢いのまま、止まらず形にしきる力', d2: '熱狂できるテーマへの発見と形にしきる意志が一体になった一気通貫の実行力であり、構想の熱量が実装の完遂力を決める。', d3: '熱が冷めないうちに形にできる者だけが、世界を変える。' },
  'idea|influence': { d1: '自分が動いたことで、周囲が動き出す力', d2: '熱狂できるテーマへの発見と体現が周囲への共鳴を生む構想的影響力であり、構想の熱量が影響の伝播速度を決める。', d3: '自分が燃えた者だけが、周囲を燃やせる。' },
  'innovation|implementation': { d1: '革新したことを、止まらずに形にしきる力', d2: '既存の枠を壊す力と形にしきる意志が融合した変革的実装力であり、変革の勢いが実装の完遂力を決める。', d3: '壊した者だけが、新しいものを形にできる。' },
  'innovation|influence': { d1: '革新的な行動が、影響を与え広げていく力', d2: '枠を壊す行為そのものが影響の震源になる変革的影響力であり、変革の大きさが影響の波紋の広がりを決める。', d3: '変えた者の行動だけが、世界に波紋を広げる。' },
  'implementation|influence': { d1: '形にしたものが動き始めることで、周囲を巻き込んでいく力', d2: '実装の完成が影響の起点になるという具現化型影響力であり、形にしきった実績が影響の信頼性を決める。', d3: '形になったものだけが、世界を巻き込める。' },
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

// ── 16素子 単体説明（対角ホバー用）2026.04.15 更新 ──────────────
const SELF_DEFS = {
  meaning:        '自分が何のために生きるかを問い続け、ぶれない軸を持つ力。すべての選択・判断・行動の「なぜ」を支える根拠であり、技術より先に存在する。基軸力がなければ、どれだけ能力があっても方向が定まらない。在り方そのものが、軸だ。',
  mindfulness:    '場の空気・相手の感情・自分の反応を鋭く受け取る力。「感じること」を止めない姿勢であり、受容の深さが判断の精度を決める。認知力は訓練より、感度を開くことで育つ。気づいた分だけ、世界が広がる。',
  mindshift:      '固定した見方を壊し、別の角度から物事を捉え直す力。「それは本当か？」と問い直す反射であり、パラダイムを書き換える速さが突破口を生む。転換力のある者は、危機を情報として読む。同じ現実が、別の景色に見える。',
  mastery:        '一つの道を深く掘り続け、技・知・感覚を統合していく力。「まだ足りない」と問い続ける姿勢であり、年輪が積み重なるほど精度が上がる。熟達力は量より密度だ。一点に人生を刻み続けた者だけが、到達できる領域がある。',
  learning:       '自分が知らないと認め、常に問い続ける学びの力。「わかった」と止まらない姿勢であり、謙虚さが知識を血肉にする。謙学力は知識の量ではない。学び続けることを選び続ける、意志の問題だ。',
  logical:        '物事を分解・整理し、筋道を立てて思考する力。「なぜそうなるか」を構造で説明する能力であり、論理の精度が判断の質を決める。論理力は言い訳を排除する。感情ではなく構造で語れる者が、信頼を積み上げる。',
  life:           '学んだことを現場に落とし込み、実際に使い切る力。「知っている」と「できる」の間を埋める行動力であり、現場での実践が知識を本物にする。活用力のない知識は、蓄積ではなく在庫だ。行動した分だけ、知識は力になる。',
  leadership:     '人と力を束ね、方向をそろえて前に進む力。「個」を「集合知」に変える能力であり、統率の質がチームの可能性の天井を決める。統率力は命令ではない。目的を共有し、それぞれの才覚を最大化させる思考の力だ。',
  critical:       '表面を削ぎ落とし、本質・核心を見抜く力。「何が本当の問題か」を特定する技術であり、本質を掴んだ者だけが真の問題を解ける。本質力は、情報の多さに惑わされない。削れば削るほど、核が現れる。',
  creativity:     'ゼロから新しいモノ・価値を生み出す能力とプロセス全体。「何もない状態から形にする」という技術であり、訓練で磨かれ、再現できる。創造力は方法論だ。問いに答え続けることで精度が上がる。',
  communication:  '想いや思考を言葉にして、相手の心に届ける力。「正確に伝える」だけでなく「相手の中に変化を起こす」伝え方の技術であり、伝わった分だけ世界が動く。伝達力は話す量ではない。届いた言葉だけが、人を動かす。',
  collaboration:  '他者の持ち味を引き出し、ひとつの力に束ねる力。「一人でやる」を超えた先にある能力であり、一人では届かない場所へ共に向かう技術だ。協働力は、自分の能力より他者の可能性を信じることから始まる。',
  idea:           '熱狂できるテーマを見出す力。「これだ」と内側から火がつく瞬間の衝動であり、技術ではなく発見だ。構想力は訓練で生まれない。在り方と感度が高まるほど、テーマが引き寄せられてくる。',
  innovation:     '既存の枠を壊し、新しい秩序・流れを生み出す力。「今のままでいい」を許さない衝動であり、変革を恐れない者だけが時代を動かす。変革力は破壊ではない。壊した先に、より本質的な秩序を生み出す意志だ。',
  implementation: '構想を止めずに最後まで形にしきる力。「やり切る」という衝動であり、実装の粘りが夢と現実の差を埋める。実装力は才能より意志だ。最後まで手を止めなかった者だけが、世界を変える。',
  influence:      '言葉や行動が周囲に波及し、変化を生み続ける力。「意図せず場が変わる」レベルの存在感であり、発信より在り方が先に伝わる。影響力は努力でなく滲み出るものだ。存在そのものが、場を変えていく。',
};

export function pairShort(kA, kB) {
  const ia = ORDERED.indexOf(kA), ib = ORDERED.indexOf(kB);
  const key = ia < ib ? `${kA}|${kB}` : `${kB}|${kA}`;
  return PAIR_SHORT[key] ?? '';
}

export function pairDef(kA, kB) {
  const ia = ORDERED.indexOf(kA), ib = ORDERED.indexOf(kB);
  const key = ia < ib ? `${kA}|${kB}` : `${kB}|${kA}`;
  return PAIR_DEFS[key] ?? null;
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
              {(() => { const d = pairDef(tip.kA, tip.kB); return d && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #F0EAE0' }}>
                  <div style={{ color: '#333', fontSize: 12, fontWeight: 600, lineHeight: 1.6 }}>{d.d1}</div>
                  <div style={{ color: '#666', fontSize: 11, lineHeight: 1.7, marginTop: 4 }}>{d.d2}</div>
                  <div style={{ color: zc, fontSize: 11, fontStyle: 'italic', fontWeight: 700, marginTop: 4, lineHeight: 1.5 }}>「{d.d3}」</div>
                </div>
              ); })()}
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
  const [expandedPairs, setExpandedPairs] = useState(() => new Set());
  const toggleExpanded = (z) => setExpandedPairs(prev => {
    const next = new Set(prev);
    if (next.has(z)) { next.delete(z); } else { next.add(z); }
    return next;
  });

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

  const [activeZones, setActiveZones] = useState(new Set(['natural', 'pro', 'active', 'potential']));
  const toggleZone = (z) => setActiveZones(prev => {
    const next = new Set(prev);
    if (next.has(z)) { next.delete(z); } else { next.add(z); }
    return next;
  });

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
        <h2 style={{ fontFamily: "'Noto Serif JP', Georgia, serif", fontSize: 20, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
          才覚発動領域Matrix
        </h2>
        <div style={{ width: 56, height: 2, background: 'linear-gradient(90deg, #8B35C8, #1A6FD4, #7CB82F)', marginTop: 10, borderRadius: 1 }} />
      </div>

      {/* ── ゾーンフィルター凡例（チェックボックス付き）── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { z: 'natural',   label: 'NATURAL ✦' },
          { z: 'pro',       label: 'PRO' },
          { z: 'active',    label: 'ACTIVE' },
          { z: 'potential', label: 'POTENTIAL' },
        ].map(({ z, label }) => {
          const on = activeZones.has(z);
          const zc = ZONE_HEX[z];
          return (
            <div key={z} onClick={() => toggleZone(z)} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              cursor: 'pointer', userSelect: 'none',
              padding: '3px 9px', borderRadius: 20,
              border: `1.5px solid ${on ? zc : '#D8D0C8'}`,
              background: on ? `${zc}12` : '#F5F0E8',
              transition: 'all 0.15s ease',
            }}>
              <div style={{
                width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                border: `1.5px solid ${on ? zc : '#C0B8B0'}`,
                background: on ? zc : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {on && <span style={{ fontSize: 8, color: '#fff', fontWeight: 900, lineHeight: 1 }}>✓</span>}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', color: on ? zc : '#B0A898' }}>{label}</span>
            </div>
          );
        })}
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

                  // ── 対角 ── スコア強度で枠太さ + ホバーで素子説明
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
                        cursor: 'pointer', transition: 'transform 0.12s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.3)'; setTip({ kA: rowKey, kB: rowKey, z: 'self', sA: sc, sB: sc, x: e.clientX, y: e.clientY }); }}
                        onMouseMove={e => setTip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; setTip(null); }}
                      >
                        {SUB_JP[rowKey].slice(0, 3)}
                      </div>
                    );
                  }

                  // ── 右上三角（j > i）: ゾーンフィルター対応
                  if (j > i) {
                    const sA = smap[rowKey], sB = smap[colKey];
                    const z  = getZone(sA, sB);
                    const inShown = shownRightSet.has(`${rowKey}|${colKey}`);
                    const show = inShown && activeZones.has(z);
                    const alpha = show ? zAlpha(z, sA, sB) : 0;
                    const bg = show ? toRgba(ZONE_HEX[z], alpha) : 'rgba(160,152,136,0.03)';
                    return (
                      <div key={colKey} style={{
                        width: SCELL, height: SCELL, marginRight: SGAP, flexShrink: 0,
                        background: bg, borderRadius: 3,
                        cursor: 'pointer',
                        transition: 'transform 0.12s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.3)'; setTip({ kA: rowKey, kB: colKey, z, sA, sB, x: e.clientX, y: e.clientY }); }}
                        onMouseMove={e => setTip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; setTip(null); }}
                      />
                    );
                  }

                  // ── 左下三角（j < i）: ゾーンフィルター対応
                  if (j < i) {
                    const sA = smap[colKey], sB = smap[rowKey];
                    const z  = getZone(sA, sB);
                    const isDormant = z === 'dormant';
                    const zoneVisible = !isDormant && activeZones.has(z);
                    const bg = !zoneVisible
                      ? 'rgba(160,152,136,0.06)'
                      : toRgba(ZONE_HEX[z], zAlpha(z, sA, sB));
                    return (
                      <div key={colKey} style={{
                        width: SCELL, height: SCELL, marginRight: SGAP, flexShrink: 0,
                        background: bg, borderRadius: 3,
                        cursor: 'pointer',
                        transition: 'transform 0.12s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.3)'; setTip({ kA: colKey, kB: rowKey, z, sA, sB, x: e.clientX, y: e.clientY }); }}
                        onMouseMove={e => setTip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; setTip(null); }}
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

      {/* ── Top 10 Active Pairs ── ゾーン別ZoneWindowカード */}
      {top10Pairs.length > 0 && (
        <div style={{ marginTop: 20, borderTop: '1px solid #EDEAE4', paddingTop: 16 }}>
          <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#7A4A9A', textTransform: 'uppercase' }}>
            才覚グリフォン &nbsp;|&nbsp; GRIFFON CODE
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#AAA', textTransform: 'uppercase', marginBottom: 12 }}>
            Top 10 Active Pairs
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {(() => {
              const zoneOrder = ['natural', 'pro', 'active', 'potential'];
              const byZone = {};
              top10Pairs.forEach((p, rank) => {
                if (!byZone[p.z]) byZone[p.z] = [];
                byZone[p.z].push({ ...p, rank });
              });
              return zoneOrder.filter(z => byZone[z]).map(z => {
                const pairs = byZone[z];
                const zc = ZONE_HEX[z];
                const scores = pairs.map(p => p.sA + p.sB);
                const minS = Math.min(...scores), maxS = Math.max(...scores);
                const rangeStr = minS === maxS ? `${minS}` : `${minS}–${maxS}`;
                const isExpanded = expandedPairs.has(z);
                return (
                  <div
                    key={z}
                    onClick={() => toggleExpanded(z)}
                    style={{
                      borderRadius: 14,
                      border: `1.5px solid ${zc}55`,
                      borderTop: `3px solid ${zc}`,
                      background: zc + '07',
                      padding: '14px 14px 12px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      minHeight: 100,
                      boxShadow: isExpanded
                        ? `0 6px 20px ${zc}22, 0 2px 8px rgba(0,0,0,0.06)`
                        : '0 1px 4px rgba(0,0,0,0.05)',
                      transition: 'box-shadow 0.2s ease',
                    }}
                  >
                    {/* ゾーン名 + 件数バッジ（ZoneWindow完全一致）*/}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.07em', color: zc }}>
                        {ZONE_LABEL[z]}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 800, color: zc,
                        background: zc + '20', padding: '1px 7px',
                        borderRadius: 9999, minWidth: 22, textAlign: 'center',
                      }}>{pairs.length}</span>
                    </div>
                    {/* スコアレンジ（ZoneWindow完全一致）*/}
                    <div style={{
                      fontSize: 10, fontWeight: 700, color: zc,
                      background: zc + '14',
                      display: 'inline-flex', alignItems: 'center', gap: 2,
                      padding: '2px 8px', borderRadius: 9999, marginBottom: 8,
                    }}>
                      {rangeStr} <span style={{ fontSize: 9, opacity: 0.75 }}>pt</span>
                    </div>
                    {/* 展開: ペア一覧（ZoneWindowのsub item構造）*/}
                    {isExpanded && (
                      <div style={{ marginTop: 2 }}>
                        <div style={{ height: 1, background: zc + '25', marginBottom: 8 }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {pairs.map(({ kA, kB, sA, sB, rank }) => {
                            const def = pairDef(kA, kB);
                            return (
                              <div key={`${kA}|${kB}`}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: def ? 4 : 0 }}>
                                  <span style={{
                                    fontSize: 9, fontWeight: 800, color: zc,
                                    background: zc + '20', padding: '1px 5px',
                                    borderRadius: 4, flexShrink: 0, minWidth: 18, textAlign: 'center',
                                  }}>{rank + 1}</span>
                                  <span style={{
                                    fontSize: 13, fontWeight: 700, color: '#2A2520',
                                    flex: 1, fontFamily: "'Noto Serif JP', serif",
                                  }}>{pairShort(kA, kB)}</span>
                                  <span style={{
                                    fontSize: 15, fontWeight: 900, color: zc,
                                    minWidth: 24, textAlign: 'right',
                                    fontFamily: "'DM Sans', 'Outfit', sans-serif",
                                  }}>{sA + sB}</span>
                                </div>
                                {def && (
                                  <div style={{ paddingLeft: 28, borderLeft: `2px solid ${zc}30` }}>
                                    <p style={{ fontSize: 11, color: '#5A5040', margin: 0, lineHeight: 1.7, fontWeight: 600 }}>{def.d1}</p>
                                    <p style={{ fontSize: 10, color: '#8A8070', margin: '3px 0 0', lineHeight: 1.6 }}>{def.d2}</p>
                                    <p style={{ fontSize: 10, color: zc, margin: '3px 0 0', fontStyle: 'italic', fontWeight: 700 }}>「{def.d3}」</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div style={{
                          marginTop: 10,
                          width: '100%',
                          padding: '6px 0',
                          background: '#00000008',
                          border: '1px dashed #CCBBAA',
                          borderRadius: 8,
                          textAlign: 'center',
                          fontSize: 11, fontWeight: 700,
                          color: '#A09888',
                          letterSpacing: '0.04em',
                        }}>
                          ▴ 閉じる
                        </div>
                      </div>
                    )}
                    {!isExpanded && (
                      <div style={{
                        marginTop: 8,
                        width: '100%',
                        padding: '7px 0',
                        background: zc + '18',
                        border: `1px dashed ${zc}66`,
                        borderRadius: 8,
                        textAlign: 'center',
                        fontSize: 11, fontWeight: 700,
                        color: zc,
                        letterSpacing: '0.04em',
                      }}>
                        click! GRIFFON CODE
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* ── ツールチップ ── */}
      {tip && (() => {
        let x = tip.x + 16, y = tip.y - 50;
        if (typeof window !== 'undefined') {
          if (x + 220 > window.innerWidth) x = tip.x - 230;
          if (y < 8) y = tip.y + 16;
        }
        // 対角（素子単体）ツールチップ
        if (tip.z === 'self') {
          const gi = CODE_GRP[tip.kA];
          const ac = AXIS_HEX[gi];
          return (
            <div style={{
              position: 'fixed', left: x, top: y, zIndex: 9999,
              background: '#FFFFFF', border: `1px solid ${toRgba(ac, 0.3)}`,
              borderTop: `3px solid ${ac}`,
              borderRadius: 12, padding: '12px 16px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              pointerEvents: 'none', minWidth: 200,
            }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: ac, marginBottom: 4, fontFamily: "'Noto Serif JP', serif" }}>{SUB_JP[tip.kA]}</div>
              <div style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, marginBottom: 8, background: toRgba(ac, 0.1), color: ac, border: `1px solid ${toRgba(ac, 0.4)}`, fontSize: 11, fontWeight: 700 }}>{AXIS_JP[gi]}</div>
              <div style={{ color: '#555', fontSize: 12, lineHeight: 1.8, marginBottom: 6 }}>スコア <span style={{ color: ac, fontWeight: 800, fontSize: 14 }}>{tip.sA}</span> / 20</div>
              {SELF_DEFS[tip.kA] && <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #F0EAE0', color: '#444', fontSize: 11, lineHeight: 1.6 }}>{SELF_DEFS[tip.kA]}</div>}
            </div>
          );
        }
        // ペアツールチップ
        const zc  = ZONE_HEX[tip.z];
        const blk = getBlock(tip.kA, tip.kB);
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
              <div>{tip.sA} + {tip.sB} = <span style={{ color: tip.z === 'dormant' ? '#A09080' : zc, fontWeight: 800, fontSize: 14 }}>{tip.sA + tip.sB}</span></div>
              {blk && <div style={{ color: '#AAA', fontSize: 11 }}>{blk.name} / {blk.jp}</div>}
              {tip.z === 'dormant' && (
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #F0EAE0', color: '#888', fontSize: 11, lineHeight: 1.6 }}>
                  この組み合わせは現在未発動の状態です。<br />
                  {SUB_JP[tip.kA]}・{SUB_JP[tip.kB]}のどちらか、または両方のスコアが低い水準にあります。意識的に鍛えることで発動できる潜在領域です。
                </div>
              )}
              {tip.z !== 'dormant' && (() => { const d = pairDef(tip.kA, tip.kB); return d && (
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #F0EAE0' }}>
                  <div style={{ color: '#333', fontSize: 11, fontWeight: 600, lineHeight: 1.6 }}>{d.d1}</div>
                  <div style={{ color: '#666', fontSize: 10, lineHeight: 1.6, marginTop: 3 }}>{d.d2}</div>
                  <div style={{ color: zc, fontSize: 10, fontStyle: 'italic', fontWeight: 700, marginTop: 3 }}>「{d.d3}」</div>
                </div>
              ); })()}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
