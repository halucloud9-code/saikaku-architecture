/**
 * ActivationPanel.jsx
 * 発動分析パネル — ユーザー画面 & 管理画面 共用コンポーネント
 */

import { getActivationAnalysis } from './activation_analysis';
import { pairShort, pairDef, SUB_JP as PAIR_SUB_JP, getBlock, ZONE_HEX as PAIR_ZONE_HEX, ZONE_LABEL } from './screens/uaam/AllPairsTriangle';

/* Case B: パートナーキー → 日本語表示名 */
const PARTNER_JP = {
  meaning:'根幹力', mindfulness:'受容力', mindshift:'転換力', mastery:'熟達力',
  learning:'謙学力', logical:'論理力', life:'活用力', leadership:'統率力',
  critical:'本質力', creativity:'創造力', communication:'伝達力', collaboration:'協働力',
  idea:'起動力', innovation:'革新力', implementation:'実装力', influence:'影響力',
};

/* Case B: ペアブロック別ワンポイントアクション */
const BLOCK_ACTION = {
  VISIONARY: 'この構想力が動いているとき、まだ誰も見えていない問いを立てられる。次の大きな問いを声に出してみる。',
  BUILDER:   '志と技が連動している。頭の中にあるものを形にする力が今出ている。24時間以内に1つ実装する。',
  CATALYST:  '志と衝動が連動している。人を動かす言葉が出やすい状態。チームへの発信を今日する。',
  ANCHOR:    '志の力が統合されている。この核を言語化して、信頼できる人に伝えてフィードバックをもらう。',
  SAGE:      '知の力が統合されている。この深さを「誰かに教える」形で使ってみる。',
  CRAFTER:   '知と技が連動している。問題解決の精度が上がっている。今すぐ難しい課題に当たってみる。',
  NAVIGATOR: '知と衝動が連動している。分析と行動が統合されている。判断を要する局面に今すぐ飛び込む。',
  INVENTOR:  '技の力が統合されている。この実装力を、まだ試したことのない分野に向けてみる。',
  STRIKER:   '技と衝動が連動している。実行力が最大値にある。止まっているアクションを今日動かす。',
  PIONEER:   '衝動の力が統合されている。この行動力をチームに伝染させる機会をつくる。',
};

/* Case A: tierラベルと色 */
const TIER_STYLE = {
  peak: { label: 'PEAK',  color: '#8B35C8', bg: '#F4EEFF' },
  high: { label: 'HIGH',  color: '#1E7A4A', bg: '#EFF8F3' },
  edge: { label: 'EDGE',  color: '#A07A18', bg: '#FAF5E9' },
};

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
          marginBottom: blk && BLOCK_ACTION[blk.name] ? 10 : 0,
        }}>{desc}</p>
      )}

      {/* Case B: ブロック別ワンポイントアクション */}
      {blk && BLOCK_ACTION[blk.name] && (
        <div style={{
          marginTop: 2,
          padding: '8px 12px',
          background: zoneColor + '10',
          borderRadius: 6,
          borderLeft: `3px solid ${zoneColor}`,
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: zoneColor, letterSpacing: '0.08em' }}>▶ ACTION</span>
          <p style={{ fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.7, margin: '4px 0 0' }}>
            {BLOCK_ACTION[blk.name]}
          </p>
        </div>
      )}
    </div>
  );
}

function Card({ item }) {
  const c = BLOCK_COLOR[item.block] || { badge: '#888', light: '#F5F0E8' };
  const ts = TIER_STYLE[item.tier];

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
        {/* Case A: tierバッジ */}
        {ts && (
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
            color: ts.color, background: ts.bg,
            padding: '2px 7px', borderRadius: 9999,
            border: `1px solid ${ts.color}40`,
          }}>{ts.label}</span>
        )}
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

      {/* Case B: ペアパートナーヒント */}
      {item.partnerKey && (
        <div style={{
          fontSize: 11, color: TEXT_MUTED,
          marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ color: c.badge, fontWeight: 700 }}>×</span>
          <span style={{ fontWeight: 600, color: TEXT_SECONDARY }}>
            {PARTNER_JP[item.partnerKey] || item.partnerKey}（{item.partnerScore}点）と組むとき最大化
          </span>
        </div>
      )}

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
