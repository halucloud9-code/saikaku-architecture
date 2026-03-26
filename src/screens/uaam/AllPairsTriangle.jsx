import { useState, useCallback } from 'react';

/**
 * AllPairsTriangle — 16素子 × 120ペア 三角マトリックス
 *
 * 設計:
 *   16×16 の上三角（120ペア）を階段レイアウトで描画
 *   行 i → 左端 x = i×STEP でインデント, セル ORDERED[i+1..15]
 *   底辺 = ORDERED[0..15] 横一列（列整列証明済み）
 *
 * 整列証明:
 *   padding-left方式 → セルj 左端 = j×STEP = 底辺jラベル左端 ✓
 *
 * ゾーン4分類:
 *   full      → 両方20     → 金  α=1.0
 *   active    → 両方16+    → 青  α=0.35+ratio×0.65
 *   potential → 片方16+    → ピンク α=0.12+ratio×0.60
 *   dormant   → 両方15以下 → グレー α=0.04+ratio×0.14
 *
 * 10ブロック:
 *   ANCHOR/SAGE/INVENTOR/PIONEER（対角）
 *   VISIONARY/BUILDER/CATALYST（志×知/技/衝）
 *   CRAFTER/NAVIGATOR/STRIKER（知/技/衝クロス）
 */

// ── 定数 ─────────────────────────────────────────────
const CELL = 22, GAP = 2, STEP = CELL + GAP;

// 16素子（軸順）
const ORDERED = [
  'meaning', 'mindfulness', 'mindshift', 'mastery',       // 志軸 0
  'learning', 'logical', 'life', 'leadership',             // 知軸 1
  'critical', 'creativity', 'communication', 'collaboration', // 技軸 2
  'idea', 'innovation', 'implementation', 'influence',     // 衝軸 3
];
const N = ORDERED.length;

// サブ項目 → 軸グループ（0=志 1=知 2=技 3=衝）
const CODE_GRP = {};
['meaning','mindfulness','mindshift','mastery'].forEach(k => CODE_GRP[k] = 0);
['learning','logical','life','leadership'].forEach(k => CODE_GRP[k] = 1);
['critical','creativity','communication','collaboration'].forEach(k => CODE_GRP[k] = 2);
['idea','innovation','implementation','influence'].forEach(k => CODE_GRP[k] = 3);

// 軸キー（スコアデータ用）
const AXIS_KEYS = ['mindset', 'literacy', 'competency', 'impact'];

// 日本語ラベル
const SUB_JP = {
  meaning: '意味', mindfulness: '気づき', mindshift: '意識転換', mastery: '熟達',
  learning: '学習', logical: '論理', life: '社会実装', leadership: 'リーダーシップ',
  critical: '批判的思考', creativity: '創造性', communication: '伝える力', collaboration: '協働',
  idea: 'アイデア', innovation: '変革', implementation: '実装', influence: '影響',
};
const SUB_EN = {
  meaning: 'Meaning', mindfulness: 'Mindfulness', mindshift: 'Mindshift', mastery: 'Mastery',
  learning: 'Learning', logical: 'Logical', life: 'Life', leadership: 'Leadership',
  critical: 'Critical', creativity: 'Creativity', communication: 'Communication', collaboration: 'Collaboration',
  idea: 'Idea', innovation: 'Innovation', implementation: 'Implementation', influence: 'Influence',
};
const AXIS_JP = ['志 MindSet', '知 Literacy', '技 Competency', '衝 Impact'];

// 軸カラー（プロジェクト既存配色に合わせる）
const AXIS_HEX   = ['#5A96DC', '#46C382', '#DCAF46', '#DC5F50'];
const AXIS_LIGHT = ['#93C5FD', '#6EE7B7', '#FDE68A', '#FCA5A5'];
const AXIS_DIM   = ['rgba(90,150,220,0.15)', 'rgba(70,195,130,0.15)',
                    'rgba(220,175,70,0.15)', 'rgba(220,95,80,0.15)'];

// ゾーンカラー
const ZONE_HEX = {
  full:      '#F59E0B',
  active:    '#3B82F6',
  potential: '#EC4899',
  dormant:   '#6B7280',
};
const ZONE_LABEL = {
  full:      'FULL ✦',
  active:    'ACTIVE',
  potential: 'POTENTIAL',
  dormant:   'DORMANT',
};

// 10ブロック定義
const BLOCKS = [
  { name: 'ANCHOR',    jp: '志×志', color: '#5A96DC', axes: [0, 0] },
  { name: 'SAGE',      jp: '知×知', color: '#46C382', axes: [1, 1] },
  { name: 'INVENTOR',  jp: '技×技', color: '#DCAF46', axes: [2, 2] },
  { name: 'PIONEER',   jp: '衝×衝', color: '#DC5F50', axes: [3, 3] },
  { name: 'VISIONARY', jp: '志×知', color: '#4E8AC0', axes: [0, 1] },
  { name: 'BUILDER',   jp: '志×技', color: '#8DB05F', axes: [0, 2] },
  { name: 'CATALYST',  jp: '志×衝', color: '#A06060', axes: [0, 3] },
  { name: 'CRAFTER',   jp: '知×技', color: '#70A890', axes: [1, 2] },
  { name: 'NAVIGATOR', jp: '知×衝', color: '#7A7EBC', axes: [1, 3] },
  { name: 'STRIKER',   jp: '技×衝', color: '#C49050', axes: [2, 3] },
];

// ── ユーティリティ ────────────────────────────────────
const toRgba = (hex, a) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
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
  if (z === 'active')    return 0.35 + ratio * 0.65;
  if (z === 'potential') return 0.12 + ratio * 0.60;
  return 0.04 + ratio * 0.14;
}

function getBlock(kA, kB) {
  const gA = CODE_GRP[kA], gB = CODE_GRP[kB];
  const pMin = Math.min(gA, gB), pMax = Math.max(gA, gB);
  return BLOCKS.find(b => {
    const bMin = Math.min(...b.axes), bMax = Math.max(...b.axes);
    return bMin === pMin && bMax === pMax;
  });
}

// scores から16素子のスコアマップを生成
function buildScoreMap(scores, maxSub = 20) {
  const map = {};
  ORDERED.forEach(k => {
    const axisKey = AXIS_KEYS[CODE_GRP[k]];
    const raw = scores?.[axisKey]?.subs?.[k] ?? 0;
    // 正規化して maxSub→20 にスケール
    map[k] = Math.round((raw / maxSub) * 20);
  });
  return map;
}

function blockTotals(smap) {
  return BLOCKS.map(b => {
    const bMin = Math.min(...b.axes), bMax = Math.max(...b.axes);
    let total = 0;
    for (let i = 0; i < N - 1; i++) {
      for (let j = i + 1; j < N; j++) {
        const gA = CODE_GRP[ORDERED[i]], gB = CODE_GRP[ORDERED[j]];
        const pMin = Math.min(gA, gB), pMax = Math.max(gA, gB);
        if (pMin === bMin && pMax === bMax) {
          total += smap[ORDERED[i]] * smap[ORDERED[j]];
        }
      }
    }
    return total;
  });
}

// ── コンポーネント ────────────────────────────────────
export default function AllPairsTriangle({ scores, maxSub = 20 }) {
  const smap = buildScoreMap(scores, maxSub);
  const [tip, setTip] = useState(null); // { kA, kB, x, y }

  const totals = blockTotals(smap);
  const maxTotal = Math.max(...totals, 1);

  const cellColor = useCallback((kA, kB) => {
    const sA = smap[kA], sB = smap[kB];
    const z  = getZone(sA, sB);
    return toRgba(ZONE_HEX[z], zAlpha(z, sA, sB));
  }, [smap]);

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E8E0D4',
      borderRadius: 16,
      padding: '24px 28px',
      margin: '24px 0',
    }}>
      {/* ヘッダー */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: 11, letterSpacing: '0.12em', color: '#999',
          textTransform: 'uppercase', marginBottom: 4,
        }}>All Pairs Triangle</div>
        <div style={{
          fontFamily: "'Noto Serif JP', Georgia, serif",
          fontSize: 18, fontWeight: 700, color: '#1A1A1A',
        }}>才覚発動 全ペアマトリックス</div>
        <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
          16素子 × 120ペア — スコア積でゾーン発光
        </div>
      </div>

      {/* 凡例 */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        {Object.entries(ZONE_HEX).map(([z, hex]) => (
          <div key={z} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#666' }}>
            <div style={{
              width: 14, height: 14, borderRadius: 3,
              background: toRgba(hex, z === 'full' ? 1 : z === 'active' ? 0.75 : z === 'potential' ? 0.55 : 0.25),
            }} />
            <span>{ZONE_LABEL[z]}</span>
          </div>
        ))}
      </div>

      {/* マトリックス */}
      <div style={{ overflowX: 'auto', position: 'relative' }}>
        <div style={{ display: 'inline-block', padding: '4px 2px 8px' }}>
          {/* 行 i = 0..14 */}
          {Array.from({ length: N - 1 }, (_, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: GAP,
                marginBottom: GAP,
                paddingLeft: i * STEP,
              }}
            >
              {/* 行ラベル */}
              <div style={{
                width: CELL, height: CELL,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, flexShrink: 0,
                color: AXIS_LIGHT[CODE_GRP[ORDERED[i]]],
                background: AXIS_DIM[CODE_GRP[ORDERED[i]]],
                borderRadius: 3,
              }}>
                {SUB_EN[ORDERED[i]].slice(0, 2)}
              </div>

              {/* セル j = i+1..15 */}
              {Array.from({ length: N - i - 1 }, (_, d) => {
                const j  = i + 1 + d;
                const kA = ORDERED[i], kB = ORDERED[j];
                return (
                  <div
                    key={j}
                    style={{
                      width: CELL, height: CELL,
                      borderRadius: 3, flexShrink: 0,
                      background: cellColor(kA, kB),
                      cursor: 'pointer',
                      transition: 'transform 0.1s',
                    }}
                    onMouseEnter={e => setTip({ kA, kB, x: e.clientX, y: e.clientY })}
                    onMouseMove={e => setTip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                    onMouseLeave={() => setTip(null)}
                  />
                );
              })}
            </div>
          ))}

          {/* 底辺ラベル（j=0..15 → j*STEP で整列） */}
          <div style={{ display: 'flex', gap: GAP, marginTop: 4 }}>
            {ORDERED.map((k, j) => (
              <div key={j} style={{
                width: CELL, flexShrink: 0,
                fontSize: 9, textAlign: 'center',
                color: AXIS_LIGHT[CODE_GRP[k]],
                fontWeight: 700,
              }}>
                {SUB_EN[k].slice(0, 2)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 軸凡例 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, marginBottom: 20 }}>
        {AXIS_JP.map((label, g) => (
          <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: AXIS_HEX[g] }} />
            <span style={{ color: AXIS_HEX[g], fontWeight: 600 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* 10ブロック スコア */}
      <div style={{ marginTop: 4 }}>
        <div style={{
          fontSize: 11, letterSpacing: '0.08em', color: '#999',
          textTransform: 'uppercase', marginBottom: 10,
        }}>10 Blocks Score</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 8,
        }}>
          {BLOCKS.map((b, idx) => {
            const pct = totals[idx] / maxTotal;
            return (
              <div key={idx} style={{
                background: '#F9F6F0',
                border: '1px solid #E8E0D4',
                borderRadius: 8,
                padding: '10px 12px',
              }}>
                <div style={{ fontSize: 10, color: '#999', marginBottom: 2 }}>{b.name}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>{b.jp}</div>
                <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                  {totals[idx].toLocaleString()} pt
                </div>
                <div style={{
                  height: 3, borderRadius: 2, background: '#E8E0D4', marginTop: 6, overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    background: b.color,
                    width: `${pct * 100}%`,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ツールチップ */}
      {tip && (() => {
        const sA = smap[tip.kA], sB = smap[tip.kB];
        const z   = getZone(sA, sB);
        const blk = getBlock(tip.kA, tip.kB);
        const zc  = ZONE_HEX[z];
        let x = tip.x + 14, y = tip.y - 44;
        if (typeof window !== 'undefined') {
          if (x + 190 > window.innerWidth) x = tip.x - 200;
          if (y < 8) y = tip.y + 14;
        }
        return (
          <div style={{
            position: 'fixed', left: x, top: y,
            background: '#1C1C30', border: '1px solid #2D2D4E',
            borderRadius: 10, padding: '10px 14px',
            fontSize: 12, zIndex: 9999, minWidth: 180,
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
          }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#E2E8F0', marginBottom: 6 }}>
              {SUB_EN[tip.kA]} × {SUB_EN[tip.kB]}
            </div>
            <div style={{
              display: 'inline-block',
              padding: '2px 8px', borderRadius: 20, marginBottom: 6,
              background: toRgba(zc, 0.25),
              color: zc,
              border: `1px solid ${toRgba(zc, 0.5)}`,
              fontSize: 11,
            }}>{ZONE_LABEL[z]}</div>
            <div style={{ color: '#94A3B8', lineHeight: 1.7 }}>
              <div>{SUB_JP[tip.kA]} × {SUB_JP[tip.kB]}</div>
              <div>スコア: {sA} × {sB} = <strong style={{ color: '#E2E8F0' }}>{sA * sB}</strong></div>
              {blk && <div style={{ marginTop: 4, color: '#64748B', fontSize: 11 }}>{blk.name} / {blk.jp}</div>}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
