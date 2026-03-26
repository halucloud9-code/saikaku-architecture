import { useState, useCallback, useMemo } from 'react';

/**
 * AllPairsTriangle — 才覚発動領域 / Activation Matrix
 * UI Max Edition
 *
 * 16素子 × 120ペア 三角レイアウト
 * padding-left方式: セルj左端 = j×STEP = 底辺jラベル左端 ✓
 */

// ── 定数 ─────────────────────────────────────────────
const CELL = 26, GAP = 2, STEP = CELL + GAP;

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
  full:      '#B8960C',
  active:    '#2C5F8A',
  potential: '#7A4A7A',
  dormant:   '#A09080',
};
const ZONE_LABEL = { full:'FULL ✦', active:'ACTIVE', potential:'POTENTIAL', dormant:'DORMANT' };

const RANK_STYLE = [
  { bg: 'linear-gradient(135deg,#B8960C,#E8C547)', color: '#fff', label: '1st' },
  { bg: 'linear-gradient(135deg,#888,#bbb)',        color: '#fff', label: '2nd' },
  { bg: 'linear-gradient(135deg,#A07A18,#C9A45A)',  color: '#fff', label: '3rd' },
  { bg: '#EDEAE4', color: '#555', label: '4th' },
  { bg: '#EDEAE4', color: '#555', label: '5th' },
];

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
  if (z === 'active')    return 0.38 + ratio * 0.62;
  if (z === 'potential') return 0.14 + ratio * 0.58;
  return 0.05 + ratio * 0.15;
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
export default function AllPairsTriangle({ scores, maxSub = 20 }) {
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
        <div style={{ fontSize: 11, letterSpacing: '0.14em', color: '#B8960C', textTransform: 'uppercase', marginBottom: 6, fontWeight: 600 }}>
          Activation Matrix
        </div>
        <h2 style={{
          fontFamily: "'Noto Serif JP', Georgia, serif",
          fontSize: 22, fontWeight: 700, color: '#1A1A1A',
          margin: 0, letterSpacing: '0.02em',
        }}>才覚発動領域</h2>
        <p style={{ fontSize: 13, color: '#666', margin: '6px 0 0', fontWeight: 400 }}>
          16素子 × 120ペア — スコア積でゾーン発光
        </p>
        <div style={{ width: 48, height: 2, background: 'linear-gradient(90deg,#B8960C,#E8C547)', marginTop: 12, borderRadius: 1 }} />
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
            const rs  = RANK_STYLE[rank];
            const pct = e.score / 20;
            return (
              <div key={e.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: rank < 4 ? 10 : 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: rs.bg, color: rs.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800, flexShrink: 0,
                  letterSpacing: '0.02em',
                }}>{rs.label}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: AXIS_HEX[g] }}>
                      {SUB_JP[e.key]}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#1A1A1A', fontFamily: "'Outfit', sans-serif" }}>
                      {e.score}
                    </span>
                  </div>
                  <div style={{ height: 6, background: '#EDEAE4', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      background: `linear-gradient(90deg, ${AXIS_HEX[g]}, ${AXIS_LIGHT[g]})`,
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
            const rs  = RANK_STYLE[rank];
            const pct = p.score / 400;
            return (
              <div key={`${p.kA}-${p.kB}`} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: rank < 4 ? 10 : 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: rs.bg, color: rs.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800, flexShrink: 0,
                  letterSpacing: '0.02em',
                }}>{rs.label}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: zc }}>
                      {SUB_JP[p.kA]} × {SUB_JP[p.kB]}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#1A1A1A', fontFamily: "'Outfit', sans-serif" }}>
                      {p.score}
                    </span>
                  </div>
                  <div style={{ height: 6, background: '#EDEAE4', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      background: `linear-gradient(90deg, ${zc}, ${toRgba(zc, 0.6)})`,
                      width: `${pct * 100}%`,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                  {blk && (
                    <div style={{ fontSize: 10, color: '#AAA', marginTop: 3 }}>{blk.name}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── ゾーン凡例 ── */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #EDEAE4' }}>
        {Object.entries(ZONE_HEX).map(([z, hex]) => (
          <div key={z} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#666' }}>
            <div style={{
              width: 16, height: 16, borderRadius: 4,
              background: z === 'dormant' ? toRgba(hex, 0.3) : z === 'potential' ? toRgba(hex, 0.55) : toRgba(hex, 0.85),
            }} />
            <span style={{ fontWeight: 600, color: hex }}>{ZONE_LABEL[z]}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#AAA' }}>ホバーで詳細</div>
      </div>

      {/* ── 三角マトリックス ── */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'inline-block', padding: '4px 2px 8px' }}>
          {Array.from({ length: N - 1 }, (_, i) => (
            <div key={i} style={{ display: 'flex', gap: GAP, marginBottom: GAP, paddingLeft: i * STEP }}>
              {/* 行ラベル */}
              <div style={{
                width: CELL, height: CELL, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, borderRadius: 4,
                color: AXIS_LIGHT[CODE_GRP[ORDERED[i]]],
                background: AXIS_DIM[CODE_GRP[ORDERED[i]]],
              }}>
                {SUB_JP[ORDERED[i]].slice(0, 2)}
              </div>
              {/* セル */}
              {Array.from({ length: N - i - 1 }, (_, d) => {
                const j = i + 1 + d;
                const kA = ORDERED[i], kB = ORDERED[j];
                return (
                  <div key={j} style={{
                    width: CELL, height: CELL, borderRadius: 4, flexShrink: 0,
                    background: cellColor(kA, kB), cursor: 'pointer',
                    transition: 'transform 0.12s, box-shadow 0.12s',
                  }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'scale(1.5)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                      e.currentTarget.style.zIndex = '20';
                      setTip({ kA, kB, x: e.clientX, y: e.clientY });
                    }}
                    onMouseMove={e => setTip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = '';
                      e.currentTarget.style.boxShadow = '';
                      e.currentTarget.style.zIndex = '';
                      setTip(null);
                    }}
                  />
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
                      background: `linear-gradient(90deg, ${color}, ${AXIS_LIGHT[b.axes[0]]})`,
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
            </div>
          </div>
        );
      })()}
    </div>
  );
}
