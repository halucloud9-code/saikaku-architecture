import { useState, useEffect, useRef, useMemo } from 'react';
import { auth, signOutUser } from '../firebase';
import { Chart, computePcts, CHART_COLORS } from '../utils/chartUtils';
import ActivationPanel from '../ActivationPanel';

function MiniDonut({ axes, colors }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const pcts = computePcts(axes);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    chartRef.current = new Chart(canvasRef.current, {
      type: 'doughnut',
      data: {
        datasets: [{ data: pcts, backgroundColor: colors, borderWidth: 0 }],
      },
      options: {
        cutout: '65%',
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        animation: { duration: 600 },
      },
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} width={60} height={60} />;
}

function UserModal({ user: u, onClose }) {
  if (!u) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(42,37,32,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FDFCFA',
          borderRadius: 16,
          border: '1px solid #D4C9B0',
          padding: '32px',
          maxWidth: 720,
          width: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(42,37,32,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {u.photoURL && (
              <img src={u.photoURL} alt={u.name} style={{ width: 48, height: 48, borderRadius: '50%', border: '2px solid #D4C9B0' }} />
            )}
            <div>
              <div style={{ fontFamily: 'Shippori Mincho, serif', fontSize: 20, fontWeight: 700, color: '#2A2520' }}>{u.name}</div>
              <div style={{ fontSize: 13, color: '#7A7060' }}>{u.email}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #D4C9B0',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 13,
              color: '#7A7060',
            }}
          >
            ✕ 閉じる
          </button>
        </div>

        {/* 才覚領域 */}
        <div
          style={{
            background: '#2A2520',
            borderRadius: 10,
            padding: '16px 20px',
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: 11, color: '#7A7060', letterSpacing: '0.12em', marginBottom: 8 }}>才覚領域</div>
          <div
            style={{
              fontFamily: 'Shippori Mincho, serif',
              fontSize: 18,
              fontWeight: 700,
              color: '#FDFCFA',
              lineHeight: 1.6,
            }}
          >
            {u.selectedKakuchiiki}
          </div>
        </div>

        {/* 3グラフ */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
            marginBottom: 24,
          }}
        >
          {[
            { label: '才能', type: 'talentAxes', colors: CHART_COLORS.talent, color: '#C4922A' },
            { label: '価値観', type: 'valueAxes', colors: CHART_COLORS.value, color: '#4A6FA5' },
            { label: '情熱', type: 'passionAxes', colors: CHART_COLORS.passion, color: '#A84432' },
          ].map(({ label, type, colors, color }) => (
            <div
              key={type}
              style={{
                background: '#F5F0E8',
                borderRadius: 10,
                padding: '16px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 10 }}>{label}</div>
              <MiniDonut axes={u[type]} colors={colors} />
              <div style={{ marginTop: 10 }}>
                {['axis1', 'axis2', 'axis3'].map((k) => (
                  <div key={k} style={{ fontSize: 11, color: '#7A7060', marginTop: 4 }}>
                    {u[type]?.[k]?.name || '-'}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* インサイト */}
        {u.insight && (
          <div
            style={{
              background: '#F5F0E8',
              borderRadius: 10,
              padding: '16px 20px',
            }}
          >
            <div style={{ fontSize: 11, color: '#7A7060', letterSpacing: '0.12em', marginBottom: 8 }}>CORE INSIGHT</div>
            <p style={{ fontSize: 14, color: '#2A2520', lineHeight: 1.8, margin: 0 }}>{u.insight}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── UAAM詳細モーダル ───────────────────────────────────────
const AXIS_META = [
  { key: 'mindset',   label: '志', color: '#4A6FA5',
    subs: ['meaning','mindfulness','mindshift','mastery'],
    subLabels: ['根幹力','受容力','転換力','熟達力'] },
  { key: 'literacy',  label: '知', color: '#2E8B57',
    subs: ['learning','logical','life','leadership'],
    subLabels: ['謙学力','論理力','活用力','統率力'] },
  { key: 'competency',label: '技', color: '#C4922A',
    subs: ['critical','creativity','communication','collaboration'],
    subLabels: ['本質力','創造力','伝達力','協働力'] },
  { key: 'impact',    label: '衝', color: '#A84432',
    subs: ['idea','innovation','implementation','influence'],
    subLabels: ['起動力','革新力','実装力','影響力'] },
];

function UAAMModal({ user: u, onClose }) {
  if (!u) return null;
  const subcategoryScores = Object.values(u.scores || {}).reduce((acc, domain) => {
    if (domain?.subs) Object.assign(acc, domain.subs);
    return acc;
  }, {});
  const MAX_SUB = 20;

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(42,37,32,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FDFCFA', borderRadius: 16,
          border: '1px solid #D4C9B0', padding: '32px',
          maxWidth: 760, width: '100%', maxHeight: '88vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(42,37,32,0.22)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {u.photoURL
              ? <img src={u.photoURL} alt={u.name} style={{ width: 48, height: 48, borderRadius: '50%', border: '2px solid #D4C9B0' }} />
              : <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#D4C9B0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#7A7060' }}>{u.name?.[0] || '?'}</div>
            }
            <div>
              <div style={{ fontFamily: 'Shippori Mincho, serif', fontSize: 20, fontWeight: 700, color: '#2A2520' }}>{u.name}</div>
              <div style={{ fontSize: 13, color: '#7A7060' }}>{u.email}</div>
              {u.uaamUpdatedAt && <div style={{ fontSize: 11, color: '#B0A898', marginTop: 2 }}>診断日: {new Date(u.uaamUpdatedAt).toLocaleDateString('ja-JP')}</div>}
            </div>
          </div>
          <button onClick={onClose} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #D4C9B0', background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#7A7060' }}>
            ✕ 閉じる
          </button>
        </div>

        {/* Vフラグ警告 */}
        {(() => {
          const v = u.vAnswers || {};
          const warns = [];
          if (v['V1'] === 5 && v['V2'] === 5) warns.push({ text: 'V1&V2=5：客観視の精度に課題の可能性', color: '#A84432', bg: '#FFF5F5' });
          else {
            if (v['V1'] === 5) warns.push({ text: 'V1=5：自己評価が高め傾向', color: '#C4922A', bg: '#FFFBF0' });
            if (v['V2'] === 5) warns.push({ text: 'V2=5：自己評価が高め傾向', color: '#C4922A', bg: '#FFFBF0' });
          }
          const v3 = v['V3']; const q46 = u.answers?.[46] ?? u.answers?.['46'];
          if (v3 != null && q46 != null && Math.abs(v3 - q46) >= 2) warns.push({ text: `V3差=${Math.abs(v3-q46)}：回答一貫性にブレあり`, color: '#4A6FA5', bg: '#F0F4FF' });
          return warns.length > 0 ? (
            <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {warns.map((w, i) => (
                <div key={i} style={{ background: w.bg, border: `1px solid ${w.color}40`, borderRadius: 8, padding: '8px 14px', fontSize: 12, color: w.color, fontWeight: 600 }}>
                  ⚠ {w.text}
                </div>
              ))}
            </div>
          ) : null;
        })()}

        {/* 4軸スコア */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          {AXIS_META.map(({ key, label, color }) => {
            const s = u.scores?.[key];
            const pct = s ? (s.percentage ?? Math.round((s.total / (s.max || 1)) * 100)) : 0;
            return (
              <div key={key} style={{ background: '#F5F0E8', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#7A7060', letterSpacing: '0.1em', marginBottom: 6 }}>{label}</div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{pct}<span style={{ fontSize: 14 }}>%</span></div>
                <div style={{ fontSize: 11, color: '#B0A898', marginTop: 4 }}>{s?.total ?? '—'} / {s?.max ?? '—'}</div>
              </div>
            );
          })}
        </div>

        {/* 16サブカテゴリ スコアバー */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7A7060', letterSpacing: '0.1em', marginBottom: 12 }}>16 SUBCATEGORY SCORES</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '8px 24px' }}>
            {AXIS_META.map(({ key, label, color, subs, subLabels }) =>
              subs.map((subKey, i) => {
                const score = u.scores?.[key]?.subs?.[subKey] ?? subcategoryScores[subKey] ?? 0;
                const pct = Math.round((score / MAX_SUB) * 100);
                return (
                  <div key={subKey} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color, fontWeight: 700, width: 16, textAlign: 'center' }}>{label}</span>
                    <span style={{ fontSize: 12, color: '#2A2520', width: 52, flexShrink: 0 }}>{subLabels[i]}</span>
                    <div style={{ flex: 1, height: 6, background: '#E8E0D4', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s' }} />
                    </div>
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700, color, width: 24, textAlign: 'right' }}>{score}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 発動分析パネル */}
        {Object.keys(subcategoryScores).length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <ActivationPanel scores={subcategoryScores} threshold={13} />
          </div>
        )}

        {/* AI分析 */}
        {u.analysis?.type_name && (
          <div style={{ background: '#F5F0E8', borderRadius: 10, padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#7A7060', letterSpacing: '0.12em', marginBottom: 8 }}>TYPE</div>
            <div style={{ fontFamily: 'Shippori Mincho, serif', fontSize: 16, fontWeight: 700, color: '#2A2520', lineHeight: 1.6 }}>{u.analysis.type_name}</div>
          </div>
        )}
        {u.analysis?.axis_analysis && (
          <div>
            <div style={{ fontSize: 11, color: '#7A7060', letterSpacing: '0.1em', marginBottom: 10 }}>AI 軸別分析</div>
            {Object.entries(u.analysis.axis_analysis).map(([axKey, text]) => {
              const ax = AXIS_META.find(a => a.key === axKey);
              if (!ax || !text) return null;
              return (
                <div key={axKey} style={{ borderLeft: `3px solid ${ax.color}`, padding: '10px 16px', marginBottom: 10, background: `${ax.color}08`, borderRadius: '0 8px 8px 0' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: ax.color, marginBottom: 4 }}>{ax.label}</div>
                  <p style={{ fontSize: 13, color: '#4A4035', margin: 0, lineHeight: 1.8 }}>{text}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// haruによる実力グレード（現実パフォーマンス評価）
// 係数: A+=0.95 / A=0.90 / B+=0.85 / B=0.80 / C+=0.75 / C=0.70 / D+=0.65 / D=0.60 / E+=0.55 / E=0.50
const HARU_GRADES = {
  '塚原厚':    'A+', '根本輝尚':   'A',
  '島田知幸':  'B+', '藤原宗賢':   'B',  '澤井洸蕎': 'B',
  '原田祐介':  'C',  '道又正人':   'C', '谷口尚子':  'C', '浜口奈々': 'C',
  '坂口友亮':  'D',  '鈴木栄子':   'D', '守永博貴':  'D', '宇田川昌美': 'D', '飯塚玄氣': 'D',
};

const GRADE_COEFF = {
  'A+': 0.95, 'A': 0.90, 'B+': 0.85, 'B': 0.80,
  'C+': 0.75, 'C': 0.70, 'D+': 0.65, 'D': 0.60,
  'E+': 0.55, 'E': 0.50,
};

const GRADE_STYLE = {
  'A+': { bg: '#0A2A0A', color: '#4EF84E' },
  'A':  { bg: '#1A3A1A', color: '#7EE87E' },
  'B+': { bg: '#0A1E2A', color: '#4EC8F8' },
  'B':  { bg: '#1A2B3A', color: '#7EC8E8' },
  'C+': { bg: '#2A2510', color: '#F0D870' },
  'C':  { bg: '#2A2A1A', color: '#D4C97E' },
  'D+': { bg: '#2A1A10', color: '#F0A870' },
  'D':  { bg: '#3A1A1A', color: '#E87E7E' },
  'E+': { bg: '#2A1A2A', color: '#D07ED0' },
  'E':  { bg: '#2A1A2A', color: '#B060B0' },
};

function GradeBadge({ name }) {
  const grade = HARU_GRADES[name?.replace(/\s/g, '')];
  if (!grade) return null;
  const s = GRADE_STYLE[grade];
  return (
    <span style={{
      display: 'inline-block',
      background: s.bg,
      color: s.color,
      fontSize: 10,
      fontWeight: 700,
      padding: '1px 6px',
      borderRadius: 4,
      marginLeft: 6,
      letterSpacing: '0.05em',
    }}>{s.label}</span>
  );
}

export default function AdminScreen({ user, onBack, onLogout }) {
  const [users, setUsers] = useState([]);
  const [uaamUsers, setUaamUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [selectedUaam, setSelectedUaam] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('saikaku'); // 'saikaku' | 'uaam'
  const [vFilter, setVFilter] = useState('all'); // 'all' | 'v1_high' | 'v2_high' | 'v3_diff' | 'critical'

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      if (!auth.currentUser) throw new Error('認証セッションが切れました');
      const idToken = await auth.currentUser.getIdToken(true);
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '取得に失敗しました');
      setUsers(data.users || []);
      setUaamUsers(data.uaamUsers || []);
    } catch (e) {
      setError(e.message || 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    let url = null;
    try {
      if (!auth.currentUser) throw new Error('認証セッションが切れました');
      const idToken = await auth.currentUser.getIdToken(true);
      const res = await fetch('/api/admin/export', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error('エクスポートに失敗しました');
      const blob = await res.blob();
      url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'saikaku_results.csv';
      a.click();
    } catch (e) {
      alert(e.message);
    } finally {
      if (url) URL.revokeObjectURL(url); // 成功・失敗どちらでも解放
      setExporting(false);
    }
  };

  // 本日・今週のカウントと検索フィルター（usersやsearchが変わった時のみ再計算）
  const today = useMemo(() => {
    const todayStr = new Date().toDateString();
    return users.filter((u) => u.createdAt && new Date(u.createdAt).toDateString() === todayStr).length;
  }, [users]);

  const thisWeek = useMemo(() => {
    const now = Date.now();
    return users.filter((u) => {
      if (!u.createdAt) return false;
      return (now - new Date(u.createdAt).getTime()) / (1000 * 60 * 60 * 24) < 7;
    }).length;
  }, [users]);

  const filtered = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.selectedKakuchiiki?.toLowerCase().includes(q)
    );
  }, [users, search]);

  // UAAMユーザーのフィルタリング（検索 + Vフラグフィルタ）
  const filteredUaam = useMemo(() => {
    let list = uaamUsers;
    // 検索フィルタ
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q)
      );
    }
    // Vフラグフィルタ
    if (vFilter !== 'all') {
      list = list.filter((u) => {
        const v = u.vAnswers;
        if (!v) return false;
        if (vFilter === 'v1_high') return v['V1'] === 5;
        if (vFilter === 'v2_high') return v['V2'] === 5;
        if (vFilter === 'critical') return v['V1'] === 5 && v['V2'] === 5;
        if (vFilter === 'v3_diff') {
          const v3 = v['V3'];
          const q46 = u.answers?.[46] ?? u.answers?.['46'];
          if (v3 == null || q46 == null) return false;
          return Math.abs(v3 - q46) >= 2;
        }
        return true;
      });
    }
    return list;
  }, [uaamUsers, search, vFilter]);

  return (
    <div style={{ minHeight: '100vh', background: '#F5F0E8' }}>
      {/* ヘッダー */}
      <div
        style={{
          background: '#2A2520',
          padding: '14px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={onBack}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #7A7060',
              background: 'transparent',
              color: '#D4C9B0',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            ← 戻る
          </button>
          <span
            style={{
              fontFamily: 'Shippori Mincho, serif',
              fontSize: 18,
              fontWeight: 700,
              color: '#FDFCFA',
            }}
          >
            管理画面
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#7A7060' }}>{user.email}</span>
          <button
            onClick={async () => { await signOutUser(); onLogout(); }}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #7A7060',
              background: 'transparent',
              color: '#D4C9B0',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            ログアウト
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 80px' }}>
        {/* サマリーカード */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 32,
          }}
        >
          {[
            { label: '総参加者数', value: users.length, color: '#C4922A' },
            { label: '本日の解析数', value: today, color: '#4A6FA5' },
            { label: '今週の解析数', value: thisWeek, color: '#A84432' },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background: '#FDFCFA',
                borderRadius: 12,
                border: '1px solid #D4C9B0',
                padding: '20px 24px',
                boxShadow: '0 2px 8px rgba(42,37,32,0.04)',
              }}
            >
              <div style={{ fontSize: 12, color: '#7A7060', marginBottom: 8 }}>{item.label}</div>
              <div
                style={{
                  fontFamily: 'Shippori Mincho, serif',
                  fontSize: 36,
                  fontWeight: 700,
                  color: item.color,
                  lineHeight: 1,
                }}
              >
                {loading ? '—' : item.value}
              </div>
            </div>
          ))}
        </div>

        {/* タブ切り替え */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
          {[
            { key: 'saikaku', label: '才覚領域', count: users.length },
            { key: 'uaam', label: 'UAAM診断', count: uaamUsers.length },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: '10px 24px',
                border: 'none',
                borderBottom: tab === key ? '3px solid #C4922A' : '3px solid transparent',
                background: tab === key ? '#FDFCFA' : 'transparent',
                color: tab === key ? '#2A2520' : '#7A7060',
                fontSize: 14,
                fontWeight: tab === key ? 700 : 400,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {label}（{loading ? '—' : count}）
            </button>
          ))}
        </div>

        {tab === 'saikaku' && (<>
        {/* テーブルヘッダー */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2
              style={{
                fontFamily: 'Shippori Mincho, serif',
                fontSize: 18,
                fontWeight: 700,
                color: '#2A2520',
                margin: 0,
              }}
            >
              参加者一覧
            </h2>
            <button
              onClick={fetchUsers}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #D4C9B0',
                background: 'transparent',
                color: '#7A7060',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              更新
            </button>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="名前・メール・才覚領域で検索..."
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid #D4C9B0',
                background: '#FDFCFA',
                fontSize: 13,
                color: '#2A2520',
                width: 260,
                fontFamily: 'Noto Sans JP, sans-serif',
                outline: 'none',
              }}
            />
            <button
              onClick={handleExport}
              disabled={exporting}
              style={{
                padding: '8px 20px',
                borderRadius: 8,
                border: 'none',
                background: '#C4922A',
                color: '#FDFCFA',
                fontSize: 13,
                fontWeight: 600,
                cursor: exporting ? 'wait' : 'pointer',
                opacity: exporting ? 0.7 : 1,
              }}
            >
              {exporting ? '処理中...' : 'CSVエクスポート'}
            </button>
          </div>
        </div>

        {/* エラー */}
        {error && (
          <div
            style={{
              padding: '12px 16px',
              background: '#F8EDEA',
              border: '1px solid #D89080',
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 14,
              color: '#A84432',
            }}
          >
            {error}
          </div>
        )}

        {/* テーブル */}
        <div
          style={{
            background: '#FDFCFA',
            borderRadius: 12,
            border: '1px solid #D4C9B0',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(42,37,32,0.04)',
          }}
        >
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#7A7060' }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: '3px solid #D4C9B0',
                  borderTopColor: '#C4922A',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 12px',
                }}
              />
              読み込み中...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#7A7060', fontSize: 14 }}>
              {search ? '該当する参加者が見つかりません' : 'まだ参加者がいません'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F5F0E8', borderBottom: '2px solid #D4C9B0' }}>
                  {['', '名前', '才覚領域', '価値観', '才能', '情熱', 'Q1', 'Q2', 'Q3', '解析日時', '発動スコア'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#7A7060',
                        letterSpacing: '0.06em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, idx) => (
                  <tr
                    key={u.uid}
                    onClick={() => setSelected(u)}
                    style={{
                      borderBottom: '1px solid #D4C9B0',
                      background: idx % 2 === 0 ? '#FDFCFA' : '#FAF8F4',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#FBF4E8')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? '#FDFCFA' : '#FAF8F4')}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      {u.photoURL ? (
                        <img src={u.photoURL} alt={u.name} style={{ width: 32, height: 32, borderRadius: '50%' }} />
                      ) : (
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: '#D4C9B0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            color: '#7A7060',
                          }}
                        >
                          {u.name?.[0] || '?'}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#2A2520', display: 'flex', alignItems: 'center' }}>
                        {u.name}<GradeBadge name={u.name} />
                      </div>
                      <div style={{ fontSize: 12, color: '#7A7060' }}>{u.email}</div>
                    </td>
                    <td style={{ padding: '12px 16px', maxWidth: 240 }}>
                      <span
                        style={{
                          fontFamily: 'Shippori Mincho, serif',
                          fontSize: 13,
                          color: '#2A2520',
                          lineHeight: 1.5,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {u.selectedKakuchiiki}
                      </span>
                    </td>
                    {[
                      { axes: u.valueAxes,   color: '#4A6FA5', top5: u.inputValueTop5   || u.inputValue   },
                      { axes: u.talentAxes,  color: '#C4922A', top5: u.inputTalentTop5  || u.inputTalent  },
                      { axes: u.passionAxes, color: '#A84432', top5: u.inputPassionTop5 || u.inputPassion },
                    ].map(({ axes, color, top5 }, i) => (
                      <td key={i} style={{ padding: '12px 16px' }}>
                        {/* AIが生成した3軸タグ */}
                        {axes ? (
                          <div>
                            {['axis1', 'axis2', 'axis3'].map((k) => (
                              <span
                                key={k}
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: 100,
                                  background: `${color}15`,
                                  color,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  margin: '2px 2px',
                                }}
                              >
                                {axes[k]?.name || '-'}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#D4C9B0', fontSize: 12 }}>—</span>
                        )}
                        {/* ユーザーが入力した5つ */}
                        {top5 && (
                          <div style={{ marginTop: 4 }}>
                            {top5.split(/[,、，\n]/).map((s) => s.trim()).filter(Boolean).map((item, j) => (
                              <span
                                key={j}
                                style={{
                                  display: 'inline-block',
                                  padding: '1px 6px',
                                  borderRadius: 100,
                                  background: 'transparent',
                                  border: `1px solid ${color}99`,
                                  color: color,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  margin: '2px 2px',
                                }}
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    ))}
                    {[
                      { val: u.inputQ1, color: '#7B5EA7' },
                      { val: u.inputQ2, color: '#7B5EA7' },
                      { val: u.inputQ3, color: '#7B5EA7' },
                    ].map(({ val, color }, qi) => (
                      <td key={`q${qi}`} style={{ padding: '12px 16px', maxWidth: 200 }}>
                        {val
                          ? <span style={{ fontSize: 12, color: '#2A2520', lineHeight: 1.6, display: 'block', whiteSpace: 'pre-wrap' }}>{val}</span>
                          : <span style={{ color: '#D4C9B0', fontSize: 12 }}>—</span>
                        }
                      </td>
                    ))}
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 12, color: '#7A7060' }}>
                        {u.createdAt
                          ? new Date(u.createdAt).toLocaleDateString('ja-JP', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                            })
                          : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      {(() => {
                        const grade = HARU_GRADES[u.name?.replace(/\s/g, '')];
                        const coeff = GRADE_COEFF[grade];
                        if (!coeff || !u.result?.axes) return <span style={{ fontSize: 12, color: '#B0A898' }}>—</span>;
                        const axes = u.result.axes;
                        const total = (axes.mindset || 0) + (axes.literacy || 0) + (axes.competency || 0) + (axes.impact || 0);
                        const activated = Math.round(total * coeff);
                        const s = GRADE_STYLE[grade] || {};
                        return (
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: s.color || '#C4922A' }}>{activated}</span>
                            <span style={{ fontSize: 10, color: '#B0A898', marginLeft: 4 }}>/{total}×{coeff}</span>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#D4C9B0', marginTop: 16 }}>
          {filtered.length} 件表示 / 総計 {users.length} 件
        </p>
        </>)}

        {/* ━━━ UAAMタブ ━━━ */}

        {tab === 'uaam' && (<>
        {/* UAAMヘッダー */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2
              style={{
                fontFamily: 'Shippori Mincho, serif',
                fontSize: 18,
                fontWeight: 700,
                color: '#2A2520',
                margin: 0,
              }}
            >
              UAAM診断結果
            </h2>
            <button
              onClick={fetchUsers}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #D4C9B0',
                background: 'transparent',
                color: '#7A7060',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              更新
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="名前・メールで検索..."
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid #D4C9B0',
                background: '#FDFCFA',
                fontSize: 13,
                color: '#2A2520',
                width: 200,
                fontFamily: 'Noto Sans JP, sans-serif',
                outline: 'none',
              }}
            />
            <select
              value={vFilter}
              onChange={(e) => setVFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #D4C9B0',
                background: '#FDFCFA',
                fontSize: 13,
                color: '#2A2520',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="all">全件表示</option>
              <option value="v1_high">V1=5（盛り傾向）</option>
              <option value="v2_high">V2=5（盛り傾向）</option>
              <option value="critical">V1&V2=5（要注意）</option>
              <option value="v3_diff">V3差≥2（一貫性ブレ）</option>
            </select>
          </div>
        </div>

        {/* UAAMテーブル */}
        <div
          style={{
            background: '#FDFCFA',
            borderRadius: 12,
            border: '1px solid #D4C9B0',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(42,37,32,0.04)',
          }}
        >
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#7A7060' }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: '3px solid #D4C9B0',
                  borderTopColor: '#C4922A',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 12px',
                }}
              />
              読み込み中...
            </div>
          ) : filteredUaam.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#7A7060', fontSize: 14 }}>
              {search || vFilter !== 'all' ? '該当するユーザーが見つかりません' : 'まだUAAM診断結果がありません'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F5F0E8', borderBottom: '2px solid #D4C9B0' }}>
                  {['', '名前', '志', '知', '技', '衝', 'V1', 'V2', 'V3差', 'タイプ', '診断日'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 12px',
                        textAlign: 'left',
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#7A7060',
                        letterSpacing: '0.06em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUaam.map((u, idx) => {
                  const v = u.vAnswers || {};
                  const v3 = v['V3'];
                  const q46 = u.answers?.[46] ?? u.answers?.['46'];
                  const v3Diff = (v3 != null && q46 != null) ? Math.abs(v3 - q46) : null;
                  const v1is5 = v['V1'] === 5;
                  const v2is5 = v['V2'] === 5;
                  const isCritical = v1is5 && v2is5;

                  return (
                    <tr
                      key={u.uid}
                      onClick={() => setSelectedUaam(u)}
                      style={{
                        borderBottom: '1px solid #D4C9B0',
                        background: isCritical ? '#FFF5F5' : idx % 2 === 0 ? '#FDFCFA' : '#FAF8F4',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#F5EFE6'}
                      onMouseLeave={(e) => e.currentTarget.style.background = isCritical ? '#FFF5F5' : idx % 2 === 0 ? '#FDFCFA' : '#FAF8F4'}
                    >
                      <td style={{ padding: '10px 12px' }}>
                        {u.photoURL ? (
                          <img src={u.photoURL} alt={u.name} style={{ width: 32, height: 32, borderRadius: '50%' }} />
                        ) : (
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              background: '#D4C9B0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
                              color: '#7A7060',
                            }}
                          >
                            {u.name?.[0] || '?'}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#2A2520', display: 'flex', alignItems: 'center' }}>
                          {u.name}<GradeBadge name={u.name} />
                        </div>
                        <div style={{ fontSize: 11, color: '#7A7060' }}>{u.email}</div>
                      </td>
                      {/* 4軸スコア */}
                      {['mindset', 'literacy', 'competency', 'impact'].map((axis) => {
                        const s = u.scores?.[axis];
                        const colors = { mindset: '#4A6FA5', literacy: '#2E8B57', competency: '#C4922A', impact: '#A84432' };
                        return (
                          <td key={axis} style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {s ? (
                              <span style={{
                                fontFamily: "'DM Sans', sans-serif",
                                fontSize: 16,
                                fontWeight: 700,
                                color: colors[axis],
                              }}>
                                {s.percentage ?? Math.round((s.total / (s.max || 1)) * 100)}%
                              </span>
                            ) : (
                              <span style={{ color: '#D4C9B0', fontSize: 12 }}>—</span>
                            )}
                          </td>
                        );
                      })}
                      {/* V1 */}
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: 14,
                          fontWeight: 700,
                          color: v1is5 ? '#A84432' : '#7A7060',
                        }}>
                          {v['V1'] ?? '—'}
                        </span>
                      </td>
                      {/* V2 */}
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: 14,
                          fontWeight: 700,
                          color: v2is5 ? '#A84432' : '#7A7060',
                        }}>
                          {v['V2'] ?? '—'}
                        </span>
                      </td>
                      {/* V3差 */}
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: 14,
                          fontWeight: 700,
                          color: v3Diff != null && v3Diff >= 2 ? '#A84432' : '#7A7060',
                        }}>
                          {v3Diff != null ? v3Diff : '—'}
                        </span>
                      </td>
                      {/* タイプ名 */}
                      <td style={{ padding: '10px 12px', maxWidth: 160 }}>
                        <span style={{
                          fontFamily: 'Shippori Mincho, serif',
                          fontSize: 12,
                          color: '#2A2520',
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}>
                          {u.analysis?.type_name || '—'}
                        </span>
                      </td>
                      {/* 診断日 */}
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 12, color: '#7A7060' }}>
                          {u.uaamUpdatedAt
                            ? new Date(u.uaamUpdatedAt).toLocaleDateString('ja-JP', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                              })
                            : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#D4C9B0', marginTop: 16 }}>
          {filteredUaam.length} 件表示 / 総計 {uaamUsers.length} 件
        </p>
        </>)}
      </div>

      {/* 才覚領域 詳細モーダル */}
      {selected && <UserModal user={selected} onClose={() => setSelected(null)} />}

      {/* UAAM 詳細モーダル */}
      {selectedUaam && <UAAMModal user={selectedUaam} onClose={() => setSelectedUaam(null)} />}
    </div>
  );
}