import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { radius, shadows, spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

interface SearchBarProps {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  /** Show on a dark/colored background (adds shadow + opaque bg) */
  floating?: boolean;
}

/**
 * Rounded search input with leading magnifier icon.
 */
export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search...',
  onSubmit,
  floating = false,
}: SearchBarProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.wrap, floating && shadows.cardStrong]}>
      <Text style={styles.icon}>⌕</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    height: 48,
  },
  icon: {
    fontSize: 22,
    color: colors.textMuted,
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: 0,
  },
});
