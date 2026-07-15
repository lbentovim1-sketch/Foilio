'use client';

import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onDismiss?: () => void;
}

export function Toast({ message, type = 'info', onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (!visible) return null;

  const bg = type === 'success' ? 'rgba(63,190,126,0.15)' : type === 'error' ? 'rgba(227,90,82,0.15)' : 'rgba(91,156,245,0.15)';
  const border = type === 'success' ? 'var(--green)' : type === 'error' ? 'var(--red)' : 'var(--blue)';
  const color = type === 'success' ? 'var(--green)' : type === 'error' ? 'var(--red)' : 'var(--blue)';

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: '8px',
      padding: '12px 16px',
      color,
      fontSize: '14px',
      fontWeight: 500,
      zIndex: 100,
      maxWidth: '320px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      cursor: 'pointer',
    }} onClick={() => { setVisible(false); onDismiss?.(); }}>
      {message}
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    setToast({ message, type });
  }

  function ToastComponent() {
    if (!toast) return null;
    return <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />;
  }

  return { showToast, ToastComponent };
}
