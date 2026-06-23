import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { radius, shadows, spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

interface ValidationErrorModalProps {
  visible: boolean;
  title?: string;
  errors: string[];
  onDismiss: () => void;
}

/**
 * Bulleted-list error modal styled after admin's "Required Fields" dialog:
 * warning-triangle icon → amber title → yellow card listing every missing
 * field → primary CTA. Replaces single-message Alert.alert calls.
 */
export function ValidationErrorModal({
  visible,
  title = 'Required Fields',
  errors,
  onDismiss,
}: ValidationErrorModalProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  // Use a height budget that adapts to the device so every error can fit on
  // short screens without forcing the user to scroll a tiny clipped list.
  // The modal chrome (icon + title + CTA + paddings) eats ~260dp, so the
  // list gets the rest, capped to keep big phones from looking empty-headed.
  const { height: winH } = useWindowDimensions();
  const listMaxHeight = Math.min(Math.max(winH - 320, 200), 460);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Pressable style={styles.close} onPress={onDismiss} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>

          <View style={styles.iconRing}>
            <Ionicons name="warning" size={28} color={colors.warning} />
          </View>

          <Text style={styles.title}>{title}</Text>

          <View style={styles.listBox}>
            <ScrollView
              style={{ maxHeight: listMaxHeight }}
              contentContainerStyle={{ paddingVertical: spacing.xs }}
              showsVerticalScrollIndicator
            >
              {errors.map((msg, idx) => (
                <View key={`${msg}-${idx}`} style={styles.listRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.listText}>{msg}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          <Button title="OK" onPress={onDismiss} style={styles.cta} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const RING = 52;

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,20,38,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    ...shadows.cardStrong,
  },
  close: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    padding: spacing.xs,
  },
  iconRing: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    backgroundColor: 'rgba(217,164,12,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h2,
    color: colors.warning,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  listBox: {
    width: '100%',
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: 'rgba(217,164,12,0.35)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
    gap: spacing.sm,
  },
  bullet: {
    color: colors.warning,
    fontSize: 16,
    lineHeight: 20,
    marginTop: -1,
  },
  listText: {
    ...typography.body,
    color: colors.warning,
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
  },
  cta: {
    width: '100%',
    minHeight: 44,
  },
});
