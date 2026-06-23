import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AuthHeroLayout } from '@/components/AuthHeroLayout';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Select } from '@/components/Select';
import { SuccessModal } from '@/components/SuccessModal';
import { ErrorModal } from '@/components/ErrorModal';
import { OfflineHint } from '@/components/OfflineHint';
import { useNetwork } from '@/context/NetworkContext';
import { registerSchema, type RegisterInput } from '@/utils/validation';
import { formatPhone } from '@/utils/phone';
import { requestRegistration, getTeamMembers, type TeamMember } from '@/api/auth';
import { extractApiError } from '@/api/client';

const USER_TYPE_OPTIONS = [
  { label: 'I am a Scholarship House Submitter', value: 'submitter' },
  { label: 'I am a Scholarship House Client', value: 'client' },
];



export default function RegisterScreen() {
  const router = useRouter();
  const { isOffline } = useNetwork();
  // Keep the submitted name so the success modal can greet the user by name.
  const [success, setSuccess] = useState<{ firstName: string; lastName: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { control, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } =
    useForm<RegisterInput>({
      resolver: zodResolver(registerSchema),
      defaultValues: {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        userType: undefined,
        specialist: '',
        password: '',
        confirmPassword: '',
      },
    });

  const userType = watch('userType');

  // Specialists a client can be matched with. Fetched once; an empty list (or a
  // failed request) just leaves the dropdown empty rather than blocking sign-up.
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  useEffect(() => {
    getTeamMembers()
      .then(setTeamMembers)
      .catch(() => setTeamMembers([]));
  }, []);

  const specialistOptions = useMemo(
    () =>
      teamMembers.map((m) => ({
        label: `${m.firstName} ${m.lastName}`.trim(),
        value: m.email,
      })),
    [teamMembers],
  );

  // The specialist field only applies to clients. Clear any selection when the
  // user switches to "submitter" so a stale value can't be submitted (the field
  // is hidden in that case too).
  useEffect(() => {
    if (userType !== 'client') setValue('specialist', '');
  }, [userType, setValue]);

  const onSubmit = async (data: RegisterInput) => {
    try {
      await requestRegistration({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        password: data.password,
        userType: data.userType,
        // Only clients carry a specialist; submitters omit it entirely.
        specialist: data.userType === 'client' ? data.specialist : undefined,
      });
      setSuccess({ firstName: data.firstName, lastName: data.lastName });
    } catch (err) {
      setErrorMsg(extractApiError(err));
    }
  };

  return (
    <>
      <AuthHeroLayout
        brandLogo
        eyebrow="GET STARTED"
        title="Create your account"
        subtitle="An admin will review and approve your account."
        showBack
        footerText="Already have an account?"
        footerLinkLabel="Sign in"
        footerLinkHref="/(auth)/login"
      >
        <Controller control={control} name="firstName" render={({ field }) => (
          <Input label="First name" value={field.value} onChangeText={field.onChange} placeholder="Jane" error={errors.firstName?.message} />
        )} />
        <Controller control={control} name="lastName" render={({ field }) => (
          <Input label="Last name" value={field.value} onChangeText={field.onChange} placeholder="Doe" error={errors.lastName?.message} />
        )} />
        <Controller control={control} name="email" render={({ field }) => (
          <Input label="Email" value={field.value} onChangeText={field.onChange} autoCapitalize="none" inputMode="text" placeholder="you@example.com" error={errors.email?.message} />
        )} />
        <Controller control={control} name="phone" render={({ field }) => (
          <Input
            label="Phone"
            value={field.value}
            onChangeText={(text) => field.onChange(formatPhone(text))}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={14}
            placeholder="(555) 123-4567"
            error={errors.phone?.message}
          />
        )} />
       
	   <Controller control={control} name="userType" render={({ field }) => (
          <Select
            label="Why do you want to use this application?"
            placeholder="Select an option"
            value={field.value ?? ''}
            options={USER_TYPE_OPTIONS}
            onChange={field.onChange}
            error={errors.userType?.message}
          />
        )} />

        {/* Specialist picker — shown ONLY for "Scholarship House Client".
            Hidden for submitters (and the value is cleared on switch). */}
        {userType === 'client' ? (
          <Controller control={control} name="specialist" render={({ field }) => (
            <Select
              label="Select your College Funding Specialist"
              placeholder="Select a specialist"
              value={field.value ?? ''}
              options={specialistOptions}
              onChange={field.onChange}
              error={errors.specialist?.message}
            />
          )} />
        ) : null}
        <Controller control={control} name="password" render={({ field }) => (
          <Input label="Password" value={field.value} onChangeText={field.onChange} secureTextEntry error={errors.password?.message} />
        )} />
        <Controller control={control} name="confirmPassword" render={({ field }) => (
          <Input label="Confirm password" value={field.value} onChangeText={field.onChange} secureTextEntry error={errors.confirmPassword?.message} />
        )} />

        <Button title="Create account" onPress={handleSubmit(onSubmit)} loading={isSubmitting} disabled={isOffline} />
        <OfflineHint message="You're offline — connect to the internet to create your account." />
      </AuthHeroLayout>

      <SuccessModal
        visible={!!success}
        title={success ? `Welcome ${success.firstName} ${success.lastName}!` : 'Welcome!'}
        message="Your registration has been submitted. An admin will approve your account shortly — we'll email you the moment it's ready."
        ctaLabel="Back to sign in"
        onDismiss={() => {
          setSuccess(null);
          router.replace('/(auth)/login');
        }}
      />

      <ErrorModal
        visible={!!errorMsg}
        title="Registration failed"
        message={errorMsg ?? ''}
        ctaLabel="OK"
        onDismiss={() => setErrorMsg(null)}
      />
    </>
  );
}
