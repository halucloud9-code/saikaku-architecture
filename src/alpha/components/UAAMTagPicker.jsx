import { UAAM16, DOMAINS } from '../uaam16';

const DOMAIN_COLORS = {
  '構想': '#3b82f6',
  '実装': '#10b981',
  '変革': '#f59e0b',
  '統合': '#a855f7',
};

export default function UAAMTagPicker({ selected, onChange }) {
  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (next.size >= 3) return;
      next.add(id);
    }
    onChange(next);
  };

  return (
    <div>
      {DOMAINS.map(domain => (
        <div key={domain} style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 10, color: '#71717a', letterSpacing: '0.1em',
            textTransform: 'uppercase', marginBottom: 6,
          }}>
            {domain}領域
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {UAAM16.filter(t => t.domain === domain).map(t => {
              const isSelected = selected.has(t.id);
              const isDisabled = !isSelected && selected.size >= 3;
              return (
                <button
                  key={t.id}
                  onClick={() => toggle(t.id)}
                  disabled={isDisabled}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 16,
                    border: `1px solid ${isSelected ? 'transparent' : '#2a2a35'}`,
                    background: isSelected ? DOMAIN_COLORS[domain] : 'transparent',
                    color: isSelected ? '#fff' : '#a1a1aa',
                    fontSize: 12,
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.35 : 1,
                    transition: 'all 0.1s',
                  }}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
