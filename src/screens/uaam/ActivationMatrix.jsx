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
  { key: 'mindset',    kanji: '志', en: 'MindSet',    color: [74, 111, 165],  hex: '#4A6FA5' },
  { key: 'literacy',   kanji: '知', en: 'Literacy',   color: [46, 139, 87],   hex: '#2E8B57' },
  { key: 'competency', kanji: '技', en: 'Competency', color: [196, 146, 42],  hex: '#C4922A' },
  { key: 'impact',     kanji: '衝', en: 'Impact',     color: [168, 68, 50],   hex: '#A84432' },
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
  const top5 = sorted.slice(0, 5);
  const bottom3 = sorted.slice(-3).reverse();

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

    // === 十字ライン（+ と ×）===
    ctx.save();
    ctx.globalAlpha = 0.07 * ep;
    ctx.strokeStyle = `rgba(42,37,32,0.6)`;
    ctx.lineWidth = 0.8;
    // + 縦横
    ctx.beginPath(); ctx.moveTo(cx, cy - R * 1.3); ctx.lineTo(cx, cy + R * 1.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - R * 1.3, cy); ctx.lineTo(cx + R * 1.3, cy); ctx.stroke();
    // × 斜め
    ctx.beginPath(); ctx.moveTo(cx - R * 0.9, cy - R * 0.9); ctx.lineTo(cx + R * 0.9, cy + R * 0.9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + R * 0.9, cy - R * 0.9); ctx.lineTo(cx - R * 0.9, cy + R * 0.9); ctx.stroke();
    ctx.restore();

    // === グリッドリング（繊細・上品）===
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
      const alpha = p === 1 ? 0.12 : 0.06 + ri * 0.015;
      ctx.strokeStyle = `rgba(42,37,32,${alpha * ep})`;
      ctx.lineWidth = p === 1 ? 1 : 0.5;
      ctx.stroke();
    });

    // === スポーク ===
    for (let i = 0; i < N; i++) {
      const angle = getAngle(i);
      const outerX = cx + Math.cos(angle) * R * ep;
      const outerY = cy + Math.sin(angle) * R * ep;
      const grad = ctx.createLinearGradient(cx, cy, outerX, outerY);
      const c = AXIS_META[SUB_META[i].axis].color;
      grad.addColorStop(0, 'rgba(42,37,32,0)');
      grad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},${(i % 4 === 0 ? 0.2 : 0.05) * ep})`);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(outerX, outerY);
      ctx.strokeStyle = grad;
      ctx.lineWidth = i % 4 === 0 ? 1 : 0.5;
      ctx.stroke();
    }

    // === セクター淡色 ===
    AXIS_META.forEach((axis, ai) => {
      const a1 = getAngle(ai * 4);
      const a2 = getAngle((ai + 1) * 4);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R * ep, a1, a2);
      ctx.closePath();
      const c = axis.color;
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.025 * ep})`;
      ctx.fill();
    });

    // === データポリゴン ===
    const getDataPoint = (i) => {
      const angle = getAngle(i);
      const dr = points[i].ratio * R * ep;
      return { x: cx + Math.cos(angle) * dr, y: cy + Math.sin(angle) * dr };
    };

    // ゴールドグロー外周
    ctx.save();
    ctx.shadowColor = `rgba(196,146,42,${0.25 + breath * 0.12})`;
    ctx.shadowBlur = 16 + breath * 8;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const p = getDataPoint(i);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.strokeStyle = `rgba(196,146,42,${0.45 * ep})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 軸ごとのグラデーション塗り
    AXIS_META.forEach((axis, ai) => {
      const startI = ai * 4;
      const c = axis.color;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let j = 0; j <= 4; j++) {
        const idx = (startI + j) % N;
        const dp = getDataPoint(idx);
        ctx.lineTo(dp.x, dp.y);
      }
      ctx.closePath();

      const fillGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      fillGrad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${0.04 * ep})`);
      fillGrad.addColorStop(0.6, `rgba(${c[0]},${c[1]},${c[2]},${(0.14 + breath * 0.06) * ep})`);
      fillGrad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},${(0.28 + breath * 0.08) * ep})`);
      ctx.fillStyle = fillGrad;
      ctx.fill();
    });

    // 輪郭ストローク（軸色グラデーション）
    for (let i = 0; i < N; i++) {
      const p1 = getDataPoint(i);
      const p2 = getDataPoint((i + 1) % N);
      const c1 = AXIS_META[SUB_META[i].axis].color;
      const c2 = AXIS_META[SUB_META[(i + 1) % N].axis].color;
      const mc = lerpColor(c1, c2, 0.5);

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = `rgba(${mc[0]},${mc[1]},${mc[2]},${0.65 * ep})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

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

    // === データドット ===
    const activeI = selectedIdx ?? hoveredIdx;
    for (let i = 0; i < N; i++) {
      const dp = getDataPoint(i);
      const c = points[i].color;
      const isActive = activeI === i;
      const topRank = top3.findIndex(t => t.idx === i);
      const isTop3 = topRank >= 0;
      const top5Rank = top5.findIndex(t => t.idx === i);
      const isTop5 = top5Rank >= 0;
      const dotR = isActive ? 8 : topRank === 0 ? 7 : topRank === 1 ? 6 : isTop3 ? 5.5 : isTop5 ? 4.5 : 3;
      const pulseR = isTop3 ? (1 + Math.sin(st.time * 3 + i) * (topRank === 0 ? 0.2 : 0.12)) : 1;

      // TOP3: ゴールドグロー
      if (isActive || isTop3) {
        const glowSize = topRank === 0 ? 18 : topRank === 1 ? 14 : isTop3 ? 12 : 10;
        const glowR = (dotR + glowSize) * pulseR;
        const glowAlpha = isActive ? 0.45 : topRank === 0 ? 0.35 : topRank === 1 ? 0.25 : 0.18;
        // TOP3はゴールドグロー
        const glowColor = isTop3 ? [196, 146, 42] : c;
        const grad = ctx.createRadialGradient(dp.x, dp.y, 0, dp.x, dp.y, glowR);
        grad.addColorStop(0, `rgba(${glowColor[0]},${glowColor[1]},${glowColor[2]},${glowAlpha})`);
        grad.addColorStop(0.5, `rgba(${glowColor[0]},${glowColor[1]},${glowColor[2]},${glowAlpha * 0.3})`);
        grad.addColorStop(1, `rgba(${glowColor[0]},${glowColor[1]},${glowColor[2]},0)`);
        ctx.beginPath();
        ctx.arc(dp.x, dp.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // ドット本体: 白 + 軸色の縁
      ctx.beginPath();
      ctx.arc(dp.x, dp.y, dotR * pulseR, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? `rgb(${c[0]},${c[1]},${c[2]})` : '#FFFFFF';
      ctx.fill();
      // TOP3はゴールドボーダー
      ctx.strokeStyle = isTop3 ? `rgba(196,146,42,0.85)` : `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.lineWidth = isActive ? 2.5 : isTop3 ? 2 : isTop5 ? 1.5 : 1;
      ctx.stroke();

      // 中心ハイライト
      ctx.beginPath();
      ctx.arc(dp.x, dp.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = isTop3 ? `rgba(255,215,0,0.8)` : '#FDFCFA';
      ctx.fill();
    }

    // === ラベル ===
    const labelR = R + 26;
    for (let i = 0; i < N; i++) {
      const angle = getAngle(i);
      const lx = cx + Math.cos(angle) * labelR * ep;
      const ly = cy + Math.sin(angle) * labelR * ep;
      const c = points[i].color;
      const isActive = activeI === i;
      const topRank = top3.findIndex(t => t.idx === i);
      const isTop = topRank >= 0;
      const cos = Math.cos(angle);
      const align = cos > 0.15 ? 'left' : cos < -0.15 ? 'right' : 'center';
      const nudge = cos > 0.15 ? 8 : cos < -0.15 ? -8 : 0;

      ctx.textAlign = align;
      ctx.textBaseline = 'middle';

      if (isTop) {
        const fontSize = topRank === 0 ? 22 : topRank === 1 ? 18 : 16;

        // 数字（メインテキスト色 + グロー）
        ctx.save();
        ctx.shadowColor = `rgba(${c[0]},${c[1]},${c[2]},0.4)`;
        ctx.shadowBlur = topRank === 0 ? 10 : 5;
        ctx.font = `800 ${fontSize}px "DM Sans", sans-serif`;
        ctx.fillStyle = topRank === 0 ? '#2A2520' : `rgba(42,37,32,${topRank === 1 ? 0.9 : 0.8})`;
        ctx.fillText(points[i].raw + '', lx + nudge, ly - 10);
        ctx.restore();

        // ランクバッジ
        ctx.font = `700 9px "DM Sans", sans-serif`;
        ctx.fillStyle = '#C4922A';
        const rankLabel = '#' + (topRank + 1);
        const badgeOffsetX = align === 'left'
          ? ctx.measureText(points[i].raw + '').width + 6
          : align === 'right'
          ? -(ctx.measureText(points[i].raw + '').width + 6)
          : ctx.measureText(points[i].raw + '').width / 2 + 6;
        ctx.fillText(rankLabel, lx + nudge + badgeOffsetX, ly - 14);

        // 日本語ラベル
        ctx.font = `700 ${topRank === 0 ? 12 : 11}px "Noto Serif JP", serif`;
        ctx.fillStyle = topRank === 0 ? '#2A2520' : 'rgba(42,37,32,0.75)';
        ctx.fillText(points[i].jp, lx + nudge, ly + 6);

        // パーセンテージ
        ctx.font = `600 10px "DM Sans", sans-serif`;
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.85)`;
        ctx.fillText(points[i].pct + '%', lx + nudge, ly + 20);

      } else if (isActive) {
        ctx.font = '700 15px "DM Sans", sans-serif';
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.fillText(points[i].raw + '', lx + nudge, ly - 8);

        ctx.font = '700 11px "Noto Serif JP", serif';
        ctx.fillStyle = '#2A2520';
        ctx.fillText(points[i].jp, lx + nudge, ly + 6);

        ctx.font = '600 9px "DM Sans", sans-serif';
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.7)`;
        ctx.fillText(points[i].pct + '%', lx + nudge, ly + 19);

      } else {
        ctx.font = '500 12px "DM Sans", sans-serif';
        ctx.fillStyle = 'rgba(42,37,32,0.65)';
        ctx.fillText(points[i].raw + '', lx + nudge, ly - 7);

        ctx.font = '400 10px "Noto Serif JP", serif';
        ctx.fillStyle = 'rgba(42,37,32,0.45)';
        ctx.fillText(points[i].jp, lx + nudge, ly + 6);
      }
    }

    // === 軸漢字ラベル ===
    AXIS_META.forEach((axis, ai) => {
      const midAngle = getAngle(ai * 4 + 1.5);
      const kr = R + 55;
      const kx = cx + Math.cos(midAngle) * kr * ep;
      const ky = cy + Math.sin(midAngle) * kr * ep;
      const c = axis.color;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 漢字（軸色、Noto Serif JP）
      ctx.font = '800 24px "Noto Serif JP", serif';
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.75 + breath * 0.12})`;
      ctx.fillText(axis.kanji, kx, ky - 5);

      // English
      ctx.font = '600 8px "DM Sans", sans-serif';
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.45)`;
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
  }, [points, totalPct, selectedIdx, hoveredIdx, top3, top5, maxSub]);

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
            Activation Matrix
          </div>
          <div style={{
            fontFamily: "'Noto Serif JP', serif", fontSize: 18, fontWeight: 700,
            color: '#2A2520', letterSpacing: '0.1em', marginTop: 4,
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
