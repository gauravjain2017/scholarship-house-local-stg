import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography } from '@/theme';
import { useTheme, type ThemeColors } from '@/context/ThemeContext';

export type BadgeTone = 'rent' | 'sale' | 'sold' | 'info' | 'neutral';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

const toneColorFor = (tone: BadgeTone, colors: ThemeColors): string => {
  const TONE_COLOR: Record<BadgeTone, string> = {
    rent: colors.badgeRent,
    sale: colors.badgeSale,
    sold: colors.badgeSold,
    info: colors.primaryAccent,
    neutral: colors.text,
  };
  return TONE_COLOR[tone];
};

/**
 * Small pill label, e.g. "Rent" / "For Sale" / "Sold" on listing cards.
 */
export function Badge({ label, tone = 'rent' }: BadgeProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: toneColorFor(tone, colors) }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  text: {
    ...typography.tiny,
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
