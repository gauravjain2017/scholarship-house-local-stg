import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { radius, shadows, spacing } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface NavItem {
  href: string;
  label: string;
  icon: IoniconsName;
  iconActive: IoniconsName;
  isActive: (path: string) => boolean;
}

/**
 * Top navigation icons — mirrors the bottom nav so the four core
 * destinations are reachable from the top of the screen. Designed to be
 * rendered ABOVE the scrollable content so it stays "fixed" while the
 * page scrolls.
 *
 * Usage:
 *   <View style={{ flex: 1 }}>
 *     <TopNav />
 *     <ScrollView>...</ScrollView>
 *   </View>
 *
 * The component pads itself with the status-bar safe-area inset, so the
 * page below it does NOT need to add `insets.top` again.
 */
const ITEMS: NavItem[] = [
  {
    href: '/(tabs)',
    label: 'Home',
    icon: 'home-outline',
    iconActive: 'home',
    isActive: (p) => p === '/' || p === '/(tabs)' || p === '/(tabs)/index',
  },
  {
    href: '/(tabs)/browse',
    label: 'Browse',
    icon: 'business-outline',
    iconActive: 'business',
    isActive: (p) => p.includes('/browse'),
  },
  {
    href: '/(tabs)/submit',
    label: 'Submit',
    icon: 'add-circle-outline',
    iconActive: 'add-circle',
    isActive: (p) =>
      p.includes('/(tabs)/submit') ||
      p.includes('/properties/new') ||
      p.includes('/properties/edit'),
  },
  {
    href: '/(tabs)/profile',
    label: 'Profile',
    icon: 'person-outline',
    iconActive: 'person',
    isActive: (p) => p.includes('/profile'),
  },
];

export function TopNav() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        {ITEMS.map((item) => {
          const active = item.isActive(pathname);
          return (
            <Pressable
              key={item.href}
              onPress={() => router.push(item.href as any)}
              style={styles.iconBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={active ? styles.iconFocused : styles.iconIdle}>
                <Ionicons
                  name={active ? item.iconActive : item.icon}
                  size={22}
                  color={active ? colors.primary : colors.textMuted}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Total height the TopNav occupies — useful if a parent needs to offset
 *  positioned children. The actual rendered height = TOP_NAV_HEIGHT + insets.top. */
export const TOP_NAV_HEIGHT = 56;

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  bar: {
    backgroundColor: colors.bg,
    zIndex: 10,
    ...shadows.cardStrong,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    minHeight: TOP_NAV_HEIGHT,
  },
  iconBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  iconIdle: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  iconFocused: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
});
