import React from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomNav, BOTTOM_NAV_HEIGHT } from '@/components/BottomNav';
import { Card } from '@/components/Card';
import { ScreenHeader } from '@/components/ScreenHeader';
import { radius, spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

interface AuthHeroLayoutProps {
  eyebrow: string;          // e.g. "WELCOME BACK" (only shown in app-bar mode)
  title: string;            // e.g. "Sign in to continue"
  subtitle?: string;
  showBack?: boolean;
  /** Where the back button navigates (Link). Ignored if `onBack` is provided. */
  backHref?: string;
  /** Imperative back handler. Takes precedence over `backHref`. */
  onBack?: () => void;
  footerText?: string;
  footerLinkLabel?: string;
  footerLinkHref?: string;
  /** Render the global bottom tab bar. Use on screens reachable only when logged in. */
  showBottomNav?: boolean;
  /** Deprecated — kept for API stability. The new light header always handles its own top inset. */
  compactTop?: boolean;
  /**
   * Branded auth mode. When true, the fixed app-bar header is replaced with a
   * centered brand logo + large centered title/subtitle, and a light circular
   * back button floats at the top-left. Use on the sign-in / sign-up / recovery
   * screens. Profile-detail screens leave this off and keep the app-bar header.
   */
  brandLogo?: boolean;
  children: React.ReactNode;
}

/**
 * Shared chrome for auth + profile-detail screens.
 *
 * Two presentations:
 *   - App-bar mode (default): a fixed `<ScreenHeader />` with back/title at the
 *     top and an "eyebrow" above the form card. Used by profile-detail screens.
 *   - Branded mode (`brandLogo`): a centered logo, large centered title and
 *     subtitle, and a floating back button — the premium sign-in experience.
 *
 * In both modes the form content is constrained to a comfortable max width and
 * centered, so it never stretches edge-to-edge or looks distorted on large
 * phones and tablets.
 */
export function AuthHeroLayout({
  eyebrow,
  title,
  subtitle,
  showBack,
  backHref = '/(auth)/login',
  onBack,
  footerText,
  footerLinkLabel,
  footerLinkHref,
  showBottomNav,
  brandLogo,
  children,
}: AuthHeroLayoutProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleBack = onBack ?? (() => router.replace(backHref as any));

  return (
    // Reserve the Android gesture-bar / home-indicator height at the screen
    // level (edge-to-edge draws content behind it). Without this, a form that
    // fits on screen renders its primary button *under* the gesture pill — the
    // trailing scroll padding only clears it once you scroll to the very bottom.
    // When the bottom tab bar is shown it owns its own inset, so skip it there.
    <View
      style={[
        styles.screen,
        brandLogo && styles.screenBranded,
        { paddingBottom: showBottomNav ? 0 : insets.bottom },
      ]}
    >
      {brandLogo ? (
        // Branded mode: a light, circular floating back button (no app bar).
        showBack ? (
          <Pressable
            onPress={handleBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.floatingBack,
              { top: insets.top + spacing.xs },
              pressed && styles.floatingBackPressed,
            ]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        ) : null
      ) : showBack ? (
        <ScreenHeader title={title} subtitle={subtitle} onBack={handleBack} />
      ) : (
        <ScreenHeader title={title} subtitle={subtitle} iconName="home" />
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: brandLogo ? insets.top + spacing.xxl : spacing.lg,
              paddingBottom:
                (showBottomNav ? BOTTOM_NAV_HEIGHT : 0) +
                insets.bottom +
                spacing.xl +
                // Older Android (API 29) doesn't auto-scroll the focused field
                // clear of the keyboard the way API 30+ does. With adjustResize
                // enabled, this extra clearance gives the ScrollView room to lift
                // the bottom fields (password / confirm password) above the IME.
                (Platform.OS === 'android' ? 220 : 0),
            },
          ]}
          // Keep the keyboard open while scrolling (don't dismiss on drag).
          // Tapping outside an input still closes it via keyboardShouldPersistTaps.
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          {/* Constrain + center the form so it never stretches or distorts on
              large phones / tablets. */}
          <View style={styles.inner}>
            {brandLogo ? (
              <View style={styles.brandHeader}>
                <Image
                  source={require('../../assets/logo-title-dark-blue.png')}
                  style={styles.brandLogo}
                  resizeMode="contain"
                  accessibilityLabel="Scholarship House logo"
                />
                <Text style={styles.brandTitle}>{title}</Text>
                {subtitle ? <Text style={styles.brandSubtitle}>{subtitle}</Text> : null}
              </View>
            ) : (
              <Text style={styles.eyebrow}>{eyebrow}</Text>
            )}

            <Card padding="lg">{children}</Card>

            {footerText && footerLinkLabel && footerLinkHref ? (
              <View style={styles.footer}>
                <Text style={styles.footerText}>{footerText} </Text>
                <Link href={footerLinkHref as any} asChild>
                  <Pressable hitSlop={6}>
                    <Text style={styles.footerLink}>{footerLinkLabel}</Text>
                  </Pressable>
                </Link>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {showBottomNav ? <BottomNav /> : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgAlt },
  // The branded sign-in surface reads cleaner on pure white.
  screenBranded: { backgroundColor: colors.bg },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  // Centered, width-capped column so the form looks intentional on every
  // device — phones, large phones, and tablets alike.
  inner: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  eyebrow: {
    ...typography.captionStrong,
    color: colors.primary,
    letterSpacing: 1.8,
    marginBottom: spacing.md,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  brandLogo: {
    width: 200,
    height: 80,
    marginBottom: spacing.lg,
  },
  brandTitle: {
    ...typography.h1,
    color: colors.text,
    textAlign: 'center',
  },
  brandSubtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  floatingBack: {
    position: 'absolute',
    left: spacing.lg,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  floatingBackPressed: {
    backgroundColor: colors.border,
    transform: [{ scale: 0.96 }],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: spacing.xl,
  },
  footerText: { ...typography.body, color: colors.textMuted },
  footerLink: { ...typography.bodyStrong, color: colors.primaryAccent },
});
