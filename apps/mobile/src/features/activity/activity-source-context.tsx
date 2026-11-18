import { createContext, useContext, useState, type ReactNode } from 'react';

import { SimulatedActivitySource } from './simulated-source';
import type { ActivityDataSource } from './types';

const ActivitySourceContext = createContext<ActivityDataSource | null>(null);

interface ActivitySourceProviderProps {
  children: ReactNode;
  /** Override the data source (tests, previews, future native adapters). */
  source?: ActivityDataSource;
}

/**
 * Supplies the active health-data adapter to the app. Until native
 * integrations exist, this always defaults to simulated data.
 */
export function ActivitySourceProvider({ children, source }: ActivitySourceProviderProps) {
  const [defaultSource] = useState<ActivityDataSource>(() => new SimulatedActivitySource());
  return (
    <ActivitySourceContext.Provider value={source ?? defaultSource}>
      {children}
    </ActivitySourceContext.Provider>
  );
}

export function useActivitySource(): ActivityDataSource {
  const source = useContext(ActivitySourceContext);
  if (!source) {
    throw new Error('useActivitySource must be used inside <ActivitySourceProvider>');
  }
  return source;
}
