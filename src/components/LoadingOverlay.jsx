import LoadingScreen from '../screens/LoadingScreen';
import UaamLoadingScreen from '../screens/uaam/UAAMLoadingScreen';

export default function LoadingOverlay({ kind, onCancel }) {
  const isUaam = kind === 'uaam';
  const Screen = isUaam ? UaamLoadingScreen : LoadingScreen;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: isUaam ? '#F5F0E8' : '#0A0908',
      }}
    >
      <Screen />
      {onCancel && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 'clamp(28px, 8vh, 72px)',
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              pointerEvents: 'auto',
              border: `1px solid ${isUaam ? '#D4C9B0' : 'rgba(245,240,232,0.22)'}`,
              background: isUaam ? 'rgba(255,255,255,0.58)' : 'rgba(245,240,232,0.06)',
              color: isUaam ? '#7A7060' : '#D4C9B0',
              borderRadius: 8,
              padding: '10px 22px',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              boxShadow: isUaam ? '0 10px 24px rgba(42,37,32,0.08)' : 'none',
            }}
          >
            キャンセル
          </button>
        </div>
      )}
    </div>
  );
}
