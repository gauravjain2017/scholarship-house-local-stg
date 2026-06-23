import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { ImageCarousel } from '@/components/ImageCarousel';
import { PropertyListSkeleton } from '@/components/Skeleton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useNotificationsHeader } from '@/hooks/useNotificationsHeader';
import { addFavorite, getFavorites, getPublishedDeals, removeFavorite } from '@/api/deals';
import { radius, shadows, spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';
import { formatPublishedDate } from '@/utils/date';
import type { Property } from '@/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n?: number | string | null) {
  const v = parseFloat(String(n));
  if (!v || isNaN(v)) return '—';
  return `$${Math.trunc(v).toLocaleString('en-US')}`;
}
function fmtPct(n?: number | null) { return n != null ? `${n}%` : '—'; }

/**
 * Property heading — identical to the submitter web view, which renders
 * `{yearBuilt} {deal.title}` where the backend stores `title` as
 * "{beds} Bedroom, {baths} Bathroom in {city}, {ST}". Prefer that stored title
 * verbatim so the app and submitter never drift; reconstruct the same shape
 * only when an older record has no title.
 */
function addressLine(p: Property): string {
  const a = p as any;
  const year = a.yearBuilt ? String(a.yearBuilt) : '';
  const title = typeof p.title === 'string' ? p.title.trim() : '';
  if (title) return [year, title].filter(Boolean).join(' ');

  const bed = p.bedrooms != null ? `${p.bedrooms} Bedroom` : '';
  const bath = p.bathrooms != null ? `${p.bathrooms} Bathroom` : '';
  const city = p.address?.city;
  const state = p.address?.state;
  const loc =
    city && state ? `in ${city}, ${state}` : city ? `in ${city}` : state ? `in ${state}` : '';
  const body = [[bed, bath].filter(Boolean).join(', '), loc].filter(Boolean).join(' ');
  return [year, body].filter(Boolean).join(' ') || 'Location TBD';
}

const hasVal = (v: any): boolean => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'number') return !Number.isNaN(v) && v !== 0;
  return true;
};

const normalizeTurnkey = (value: any) =>
  value?.toString().toUpperCase().replace(/-/g, '_');

const isTurnkeyDeal = (a: any) =>
  ['TURNKEY_OPERATING', 'FURNISHED_NOT_OPERATING'].includes(normalizeTurnkey(a?.turnkeyFurnished));

const shortFinancingLabel = (type: string) => {
  const map: Record<string, string> = {
    traditional:  'Conventional',
    'subject-to': 'Subject-to',
    hybrid:       'Hybrid',
    seller:       'Seller Finance',
    cash:         'Cash Only',
  };
  return map[type] || (type ? type.charAt(0).toUpperCase() + type.slice(1) : '—');
};

function statusStyle(s?: string): { bg: string; text: string } {
  switch ((s || '').toLowerCase()) {
    case 'sold':    return { bg: '#D14343', text: '#fff' };
    case 'active':  return { bg: '#1F9D55', text: '#fff' };
    case 'pending': return { bg: '#D9A40C', text: '#fff' };
    default:        return { bg: '#3B82F6', text: '#fff' };
  }
}

// ── DealCell ──────────────────────────────────────────────────────────────────

function DealCell({ label, value, accent, last }: { label: string; value: string; accent?: boolean; last?: boolean }) {
  const dc = useThemedStyles(makeDcStyles);
  return (
    <View style={[dc.cell, !last && dc.sep]}>
      <Text style={dc.label}>{label}</Text>
      <Text style={[dc.value, accent && dc.accentValue]}>{value}</Text>
    </View>
  );
}
const makeDcStyles = (colors: ThemeColors) => StyleSheet.create({
  cell:        { flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs },
  sep:         { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border },
  label:       { ...typography.tiny, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  value:       { ...typography.captionStrong, color: colors.text, fontSize: 13 },
  accentValue: { color: colors.primaryAccent },
});

// ── PropertyCard ──────────────────────────────────────────────────────────────

function PropertyCard({
  p,
  onView,
  onToggleFavorite,
  favoriteLoading,
}: {
  p: Property;
  onView: () => void;
  onToggleFavorite: () => void;
  favoriteLoading?: boolean;
}) {
  const { colors } = useTheme();
  const cs = useThemedStyles(makeCsStyles);
  const [linkCopied, setLinkCopied] = useState(false);
  const [imgIndex,   setImgIndex]   = useState(0);
  const a  = p as any;
  const ss = statusStyle(p.status);

  const allImages: string[] = [
    ...(Array.isArray(a.coverPhoto)       ? a.coverPhoto       : []),
    ...(Array.isArray(a.exteriorImages)   ? a.exteriorImages   : []),
    ...(Array.isArray(a.interiorImages)   ? a.interiorImages   : []),
    ...(Array.isArray(p.images)           ? p.images           : []),
    ...(Array.isArray(a.additionalImages) ? a.additionalImages : []),
  ].filter(Boolean);

  const interestRateRaw = parseFloat(a.subjInterestRate ?? a.sellerInterestRate);
  const interestRate    = hasVal(a.subjInterestRate)
    ? `${a.subjInterestRate}%`
    : hasVal(a.sellerInterestRate) ? `${a.sellerInterestRate}%` : '—';

  const downPaymentNum = Number(a.downPayment || 0);
  const assignmentFee  = Number(a.assignmentFee) > 0 ? Number(a.assignmentFee) : 0;
  const entryDown      = downPaymentNum + assignmentFee > 0 ? fmt$(downPaymentNum + assignmentFee) : '—';
  const displayPrice   = Number(a.price || 0) + assignmentFee;

  const piti            = hasVal(a.totalMonthlyPayment) ? `${fmt$(a.totalMonthlyPayment)}/mo` : '—';
  const financing       = hasVal(a.financingType) ? shortFinancingLabel(a.financingType) : '—';
  const turnkey         = isTurnkeyDeal(a) ? 'Yes' : 'No';
  const occupancy       = hasVal(a.occupancyRate) ? fmtPct(a.occupancyRate) : '—';
  const incomeReduction = hasVal(a.incomeReduction) ? fmt$(a.incomeReduction) : '—';
  const taxSavings      = hasVal(a.taxSavings) ? fmt$(a.taxSavings) : '—';

  const streetNum = (a.streetAddress || '').trim().split(' ')[0].replace(/\D/g, '');
  const postal    = (a.postalCode || '').trim();
  const propId    = streetNum && postal
    ? `${streetNum}-${postal}`
    : streetNum || postal || p.id?.slice(-8).toUpperCase() || '—';

  const publishedDate = formatPublishedDate(p);

  const price             = parseFloat(a.price);
  const downPct           = price > 0 ? (downPaymentNum / price) * 100 : null;
  const normFinancing     = (a.financingType || '').toUpperCase().replace(/[\s_-]+/g, '');
  const isCreativeFinance = normFinancing === 'SELLER' || normFinancing === 'SUBJECTTO' || normFinancing === 'HYBRID';

  const activeTags = [
    { key: 'jv',          show: a.fiftyFiftyPartner === true,                                          label: '50/50 Joint Venture',     c: { bg: '#F3F0FF', border: '#7C3AED', text: '#7C3AED' } },
    { key: 'preapproved', show: a.fiftyFiftyPreApproved === true,                                      label: '50-50 Pre Approved',      c: { bg: '#E8F0FF', border: '#3B82F6', text: '#3B82F6' } },
    { key: 'turnkey',     show: isTurnkeyDeal(a),                                                      label: 'Turnkey Fully Furnished', c: { bg: '#ECFDF5', border: '#1F9D55', text: '#1F9D55' } },
    { key: 'creative',    show: isCreativeFinance,                                                     label: 'Creative Financing',      c: { bg: '#FFFBEB', border: '#D9A40C', text: '#D9A40C' } },
    { key: 'lowrate',     show: !isNaN(interestRateRaw) && interestRateRaw > 0 && interestRateRaw < 5, label: 'Low Interest Rate',       c: { bg: '#E0F7FA', border: '#0891B2', text: '#0891B2' } },
    { key: 'lowentry',    show: downPct !== null && downPct < 10,                                      label: 'Low Entry Fee',           c: { bg: '#ECFEFF', border: '#0D9488', text: '#0D9488' } },
    { key: 'discounted',  show: a.discountPrice === true,                                              label: 'Discounted Price',        c: { bg: '#FFF1F2', border: '#D14343', text: '#D14343' } },
  ].filter((t) => t.show);

  const handleShare = async () => {
    try {
      await Share.share({ message: `Check out this property: ${p.title || addressLine(p)}` });
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (_) {}
  };

  return (
    <View style={cs.card}>
      {/* Image Slider — swipeable horizontal pager. Tapping any image opens
          the fullscreen lightbox (built into ImageCarousel). Status badge +
          favorite star are stacked as overlay children. */}
      <ImageCarousel
        images={allImages}
        height={210}
        index={imgIndex}
        onIndexChange={setImgIndex}
      >
        {/* Status badge */}
        <View style={cs.badgePos}>
          <View style={[cs.statusBadge, { backgroundColor: ss.bg }]}>
            {p.status?.toUpperCase() === 'ACTIVE' ? (
              <View style={cs.activeDot} />
            ) : (
              <Ionicons name="checkmark" size={11} color={ss.text} />
            )}
            <Text style={[cs.statusText, { color: ss.text }]}>
              {(p.status || 'PUBLISHED').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Star — always filled (all cards here are favorites); tap removes */}
        <Pressable
          style={cs.favPos}
          onPress={onToggleFavorite}
          hitSlop={8}
          disabled={favoriteLoading}
        >
          <View style={[cs.favBtn, favoriteLoading && { opacity: 0.6 }]}>
            {favoriteLoading ? (
              <ActivityIndicator size="small" color={colors.star} />
            ) : (
              <Ionicons name="star" size={18} color={colors.star} />
            )}
          </View>
        </Pressable>
      </ImageCarousel>

      {/* Content */}
      <View style={cs.content}>
        <View style={cs.addressRow}>
          <Ionicons name="location-outline" size={15} color={colors.primary} style={cs.addressIcon} />
          <Text style={cs.addressText} numberOfLines={2}>{addressLine(p)}</Text>
        </View>

        <Text style={cs.price}>{fmt$(displayPrice || p.price)}</Text>

        <Text style={cs.propId}>
          <Text style={cs.propIdLabel}>Property ID: </Text>
          {propId}
        </Text>

        {publishedDate && (
          <Text style={cs.published}>
            <Text style={cs.publishedLabel}>Published: </Text>
            {publishedDate}
          </Text>
        )}

        {/* Tags — clean pills, capped at 3 with a +N overflow chip */}
        {activeTags.length > 0 && (
          <View style={cs.tagsRow}>
            {activeTags.slice(0, 3).map((tag) => (
              <View key={tag.key} style={[cs.tagChip, { backgroundColor: tag.c.bg }]}>
                <View style={[cs.tagDot, { backgroundColor: tag.c.text }]} />
                <Text style={[cs.tagText, { color: tag.c.text }]} numberOfLines={1}>{tag.label}</Text>
              </View>
            ))}
            {activeTags.length > 3 && (
              <View style={[cs.tagChip, cs.tagMore]}>
                <Text style={[cs.tagText, { color: colors.textSecondary }]}>+{activeTags.length - 3}</Text>
              </View>
            )}
          </View>
        )}

        {/* Key metrics — compact stat panel (full nightly tiers live on the
            detail page to keep the listing card short and scannable). */}
        <View style={cs.metricsPanel}>
          <View style={cs.dealRow}>
            <DealCell label="INTEREST RATE" value={interestRate} />
            <DealCell label="ENTRY / DOWN"  value={entryDown} />
            <DealCell label="PITI"          value={piti} accent last />
          </View>
          <View style={[cs.dealRow, cs.dealRowBorderTop]}>
            <DealCell label="FINANCING" value={financing} />
            <DealCell label="TURNKEY"   value={turnkey} />
            <DealCell label="OCCUPANCY" value={occupancy} last />
          </View>
        </View>

        <View style={cs.summaryRow}>
          <View style={[cs.summaryBox, cs.summaryYellow]}>
            <Text style={cs.summaryLabel}>EST. INCOME REDUCTION</Text>
            <Text style={cs.summaryValue}>{incomeReduction}</Text>
          </View>
          <View style={[cs.summaryBox, cs.summaryGreen]}>
            <Text style={cs.summaryLabel}>EST. TAX SAVINGS</Text>
            <Text style={[cs.summaryValue, cs.summaryAccent]}>{taxSavings}</Text>
          </View>
        </View>

        <View style={cs.actionsRow}>
          <Pressable onPress={handleShare} style={cs.copyLink}>
            <Ionicons name="link-outline" size={15} color={colors.primaryAccent} />
            <Text style={cs.copyLinkText}>{linkCopied ? 'Shared!' : 'Copy Link'}</Text>
          </Pressable>
          <Pressable
            onPress={onView}
            style={({ pressed }) => [cs.viewBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={cs.viewBtnText}>View Details</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const makeCsStyles = (colors: ThemeColors) => StyleSheet.create({
  card:             { backgroundColor: colors.bg, borderRadius: radius.lg, overflow: 'hidden', ...shadows.card, marginBottom: spacing.md },
  badgePos:         { position: 'absolute', top: spacing.md, left: spacing.md },
  statusBadge:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  statusText:       { ...typography.captionStrong, textTransform: 'uppercase', letterSpacing: 0.5 },
  activeDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  favPos:           { position: 'absolute', top: spacing.md, right: spacing.md },
  favBtn:           { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center', ...shadows.card },
  content:          { padding: spacing.lg },
  addressRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: spacing.sm },
  addressIcon:      { marginTop: 3 },
  addressText:      { ...typography.bodyStrong, color: colors.text, flex: 1, fontSize: 15.5, lineHeight: 21, letterSpacing: -0.1 },
  price:            { ...typography.display, color: colors.primary, fontSize: 27, letterSpacing: -0.5, marginBottom: spacing.xs },
  propId:           { ...typography.caption, color: colors.textMuted, marginBottom: 2 },
  propIdLabel:      { fontWeight: '700', color: colors.textSecondary },
  published:        { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
  publishedLabel:   { fontWeight: '700', color: colors.textSecondary },
  tagsRow:          { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md, flexWrap: 'wrap' },
  tagChip:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  tagDot:           { width: 6, height: 6, borderRadius: 3 },
  tagText:          { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.1 },
  tagMore:          { backgroundColor: colors.bgAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  metricsPanel:     { backgroundColor: colors.bgAlt, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden', marginTop: spacing.sm, marginBottom: spacing.md },
  dealRow:          { flexDirection: 'row', backgroundColor: 'transparent' },
  dealRowBorderTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  summaryRow:       { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  summaryBox:       { flex: 1, borderRadius: radius.md, padding: spacing.md },
  summaryYellow:    { backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warning },
  summaryGreen:     { backgroundColor: colors.successSoft, borderWidth: 1, borderColor: colors.success },
  summaryLabel:     { ...typography.tiny, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  summaryValue:     { ...typography.h3, color: colors.text },
  summaryAccent:    { color: colors.primaryAccent },
  actionsRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  copyLink:         { flexDirection: 'row', alignItems: 'center', gap: 5 },
  copyLinkText:     { ...typography.bodyStrong, color: colors.primaryAccent },
  viewBtn:          { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm + 2, borderRadius: radius.md, ...shadows.primaryButton },
  viewBtnText:      { ...typography.bodyStrong, color: '#fff' },
});

// ── Search + sort helpers ──────────────────────────────────────────────────────

const FAV_SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'newest',     label: 'Newest' },
  { value: 'oldest',     label: 'Oldest' },
  { value: 'price-high', label: 'Price ↓' },
  { value: 'price-low',  label: 'Price ↑' },
];

const favDateVal = (p: Property): number => {
  const a = p as any;
  const raw = a.publishedAt || a.submittedAt || a.createdAt || a.updatedAt;
  const t = raw ? new Date(raw).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
};

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ClientFavoritesScreen() {
  const router = useRouter();
  const qc     = useQueryClient();
  const headerBell = useNotificationsHeader();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const { data: allDeals = [], isLoading: dealsLoading } = useQuery({
    queryKey: ['published-deals'],
    queryFn:  getPublishedDeals,
  });

  const { data: favoriteIds = [], isLoading: favsLoading, refetch: refetchFavs, isRefetching } = useQuery({
    queryKey: ['favorites'],
    queryFn:  getFavorites,
  });

  // Optimistic favorites — see client-browse.tsx for the rationale. The
  // visible difference here is that removing a favorite drops the card
  // out of the list immediately (favoritedDeals filters on the cache),
  // so users get instant feedback instead of a 1–2s wait.
  const removeFavMutation = useMutation({
    mutationFn: removeFavorite,
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ['favorites'] });
      const prev = qc.getQueryData<string[]>(['favorites']) ?? [];
      qc.setQueryData<string[]>(['favorites'], prev.filter((x) => x !== id));
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(['favorites'], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });

  const addFavMutation = useMutation({
    mutationFn: addFavorite,
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ['favorites'] });
      const prev = qc.getQueryData<string[]>(['favorites']) ?? [];
      if (!prev.includes(id)) {
        qc.setQueryData<string[]>(['favorites'], [...prev, id]);
      }
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(['favorites'], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });

  const [pendingFavId, setPendingFavId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const handleToggleFavorite = (id: string) => {
    if (pendingFavId) return;
    setPendingFavId(id);
    const finish = () => setPendingFavId(null);
    if (favoriteIds.includes(id)) {
      removeFavMutation.mutate(id, { onSettled: finish });
    } else {
      addFavMutation.mutate(id, { onSettled: finish });
    }
  };

  useEffect(() => {
    if (!allDeals.length) return;
    const urls = allDeals
      .map((p: any) => {
        const imgs = [
          ...(Array.isArray(p.coverPhoto) ? p.coverPhoto : []),
          ...(Array.isArray(p.exteriorImages) ? p.exteriorImages : []),
          ...(Array.isArray(p.interiorImages) ? p.interiorImages : []),
          ...(Array.isArray(p.images) ? p.images : []),
        ].filter(Boolean);
        return imgs[0] as string | undefined;
      })
      .filter((u): u is string => !!u);
    if (urls.length) Image.prefetch(urls);
  }, [allDeals]);

  // Keep a card visible while its un-favorite request is in flight so the
  // spinner on the star is actually seen — otherwise the optimistic cache
  // update would remove the card before the loader could render. Once the
  // network settles, pendingFavId clears and the card drops out normally.
  const favoritedDeals = allDeals.filter(
    (p) => favoriteIds.includes(p.id) || pendingFavId === p.id,
  );
  const isLoading      = dealsLoading || favsLoading;
  // True favorites count — excludes the optimistic "still visible during
  // un-favorite" row so the header reflects what the user actually has
  // saved, not what's currently rendered.
  const favCount = allDeals.filter((p) => favoriteIds.includes(p.id)).length;

  // Apply in-favorites search + sort (the underlying favorited set is small,
  // so a per-render pass is fine — no memo needed).
  const displayed = (() => {
    let list = favoritedDeals;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const a = p as any;
        const streetNum = String(a.streetAddress || '').trim().split(' ')[0].replace(/\D/g, '');
        const postal = String(a.postalCode || '').trim();
        const propId = streetNum && postal ? `${streetNum}-${postal}` : streetNum || postal || '';
        const hay = `${p.title ?? ''} ${addressLine(p)} ${a.city ?? p.address?.city ?? ''} ${propId}`.toLowerCase();
        return hay.includes(q);
      });
    }
    const sorted = [...list];
    switch (sortBy) {
      case 'oldest':     sorted.sort((a, b) => favDateVal(a) - favDateVal(b)); break;
      case 'price-high': sorted.sort((a, b) => Number((b as any).price || 0) - Number((a as any).price || 0)); break;
      case 'price-low':  sorted.sort((a, b) => Number((a as any).price || 0) - Number((b as any).price || 0)); break;
      default:           sorted.sort((a, b) => favDateVal(b) - favDateVal(a)); break; // newest
    }
    return sorted;
  })();

  const ListHeader = (
    <>
      <View style={styles.summaryWrap}>
        <View style={styles.summaryIcon}>
          <Ionicons name="star" size={18} color={colors.star} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryHeading}>Saved Properties</Text>
          <Text style={styles.summarySub}>
            {favCount === 0
              ? 'Tap the star on any property to save it here.'
              : `${favCount} ${favCount === 1 ? 'property' : 'properties'} saved`}
          </Text>
        </View>
        {favCount > 0 ? (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{favCount}</Text>
          </View>
        ) : null}
      </View>

      {favCount > 0 ? (
        <View style={styles.controls}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search saved..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            {search ? (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.sortRow}>
            {FAV_SORT_OPTIONS.map((o) => {
              const active = sortBy === o.value;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => setSortBy(o.value)}
                  style={[styles.sortChip, active && styles.sortChipActive]}
                >
                  <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </>
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="My Favorites"
        subtitle={
          isLoading
            ? 'Loading…'
            : favCount === 0
              ? 'No saved properties yet'
              : `${favCount} saved ${favCount === 1 ? 'property' : 'properties'} · pull to refresh`
        }
        iconName="star"
        onProfilePress={() => router.push('/(tabs)/profile')}
        {...headerBell}
      />

      {isLoading ? (
        <PropertyListSkeleton />
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={ListHeader}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetchFavs()}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            favCount > 0 && search.trim() ? (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={64} color={colors.border} />
                <Text style={styles.emptyTitle}>No matches</Text>
                <Text style={styles.emptyBody}>
                  No saved properties match “{search.trim()}”.
                </Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="star-outline" size={64} color={colors.border} />
                <Text style={styles.emptyTitle}>No favorites yet</Text>
                <Text style={styles.emptyBody}>
                  Browse properties and tap the star icon to save them here.
                </Text>
              </View>
            )
          }
          renderItem={({ item: p }) => (
            <PropertyCard
              p={p}
              onView={() => router.push({ pathname: '/properties/[id]', params: { id: p.id } })}
              onToggleFavorite={() => handleToggleFavorite(p.id)}
              favoriteLoading={pendingFavId === p.id}
            />
          )}
        />
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgAlt },
  list:   { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl * 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },

  // Summary header — mirrors the Notifications page's count strip so users
  // see a prominent saved-properties count before scrolling.
  summaryWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryHeading: {
    ...typography.bodyStrong,
    color: colors.text,
    fontSize: 15,
  },
  summarySub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  countBadge: {
    minWidth: 36,
    paddingHorizontal: spacing.sm,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    color: colors.textOnPrimary,
    fontWeight: '700',
    fontSize: 14,
  },

  // Search + sort controls
  controls: { marginBottom: spacing.md, gap: spacing.sm },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, padding: 0 },
  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sortChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  sortChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sortChipText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  sortChipTextActive: { color: colors.textOnPrimary },

  emptyState: { alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
  emptyTitle: { ...typography.h2, color: colors.text, marginTop: spacing.lg },
  emptyBody:  { ...typography.body, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
});
