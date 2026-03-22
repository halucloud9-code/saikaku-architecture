import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

/**
 * ActivationMatrix — 16項目統一チャート
 * System 1 Design: 見た瞬間に心を奪う
 *
 * Canvas描画 + requestAnimationFrame で:
 * - 呼吸するグローアニメーション
 * - パーティクルエフェクト（データ頂点から放射）
 * - グラデーションポリゴン（軸色が滑らかに遷移）
 * - 展開アニメーション（easeOutExpo）
 */

const NUM_FONT = "'DM Sans', 'Outfit', sans-serif";
const N = 16;

const AXIS_META = [
  { key: 'mindset',    kanji: '志', en: 'MindSet',    color: [90, 150, 220],  hex: '#5A96DC' },
  { key: 'literacy',   kanji: '知', en: 'Literacy',   color: [70, 195, 130],  hex: '#46C382' },
  { key: 'competency', kanji: '技', en: 'Competency', color: [220, 175, 70],  hex: '#DCAF46' },
  { key: 'impact',     kanji: '衝', en: 'Impact',     color: [220, 95, 80],   hex: '#DC5F50' },
];

const SUB_META = [
  { key: 'meaning',       axis: 0, label: 'Meaning',       jp: '意味' },
  { key: 'mindfulness',   axis: 0, label: 'Mindfulness',   jp: '気づき' },
  { key: 'mindshift',     axis: 0, label: 'Mindshift',     jp: '意識転換' },
  { key: 'mastery',       axis: 0, label: 'Mastery',       jp: '熟達' },
  { key: 'learning',      axis: 1, label: 'Learning',      jp: '学習' },
  { key: 'logical',       axis: 1, label: 'Logical',       jp: '論理' },
  { key: 'life',          axis: 1, label: 'Life',          jp: '社会実装' },
  { key: 'leadership',    axis: 1, label: 'Leadership',    jp: 'リーダーシップ' },
  { key: 'critical',      axis: 2, label: 'Critical',      jp: '批判的思考' },
  { key: 'creativity',    axis: 2, label: 'Creativity',    jp: '創造性' },
  { key: 'communication', axis: 2, label: 'Communication', jp: '伝える力' },
  { key: 'collaboration', axis: 2, label: 'Collaboration', jp: '協働' },
  { key: 'idea',           axis: 3, label: 'Idea',           jp: 'アイデア' },
  { key: 'innovation',     axis: 3, label: 'Innovation',     jp: '変革' },
  { key: 'implementation', axis: 3, label: 'Implementation', jp: '実装' },
  { key: 'influence',      axis: 3, label: 'Influence',      jp: '影響' },
];

function getAngle(i) {
  return (Math.PI * 2 * i) / N - Math.PI / 2;
}

function lerpColor(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ];
}

export default function ActivationMatrix({ scores, maxSub = 20 }) {
  const canvasRef = useRef(null);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const stateRef = useRef({ time: 0, entryProgress: 0, particles: [], mouseX: -1, mouseY: -1 });
  const frameRef = useRef(null);

  // Build data
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
  const top3 = sorted.slice(0, 3);
  const bottom3 = sorted.slice(-3).reverse();

  // Init particles
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

    // Entry animation (1.8s easeOutExpo)
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
    const breath = Math.sin(st.time * 1.2) * 0.5 + 0.5; // 0~1 breathing

    ctx.clearRect(0, 0, W, H);

    // === Background radial glow ===
    const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.8);
    bgGrad.addColorStop(0, `rgba(184,150,12,${0.04 + breath * 0.02})`);
    bgGrad.addColorStop(0.5, 'rgba(40,35,25,0.03)');
    bgGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // === Grid rings (organic, breathing) ===
    [0.25, 0.5, 0.75, 1.0].forEach((p, ri) => {
      const gr = R * p * ep;
      const breathOffset = breath * 1.5 * (1 - p);
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const angle = getAngle(i % N);
        const x = cx + Math.cos(angle) * (gr + breathOffset);
        const y = cy + Math.sin(angle) * (gr + breathOffset);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      const alpha = p === 1 ? 0.15 : 0.04 + ri * 0.02;
      ctx.strokeStyle = `rgba(255,255,255,${alpha * ep})`;
      ctx.lineWidth = p === 1 ? 1 : 0.5;
      ctx.stroke();
    });

    // === Spokes with gradient ===
    for (let i = 0; i < N; i++) {
      const angle = getAngle(i);
      const outerX = cx + Math.cos(angle) * R * ep;
      const outerY = cy + Math.sin(angle) * R * ep;
      const grad = ctx.createLinearGradient(cx, cy, outerX, outerY);
      const c = AXIS_META[SUB_META[i].axis].color;
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},${(i % 4 === 0 ? 0.2 : 0.06) * ep})`);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(outerX, outerY);
      ctx.strokeStyle = grad;
      ctx.lineWidth = i % 4 === 0 ? 1 : 0.5;
      ctx.stroke();
    }

    // === Sector tint ===
    AXIS_META.forEach((axis, ai) => {
      const a1 = getAngle(ai * 4);
      const a2 = getAngle((ai + 1) * 4);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R * ep, a1, a2);
      ctx.closePath();
      const c = axis.color;
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.03 * ep})`;
      ctx.fill();
    });

    // === Data polygon (gradient colored per axis) ===
    // Draw filled segments per axis group
    const getDataPoint = (i) => {
      const angle = getAngle(i);
      const dr = points[i].ratio * R * ep;
      return { x: cx + Math.cos(angle) * dr, y: cy + Math.sin(angle) * dr };
    };

    // Glow layer
    ctx.save();
    ctx.shadowColor = `rgba(220,180,60,${0.3 + breath * 0.15})`;
    ctx.shadowBlur = 20 + breath * 10;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const p = getDataPoint(i);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.strokeStyle = `rgba(255,220,80,${0.4 * ep})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Fill per-axis group with gradient
    AXIS_META.forEach((axis, ai) => {
      const startI = ai * 4;
      const c = axis.color;
      const nextC = AXIS_META[(ai + 1) % 4].color;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let j = 0; j <= 4; j++) {
        const idx = (startI + j) % N;
        const dp = getDataPoint(idx);
        ctx.lineTo(dp.x, dp.y);
      }
      ctx.closePath();

      const fillGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      fillGrad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${0.08 * ep})`);
      fillGrad.addColorStop(0.6, `rgba(${c[0]},${c[1]},${c[2]},${(0.2 + breath * 0.08) * ep})`);
      fillGrad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},${(0.35 + breath * 0.1) * ep})`);
      ctx.fillStyle = fillGrad;
      ctx.fill();
    });

    // Stroke (colored per segment)
    for (let i = 0; i < N; i++) {
      const p1 = getDataPoint(i);
      const p2 = getDataPoint((i + 1) % N);
      const c1 = AXIS_META[SUB_META[i].axis].color;
      const c2 = AXIS_META[SUB_META[(i + 1) % N].axis].color;
      const mc = lerpColor(c1, c2, 0.5);

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = `rgba(${mc[0]},${mc[1]},${mc[2]},${0.7 * ep})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // === Particles ===
    st.particles.forEach(pt => {
      pt.life += pt.speed * 0.008;
      if (pt.life > 1) { pt.life = 0; pt.idx = Math.floor(Math.random() * N); }

      const dp = getDataPoint(pt.idx);
      const angle = getAngle(pt.idx) + pt.offset;
      const dist = pt.life * 30;
      const px = dp.x + Math.cos(angle) * dist;
      const py = dp.y + Math.sin(angle) * dist;
      const alpha = (1 - pt.life) * pt.brightness * ep;
      const c = AXIS_META[SUB_META[pt.idx].axis].color;

      ctx.beginPath();
      ctx.arc(px, py, pt.size * (1 - pt.life * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
      ctx.fill();
    });

    // === Data dots ===
    const activeI = selectedIdx ?? hoveredIdx;
    for (let i = 0; i < N; i++) {
      const dp = getDataPoint(i);
      const c = points[i].color;
      const isActive = activeI === i;
      const topRank = top3.findIndex(t => t.idx === i);
      const isTop = topRank >= 0;
      const dotR = isActive ? 8 : topRank === 0 ? 7 : topRank === 1 ? 6 : isTop ? 5.5 : 3;
      const pulseR = isTop ? (1 + Math.sin(st.time * 3 + i) * (topRank === 0 ? 0.2 : 0.12)) : 1;

      // Outer glow (Top3 = bigger, brighter)
      if (isActive || isTop) {
        const glowSize = topRank === 0 ? 18 : topRank === 1 ? 14 : isTop ? 12 : 10;
        const glowR = (dotR + glowSize) * pulseR;
        const glowAlpha = isActive ? 0.5 : topRank === 0 ? 0.4 : topRank === 1 ? 0.3 : 0.2;
        const grad = ctx.createRadialGradient(dp.x, dp.y, 0, dp.x, dp.y, glowR);
        grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${glowAlpha})`);
        grad.addColorStop(0.5, `rgba(${c[0]},${c[1]},${c[2]},${glowAlpha * 0.3})`);
        grad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
        ctx.beginPath();
        ctx.arc(dp.x, dp.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Dot
      ctx.beginPath();
      ctx.arc(dp.x, dp.y, dotR * pulseR, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? `rgb(${c[0]},${c[1]},${c[2]})` : '#FFFFFF';
      ctx.fill();
      ctx.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.lineWidth = isActive ? 2.5 : 1.5;
      ctx.stroke();

      // Center highlight
      ctx.beginPath();
      ctx.arc(dp.x, dp.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    }

    // === Labels ===
    const labelR = R + 26;
    for (let i = 0; i < N; i++) {
      const angle = getAngle(i);
      const lx = cx + Math.cos(angle) * labelR * ep;
      const ly = cy + Math.sin(angle) * labelR * ep;
      const c = points[i].color;
      const isActive = activeI === i;
      const topRank = top3.findIndex(t => t.idx === i); // 0,1,2 or -1
      const isTop = topRank >= 0;
      const cos = Math.cos(angle);
      const align = cos > 0.15 ? 'left' : cos < -0.15 ? 'right' : 'center';
      const nudge = cos > 0.15 ? 8 : cos < -0.15 ? -8 : 0;

      ctx.textAlign = align;
      ctx.textBaseline = 'middle';

      if (isTop) {
        // === TOP 3: デカい数字 + ランク + グロー ===
        const fontSize = topRank === 0 ? 22 : topRank === 1 ? 18 : 16;

        // 数字にグロー
        ctx.save();
        ctx.shadowColor = `rgba(${c[0]},${c[1]},${c[2]},0.6)`;
        ctx.shadowBlur = topRank === 0 ? 12 : 6;
        ctx.font = `800 ${fontSize}px "DM Sans", sans-serif`;
        ctx.fillStyle = topRank === 0
          ? '#FFFFFF'
          : `rgba(255,255,255,${topRank === 1 ? 0.95 : 0.85})`;
        ctx.fillText(points[i].raw + '', lx + nudge, ly - 10);
        ctx.restore();

        // ランクバッジ（#1, #2, #3）
        const badgeX = align === 'left' ? lx + nudge - 2 : align === 'right' ? lx + nudge + 2 : lx + nudge;
        ctx.font = `700 9px "DM Sans", sans-serif`;
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        const rankLabel = '#' + (topRank + 1);
        const badgeOffsetX = align === 'left'
          ? ctx.measureText(points[i].raw + '').width + 6
          : align === 'right'
          ? -(ctx.measureText(points[i].raw + '').width + 6)
          : ctx.measureText(points[i].raw + '').width / 2 + 6;
        ctx.fillText(rankLabel, lx + nudge + badgeOffsetX, ly - 14);

        // 日本語ラベル
        ctx.font = `700 ${topRank === 0 ? 12 : 11}px sans-serif`;
        ctx.fillStyle = `rgba(255,255,255,${topRank === 0 ? 0.9 : 0.7})`;
        ctx.fillText(points[i].jp, lx + nudge, ly + 6);

        // パーセンテージ
        ctx.font = `600 10px "DM Sans", sans-serif`;
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.8)`;
        ctx.fillText(points[i].pct + '%', lx + nudge, ly + 20);

      } else if (isActive) {
        // === Active（ホバー/選択）===
        ctx.font = '700 15px "DM Sans", sans-serif';
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.fillText(points[i].raw + '', lx + nudge, ly - 8);

        ctx.font = '700 11px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText(points[i].jp, lx + nudge, ly + 6);

        ctx.font = '600 9px "DM Sans", sans-serif';
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.7)`;
        ctx.fillText(points[i].pct + '%', lx + nudge, ly + 19);

      } else {
        // === 通常 ===
        ctx.font = '500 12px "DM Sans", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(points[i].raw + '', lx + nudge, ly - 7);

        ctx.font = '400 10px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillText(points[i].jp, lx + nudge, ly + 6);
      }
    }

    // === Axis kanji labels ===
    AXIS_META.forEach((axis, ai) => {
      const midAngle = getAngle(ai * 4 + 1.5);
      const kr = R + 55;
      const kx = cx + Math.cos(midAngle) * kr * ep;
      const ky = cy + Math.sin(midAngle) * kr * ep;
      const c = axis.color;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Kanji
      ctx.font = '800 22px "Noto Serif JP", serif';
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.6 + breath * 0.15})`;
      ctx.fillText(axis.kanji, kx, ky - 5);

      // English
      ctx.font = '600 8px "DM Sans", sans-serif';
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.4)`;
      ctx.fillText(axis.en.toUpperCase(), kx, ky + 12);
    });

    // === Center ===
    // Breathing ring
    const centerR = 32 + breath * 3;
    const cGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, centerR + 10);
    cGrad.addColorStop(0, 'rgba(30,28,24,0.9)');
    cGrad.addColorStop(0.7, 'rgba(20,18,14,0.8)');
    cGrad.addColorStop(1, 'rgba(20,18,14,0)');
    ctx.beginPath();
    ctx.arc(cx, cy, centerR + 10, 0, Math.PI * 2);
    ctx.fillStyle = cGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, centerR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15,13,10,0.85)';
    ctx.fill();
    ctx.strokeStyle = `rgba(220,180,60,${0.15 + breath * 0.1})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Total %
    const displayPct = Math.round(totalPct * ep);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 24px "DM Sans", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(displayPct + '', cx, cy - 2);
    ctx.font = '500 8px "DM Sans", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('TOTAL %', cx, cy + 14);

    frameRef.current = requestAnimationFrame(draw);
  }, [points, totalPct, selectedIdx, hoveredIdx, top3, maxSub]);

  // Start animation loop
  useEffect(() => {
    stateRef.current.startTime = null;
    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw]);

  // Hit detection
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
    let closestDist = 30; // hit radius in px
    for (let i = 0; i < N; i++) {
      const angle = getAngle(i);
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
    <div style={{ borderRadius: 20, overflow: 'hidden' }}>
      {/* Canvas area */}
      <div style={{
        background: 'linear-gradient(160deg, #0E0C08 0%, #161210 40%, #0E0C08 100%)',
        padding: '28px 8px 16px',
        position: 'relative',
      }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 12, position: 'relative', zIndex: 1 }}>
          <div style={{
            fontSize: 9, color: 'rgba(220,180,60,0.6)', letterSpacing: '0.35em', fontWeight: 600,
            textTransform: 'uppercase',
          }}>
            Activation Matrix
          </div>
          <div style={{
            fontFamily: "'Noto Serif JP', serif", fontSize: 18, fontWeight: 700,
            color: '#FFFFFF', letterSpacing: '0.1em', marginTop: 4,
          }}>
            才覚発動領域
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

      {/* Detail card */}
      {activePoint && selectedIdx != null && (
        <div style={{
          background: 'linear-gradient(180deg, #18150F, #0E0C08)',
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
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginLeft: 8 }}>
                {activePoint.label}
              </span>
            </div>
            <div style={{ fontFamily: NUM_FONT, fontSize: 24, fontWeight: 800, color: '#FFFFFF' }}>
              {activePoint.pct}<span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>%</span>
            </div>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{
              height: '100%', width: `${activePoint.pct}%`,
              background: `linear-gradient(90deg, ${activePoint.hex}, ${activePoint.hex}88)`,
              borderRadius: 2, transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            {activePoint.raw}/{maxSub} — {AXIS_META[activePoint.axis].kanji} {AXIS_META[activePoint.axis].en}
          </div>
        </div>
      )}

      {/* Rankings */}
      <div style={{
        background: 'linear-gradient(180deg, #0E0C08, #141210)',
        padding: '20px 20px 28px',
        display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap',
      }}>
        {/* Top 3 */}
        <div style={{ flex: '1 1 140px', maxWidth: 220 }}>
          <div style={{
            fontSize: 9, color: 'rgba(220,180,60,0.6)', letterSpacing: '0.25em', fontWeight: 700,
            marginBottom: 12, textTransform: 'uppercase', textAlign: 'center',
          }}>
            Strengths
          </div>
          {top3.map((p, i) => (
            <div key={p.key} style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6,
              padding: '8px 12px', borderRadius: 10,
              background: i === 0 ? 'rgba(220,180,60,0.08)' : 'transparent',
              border: i === 0 ? '1px solid rgba(220,180,60,0.15)' : '1px solid transparent',
            }}>
              <span style={{
                fontFamily: NUM_FONT, fontSize: 14, fontWeight: 800,
                color: i === 0 ? 'rgba(220,180,60,0.8)' : 'rgba(255,255,255,0.3)',
                width: 20, textAlign: 'center',
              }}>
                {i + 1}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: '#FFFFFF', fontWeight: i === 0 ? 700 : 500 }}>{p.jp}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>{p.label}</div>
              </div>
              <span style={{
                fontFamily: NUM_FONT, fontSize: 15, fontWeight: 700, color: p.hex,
              }}>
                {p.pct}<span style={{ fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.3)' }}>%</span>
              </span>
            </div>
          ))}
        </div>

        {/* Bottom 3 */}
        <div style={{ flex: '1 1 140px', maxWidth: 220 }}>
          <div style={{
            fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.25em', fontWeight: 700,
            marginBottom: 12, textTransform: 'uppercase', textAlign: 'center',
          }}>
            Growth Areas
          </div>
          {bottom3.map((p, i) => (
            <div key={p.key} style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6,
              padding: '8px 12px', borderRadius: 10,
            }}>
              <span style={{
                fontFamily: NUM_FONT, fontSize: 14, fontWeight: 800,
                color: 'rgba(255,255,255,0.2)', width: 20, textAlign: 'center',
              }}>
                {14 + i}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>{p.jp}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 1 }}>{p.label}</div>
              </div>
              <span style={{
                fontFamily: NUM_FONT, fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.4)',
              }}>
                {p.pct}<span style={{ fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.2)' }}>%</span>
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
