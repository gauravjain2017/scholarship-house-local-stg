import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shadows } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface TabIconProps {
  name: IoniconsName;
  color: string;
}

const TabIcon = ({ name, color }: TabIconProps) => (
  <Ionicons name={name} size={24} color={color} />
);

export default function TabsLayout() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  // Reserve space for the OS gesture bar / home indicator on every device
  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: [styles.tabBar, { height: 56 + bottomPad, paddingBottom: bottomPad }],
        tabBarItemStyle: { paddingTop: 6 },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: 'Browse',
          href: user?.userType === 'client' ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'business' : 'business-outline'}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="client-browse"
        options={{
          title: 'Browse',
          href: user?.userType === 'client' ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'business' : 'business-outline'}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="client-favorites"
        options={{
          title: 'Favorites',
          href: user?.userType === 'client' ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'star' : 'star-outline'} color={color} />
          ),
        }}
      />
      {/* Submit is a real tab that renders the property-creation wizard
          directly (see app/(tabs)/submit.tsx). No trampoline / push — the
          tab bar stays put and back-navigation isn't needed. */}
      <Tabs.Screen
        name="submit"
        options={{
          title: 'Submit',
          href: user?.userType === 'client' ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name={focused ? 'add-circle' : 'add-circle-outline'}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="jv-calculator"
        options={{
          title: 'JV Calc',
          href: user?.userType === 'client' ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'calculator' : 'calculator-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'person' : 'person-outline'} color={color} />
          ),
        }}
      />
      {/* Drafts route stays mounted but isn't shown in the tab bar — still accessible
          from the Profile menu's "My drafts" link and from `/(tabs)/drafts`. */}
      <Tabs.Screen
        name="drafts"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bg,
    borderTopColor: 'transparent',
    ...shadows.cardStrong,
  },
});
