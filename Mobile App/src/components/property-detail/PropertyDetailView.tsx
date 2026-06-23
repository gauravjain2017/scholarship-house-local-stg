import React, { useMemo, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, type BadgeTone } from '@/components/Badge';
import { BottomNav, BOTTOM_NAV_HEIGHT } from '@/components/BottomNav';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ImageCarousel } from '@/components/ImageCarousel';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SuccessModal } from '@/components/SuccessModal';
import {
  addFavorite,
  claimProperty,
  deleteMyDeal,
  getFavorites,
  removeFavorite,
} from '@/api/deals';
import { extractApiError } from '@/api/client';
import { env } from '@/config/env';
import { useAuth } from '@/context/AuthContext';
import { radius, shadows, spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';
import type { Property } from '@/types';
import { formatPublishedDate } from '@/utils/date';
import {
  DEFAULT_TEN_YEAR_GROWTH,
  PROPERTY_TYPE_LABELS,
  VACATION_RENTAL_MARKET_LABELS,
  computeProForma,
  computeTenYearProjection,
  fmt$,
  fmtPct,
  formatCompact,
  formatPrice,
  getDealImages,
  getDealVideos,
  getUnderwritingImages,
  getUserTypeLabel,
  hasAnyObjectValue,
  hasAnyValue,
  hasValue,
  humanizeEnum,
  isTurnkeyDeal,
  LLC_INCLUDED_ITEMS,
  MONTHS,
  type TenYearGrowth,
  type TenYearOverride,
} from '@/utils/dealFinancials';

type Mode = 'client' | 'submitter';

interface Props {
  data: Property;
  mode: Mode;
  onBack: () => void;
}

// ── Local helpers ─────────────────────────────────────────────────────────────
const shortFinancingLabel = (type: string) => {
  const map: Record<string, string> = {
    traditional: 'Conventional',
    'subject-to': 'Subject-to',
    hybrid: 'Hybrid',
    seller: 'Seller Finance',
    cash: 'Cash Only',
  };
  return map[type] || (type ? type.charAt(0).toUpperCase() + type.slice(1) : '—');
};
function toChipList(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((s): s is string => typeof s === 'string').map((s) => s.trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}
function statusTone(status?: string): BadgeTone {
  switch (status) {
    case 'published': return 'rent';
    case 'sold': return 'sold';
    case 'rejected': return 'sold';
    case 'expired': return 'neutral';
    default: return 'info';
  }
}
// Statuses where the backend rejects edits & deletes for submitters.
const LOCKED_STATUSES = new Set(['approved', 'published', 'sold']);
const isLocked = (s?: string) => LOCKED_STATUSES.has(String(s || '').toLowerCase());

// Public web app origin (configured per-env in app.config.ts → extra.webUrl),
// used to build the shareable property link that Copy Link puts on the clipboard.
const WEB_ORIGIN = (env.webUrl || env.apiUrl).replace(/\/+$/, '');

// ── Presentational atoms ────────────────────────────────────────────────────
function SectionHeading({ icon, title }: { icon: string; title: string }) {
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.sectionHeadRow}>
      <Text style={s.sectionHeadIcon}>{icon}</Text>
      <Text style={s.sectionHeadText}>{title}</Text>
    </View>
  );
}

function StatItem({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  const s = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={s.statItem}>
      <Text style={s.statItemLabel}>{label}</Text>
      <Text style={[s.statItemValue, accent && { color: colors.primary }]}>{value ?? '—'}</Text>
    </View>
  );
}

function DetailRow({ label, value, emphasized }: { label: string; value: React.ReactNode; emphasized?: boolean }) {
  const s = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={[s.detailRow, emphasized && s.detailRowEmphasized]}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={[s.detailValue, emphasized && { color: colors.primary }]}>{value ?? '—'}</Text>
    </View>
  );
}

/** Simple vertical table: header row + body rows. `align` right-justifies cells. */
function SimpleTable({
  columns,
  rows,
}: {
  columns: { key: string; label: string; align?: 'left' | 'right'; flex?: number }[];
  rows: Record<string, React.ReactNode>[];
}) {
  const s = useThemedStyles(makeStyles);
  return (
    <View style={s.table}>
      <View style={[s.tableRow, s.tableHeader]}>
        {columns.map((c) => (
          <Text
            key={c.key}
            style={[s.tableCell, s.tableHeaderText, { flex: c.flex ?? 1, textAlign: c.align === 'right' ? 'right' : 'left' }]}
          >
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={s.tableRow}>
          {columns.map((c) => (
            <Text
              key={c.key}
              style={[s.tableCell, { flex: c.flex ?? 1, textAlign: c.align === 'right' ? 'right' : 'left' }]}
            >
              {r[c.key]}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * Numeric input with a tri-state raw model that mirrors the web:
 *   - raw === null  → field is untouched; show the deal's default value
 *   - raw === ''    → user cleared it; show BLANK (placeholder), compute as 0
 *   - raw === '12'  → user-entered value
 * The parent owns the raw string so it can apply the exact web compute rules.
 */
function EditableNumber({
  raw,
  defaultValue,
  onChange,
  max,
  prefix,
  suffix,
  width = 90,
  placeholder = '0',
}: {
  raw: string | null;
  defaultValue: number;
  onChange: (v: string | null) => void;
  max?: number;
  prefix?: string;
  suffix?: string;
  width?: number;
  placeholder?: string;
}) {
  const s = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const display = raw === null ? String(Math.round(defaultValue) || 0) : raw;
  return (
    <View style={s.editableWrap}>
      {prefix ? <Text style={s.editableAffix}>{prefix}</Text> : null}
      <TextInput
        value={display}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        onChangeText={(t) => {
          const cleaned = t.replace(/[^0-9]/g, '');
          if (cleaned === '') return onChange('');
          let n = parseInt(cleaned, 10);
          if (Number.isNaN(n)) return onChange('');
          if (typeof max === 'number') n = Math.min(max, n);
          onChange(String(n));
        }}
        keyboardType="number-pad"
        style={[s.editableInput, { width }]}
        selectTextOnFocus
      />
      {suffix ? <Text style={s.editableAffix}>{suffix}</Text> : null}
    </View>
  );
}

// ── "What's Included" modal (JV) ──────────────────────────────────────────────
function WhatsIncludedModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = useThemedStyles(makeStyles);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalBackdrop}>
        {/* Tap-outside-to-close lives on a sibling layer BEHIND the card so it
            never intercepts the inner ScrollView's pan gesture (which had
            stopped scroll from working on device). */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalEyebrow}>LLC JOINT VENTURE BUY-IN</Text>
            <Text style={s.modalTitle}>What's Included</Text>
          </View>
          <ScrollView
            style={{ maxHeight: 420 }}
            contentContainerStyle={{ padding: spacing.lg }}
            showsVerticalScrollIndicator
            persistentScrollbar
            nestedScrollEnabled
          >
            <Text style={s.modalLead}>
              The LLC Joint Venture Buy-In covers every aspect of getting your property
              acquisition-ready and revenue-generating from day one.
            </Text>
            {LLC_INCLUDED_ITEMS.map((sec) => (
              <View key={sec.category} style={{ marginTop: spacing.md }}>
                <Text style={s.modalCategory}>{sec.icon}  {sec.category}</Text>
                {sec.items.map((item) => (
                  <View key={item} style={s.modalBullet}>
                    <View style={s.modalDot} />
                    <Text style={s.modalItem}>{item}</Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
          <Pressable style={s.modalClose} onPress={onClose}>
            <Text style={s.modalCloseText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function PropertyDetailView({ data, mode, onBack }: Props) {
  const s = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const a = data as any;

  const [imgIndex, setImgIndex] = useState(0);

  // Calculator state (interactive — mirrors web). Raw strings so a cleared
  // field shows blank: null = untouched (use default), '' = cleared.
  const [editableOccupancy, setEditableOccupancy] = useState<string | null>(null);
  const [editableANR, setEditableANR] = useState<string | null>(null);
  const [taxSectionRate, setTaxSectionRate] = useState<string | null>(null);
  const [jvSectionRate, setJvSectionRate] = useState<string | null>(null);
  const [tenYearGrowth, setTenYearGrowth] = useState<TenYearGrowth>(DEFAULT_TEN_YEAR_GROWTH);
  const [tenYearOverrides, setTenYearOverrides] = useState<Record<number, TenYearOverride>>({});
  const [showIncluded, setShowIncluded] = useState(false);
  const [showMap, setShowMap] = useState(false);

  // Submitter actions
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeSuccess, setRemoveSuccess] = useState(false);
  const [lockedAction, setLockedAction] = useState<'edit' | 'delete' | null>(null);

  // Client claim
  const [confirmingClaim, setConfirmingClaim] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // ── Favorites (client) ──────────────────────────────────────────────────
  const { data: favorites = [], isFetched: favFetched } = useQuery({
    queryKey: ['favorites'],
    queryFn: getFavorites,
    enabled: mode === 'client' && isAuthenticated,
  });
  const [favPending, setFavPending] = useState(false);
  // Optimistic cache updates on the shared ['favorites'] key — identical pattern
  // to client-favorites.tsx / client-browse.tsx, so the star here, the Favorites
  // tab, and the browse list all stay in sync and the change persists.
  const isFavorited = favorites.includes(data.id);
  const favReady = favFetched;

  const addFavMut = useMutation({
    mutationFn: addFavorite,
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ['favorites'] });
      const prev = qc.getQueryData<string[]>(['favorites']) ?? [];
      if (!prev.includes(id)) qc.setQueryData<string[]>(['favorites'], [...prev, id]);
      return { prev };
    },
    onError: (_e, _id, ctx) => { if (ctx?.prev !== undefined) qc.setQueryData(['favorites'], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });
  const removeFavMut = useMutation({
    mutationFn: removeFavorite,
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ['favorites'] });
      const prev = qc.getQueryData<string[]>(['favorites']) ?? [];
      qc.setQueryData<string[]>(['favorites'], prev.filter((x) => x !== id));
      return { prev };
    },
    onError: (_e, _id, ctx) => { if (ctx?.prev !== undefined) qc.setQueryData(['favorites'], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });
  const toggleFavorite = () => {
    if (!data.id || favPending) return;
    setFavPending(true);
    const finish = () => setFavPending(false);
    if (isFavorited) removeFavMut.mutate(data.id, { onSettled: finish });
    else addFavMut.mutate(data.id, { onSettled: finish });
  };

  const claimMut = useMutation({
    mutationFn: () => claimProperty(data.id),
    onSuccess: () => {
      setConfirmingClaim(false);
      setClaimError(null);
      setClaimSuccess(true);
      qc.invalidateQueries({ queryKey: ['deal', data.id] });
      qc.invalidateQueries({ queryKey: ['published-deals'] });
    },
    onError: (e) => {
      setConfirmingClaim(false);
      setClaimError(extractApiError(e));
    },
  });

  const removeMut = useMutation({
    mutationFn: () => deleteMyDeal(data.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-submissions'] });
      setConfirmingDelete(false);
      setRemoveSuccess(true);
    },
    onError: (e) => {
      setConfirmingDelete(false);
      setRemoveError(extractApiError(e));
    },
  });

  const handleCopyLink = async () => {
    if (!data.id) return;
    await Clipboard.setStringAsync(`${WEB_ORIGIN}/property/${data.id}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const openMap = () => {
    const addr = [a.streetAddress, a.city, a.stateRegion, a.postalCode].filter(Boolean).join(', ');
    if (!addr) return;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`);
  };

  // ── Derived display data (mirrors web) ────────────────────────────────────
  const allImages = useMemo(() => getDealImages(a), [a]);
  const dealVideos = useMemo(() => getDealVideos(a), [a]);
  const uwImages = useMemo(() => getUnderwritingImages(a), [a]);
  const pf = useMemo(() => computeProForma(a, a.taxRateSettings?.[0]), [a]);

  const locked = isLocked(data.status);

  const titleLine =
    [a.yearBuilt, data.bedrooms ? `${data.bedrooms} Bed` : null, data.bathrooms ? `${data.bathrooms} Bath` : null]
      .filter(Boolean)
      .join(' | ') || data.title || 'Untitled property';

  const submittedName = a.submittedBy?.name || a.submitter?.name || (typeof a.submittedBy === 'string' ? a.submittedBy : '') || 'Unknown';
  const submittedPhone = a.submittedBy?.phone || a.submitter?.phone || '';
  const submittedRole = a.submittedBy?.userType
    ? `(${getUserTypeLabel(a.submittedBy.userType)})`
    : a.submitter?.userType
      ? `(${getUserTypeLabel(a.submitter.userType)})`
      : '';

  const cityState = [a.city || data.address?.city, a.stateRegion || data.address?.state].filter(Boolean).join(', ');
  const fullAddress = [a.streetAddress || data.address?.street, a.city || data.address?.city, a.stateRegion || data.address?.state, a.postalCode || data.address?.zip]
    .filter(Boolean)
    .join(', ');

  // Standard Google Maps look via the classic ?output=embed page, rendered
  // inside an <iframe> (Google only serves the embed in an iframe). Prefers
  // stored coordinates, else the full address — both drop the Google marker.
  const mapQuery = fullAddress || cityState;
  const rawLat = (data.address?.lat ?? a.latitude ?? a.lat) as any;
  const rawLng = (data.address?.lng ?? a.longitude ?? a.lng) as any;
  const latNum = rawLat != null && rawLat !== '' && Number.isFinite(Number(rawLat)) ? Number(rawLat) : null;
  const lngNum = rawLng != null && rawLng !== '' && Number.isFinite(Number(rawLng)) ? Number(rawLng) : null;
  const mapPlace = latNum != null && lngNum != null ? `${latNum},${lngNum}` : mapQuery;
  const mapEmbedUrl = mapPlace
    ? `https://maps.google.com/maps?q=${encodeURIComponent(mapPlace)}&z=15&hl=en&output=embed`
    : '';
  const mapHtml = mapEmbedUrl
    ? `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{height:100%;width:100%;overflow:hidden;background:#e9eef2}iframe{border:0;display:block;width:100%;height:100%}</style></head><body><iframe src="${mapEmbedUrl}" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></body></html>`
    : '';

  const streetNum = (a.streetAddress || '').trim().split(' ')[0].replace(/\D/g, '');
  const postal = (a.postalCode || '').trim();
  const propId = streetNum && postal ? `${streetNum}-${postal}` : streetNum || postal || data.id?.slice(-8).toUpperCase() || '—';

  // Tags
  const irRaw = parseFloat(a.subjInterestRate ?? a.sellerInterestRate);
  const downPct = pf.dealSalePrice > 0 ? (pf.dealDownPayment / pf.dealSalePrice) * 100 : null;
  const normFinancing = (a.financingType || '').toUpperCase().replace(/[\s_-]+/g, '');
  const isCreative = normFinancing === 'SELLER' || normFinancing === 'SUBJECTTO' || normFinancing === 'HYBRID';
  const activeTags = [
    { key: 'jv', show: a.fiftyFiftyPartner === true, label: '50/50 Joint Venture', c: { bg: '#F3F0FF', border: '#7C3AED', text: '#7C3AED' } },
    { key: 'preapproved', show: a.fiftyFiftyPreApproved === true, label: '50-50 Pre Approved', c: { bg: '#E8F0FF', border: '#3B82F6', text: '#3B82F6' } },
    { key: 'turnkey', show: isTurnkeyDeal(a), label: 'Turnkey Fully Furnished', c: { bg: '#ECFDF5', border: '#1F9D55', text: '#1F9D55' } },
    { key: 'creative', show: isCreative, label: 'Creative Financing', c: { bg: '#FFFBEB', border: '#D9A40C', text: '#D9A40C' } },
    { key: 'lowrate', show: !isNaN(irRaw) && irRaw > 0 && irRaw < 5, label: 'Low Interest Rate', c: { bg: '#E0F7FA', border: '#0891B2', text: '#0891B2' } },
    { key: 'lowentry', show: downPct !== null && downPct < 10, label: 'Low Entry Fee', c: { bg: '#ECFEFF', border: '#0D9488', text: '#0D9488' } },
    { key: 'discounted', show: a.discountPrice === true, label: 'Discounted Price', c: { bg: '#FFF1F2', border: '#D14343', text: '#D14343' } },
  ].filter((t) => t.show);

  // Nightly-rate tiers
  const tierRows = [
    { tier: 'Budget', occ: a.occupancyRate_budget, rate: a.anr_budget ?? a.anrbudget, revenue: a.egr_budget ?? a.egrbudget },
    { tier: 'Economy', occ: a.occupancyRate_economy, rate: a.anr_economy ?? a.anreconomy, revenue: a.egr_economy ?? a.egreconomy },
    { tier: 'Midscale', occ: a.occupancyRate_midscale, rate: a.anr_midscale ?? a.anrmidscale, revenue: a.egr_midscale ?? a.egrmidscale },
    { tier: 'Upscale', occ: a.occupancyRate_upscale, rate: a.anr_upscale ?? a.anrupscale, revenue: a.egr_upscale ?? a.egrupscale },
    { tier: 'Luxury', occ: a.occupancyRate_luxury, rate: a.anr_luxury ?? a.anrluxury, revenue: a.egr_luxury ?? a.egrluxury },
  ].filter((row) => hasAnyValue(row.rate, row.revenue));

  // Comparable properties (comp{n}link / comp{n}grossRevenue)
  const compRows = [1, 2, 3, 4, 5, 6]
    .map((num) => {
      const link = a[`comp${num}link`];
      const revenue = a[`comp${num}grossRevenue`];
      if (!hasAnyValue(link, revenue)) return null;
      return { name: `Comparable ${num}`, link, revenue: fmt$(revenue) };
    })
    .filter(Boolean) as { name: string; link?: string; revenue: string }[];

  // Top Properties comps (comp_${n}_*)
  const topCompNums = Array.from(
    new Set(
      Object.keys(a)
        .map((k) => {
          const m = k.match(/^comp_(\d+)_(title|dailyRate|occupancy|link|grossRevenue)$/);
          return m && a[k] ? Number(m[1]) : null;
        })
        .filter((n): n is number => n !== null),
    ),
  ).sort((x, y) => x - y);

  // Market revenue & occupancy
  const hasMarketRevenue = hasAnyObjectValue(
    MONTHS.reduce((acc, m) => ({ ...acc, [m.key]: a[`marketRevenue${m.key}`] }), {}),
  );
  const hasMarketOccupancy = hasAnyObjectValue(
    MONTHS.reduce((acc, m) => ({ ...acc, [m.key]: a[`marketOccupancy${m.key}`] }), {}),
  );
  const marketRows = MONTHS.map(({ key, label }) => ({
    period: label,
    revenue: hasValue(a[`marketRevenue${key}`]) ? formatCompact(a[`marketRevenue${key}`]) : '—',
    occupancy: hasValue(a[`marketOccupancy${key}`]) ? `${a[`marketOccupancy${key}`]}%` : '—',
  })).filter((row) => row.revenue !== '—' || row.occupancy !== '—');

  // Signature Process base values
  const anrValues = [a.anr_budget, a.anr_economy, a.anr_midscale, a.anr_upscale, a.anr_luxury]
    .map((v) => parseFloat(v))
    .filter((v) => !Number.isNaN(v) && v > 0);
  const overallAvgANR = anrValues.length > 0 ? anrValues.reduce((sum, v) => sum + v, 0) / anrValues.length : 0;
  const baseANR = Math.round(parseInt(a.averageNightRate || 0, 10) || overallAvgANR || 0);
  const baseOcc = Math.round(parseFloat(a.occupancyRate || 0)) || 0;
  // Web rules: occupancy empty → default; ANR empty → 0.
  const occupancy = editableOccupancy === null || editableOccupancy === '' ? baseOcc : Math.round(Number(editableOccupancy));
  const avgANR = editableANR === null ? baseANR : editableANR === '' ? 0 : Math.round(Number(editableANR));
  const estimatedRevenue = Math.round(365 * ((occupancy || 0) / 100) * (avgANR || 0));
  const annualExpenses = Math.round(parseFloat(a.expenseTotalAnnual || 0));
  const hasExpenses = hasValue(a.expenseTotalAnnual);
  const netRevenue = estimatedRevenue - annualExpenses;

  // 10-year rows
  const tenYearRows = computeTenYearProjection(occupancy, avgANR, annualExpenses, tenYearGrowth, tenYearOverrides);
  // 10-year totals shown as headline figures above the breakdown table.
  const projTotals = tenYearRows.reduce(
    (acc, r) => ({ gross: acc.gross + (r.grossRevenue ?? 0), net: acc.net + (r.netRevenue ?? 0) }),
    { gross: 0, net: 0 },
  );
  const updateGrowth = (group: keyof TenYearGrowth, bucket: 'y1to5' | 'y6to10', raw: string) => {
    const v = raw.replace(/[^0-9.]/g, '');
    setTenYearGrowth((prev) => ({ ...prev, [group]: { ...prev[group], [bucket]: v } }));
  };
  const updateOverride = (year: number, field: keyof TenYearOverride, val: string) => {
    setTenYearOverrides((prev) => ({ ...prev, [year]: { ...(prev[year] || {}), [field]: val } }));
  };

  // Tax Savings section (empty rate → 0, matching web)
  const taxFederalRate = taxSectionRate === null ? Number(pf.FEDERAL_TAX_PERCENTAGE) : taxSectionRate === '' ? 0 : Number(taxSectionRate);
  const taxIncomeReduction = parseFloat(a.incomeReduction) || 0;
  const estTaxSavings = (taxFederalRate / 100) * taxIncomeReduction;

  // 50/50 JV active values (empty rate → 0, matching web)
  const activeJvRate = jvSectionRate === null ? pf.FEDERAL_TAX_RATE * 100 : jvSectionRate === '' ? 0 : Number(jvSectionRate);
  const activeTaxSavings = Math.round((Number(activeJvRate) / 100) * pf.bonusDepr);
  const activeTotalReturn = pf.purchasePrice
    ? Math.round(pf.totalOOP + pf.netSales + pf.totalDist + activeTaxSavings)
    : pf.totalReturn;
  const activeCoC1 = pf.purchasePrice && pf.totalOOP > 0 ? `${(((pf.annualDist + activeTaxSavings) / pf.totalOOP) * 100).toFixed(2)}%` : pf.cashOnCash1yr;
  const activeCoC3 = pf.purchasePrice && pf.totalOOP > 0 ? `${(((pf.annualDist * 3 + activeTaxSavings) / pf.totalOOP) * 100).toFixed(2)}%` : pf.cashOnCash3yr;
  const activeCoC5 = pf.purchasePrice && pf.totalOOP > 0 ? `${((activeTotalReturn / pf.totalOOP) * 100).toFixed(2)}%` : pf.cashOnCash5yr;
  const activeAnnualized = pf.purchasePrice && pf.llcBuyIn > 0 ? `${((Math.pow(activeTotalReturn / pf.llcBuyIn, 1 / 5) - 1) * 100).toFixed(2)}%` : pf.annualizedReturn;

  // Estimated expenses
  const oneTimeFields = [
    { label: 'Entry or Down Payment', value: a.expenseEntryDownPayment },
    { label: 'Closing Costs', value: a.expenseClosingCosts },
    { label: 'Design/Furnishing/Setup/Renovations', value: a.expenseDesignFurnishing },
  ];
  const annualFields = [
    { label: 'Principal and Interest', value: a.expensePrincipalInterest },
    { label: 'Property Taxes', value: a.expensePropertyTaxes },
    { label: 'Insurance', value: a.expenseInsurance },
    { label: 'Management', value: a.expenseManagement },
    { label: 'OTA Fees — Airbnb, VRBO, etc.', value: a.expenseOTAFees },
    { label: 'Cleaning', value: a.expenseCleaning },
    { label: 'Maintenance and Repairs', value: a.expenseMaintenanceRepairs },
    { label: 'Utilities', value: a.expenseUtilities },
    { label: 'HOA Fees', value: a.expenseHOAFees },
    { label: 'Sales Tax', value: a.expenseSalesTax },
    { label: 'Advertising', value: a.expenseAdvertising },
    { label: 'Misc Expense', value: a.expenseMisc },
  ];
  const hasOneTime = oneTimeFields.some((f) => hasValue(f.value)) || hasValue(a.expenseTotalOneTime);
  const hasAnnual = annualFields.some((f) => hasValue(f.value)) || hasValue(a.expenseTotalAnnual);

  const showMarketContext =
    hasValue(a.guestDemandInsights) ||
    hasValue(a.valueAddOpportunities) ||
    hasValue(a.localAttractions) ||
    hasValue(a.amenities) ||
    hasValue(a.localContacts) ||
    (Array.isArray(a.travelMotivations) && a.travelMotivations.length > 0) ||
    (Array.isArray(a.vacationRentalMarkets) && a.vacationRentalMarkets.length > 0);

  const showMarketResearch =
    hasAnyValue(a.underwritingMarketType, a.underwritingMarketSize, a.strZoning, a.strConfidence, a.occupancyRate, a.averageNightlyRate) ||
    compRows.length > 0;

  const canClaim = mode === 'client' && isAuthenticated && data.status !== 'pending' && data.status !== 'sold';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={s.screen}>
      {/* Header — fixes status-bar overlap; matches every other inner page */}
      <ScreenHeader title={data.title || 'Property'} subtitle={cityState || undefined} onBack={onBack} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        contentContainerStyle={{ paddingBottom: BOTTOM_NAV_HEIGHT + spacing.xxl }}
      >
        {/* Media gallery — images then videos (videos play inline with native
            play/pause/fullscreen controls). */}
        <ImageCarousel images={allImages} videos={dealVideos} height={CLIENT_HERO} index={imgIndex} onIndexChange={setImgIndex}>
          <View style={[s.statusBadgePos, { top: spacing.sm }]}>
            <Badge label={(data.status || 'published').toUpperCase()} tone={statusTone(data.status)} />
          </View>
        </ImageCarousel>

        <View style={s.body}>
          {/* Client CTA row — CLIENT interface only */}
          {mode === 'client' && (
            <View style={s.ctaRow}>
              {canClaim && (
                <Pressable style={[s.ctaBtn, s.ctaPrimary]} onPress={() => { setClaimError(null); setConfirmingClaim(true); }}>
                  <Ionicons name="home" size={16} color="#fff" />
                  <Text style={s.ctaPrimaryText}>I want this Scholarship House</Text>
                </Pressable>
              )}
              <Pressable style={[s.ctaBtn, s.ctaGhost]} onPress={handleCopyLink}>
                <Ionicons name={linkCopied ? 'checkmark' : 'link-outline'} size={16} color={colors.primaryAccent} />
                <Text style={s.ctaGhostText}>{linkCopied ? 'Copied!' : 'Copy Link'}</Text>
              </Pressable>
              <Pressable
                style={[s.ctaBtn, s.ctaGhost, isFavorited && { borderColor: colors.star, backgroundColor: colors.warningSoft }]}
                onPress={toggleFavorite}
                disabled={!favReady}
              >
                <Ionicons name={isFavorited ? 'star' : 'star-outline'} size={16} color={colors.star} />
                <Text style={[s.ctaGhostText, { color: isFavorited ? '#B7791F' : colors.textSecondary }]}>
                  {!favReady ? 'Loading…' : isFavorited ? 'Favorited' : 'Add to Favorites'}
                </Text>
              </Pressable>
            </View>
          )}



          {/* Sold banner */}
          {data.status === 'sold' && (
            <View style={s.soldBanner}>
              <Text style={s.soldTitle}>This Property Has Been Sold</Text>
              <Text style={s.soldBody}>This listing is no longer available for purchase.</Text>
            </View>
          )}

          {/* Title / ID / price */}
          <View style={s.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{titleLine} </Text>
              {!!fullAddress && (
                <Pressable style={s.addressRow} onPress={openMap}>
                  <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                  <Text style={s.addressText}>{cityState || fullAddress}</Text>
                  <Text style={s.mapLink}>View map</Text>
                </Pressable>
              )}
              <Text style={s.propId}>
                <Text style={s.propIdLabel}>Property ID: </Text>
                {propId}
              </Text>
              {formatPublishedDate(data) && (
                <Text style={s.propId}>
                  <Text style={s.propIdLabel}>Published: </Text>
                  {formatPublishedDate(data)}
                </Text>
              )}
            </View>
            <Text style={s.price}>${formatPrice(pf.dealSalePrice || data.price)}</Text>
          </View>
          {hasValue(a.discountedPrice) && a.discountedPrice !== pf.dealSalePrice && (
            <Text style={s.strikePrice}>${formatPrice(a.discountedPrice)}</Text>
          )}

          {/* Tags */}
          {activeTags.length > 0 && (
            <>
              <SectionHeading icon="🏷️" title="Tags" />
              <View style={s.tagsWrap}>
                {activeTags.map((tag) => (
                  <View key={tag.key} style={[s.tagChip, { backgroundColor: tag.c.bg, borderColor: tag.c.border }]}>
                    <Text style={[s.tagText, { color: tag.c.text }]}>{tag.label}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Core stats */}
          <Card style={s.gridCard} padding="lg">
            <View style={s.statGrid}>
              <StatItem label="Type" value={PROPERTY_TYPE_LABELS[a.category] || humanizeEnum(a.category)} />
              <StatItem label="Bedrooms" value={data.bedrooms || '—'} />
              <StatItem label="Bathrooms" value={data.bathrooms || '—'} />
              <StatItem label="Sqft" value={hasValue(a.squareFootage) ? Number(a.squareFootage).toLocaleString('en-US') : '—'} />
              <StatItem label="Year Built" value={a.yearBuilt || '—'} />
            </View>
          </Card>
          <Text style={s.publishedBy}>
            Published by: <Text style={{ fontWeight: '700', color: colors.textSecondary }}>{submittedName}</Text> {submittedRole}
          </Text>

          {/* Financing & STR Details */}
          <SectionHeading icon="🏛" title="Financing & STR Details" />
          <Card style={s.gridCard} padding="lg">
            <View style={s.statGrid}>
              <StatItem label="Financing Type" value={humanizeEnum(a.financingType)} />
              <StatItem label="Interest Rate" value={hasAnyValue(a.subjInterestRate, a.sellerInterestRate) ? `${a.subjInterestRate || a.sellerInterestRate}%` : '—'} />
              <StatItem label="50/50 Property" value={a.fiftyFiftyPartner ? 'Yes' : 'No'} />
              <StatItem label="Entry / Down" value={fmt$(pf.dealDownPayment)} />
              <StatItem label="Monthly Payment" value={hasValue(a.totalMonthlyPayment) ? `${fmt$(a.totalMonthlyPayment)}/mo` : '—'} />
              <StatItem label="HOA" value={a.isHOA ? (hasValue(a.hoaMonthlyFee) ? `${fmt$(a.hoaMonthlyFee)}/mo` : 'Yes') : 'No'} />
            </View>
          </Card>

          {/* Contact */}
          <Card style={s.contactCard} padding="lg">
            <View style={s.contactIcon}><Ionicons name="call" size={18} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.contactLabel}>CONTACT</Text>
              <Text style={s.contactValue}>
                {a.contactName || submittedName}
                {submittedPhone ? ` · ${submittedPhone}` : ''}
              </Text>
            </View>
          </Card>

          {/* Description */}
          {hasValue(a.description) && (
            <>
              <SectionHeading icon="✦" title="Description" />
              <Card padding="lg"><Text style={s.paragraph}>{a.description}</Text></Card>
            </>
          )}

          {/* Story */}
          {hasValue(a.story) && (
            <>
              <SectionHeading icon="✦" title="Seller's Intentions" />
              <Card padding="lg"><Text style={s.paragraph}>{a.story}</Text></Card>
            </>
          )}

          {/* Market Research */}
          {showMarketResearch && (
            <>
              <SectionHeading icon="↗" title="Market Research" />
              <Card style={[s.gridCard, { backgroundColor: colors.warningSoft }]} padding="lg">
                <View style={s.statGrid}>
                  <StatItem label="Market Type" value={humanizeEnum(a.underwritingMarketType)} />
                  <StatItem label="Market Size" value={humanizeEnum(a.underwritingMarketSize)} />
                  <StatItem label="STR Zoning" value={a.strZoning || '—'} />
                  <StatItem label="STR Confidence" value={humanizeEnum(a.strConfidence)} />
                </View>
              </Card>
              {compRows.length > 0 && (
                <View style={{ marginTop: spacing.md }}>
                  <Text style={s.subLabel}>Top Comparable Properties</Text>
                  {compRows.slice(0, 2).map((row, i) => (
                    <Card key={i} style={s.compCard} padding="md">
                      {row.link ? (
                        <Pressable onPress={() => Linking.openURL(row.link!)}><Text style={s.compLink}>{row.name}</Text></Pressable>
                      ) : (
                        <Text style={s.compName}>{row.name}</Text>
                      )}
                      <Text style={s.compRev}>Revenue: <Text style={{ fontWeight: '700', color: colors.text }}>{row.revenue}</Text></Text>
                    </Card>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Nightly Rate & Revenue Tiers */}
          {tierRows.length > 0 && (
            <>
              <SectionHeading icon="📊" title="Nightly Rate & Revenue Tiers" />
              <SimpleTable
                columns={[
                  { key: 'tier', label: 'Tier', flex: 1.2 },
                  { key: 'occupancy', label: 'Occupancy', align: 'right' },
                  { key: 'rate', label: 'Avg Rate', align: 'right' },
                  { key: 'revenue', label: 'Est. Revenue', align: 'right' },
                ]}
                rows={tierRows.map((row) => ({
                  tier: row.tier,
                  occupancy: hasValue(row.occ) ? `${row.occ}%` : '—',
                  rate: fmt$(row.rate),
                  revenue: fmt$(row.revenue),
                }))}
              />
            </>
          )}

          {/* Top Properties (Comps) */}
          {topCompNums.length > 0 && (
            <>
              <SectionHeading icon="🏆" title="Top Properties (Comps)" />
              <Text style={s.helperText}>
               These properties represent top-performing listings in the area and are shown to illustrate potential gross revenue if this property were positioned at the top of the market.
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator persistentScrollbar>
                <SimpleTable
                  columns={[
                    { key: 'name', label: 'Property', flex: 2 },
                    { key: 'occupancy', label: 'Occupancy', align: 'right' },
                    { key: 'rate', label: 'Daily Rate', align: 'right' },
                    { key: 'revenue', label: 'Revenue', align: 'right' },
                  ]}
                  rows={topCompNums
                    .map((num) => {
                      const link = a[`comp_${num}_link`];
                      const revenue = a[`comp_${num}_grossRevenue`];
                      const title = a[`comp_${num}_title`] || `Property ${num}`;
                      if (!link && !revenue) return null;
                      return {
                        name: title,
                        occupancy: a[`comp_${num}_occupancy`] ? `${a[`comp_${num}_occupancy`]}%` : '—',
                        rate: a[`comp_${num}_dailyRate`] ? `$${formatPrice(a[`comp_${num}_dailyRate`])}` : '—',
                        revenue: revenue ? `$${formatPrice(revenue)}` : '—',
                      };
                    })
                    .filter(Boolean) as Record<string, React.ReactNode>[]}
                />
              </ScrollView>
            </>
          )}

          {/* Underwriting Materials → SLIDER */}
          {uwImages.length > 0 && (
            <>
              <SectionHeading icon="📋" title="Underwriting Materials" />
              <Text style={s.helperText}>Supporting screenshots, analyses, and reference materials used during underwriting.</Text>
              <View style={s.uwSliderWrap}>
                <ImageCarousel images={uwImages} height={220} />
              </View>
            </>
          )}

          {/* Scholarship House Signature Process */}
          <SectionHeading icon="🏢" title="Scholarship House Signature Process" />
          <Card padding="lg">
            <View style={s.twoCol}>
              <View style={[s.softBox, { flex: 1 }]}>
                <Text style={s.softBoxLabel}>OCCUPANCY RATE</Text>
                <EditableNumber raw={editableOccupancy} defaultValue={baseOcc} onChange={setEditableOccupancy} max={100} suffix="%" width={70} />
                <Text style={s.softHint}>Max value is 100%</Text>
              </View>
              <View style={[s.softBox, { flex: 1 }]}>
                <Text style={s.softBoxLabel}>AVG NIGHTLY RATE</Text>
                <EditableNumber raw={editableANR} defaultValue={baseANR} onChange={setEditableANR} max={5000} prefix="$" width={100} />
                <Text style={s.softHint}>Enter a value up to $5,000</Text>
              </View>
            </View>
            <View style={s.revenueBox}>
              <View style={s.revRow}>
                <Text style={s.revLabel}>ESTIMATED GROSS REVENUE</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.revValue}>${estimatedRevenue.toLocaleString('en-US')}</Text>
                  <Text style={s.revFormula}>365 × {occupancy || 0}% × ${Math.round(avgANR || 0).toLocaleString('en-US')}/night</Text>
                </View>
              </View>
              {hasExpenses && (
                <>
                  <View style={s.revDivider}><Text style={s.revDividerText}>minus ${annualExpenses.toLocaleString('en-US')} annual expenses</Text></View>
                  <View style={s.revRow}>
                    <Text style={[s.revLabel, { color: colors.success }]}>NET REVENUE</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[s.revValue, { color: netRevenue < 0 ? colors.danger : colors.success }]}>
                        {netRevenue < 0 ? '-' : ''}${Math.abs(netRevenue).toLocaleString('en-US')}
                      </Text>
                      <Text style={s.revFormula}>Gross Revenue − Total Annual Expenses</Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          </Card>

          {/* 10-Year Financial Projection */}
          <Card padding="lg" style={{ marginTop: spacing.md }}>
            <View style={s.subHeadRow}>
              <View style={s.projTitleIcon}>
                <Ionicons name="trending-up" size={15} color={colors.primary} />
              </View>
              <Text style={s.subHead}>10-Year Financial Projection</Text>
            </View>

            {/* Headline totals */}
            <View style={s.projSummaryRow}>
              <View style={[s.projSummaryBox, { backgroundColor: colors.primarySoft }]}>
                <Text style={s.projSummaryLabel}>10-YR GROSS REVENUE</Text>
                <Text style={[s.projSummaryValue, { color: colors.primary }]}>
                  ${Math.round(projTotals.gross).toLocaleString('en-US')}
                </Text>
              </View>
              <View style={[s.projSummaryBox, { backgroundColor: colors.successSoft }]}>
                <Text style={s.projSummaryLabel}>10-YR NET REVENUE</Text>
                <Text style={[s.projSummaryValue, { color: projTotals.net < 0 ? colors.danger : colors.success }]}>
                  {projTotals.net < 0 ? '-' : ''}${Math.abs(Math.round(projTotals.net)).toLocaleString('en-US')}
                </Text>
              </View>
            </View>

            {/* Auto-Growth Settings */}
            <View style={s.growthCard}>
              <View style={s.growthHeadRow}>
                <Ionicons name="settings-outline" size={14} color={colors.textSecondary} />
                <Text style={s.growthHead}>Auto-Growth Settings</Text>
              </View>
              {([
                { key: 'occupancy', label: 'Occupancy Growth', icon: 'home' as const, color: colors.primary },
                { key: 'nightlyRate', label: 'Nightly Rate Growth', icon: 'cash' as const, color: colors.success },
                { key: 'expenses', label: 'Expense Growth', icon: 'receipt' as const, color: colors.warning },
              ] as const).map((g) => (
                <View key={g.key} style={s.growthGroup}>
                  <View style={s.growthLabelRow}>
                    <View style={[s.growthIcon, { backgroundColor: g.color + '1A' }]}>
                      <Ionicons name={g.icon} size={13} color={g.color} />
                    </View>
                    <Text style={[s.growthLabel, { color: g.color }]}>{g.label}</Text>
                  </View>
                  <View style={s.growthInputsRow}>
                    <View style={s.growthField}>
                      <Text style={s.growthFieldLabel}>Years 1–5</Text>
                      <View style={s.growthInputWrap}>
                        <TextInput
                          value={String((tenYearGrowth as any)[g.key].y1to5)}
                          onChangeText={(t) => updateGrowth(g.key, 'y1to5', t)}
                          keyboardType="decimal-pad"
                          style={s.growthInput}
                        />
                        <Text style={s.growthPct}>%</Text>
                      </View>
                    </View>
                    <View style={s.growthField}>
                      <Text style={s.growthFieldLabel}>Years 6–10</Text>
                      <View style={s.growthInputWrap}>
                        <TextInput
                          value={String((tenYearGrowth as any)[g.key].y6to10)}
                          onChangeText={(t) => updateGrowth(g.key, 'y6to10', t)}
                          keyboardType="decimal-pad"
                          style={s.growthInput}
                        />
                        <Text style={s.growthPct}>%</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {/* Year-by-year breakdown */}
            <Text style={s.projTableTitle}>Year-by-Year Breakdown</Text>
            <Text style={s.projTableHint}>Tap any value to override · swipe to see more →</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator persistentScrollbar style={{ marginTop: spacing.sm }}>
              <View style={s.projTable}>
                <View style={s.projHeaderRow}>
                  <Text style={[s.projHeaderText, { width: 56 }]}>Year</Text>
                  <Text style={[s.projHeaderText, { width: 92 }]}>Occ %</Text>
                  <Text style={[s.projHeaderText, { width: 110 }]}>Nightly Rate</Text>
                  <Text style={[s.projHeaderText, { width: 110 }]}>Gross Rev</Text>
                  <Text style={[s.projHeaderText, { width: 110 }]}>Expenses</Text>
                  <Text style={[s.projHeaderText, { width: 110, textAlign: 'right' }]}>Net Rev</Text>
                </View>
                {tenYearRows.map((r, idx) => {
                  const ov = tenYearOverrides[r.year] || {};
                  return (
                    <View
                      key={r.year}
                      style={[
                        s.projRow,
                        idx % 2 === 1 && s.projRowAlt,
                        r.isLocked && s.projRowLocked,
                      ]}
                    >
                      <View style={[s.projCell, { width: 56 }]}>
                        <View style={[s.projYearBadge, r.isLocked && s.projYearBadgeLocked]}>
                          {r.isLocked ? (
                            <Ionicons name="lock-closed" size={9} color="#fff" style={{ marginRight: 2 }} />
                          ) : null}
                          <Text style={[s.projYearText, r.isLocked && { color: '#fff' }]}>{r.year}</Text>
                        </View>
                      </View>
                      <View style={[s.projCell, { width: 92 }]}>
                        {r.isLocked ? (
                          <Text style={s.projStatic}>{fmtPct(r.occupancy)}%</Text>
                        ) : (
                          <TextInput
                            value={ov.occupancy !== undefined ? String(ov.occupancy) : fmtPct(r.occupancy)}
                            onChangeText={(t) => updateOverride(r.year, 'occupancy', t.replace(/[^0-9.]/g, ''))}
                            keyboardType="decimal-pad"
                            style={s.projInput}
                          />
                        )}
                      </View>
                      <View style={[s.projCell, { width: 110 }]}>
                        {r.isLocked ? (
                          <Text style={s.projStatic}>${Math.round(r.nightlyRate).toLocaleString('en-US')}</Text>
                        ) : (
                          <TextInput
                            value={ov.nightlyRate !== undefined ? String(ov.nightlyRate) : String(Math.round(r.nightlyRate))}
                            onChangeText={(t) => updateOverride(r.year, 'nightlyRate', t.replace(/[^0-9]/g, ''))}
                            keyboardType="number-pad"
                            style={s.projInput}
                          />
                        )}
                      </View>
                      <Text style={[s.projCell, s.projStatic, { width: 110 }]}>
                        {r.grossRevenue === null ? '—' : `$${r.grossRevenue.toLocaleString('en-US')}`}
                      </Text>
                      <View style={[s.projCell, { width: 110 }]}>
                        {r.isLocked ? (
                          <Text style={s.projStatic}>{r.expenses === null ? '—' : `$${r.expenses.toLocaleString('en-US')}`}</Text>
                        ) : (
                          <TextInput
                            value={ov.expenses !== undefined ? String(ov.expenses) : String(Math.round(r.expenses ?? 0))}
                            onChangeText={(t) => updateOverride(r.year, 'expenses', t.replace(/[^0-9]/g, ''))}
                            keyboardType="number-pad"
                            style={s.projInput}
                          />
                        )}
                      </View>
                      <Text style={[s.projCell, { width: 110, textAlign: 'right', fontWeight: '700', color: r.netRevenue === null ? colors.textMuted : r.netRevenue < 0 ? colors.danger : colors.success }]}>
                        {r.netRevenue === null ? '—' : `${r.netRevenue < 0 ? '-' : ''}$${Math.abs(r.netRevenue).toLocaleString('en-US')}`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </Card>

          {/* Disclaimer */}
          <View style={s.disclaimer}>
            <Ionicons name="information-circle" size={18} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={s.disclaimerTitle}>DISCLAIMER</Text>
              <Text style={s.disclaimerBody}>
                These expenses are only estimates and it is your responsibility to do your own due diligence for more accurate numbers.
              </Text>
            </View>
          </View>

          {/* Tax Savings */}
          {(hasValue(a.incomeReduction) || hasValue(pf.FEDERAL_TAX_PERCENTAGE)) && (
            <>
              <SectionHeading icon="💲" title="Tax Savings" />
              <View style={s.twoCol}>
                <Card style={{ flex: 1 }} padding="md">
                  <Text style={s.statItemLabel}>Federal Tax Rate</Text>
                  <EditableNumber raw={taxSectionRate} defaultValue={Number(pf.FEDERAL_TAX_PERCENTAGE)} onChange={setTaxSectionRate} max={100} suffix="%" width={64} />
                </Card>
                <Card style={{ flex: 1 }} padding="md"><StatItem label="Est. Income Reduction" value={fmt$(taxIncomeReduction)} /></Card>
              </View>
              <Card style={[s.taxResult]} padding="md"><StatItem label="Est. Tax Savings" value={estTaxSavings > 0 ? fmt$(estTaxSavings) : '$0'} accent /></Card>
            </>
          )}

          {/* 50/50 JV Pro Forma */}
          {a.fiftyFiftyPartner && (
            <>
              <SectionHeading icon="🛡" title="50/50 Joint Venture Pro Forma" />
              <Card style={{ backgroundColor: colors.primarySoft }} padding="lg">
                <View style={s.statGrid}>
                  <StatItem label="Purchase Price" value={fmt$(pf.purchasePrice)} />
                  <StatItem label="Out-of-Pocket" value={fmt$(pf.llcBuyIn)} />
                  <StatItem label="Initial Tax Savings" value={fmt$(activeTaxSavings)} />
                  <StatItem label="Total Net Cash Inflow" value={fmt$(pf.totalDist)} />
                  <StatItem label="Total Return & Benefit" value={fmt$(activeTotalReturn)} />
                  <StatItem label="Annualized Return" value={activeAnnualized} />
                </View>
              </Card>

              <Card padding={0} style={s.jvCard}>
                <Text style={s.jvCardHead}>Cash-on-cash returns (Year 1, 3, 5)</Text>
                <View style={{ padding: spacing.sm }}>
                  <DetailRow label="1-Yr Cash-on-Cash" value={activeCoC1} />
                  <DetailRow label="3-Yr Cash-on-Cash" value={activeCoC3} />
                  <DetailRow label="5-Yr Cash-on-Cash" value={activeCoC5} />
                </View>
              </Card>

              <Card padding={0} style={s.jvCard}>
                <Text style={s.jvCardHead}>Client Out-of-Pocket Investment</Text>
                <View style={{ padding: spacing.sm }}>
                  <DetailRow label="LLC Joint Venture Buy-In" value={fmt$(pf.llcBuyIn)} />
                  <Pressable style={s.includedBtn} onPress={() => setShowIncluded(true)}>
                    <Text style={s.includedBtnText}>📋  What's Included in the LLC JV Buy-In</Text>
                    <Text style={s.includedBtnCta}>View All →</Text>
                  </Pressable>
                  <DetailRow label="Total Out-of-Pocket" value={fmt$(pf.totalOOP)} emphasized />
                </View>
              </Card>

              <Card padding={0} style={s.jvCard}>
                <Text style={s.jvCardHead}>Client Tax Snapshot (Year 1)</Text>
                <View style={{ padding: spacing.sm }}>
                  <DetailRow label="Est. Bonus Depreciation" value={fmt$(pf.bonusDepr)} />
                  <View style={s.detailRow}>
                    <Text style={s.detailLabel}>Federal Tax Rate</Text>
                    <EditableNumber raw={jvSectionRate} defaultValue={pf.FEDERAL_TAX_RATE * 100} onChange={setJvSectionRate} max={100} suffix="%" width={60} />
                  </View>
                  <DetailRow label="Tax Savings (Bonus Depr.)" value={fmt$(activeTaxSavings)} />
                </View>
              </Card>

              <Card padding={0} style={s.jvCard}>
                <Text style={s.jvCardHead}>Client 5-Year Cash Flow Summary</Text>
                <View style={{ padding: spacing.sm }}>
                  {[1, 2, 3, 4, 5].map((yr) => <DetailRow key={yr} label={`Year ${yr}`} value={fmt$(pf.annualDist)} />)}
                  <DetailRow label="Totals" value={fmt$(pf.totalDist)} emphasized />
                </View>
              </Card>

              <Card padding={0} style={s.jvCard}>
                <Text style={s.jvCardHead}>Sale Snapshot at Exit Year</Text>
                <View style={{ padding: spacing.sm }}>
                  <DetailRow label="Purchase Price" value={fmt$(pf.purchasePrice)} />
                  <DetailRow label="Est. Sale Price (7% annual)" value={fmt$(pf.estSalePrice)} />
                  <DetailRow label="Accelerated Appr. Gain" value={fmt$(pf.apprGain)} />
                  <DetailRow label="Return of Investment" value={fmt$(pf.totalOOP)} />
                  <DetailRow label="Net Sale Proceeds (Split 50/50)" value={fmt$(pf.clientShare)} />
                </View>
              </Card>

              <Card padding="lg" style={s.jvCard}>
                <Text style={s.jvTotalHead}>Client Total Return / Benefit</Text>
                <DetailRow label="Initial Out-of-Pocket" value={fmt$(pf.totalOOP)} />
                <DetailRow label="Share of Net Sale Proceeds" value={fmt$(pf.netSales)} />
                <DetailRow label="5-Year Distributions" value={fmt$(pf.totalDist)} />
                <DetailRow label="Estimated Tax Savings" value={fmt$(activeTaxSavings)} />
                <DetailRow label="Total Est. Return/Benefit" value={fmt$(Math.round(activeTotalReturn))} emphasized />
              </Card>

              <View style={s.notesBox}>
                <Text style={s.notesTitle}>NOTES</Text>
                {[
                  '(1) Does not include the mortgage paydown (a bonus benefit not calculated).',
                  '(2) Annual operating cash flow and sale profit pool are split per the Revenue Share agreement and rate.',
                  '(3) Annualized Return = compound annual growth rate over the length of the project.',
                  '(4) Cash-On-Cash: cash income the investment produces. Year 1 includes the tax savings from Bonus Depreciation.',
                  '(5) Based on the estimated accelerated appreciation gain from selling as a business.',
                ].map((n) => <Text key={n} style={s.notesItem}>{n}</Text>)}
              </View>
            </>
          )}

          {/* Estimated Expenses */}
          {(hasOneTime || hasAnnual) && (
            <>
              <SectionHeading icon="$" title="Estimated Expenses" />
              <Card padding="lg">
                {hasOneTime && (
                  <>
                    <Text style={s.expenseHead}>ONE-TIME FEES</Text>
                    {oneTimeFields.filter((f) => hasValue(f.value)).map((f) => <DetailRow key={f.label} label={f.label} value={fmt$(f.value)} />)}
                    {hasValue(a.expenseTotalOneTime) && <DetailRow label="Total One-Time" value={fmt$(a.expenseTotalOneTime)} emphasized />}
                  </>
                )}
                {hasAnnual && (
                  <>
                    <Text style={[s.expenseHead, { marginTop: spacing.md }]}>ANNUAL FEES AND EXPENSES</Text>
                    {annualFields.filter((f) => hasValue(f.value)).map((f) => <DetailRow key={f.label} label={f.label} value={fmt$(f.value)} />)}
                    {hasValue(a.expenseTotalAnnual) && <DetailRow label="Total Annual Expenses" value={fmt$(a.expenseTotalAnnual)} emphasized />}
                  </>
                )}
              </Card>
            </>
          )}

          {/* Market Revenue & Occupancy */}
          {(hasMarketRevenue || hasMarketOccupancy || marketRows.length > 0) && (
            <>
              <SectionHeading icon="📈" title="Market Revenue & Occupancy" />
              <SimpleTable
                columns={[
                  { key: 'period', label: 'Period', flex: 1.2 },
                  { key: 'revenue', label: 'Market Revenue', align: 'right' },
                  { key: 'occupancy', label: 'Market Occupancy', align: 'right' },
                ]}
                rows={marketRows}
              />
            </>
          )}

          {/* Underwriting Comps */}
          {compRows.length > 0 && (
            <>
              <SectionHeading icon="🧾" title="Underwriting Comps" />
              <SimpleTable
                columns={[
                  { key: 'name', label: 'Property', flex: 2 },
                  { key: 'revenue', label: 'Gross Revenue', align: 'right' },
                ]}
                rows={compRows.map((r) => ({ name: r.name, revenue: r.revenue }))}
              />
            </>
          )}

          {/* Market Context & Demand */}
          {showMarketContext && (
            <>
              <SectionHeading icon="🌎" title="Market Context & Demand" />
              {Array.isArray(a.travelMotivations) && a.travelMotivations.length > 0 && (
                <Card padding="lg" style={{ marginBottom: spacing.md }}>
                  <Text style={s.ctxHead}>Why People Travel Here</Text>
                  <View style={s.chipWrap}>{a.travelMotivations.map((t: string) => <View key={t} style={s.ctxChip}><Text style={s.ctxChipText}>{t}</Text></View>)}</View>
                </Card>
              )}
              {Array.isArray(a.vacationRentalMarkets) && a.vacationRentalMarkets.length > 0 && (
                <Card padding="lg" style={{ marginBottom: spacing.md }}>
                  <Text style={s.ctxHead}>Vacation Rental Markets</Text>
                  <View style={s.chipWrap}>{a.vacationRentalMarkets.map((t: string) => <View key={t} style={s.ctxChip}><Text style={s.ctxChipText}>{VACATION_RENTAL_MARKET_LABELS[t] || humanizeEnum(t)}</Text></View>)}</View>
                </Card>
              )}
              {hasValue(a.guestDemandInsights) && <Card padding="lg" style={{ marginBottom: spacing.md }}><Text style={s.ctxHead}>Guest Demand Insights</Text><Text style={s.paragraph}>{a.guestDemandInsights}</Text></Card>}
              {hasValue(a.valueAddOpportunities) && <Card padding="lg" style={{ marginBottom: spacing.md }}><Text style={s.ctxHead}>Value-Add Opportunities</Text><Text style={s.paragraph}>{a.valueAddOpportunities}</Text></Card>}
              {hasValue(a.localAttractions) && <Card padding="lg" style={{ marginBottom: spacing.md }}><Text style={s.ctxHead}>Local Attractions</Text><Text style={s.paragraph}>{toChipList(a.localAttractions).join(', ') || a.localAttractions}</Text></Card>}
              {hasValue(a.amenities) && <Card padding="lg" style={{ marginBottom: spacing.md }}><Text style={s.ctxHead}>Amenities</Text><Text style={s.paragraph}>{toChipList(a.amenities).join(', ') || a.amenities}</Text></Card>}
            </>
          )}

          {/* Additional Info */}
          {hasValue(a.additionalInfo) && (
            <>
              <SectionHeading icon="ℹ" title="Additional Info" />
              <Card padding="lg"><Text style={s.paragraph}>{a.additionalInfo}</Text></Card>
            </>
          )}

          {/* Location — embedded Google map at the bottom of the page. The map
              is a non-interactive preview (pointerEvents none) so the page keeps
              scrolling; tapping it opens the full map in Google Maps. */}
          {!!mapHtml && (
            <>
              <SectionHeading icon="📍" title="Location" />
              <Pressable style={s.mapCard} onPress={() => setShowMap(true)}>
                <View style={s.mapInner} pointerEvents="none">
                  <WebView
                    originWhitelist={['*']}
                    source={{ html: mapHtml }}
                    style={s.mapWebview}
                    scrollEnabled={false}
                    javaScriptEnabled
                    domStorageEnabled
                    startInLoadingState
                  />
                </View>
                <View style={s.mapFooter}>
                  <Ionicons name="location-outline" size={14} color={colors.primary} />
                  <Text style={s.mapFooterText} numberOfLines={1}>{fullAddress || cityState}</Text>
                  <Text style={s.mapOpen}>Expand map ›</Text>
                </View>
              </Pressable>
            </>
          )}

          {/* Submitter actions — SUBMITTER interface only */}
          {mode === 'submitter' && (
            <View style={s.submitterActions}>
              <Button title="Edit listing" onPress={() => { if (locked) setLockedAction('edit'); else router.push({ pathname: '/properties/edit', params: { id: data.id } }); }} />
            
		
            </View>
          )}
        </View>
      </ScrollView>

      <WhatsIncludedModal visible={showIncluded} onClose={() => setShowIncluded(false)} />

      {/* Full-screen interactive map — opens IN the app (not the Google Maps app). */}
      <Modal visible={showMap} animationType="slide" onRequestClose={() => setShowMap(false)}>
        <SafeAreaView style={s.mapModal} edges={['top', 'bottom']}>
          <View style={s.mapModalHeader}>
            <Pressable onPress={() => setShowMap(false)} hitSlop={10} style={s.mapModalIcon}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={s.mapModalTitle} numberOfLines={1}>{fullAddress || cityState || 'Location'}</Text>
            <Pressable onPress={openMap} hitSlop={10} style={s.mapModalIcon}>
              <Ionicons name="open-outline" size={22} color={colors.primary} />
            </Pressable>
          </View>
          {!!mapHtml && (
            <WebView
              originWhitelist={['*']}
              source={{ html: mapHtml }}
              style={{ flex: 1 }}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* Claim flow (client) */}
      <ConfirmModal
        visible={confirmingClaim}
        title="Hold This Property"
        message={'You will be required to sign a Memorandum of Understanding (MOU) and wire $5k within 48 hours to hold this property. Once confirmed, this property is marked Pending and the Scholarship House team will reach out to you. Continue?'}
        confirmLabel={claimMut.isPending ? 'Submitting…' : 'Yes, Continue'}
        cancelLabel="Cancel"
        loading={claimMut.isPending}
        onCancel={() => setConfirmingClaim(false)}
        onConfirm={() => claimMut.mutate()}
      />
      <ConfirmModal
        visible={!!claimError}
        title="Could not claim property"
        message={claimError ?? ''}
        confirmLabel="OK"
        cancelLabel="Close"
        onCancel={() => setClaimError(null)}
        onConfirm={() => setClaimError(null)}
      />
      <SuccessModal
        visible={claimSuccess}
        title="Request received!"
        message="This property is now marked Pending. The Scholarship House team has been notified and will reach out about the MOU and the $5k wire."
        ctaLabel="Got it"
        onDismiss={() => setClaimSuccess(false)}
      />

      {/* Submitter modals */}
      <ConfirmModal
        visible={confirmingDelete}
        title="Unsubmit Property"
        message={`Are you sure you want to remove "${data.title || 'this property'}" from review? This cannot be undone.`}
        confirmLabel={removeMut.isPending ? 'Removing…' : 'Unsubmit'}
        cancelLabel="Cancel"
        destructive
        loading={removeMut.isPending}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => removeMut.mutate()}
      />
      <SuccessModal
        visible={removeSuccess}
        title="Property Removed"
        message="The property has been removed from your submissions."
        ctaLabel="Done"
        onDismiss={() => { setRemoveSuccess(false); onBack(); }}
      />
      <ConfirmModal
        visible={!!removeError}
        title="Could not unsubmit"
        message={removeError ?? ''}
        confirmLabel="OK"
        cancelLabel="Close"
        onCancel={() => setRemoveError(null)}
        onConfirm={() => setRemoveError(null)}
      />
      <ConfirmModal
        visible={!!lockedAction}
        title={lockedAction === 'delete' ? 'Delete failed' : 'Update failed'}
        message={lockedAction === 'delete'
          ? 'Approved, published, or sold properties cannot be deleted. Contact an admin.'
          : 'Approved, published, or sold properties cannot be edited. Contact an admin.'}
        confirmLabel="OK"
        cancelLabel="Close"
        onCancel={() => setLockedAction(null)}
        onConfirm={() => setLockedAction(null)}
      />

      <BottomNav />
    </View>
  );
}

const CLIENT_HERO = 300;

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  statusBadgePos: { position: 'absolute', right: spacing.lg },

  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },

  // CTA row
  ctaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderRadius: radius.pill },
  ctaPrimary: { backgroundColor: colors.primary, ...shadows.primaryButton },
  ctaPrimaryText: { ...typography.captionStrong, color: '#fff' },
  ctaGhost: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  ctaGhostText: { ...typography.captionStrong, color: colors.primaryAccent },

  soldBanner: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.danger, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  soldTitle: { ...typography.h3, color: colors.danger },
  soldBody: { ...typography.caption, color: colors.danger, marginTop: 2 },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { ...typography.h1, color: colors.text },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs, flexWrap: 'wrap' },
  mapCard:       { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden', marginBottom: spacing.md, backgroundColor: colors.bg },
  mapInner:      { height: 200, width: '100%' },
  mapWebview:    { flex: 1, backgroundColor: colors.bgAlt },
  mapFooter:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  mapFooterText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  mapOpen:       { ...typography.captionStrong, color: colors.primary },
  mapModal:       { flex: 1, backgroundColor: colors.bg },
  mapModalHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.bg },
  mapModalIcon:   { padding: spacing.xs },
  mapModalTitle:  { ...typography.bodyStrong, color: colors.text, flex: 1 },
  addressText: { ...typography.body, color: colors.textMuted },
  mapLink: { ...typography.captionStrong, color: colors.primaryAccent, textDecorationLine: 'underline' },
  propId: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  propIdLabel: { fontWeight: '700', color: colors.text },
  price: { ...typography.h1, color: colors.primary, marginLeft: spacing.md },
  strikePrice: { ...typography.body, color: colors.textMuted, textDecorationLine: 'line-through', marginTop: 2 },

  sectionHeadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.sm },
  sectionHeadIcon: { fontSize: 16 },
  sectionHeadText: { ...typography.captionStrong, color: colors.primary, textTransform: 'uppercase', letterSpacing: 1, fontSize: 14 },

  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tagChip: { paddingHorizontal: spacing.sm + 2, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1 },
  tagText: { ...typography.caption, fontWeight: '600' },

  gridCard: { marginTop: spacing.sm },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statItem: { width: '50%', paddingVertical: spacing.sm, paddingRight: spacing.sm },
  statItemLabel: { ...typography.tiny, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  statItemValue: { ...typography.bodyStrong, color: colors.text },

  publishedBy: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },

  contactCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  contactIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  contactLabel: { ...typography.tiny, color: colors.textMuted, letterSpacing: 1 },
  contactValue: { ...typography.bodyStrong, color: colors.text, marginTop: 2 },

  paragraph: { ...typography.body, color: colors.textSecondary },
  helperText: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  subLabel: { ...typography.captionStrong, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm, marginTop: spacing.sm },

  compCard: { marginBottom: spacing.sm },
  compLink: { ...typography.bodyStrong, color: colors.primaryAccent },
  compName: { ...typography.bodyStrong, color: colors.text },
  compRev: { ...typography.caption, color: colors.textMuted, marginTop: 2 },

  // Tables
  table: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, alignItems: 'center' },
  tableHeader: { backgroundColor: colors.bgAlt },
  tableCell: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, ...typography.caption, color: colors.text },
  tableHeaderText: { ...typography.tiny, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },

  uwSliderWrap: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },

  // Signature process
  twoCol: { flexDirection: 'row', gap: spacing.sm },
  softBox: { backgroundColor: colors.bgAlt, borderRadius: radius.md, padding: spacing.md },
  softBoxLabel: { ...typography.tiny, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: spacing.sm },
  softHint: { ...typography.tiny, color: colors.textMuted, marginTop: spacing.xs },

  editableWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editableAffix: { ...typography.bodyStrong, color: colors.text },
  editableInput: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs + 2, ...typography.bodyStrong, color: colors.text, backgroundColor: colors.bg },

  revenueBox: { marginTop: spacing.md, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md },
  revRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  revLabel: { ...typography.tiny, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, flexShrink: 1 },
  revValue: { ...typography.h3, color: colors.primary, fontWeight: '800' },
  revFormula: { ...typography.tiny, color: colors.textMuted, fontStyle: 'italic', marginTop: 2 },
  revDivider: { borderTopWidth: 1, borderTopColor: '#BAE6FD', borderStyle: 'dashed', alignItems: 'center', paddingTop: spacing.sm },
  revDividerText: { ...typography.tiny, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },

  subHeadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  subHeadIcon: { fontSize: 16 },
  subHead: { ...typography.captionStrong, color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 14 },
  // Auto-Growth Settings — boxed panel with per-metric icon + paired inputs.
  growthCard: { backgroundColor: colors.bgAlt, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, marginBottom: spacing.md },
  growthHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs },
  growthHead: { ...typography.captionStrong, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  growthGroup: { marginTop: spacing.sm },
  growthLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  growthIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  growthLabel: { ...typography.captionStrong },
  growthInputsRow: { flexDirection: 'row', gap: spacing.sm },
  growthField: { flex: 1 },
  growthFieldLabel: { ...typography.tiny, color: colors.textMuted, marginBottom: 4 },
  growthInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.sm },
  growthInput: { flex: 1, paddingVertical: 8, ...typography.captionStrong, color: colors.text },
  growthPct: { ...typography.captionStrong, color: colors.textSecondary },

  // 10-Year projection — headline totals + framed breakdown table.
  projTitleIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  projSummaryRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  projSummaryBox: { flex: 1, borderRadius: radius.md, padding: spacing.md },
  projSummaryLabel: { ...typography.tiny, color: colors.textSecondary, letterSpacing: 0.4, marginBottom: 4 },
  projSummaryValue: { fontSize: 19, fontWeight: '800' },
  projTableTitle: { ...typography.captionStrong, color: colors.text, marginTop: spacing.xs },
  projTableHint: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },
  projTable: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
  projHeaderRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary },
  projHeaderText: { ...typography.tiny, color: '#fff', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs },
  projRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  projRowAlt: { backgroundColor: colors.bgAlt },
  projRowLocked: { backgroundColor: colors.primarySoft },
  projCell: { paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, ...typography.caption, color: colors.text, justifyContent: 'center' },
  projStatic: { ...typography.captionStrong, color: colors.text },
  projYearBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgAlt, borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start' },
  projYearBadgeLocked: { backgroundColor: colors.primary },
  projYearText: { ...typography.captionStrong, color: colors.text },
  projInput: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.card, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6, ...typography.caption, color: colors.text, minWidth: 78 },

  disclaimer: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.warning, backgroundColor: colors.warningSoft, borderRadius: radius.sm },
  disclaimerTitle: { ...typography.captionStrong, color: colors.warning, textTransform: 'uppercase', letterSpacing: 0.6 },
  disclaimerBody: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  taxResult: { marginTop: spacing.sm, backgroundColor: colors.primarySoft },

  // Detail rows
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.sm },
  detailRowEmphasized: { backgroundColor: colors.bg, borderRadius: radius.sm, ...shadows.card },
  detailLabel: { ...typography.body, color: colors.textMuted, flex: 1 },
  detailValue: { ...typography.bodyStrong, color: colors.text, textAlign: 'right' },

  // JV cards
  jvCard: { marginTop: spacing.md, overflow: 'hidden' },
  jvCardHead: { ...typography.bodyStrong, color: '#fff', backgroundColor: colors.primary, padding: spacing.md },
  jvTotalHead: { ...typography.bodyStrong, color: colors.text, marginBottom: spacing.sm },
  includedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, borderWidth: 1, borderColor: '#BAE6FD', borderStyle: 'dashed', borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, marginVertical: spacing.xs },
  includedBtnText: { ...typography.caption, color: colors.primary, fontWeight: '600', flex: 1 },
  includedBtnCta: { ...typography.tiny, color: colors.primary, fontWeight: '700' },

  notesBox: { marginTop: spacing.md, backgroundColor: colors.bgAlt, borderRadius: radius.md, padding: spacing.md },
  notesTitle: { ...typography.tiny, color: colors.textMuted, letterSpacing: 0.8, marginBottom: spacing.sm },
  notesItem: { ...typography.tiny, color: colors.textMuted, marginBottom: 4, lineHeight: 16 },

  expenseHead: { ...typography.captionStrong, color: colors.text, textTransform: 'uppercase', letterSpacing: 0.4, paddingBottom: spacing.sm, marginBottom: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },

  ctxHead: { ...typography.bodyStrong, color: colors.text, marginBottom: spacing.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  ctxChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  ctxChipText: { ...typography.caption, color: colors.textSecondary },

  submitterActions: { marginTop: spacing.xxl },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', maxWidth: 520, backgroundColor: colors.bg, borderRadius: radius.lg, overflow: 'hidden' },
  modalHeader: { backgroundColor: colors.primary, padding: spacing.lg },
  modalEyebrow: { ...typography.tiny, color: 'rgba(255,255,255,0.8)', letterSpacing: 1 },
  modalTitle: { ...typography.h2, color: '#fff', marginTop: 2 },
  modalLead: { ...typography.caption, color: colors.textSecondary, lineHeight: 20 },
  modalCategory: { ...typography.captionStrong, color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.xs },
  modalBullet: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingLeft: spacing.sm, marginBottom: 4 },
  modalDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primaryAccent, marginTop: 7 },
  modalItem: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  modalClose: { padding: spacing.md, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  modalCloseText: { ...typography.bodyStrong, color: colors.primary },
});
