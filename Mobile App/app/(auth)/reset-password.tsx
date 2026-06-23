import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AuthHeroLayout } from '@/components/AuthHeroLayout';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { SuccessModal } from '@/components/SuccessModal';
import { ErrorModal } from '@/components/ErrorModal';
import { OfflineHint } from '@/components/OfflineHint';
import { resetPasswordSchema, type ResetPasswordInput } from '@/utils/validation';
import { resetPassword, validateResetToken } from '@/api/auth';
import { extractApiError } from '@/api/client';
import { spacing, typography } from '@/theme';
import { useTheme } from '@/context/ThemeContext';
import { useNetwork } from '@/context/NetworkContext';

export default function ResetPasswordScreen() {
  const { colors } = useTheme();
  const { isOffline } = useNetwork();
  const params = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { control, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<ResetPasswordInput>({
      resolver: zodResolver(resetPasswordSchema),
      defaultValues: { password: '', confirmPassword: '' },
    });

  useEffect(() => {
    if (!params.token) {
      setTokenValid(false);
      return;
    }
    validateResetToken(params.token)
      .then((res) => setTokenValid(res.valid))
      .catch(() => setTokenValid(false));
  }, [params.token]);

  const onSubmit = async ({ password }: ResetPasswordInput) => {
    if (!params.token) return;
    try {
      await resetPassword(params.token, password);
      setSuccess(true);
    } catch (err) {
      setErrorMsg(extractApiError(err));
    }
  };

  if (tokenValid === null) {
    return (
      <AuthHeroLayout brandLogo eyebrow="VERIFYING" title="One moment…" showBack>
        <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.md }]}>
            Verifying your reset link.
          </Text>
        </View>
      </AuthHeroLayout>
    );
  }

  if (!tokenValid) {
    return (
      <AuthHeroLayout
        brandLogo
        eyebrow="LINK EXPIRED"
        title="Try again"
        subtitle="This reset link is invalid or has expired."
        showBack
      >
        <Button title="Request new link" onPress={() => router.replace('/(auth)/forgot-password')} />
      </AuthHeroLayout>
    );
  }

  return (
    <AuthHeroLayout
      brandLogo
      eyebrow="NEW PASSWORD"
      title="Set a new password"
      subtitle="Choose a strong password you haven't used before."
      showBack
    >
      <Controller control={control} name="password" render={({ field }) => (
        <Input label="New password" value={field.value} onChangeText={field.onChange} secureTextEntry error={errors.password?.message} />
      )} />
      <Controller control={control} name="confirmPassword" render={({ field }) => (
        <Input label="Confirm password" value={field.value} onChangeText={field.onChange} secureTextEntry error={errors.confirmPassword?.message} />
      )} />

      <Button title="Update password" onPress={handleSubmit(onSubmit)} loading={isSubmitting} disabled={isOffline} />
      <OfflineHint message="You're offline — connect to the internet to update your password." />

      <SuccessModal
        visible={success}
        title="Password updated"
        message="You can now sign in with your new password."
        ctaLabel="Sign in"
        onDismiss={() => {
          setSuccess(false);
          router.replace('/(auth)/login');
        }}
      />

      <ErrorModal
        visible={!!errorMsg}
        title="Reset failed"
        message={errorMsg ?? ''}
        ctaLabel="OK"
        onDismiss={() => setErrorMsg(null)}
      />
    </AuthHeroLayout>
  );
}
