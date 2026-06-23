import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import * as authApi from '@/api/auth';
import * as profileApi from '@/api/profile';
import { onForcedLogout, setIntentionalSignOut } from '@/api/client';
import { ErrorModal } from '@/components/ErrorModal';
import { clearAuth, getItem, setItem, StorageKeys } from '@/storage/secure';
import type { AuthUser, UserType } from '@/types';

interface AuthState {
  user: AuthUser | null;
  initializing: boolean;
  signingIn: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (
    email: string,
    password: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);

/**
 * The `/auth/me` endpoint (and the login response) don't reliably include the
 * user's avatar, so the header showed the placeholder icon until the user
 * happened to open Edit Profile (which hits `/profile/me`). Backfill the avatar
 * from `/profile/me` so it appears app-wide as soon as the session loads.
 */
async function withAvatar(u: AuthUser): Promise<AuthUser> {
  if (u.profileImage) return u;
  try {
    const prof = await profileApi.getProfile();
    return prof.profileImage ? { ...u, profileImage: prof.profileImage } : u;
  } catch {
    return u;
  }
}

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [forcedLogoutMessage, setForcedLogoutMessage] = useState<string | null>(null);

  const mountedRef = useRef(true);

  // Restore session on app start
  useEffect(() => {
    mountedRef.current = true;

    (async () => {
      try {
        const [jwt, cachedUserJson] = await Promise.all([
          getItem(StorageKeys.jwt),
          getItem(StorageKeys.user),
        ]);

        if (jwt && cachedUserJson && cachedUserJson !== 'undefined') {
          try {
            const cached = JSON.parse(
              cachedUserJson
            ) as AuthUser;

            if (mountedRef.current) {
              setUser(cached);
            }
          } catch (error) {
            console.log('Invalid cached user JSON', error);

            await clearAuth();

            if (mountedRef.current) {
              setUser(null);
            }
          }

          // Refresh profile in background (and backfill the avatar).
          authApi
            .getMe()
            .then((fresh) => withAvatar(fresh))
            .then((fresh) => {
              if (mountedRef.current) {
                setUser(fresh);
              }

              return setItem(
                StorageKeys.user,
                JSON.stringify(fresh)
              );
            })
            .catch((err) => {
              // Background refresh failed (offline / backend down). We keep the
              // cached profile; log it so the failure isn't completely silent.
              if (__DEV__) {
                console.warn('Background profile refresh failed:', err);
              }
            });
        }
      } catch (error) {
        console.log('Auth restore error:', error);
      } finally {
        if (mountedRef.current) {
          setInitializing(false);
        }
      }
    })();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Forced logout listener
  useEffect(() => {
    const off = onForcedLogout((reason) => {
      setUser(null);
      setForcedLogoutMessage(reason);
    });

    return off;
  }, []);

  const signIn = useCallback(
    async (
      email: string,
      password: string,
    ) => {
      setSigningIn(true);

      try {
        const res = await authApi.login({
          email,
          password,
        });

        // Validate response
        if (!res?.user || !res?.token) {
          throw new Error('Invalid login response');
        }

        await Promise.all([
          setItem(StorageKeys.jwt, res.token),

          setItem(
            StorageKeys.sessionToken,
            res.sessionToken || ''
          ),

          setItem(
            StorageKeys.user,
            JSON.stringify(res.user)
          ),
        ]);

        setUser(res.user);

        // Backfill the avatar in the background if the login response omitted
        // it, so the header shows the photo without waiting for Edit Profile.
        if (!res.user.profileImage) {
          withAvatar(res.user).then((u) => {
            if (u.profileImage && mountedRef.current) {
              setUser(u);
              setItem(StorageKeys.user, JSON.stringify(u));
            }
          });
        }
      } catch (error) {
        console.log('Login error:', error);
        throw error;
      } finally {
        setSigningIn(false);
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    // Flag the interceptor so any 401 from the logout POST itself (or any
    // other in-flight request that races with the session-token invalidation)
    // doesn't fire the forced-logout listener — otherwise the "Signed out"
    // modal would appear on top of the user's own confirm dialog.
    setIntentionalSignOut(true);
    try {
      await authApi.logout();
    } catch {
      // Ignore logout errors
    }

    await clearAuth();
    setUser(null);

    // Keep the flag on briefly so any trailing 401s from queries that fired
    // just before clearAuth still get suppressed. 1s is plenty in practice.
    setTimeout(() => setIntentionalSignOut(false), 1000);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const fresh = await withAvatar(await authApi.getMe());

      setUser(fresh);

      await setItem(
        StorageKeys.user,
        JSON.stringify(fresh)
      );
    } catch (error) {
      console.log('Refresh profile error:', error);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      signingIn,
      signIn,
      signOut,
      refreshProfile,
      setUser,
    }),
    [
      user,
      initializing,
      signingIn,
      signIn,
      signOut,
      refreshProfile,
    ]
  );

  const isDeactivation = (forcedLogoutMessage ?? '')
    .toLowerCase()
    .includes('deactivated');

  return (
    <AuthContext.Provider value={value}>
      {children}
      <ErrorModal
        visible={!!forcedLogoutMessage}
        title={isDeactivation ? 'Account deactivated' : 'Signed out'}
        message={forcedLogoutMessage ?? ''}
        ctaLabel="OK"
        onDismiss={() => setForcedLogoutMessage(null)}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      'useAuth must be used inside AuthProvider'
    );
  }

  return ctx;
}