import React from 'react';
import { Image, ImageSourcePropType, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { radius, shadows, spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface ScreenHeaderProps {
  /** Big title shown on the left, e.g. "Scholarship House". */
  title: string;
  /** Optional caption rendered under the title in muted text. */
  subtitle?: string;
  /** Optional leading glyph rendered inside a soft tinted square next to the title. */
  iconName?: IoniconsName;
  /** Optional leading image (e.g. app logo) rendered in place of `iconName`. Takes precedence over `iconName`. */
  iconSource?: ImageSourcePropType;
  /** When provided, renders a back-chevron pressable on the left in place of the icon. */
  onBack?: () => void;
  /** Tap the person avatar on the right. Pass `undefined` to hide. */
  onProfilePress?: () => void;
  /** Tap the bell on the right. Pass `undefined` to hide. */
  onNotificationPress?: () => void;
  /** Optional unread-notification count to render as a badge over the bell. */
  notificationCount?: number;
}

/**
 * Premium, light, fixed app header used across every inner page.
 *
 * Designed to live OUTSIDE the screen's ScrollView/FlatList so it remains
 * pinned while content scrolls under it. Self-pads the status-bar safe-area
 * inset, so the parent screen does not need to add `insets.top` again.
 *
 * Two modes:
 *   - Tab mode: pass `iconName` for a tinted glyph + title + profile/bell actions.
 *   - Stack mode: pass `onBack` for a back chevron on the left.
 */
export function ScreenHeader({
  title,
  subtitle,
  iconName,
  iconSource,
  onBack,
  onProfilePress,
  onNotificationPress,
  notificationCount = 0,
}: ScreenHeaderProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  // Pull the cached avatar straight from AuthContext so every screen using
  // <ScreenHeader> picks up the user's profile photo without prop-drilling.
  // Falls back to the person icon when there's no image yet (first login,
  // user hasn't uploaded one, or the URL failed to load).
  const { user } = useAuth();
  const [avatarBroken, setAvatarBroken] = React.useState(false);
  const avatarUrl = user?.profileImage && !avatarBroken ? user.profileImage : null;
  // Reset the broken flag whenever the URL changes (e.g. after a fresh upload)
  // so a previously-failed image gets retried.
  React.useEffect(() => {
    setAvatarBroken(false);
  }, [user?.profileImage]);
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 4 }]}>
      <View style={styles.row}>
        <View style={styles.leadingGroup}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={8}
              style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
          ) : iconSource ? (
            <View style={styles.iconCircle}>
              <Image source={iconSource} style={styles.iconImage} resizeMode="contain" />
            </View>
          ) : iconName ? (
            <View style={styles.iconCircle}>
              <Ionicons name={iconName} size={20} color={colors.primary} />
            </View>
          ) : null}
          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.actions}>
          {onNotificationPress ? (
            <Pressable
              onPress={onNotificationPress}
              hitSlop={6}
              style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel={
                notificationCount > 0
                  ? `Notifications, ${notificationCount} unread`
                  : 'Notifications'
              }
            >
              <Ionicons name="notifications-outline" size={20} color={colors.text} />
              {notificationCount > 0 ? (
                <View style={styles.badge} pointerEvents="none">
                  <Text style={styles.badgeText} numberOfLines={1}>
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}
          {onProfilePress ? (
            <Pressable
              onPress={onProfilePress}
              hitSlop={6}
              style={({ pressed }) => [
                styles.profileBtn,
                avatarUrl && styles.profileBtnWithImage,
                pressed && styles.profileBtnPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Profile"
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.profileImg}
                  onError={() => setAvatarBroken(true)}
                />
              ) : (
                <Ionicons name="person" size={20} color={colors.primary} />
              )}
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** Approximate visible content height of the header (excluding safe-area inset). */
export const SCREEN_HEADER_HEIGHT = 64;

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  wrap: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    ...(Platform.OS === 'android' ? { elevation: 2 } : shadows.header),
    zIndex: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: SCREEN_HEADER_HEIGHT,
    gap: spacing.md,
  },
  leadingGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconImage: {
    width: '100%',
    height: '100%',
    borderRadius: radius.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  backBtnPressed: {
    backgroundColor: colors.border,
    transform: [{ scale: 0.96 }],
  },
  titleBlock: { flex: 1 },
  title: {
    ...typography.h2,
    color: colors.text,
    letterSpacing: -0.2,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  actionBtnPressed: {
    backgroundColor: colors.border,
    transform: [{ scale: 0.96 }],
  },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    overflow: 'hidden',
  },
  profileBtnWithImage: {
    backgroundColor: colors.bg,
    borderColor: colors.primary,
    padding: 0,
  },
  profileImg: {
    width: '100%',
    height: '100%',
    borderRadius: radius.pill,
  },
  profileBtnPressed: {
    backgroundColor: '#DDE7FF',
    transform: [{ scale: 0.96 }],
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
});
