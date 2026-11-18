import { useCallback, useEffect, useMemo, useState } from 'react';

import { useActivitySource } from './activity-source-context';
import { lastNDays } from './dates';
import type { DailyActivitySummary } from './types';

export type RecentActivityState =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; days: DailyActivitySummary[] };

type SettledState = Exclude<RecentActivityState, { status: 'loading' }>;

/** Loads the last `days` daily summaries (oldest first) from the active source. */
export function useRecentActivity(days: number) {
  const source = useActivitySource();
  const [reloadToken, setReloadToken] = useState(0);
  // A new request object whenever inputs change; results for stale requests are ignored.
  const request = useMemo(() => ({ source, days, reloadToken }), [source, days, reloadToken]);
  const [result, setResult] = useState<{ request: typeof request; state: SettledState } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    request.source
      .getDailySummaries(lastNDays(new Date(), request.days))
      .then(
        (summaries): SettledState => ({ status: 'ready', days: summaries }),
        (error: unknown): SettledState => ({
          status: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
        }),
      )
      .then((state) => {
        if (!cancelled) setResult({ request, state });
      });
    return () => {
      cancelled = true;
    };
  }, [request]);

  const state: RecentActivityState =
    result?.request === request ? result.state : { status: 'loading' };
  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { state, reload };
}
