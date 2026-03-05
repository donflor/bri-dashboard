'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Environment } from '@/types/btp';

interface EnvironmentContextValue {
  environment: Environment;
  setEnvironment: (env: Environment) => void;
  isSandbox: boolean;
  isProduction: boolean;
}

const EnvironmentContext = createContext<EnvironmentContextValue | undefined>(undefined);

export function EnvironmentProvider({ children }: { children: ReactNode }) {
  const [environment, setEnv] = useState<Environment>('production');

  const setEnvironment = useCallback((env: Environment) => {
    setEnv(env);
  }, []);

  return (
    <EnvironmentContext.Provider
      value={{
        environment,
        setEnvironment,
        isSandbox: environment === 'sandbox',
        isProduction: environment === 'production',
      }}
    >
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironment() {
  const ctx = useContext(EnvironmentContext);
  if (!ctx) throw new Error('useEnvironment must be used within EnvironmentProvider');
  return ctx;
}
