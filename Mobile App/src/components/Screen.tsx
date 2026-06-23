import React from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing } from '@/theme';
import { useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  keyboardAvoiding?: boolean;
}

export function Screen({
  children,
  scroll = true,
  contentStyle,
  keyboardAvoiding = true,
}: ScreenProps) {
  const styles = useThemedStyles(makeStyles);
  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      // iOS: auto-scrolls the focused input above the keyboard (and shows the
      // caret). Android relies on softwareKeyboardLayoutMode: 'resize'.
      automaticallyAdjustKeyboardInsets
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {keyboardAvoiding ? (
        // `behavior` is left undefined on purpose: on iOS we let the
        // ScrollView's `automaticallyAdjustKeyboardInsets` handle the shift
        // (combining it with KAV "padding" double-shifts and hides fields),
        // and on Android the window resize does the work.
        <KeyboardAvoidingView behavior={undefined} style={styles.flex}>
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
});
