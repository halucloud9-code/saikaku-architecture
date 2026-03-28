/**
 * ActivationPanel.jsx
 * 発動分析パネル — ユーザー画面 & 管理画面 共用コンポーネント
 *
 * 使い方:
 *   import ActivationPanel from './ActivationPanel';
 *   <ActivationPanel scores={subcategoryScores} />
 *
 * scores の形式:
 *   { 根幹力: 72, 受容力: 48, 転換力: 76, ... } // 80点満点
 */

import { getActivationAnalysis } from './activation_analysis';

const BLOCK_COLOR = {
  志: { bg: '#EEF2FF', border: '#818CF8', label: '#4F46E5' },
  知: { bg: '#F0FDF4', border: '#4ADE80', label: '#16A34A' },
  技: { bg: '#FFF7ED', border: '#FB923C', label: '#EA580C' },
  衝: { bg: '#FDF2F8', border: '#E879F9', label: '#A21CAF' },
};

export default function ActivationPanel({ scores, threshold = 52 }) {
  if (!scores) return null;

  const { active, sleeping } = getActivationAnalysis(scores, threshold);

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 640, margin: '0 auto' }}>

      {/* 発動中 */}
      <Section title="✅ 今、発動している力" items={active} />

      {/* 未発動 */}
      <Section title="🔑 次に動かす力" items={sleeping} />

    </div>
  );
}

function Section({ title, items }) {
  if (!items || items.length === 0) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 12 }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((item) => (
          <Card key={item.name} item={item} />
        ))}
      </div>
    </div>
  );
}

function Card({ item }) {
  const color = BLOCK_COLOR[item.block] || { bg: '#F9FAFB', border: '#D1D5DB', label: '#6B7280' };

  return (
    <div style={{
      background: color.bg,
      border: `1px solid ${color.border}`,
      borderRadius: 10,
      padding: '14px 16px',
    }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{
          background: color.border,
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: 9999,
        }}>
          {item.block}
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1F2937' }}>
          {item.name}
        </span>
        <span style={{ fontSize: 12, color: '#6B7280', marginLeft: 'auto' }}>
          {item.score}点
        </span>
      </div>

      {/* メッセージ */}
      <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 8 }}>
        {item.message}
      </p>

      {/* アクション */}
      <div style={{
        background: '#fff',
        border: `1px solid ${color.border}`,
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 13,
        color: color.label,
        fontWeight: 600,
      }}>
        ▶ {item.action}
      </div>
    </div>
  );
}
