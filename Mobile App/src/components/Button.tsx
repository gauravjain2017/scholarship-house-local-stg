import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, shadows, spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

type Variant = 'primary' | 'secondary' | 'danger' | 'dangerGhost' | 'ghost' | 'onDark';
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  /** Optional Ionicons glyph rendered before the label. */
  icon?: IoniconsName;
  /** Accepts a single style or an array of styles (RN convention). */
  style?: StyleProp<ViewStyle>;
}

/**
 * Variants:
 *   primary    — navy fill, white text. The default CTA.
 *   secondary  — light grey fill with a 1px border. **Primary-color text.**
 *                Used on light page backgrounds (back buttons, "duplicate", etc).
 *   danger     — red fill, white text.
 *   ghost      — transparent, primary-color text. For link-style actions.
 *   onDark     — transparent with white border and white text. For use on the
 *                navy hero (e.g. the dashboard's "My Properties" CTA).
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const isDisabled = disabled || loading;
  const spinnerColor =
    variant === 'dangerGhost'
      ? colors.danger
      : variant === 'ghost' || variant === 'secondary'
        ? colors.primary
        : '#fff';
  const iconColor =
    variant === 'dangerGhost'
      ? colors.danger
      : variant === 'secondary' || variant === 'ghost'
        ? colors.primary
        : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <View style={styles.contentRow}>
          {icon ? (
            <Ionicons
              name={icon}
              size={18}
              color={iconColor}
              style={styles.icon}
            />
          ) : null}
          <Text
            style={[styles.label, labelStyleFor(variant, styles)]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function labelStyleFor(variant: Variant, styles: ReturnType<typeof makeStyles>) {
  switch (variant) {
    case 'secondary':
      return styles.labelSecondary;
    case 'ghost':
      return styles.labelGhost;
    case 'dangerGhost':
      return styles.labelDanger;
    case 'onDark':
      return styles.labelOnDark;
    default:
      return undefined;
  }
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    base: {
      paddingVertical: spacing.md + 2,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
    },
    primary: { backgroundColor: colors.primary, ...shadows.primaryButton },
    secondary: {
      backgroundColor: colors.bg,
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    danger: { backgroundColor: colors.danger },
    dangerGhost: {
      backgroundColor: colors.dangerSoft,
      borderWidth: 1.5,
      borderColor: colors.danger,
    },
    ghost: { backgroundColor: 'transparent' },
    onDark: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.6)',
    },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },

    contentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    icon: { marginRight: 8 },
    label: { ...typography.bodyStrong, color: '#fff', letterSpacing: 0.3 },
    labelSecondary: { color: colors.primary },
    labelGhost: { color: colors.primary },
    labelDanger: { color: colors.danger },
    labelOnDark: { color: '#fff' },
  });
