import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/Button';
import { ConfirmModal } from '@/components/ConfirmModal';
import { PropertyCard } from '@/components/PropertyCard';
import { PropertyListSkeleton } from '@/components/Skeleton';
import { StatusFilterDropdown } from '@/components/StatusFilterDropdown';
import { RenewalModal, type RenewalAnswers } from '@/components/RenewalModal';
import { SearchBar } from '@/components/SearchBar';
import { SuccessModal } from '@/components/SuccessModal';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useNotificationsHeader } from '@/hooks/useNotificationsHeader';
import { deleteMyDeal, getMySubmissions, updateMyDeal } from '@/api/deals';
import { formatListingTitle, formatPropertyId } from '@/utils/propertyId';
import { isExpired, isoDaysFromNow } from '@/utils/expiry';
import { formatPublishedDate } from '@/utils/date';
import { spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';
import type { Property } from '@/types';

const PAGE_SIZE = 10;

/**
 * Status filter options — mirror the web "My Properties" page. `key` matches the
 * lowercased `status` stored on a deal; `all` is the unfiltered view. Properties
 * with no status are treated as "pending" (same as the card badge). Each status
 * carries an accent color used for the dropdown's dot.
 */
type StatusKey = 'all' | 'pending' | 'active' | 'rejected' | 'sold';
const makeStatusTabs = (colors: ThemeColors): { key: StatusKey; label: string; color: string }[] => [
  { key: 'all', label: 'All Statuses', color: colors.primary },
  { key: 'pending', label: 'Pending', color: colors.warning },
  { key: 'active', label: 'Active', color: colors.success },
  { key: 'rejected', label: 'Rejected', color: colors.danger },
  { key: 'sold', label: 'Sold', color: colors.textMuted },
];

function formatPrice(p?: number) {
  if (!p) return '$—';
  return `$${p.toLocaleString('en-US')}`;
}

function locationOf(p: Property) {
  return (
    [p.address?.city, p.address?.state].filter(Boolean).join(', ') || 'Location TBD'
  );
}

function coverImageOf(p: Property): string | undefined {
  const anyP = p as any;
  return (
    anyP.coverPhoto?.[0] ||
    anyP.exteriorImages?.[0] ||
    anyP.interiorImages?.[0] ||
    p.images?.[0] ||
    anyP.additionalImages?.[0]
  );
}

function formatCategory(cat?: string): string {
  if (!cat) return '—';
  return cat
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/(^| )([a-z])/g, (_, sep, c) => sep + c.toUpperCase());
}

function bedsBathsOf(p: Property): string {
  const beds = p.bedrooms;
  const baths = p.bathrooms;
  if (beds === undefined && baths === undefined) return '';
  return `${beds ?? '—'} BD · ${baths ?? '—'} BA`;
}

function areaOf(p: Property): string {
  const area = (p as any).squareFootage ?? p.area;
  return area ? `${area} sqft` : '';
}

/**
 * Statuses where the backend rejects edits & deletes for submitters. Mirrors
 * the LOCKED set in backend/src/controllers/dealController.js#updateMyDeal —
 * keep these in sync.
 */
const LOCKED_STATUSES = new Set(['approved', 'published', 'sold']);

const normStatus = (status?: string) => String(status || '').toLowerCase();

/**
 * Map a deal's raw status to the dropdown tab it belongs to. "Approved" and
 * "Published" both roll up into the combined "Active" tab (mirrors the client
 * interface and the Home submission-overview tile). Unknown statuses → null.
 */
const statusToTab = (status?: string): Exclude<StatusKey, 'all'> | null => {
  const s = normStatus(status) || 'pending';
  if (s === 'pending') return 'pending';
  if (s === 'approved' || s === 'published') return 'active';
  if (s === 'rejected') return 'rejected';
  if (s === 'sold') return 'sold';
  return null;
};
const isLocked = (status?: string) => LOCKED_STATUSES.has(normStatus(status));
const canEdit = (status?: string) => !isLocked(status);
const canDelete = (status?: string) => !isLocked(status);

/**
 * Most-recent-first ordering. Falls back through `submittedAt` and `updatedAt`
 * when `createdAt` is missing (some legacy DynamoDB rows omit it).
 */
function recencyTime(p: Property): number {
  const anyP = p as any;
  const raw = anyP.createdAt ?? anyP.submittedAt ?? anyP.updatedAt;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Browse / My Properties tab.
 *
 * Lists the submitter's own listings with infinite scroll: the first 10 are
 * shown immediately, each scroll-to-end loads the next 10. Inline Edit /
 * Delete actions live on each card (Delete is disabled for non-pending).
 */
export default function BrowseScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const headerBell = useNotificationsHeader();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const STATUS_TABS = makeStatusTabs(colors);
  const params = useLocalSearchParams<{ status?: string; t?: string }>();
  const navigation = useNavigation();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusKey>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Pre-select the status filter when arriving via a ?status= deep link (the
  // Home "Submission overview" tiles). Ignores anything that isn't a real tab.
  // `params.t` is a per-tap nonce so re-tapping the SAME status still re-applies
  // the filter (identical params alone wouldn't re-trigger this effect).
  useEffect(() => {
    const incoming = String(params.status || '').toLowerCase();
    const valid: StatusKey[] = ['all', 'pending', 'active', 'rejected', 'sold'];
    if (incoming && (valid as string[]).includes(incoming)) {
      setStatusFilter(incoming as StatusKey);
      setVisibleCount(PAGE_SIZE);
    }
  }, [params.status, params.t]);

  // Tapping the bottom "Browse" tab itself clears any active filter/search and
  // resets to All. (Programmatic deep-links from Home don't fire tabPress, so
  // those still pre-select their status.)
  useEffect(() => {
    const unsub = (navigation as any).addListener('tabPress', () => {
      setSearch('');
      setStatusFilter('all');
      setVisibleCount(PAGE_SIZE);
    });
    return unsub;
  }, [navigation]);
  const [pendingDelete, setPendingDelete] = useState<Property | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Set to "edit" or "delete" when the user taps a locked-status action so
  // we know which message to show in the "Action not allowed" popup.
  const [lockedAction, setLockedAction] = useState<'edit' | 'delete' | null>(null);
  // Renewal flow state.
  const [renewTarget, setRenewTarget] = useState<Property | null>(null);
  const [renewSuccess, setRenewSuccess] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);

  const { data, isLoading, isRefetching, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['my-submissions'],
    queryFn: getMySubmissions,
    // Treat the list as fresh for a minute so quickly switching back to this
    // tab reuses the cache instead of re-fetching (and flashing a loader).
    staleTime: 60_000,
  });

  const deleteMut = useMutation({
    mutationFn: deleteMyDeal,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-submissions'] });
      setPendingDelete(null);
      setDeleteSuccess(true);
    },
    onError: (e: any) => {
      setPendingDelete(null);
      const fromServer = e?.response?.data?.message || e?.response?.data?.error;
      setDeleteError(
        fromServer ||
          'Could not delete this property. Published or approved properties must be removed by an admin.',
      );
    },
  });

  const renewMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      updateMyDeal(id, payload as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-submissions'] });
      setRenewTarget(null);
      setRenewSuccess(true);
    },
    onError: (e: any) => {
      setRenewTarget(null);
      setRenewError(
        e?.response?.data?.error ||
          e?.response?.data?.message ||
          'Could not renew this property. Please try again.',
      );
    },
  });

  // Any "Yes" → review/edit the listing first; all "No" → renew immediately.
  const handleRenewSubmit = (answers: RenewalAnswers) => {
    const p = renewTarget;
    if (!p) return;
    const anyYes =
      answers.is_property_status_changed ||
      answers.is_financial_terms_changed ||
      answers.is_property_edit;

    if (anyYes) {
      setRenewTarget(null);
      router.push({
        pathname: '/properties/edit',
        params: {
          id: p.id,
          renew: '1',
          // Booleans travel as 'true'/'false' strings through route params; the
          // edit screen converts them back to real booleans before saving.
          is_property_status_changed: String(answers.is_property_status_changed),
          // 'Pending' / 'Sold' (or '') — the edit screen lowercases it into `status`.
          changed_property_status: answers.changed_property_status,
          is_financial_terms_changed: String(answers.is_financial_terms_changed),
          is_property_edit: String(answers.is_property_edit),
        },
      });
      return;
    }

    // Quick renew (all "No"): extend 20 days, clear the expired flag, record the
    // answers as false. No status change since the status question was "No".
    renewMut.mutate({
      id: p.id,
      payload: {
        is_property_status_changed: false,
        is_financial_terms_changed: false,
        is_property_edit: false,
        expiry_date: isoDaysFromNow(20),
        expired_status: false,
      },
    });
  };

  useFocusEffect(
    useCallback(() => {
      // Only refresh when the cached list is actually stale. The previous
      // unconditional invalidate fired on EVERY focus, so the page re-fetched
      // (and showed a loader) every single time the tab was opened. Mutations
      // (submit / edit / delete / renew) already invalidate this query, so the
      // list stays correct after any change the user makes in-app; this catches
      // server-side changes (e.g. an admin approving a listing) only when the
      // data is genuinely old.
      if (Date.now() - dataUpdatedAt > 60_000) {
        qc.invalidateQueries({ queryKey: ['my-submissions'] });
      }
    }, [qc, dataUpdatedAt]),
  );

  // Per-status counts for the filter pills — always computed from the full set
  // (not the search-filtered list) so the badges reflect the real totals.
  const statusCounts = useMemo(() => {
    const counts: Record<StatusKey, number> = {
      all: data?.length ?? 0,
      pending: 0,
      active: 0,
      rejected: 0,
      sold: 0,
    };
    for (const p of data ?? []) {
      const key = statusToTab(p.status);
      if (key) counts[key] += 1;
    }
    return counts;
  }, [data]);

  // Shape the tabs + live counts into the dropdown's option list.
  const statusOptions = useMemo(
    () =>
      STATUS_TABS.map((t) => ({
        key: t.key,
        label: t.label,
        color: t.color,
        count: statusCounts[t.key],
      })),
    [statusCounts],
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    // Status filter first (treat missing status as "pending", like the badge).
    const byStatus =
      statusFilter === 'all'
        ? data
        : data.filter((p) => statusToTab(p.status) === statusFilter);
    // Sort latest first so newly-submitted listings appear at the top.
    const sorted = [...byStatus].sort((a, b) => recencyTime(b) - recencyTime(a));
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((p) => {
      // Build the same haystack the admin Property Management table searches
      // across: title + full address (street, city, state, zip) + price.
      // Price is included in two forms — raw digits and locale-formatted with
      // commas / dollar sign — so a query like "350", "350,000" or "$350,000"
      // all match the same listing.
      const priceNum = p.price ?? 0;
      const priceFormatted = priceNum
        ? `$${priceNum.toLocaleString('en-US')}`
        : '';
      const hay = [
        p.title,
        (p as any).streetAddress,
        p.address?.street,
        p.address?.city,
        p.address?.state,
        p.address?.zip,
        p.propertyType,
        priceNum ? String(priceNum) : '',
        priceFormatted,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data, search, statusFilter]);

  const visible = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );

  const hasMore = visibleCount < filtered.length;

  const loadMore = () => {
    if (hasMore) setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length));
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="My Properties"
        subtitle={data ? `${data.length} total · pull to refresh` : 'Loading…'}
        iconName="business-outline"
        onProfilePress={() => router.push('/(tabs)/profile')}
        {...headerBell}
      />

      <StatusFilterDropdown
        value={statusFilter}
        options={statusOptions}
        onChange={(key) => {
          setStatusFilter(key as StatusKey);
          setVisibleCount(PAGE_SIZE);
        }}
      />

      <View style={styles.searchWrap}>
        <SearchBar
          value={search}
          onChangeText={(v) => {
            setSearch(v);
            setVisibleCount(PAGE_SIZE);
          }}
          placeholder="Search by title, address, price…"
        />
      </View>

      {!isLoading && !error && data ? (
        <View style={styles.resultsRow}>
          <Text style={styles.resultsText}>
            Showing <Text style={styles.resultsStrong}>{filtered.length}</Text> of{' '}
            <Text style={styles.resultsStrong}>{data.length}</Text> propert{data.length === 1 ? 'y' : 'ies'}
            {statusFilter !== 'all'
              ? ` · ${STATUS_TABS.find((t) => t.key === statusFilter)?.label ?? ''}`
              : ''}
          </Text>
        </View>
      ) : null}

      {isLoading ? (
        <PropertyListSkeleton />
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: colors.danger, marginBottom: spacing.md }}>
            Failed to load properties
          </Text>
          <Button title="Retry" variant="secondary" onPress={() => refetch()} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                setVisibleCount(PAGE_SIZE);
                refetch();
              }}
              tintColor={colors.primary}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          decelerationRate="normal"
          scrollEventThrottle={16}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={7}
          removeClippedSubviews
          ListFooterComponent={
            hasMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.footerText}>
                  Loading more… ({visibleCount} of {filtered.length})
                </Text>
              </View>
            ) : filtered.length > PAGE_SIZE ? (
              <Text style={styles.footerText}>You've reached the end.</Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🏠</Text>
              {data && data.length > 0 ? (
                <>
                  <Text style={styles.emptyTitle}>No properties found</Text>
                  <Text style={styles.emptyBody}>
                    {statusFilter !== 'all'
                      ? `You have no ${
                          STATUS_TABS.find((t) => t.key === statusFilter)?.label.toLowerCase() ??
                          statusFilter
                        } properties${search ? ' matching your search' : ''}.`
                      : 'No properties match your search. Try a different keyword.'}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.emptyTitle}>No properties yet</Text>
                  <Text style={styles.emptyBody}>
                    Tap "Submit" at the bottom to add your first listing.
                  </Text>
                </>
              )}
            </View>
          }
          renderItem={({ item: p }) => {
            const editable = canEdit(p.status);
            const deletable = canDelete(p.status);
            // Prefer the canonical "{#} {beds} Bedroom, {baths} Bathroom in
            // City, ST" composition; fall back to the backend-stored title
            // (then a generic placeholder) when we can't synthesize anything.
            const builtTitle = formatListingTitle({
              streetAddress: (p as any).streetAddress,
              address: p.address,
              city: (p as any).city,
              state: (p as any).state,
              stateRegion: (p as any).stateRegion,
              yearBuilt: (p as any).yearBuilt,
              bedrooms: p.bedrooms,
              bathrooms: p.bathrooms,
            });
            const cardTitle = builtTitle || p.title || 'Untitled property';
            return (
              <PropertyCard
                variant="wide"
                imageUri={coverImageOf(p)}
                title={cardTitle}
                category={formatCategory((p as any).category ?? p.propertyType)}
                bedsBaths={bedsBathsOf(p)}
                area={areaOf(p)}
                publishedDate={formatPublishedDate(p) ?? undefined}
                propertyId={formatPropertyId(p) || undefined}
                price={formatPrice(p.price)}
                badgeLabel={(p.status || 'pending').toUpperCase()}
                badgeTone={
                  p.status === 'sold'
                    ? 'sold'
                    : p.status === 'published'
                      ? 'rent'
                      : 'info'
                }
                onPress={() =>
                  router.push({ pathname: '/properties/[id]', params: { id: p.id } })
                }
                onEdit={() => {
                  // For approved/published/sold properties we surface the same
                  // explanation the backend would return (the popup) instead
                  // of navigating into the edit screen.
                  if (!editable) {
                    setLockedAction('edit');
                    return;
                  }
                  router.push({ pathname: '/properties/edit', params: { id: p.id } });
                }}
                onDelete={() => {
                  if (!deletable) {
                    setLockedAction('delete');
                    return;
                  }
                  setPendingDelete(p);
                }}
                editEnabled={editable}
                deleteEnabled={deletable}
                deleting={deleteMut.isPending && pendingDelete?.id === p.id}
                showRenew={isExpired(p as any)}
                onRenew={() => setRenewTarget(p)}
              />
            );
          }}
        />
      )}

      <ConfirmModal
        visible={!!pendingDelete}
        title="Delete Property"
        message={
          pendingDelete
            ? `Are you sure you want to delete "${pendingDelete.title || 'this property'}"? This cannot be undone.`
            : ''
        }
        confirmLabel={deleteMut.isPending ? 'Deleting…' : 'Delete'}
        cancelLabel="Cancel"
        destructive
        loading={deleteMut.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
      />

      <SuccessModal
        visible={deleteSuccess}
        title="Property Deleted"
        message="The property has been removed from your submissions."
        ctaLabel="Done"
        onDismiss={() => setDeleteSuccess(false)}
      />

      <ConfirmModal
        visible={!!deleteError}
        title="Delete Failed"
        message={deleteError ?? ''}
        confirmLabel="OK"
        cancelLabel="Close"
        onCancel={() => setDeleteError(null)}
        onConfirm={() => setDeleteError(null)}
      />

      {/* Locked-status popup — shown when the user taps Edit or Delete on a
          property whose status is approved / published / sold. Matches the
          message the backend returns from updateMyDeal. */}
      <ConfirmModal
        visible={!!lockedAction}
        title={lockedAction === 'delete' ? 'Delete failed' : 'Update failed'}
        message={
          lockedAction === 'delete'
            ? 'Approved, published, or sold properties cannot be deleted. Contact an admin.'
            : 'Approved, published, or sold properties cannot be edited. Contact an admin.'
        }
        confirmLabel="OK"
        cancelLabel="Close"
        onCancel={() => setLockedAction(null)}
        onConfirm={() => setLockedAction(null)}
      />

      <RenewalModal
        visible={!!renewTarget}
        loading={renewMut.isPending}
        onCancel={() => setRenewTarget(null)}
        onSubmit={handleRenewSubmit}
      />

      <SuccessModal
        visible={renewSuccess}
        title="Listing renewed"
        message="Your listing is active again and will expire in 20 days."
        ctaLabel="Done"
        onDismiss={() => setRenewSuccess(false)}
      />

      <ConfirmModal
        visible={!!renewError}
        title="Renewal failed"
        message={renewError ?? ''}
        confirmLabel="OK"
        cancelLabel="Close"
        onCancel={() => setRenewError(null)}
        onConfirm={() => setRenewError(null)}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgAlt },
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bgAlt,
  },

  resultsRow:    { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  resultsText:   { ...typography.caption, color: colors.textMuted },
  resultsStrong: { ...typography.captionStrong, color: colors.text },

  list: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },

  footerLoader: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  footerText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyIcon: { fontSize: 56, marginBottom: spacing.md },
  emptyTitle: { ...typography.h2, color: colors.text },
  emptyBody: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});
