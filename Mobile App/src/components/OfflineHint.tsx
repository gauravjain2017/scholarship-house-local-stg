import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useNetwork } from '@/context/NetworkContext';
import { useThemedStyles, type ThemeColors } from '@/context/ThemeContext';
import { spacing, typography } from '@/theme';

/**
 * Inline caption rendered beneath a submit button while the device is offline.
 * Pairs with disabling the button (`useNetwork().isOffline`) so the user sees
 * why the action is unavailable, alongside the global OfflineBanner.
 */
export function OfflineHint({
  message = "You're offline — connect to the internet to continue.",
}: {
  message?: string;
}) {
  const { isOffline } = useNetwork();
  const styles = useThemedStyles(makeStyles);
  if (!isOffline) return null;
  return <Text style={styles.hint}>{message}</Text>;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    hint: {
      ...typography.caption,
      color: colors.danger,
      textAlign: 'center',
      marginTop: spacing.md,
    },
  });
