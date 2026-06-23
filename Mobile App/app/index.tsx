import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

/**
 * Root entry — first-time visitors (not signed in) land on the Welcome screen.
 * Authenticated users get routed to the tabs by the ProtectedRouter in _layout.tsx.
 */
export default function Index() {
  const { user, initializing } = useAuth();
  if (initializing) return null;
  return <Redirect href={user ? '/(tabs)' : '/(auth)/welcome'} />;
}
