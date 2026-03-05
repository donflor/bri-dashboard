'use client';

import { useEnvironment } from '@/contexts/EnvironmentContext';

export default function EnvironmentToggle() {
  const { environment, setEnvironment } = useEnvironment();
  const isSandbox = environment === 'sandbox';

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setEnvironment(isSandbox ? 'production' : 'sandbox')}
        className={`
          relative flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium
          transition-all duration-300 border
          ${isSandbox
            ? 'bg-amber-950/50 border-amber-600/40 text-amber-300 hover:bg-amber-950/70'
            : 'bg-emerald-950/50 border-emerald-600/40 text-emerald-300 hover:bg-emerald-950/70'
          }
        `}
        title={`Switch to ${isSandbox ? 'Production' : 'BTP Sandbox'}`}
      >
        <span className={`
          inline-block h-2.5 w-2.5 rounded-full transition-colors duration-300
          ${isSandbox ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}
        `} />
        <span className="select-none">
          {isSandbox ? 'BTP Sandbox' : 'Production'}
        </span>
        <svg
          className={`h-3.5 w-3.5 transition-transform duration-300 ${isSandbox ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      </button>
    </div>
  );
}
