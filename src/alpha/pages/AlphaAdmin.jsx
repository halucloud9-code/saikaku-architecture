import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { db } from '../../firebase';
import { PRESENTERS, EVENT_ID } from '../uaam16';

const T = {
  bg: '#F5F0E8',
  card: '#FFFFFF',
  border: '#E0D8CE',
  borderSubtle: '#EDE8E0',
  text: '#2A2520',
  muted: '#8A7A6A',
  sub: '#6A5A4A',
  accent: '#C4922A',
  accentBg: 'rgba(196,146,42,0.10)',
  fontFamily: "'Noto Serif JP', 'Hiragino Sans', sans-serif",
};

const S = {
  app: {
    maxWidth: 960, margin: '0 auto', minHeight: '100vh',
    padding: 16, background: T.bg, color: T.text,
    fontFamily: T.fontFamily, fontSize: 15, lineHeight: 1.6,
  },
};

function badge(label, color, bgColor) {
  return (
    <span key={label} style={{
      fontSize: 11, background: bgColor, color,
      padding: '2px 8px', borderRadius: 4, fontWeight: 600,
    }}>
      {label}
    </span>
  );
}

export default function AlphaAdmin({ user, onLogout }) {
  const [resonances, setResonances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('top3');

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, 'alpha_events', EVENT_ID, 'resonance'));
        const data = [];
        snap.forEach(d => data.push({ id: d.id, ...d.data() }));
        setResonances(data);
      } catch (e) {
        console.error('[AlphaAdmin] load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const top3Map = (() => {
    const map = new Map();
    PRESENTERS.forEach(p => {
      const entries = resonances
        .filter(r => r.toUid === p.uid)
        .sort((a, b) => b.talkLevel - a.talkLevel)
        .slice(0, 3);
      map.set(p.uid, entries);
    });
    return map;
  })();

  if (loading) {
    return (
      <div style={{ ...S.app, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: `3px solid ${T.border}`, borderTopColor: T.accent,
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={S.app}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 4px 16px', borderBottom: `1px solid ${T.border}`, marginBottom: 20,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>α管理画面</div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{resonances.length} 件のデータ</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/alpha" style={{
            padding: '6px 12px', background: 'transparent',
            border: `1px solid ${T.border}`, borderRadius: 8,
            color: T.sub, fontSize: 13, textDecoration: 'none',
          }}>入力画面</a>
          <button onClick={onLogout} style={{
            background: 'transparent', border: `1px solid ${T.border}`,
            color: T.muted, fontSize: 11, padding: '4px 10px',
            borderRadius: 6, cursor: 'pointer',
          }}>ログアウト</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['top3', 'TOP3一覧'], ['raw', '全データ']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            style={{
              padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${view === key ? T.accent : T.border}`,
              background: view === key ? T.accent : T.card,
              color: view === key ? '#fff' : T.sub,
              fontSize: 13, fontWeight: view === key ? 700 : 400,
            }}
          >
            {label}
          </button>
        ))}
        <PdfExportButton top3Map={top3Map} resonances={resonances} />
      </div>

      {view === 'top3' ? (
        <Top3View top3Map={top3Map} resonances={resonances} />
      ) : (
        <RawView resonances={resonances} />
      )}
    </div>
  );
}

function ResonanceEntry({ r, rank }) {
  const rankColors = [T.accent, '#8A7A6A', '#B0A090'];
  const color = rankColors[rank] ?? T.muted;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 0', borderTop: rank === 0 ? 'none' : `1px solid ${T.borderSubtle}`,
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        background: `${color}18`, border: `1px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color, flexShrink: 0,
      }}>
        {rank + 1}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
            {r.fromName || r.fromUid?.slice(0, 8)}
          </span>
          <span style={{
            fontSize: 11, background: T.accentBg, color: T.accent,
            padding: '2px 6px', borderRadius: 4, fontWeight: 700,
          }}>
            Lv.{r.talkLevel}
          </span>
        </div>
        {r.saikaku?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {r.saikaku.map(s => badge(s, '#6B5A9A', 'rgba(107,90,154,0.10)'))}
          </div>
        )}
        {r.actions?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {r.actions.map(s => badge(s, '#2D7A4A', 'rgba(45,122,74,0.10)'))}
          </div>
        )}
        {r.help && (
          <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>手伝い: {r.help}</div>
        )}
        {r.condition && (
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>条件: {r.condition}</div>
        )}
      </div>
    </div>
  );
}

function Top3View({ top3Map, resonances }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: 12,
    }}>
      {PRESENTERS.map(p => {
        const entries = top3Map.get(p.uid) ?? [];
        const totalResponses = resonances.filter(r => r.toUid === p.uid).length;
        return (
          <div key={p.uid} style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 12, padding: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: T.bg, border: `1px solid ${T.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: T.accent, flexShrink: 0,
              }}>
                {p.name.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{p.name}</div>
                <div style={{ fontSize: 11, color: T.muted }}>{totalResponses}人が入力</div>
              </div>
            </div>
            {entries.length === 0 ? (
              <div style={{ fontSize: 12, color: T.muted, padding: '8px 0' }}>データなし</div>
            ) : (
              entries.map((r, i) => <ResonanceEntry key={r.id} r={r} rank={i} />)
            )}
          </div>
        );
      })}
    </div>
  );
}

function RawView({ resonances }) {
  if (resonances.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: T.muted }}>
        データがありません
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {resonances.map(r => (
        <div key={r.id} style={{
          background: T.card, border: `1px solid ${T.border}`,
          borderRadius: 10, padding: '14px 16px', fontSize: 13,
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: T.text }}>
              {r.fromName || r.fromUid?.slice(0, 8)}
              <span style={{ color: T.muted, fontWeight: 400 }}> → </span>
              {r.toName}
            </span>
            <span style={{
              fontSize: 11, background: T.accentBg, color: T.accent,
              padding: '2px 8px', borderRadius: 4, fontWeight: 700,
            }}>
              Lv.{r.talkLevel}
            </span>
          </div>
          {r.saikaku?.length > 0 && (
            <div style={{ marginBottom: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              <span style={{ fontSize: 11, color: T.muted, marginRight: 4 }}>才覚:</span>
              {r.saikaku.map(s => badge(s, '#6B5A9A', 'rgba(107,90,154,0.10)'))}
            </div>
          )}
          {r.domains?.length > 0 && (
            <div style={{ marginBottom: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              <span style={{ fontSize: 11, color: T.muted, marginRight: 4 }}>領域:</span>
              {r.domains.map(s => badge(s, '#2D5A8A', 'rgba(45,90,138,0.10)'))}
            </div>
          )}
          {r.actions?.length > 0 && (
            <div style={{ marginBottom: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              <span style={{ fontSize: 11, color: T.muted, marginRight: 4 }}>アクション:</span>
              {r.actions.map(s => badge(s, '#2D7A4A', 'rgba(45,122,74,0.10)'))}
            </div>
          )}
          {r.help && (
            <div style={{ fontSize: 12, color: T.sub, marginTop: 4 }}>
              <span style={{ color: T.muted }}>手伝い: </span>{r.help}
            </div>
          )}
          {r.condition && (
            <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>
              <span style={{ color: T.muted }}>条件: </span>{r.condition}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function buildCardHtml(presenter, entries, resonances) {
  const totalResponses = resonances.filter(r => r.toUid === presenter.uid).length;
  const rankColors = [T.accent, '#8A7A6A', '#B0A090'];

  const rows = entries.length === 0
    ? '<p style="color:#8A7A6A;font-size:13px;margin:12px 0">まだデータがありません</p>'
    : entries.map((r, i) => `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-top:${i === 0 ? 'none' : '1px solid #EDE8E0'}">
          <div style="width:26px;height:26px;border-radius:50%;border:1.5px solid ${rankColors[i]};
            display:flex;align-items:center;justify-content:center;
            font-size:12px;font-weight:700;color:${rankColors[i]};flex-shrink:0;">
            ${i + 1}
          </div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#2A2520">${r.fromName || '—'}</div>
            <div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px">
              <span style="font-size:11px;background:rgba(196,146,42,0.10);color:#C4922A;padding:2px 8px;border-radius:4px;font-weight:700">
                Lv.${r.talkLevel}
              </span>
              ${(r.saikaku ?? []).map(s => `<span style="font-size:11px;color:#6B5A9A;background:rgba(107,90,154,0.10);padding:2px 8px;border-radius:4px">${s}</span>`).join('')}
            </div>
            ${(r.actions ?? []).length > 0 ? `
            <div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px">
              ${r.actions.map(s => `<span style="font-size:11px;color:#2D7A4A;background:rgba(45,122,74,0.10);padding:2px 8px;border-radius:4px">${s}</span>`).join('')}
            </div>` : ''}
            ${r.help ? `<div style="font-size:11px;color:#8A7A6A;margin-top:4px">手伝い: ${r.help}</div>` : ''}
            ${r.condition ? `<div style="font-size:11px;color:#8A7A6A;margin-top:2px">条件: ${r.condition}</div>` : ''}
          </div>
        </div>`
    ).join('');

  return `
    <div style="
      width:640px;padding:32px;background:#FFFFFF;border-radius:16px;
      border:1px solid #E0D8CE;
      font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Noto Sans JP',sans-serif;
      color:#2A2520;
    ">
      <div style="font-size:11px;color:#8A7A6A;letter-spacing:0.15em;margin-bottom:20px">
        RETREAT α 2026 — 共鳴シート
      </div>
      <div style="display:flex;align-items:center;gap:16px;padding-bottom:20px;border-bottom:1px solid #E0D8CE;margin-bottom:20px">
        <div style="width:56px;height:56px;border-radius:50%;background:#F5F0E8;border:1px solid #E0D8CE;
          display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#C4922A;flex-shrink:0;">
          ${presenter.name.charAt(0)}
        </div>
        <div>
          <div style="font-size:22px;font-weight:800;color:#2A2520">${presenter.name}</div>
          <div style="font-size:12px;color:#8A7A6A;margin-top:4px">${totalResponses}人が入力</div>
        </div>
      </div>
      <div style="font-size:12px;color:#8A7A6A;margin-bottom:10px;letter-spacing:0.1em">
        あなたを最も呼んだ3人
      </div>
      ${rows}
    </div>
  `;
}

function PdfExportButton({ top3Map, resonances }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = 210;
      const pageH = 297;

      for (let i = 0; i < PRESENTERS.length; i++) {
        const p = PRESENTERS[i];
        const entries = top3Map.get(p.uid) ?? [];

        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;left:-9999px;top:0;';
        container.innerHTML = buildCardHtml(p, entries, resonances);
        document.body.appendChild(container);

        const canvas = await html2canvas(container.firstElementChild, {
          scale: 2, backgroundColor: '#FFFFFF', useCORS: true,
        });
        document.body.removeChild(container);

        const imgW = pageW - 20;
        const imgH = (canvas.height / canvas.width) * imgW;
        const y = (pageH - imgH) / 2;

        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, y, imgW, imgH);
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
    <button
      onClick={handleExport}
      disabled={exporting}
      style={{
        padding: '8px 16px', borderRadius: 8, cursor: exporting ? 'not-allowed' : 'pointer',
        border: `1px solid ${T.border}`, background: T.card,
        color: exporting ? T.muted : '#2D7A4A', fontSize: 13,
        opacity: exporting ? 0.6 : 1,
      }}
    >
      {exporting ? 'PDF生成中…' : '全員PDF書き出し'}
    </button>
  );
}
