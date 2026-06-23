import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/Button';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ErrorModal } from '@/components/ErrorModal';
import { ImageCarousel } from '@/components/ImageCarousel';
import { MultiSelectChips } from '@/components/MultiSelectChips';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PropertyListSkeleton } from '@/components/Skeleton';
import { SuccessModal } from '@/components/SuccessModal';
import { useNotificationsHeader } from '@/hooks/useNotificationsHeader';
import { addFavorite, deleteBuyBox, getBuyBox, getFavorites, getPublishedDeals, removeFavorite, saveBuyBox } from '@/api/deals';
import { env } from '@/config/env';
import { radius, shadows, spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';
import {
  FINANCING_OPTIONS,
  TURNKEY_OPTIONS,
  VACATION_RENTAL_MARKETS,
  TRAVEL_MOTIVATIONS,
} from '@/utils/propertyFormSchema';
import { US_STATE_OPTIONS, resolveStateCode } from '@/utils/usStates';
import { formatPublishedDate } from '@/utils/date';
import type { Property } from '@/types';

const PAGE_SIZE = 10;

const SORT_OPTIONS = [
  { label: 'Newest First',       value: 'newest'     },
  { label: 'Oldest First',       value: 'oldest'     },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Price: Low to High', value: 'price_asc'  },
] as const;
type SortKey = typeof SORT_OPTIONS[number]['value'];

function fmt$(n?: number | string | null) {
  const v = parseFloat(String(n));
  if (!v || isNaN(v)) return '—';
  return `$${Math.trunc(v).toLocaleString('en-US')}`;
}
function fmtPct(n?: number | null) { return n != null ? `${n}%` : '—'; }


/**
 * Property heading — identical to the submitter web view, which renders
 * `{yearBuilt} {deal.title}` where the backend stores `title` as
 * "{beds} Bedroom, {baths} Bathroom in {city}, {ST}". We prefer that stored
 * title verbatim so the app and submitter never drift, and only reconstruct
 * the same shape when an older record has no title.
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

/**
 * Best-available listing timestamp (ms). Prefers when the deal went live /
 * was submitted, falling back to record timestamps. Returns 0 when none parse
 * so sorting stays deterministic instead of returning 1 for equal values
 * (which produced an unstable, not-actually-newest order before).
 */
function dealTimestamp(d: Property): number {
  const a = d as any;
  const raw = a.publishedAt || a.submittedAt || d.createdAt || d.updatedAt;
  const t = raw ? Date.parse(raw) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

function applySort(deals: Property[], s: SortKey): Property[] {
  const arr = [...deals];
  arr.sort((a, b) => {
    if (s === 'price_asc') return (a.price || 0) - (b.price || 0);
    if (s === 'price_desc') return (b.price || 0) - (a.price || 0);
    const ta = dealTimestamp(a);
    const tb = dealTimestamp(b);
    return s === 'oldest' ? ta - tb : tb - ta; // default: newest first
  });
  return arr;
}

// "Active" covers both published and approved listings (mirrors the web client).
const STATUS_FILTER_OPTIONS: { key: string; label: string; values: string[] }[] = [
  { key: 'active',  label: 'Active',  values: ['published', 'approved'] },
  { key: 'pending', label: 'Pending', values: ['pending'] },
  { key: 'sold',    label: 'Sold',    values: ['sold'] },
];

// Tags filter — matches the web app's CustomerView/FilterBar Tags section exactly.
const TAG_OPTIONS: { value: string; label: string }[] = [
  { value: 'jv',          label: '50/50 Joint Venture'     },
  { value: 'turnkey',     label: 'Turnkey Fully Furnished' },
  { value: 'creative',    label: 'Creative Financing'      },
  { value: 'lowrate',     label: 'Low Interest Rate'       },
  { value: 'lowentry',    label: 'Low Entry Fee'           },
  { value: 'discounted',  label: 'Discounted Price'        },
];

// STR pricing tiers — mirrors the web filter and DealCard.jsx field naming.
const PROPERTY_TYPE_FILTER_OPTIONS = [
  { value: 'Single_Family', label: 'Single Family' },
  { value: 'Multi_Family',  label: 'Multi Family'  },
  { value: 'Condo',         label: 'Condo'         },
  { value: 'Townhouse',     label: 'Townhouse'     },
  { value: 'Land',          label: 'Land'          },
];

const STR_TIERS = ['budget', 'economy', 'midscale', 'upscale', 'luxury'] as const;
type StrTier = typeof STR_TIERS[number];

const STR_TIER_LABELS: Record<StrTier, string> = {
  budget:   'Budget',
  economy:  'Economy',
  midscale: 'Midscale',
  upscale:  'Upscale',
  luxury:   'Luxury',
};

// Per-tier range filter state: each tier has independent {min, max} strings.
type TierRanges = Record<StrTier, { min: string; max: string }>;
const EMPTY_TIER_RANGES: TierRanges = {
  budget:   { min: '', max: '' },
  economy:  { min: '', max: '' },
  midscale: { min: '', max: '' },
  upscale:  { min: '', max: '' },
  luxury:   { min: '', max: '' },
};
const countActiveTierRanges = (r: TierRanges) =>
  STR_TIERS.reduce((acc, t) => acc + (r[t].min || r[t].max ? 1 : 0), 0);

// Mirrors the card's activeTags predicates. Returns the set of tag VALUES
// (from TAG_OPTIONS) that apply to the given deal.
function getDealTags(p: any): Set<string> {
  const out = new Set<string>();
  if (p.fiftyFiftyPartner === true) out.add('jv');
  if (p.fiftyFiftyPreApproved === true) out.add('preapproved');
  const tk = (p.turnkeyFurnished || '').toString().toUpperCase().replace(/-/g, '_');
  if (tk === 'TURNKEY_OPERATING' || tk === 'FURNISHED_NOT_OPERATING') out.add('turnkey');
  const fin = (p.financingType || '').toString().toLowerCase();
  if (fin === 'seller' || fin === 'subject-to' || fin === 'hybrid') out.add('creative');
  const rate = parseFloat(p.subjInterestRate ?? p.sellerInterestRate);
  if (!isNaN(rate) && rate > 0 && rate < 5) out.add('lowrate');
  const price = Number(p.price) || 0;
  const dp = Number(p.downPayment) || 0;
  if (price > 0 && (dp / price) * 100 < 10) out.add('lowentry');
  if (p.discountPrice === true) out.add('discounted');
  if (Array.isArray(p.specialTags)) {
    for (const t of p.specialTags) out.add(String(t));
  }
  return out;
}

function FilterSection({
  icon,
  title,
  open,
  onToggle,
  children,
}: {
  icon: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.filterSection}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          styles.filterSectionHeader,
          pressed && { backgroundColor: colors.primarySoft },
        ]}
      >
        <Text style={styles.filterSectionIcon}>{icon}</Text>
        <Text style={styles.filterSectionTitle}>{title}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </Pressable>
      {open ? <View style={styles.filterSectionBody}>{children}</View> : null}
    </View>
  );
}

function CheckRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable onPress={onToggle} style={styles.checkRow}>
      <View style={[styles.checkBox, checked && styles.checkBoxOn]}>
        {checked ? (
          <Ionicons name="checkmark" size={14} color={colors.textOnPrimary} />
        ) : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
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

// ── Helpers matching DealCard.jsx ────────────────────────────────────────────
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

// ── PropertyCard ──────────────────────────────────────────────────────────────
function PropertyCard({
  p,
  onView,
  isFavorited,
  onToggleFavorite,
  favoriteLoading,
}: {
  p: Property;
  onView: () => void;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  favoriteLoading?: boolean;
}) {
  const { colors } = useTheme();
  const cs = useThemedStyles(makeCsStyles);
  const [linkCopied, setLinkCopied] = useState(false);
  const [imgIndex,   setImgIndex]   = useState(0);
  const a   = p as any;
  const ss  = statusStyle(p.status);

  const allImages: string[] = [
    ...(Array.isArray(a.coverPhoto)       ? a.coverPhoto       : []),
    ...(Array.isArray(a.exteriorImages)   ? a.exteriorImages   : []),
    ...(Array.isArray(a.interiorImages)   ? a.interiorImages   : []),
    ...(Array.isArray(p.images)           ? p.images           : []),
    ...(Array.isArray(a.additionalImages) ? a.additionalImages : []),
  ].filter(Boolean);

  const totalImgs = allImages.length;

  // Metrics — matching DealCard.jsx
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

  // Property ID: streetNum-postalCode (matching DealCard.jsx)
  const streetNum = (a.streetAddress || '').trim().split(' ')[0].replace(/\D/g, '');
  const postal    = (a.postalCode || '').trim();
  const propId    = streetNum && postal
    ? `${streetNum}-${postal}`
    : streetNum || postal || p.id?.slice(-8).toUpperCase() || '—';

  const publishedDate = formatPublishedDate(p);

  // Tags — dynamically built from deal properties (matching DealCard.jsx)
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

  // Nightly rate tiers — field names matching DealCard.jsx (anr_*, egr_*, occupancyRate_*)
  const handleShare = async () => {
    try {
      const baseUrl = env.apiUrl.replace(/\/api\/?$/, '');
      const url = `${baseUrl}/property/${p.id}`;
      await Clipboard.setStringAsync(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (_) {}
  };
  
  return (
    <View style={cs.card}>
      {/* Image Slider — swipeable horizontal pager (chevrons + dots come from
          ImageCarousel). Status badge + favorite star ride on top as overlays. */}
      <ImageCarousel
        images={allImages}
        height={210}
        index={imgIndex}
        onIndexChange={setImgIndex}
      >
        {/* Status badge — SOLD / PENDING / ACTIVE */}
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
              <Ionicons
                name={isFavorited ? 'star' : 'star-outline'}
                size={18}
                color={colors.star}
              />
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

        {/* Price includes assignment fee */}
        <Text style={cs.price}>{fmt$(displayPrice || p.price)}</Text>

        {/* Property ID: streetNum-postalCode */}
        <Text style={cs.propId}>
          <Text style={cs.propIdLabel}>Property ID: </Text>
          {propId}
        </Text>

        {/* Published date */}
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
            <Text style={cs.copyLinkText}>{linkCopied ? 'Copied!' : 'Copy Link'}</Text>
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
  imageBox:         { width: '100%', height: 210, position: 'relative', backgroundColor: colors.bgAlt },
  image:            { width: '100%', height: '100%' },
  imageFallback:    { alignItems: 'center', justifyContent: 'center' },
  badgePos:         { position: 'absolute', top: spacing.md, left: spacing.md },
  statusBadge:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  statusText:       { ...typography.captionStrong, textTransform: 'uppercase', letterSpacing: 0.5 },
  activeDot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  favPos:           { position: 'absolute', top: spacing.md, right: spacing.md },
  favBtn:           { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center', ...shadows.card },
  arrowLeft:        { position: 'absolute', left: spacing.sm, top: 87, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  arrowRight:       { position: 'absolute', right: spacing.sm, top: 87, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  dotsRow:          { position: 'absolute', bottom: spacing.sm, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  dot:              { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive:        { backgroundColor: '#fff', width: 22 },
  imgCounter:       { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  imgCounterText:   { color: '#fff', fontSize: 12, fontWeight: '600' },
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

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ClientBrowseScreen() {
  const router  = useRouter();
  const qc      = useQueryClient();
  const headerBell = useNotificationsHeader();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [search,       setSearch]       = useState('');
  const [sortBy,       setSortBy]       = useState<SortKey>('newest');
  const [showSort,     setShowSort]     = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [showFilters,          setShowFilters]          = useState(false);
  const [hasSavedBuyBox,       setHasSavedBuyBox]       = useState(false);
  const [savedBuyBoxSnapshot,  setSavedBuyBoxSnapshot]  = useState<Record<string, any> | null>(null);
  const [buyBoxModal,          setBuyBoxModal]          = useState<{ open: boolean; type: 'success' | 'error'; message: string }>({ open: false, type: 'success', message: '' });
  const [deleteConfirmModal,   setDeleteConfirmModal]   = useState(false);
  // Accordion: only one section can be open at a time. null = all collapsed.
  const [openSection,        setOpenSection]        = useState<string | null>(
    'partnership',
  );
  const toggleSection = (id: string) =>
    setOpenSection((cur) => (cur === id ? null : id));

  const [statusFilter,       setStatusFilter]       = useState<string[]>([]);
  const [stateFilter,        setStateFilter]        = useState<string[]>([]);
  const [cityFilter,         setCityFilter]         = useState('');
  const [zipFilter,          setZipFilter]          = useState('');
  const [categoryFilter,     setCategoryFilter]     = useState<string[]>([]);
  const [partnershipAvail,   setPartnershipAvail]   = useState(false);
  const [partnershipApproved, setPartnershipApproved] = useState(false);
  const [minPrice,           setMinPrice]           = useState('');
  const [maxPrice,           setMaxPrice]           = useState('');
  const [minDown,            setMinDown]            = useState('');
  const [maxDown,            setMaxDown]            = useState('');
  const [minRate,            setMinRate]            = useState('');
  const [maxRate,            setMaxRate]            = useState('');
  const [minBeds,            setMinBeds]            = useState('');
  const [maxBeds,            setMaxBeds]            = useState('');
  const [minBaths,           setMinBaths]           = useState('');
  const [maxBaths,           setMaxBaths]           = useState('');
  const [minSqft,            setMinSqft]            = useState('');
  const [minYearBuilt,       setMinYearBuilt]       = useState('');
  const [financingFilter,    setFinancingFilter]    = useState<string[]>([]);
  const [turnkeyFilter,      setTurnkeyFilter]      = useState<string[]>([]);
  const [minMonthlyPayment,  setMinMonthlyPayment]  = useState('');
  const [maxMonthlyPayment,  setMaxMonthlyPayment]  = useState('');
  const [minOccupancy,       setMinOccupancy]       = useState('');
  const [maxOccupancy,       setMaxOccupancy]       = useState('');
  const [anrRanges,          setAnrRanges]          = useState<TierRanges>(EMPTY_TIER_RANGES);
  const [egrRanges,          setEgrRanges]          = useState<TierRanges>(EMPTY_TIER_RANGES);
  const setAnrRange = (tier: StrTier, key: 'min' | 'max', value: string) =>
    setAnrRanges((prev) => ({ ...prev, [tier]: { ...prev[tier], [key]: value } }));
  const setEgrRange = (tier: StrTier, key: 'min' | 'max', value: string) =>
    setEgrRanges((prev) => ({ ...prev, [tier]: { ...prev[tier], [key]: value } }));

  const [marketsFilter,      setMarketsFilter]      = useState<string[]>([]);
  const [motivationsFilter,  setMotivationsFilter]  = useState<string[]>([]);
  const [tagsFilter,         setTagsFilter]         = useState<string[]>([]);
  const [minIncomeReduction, setMinIncomeReduction] = useState('');
  const [maxIncomeReduction, setMaxIncomeReduction] = useState('');
  const [minTaxSavings,      setMinTaxSavings]      = useState('');
  const [maxTaxSavings,      setMaxTaxSavings]      = useState('');
  const [maxYearBuilt,       setMaxYearBuilt]       = useState('');
  const [maxSqft,            setMaxSqft]            = useState('');

  const toggleIn = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const activeFilterCount =
    statusFilter.length +
    stateFilter.length +
    (cityFilter ? 1 : 0) +
    (zipFilter ? 1 : 0) +
    categoryFilter.length +
    (partnershipAvail ? 1 : 0) +
    (partnershipApproved ? 1 : 0) +
    (minPrice || maxPrice ? 1 : 0) +
    (minDown || maxDown ? 1 : 0) +
    (minRate || maxRate ? 1 : 0) +
    (minBeds || maxBeds ? 1 : 0) +
    (minBaths || maxBaths ? 1 : 0) +
    (minSqft || maxSqft ? 1 : 0) +
    (minYearBuilt || maxYearBuilt ? 1 : 0) +
    financingFilter.length +
    turnkeyFilter.length +
    (minMonthlyPayment || maxMonthlyPayment ? 1 : 0) +
    (minOccupancy || maxOccupancy ? 1 : 0) +
    countActiveTierRanges(anrRanges) +
    countActiveTierRanges(egrRanges) +
    marketsFilter.length +
    motivationsFilter.length +
    tagsFilter.length +
    (minIncomeReduction || maxIncomeReduction ? 1 : 0) +
    (minTaxSavings || maxTaxSavings ? 1 : 0);

  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: ['published-deals'],
    queryFn:  getPublishedDeals,
  });

  // Prefetch the first image of every property as soon as data arrives so
  // images are already in the disk cache when the card scrolls into view.
  useEffect(() => {
    if (!data) return;
    const urls = data
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
  }, [data]);

  const { data: favoriteIds = [] } = useQuery({
    queryKey: ['favorites'],
    queryFn:  getFavorites,
  });

  // Optimistic favorites: the previous flow waited for the API round-trip
  // AND a refetch before the star icon changed — which felt like 1–2s of
  // dead clicks. onMutate now updates the cached favorites array immediately
  // so the star flips on tap; onError reverts if the network fails;
  // onSettled refetches as a final source-of-truth sync.
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

  // Track which property's star is mid-request so the card can dim it
  // slightly + ignore double-taps. We compare the addressed id rather than
  // a generic isPending so a slow card doesn't dim every other card.
  const [pendingFavId, setPendingFavId] = useState<string | null>(null);

  const handleToggleFavorite = (id: string) => {
    if (pendingFavId) return; // ignore taps while a request is in flight
    setPendingFavId(id);
    const finish = () => setPendingFavId(null);
    if (favoriteIds.includes(id)) {
      removeFavMutation.mutate(id, { onSettled: finish });
    } else {
      addFavMutation.mutate(id, { onSettled: finish });
    }
  };

  // ── Buy Box ───────────────────────────────────────────────────────────────────
  const buyBoxApplied = useRef(false);

  const { data: buyBoxData, refetch: refetchBuyBox } = useQuery({
    queryKey: ['buy-box'],
    queryFn:  getBuyBox,
    staleTime: 0, // always fetch fresh on mount so saved filters load reliably on mobile
  });

  useEffect(() => {
    if (buyBoxData === undefined) return; // still loading — wait for a real server response
    const isEmpty = !buyBoxData || Object.keys(buyBoxData).length === 0;
    if (isEmpty) {
      // Server says no buy box (null OR {}) — always clear if we had one applied,
      // regardless of buyBoxApplied, so web-side deletion is always reflected.
      if (hasSavedBuyBox) {
        setHasSavedBuyBox(false);
        setSavedBuyBoxSnapshot(null);
        clearFilters();
        buyBoxApplied.current = false;
      }
      return;
    }
    // Has real data — only apply once; skip if user has already seen it to avoid
    // overwriting manual filter changes on background refetches.
    if (buyBoxApplied.current) return;
    buyBoxApplied.current = true;
    setHasSavedBuyBox(true);
    setSavedBuyBoxSnapshot(buyBoxData);
    // Keys match the web app's CustomerView.jsx filter format for cross-platform compatibility
    if (buyBoxData.selectedStatuses)         setStatusFilter(buyBoxData.selectedStatuses);
    if (buyBoxData.selectedStates)           setStateFilter(buyBoxData.selectedStates);
    if (buyBoxData.advPropertyType)          setCategoryFilter(Array.isArray(buyBoxData.advPropertyType) ? buyBoxData.advPropertyType : [buyBoxData.advPropertyType]);
    if (buyBoxData.fiftyFiftyPartner)        setPartnershipAvail(true);
    if (buyBoxData.fiftyFiftyPreApproved)    setPartnershipApproved(true);
    if (buyBoxData.minPrice)                 setMinPrice(buyBoxData.minPrice);
    if (buyBoxData.maxPrice)                 setMaxPrice(buyBoxData.maxPrice);
    if (buyBoxData.minDownPayment)           setMinDown(buyBoxData.minDownPayment);
    if (buyBoxData.maxDownPayment)           setMaxDown(buyBoxData.maxDownPayment);
    if (buyBoxData.interestRateMin)          setMinRate(buyBoxData.interestRateMin);
    if (buyBoxData.subjectToInterestRateMax) setMaxRate(buyBoxData.subjectToInterestRateMax);
    if (buyBoxData.advBedroomsMin)           setMinBeds(buyBoxData.advBedroomsMin);
    if (buyBoxData.advBedroomsMax)           setMaxBeds(buyBoxData.advBedroomsMax);
    if (buyBoxData.advBathroomsMin)          setMinBaths(buyBoxData.advBathroomsMin);
    if (buyBoxData.advBathroomsMax)          setMaxBaths(buyBoxData.advBathroomsMax);
    if (buyBoxData.advSqftMin)               setMinSqft(buyBoxData.advSqftMin);
    if (buyBoxData.advSqftMax)               setMaxSqft(buyBoxData.advSqftMax);
    if (buyBoxData.advYearBuiltMin)          setMinYearBuilt(buyBoxData.advYearBuiltMin);
    if (buyBoxData.advYearBuiltMax)          setMaxYearBuilt(buyBoxData.advYearBuiltMax);
    if (buyBoxData.advFinancing)             setFinancingFilter(Array.isArray(buyBoxData.advFinancing) ? buyBoxData.advFinancing : [buyBoxData.advFinancing]);
    if (buyBoxData.turnkeyFurnished)         setTurnkeyFilter(Array.isArray(buyBoxData.turnkeyFurnished) ? buyBoxData.turnkeyFurnished : [buyBoxData.turnkeyFurnished]);
    if (buyBoxData.advMonthlyPaymentMin)     setMinMonthlyPayment(buyBoxData.advMonthlyPaymentMin);
    if (buyBoxData.advMonthlyPaymentMax)     setMaxMonthlyPayment(buyBoxData.advMonthlyPaymentMax);
    if (buyBoxData.occupancyRateMin)         setMinOccupancy(buyBoxData.occupancyRateMin);
    if (buyBoxData.occupancyRateMax)         setMaxOccupancy(buyBoxData.occupancyRateMax);
    const newAnr = { ...EMPTY_TIER_RANGES };
    const newEgr = { ...EMPTY_TIER_RANGES };
    for (const t of STR_TIERS) {
      if (buyBoxData[`anrMin_${t}`]) newAnr[t] = { ...newAnr[t], min: buyBoxData[`anrMin_${t}`] };
      if (buyBoxData[`anrMax_${t}`]) newAnr[t] = { ...newAnr[t], max: buyBoxData[`anrMax_${t}`] };
      if (buyBoxData[`egrMin_${t}`]) newEgr[t] = { ...newEgr[t], min: buyBoxData[`egrMin_${t}`] };
      if (buyBoxData[`egrMax_${t}`]) newEgr[t] = { ...newEgr[t], max: buyBoxData[`egrMax_${t}`] };
    }
    setAnrRanges(newAnr);
    setEgrRanges(newEgr);
    if (buyBoxData.vacationRentalMarkets)    setMarketsFilter(buyBoxData.vacationRentalMarkets);
    if (buyBoxData.travelMotivations)        setMotivationsFilter(buyBoxData.travelMotivations);
    if (buyBoxData.selectedTags)             setTagsFilter(buyBoxData.selectedTags);
    if (buyBoxData.incomeReductionMin)       setMinIncomeReduction(buyBoxData.incomeReductionMin);
    if (buyBoxData.incomeReductionMax)       setMaxIncomeReduction(buyBoxData.incomeReductionMax);
    if (buyBoxData.taxSavingsMin)            setMinTaxSavings(buyBoxData.taxSavingsMin);
    if (buyBoxData.taxSavingsMax)            setMaxTaxSavings(buyBoxData.taxSavingsMax);
  }, [buyBoxData]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!data) return [];
    let list: Property[] = data;

    // Mirror the web client (CustomerView): a pending property only surfaces
    // once it has been claimed (claimedAt set). "Needs Approval" deals — pending
    // with no claim — are never shown in browse.
    list = list.filter(
      (p) => !(String(p.status || '').toLowerCase() === 'pending' && p.claimedAt == null),
    );

    if (statusFilter.length) {
      list = list.filter((p) =>
        statusFilter.includes(String(p.status || '').toLowerCase()),
      );
    }
    if (stateFilter.length) {
      list = list.filter(
        (p) =>
          !!p.address?.state &&
          stateFilter.includes(resolveStateCode(p.address.state)),
      );
    }
    if (cityFilter.trim()) {
      const q = cityFilter.trim().toLowerCase();
      list = list.filter((p) =>
        String(p.address?.city ?? (p as any).city ?? '').toLowerCase().includes(q),
      );
    }
    if (zipFilter.trim()) {
      const q = zipFilter.trim().toLowerCase();
      list = list.filter((p) =>
        String(p.address?.zip ?? (p as any).postalCode ?? '').toLowerCase().includes(q),
      );
    }
    if (categoryFilter.length) {
      list = list.filter((p) => {
        const cat = String((p as any).category ?? p.propertyType ?? '').toUpperCase().replace(/-/g, '_');
        return cat && categoryFilter.some((f) => f.toUpperCase().replace(/-/g, '_') === cat);
      });
    }
    if (partnershipAvail) {
      list = list.filter((p) => !!(p as any).fiftyFiftyPartner);
    }
    if (partnershipApproved) {
      list = list.filter((p) => !!(p as any).fiftyFiftyPreApproved);
    }
    const min = Number(minPrice) || 0;
    const max = Number(maxPrice) || Number.POSITIVE_INFINITY;
    if (min > 0 || Number.isFinite(max)) {
      list = list.filter((p) => {
        const price = p.price ?? 0;
        return price >= min && price <= max;
      });
    }
    const minD = Number(minDown) || 0;
    const maxD = Number(maxDown) || Number.POSITIVE_INFINITY;
    if (minD > 0 || Number.isFinite(maxD)) {
      list = list.filter((p) => {
        const dp = Number((p as any).downPayment) || 0;
        return dp >= minD && dp <= maxD;
      });
    }
    const minR = Number(minRate) || 0;
    const maxR = Number(maxRate) || Number.POSITIVE_INFINITY;
    if (minR > 0 || Number.isFinite(maxR)) {
      list = list.filter((p) => {
        const a: any = p;
        const r = parseFloat(a.subjInterestRate ?? a.sellerInterestRate);
        return !isNaN(r) && r >= minR && r <= maxR;
      });
    }
    const mb = Number(minBeds) || 0;
    if (mb > 0) list = list.filter((p) => (p.bedrooms ?? 0) >= mb);
    const mxb = Number(maxBeds) || 0;
    if (mxb > 0) list = list.filter((p) => (p.bedrooms ?? 0) <= mxb);
    const mba = Number(minBaths) || 0;
    if (mba > 0) list = list.filter((p) => (p.bathrooms ?? 0) >= mba);
    const mxba = Number(maxBaths) || 0;
    if (mxba > 0) list = list.filter((p) => (p.bathrooms ?? 0) <= mxba);
    const minS = Number(minSqft) || 0;
    const maxS = Number(maxSqft) || Number.POSITIVE_INFINITY;
    if (minS > 0 || Number.isFinite(maxS)) {
      list = list.filter((p) => {
        const sq = Number((p as any).squareFootage ?? p.area) || 0;
        return sq >= minS && sq <= maxS;
      });
    }
    const minYr = Number(minYearBuilt) || 0;
    const maxYr = Number(maxYearBuilt) || Number.POSITIVE_INFINITY;
    if (minYr > 0 || Number.isFinite(maxYr)) {
      list = list.filter((p) => {
        const yr = Number((p as any).yearBuilt) || 0;
        return yr >= minYr && yr <= maxYr;
      });
    }

    if (financingFilter.length) {
      list = list.filter((p) =>
        financingFilter.includes(String((p as any).financingType || '').toLowerCase()),
      );
    }
    if (turnkeyFilter.length) {
      list = list.filter((p) => {
        const tk = String((p as any).turnkeyFurnished || '')
          .toUpperCase()
          .replace(/-/g, '_');
        return turnkeyFilter.includes(tk);
      });
    }

    // ANR — per-tier filter. Each tier independently filters by deal[`anr_${tier}`].
    for (const t of STR_TIERS) {
      const lo = Number(anrRanges[t].min) || 0;
      const hi = Number(anrRanges[t].max) || Number.POSITIVE_INFINITY;
      if (lo > 0 || Number.isFinite(hi)) {
        list = list.filter((p) => {
          const v = Number((p as any)[`anr_${t}`]) || 0;
          return v >= lo && v <= hi;
        });
      }
    }
    // EGR — same shape as ANR.
    for (const t of STR_TIERS) {
      const lo = Number(egrRanges[t].min) || 0;
      const hi = Number(egrRanges[t].max) || Number.POSITIVE_INFINITY;
      if (lo > 0 || Number.isFinite(hi)) {
        list = list.filter((p) => {
          const v = Number((p as any)[`egr_${t}`]) || 0;
          return v >= lo && v <= hi;
        });
      }
    }
    // Monthly payment / PITI range
    const minPiti = Number(minMonthlyPayment) || 0;
    const maxPiti = Number(maxMonthlyPayment) || Number.POSITIVE_INFINITY;
    if (minPiti > 0 || Number.isFinite(maxPiti)) {
      list = list.filter((p) => {
        const v = Number((p as any).totalMonthlyPayment) || 0;
        return v >= minPiti && v <= maxPiti;
      });
    }
    // Occupancy range (percentage 0-100)
    const minOcc = Number(minOccupancy) || 0;
    const maxOcc = Number(maxOccupancy) || Number.POSITIVE_INFINITY;
    if (minOcc > 0 || Number.isFinite(maxOcc)) {
      list = list.filter((p) => {
        const v = Number((p as any).occupancyRate) || 0;
        return v >= minOcc && v <= maxOcc;
      });
    }

    if (marketsFilter.length) {
      list = list.filter((p) => {
        const arr = (p as any).vacationRentalMarkets;
        return Array.isArray(arr) && arr.some((m: string) => marketsFilter.includes(m));
      });
    }
    if (motivationsFilter.length) {
      list = list.filter((p) => {
        const arr = (p as any).travelMotivations;
        return Array.isArray(arr) && arr.some((m: string) => motivationsFilter.includes(m));
      });
    }
    if (tagsFilter.length) {
      list = list.filter((p) => {
        const dealTags = getDealTags(p as any);
        return tagsFilter.some((t) => dealTags.has(t));
      });
    }

    const minIR = Number(minIncomeReduction) || 0;
    const maxIR = Number(maxIncomeReduction) || Number.POSITIVE_INFINITY;
    if (minIR > 0 || Number.isFinite(maxIR)) {
      list = list.filter((p) => {
        const v = Number((p as any).incomeReduction) || 0;
        return v >= minIR && v <= maxIR;
      });
    }
    const minTS = Number(minTaxSavings) || 0;
    const maxTS = Number(maxTaxSavings) || Number.POSITIVE_INFINITY;
    if (minTS > 0 || Number.isFinite(maxTS)) {
      list = list.filter((p) => {
        const v = Number((p as any).taxSavings) || 0;
        return v >= minTS && v <= maxTS;
      });
    }

    const q = search.trim().toLowerCase();
    if (q) {
      // Match admin Property Management — search across title + full address
      // (street, city, state, zip) + price (raw digits AND formatted with
      // commas/$ so "350", "350,000", "$350,000" all hit the same listing).
      list = list.filter((p) => {
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
    }

    return applySort(list, sortBy);
  }, [
    data,
    search,
    sortBy,
    statusFilter,
    stateFilter,
    cityFilter,
    zipFilter,
    categoryFilter,
    partnershipAvail,
    partnershipApproved,
    minPrice,
    maxPrice,
    minDown,
    maxDown,
    minRate,
    maxRate,
    minBeds,
    maxBeds,
    minBaths,
    maxBaths,
    minSqft,
    maxSqft,
    minYearBuilt,
    maxYearBuilt,
    financingFilter,
    turnkeyFilter,
    minMonthlyPayment,
    maxMonthlyPayment,
    minOccupancy,
    maxOccupancy,
    anrRanges,
    egrRanges,
    marketsFilter,
    motivationsFilter,
    tagsFilter,
    minIncomeReduction,
    maxIncomeReduction,
    minTaxSavings,
    maxTaxSavings,
  ]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = visibleCount < filtered.length;

  const clearFilters = () => {
    setSearch('');
    setSortBy('newest');
    setVisibleCount(PAGE_SIZE);
    setStatusFilter([]);
    setStateFilter([]);
    setCityFilter('');
    setZipFilter('');
    setCategoryFilter([]);
    setPartnershipAvail(false);
    setPartnershipApproved(false);
    setMinPrice('');
    setMaxPrice('');
    setMinDown('');
    setMaxDown('');
    setMinRate('');
    setMaxRate('');
    setMinBeds('');
    setMaxBeds('');
    setMinBaths('');
    setMaxBaths('');
    setMinSqft('');
    setMinYearBuilt('');
    setFinancingFilter([]);
    setTurnkeyFilter([]);
    setMinMonthlyPayment('');
    setMaxMonthlyPayment('');
    setMinOccupancy('');
    setMaxOccupancy('');
    setAnrRanges(EMPTY_TIER_RANGES);
    setEgrRanges(EMPTY_TIER_RANGES);
    setMarketsFilter([]);
    setMotivationsFilter([]);
    setTagsFilter([]);
    setMinIncomeReduction('');
    setMaxIncomeReduction('');
    setMinTaxSavings('');
    setMaxTaxSavings('');
    setMaxYearBuilt('');
    setMaxSqft('');
  };

  // ── Buy Box actions ───────────────────────────────────────────────────────────
  const buildFiltersPayload = (): Record<string, any> => {
    // Keys match the web app's CustomerView.jsx filter format for cross-platform compatibility
    const p: Record<string, any> = {};
    if (statusFilter.length)       p.selectedStatuses = statusFilter;
    if (stateFilter.length)        p.selectedStates = stateFilter;
    if (categoryFilter.length)     p.advPropertyType = categoryFilter[0];
    if (partnershipAvail)          p.fiftyFiftyPartner = true;
    if (partnershipApproved)       p.fiftyFiftyPreApproved = true;
    if (minPrice)                  p.minPrice = minPrice;
    if (maxPrice)                  p.maxPrice = maxPrice;
    if (minDown)                   p.minDownPayment = minDown;
    if (maxDown)                   p.maxDownPayment = maxDown;
    if (minRate)                   p.interestRateMin = minRate;
    if (maxRate)                   p.subjectToInterestRateMax = maxRate;
    if (minBeds)                   p.advBedroomsMin = minBeds;
    if (maxBeds)                   p.advBedroomsMax = maxBeds;
    if (minBaths)                  p.advBathroomsMin = minBaths;
    if (maxBaths)                  p.advBathroomsMax = maxBaths;
    if (minSqft)                   p.advSqftMin = minSqft;
    if (maxSqft)                   p.advSqftMax = maxSqft;
    if (minYearBuilt)              p.advYearBuiltMin = minYearBuilt;
    if (maxYearBuilt)              p.advYearBuiltMax = maxYearBuilt;
    if (financingFilter.length)    p.advFinancing = financingFilter;
    if (turnkeyFilter.length)      p.turnkeyFurnished = turnkeyFilter;
    if (minMonthlyPayment)         p.advMonthlyPaymentMin = minMonthlyPayment;
    if (maxMonthlyPayment)         p.advMonthlyPaymentMax = maxMonthlyPayment;
    if (minOccupancy)              p.occupancyRateMin = minOccupancy;
    if (maxOccupancy)              p.occupancyRateMax = maxOccupancy;
    for (const t of STR_TIERS) {
      if (anrRanges[t].min) p[`anrMin_${t}`] = anrRanges[t].min;
      if (anrRanges[t].max) p[`anrMax_${t}`] = anrRanges[t].max;
      if (egrRanges[t].min) p[`egrMin_${t}`] = egrRanges[t].min;
      if (egrRanges[t].max) p[`egrMax_${t}`] = egrRanges[t].max;
    }
    if (marketsFilter.length)     p.vacationRentalMarkets = marketsFilter;
    if (motivationsFilter.length) p.travelMotivations = motivationsFilter;
    if (tagsFilter.length)        p.selectedTags = tagsFilter;
    if (minIncomeReduction)       p.incomeReductionMin = minIncomeReduction;
    if (maxIncomeReduction)       p.incomeReductionMax = maxIncomeReduction;
    if (minTaxSavings)            p.taxSavingsMin = minTaxSavings;
    if (maxTaxSavings)            p.taxSavingsMax = maxTaxSavings;
    return p;
  };

  const saveFilterMutation = useMutation({
    mutationFn: (payload: Record<string, any>) => saveBuyBox(payload),
    onSuccess: (_data, variables) => {
      setHasSavedBuyBox(true);
      setSavedBuyBoxSnapshot(variables);
      // Keep the React Query cache in sync so that a future refresh detecting
      // deletion (null) can see a real transition instead of null → null (no change).
      qc.setQueryData(['buy-box'], variables);
      buyBoxApplied.current = true;
      setBuyBoxModal({ open: true, type: 'success', message: 'Buy Box saved successfully!' });
    },
    onError: () => {
      setBuyBoxModal({ open: true, type: 'error', message: 'Failed to save Buy Box. Please try again.' });
    },
  });

  const deleteFilterMutation = useMutation({
    mutationFn: deleteBuyBox,
    onSuccess: () => {
      setHasSavedBuyBox(false);
      setSavedBuyBoxSnapshot(null);
      clearFilters();
      qc.setQueryData(['buy-box'], null);
      buyBoxApplied.current = false;
      setBuyBoxModal({ open: true, type: 'success', message: 'Buy Box deleted successfully!' });
    },
    onError: () => {
      setBuyBoxModal({ open: true, type: 'error', message: 'Failed to delete Buy Box. Please try again.' });
    },
  });

  const forSaveFilters = () => {
    const payload = buildFiltersPayload();
    if (Object.keys(payload).length === 0) {
      Alert.alert('Save Buy Box', 'Please select at least one filter before saving Buy Box.');
      return;
    }
    saveFilterMutation.mutate(payload);
  };

  const isDirty = hasSavedBuyBox && savedBuyBoxSnapshot !== null &&
    JSON.stringify(buildFiltersPayload()) !== JSON.stringify(savedBuyBoxSnapshot);

  const hasAnyFilter =
    !!search ||
    sortBy !== 'newest' ||
    activeFilterCount > 0;

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Newest First';

  type ActiveChip = { key: string; label: string; onRemove: () => void };
  const activeChips: ActiveChip[] = [];
  for (const opt of STATUS_FILTER_OPTIONS) {
    if (opt.values.every((v) => statusFilter.includes(v))) {
      activeChips.push({
        key: `status:${opt.key}`,
        label: `Status: ${opt.label}`,
        onRemove: () => setStatusFilter((p) => p.filter((x) => !opt.values.includes(x))),
      });
    }
  }
  for (const v of stateFilter) {
    activeChips.push({ key: `state:${v}`, label: `States: ${v}`, onRemove: () => setStateFilter((p) => p.filter((x) => x !== v)) });
  }
  if (cityFilter.trim())
    activeChips.push({ key: 'city', label: `City: ${cityFilter.trim()}`, onRemove: () => setCityFilter('') });
  if (zipFilter.trim())
    activeChips.push({ key: 'zip', label: `ZIP: ${zipFilter.trim()}`, onRemove: () => setZipFilter('') });
  for (const v of categoryFilter) {
    const lbl = PROPERTY_TYPE_FILTER_OPTIONS.find((o) => o.value === v)?.label ?? v;
    activeChips.push({ key: `cat:${v}`, label: `Type: ${lbl}`, onRemove: () => setCategoryFilter((p) => p.filter((x) => x !== v)) });
  }
  if (partnershipAvail)    activeChips.push({ key: 'jv',          label: 'Partnership Available', onRemove: () => setPartnershipAvail(false) });
  if (partnershipApproved) activeChips.push({ key: 'jv-approved', label: 'Pre-Approved',          onRemove: () => setPartnershipApproved(false) });
  if (minPrice || maxPrice)
    activeChips.push({ key: 'price', label: `Price: ${[minPrice && `$${minPrice}`, maxPrice && `$${maxPrice}`].filter(Boolean).join('–')}`, onRemove: () => { setMinPrice(''); setMaxPrice(''); } });
  if (minDown || maxDown)
    activeChips.push({ key: 'down', label: `Down: ${[minDown && `$${minDown}`, maxDown && `$${maxDown}`].filter(Boolean).join('–')}`, onRemove: () => { setMinDown(''); setMaxDown(''); } });
  if (minRate || maxRate)
    activeChips.push({ key: 'rate', label: `Rate: ${[minRate && `${minRate}%`, maxRate && `${maxRate}%`].filter(Boolean).join('–')}`, onRemove: () => { setMinRate(''); setMaxRate(''); } });
  if (minBeds || maxBeds)
    activeChips.push({ key: 'beds', label: `Beds: ${[minBeds, maxBeds].filter(Boolean).join('–')}`, onRemove: () => { setMinBeds(''); setMaxBeds(''); } });
  if (minBaths || maxBaths)
    activeChips.push({ key: 'baths', label: `Baths: ${[minBaths, maxBaths].filter(Boolean).join('–')}`, onRemove: () => { setMinBaths(''); setMaxBaths(''); } });
  if (minSqft || maxSqft)
    activeChips.push({ key: 'sqft', label: `Sqft: ${[minSqft, maxSqft].filter(Boolean).join('–')}`, onRemove: () => { setMinSqft(''); setMaxSqft(''); } });
  if (minYearBuilt || maxYearBuilt)
    activeChips.push({ key: 'year', label: `Year: ${[minYearBuilt, maxYearBuilt].filter(Boolean).join('–')}`, onRemove: () => { setMinYearBuilt(''); setMaxYearBuilt(''); } });
  for (const v of financingFilter) {
    const lbl = FINANCING_OPTIONS.find((o) => o.value === v)?.label ?? v;
    activeChips.push({ key: `fin:${v}`, label: `Financing: ${lbl}`, onRemove: () => setFinancingFilter((p) => p.filter((x) => x !== v)) });
  }
  for (const v of turnkeyFilter) {
    const lbl = TURNKEY_OPTIONS.find((o) => o.value === v)?.label ?? v;
    activeChips.push({ key: `tk:${v}`, label: lbl, onRemove: () => setTurnkeyFilter((p) => p.filter((x) => x !== v)) });
  }
  if (minMonthlyPayment || maxMonthlyPayment)
    activeChips.push({ key: 'monthly', label: `Monthly: ${[minMonthlyPayment && `$${minMonthlyPayment}`, maxMonthlyPayment && `$${maxMonthlyPayment}`].filter(Boolean).join('–')}`, onRemove: () => { setMinMonthlyPayment(''); setMaxMonthlyPayment(''); } });
  if (minOccupancy || maxOccupancy)
    activeChips.push({ key: 'occ', label: `Occupancy: ${[minOccupancy && `${minOccupancy}%`, maxOccupancy && `${maxOccupancy}%`].filter(Boolean).join('–')}`, onRemove: () => { setMinOccupancy(''); setMaxOccupancy(''); } });
  for (const t of STR_TIERS) {
    if (anrRanges[t].min || anrRanges[t].max)
      activeChips.push({ key: `anr:${t}`, label: `ANR ${STR_TIER_LABELS[t]}: ${[anrRanges[t].min && `$${anrRanges[t].min}`, anrRanges[t].max && `$${anrRanges[t].max}`].filter(Boolean).join('–')}`, onRemove: () => setAnrRanges((p) => ({ ...p, [t]: { min: '', max: '' } })) });
    if (egrRanges[t].min || egrRanges[t].max)
      activeChips.push({ key: `egr:${t}`, label: `EGR ${STR_TIER_LABELS[t]}: ${[egrRanges[t].min && `$${egrRanges[t].min}`, egrRanges[t].max && `$${egrRanges[t].max}`].filter(Boolean).join('–')}`, onRemove: () => setEgrRanges((p) => ({ ...p, [t]: { min: '', max: '' } })) });
  }
  for (const v of marketsFilter) {
    const lbl = VACATION_RENTAL_MARKETS.find((o) => o.value === v)?.label ?? v;
    activeChips.push({ key: `mkt:${v}`, label: lbl, onRemove: () => setMarketsFilter((p) => p.filter((x) => x !== v)) });
  }
  for (const v of motivationsFilter) {
    const lbl = TRAVEL_MOTIVATIONS.find((o) => o.value === v)?.label ?? v;
    activeChips.push({ key: `mot:${v}`, label: lbl, onRemove: () => setMotivationsFilter((p) => p.filter((x) => x !== v)) });
  }
  for (const v of tagsFilter) {
    const lbl = TAG_OPTIONS.find((o) => o.value === v)?.label ?? v;
    activeChips.push({ key: `tag:${v}`, label: lbl, onRemove: () => setTagsFilter((p) => p.filter((x) => x !== v)) });
  }
  if (minIncomeReduction || maxIncomeReduction)
    activeChips.push({ key: 'income', label: `Income Red.: ${[minIncomeReduction && `${minIncomeReduction}%`, maxIncomeReduction && `${maxIncomeReduction}%`].filter(Boolean).join('–')}`, onRemove: () => { setMinIncomeReduction(''); setMaxIncomeReduction(''); } });
  if (minTaxSavings || maxTaxSavings)
    activeChips.push({ key: 'tax', label: `Tax Savings: ${[minTaxSavings && `$${minTaxSavings}`, maxTaxSavings && `$${maxTaxSavings}`].filter(Boolean).join('–')}`, onRemove: () => { setMinTaxSavings(''); setMaxTaxSavings(''); } });

  const ListHeader = (
    <View style={{ paddingTop: spacing.sm }}>
      <View style={styles.filterCard}>
        <View style={styles.filterTopRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={(v) => { setSearch(v); setVisibleCount(PAGE_SIZE); }}
            />
          </View>
          <Pressable style={styles.sortBtn} onPress={() => setShowSort(true)}>
            <Text style={styles.sortBtnText} numberOfLines={1}>{sortLabel}</Text>
            <Ionicons name="chevron-down" size={13} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => setShowFilters((s) => !s)}
            style={({ pressed }) => [
              styles.filterIconBtn,
              showFilters && styles.filterIconBtnActive,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={showFilters ? colors.textOnPrimary : colors.primary}
            />
            <Text
              style={[
                styles.filterIconBtnText,
                showFilters && { color: colors.textOnPrimary },
              ]}
            >
            </Text>
            {activeFilterCount > 0 ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {showFilters ? (
          <View style={styles.filterPanel}>
            <View style={styles.saveBuyBoxRow}>
              <Pressable
                onPress={forSaveFilters}
                style={({ pressed }) => [
                  styles.saveBuyBoxBtn,
                  hasSavedBuyBox && !isDirty && styles.saveBuyBoxBtnSaved,
                  isDirty && styles.saveBuyBoxBtnDirty,
                  pressed && { opacity: 0.8 },
                ]}
                disabled={saveFilterMutation.isPending}
              >
                {saveFilterMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons
                    name={hasSavedBuyBox ? 'bookmark' : 'bookmark-outline'}
                    size={20}
                    color={hasSavedBuyBox ? colors.primary : colors.text}
                  />
                )}
                <Text style={[styles.saveBuyBoxText, hasSavedBuyBox && { color: colors.primary }]}>
                  {saveFilterMutation.isPending ? 'Saving…' : isDirty ? 'Update Buy Box' : 'Save Buy Box'}
                </Text>
                {isDirty && <View style={styles.saveBuyBoxDirtyDot} />}
              </Pressable>

              {hasSavedBuyBox && (
                <Pressable
                  onPress={() => setDeleteConfirmModal(true)}
                  style={styles.deleteBuyBoxBtn}
                  disabled={deleteFilterMutation.isPending}
                >
                  {deleteFilterMutation.isPending ? (
                    <ActivityIndicator size="small" color={colors.danger} />
                  ) : (
                    <Ionicons name="trash-outline" size={15} color={colors.danger} />
                  )}
                  <Text style={styles.deleteBuyBoxText}>Delete</Text>
                </Pressable>
              )}
            </View>

            <FilterSection
              icon="🤝"
              title="50-50 Partnership Pro Forma"
              open={openSection === 'partnership'}
              onToggle={() => toggleSection('partnership')}
            >
              <CheckRow
                label="50-50 Partnership Available"
                checked={partnershipAvail}
                onToggle={() => setPartnershipAvail((v) => !v)}
              />
              <CheckRow
                label="50-50 Partnership Pre-Approved"
                checked={partnershipApproved}
                onToggle={() => setPartnershipApproved((v) => !v)}
              />
            </FilterSection>

            <FilterSection
              icon="🏷️"
              title="Property Status"
              open={openSection === 'status'}
              onToggle={() => toggleSection('status')}
            >
              {STATUS_FILTER_OPTIONS.map((opt) => {
                const checked = opt.values.every((v) => statusFilter.includes(v));
                return (
                  <CheckRow
                    key={opt.key}
                    label={opt.label}
                    checked={checked}
                    onToggle={() =>
                      setStatusFilter((prev) =>
                        checked
                          ? prev.filter((s) => !opt.values.includes(s))
                          : Array.from(new Set([...prev, ...opt.values])),
                      )
                    }
                  />
                );
              })}
            </FilterSection>

            <FilterSection
              icon="📍"
              title="Location"
              open={openSection === 'location'}
              onToggle={() => toggleSection('location')}
            >
              <Text style={styles.fieldLabel}>State</Text>
              <MultiSelectChips
                options={US_STATE_OPTIONS}
                value={stateFilter}
                onChange={setStateFilter}
              />

              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>City</Text>
              <View style={styles.rangeRow}>
                <TextInput
                  value={cityFilter}
                  onChangeText={setCityFilter}
                  placeholder="e.g. El Paso"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  style={styles.rangeInput}
                />
              </View>

              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>ZIP / Postal code</Text>
              <View style={styles.rangeRow}>
                <TextInput
                  value={zipFilter}
                  onChangeText={setZipFilter}
                  placeholder="e.g. 79928"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={styles.rangeInput}
                />
              </View>
            </FilterSection>

            <FilterSection
              icon="💰"
              title="Financial"
              open={openSection === 'financial'}
              onToggle={() => toggleSection('financial')}
            >
              <Text style={styles.fieldLabel}>Price range (USD)</Text>
              <View style={styles.rangeRow}>
                <TextInput
                  value={minPrice}
                  onChangeText={setMinPrice}
                  placeholder="Min"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={styles.rangeInput}
                />
                <Text style={styles.rangeDash}>—</Text>
                <TextInput
                  value={maxPrice}
                  onChangeText={setMaxPrice}
                  placeholder="Max"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={styles.rangeInput}
                />
              </View>

              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
                Down payment range (USD)
              </Text>
              <View style={styles.rangeRow}>
                <TextInput
                  value={minDown}
                  onChangeText={setMinDown}
                  placeholder="Min"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={styles.rangeInput}
                />
                <Text style={styles.rangeDash}>—</Text>
                <TextInput
                  value={maxDown}
                  onChangeText={setMaxDown}
                  placeholder="Max"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={styles.rangeInput}
                />
              </View>

              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
                Interest rate range (%)
              </Text>
              <View style={styles.rangeRow}>
                <TextInput
                  value={minRate}
                  onChangeText={setMinRate}
                  placeholder="Min"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={styles.rangeInput}
                />
                <Text style={styles.rangeDash}>—</Text>
                <TextInput
                  value={maxRate}
                  onChangeText={setMaxRate}
                  placeholder="Max"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={styles.rangeInput}
                />
              </View>

              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
                Monthly Payment / PITI (USD)
              </Text>
              <View style={styles.rangeRow}>
                <TextInput
                  value={minMonthlyPayment}
                  onChangeText={setMinMonthlyPayment}
                  placeholder="Min"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={styles.rangeInput}
                />
                <Text style={styles.rangeDash}>—</Text>
                <TextInput
                  value={maxMonthlyPayment}
                  onChangeText={setMaxMonthlyPayment}
                  placeholder="Max"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={styles.rangeInput}
                />
              </View>
            </FilterSection>

            <FilterSection
              icon="🏠"
              title="Property Details"
              open={openSection === 'details'}
              onToggle={() => toggleSection('details')}
            >
              <Text style={styles.fieldLabel}>Property type</Text>
              <MultiSelectChips
                options={PROPERTY_TYPE_FILTER_OPTIONS}
                value={categoryFilter}
                onChange={(next) => {
                  const added = next.find((v) => !categoryFilter.includes(v));
                  setCategoryFilter(added ? [added] : []);
                }}
              />

              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
                Bedrooms
              </Text>
              <View style={styles.rangeRow}>
                <TextInput
                  value={minBeds}
                  onChangeText={setMinBeds}
                  placeholder="Min"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={styles.rangeInput}
                />
                <Text style={styles.rangeDash}>—</Text>
                <TextInput
                  value={maxBeds}
                  onChangeText={setMaxBeds}
                  placeholder="Max"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={styles.rangeInput}
                />
              </View>

              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
                Bathrooms
              </Text>
              <View style={styles.rangeRow}>
                <TextInput
                  value={minBaths}
                  onChangeText={setMinBaths}
                  placeholder="Min"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={styles.rangeInput}
                />
                <Text style={styles.rangeDash}>—</Text>
                <TextInput
                  value={maxBaths}
                  onChangeText={setMaxBaths}
                  placeholder="Max"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={styles.rangeInput}
                />
              </View>

              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
                Square footage
              </Text>
              <View style={styles.rangeRow}>
                <TextInput
                  value={minSqft}
                  onChangeText={setMinSqft}
                  placeholder="Min"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={styles.rangeInput}
                />
                <Text style={styles.rangeDash}>—</Text>
                <TextInput
                  value={maxSqft}
                  onChangeText={setMaxSqft}
                  placeholder="Max"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={styles.rangeInput}
                />
              </View>

              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
                Year built
              </Text>
              <View style={styles.rangeRow}>
                <TextInput
                  value={minYearBuilt}
                  onChangeText={setMinYearBuilt}
                  placeholder="Min"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={styles.rangeInput}
                />
                <Text style={styles.rangeDash}>—</Text>
                <TextInput
                  value={maxYearBuilt}
                  onChangeText={setMaxYearBuilt}
                  placeholder="Max"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={styles.rangeInput}
                />
              </View>
            </FilterSection>

            <FilterSection
              icon="🏦"
              title="Financing & STR"
              open={openSection === 'financing'}
              onToggle={() => toggleSection('financing')}
            >
              <Text style={styles.fieldLabel}>Financing type</Text>
              {FINANCING_OPTIONS.map((opt) => (
                <CheckRow
                  key={opt.value}
                  label={opt.label}
                  checked={financingFilter.includes(opt.value)}
                  onToggle={() =>
                    setFinancingFilter((prev) => toggleIn(prev, opt.value))
                  }
                />
              ))}

              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
                Turnkey status
              </Text>
              {TURNKEY_OPTIONS.map((opt) => (
                <CheckRow
                  key={opt.value}
                  label={opt.label}
                  checked={turnkeyFilter.includes(opt.value)}
                  onToggle={() =>
                    setTurnkeyFilter((prev) => toggleIn(prev, opt.value))
                  }
                />
              ))}

              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
                Est. Occupancy (%)
              </Text>
              <View style={styles.rangeRow}>
                <TextInput
                  value={minOccupancy}
                  onChangeText={setMinOccupancy}
                  placeholder="Min"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={styles.rangeInput}
                />
                <Text style={styles.rangeDash}>—</Text>
                <TextInput
                  value={maxOccupancy}
                  onChangeText={setMaxOccupancy}
                  placeholder="Max"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={styles.rangeInput}
                />
              </View>
            </FilterSection>

            <FilterSection
              icon="🌙"
              title="Average Nightly Rate"
              open={openSection === 'anr'}
              onToggle={() => toggleSection('anr')}
            >
              {STR_TIERS.map((tier, i) => (
                <View key={`anr-${tier}`}>
                  <Text
                    style={[
                      styles.fieldLabel,
                      i > 0 && { marginTop: spacing.md },
                    ]}
                  >
                    {STR_TIER_LABELS[tier]} (USD)
                  </Text>
                  <View style={styles.rangeRow}>
                    <TextInput
                      value={anrRanges[tier].min}
                      onChangeText={(v) => setAnrRange(tier, 'min', v)}
                      placeholder="Min"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      style={styles.rangeInput}
                    />
                    <Text style={styles.rangeDash}>—</Text>
                    <TextInput
                      value={anrRanges[tier].max}
                      onChangeText={(v) => setAnrRange(tier, 'max', v)}
                      placeholder="Max"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      style={styles.rangeInput}
                    />
                  </View>
                </View>
              ))}
            </FilterSection>

            <FilterSection
              icon="💵"
              title="Estimated Gross Revenue"
              open={openSection === 'egr'}
              onToggle={() => toggleSection('egr')}
            >
              {STR_TIERS.map((tier, i) => (
                <View key={`egr-${tier}`}>
                  <Text
                    style={[
                      styles.fieldLabel,
                      i > 0 && { marginTop: spacing.md },
                    ]}
                  >
                    {STR_TIER_LABELS[tier]} (USD)
                  </Text>
                  <View style={styles.rangeRow}>
                    <TextInput
                      value={egrRanges[tier].min}
                      onChangeText={(v) => setEgrRange(tier, 'min', v)}
                      placeholder="Min"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      style={styles.rangeInput}
                    />
                    <Text style={styles.rangeDash}>—</Text>
                    <TextInput
                      value={egrRanges[tier].max}
                      onChangeText={(v) => setEgrRange(tier, 'max', v)}
                      placeholder="Max"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      style={styles.rangeInput}
                    />
                  </View>
                </View>
              ))}
            </FilterSection>

            <FilterSection
              icon="🏖️"
              title="Vacation Rental Markets"
              open={openSection === 'markets'}
              onToggle={() => toggleSection('markets')}
            >
              <MultiSelectChips
                options={VACATION_RENTAL_MARKETS}
                value={marketsFilter}
                onChange={setMarketsFilter}
              />
            </FilterSection>

            <FilterSection
              icon="✈️"
              title="Travel Motivations"
              open={openSection === 'motivations'}
              onToggle={() => toggleSection('motivations')}
            >
              <MultiSelectChips
                options={TRAVEL_MOTIVATIONS}
                value={motivationsFilter}
                onChange={setMotivationsFilter}
              />
            </FilterSection>

            <FilterSection
              icon="🏷️"
              title="Tags"
              open={openSection === 'tags'}
              onToggle={() => toggleSection('tags')}
            >
              <MultiSelectChips
                options={TAG_OPTIONS}
                value={tagsFilter}
                onChange={setTagsFilter}
              />
            </FilterSection>

            <FilterSection
              icon="📄"
              title="Tax Benefits"
              open={openSection === 'tax'}
              onToggle={() => toggleSection('tax')}
            >
              <Text style={styles.fieldLabel}>Income reduction (USD)</Text>
              <View style={styles.rangeRow}>
                <TextInput
                  value={minIncomeReduction}
                  onChangeText={setMinIncomeReduction}
                  placeholder="Min"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={styles.rangeInput}
                />
                <Text style={styles.rangeDash}>—</Text>
                <TextInput
                  value={maxIncomeReduction}
                  onChangeText={setMaxIncomeReduction}
                  placeholder="Max"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={styles.rangeInput}
                />
              </View>

              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>
                Est. tax savings (USD)
              </Text>
              <View style={styles.rangeRow}>
                <TextInput
                  value={minTaxSavings}
                  onChangeText={setMinTaxSavings}
                  placeholder="Min"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={styles.rangeInput}
                />
                <Text style={styles.rangeDash}>—</Text>
                <TextInput
                  value={maxTaxSavings}
                  onChangeText={setMaxTaxSavings}
                  placeholder="Max"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  style={styles.rangeInput}
                />
              </View>
            </FilterSection>

            {activeChips.length > 0 && (
              <View style={styles.activeFiltersRow}>
                <Text style={styles.activeFiltersLabel}>Active:</Text>
                <View style={styles.activeChipsWrap}>
                  {activeChips.map((chip) => (
                    <Pressable key={chip.key} onPress={chip.onRemove} style={styles.activeChip}>
                      <Text style={styles.activeChipText}>{chip.label}</Text>
                      <Text style={styles.activeChipX}> ×</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.filterPanelActions}>
              <Button title="Clear all" variant="secondary" onPress={clearFilters} />
              <Button
                title={`Show ${filtered.length} result${filtered.length === 1 ? '' : 's'}`}
                onPress={() => {
                  setVisibleCount(PAGE_SIZE);
                  setShowFilters(false);
                }}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.filterBottomRow}>
          <Text style={styles.countText}>
            Showing {visible.length} of {filtered.length} properties
          </Text>
          {hasAnyFilter && (
            <Pressable onPress={clearFilters} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>Clear Filters</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Browse Properties"
        subtitle="Explore investment opportunities"
        iconName="home"
        onProfilePress={() => router.push('/(tabs)/profile')}
        {...headerBell}
      />

      {isLoading ? (
        <PropertyListSkeleton />
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: colors.danger, marginBottom: spacing.md }}>Failed to load properties</Text>
          <Button title="Retry" variant="secondary" onPress={() => refetch()} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={ListHeader}
          extraData={`${showFilters ? 1 : 0}|${activeFilterCount}|${openSection ?? ''}|${hasSavedBuyBox ? 1 : 0}`}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => { setVisibleCount(PAGE_SIZE); refetch(); buyBoxApplied.current = false; refetchBuyBox(); }}
              tintColor={colors.primary}
            />
          }
          onEndReached={() => { if (hasMore) setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length)); }}
          onEndReachedThreshold={0.4}
          /**
           * Scroll tuning — most relevant on emulators / web where a mouse wheel
           * translates to large scroll deltas (a touchscreen never has this
           * problem). decelerationRate="normal" lengthens the fling tail so a
           * single wheel tick doesn't shoot past the next card; the throttle
           * + windowing props keep the FlatList from rendering more rows than
           * are visible, which is the other thing that makes mouse-wheel
           * scrolling feel jittery.
           */
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
                <Text style={styles.footerText}>Loading more… ({visibleCount} of {filtered.length})</Text>
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
                  <Text style={styles.emptyTitle}>No Results Found</Text>
                  <Text style={styles.emptyBody}>
                    No properties match your filters. Try adjusting your search.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.emptyTitle}>No properties available</Text>
                  <Text style={styles.emptyBody}>Check back later for new listings.</Text>
                </>
              )}
            </View>
          }
          renderItem={({ item: p }) => (
            <PropertyCard
              p={p}
              onView={() => router.push({ pathname: '/properties/[id]', params: { id: p.id } })}
              isFavorited={favoriteIds.includes(p.id)}
              onToggleFavorite={() => handleToggleFavorite(p.id)}
              favoriteLoading={pendingFavId === p.id}
            />
          )}
        />
      )}

      <Modal visible={showSort} transparent animationType="fade" onRequestClose={() => setShowSort(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowSort(false)}>
          <Pressable style={styles.sortSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sortSheetTitle}>Sort by</Text>
            {SORT_OPTIONS.map((o) => (
              <Pressable
                key={o.value}
                style={({ pressed }) => [styles.sortOption, sortBy === o.value && styles.sortOptionActive, pressed && { opacity: 0.7 }]}
                onPress={() => { setSortBy(o.value); setShowSort(false); setVisibleCount(PAGE_SIZE); }}
              >
                <Text style={[styles.sortOptionText, sortBy === o.value && styles.sortOptionTextActive]}>{o.label}</Text>
                {sortBy === o.value && <Ionicons name="checkmark" size={16} color={colors.primary} />}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <SuccessModal
        visible={buyBoxModal.open && buyBoxModal.type === 'success'}
        title="Buy Box"
        message={buyBoxModal.message}
        ctaLabel="OK"
        onDismiss={() => setBuyBoxModal({ open: false, type: 'success', message: '' })}
      />
      <ErrorModal
        visible={buyBoxModal.open && buyBoxModal.type === 'error'}
        title="Buy Box"
        message={buyBoxModal.message}
        ctaLabel="OK"
        onDismiss={() => setBuyBoxModal({ open: false, type: 'error', message: '' })}
      />
      <ConfirmModal
        visible={deleteConfirmModal}
        title="Delete Buy Box"
        message="Are you sure you want to delete your saved Buy Box? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        loading={deleteFilterMutation.isPending}
        onConfirm={() => { setDeleteConfirmModal(false); deleteFilterMutation.mutate(); }}
        onCancel={() => setDeleteConfirmModal(false)}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgAlt },
  list:   { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl * 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },


  filterCard:      { backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadows.card },
  filterTopRow:    { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  searchBox:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.bgAlt, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, borderWidth: 1, borderColor: colors.border },
  searchInput:     { flex: 1, ...typography.body, color: colors.text },
  sortBtn:         { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.bgAlt, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, borderWidth: 1, borderColor: colors.border, minWidth: 110 },

  filterIconBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 44, borderWidth: 1.5, borderColor: colors.primary },
  filterIconBtnActive: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
  filterIconBtnText:   { ...typography.bodyStrong, color: colors.primary, fontSize: 13 },
  filterBadge:         { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  filterBadgeText:     { color: colors.textOnPrimary, fontSize: 10, fontWeight: '700' },

  // Filter panel (sits inside the filterCard between filterTopRow and filterBottomRow)
  filterPanel:         { gap: spacing.md, marginTop: spacing.sm, marginBottom: spacing.sm },
  filterSection:       { backgroundColor: colors.bgAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  filterSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  filterSectionIcon:   { fontSize: 18 },
  filterSectionTitle:  { ...typography.bodyStrong, color: colors.text, flex: 1, letterSpacing: 0.3 },
  filterSectionBody:   { paddingHorizontal: spacing.md, paddingBottom: spacing.md, paddingTop: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.bg },

  checkRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.sm },
  checkBox:    { width: 20, height: 20, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  checkBoxOn:  { backgroundColor: colors.primary, borderColor: colors.primary },
  checkLabel:  { ...typography.body, color: colors.text, flex: 1 },

  fieldLabel:  { ...typography.captionStrong, color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xs, letterSpacing: 0.2 },
  rangeRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rangeInput:  { flex: 1, alignSelf: 'stretch', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, backgroundColor: colors.bg, color: colors.text, fontSize: 15 },
  rangeDash:   { color: colors.textMuted, fontWeight: '600' },

  filterPanelActions:  { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  activeFiltersRow:    { marginTop: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  activeFiltersLabel:  { ...typography.captionStrong, color: colors.textMuted, paddingTop: 6 },
  activeChipsWrap:     { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  activeChip:          { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5, borderWidth: 1, borderColor: colors.primary },
  activeChipText:      { ...typography.caption, color: colors.primary, fontWeight: '600' },
  activeChipX:         { ...typography.caption, color: colors.primary, fontWeight: '700' },

  saveBuyBoxRow:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  saveBuyBoxBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.bgAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  saveBuyBoxBtnSaved:  { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  saveBuyBoxBtnDirty:  { backgroundColor: colors.warningSoft, borderColor: colors.warning },
  saveBuyBoxText:      { ...typography.bodyStrong, color: colors.text, flex: 1 },
  saveBuyBoxDirtyDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warning },
  deleteBuyBoxBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  deleteBuyBoxText:    { ...typography.captionStrong, color: colors.danger },

  sortBtnText:     { ...typography.body, color: colors.text, flex: 1 },
  filterBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countText:       { ...typography.caption, color: colors.textMuted },
  clearBtn:        { borderWidth: 1, borderColor: colors.primaryAccent, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  clearBtnText:    { ...typography.captionStrong, color: colors.primaryAccent },

  modalBackdrop:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing.xl },
  sortSheet:            { backgroundColor: colors.bg, borderRadius: radius.lg, paddingVertical: spacing.sm, ...shadows.cardStrong },
  sortSheetTitle:       { ...typography.captionStrong, color: colors.textMuted, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, letterSpacing: 0.5, textTransform: 'uppercase' },
  sortOption:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  sortOptionActive:     { backgroundColor: colors.primarySoft },
  sortOptionText:       { ...typography.body, color: colors.text },
  sortOptionTextActive: { color: colors.primary, fontWeight: '600' },

  footerLoader: { paddingVertical: spacing.lg, alignItems: 'center', gap: spacing.xs },
  footerText:   { ...typography.caption, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },
  emptyState:   { alignItems: 'center', paddingVertical: spacing.xxxl },
  emptyIcon:    { fontSize: 56, marginBottom: spacing.md },
  emptyTitle:   { ...typography.h2, color: colors.text },
  emptyBody:    { ...typography.body, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center', paddingHorizontal: spacing.xl },
});
