
import { useState } from "react";

// ── サンプルデータ（実際のスコア想定） ──────────────────────
const SAMPLE_PAIRS = [
  { short: '洞察力',  kA: '意味',     kB: '批判的思考', sA: 14, sB: 13, zone: 'active',  desc: '在り方を軸に本質を見抜く力' },
  { short: '創造力',  kA: '意味',     kB: '創造性',     sA: 14, sB: 12, zone: 'active',  desc: '目的を起点に新しい価値を創る力' },
  { short: '観察力',  kA: '気づき',   kB: '批判的思考', sA: 13, sB: 13, zone: 'active',  desc: '状況を鋭く観察し本質を捉える力' },
  { short: '発想力',  kA: '気づき',   kB: '創造性',     sA: 13, sB: 12, zone: 'active',  desc: '微細な変化に気づき新発想を生む力' },
  { short: '論述力',  kA: '学習',     kB: '論理',       sA: 12, sB: 14, zone: 'active',  desc: '事実を整理し論理的に伝える力' },
  { short: '再現力',  kA: '熟達',     kB: '活用',       sA: 13, sB: 12, zone: 'active',  desc: '熟練の技を現場で再現する力' },
];

const ZONE_COLOR = { natural: '#8B35C8', pro: '#1A6FD4', active: '#7CB82F', potential: '#E07830' };
const MAX_SUM = 40; // 20+20

// ── Before: 現在のPairCard ──────────────────────────────────
function OldPairCard({ pair }) {
  const zc = ZONE_COLOR[pair.zone];
  const sum = pair.sA + pair.sB;
  return (
    <div style={{
      background: '#FFFFFF',
      border: `1px solid #E8E0D4`,
      borderLeft: `4px solid ${zc}`,
      borderRadius: 10,
      padding: '14px 16px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', fontFamily: 'serif' }}>{pair.short}</span>
        <span style={{
          background: zc, color: '#fff', fontSize: 10, fontWeight: 700,
          padding: '2px 8px', borderRadius: 9999, marginLeft: 'auto', letterSpacing: '0.06em',
        }}>ACTIVE</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: zc, marginBottom: 6 }}>{pair.kA} × {pair.kB}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#333', marginBottom: 8, fontFamily: 'monospace' }}>
        {pair.sA} + {pair.sB} = <span style={{ color: zc }}>{sum}</span>
      </div>
      <p style={{ fontSize: 13, color: '#333', lineHeight: 1.7, margin: 0, marginBottom: 10 }}>{pair.desc}</p>
      <div style={{ padding: '8px 12px', background: zc + '10', borderRadius: 6, borderLeft: `3px solid ${zc}` }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: zc }}>▶ ACTION</span>
        <p style={{ fontSize: 12, color: '#333', lineHeight: 1.7, margin: '4px 0 0' }}>
          今直面している問題の「本当の問い」を再定義して、チームに問いかけてみる。
        </p>
      </div>
    </div>
  );
}

// ── After: スペクトラム型 ────────────────────────────────────
function SpectrumCard({ pair, maxSum }) {
  const zc = ZONE_COLOR[pair.zone];
  const sum = pair.sA + pair.sB;
  const pct = (sum / maxSum) * 100;
  return (
    <div style={{
      padding: '10px 14px',
      borderBottom: '1px solid #EDE8E0',
      background: '#FFFFFF',
    }}>
      {/* 行1: 名前 + スコア + バッジ */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#1A1A1A', fontFamily: 'serif', letterSpacing: '0.02em' }}>
          {pair.short}
        </span>
        <span style={{ fontSize: 10, color: '#999', flex: 1 }}>{pair.kA} × {pair.kB}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: zc, fontFamily: 'monospace' }}>{sum}pt</span>
      </div>
      {/* バー */}
      <div style={{ height: 4, background: '#EDE8E0', borderRadius: 2, marginBottom: 5, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 2,
          background: `linear-gradient(90deg, ${zc}99, ${zc})`,
          transition: 'width 0.6s ease',
        }} />
      </div>
      {/* 説明文 */}
      <p style={{ fontSize: 12, color: '#555', margin: 0, lineHeight: 1.6 }}>{pair.desc}</p>
    </div>
  );
}

// ── After v2: ゾーンバッジ付きカード（ACTION削除版）─────────
function CompactCard({ pair }) {
  const zc = ZONE_COLOR[pair.zone];
  const sum = pair.sA + pair.sB;
  return (
    <div style={{
      background: '#FFFFFF',
      border: `1px solid #E8E0D4`,
      borderLeft: `3px solid ${zc}`,
      borderRadius: 8,
      padding: '8px 12px',
      marginBottom: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#1A1A1A', fontFamily: 'serif' }}>{pair.short}</span>
        <span style={{ fontSize: 10, color: '#AAA', flex: 1 }}>{pair.kA} × {pair.kB}</span>
        <span style={{
          background: zc + '20', color: zc, fontSize: 9, fontWeight: 700,
          padding: '1px 6px', borderRadius: 9999, border: `1px solid ${zc}40`,
        }}>ACTIVE {sum}pt</span>
      </div>
      <p style={{ fontSize: 12, color: '#555', margin: 0, lineHeight: 1.55 }}>{pair.desc}</p>
    </div>
  );
}

export default function Preview() {
  const [view, setView] = useState('spectrum');
  const maxSum = Math.max(...SAMPLE_PAIRS.map(p => p.sA + p.sB));

  const TAB = {
    base: {
      padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      cursor: 'pointer', border: 'none', letterSpacing: '0.04em',
    },
  };

  return (
    <div style={{ fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif", background: '#F0EBE0', minHeight: '100vh', display: 'flex', gap: 24, justifyContent: 'center', padding: '32px 16px', flexWrap: 'wrap' }}>

      {/* ── Before ──────────────── */}
      <div style={{ width: 360 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#999', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>◀ Before（現在）</div>
        <div style={{ background: '#F5F0E8', borderRadius: 16, padding: '20px 16px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 8, borderBottom: '2px solid #7CB82F30' }}>
            <span style={{ fontSize: 18 }}>🔑</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#7A6A50', fontFamily: 'serif' }}>次に動かす力</span>
            <span style={{ fontSize: 10, color: '#BBB', marginLeft: 'auto' }}>上位3件のみ</span>
          </div>
          {SAMPLE_PAIRS.slice(0, 3).map((p, i) => <OldPairCard key={i} pair={p} />)}
        </div>
      </div>

      {/* ── After ───────────────── */}
      <div style={{ width: 360 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#7CB82F', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>▶ After（提案）</div>

        {/* タブ切り替え */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {[
            { key: 'spectrum', label: '案X スペクトラム型' },
            { key: 'compact',  label: '案Y コンパクトカード' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setView(key)} style={{
              ...TAB.base,
              background: view === key ? '#1A1A1A' : '#E8E0D4',
              color: view === key ? '#FFF' : '#888',
            }}>{label}</button>
          ))}
        </div>

        <div style={{ background: '#F5F0E8', borderRadius: 16, padding: '20px 16px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 8, borderBottom: '2px solid #7CB82F30' }}>
            <span style={{ fontSize: 18 }}>🔑</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#7A6A50', fontFamily: 'serif' }}>次に動かす力</span>
            <span style={{ fontSize: 10, color: '#7CB82F', marginLeft: 'auto', fontWeight: 700 }}>全{SAMPLE_PAIRS.length}件</span>
          </div>

          {view === 'spectrum' && (
            <div style={{ background: '#FFFFFF', borderRadius: 10, overflow: 'hidden', border: '1px solid #E8E0D4' }}>
              {SAMPLE_PAIRS.map((p, i) => <SpectrumCard key={i} pair={p} maxSum={maxSum} />)}
            </div>
          )}

          {view === 'compact' && (
            <div>
              {SAMPLE_PAIRS.map((p, i) => <CompactCard key={i} pair={p} />)}
            </div>
          )}
        </div>

        {/* 差分サマリー */}
        <div style={{ marginTop: 14, padding: '12px 14px', background: '#1A1A1A', borderRadius: 10, color: '#FFF' }}>
          {view === 'spectrum' ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#7CB82F', marginBottom: 6 }}>案X の特徴</div>
              <div style={{ fontSize: 11, color: '#CCC', lineHeight: 1.8 }}>
                ・バーで強度が視覚的に比較できる<br/>
                ・1ペア約58px → Before比 -67%<br/>
                ・全6件が画面内に収まる<br/>
                ・説明文あり / ACTION削除
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#7CB82F', marginBottom: 6 }}>案Y の特徴</div>
              <div style={{ fontSize: 11, color: '#CCC', lineHeight: 1.8 }}>
                ・現行デザインに近い安心感<br/>
                ・1ペア約56px → Before比 -69%<br/>
                ・変更量が少なくリスク低<br/>
                ・説明文あり / ACTION削除
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
