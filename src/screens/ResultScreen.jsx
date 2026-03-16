import { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db, signOutUser } from '../firebase';
import { computePcts, CHART_COLORS } from '../utils/chartUtils';

const COLORS = {
  ...CHART_COLORS,
  bg:     { value: '#0D1118',   talent: '#14110D',   passion: '#140D0D'   },
  main:   { value: '#4A6FA5',   talent: '#C4922A',   passion: '#A84432'   },
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
function AxisCard({ axis, color, bg, borderColor, pct }) {
  const allItems = axis?.items || [];

  return (
    <div
      className="pdf-axis-card"
      style={{
        border: `1px solid ${color}25`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 14,
        marginBottom: 10,
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        background: 'rgba(255,255,255,0.02)',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
      }}
    >
      <div style={{ background: `${color}12`, padding: '14px 16px 12px', backdropFilter: 'blur(10px)' }}>
        {/* 軸名 + パーセント */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div>
            <span style={{ fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif", fontSize: 18, fontWeight: 700, color: `${color}` }}>
              {axis.name}
            </span>
            <span style={{ fontSize: 11, color: `${color}90`, marginLeft: 6, fontStyle: 'italic', letterSpacing: '0.05em' }}>
              {axis.english || axis.en}
            </span>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, overflow: 'hidden' }}>
            <span style={{ display: 'block', fontSize: 26, fontWeight: 700, color, fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif", lineHeight: 1 }}>
              {pct}%
            </span>
            <span style={{ fontSize: 14, color: '#6A6050', letterSpacing: '0.05em' }}>
              {allItems.length} 要素
            </span>
          </div>
        </div>

        <p style={{ fontSize: 14, color: '#B0A890', margin: '0 0 10px', lineHeight: 1.6 }}>
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
                background: `${color}15`,
                border: `1px solid ${color}50`,
                color: `${color}DD`,
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
  const axesArray  = ['axis1', 'axis2', 'axis3'].map(k => axes?.[k]).filter(Boolean);
  const donutColors = DONUT_COLORS[type];
  const LABELS    = { talent: '才能', value: '価値観', passion: '情熱' };
  const EN_LABELS = { talent: 'Talent', value: 'Values', passion: 'Passion' };

  return (
    <div
      className="pdf-section"
      style={{
        background: bg,
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
        <div style={{ background: VENN_COLORS[type].bg, borderRadius: 14, padding: '24px 16px', marginBottom: 12, border: `1px solid ${main}10` }}>
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
  // hover states removed for McKinsey simplicity

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
        await navigator.share({ title: '才覚領域 Architecture', text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (e) { /* user cancelled */ }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#09090B' }}>

      {/* ── ヘッダー（no-print） ── */}
      <div
        className="no-print"
        style={{
          background: '#09090B',
          borderBottom: '1px solid #18181B',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', color: '#52525B', textTransform: 'uppercase' }}>
          Saikaku Architecture
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isAdmin && (
            <button onClick={onAdmin} style={{ fontSize: 12, color: '#A1A1AA', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>管理</button>
          )}
          {user.photoURL && (
            <img src={user.photoURL} alt={user.displayName} style={{ width: 24, height: 24, borderRadius: '50%' }} />
          )}
          <button
            onClick={async () => { await signOutUser(); onLogout(); }}
            style={{ fontSize: 12, color: '#52525B', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            ログアウト
          </button>
        </div>
      </div>

      {/* ── コンテンツ ── */}
      <div>
        <div className="pdf-content-wrapper" style={{ maxWidth: 1100, margin: '0 auto', padding: '56px 24px 16px' }}>

          {/* メインタイトル（スクリーンのみ） */}
          <div className="no-print" style={{ marginBottom: 48 }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.2em', color: '#52525B', textTransform: 'uppercase', margin: '0 0 12px' }}>
              Result
            </p>
            <h1 style={{
              fontFamily: "'Noto Serif JP', 'Times New Roman', serif",
              fontSize: 36,
              fontWeight: 900,
              color: '#FAFAFA',
              margin: '0 0 4px',
              letterSpacing: '-0.01em',
            }}>
              {result.name || user.displayName}
            </h1>
            <p style={{ fontSize: 15, color: '#52525B', margin: 0 }}>才覚領域 Architecture</p>
          </div>

          {/* 才覚領域 選択セクション（スクリーンのみ） */}
          <div
            className="no-print"
            style={{
              background: '#111113',
              borderRadius: 8,
              padding: '32px 28px',
              marginBottom: 24,
            }}
          >
            <h2 style={{
              fontFamily: "'Noto Serif JP', 'Times New Roman', serif",
              fontSize: 28, fontWeight: 900, color: '#FAFAFA',
              margin: '0 0 4px',
            }}>才覚領域</h2>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', color: '#52525B', textTransform: 'uppercase', margin: '0 0 24px' }}>
              Three Pattern Unique Ability
            </p>

            <div
              className="pdf-pattern-grid"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 8 }}
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
                      padding: '20px 22px',
                      borderRadius: 6,
                      border: isSelected ? '1px solid #FAFAFA' : '1px solid #27272A',
                      background: isSelected ? '#18181B' : '#09090B',
                      cursor: 'pointer',
                      textAlign: 'left',
                      position: 'relative',
                      transition: 'all 0.15s ease',
                      width: '100%',
                      boxSizing: 'border-box',
                      WebkitAppearance: 'none',
                      appearance: 'none',
                      outline: 'none',
                    }}
                  >
                    {isRecommended && (
                      <span style={{
                        position: 'absolute', top: -8, left: 16,
                        background: '#FAFAFA', color: '#09090B',
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 3,
                      }}>推奨</span>
                    )}
                    <p style={{ fontSize: 11, color: '#52525B', fontWeight: 600, letterSpacing: '0.15em', margin: '0 0 8px' }}>
                      PATTERN {i + 1}
                    </p>
                    <p style={{
                      fontFamily: "'Noto Serif JP', 'Times New Roman', serif",
                      fontSize: 18, fontWeight: 700,
                      color: isSelected ? '#FAFAFA' : '#71717A',
                      margin: 0, lineHeight: 1.5, transition: 'color 0.15s ease',
                      wordBreak: 'break-word',
                    }}>{option}</p>
                  </button>
                );
              })}
            </div>
            {saving && <p style={{ fontSize: 12, color: '#52525B', marginTop: 8 }}>保存中...</p>}
          </div>

          {/* 3列グリッド：価値観・才能・情熱（スクリーンのみ） */}
          <div
            className="no-print"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 8, marginBottom: 24 }}
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
                background: '#111113',
                borderRadius: 8,
                padding: '28px 24px',
                marginBottom: 8,
              }}
            >
              <h3 style={{ fontSize: 20, fontWeight: 800, color: '#FAFAFA', margin: '0 0 4px' }}>What</h3>
              <p style={{ fontSize: 13, color: '#52525B', margin: '0 0 20px' }}>才覚領域から自然に生まれること</p>
              {result.what.products?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#A1A1AA', margin: '0 0 8px' }}>具体的なサービス・活動</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {result.what.products.map((p, i) => (
                      <span key={i} style={{ padding: '4px 10px', borderRadius: 3, background: '#18181B', border: '1px solid #27272A', color: '#A1A1AA', fontSize: 12 }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ height: 1, background: '#18181B', margin: '0 0 16px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
                {result.what.actions && (
                  <div style={{ borderLeft: '2px solid #C4922A', padding: '12px 16px' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#C4922A', margin: '0 0 6px' }}>First Step</p>
                    <p style={{ fontSize: 13, color: '#A1A1AA', margin: 0, lineHeight: 1.7 }}>{result.what.actions}</p>
                  </div>
                )}
                {result.what.offer && (
                  <div style={{ borderLeft: '2px solid #C4922A', padding: '12px 16px' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#C4922A', margin: '0 0 6px' }}>To the World</p>
                    <p style={{ fontSize: 13, color: '#A1A1AA', margin: 0, lineHeight: 1.7 }}>{result.what.offer}</p>
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
                background: '#111113',
                borderRadius: 8,
                padding: '28px 24px',
                marginBottom: 24,
              }}
            >
              <h3 style={{ fontSize: 20, fontWeight: 800, color: '#FAFAFA', margin: '0 0 4px' }}>Reward</h3>
              <p style={{ fontSize: 13, color: '#52525B', margin: '0 0 20px' }}>あなたが得るもの</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 16 }}>
                {[
                  { key: 'economic',  label: '経済', color: '#C4922A' },
                  { key: 'social',    label: '社会', color: '#4A6FA5' },
                  { key: 'intrinsic', label: '内的', color: '#A84432' },
                ].map(({ key, label, color }) =>
                  result.reward[key] ? (
                    <div key={key} style={{ borderLeft: `2px solid ${color}`, padding: '12px 16px' }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#FAFAFA', margin: '0 0 4px' }}>{label}</p>
                      <p style={{ fontSize: 13, color: '#71717A', margin: 0, lineHeight: 1.7 }}>{result.reward[key]}</p>
                    </div>
                  ) : null
                )}
              </div>
              {result.reward.model && (
                <div style={{ background: '#09090B', border: '1px solid #18181B', borderRadius: 6, padding: '16px 20px' }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#FAFAFA', margin: '0 0 8px' }}>Reward Model</p>
                  <p style={{ fontSize: 14, color: '#A1A1AA', margin: 0, lineHeight: 1.8, fontWeight: 500 }}>{result.reward.model}</p>
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
      <div className="no-print" style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 24px 40px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={handlePdfDownload} style={{
          flex: 1, minWidth: 140, height: 44, borderRadius: 6, border: 'none',
          background: '#FAFAFA', color: '#09090B', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>PDF保存</button>
        <button onClick={handleShare} style={{
          flex: 1, minWidth: 140, height: 44, borderRadius: 6,
          border: '1px solid #27272A', background: 'none',
          color: '#71717A', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>{copied ? '✓ コピー済み' : 'シェア'}</button>
        <button onClick={onReset} style={{
          width: '100%', height: 44, borderRadius: 6,
          border: '1px solid #18181B', background: 'none',
          color: '#3F3F46', fontSize: 13, cursor: 'pointer',
        }}>もう一度解析する</button>
      </div>
    </div>
  );
}
