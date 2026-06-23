import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import {
  addNetworkStateListener,
  getNetworkStateAsync,
  NetworkStateType,
  type NetworkState,
} from 'expo-network';

interface NetworkContextValue {
  /** True only when we're confident the device has no usable connection. */
  isOffline: boolean;
  /** True when connected to a network with reachable internet (best-effort). */
  isOnline: boolean;
}

const NetworkContext = createContext<NetworkContextValue | undefined>(undefined);

// How often to re-probe connectivity as a safety net (ms). The native change
// listener is the primary signal; this catches events it misses.
const POLL_INTERVAL_MS = 5000;

/**
 * Decide whether the device is offline from a network-state snapshot.
 *
 * `null` means we haven't probed yet — return false so the banner doesn't
 * flash during the brief unknown window at startup. Otherwise the device is
 * offline when the network type is NONE, or when connectivity / internet
 * reachability is *explicitly* false (on iOS `isInternetReachable` mirrors
 * `isConnected`).
 */
function computeOffline(state: NetworkState | null): boolean {
  if (!state) return false;
  if (state.type === NetworkStateType.NONE) return true;
  return state.isConnected === false || state.isInternetReachable === false;
}

/**
 * Tracks connectivity app-wide via expo-network.
 *
 * `useNetworkState()` from expo-network only probes once on mount and then
 * relies solely on the native change listener — so if Wi-Fi is toggled while
 * the app is backgrounded (or a listener event is dropped), the state goes
 * stale and the offline banner never appears. To make detection reliable we:
 *   1. probe once on mount,
 *   2. subscribe to native change events,
 *   3. re-probe whenever the app returns to the foreground, and
 *   4. poll on a short interval as a safety net for missed events.
 */
export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NetworkState | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const apply = (next: NetworkState) => {
      if (mountedRef.current) setState(next);
    };
    const refresh = () => {
      getNetworkStateAsync().then(apply).catch(() => {});
    };

    // 1. Initial probe.
    refresh();

    // 2. Native connectivity-change listener.
    const sub = addNetworkStateListener(apply);

    // 3. Re-probe on foreground — changes made while backgrounded are
    //    otherwise missed, leaving a stale "online" state on resume.
    const appStateSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });

    // 4. Safety-net poll for any change events the listener didn't deliver.
    const interval = setInterval(refresh, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      sub.remove();
      appStateSub.remove();
      clearInterval(interval);
    };
  }, []);

  const isOffline = computeOffline(state);

  const value = useMemo<NetworkContextValue>(
    () => ({ isOffline, isOnline: !isOffline }),
    [isOffline],
  );

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) {
    throw new Error('useNetwork must be used inside NetworkProvider');
  }
  return ctx;
}
