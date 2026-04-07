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
  { key: 'meaning',       axis: 0, label: 'Meaning',       jp: '基軸力', desc: 'なぜ生き、どこへ向かうのかを定める、存在の軸。' },
  { key: 'mindfulness',   axis: 0, label: 'Mindfulness',   jp: '認知力', desc: '自己と環境を客観的に捉え、今この瞬間を正確に読む力。' },
  { key: 'mindshift',     axis: 0, label: 'Mindshift',     jp: '転換力', desc: '固定観念を手放し、新しい視点へと発想を切り替える力。' },
  { key: 'mastery',       axis: 0, label: 'Mastery',       jp: '熟達力', desc: '一つの道を深く磨き続け、本物の技として昇華させる力。' },
  { key: 'learning',      axis: 1, label: 'Learning',      jp: '謙学力', desc: '素直に問いを立て、知を吸収し続ける謙虚な学びの力。' },
  { key: 'logical',       axis: 1, label: 'Logical',       jp: '論理力', desc: '筋道を立てて考え、根拠と結論を正確につなぐ思考の力。' },
  { key: 'life',          axis: 1, label: 'Life',          jp: '活用力', desc: '得た知識・経験を実生活と実践の場に活かし切る力。' },
  { key: 'leadership',    axis: 1, label: 'Leadership',    jp: '統率力', desc: '人を信じ、方向を示し、チームを一つの意志へと束ねる力。' },
  { key: 'critical',      axis: 2, label: 'Critical',      jp: '本質力', desc: '表面に惑わされず、物事の核心と真実を見抜く洞察の力。' },
  { key: 'creativity',    axis: 2, label: 'Creativity',    jp: '創造力', desc: '既存の枠を超え、新しい価値とアイデアを生み出す力。' },
  { key: 'communication', axis: 2, label: 'Communication', jp: '伝達力', desc: '想いと情報を相手の心に届く言葉と表現に変換する力。' },
  { key: 'collaboration', axis: 2, label: 'Collaboration', jp: '協働力', desc: '違いを強さとして活かし、他者と共に大きな成果を生む力。' },
  { key: 'idea',           axis: 3, label: 'Idea',           jp: '構想力', desc: '未来を描き、大局を掴み、実現へのシナリオを設計する力。' },
  { key: 'innovation',     axis: 3, label: 'Innovation',     jp: '変革力', desc: '現状の壁を打ち破り、新しい流れを自ら創り出す力。' },
  { key: 'implementation', axis: 3, label: 'Implementation', jp: '実装力', desc: '構想を具体的な行動と形に変え、現実へと落とし込む力。' },
  { key: 'influence',      axis: 3, label: 'Influence',      jp: '影響力', desc: '周囲の心を動かし、人と社会に変化と行動を促す力。' },
];

// 四隅バッジ（グラフ外配置用 — position:absoluteなし）
function CornerBadge({ g, align, delay }) {
  const c = g.color;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: align === 'right' ? 'flex-end' : 'flex-start',
      animation: `amFadeIn 0.5s ease ${delay}s both`,
      pointerEvents: 'none',
      padding: '0 6px',
    }}>
      {/* 漢字 */}
      <div style={{
        fontFamily: "'Noto Serif JP', serif",
        fontSize: 'clamp(22px, 5vw, 32px)',
        fontWeight: 800,
        color: `rgba(${c[0]},${c[1]},${c[2]},0.82)`,
        lineHeight: 1,
        letterSpacing: '0.04em',
      }}>
        {g.kanji}
      </div>
      {/* EN */}
      <div style={{
        fontSize: 'clamp(7px, 1.4vw, 9px)',
        fontWeight: 600,
        color: `rgba(${c[0]},${c[1]},${c[2]},0.55)`,
        letterSpacing: '0.18em',
        marginTop: 2,
      }}>
        {g.en}
      </div>
      {/* スコア */}
      <div style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 'clamp(13px, 3vw, 18px)',
        fontWeight: 700,
        color: `rgba(${c[0]},${c[1]},${c[2]},0.9)`,
        marginTop: 3,
        lineHeight: 1,
      }}>
        {g.total}
        <span style={{ fontSize: '0.55em', fontWeight: 400, color: `rgba(${c[0]},${c[1]},${c[2]},0.5)`, marginLeft: 2 }}>
          /{g.max}
        </span>
      </div>
      {/* ミニバー */}
      <div style={{
        width: 'clamp(28px, 6vw, 40px)',
        height: 2,
        background: `rgba(${c[0]},${c[1]},${c[2]},0.15)`,
        borderRadius: 1,
        marginTop: 4,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${g.pct}%`,
          background: `rgba(${c[0]},${c[1]},${c[2]},0.6)`,
          borderRadius: 1,
        }} />
      </div>
    </div>
  );
}

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
  const [gridOpen, setGridOpen]       = useState(false);
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

  // グループ別合計スコア（四隅バッジ用）
  const groupTotals = useMemo(() => AXIS_META.map((axis, gi) => {
    const grp   = points.slice(gi * 4, gi * 4 + 4);
    const total = grp.reduce((s, p) => s + p.raw, 0);
    const pct   = Math.round(total / (maxSub * 4) * 100);
    return { ...axis, total, pct, max: maxSub * 4 };
  }), [points, maxSub]);

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

    // ── 背景装飾：同心参照リング ──────────────────────────────
    if (ep > 0.15) {
      const ra = Math.min((ep - 0.15) / 0.85, 1);
      ctx.save();
      // 内側ガイドリング（点線）
      ctx.setLineDash([2, 6]);
      [0.5, 0.75].forEach(mult => {
        ctx.beginPath();
        ctx.arc(cx, cy, R * mult, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(196,146,42,${ra * 0.055})`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      });
      ctx.setLineDash([]);
      // 外縁フレームリング
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.1, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(196,146,42,${ra * 0.07})`;
      ctx.lineWidth = 0.7;
      ctx.stroke();
      // 4方向コンパスティック（12/3/6/9時）
      [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach(a => {
        const tx1 = cx + Math.cos(a) * R * 1.06;
        const ty1 = cy + Math.sin(a) * R * 1.06;
        const tx2 = cx + Math.cos(a) * R * 1.16;
        const ty2 = cy + Math.sin(a) * R * 1.16;
        ctx.beginPath();
        ctx.moveTo(tx1, ty1);
        ctx.lineTo(tx2, ty2);
        ctx.strokeStyle = `rgba(196,146,42,${ra * 0.22})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      });
      ctx.restore();
    }

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
      // トラック背景グラデーション（未塗り部分を可視化）
      const trackGrad = ctx.createRadialGradient(cx, cy, INNER_R, cx, cy, R);
      trackGrad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${0.05 * ep})`);
      trackGrad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},${0.12 * ep})`);
      ctx.fillStyle = trackGrad;
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

    // ── グループ外周弧 + 内側ラベルバッジ ──
    if (ep > 0.35) {
      const lineAlpha  = Math.min((ep - 0.35) / 0.65, 1);
      const labelAlpha = Math.min(Math.max((ep - 0.6) / 0.4, 0), 1);
      const BADGE_R    = INNER_R + (R - INNER_R) * 0.44; // ドーナツ内側44%

      AXIS_META.forEach((axis, gi) => {
        const firstSeg  = segAngles[gi * 4];
        const lastSeg   = segAngles[gi * 4 + 3];
        const midAngle  = (firstSeg.start + lastSeg.end) / 2;
        const c         = axis.color;

        // 外周グループ弧（境界線）
        ctx.beginPath();
        ctx.arc(cx, cy, R + 9, firstSeg.start - 0.01, lastSeg.end + 0.01);
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${lineAlpha * 0.35})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 内側セクター背景（グループカラーの薄いファン）
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, INNER_R * 0.95, firstSeg.start, lastSeg.end);
        ctx.closePath();
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.04 * lineAlpha})`;
        ctx.fill();

        if (labelAlpha < 0.05) return;

        // バッジ位置
        const bx = cx + Math.cos(midAngle) * BADGE_R;
        const by = cy + Math.sin(midAngle) * BADGE_R;

        ctx.save();
        ctx.globalAlpha = labelAlpha;

        // バッジ背景円
        ctx.beginPath();
        ctx.arc(bx, by, 17, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.1)`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bx, by, 17, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},0.28)`;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // 漢字
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.font         = `700 17px "Noto Serif JP", serif`;
        ctx.fillStyle    = `rgba(${c[0]},${c[1]},${c[2]},0.82)`;
        ctx.fillText(axis.kanji, bx, by - 3);

        // EN サブラベル
        ctx.font      = `600 7px "DM Sans", sans-serif`;
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.5)`;
        ctx.fillText(axis.en, bx, by + 10);

        ctx.restore();

        // ── グループ間ギャップ装飾（区切り線 + ダイヤ）──
        const nextGi   = (gi + 1) % 4;
        const nextSeg  = segAngles[nextGi * 4];
        let gapStart   = lastSeg.end + SEG_GAP / 2;
        let gapEnd     = nextSeg.start - SEG_GAP / 2;
        if (gi === 3) gapEnd += Math.PI * 2; // 折り返し
        const gapMid   = (gapStart + gapEnd) / 2;
        const nc = AXIS_META[nextGi].color;

        // ギャップ中央の細い放射線（2色グラデ）
        const gLineOuter = cx + Math.cos(gapMid) * (R + 4);
        const gLineInner = cx + Math.cos(gapMid) * INNER_R;
        const gLineOy = cy + Math.sin(gapMid) * (R + 4);
        const gLineIy = cy + Math.sin(gapMid) * INNER_R;
        const gGrad = ctx.createLinearGradient(gLineInner, gLineIy, gLineOuter, gLineOy);
        gGrad.addColorStop(0,   `rgba(${c[0]},${c[1]},${c[2]},${lineAlpha * 0.4})`);
        gGrad.addColorStop(0.5, `rgba(196,146,42,${lineAlpha * 0.6})`);
        gGrad.addColorStop(1,   `rgba(${nc[0]},${nc[1]},${nc[2]},${lineAlpha * 0.4})`);
        ctx.beginPath();
        ctx.moveTo(gLineInner, gLineIy);
        ctx.lineTo(gLineOuter, gLineOy);
        ctx.strokeStyle = gGrad;
        ctx.lineWidth = 1;
        ctx.stroke();

        // ギャップ中央のダイヤモンドマーク
        const dR    = INNER_R + (R - INNER_R) * 0.5;
        const dx2   = cx + Math.cos(gapMid) * dR;
        const dy2   = cy + Math.sin(gapMid) * dR;
        const ds    = 5 * lineAlpha;
        ctx.save();
        ctx.translate(dx2, dy2);
        ctx.rotate(gapMid + Math.PI / 4);
        ctx.beginPath();
        ctx.rect(-ds / 2, -ds / 2, ds, ds);
        ctx.fillStyle = `rgba(196,146,42,${lineAlpha * 0.55})`;
        ctx.fill();
        ctx.restore();
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

    // ── グループ合計ミニアーク（白丸内縁）──────────────────────
    if (ep > 0.5) {
      const miniAlpha = Math.min((ep - 0.5) / 0.5, 1);
      const miniMid   = centerR * 0.93;
      const miniW     = centerR * 0.1;
      ctx.save();
      ctx.lineCap = 'round';
      AXIS_META.forEach((axis, gi) => {
        const grpPts   = points.slice(gi * 4, gi * 4 + 4);
        const grpRatio = grpPts.reduce((s, p) => s + p.raw, 0) / (maxSub * 4);
        const firstSeg = segAngles[gi * 4];
        const lastSeg  = segAngles[gi * 4 + 3];
        const gSpan    = lastSeg.end - firstSeg.start;
        const c        = axis.color;
        // トラック
        ctx.beginPath();
        ctx.arc(cx, cy, miniMid, firstSeg.start, lastSeg.end);
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.12 * miniAlpha})`;
        ctx.lineWidth = miniW;
        ctx.stroke();
        // 塗り
        const fillEnd = firstSeg.start + gSpan * grpRatio * miniAlpha;
        if (fillEnd > firstSeg.start + 0.01) {
          ctx.beginPath();
          ctx.arc(cx, cy, miniMid, firstSeg.start, fillEnd);
          ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.55 * miniAlpha})`;
          ctx.lineWidth = miniW;
          ctx.stroke();
        }
      });
      ctx.lineCap = 'butt';
      ctx.restore();
    }

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

      {/* Canvas + 四隅バッジ — グリッドでグラフの外側に配置 */}
      {/* 配置: 衝=左上 / 志=右上 / 技=左下 / 知=右下 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gridTemplateRows: 'auto auto auto',
        alignItems: 'center',
        justifyItems: 'stretch',
      }}>
        {/* Row 1 */}
        <CornerBadge g={groupTotals[3]} align="left"  delay={0.24} />{/* 衝 — 左上 */}
        <div />
        <CornerBadge g={groupTotals[0]} align="right" delay={0}    />{/* 志 — 右上 */}

        {/* Row 2 — Canvas */}
        <div />
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: 'min(72vw, 480px)', display: 'block', cursor: 'pointer' }}
          onClick={e => handleInteraction(e, true)}
          onMouseMove={e => handleInteraction(e, false)}
          onMouseLeave={() => setHoveredIdx(null)}
        />
        <div />

        {/* Row 3 */}
        <CornerBadge g={groupTotals[2]} align="left"  delay={0.16} />{/* 技 — 左下 */}
        <div />
        <CornerBadge g={groupTotals[1]} align="right" delay={0.08} />{/* 知 — 右下 */}
      </div>

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
          {activePoint.desc && (
            <div style={{
              fontSize: 12, color: PALETTE.text, lineHeight: 1.65,
              marginBottom: 8, opacity: 0.78,
              fontFamily: "'Noto Serif JP', serif",
            }}>
              {activePoint.desc}
            </div>
          )}
          <div style={{ fontSize: 11, color: PALETTE.textSub }}>
            {activePoint.raw}/{maxSub} pts — {AXIS_META[activePoint.axis].kanji} {AXIS_META[activePoint.axis].en}
            &ensp;|&ensp;{getZone(activePoint.raw).toUpperCase()}
          </div>
        </div>
      )}

      {/* 16項目グリッド（プルダウン式）*/}
      <div style={{ background: PALETTE.surface, borderTop: `1px solid ${PALETTE.border}` }}>
        {/* トグルヘッダー */}
        <button
          onClick={() => setGridOpen(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px', background: 'none', border: 'none',
            cursor: 'pointer', outline: 'none',
          }}
        >
          <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            {groupTotals.map(g => {
              const c = g.color;
              return (
                <div key={g.key} style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{
                    fontFamily: "'Noto Serif JP', serif", fontSize: 13, fontWeight: 800,
                    color: `rgb(${c[0]},${c[1]},${c[2]})`,
                  }}>{g.kanji}</span>
                  <span style={{
                    fontFamily: NUM_FONT, fontSize: 12, fontWeight: 700,
                    color: `rgba(${c[0]},${c[1]},${c[2]},0.85)`,
                  }}>{g.total}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: PALETTE.textSub }}>
            <span style={{ fontSize: 9, letterSpacing: '0.12em', opacity: 0.7 }}>16軸詳細</span>
            <span style={{
              fontSize: 10,
              display: 'inline-block',
              transform: gridOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.25s ease',
            }}>▼</span>
          </div>
        </button>

        {/* 展開グリッド */}
        {gridOpen && (
        <div style={{ padding: '4px 16px 20px', animation: 'amFadeIn 0.2s ease' }}>
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
        )}
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
