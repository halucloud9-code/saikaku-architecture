const LEVELS = [
  { value: 1, label: 'Ⅰ', sub: '少し' },
  { value: 2, label: 'Ⅱ', sub: '気になる' },
  { value: 3, label: 'Ⅲ', sub: '話したい' },
  { value: 4, label: 'Ⅳ', sub: '強く' },
  { value: 5, label: 'Ⅴ', sub: '即' },
];

export default function TalkLevelSelector({ value, onChange }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
      {LEVELS.map(l => (
        <button
          key={l.value}
          onClick={() => onChange(l.value)}
          style={{
            padding: '12px 0',
            border: `1px solid ${value === l.value ? '#C4922A' : '#E0D8CE'}`,
            background: value === l.value ? '#C4922A' : '#FFFFFF',
            color: value === l.value ? '#fff' : '#6A5A4A',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 15,
            fontWeight: 600,
            transition: 'all 0.1s',
            textAlign: 'center',
          }}
        >
          {l.label}
          <span style={{
            display: 'block', fontSize: 9,
            marginTop: 2, opacity: 0.7, fontWeight: 400,
          }}>
            {l.sub}
          </span>
        </button>
      ))}
    </div>
  );
}
