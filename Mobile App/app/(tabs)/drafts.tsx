import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DraftsList } from '@/components/property-form/DraftsList';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useNotificationsHeader } from '@/hooks/useNotificationsHeader';
import { spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';
import type { Draft } from '@/types';

/**
 * Standalone "Drafts" tab. Reuses the same `DraftsList` component the form
 * and Profile screen render — so the title / "Step X of Y · Last saved …" /
 * Resume + Delete layout is identical across the app.
 *
 * Tapping Resume navigates to the property form with `?resumeDraftId=<id>`,
 * which causes the form to fetch the draft and open at the saved step.
 */
export default function DraftsScreen() {
  const router = useRouter();
  const headerBell = useNotificationsHeader();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Drafts"
        subtitle="Resume your work in progress"
        iconName="document-text-outline"
        onProfilePress={() => router.push('/(tabs)/profile')}
        {...headerBell}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          <DraftsList
            activeDraftId={null}
            onResume={(draft: Draft) =>
              router.push({
                pathname: '/(tabs)/submit',
                params: { resumeDraftId: draft.id },
              })
            }
            emptyState={
              <Card padding="lg" style={styles.emptyCard}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="document-text-outline" size={36} color={colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>No drafts yet</Text>
                <Text style={styles.emptyBody}>
                Your saved property drafts will appear here. Start creating a property listing and save it as a draft to continue editing anytime before submission.
                </Text>
                <Button
                  title="Add a property"
                  onPress={() => router.push('/(tabs)/submit')}
                  style={styles.emptyCta}
                />
              </Card>
            }
          />
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgAlt },
  content: { paddingBottom: spacing.xxl, paddingTop: spacing.lg },
  body: { paddingHorizontal: spacing.lg },
  emptyCard: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  emptyBody: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  emptyCta: {
    alignSelf: 'stretch',
  },
});
