import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

interface StarRatingProps {
  rating: number; // 0–5
  size?: number;
  showValue?: boolean;
}

/**
 * Five-star row with filled / outlined glyphs.
 * Pure text — no icon font required.
 */
export function StarRating({ rating, size = 13, showValue = false }: StarRatingProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const clamped = Math.max(0, Math.min(5, rating));
  const full = Math.round(clamped);

  return (
    <View style={styles.row}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Text
          key={i}
          style={{
            fontSize: size,
            color: i < full ? colors.star : colors.border,
            marginRight: 1,
          }}
        >
          ★
        </Text>
      ))}
      {showValue && (
        <Text style={[styles.value, { fontSize: size }]}>
          {clamped.toFixed(1)}
        </Text>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  value: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: 4,
    fontWeight: '600',
  },
});
