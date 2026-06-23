import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography } from '@/theme';
import { useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

export interface ChipOption {
  value: string;
  label: string;
}

interface MultiSelectChipsProps {
  label?: string;
  options: ChipOption[];
  value: string[];
  onChange: (next: string[]) => void;
  error?: string;
  hint?: string;
}

/**
 * Toggleable chip grid for picking multiple options.
 * Used for `vacationRentalMarkets`, `travelMotivations`, `specialTags`.
 *
 *   <MultiSelectChips
 *     options={VACATION_RENTAL_MARKETS}
 *     value={field.value}
 *     onChange={field.onChange}
 *   />
 */
export function MultiSelectChips({
  label,
  options,
  value,
  onChange,
  error,
  hint,
}: MultiSelectChipsProps) {
  const styles = useThemedStyles(makeStyles);
  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={styles.grid}>
        {options.map((opt) => {
          const selected = value.includes(opt.value);
          return (
            <Pressable
              key={opt.value}
              onPress={() => toggle(opt.value)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              {selected ? <Text style={styles.tick}>✓ </Text> : null}
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: {
    ...typography.captionStrong,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    letterSpacing: 0.2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgAlt,
  },
  chipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  tick: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  chipText: { ...typography.captionStrong, color: colors.textSecondary },
  chipTextSelected: { color: colors.primary },
  errorText: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
  hintText: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
