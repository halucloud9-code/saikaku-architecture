export default function PresenterCard({ presenter, done, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? '#1c1c24' : '#14141a',
        border: `1px solid ${active ? '#e63946' : done ? '#10b981' : '#2a2a35'}`,
        borderRadius: 12,
        padding: '14px 10px',
        cursor: 'pointer',
        textAlign: 'center',
        position: 'relative',
        transition: 'all 0.15s',
      }}
    >
      {done && (
        <span style={{
          position: 'absolute', top: 8, right: 10,
          color: '#10b981', fontSize: 14, fontWeight: 700,
        }}>✓</span>
      )}
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: '#1c1c24', border: '1px solid #2a2a35',
        margin: '0 auto 8px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 600, color: '#a1a1aa',
      }}>
        {presenter.name.charAt(0)}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#f4f4f5' }}>
        {presenter.name}
      </div>
    </div>
  );
}
