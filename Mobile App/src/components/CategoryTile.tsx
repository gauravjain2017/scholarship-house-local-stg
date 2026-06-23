import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, shadows, spacing, typography } from '@/theme';
import { useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

interface CategoryTileProps {
  label: string;
  imageUri?: string;
  emoji?: string;
  onPress?: () => void;
}

/**
 * Category card — image / emoji on top, label pill on the bottom.
 * Used in horizontal scrolls like "Popular Categories".
 */
export function CategoryTile({ label, imageUri, emoji = '🏠', onPress }: CategoryTileProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && { transform: [{ scale: 0.97 }] }]}
    >
      <View style={styles.imageWrap}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        ) : (
          <Text style={styles.emoji}>{emoji}</Text>
        )}
        <View style={styles.labelPill}>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  wrap: {
    width: 120,
    height: 140,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.card,
  },
  imageWrap: {
    flex: 1,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%', position: 'absolute' },
  emoji: { fontSize: 56 },
  labelPill: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  label: {
    ...typography.tiny,
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
});
