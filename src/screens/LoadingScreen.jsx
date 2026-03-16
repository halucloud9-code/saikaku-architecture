import { useState, useEffect } from 'react';

const STAGES = [
  { text: '才能を解析中', sub: 'Talent Analysis', color: '#C4922A', glow: 'rgba(196,146,42,0.15)' },
  { text: '価値観を解析中', sub: 'Values Analysis', color: '#4A6FA5', glow: 'rgba(74,111,165,0.15)' },
  { text: '情熱を解析中', sub: 'Passion Analysis', color: '#A84432', glow: 'rgba(168,68,50,0.15)' },
  { text: '才覚領域を統合中', sub: 'Integration', color: '#C4922A', glow: 'rgba(196,146,42,0.12)' },
];

export default function LoadingScreen() {
  const [stage, setStage] = useState(0);
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setStage((s) => (s + 1) % STAGES.length);
    }, 900);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 400);
    return () => clearInterval(dotInterval);
  }, []);

  const current = STAGES[stage];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(170deg, #0A0908 0%, #14110D 30%, #1A1610 60%, #0D0B09 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 背景グロー */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${current.glow} 0%, transparent 60%)`,
          transition: 'background 1s ease',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-15%',
          right: '-10%',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(74,111,165,0.04) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      {/* コンテンツ */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        {/* ロゴ */}
        <div
          style={{
            fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif",
            fontSize: 12,
            fontWeight: 600,
            color: 'rgba(196,146,42,0.5)',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            marginBottom: 56,
          }}
        >
          Unique Ability Architecture
        </div>

        {/* リングスピナー */}
        <div
          style={{
            position: 'relative',
            width: 100,
            height: 100,
            margin: '0 auto 44px',
          }}
        >
          {/* 外リング */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.04)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: `2px solid transparent`,
              borderTopColor: current.color,
              borderRightColor: `${current.color}40`,
              animation: 'spin 0.9s linear infinite',
              transition: 'border-color 0.6s ease',
            }}
          />
          {/* 内リング */}
          <div
            style={{
              position: 'absolute',
              inset: 14,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.03)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 14,
              borderRadius: '50%',
              border: `1px solid transparent`,
              borderBottomColor: `${current.color}60`,
              borderLeftColor: `${current.color}20`,
              animation: 'spin 1.4s linear infinite reverse',
              transition: 'border-color 0.6s ease',
            }}
          />
          {/* 中央ドット */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: current.color,
              boxShadow: `0 0 20px ${current.color}60`,
              transition: 'all 0.6s ease',
            }}
          />
        </div>

        {/* ステージテキスト */}
        <div
          key={stage}
          style={{ animation: 'fadeIn 0.4s ease' }}
        >
          <div
            style={{
              fontFamily: "'Noto Serif JP', Georgia, serif",
              fontSize: 22,
              fontWeight: 700,
              color: '#F5F0E8',
              letterSpacing: '0.1em',
              marginBottom: 8,
            }}
          >
            {current.text}<span style={{ color: current.color }}>{dots}</span>
          </div>
          <div
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 11,
              fontWeight: 600,
              color: `${current.color}80`,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
            }}
          >
            {current.sub}
          </div>
        </div>

        {/* プログレスバー */}
        <div style={{ marginTop: 48, width: 240, margin: '48px auto 0' }}>
          <div
            style={{
              display: 'flex',
              gap: 6,
              alignItems: 'center',
            }}
          >
            {STAGES.map((s, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  background: i <= stage
                    ? `linear-gradient(90deg, ${current.color}, ${current.color}80)`
                    : 'rgba(255,255,255,0.06)',
                  transition: 'all 0.5s ease',
                  boxShadow: i === stage ? `0 0 8px ${current.color}40` : 'none',
                }}
              />
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 10,
            }}
          >
            {STAGES.map((s, i) => (
              <div
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: i <= stage ? current.color : 'rgba(255,255,255,0.08)',
                  transition: 'all 0.5s ease',
                  boxShadow: i === stage ? `0 0 10px ${current.color}60` : 'none',
                }}
              />
            ))}
          </div>
        </div>

        {/* 装飾ライン */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, margin: '40px 0 24px' }}>
          <div style={{ width: 40, height: 1, background: 'linear-gradient(90deg, transparent, rgba(196,146,42,0.2))' }} />
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(196,146,42,0.3)' }} />
          <div style={{ width: 40, height: 1, background: 'linear-gradient(90deg, rgba(196,146,42,0.2), transparent)' }} />
        </div>

        {/* 補足テキスト */}
        <p
          style={{
            fontSize: 13,
            color: '#6A6050',
            textAlign: 'center',
            lineHeight: 2,
            margin: 0,
            letterSpacing: '0.02em',
          }}
        >
          Claude AIがあなたの才覚領域を分析しています
          <br />
          <span style={{ fontSize: 11, color: '#4A4030' }}>
            そのままお待ちください（約30秒）
          </span>
        </p>
      </div>
    </div>
  );
}
