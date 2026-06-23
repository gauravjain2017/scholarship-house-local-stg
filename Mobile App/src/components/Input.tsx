import React, { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  /** Caption shown below the field — useful for things like "Email cannot be changed." */
  hint?: string;
  /** Visually + functionally disable the field. Sets `editable={false}` and dims the background. */
  disabled?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, hint, disabled, style, editable, secureTextEntry, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const isEditable = disabled ? false : (editable ?? true);
  const [revealed, setRevealed] = useState(false);
  const isPassword = !!secureTextEntry;
  const hideText = isPassword && !revealed;

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.fieldRow}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          // Older Android (API 29) has no default accent, so the caret/selection
          // are invisible unless set explicitly. Android 12+ themes supply one.
          cursorColor={colors.primary}
          selectionColor={colors.primary}
          editable={isEditable}
          secureTextEntry={hideText}
          style={[
            styles.input,
            isPassword && styles.inputWithIcon,
            !!error && styles.inputError,
            disabled && styles.inputDisabled,
            style,
          ]}
          {...rest}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            hitSlop={8}
            style={styles.eyeButton}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          >
            <Ionicons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
});

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  wrapper: { marginBottom: spacing.lg },
  label: {
    ...typography.captionStrong,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    letterSpacing: 0.2,
  },
  fieldRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.bgAlt,
    minHeight: 50,
  },
  inputWithIcon: {
    paddingRight: spacing.xl + 24,
  },
  inputError: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  inputDisabled: {
    backgroundColor: colors.bgAlt,
    color: colors.textMuted,
    borderColor: colors.border,
  },
  eyeButton: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  hintText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
