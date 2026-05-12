import { useState, useEffect, useRef } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { db, signOutUser } from '../../firebase';
import { PRESENTERS, UAAM16, EVENT_ID } from '../uaam16';

const S = {
  app: {
    maxWidth: 960, margin: '0 auto', minHeight: '100vh',
    padding: 16, background: '#0a0a0b', color: '#f4f4f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif',
    fontSize: 15, lineHeight: 1.6,
  },
};

function tagName(id) {
  return UAAM16.find(t => t.id === id)?.name ?? id;
}

export default function AlphaAdmin({ user, onLogout }) {
  const [resonances, setResonances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('top3'); // 'top3' | 'raw'

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

  // 各プレゼンターへの共鳴をtalkLevelでソートしてTOP3を計算
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
          border: '3px solid #2a2a35', borderTopColor: '#e63946',
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={S.app}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 4px 16px', borderBottom: '1px solid #2a2a35', marginBottom: 20,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>α管理画面</div>
          <div style={{ fontSize: 12, color: '#71717a', marginTop: 2 }}>
            {resonances.length} 件のデータ
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a
            href="/alpha"
            style={{
              padding: '6px 12px', background: 'transparent',
              border: '1px solid #2a2a35', borderRadius: 8,
              color: '#a1a1aa', fontSize: 13, textDecoration: 'none',
            }}
          >
            入力画面
          </a>
          <button onClick={onLogout} style={{
            background: 'transparent', border: '1px solid #2a2a35',
            color: '#71717a', fontSize: 11, padding: '4px 10px',
            borderRadius: 6, cursor: 'pointer',
          }}>ログアウト</button>
        </div>
      </div>

      {/* Tab */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['top3', 'TOP3一覧'], ['raw', '全データ']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            style={{
              padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${view === key ? '#e63946' : '#2a2a35'}`,
              background: view === key ? '#e63946' : 'transparent',
              color: view === key ? '#fff' : '#a1a1aa',
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
      ) : view === 'raw' ? (
        <RawView resonances={resonances} />
      ) : null}
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
            background: '#14141a', border: '1px solid #2a2a35',
            borderRadius: 12, padding: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: '#1c1c24', border: '1px solid #2a2a35',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: '#a1a1aa', flexShrink: 0,
              }}>
                {p.name.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: '#71717a' }}>{totalResponses}人が入力</div>
              </div>
            </div>

            {entries.length === 0 ? (
              <div style={{ fontSize: 12, color: '#71717a', padding: '8px 0' }}>データなし</div>
            ) : (
              entries.map((r, i) => (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '8px 0',
                  borderTop: i === 0 ? 'none' : '1px solid #1c1c24',
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: ['#e63946', '#a1a1aa', '#71717a'][i] + '22',
                    border: `1px solid ${['#e63946', '#a1a1aa', '#71717a'][i]}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    color: ['#e63946', '#a1a1aa', '#71717a'][i],
                    flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {r.fromName || r.fromUid.slice(0, 8)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{
                        fontSize: 11, background: '#e6394620', color: '#e63946',
                        padding: '2px 6px', borderRadius: 4, fontWeight: 700,
                      }}>
                        Lv.{r.talkLevel}
                      </span>
                      {r.tags?.map(tid => (
                        <span key={tid} style={{
                          fontSize: 10, color: '#71717a',
                          background: '#1c1c24', padding: '2px 6px', borderRadius: 4,
                        }}>
                          {tagName(tid)}
                        </span>
                      ))}
                    </div>
                    {r.memo && (
                      <div style={{ fontSize: 11, color: '#71717a', marginTop: 4 }}>
                        {r.memo}
                      </div>
                    )}
                  </div>
                </div>
              ))
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
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#71717a' }}>
        データがありません
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%', borderCollapse: 'collapse',
        fontSize: 12, color: '#a1a1aa',
      }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #2a2a35' }}>
            {['聞き手', '話し手', 'Lv', '才覚タグ', 'メモ'].map(h => (
              <th key={h} style={{
                padding: '8px 12px', textAlign: 'left',
                color: '#71717a', fontWeight: 600, fontSize: 11,
                letterSpacing: '0.05em',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resonances.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid #1c1c24' }}>
              <td style={{ padding: '10px 12px' }}>{r.fromName || r.fromUid?.slice(0, 8)}</td>
              <td style={{ padding: '10px 12px', fontWeight: 600, color: '#f4f4f5' }}>{r.toName}</td>
              <td style={{ padding: '10px 12px' }}>
                <span style={{
                  background: '#e6394620', color: '#e63946',
                  padding: '2px 6px', borderRadius: 4, fontWeight: 700,
                }}>
                  {r.talkLevel}
                </span>
              </td>
              <td style={{ padding: '10px 12px' }}>
                {r.tags?.map(id => tagName(id)).join(' / ') || '—'}
              </td>
              <td style={{ padding: '10px 12px', color: '#71717a' }}>{r.memo || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── PDF一括書き出し ──────────────────────────────────────────
function buildCardHtml(presenter, entries, resonances) {
  const totalResponses = resonances.filter(r => r.toUid === presenter.uid).length;
  const rankColors = ['#e63946', '#a1a1aa', '#71717a'];

  const rows = entries.length === 0
    ? '<p style="color:#888;font-size:13px;margin:12px 0">まだデータがありません</p>'
    : entries.map((r, i) => `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-top:${i === 0 ? 'none' : '1px solid #222'}">
          <div style="width:26px;height:26px;border-radius:50%;border:1.5px solid ${rankColors[i]};
            display:flex;align-items:center;justify-content:center;
            font-size:12px;font-weight:700;color:${rankColors[i]};flex-shrink:0;">
            ${i + 1}
          </div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#f0f0f0">${r.fromName || '—'}</div>
            <div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:4px">
              <span style="font-size:11px;background:#3a0a0d;color:#e63946;padding:2px 8px;border-radius:4px;font-weight:700">
                Lv.${r.talkLevel}
              </span>
              ${(r.tags ?? []).map(tid => {
                const tag = UAAM16.find(t => t.id === tid);
                return `<span style="font-size:11px;color:#888;background:#222;padding:2px 8px;border-radius:4px">${tag?.name ?? tid}</span>`;
              }).join('')}
            </div>
            ${r.memo ? `<div style="font-size:11px;color:#888;margin-top:4px">${r.memo}</div>` : ''}
          </div>
        </div>`
    ).join('');

  return `
    <div style="
      width:640px;padding:32px;background:#14141a;border-radius:16px;
      border:1px solid #2a2a35;
      font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Noto Sans JP',sans-serif;
      color:#f4f4f5;
    ">
      <div style="font-size:11px;color:#555;letter-spacing:0.15em;margin-bottom:20px">
        RETREAT α 2026 — 共鳴シート
      </div>
      <div style="display:flex;align-items:center;gap:16px;padding-bottom:20px;border-bottom:1px solid #2a2a35;margin-bottom:20px">
        <div style="width:56px;height:56px;border-radius:50%;background:#1c1c24;border:1px solid #2a2a35;
          display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#a1a1aa;flex-shrink:0;">
          ${presenter.name.charAt(0)}
        </div>
        <div>
          <div style="font-size:22px;font-weight:800">${presenter.name}</div>
          <div style="font-size:12px;color:#555;margin-top:4px">${totalResponses}人が入力</div>
        </div>
      </div>
      <div style="font-size:12px;color:#555;margin-bottom:10px;letter-spacing:0.1em">
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
          scale: 2,
          backgroundColor: '#14141a',
          useCORS: true,
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
        border: '1px solid #2a2a35',
        background: 'transparent',
        color: exporting ? '#71717a' : '#10b981',
        fontSize: 13,
        opacity: exporting ? 0.6 : 1,
      }}
    >
      {exporting ? 'PDF生成中…' : '全員PDF書き出し'}
    </button>
  );
}
