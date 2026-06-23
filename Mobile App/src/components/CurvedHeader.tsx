import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, typography } from '@/theme';
import { useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

interface CurvedHeaderProps {
  title?: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode;
  /** Extra content rendered inside the header (search bar, stats, etc.) */
  children?: React.ReactNode;
  /** Pull a bottom bleed (e.g. a search bar) below the curve */
  bleedHeight?: number;
}

/**
 * Navy hero header with a rounded bottom edge.
 * Used at the top of authenticated screens.
 */
export function CurvedHeader({
  title,
  subtitle,
  leftElement,
  rightElement,
  children,
  bleedHeight = 0,
}: CurvedHeaderProps) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + spacing.md,
          paddingBottom: bleedHeight ? bleedHeight + spacing.lg : spacing.xl,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.sideSlot}>{leftElement}</View>
        <View style={styles.titleWrap}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={[styles.sideSlot, { alignItems: 'flex-end' }]}>{rightElement}</View>
      </View>

      {children ? <View style={{ marginTop: spacing.lg }}>{children}</View> : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  wrap: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideSlot: { width: 40 },
  titleWrap: { flex: 1, alignItems: 'center' },
  title: {
    ...typography.h2,
    color: colors.textOnPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
});
