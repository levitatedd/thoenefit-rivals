import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';

import { dayOf } from '@/features/scoring';

import { demoReducer, initialDemoState, type DemoAction, type DemoState } from './state';
import { buildDemoWorld, type DemoWorld } from './world';

interface DemoContextValue {
  state: DemoState;
  world: DemoWorld;
  dispatch: (action: DemoAction) => void;
  /** Moves the demo clock forward to `ms` (epoch, demo time). */
  jumpTo: (ms: number) => void;
  reset: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

interface DemoProviderProps {
  children: ReactNode;
  /** Injectable clock and time zone for tests. */
  now?: () => number;
  timeZone?: string;
}

/**
 * Holds the interactive demo (#3) in memory. Nothing is stored or sent anywhere; closing the
 * app or "Reset demo" returns to the defaults.
 */
export function DemoProvider({ children, now = Date.now, timeZone }: DemoProviderProps) {
  const [zone] = useState(() => timeZone ?? deviceTimeZone());
  const [state, dispatch] = useReducer(demoReducer, undefined, () =>
    initialDemoState(dayOf(now(), zone)),
  );
  const world = useMemo(
    () => buildDemoWorld(state, now(), zone),
    // Rebuilt whenever the demo changes; the clock is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, zone],
  );
  const jumpTo = useCallback(
    (ms: number) => {
      dispatch({ type: 'advance-clock', toMs: ms, nowMs: now() });
    },
    [now],
  );
  const reset = useCallback(() => {
    dispatch({ type: 'reset', anchorDate: dayOf(now(), zone) });
  }, [now, zone]);
  const value = useMemo(
    () => ({ state, world, dispatch, jumpTo, reset }),
    [state, world, jumpTo, reset],
  );
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const value = useContext(DemoContext);
  if (!value) throw new Error('useDemo must be used inside <DemoProvider>');
  return value;
}
