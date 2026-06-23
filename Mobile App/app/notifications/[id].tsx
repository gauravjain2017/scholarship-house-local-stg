import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { ScreenHeader } from '@/components/ScreenHeader';
import { ConfirmModal } from '@/components/ConfirmModal';
import { BottomNav, BOTTOM_NAV_HEIGHT } from '@/components/BottomNav';
import { useAuth } from '@/context/AuthContext';
import { getDealById } from '@/api/deals';
import {
  deleteNotification,
  getNotificationById,
  markNotificationAsRead,
} from '@/api/notifications';
import { radius, shadows, spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';
import type { Property } from '@/types';

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  new_registration: 'New Registration',
  new_property: 'New Property',
};

function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function getTypeLabel(type?: string): string {
  if (!type) return 'Notification';
  return NOTIFICATION_TYPE_LABELS[type] ?? titleCase(type);
}

function formatDateLong(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function fmtMoney(v?: number | string | null): string | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return `$${n.toLocaleString('en-US')}`;
}

interface MetaCardProps {
  label: string;
  value?: string | number | null;
}

function MetaCard({ label, value }: MetaCardProps) {
  const styles = useThemedStyles(makeStyles);
  if (value == null || value === '') return null;
  return (
    <View style={styles.metaCard}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={2}>
        {String(value)}
      </Text>
    </View>
  );
}

export default function NotificationDetailScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';

  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notification', id],
    queryFn: () => getNotificationById(id),
    enabled: !!id,
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => markNotificationAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification', id] });
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.email] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (notificationId: string) => deleteNotification(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.email] });
      router.back();
    },
  });

  // Auto-mark-read on first load if unread
  useEffect(() => {
    if (data && !data.notify && !markReadMutation.isPending) {
      markReadMutation.mutate(data.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id, data?.notify]);

  const isPropertyNotification = data?.notification_type === 'new_property';

  const { data: property, isLoading: propertyLoading } = useQuery<Property>({
    queryKey: ['deal', data?.type_id],
    queryFn: () => getDealById(data!.type_id as string),
    enabled: !!data?.type_id && isPropertyNotification,
  });

  const onDelete = useCallback(() => {
    if (data?.id) deleteMutation.mutate(data.id);
  }, [data?.id, deleteMutation]);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Notification"
        onBack={() => router.back()}
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError || !data ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={36} color={colors.danger} />
          <Text style={styles.errorTitle}>Couldn&rsquo;t load notification</Text>
          <Pressable
            onPress={() => refetch()}
            style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero card */}
          <View style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <View style={styles.heroIcon}>
                <Ionicons name="notifications" size={26} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>
                  {getTypeLabel(data.notification_type)}
                </Text>
                <Text style={styles.heroDate}>
                  {formatDateLong(data.created_at)}
                </Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  data.notify ? styles.statusPillRead : styles.statusPillUnread,
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    data.notify ? styles.statusDotRead : styles.statusDotUnread,
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    data.notify ? styles.statusTextRead : styles.statusTextUnread,
                  ]}
                >
                  {data.notify ? 'Read' : 'Unread'}
                </Text>
              </View>
            </View>

            <View style={styles.metaGrid}>
              <MetaCard label="FROM" value={data.action_performer_id} />
              <MetaCard label="TO" value={data.admin_email} />
              <MetaCard label="REFERENCE" value={data.type_id} />
              <MetaCard label="TYPE" value={getTypeLabel(data.notification_type)} />
            </View>
          </View>

          {/* Property details (only for new_property notifications) */}
          {isPropertyNotification && data.type_id ? (
            <View style={styles.propertyCard}>
              <Text style={styles.sectionHeading}>PROPERTY DETAILS</Text>
              {propertyLoading ? (
                <View style={styles.propertyLoading}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : property ? (
                <View style={{ gap: spacing.md }}>
                  <View style={styles.propertyHeaderRow}>
                    <Text style={styles.propertyTitle} numberOfLines={2}>
                      {property.title || 'Untitled Property'}
                    </Text>
                    {property.status ? (
                      <View style={styles.statusBadge}>
                        <Text style={styles.statusBadgeText}>
                          {titleCase(property.status)}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {property.address ? (
                    <View style={styles.metaCardFull}>
                      <Text style={styles.metaLabel}>ADDRESS</Text>
                      <Text style={styles.metaValue}>
                        {[
                          property.address.street,
                          property.address.city,
                          property.address.state,
                          property.address.zip,
                        ]
                          .filter(Boolean)
                          .join(', ') || '—'}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.metaGrid}>
                    <MetaCard label="PRICE" value={fmtMoney(property.price)} />
                    <MetaCard label="BEDROOMS" value={property.bedrooms} />
                    <MetaCard label="BATHROOMS" value={property.bathrooms} />
                    <MetaCard label="SQ FT" value={property.area} />
                    <MetaCard
                      label="CATEGORY"
                      value={
                        (property as any).category
                          ? titleCase((property as any).category)
                          : null
                      }
                    />
                    <MetaCard
                      label="YEAR BUILT"
                      value={(property as any).yearBuilt}
                    />
                  </View>

                  {property.description ? (
                    <View style={styles.metaCardFull}>
                      <Text style={styles.metaLabel}>DESCRIPTION</Text>
                      <Text style={styles.metaValue}>{property.description}</Text>
                    </View>
                  ) : null}

                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/properties/[id]',
                        params: { id: data.type_id as string },
                      })
                    }
                    style={({ pressed }) => [
                      styles.viewPropertyBtn,
                      pressed && { opacity: 0.9 },
                    ]}
                  >
                    <Ionicons name="open-outline" size={16} color={colors.textOnPrimary} />
                    <Text style={styles.viewPropertyText}>View full property</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.subtle}>Property details could not be loaded.</Text>
              )}
            </View>
          ) : null}

          {/* Actions */}
          <View style={styles.actionsRow}>
            {!data.notify ? (
              <Pressable
                onPress={() => markReadMutation.mutate(data.id)}
                disabled={markReadMutation.isPending}
                style={({ pressed }) => [
                  styles.markBtn,
                  pressed && { opacity: 0.9 },
                  markReadMutation.isPending && { opacity: 0.6 },
                ]}
              >
                <Ionicons name="checkmark-done" size={16} color={colors.textOnPrimary} />
                <Text style={styles.markBtnText}>Mark as Read</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => setConfirmDelete(true)}
              style={({ pressed }) => [
                styles.deleteBtn,
                pressed && { backgroundColor: colors.dangerSoft },
              ]}
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={styles.deleteBtnText}>Delete</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      <ConfirmModal
        visible={confirmDelete}
        title="Delete notification?"
        message="This will remove the notification from your list. This action cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={onDelete}
      />

      <BottomNav />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgAlt },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl + BOTTOM_NAV_HEIGHT,
    gap: spacing.md,
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
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.card,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    ...typography.h2,
    color: colors.text,
  },
  heroDate: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusPillUnread: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  statusPillRead: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotUnread: { backgroundColor: colors.primary },
  statusDotRead: { backgroundColor: colors.success },
  statusText: {
    ...typography.tiny,
  },
  statusTextUnread: { color: colors.primary },
  statusTextRead: { color: colors.success },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metaCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.bgAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  metaCardFull: {
    backgroundColor: colors.bgAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  metaLabel: {
    ...typography.tiny,
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
  metaValue: {
    ...typography.bodyStrong,
    color: colors.text,
  },
  propertyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.card,
  },
  propertyLoading: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  sectionHeading: {
    ...typography.tiny,
    color: colors.textMuted,
    letterSpacing: 0.8,
  },
  propertyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  propertyTitle: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  statusBadgeText: {
    ...typography.tiny,
    color: colors.primary,
  },
  viewPropertyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    ...shadows.primaryButton,
  },
  viewPropertyText: {
    color: colors.textOnPrimary,
    ...typography.bodyStrong,
  },
  subtle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  markBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    ...shadows.primaryButton,
  },
  markBtnText: {
    color: colors.textOnPrimary,
    ...typography.bodyStrong,
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.danger,
  },
  deleteBtnText: {
    color: colors.danger,
    ...typography.bodyStrong,
  },
});
