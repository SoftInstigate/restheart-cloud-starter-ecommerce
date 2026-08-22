import { useEffect } from 'react';

interface AlertProps {
  type: 'success' | 'error';
  dismissible?: boolean;
  autoDismiss?: number;
  onClose: () => void;
  children: React.ReactNode;
}

export function Alert({ type, dismissible = true, autoDismiss = 4000, onClose, children }: AlertProps) {
  useEffect(() => {
    if (autoDismiss > 0) {
      const id = setTimeout(onClose, autoDismiss);
      return () => clearTimeout(id);
    }
  }, [autoDismiss, onClose]);

  return (
    <div className={type === 'success' ? 'success-msg' : 'form-error'} role={type === 'success' ? 'status' : 'alert'}>
      <span style={{ flex: 1 }}>{children}</span>
      {dismissible && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          style={{
            flexShrink: 0,
            font: 'inherit',
            fontSize: '1.125rem',
            lineHeight: 1,
            padding: 0,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            opacity: 0.6,
            color: 'inherit',
          }}
        >
          &times;
        </button>
      )}
    </div>
  );
}
