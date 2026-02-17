'use client';

interface Props {
  value: number; // hours
  onChange: (hours: number) => void;
}

const options = [
  { label: '1h', value: 1 },
  { label: '24h', value: 24 },
  { label: '7d', value: 168 },
  { label: '30d', value: 720 },
];

export function TimeRangeSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-1 bg-surface rounded-xl p-1">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            value === opt.value
              ? 'bg-blue-500 text-white'
              : 'text-muted hover:text-primary'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
