import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography } from '@/theme';
import { useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

interface YesNoRowProps {
  label: string;
  /** 'yes' | 'no' | '' */
  value: string;
  onChange: (value: 'yes' | 'no') => void;
  required?: boolean;
  error?: string;
}

/**
 * Yes/No radio row — mirrors the inline `yesNo()` helper used across the
 * submitter's RentalDataSection / FinancialInformationSection. Used for the
 * conditional gates (operating-as-STR, has-financials, has-primary-mortgage…).
 */
export function YesNoRow({ label, value, onChange, required, error }: YesNoRowProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <View style={styles.row}>
        {(['yes', 'no'] as const).map((opt) => {
          const selected = value === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <View style={[styles.dot, selected && styles.dotSelected]}>
                {selected ? <View style={styles.dotInner} /> : null}
              </View>
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                {opt === 'yes' ? 'Yes' : 'No'}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: {
    ...typography.captionStrong,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    letterSpacing: 0.2,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgAlt,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  dotSelected: { borderColor: colors.primary },
  dotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  optionText: { ...typography.body, color: colors.text },
  optionTextSelected: { color: colors.primary, fontWeight: '600' },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});
