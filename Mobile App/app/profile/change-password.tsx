import React, { useState } from 'react';
import { Stack, useNavigation, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AuthHeroLayout } from '@/components/AuthHeroLayout';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { SuccessModal } from '@/components/SuccessModal';
import { ErrorModal } from '@/components/ErrorModal';
import { OfflineHint } from '@/components/OfflineHint';
import { changePasswordSchema, type ChangePasswordInput } from '@/utils/validation';
import { changePassword } from '@/api/profile';
import { extractApiError } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useNetwork } from '@/context/NetworkContext';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { signOut } = useAuth();
  const { isOffline } = useNetwork();
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Fallback to Profile tab if we got here via a deep link with no stack history.
  const goBack = () => {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile');
    }
  };

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ChangePasswordInput) => {
    try {
      await changePassword(data.currentPassword, data.newPassword);
      setSuccess(true);
    } catch (err) {
      setErrorMsg(extractApiError(err));
    }
  };

  return (
    <>
      {/* Root layout renders TopNav as this screen's header. */}
      <AuthHeroLayout
        eyebrow="SECURITY"
        title="Change password"
        subtitle="Choose a strong password you haven't used before."
        showBack
        onBack={goBack}
        showBottomNav
        compactTop
      >
        <Controller control={control} name="currentPassword" render={({ field }) => (
          <Input
            label="Current password"
            value={field.value}
            onChangeText={field.onChange}
            secureTextEntry
            error={errors.currentPassword?.message}
          />
        )} />
        <Controller control={control} name="newPassword" render={({ field }) => (
          <Input
            label="New password"
            value={field.value}
            onChangeText={field.onChange}
            secureTextEntry
            error={errors.newPassword?.message}
          />
        )} />
        <Controller control={control} name="confirmPassword" render={({ field }) => (
          <Input
            label="Confirm new password"
            value={field.value}
            onChangeText={field.onChange}
            secureTextEntry
            error={errors.confirmPassword?.message}
          />
        )} />
        <Button title="Update password" onPress={handleSubmit(onSubmit)} loading={isSubmitting} disabled={isOffline} />
        <OfflineHint message="You're offline — connect to the internet to update your password." />
      </AuthHeroLayout>

      <SuccessModal
        visible={success}
        title="Password updated"
        message="Your new password is now active. Please sign in again to continue."
        ctaLabel="Sign in again"
        onDismiss={() => {
          setSuccess(false);
          // ProtectedRouter will redirect to /(auth)/login once user is null.
          signOut();
        }}
      />

      <ErrorModal
        visible={!!errorMsg}
        title="Could not change password"
        message={errorMsg ?? ''}
        ctaLabel="OK"
        onDismiss={() => setErrorMsg(null)}
      />
    </>
  );
}
