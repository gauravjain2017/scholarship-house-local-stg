import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '@/components/Button';
import { radius, shadows, spacing, typography } from '@/theme';
import { useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

interface SuccessModalProps {
  visible: boolean;
  title: string;
  message: string;
  /** Primary CTA label */
  ctaLabel?: string;
  /** Called when user taps the CTA or backdrop */
  onDismiss: () => void;
}

/**
 * Full-screen success overlay with an animated checkmark.
 * Use instead of `Alert.alert(..., 'Success', ...)` for a more premium feel.
 *
 *   const [success, setSuccess] = useState<{title, message} | null>(null);
 *   ...
 *   <SuccessModal
 *     visible={!!success}
 *     title={success?.title ?? ''}
 *     message={success?.message ?? ''}
 *     onDismiss={() => { setSuccess(null); router.back(); }}
 *   />
 */
export function SuccessModal({
  visible,
  title,
  message,
  ctaLabel = 'Continue',
  onDismiss,
}: SuccessModalProps) {
  const styles = useThemedStyles(makeStyles);
  const scale = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(0);
      fade.setValue(0);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 90,
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scale, fade]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Animated.View
          style={[styles.card, { opacity: fade, transform: [{ scale: scale }] }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.checkRing}>
            <View style={styles.checkCircle}>
              <Text style={styles.check}>✓</Text>
            </View>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <Button title={ctaLabel} onPress={onDismiss} style={styles.cta} />
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const RING = 100;
const INNER = 72;

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 20, 38, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.xl,
    padding: spacing.xl + spacing.sm,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    ...shadows.cardStrong,
  },
  checkRing: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  checkCircle: {
    width: INNER,
    height: INNER,
    borderRadius: INNER / 2,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.primaryButton,
  },
  check: {
    color: '#fff',
    fontSize: 38,
    fontWeight: '800',
    marginTop: -2,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  cta: {
    marginTop: spacing.xl,
    width: '100%',
  },
});
