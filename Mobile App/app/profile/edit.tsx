import React, { useEffect, useState } from 'react';
import { Alert, Text } from 'react-native';
import { Stack, useNavigation, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthHeroLayout } from '@/components/AuthHeroLayout';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Row } from '@/components/Row';
import { Select } from '@/components/Select';
import { SuccessModal } from '@/components/SuccessModal';
import { OfflineHint } from '@/components/OfflineHint';
import { getProfile, updateProfile } from '@/api/profile';
import { extractApiError } from '@/api/client';
import { profileSchema, type ProfileInput } from '@/utils/validation';
import { formatPhone } from '@/utils/phone';
import { US_STATE_OPTIONS, resolveStateCode } from '@/utils/usStates';
import { useAuth } from '@/context/AuthContext';
import { spacing, typography } from '@/theme';
import { useTheme } from '@/context/ThemeContext';
import { useNetwork } from '@/context/NetworkContext';

/**
 * Mirrors submitter-frontend/views/Profile.jsx ProfileInfoTab:
 *   - firstName, lastName, phone (required)
 *   - email (read-only)
 *   - address.{street, city, state, zip} (optional)
 */
export default function EditProfileScreen() {
  const { colors } = useTheme();
  const { isOffline } = useNetwork();
  const router = useRouter();
  const navigation = useNavigation();
  const qc = useQueryClient();
  const { user, setUser } = useAuth();
  // Fallback to Profile tab if we got here via a deep link with no stack history.
  const goBack = () => {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile');
    }
  };
  const [success, setSuccess] = useState(false);

  // The `['profile']` cache is shared with the Profile tab, which seeds it
  // with `initialData: user` from AuthContext. That AuthUser has no address
  // field, so reading from the cache would show blank Street/City/State/ZIP
  // until a real /profile/me fetch lands. Force a fresh fetch here and gate
  // the form on `dataUpdatedAt > 0` so we never reset() with the slim shape.
  // Use a DEDICATED key — NOT the ['profile'] cache the Profile tab seeds with
  // the stale AuthContext `user` (a login-time snapshot that only ever refreshes
  // its avatar). Reading that cache made the form show old name/phone even
  // though the DB was updated. gcTime:0 drops it on unmount so every open
  // refetches the real /profile/me values.
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['profile', 'edit'],
    queryFn: getProfile,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });
  const hasFreshData = dataUpdatedAt > 0;

  // `/profile/me` doesn't always return an email field (varies by backend
  // version). Fall back to the user cached in AuthContext from login.
  const email = data?.email ?? user?.email ?? '';

  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      acquisitionSpecialist: '',
      street: '',
      city: '',
      state: '',
      zip: '',
    },
  });

  // Populate the form once profile loads. Splits a legacy combined `name`
  // field into first / last on a best-effort basis. Wait for an actual fetch
  // (not initialData from the shared cache) before resetting, so address
  // fields aren't clobbered with empty strings while the refetch is in flight.
  useEffect(() => {
    if (!data || !hasFreshData) return;
    let firstName = data.firstName ?? '';
    let lastName = data.lastName ?? '';
    if (!firstName && !lastName && data.name) {
      const parts = data.name.trim().split(/\s+/);
      firstName = parts[0] ?? '';
      lastName = parts.slice(1).join(' ');
    }
    reset({
      firstName,
      lastName,
      phone: formatPhone(data.phone ?? ''),
      acquisitionSpecialist: data.acquisitionSpecialist ?? '',
      street: data.address?.street ?? '',
      city: data.address?.city ?? '',
      // Coerce whatever the backend returned (full name, lowercase code,
      // legacy free-form value) into the canonical 2-letter code so the
      // Select can find it in US_STATE_OPTIONS and display the right label.
      state: resolveStateCode(data.address?.state),
      zip: data.address?.zip ?? '',
    });
  }, [data, hasFreshData, reset]);

  const mut = useMutation({
    mutationFn: updateProfile,
    onSuccess: (_res, variables) => {
      // Refetch both the Profile tab cache and this screen's dedicated query.
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['profile', 'edit'] });
      // Keep the app-wide auth snapshot in sync so the Profile tab and header
      // immediately show the new name/phone instead of the login-time values.
      if (user) {
        const fullName = `${variables.firstName ?? ''} ${variables.lastName ?? ''}`.trim();
        setUser({
          ...user,
          name: fullName || user.name,
          phone: variables.phone ?? user.phone,
        });
      }
      setSuccess(true);
    },
    onError: (e) => Alert.alert('Update failed', extractApiError(e)),
  });

  const onSubmit = (form: ProfileInput) => {
    if (!email) {
      Alert.alert('Please wait', 'Profile is still loading. Try again in a moment.');
      return;
    }
    mut.mutate({
      // Backend requires email even though it's read-only — echo the current value.
      email,
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone,
      address: {
        street: form.street || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        zip: form.zip || undefined,
      },
    });
  };

  return (
    <>
      {/* Root layout renders TopNav as this screen's header. */}
      <AuthHeroLayout
        eyebrow="ACCOUNT"
        title="Edit profile"
        subtitle="Update your account details"
        showBack
        onBack={goBack}
        showBottomNav
        compactTop
      >
        {isLoading || !hasFreshData ? (
          <Text style={typography.body}>Loading…</Text>
        ) : (
          <>
            <Row>
              <Controller control={control} name="firstName" render={({ field }) => (
                <Input
                  label="First name *"
                  value={field.value}
                  onChangeText={field.onChange}
                  error={errors.firstName?.message}
                />
              )} />
              <Controller control={control} name="lastName" render={({ field }) => (
                <Input
                  label="Last name *"
                  value={field.value}
                  onChangeText={field.onChange}
                  error={errors.lastName?.message}
                />
              )} />
            </Row>

            <Input
              label="Email address"
              value={email}
              disabled
              hint="Email address cannot be changed."
            />

            <Controller control={control} name="phone" render={({ field }) => (
              <Input
                label="Phone *"
                value={field.value}
                onChangeText={(text) => field.onChange(formatPhone(text))}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={14}
                placeholder="(555) 123-4567"
                error={errors.phone?.message}
              />
            )} />

            <Text style={{
              ...typography.captionStrong,
              color: colors.textMuted,
              letterSpacing: 1,
              textTransform: 'uppercase',
              marginTop: spacing.lg,
              marginBottom: spacing.sm,
            }}>
              Address (optional)
            </Text>

            <Controller control={control} name="street" render={({ field }) => (
              <Input label="Street" value={field.value ?? ''} onChangeText={field.onChange} />
            )} />

            <Row>
              <Controller control={control} name="city" render={({ field }) => (
                <Input label="City" value={field.value ?? ''} onChangeText={field.onChange} />
              )} />
              <Controller control={control} name="state" render={({ field }) => (
                <Select
                  label="State"
                  placeholder="Select a state"
                  value={field.value ?? ''}
                  options={US_STATE_OPTIONS}
                  onChange={field.onChange}
                  error={errors.state?.message}
                />
              )} />
            </Row>

            <Controller control={control} name="zip" render={({ field }) => (
              <Input label="ZIP" value={field.value ?? ''} onChangeText={field.onChange} keyboardType="numeric" />
            )} />

            <Button
              title="Save changes"
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting || mut.isPending}
              disabled={isOffline}
            />
            <OfflineHint message="You're offline — connect to the internet to save changes." />
          </>
        )}
      </AuthHeroLayout>

      <SuccessModal
        visible={success}
        title="Profile updated"
        message="Your changes have been saved."
        ctaLabel="Done"
        onDismiss={() => {
          setSuccess(false);
          goBack();
        }}
      />
    </>
  );
}
