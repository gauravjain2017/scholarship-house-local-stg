import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AuthHeroLayout } from '@/components/AuthHeroLayout';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { ErrorModal } from '@/components/ErrorModal';
import { OfflineHint } from '@/components/OfflineHint';
import { useNetwork } from '@/context/NetworkContext';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/utils/validation';
import { requestPasswordReset } from '@/api/auth';
import { extractApiError } from '@/api/client';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { isOffline } = useNetwork();
  // Use the same styled popup as the login screen instead of a native Alert.
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { control, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<ForgotPasswordInput>({
      resolver: zodResolver(forgotPasswordSchema),
      defaultValues: { email: '' },
    });

  const onSubmit = async ({ email }: ForgotPasswordInput) => {
    try {
      await requestPasswordReset(email);
      // Hand off to the OTP screen. It owns the countdown + resend; we pass the
      // email along so it can verify the code and re-request if it expires.
      router.push({ pathname: '/(auth)/verify-otp', params: { email } });
    } catch (err) {
      setErrorMsg(extractApiError(err));
    }
  };

  return (
    <>
      <AuthHeroLayout
        brandLogo
        eyebrow="ACCOUNT RECOVERY"
        title="Forgot password?"
        subtitle="Enter your email and we'll send you a 6-digit verification code."
        showBack
        footerText="Remembered it?"
        footerLinkLabel="Back to sign in"
        footerLinkHref="/(auth)/login"
      >
        <Controller control={control} name="email" render={({ field }) => (
          <Input
            label="Email"
            value={field.value}
            onChangeText={field.onChange}
            autoCapitalize="none"
            inputMode="text"
            placeholder="you@example.com"
            error={errors.email?.message}
          />
        )} />

        <Button title="Send code" onPress={handleSubmit(onSubmit)} loading={isSubmitting} disabled={isOffline} />
        <OfflineHint message="You're offline — connect to the internet to send the code." />
      </AuthHeroLayout>

      <ErrorModal
        visible={!!errorMsg}
        title="Could not send code"
        message={errorMsg ?? ''}
        ctaLabel="OK"
        onDismiss={() => setErrorMsg(null)}
      />
    </>
  );
}
