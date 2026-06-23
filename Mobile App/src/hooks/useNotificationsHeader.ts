import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { getMyNotifications } from '@/api/notifications';

/**
 * Centralised header-bell wiring. Returns props ready to spread on
 * `<ScreenHeader>` so the bell shows the live unread count for client users,
 * and is hidden entirely for non-client roles (submitter / admin).
 *
 * Use as:
 *   const headerBell = useNotificationsHeader();
 *   <ScreenHeader ... {...headerBell} />
 */
export function useNotificationsHeader() {
  const { user } = useAuth();
  const router = useRouter();

  const isClient = (user?.userType ?? '').toLowerCase() === 'client';

  const { data } = useQuery({
    queryKey: ['notifications', user?.email],
    queryFn: getMyNotifications,
    enabled: isClient && !!user?.email,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return useMemo(() => {
    if (!isClient) {
      return { onNotificationPress: undefined, notificationCount: 0 } as const;
    }
    const unread = (data ?? []).filter((n) => !n.notify).length;
    return {
      onNotificationPress: () => router.push('/notifications'),
      notificationCount: unread,
    } as const;
  }, [isClient, data, router]);
}
