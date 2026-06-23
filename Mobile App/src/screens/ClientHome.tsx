import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';

import { ScreenHeader } from '@/components/ScreenHeader';
import { useNotificationsHeader } from '@/hooks/useNotificationsHeader';
import { useAuth } from '@/context/AuthContext';
import { getPublishedDeals } from '@/api/deals';
import { radius, shadows, spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';
import type { Property } from '@/types';
import { formatPublishedDate } from '@/utils/date';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── House loader ────────────────────────────────────────────────────────────

function HouseLoader() {
  const ds = useThemedStyles(makeDsStyles);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  return (
    <View style={[ds.screen, ds.loaderWrap, { backgroundColor: '#fff' }]}>
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <Image
          source={require('../../assets/house.gif')}
          style={ds.loaderImg}
          resizeMode="contain"
        />
      </Animated.View>
      <Text style={ds.loaderText}></Text>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clientStatusStyle(s: string): { bg: string; text: string } {
  switch (s.toLowerCase()) {
    case 'sold':    return { bg: '#D14343', text: '#fff' };
    case 'active':  return { bg: '#1F9D55', text: '#fff' };
    case 'pending': return { bg: '#D9A40C', text: '#fff' };
    default:        return { bg: '#3B82F6', text: '#fff' };
  }
}

function coverOf(p: Property): string | undefined {
  const a = p as any;
  return a.coverPhoto?.[0] || a.exteriorImages?.[0] || a.interiorImages?.[0] || p.images?.[0] || a.additionalImages?.[0];
}

// ─── Client Dashboard ────────────────────────────────────────────────────────

export function ClientDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const headerBell = useNotificationsHeader();
  const { colors } = useTheme();
  const ds = useThemedStyles(makeDsStyles);

  const { data: deals = [], isLoading: dealsLoading } = useQuery<Property[]>({
    queryKey: ['published-deals'],
    queryFn:  getPublishedDeals,
  });

  if (dealsLoading) return <HouseLoader />;

  const displayName = user?.name?.trim() || user?.email?.split('@')[0] || 'there';
  const hour        = new Date().getHours();
  const greeting    = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Mirror the client Browse page exactly: "Needs Approval" deals (pending with
  // no claim) are hidden there, and "Active" means published OR approved. Using
  // the same base list + status buckets keeps these counts in sync with Browse.
  const statusOf = (d: Property) => String(d.status || '').toLowerCase();
  const browseList = deals.filter(
    (d) => !(statusOf(d) === 'pending' && (d as any).claimedAt == null),
  );
  const totalDeals  = browseList.length;
  const activeDeals = browseList.filter((d) => ['published', 'approved'].includes(statusOf(d))).length;
  const soldDeals   = browseList.filter((d) => statusOf(d) === 'sold').length;

  const accessBadges = [
    { key: 'priority',    show: user?.access?.priority,    label: 'Priority Access', icon: 'star'           as IoniconName, color: '#F59E0B' },
    { key: 'partnership', show: user?.access?.partnership, label: 'Partnership',     icon: 'people'         as IoniconName, color: '#7C3AED' },
    { key: 'turnkey',     show: user?.access?.turnkey,     label: 'Turnkey Access',  icon: 'home'           as IoniconName, color: '#1F9D55' },
  ].filter((b) => b.show);

  // Newest-first by best-available timestamp, then take the top 3. Numeric
  // compare (not string `>`) so missing/equal dates stay deterministic.
  const dealTime = (d: Property): number => {
    const a = d as any;
    const raw = a.publishedAt || a.submittedAt || d.createdAt || d.updatedAt;
    const t = raw ? Date.parse(raw) : NaN;
    return Number.isNaN(t) ? 0 : t;
  };
  const recentDeals = [...browseList]
    .sort((a, b) => dealTime(b) - dealTime(a))
    .slice(0, 3);

  return (
    <View style={ds.screen}>

      <ScreenHeader
        title="Scholarship House"
        subtitle="Investment Properties"
        iconSource={require('../../assets/icon.png')}
        onProfilePress={() => router.push('/(tabs)/profile')}
        {...headerBell}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxxl * 2 }}>

        {/* ── Hero ── */}
        <View style={ds.hero}>
          {/* Layered translucent shapes give the flat fill subtle depth. */}
          <View pointerEvents="none" style={ds.heroBlobTop} />
          <View pointerEvents="none" style={ds.heroBlobBottom} />

          <Text style={ds.eyebrow}>{greeting.toUpperCase()}</Text>
          <Text style={ds.heroName} numberOfLines={2}>{displayName}</Text>
          <Text style={ds.heroSubtitle}>
            Browse vetted investment properties, save your favorites, and run the numbers — all in one place.
          </Text>

          {accessBadges.length > 0 && (
            <View style={ds.badgesRow}>
              {accessBadges.map((b) => (
                <View key={b.key} style={[ds.accessBadge, { borderColor: b.color + '66' }]}>
                  <Ionicons name={b.icon} size={12} color={b.color} />
                  <Text style={[ds.accessBadgeText, { color: '#fff' }]}>{b.label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Floating stats ── */}
        <View style={ds.statsFloat}>
          <View style={ds.statFloatItem}>
            <Text style={ds.statFloatVal}>{totalDeals}</Text>
            <Text style={ds.statFloatLbl}>Total</Text>
          </View>
          <View style={ds.statFloatDivider} />
          <View style={ds.statFloatItem}>
            <Text style={[ds.statFloatVal, { color: colors.success }]}>{activeDeals}</Text>
            <Text style={ds.statFloatLbl}>Active</Text>
          </View>
          <View style={ds.statFloatDivider} />
          <View style={ds.statFloatItem}>
            <Text style={[ds.statFloatVal, { color: colors.danger }]}>{soldDeals}</Text>
            <Text style={ds.statFloatLbl}>Sold</Text>
          </View>
        </View>

        <View style={ds.content}>

          {/* ── Primary browse CTA ── */}
          <Pressable
            style={({ pressed }) => [ds.browseCta, pressed && { opacity: 0.9 }]}
            onPress={() => router.push('/(tabs)/client-browse')}
          >
            <View style={ds.browseCtaIconWrap}>
              <Ionicons name="search" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ds.browseCtaTitle}>Browse Investment Deals</Text>
              <Text style={ds.browseCtaSub}>
                {totalDeals > 0 ? `${totalDeals} propert${totalDeals === 1 ? 'y' : 'ies'} available` : 'View all available properties'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
          </Pressable>

          {/* ── Quick actions ── */}
          <View style={ds.quickRow}>
            <Pressable style={({ pressed }) => [ds.quickCard, pressed && { opacity: 0.9 }]} onPress={() => router.push('/(tabs)/client-browse')}>
              <View style={[ds.quickIconWrap, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="business-outline" size={20} color={colors.primary} />
              </View>
              <Text style={ds.quickLabel}>Browse</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [ds.quickCard, pressed && { opacity: 0.9 }]} onPress={() => router.push('/(tabs)/client-favorites')}>
              <View style={[ds.quickIconWrap, { backgroundColor: colors.warningSoft }]}>
                <Ionicons name="star-outline" size={20} color={colors.star} />
              </View>
              <Text style={ds.quickLabel}>Favorites</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [ds.quickCard, pressed && { opacity: 0.9 }]} onPress={() => router.push('/(tabs)/jv-calculator')}>
              <View style={[ds.quickIconWrap, { backgroundColor: colors.successSoft }]}>
                <Ionicons name="calculator-outline" size={20} color={colors.success} />
              </View>
              <Text style={ds.quickLabel}>JV Calc</Text>
            </Pressable>
          </View>

          {/* ── Recent listings ── */}
          {recentDeals.length > 0 && (
            <>
              <View style={ds.sectionHeader}>
                <Text style={ds.sectionTitle}>Recent Listings</Text>
                <Pressable onPress={() => router.push('/(tabs)/client-browse')}>
                  <Text style={ds.seeAll}>See all →</Text>
                </Pressable>
              </View>

              <View style={{ gap: spacing.md }}>
                {recentDeals.map((deal) => {
                  const cover = coverOf(deal);
                  const ss    = clientStatusStyle(deal.status || '');
                  const loc   = [deal.address?.city, deal.address?.state].filter(Boolean).join(', ') || deal.title || '—';
                  const assignFee    = Number((deal as any).assignmentFee) > 0 ? Number((deal as any).assignmentFee) : 0;
                  const displayPrice = Number(deal.price || 0) + assignFee;
                  const published    = formatPublishedDate(deal);
                  return (
                    <Pressable
                      key={deal.id}
                      style={({ pressed }) => [ds.recentCard, pressed && { opacity: 0.92 }]}
                      onPress={() => router.push({ pathname: '/properties/[id]', params: { id: deal.id } })}
                    >
                      {cover ? (
                        <ExpoImage source={{ uri: cover }} style={ds.recentImg} contentFit="cover" transition={200} cachePolicy="memory-disk" />
                      ) : (
                        <View style={[ds.recentImg, ds.recentImgFallback]}>
                          <Ionicons name="home-outline" size={28} color={colors.border} />
                        </View>
                      )}
                      <View style={ds.recentInfo}>
                        <View style={ds.recentTopRow}>
                          <Text style={ds.recentPrice}>
                            {displayPrice > 0 ? `$${displayPrice.toLocaleString('en-US')}` : '—'}
                          </Text>
                          <View style={[ds.recentBadge, { backgroundColor: ss.bg }]}>
                            <Text style={[ds.recentBadgeText, { color: ss.text }]}>
                              {(deal.status || 'PUBLISHED').toUpperCase()}
                            </Text>
                          </View>
                        </View>
                        <Text style={ds.recentLoc} numberOfLines={1}>{loc}</Text>
                        {(deal.bedrooms != null || deal.bathrooms != null) && (
                          <Text style={ds.recentMeta}>
                            {[
                              deal.bedrooms  != null && `${deal.bedrooms} bd`,
                              deal.bathrooms != null && `${deal.bathrooms} ba`,
                            ].filter(Boolean).join('  ·  ')}
                          </Text>
                        )}
                        {published && (
                          <Text style={ds.recentMeta}>
                            <Text style={ds.recentPublishedLabel}>Published: </Text>
                            {published}
                          </Text>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {/* ── Investment highlights ── */}
          <View style={ds.highlightsCard}>
            <View style={ds.highlightsHeader}>
              <View style={ds.highlightsIconWrap}>
                <Ionicons name="bulb-outline" size={18} color={colors.primaryAccent} />
              </View>
              <Text style={ds.highlightsTitle}>What's in every deal</Text>
            </View>
            <Text style={ds.highlightsBody}>
              Every listing is reviewed by our team and includes full financial projections so you can invest with confidence.
            </Text>
            <View style={ds.highlightsList}>
              {[
                { icon: 'shield-checkmark-outline' as IoniconName, text: 'Verified & reviewed listings',           color: colors.success },
                { icon: 'cash-outline'             as IoniconName, text: 'Creative & seller financing options',    color: '#7C3AED'       },
                { icon: 'home-outline'             as IoniconName, text: 'Turnkey fully-furnished properties',     color: colors.primary  },
                { icon: 'trending-up-outline'      as IoniconName, text: 'Revenue projections across 5 tiers',    color: colors.warning  },
                { icon: 'calculator-outline'       as IoniconName, text: 'Tax savings & income reduction data',    color: '#0891B2'       },
              ].map((item) => (
                <View key={item.icon} style={ds.highlightRow}>
                  <View style={[ds.highlightDot, { backgroundColor: item.color + '22', borderColor: item.color + '44' }]}>
                    <Ionicons name={item.icon} size={14} color={item.color} />
                  </View>
                  <Text style={ds.highlightText}>{item.text}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── Deal types explainer ── */}
          <Text style={ds.h2}>Types of deals available</Text>
          <View style={{ gap: spacing.md }}>
            {[
              {
                icon:  'key-outline'            as IoniconName,
                title: 'Subject-to & Seller Finance',
                body:  'Take over existing mortgages or negotiate seller-financed terms for lower entry costs.',
                color: '#7C3AED',
                bg:    '#F3F0FF',
              },
              {
                icon:  'home'                   as IoniconName,
                title: 'Turnkey Fully Furnished',
                body:  'Move-in ready STR properties — already set up, furnished, and in some cases already operating.',
                color: colors.success,
                bg:    '#ECFDF5',
              },
              {
                icon:  'people-outline'         as IoniconName,
                title: '50/50 Joint Venture',
                body:  'Partner with the submitter — split costs and profits 50/50 on high-potential deals.',
                color: '#3B82F6',
                bg:    '#EAF1FF',
              },
              {
                icon:  'pricetag-outline'       as IoniconName,
                title: 'Discounted Properties',
                body:  'Below-market deals sourced directly — buy at a discount for instant equity.',
                color: colors.danger,
                bg:    '#FFF1F2',
              },
            ].map((item) => (
              <Pressable
                key={item.icon}
                style={({ pressed }) => [ds.dealTypeCard, pressed && { opacity: 0.93 }]}
                onPress={() => router.push('/(tabs)/client-browse')}
              >
                <View style={[ds.dealTypeIcon, { backgroundColor: item.bg }]}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ds.dealTypeTitle}>{item.title}</Text>
                  <Text style={ds.dealTypeBody}>{item.body}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

// ─── Client dashboard styles ─────────────────────────────────────────────────

const makeDsStyles = (colors: ThemeColors) => StyleSheet.create({
  screen:     { flex: 1, backgroundColor: colors.bgAlt },

  loaderWrap: { alignItems: 'center', justifyContent: 'center' },
  loaderImg:  { width: 130, height: 130 },
  loaderText: { ...typography.body, color: colors.textMuted, marginTop: spacing.lg },

  // Hero
  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  heroBlobTop:    { position: 'absolute', top: -56, right: -44, width: 168, height: 168, borderRadius: 84, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroBlobBottom: { position: 'absolute', bottom: -64, left: -36, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.06)' },
  eyebrow:      { ...typography.tiny, color: 'rgba(255,255,255,0.65)', letterSpacing: 2, marginBottom: spacing.xs },
  heroGreeting: { ...typography.h3, color: 'rgba(255,255,255,0.75)', fontWeight: '400' },
  heroName:     { ...typography.display, color: colors.textOnPrimary, marginBottom: spacing.sm },
  heroSubtitle: { ...typography.body, color: 'rgba(255,255,255,0.85)', lineHeight: 21 },

  badgesRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  accessBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  accessBadgeText: { ...typography.tiny, fontWeight: '700' },

  // Floating stats card — overlaps the hero's lower edge for a premium, layered feel.
  statsFloat:        { flexDirection: 'row', backgroundColor: colors.bg, marginHorizontal: spacing.lg, marginTop: -spacing.xxl, borderRadius: radius.lg, paddingVertical: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadows.cardStrong },
  statFloatItem:     { flex: 1, alignItems: 'center' },
  statFloatDivider:  { width: 1, backgroundColor: colors.border, marginVertical: 6 },
  statFloatVal:      { fontSize: 24, fontWeight: '800', color: colors.primary, letterSpacing: -0.5 },
  statFloatLbl:      { ...typography.tiny, color: colors.textMuted, marginTop: 3, letterSpacing: 0.6, textTransform: 'uppercase' },

  content: { paddingHorizontal: spacing.lg },

  // Browse CTA
  browseCta: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.primaryAccent, borderRadius: radius.lg,
    padding: spacing.lg, marginTop: spacing.lg, ...shadows.primaryButton,
  },
  browseCtaIconWrap: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  browseCtaTitle:    { ...typography.bodyStrong, color: '#fff' },
  browseCtaSub:      { ...typography.caption, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  // Quick actions
  quickRow:     { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  quickCard:    { flex: 1, backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', gap: spacing.sm, ...shadows.card },
  quickIconWrap:{ width: 46, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  quickLabel:   { ...typography.captionStrong, color: colors.text, textAlign: 'center' },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: spacing.md },
  sectionTitle:  { ...typography.h2, color: colors.text },
  seeAll:        { ...typography.bodyStrong, color: colors.primaryAccent },

  // Recent deal cards
  recentCard:       { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.lg, overflow: 'hidden', ...shadows.card },
  recentImg:        { width: 96, height: 86 },
  recentImgFallback:{ alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgAlt },
  recentInfo:       { flex: 1, padding: spacing.md, gap: 4 },
  recentTopRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recentPrice:      { ...typography.bodyStrong, color: colors.primary, fontSize: 16 },
  recentBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  recentBadgeText:  { ...typography.tiny, fontWeight: '700', letterSpacing: 0.3 },
  recentLoc:        { ...typography.caption, color: colors.text },
  recentMeta:       { ...typography.tiny, color: colors.textMuted },
  recentPublishedLabel: { fontWeight: '700', color: colors.text },

  // Highlights card
  highlightsCard:    { backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.xl, ...shadows.card, borderWidth: 1, borderColor: colors.border },
  highlightsHeader:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  highlightsIconWrap:{ width: 34, height: 34, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  highlightsTitle:   { ...typography.h3, color: colors.text },
  highlightsBody:    { ...typography.body, color: colors.textMuted, lineHeight: 22, marginBottom: spacing.md },
  highlightsList:    { gap: spacing.sm },
  highlightRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  highlightDot:      { width: 30, height: 30, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  highlightText:     { ...typography.body, color: colors.text, flex: 1 },

  // Deal types
  h2:           { ...typography.h2, color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  dealTypeCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.bg, borderRadius: radius.lg, ...shadows.card },
  dealTypeIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  dealTypeTitle:{ ...typography.bodyStrong, color: colors.text },
  dealTypeBody: { ...typography.caption, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
});
