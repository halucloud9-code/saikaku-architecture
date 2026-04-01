/**
 * ActivationPanel.jsx
 * 発動分析パネル — ユーザー画面 & 管理画面 共用コンポーネント
 */

import { getActivationAnalysis } from './activation_analysis';
import { pairShort, pairDef, SUB_JP as PAIR_SUB_JP, getBlock, ZONE_HEX as PAIR_ZONE_HEX, ZONE_LABEL } from './screens/uaam/AllPairsTriangle';

/* ページ全体トーンに合わせたブロック配色（バッジのみに使用） */
const BLOCK_COLOR = {
  志: { badge: '#2C5F8A', light: '#EFF4FA' },
  知: { badge: '#1E7A4A', light: '#EFF8F3' },
  技: { badge: '#A07A18', light: '#FAF5E9' },
  衝: { badge: '#C0614A', light: '#FAF0EE' },
};

const LIGHT_BG   = '#F5F0E8';
const BORDER     = '#E8E0D4';
const ACCENT_GOLD = '#B8960C';
const TEXT_PRIMARY   = '#1A1A1A';
const TEXT_SECONDARY = '#333333';
const TEXT_MUTED     = '#666666';

export default function ActivationPanel({ scores, threshold = 13 }) {
  if (!scores) return null;
  const { active, sleeping } = getActivationAnalysis(scores, threshold);

  return (
    <div style={{
      fontFamily: "'Outfit', 'Noto Sans JP', sans-serif",
      maxWidth: 640, margin: '0 auto',
    }}>
      <PanelSection
        emoji="✅"
        title="今、発動している力"
        items={active}
        accentColor={ACCENT_GOLD}
      />
      <PanelSection
        emoji="🔑"
        title="次に動かす力"
        items={sleeping}
        accentColor="#7A6A50"
      />
    </div>
  );
}

function PanelSection({ emoji, title, items, accentColor }) {
  if (!items || items.length === 0) return null;

  return (
    <div style={{ marginBottom: 28 }}>
      {/* セクションヘッダー */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 14,
        paddingBottom: 8,
        borderBottom: `2px solid ${accentColor}30`,
      }}>
        <span style={{ fontSize: 18 }}>{emoji}</span>
        <span style={{
          fontSize: 15, fontWeight: 700,
          color: accentColor,
          fontFamily: "'Noto Serif JP', serif",
          letterSpacing: '0.03em',
        }}>{title}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item, i) =>
          item.isPair
            ? <PairCard key={`${item.kA}-${item.kB}`} item={item} />
            : <Card key={item.name || i} item={item} />
        )}
      </div>
    </div>
  );
}

/* ── ペア表示カード（🔑 次に動かす力 用）── */
function PairCard({ item }) {
  const { kA, kB, zone, scoreA, scoreB, sum } = item;
  const shortName = pairShort(kA, kB);
  const desc      = pairDef(kA, kB);
  const blk       = getBlock(kA, kB);
  const zoneColor = PAIR_ZONE_HEX[zone] || '#888';
  const zoneLbl   = ZONE_LABEL[zone] || zone.toUpperCase();
  const nameA     = PAIR_SUB_JP[kA] || kA;
  const nameB     = PAIR_SUB_JP[kB] || kB;

  return (
    <div style={{
      background: '#FFFFFF',
      border: `1px solid ${BORDER}`,
      borderLeft: `4px solid ${zoneColor}`,
      borderRadius: 10,
      padding: '14px 16px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      {/* ヘッダー行: ショートネーム + ゾーンバッジ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{
          fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY,
          fontFamily: "'Noto Serif JP', serif",
        }}>{shortName}</span>
        <span style={{
          background: zoneColor,
          color: '#fff',
          fontSize: 10, fontWeight: 700,
          padding: '2px 8px', borderRadius: 9999,
          letterSpacing: '0.06em',
          marginLeft: 'auto',
        }}>{zoneLbl}</span>
      </div>

      {/* ペア名 */}
      <div style={{
        fontSize: 12, fontWeight: 600, color: zoneColor,
        marginBottom: 6,
      }}>{nameA} × {nameB}</div>

      {/* スコア + ブロック */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 8,
      }}>
        <span style={{
          fontSize: 13, fontWeight: 700, color: TEXT_SECONDARY,
          fontFamily: "'Outfit', sans-serif",
        }}>{scoreA} + {scoreB} = <span style={{ color: zoneColor }}>{sum}</span></span>
        {blk && (
          <span style={{
            fontSize: 10, color: TEXT_MUTED, marginLeft: 'auto',
            fontWeight: 600, letterSpacing: '0.04em',
          }}>{blk.name} / {blk.jp}</span>
        )}
      </div>

      {/* ペア説明 */}
      {desc && (
        <p style={{
          fontSize: 13, color: TEXT_SECONDARY,
          lineHeight: 1.7, margin: 0,
        }}>{desc}</p>
      )}
    </div>
  );
}

function Card({ item }) {
  const c = BLOCK_COLOR[item.block] || { badge: '#888', light: '#F5F0E8' };

  return (
    <div style={{
      background: '#FFFFFF',
      border: `1px solid ${BORDER}`,
      borderLeft: `4px solid ${c.badge}`,
      borderRadius: 10,
      padding: '14px 16px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      {/* ヘッダー行 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
      }}>
        <span style={{
          background: c.badge,
          color: '#fff',
          fontSize: 11, fontWeight: 700,
          padding: '2px 8px',
          borderRadius: 9999,
          letterSpacing: '0.04em',
          fontFamily: "'Noto Serif JP', serif",
        }}>
          {item.block}
        </span>
        <span style={{
          fontSize: 15, fontWeight: 700,
          color: TEXT_PRIMARY,
          fontFamily: "'Noto Serif JP', serif",
        }}>
          {item.name}
        </span>
        <span style={{
          fontSize: 12, color: TEXT_MUTED,
          marginLeft: 'auto',
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 600,
        }}>
          {item.score}点
        </span>
      </div>

      {/* メッセージ */}
      <p style={{
        fontSize: 13, color: TEXT_SECONDARY,
        lineHeight: 1.7, marginBottom: 10,
      }}>
        {item.message}
      </p>

      {/* アクション */}
      <div style={{
        background: c.light,
        border: `1px solid ${c.badge}28`,
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 13, fontWeight: 600,
        color: c.badge,
      }}>
        ▶ {item.action}
      </div>
    </div>
  );
}
