import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { env } from '@/config/env';
import { getItem, StorageKeys, clearAuth } from '@/storage/secure';

// Subscribers get notified when the user is forcibly logged out
// (e.g. session invalidated by a login from another device).
type LogoutListener = (reason: string) => void;
const logoutListeners = new Set<LogoutListener>();

export function onForcedLogout(listener: LogoutListener): () => void {
  logoutListeners.add(listener);
  return () => logoutListeners.delete(listener);
}

function emitForcedLogout(reason: string) {
  logoutListeners.forEach((fn) => fn(reason));
}

// When the user clicks "Sign out", the backend invalidates the session
// token. Any in-flight request (or the logout POST itself, if it 401s)
// would otherwise trip the interceptor's forced-logout flow and render
// the "Signed out" modal on top of the user's own deliberate confirm
// dialog — two popups. AuthContext.signOut sets this flag for the
// duration of the sign-out window so the interceptor skips the listener.
let isIntentionalSignOut = false;
export function setIntentionalSignOut(v: boolean) {
  isIntentionalSignOut = v;
}

export const api: AxiosInstance = axios.create({
  baseURL: `${env.apiUrl.replace(/\/$/, '')}/api`,
  timeout: 20000,
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const [jwt, sessionToken] = await Promise.all([
    getItem(StorageKeys.jwt),
    getItem(StorageKeys.sessionToken),
  ]);
  if (jwt) config.headers.set('Authorization', `Bearer ${jwt}`);
  if (sessionToken) config.headers.set('x-session-token', sessionToken);
  return config;
});

// Retry only safe, idempotent reads on transient failures so a single network
// blip or brief 5xx doesn't surface as a hard error. POST/PUT/DELETE are never
// retried (could double-submit). 4xx (except 429) are real errors — no retry.
const RETRY_MAX = 2;
const isTransient = (error: AxiosError): boolean => {
  const status = error.response?.status;
  // No response at all = network error / timeout.
  if (!error.response) return true;
  return status === 429 || (status !== undefined && status >= 500);
};
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<{ error?: string; code?: string }>) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const url = error.config?.url ?? '';

    // Transient-failure retry for GETs (before any forced-logout handling,
    // which only applies to 401s and is unaffected by this block).
    const cfg = error.config as (InternalAxiosRequestConfig & { __retryCount?: number }) | undefined;
    const method = (cfg?.method ?? 'get').toLowerCase();
    if (cfg && method === 'get' && !isIntentionalSignOut && isTransient(error)) {
      cfg.__retryCount = cfg.__retryCount ?? 0;
      if (cfg.__retryCount < RETRY_MAX) {
        cfg.__retryCount += 1;
        await wait(300 * 2 ** (cfg.__retryCount - 1)); // 300ms, then 600ms
        return api(cfg);
      }
    }
    // A 401 from the login endpoint itself just means bad credentials —
    // the login screen surfaces that. Don't fire the forced-logout flow.
    const isLoginRequest = url.includes('/submitters/applogin');

    // Skip forced-logout entirely while the user is deliberately signing out.
    // The session token has been invalidated server-side, so any racing
    // request will 401 — but we don't want to show the "Signed out" popup
    // on top of the user's own sign-out confirmation.
    if (isIntentionalSignOut) {
      return Promise.reject(error);
    }

    if (!isLoginRequest) {
      if (code === 'ACCOUNT_DEACTIVATED') {
        // Admin deactivated the account mid-session. Sign the user out and
        // show the exact message the backend returned.
        await clearAuth();
        emitForcedLogout(
          error.response?.data?.error ||
            'Your account has been deactivated. Please contact an administrator.',
        );
      } else if (status === 401 && code === 'SESSION_INVALIDATED') {
        await clearAuth();
        emitForcedLogout(
          error.response?.data?.error || 'Session expired. Please sign in again.',
        );
      } else if (status === 401) {
        // Token expired or never valid — also bounce to login.
        await clearAuth();
        emitForcedLogout('Your session has ended. Please sign in again.');
      }
    }

    return Promise.reject(error);
  },
);

export function extractApiError(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error || err.message || fallback;
  }
  return err instanceof Error ? err.message : fallback;
}
