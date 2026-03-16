import { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db, signOutUser } from '../firebase';
import { computePcts, CHART_COLORS } from '../utils/chartUtils';

const COLORS = {
  ...CHART_COLORS,
  bg:     { value: '#0D1118',   talent: '#14110D',   passion: '#140D0D'   },
  main:   { value: '#60A5FA',   talent: '#FBBF24',   passion: '#F87171'   },
  border: { value: '#4A6FA540', talent: '#C4922A40', passion: '#A8443240' },
};

// カテゴリ別 Venn ダーク配色
const VENN_COLORS = {
  value:   { bg: '#0D1420', c1: '#1a3a6b', c2: '#2e6bc4', c3: '#7eb8f7' },
  talent:  { bg: '#14110D', c1: '#8b5e00', c2: '#c4922a', c3: '#f0c96e' },
  passion: { bg: '#140D0D', c1: '#7a1a1a', c2: '#c0392b', c3: '#e8847a' },
};

// ドーナツチャート色
const DONUT_COLORS = {
  value:   ['#2e6bc4', '#1a3a6b', '#7eb8f7'],
  talent:  ['#c4922a', '#8b5e00', '#f0c96e'],
  passion: ['#c0392b', '#7a1a1a', '#e8847a'],
};

// ── メインベン図 SVG（サマリーカード用）─────────────────────────────────
function VennSvg({ width = 240, height = 200, className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 280 232"
      width={width}
      height={height}
      style={{ display: 'inline-block', overflow: 'visible', maxWidth: '100%' }}
    >
      <circle cx="140" cy="78"  r="70" fill="#4A6FA5" fillOpacity="0.75" stroke="#4A6FA5" strokeOpacity="0.90" strokeWidth="1.5"/>
      <circle cx="98"  cy="156" r="70" fill="#A84432" fillOpacity="0.75" stroke="#A84432" strokeOpacity="0.90" strokeWidth="1.5"/>
      <circle cx="182" cy="156" r="70" fill="#C4922A" fillOpacity="0.75" stroke="#C4922A" strokeOpacity="0.90" strokeWidth="1.5"/>
      <circle cx="140" cy="128" r="22" fill="#FFD700" fillOpacity="0.55" stroke="#FFD700" strokeOpacity="0.80" strokeWidth="1.5"/>
      <text x="140" y="9"   textAnchor="middle" fill="#FDFCFA" fontSize="18" fontWeight="700" letterSpacing="1">価値観</text>
      <text x="140" y="23"  textAnchor="middle" fill="#FDFCFA" fontSize="9"  fillOpacity="0.85" letterSpacing="0.5">VALUE</text>
      <text x="34"  y="218" textAnchor="middle" fill="#FDFCFA" fontSize="18" fontWeight="700">情熱</text>
      <text x="34"  y="230" textAnchor="middle" fill="#FDFCFA" fontSize="9"  fillOpacity="0.85">PASSION</text>
      <text x="246" y="218" textAnchor="middle" fill="#FDFCFA" fontSize="18" fontWeight="700">才能</text>
      <text x="246" y="230" textAnchor="middle" fill="#FDFCFA" fontSize="9"  fillOpacity="0.85">TALENT</text>
      <text x="140" y="133" textAnchor="middle" fill="#FDFCFA" fontSize="16" fontWeight="700">✦</text>
    </svg>
  );
}

// ── カテゴリ別ベン図（各セクション用）──────────────
function CategoryVennChart({ type, axes }) {
  const { bg, c1, c2, c3 } = VENN_COLORS[type];
  const ax1 = axes?.axis1;
  const ax2 = axes?.axis2;
  const ax3 = axes?.axis3;

  return (
    <div
      style={{
        background: bg,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <div style={{ position: 'relative', paddingLeft: 38, paddingRight: 38, paddingBottom: 28, textAlign: 'center', overflow: 'hidden' }}>
        <svg
          viewBox="0 0 280 232"
          width={160}
          height={132}
          style={{ display: 'inline-block', overflow: 'visible', maxWidth: '100%' }}
        >
          <circle cx="140" cy="78"  r="70" fill={c1} fillOpacity="0.75" stroke={c1} strokeOpacity="0.90" strokeWidth="1.5"/>
          <circle cx="98"  cy="156" r="70" fill={c2} fillOpacity="0.75" stroke={c2} strokeOpacity="0.90" strokeWidth="1.5"/>
          <circle cx="182" cy="156" r="70" fill={c3} fillOpacity="0.75" stroke={c3} strokeOpacity="0.90" strokeWidth="1.5"/>
          <circle cx="140" cy="128" r="18" fill="#FFFFFF" fillOpacity="0.15" stroke="#FFFFFF" strokeOpacity="0.25" strokeWidth="1"/>
          <text x="140" y="133" textAnchor="middle" fill="#FDFCFA" fontSize="14" fontWeight="700">✦</text>
        </svg>
        <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#FDFCFA', textAlign: 'center', width: 34 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: c1, margin: '0 auto 3px' }} />
          <span style={{ display: 'block', wordBreak: 'break-all', lineHeight: 1.2 }}>{ax1?.name}</span>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: '#FDFCFA', textAlign: 'center', whiteSpace: 'nowrap' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: c2, margin: '0 auto 3px' }} />
          <span>{ax2?.name}</span>
        </div>
        <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#FDFCFA', textAlign: 'center', width: 34 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: c3, margin: '0 auto 3px' }} />
          <span style={{ display: 'block', wordBreak: 'break-all', lineHeight: 1.2 }}>{ax3?.name}</span>
        </div>
      </div>
    </div>
  );
}

// ── ドーナツチャートコンポーネント ─────────────────────────────────────────
function DonutChart({ axes, colors, size = 240 }) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.38;
  const strokeWidth = size * 0.18;
  const circumference = 2 * Math.PI * radius;
  const counts = axes.map(a => a.items?.length || 0);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {axes.map((axis, i) => {
        const pct = counts[i] / total;
        const dash = pct * circumference;
        const gap = circumference - dash;
        const rotation = offset * 360 - 90;
        offset += pct;
        return (
          <circle key={i} cx={cx} cy={cy} r={radius} fill="none" stroke={colors[i]}
            strokeWidth={strokeWidth} strokeDasharray={`${dash} ${gap}`}
            transform={`rotate(${rotation} ${cx} ${cy})`} strokeLinecap="butt" />
        );
      })}
      <text
        x={cx}
        y={cy + size * 0.07}
        textAnchor="middle"
        fill="#ffffff"
        fontSize={size * 0.22}
        fontWeight="900"
        fontFamily="'Inter', Arial, sans-serif"
        style={{ fontFamily: "'Inter', Arial, sans-serif", fill: '#ffffff' }}
      >
        {axes.reduce((s, a) => s + (a.items?.length || 0), 0)}
      </text>
    </svg>
  );
}

// ── 軸カード（全items フラット表示） ─────────────────────────────────────
// パーセント数字用の明るい色（WHATゴールドレベル）
const PCT_COLORS = {
  value:   ['#BFDBFE', '#93C5FD', '#60A5FA'],
  talent:  ['#FFD700', '#FDE68A', '#FBBF24'],
  passion: ['#FECACA', '#FCA5A5', '#F87171'],
};

function AxisCard({ axis, color, pctColor, bg, borderColor, pct }) {
  const allItems = axis?.items || [];

  return (
    <div
      className="pdf-axis-card"
      style={{
        borderLeft: `6px solid ${color}`,
        borderRadius: 8,
        marginBottom: 10,
        overflow: 'hidden',
        background: '#27272A',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
      }}
    >
      <div style={{ padding: '14px 16px 12px' }}>
        {/* 軸名 + パーセント */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div>
            <span style={{ fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif", fontSize: 18, fontWeight: 700, color: '#FAFAFA' }}>
              {axis.name}
            </span>
            <span style={{ fontSize: 11, color: '#71717A', marginLeft: 6, fontStyle: 'italic', letterSpacing: '0.05em' }}>
              {axis.english || axis.en}
            </span>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, overflow: 'hidden' }}>
            <span style={{ display: 'block', fontSize: 26, fontWeight: 700, color: '#FFFFFF', fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif", lineHeight: 1 }}>
              {pct}%
            </span>
            <span style={{ fontSize: 14, color: '#71717A', letterSpacing: '0.05em' }}>
              {allItems.length} 要素
            </span>
          </div>
        </div>

        <p style={{ fontSize: 14, color: '#D4D4D8', margin: '0 0 10px', lineHeight: 1.6 }}>
          {axis.description || axis.desc}
        </p>

        {/* 全items フラット */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {allItems.map((item, i) => (
            <span
              key={i}
              className="pdf-tag"
              style={{
                padding: '5px 11px',
                borderRadius: 100,
                background: '#3F3F46',
                border: '1px solid #52525B',
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: 600,
                wordBreak: 'break-word',
              }}
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── カテゴリセクション（ベン図 + 軸カード） ─────────────────────────────
function CategorySection({ title, type, axes }) {
  const colors = COLORS[type];
  const main   = COLORS.main[type];
  const bg     = COLORS.bg[type];
  const border = COLORS.border[type];
  const pcts      = computePcts(axes);
  const pctColors = PCT_COLORS[type];
  const axesArray  = ['axis1', 'axis2', 'axis3'].map(k => axes?.[k]).filter(Boolean);
  const donutColors = DONUT_COLORS[type];
  const LABELS    = { talent: '才能', value: '価値観', passion: '情熱' };
  const EN_LABELS = { talent: 'Talent', value: 'Values', passion: 'Passion' };

  return (
    <div
      className="pdf-section"
      style={{
        background: '#111113',
        borderRadius: 8,
        borderTop: `2px solid ${main}`,
        padding: '24px 20px',
        overflow: 'hidden',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
      }}
    >
      {/* セクションヘッダー */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#FAFAFA' }}>{LABELS[type]}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: main, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{EN_LABELS[type]}</span>
        </div>

        {/* ドーナツチャート */}
        <div style={{ background: '#0A0A0C', borderRadius: 8, padding: '24px 16px', marginBottom: 12, border: '1px solid #18181B' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 280, margin: '0 auto', height: 320 }}>
            {axesArray[0] && (
              <div style={{ position: 'absolute', top: 0, left: 0, textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: donutColors[0], display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: 18, color: '#FDFCFA', fontWeight: 700 }}>{axesArray[0].name}</span>
                </div>
                <div className="donut-pct" style={{ fontSize: 36, fontWeight: 900, color: '#ffffff', lineHeight: 1, paddingLeft: 16, fontFamily: "'Inter', Arial, sans-serif" }}>{pcts[0]}%</div>
              </div>
            )}
            {axesArray[1] && (
              <div style={{ position: 'absolute', top: 0, right: 0, textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 18, color: '#FDFCFA', fontWeight: 700 }}>{axesArray[1].name}</span>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: donutColors[1], display: 'inline-block', flexShrink: 0 }} />
                </div>
                <div className="donut-pct" style={{ fontSize: 36, fontWeight: 900, color: '#ffffff', lineHeight: 1, paddingRight: 16, fontFamily: "'Inter', Arial, sans-serif" }}>{pcts[1]}%</div>
              </div>
            )}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
              <DonutChart axes={axesArray} colors={donutColors} size={220} />
            </div>
            {axesArray[2] && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, textAlign: 'left' }}>
                <div className="donut-pct" style={{ fontSize: 36, fontWeight: 900, color: '#ffffff', lineHeight: 1, paddingLeft: 16, marginBottom: 2, fontFamily: "'Inter', Arial, sans-serif" }}>{pcts[2]}%</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: donutColors[2], display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: 18, color: '#FDFCFA', fontWeight: 700 }}>{axesArray[2].name}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 軸カード */}
      {['axis1', 'axis2', 'axis3'].map((k, i) => (
        <AxisCard
          key={k}
          axis={axes[k]}
          color={colors[i]}
          pctColor={pctColors[i]}
          bg={`${colors[i]}14`}
          borderColor={`${colors[i]}45`}
          pct={pcts[i]}
        />
      ))}
    </div>
  );
}

// ── メインコンポーネント ─────────────────────────────────────────────────
export default function ResultScreen({ user, result, isAdmin, onReset, onAdmin, onLogout }) {
  const [selected, setSelected] = useState(result.kakuchiiki || result.kakuchiiki_options?.[0] || '');
  const [saving,   setSaving]   = useState(false);
  const [copied,   setCopied]   = useState(false);
  const [hoverPdf, setHoverPdf] = useState(false);
  const [hoverShare, setHoverShare] = useState(false);

  const handleSelectKakuchiiki = async (option) => {
    if (option === selected) return;
    setSelected(option);
    setSaving(true);
    try {
      await setDoc(doc(db, 'results', user.uid), { selectedKakuchiiki: option }, { merge: true });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handlePdfDownload = () => { window.print(); };

  const handleShare = async () => {
    const text = `${result.name || user.displayName}の才覚領域：${selected}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Unique Ability Architecture', text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (e) { /* user cancelled */ }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(170deg, #0A0908 0%, #0F0D0A 20%, #14110D 50%, #0D0B09 100%)',
    }}>

      {/* ── ヘッダー（no-print） ── */}
      <div
        className="no-print"
        style={{
          background: 'rgba(10,9,8,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(196,146,42,0.1)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <span style={{ fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif", fontSize: 16, fontWeight: 700, color: '#F5F0E8' }}>
          Unique Ability <span style={{ color: 'rgba(196,146,42,0.6)', fontWeight: 400, fontSize: 13 }}>Architecture</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isAdmin && (
            <button onClick={onAdmin} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(196,146,42,0.2)', background: 'transparent', color: '#8A8070', fontSize: 13, cursor: 'pointer' }}>
              管理画面
            </button>
          )}
          {user.photoURL && (
            <img src={user.photoURL} alt={user.displayName} style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid rgba(196,146,42,0.3)' }} />
          )}
          <button
            onClick={async () => { await signOutUser(); onLogout(); }}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#8A8070', fontSize: 13, cursor: 'pointer' }}
          >
            ログアウト
          </button>
        </div>
      </div>

      {/* ── コンテンツ ── */}
      <div>
        <div className="pdf-content-wrapper" style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 24px 16px' }}>

          {/* グラデーションバー（スクリーンのみ） */}
          <div
            className="no-print"
            style={{
              height: 3,
              borderRadius: 2,
              background: 'linear-gradient(to right, #1a3a6b, #2e6bc4, #4A6FA5, #C4922A, #A84432, #c0392b)',
              marginBottom: 40,
              boxShadow: '0 0 20px rgba(196,146,42,0.15)',
            }}
          />

          {/* メインタイトル（スクリーンのみ） */}
          <div className="no-print" style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{
              display: 'inline-flex',
              background: 'linear-gradient(135deg, rgba(196,146,42,0.15), rgba(74,111,165,0.15), rgba(168,68,50,0.15))',
              border: '1px solid rgba(196,146,42,0.2)',
              borderRadius: 12,
              padding: '10px 32px',
              marginBottom: 20,
              minWidth: 200,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#C4922A',
                letterSpacing: '0.2em',
                fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif",
                textTransform: 'uppercase',
              }}>Three Pattern Unique Ability</span>
            </div>
            <h1 style={{
              fontFamily: "'Noto Serif JP', Georgia, serif",
              fontSize: 32,
              fontWeight: 800,
              color: '#F5F0E8',
              margin: '0 0 8px',
              letterSpacing: '0.05em',
            }}>
              {result.name || user.displayName}
            </h1>

            {/* 装飾ライン */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, margin: '16px 0' }}>
              <div style={{ width: 48, height: 1, background: 'linear-gradient(90deg, transparent, rgba(196,146,42,0.3))' }} />
              <div style={{ width: 5, height: 5, borderRadius: '50%', border: '1px solid rgba(196,146,42,0.4)', background: 'rgba(196,146,42,0.15)' }} />
              <div style={{ width: 48, height: 1, background: 'linear-gradient(90deg, rgba(196,146,42,0.3), transparent)' }} />
            </div>

            <div style={{
              fontFamily: "'Noto Serif JP', Georgia, serif",
              fontSize: 22,
              fontWeight: 700,
              color: '#F5F0E8',
              letterSpacing: '0.1em',
              marginBottom: 4,
            }}>才覚領域</div>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'rgba(196,146,42,0.5)',
              letterSpacing: '0.2em',
              fontFamily: "'Playfair Display', Georgia, serif",
            }}>Architecture</div>
          </div>

          {/* 才覚領域 選択セクション（スクリーンのみ） */}
          <div
            className="no-print"
            style={{
              background: 'rgba(20,17,13,0.8)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: 20,
              border: '1px solid rgba(196,146,42,0.12)',
              padding: '36px 32px',
              marginBottom: 32,
              boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: '#F5F0E8', letterSpacing: '0.1em', lineHeight: 1.2, fontFamily: "'Noto Serif JP', Georgia, serif" }}>
                才覚領域
              </div>
              <div style={{
                fontSize: 14, fontWeight: 600, color: '#C4922A', letterSpacing: '0.2em', marginTop: 12,
                display: 'inline-block', background: 'linear-gradient(135deg, rgba(196,146,42,0.15), rgba(74,111,165,0.15), rgba(168,68,50,0.15))',
                border: '1px solid rgba(196,146,42,0.2)', borderRadius: 10, padding: '8px 24px',
                fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.5, textAlign: 'center',
              }}>
                <div>Three Pattern</div>
                <div>Unique Ability</div>
              </div>
            </div>

            <div
              className="pdf-pattern-grid"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}
            >
              {(result.kakuchiiki_options || [result.kakuchiiki]).map((option, i) => {
                const isSelected    = selected === option;
                const isRecommended = option === result.kakuchiiki;
                return (
                  <button
                    key={i}
                    className="pdf-pattern-card"
                    onClick={() => handleSelectKakuchiiki(option)}
                    style={{
                      padding: '20px 24px',
                      borderRadius: 14,
                      border: isSelected ? '2px solid #FFD700' : '1.5px solid rgba(196,146,42,0.4)',
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(196,146,42,0.12), rgba(196,146,42,0.06))'
                        : 'rgba(255,255,255,0.02)',
                      boxShadow: isSelected ? '0 4px 24px rgba(196,146,42,0.2), inset 0 1px 0 rgba(196,146,42,0.1)' : 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      position: 'relative',
                      transition: 'all 0.3s ease',
                      width: '100%',
                      boxSizing: 'border-box',
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                      overflow: 'hidden',
                      WebkitAppearance: 'none',
                      appearance: 'none',
                      outline: 'none',
                    }}
                  >
                    {isRecommended && (
                      <div style={{ position: 'absolute', top: -10, left: 16, background: 'linear-gradient(135deg, #C4922A, #A87A1E)', color: '#0D0B09', fontSize: 10, fontWeight: 700, padding: '3px 12px', borderRadius: 100, letterSpacing: '0.05em' }}>
                        ★ 推奨
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: '#C4922A', fontWeight: 700, letterSpacing: '0.15em', marginBottom: 10 }}>
                      PATTERN {i + 1}
                    </div>
                    <p style={{ fontFamily: "'Noto Serif JP', Georgia, serif", fontSize: 20, fontWeight: 700, color: isSelected ? '#FFFFFF' : '#D4D4D8', margin: 0, lineHeight: 1.5, wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'normal', transition: 'color 0.3s ease' }}>
                      {option}
                    </p>
                  </button>
                );
              })}
            </div>
            {saving && <p style={{ textAlign: 'center', fontSize: 12, color: '#8A8070', marginTop: 12 }}>保存中...</p>}
          </div>

          {/* 3列グリッド：価値観・才能・情熱（スクリーンのみ） */}
          <div
            className="no-print"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 32 }}
          >
            <CategorySection title="価値観" type="value"   axes={result.value}   />
            <CategorySection title="才能"   type="talent"  axes={result.talent}  />
            <CategorySection title="情熱"   type="passion" axes={result.passion} />
          </div>

          {/* WHAT セクション（スクリーンのみ） */}
          {result.what && (
            <div
              className="no-print"
              style={{
                background: 'rgba(20,17,13,0.9)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: 20,
                border: '1px solid rgba(240,201,110,0.12)',
                borderTop: '3px solid rgba(240,201,110,0.4)',
                padding: '28px 32px',
                marginBottom: 20,
                boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 3, height: 24, background: 'linear-gradient(to bottom, #F0C96E, #C4922A)', borderRadius: 2 }} />
                <div>
                  <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 800, color: '#FFD700', letterSpacing: '0.15em' }}>What</span>
                  <span style={{ fontSize: 13, color: '#6A6050', marginLeft: 10 }}>才覚領域から自然に生まれること</span>
                </div>
              </div>
              {result.what.products?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 14, color: '#C8C0B0', margin: '0 0 10px', fontWeight: 700, letterSpacing: '0.05em' }}>具体的なサービス・活動</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {result.what.products.map((p, i) => (
                      <span key={i} style={{ padding: '4px 14px', borderRadius: 100, background: 'rgba(196,146,42,0.1)', border: '1px solid rgba(196,146,42,0.3)', color: '#F5F0E8', fontSize: 12, fontWeight: 500 }}>
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ height: 1, background: 'rgba(196,146,42,0.1)', margin: '0 0 16px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                {result.what.actions && (
                  <div style={{ background: 'rgba(196,146,42,0.06)', border: '1px solid rgba(196,146,42,0.12)', borderLeft: '3px solid #FFD700', borderRadius: 12, padding: '14px 18px' }}>
                    <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 15, fontWeight: 800, color: '#FFD700', letterSpacing: '0.1em', margin: '0 0 8px' }}>First Step</p>
                    <p style={{ fontSize: 14, color: '#C8C0B0', margin: 0, lineHeight: 1.8 }}>{result.what.actions}</p>
                  </div>
                )}
                {result.what.offer && (
                  <div style={{ background: 'rgba(196,146,42,0.06)', border: '1px solid rgba(196,146,42,0.12)', borderLeft: '3px solid #FFD700', borderRadius: 12, padding: '14px 18px' }}>
                    <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 15, fontWeight: 800, color: '#FFD700', letterSpacing: '0.1em', margin: '0 0 8px' }}>To the World</p>
                    <p style={{ fontSize: 14, color: '#C8C0B0', margin: 0, lineHeight: 1.8 }}>{result.what.offer}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* REWARD セクション（スクリーンのみ） */}
          {result.reward && (
            <div
              className="no-print"
              style={{
                background: 'rgba(15,20,18,0.9)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: 20,
                border: '1px solid rgba(62,207,190,0.1)',
                padding: '28px 32px',
                marginBottom: 32,
                boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 3, height: 24, background: 'linear-gradient(to bottom, #3ECFBE, #5275A8)', borderRadius: 2 }} />
                <div>
                  <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, fontWeight: 800, color: '#3ECFBE', letterSpacing: '0.15em' }}>Reward</span>
                  <span style={{ fontSize: 13, color: '#4A7A70', marginLeft: 10 }}>あなたが得るもの</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 14 }}>
                {[
                  { key: 'economic',  label: '経済', icon: '💰', color: '#D4922A' },
                  { key: 'social',    label: '社会', icon: '🌍', color: '#7AA8D0' },
                  { key: 'intrinsic', label: '内的', icon: '✨', color: '#A090D8' },
                ].map(({ key, label, icon, color }) =>
                  result.reward[key] ? (
                    <div key={key} style={{ background: `${color}0A`, border: `1px solid ${color}18`, borderLeft: `3px solid ${color}60`, borderRadius: 12, padding: '14px 16px', overflow: 'hidden', wordBreak: 'break-all', whiteSpace: 'normal' }}>
                      <p style={{ fontSize: 18, fontWeight: 800, color, margin: '0 0 8px', letterSpacing: '0.08em' }}>{icon} {label}</p>
                      <p style={{ fontSize: 13, color: '#A0988A', margin: 0, lineHeight: 1.8, overflow: 'hidden', wordBreak: 'break-all', whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical' }}>{result.reward[key]}</p>
                    </div>
                  ) : null
                )}
              </div>
              {result.reward.model && (
                <div style={{ background: 'rgba(62,207,190,0.06)', border: '1px solid rgba(62,207,190,0.15)', borderRadius: 14, padding: '18px 22px' }}>
                  <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, fontWeight: 900, color: '#3ECFBE', letterSpacing: '0.15em', margin: '0 0 10px' }}>Reward Model</p>
                  <p style={{ fontSize: 15, color: '#D0C8B8', margin: 0, lineHeight: 1.9, fontFamily: "'Noto Serif JP', Georgia, serif", fontWeight: 600, overflow: 'hidden', wordBreak: 'break-all', whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}>
                    {result.reward.model}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── 才覚領域サマリーカード（スクリーン + PDF印刷対象） ── */}
          <div
            className="pdf-section pdf-page-break"
            style={{
              background: '#2A2520',
              borderRadius: 16,
              padding: '12px 20px',
              marginBottom: 8,
              pageBreakInside: 'avoid',
              breakInside: 'avoid',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 3, height: 20, background: 'linear-gradient(to bottom, #4A6FA5, #A84432)', borderRadius: 2 }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: '#FDFCFA', letterSpacing: '0.06em' }}>
                才覚領域 / Unique Ability
              </div>
            </div>
            <div style={{ textAlign: 'center', marginBottom: 2 }}>
              <VennSvg width={180} height={150} className="pdf-venn-svg" />
            </div>
            <div style={{ textAlign: 'center', marginBottom: 4 }}>
              <div style={{ color: '#FFD700', fontSize: '24px', fontWeight: 900, textAlign: 'center', letterSpacing: '0.1em', marginBottom: '1px' }}>才覚領域</div>
              <p style={{ fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif', fontSize: 18, fontWeight: 700, color: '#FDFCFA', margin: 0, lineHeight: 1.4, letterSpacing: '0.03em' }}>
                {selected}
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', width: '100%', boxSizing: 'border-box', marginBottom: 6 }}>
              {[
                { tp: 'value',   label: '価値観', axesData: result.value   },
                { tp: 'talent',  label: '才能',   axesData: result.talent  },
                { tp: 'passion', label: '情熱',   axesData: result.passion },
              ].map(({ tp, label, axesData }) => {
                const arr = ['axis1', 'axis2', 'axis3'].map(k => axesData?.[k]).filter(Boolean);
                const dotColor = DONUT_COLORS[tp];
                const miniPcts = computePcts(axesData);
                return (
                  <div key={tp} style={{ textAlign: 'center', flexShrink: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <DonutChart axes={arr} colors={dotColor} size={80} />
                    <div style={{ fontSize: 10, color: '#ffffff', marginTop: 2, fontWeight: 700, marginBottom: 3 }}>{label}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
                      {arr.map((axis, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <span style={{ fontSize: 9, color: dotColor[i], flexShrink: 0 }}>☀︎</span>
                          <span style={{ fontSize: 9, color: '#ffffff', fontWeight: 500, lineHeight: 1.2, fontFamily: "'Inter', Arial, sans-serif" }}>{axis.name}</span>
                          <span style={{ fontSize: 9, color: '#ffffff', fontWeight: 700, fontFamily: "'Inter', Arial, sans-serif" }}>{miniPcts[i]}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ height: 1, background: '#FDFCFA10', margin: '0 0 5px' }} />
            <div style={{ fontSize: 18, fontWeight: 800, color: '#FFD700', letterSpacing: '0.12em', marginBottom: 3 }}>
              Narrative
            </div>
            <p style={{ fontSize: 11, color: '#D4C9B0', lineHeight: 1.55, margin: '0 0 5px', fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif' }}>
              {result.insight}
            </p>
            {result.what && (
              <>
                <div style={{ height: 1, background: '#FDFCFA10', margin: '0 0 5px' }} />
                {result.what.products?.length > 0 && (
                  <div style={{ marginBottom: 4 }}>
                    <p style={{ fontSize: 12, fontWeight: 800, color: '#FFD700', letterSpacing: '0.08em', margin: '0 0 3px' }}>
                      ▶ What — 自然に生まれること
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {result.what.products.map((p, i) => (
                        <span key={i} style={{ padding: '1px 8px', borderRadius: 100, background: '#C4922A22', border: '1px solid rgba(255,255,255,0.3)', color: '#ffffff', fontSize: 10, fontWeight: 600 }}>
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {result.what.actions && (
                  <p style={{ fontSize: 11, color: '#D4C9B0', margin: '0 0 3px', lineHeight: 1.5 }}>
                    <span style={{ color: '#FFD700', fontWeight: 800, fontSize: 12 }}>First Step：</span>
                    {result.what.actions}
                  </p>
                )}
              </>
            )}
            {result.reward?.model && (
              <>
                <div style={{ height: 1, background: '#FDFCFA10', margin: '5px 0 4px' }} />
                <p style={{ fontSize: 20, fontWeight: 900, color: '#3ECFBE', letterSpacing: '0.12em', margin: '0 0 2px' }}>
                  ▶ Reward Model
                </p>
                <p style={{ fontSize: 11, color: '#F0EAE0', margin: 0, lineHeight: 1.55, fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif', fontWeight: 600 }}>
                  {result.reward.model}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── アクションボタン（no-print） ── */}
      <div
        className="no-print"
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '24px 16px',
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={handlePdfDownload}
          onMouseEnter={() => setHoverPdf(true)}
          onMouseLeave={() => setHoverPdf(false)}
          style={{
            width: 'calc(50% - 6px)',
            height: 52,
            boxSizing: 'border-box',
            borderRadius: 12,
            border: 'none',
            background: hoverPdf
              ? 'linear-gradient(135deg, #C4922A, #A87A1E)'
              : 'rgba(196,146,42,0.12)',
            color: hoverPdf ? '#0D0B09' : '#C4922A',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.3s ease',
            border: '1px solid rgba(196,146,42,0.2)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          印刷 / PDF保存
        </button>

        <button
          onClick={handleShare}
          onMouseEnter={() => setHoverShare(true)}
          onMouseLeave={() => setHoverShare(false)}
          style={{
            width: 'calc(50% - 6px)',
            height: 52,
            boxSizing: 'border-box',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.08)',
            background: hoverShare ? 'rgba(255,255,255,0.08)' : 'transparent',
            color: '#B0A890',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.3s ease',
          }}
        >
          {copied ? (
            <>✓ コピーしました</>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              結果をシェア
            </>
          )}
        </button>

        <button
          onClick={onReset}
          style={{
            width: '100%',
            height: 52,
            boxSizing: 'border-box',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'transparent',
            color: '#6A6050',
            fontSize: 15,
            fontWeight: 400,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
        >
          もう一度解析する
        </button>
      </div>

      {/* フッター */}
      <div style={{ textAlign: 'center', padding: '20px 0 40px' }}>
        <p className="no-print" style={{ fontSize: 10, color: 'rgba(138,128,112,0.3)', letterSpacing: '0.1em' }}>
          Powered by GRIFFON × Firebase
        </p>
      </div>
    </div>
  );
}
