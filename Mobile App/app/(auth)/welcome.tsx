import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { StarRating } from '@/components/StarRating';
import { radius, spacing, typography } from '@/theme';
import { useThemedStyles, type ThemeColors } from '@/context/ThemeContext';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from 'react-native';
/**
 * First-launch welcome screen — logo, tagline, CTA.
 * Mirrors the "Perfect Choice For Your Future" template.
 */
export default function WelcomeScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Top — logo block */}
      <View style={styles.top}>
        <Image
          source={require('../../assets/logo-title-black.png')}
          style={styles.logoImage}
          resizeMode="contain"
          accessibilityLabel="Scholarship House logo"
        />
      </View>

      {/* Middle — hero */}
      <View style={styles.middle}>
        <View style={styles.heroCard}>
          {/* <Ionicons name="home" size={110} color={colors.primary} /> */}
           <Image
              source={require('../../assets/logo-dark-blue.png')}
              style={styles.heroImage}
              resizeMode="contain"
              accessibilityLabel="Scholarship House emblem"
            />
        </View>

        <View style={styles.starsWrap}>
          <StarRating rating={5} size={18} />
        </View>

        <Text style={styles.heroTitle}>
          Perfect{'\n'}Choice For{'\n'}Your Future
        </Text>

        <Text style={styles.heroSubtitle}>
          Submit, browse, and manage property deals — all from your pocket.
        </Text>
      </View>

      {/* Bottom — CTA */}
      <View style={styles.bottom}>
        <Button
          title="Get Started"
          onPress={() => router.replace('/(auth)/login')}
          style={{ width: '100%' }}
        />

        <Pressable
          style={styles.bottomLinkRow}
          onPress={() => router.push('/(auth)/register')}
          accessibilityRole="button"
          accessibilityLabel="Create an account"
          hitSlop={8}
        >
          <Text style={styles.bottomText}>New here? </Text>
          <Text style={styles.bottomLink}>Create an account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xl,
  },
  top: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  logoImage: {
    width: 240,
    height: 85,
  },
  logoMark: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    ...typography.h2,
    color: colors.primary,
    letterSpacing: -0.3,
  },

  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    width: 220,
    height: 220,
    borderRadius: radius.xl,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  heroImage: {
    width: 190,
    height: 190,
  },
  starsWrap: { marginBottom: spacing.md },
  heroTitle: {
    ...typography.display,
    color: colors.text,
    textAlign: 'center',
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
  },

  bottom: {
    paddingBottom: spacing.lg,
  },
  bottomLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
    marginTop: spacing.lg,
  },
  bottomText: { ...typography.body, color: colors.textMuted },
  bottomLink: {
    ...typography.bodyStrong,
    color: colors.primaryAccent,
  },
});
