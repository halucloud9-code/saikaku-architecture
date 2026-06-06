// 事業グループカード（src/alpha/components/PresenterCard.jsx の事業単位版）
export default function GroupCard({ group, done, active, onClick }) {
  const members = group.members && group.members.length ? group.members.join('・') : '—';
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? 'rgba(196,146,42,0.06)' : '#FFFFFF',
        border: `1.5px solid ${active ? '#C4922A' : done ? '#2D7A4A' : '#E0D8CE'}`,
        borderRadius: 14,
        padding: '14px 14px 12px',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.15s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      {done && (
        <span style={{
          position: 'absolute', top: 8, right: 10,
          fontSize: 10, fontWeight: 700, color: '#1a7a3a',
          background: '#eef8f1', border: '1px solid #b8ddc2',
          borderRadius: 6, padding: '2px 7px',
        }}>✓ 回答済</span>
      )}
      <div style={{
        width: 44, height: 44, flex: 'none', borderRadius: '50%',
        background: '#EFE7D2', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 19, fontWeight: 800, color: '#9C7D18',
      }}>
        {group.icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: '#2A2520', lineHeight: 1.35 }}>
          {group.name}
        </div>
        {group.presenter && (
          <div style={{ fontSize: 11.5, color: '#9C7D18', marginTop: 5, fontWeight: 700 }}>
            発表：{group.presenter}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#8A7A6A', marginTop: 3, lineHeight: 1.4 }}>
          {members}
        </div>
      </div>
    </div>
  );
}
