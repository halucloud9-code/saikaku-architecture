import { useState, useEffect } from 'react';
import { getDocs, query, collection, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { GROUPS, EVENT_ID, EVENT_TITLE } from '../data';

const T = {
  bg: '#F5F0E8', card: '#FFFFFF', border: '#E0D8CE', borderSubtle: '#EDE8E0',
  text: '#2A2520', muted: '#8A7A6A', sub: '#6A5A4A', accent: '#C4922A',
  accentBg: 'rgba(196,146,42,0.10)',
  fontFamily: "'Noto Serif JP', 'Hiragino Sans', sans-serif",
};

// fromName が生メールアドレスのとき @ より前だけ表示（他者の生メアドを発表者に見せない）
function maskName(name) {
  const n = (name || '').trim();
  if (!n) return '（名前未設定）';
  if (n.includes('@')) return n.split('@')[0];
  return n;
}

function Tag({ children, color }) {
  return (
    <span style={{
      fontSize: 11, padding: '2px 8px', borderRadius: 4,
      background: `${color}1A`, color, fontWeight: 600, whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

// 配列の出現頻度を降順に集計
function tally(items) {
  const map = new Map();
  items.forEach(v => map.set(v, (map.get(v) || 0) + 1));
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: `3px solid ${T.border}`, borderTopColor: T.accent,
        animation: 'spin 1s linear infinite',
      }} />
    </div>
  );
}

export default function ProgressResult({ groupId, user, onLogout }) {
  const group = GROUPS.find(g => g.id === groupId);
  const [resonances, setResonances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!group) { setLoading(false); return; }
    const load = async () => {
      try {
        const q = query(
          collection(db, 'alpha_events', EVENT_ID, 'resonance'),
          where('toUid', '==', groupId),
        );
        const snap = await getDocs(q);
        setResonances(snap.docs.map(d => d.data()));
      } catch (e) {
        console.warn('[ProgressResult] load error:', e);
        setError('集計の読み込みに失敗しました。時間をおいて再読み込みしてください。');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [groupId, group]);

  const page = (children) => (
    <div style={{
      maxWidth: 720, margin: '0 auto', minHeight: '100vh', padding: 16,
      background: T.bg, color: T.text, fontFamily: T.fontFamily,
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {children}
    </div>
  );

  if (!group) {
    return page(
      <div style={{ textAlign: 'center', padding: '80px 20px', color: T.muted }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
        <div style={{ color: T.text }}>事業が見つかりません</div>
        <a href="/alpha-progress" style={{ color: T.accent, marginTop: 16, display: 'block', fontSize: 13 }}>
          入力画面へ戻る
        </a>
      </div>
    );
  }

  const entries = [...resonances].sort((a, b) => (b.talkLevel || 0) - (a.talkLevel || 0));
  const respondents = new Set(entries.map(r => r.fromUid)).size;
  const avg = entries.length
    ? (entries.reduce((s, r) => s + (r.talkLevel || 0), 0) / entries.length).toFixed(1)
    : '—';
  const saikakuTop = tally(entries.flatMap(r => r.saikaku ?? []));
  const actionTop = tally(entries.flatMap(r => r.actions ?? []));

  return page(
    <>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 4px 16px', borderBottom: `1px solid ${T.border}`, marginBottom: 18,
        flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          <div style={{ fontSize: 11, color: T.accent, letterSpacing: '0.1em', marginBottom: 3 }}>
            {EVENT_TITLE}　発表者向け集計
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 36, height: 36, borderRadius: '50%', background: '#EFE7D2',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 800, color: '#9C7D18', flexShrink: 0,
            }}>{group.icon}</span>
            <span>{group.name}</span>
          </div>
          {group.presenter && (
            <div style={{ fontSize: 12, color: T.accent, marginTop: 4, fontWeight: 700 }}>発表：{group.presenter}</div>
          )}
        </div>
        {onLogout && (
          <button onClick={onLogout} style={{
            background: 'transparent', border: `1px solid ${T.border}`, color: T.muted,
            fontSize: 11, padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
            fontFamily: T.fontFamily,
          }}>ログアウト</button>
        )}
      </div>

      {loading ? <Spinner /> : error ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#a84432', fontSize: 14 }}>{error}</div>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '70px 20px', color: T.muted, fontSize: 14 }}>
          <div style={{ fontSize: 30, marginBottom: 12, opacity: 0.4 }}>◎</div>
          まだ共鳴の回答が集まっていません。<br />報告会の進行に合わせて随時更新されます。
        </div>
      ) : (
        <>
          {/* Summary */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10,
            marginBottom: 16,
          }}>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: T.muted }}>回答</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{entries.length}<span style={{ fontSize: 12, color: T.muted, fontWeight: 400 }}> 件 / {respondents} 名</span></div>
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: T.muted }}>後で話したい度 平均</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T.accent }}>{avg}</div>
            </div>
          </div>

          {(saikakuTop.length > 0 || actionTop.length > 0) && (
            <div style={{
              background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
              padding: '12px 14px', marginBottom: 16,
            }}>
              {saikakuTop.length > 0 && (
                <div style={{ marginBottom: actionTop.length ? 10 : 0 }}>
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>感じてもらえた才覚</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {saikakuTop.map(([name, n]) => (
                      <Tag key={name} color="#6B5A9A">{name} {n}</Tag>
                    ))}
                  </div>
                </div>
              )}
              {actionTop.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>この事業と…</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {actionTop.map(([name, n]) => (
                      <Tag key={name} color="#2D7A4A">{name} {n}</Tag>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Individual responses */}
          <div style={{ fontSize: 11, color: T.muted, letterSpacing: '0.06em', margin: '4px 2px 10px' }}>
            一人ひとりの共鳴（後で話したい度の高い順）
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {entries.map((r, i) => (
              <div key={i} style={{
                background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 800 }}>{maskName(r.fromName)}</span>
                  <span style={{
                    fontSize: 11, background: T.accentBg, color: T.accent,
                    padding: '2px 8px', borderRadius: 4, fontWeight: 700,
                  }}>後で話したい度 {r.talkLevel}</span>
                  {(r.saikaku ?? []).map((s, j) => <Tag key={`s${j}`} color="#6B5A9A">{s}</Tag>)}
                  {(r.actions ?? []).map((s, j) => <Tag key={`a${j}`} color="#2D7A4A">{s}</Tag>)}
                </div>
                {(r.domains ?? []).length > 0 && (
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>領域: {(r.domains ?? []).join('・')}</div>
                )}
                {r.help && (
                  <div style={{ fontSize: 13, color: T.sub, marginTop: 6, lineHeight: 1.7 }}>
                    <span style={{ color: T.accent, fontWeight: 700 }}>★力になれること</span>：{r.help}
                  </div>
                )}
                {r.oneworld && (
                  <div style={{ fontSize: 13, color: T.sub, marginTop: 4, lineHeight: 1.7 }}>
                    <span style={{ color: T.accent, fontWeight: 700 }}>★One World活用</span>：{r.oneworld}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ textAlign: 'center', marginTop: 28, paddingTop: 16, borderTop: `1px solid ${T.borderSubtle}` }}>
        <a href="/alpha-progress" style={{ color: T.muted, fontSize: 12, textDecoration: 'none' }}>
          ← 共鳴シート入力画面へ
        </a>
      </div>
    </>
  );
}
