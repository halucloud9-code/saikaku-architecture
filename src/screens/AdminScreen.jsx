import { useState, useEffect, useRef, useMemo } from 'react';
import { auth, signOutUser } from '../firebase';
import { Chart, computePcts, CHART_COLORS } from '../utils/chartUtils';

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

export default function AdminScreen({ user, onBack, onLogout }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');

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
                  {['', '名前', '才覚領域', '才能', '価値観', '情熱', '解析日時'].map((h) => (
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
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#2A2520' }}>{u.name}</div>
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
                      { axes: u.talentAxes, color: '#C4922A' },
                      { axes: u.valueAxes, color: '#4A6FA5' },
                      { axes: u.passionAxes, color: '#A84432' },
                    ].map(({ axes, color }, i) => (
                      <td key={i} style={{ padding: '12px 16px' }}>
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#D4C9B0', marginTop: 16 }}>
          {filtered.length} 件表示 / 総計 {users.length} 件
        </p>
      </div>

      {/* 詳細モーダル */}
      {selected && <UserModal user={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
