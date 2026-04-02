/**
 * ActivationPanel.jsx
 * 発動分析パネル — ユーザー画面 & 管理画面 共用コンポーネント
 */

import { getActivationAnalysis } from './activation_analysis';
import { pairShort, pairDef, SUB_JP as PAIR_SUB_JP, getBlock, ZONE_HEX as PAIR_ZONE_HEX, ZONE_LABEL, BLOCKS } from './screens/uaam/AllPairsTriangle';

/* ── 才覚タイプ定義（10ブロック） ── */
const TYPE_JP = {
  VISIONARY: '構想家', BUILDER:  '創造者', CATALYST: '触媒',
  ANCHOR:    '軸人',   SAGE:     '賢者',   CRAFTER:  '匠',
  NAVIGATOR: '羅針盤', INVENTOR: '発明家', STRIKER:  '実践家', PIONEER: '開拓者',
};
const TYPE_DESC = {
  VISIONARY: 'まだ誰も見えていない未来を設計する。志と知が統合されているとき、問いの質が変わる。',
  BUILDER:   '志と技が連動している。アイデアを形にするまで諦めない。頭の中の設計図を現実に変換する。',
  CATALYST:  '志と衝動が一体化している。場に入ると何かが動き始める。変化の引き金を引く存在。',
  ANCHOR:    '核となる価値観が確立されている。ブレない軸が周囲に安心と信頼を生む。場を安定させる存在。',
  SAGE:      '知の統合力が高い。表面ではなく本質を見抜く。深い洞察と言語化で複雑な状況に光を当てる。',
  CRAFTER:   '知と技が高い精度で連動している。分析→設計→実装を一人でやりきれる問題解決のプロ。',
  NAVIGATOR: '知と衝動が統合されている。情報を即行動に変換する。霧の中でも最短ルートを見つけていく。',
  INVENTOR:  '技の核が統合されている。ゼロから仕組みを生み出す力を持つ。誰も作ったことのないものを作る。',
  STRIKER:   '技と衝動が連動している。動きながら精度を上げる。行動の速度そのものが武器になっている。',
  PIONEER:   '衝動の核が統合されている。誰も行かない場所に最初に踏み込む。その背中が道になる。',
};

/* Case B: パートナーキー → 日本語表示名 */
const PARTNER_JP = {
  meaning:'根幹力', mindfulness:'受容力', mindshift:'転換力', mastery:'熟達力',
  learning:'謙学力', logical:'論理力', life:'活用力', leadership:'統率力',
  critical:'本質力', creativity:'創造力', communication:'表現力', collaboration:'協働力',
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

// mode: "top"    = TypeBadgeのみ（名前 + Activation Type）
//       "bottom"  = ✅今、発動している力 + 🔑次に動かす力
//       "all"     = すべて（デフォルト互換）
export default function ActivationPanel({ scores, threshold = 13, userName, mode = 'all' }) {
  if (!scores) return null;
  const { active, sleeping, type } = getActivationAnalysis(scores, threshold);

  if (mode === 'top') {
    return (
      <div style={{ fontFamily: "'Outfit', 'Noto Sans JP', sans-serif", maxWidth: 640, margin: '0 auto' }}>
        <TypeBadge type={type} userName={userName} />
      </div>
    );
  }

  if (mode === 'bottom') {
    return (
      <div style={{ fontFamily: "'Outfit', 'Noto Sans JP', sans-serif", maxWidth: 640, margin: '0 auto' }}>
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

  // mode === 'all'
  return (
    <div style={{
      fontFamily: "'Outfit', 'Noto Sans JP', sans-serif",
      maxWidth: 640, margin: '0 auto',
    }}>
      <TypeBadge type={type} userName={userName} />
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

/* ── 才覚タイプバッジ ── */
function TypeBadge({ type, userName }) {
  if (!type?.main) return null;
  const mainBlock = BLOCKS.find(b => b.name === type.main);
  const subBlock  = BLOCKS.find(b => b.name === type.sub);
  const mainColor = mainBlock?.color || '#8B35C8';
  const subColor  = subBlock?.color  || '#888';

  return (
    <div style={{
      marginBottom: 24,
      padding: '18px 20px',
      background: '#FFFFFF',
      borderRadius: 14,
      border: `1px solid ${mainColor}30`,
      borderTop: `3px solid ${mainColor}`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    }}>
      {/* 名前 + UAAM ラベル */}
      {userName && (
        <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${BORDER}` }}>
          <div style={{
            fontSize: 9, letterSpacing: '0.18em', color: TEXT_MUTED,
            fontWeight: 700, textTransform: 'uppercase', marginBottom: 4,
          }}>Universal Ability Assessment Model</div>
          <div style={{
            fontFamily: "'Noto Serif JP', Georgia, serif",
            fontSize: 20, fontWeight: 700, color: TEXT_PRIMARY,
          }}>{userName}</div>
        </div>
      )}
      {/* Activation Type ラベル */}
      <div style={{
        fontSize: 9, letterSpacing: '0.18em', color: TEXT_MUTED,
        marginBottom: 10, fontWeight: 700, textTransform: 'uppercase',
      }}>Activation Type</div>

      {/* メイン × サブ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* メインタイプ */}
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
            color: mainColor, marginBottom: 2,
          }}>{type.main}</div>
          <div style={{
            fontSize: 22, fontWeight: 800, color: TEXT_PRIMARY,
            fontFamily: "'Noto Serif JP', serif", lineHeight: 1.1,
          }}>{TYPE_JP[type.main] || type.main}</div>
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 2 }}>
            {mainBlock?.jp}
          </div>
        </div>

        {/* × 区切り */}
        {subBlock && (
          <div style={{ fontSize: 20, color: '#CCBBAA', fontWeight: 300, lineHeight: 1 }}>×</div>
        )}

        {/* サブタイプ */}
        {subBlock && (
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
              color: subColor, marginBottom: 2,
            }}>{type.sub}</div>
            <div style={{
              fontSize: 18, fontWeight: 700, color: TEXT_SECONDARY,
              fontFamily: "'Noto Serif JP', serif", lineHeight: 1.1,
            }}>{TYPE_JP[type.sub] || type.sub}</div>
            <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 2 }}>
              {subBlock.jp}
            </div>
          </div>
        )}
      </div>

      {/* タイプ説明 */}
      <p style={{
        fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.8,
        margin: '12px 0 0', paddingTop: 10,
        borderTop: `1px solid ${BORDER}`,
      }}>
        {TYPE_DESC[type.main] || ''}
      </p>
    </div>
  );
}

function PanelSection({ emoji, title, items, accentColor }) {
  if (!items || items.length === 0) return null;

  const pairItems = items.filter(item => item.isPair);
  const cardItems = items.filter(item => !item.isPair);
  const maxSum = pairItems.length > 0
    ? Math.max(...pairItems.map(p => p.sum))
    : 40;

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
        {pairItems.length > 0 && (
          <span style={{
            fontSize: 10, color: accentColor, marginLeft: 'auto',
            fontWeight: 700, background: accentColor + '18',
            padding: '2px 8px', borderRadius: 9999,
          }}>全{pairItems.length}件</span>
        )}
      </div>

      {/* ペアアイテム: スペクトラム型コンテナ */}
      {pairItems.length > 0 && (
        <div style={{
          background: '#FFFFFF',
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          overflow: 'hidden',
          marginBottom: cardItems.length > 0 ? 10 : 0,
        }}>
          {pairItems.map((item, i) => (
            <PairCard
              key={`${item.kA}-${item.kB}`}
              item={item}
              maxSum={maxSum}
              isLast={i === pairItems.length - 1}
            />
          ))}
        </div>
      )}

      {/* 通常カード */}
      {cardItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cardItems.map((item, i) => (
            <Card key={item.name || i} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── ペア表示カード — スペクトラム型（🔑 次に動かす力 用）── */
function PairCard({ item, maxSum = 40, isLast = false }) {
  const { kA, kB, zone, sum } = item;
  const shortName = pairShort(kA, kB);
  const desc      = pairDef(kA, kB);
  const zoneColor = PAIR_ZONE_HEX[zone] || '#888';
  const nameA     = PAIR_SUB_JP[kA] || kA;
  const nameB     = PAIR_SUB_JP[kB] || kB;
  const pct       = Math.min((sum / maxSum) * 100, 100);

  return (
    <div style={{
      padding: '10px 14px',
      borderBottom: isLast ? 'none' : `1px solid ${BORDER}`,
    }}>
      {/* 行1: 力の名前 + ペア素子 + スコア */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
        <span style={{
          fontSize: 14, fontWeight: 800, color: TEXT_PRIMARY,
          fontFamily: "'Noto Serif JP', serif", letterSpacing: '0.02em',
          flexShrink: 0,
        }}>{shortName}</span>
        <span style={{
          fontSize: 11, color: TEXT_MUTED, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{nameA} × {nameB}</span>
        <span style={{
          fontSize: 12, fontWeight: 700, color: zoneColor,
          fontFamily: "'Outfit', sans-serif", flexShrink: 0,
        }}>{sum}pt</span>
      </div>

      {/* 強度バー */}
      <div style={{
        height: 3, background: '#EDE8E0', borderRadius: 2,
        marginBottom: 5, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 2,
          background: `linear-gradient(90deg, ${zoneColor}77, ${zoneColor})`,
          transition: 'width 0.6s ease',
        }} />
      </div>

      {/* 説明文 */}
      {desc && (
        <p style={{
          fontSize: 12, color: TEXT_SECONDARY,
          margin: 0, lineHeight: 1.6,
        }}>{desc}</p>
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
