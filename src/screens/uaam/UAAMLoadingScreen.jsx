import { useState, useEffect } from 'react';

const AXES = [
  { label: '志', english: 'MindSet', color: '#4A6FA5', msg: '志 MindSet を分析中' },
  { label: '知', english: 'Literacy', color: '#2E8B57', msg: '知 Literacy を分析中' },
  { label: '技', english: 'Competency', color: '#C4922A', msg: '技 Competency を分析中' },
  { label: '衝', english: 'Impact', color: '#A84432', msg: '衝 Impact を分析中' },
];

export default function UAAMLoadingScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const [dots, setDots] = useState('');

  // 4軸を順番にフェードイン→フェードアウトでループ
  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % AXES.length);
        setFade(true);
      }, 400);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  // ドットアニメーション
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const current = AXES[activeIndex];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F5F0E8',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      {/* メインアニメーションエリア */}
      <div
        style={{
          opacity: fade ? 1 : 0,
          transform: fade ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(10px)',
          transition: 'all 0.4s ease',
          textAlign: 'center',
          marginBottom: 48,
        }}
      >
        {/* 漢字1文字 */}
        <div
          style={{
            fontSize: 120,
            fontWeight: 900,
            color: current.color,
            fontFamily: "'Shippori Mincho', 'Noto Serif JP', Georgia, serif",
            lineHeight: 1,
            textShadow: `0 4px 20px ${current.color}30`,
          }}
        >
          {current.label}
        </div>

        {/* English名 */}
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: current.color,
            fontFamily: "'Playfair Display', Georgia, serif",
            letterSpacing: '0.15em',
            marginTop: 8,
            opacity: 0.8,
          }}
        >
          {current.english}
        </div>

        {/* 分析中メッセージ */}
        <div
          style={{
            fontSize: 16,
            color: '#7A7060',
            marginTop: 16,
            fontWeight: 500,
            minWidth: 240,
          }}
        >
          {current.msg}{dots}
        </div>
      </div>

      {/* 4軸インジケーター */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 40 }}>
        {AXES.map((axis, i) => (
          <div
            key={axis.label}
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: i === activeIndex ? axis.color : '#D4C9B0',
              transition: 'all 0.4s ease',
              transform: i === activeIndex ? 'scale(1.4)' : 'scale(1)',
            }}
          />
        ))}
      </div>

      {/* 下部テキスト */}
      <div
        style={{
          textAlign: 'center',
          color: '#7A7060',
          fontSize: 14,
          fontWeight: 500,
          lineHeight: 1.8,
        }}
      >
        <div
          style={{
            fontFamily: "'Shippori Mincho', 'Noto Serif JP', Georgia, serif",
            fontSize: 15,
            fontWeight: 600,
            color: '#2A2520',
          }}
        >
          才覚を分析しています
        </div>
        <div style={{ fontSize: 12, marginTop: 8, color: '#9A9080' }}>
          4軸16項目の回答から、あなただけの能力特性を分析中です
        </div>
      </div>

      {/* CSSアニメーション */}
      <style>{`
        @keyframes uaam-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
