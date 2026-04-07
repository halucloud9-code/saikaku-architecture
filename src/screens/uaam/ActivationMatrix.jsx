import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

/**
 * ActivationMatrix — 16項目統一チャート
 * System 1 Design: 見た瞬間に心を奪う
 * ResultScreen カラーパレット完全統一版
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

// 旧: 均等16分割（被り発生）
function getAngle(i) {
  return (Math.PI * 2 * i) / N - Math.PI * 3 / 4;
}

// 新: 花びら設計 — 4グループ × 22°間隔、グループ間24°ギャップ
// 志(top=-90°) / 知(right=0°) / 技(bottom=90°) / 衝(left=180°)
const PETAL_ALPHA = 22 * Math.PI / 180; // グループ内隣軸間隔 22°
const PETAL_CENTERS = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];

function getPetalAngle(i) {
  const g = Math.floor(i / 4); // グループ 0-3
  const a = i % 4;             // グループ内 0-3
  return PETAL_CENTERS[g] + (a - 1.5) * PETAL_ALPHA;
  // グループ内オフセット: -33°, -11°, +11°, +33°
  // グループスパン: 66°、グループ間ギャップ: 24°
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

export default function ActivationMatrix({ scores, maxSub = 20 }) {
  const canvasRef = useRef(null);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const stateRef = useRef({ time: 0, entryProgress: 0, particles: [], mouseX: -1, mouseY: -1, activeI: null });
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
  // useMemo で安定した参照を保つ（これがないと hover のたびに draw が再生成されアニメーションがリセットされる）
  const top3 = useMemo(() => sorted.slice(0, 3), [sorted]);
  const top5 = useMemo(() => sorted.slice(0, 5), [sorted]);
  const bottom3 = useMemo(() => sorted.slice(-3).reverse(), [sorted]);

  // hover/click のたびに stateRef に書くだけ（animation は再起動しない）
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
    if (!st.startTime) st.startTime = timestamp;
    st.time = (timestamp - st.startTime) / 1000;

    const entryT = Math.min((timestamp - st.startTime) / 1800, 1);
    st.entryProgress = entryT === 1 ? 1 : 1 - Math.pow(2, -12 * entryT);

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
    const ep = st.entryProgress;
    const breath = Math.sin(st.time * 1.2) * 0.5 + 0.5;

    ctx.clearRect(0, 0, W, H);

    // === ×型クロスライン ===
    ctx.save();
    ctx.globalAlpha = 0.07 * ep;
    ctx.strokeStyle = `rgba(42,37,32,0.6)`;
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(cx - R * 1.3, cy - R * 1.3); ctx.lineTo(cx + R * 1.3, cy + R * 1.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + R * 1.3, cy - R * 1.3); ctx.lineTo(cx - R * 1.3, cy + R * 1.3); ctx.stroke();
    ctx.restore();

    // === 花びらグリッドリング（グループ別弧）===
    [0.25, 0.5, 0.75, 1.0].forEach((p, ri) => {
      const gr = R * p * ep;
      AXIS_META.forEach((axis, gi) => {
        const a1 = getPetalAngle(gi * 4);
        const a2 = getPetalAngle(gi * 4 + 3);
        const c = axis.color;
        const alpha = (p === 1 ? 0.18 : 0.07 + ri * 0.02) * ep;
        ctx.beginPath();
        ctx.arc(cx, cy, gr, a1, a2);
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
        ctx.lineWidth = p === 1 ? 1.2 : 0.6;
        ctx.stroke();
      });
    });

    // === ゾーン閾値弧（Activeライン 16/20=0.8）===
    const thresholdR = R * 0.8 * ep;
    ctx.save();
    ctx.setLineDash([3, 5]);
    AXIS_META.forEach((axis, gi) => {
      const a1 = getPetalAngle(gi * 4);
      const a2 = getPetalAngle(gi * 4 + 3);
      const c = axis.color;
      ctx.beginPath();
      ctx.arc(cx, cy, thresholdR, a1, a2);
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.45 * ep})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.restore();

    // === スポーク（グループ内のみ）===
    for (let i = 0; i < N; i++) {
      const angle = getPetalAngle(i);
      const outerX = cx + Math.cos(angle) * R * ep;
      const outerY = cy + Math.sin(angle) * R * ep;
      const grad = ctx.createLinearGradient(cx, cy, outerX, outerY);
      const c = AXIS_META[SUB_META[i].axis].color;
      const isEdge = i % 4 === 0 || i % 4 === 3; // グループ境界軸
      grad.addColorStop(0, 'rgba(42,37,32,0)');
      grad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},${(isEdge ? 0.18 : 0.06) * ep})`);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(outerX, outerY);
      ctx.strokeStyle = grad;
      ctx.lineWidth = isEdge ? 0.8 : 0.4;
      ctx.stroke();
    }

    // === セクター淡色（花びら扇形）===
    AXIS_META.forEach((axis, gi) => {
      const a1 = getPetalAngle(gi * 4);
      const a2 = getPetalAngle(gi * 4 + 3);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R * ep, a1, a2);
      ctx.closePath();
      const c = axis.color;
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.03 * ep})`;
      ctx.fill();
    });

    // === データポリゴン（花びら4枚・グループ独立）===
    const getDataPoint = (i) => {
      const angle = getPetalAngle(i);
      const dr = points[i].ratio * R * ep;
      return { x: cx + Math.cos(angle) * dr, y: cy + Math.sin(angle) * dr };
    };

    // ★ 花びら4枚をそれぞれ独立して描画（グループ間は繋がない）
    AXIS_META.forEach((axis, gi) => {
      const startI = gi * 4;
      const c = axis.color;

      // ── ゴールドグロー（この花びら分）──
      ctx.save();
      ctx.shadowColor = `rgba(196,146,42,${0.2 + breath * 0.1})`;
      ctx.shadowBlur = 14 + breath * 7;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let j = 0; j < 4; j++) {
        const dp = getDataPoint(startI + j);
        ctx.lineTo(dp.x, dp.y);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(196,146,42,${0.4 * ep})`;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.restore();

      // ── グラデーション塗り ──
      const fillGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      fillGrad.addColorStop(0,   `rgba(${c[0]},${c[1]},${c[2]},${0.05 * ep})`);
      fillGrad.addColorStop(0.55, `rgba(${c[0]},${c[1]},${c[2]},${(0.16 + breath * 0.06) * ep})`);
      fillGrad.addColorStop(1,   `rgba(${c[0]},${c[1]},${c[2]},${(0.3 + breath * 0.08) * ep})`);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let j = 0; j < 4; j++) {
        const dp = getDataPoint(startI + j);
        ctx.lineTo(dp.x, dp.y);
      }
      ctx.closePath();
      ctx.fillStyle = fillGrad;
      ctx.fill();

      // ── 外縁ストローク（グループ内の3辺のみ・他グループとは繋がない）──
      for (let j = 0; j < 3; j++) {
        const p1 = getDataPoint(startI + j);
        const p2 = getDataPoint(startI + j + 1);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.7 * ep})`;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      // 花びら両側辺（中心→端点）
      [0, 3].forEach(j => {
        const dp = getDataPoint(startI + j);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(dp.x, dp.y);
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.25 * ep})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      });
    });

    // === パーティクル ===
    st.particles.forEach(pt => {
      pt.life += pt.speed * 0.008;
      if (pt.life > 1) { pt.life = 0; pt.idx = Math.floor(Math.random() * N); }

      const dp = getDataPoint(pt.idx);
      const angle = getAngle(pt.idx) + pt.offset;
      const dist = pt.life * 30;
      const px = dp.x + Math.cos(angle) * dist;
      const py = dp.y + Math.sin(angle) * dist;
      const alpha = (1 - pt.life) * pt.brightness * ep * 0.7;
      const c = AXIS_META[SUB_META[pt.idx].axis].color;

      ctx.beginPath();
      ctx.arc(px, py, pt.size * (1 - pt.life * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
      ctx.fill();
    });

    // === データドット（ゾーンベース）===
    const activeI = stateRef.current.activeI;
    for (let i = 0; i < N; i++) {
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
        ? (1 + Math.sin(st.time * 3 + i) * 0.18)
        : 1;

      // グロー
      if (isSelected || zone === 'active' || zone === 'potential') {
        const glowColor = (zone === 'active' || isSelected) ? [196, 146, 42] : c;
        const glowSize  = zone === 'active' ? 18 : zone === 'potential' ? 12 : 8;
        const glowAlpha = isSelected ? 0.45 : zone === 'active' ? 0.38 : 0.18;
        const glowR = (dotR + glowSize) * pulse;
        const grad = ctx.createRadialGradient(dp.x, dp.y, 0, dp.x, dp.y, glowR);
        grad.addColorStop(0, `rgba(${glowColor[0]},${glowColor[1]},${glowColor[2]},${glowAlpha})`);
        grad.addColorStop(0.5, `rgba(${glowColor[0]},${glowColor[1]},${glowColor[2]},${glowAlpha * 0.3})`);
        grad.addColorStop(1, `rgba(${glowColor[0]},${glowColor[1]},${glowColor[2]},0)`);
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
        ctx.lineWidth = 2;
      } else if (zone === 'potential') {
        ctx.fillStyle = isSelected ? `rgb(${c[0]},${c[1]},${c[2]})` : '#FFFFFF';
        ctx.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.lineWidth = 1.5;
      } else { // emerging
        ctx.fillStyle = isSelected ? `rgb(${c[0]},${c[1]},${c[2]})` : '#FFFFFF';
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},0.55)`;
        ctx.lineWidth = 1;
      }
      ctx.fill();
      ctx.stroke();

      // 中心ハイライト
      ctx.beginPath();
      ctx.arc(dp.x, dp.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = zone === 'active' ? 'rgba(255,215,0,0.85)' : '#FDFCFA';
      ctx.fill();
    }

    // === ラベル（ゾーンベース・花びら配置）===
    // 各花びら内に収まる配置 — getPetalAngle で軸角を算出
    const labelR = R + 22;
    for (let i = 0; i < N; i++) {
      const angle = getPetalAngle(i);
      const lx = cx + Math.cos(angle) * labelR * ep;
      const ly = cy + Math.sin(angle) * labelR * ep;
      const c = points[i].color;
      const isSelected = activeI === i;
      const zone = getZone(points[i].raw);
      const topRank = top3.findIndex(t => t.idx === i);
      const cos = Math.cos(angle);
      const align = cos > 0.15 ? 'left' : cos < -0.15 ? 'right' : 'center';
      const nudge = cos > 0.15 ? 8 : cos < -0.15 ? -8 : 0;

      ctx.textAlign = align;
      ctx.textBaseline = 'middle';

      if (isSelected) {
        // 選択時: 詳細表示
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
        // Active: 軸カラーで大きい数値 + 軸色グロー
        ctx.save();
        ctx.shadowColor = `rgba(${c[0]},${c[1]},${c[2]},0.6)`;
        ctx.shadowBlur = 14;
        ctx.font = `800 20px "DM Sans", sans-serif`;
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.fillText(points[i].raw + '', lx + nudge, ly - 10);
        const numW20 = ctx.measureText(points[i].raw + '').width;
        ctx.restore();
        if (topRank >= 0) {
          ctx.font = `700 9px "DM Sans", sans-serif`;
          ctx.fillStyle = '#C4922A';
          const bx = align === 'left' ? lx + nudge + numW20 + 4
            : align === 'right' ? lx + nudge - numW20 - 4
            : lx + nudge + numW20 / 2 + 4;
          ctx.fillText('#' + (topRank + 1), bx, ly - 18);
        }
        ctx.font = `800 11px "Noto Serif JP", serif`;
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.fillText(points[i].jp, lx + nudge, ly + 6);
        ctx.font = `600 9px "DM Sans", sans-serif`;
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.75)`;
        ctx.fillText(points[i].pct + '%', lx + nudge, ly + 19);

      } else if (zone === 'potential') {
        // Potential: 中サイズ + 軸色
        ctx.font = `700 15px "DM Sans", sans-serif`;
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.85)`;
        ctx.fillText(points[i].raw + '', lx + nudge, ly - 8);
        ctx.font = `500 10px "Noto Serif JP", serif`;
        ctx.fillStyle = 'rgba(42,37,32,0.65)';
        ctx.fillText(points[i].jp, lx + nudge, ly + 6);

      } else if (zone === 'emerging') {
        // Emerging: 小さめ + 薄い軸色
        ctx.font = `500 12px "DM Sans", sans-serif`;
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.55)`;
        ctx.fillText(points[i].raw + '', lx + nudge, ly - 7);
        ctx.font = `400 9px "Noto Serif JP", serif`;
        ctx.fillStyle = 'rgba(42,37,32,0.4)';
        ctx.fillText(points[i].jp, lx + nudge, ly + 5);

      } else {
        // Dormant: 最小・グレー・薄い
        ctx.font = `400 11px "DM Sans", sans-serif`;
        ctx.fillStyle = 'rgba(42,37,32,0.28)';
        ctx.fillText(points[i].raw + '', lx + nudge, ly - 6);
        ctx.font = `400 9px "Noto Serif JP", serif`;
        ctx.fillStyle = 'rgba(42,37,32,0.18)';
        ctx.fillText(points[i].jp, lx + nudge, ly + 5);
      }
    }

    // === 軸漢字ラベル（花びら中心方向 = 4方位の外端）===
    // PETAL_CENTERS[gi] = -π/2(上), 0(右), π/2(下), π(左) を使用
    // → getAngle(ai*4+2) 不使用：被りの根本原因だったため廃止
    const kanjiR = Math.min(R + 82, Math.min(W / 2, H / 2) - 16);
    AXIS_META.forEach((axis, gi) => {
      const midAngle = PETAL_CENTERS[gi]; // 4方位: 上/右/下/左
      const targetX = cx + Math.cos(midAngle) * kanjiR;
      const targetY = cy + Math.sin(midAngle) * kanjiR;
      const kx = targetX * ep + cx * (1 - ep);
      const ky = targetY * ep + cy * (1 - ep);
      const c = axis.color;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 漢字（軸色、Noto Serif JP）
      ctx.font = '800 24px "Noto Serif JP", serif';
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.78 + breath * 0.12})`;
      ctx.fillText(axis.kanji, kx, ky - 5);

      // English sublabel
      ctx.font = '600 8px "DM Sans", sans-serif';
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.5)`;
      ctx.fillText(axis.en.toUpperCase(), kx, ky + 12);
    });

    // === センター（白丸 + ゴールドリング）===
    const centerR = 32 + breath * 3;

    // ゴールドのconical gradient風リング（複数段で近似）
    for (let seg = 0; seg < 16; seg++) {
      const a1 = (Math.PI * 2 * seg) / 16 - Math.PI / 2;
      const a2 = (Math.PI * 2 * (seg + 1)) / 16 - Math.PI / 2;
      const t = seg / 16;
      const alpha = 0.15 + t * 0.25 + breath * 0.1;
      ctx.beginPath();
      ctx.arc(cx, cy, centerR + 4, a1, a2);
      ctx.arc(cx, cy, centerR + 1, a2, a1, true);
      ctx.closePath();
      ctx.fillStyle = `rgba(196,146,42,${alpha})`;
      ctx.fill();
    }

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
  // selectedIdx/hoveredIdx は stateRef.current.activeI で読む → draw の deps に含めない
  // → hover/click しても animation がリセットされない = 志/知/技/衝 が 12/3/6/9時に固定
  }, [points, totalPct, top3, top5, maxSub]);

  useEffect(() => {
    stateRef.current.startTime = null;
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
    let closestDist = 30;
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
                <div style={{ fontSize: 9, color: PALETTE.textSub, marginTop: 1 }}>{p.label}</div>
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
      `}</style>
    </div>
  );
}
