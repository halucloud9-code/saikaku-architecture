import { useState, useEffect } from 'react';
import { getDocs, collection } from 'firebase/firestore';
import { db } from '../../firebase';
import { GROUPS, EVENT_ID, EVENT_TITLE } from '../data';

const T = {
  bg: '#F5F0E8', card: '#FFFFFF', border: '#E0D8CE', borderSubtle: '#EDE8E0',
  text: '#2A2520', muted: '#8A7A6A', sub: '#6A5A4A', accent: '#C4922A',
  accentBg: 'rgba(196,146,42,0.10)',
  fontFamily: "'Noto Serif JP', 'Hiragino Sans', sans-serif",
};

// ── CSV書き出し（Drive README の列定義に準拠） ──
function exportCSV(resonances) {
  const headers = [
    '聞き手', '事業', '発表者', '後で話したい度',
    '才覚', '領域', 'この事業と', '力になれること', 'One World活用', '記録時刻',
  ];
  const groupName = id => GROUPS.find(g => g.id === id);
  const rows = resonances.map(r => {
    const g = groupName(r.toUid);
    return [
      r.fromName || r.fromUid?.slice(0, 8) || '',
      r.toName || (g && g.name) || r.toUid,
      r.presenter || (g && g.presenter) || '',
      r.talkLevel ?? '',
      (r.saikaku ?? []).join('|'),
      (r.domains ?? []).join('|'),
      (r.actions ?? []).join('|'),
      (r.help ?? '').replace(/\n/g, ' '),
      (r.oneworld ?? '').replace(/\n/g, ' '),
      formatTs(r.updatedAt),
    ];
  });
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'alpha-progress-resonance.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function formatTs(ts) {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('ja-JP');
  } catch { return ''; }
}

function Avatar({ icon }) {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
      background: '#EFE7D2', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#9C7D18',
    }}>{icon}</div>
  );
}

function Tag({ children, color }) {
  return (
    <span style={{
      fontSize: 11, padding: '2px 8px', borderRadius: 4,
      background: `${color}1A`, color, fontWeight: 600,
    }}>{children}</span>
  );
}

export default function ProgressAdmin({ user, onLogout }) {
  const [resonances, setResonances] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, 'alpha_events', EVENT_ID, 'resonance'));
        setResonances(snap.docs.map(d => d.data()));
      } catch (e) {
        console.warn('[ProgressAdmin] load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const respondents = new Set(resonances.map(r => r.fromUid)).size;

  return (
    <div style={{
      maxWidth: 920, margin: '0 auto', minHeight: '100vh', padding: 16,
      background: T.bg, color: T.text, fontFamily: T.fontFamily,
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 4px 16px', borderBottom: `1px solid ${T.border}`, marginBottom: 20, flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{EVENT_TITLE}　集計</div>
          <div style={{ fontSize: 11, color: T.accent, letterSpacing: '0.12em', marginTop: 2 }}>
            回答 {resonances.length} 件 ・ 回答者 {respondents} 名
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => exportCSV(resonances)} disabled={!resonances.length} style={{
            background: resonances.length ? T.accent : T.border, color: '#fff', border: 'none',
            fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 8,
            cursor: resonances.length ? 'pointer' : 'not-allowed',
          }}>CSV出力</button>
          <button onClick={onLogout} style={{
            background: 'transparent', border: `1px solid ${T.border}`, color: T.muted,
            fontSize: 11, padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
          }}>ログアウト</button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            border: `3px solid ${T.border}`, borderTopColor: T.accent,
            animation: 'spin 1s linear infinite',
          }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {GROUPS.map(g => {
            const entries = resonances
              .filter(r => r.toUid === g.id)
              .sort((a, b) => (b.talkLevel || 0) - (a.talkLevel || 0));
            const avg = entries.length
              ? (entries.reduce((s, r) => s + (r.talkLevel || 0), 0) / entries.length).toFixed(1)
              : '—';
            return (
              <div key={g.id} style={{
                background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <Avatar icon={g.icon} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{g.name}</div>
                    <div style={{ fontSize: 11.5, color: T.accent, marginTop: 2, fontWeight: 700 }}>発表：{g.presenter}</div>
                  </div>
                  <div style={{ fontSize: 12, color: T.muted, textAlign: 'right' }}>
                    {entries.length} 件<br />
                    <span style={{ fontSize: 11 }}>平均 {avg}</span>
                  </div>
                </div>

                {entries.length === 0 ? (
                  <div style={{ fontSize: 12, color: T.muted, padding: '8px 0' }}>まだ回答がありません</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {entries.map((r, i) => (
                      <div key={i} style={{
                        borderTop: `1px solid ${T.borderSubtle}`, paddingTop: 10,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{r.fromName || '—'}</span>
                          <span style={{
                            fontSize: 11, background: T.accentBg, color: T.accent,
                            padding: '2px 8px', borderRadius: 4, fontWeight: 700,
                          }}>後で話したい度 {r.talkLevel}</span>
                          {(r.saikaku ?? []).map((s, j) => <Tag key={`s${j}`} color="#6B5A9A">{s}</Tag>)}
                          {(r.actions ?? []).map((s, j) => <Tag key={`a${j}`} color="#2D7A4A">{s}</Tag>)}
                        </div>
                        {(r.domains ?? []).length > 0 && (
                          <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>領域: {(r.domains ?? []).join('・')}</div>
                        )}
                        {r.help && <div style={{ fontSize: 12, color: T.sub, marginTop: 4 }}>★力になれること: {r.help}</div>}
                        {r.oneworld && <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>★One World活用: {r.oneworld}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
