'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: string;
}

export function Dialog({ open, onClose, title, children, maxWidth = 'max-w-lg' }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className={`${maxWidth} w-full mx-4 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl`}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-xl leading-none">&times;</button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
