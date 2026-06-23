import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { radius, shadows, spacing, typography } from '@/theme';
import { useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

interface FilterChipRowProps {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  paddingHorizontal?: number;
}

/**
 * Horizontally-scrolling pill row: Any | Austin | Croatia | …
 * Selected chip flips to filled navy with white text.
 */
export function FilterChipRow({
  options,
  value,
  onChange,
  paddingHorizontal = spacing.lg,
}: FilterChipRowProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingHorizontal }]}
    >
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{opt}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  content: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadows.primaryButton,
  },
  label: { ...typography.captionStrong, color: colors.textSecondary },
  labelActive: { color: colors.textOnPrimary },
});
