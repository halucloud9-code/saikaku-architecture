import { useState, useEffect, useRef, useMemo } from 'react';

/**
 * ActivationMatrix — 16項目統一レーダーチャート
 *
 * 4軸 × 4サブ = 16次元を1つの多角形で可視化
 * ダーク背景 + グロー + アニメーション + インタラクション
 */

const NUM_FONT = "'DM Sans', 'Outfit', sans-serif";

const AXIS_META = [
  { key: 'mindset',    kanji: '志', en: 'MindSet',    color: '#4A8FD4', glow: '#4A8FD440' },
  { key: 'literacy',   kanji: '知', en: 'Literacy',   color: '#3DBD7A', glow: '#3DBD7A40' },
  { key: 'competency', kanji: '技', en: 'Competency', color: '#D4A84A', glow: '#D4A84A40' },
  { key: 'impact',     kanji: '衝', en: 'Impact',     color: '#D45A4A', glow: '#D45A4A40' },
];

const SUB_META = [
  // 志 (0-3)
  { key: 'meaning',       axis: 0, label: 'Meaning',       jp: '意味' },
  { key: 'mindfulness',   axis: 0, label: 'Mindfulness',   jp: '気づき' },
  { key: 'mindshift',     axis: 0, label: 'Mindshift',     jp: '意識転換' },
  { key: 'mastery',       axis: 0, label: 'Mastery',       jp: '熟達' },
  // 知 (4-7)
  { key: 'learning',      axis: 1, label: 'Learning',      jp: '学習' },
  { key: 'logical',       axis: 1, label: 'Logical',       jp: '論理' },
  { key: 'life',          axis: 1, label: 'Life',          jp: '社会実装' },
  { key: 'leadership',    axis: 1, label: 'Leadership',    jp: 'リーダーシップ' },
  // 技 (8-11)
  { key: 'critical',      axis: 2, label: 'Critical',      jp: '批判的思考' },
  { key: 'creativity',    axis: 2, label: 'Creativity',    jp: '創造性' },
  { key: 'communication', axis: 2, label: 'Communication', jp: '伝える力' },
  { key: 'collaboration', axis: 2, label: 'Collaboration', jp: '協働' },
  // 衝 (12-15)
  { key: 'idea',           axis: 3, label: 'Idea',           jp: 'アイデア' },
  { key: 'innovation',     axis: 3, label: 'Innovation',     jp: '変革' },
  { key: 'implementation', axis: 3, label: 'Implementation', jp: '実装' },
  { key: 'influence',      axis: 3, label: 'Influence',      jp: '影響' },
];

const N = 16;
const CX = 260, CY = 260, OUTER_R = 190;
const SVG_SIZE = 520;

function polarToXY(i, r) {
  const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
  return { x: CX + Math.cos(angle) * r, y: CY + Math.sin(angle) * r };
}

function ringPath(r) {
  return SUB_META.map((_, i) => {
    const p = polarToXY(i, r);
    return `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`;
  }).join(' ') + ' Z';
}

export default function ActivationMatrix({ scores, maxSub = 15, onSubClick }) {
  const [animProgress, setAnimProgress] = useState(0);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const animRef = useRef(null);

  // Build data points
  const points = useMemo(() => {
    return SUB_META.map((sub, i) => {
      const axisData = scores?.[AXIS_META[sub.axis].key];
      const raw = axisData?.subs?.[sub.key] ?? axisData?.domainSubs?.[sub.key] ?? 0;
      const pct = Math.round((raw / maxSub) * 100);
      const r = (raw / maxSub) * OUTER_R;
      const pos = polarToXY(i, r);
      const outerPos = polarToXY(i, OUTER_R);
      const labelPos = polarToXY(i, OUTER_R + 34);
      const color = AXIS_META[sub.axis].color;
      return { ...sub, raw, pct, r, pos, outerPos, labelPos, color, idx: i };
    });
  }, [scores, maxSub]);

  // Overall total
  const totalScore = useMemo(() => {
    return points.reduce((sum, p) => sum + p.raw, 0);
  }, [points]);
  const totalMax = maxSub * 16;
  const totalPct = Math.round((totalScore / totalMax) * 100);

  // Top 3 and bottom 3
  const sorted = useMemo(() => [...points].sort((a, b) => b.pct - a.pct), [points]);
  const top3 = sorted.slice(0, 3);
  const bottom3 = sorted.slice(-3).reverse();

  // Entrance animation
  useEffect(() => {
    let start = null;
    const duration = 1200;
    function tick(ts) {
      if (!start) start = ts;
      const elapsed = ts - start;
      const t = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setAnimProgress(eased);
      if (t < 1) animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [scores]);

  // Data polygon path (animated)
  const dataPath = useMemo(() => {
    return points.map((p, i) => {
      const animR = p.r * animProgress;
      const pos = polarToXY(i, animR);
      return `${i === 0 ? 'M' : 'L'}${pos.x},${pos.y}`;
    }).join(' ') + ' Z';
  }, [points, animProgress]);

  // Animated dot positions
  const animDots = useMemo(() => {
    return points.map((p, i) => polarToXY(i, p.r * animProgress));
  }, [points, animProgress]);

  const activeIdx = selectedIdx ?? hoveredIdx;
  const activePoint = activeIdx != null ? points[activeIdx] : null;

  return (
    <div style={{
      background: 'linear-gradient(145deg, #0D0B09 0%, #1A1510 50%, #0D0B09 100%)',
      borderRadius: 20,
      padding: '32px 20px 28px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle background texture */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 30%, rgba(184,150,12,0.06) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 24, position: 'relative', zIndex: 1 }}>
        <div style={{
          fontSize: 10, color: '#B8960C', letterSpacing: '0.3em', fontWeight: 600,
          marginBottom: 6, textTransform: 'uppercase',
        }}>
          Activation Matrix
        </div>
        <div style={{
          fontFamily: "'Noto Serif JP', serif", fontSize: 20, fontWeight: 700,
          color: '#FFFFFF', letterSpacing: '0.08em',
        }}>
          才覚発動領域
        </div>
      </div>

      {/* SVG Chart */}
      <div style={{ position: 'relative', maxWidth: SVG_SIZE, margin: '0 auto' }}>
        <svg
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          <defs>
            {/* Glow filter */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-strong" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Gradient for data polygon */}
            <linearGradient id="dataGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#B8960C" stopOpacity="0.35" />
              <stop offset="50%" stopColor="#D4A84A" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#B8960C" stopOpacity="0.35" />
            </linearGradient>

            {/* Sector arc backgrounds */}
            {AXIS_META.map((axis, ai) => (
              <radialGradient key={axis.key} id={`sector-${ai}`} cx="50%" cy="50%" r="50%">
                <stop offset="60%" stopColor={axis.color} stopOpacity="0.03" />
                <stop offset="100%" stopColor={axis.color} stopOpacity="0.08" />
              </radialGradient>
            ))}
          </defs>

          {/* Sector background arcs */}
          {AXIS_META.map((axis, ai) => {
            const startIdx = ai * 4;
            const startAngle = (Math.PI * 2 * startIdx) / N - Math.PI / 2;
            const endAngle = (Math.PI * 2 * (startIdx + 4)) / N - Math.PI / 2;
            const r = OUTER_R + 4;
            const x1 = CX + Math.cos(startAngle) * r;
            const y1 = CY + Math.sin(startAngle) * r;
            const x2 = CX + Math.cos(endAngle) * r;
            const y2 = CY + Math.sin(endAngle) * r;
            return (
              <path key={axis.key}
                d={`M${CX},${CY} L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z`}
                fill={`url(#sector-${ai})`}
              />
            );
          })}

          {/* Grid rings */}
          {[0.25, 0.5, 0.75, 1].map(p => (
            <path key={p} d={ringPath(OUTER_R * p)}
              fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={p === 1 ? 1 : 0.5}
            />
          ))}

          {/* Axis spokes */}
          {points.map((p, i) => (
            <line key={i}
              x1={CX} y1={CY} x2={p.outerPos.x} y2={p.outerPos.y}
              stroke={i % 4 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)'}
              strokeWidth={i % 4 === 0 ? 1 : 0.5}
            />
          ))}

          {/* Data polygon glow */}
          <path d={dataPath} fill="none" stroke="#B8960C" strokeWidth="3"
            filter="url(#glow-strong)" opacity={0.4 * animProgress}
          />

          {/* Data polygon fill */}
          <path d={dataPath} fill="url(#dataGrad)" opacity={animProgress} />

          {/* Data polygon stroke */}
          <path d={dataPath} fill="none" stroke="#B8960C" strokeWidth="1.5"
            opacity={0.8 * animProgress} strokeLinejoin="round"
          />

          {/* Data dots */}
          {animDots.map((dot, i) => {
            const p = points[i];
            const isActive = activeIdx === i;
            const isTop = top3.some(t => t.idx === i);
            const baseR = isTop ? 5 : 3.5;
            const dotR = isActive ? 7 : baseR;
            return (
              <g key={i}>
                {/* Glow circle */}
                {(isActive || isTop) && (
                  <circle cx={dot.x} cy={dot.y} r={dotR + 4}
                    fill={p.color} opacity={isActive ? 0.3 : 0.15}
                    style={{ transition: 'all 0.3s ease' }}
                  />
                )}
                {/* Main dot */}
                <circle cx={dot.x} cy={dot.y} r={dotR}
                  fill={isActive ? p.color : '#FFFFFF'}
                  stroke={p.color} strokeWidth={isActive ? 2 : 1.5}
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    filter: isActive ? 'url(#glow)' : 'none',
                  }}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
                />
                {/* Score label on hover */}
                {isActive && (
                  <text x={dot.x} y={dot.y - 14}
                    textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="700"
                    fontFamily={NUM_FONT}
                    style={{ pointerEvents: 'none' }}
                  >
                    {p.pct}%
                  </text>
                )}
              </g>
            );
          })}

          {/* Outer labels */}
          {points.map((p, i) => {
            const isActive = activeIdx === i;
            const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
            const angleDeg = (angle * 180) / Math.PI;
            const isRight = angleDeg > -90 && angleDeg < 90;
            const anchor = Math.abs(angleDeg + 90) < 10 || Math.abs(angleDeg - 90) < 10
              ? 'middle'
              : isRight ? 'start' : 'end';

            return (
              <g key={i}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
              >
                <text
                  x={p.labelPos.x} y={p.labelPos.y - 6}
                  textAnchor={anchor}
                  fill={isActive ? p.color : 'rgba(255,255,255,0.5)'}
                  fontSize={isActive ? 11 : 10}
                  fontWeight={isActive ? 700 : 400}
                  fontFamily={NUM_FONT}
                  style={{ transition: 'all 0.2s ease' }}
                >
                  {p.label}
                </text>
                <text
                  x={p.labelPos.x} y={p.labelPos.y + 8}
                  textAnchor={anchor}
                  fill={isActive ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)'}
                  fontSize={9}
                  style={{ transition: 'all 0.2s ease' }}
                >
                  {p.jp}
                </text>
              </g>
            );
          })}

          {/* Axis kanji labels at sector midpoints */}
          {AXIS_META.map((axis, ai) => {
            const midIdx = ai * 4 + 1.5;
            const angle = (Math.PI * 2 * midIdx) / N - Math.PI / 2;
            const r = OUTER_R + 62;
            const x = CX + Math.cos(angle) * r;
            const y = CY + Math.sin(angle) * r;
            return (
              <g key={axis.key}>
                <text x={x} y={y - 4} textAnchor="middle"
                  fill={axis.color} fontSize="20" fontWeight="800"
                  fontFamily="'Noto Serif JP', serif"
                  opacity="0.7"
                >
                  {axis.kanji}
                </text>
                <text x={x} y={y + 12} textAnchor="middle"
                  fill={axis.color} fontSize="8" fontWeight="600"
                  fontFamily={NUM_FONT} letterSpacing="0.1em" opacity="0.5"
                >
                  {axis.en.toUpperCase()}
                </text>
              </g>
            );
          })}

          {/* Center score */}
          <circle cx={CX} cy={CY} r="36" fill="rgba(0,0,0,0.6)" stroke="rgba(184,150,12,0.3)" strokeWidth="1" />
          <text x={CX} y={CY - 4} textAnchor="middle" fill="#FFFFFF"
            fontSize="22" fontWeight="800" fontFamily={NUM_FONT}
          >
            {Math.round(totalPct * animProgress)}
          </text>
          <text x={CX} y={CY + 12} textAnchor="middle" fill="rgba(255,255,255,0.4)"
            fontSize="9" fontWeight="500" fontFamily={NUM_FONT} letterSpacing="0.1em"
          >
            TOTAL %
          </text>
        </svg>
      </div>

      {/* Detail card on selection */}
      {activePoint && selectedIdx != null && (
        <div style={{
          margin: '16px auto 0',
          maxWidth: 360,
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(10px)',
          border: `1px solid ${activePoint.color}40`,
          borderRadius: 14,
          padding: '18px 20px',
          animation: 'fadeSlideUp 0.3s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <span style={{
                fontSize: 14, fontWeight: 700, color: activePoint.color,
              }}>
                {activePoint.jp}
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
                {activePoint.label}
              </span>
            </div>
            <div style={{
              fontFamily: NUM_FONT, fontSize: 20, fontWeight: 800, color: '#FFFFFF',
            }}>
              {activePoint.pct}<span style={{ fontSize: 12, fontWeight: 400, color: 'rgba(255,255,255,0.5)' }}>%</span>
            </div>
          </div>
          {/* Score bar */}
          <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{
              height: '100%', width: `${activePoint.pct}%`,
              background: `linear-gradient(90deg, ${activePoint.color}, ${activePoint.color}AA)`,
              borderRadius: 2,
              transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{
            fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6,
          }}>
            {activePoint.raw}/{maxSub} — {AXIS_META[activePoint.axis].kanji} {AXIS_META[activePoint.axis].en}
          </div>
        </div>
      )}

      {/* Top & Bottom badges */}
      <div style={{
        display: 'flex', gap: 20, justifyContent: 'center', marginTop: 24,
        flexWrap: 'wrap', position: 'relative', zIndex: 1,
      }}>
        {/* Top 3 */}
        <div style={{ flex: '1 1 140px', maxWidth: 200 }}>
          <div style={{
            fontSize: 9, color: '#B8960C', letterSpacing: '0.2em', fontWeight: 600,
            marginBottom: 10, textTransform: 'uppercase', textAlign: 'center',
          }}>
            Strengths
          </div>
          {top3.map((p, i) => (
            <div key={p.key} style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
              padding: '6px 10px', borderRadius: 8,
              background: i === 0 ? 'rgba(184,150,12,0.1)' : 'transparent',
            }}>
              <span style={{
                fontFamily: NUM_FONT, fontSize: 13, fontWeight: 800,
                color: i === 0 ? '#B8960C' : 'rgba(255,255,255,0.6)',
                width: 18,
              }}>
                {i + 1}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#FFFFFF', fontWeight: 600 }}>{p.jp}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>{p.label}</div>
              </div>
              <span style={{
                fontFamily: NUM_FONT, fontSize: 14, fontWeight: 700,
                color: p.color,
              }}>
                {p.pct}%
              </span>
            </div>
          ))}
        </div>

        {/* Bottom 3 */}
        <div style={{ flex: '1 1 140px', maxWidth: 200 }}>
          <div style={{
            fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.2em', fontWeight: 600,
            marginBottom: 10, textTransform: 'uppercase', textAlign: 'center',
          }}>
            Growth Areas
          </div>
          {bottom3.map((p, i) => (
            <div key={p.key} style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
              padding: '6px 10px', borderRadius: 8,
            }}>
              <span style={{
                fontFamily: NUM_FONT, fontSize: 13, fontWeight: 800,
                color: 'rgba(255,255,255,0.3)', width: 18,
              }}>
                {16 - 2 + i}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{p.jp}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>{p.label}</div>
              </div>
              <span style={{
                fontFamily: NUM_FONT, fontSize: 14, fontWeight: 700,
                color: 'rgba(255,255,255,0.5)',
              }}>
                {p.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
