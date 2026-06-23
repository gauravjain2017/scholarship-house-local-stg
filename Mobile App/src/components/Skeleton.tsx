import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';
import { radius, shadows, spacing } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

/**
 * A single shimmering placeholder block. Pulses its opacity on a loop so a
 * loading screen reads as "content is coming" instead of a bare spinner.
 *
 * Uses the RN Animated API with `useNativeDriver` (opacity only) so it stays
 * smooth without pulling in reanimated, and works identically in Expo Go and
 * release APKs.
 */
export function Skeleton({
  width = '100%',
  height,
  radius: r = radius.sm,
  style,
}: {
  width?: ViewStyle['width'];
  height: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius: r, backgroundColor: colors.border, opacity }, style]}
    />
  );
}

/** Placeholder matching the image-on-top listing card while data loads. */
export function PropertyCardSkeleton() {
  const sk = useThemedStyles(makeStyles);
  return (
    <View style={sk.card}>
      <Skeleton width="100%" height={180} radius={0} />
      <View style={sk.body}>
        <Skeleton width="85%" height={16} />
        <Skeleton width="55%" height={12} style={{ marginTop: 10 }} />
        <View style={sk.chips}>
          <Skeleton width={72} height={22} radius={radius.pill} />
          <Skeleton width={72} height={22} radius={radius.pill} />
          <Skeleton width={92} height={22} radius={radius.pill} />
        </View>
        <Skeleton width="45%" height={12} style={{ marginTop: 14 }} />
      </View>
    </View>
  );
}

/** A padded column of card skeletons for list screens. */
export function PropertyListSkeleton({ count = 4 }: { count?: number }) {
  const sk = useThemedStyles(makeStyles);
  return (
    <View style={sk.list}>
      {Array.from({ length: count }).map((_, i) => (
        <PropertyCardSkeleton key={i} />
      ))}
    </View>
  );
}

/** Placeholder for the property detail page (header + hero + body blocks). */
export function PropertyDetailSkeleton() {
  const sk = useThemedStyles(makeStyles);
  return (
    <View style={sk.detail}>
      <Skeleton width="100%" height={62} radius={0} />
      <Skeleton width="100%" height={230} radius={0} />
      <View style={sk.detailBody}>
        <Skeleton width="70%" height={22} />
        <Skeleton width="50%" height={14} style={{ marginTop: 10 }} />
        <Skeleton width="40%" height={26} style={{ marginTop: 18 }} />
        <View style={sk.detailRow}>
          <Skeleton width="48%" height={72} radius={radius.md} />
          <Skeleton width="48%" height={72} radius={radius.md} />
        </View>
        <Skeleton width="100%" height={130} radius={radius.md} style={{ marginTop: spacing.md }} />
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  body: { padding: spacing.lg },
  chips: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  detail: { flex: 1, backgroundColor: colors.bg },
  detailBody: { padding: spacing.lg },
  detailRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
});
