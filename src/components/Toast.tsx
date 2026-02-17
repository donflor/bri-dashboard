'use client';
import { useEffect, useState } from 'react';

export interface ToastItem {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'error';
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed top-16 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map(t => (
        <ToastNotification key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastNotification({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, 3000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const colors = {
    info: 'bg-blue-500/90',
    success: 'bg-green-500/90',
    error: 'bg-red-500/90',
  };

  return (
    <div
      className={`${exiting ? 'animate-toast-out' : 'animate-toast-in'} ${colors[toast.type || 'info']} rounded-xl px-4 py-3 text-sm text-white shadow-lg cursor-pointer`}
      onClick={() => { setExiting(true); setTimeout(() => onDismiss(toast.id), 300); }}
    >
      {toast.message}
    </div>
  );
}
