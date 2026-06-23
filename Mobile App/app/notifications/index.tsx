import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { ScreenHeader } from '@/components/ScreenHeader';
import { ConfirmModal } from '@/components/ConfirmModal';
import { BottomNav, BOTTOM_NAV_HEIGHT } from '@/components/BottomNav';
import { useAuth } from '@/context/AuthContext';
import {
  deleteNotification,
  getMyNotifications,
  markNotificationAsRead,
} from '@/api/notifications';
import { radius, shadows, spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';
import type { AppNotification } from '@/types/notification';

const PAGE_SIZE = 10;

type FilterKey = 'all' | 'unread' | 'read';

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  new_registration: 'New Registration',
  new_property: 'New Property',
};

function titleCase(s: string): string {
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getTypeLabel(type?: string): string {
  if (!type) return 'Notification';
  return NOTIFICATION_TYPE_LABELS[type] ?? titleCase(type);
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

export default function NotificationsScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [filter, setFilter] = useState<FilterKey>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['notifications', user?.email],
    queryFn: getMyNotifications,
    enabled: !!user?.email,
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationAsRead(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.email] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: () => {
      setConfirmDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.email] });
    },
  });

  const notifications = data ?? [];

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (filter === 'unread') return !n.notify;
      if (filter === 'read') return n.notify;
      return true;
    });
  }, [notifications, filter]);

  // Reset pagination when filter changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const loadMore = useCallback(() => {
    if (hasMore) setVisibleCount((c) => c + PAGE_SIZE);
  }, [hasMore]);

  const counts = useMemo(() => {
    const unread = notifications.filter((n) => !n.notify).length;
    return {
      all: notifications.length,
      unread,
      read: notifications.length - unread,
    };
  }, [notifications]);

  const openDetail = useCallback(
    (n: AppNotification) => {
      router.push({ pathname: '/notifications/[id]', params: { id: n.id } });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => {
      const unread = !item.notify;
      return (
        <Pressable
          onPress={() => openDetail(item)}
          style={({ pressed }) => [
            styles.row,
            unread && styles.rowUnread,
            pressed && styles.rowPressed,
          ]}
        >
          <View style={styles.dotCol}>
            {unread ? <View style={styles.dot} /> : <View style={styles.dotPlaceholder} />}
          </View>

          <View
            style={[
              styles.iconCircle,
              unread ? styles.iconCircleUnread : styles.iconCircleRead,
            ]}
          >
            <Ionicons
              name="notifications"
              size={18}
              color={unread ? colors.primary : colors.textMuted}
            />
          </View>

          <View style={styles.body}>
            <View style={styles.bodyHeaderRow}>
              <Text
                style={[styles.title, unread && styles.titleUnread]}
                numberOfLines={1}
              >
                {getTypeLabel(item.notification_type)}
              </Text>
              <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
            </View>

            {item.action_performer_id ? (
              <Text style={styles.subtle} numberOfLines={1}>
                {item.action_performer_id}
              </Text>
            ) : null}
            {item.admin_email ? (
              <Text style={styles.subtle} numberOfLines={1}>
                To: {item.admin_email}
              </Text>
            ) : null}

            <View style={styles.actions}>
              {unread ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    markReadMutation.mutate(item.id);
                  }}
                  disabled={markReadMutation.isPending}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    pressed && styles.actionBtnPressed,
                  ]}
                >
                  <Ionicons
                    name="checkmark-done"
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={styles.actionTextPrimary}>Mark as read</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  setConfirmDeleteId(item.id);
                }}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.actionBtn,
                  pressed && styles.actionBtnPressed,
                ]}
              >
                <Ionicons name="trash-outline" size={14} color={colors.danger} />
                <Text style={styles.actionTextDanger}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      );
    },
    [markReadMutation, openDetail],
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Notifications"
        subtitle={
          counts.unread > 0
            ? `${counts.unread} unread`
            : 'You’re all caught up'
        }
        onBack={() => router.back()}
      />

      <View style={styles.summaryWrap}>
        <Text style={styles.summaryHeading}>Property Notifications</Text>
        <Text style={styles.summarySub}>
          {counts.unread > 0
            ? `${counts.unread} unread notification${counts.unread === 1 ? '' : 's'}`
            : 'All caught up'}
        </Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.tabs}>
        {(
          [
            { key: 'all', label: 'All', count: counts.all },
            { key: 'unread', label: 'Unread', count: counts.unread },
            { key: 'read', label: 'Read', count: counts.read },
          ] as { key: FilterKey; label: string; count: number }[]
        ).map((tab) => {
          const active = filter === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setFilter(tab.key)}
              style={({ pressed }) => [
                styles.tab,
                active && styles.tabActive,
                pressed && !active && styles.tabPressed,
              ]}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {tab.label}
              </Text>
              {tab.count > 0 ? (
                <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                  <Text
                    style={[
                      styles.tabBadgeText,
                      active && styles.tabBadgeTextActive,
                    ]}
                  >
                    {tab.count}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={36} color={colors.danger} />
          <Text style={styles.errorTitle}>Couldn&rsquo;t load notifications</Text>
          <Pressable
            onPress={() => refetch()}
            style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isLoading}
              onRefresh={refetch}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconCircle}>
                <Ionicons
                  name="notifications-off-outline"
                  size={28}
                  color={colors.textMuted}
                />
              </View>
              <Text style={styles.emptyTitle}>No notifications</Text>
              <Text style={styles.emptySub}>
                {filter === 'unread'
                  ? 'You have no unread notifications.'
                  : filter === 'read'
                    ? 'No read notifications yet.'
                    : 'When something happens, it’ll show up here.'}
              </Text>
            </View>
          }
          ListFooterComponent={
            visible.length === 0 ? null : hasMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <Text style={styles.endText}>You&rsquo;re all caught up.</Text>
            )
          }
        />
      )}

      <ConfirmModal
        visible={!!confirmDeleteId}
        title="Delete notification?"
        message="This will remove the notification from your list. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() =>
          confirmDeleteId && deleteMutation.mutate(confirmDeleteId)
        }
      />

      <BottomNav />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgAlt },
  summaryWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bgAlt,
  },
  summaryHeading: {
    ...typography.h1,
    color: colors.text,
  },
  summarySub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.bg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: 4,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.card,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabPressed: {
    backgroundColor: colors.bgAlt,
  },
  tabLabel: {
    ...typography.captionStrong,
    color: colors.textSecondary,
  },
  tabLabelActive: {
    color: colors.textOnPrimary,
  },
  tabBadge: {
    minWidth: 20,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 9,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tabBadgeTextActive: {
    color: colors.textOnPrimary,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl + BOTTOM_NAV_HEIGHT,
  },
  separator: { height: spacing.sm },
  row: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.card,
  },
  rowUnread: {
    borderColor: colors.primarySoft,
    backgroundColor: colors.primarySoft,
  },
  rowPressed: {
    transform: [{ scale: 0.997 }],
    opacity: 0.96,
  },
  dotCol: {
    width: 10,
    alignItems: 'center',
    paddingTop: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  dotPlaceholder: {
    width: 8,
    height: 8,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  iconCircleUnread: {
    backgroundColor: colors.primarySoft,
  },
  iconCircleRead: {
    backgroundColor: colors.bgAlt,
  },
  body: { flex: 1, minWidth: 0 },
  bodyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  title: {
    ...typography.bodyStrong,
    color: colors.text,
    flex: 1,
  },
  titleUnread: {
    color: colors.primary,
  },
  time: {
    ...typography.tiny,
    color: colors.textMuted,
  },
  subtle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
  },
  actionBtnPressed: {
    backgroundColor: colors.bgAlt,
  },
  actionTextPrimary: {
    ...typography.captionStrong,
    color: colors.primary,
  },
  actionTextDanger: {
    ...typography.captionStrong,
    color: colors.danger,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  errorTitle: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  retryBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  retryText: {
    color: colors.textOnPrimary,
    ...typography.captionStrong,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
  },
  emptySub: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  footerLoading: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  endText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
