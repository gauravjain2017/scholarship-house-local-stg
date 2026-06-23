import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { radius, shadows, spacing } from '@/theme';
import { useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

interface CardProps extends ViewProps {
  elevated?: boolean;
  padding?: keyof typeof spacing | 0;
}

/**
 * Surface container with rounded corners and soft drop-shadow.
 * Use anywhere a piece of content needs to feel "lifted" off the page.
 */
export function Card({
  elevated = false,
  padding = 'lg',
  style,
  children,
  ...rest
}: CardProps) {
  const styles = useThemedStyles(makeStyles);
  const padValue = padding === 0 ? 0 : spacing[padding];
  return (
    <View
      style={[
        styles.base,
        { padding: padValue },
        elevated ? shadows.cardStrong : shadows.card,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    base: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
    },
  });
