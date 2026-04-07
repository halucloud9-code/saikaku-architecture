import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

/**
 * ActivationMatrix — 16項目統一チャート v2
 * System 1 Design: 見た瞬間に心を奪う
 * UI強化版: Sequential bloom / Scan beam / Ripple / Outer ticks / Center rotation
 */

const NUM_FONT = "'DM Sans', 'Outfit', sans-serif";
const N = 16;

// ResultScreen統一カラーパレット
const PALETTE = {
  bg:          '#F5F0E8',
  text:        '#2A2520',
  textSub:     '#7A7060',
  border:      '#D4C9B0',
  gold:        '#C4922A',
  goldBright:  '#FFD700',
  surface:     '#FDFCFA',
};

const AXIS_META = [
  { key: 'mindset',    kanji: '志', en: 'WHY',   color: [74, 111, 165],  hex: '#4A6FA5' },
  { key: 'literacy',   kanji: '知', en: 'THINK', color: [46, 139, 87],   hex: '#2E8B57' },
  { key: 'competency', kanji: '技', en: 'HOW',   color: [196, 146, 42],  hex: '#C4922A' },
  { key: 'impact',     kanji: '衝', en: 'ACT',   color: [168, 68, 50],   hex: '#A84432' },
];

const SUB_META = [
  { key: 'meaning',       axis: 0, label: 'Meaning',       jp: '基軸力' },
  { key: 'mindfulness',   axis: 0, label: 'Mindfulness',   jp: '認知力' },
  { key: 'mindshift',     axis: 0, label: 'Mindshift',     jp: '転換力' },
  { key: 'mastery',       axis: 0, label: 'Mastery',       jp: '熟達力' },
  { key: 'learning',      axis: 1, label: 'Learning',      jp: '謙学力' },
  { key: 'logical',       axis: 1, label: 'Logical',       jp: '論理力' },
  { key: 'life',          axis: 1, label: 'Life',          jp: '活用力' },
  { key: 'leadership',    axis: 1, label: 'Leadership',    jp: '統率力' },
  { key: 'critical',      axis: 2, label: 'Critical',      jp: '本質力' },
  { key: 'creativity',    axis: 2, label: 'Creativity',    jp: '創造力' },
  { key: 'communication', axis: 2, label: 'Communication', jp: '伝達力' },
  { key: 'collaboration', axis: 2, label: 'Collaboration', jp: '協働力' },
  { key: 'idea',           axis: 3, label: 'Idea',           jp: '構想力' },
  { key: 'innovation',     axis: 3, label: 'Innovation',     jp: '変革力' },
  { key: 'implementation', axis: 3, label: 'Implementation', jp: '実装力' },
  { key: 'influence',      axis: 3, label: 'Influence',      jp: '影響力' },
];

// 花びら設計 — 4グループ × 22°間隔、グループ間24°ギャップ
const PETAL_ALPHA = 22 * Math.PI / 180;
const PETAL_CENTERS = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];

function getPetalAngle(i) {
  const g = Math.floor(i / 4);
  const a = i % 4;
  return PETAL_CENTERS[g] + (a - 1.5) * PETAL_ALPHA;
}

function lerpColor(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ];
}

function getZone(raw) {
  if (raw >= 16) return 'active';
  if (raw >= 12) return 'potential';
  if (raw >= 10) return 'emerging';
  return 'dormant';
}

// easeOutExpo
function easeOut(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export default function ActivationMatrix({ scores, maxSub = 20 }) {
  const canvasRef = useRef(null);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [barsVisible, setBarsVisible] = useState(false);
  const stateRef = useRef({
    time: 0, entryProgress: 0,
    particles: [], mouseX: -1, mouseY: -1, activeI: null,
    ripples: [],      // [{idx, t}]
    scanAngle: 0,     // 回転スキャンビーム角
  });
  const frameRef = useRef(null);

  const points = useMemo(() => {
    return SUB_META.map((sub, i) => {
      const axisData = scores?.[AXIS_META[sub.axis].key];
      const raw = axisData?.subs?.[sub.key] ?? axisData?.domainSubs?.[sub.key] ?? 0;
      const pct = Math.round((raw / maxSub) * 100);
      const ratio = raw / maxSub;
      const color = AXIS_META[sub.axis].color;
      const hex = AXIS_META[sub.axis].hex;
      return { ...sub, raw, pct, ratio, color, hex, idx: i };
    });
  }, [scores, maxSub]);

  const totalPct = useMemo(() => {
    const total = points.reduce((s, p) => s + p.raw, 0);
    return Math.round((total / (maxSub * 16)) * 100);
  }, [points, maxSub]);

  const sorted = useMemo(() => [...points].sort((a, b) => b.pct - a.pct), [points]);
  const top3 = useMemo(() => sorted.slice(0, 3), [sorted]);
  const top5 = useMemo(() => sorted.slice(0, 5), [sorted]);
  const bottom3 = useMemo(() => sorted.slice(-3).reverse(), [sorted]);

  useEffect(() => {
    stateRef.current.activeI = selectedIdx ?? hoveredIdx;
  }, [selectedIdx, hoveredIdx]);

  useEffect(() => {
    const particles = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        idx: Math.floor(Math.random() * N),
        offset: Math.random() * 0.3 - 0.15,
        speed: 0.3 + Math.random() * 0.7,
        life: Math.random(),
        size: 0.5 + Math.random() * 1.5,
        brightness: 0.3 + Math.random() * 0.7,
      });
    }
    stateRef.current.particles = particles;
  }, []);

  const draw = useCallback((timestamp) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const st = stateRef.current;
    if (!st.startTime) {
      st.startTime = timestamp;
      // ランキングバーのアニメーション起動（1.6秒後）
      setTimeout(() => setBarsVisible(true), 1600);
    }
    st.time = (timestamp - st.startTime) / 1000;

    // 全体エントリー進捗（2000ms）
    const totalT = Math.min((timestamp - st.startTime) / 2000, 1);
    st.entryProgress = easeOut(totalT);
    const ep = st.entryProgress;

    // グループ別 sequential bloom（各グループ 0.18 ずつ遅延）
    const GROUP_DELAY = [0, 0.18, 0.36, 0.54];
    const groupEp = GROUP_DELAY.map(d => {
      const t = Math.max(0, Math.min((totalT - d) / (1 - d * 0.5), 1));
      return easeOut(t);
    });

    // スキャンビーム角度更新（0.25 rad/s = 約25秒で一周）
    st.scanAngle = (st.time * 0.25) % (Math.PI * 2);

    const DPR = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    const ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);

    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) * 0.32;
    const breath = Math.sin(st.time * 1.2) * 0.5 + 0.5;

    ctx.clearRect(0, 0, W, H);

    // === 背景グラデーション（淡いウォーム）===
    const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.8);
    bgGrad.addColorStop(0,   `rgba(253,252,250,0)`);
    bgGrad.addColorStop(0.6, `rgba(196,146,42,${0.015 * ep})`);
    bgGrad.addColorStop(1,   `rgba(196,146,42,${0.03 * ep})`);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // === スキャンビーム（ゆっくり回転する光の扇）===
    if (ep > 0.5) {
      const beamAlpha = (ep - 0.5) * 2 * 0.06;
      const beamSpan = Math.PI / 6; // 30度
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R * 1.25, st.scanAngle - beamSpan, st.scanAngle);
      ctx.closePath();
      const beamGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.25);
      beamGrad.addColorStop(0,   `rgba(196,146,42,0)`);
      beamGrad.addColorStop(0.6, `rgba(196,146,42,${beamAlpha * 0.5})`);
      beamGrad.addColorStop(1,   `rgba(196,146,42,${beamAlpha})`);
      ctx.fillStyle = beamGrad;
      ctx.fill();
      ctx.restore();
    }

    // === 花びらグリッドリング（グループ別弧）===
    [0.25, 0.5, 0.75, 1.0].forEach((p, ri) => {
      AXIS_META.forEach((axis, gi) => {
        const gep = groupEp[gi];
        const gr = R * p * gep;
        const a1 = getPetalAngle(gi * 4);
        const a2 = getPetalAngle(gi * 4 + 3);
        const c = axis.color;
        const alpha = (p === 1 ? 0.2 : 0.07 + ri * 0.025) * gep;
        ctx.beginPath();
        ctx.arc(cx, cy, gr, a1, a2);
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
        ctx.lineWidth = p === 1 ? 1.4 : 0.7;
        ctx.stroke();
      });
    });

    // === ゾーン閾値弧（Active ライン 0.8）===
    const thresholdR = R * 0.8;
    ctx.save();
    ctx.setLineDash([3, 5]);
    AXIS_META.forEach((axis, gi) => {
      const gep = groupEp[gi];
      const a1 = getPetalAngle(gi * 4);
      const a2 = getPetalAngle(gi * 4 + 3);
      const c = axis.color;
      ctx.beginPath();
      ctx.arc(cx, cy, thresholdR * gep, a1, a2);
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.5 * gep})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.restore();

    // === スポーク（グループ内のみ）===
    for (let i = 0; i < N; i++) {
      const gi = Math.floor(i / 4);
      const gep = groupEp[gi];
      const angle = getPetalAngle(i);
      const outerX = cx + Math.cos(angle) * R * gep;
      const outerY = cy + Math.sin(angle) * R * gep;
      const grad = ctx.createLinearGradient(cx, cy, outerX, outerY);
      const c = AXIS_META[SUB_META[i].axis].color;
      const isEdge = i % 4 === 0 || i % 4 === 3;
      grad.addColorStop(0, 'rgba(42,37,32,0)');
      grad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},${(isEdge ? 0.22 : 0.08) * gep})`);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(outerX, outerY);
      ctx.strokeStyle = grad;
      ctx.lineWidth = isEdge ? 1.0 : 0.5;
      ctx.stroke();
    }

    // === 外周ティックマーク（スポーク先端の小マーク）===
    if (ep > 0.7) {
      const tickAlpha = (ep - 0.7) * 3.33;
      for (let i = 0; i < N; i++) {
        const gi = Math.floor(i / 4);
        const gep = groupEp[gi];
        const angle = getPetalAngle(i);
        const tickR = R * gep;
        const tx = cx + Math.cos(angle) * tickR;
        const ty = cy + Math.sin(angle) * tickR;
        const c = AXIS_META[SUB_META[i].axis].color;
        const isEdge = i % 4 === 0 || i % 4 === 3;
        if (isEdge) {
          ctx.beginPath();
          ctx.arc(tx, ty, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${tickAlpha * 0.6})`;
          ctx.fill();
        } else {
          const tickLen = 5;
          const nx = Math.cos(angle + Math.PI / 2);
          const ny = Math.sin(angle + Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(tx - nx * tickLen / 2, ty - ny * tickLen / 2);
          ctx.lineTo(tx + nx * tickLen / 2, ty + ny * tickLen / 2);
          ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${tickAlpha * 0.35})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    // === セクター淡色（花びら扇形）===
    AXIS_META.forEach((axis, gi) => {
      const gep = groupEp[gi];
      const a1 = getPetalAngle(gi * 4);
      const a2 = getPetalAngle(gi * 4 + 3);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R * gep, a1, a2);
      ctx.closePath();
      const c = axis.color;
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.035 * gep})`;
      ctx.fill();
    });

    // === データポリゴン（花びら4枚・グループ独立）===
    const getDataPoint = (i) => {
      const gi = Math.floor(i / 4);
      const gep = groupEp[gi];
      const angle = getPetalAngle(i);
      const dr = points[i].ratio * R * gep;
      return { x: cx + Math.cos(angle) * dr, y: cy + Math.sin(angle) * dr };
    };

    AXIS_META.forEach((axis, gi) => {
      const startI = gi * 4;
      const gep = groupEp[gi];
      const c = axis.color;

      // ゴールドグロー
      ctx.save();
      ctx.shadowColor = `rgba(196,146,42,${0.22 + breath * 0.12})`;
      ctx.shadowBlur = 16 + breath * 8;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let j = 0; j < 4; j++) {
        const dp = getDataPoint(startI + j);
        ctx.lineTo(dp.x, dp.y);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(196,146,42,${0.45 * gep})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // グラデーション塗り
      const fillGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      fillGrad.addColorStop(0,    `rgba(${c[0]},${c[1]},${c[2]},${0.05 * gep})`);
      fillGrad.addColorStop(0.55, `rgba(${c[0]},${c[1]},${c[2]},${(0.18 + breath * 0.07) * gep})`);
      fillGrad.addColorStop(1,    `rgba(${c[0]},${c[1]},${c[2]},${(0.32 + breath * 0.09) * gep})`);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let j = 0; j < 4; j++) {
        const dp = getDataPoint(startI + j);
        ctx.lineTo(dp.x, dp.y);
      }
      ctx.closePath();
      ctx.fillStyle = fillGrad;
      ctx.fill();

      // 外縁ストローク（グループ内3辺）
      for (let j = 0; j < 3; j++) {
        const p1 = getDataPoint(startI + j);
        const p2 = getDataPoint(startI + j + 1);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.75 * gep})`;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
      // 花びら両側辺（中心→端点）
      [0, 3].forEach(j => {
        const dp = getDataPoint(startI + j);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(dp.x, dp.y);
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.28 * gep})`;
        ctx.lineWidth = 0.9;
        ctx.stroke();
      });
    });

    // === パーティクル（getPetalAngle使用・修正済み）===
    st.particles.forEach(pt => {
      pt.life += pt.speed * 0.008;
      if (pt.life > 1) { pt.life = 0; pt.idx = Math.floor(Math.random() * N); }

      const dp = getDataPoint(pt.idx);
      const angle = getPetalAngle(pt.idx) + pt.offset; // ← 修正: getAngle → getPetalAngle
      const dist = pt.life * 32;
      const px = dp.x + Math.cos(angle) * dist;
      const py = dp.y + Math.sin(angle) * dist;
      const alpha = (1 - pt.life) * pt.brightness * ep * 0.75;
      const c = AXIS_META[SUB_META[pt.idx].axis].color;

      ctx.beginPath();
      ctx.arc(px, py, pt.size * (1 - pt.life * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
      ctx.fill();
    });

    // === リップル（クリック波紋）===
    st.ripples = st.ripples.filter(r => r.t < 1);
    st.ripples.forEach(r => {
      r.t += 0.025;
      const dp = getDataPoint(r.idx);
      const rR = r.t * 50;
      const alpha = (1 - r.t) * 0.6;
      const c = AXIS_META[SUB_META[r.idx].axis].color;
      ctx.beginPath();
      ctx.arc(dp.x, dp.y, rR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // 二重リップル
      if (r.t > 0.2) {
        const rR2 = (r.t - 0.2) * 50;
        const alpha2 = (1 - r.t) * 0.3;
        ctx.beginPath();
        ctx.arc(dp.x, dp.y, rR2, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(196,146,42,${alpha2})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });

    // === データドット（ゾーンベース）===
    const activeI = stateRef.current.activeI;
    for (let i = 0; i < N; i++) {
      const gi = Math.floor(i / 4);
      const gep = groupEp[gi];
      if (gep < 0.1) continue;

      const dp = getDataPoint(i);
      const c = points[i].color;
      const isSelected = activeI === i;
      const zone = getZone(points[i].raw);

      const dotR = isSelected ? 8
        : zone === 'active'    ? 7
        : zone === 'potential' ? 5
        : zone === 'emerging'  ? 3.5
        : 2.5;
      const pulse = (zone === 'active' || isSelected)
        ? (1 + Math.sin(st.time * 3 + i) * 0.2)
        : 1;

      // グロー
      if (isSelected || zone === 'active' || zone === 'potential') {
        const glowColor = (zone === 'active' || isSelected) ? [196, 146, 42] : c;
        const glowSize  = zone === 'active' ? 20 : zone === 'potential' ? 14 : 9;
        const glowAlpha = isSelected ? 0.5 : zone === 'active' ? 0.42 : 0.2;
        const glowR = (dotR + glowSize) * pulse;
        const grad = ctx.createRadialGradient(dp.x, dp.y, 0, dp.x, dp.y, glowR);
        grad.addColorStop(0,   `rgba(${glowColor[0]},${glowColor[1]},${glowColor[2]},${glowAlpha})`);
        grad.addColorStop(0.5, `rgba(${glowColor[0]},${glowColor[1]},${glowColor[2]},${glowAlpha * 0.3})`);
        grad.addColorStop(1,   `rgba(${glowColor[0]},${glowColor[1]},${glowColor[2]},0)`);
        ctx.beginPath();
        ctx.arc(dp.x, dp.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // ドット本体
      ctx.beginPath();
      ctx.arc(dp.x, dp.y, dotR * pulse, 0, Math.PI * 2);
      if (zone === 'dormant') {
        ctx.fillStyle = isSelected ? `rgb(${c[0]},${c[1]},${c[2]})` : '#BBBBBB';
        ctx.strokeStyle = 'rgba(150,150,150,0.5)';
        ctx.lineWidth = 1;
      } else if (zone === 'active') {
        ctx.fillStyle = isSelected ? `rgb(${c[0]},${c[1]},${c[2]})` : '#FFFFFF';
        ctx.strokeStyle = `rgba(196,146,42,0.9)`;
        ctx.lineWidth = 2.5;
      } else if (zone === 'potential') {
        ctx.fillStyle = isSelected ? `rgb(${c[0]},${c[1]},${c[2]})` : '#FFFFFF';
        ctx.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.lineWidth = 1.8;
      } else {
        ctx.fillStyle = isSelected ? `rgb(${c[0]},${c[1]},${c[2]})` : '#FFFFFF';
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},0.55)`;
        ctx.lineWidth = 1;
      }
      ctx.fill();
      ctx.stroke();

      // 中心ハイライト
      ctx.beginPath();
      ctx.arc(dp.x, dp.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = zone === 'active' ? 'rgba(255,215,0,0.9)' : '#FDFCFA';
      ctx.fill();
    }

    // === ラベル（ゾーンベース・花びら配置）===
    const labelR = R + 22;
    for (let i = 0; i < N; i++) {
      const gi = Math.floor(i / 4);
      const gep = groupEp[gi];
      if (gep < 0.3) continue;
      const labelAlpha = Math.min((gep - 0.3) / 0.7, 1);

      const angle = getPetalAngle(i);
      const lx = cx + Math.cos(angle) * labelR * gep;
      const ly = cy + Math.sin(angle) * labelR * gep;
      const c = points[i].color;
      const isSelected = activeI === i;
      const zone = getZone(points[i].raw);
      const topRank = top3.findIndex(t => t.idx === i);
      const cos = Math.cos(angle);
      const align = cos > 0.15 ? 'left' : cos < -0.15 ? 'right' : 'center';
      const nudge = cos > 0.15 ? 8 : cos < -0.15 ? -8 : 0;

      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = labelAlpha;

      if (isSelected) {
        ctx.font = '700 15px "DM Sans", sans-serif';
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.fillText(points[i].raw + '', lx + nudge, ly - 8);
        ctx.font = '700 11px "Noto Serif JP", serif';
        ctx.fillStyle = '#2A2520';
        ctx.fillText(points[i].jp, lx + nudge, ly + 6);
        ctx.font = '600 9px "DM Sans", sans-serif';
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.7)`;
        ctx.fillText(points[i].pct + '%', lx + nudge, ly + 19);
      } else if (zone === 'active') {
        ctx.save();
        ctx.shadowColor = `rgba(${c[0]},${c[1]},${c[2]},0.6)`;
        ctx.shadowBlur = 14;
        ctx.font = `800 20px "DM Sans", sans-serif`;
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.fillText(points[i].raw + '', lx + nudge, ly - 10);
        const numW = ctx.measureText(points[i].raw + '').width;
        ctx.restore();
        if (topRank >= 0) {
          ctx.font = `700 9px "DM Sans", sans-serif`;
          ctx.fillStyle = '#C4922A';
          const bx = align === 'left' ? lx + nudge + numW + 4
            : align === 'right' ? lx + nudge - numW - 4
            : lx + nudge + numW / 2 + 4;
          ctx.fillText('#' + (topRank + 1), bx, ly - 18);
        }
        ctx.font = `800 11px "Noto Serif JP", serif`;
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.fillText(points[i].jp, lx + nudge, ly + 6);
        ctx.font = `600 9px "DM Sans", sans-serif`;
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.75)`;
        ctx.fillText(points[i].pct + '%', lx + nudge, ly + 19);
      } else if (zone === 'potential') {
        ctx.font = `700 15px "DM Sans", sans-serif`;
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.85)`;
        ctx.fillText(points[i].raw + '', lx + nudge, ly - 8);
        ctx.font = `500 10px "Noto Serif JP", serif`;
        ctx.fillStyle = 'rgba(42,37,32,0.65)';
        ctx.fillText(points[i].jp, lx + nudge, ly + 6);
      } else if (zone === 'emerging') {
        ctx.font = `500 12px "DM Sans", sans-serif`;
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.55)`;
        ctx.fillText(points[i].raw + '', lx + nudge, ly - 7);
        ctx.font = `400 9px "Noto Serif JP", serif`;
        ctx.fillStyle = 'rgba(42,37,32,0.4)';
        ctx.fillText(points[i].jp, lx + nudge, ly + 5);
      } else {
        ctx.font = `400 11px "DM Sans", sans-serif`;
        ctx.fillStyle = 'rgba(42,37,32,0.28)';
        ctx.fillText(points[i].raw + '', lx + nudge, ly - 6);
        ctx.font = `400 9px "Noto Serif JP", serif`;
        ctx.fillStyle = 'rgba(42,37,32,0.18)';
        ctx.fillText(points[i].jp, lx + nudge, ly + 5);
      }
      ctx.globalAlpha = 1;
    }

    // === センター（白丸 + 回転ゴールドリング）===
    const centerR = 32 + breath * 3;
    // ゴールドリング — 微回転（0.05 rad/s）
    const ringRotation = st.time * 0.05;
    for (let seg = 0; seg < 24; seg++) {
      const a1 = (Math.PI * 2 * seg) / 24 + ringRotation - Math.PI / 2;
      const a2 = (Math.PI * 2 * (seg + 1)) / 24 + ringRotation - Math.PI / 2;
      const t = (seg % 12) / 12;
      const alpha = (0.12 + t * 0.28 + breath * 0.08) * ep;
      ctx.beginPath();
      ctx.arc(cx, cy, centerR + 5, a1, a2);
      ctx.arc(cx, cy, centerR + 1, a2, a1, true);
      ctx.closePath();
      ctx.fillStyle = `rgba(196,146,42,${alpha})`;
      ctx.fill();
    }
    // 外側細リング
    ctx.beginPath();
    ctx.arc(cx, cy, centerR + 7, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(196,146,42,${0.15 * ep})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // 白い丸
    ctx.beginPath();
    ctx.arc(cx, cy, centerR, 0, Math.PI * 2);
    ctx.fillStyle = '#FDFCFA';
    ctx.fill();
    ctx.strokeStyle = `rgba(212,201,176,0.8)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // TOTAL%
    const displayPct = Math.round(totalPct * ep);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 22px "DM Sans", sans-serif';
    ctx.fillStyle = '#2A2520';
    ctx.fillText(displayPct + '', cx, cy - 3);
    ctx.font = '500 7px "DM Sans", sans-serif';
    ctx.fillStyle = 'rgba(122,112,96,0.7)';
    ctx.fillText('TOTAL %', cx, cy + 13);

    frameRef.current = requestAnimationFrame(draw);
  }, [points, totalPct, top3, top5, maxSub]);

  useEffect(() => {
    stateRef.current.startTime = null;
    setBarsVisible(false);
    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw]);

  const handleInteraction = useCallback((e, isClick) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const R = Math.min(rect.width, rect.height) * 0.32;
    const ep = stateRef.current.entryProgress;

    let closest = -1;
    let closestDist = 32;
    for (let i = 0; i < N; i++) {
      const angle = getPetalAngle(i);
      const dr = points[i].ratio * R * ep;
      const px = cx + Math.cos(angle) * dr;
      const py = cy + Math.sin(angle) * dr;
      const dist = Math.sqrt((mx - px) ** 2 + (my - py) ** 2);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    }

    if (isClick) {
      setSelectedIdx(closest === selectedIdx ? null : closest >= 0 ? closest : null);
      // リップル追加
      if (closest >= 0) {
        stateRef.current.ripples.push({ idx: closest, t: 0 });
      }
    } else {
      setHoveredIdx(closest >= 0 ? closest : null);
    }
  }, [points, selectedIdx]);

  const activeIdx = selectedIdx ?? hoveredIdx;
  const activePoint = activeIdx != null ? points[activeIdx] : null;

  return (
    <div style={{ borderRadius: 20, overflow: 'hidden', border: `1px solid ${PALETTE.border}` }}>
      {/* Canvas エリア */}
      <div style={{
        background: 'transparent',
        padding: '28px 8px 16px',
        position: 'relative',
      }}>
        {/* タイトル */}
        <div style={{ textAlign: 'center', marginBottom: 12, position: 'relative', zIndex: 1 }}>
          <div style={{
            fontSize: 9, color: '#C4922A', letterSpacing: '0.35em', fontWeight: 600,
            textTransform: 'uppercase', opacity: 0.75,
          }}>
            Sixteen-Axis Activation Matrix
          </div>
          <div style={{
            fontFamily: "'Noto Serif JP', serif", fontSize: 18, fontWeight: 700,
            color: '#2A2520', letterSpacing: '0.1em', marginTop: 4,
          }}>
            16軸 才覚レーダー
          </div>
        </div>

        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: 'min(85vw, 520px)',
            display: 'block',
            cursor: 'pointer',
          }}
          onClick={(e) => handleInteraction(e, true)}
          onMouseMove={(e) => handleInteraction(e, false)}
          onMouseLeave={() => setHoveredIdx(null)}
        />
      </div>

      {/* 詳細カード */}
      {activePoint && selectedIdx != null && (
        <div style={{
          background: PALETTE.surface,
          borderTop: `1px solid ${PALETTE.border}`,
          padding: '16px 20px 20px',
          animation: 'amFadeIn 0.3s ease',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
          }}>
            <div>
              <span style={{ fontSize: 16, fontWeight: 700, color: activePoint.hex }}>
                {activePoint.jp}
              </span>
              <span style={{ fontSize: 11, color: PALETTE.textSub, marginLeft: 8 }}>
                {activePoint.label}
              </span>
            </div>
            <div style={{ fontFamily: NUM_FONT, fontSize: 24, fontWeight: 800, color: PALETTE.text }}>
              {activePoint.pct}<span style={{ fontSize: 13, fontWeight: 400, color: PALETTE.textSub }}>%</span>
            </div>
          </div>
          <div style={{ height: 3, background: PALETTE.border, borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{
              height: '100%', width: `${activePoint.pct}%`,
              background: `linear-gradient(90deg, ${activePoint.hex}, ${activePoint.hex}88)`,
              borderRadius: 2, transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ fontSize: 11, color: PALETTE.textSub }}>
            {activePoint.raw}/{maxSub} — {AXIS_META[activePoint.axis].kanji} {AXIS_META[activePoint.axis].en}
          </div>
        </div>
      )}

      {/* ランキングカード */}
      <div style={{
        background: PALETTE.surface,
        borderTop: `1px solid ${PALETTE.border}`,
        padding: '20px 20px 28px',
        display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap',
      }}>
        {/* Strengths */}
        <div style={{ flex: '1 1 140px', maxWidth: 220 }}>
          <div style={{
            fontSize: 9, color: '#C4922A', letterSpacing: '0.25em', fontWeight: 700,
            marginBottom: 12, textTransform: 'uppercase', textAlign: 'center', opacity: 0.85,
          }}>
            Strengths
          </div>
          {top3.map((p, i) => (
            <div key={p.key} style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6,
              padding: '8px 12px', borderRadius: 10,
              background: i === 0 ? 'rgba(196,146,42,0.07)' : 'transparent',
              border: i === 0
                ? '1px solid rgba(196,146,42,0.25)'
                : `1px solid ${PALETTE.border}`,
              animation: `amSlideIn 0.4s ease ${i * 0.1 + 0.2}s both`,
            }}>
              <span style={{
                fontFamily: NUM_FONT, fontSize: 14, fontWeight: 800,
                color: i === 0 ? '#C4922A' : PALETTE.textSub,
                width: 20, textAlign: 'center',
              }}>
                {i + 1}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 13, color: PALETTE.text,
                  fontWeight: i === 0 ? 700 : 500,
                  fontFamily: "'Noto Serif JP', serif",
                }}>
                  {p.jp}
                </div>
                {/* アニメーションバー */}
                <div style={{
                  height: 2, background: PALETTE.border, borderRadius: 1,
                  overflow: 'hidden', marginTop: 4,
                }}>
                  <div style={{
                    height: '100%',
                    width: barsVisible ? `${p.pct}%` : '0%',
                    background: `linear-gradient(90deg, ${p.hex}, ${p.hex}66)`,
                    borderRadius: 1,
                    transition: `width 0.8s cubic-bezier(0.4,0,0.2,1) ${i * 0.15}s`,
                  }} />
                </div>
                <div style={{ fontSize: 9, color: PALETTE.textSub, marginTop: 2 }}>{p.label}</div>
              </div>
              <span style={{
                fontFamily: NUM_FONT, fontSize: 15, fontWeight: 700, color: p.hex,
              }}>
                {p.pct}<span style={{ fontSize: 10, fontWeight: 400, color: PALETTE.textSub }}>%</span>
              </span>
            </div>
          ))}
        </div>

        {/* Growth Areas */}
        <div style={{ flex: '1 1 140px', maxWidth: 220 }}>
          <div style={{
            fontSize: 9, color: PALETTE.textSub, letterSpacing: '0.25em', fontWeight: 700,
            marginBottom: 12, textTransform: 'uppercase', textAlign: 'center',
          }}>
            Growth Areas
          </div>
          {bottom3.map((p, i) => (
            <div key={p.key} style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6,
              padding: '8px 12px', borderRadius: 10,
              border: `1px solid ${PALETTE.border}`,
              animation: `amSlideIn 0.4s ease ${i * 0.1 + 0.4}s both`,
            }}>
              <span style={{
                fontFamily: NUM_FONT, fontSize: 14, fontWeight: 800,
                color: PALETTE.border, width: 20, textAlign: 'center',
              }}>
                {14 + i}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 13, color: PALETTE.textSub, fontWeight: 500,
                  fontFamily: "'Noto Serif JP', serif",
                }}>
                  {p.jp}
                </div>
                <div style={{ fontSize: 9, color: PALETTE.border, marginTop: 1 }}>{p.label}</div>
              </div>
              <span style={{
                fontFamily: NUM_FONT, fontSize: 15, fontWeight: 700, color: PALETTE.textSub,
              }}>
                {p.pct}<span style={{ fontSize: 10, fontWeight: 400, color: PALETTE.border }}>%</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes amFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes amSlideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
