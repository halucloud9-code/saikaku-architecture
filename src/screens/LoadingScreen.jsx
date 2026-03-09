import { useState, useEffect } from 'react';

const STAGES = [
  { text: '才能を解析中...', color: '#C4922A', bg: '#FBF4E8', accent: '#E8C87A' },
  { text: '価値観を解析中...', color: '#4A6FA5', bg: '#EBF0F8', accent: '#9AB5D8' },
  { text: '情熱を解析中...', color: '#A84432', bg: '#F8EDEA', accent: '#D89080' },
  { text: '才覚領域を統合中...', color: '#2A2520', bg: '#F5F0E8', accent: '#D4C9B0' },
];

export default function LoadingScreen() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStage((s) => (s + 1) % STAGES.length);
    }, 900);
    return () => clearInterval(interval);
  }, []);

  const current = STAGES[stage];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: current.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.6s ease',
        padding: 24,
      }}
    >
      {/* ロゴ */}
      <div
        style={{
          fontFamily: 'Shippori Mincho, serif',
          fontSize: 13,
          fontWeight: 600,
          color: current.color,
          letterSpacing: '0.2em',
          marginBottom: 48,
          opacity: 0.6,
        }}
      >
        才覚領域 Architecture
      </div>

      {/* スピナー */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          border: `4px solid ${current.accent}`,
          borderTopColor: current.color,
          animation: 'spin 0.9s linear infinite',
          marginBottom: 36,
        }}
      />

      {/* テキスト */}
      <div
        key={stage}
        style={{
          fontFamily: 'Shippori Mincho, serif',
          fontSize: 22,
          fontWeight: 600,
          color: current.color,
          letterSpacing: '0.08em',
          animation: 'fadeIn 0.4s ease',
          marginBottom: 40,
        }}
      >
        {current.text}
      </div>

      {/* プログレスドット */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {STAGES.map((s, i) => (
          <div
            key={i}
            style={{
              width: i === stage ? 24 : 8,
              height: 8,
              borderRadius: 4,
              background: i === stage ? current.color : `${current.color}30`,
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>

      {/* 補足テキスト */}
      <p
        style={{
          marginTop: 48,
          fontSize: 13,
          color: `${current.color}80`,
          textAlign: 'center',
          lineHeight: 1.7,
        }}
      >
        Claude AIがあなたの才覚領域を分析しています
        <br />
        そのままお待ちください（約30秒）
      </p>
    </div>
  );
}
