import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

interface CollapsibleProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * Animated accordion-style section used for "Market Motivation & Travel Drivers"
 * and "Amenities, Attractions & Tags" — mirrors the admin's <details> blocks.
 */
export function Collapsible({ title, subtitle, defaultOpen = false, children }: CollapsibleProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={[styles.wrap, open && styles.wrapOpen]}>
      <Pressable
        onPress={() => setOpen(!open)}
        style={({ pressed }) => [styles.header, pressed && { backgroundColor: colors.primarySoft }]}
      >
        <Ionicons
          name={open ? 'chevron-down' : 'chevron-forward'}
          size={16}
          color={colors.primary}
        />
        <Text style={styles.title}>{title}</Text>
      </Pressable>

      {open ? (
        <View style={styles.body}>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {children}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  wrap: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
  wrapOpen: {
    borderColor: colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.bg,
  },
  title: { ...typography.bodyStrong, color: colors.primary, flex: 1 },
  body: {
    paddingHorizontal: spacing.md,
    paddingTop: 0,
    paddingBottom: spacing.md,
    backgroundColor: colors.bgAlt,
  },
  subtitle: {
    ...typography.caption,
    color: colors.primaryAccent,
    marginVertical: spacing.sm,
  },
});
