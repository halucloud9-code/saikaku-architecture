import { useState, useCallback, useMemo } from 'react';

/**
 * AllPairsTriangle — 才覚発動領域 / Activation Matrix
 * UI Max Edition
 *
 * 16素子 × 120ペア 三角レイアウト
 * padding-left方式: セルj左端 = j×STEP = 底辺jラベル左端 ✓
 */

// ── 定数 ─────────────────────────────────────────────
const CELL = 32, GAP = 2, STEP = CELL + GAP;

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

const SUB_JP = {
  meaning:'意味', mindfulness:'気づき', mindshift:'意識転換', mastery:'熟達',
  learning:'学習', logical:'論理', life:'社会実装', leadership:'リーダーシップ',
  critical:'批判的思考', creativity:'創造性', communication:'伝える力', collaboration:'協働',
  idea:'アイデア', innovation:'変革', implementation:'実装', influence:'影響',
};

// 既存 AXIS_COLORS に統一
const AXIS_HEX   = ['#2C5F8A', '#1E7A4A', '#A07A18', '#8B3A28'];
const AXIS_LIGHT = ['#5A96DC', '#46C382', '#DCAF46', '#DC5F50'];
const AXIS_DIM   = ['rgba(44,95,138,0.12)','rgba(30,122,74,0.12)',
                    'rgba(160,122,24,0.12)','rgba(139,58,40,0.12)'];

const ZONE_HEX = {
  full:      '#D4900A',   // 深金：完全発動
  active:    '#1A6FD4',   // 鮮青：発動中
  potential: '#8B35C8',   // 鮮紫：潜在
  dormant:   '#5A7A8A',   // 青灰：休眠
};
const ZONE_LABEL = { full:'FULL ✦', active:'ACTIVE', potential:'POTENTIAL', dormant:'DORMANT' };
const ZONE_DESC  = {
  full:      '両才覚が満点（20×20）— 完全発動状態',
  active:    '両才覚が高水準（16以上）— 安定発動中',
  potential: '片方が高水準（16以上）— 条件次第で発動可能',
  dormant:   '両才覚が未達（16未満）— 発動待機・潜在状態',
};
// 右側 vs 左側のゾーン割り当て
const RIGHT_ZONES = ['full', 'active'];
const LEFT_ZONES  = ['potential', 'dormant'];

const RANK_NUM = ['1', '2', '3', '4', '5'];

const BLOCKS = [
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
  // ━ 志×志 ANCHOR ━
  'meaning|mindfulness':     '在り方を起点に今この瞬間に集中する力',
  'meaning|mindshift':       '在り方を軸に固定観念を破る力',
  'meaning|mastery':         '目的に向け実践を反復する力',
  'mindfulness|mindshift':   '気づきを意識転換のトリガーにする力',
  'mindfulness|mastery':     '気づきを習慣化し成長に変える力',
  'mindshift|mastery':       '新視点の発見を反復で定着させる力',
  // ━ 志×知 VISIONARY ━
  'meaning|learning':        '在り方を起点に純粋に学ぶ力',
  'meaning|logical':         '目的を論理的に言語化する力',
  'meaning|life':            '在り方を現場の成果に変える力',
  'meaning|leadership':      '在り方でチームを動かす力',
  'mindfulness|learning':    '気づきを新しい知識へ変換する力',
  'mindfulness|logical':     '現在の状況を論理的に把握する力',
  'mindfulness|life':        '気づきを即座に現場で活かす力',
  'mindfulness|leadership':  '人の変化に気づき育てる力',
  'mindshift|learning':      '先入観を捨て本質を学ぶ力',
  'mindshift|logical':       '新視点を論理的に組み立てる力',
  'mindshift|life':          '発想転換を現場で形にする力',
  'mindshift|leadership':    '変化をチームに起こす力',
  'mastery|learning':        '深い学びを反復で完全定着させる力',
  'mastery|logical':         '熟達した知識を論理的に整理する力',
  'mastery|life':            '熟練の技を現場で再現する力',
  'mastery|leadership':      '熟達した力で人を育てる力',
  // ━ 知×知 SAGE ━
  'learning|logical':        '事実を整理し論理的に伝える力',
  'learning|life':           '学びを現場の結果に変える力',
  'learning|leadership':     '学びを人育てに転化する力',
  'logical|life':            '論理的思考を実際の成果につなげる力',
  'logical|leadership':      '論理で人を動かすリーダー力',
  'life|leadership':         '現場で人を育て結果を出す力',
  // ━ 志×技 BUILDER ━
  'meaning|critical':        '在り方を軸に本質を見抜く力',
  'meaning|creativity':      '目的を起点に新しい価値を創る力',
  'meaning|communication':   '在り方を言葉で伝える力',
  'meaning|collaboration':   '在り方でチームを束ねる力',
  'mindfulness|critical':    '状況を鋭く観察し本質を捉える力',
  'mindfulness|creativity':  '微細な変化に気づき新発想を生む力',
  'mindfulness|communication':'相手の状態に気づき的確に伝える力',
  'mindfulness|collaboration':'場の空気を読み協働を促進する力',
  'mindshift|critical':      '既存の枠を疑い本質を問い直す力',
  'mindshift|creativity':    '固定観念を破り創造的に発想する力',
  'mindshift|communication': '新しい視点を説得力を持って伝える力',
  'mindshift|collaboration': '多様な価値観を受け入れ協働する力',
  'mastery|critical':        '深い経験から本質的な問いを立てる力',
  'mastery|creativity':      '蓄積された知恵から革新を生む力',
  'mastery|communication':   '熟練の知識をわかりやすく伝える力',
  'mastery|collaboration':   '熟達した力を多様なチームで発揮する力',
  // ━ 知×技 CRAFTER ━
  'learning|critical':       '事実を基に批判的に分析する力',
  'learning|creativity':     '多様な知識から新発想を生む力',
  'learning|communication':  '学んだことをわかりやすく伝える力',
  'learning|collaboration':  '学びを他者と分かち合う力',
  'logical|critical':        '論理的な思考で本質を見抜く力',
  'logical|creativity':      '論理的思考と創造性を融合する力',
  'logical|communication':   '論理的に伝え相手を的確に動かす力',
  'logical|collaboration':   '論理共有でチームの方向を揃える力',
  'life|critical':           '現場の課題を論理的に特定する力',
  'life|creativity':         '現場で新しい解決策を生み出す力',
  'life|communication':      '現場の成果を説得力を持って伝える力',
  'life|collaboration':      '現場で多様な人と協力し成果を出す力',
  'leadership|critical':     '組織の問題を構造的に見抜く力',
  'leadership|creativity':   'リーダーとして新しいビジョンを描く力',
  'leadership|communication':'人を動かす言葉でリードする力',
  'leadership|collaboration':'多様な人をまとめて成果を生む力',
  // ━ 技×技 INVENTOR ━
  'critical|creativity':     '本質を見抜き新しい価値を生む力',
  'critical|communication':  '論理的な思考を分かりやすく伝える力',
  'critical|collaboration':  '本質を共有し多様な人と協力する力',
  'creativity|communication':'新しいアイデアを魅力的に伝える力',
  'creativity|collaboration':'創造性を他者と共に発揮する力',
  'communication|collaboration':'伝える力と協働で大きな成果を生む力',
  // ━ 志×衝 CATALYST ━
  'meaning|idea':            '在り方から熱狂テーマを生む力',
  'meaning|innovation':      '目的を起点に変革を起こす力',
  'meaning|implementation':  '在り方を社会に実装する力',
  'meaning|influence':       '在り方を文化として広める力',
  'mindfulness|idea':        '日常の微細な変化から着想する力',
  'mindfulness|innovation':  '現状の限界に気づき変革する力',
  'mindfulness|implementation':'実装の問題点に早く気づく力',
  'mindfulness|influence':   '変化の兆候に気づき影響を与える力',
  'mindshift|idea':          '枠を外して全く新しい発想をする力',
  'mindshift|innovation':    '既存を疑い新しい形を作る力',
  'mindshift|implementation':'新アプローチで実装を突破する力',
  'mindshift|influence':     '思考の転換を文化として広める力',
  'mastery|idea':            '深い知恵から新しいテーマを見出す力',
  'mastery|innovation':      '実力を活かして変革を牽引する力',
  'mastery|implementation':  '熟練の技で確実に形にする力',
  'mastery|influence':       '熟達の姿勢が文化として根づく力',
  // ━ 知×衝 NAVIGATOR ━
  'learning|idea':           '広範な知識から新テーマを発見する力',
  'learning|innovation':     '学びを変革の原動力にする力',
  'learning|implementation': '学んだ知識を現場で実装する力',
  'learning|influence':      '学びを通じて周囲に影響を与える力',
  'logical|idea':            '論理的思考から新発想を生む力',
  'logical|innovation':      '論理的に変革の道筋を描く力',
  'logical|implementation':  '論理的アプローチで確実に実装する力',
  'logical|influence':       '論理的な言葉で長期的に影響を与える力',
  'life|idea':               '現場の課題から新アイデアを生む力',
  'life|innovation':         '現場で変革を実現する力',
  'life|implementation':     '現場で実際に機能する形を作る力',
  'life|influence':          '現場での成果が文化として広がる力',
  'leadership|idea':         '組織の熱狂テーマを見出す力',
  'leadership|innovation':   'リーダーとして変革を起こす力',
  'leadership|implementation':'チームで確実に実装を完遂する力',
  'leadership|influence':    'リーダーの在り方が文化として根づく力',
  // ━ 技×衝 STRIKER ━
  'critical|idea':           '本質的な問いから革新的発想を生む力',
  'critical|innovation':     '問題の核心を見抜き変革を起こす力',
  'critical|implementation': '論理的に検証しながら実装する力',
  'critical|influence':      '本質的な問いで周囲の思考を変える力',
  'creativity|idea':         '創造的発想から熱狂テーマを見出す力',
  'creativity|innovation':   '創造性を発揮して変革を実現する力',
  'creativity|implementation':'創造的なアイデアを実際の形にする力',
  'creativity|influence':    '創造物を文化として広める力',
  'communication|idea':      '熱狂テーマを言葉で伝播させる力',
  'communication|innovation':'変革のビジョンを伝え人を動かす力',
  'communication|implementation':'実装の内容を効果的に伝える力',
  'communication|influence': '言葉の力で長期的に影響を与える力',
  'collaboration|idea':      '多様な視点から新テーマを生む力',
  'collaboration|innovation':'チームで協力して変革を起こす力',
  'collaboration|implementation':'協力して確実に実装を完遂する力',
  'collaboration|influence': '協働の文化を社会に広める力',
  // ━ 衝×衝 PIONEER ━
  'idea|innovation':         '熱狂テーマを変革の形に落とし込む力',
  'idea|implementation':     '情熱を社会に実装する力',
  'idea|influence':          '自分の熱狂を文化として根づかせる力',
  'innovation|implementation':'変革を現実に実装する力',
  'innovation|influence':    '変革を文化として広げる力',
  'implementation|influence':'実装した変化を社会に浸透させる力',
};

function pairDef(kA, kB) {
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
  if (sA === 20 && sB === 20) return 'full';
  if (sA >= 16 && sB >= 16)   return 'active';
  if (sA >= 16 || sB >= 16)   return 'potential';
  return 'dormant';
}

function zAlpha(z, sA, sB) {
  const ratio = (sA * sB) / 400;
  if (z === 'full')      return 1.0;
  if (z === 'active')    return 0.55 + ratio * 0.45;
  if (z === 'potential') return 0.45 + ratio * 0.40;
  return 0.30 + ratio * 0.25;
}

function getBlock(kA, kB) {
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
        <div style={{ fontSize: 11, letterSpacing: '0.14em', color: mirror ? '#7A4A7A' : '#B8960C', textTransform: 'uppercase', marginBottom: 6, fontWeight: 600 }}>
          {mirror ? 'Activation Matrix — Latent Zone' : 'Activation Matrix — Active Zone'}
        </div>
        <h2 style={{
          fontFamily: "'Noto Serif JP', Georgia, serif",
          fontSize: 22, fontWeight: 700, color: '#1A1A1A',
          margin: 0, letterSpacing: '0.02em',
        }}>{mirror ? '潜在発動領域' : '才覚発動領域'}</h2>
        <p style={{ fontSize: 13, color: '#666', margin: '6px 0 0', fontWeight: 400 }}>
          {mirror
            ? '16素子 × 120ペア — POTENTIAL & DORMANT ゾーン'
            : '16素子 × 120ペア — FULL & ACTIVE ゾーン'}
        </p>
        <div style={{ width: 48, height: 2, background: mirror ? 'linear-gradient(90deg,#7A4A7A,#C480C4)' : 'linear-gradient(90deg,#B8960C,#E8C547)', marginTop: 12, borderRadius: 1 }} />
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
            const pct = p.score / 400;
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

      {/* ── 正方形マトリックス（16×16） ── */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'inline-block', padding: '4px 2px 8px' }}>
          {/* 列ラベル（上） */}
          <div style={{ display: 'flex', gap: GAP, marginBottom: 4, paddingLeft: STEP }}>
            {ORDERED.map((k, j) => (
              <div key={j} style={{
                width: CELL, height: 18, flexShrink: 0,
                fontSize: 9, textAlign: 'center', fontWeight: 700,
                color: AXIS_LIGHT[CODE_GRP[k]],
              }}>
                {SUB_JP[k].slice(0, 2)}
              </div>
            ))}
          </div>
          {/* 行 */}
          {ORDERED.map((kRow, i) => (
            <div key={i} style={{ display: 'flex', gap: GAP, marginBottom: GAP }}>
              {/* 行ラベル */}
              <div style={{
                width: CELL, height: CELL, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, borderRadius: 4,
                color: AXIS_LIGHT[CODE_GRP[kRow]],
                background: AXIS_DIM[CODE_GRP[kRow]],
              }}>
                {SUB_JP[kRow].slice(0, 2)}
              </div>
              {/* セル */}
              {ORDERED.map((kCol, j) => {
                if (i === j) {
                  const sc = smap[kRow];
                  return (
                    <div key={j} style={{
                      width: CELL, height: CELL, borderRadius: 4, flexShrink: 0,
                      background: AXIS_DIM[CODE_GRP[kRow]],
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      gap: 1,
                    }}>
                      <div style={{ fontSize: 7, fontWeight: 700, color: AXIS_LIGHT[CODE_GRP[kRow]], lineHeight: 1 }}>
                        {AXIS_SHORT[CODE_GRP[kRow]]}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: AXIS_LIGHT[CODE_GRP[kRow]], fontFamily: "'Outfit',sans-serif", lineHeight: 1 }}>
                        {sc}
                      </div>
                    </div>
                  );
                }
                const z = getZone(smap[kRow], smap[kCol]);
                const visible = !zones || zones.includes(z);
                const pairScore = smap[kRow] * smap[kCol];
                return (
                  <div key={j} style={{
                    width: CELL, height: CELL, borderRadius: 4, flexShrink: 0,
                    background: visible ? cellColor(kRow, kCol) : 'rgba(0,0,0,0.04)',
                    cursor: visible ? 'pointer' : 'default',
                    transition: 'transform 0.12s, box-shadow 0.12s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                    onMouseEnter={visible ? e => {
                      e.currentTarget.style.transform = 'scale(1.3)';
                      e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.15)';
                      e.currentTarget.style.zIndex = '20';
                      setTip({ kA: kRow, kB: kCol, x: e.clientX, y: e.clientY });
                    } : undefined}
                    onMouseMove={visible ? e => setTip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null) : undefined}
                    onMouseLeave={visible ? e => {
                      e.currentTarget.style.transform = '';
                      e.currentTarget.style.boxShadow = '';
                      e.currentTarget.style.zIndex = '';
                      setTip(null);
                    } : undefined}
                  >
                    <span style={{
                      fontSize: visible ? (pairScore >= 100 ? 8 : 9) : 8,
                      fontWeight: 800,
                      fontFamily: "'Outfit',sans-serif",
                      color: visible ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.18)',
                      pointerEvents: 'none',
                      lineHeight: 1,
                    }}>
                      {pairScore}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
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
              <div>スコア <span style={{ color: '#1A1A1A', fontWeight: 800, fontFamily: "'Outfit'" }}>{sA}</span> × <span style={{ color: '#1A1A1A', fontWeight: 800, fontFamily: "'Outfit'" }}>{sB}</span> = <span style={{ color: zc, fontWeight: 800, fontSize: 14, fontFamily: "'Outfit'" }}>{sA * sB}</span></div>
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
