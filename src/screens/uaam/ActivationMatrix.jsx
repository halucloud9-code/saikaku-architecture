import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

/**
 * ActivationMatrix v3 — 16セグメントウィール
 * 花びら廃止 / 16項目を一目で把握 / アニメーション重視
 */

const NUM_FONT = "'DM Sans', 'Outfit', sans-serif";
const N = 16;

const PALETTE = {
  bg:      '#F5F0E8',
  text:    '#2A2520',
  textSub: '#7A7060',
  border:  '#D4C9B0',
  gold:    '#C4922A',
  surface: '#FDFCFA',
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

function getZone(raw) {
  if (raw >= 16) return 'active';
  if (raw >= 12) return 'potential';
  if (raw >= 10) return 'emerging';
  return 'dormant';
}

function easeOutExpo(t) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export default function ActivationMatrix({ scores, maxSub = 20 }) {
  const canvasRef = useRef(null);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [hoveredIdx, setHoveredIdx]   = useState(null);
  const [barsReady, setBarsReady]     = useState(false);
  const stateRef = useRef({
    time: 0, startTime: null,
    ripples: [],     // { idx, t }
    scanAngle: 0,
    activeI: null,
  });
  const frameRef = useRef(null);

  const points = useMemo(() => SUB_META.map((sub, i) => {
    const axisData = scores?.[AXIS_META[sub.axis].key];
    const raw  = axisData?.subs?.[sub.key] ?? axisData?.domainSubs?.[sub.key] ?? 0;
    const pct  = Math.round((raw / maxSub) * 100);
    const ratio = raw / maxSub;
    const color = AXIS_META[sub.axis].color;
    const hex   = AXIS_META[sub.axis].hex;
    return { ...sub, raw, pct, ratio, color, hex, idx: i };
  }), [scores, maxSub]);

  const totalPct = useMemo(() => {
    const s = points.reduce((a, p) => a + p.raw, 0);
    return Math.round((s / (maxSub * N)) * 100);
  }, [points, maxSub]);

  const sorted  = useMemo(() => [...points].sort((a, b) => b.pct - a.pct), [points]);
  const top3    = useMemo(() => sorted.slice(0, 3), [sorted]);
  const bottom3 = useMemo(() => sorted.slice(-3).reverse(), [sorted]);

  useEffect(() => {
    stateRef.current.activeI = selectedIdx ?? hoveredIdx;
  }, [selectedIdx, hoveredIdx]);

  // ── セグメント角度計算 ──────────────────────────────────────────
  // 16等分 + グループ間に少し広いギャップ
  const SEG_GAP   = 3 * Math.PI / 180;   // セグメント間隙間 3°
  const GROUP_GAP = 10 * Math.PI / 180;  // グループ間隙間 10°
  const totalAngle = Math.PI * 2 - GROUP_GAP * 4; // グループ間4箇所
  const segAngle   = (totalAngle - SEG_GAP * 16) / 16;

  const segAngles = useMemo(() => {
    const angles = [];
    let cur = -Math.PI / 2; // 12時スタート
    for (let i = 0; i < N; i++) {
      if (i % 4 === 0 && i > 0) cur += GROUP_GAP;
      const start = cur + SEG_GAP / 2;
      const end   = cur + SEG_GAP / 2 + segAngle;
      const mid   = (start + end) / 2;
      angles.push({ start, end, mid });
      cur += segAngle + SEG_GAP;
    }
    return angles;
  }, []);

  // ── draw ──────────────────────────────────────────────────────
  const draw = useCallback((timestamp) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const st = stateRef.current;
    if (!st.startTime) {
      st.startTime = timestamp;
      setTimeout(() => setBarsReady(true), 1400);
    }
    st.time = (timestamp - st.startTime) / 1000;

    // 全体エントリー（2s）
    const totalT = Math.min((timestamp - st.startTime) / 2000, 1);
    const ep     = easeOutExpo(totalT);

    // 各セグメントのエントリー（50ms stagger）
    const segEp = points.map((_, i) => {
      const delay = i * 0.05; // 50ms stagger
      const t = Math.max(0, Math.min((st.time - delay) / 1.2, 1));
      return easeOutBack(Math.min(t, 1));
    });

    st.scanAngle = (st.time * 0.2) % (Math.PI * 2);

    const DPR = window.devicePixelRatio || 1;
    const W   = canvas.clientWidth;
    const H   = canvas.clientHeight;
    canvas.width  = W * DPR;
    canvas.height = H * DPR;
    const ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);

    const cx = W / 2;
    const cy = H / 2;
    const R  = Math.min(W, H) * 0.38;

    const breath = Math.sin(st.time * 1.1) * 0.5 + 0.5;

    ctx.clearRect(0, 0, W, H);

    // 背景グラデーション
    const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6);
    bgGrad.addColorStop(0, `rgba(253,252,250,0)`);
    bgGrad.addColorStop(1, `rgba(196,146,42,${0.025 * ep})`);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // スキャンビーム
    if (ep > 0.6) {
      const beamA = (ep - 0.6) / 0.4 * 0.05;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R * 1.15, st.scanAngle, st.scanAngle + Math.PI / 5);
      ctx.closePath();
      const sGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.15);
      sGrad.addColorStop(0,   'rgba(196,146,42,0)');
      sGrad.addColorStop(0.7, `rgba(196,146,42,${beamA * 0.4})`);
      sGrad.addColorStop(1,   `rgba(196,146,42,${beamA})`);
      ctx.fillStyle = sGrad;
      ctx.fill();
      ctx.restore();
    }

    const INNER_R = R * 0.28;
    const activeI = st.activeI;

    // ── 各セグメント描画 ──────────────────────────────────────
    for (let i = 0; i < N; i++) {
      const p    = points[i];
      const seg  = segAngles[i];
      const zone = getZone(p.raw);
      const isActive   = activeI === i;
      const isTop3     = top3.some(t => t.idx === i);
      const c    = p.color;
      const gep  = segEp[i];

      // 伸び量
      const maxFill = INNER_R + (R - INNER_R) * p.ratio;
      const fillR   = INNER_R + (maxFill - INNER_R) * gep;

      // ── グロー（active/potential）──
      if (isActive || zone === 'active' || (isTop3 && zone === 'potential')) {
        const glowC = zone === 'active' || isActive ? [196, 146, 42] : c;
        ctx.save();
        ctx.shadowColor = `rgba(${glowC[0]},${glowC[1]},${glowC[2]},${0.5 + breath * 0.2})`;
        ctx.shadowBlur  = 18 + breath * 8;
        ctx.beginPath();
        ctx.arc(cx, cy, fillR, seg.start, seg.end);
        ctx.arc(cx, cy, INNER_R, seg.end, seg.start, true);
        ctx.closePath();
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.01)`;
        ctx.fill();
        ctx.restore();
      }

      // ── 背景トラック（薄いグレー）──
      ctx.beginPath();
      ctx.arc(cx, cy, R, seg.start, seg.end);
      ctx.arc(cx, cy, INNER_R, seg.end, seg.start, true);
      ctx.closePath();
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.06 * ep})`;
      ctx.fill();

      if (fillR <= INNER_R + 0.5) continue;

      // ── 塗りセグメント ──
      const grad = ctx.createRadialGradient(cx, cy, INNER_R, cx, cy, R);
      const aInner = zone === 'active' ? 0.55 : zone === 'potential' ? 0.42 : 0.3;
      const aOuter = zone === 'active' ? 0.9  : zone === 'potential' ? 0.7  : 0.5;
      grad.addColorStop(0,   `rgba(${c[0]},${c[1]},${c[2]},${aInner * gep})`);
      grad.addColorStop(1,   `rgba(${c[0]},${c[1]},${c[2]},${aOuter * gep})`);

      ctx.beginPath();
      ctx.arc(cx, cy, fillR, seg.start, seg.end);
      ctx.arc(cx, cy, INNER_R, seg.end, seg.start, true);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // ── 外縁ストローク ──
      const strokeAlpha = zone === 'active' ? 0.9 : zone === 'potential' ? 0.65 : 0.35;
      ctx.beginPath();
      ctx.arc(cx, cy, fillR, seg.start, seg.end);
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${strokeAlpha * gep})`;
      ctx.lineWidth = zone === 'active' ? 2 : 1.2;
      ctx.stroke();

      // ── selected ハイライトリング ──
      if (isActive) {
        ctx.beginPath();
        ctx.arc(cx, cy, fillR + 3, seg.start - 0.01, seg.end + 0.01);
        ctx.arc(cx, cy, fillR + 1, seg.end + 0.01, seg.start - 0.01, true);
        ctx.closePath();
        ctx.fillStyle = `rgba(196,146,42,0.5)`;
        ctx.fill();
      }
    }

    // ── リップル ──
    st.ripples = st.ripples.filter(r => r.t < 1);
    st.ripples.forEach(r => {
      r.t += 0.022;
      const seg = segAngles[r.idx];
      const p   = points[r.idx];
      const fillR = INNER_R + (R - INNER_R) * p.ratio;
      const midX  = cx + Math.cos(seg.mid) * fillR;
      const midY  = cy + Math.sin(seg.mid) * fillR;
      const rR    = r.t * 45;
      const alpha = (1 - r.t) * 0.6;
      const c     = p.color;
      ctx.beginPath();
      ctx.arc(midX, midY, rR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      if (r.t > 0.2) {
        const rR2 = (r.t - 0.2) * 40;
        ctx.beginPath();
        ctx.arc(midX, midY, rR2, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(196,146,42,${(1 - r.t) * 0.35})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });

    // ── グループ区切り線 ──
    if (ep > 0.4) {
      const lineAlpha = Math.min((ep - 0.4) / 0.6, 1) * 0.18;
      AXIS_META.forEach((axis, gi) => {
        // グループ最初のセグメントのstartとグループ最後のendの間の中点にティック
        const firstSeg = segAngles[gi * 4];
        const lastSeg  = segAngles[gi * 4 + 3];
        const c = axis.color;
        // グループ外周弧（薄い）
        ctx.beginPath();
        ctx.arc(cx, cy, R + 8, firstSeg.start - SEG_GAP / 2, lastSeg.end + SEG_GAP / 2);
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${lineAlpha * 2})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    // ── ラベル（外側）──
    const labelR = R + 22;
    if (ep > 0.5) {
      const lAlpha = Math.min((ep - 0.5) / 0.5, 1);
      for (let i = 0; i < N; i++) {
        const seg  = segAngles[i];
        const p    = points[i];
        const zone = getZone(p.raw);
        const isActive = activeI === i;
        const c    = p.color;
        const lx   = cx + Math.cos(seg.mid) * labelR;
        const ly   = cy + Math.sin(seg.mid) * labelR;
        const cos  = Math.cos(seg.mid);

        ctx.globalAlpha = lAlpha * segEp[i];
        ctx.textBaseline = 'middle';

        const align = cos > 0.15 ? 'left' : cos < -0.15 ? 'right' : 'center';
        const nudge = cos > 0.15 ? 6 : cos < -0.15 ? -6 : 0;
        ctx.textAlign = align;

        if (isActive) {
          ctx.font = '700 13px "DM Sans", sans-serif';
          ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
          ctx.fillText(p.raw + '', lx + nudge, ly - 7);
          ctx.font = '600 10px "Noto Serif JP", serif';
          ctx.fillStyle = '#2A2520';
          ctx.fillText(p.jp, lx + nudge, ly + 5);
          ctx.font = '500 8px "DM Sans", sans-serif';
          ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.7)`;
          ctx.fillText(p.pct + '%', lx + nudge, ly + 16);
        } else if (zone === 'active') {
          ctx.save();
          ctx.shadowColor = `rgba(${c[0]},${c[1]},${c[2]},0.5)`;
          ctx.shadowBlur = 10;
          ctx.font = `800 17px "DM Sans", sans-serif`;
          ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
          ctx.fillText(p.raw + '', lx + nudge, ly - 8);
          ctx.restore();
          ctx.font = `700 10px "Noto Serif JP", serif`;
          ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
          ctx.fillText(p.jp, lx + nudge, ly + 5);
        } else if (zone === 'potential') {
          ctx.font = `600 14px "DM Sans", sans-serif`;
          ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.85)`;
          ctx.fillText(p.raw + '', lx + nudge, ly - 7);
          ctx.font = `400 9px "Noto Serif JP", serif`;
          ctx.fillStyle = 'rgba(42,37,32,0.6)';
          ctx.fillText(p.jp, lx + nudge, ly + 5);
        } else {
          ctx.font = `400 11px "DM Sans", sans-serif`;
          ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${zone === 'emerging' ? 0.55 : 0.3})`;
          ctx.fillText(p.raw + '', lx + nudge, ly - 6);
          ctx.font = `400 8px "Noto Serif JP", serif`;
          ctx.fillStyle = 'rgba(42,37,32,0.3)';
          ctx.fillText(p.jp, lx + nudge, ly + 5);
        }
        ctx.globalAlpha = 1;
      }
    }

    // ── センター ──
    const centerR = INNER_R * 0.82;

    // 回転ゴールドリング
    const ringRot = st.time * 0.06;
    for (let s = 0; s < 24; s++) {
      const a1 = (Math.PI * 2 * s) / 24 + ringRot;
      const a2 = (Math.PI * 2 * (s + 1)) / 24 + ringRot;
      const t  = (s % 12) / 12;
      ctx.beginPath();
      ctx.arc(cx, cy, centerR + 4, a1, a2);
      ctx.arc(cx, cy, centerR + 1, a2, a1, true);
      ctx.closePath();
      ctx.fillStyle = `rgba(196,146,42,${(0.1 + t * 0.28 + breath * 0.08) * ep})`;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, centerR + 6, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(196,146,42,${0.12 * ep})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // 白丸
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
    ctx.font = `800 ${Math.round(centerR * 0.68)}px "DM Sans", sans-serif`;
    ctx.fillStyle = '#2A2520';
    ctx.fillText(displayPct + '', cx, cy - 2);
    ctx.font = '500 7px "DM Sans", sans-serif';
    ctx.fillStyle = 'rgba(122,112,96,0.7)';
    ctx.fillText('TOTAL %', cx, cy + centerR * 0.45);

    frameRef.current = requestAnimationFrame(draw);
  }, [points, totalPct, top3, segAngles, maxSub]);

  useEffect(() => {
    stateRef.current.startTime = null;
    setBarsReady(false);
    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw]);

  // クリック / ホバー
  const handleInteraction = useCallback((e, isClick) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;
    const cx   = rect.width  / 2;
    const cy   = rect.height / 2;

    // クリック位置の角度と距離
    const dx   = mx - cx;
    const dy   = my - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    let angle  = Math.atan2(dy, dx);

    const R       = Math.min(rect.width, rect.height) * 0.38;
    const INNER_R = R * 0.28;

    if (dist < INNER_R * 0.7 || dist > R * 1.1) {
      if (isClick) setSelectedIdx(null);
      else setHoveredIdx(null);
      return;
    }

    // 負の角度を正に正規化
    if (angle < -Math.PI / 2) angle += Math.PI * 2;

    let closest = -1;
    let minDiff = Infinity;
    for (let i = 0; i < N; i++) {
      const seg = segAngles[i];
      let mid = seg.mid;
      if (mid < -Math.PI / 2) mid += Math.PI * 2;
      const diff = Math.abs(angle - mid);
      if (diff < minDiff) { minDiff = diff; closest = i; }
    }

    if (isClick) {
      setSelectedIdx(closest === selectedIdx ? null : closest >= 0 ? closest : null);
      if (closest >= 0) stateRef.current.ripples.push({ idx: closest, t: 0 });
    } else {
      setHoveredIdx(closest >= 0 ? closest : null);
    }
  }, [selectedIdx, segAngles]);

  const activeIdx   = selectedIdx ?? hoveredIdx;
  const activePoint = activeIdx != null ? points[activeIdx] : null;

  return (
    <div style={{ borderRadius: 20, overflow: 'hidden', border: `1px solid ${PALETTE.border}` }}>

      {/* タイトル */}
      <div style={{ padding: '20px 20px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 9, color: '#C4922A', letterSpacing: '0.35em', fontWeight: 600, textTransform: 'uppercase', opacity: 0.75 }}>
          Sixteen-Axis Activation Matrix
        </div>
        <div style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 17, fontWeight: 700, color: '#2A2520', letterSpacing: '0.1em', marginTop: 3 }}>
          16軸 才覚レーダー
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: 'min(92vw, 520px)', display: 'block', cursor: 'pointer' }}
        onClick={e => handleInteraction(e, true)}
        onMouseMove={e => handleInteraction(e, false)}
        onMouseLeave={() => setHoveredIdx(null)}
      />

      {/* 詳細カード（クリック時）*/}
      {activePoint && selectedIdx != null && (
        <div style={{
          background: PALETTE.surface, borderTop: `1px solid ${PALETTE.border}`,
          padding: '14px 20px 18px', animation: 'amFadeIn 0.25s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <span style={{ fontSize: 16, fontWeight: 700, color: activePoint.hex }}>{activePoint.jp}</span>
              <span style={{ fontSize: 11, color: PALETTE.textSub, marginLeft: 8 }}>{activePoint.label}</span>
            </div>
            <div style={{ fontFamily: NUM_FONT, fontSize: 26, fontWeight: 800, color: PALETTE.text }}>
              {activePoint.pct}<span style={{ fontSize: 13, fontWeight: 400, color: PALETTE.textSub }}>%</span>
            </div>
          </div>
          <div style={{ height: 4, background: PALETTE.border, borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: '100%', width: `${activePoint.pct}%`,
              background: `linear-gradient(90deg, ${activePoint.hex}, ${activePoint.hex}88)`,
              borderRadius: 2, transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ fontSize: 11, color: PALETTE.textSub }}>
            {activePoint.raw}/{maxSub} pts — {AXIS_META[activePoint.axis].kanji} {AXIS_META[activePoint.axis].en}
            &ensp;|&ensp;{getZone(activePoint.raw).toUpperCase()}
          </div>
        </div>
      )}

      {/* 16項目グリッド（4グループ × 4項目）*/}
      <div style={{
        background: PALETTE.surface, borderTop: `1px solid ${PALETTE.border}`,
        padding: '20px 16px 24px',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {AXIS_META.map((axis, gi) => (
            <div key={axis.key} style={{
              background: `rgba(${axis.color[0]},${axis.color[1]},${axis.color[2]},0.04)`,
              border: `1px solid rgba(${axis.color[0]},${axis.color[1]},${axis.color[2]},0.18)`,
              borderRadius: 12, padding: '10px 12px',
              animation: `amSlideUp 0.4s ease ${gi * 0.08}s both`,
            }}>
              {/* グループヘッダー */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
                paddingBottom: 6, borderBottom: `1px solid rgba(${axis.color[0]},${axis.color[1]},${axis.color[2]},0.2)`,
              }}>
                <span style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 15, fontWeight: 800, color: axis.hex }}>
                  {axis.kanji}
                </span>
                <span style={{ fontSize: 9, color: axis.hex, fontWeight: 600, letterSpacing: '0.12em', opacity: 0.8 }}>
                  {axis.en}
                </span>
              </div>
              {/* 4項目 */}
              {points.slice(gi * 4, gi * 4 + 4).map((p, j) => {
                const zone = getZone(p.raw);
                const isTop = top3.some(t => t.idx === p.idx);
                return (
                  <div key={p.key}
                    onClick={() => setSelectedIdx(p.idx === selectedIdx ? null : p.idx)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '4px 0',
                      cursor: 'pointer',
                      opacity: 1,
                    }}
                  >
                    {/* バー */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                        <span style={{
                          fontFamily: "'Noto Serif JP', serif",
                          fontSize: 11, fontWeight: zone === 'active' || isTop ? 700 : 400,
                          color: zone === 'active' ? axis.hex : zone === 'potential' ? PALETTE.text : PALETTE.textSub,
                        }}>
                          {p.jp}
                        </span>
                        <span style={{
                          fontFamily: NUM_FONT, fontSize: 12, fontWeight: 700,
                          color: zone === 'active' ? axis.hex : PALETTE.textSub,
                        }}>
                          {p.raw}
                          {isTop && <span style={{ fontSize: 8, color: '#C4922A', marginLeft: 2 }}>★</span>}
                        </span>
                      </div>
                      <div style={{ height: 3, background: `rgba(${axis.color[0]},${axis.color[1]},${axis.color[2]},0.12)`, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: barsReady ? `${p.pct}%` : '0%',
                          background: zone === 'active'
                            ? `linear-gradient(90deg, ${axis.hex}, #FFD700)`
                            : `linear-gradient(90deg, ${axis.hex}AA, ${axis.hex}44)`,
                          borderRadius: 2,
                          transition: `width 0.9s cubic-bezier(0.4,0,0.2,1) ${(gi * 4 + j) * 0.06}s`,
                        }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Strengths / Growth */}
      <div style={{
        background: PALETTE.surface, borderTop: `1px solid ${PALETTE.border}`,
        padding: '16px 20px 24px',
        display: 'flex', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ flex: '1 1 140px' }}>
          <div style={{ fontSize: 9, color: '#C4922A', letterSpacing: '0.25em', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', textAlign: 'center', opacity: 0.85 }}>
            Strengths
          </div>
          {top3.map((p, i) => (
            <div key={p.key} style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5,
              padding: '7px 10px', borderRadius: 9,
              background: i === 0 ? 'rgba(196,146,42,0.07)' : 'transparent',
              border: i === 0 ? '1px solid rgba(196,146,42,0.25)' : `1px solid ${PALETTE.border}`,
              animation: `amSlideIn 0.4s ease ${i * 0.1 + 0.2}s both`,
            }}>
              <span style={{ fontFamily: NUM_FONT, fontSize: 13, fontWeight: 800, color: i === 0 ? '#C4922A' : PALETTE.textSub, width: 18, textAlign: 'center' }}>
                {i + 1}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: i === 0 ? 700 : 500, color: PALETTE.text, fontFamily: "'Noto Serif JP', serif" }}>{p.jp}</div>
                <div style={{ height: 2, background: PALETTE.border, borderRadius: 1, overflow: 'hidden', marginTop: 3 }}>
                  <div style={{
                    height: '100%', width: barsReady ? `${p.pct}%` : '0%',
                    background: `linear-gradient(90deg, ${p.hex}, ${p.hex}66)`,
                    borderRadius: 1, transition: `width 0.8s ease ${i * 0.15}s`,
                  }} />
                </div>
              </div>
              <span style={{ fontFamily: NUM_FONT, fontSize: 14, fontWeight: 700, color: p.hex }}>
                {p.pct}<span style={{ fontSize: 9, fontWeight: 400, color: PALETTE.textSub }}>%</span>
              </span>
            </div>
          ))}
        </div>

        <div style={{ flex: '1 1 140px' }}>
          <div style={{ fontSize: 9, color: PALETTE.textSub, letterSpacing: '0.25em', fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', textAlign: 'center' }}>
            Growth Areas
          </div>
          {bottom3.map((p, i) => (
            <div key={p.key} style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5,
              padding: '7px 10px', borderRadius: 9,
              border: `1px solid ${PALETTE.border}`,
              animation: `amSlideIn 0.4s ease ${i * 0.1 + 0.4}s both`,
            }}>
              <span style={{ fontFamily: NUM_FONT, fontSize: 13, fontWeight: 800, color: PALETTE.border, width: 18, textAlign: 'center' }}>{14 + i}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 400, color: PALETTE.textSub, fontFamily: "'Noto Serif JP', serif" }}>{p.jp}</div>
                <div style={{ fontSize: 8, color: PALETTE.border, marginTop: 1 }}>{p.label}</div>
              </div>
              <span style={{ fontFamily: NUM_FONT, fontSize: 14, fontWeight: 600, color: PALETTE.textSub }}>
                {p.pct}<span style={{ fontSize: 9, fontWeight: 400, color: PALETTE.border }}>%</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes amFadeIn  { from { opacity:0; transform:translateY(6px) }  to { opacity:1; transform:translateY(0) } }
        @keyframes amSlideIn { from { opacity:0; transform:translateX(-8px) } to { opacity:1; transform:translateX(0) } }
        @keyframes amSlideUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
      `}</style>
    </div>
  );
}
