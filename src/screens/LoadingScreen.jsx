import { useState, useEffect } from 'react';

const STAGES = [
  { text: '才能を解析中', color: '#C4922A' },
  { text: '価値観を解析中', color: '#4A6FA5' },
  { text: '情熱を解析中', color: '#A84432' },
  { text: '統合中', color: '#FAFAFA' },
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
  const progress = ((stage + 1) / STAGES.length) * 100;

  return (
    <div style={{
      minHeight: '100vh', background: '#09090B',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 320, textAlign: 'center' }}>
        {/* ステージテキスト */}
        <div key={stage} style={{ animation: 'fadeIn 0.3s ease', marginBottom: 48 }}>
          <h2 style={{
            fontFamily: "'Noto Serif JP', 'Times New Roman', serif",
            fontSize: 24, fontWeight: 800, color: '#FAFAFA',
            margin: '0 0 8px', letterSpacing: '0.02em',
          }}>{current.text}</h2>
          <p style={{ fontSize: 13, color: '#52525B', margin: 0 }}>
            {stage + 1} / {STAGES.length}
          </p>
        </div>

        {/* プログレスバー */}
        <div style={{
          width: '100%', height: 2, background: '#18181B',
          borderRadius: 1, overflow: 'hidden', marginBottom: 48,
        }}>
          <div style={{
            height: '100%', background: current.color,
            width: `${progress}%`,
            transition: 'all 0.5s ease',
          }} />
        </div>

        <p style={{ fontSize: 13, color: '#3F3F46', margin: 0, lineHeight: 1.8 }}>
          AIがあなたの才覚領域を分析しています<br />
          <span style={{ fontSize: 12 }}>約30秒お待ちください</span>
        </p>
      </div>
    </div>
  );
}
