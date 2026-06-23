import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { radius, shadows, spacing, typography } from '@/theme';
import { useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

export interface AvatarItem {
  id: string;
  name: string;
  imageUri?: string;
}

interface AvatarRowProps {
  items: AvatarItem[];
  onItemPress?: (item: AvatarItem) => void;
}

/**
 * Horizontal row of circular agent avatars with names below.
 */
export function AvatarRow({ items, onItemPress }: AvatarRowProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {items.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => onItemPress?.(item)}
          style={styles.cell}
        >
          <View style={[styles.avatarFrame, shadows.card]}>
            {item.imageUri ? (
              <Image source={{ uri: item.imageUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.placeholder]}>
                <Text style={styles.initials}>{initialsOf(item.name)}</Text>
              </View>
            )}
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function initialsOf(name: string) {
  return name
    .split(' ')
    .map((s) => s[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join('');
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  content: { gap: spacing.lg, paddingVertical: spacing.sm },
  cell: { alignItems: 'center', width: 72 },
  avatarFrame: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    padding: 3,
  },
  avatar: { width: '100%', height: '100%', borderRadius: radius.pill },
  placeholder: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
  name: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
