import { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db, signOutUser } from '../firebase';
import { computePcts, CHART_COLORS } from '../utils/chartUtils';

const COLORS = {
  ...CHART_COLORS,
  bg:     { value: '#EEF2F8',   talent: '#FBF5EB',   passion: '#F8EEEE'   },
  main:   { value: '#4A6FA5',   talent: '#C4922A',   passion: '#A84432'   },
  border: { value: '#4A6FA540', talent: '#C4922A40', passion: '#A8443240' },
};

// カテゴリ別 Venn ダーク配色
const VENN_COLORS = {
  value:   { bg: '#1a1a2e', c1: '#1a3a6b', c2: '#2e6bc4', c3: '#7eb8f7' },
  talent:  { bg: '#1a1500', c1: '#8b5e00', c2: '#c4922a', c3: '#f0c96e' },
  passion: { bg: '#1a0a0a', c1: '#7a1a1a', c2: '#c0392b', c3: '#e8847a' },
};

// ドーナツチャート色
const DONUT_COLORS = {
  value:   ['#2e6bc4', '#1a3a6b', '#7eb8f7'],
  talent:  ['#c4922a', '#8b5e00', '#f0c96e'],
  passion: ['#c0392b', '#7a1a1a', '#e8847a'],
};

// ── メインベン図 SVG（サマリーカード用）─────────────────────────────────
// 配置：上=価値観(青)、左下=情熱(赤)、右下=才能(金)
function VennSvg({ width = 240, height = 200, className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 280 232"
      width={width}
      height={height}
      style={{ display: 'inline-block', overflow: 'visible', maxWidth: '100%' }}
    >
      {/* 価値観（上・青 #4A6FA5） */}
      <circle cx="140" cy="78"  r="70" fill="#4A6FA5" fillOpacity="0.75" stroke="#4A6FA5" strokeOpacity="0.90" strokeWidth="1.5"/>
      {/* 情熱（左下・赤 #A84432） */}
      <circle cx="98"  cy="156" r="70" fill="#A84432" fillOpacity="0.75" stroke="#A84432" strokeOpacity="0.90" strokeWidth="1.5"/>
      {/* 才能（右下・金 #C4922A） */}
      <circle cx="182" cy="156" r="70" fill="#C4922A" fillOpacity="0.75" stroke="#C4922A" strokeOpacity="0.90" strokeWidth="1.5"/>
      {/* 中央交差ハイライト */}
      <circle cx="140" cy="128" r="22" fill="#FFD700" fillOpacity="0.55" stroke="#FFD700" strokeOpacity="0.80" strokeWidth="1.5"/>
      {/* ラベル：価値観（上） */}
      <text x="140" y="9"   textAnchor="middle" fill="#FDFCFA" fontSize="18" fontWeight="700" letterSpacing="1">価値観</text>
      <text x="140" y="23"  textAnchor="middle" fill="#FDFCFA" fontSize="9"  fillOpacity="0.85" letterSpacing="0.5">VALUE</text>
      {/* ラベル：情熱（左下） */}
      <text x="34"  y="218" textAnchor="middle" fill="#FDFCFA" fontSize="18" fontWeight="700">情熱</text>
      <text x="34"  y="230" textAnchor="middle" fill="#FDFCFA" fontSize="9"  fillOpacity="0.85">PASSION</text>
      {/* ラベル：才能（右下） */}
      <text x="246" y="218" textAnchor="middle" fill="#FDFCFA" fontSize="18" fontWeight="700">才能</text>
      <text x="246" y="230" textAnchor="middle" fill="#FDFCFA" fontSize="9"  fillOpacity="0.85">TALENT</text>
      {/* 中央アイコン */}
      <text x="140" y="133" textAnchor="middle" fill="#FDFCFA" fontSize="16" fontWeight="700">✦</text>
    </svg>
  );
}

// ── カテゴリ別ベン図（各セクション用：軸名動的・ダーク背景）──────────────
// 配置：axis1=上、axis2=左下、axis3=右下（メインVennと同じ三角配置）
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
      {/* ベン図 SVG + 凡例（絶対配置） */}
      <div style={{ position: 'relative', paddingLeft: 38, paddingRight: 38, paddingBottom: 28, textAlign: 'center', overflow: 'hidden' }}>
        <svg
          viewBox="0 0 280 232"
          width={160}
          height={132}
          style={{ display: 'inline-block', overflow: 'visible', maxWidth: '100%' }}
        >
          {/* axis1（上） */}
          <circle cx="140" cy="78"  r="70" fill={c1} fillOpacity="0.75" stroke={c1} strokeOpacity="0.90" strokeWidth="1.5"/>
          {/* axis2（左下） */}
          <circle cx="98"  cy="156" r="70" fill={c2} fillOpacity="0.75" stroke={c2} strokeOpacity="0.90" strokeWidth="1.5"/>
          {/* axis3（右下） */}
          <circle cx="182" cy="156" r="70" fill={c3} fillOpacity="0.75" stroke={c3} strokeOpacity="0.90" strokeWidth="1.5"/>
          {/* 中央 */}
          <circle cx="140" cy="128" r="18" fill="#FFFFFF" fillOpacity="0.15" stroke="#FFFFFF" strokeOpacity="0.25" strokeWidth="1"/>
          {/* 中央 ✦ */}
          <text x="140" y="133" textAnchor="middle" fill="#FDFCFA" fontSize="14" fontWeight="700">✦</text>
        </svg>

        {/* 凡例 axis1（左） */}
        <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#FDFCFA', textAlign: 'center', width: 34 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: c1, margin: '0 auto 3px' }} />
          <span style={{ display: 'block', wordBreak: 'break-all', lineHeight: 1.2 }}>{ax1?.name}</span>
        </div>

        {/* 凡例 axis2（下中央） */}
        <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: '#FDFCFA', textAlign: 'center', whiteSpace: 'nowrap' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: c2, margin: '0 auto 3px' }} />
          <span>{ax2?.name}</span>
        </div>

        {/* 凡例 axis3（右） */}
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
  const total = axes.reduce((s, a) => s + (a.percentage || 0), 0) || 1;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {axes.map((axis, i) => {
        const pct = (axis.percentage || 0) / total;
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
        border: `1px solid ${color}40`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 12,
        marginBottom: 10,
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
      }}
    >
      <div style={{ background: `${color}35`, padding: '14px 16px 12px' }}>
        {/* 軸名 + パーセント */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div>
            <span style={{ fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif", fontSize: 18, fontWeight: 700, color: `${color}FF` }}>
              {axis.name}
            </span>
            <span style={{ fontSize: 11, color: `${color}AA`, marginLeft: 6, fontStyle: 'italic', letterSpacing: '0.05em' }}>
              {axis.english || axis.en}
            </span>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, overflow: 'hidden' }}>
            <span style={{ display: 'block', fontSize: 26, fontWeight: 700, color, fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif", lineHeight: 1 }}>
              {pct}%
            </span>
            <span style={{ fontSize: 14, color: '#5A5040', letterSpacing: '0.05em' }}>
              {allItems.length} 要素
            </span>
          </div>
        </div>

        <p style={{ fontSize: 14, color: '#2A2010', margin: '0 0 10px', lineHeight: 1.6 }}>
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
                background: `${color}22`,
                border: `1px solid ${color}CC`,
                color,
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
        borderRadius: 14,
        border: '1px solid #D4C9B0',
        borderTop: `4px solid ${main}`,
        padding: '24px 20px',
        boxShadow: '0 2px 8px rgba(42,37,32,0.06)',
        overflow: 'hidden',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
      }}
    >
      {/* セクションヘッダー */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div
          style={{
            display: 'inline-block',
            padding: '4px 16px',
            borderRadius: 100,
            background: bg,
            border: `1px solid ${border}`,
            marginBottom: 12,
          }}
        >
          <div>
            <span style={{ fontSize: 16, fontWeight: 800, color: main, letterSpacing: '0.1em' }}>
              {LABELS[type]}
            </span>
            <div style={{ fontSize: 11, opacity: 0.6, fontStyle: 'italic', color: main, marginTop: 2 }}>
              {EN_LABELS[type]}
            </div>
          </div>
        </div>

        {/* ドーナツチャート */}
        <div style={{ background: VENN_COLORS[type].bg, borderRadius: 12, padding: '24px 16px', marginBottom: 12 }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 280, margin: '0 auto', height: 320 }}>
            {axesArray[0] && (
              <div style={{ position: 'absolute', top: 0, left: 0, textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: donutColors[0], display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: 18, color: '#FDFCFA', fontWeight: 700 }}>{axesArray[0].name}</span>
                </div>
                <div className="donut-pct" style={{ fontSize: 36, fontWeight: 900, color: '#ffffff', lineHeight: 1, paddingLeft: 16, fontFamily: "'Inter', Arial, sans-serif" }}>{axesArray[0].percentage}%</div>
              </div>
            )}
            {axesArray[1] && (
              <div style={{ position: 'absolute', top: 0, right: 0, textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 18, color: '#FDFCFA', fontWeight: 700 }}>{axesArray[1].name}</span>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: donutColors[1], display: 'inline-block', flexShrink: 0 }} />
                </div>
                <div className="donut-pct" style={{ fontSize: 36, fontWeight: 900, color: '#ffffff', lineHeight: 1, paddingRight: 16, fontFamily: "'Inter', Arial, sans-serif" }}>{axesArray[1].percentage}%</div>
              </div>
            )}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
              <DonutChart axes={axesArray} colors={donutColors} size={220} />
            </div>
            {axesArray[2] && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, textAlign: 'left' }}>
                <div className="donut-pct" style={{ fontSize: 36, fontWeight: 900, color: '#ffffff', lineHeight: 1, paddingLeft: 16, marginBottom: 2, fontFamily: "'Inter', Arial, sans-serif" }}>{axesArray[2].percentage}%</div>
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
    <div style={{ minHeight: '100vh', background: '#F5F0E8' }}>

      {/* ── ヘッダー（no-print） ── */}
      <div
        className="no-print"
        style={{
          background: '#FDFCFA',
          borderBottom: '1px solid #D4C9B0',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <span style={{ fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif", fontSize: 16, fontWeight: 700, color: '#2A2520' }}>
          才覚領域 Architecture
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isAdmin && (
            <button onClick={onAdmin} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D4C9B0', background: 'transparent', color: '#7A7060', fontSize: 13, cursor: 'pointer' }}>
              管理画面
            </button>
          )}
          {user.photoURL && (
            <img src={user.photoURL} alt={user.displayName} style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid #D4C9B0' }} />
          )}
          <button
            onClick={async () => { await signOutUser(); onLogout(); }}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D4C9B0', background: 'transparent', color: '#7A7060', fontSize: 13, cursor: 'pointer' }}
          >
            ログアウト
          </button>
        </div>
      </div>

      {/* ── コンテンツ ── */}
      <div style={{ background: '#F5F0E8' }}>
        <div className="pdf-content-wrapper" style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 24px 16px' }}>

          {/* グラデーションバー（スクリーンのみ） */}
          <div
            className="no-print"
            style={{
              height: 5,
              borderRadius: 3,
              background: 'linear-gradient(to right, #1a3a6b, #2e6bc4, #4A6FA5, #C4922A, #A84432, #c0392b)',
              marginBottom: 36,
              boxShadow: '0 2px 12px rgba(196,146,42,0.25)',
            }}
          />

          {/* メインタイトル（スクリーンのみ） */}
          <div className="no-print" style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{
              display: 'inline-flex',
              background: 'linear-gradient(135deg, #C4922A, #4A6FA5, #A84432)',
              borderRadius: 12,
              padding: '10px 32px',
              marginBottom: 20,
              minWidth: 200,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{
                fontSize: 14,
                fontWeight: 800,
                color: '#ffffff',
                letterSpacing: '0.2em',
                fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif",
              }}>Three Pattern Unique Ability</span>
            </div>
            <h1 style={{
              fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif",
              fontSize: 32,
              fontWeight: 700,
              color: '#2A2520',
              margin: '0 0 4px',
            }}>
              {result.name || user.displayName}
            </h1>
            <div style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#2A2520',
              letterSpacing: '0.05em',
              marginBottom: 4,
              fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif",
            }}>才覚領域</div>
            <div style={{
              fontSize: 18,
              fontWeight: 400,
              color: '#7A7060',
              letterSpacing: '0.05em',
              fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif",
            }}>Architecture</div>
          </div>

          {/* 才覚領域 選択セクション（スクリーンのみ） */}
          <div
            className="no-print"
            style={{
              background: '#FDFCFA',
              borderRadius: 16,
              border: '1px solid #D4C9B0',
              padding: '32px 36px',
              marginBottom: 32,
              boxShadow: '0 2px 12px rgba(42,37,32,0.06)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 40, fontWeight: 900, color: '#2A2520', letterSpacing: '0.08em', lineHeight: 1.2, fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif" }}>
                才覚領域
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', letterSpacing: '0.12em', marginTop: 12, display: 'inline-block', background: 'linear-gradient(135deg, #C4922A, #4A6FA5, #A84432)', borderRadius: 12, padding: '10px 28px', fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.5, textAlign: 'center' }}>
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
                      borderRadius: 12,
                      border: isSelected ? '2px solid #C4922A' : '1px solid #e0d9d0',
                      background: isSelected ? '#1a1a1a' : '#ffffff',
                      boxShadow: isSelected ? '0 4px 20px rgba(196,146,42,0.3)' : 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      position: 'relative',
                      transition: 'all 0.2s ease',
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
                      <div style={{ position: 'absolute', top: -10, left: 16, background: '#C4922A', color: '#FDFCFA', fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 100, letterSpacing: '0.05em' }}>
                        ★ 推奨
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: isSelected ? 'rgba(255,255,255,0.5)' : '#7A7060', fontWeight: 700, letterSpacing: '0.15em', marginBottom: 10, opacity: isSelected ? 1 : 0.5 }}>
                      PATTERN {i + 1}
                    </div>
                    <p style={{ fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif", fontSize: 20, fontWeight: 700, color: isSelected ? '#ffffff' : '#1a1a1a', margin: 0, lineHeight: 1.5, wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'normal' }}>
                      {option}
                    </p>
                  </button>
                );
              })}
            </div>
            {saving && <p style={{ textAlign: 'center', fontSize: 12, color: '#7A7060', marginTop: 12 }}>保存中...</p>}
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
                background: '#1A1200',
                borderRadius: 16,
                border: '1px solid #3D2E00',
                borderTop: '4px solid #F0C96E',
                padding: '28px 32px',
                marginBottom: 20,
                boxShadow: '0 6px 24px rgba(0,0,0,0.3)',
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 4, height: 24, background: '#F0C96E', borderRadius: 2 }} />
                <div>
                  <span style={{ fontSize: 22, fontWeight: 800, color: '#FFD700', letterSpacing: '0.15em' }}>What</span>
                  <span style={{ fontSize: 13, color: '#C8C0B0', marginLeft: 10 }}>才覚領域から自然に生まれること</span>
                </div>
              </div>
              {result.what.products?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 16, color: '#ffffff', margin: '0 0 10px', fontWeight: 700, letterSpacing: '0.05em' }}>具体的なサービス・活動</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {result.what.products.map((p, i) => (
                      <span key={i} style={{ padding: '3px 12px', borderRadius: 100, background: '#3D2E00', border: '1px solid rgba(255,255,255,0.3)', color: '#ffffff', fontSize: 12, fontWeight: 500, fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif" }}>
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ height: 1, background: '#3D2E00', margin: '0 0 16px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                {result.what.actions && (
                  <div style={{ background: '#2A1F00', border: '1px solid #3D2E00', borderLeft: '3px solid #FFD700', borderRadius: 10, padding: '10px 18px' }}>
                    <p style={{ fontSize: 17, fontWeight: 800, color: '#FFD700', letterSpacing: '0.1em', margin: '0 0 8px' }}>▶ First Step</p>
                    <p style={{ fontSize: 16, color: '#E8E0CC', margin: 0, lineHeight: 1.8 }}>{result.what.actions}</p>
                  </div>
                )}
                {result.what.offer && (
                  <div style={{ background: '#2A1F00', border: '1px solid #3D2E00', borderLeft: '3px solid #FFD700', borderRadius: 10, padding: '10px 18px' }}>
                    <p style={{ fontSize: 17, fontWeight: 800, color: '#FFD700', letterSpacing: '0.1em', margin: '0 0 8px' }}>▶ To the World</p>
                    <p style={{ fontSize: 16, color: '#E8E0CC', margin: 0, lineHeight: 1.8 }}>{result.what.offer}</p>
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
                background: 'linear-gradient(135deg, #1A2C28 0%, #1C1A17 100%)',
                borderRadius: 16,
                border: '1px solid #3E8B8030',
                padding: '28px 32px',
                marginBottom: 32,
                boxShadow: '0 6px 28px rgba(20,14,8,0.20)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 4, height: 24, background: 'linear-gradient(to bottom, #3ECFBE, #5275A8)', borderRadius: 2 }} />
                <div>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#3ECFBE', letterSpacing: '0.15em' }}>Reward</span>
                  <span style={{ fontSize: 13, color: '#6A9A94', marginLeft: 10 }}>あなたが得るもの</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 14 }}>
                {[
                  { key: 'economic',  label: '💰 経済', color: '#D4922A' },
                  { key: 'social',    label: '🌍 社会', color: '#7AA8D0' },
                  { key: 'intrinsic', label: '✨ 内的', color: '#A090D8' },
                ].map(({ key, label, color }) =>
                  result.reward[key] ? (
                    <div key={key} style={{ background: `${color}16`, border: `1px solid ${color}35`, borderLeft: `3px solid ${color}`, borderRadius: 10, padding: '14px 16px', overflow: 'hidden', wordBreak: 'break-all', whiteSpace: 'normal' }}>
                      <p style={{ fontSize: 20, fontWeight: 800, color, margin: '0 0 8px', letterSpacing: '0.08em' }}>{label}</p>
                      <p style={{ fontSize: 13, color: '#C8C0B4', margin: 0, lineHeight: 1.8, overflow: 'hidden', wordBreak: 'break-all', whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical' }}>{result.reward[key]}</p>
                    </div>
                  ) : null
                )}
              </div>
              {result.reward.model && (
                <div style={{ background: 'rgba(62,143,128,0.12)', border: '1px solid #3E8B8050', borderRadius: 10, padding: '18px 22px' }}>
                  <p style={{ fontSize: 22, fontWeight: 900, color: '#3ECFBE', letterSpacing: '0.15em', margin: '0 0 10px' }}>Reward Model</p>
                  <p style={{ fontSize: 17, color: '#F0EAE0', margin: 0, lineHeight: 1.9, fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif", fontWeight: 600, overflow: 'hidden', wordBreak: 'break-all', whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}>
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
                return (
                  <div key={tp} style={{ textAlign: 'center', flexShrink: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <DonutChart axes={arr} colors={dotColor} size={80} />
                    <div style={{ fontSize: 10, color: '#ffffff', marginTop: 2, fontWeight: 700, marginBottom: 3 }}>{label}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
                      {arr.map((axis, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <span style={{ fontSize: 9, color: dotColor[i], flexShrink: 0 }}>☀︎</span>
                          <span style={{ fontSize: 9, color: '#ffffff', fontWeight: 500, lineHeight: 1.2, fontFamily: "'Inter', Arial, sans-serif" }}>{axis.name}</span>
                          <span style={{ fontSize: 9, color: '#ffffff', fontWeight: 700, fontFamily: "'Inter', Arial, sans-serif" }}>{axis.percentage}%</span>
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
          style={{
            width: 'calc(50% - 6px)',
            height: 52,
            boxSizing: 'border-box',
            borderRadius: 10,
            border: 'none',
            background: '#2A2520',
            color: '#FDFCFA',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
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
          style={{
            width: 'calc(50% - 6px)',
            height: 52,
            boxSizing: 'border-box',
            borderRadius: 10,
            border: '2px solid #2A2520',
            background: 'transparent',
            color: '#2A2520',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
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
            borderRadius: 10,
            border: '1px solid #D4C9B0',
            background: 'transparent',
            color: '#7A7060',
            fontSize: 16,
            fontWeight: 400,
            cursor: 'pointer',
          }}
        >
          もう一度解析する
        </button>
      </div>
    </div>
  );
}
