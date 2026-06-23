import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useNotificationsHeader } from '@/hooks/useNotificationsHeader';
import { useAuth } from '@/context/AuthContext';
import { getMySubmissions } from '@/api/deals';
import { radius, shadows, spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

type IoniconNameLocal = React.ComponentProps<typeof Ionicons>['name'];

// ─── Submitter Dashboard ──────────────────────────────────────────────────────

export function SubmitterDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const headerBell = useNotificationsHeader();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const { data, isPending: submissionsPending } = useQuery({
    queryKey: ['my-submissions'],
    queryFn: getMySubmissions,
  });

  const submissionsThisMonth = (data ?? []).filter((p) => {
    const dt = (p as any).submittedAt || (p as any).createdAt;
    if (!dt) return false;
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  // Status breakdown for the "Submission overview" card. "Active" combines
  // approved + published to mirror the client interface (where a published or
  // approved listing is considered Active).
  const subs = data ?? [];
  const statusOfSub = (p: unknown) => String((p as any).status || '').toLowerCase();
  const countTotal    = subs.length;
  const countPending  = subs.filter((p) => statusOfSub(p) === 'pending').length;
  const countActive   = subs.filter((p) => ['approved', 'published'].includes(statusOfSub(p))).length;
  const countRejected = subs.filter((p) => statusOfSub(p) === 'rejected').length;
  const countSold     = subs.filter((p) => statusOfSub(p) === 'sold').length;

  const displayName =
    user?.name?.trim() || user?.email?.split('@')[0] || 'submitter';

  return (
    <View style={styles.screen}>

      <ScreenHeader
        title="Scholarship House"
        subtitle="Deal Submissions"
        iconSource={require('../../assets/icon.png')}
        onProfilePress={() => router.push('/(tabs)/profile')}
        {...headerBell}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxl * 2 }}
      >
        {/* Welcome hero — premium card with accent strip + stat */}
        <View style={styles.hero}>
          <View style={styles.heroAccent} />
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>WELCOME BACK</Text>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {displayName}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>THIS MONTH</Text>
              {submissionsPending ? (
                <ActivityIndicator color={colors.primary} style={styles.statSpinner} />
              ) : (
                <>
                  <Text style={styles.statValue}>{submissionsThisMonth}</Text>
                  <Text style={styles.statSub}>
                    submission{submissionsThisMonth === 1 ? '' : 's'}
                  </Text>
                </>
              )}
            </View>
          </View>

          <Text style={styles.heroSubtitle}>
            Submit short-term rental opportunities, track approvals, and watch your
            listings go live — all in one place.
          </Text>

          <View style={styles.heroCtaRow}>
            <Button
              title="Submit"
              onPress={() => router.push('/properties/new')}
              style={styles.heroCta}
            />
            <Button
              title="My Listings"
              variant="secondary"
              onPress={() => router.push('/(tabs)/browse')}
              style={styles.heroCta}
            />
          </View>
        </View>

        <View style={styles.content}>
          {/* Submission overview — status breakdown (mirrors My Properties) */}
          <Card padding="lg" style={{ marginTop: spacing.xl }}>
            <Text style={styles.sectionTitle}>Submission overview</Text>
            <Text style={styles.sectionLead}>Track every listing you&apos;ve submitted, by status.</Text>

            {submissionsPending ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
            ) : (
              <>
                <Pressable
                  onPress={() => router.push({ pathname: '/(tabs)/browse', params: { status: 'all', t: String(Date.now()) } })}
                  style={({ pressed }) => [styles.totalTile, pressed && { opacity: 0.92 }]}
                >
                  <View style={styles.totalIconChip}>
                    <Ionicons name="albums-outline" size={20} color={colors.textOnPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.totalNum}>{countTotal}</Text>
                    <Text style={styles.totalLabel}>Total submission{countTotal === 1 ? '' : 's'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
                </Pressable>

                <View style={styles.statGrid}>
                  {[
                    { key: 'pending',  label: 'Pending',  value: countPending,  filter: 'pending',   icon: 'time-outline'             as IoniconNameLocal, color: colors.warning },
                    { key: 'active',   label: 'Active',   value: countActive,   filter: 'active',    icon: 'checkmark-circle-outline' as IoniconNameLocal, color: colors.success },
                    { key: 'rejected', label: 'Rejected', value: countRejected, filter: 'rejected',  icon: 'close-circle-outline'     as IoniconNameLocal, color: colors.danger  },
                    { key: 'sold',     label: 'Sold',     value: countSold,     filter: 'sold',      icon: 'pricetag-outline'         as IoniconNameLocal, color: '#7C3AED'      },
                  ].map((s) => (
                    <Pressable
                      key={s.key}
                      onPress={() => router.push({ pathname: '/(tabs)/browse', params: { status: s.filter, t: String(Date.now()) } })}
                      style={({ pressed }) => [
                        styles.statTile,
                        { backgroundColor: s.color + '14', borderColor: s.color + '33' },
                        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                      ]}
                    >
                      <View style={[styles.statIconChip, { backgroundColor: s.color + '26' }]}>
                        <Ionicons name={s.icon} size={18} color={s.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.statTileNum, { color: s.color }]}>{s.value}</Text>
                        <Text style={styles.statTileLabel}>{s.label}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </Card>

          {/* How this platform works */}
          <Card padding="lg" style={{ marginTop: spacing.xl }}>
            <Text style={styles.sectionTitle}>How this platform works</Text>
            <Text style={styles.sectionLead}>
              This platform showcases short-term rental investment opportunities submitted
              by vetted partners. Each property is reviewed before being published.
            </Text>

            <View style={styles.featureRow}>
              <FeatureTile
                icon="flash"
                title="Submit fast"
                body="Add a property in under 5 minutes."
              />
              <FeatureTile
                icon="shield-checkmark"
                title="Get reviewed"
                body="Our team verifies every listing."
              />
              <FeatureTile
                icon="trending-up"
                title="Go live"
                body="Approved listings reach investors."
              />
            </View>
          </Card>

          {/* Submit investment opportunities */}
          <Text style={styles.h2}>Submit investment opportunities</Text>
          <View style={{ gap: spacing.md }}>
            <ActionTile
              icon="document-text"
              title="Create new property submissions"
              body="Submit short-term rental opportunities for review and approval."
              onPress={() => router.push('/properties/new')}
            />
            <ActionTile
              icon="list"
              title="Track submission status"
              body="Monitor whether your listings are pending, approved, or published."
              onPress={() => router.push('/(tabs)/browse')}
            />
            <ActionTile
              icon="bookmark"
              title="Resume a draft"
              body="Pick up where you left off — drafts auto-save your progress."
              onPress={() => router.push('/(tabs)/drafts')}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function FeatureTile({ icon, title, body }: { icon: IoniconNameLocal; title: string; body: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.featureTile}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureBody}>{body}</Text>
      </View>
    </View>
  );
}

function ActionTile({
  icon,
  title,
  body,
  onPress,
}: {
  icon: IoniconNameLocal;
  title: string;
  body: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionTile, pressed && { transform: [{ scale: 0.99 }] }]}
    >
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionBody}>{body}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

// ─── Submitter styles ────────────────────────────────────────────────────────

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgAlt },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },

  hero: {
    position: 'relative',
    backgroundColor: colors.bg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  heroAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 4,
    bottom: 0,
    backgroundColor: colors.primary,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  heroEyebrow: {
    ...typography.captionStrong,
    color: colors.primary,
    letterSpacing: 1.8,
    fontSize: 11,
  },
  heroTitle: {
    ...typography.h1,
    color: colors.text,
    marginTop: spacing.xs,
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
    lineHeight: 21,
  },
  heroCtaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  heroCta: { flex: 1 },

  statCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 84,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DEE8FF',
  },
  statLabel: {
    ...typography.tiny,
    color: colors.primary,
    letterSpacing: 1.2,
    fontSize: 10,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 2,
    letterSpacing: -0.8,
    lineHeight: 32,
  },
  statSpinner: {
    marginTop: 4,
    height: 32,
  },
  statSub: {
    ...typography.tiny,
    color: colors.primary,
    opacity: 0.75,
  },

  content: { paddingHorizontal: spacing.lg },

  sectionTitle: { ...typography.h2, color: colors.text },
  sectionLead:  { ...typography.body, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },

  featureRow: { flexDirection: 'column', gap: spacing.sm },
  featureTile: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.bgAlt, borderRadius: radius.md, padding: spacing.md,
  },
  featureIcon:  { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { ...typography.bodyStrong, color: colors.text },
  featureBody:  { ...typography.caption, color: colors.textMuted, marginTop: 2 },

  h2: { ...typography.h2, color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  actionTile: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.lg, backgroundColor: colors.bg, borderRadius: radius.lg, ...shadows.card,
  },
  actionTitle: { ...typography.bodyStrong, color: colors.text },
  actionBody:  { ...typography.caption, color: colors.textMuted, marginTop: 2 },

  // Submission overview
  totalTile: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg,
    marginTop: spacing.md, ...shadows.primaryButton,
  },
  totalIconChip: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  totalNum:      { fontSize: 28, fontWeight: '800', color: colors.textOnPrimary, letterSpacing: -0.6, lineHeight: 32 },
  totalLabel:    { ...typography.caption, color: 'rgba(255,255,255,0.85)', marginTop: 1 },

  statGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  statTile: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    flexGrow: 1, flexBasis: '47%', minWidth: 140,
    borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statIconChip:  { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  statTileNum:   { fontSize: 24, fontWeight: '800', letterSpacing: -0.6, lineHeight: 27 },
  statTileLabel: { ...typography.tiny, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 1 },
});
