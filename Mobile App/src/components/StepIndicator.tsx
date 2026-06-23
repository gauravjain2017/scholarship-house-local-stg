import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, shadows, spacing, typography } from '@/theme';
import { useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

interface StepIndicatorProps {
  steps: { key: string; label: string }[];
  currentStep: number; // 0-based
  completedSteps: number[]; // 0-based indexes of fully-validated steps
  onStepPress?: (index: number) => void;
}

export function StepIndicator({
  steps,
  currentStep,
  completedSteps,
  onStepPress,
}: StepIndicatorProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      {steps.map((s, idx) => {
        const isActive = idx === currentStep;
        const isCompleted = completedSteps.includes(idx);
        const canTap = onStepPress && (isCompleted || idx <= currentStep);

        return (
          <React.Fragment key={s.key}>
            {idx > 0 && (
              <View
                style={[
                  styles.connector,
                  isCompleted || idx <= currentStep ? styles.connectorDone : null,
                ]}
              />
            )}

            <Pressable
              onPress={canTap ? () => onStepPress!(idx) : undefined}
              style={styles.stepWrap}
              disabled={!canTap}
            >
              <View
                style={[
                  styles.circle,
                  isCompleted && styles.circleCompleted,
                  isActive && styles.circleActive,
                ]}
              >
                <Text
                  style={[
                    styles.circleText,
                    (isActive || isCompleted) && styles.circleTextActive,
                  ]}
                >
                  {isCompleted ? '✓' : idx + 1}
                </Text>
              </View>
              <Text
                style={[
                  styles.label,
                  isActive && styles.labelActive,
                ]}
                numberOfLines={1}
              >
                {s.label}
              </Text>
            </Pressable>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const CIRCLE = 36;

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
  },
  stepWrap: {
    alignItems: 'center',
    width: 60,
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
    ...shadows.primaryButton,
  },
  circleCompleted: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  circleText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMuted,
  },
  circleTextActive: {
    color: '#fff',
  },
  label: {
    ...typography.tiny,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  labelActive: {
    color: colors.primary,
  },
  connector: {
    flex: 1,
    height: 3,
    backgroundColor: colors.border,
    marginTop: CIRCLE / 2 - 1.5,
    marginHorizontal: -6,
    borderRadius: 2,
  },
  connectorDone: {
    backgroundColor: colors.primary,
  },
});
