import { useState } from 'react';
import { signOutUser } from '../../firebase';
import { UAAM_AXES } from '../../data/uaam_questions';

// レーダーチャート SVG コンポーネント
function RadarChart({ data, labels, colors, size = 260, title }) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.38;
  const levels = 5;
  const count = data.length;

  const getPoint = (index, value, maxVal = 100) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const r = (value / maxVal) * radius;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  const gridLines = [];
  for (let l = 1; l <= levels; l++) {
    const points = [];
    for (let i = 0; i < count; i++) {
      const p = getPoint(i, (l / levels) * 100);
      points.push(`${p.x},${p.y}`);
    }
    gridLines.push(points.join(' '));
  }

  const dataPoints = data.map((d, i) => {
    const p = getPoint(i, d);
    return `${p.x},${p.y}`;
  }).join(' ');

  return (
    <div style={{ textAlign: 'center' }}>
      {title && (
        <div style={{ fontSize: 14, fontWeight: 700, color: '#2A2520', marginBottom: 8 }}>{title}</div>
      )}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* グリッド */}
        {gridLines.map((pts, i) => (
          <polygon key={i} points={pts} fill="none" stroke="#D4C9B040" strokeWidth="0.5" />
        ))}
        {/* 軸線 */}
        {data.map((_, i) => {
          const p = getPoint(i, 100);
          return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#D4C9B030" strokeWidth="0.5" />;
        })}
        {/* データ */}
        <polygon points={dataPoints} fill={`${colors[0]}30`} stroke={colors[0]} strokeWidth="2" />
        {data.map((d, i) => {
          const p = getPoint(i, d);
          return <circle key={i} cx={p.x} cy={p.y} r={4} fill={colors[i % colors.length]} />;
        })}
        {/* ラベル */}
        {labels.map((label, i) => {
          const p = getPoint(i, 120);
          return (
            <text
              key={i}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="10"
              fontWeight="600"
              fill="#2A2520"
            >
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// バロメーター（水平ゲージ）
function Barometer({ label, value, max, color }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#2A2520' }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: 10, background: '#E8E2D8', borderRadius: 5, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: `linear-gradient(to right, ${color}80, ${color})`,
            borderRadius: 5,
            transition: 'width 0.5s ease',
          }}
        />
      </div>
    </div>
  );
}

// 4象限マトリックス
function QuadrantMatrix({ scores }) {
  const asp = scores.mindset?.percentage || 0;
  const kno = scores.literacy?.percentage || 0;
  const ski = scores.competency?.percentage || 0;
  const imp = scores.impact?.percentage || 0;

  // 志×知 = ビジョン象限, 技×衝 = 実行象限
  const visionX = kno;
  const visionY = asp;
  const execX = imp;
  const execY = ski;

  const size = 240;
  const pad = 30;
  const inner = size - pad * 2;

  const renderQuadrant = (title, xLabel, yLabel, xVal, yVal, color) => {
    const px = pad + (xVal / 100) * inner;
    const py = pad + ((100 - yVal) / 100) * inner;

    return (
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color, textAlign: 'center', marginBottom: 6 }}>{title}</div>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', margin: '0 auto' }}>
          {/* 背景4象限 */}
          <rect x={pad} y={pad} width={inner / 2} height={inner / 2} fill="#4A6FA508" />
          <rect x={pad + inner / 2} y={pad} width={inner / 2} height={inner / 2} fill="#2E8B5708" />
          <rect x={pad} y={pad + inner / 2} width={inner / 2} height={inner / 2} fill="#C4922A08" />
          <rect x={pad + inner / 2} y={pad + inner / 2} width={inner / 2} height={inner / 2} fill="#A8443208" />
          {/* 十字線 */}
          <line x1={pad + inner / 2} y1={pad} x2={pad + inner / 2} y2={pad + inner} stroke="#D4C9B060" strokeWidth="1" strokeDasharray="4" />
          <line x1={pad} y1={pad + inner / 2} x2={pad + inner} y2={pad + inner / 2} stroke="#D4C9B060" strokeWidth="1" strokeDasharray="4" />
          {/* 枠 */}
          <rect x={pad} y={pad} width={inner} height={inner} fill="none" stroke="#D4C9B040" strokeWidth="1" />
          {/* ポイント */}
          <circle cx={px} cy={py} r={8} fill={color} fillOpacity="0.9" stroke="#fff" strokeWidth="2" />
          {/* 軸ラベル */}
          <text x={size / 2} y={size - 4} textAnchor="middle" fontSize="10" fill="#7A7060">{xLabel}</text>
          <text x={4} y={size / 2} textAnchor="middle" fontSize="10" fill="#7A7060" transform={`rotate(-90, 4, ${size / 2})`}>{yLabel}</text>
        </svg>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
      {renderQuadrant('ビジョン象限', '知 (Literacy)', '志 (MindSet)', visionX, visionY, '#4A6FA5')}
      {renderQuadrant('実行象限', '衝 (Impact)', '技 (Competency)', execX, execY, '#A84432')}
    </div>
  );
}

export default function UAAMResultScreen({ user, result, isAdmin, onReset, onAdmin, onLogout }) {
  const { scores, analysis } = result;

  const axisColors = UAAM_AXES.map((a) => a.color);

  // メインレーダー: 4軸
  const mainRadarData = UAAM_AXES.map((a) => scores[a.key]?.percentage || 0);
  const mainRadarLabels = UAAM_AXES.map((a) => `${a.label}(${a.english})`);

  // サブ項目レーダー（各軸ごと）
  const subRadars = UAAM_AXES.map((axis) => {
    const subs = scores[axis.key]?.subs || {};
    return {
      axis,
      data: axis.subs.map((s) => Math.round(((subs[s.key] || 0) / 15) * 100)),
      labels: axis.subs.map((s) => s.label),
      subKeys: axis.subs.map((s) => s.key),
    };
  });

  return (
    <div style={{ minHeight: '100vh', background: '#F5F0E8' }}>
      {/* ヘッダー */}
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
        <span
          style={{
            fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif",
            fontSize: 16,
            fontWeight: 700,
            color: '#2A2520',
          }}
        >
          UAAM 診断結果
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isAdmin && (
            <button
              onClick={onAdmin}
              style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D4C9B0', background: 'transparent', color: '#7A7060', fontSize: 13, cursor: 'pointer' }}
            >
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

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
        {/* タイトル */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #4A6FA5, #2E8B57, #C4922A, #A84432)',
              borderRadius: 12,
              padding: '8px 28px',
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.15em' }}>
              UAAM — Universal Ability Assessment Model
            </span>
          </div>
          <h1
            style={{
              fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif",
              fontSize: 28,
              fontWeight: 700,
              color: '#2A2520',
              margin: '0 0 4px',
            }}
          >
            {user.displayName}
          </h1>
          {analysis?.type_name && (
            <div style={{ fontSize: 22, fontWeight: 800, color: '#C4922A', marginTop: 8 }}>
              {analysis.type_name}
            </div>
          )}
          {analysis?.type_description && (
            <div style={{ fontSize: 14, color: '#7A7060', marginTop: 4 }}>
              {analysis.type_description}
            </div>
          )}
        </div>

        {/* グラデーションバー */}
        <div style={{ height: 4, borderRadius: 2, background: 'linear-gradient(to right, #4A6FA5, #2E8B57, #C4922A, #A84432)', marginBottom: 32 }} />

        {/* メインレーダーチャート */}
        <div
          style={{
            background: '#FDFCFA',
            borderRadius: 16,
            border: '1px solid #D4C9B0',
            padding: '24px',
            marginBottom: 24,
            boxShadow: '0 2px 8px rgba(42,37,32,0.06)',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: '#2A2520', textAlign: 'center', marginBottom: 16 }}>
            4軸バランス
          </div>
          <RadarChart
            data={mainRadarData}
            labels={mainRadarLabels}
            colors={axisColors}
            size={280}
          />
        </div>

        {/* バロメーター */}
        <div
          style={{
            background: '#FDFCFA',
            borderRadius: 16,
            border: '1px solid #D4C9B0',
            padding: '24px',
            marginBottom: 24,
            boxShadow: '0 2px 8px rgba(42,37,32,0.06)',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: '#2A2520', marginBottom: 16 }}>
            軸別スコア
          </div>
          {UAAM_AXES.map((axis) => (
            <Barometer
              key={axis.key}
              label={`${axis.label}（${axis.english}）`}
              value={scores[axis.key]?.total || 0}
              max={scores[axis.key]?.max || 60}
              color={axis.color}
            />
          ))}
        </div>

        {/* サブ項目レーダーチャート */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          {subRadars.map(({ axis, data, labels }) => (
            <div
              key={axis.key}
              style={{
                background: '#FDFCFA',
                borderRadius: 16,
                border: '1px solid #D4C9B0',
                borderTop: `4px solid ${axis.color}`,
                padding: '20px',
                boxShadow: '0 2px 8px rgba(42,37,32,0.06)',
              }}
            >
              <RadarChart
                data={data}
                labels={labels}
                colors={[axis.color, axis.color, axis.color, axis.color]}
                size={220}
                title={`${axis.label}（${axis.english}）`}
              />
              {/* サブ項目バロメーター */}
              <div style={{ marginTop: 12 }}>
                {labels.map((label, i) => (
                  <Barometer key={label} label={label} value={data[i]} max={100} color={axis.color} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 4象限マトリックス */}
        <div
          style={{
            background: '#FDFCFA',
            borderRadius: 16,
            border: '1px solid #D4C9B0',
            padding: '24px',
            marginBottom: 24,
            boxShadow: '0 2px 8px rgba(42,37,32,0.06)',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: '#2A2520', textAlign: 'center', marginBottom: 16 }}>
            4象限マトリックス
          </div>
          <QuadrantMatrix scores={scores} />
          {analysis?.quadrant_analysis && (
            <div style={{ marginTop: 20 }}>
              {Object.entries(analysis.quadrant_analysis).map(([key, text]) => (
                <div
                  key={key}
                  style={{
                    background: '#F5F0E8',
                    borderRadius: 10,
                    padding: '12px 16px',
                    marginBottom: 8,
                    fontSize: 13,
                    color: '#2A2520',
                    lineHeight: 1.7,
                  }}
                >
                  <span style={{ fontWeight: 700, color: key.includes('vision') ? '#4A6FA5' : '#A84432' }}>
                    {key.includes('vision') ? 'ビジョン象限：' : '実行象限：'}
                  </span>
                  {text}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI分析 */}
        {analysis && (
          <>
            {/* 軸別分析 */}
            <div
              style={{
                background: '#2A2520',
                borderRadius: 16,
                padding: '28px 24px',
                marginBottom: 24,
                boxShadow: '0 4px 16px rgba(42,37,32,0.15)',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800, color: '#FFD700', letterSpacing: '0.1em', marginBottom: 20 }}>
                AI Analysis
              </div>
              {analysis.axis_analysis && Object.entries(analysis.axis_analysis).map(([key, text]) => {
                const axis = UAAM_AXES.find((a) => a.key === key);
                if (!axis) return null;
                return (
                  <div
                    key={key}
                    style={{
                      background: `${axis.color}18`,
                      borderLeft: `3px solid ${axis.color}`,
                      borderRadius: 8,
                      padding: '12px 16px',
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, color: axis.color, marginBottom: 4 }}>
                      {axis.label}（{axis.english}）
                    </div>
                    <p style={{ fontSize: 13, color: '#D4C9B0', margin: 0, lineHeight: 1.7 }}>{text}</p>
                  </div>
                );
              })}
            </div>

            {/* ナラティブ */}
            <div
              style={{
                background: 'linear-gradient(135deg, #1A2C28 0%, #1C1A17 100%)',
                borderRadius: 16,
                padding: '28px 24px',
                marginBottom: 24,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800, color: '#3ECFBE', letterSpacing: '0.1em', marginBottom: 16 }}>
                Narrative
              </div>
              <p style={{ fontSize: 15, color: '#F0EAE0', lineHeight: 1.9, margin: 0 }}>
                {analysis.narrative}
              </p>
            </div>

            {/* 強み・成長ポイント */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
              {analysis.strengths?.length > 0 && (
                <div
                  style={{
                    background: '#FDFCFA',
                    borderRadius: 16,
                    border: '1px solid #D4C9B0',
                    borderTop: '4px solid #2E8B57',
                    padding: '20px 24px',
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#2E8B57', marginBottom: 12 }}>
                    Strengths
                  </div>
                  {analysis.strengths.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                      <span style={{ color: '#2E8B57', fontWeight: 700, flexShrink: 0 }}>●</span>
                      <span style={{ fontSize: 14, color: '#2A2520', lineHeight: 1.6 }}>{s}</span>
                    </div>
                  ))}
                </div>
              )}
              {analysis.growth_areas?.length > 0 && (
                <div
                  style={{
                    background: '#FDFCFA',
                    borderRadius: 16,
                    border: '1px solid #D4C9B0',
                    borderTop: '4px solid #C4922A',
                    padding: '20px 24px',
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#C4922A', marginBottom: 12 }}>
                    Growth Areas
                  </div>
                  {analysis.growth_areas.map((g, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                      <span style={{ color: '#C4922A', fontWeight: 700, flexShrink: 0 }}>▲</span>
                      <span style={{ fontSize: 14, color: '#2A2520', lineHeight: 1.6 }}>{g}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* アクション提案 */}
            {analysis.action_suggestions?.length > 0 && (
              <div
                style={{
                  background: '#FDFCFA',
                  borderRadius: 16,
                  border: '1px solid #D4C9B0',
                  borderTop: '4px solid #4A6FA5',
                  padding: '20px 24px',
                  marginBottom: 24,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 700, color: '#4A6FA5', marginBottom: 12 }}>
                  Action Suggestions
                </div>
                {analysis.action_suggestions.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-start' }}>
                    <span
                      style={{
                        background: '#4A6FA5',
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 100,
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ fontSize: 14, color: '#2A2520', lineHeight: 1.6 }}>{a}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* アクションボタン */}
        <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => window.print()}
            style={{
              flex: 1,
              minWidth: 140,
              height: 52,
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
            印刷 / PDF保存
          </button>
          <button
            onClick={onReset}
            style={{
              flex: 1,
              minWidth: 140,
              height: 52,
              borderRadius: 10,
              border: '1px solid #D4C9B0',
              background: 'transparent',
              color: '#7A7060',
              fontSize: 16,
              fontWeight: 400,
              cursor: 'pointer',
            }}
          >
            もう一度診断する
          </button>
        </div>
      </div>
    </div>
  );
}
