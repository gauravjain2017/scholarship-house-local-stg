import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

/**
 * App-wide error boundary. Catches render-time exceptions anywhere in the tree
 * and shows a recoverable fallback instead of a white screen. "Try again"
 * clears the error so the subtree re-mounts and re-renders.
 *
 * Note: error boundaries only catch errors thrown during React rendering /
 * lifecycle — not inside async callbacks or event handlers (those are handled
 * per-call via try/catch + ErrorModal).
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : undefined,
    };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Surface in dev; in production this is where a telemetry hook would go.
    if (__DEV__) {
      console.error('[ErrorBoundary] Uncaught render error:', error, info);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, message: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.root}>
        <View style={styles.iconRing}>
          <Ionicons name="warning-outline" size={34} color={colors.danger} />
        </View>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          The app hit an unexpected error. You can try again — if it keeps
          happening, please restart the app.
        </Text>
        {__DEV__ && this.state.message ? (
          <Text style={styles.devMessage}>{this.state.message}</Text>
        ) : null}
        <Pressable
          onPress={this.handleReset}
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  devMessage: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  buttonText: {
    ...typography.bodyStrong,
    color: colors.textOnPrimary,
  },
});
