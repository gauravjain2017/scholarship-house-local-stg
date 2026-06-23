import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getItem, setItem, StorageKeys } from '@/storage/secure';
import {
  palettes,
  type ThemeColors,
  type ThemeMode,
} from '@/theme';

interface ThemeContextValue {
  /** Active mode — 'light' | 'dark'. */
  mode: ThemeMode;
  /** Convenience flag, equal to `mode === 'dark'`. */
  isDark: boolean;
  /** The active color palette for the current mode. */
  colors: ThemeColors;
  /** Flip between light and dark. */
  toggle: () => void;
  /** Set an explicit mode. */
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const DEFAULT_MODE: ThemeMode = 'light';

/**
 * Provides the active color mode to the whole app. The user's choice is a
 * manual Light/Dark toggle (no OS-follow) and is persisted to secure storage
 * so it survives app restarts.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_MODE);
  const mountedRef = useRef(true);

  // Restore the saved preference on mount.
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const saved = await getItem(StorageKeys.themeMode);
        if ((saved === 'light' || saved === 'dark') && mountedRef.current) {
          setModeState(saved);
        }
      } catch {
        // Ignore — fall back to the default mode.
      }
    })();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const persist = useCallback((next: ThemeMode) => {
    setItem(StorageKeys.themeMode, next).catch(() => {});
  }, []);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      persist(next);
    },
    [persist],
  );

  const toggle = useCallback(() => {
    setModeState((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      persist(next);
      return next;
    });
  }, [persist]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      isDark: mode === 'dark',
      colors: palettes[mode],
      toggle,
      setMode,
    }),
    [mode, toggle, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return ctx;
}

/**
 * Build a memoised StyleSheet from a factory that takes the active palette.
 *
 * Usage:
 *   const makeStyles = (colors: ThemeColors) =>
 *     StyleSheet.create({ box: { backgroundColor: colors.card } });
 *
 *   function MyComponent() {
 *     const styles = useThemedStyles(makeStyles);
 *     ...
 *   }
 *
 * The factory must be defined at module scope (stable identity) so the memo
 * only recomputes when the color mode changes.
 */
export function useThemedStyles<T>(factory: (colors: ThemeColors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}

export type { ThemeColors, ThemeMode } from '@/theme';
