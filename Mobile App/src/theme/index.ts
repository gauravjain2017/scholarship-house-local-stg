/**
 * App design tokens.
 *
 * The app supports a Light and a Dark color mode. Both palettes share the
 * exact same set of keys (see `ThemeColors`), so any component can be written
 * once against the token names and themed at runtime.
 *
 * Components should NOT import `colors` directly for rendering — instead read
 * the active palette from the theme context via `useTheme()` /
 * `useThemedStyles()` (see `src/context/ThemeContext.tsx`). The `colors`
 * export below is the Light palette and is kept as a non-reactive fallback
 * (e.g. for the splash/loading frame before the provider mounts).
 */

export const lightColors = {
  // Brand — refined professional blue (no longer the heavy navy of the prior
  // design). Tailwind blue-600 family, sits well on light surfaces.
  primary: '#2563EB',          // confident, modern blue — primary brand
  primaryDark: '#1D4ED8',
  primaryAccent: '#3B82F6',    // brighter accent for links / focused states
  primarySoft: '#EFF4FF',      // pale-blue tint for chip backgrounds, selected pills

  // Surfaces — lighter, more premium
  bg: '#FFFFFF',
  bgAlt: '#F7F8FB',            // soft page background between cards
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',

  // Text — softened for a less heavy look
  text: '#101828',
  textSecondary: '#475467',
  textMuted: '#8A93A6',
  textOnPrimary: '#FFFFFF',

  // Lines & dividers — paler for clean separation
  border: '#EAECF2',
  borderStrong: '#D6DBE6',

  // Semantic
  danger: '#D14343',
  dangerSoft: '#FDECEC',       // pale-red tint for destructive pill backgrounds
  success: '#1F9D55',
  successSoft: '#ECFDF5',      // pale-green tint for positive highlight cards
  warning: '#D9A40C',
  warningSoft: '#FFFBEB',      // pale-amber tint for advisory / research cards
  info: '#2563EB',

  // Star / rating
  star: '#F59E0B',

  // Listing badges
  badgeRent: '#1F9D55',
  badgeSale: '#D9A40C',
  badgeSold: '#D14343',
};

/**
 * Dark palette — professional, low-glare. Surfaces are layered near-black
 * navy (page is darkest, cards/heroes sit slightly lighter), text steps down
 * through three readable greys, and the brand blue is brightened so it stays
 * legible on dark backgrounds. Same keys as `lightColors`.
 */
export const darkColors: ThemeColors = {
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  primaryAccent: '#60A5FA',
  primarySoft: '#1B2740',      // dark blue-slate tint for chips / selected pills

  bg: '#131A2A',               // surfaces (cards, heroes) on top of the page
  bgAlt: '#0B1220',            // darkest — the page background behind cards
  card: '#131A2A',
  cardElevated: '#1A2336',

  text: '#F1F5F9',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  textOnPrimary: '#FFFFFF',

  border: '#243042',
  borderStrong: '#33415C',

  danger: '#F87171',
  dangerSoft: '#3A1E1E',
  success: '#34D399',
  successSoft: '#10301F',      // dark green tint — positive highlight cards
  warning: '#FBBF24',
  warningSoft: '#352B12',      // dark amber tint — advisory / research cards
  info: '#60A5FA',

  star: '#FBBF24',

  badgeRent: '#34D399',
  badgeSale: '#FBBF24',
  badgeSold: '#F87171',
};

/** Shape shared by both palettes. */
export type ThemeColors = typeof lightColors;

export type ThemeMode = 'light' | 'dark';

export const palettes: Record<ThemeMode, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
};

/**
 * Non-reactive default palette (Light). Kept for backward-compatibility and
 * for the pre-provider loading frame. For anything that should re-theme at
 * runtime, use `useTheme()` instead of importing this.
 */
export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 22,
  pill: 999,
};

export const typography = {
  display: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.5 },
  h1: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: '700' as const },
  h3: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  captionStrong: { fontSize: 13, fontWeight: '600' as const, lineHeight: 18 },
  price: { fontSize: 18, fontWeight: '800' as const, letterSpacing: -0.2 },
  tiny: { fontSize: 11, fontWeight: '500' as const },
};

/**
 * Card shadow presets. iOS uses real shadows; Android relies on `elevation`.
 * Spread these via `...shadows.card` inside StyleSheet.create.
 * Lighter than the previous theme — premium feel without heavy depth.
 */
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  card: {
    shadowColor: '#0B1426',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  cardStrong: {
    shadowColor: '#0B1426',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  header: {
    shadowColor: '#0B1426',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  primaryButton: {
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 5,
  },
};
