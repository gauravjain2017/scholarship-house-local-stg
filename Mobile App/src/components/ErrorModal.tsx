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

interface ErrorModalProps {
  visible: boolean;
  title: string;
  message: string;
  ctaLabel?: string;
  onDismiss: () => void;
}

export function ErrorModal({
  visible,
  title,
  message,
  ctaLabel = 'Try again',
  onDismiss,
}: ErrorModalProps) {
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
          <View style={styles.xRing}>
            <View style={styles.xCircle}>
              <Text style={styles.x}>✕</Text>
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
  xRing: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    backgroundColor: 'rgba(209, 67, 67, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  xCircle: {
    width: INNER,
    height: INNER,
    borderRadius: INNER / 2,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.primaryButton,
  },
  x: {
    color: '#fff',
    fontSize: 34,
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
