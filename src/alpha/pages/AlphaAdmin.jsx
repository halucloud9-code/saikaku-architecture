import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { db } from '../../firebase';
import { PRESENTERS, EVENT_ID } from '../uaam16';

const T = {
  bg: '#F5F0E8', card: '#FFFFFF', border: '#E0D8CE', borderSubtle: '#EDE8E0',
  text: '#2A2520', muted: '#8A7A6A', sub: '#6A5A4A',
  accent: '#C4922A', accentBg: 'rgba(196,146,42,0.10)',
  green: '#2D7A4A', greenBg: 'rgba(45,122,74,0.10)',
  purple: '#6B5A9A', purpleBg: 'rgba(107,90,154,0.10)',
  blue: '#2D5A8A', blueBg: 'rgba(45,90,138,0.10)',
  red: '#a84432', redBg: 'rgba(168,68,50,0.10)',
  fontFamily: "'Noto Serif JP', 'Hiragino Sans', sans-serif",
};

const TABS = [
  { key: 'summary', label: '集計' },
  { key: 'matching', label: 'マッチング' },
  { key: 'listener', label: '聞き手別' },
  { key: 'top3', label: 'TOP3' },
  { key: 'raw', label: '全データ' },
];

function badge(label, color, bg) {
  return (
    <span key={label} style={{
      fontSize: 11, background: bg, color,
      padding: '2px 8px', borderRadius: 4, fontWeight: 600,
    }}>{label}</span>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 12, padding: 16,
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      ...style,
    }}>
      {children}
    </div>
  );
}

function Avatar({ name, size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: T.bg, border: `1px solid ${T.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, color: T.accent, flexShrink: 0,
    }}>
      {name?.charAt(0)}
    </div>
  );
}

// ── CSV書き出し ──────────────────────────────────────
function exportCSV(resonances) {
  const headers = ['聞き手', '話し手', '後で話したい度', '才覚', '領域', 'アクション', '手伝えること', 'こうなれば動ける'];
  const rows = resonances.map(r => [
    r.fromName || r.fromUid?.slice(0, 8),
    r.toName,
    r.talkLevel,
    (r.saikaku ?? []).join('|'),
    (r.domains ?? []).join('|'),
    (r.actions ?? []).join('|'),
    r.help ?? '',
    r.condition ?? '',
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'retreat-alpha-resonance.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ── 集計ビュー（B） ───────────────────────────────────
function SummaryView({ resonances }) {
  const [selected, setSelected] = useState(PRESENTERS[0].uid);
  const presenter = PRESENTERS.find(p => p.uid === selected);
  const entries = resonances.filter(r => r.toUid === selected);

  const count = (field) => {
    const map = {};
    entries.forEach(r => (r[field] ?? []).forEach(v => { map[v] = (map[v] || 0) + 1; }));
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  };

  const avgLevel = entries.length
    ? (entries.reduce((s, r) => s + r.talkLevel, 0) / entries.length).toFixed(1)
    : '—';

  const Bar = ({ label, count: cnt, max, color, bg }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <div style={{ width: 100, fontSize: 12, color: T.sub, flexShrink: 0, textAlign: 'right' }}>{label}</div>
      <div style={{ flex: 1, background: T.bg, borderRadius: 4, overflow: 'hidden', height: 18 }}>
        <div style={{
          width: `${(cnt / max) * 100}%`, height: '100%',
          background: color, borderRadius: 4, transition: 'width 0.4s ease',
          display: 'flex', alignItems: 'center', paddingLeft: 6,
        }}>
          <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{cnt}</span>
        </div>
      </div>
    </div>
  );

  const saikakuData = count('saikaku');
  const domainsData = count('domains');
  const actionsData = count('actions');
  const maxS = saikakuData[0]?.[1] || 1;
  const maxD = domainsData[0]?.[1] || 1;
  const maxA = actionsData[0]?.[1] || 1;

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {/* 左：話し手選択 */}
      <div style={{ width: 180, flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: T.muted, marginBottom: 8, letterSpacing: '0.1em' }}>話し手を選択</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {PRESENTERS.map(p => {
            const cnt = resonances.filter(r => r.toUid === p.uid).length;
            return (
              <button
                key={p.uid}
                onClick={() => setSelected(p.uid)}
                style={{
                  padding: '8px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                  border: `1px solid ${selected === p.uid ? T.accent : T.border}`,
                  background: selected === p.uid ? T.accentBg : T.card,
                  color: selected === p.uid ? T.accent : T.text,
                  fontSize: 13, fontWeight: selected === p.uid ? 700 : 400,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span>{p.name}</span>
                <span style={{ fontSize: 11, color: selected === p.uid ? T.accent : T.muted }}>{cnt}件</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 右：集計 */}
      <div style={{ flex: 1, minWidth: 280 }}>
        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <Avatar name={presenter?.name} size={44} />
            <div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{presenter?.name}</div>
              <div style={{ fontSize: 12, color: T.muted }}>
                {entries.length}人が入力　平均Lv {avgLevel}
              </div>
            </div>
          </div>
        </Card>

        {entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: T.muted }}>データなし</div>
        ) : (
          <>
            {saikakuData.length > 0 && (
              <Card style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 10, fontWeight: 600, letterSpacing: '0.05em' }}>① 才覚で感じたもの</div>
                {saikakuData.map(([k, v]) => <Bar key={k} label={k} count={v} max={maxS} color={T.purple} bg={T.purpleBg} />)}
              </Card>
            )}
            {domainsData.length > 0 && (
              <Card style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 10, fontWeight: 600, letterSpacing: '0.05em' }}>② 親和性を感じた領域</div>
                {domainsData.map(([k, v]) => <Bar key={k} label={k} count={v} max={maxD} color={T.blue} bg={T.blueBg} />)}
              </Card>
            )}
            {actionsData.length > 0 && (
              <Card>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 10, fontWeight: 600, letterSpacing: '0.05em' }}>③ この人と…</div>
                {actionsData.map(([k, v]) => <Bar key={k} label={k} count={v} max={maxA} color={T.green} bg={T.greenBg} />)}
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── マッチングビュー（A） ──────────────────────────────
function MatchingView({ resonances }) {
  const [minLevel, setMinLevel] = useState(3);

  const filtered = resonances
    .filter(r => r.talkLevel >= minLevel)
    .sort((a, b) => b.talkLevel - a.talkLevel);

  const isMutual = (r) => {
    return resonances.some(
      s => s.fromName === r.toName && s.toName === r.fromName && s.talkLevel >= minLevel
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: T.sub }}>Lv以上を表示：</span>
        {[1, 2, 3, 4, 5].map(v => (
          <button
            key={v}
            onClick={() => setMinLevel(v)}
            style={{
              width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
              border: `1px solid ${minLevel === v ? T.accent : T.border}`,
              background: minLevel === v ? T.accent : T.card,
              color: minLevel === v ? '#fff' : T.sub,
              fontSize: 13, fontWeight: 700,
            }}
          >{v}</button>
        ))}
        <span style={{ fontSize: 12, color: T.muted }}>{filtered.length}件</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(r => {
          const mutual = isMutual(r);
          return (
            <Card key={r.id} style={{ padding: '12px 16px', borderColor: mutual ? T.accent : T.border }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {mutual && (
                  <span style={{
                    fontSize: 10, background: T.accentBg, color: T.accent,
                    padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                    letterSpacing: '0.05em',
                  }}>相互</span>
                )}
                <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
                  {r.fromName || '—'}
                </span>
                <span style={{ fontSize: 12, color: T.muted }}>→</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
                  {r.toName}
                </span>
                <span style={{
                  fontSize: 12, background: T.accentBg, color: T.accent,
                  padding: '2px 8px', borderRadius: 4, fontWeight: 700, marginLeft: 4,
                }}>Lv.{r.talkLevel}</span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {(r.actions ?? []).map(s => badge(s, T.green, T.greenBg))}
                </div>
              </div>
              {(r.help || r.condition) && (
                <div style={{ marginTop: 6, fontSize: 12, color: T.muted }}>
                  {r.help && <span>手伝い: {r.help}　</span>}
                  {r.condition && <span>条件: {r.condition}</span>}
                </div>
              )}
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: T.muted }}>
            該当するデータがありません
          </div>
        )}
      </div>
    </div>
  );
}

// ── 聞き手別ビュー（C） ──────────────────────────────
function ListenerView({ resonances }) {
  const names = [...new Set(resonances.map(r => r.fromName || r.fromUid?.slice(0, 8)))].sort();
  const [selected, setSelected] = useState(names[0] ?? '');
  const entries = resonances.filter(r => (r.fromName || r.fromUid?.slice(0, 8)) === selected);

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ width: 180, flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: T.muted, marginBottom: 8, letterSpacing: '0.1em' }}>聞き手を選択</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {names.map(name => (
            <button
              key={name}
              onClick={() => setSelected(name)}
              style={{
                padding: '8px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                border: `1px solid ${selected === name ? T.accent : T.border}`,
                background: selected === name ? T.accentBg : T.card,
                color: selected === name ? T.accent : T.text,
                fontSize: 13, fontWeight: selected === name ? 700 : 400,
              }}
            >{name}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 280 }}>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>
          {selected} — {entries.length}人分入力済み
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries
            .sort((a, b) => b.talkLevel - a.talkLevel)
            .map(r => (
              <Card key={r.id} style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <Avatar name={r.toName} size={32} />
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{r.toName}</span>
                  <span style={{
                    fontSize: 12, background: T.accentBg, color: T.accent,
                    padding: '2px 8px', borderRadius: 4, fontWeight: 700,
                  }}>Lv.{r.talkLevel}</span>
                </div>
                {r.saikaku?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                    {r.saikaku.map(s => badge(s, T.purple, T.purpleBg))}
                  </div>
                )}
                {r.domains?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                    {r.domains.map(s => badge(s, T.blue, T.blueBg))}
                  </div>
                )}
                {r.actions?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                    {r.actions.map(s => badge(s, T.green, T.greenBg))}
                  </div>
                )}
                {r.help && <div style={{ fontSize: 11, color: T.muted }}>手伝い: {r.help}</div>}
                {r.condition && <div style={{ fontSize: 11, color: T.muted }}>条件: {r.condition}</div>}
              </Card>
            ))}
          {entries.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: T.muted }}>データなし</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── TOP3ビュー（既存） ────────────────────────────────
function Top3View({ top3Map, resonances }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
      {PRESENTERS.map(p => {
        const entries = top3Map.get(p.uid) ?? [];
        const total = resonances.filter(r => r.toUid === p.uid).length;
        return (
          <Card key={p.uid}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Avatar name={p.name} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: T.muted }}>{total}人が入力</div>
              </div>
            </div>
            {entries.length === 0 ? (
              <div style={{ fontSize: 12, color: T.muted }}>データなし</div>
            ) : entries.map((r, i) => {
              const colors = [T.accent, T.muted, '#B0A090'];
              const c = colors[i];
              return (
                <div key={r.id} style={{
                  display: 'flex', gap: 10, padding: '8px 0',
                  borderTop: i === 0 ? 'none' : `1px solid ${T.borderSubtle}`,
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    border: `1px solid ${c}`, background: `${c}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: c, flexShrink: 0,
                  }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{r.fromName || '—'}</span>
                      <span style={{
                        fontSize: 11, background: T.accentBg, color: T.accent,
                        padding: '1px 6px', borderRadius: 4, fontWeight: 700,
                      }}>Lv.{r.talkLevel}</span>
                    </div>
                    {r.saikaku?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
                        {r.saikaku.map(s => badge(s, T.purple, T.purpleBg))}
                      </div>
                    )}
                    {r.actions?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
                        {r.actions.map(s => badge(s, T.green, T.greenBg))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </Card>
        );
      })}
    </div>
  );
}

// ── 全データビュー（既存） ────────────────────────────
function RawView({ resonances }) {
  if (resonances.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: T.muted }}>データなし</div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {resonances.map(r => (
        <Card key={r.id} style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontWeight: 700 }}>
              {r.fromName || r.fromUid?.slice(0, 8)}
              <span style={{ color: T.muted, fontWeight: 400 }}> → </span>
              {r.toName}
            </span>
            <span style={{ fontSize: 11, background: T.accentBg, color: T.accent, padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
              Lv.{r.talkLevel}
            </span>
          </div>
          {r.saikaku?.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>{r.saikaku.map(s => badge(s, T.purple, T.purpleBg))}</div>}
          {r.domains?.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>{r.domains.map(s => badge(s, T.blue, T.blueBg))}</div>}
          {r.actions?.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>{r.actions.map(s => badge(s, T.green, T.greenBg))}</div>}
          {r.help && <div style={{ fontSize: 12, color: T.muted }}>手伝い: {r.help}</div>}
          {r.condition && <div style={{ fontSize: 12, color: T.muted }}>条件: {r.condition}</div>}
        </Card>
      ))}
    </div>
  );
}

// ── PDF ─────────────────────────────────────────────
function buildCardHtml(presenter, entries, resonances) {
  const total = resonances.filter(r => r.toUid === presenter.uid).length;
  const rankColors = [T.accent, '#8A7A6A', '#B0A090'];
  const rows = entries.length === 0
    ? '<p style="color:#8A7A6A;font-size:13px;margin:12px 0">まだデータがありません</p>'
    : entries.map((r, i) => `
      <div style="display:flex;gap:10px;padding:10px 0;border-top:${i === 0 ? 'none' : '1px solid #EDE8E0'}">
        <div style="width:26px;height:26px;border-radius:50%;border:1.5px solid ${rankColors[i]};
          display:flex;align-items:center;justify-content:center;
          font-size:12px;font-weight:700;color:${rankColors[i]};flex-shrink:0">${i + 1}</div>
        <div>
          <div style="font-size:14px;font-weight:700;color:#2A2520">${r.fromName || '—'}</div>
          <div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px">
            <span style="font-size:11px;background:rgba(196,146,42,0.10);color:#C4922A;padding:2px 8px;border-radius:4px;font-weight:700">Lv.${r.talkLevel}</span>
            ${(r.saikaku ?? []).map(s => `<span style="font-size:11px;color:#6B5A9A;background:rgba(107,90,154,0.10);padding:2px 8px;border-radius:4px">${s}</span>`).join('')}
          </div>
          ${(r.actions ?? []).length > 0 ? `<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px">${r.actions.map(s => `<span style="font-size:11px;color:#2D7A4A;background:rgba(45,122,74,0.10);padding:2px 8px;border-radius:4px">${s}</span>`).join('')}</div>` : ''}
          ${r.help ? `<div style="font-size:11px;color:#8A7A6A;margin-top:4px">手伝い: ${r.help}</div>` : ''}
        </div>
      </div>`).join('');
  return `<div style="width:640px;padding:32px;background:#FFFFFF;border-radius:16px;border:1px solid #E0D8CE;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Noto Sans JP',sans-serif;color:#2A2520">
    <div style="font-size:11px;color:#8A7A6A;letter-spacing:0.15em;margin-bottom:20px">RETREAT α 2026 — 共鳴シート</div>
    <div style="display:flex;align-items:center;gap:16px;padding-bottom:20px;border-bottom:1px solid #E0D8CE;margin-bottom:20px">
      <div style="width:56px;height:56px;border-radius:50%;background:#F5F0E8;border:1px solid #E0D8CE;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#C4922A;flex-shrink:0">${presenter.name.charAt(0)}</div>
      <div><div style="font-size:22px;font-weight:800;color:#2A2520">${presenter.name}</div><div style="font-size:12px;color:#8A7A6A;margin-top:4px">${total}人が入力</div></div>
    </div>
    <div style="font-size:12px;color:#8A7A6A;margin-bottom:10px;letter-spacing:0.1em">あなたを最も呼んだ3人</div>
    ${rows}
  </div>`;
}

function PdfExportButton({ top3Map, resonances }) {
  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      for (let i = 0; i < PRESENTERS.length; i++) {
        const p = PRESENTERS[i];
        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;left:-9999px;top:0;';
        container.innerHTML = buildCardHtml(p, top3Map.get(p.uid) ?? [], resonances);
        document.body.appendChild(container);
        const canvas = await html2canvas(container.firstElementChild, { scale: 2, backgroundColor: '#FFFFFF', useCORS: true });
        document.body.removeChild(container);
        const imgW = 190;
        const imgH = (canvas.height / canvas.width) * imgW;
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, (297 - imgH) / 2, imgW, imgH);
      }
      pdf.save('retreat-alpha-top3.pdf');
    } catch (e) {
      console.error('[PDF]', e);
      alert('PDF生成に失敗しました');
    } finally {
      setExporting(false);
    }
  };
  return (
    <button onClick={handleExport} disabled={exporting} style={{
      padding: '8px 14px', borderRadius: 8, cursor: exporting ? 'not-allowed' : 'pointer',
      border: `1px solid ${T.border}`, background: T.card,
      color: exporting ? T.muted : T.green, fontSize: 13, opacity: exporting ? 0.6 : 1,
    }}>{exporting ? 'PDF生成中…' : 'PDF書き出し'}</button>
  );
}

// ── メイン ───────────────────────────────────────────
export default function AlphaAdmin({ user, onLogout }) {
  const [resonances, setResonances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('summary');

  useEffect(() => {
    getDocs(collection(db, 'alpha_events', EVENT_ID, 'resonance'))
      .then(snap => {
        const data = [];
        snap.forEach(d => data.push({ id: d.id, ...d.data() }));
        setResonances(data);
      })
      .catch(e => console.error('[AlphaAdmin]', e))
      .finally(() => setLoading(false));
  }, []);

  const top3Map = (() => {
    const map = new Map();
    PRESENTERS.forEach(p => {
      map.set(p.uid, resonances.filter(r => r.toUid === p.uid).sort((a, b) => b.talkLevel - a.talkLevel).slice(0, 3));
    });
    return map;
  })();

  if (loading) return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${T.border}`, borderTopColor: T.accent, animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', minHeight: '100vh', padding: 16, background: T.bg, color: T.text, fontFamily: T.fontFamily, fontSize: 15 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 4px 16px', borderBottom: `1px solid ${T.border}`, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>α管理画面</div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{resonances.length} 件のデータ</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => exportCSV(resonances)} style={{
            padding: '7px 12px', background: 'transparent', border: `1px solid ${T.border}`,
            borderRadius: 8, color: T.blue, fontSize: 13, cursor: 'pointer',
          }}>CSV書き出し</button>
          <PdfExportButton top3Map={top3Map} resonances={resonances} />
          <a href="/alpha" style={{ padding: '6px 12px', border: `1px solid ${T.border}`, borderRadius: 8, color: T.sub, fontSize: 13, textDecoration: 'none' }}>入力画面</a>
          <button onClick={onLogout} style={{ background: 'transparent', border: `1px solid ${T.border}`, color: T.muted, fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}>ログアウト</button>
          <a href="/alpha/map" target="_blank" rel="noreferrer" style={{
            padding: '7px 12px', background: 'transparent', border: `1px solid ${T.border}`,
            borderRadius: 8, color: T.sub, fontSize: 13, textDecoration: 'none',
          }}>マップ</a>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setView(key)} style={{
            padding: '8px 18px', borderRadius: 8, cursor: 'pointer',
            border: `1px solid ${view === key ? T.accent : T.border}`,
            background: view === key ? T.accent : T.card,
            color: view === key ? '#fff' : T.sub,
            fontSize: 13, fontWeight: view === key ? 700 : 400,
          }}>{label}</button>
        ))}
      </div>

      {view === 'summary'  && <SummaryView resonances={resonances} />}
      {view === 'matching' && <MatchingView resonances={resonances} />}
      {view === 'listener' && <ListenerView resonances={resonances} />}
      {view === 'top3'     && <Top3View top3Map={top3Map} resonances={resonances} />}
      {view === 'raw'      && <RawView resonances={resonances} />}
    </div>
  );
}
