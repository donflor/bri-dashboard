'use client';

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <div className="bg-[var(--bg-card)] rounded-2xl p-12 text-center border border-[var(--border-color)]">
      <div className="text-5xl mb-4">{icon}</div>
      <p className="text-[var(--text-secondary)] font-medium">{title}</p>
      {subtitle && <p className="text-[var(--text-muted)] text-sm mt-2">{subtitle}</p>}
    </div>
  );
}
