import { useEffect, useRef } from 'react';

const backdropStyle = {
  position: 'fixed', inset: 0, zIndex: 11000,
  background: 'rgba(0,0,0,0.5)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', padding: 24,
};

const panelStyle = {
  width: 'min(420px, 100%)', borderRadius: 8,
  background: '#F5F0E8', color: '#2A2520',
  boxShadow: '0 24px 80px rgba(10,9,8,0.32)', padding: 28,
};

const buttonBaseStyle = {
  borderRadius: 8, padding: '11px 18px',
  fontSize: 14, fontWeight: 700, cursor: 'pointer',
};

export default function NavigationGuardDialog({
  open,
  onConfirm,
  onCancel,
  title = '解析を中断しますか？',
  message = '現在解析中です。このまま戻ると結果は表示されません。中断しますか？',
}) {
  const continueButtonRef = useRef(null), stopButtonRef = useRef(null), previousFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement;
    continueButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;
      const nextTarget = event.shiftKey && document.activeElement === continueButtonRef.current ? stopButtonRef.current
        : !event.shiftKey && document.activeElement === stopButtonRef.current ? continueButtonRef.current : null;
      if (nextTarget) {
        event.preventDefault();
        nextTarget.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus?.();
      previousFocusRef.current = null;
    };
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div style={backdropStyle}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="navigation-guard-title"
        aria-describedby="navigation-guard-message"
        style={panelStyle}
      >
        <h2 id="navigation-guard-title" style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800, lineHeight: 1.4 }}>
          {title}
        </h2>
        <p id="navigation-guard-message" style={{ margin: '0 0 24px', color: '#6A6050', fontSize: 14, lineHeight: 1.8 }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button
            ref={continueButtonRef}
            type="button"
            onClick={onCancel}
            style={{ ...buttonBaseStyle, border: '1px solid #D4C9B0', background: 'transparent', color: '#6A6050' }}
          >
            続ける
          </button>
          <button
            ref={stopButtonRef}
            type="button"
            onClick={onConfirm}
            style={{ ...buttonBaseStyle, border: '1px solid #A84432', background: '#A84432', color: '#FFF8EE' }}
          >
            中断する
          </button>
        </div>
      </div>
    </div>
  );
}
