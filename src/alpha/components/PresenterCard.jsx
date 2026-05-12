export default function PresenterCard({ presenter, done, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? 'rgba(196,146,42,0.06)' : '#FFFFFF',
        border: `1px solid ${active ? '#C4922A' : done ? '#2D7A4A' : '#E0D8CE'}`,
        borderRadius: 12,
        padding: '14px 10px',
        cursor: 'pointer',
        textAlign: 'center',
        position: 'relative',
        transition: 'all 0.15s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      {done && (
        <span style={{
          position: 'absolute', top: 8, right: 10,
          color: '#2D7A4A', fontSize: 14, fontWeight: 700,
        }}>✓</span>
      )}
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: '#F5F0E8', border: '1px solid #E0D8CE',
        margin: '0 auto 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 600, color: '#C4922A',
      }}>
        {presenter.name.charAt(0)}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#2A2520' }}>
        {presenter.name}
      </div>
    </div>
  );
}
