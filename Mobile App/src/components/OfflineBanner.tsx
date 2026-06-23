import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNetwork } from '@/context/NetworkContext';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';
import { spacing, typography } from '@/theme';

/**
 * Lightweight "You're offline" banner. Mounted once at the app root; it pins
 * to the top under the status bar and only renders while the device is
 * offline. Submit-style actions across the app are separately disabled via
 * `useNetwork()`.
 */
export function OfflineBanner() {
  const { isOffline } = useNetwork();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  if (!isOffline) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xs }]}>
      <Ionicons name="cloud-offline-outline" size={16} color={colors.textOnPrimary} />
      <Text style={styles.text}>You're offline — some actions are unavailable</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingBottom: spacing.sm,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.danger,
    },
    text: {
      ...typography.captionStrong,
      color: colors.textOnPrimary,
    },
  });
