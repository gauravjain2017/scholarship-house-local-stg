import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { AuthHeroLayout } from '@/components/AuthHeroLayout';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { ErrorModal } from '@/components/ErrorModal';
import { useAuth } from '@/context/AuthContext';
import { loginSchema, type LoginInput } from '@/utils/validation';
import { extractApiError } from '@/api/client';
import { spacing, typography } from '@/theme';
import { useThemedStyles, type ThemeColors } from '@/context/ThemeContext';
import { useNetwork } from '@/context/NetworkContext';

interface LoginError {
  message: string;
  // 'deactivated' surfaces a separate popup title that matches the web app.
  kind: 'deactivated' | 'generic';
}

export default function LoginScreen() {
  const { signIn, signingIn } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const { isOffline } = useNetwork();
  const [loginError, setLoginError] = useState<LoginError | null>(null);

  const { control, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginInput) => {
    try {
      await signIn(data.email, data.password);
    } catch (err) {
      // Deactivated accounts get their own popup title — matches the web's
      // "Your account has been deactivated…" flow. Everything else falls
      // back to the generic "Login failed" popup.
      const code = axios.isAxiosError(err)
        ? (err.response?.data as { code?: string } | undefined)?.code
        : undefined;
      const message = extractApiError(err, 'Invalid email or password');
      setLoginError({
        message,
        kind: code === 'ACCOUNT_DEACTIVATED' ? 'deactivated' : 'generic',
      });
    }
  };

  return (
    <>
      <AuthHeroLayout
        brandLogo
        eyebrow="WELCOME BACK"
        title="Welcome back"
        subtitle="Sign in to continue to Scholarship House"
        footerText="Don't have an account?"
        footerLinkLabel="Create one"
        footerLinkHref="/(auth)/register"
      >
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value, onBlur } }) => (
            <Input
              label="Email"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoCapitalize="none"
              autoComplete="email"
              inputMode="text"
              placeholder="you@example.com"
              error={errors.email?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value, onBlur } }) => (
            <Input
              label="Password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoCapitalize="none"
              autoComplete="password"
              secureTextEntry
              placeholder="••••••••"
              error={errors.password?.message}
            />
          )}
        />

        <View style={styles.forgotRow}>
          <Link href="/(auth)/forgot-password" asChild>
            <Pressable hitSlop={6}>
              <Text style={styles.forgotLink}>Forgot password?</Text>
            </Pressable>
          </Link>
        </View>

        <Button
          title="Sign In"
          onPress={handleSubmit(onSubmit)}
          loading={signingIn}
          disabled={isOffline}
        />
        {isOffline && (
          <Text style={styles.offlineHint}>
            You're offline — connect to the internet to sign in.
          </Text>
        )}
      </AuthHeroLayout>

      <ErrorModal
        visible={!!loginError}
        title={loginError?.kind === 'deactivated' ? 'Account deactivated' : 'Login failed'}
        message={loginError?.message ?? ''}
        ctaLabel={loginError?.kind === 'deactivated' ? 'OK' : 'Try again'}
        onDismiss={() => setLoginError(null)}
      />
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  forgotRow: {
    alignItems: 'flex-end',
    // Pull the link up snug under the password field (Input has its own
    // bottom margin) and give the Sign In button a little breathing room.
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },
  forgotLink: {
    ...typography.captionStrong,
    color: colors.primaryAccent,
  },
  offlineHint: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
