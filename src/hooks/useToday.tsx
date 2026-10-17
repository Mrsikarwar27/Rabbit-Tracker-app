import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { localDateKey } from '@/lib/dates';

/**
 * Reactive "today" in LOCAL calendar time.
 * Recomputes when the app returns to foreground or every 60s in the
 * foreground, so a running app rolls over correctly at midnight.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => localDateKey());

  useEffect(() => {
    const sync = () => {
      const next = localDateKey();
      setToday((prev) => (prev === next ? prev : next));
    };
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    const interval = setInterval(sync, 60_000);
    sync();
    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, []);

  return today;
}
