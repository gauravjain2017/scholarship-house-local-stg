import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { NetworkProvider } from '@/context/NetworkContext';
import { ActivityIndicator, View } from 'react-native';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ProtectedRouter({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuth();
  const { colors } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, initializing, segments]);

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  return <>{children}</>;
}

/** Status bar follows the active color mode (light glyphs on dark, vice-versa). */
function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
        <ThemeProvider>
        <NetworkProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ThemedStatusBar />
            <ProtectedRouter>
              {/* Root Stack — no header anywhere. Each screen already has
                  its own navy hero with a back button, so the floating
                  top-nav icon row is intentionally hidden. */}
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="properties/[id]" options={{ headerShown: false }} />
                <Stack.Screen name="properties/edit" options={{ headerShown: false }} />
                {/* Push as a regular stack screen so Submit opens the same
                    way the Profile / Browse / Home tabs do — not as a modal
                    that slides up from the bottom. */}
                <Stack.Screen
                  name="properties/new"
                  options={{ headerShown: false }}
                />
                <Stack.Screen name="profile/edit" options={{ headerShown: false }} />
                <Stack.Screen name="profile/change-password" options={{ headerShown: false }} />
                <Stack.Screen name="notifications/index" options={{ headerShown: false }} />
                <Stack.Screen name="notifications/[id]" options={{ headerShown: false }} />
              </Stack>
            </ProtectedRouter>
            {/* Global offline banner — pins to the top, renders only when the
                device loses connectivity. */}
            <OfflineBanner />
          </AuthProvider>
        </QueryClientProvider>
        </NetworkProvider>
        </ThemeProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
