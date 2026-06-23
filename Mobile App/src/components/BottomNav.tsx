import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { shadows, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface NavTab {
  href: string;
  label: string;
  icon: IoniconsName;
  iconActive: IoniconsName;
  isActive: (path: string) => boolean;
  submitterOnly?: boolean;
  clientOnly?: boolean;
}

export function BottomNav() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const isClient = String(user?.userType ?? '').toLowerCase() === 'client';
  const bottomPad = Math.max(insets.bottom, 6);

  // Browse goes to the user's own listings page (submitter) or the public
  // listings page (client) so the tab matches what the (tabs) layout shows.
  const browseHref = isClient ? '/(tabs)/client-browse' : '/(tabs)/browse';

  const TABS: NavTab[] = [
    {
      href: '/(tabs)',
      label: 'Home',
      icon: 'home-outline',
      iconActive: 'home',
      isActive: (p) => p === '/' || p === '/(tabs)' || p === '/(tabs)/index',
    },
    {
      href: browseHref,
      label: 'Browse',
      icon: 'business-outline',
      iconActive: 'business',
      isActive: (p) => p.includes('/browse'),
    },
    {
      href: '/(tabs)/client-favorites',
      label: 'Favorites',
      icon: 'star-outline',
      iconActive: 'star',
      isActive: (p) => p.includes('/client-favorites'),
      clientOnly: true,
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
      submitterOnly: true,
    },
    {
      href: '/(tabs)/jv-calculator',
      label: 'JV Calc',
      icon: 'calculator-outline',
      iconActive: 'calculator',
      isActive: (p) => p.includes('/jv-calculator'),
      clientOnly: true,
    },
    {
      href: '/(tabs)/profile',
      label: 'Profile',
      icon: 'person-outline',
      iconActive: 'person',
      isActive: (p) => p.includes('/profile'),
    },
  ];

  const visibleTabs = TABS.filter(
    (t) => !(t.submitterOnly && isClient) && !(t.clientOnly && !isClient),
  );

  return (
    <View style={[styles.bar, { paddingBottom: bottomPad }]}>
      {visibleTabs.map((t) => {
        const active = t.isActive(pathname);
        return (
          <Pressable
            key={t.href}
            onPress={() => router.push(t.href as any)}
            style={styles.tab}
          >
            <Ionicons
              name={active ? t.iconActive : t.icon}
              size={24}
              color={active ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.label, { color: active ? colors.primary : colors.textMuted }]}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const BOTTOM_NAV_HEIGHT = 64;

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    minHeight: BOTTOM_NAV_HEIGHT,
    paddingTop: 6,
    ...shadows.cardStrong,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  label: {
    ...typography.tiny,
    fontWeight: '600',
  },
});
