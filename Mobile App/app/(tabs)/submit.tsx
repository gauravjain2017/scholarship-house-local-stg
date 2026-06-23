import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { MultiStepPropertyForm } from '@/components/property-form/MultiStepPropertyForm';
import { DraftsList } from '@/components/property-form/DraftsList';
import { clearDraft } from '@/components/property-form/draftStorage';
import { SuccessModal } from '@/components/SuccessModal';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useNotificationsHeader } from '@/hooks/useNotificationsHeader';
import { createDeal } from '@/api/deals';
import { createDraft, deleteDraft, getDraftById, updateDraft } from '@/api/drafts';
import { extractApiError } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';
import type { PropertyFormInput } from '@/utils/propertyFormSchema';
import { buildDealPayload } from '@/utils/buildDealPayload';
import type { Draft } from '@/types';

/**
 * Submit tab — the property-creation wizard rendered DIRECTLY as a tab screen,
 * not as a stack screen pushed on top of the tabs. Earlier this tab was a
 * trampoline that called `router.push('/properties/new')`, which (a) felt
 * modal-like because the form slid up over the tab bar, (b) stacked multiple
 * copies on repeated taps, and (c) failed to open at all in some release
 * builds. Rendering the form as the tab's own content makes it behave
 * identically to Home / Browse / Profile.
 *
 * Deep-link / Resume entry points pass `?resumeDraftId=<id>` to reopen a
 * specific server-side draft at the step where it was paused.
 */

type SuccessKind = 'submitted' | 'draft' | null;

export default function SubmitPropertyTab() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const headerBell = useNotificationsHeader();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { resumeDraftId } = useLocalSearchParams<{ resumeDraftId?: string }>();

  const [success, setSuccess] = useState<SuccessKind>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [initialValues, setInitialValues] = useState<Partial<PropertyFormInput> | undefined>(undefined);
  const [initialStep, setInitialStep] = useState<number>(0);
  const [initialCompletedSteps, setInitialCompletedSteps] = useState<number[]>([]);
  const [bootstrapping, setBootstrapping] = useState<boolean>(!!resumeDraftId);

  const submitMut = useMutation({
    // When the user resumed a server-side draft and then submits, we POST the
    // deal AND delete the draft so it disappears from "My Drafts".
    mutationFn: async ({
      payload,
      draftIdToDelete,
    }: {
      payload: Record<string, unknown>;
      draftIdToDelete: string | null;
    }) => {
      const created = await createDeal(payload as any);
      if (draftIdToDelete) {
        await deleteDraft(draftIdToDelete).catch(() => {
          /* swallow — deal succeeded; stale draft cleanup is non-fatal */
        });
      }
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-submissions'] });
      qc.invalidateQueries({ queryKey: ['my-drafts'] });
      setSuccess('submitted');
    },
    onError: (e: any) => {
      const hasDetails = Array.isArray(e?.response?.data?.details);
      if (!hasDetails) Alert.alert('Submission failed', extractApiError(e));
    },
  });

  const createDraftMut = useMutation({
    mutationFn: createDraft,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-drafts'] }),
  });

  const updateDraftMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      updateDraft(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-drafts'] }),
  });

  const handleFormSubmit = async ({
    payload,
    asDraft,
    currentStep,
    draftId,
    setDraftId,
  }: {
    payload: PropertyFormInput;
    asDraft: boolean;
    currentStep: number;
    draftId: string | null;
    setDraftId: (id: string) => void;
  }) => {
    const body = buildDealPayload(payload, {
      email: user?.email,
      fullName: user?.name ?? '',
      phone: user?.phone ?? '',
      draftStep: asDraft ? currentStep : undefined,
    });

    if (asDraft) {
      try {
        if (draftId) {
          try {
            await updateDraftMut.mutateAsync({ id: draftId, payload: body });
          } catch (err: any) {
            const status = err?.response?.status;
            if (status === 404 || status === 410) {
              const created = await createDraftMut.mutateAsync(body);
              if (created?.id) {
                setDraftId(created.id);
                setActiveDraftId(created.id);
              }
            } else {
              throw err;
            }
          }
        } else {
          const created = await createDraftMut.mutateAsync(body);
          if (created?.id) {
            setDraftId(created.id);
            setActiveDraftId(created.id);
          }
        }
        setSuccess('draft');
        // Saving parks this draft in "My Drafts"; the live form resets to a
        // fresh property (resetAfterSaveDraft on the wizard). Drop the active
        // draft linkage too — otherwise the next submit would delete the draft
        // we just saved.
        setActiveDraftId(null);
        setInitialValues(undefined);
        setInitialStep(0);
        setInitialCompletedSteps([]);
      } catch (e) {
        Alert.alert('Could not save draft', extractApiError(e));
        throw e;
      }
      return;
    }

    await submitMut.mutateAsync({ payload: body, draftIdToDelete: activeDraftId });
  };

  const handleResumeDraft = async (draft: Draft) => {
    await clearDraft();
    const d = draft as any;
    const payload = (d.payload && typeof d.payload === 'object' && Object.keys(d.payload).length > 0
      ? d.payload
      : d) as Partial<PropertyFormInput> & { draftStep?: number };
    setActiveDraftId(draft.id);
    setInitialValues(payload);
    const resumeStep = d.draftStep ?? payload.draftStep ?? 0;
    const step = Math.max(0, Math.min(5, Number(resumeStep) || 0));
    setInitialStep(step);
    setInitialCompletedSteps(Array.from({ length: step }, (_, i) => i));
    setFormKey((k) => k + 1);
  };

  useEffect(() => {
    if (!resumeDraftId) return;
    let cancelled = false;
    (async () => {
      try {
        const draft = await getDraftById(resumeDraftId);
        if (cancelled) return;
        await handleResumeDraft(draft);
      } catch (e) {
        if (!cancelled) Alert.alert('Could not load draft', extractApiError(e));
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeDraftId]);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Add a property"
        subtitle="Step-by-step submission"
        iconName="add-circle-outline"
        onProfilePress={() => router.push('/(tabs)/profile')}
        {...headerBell}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        // Keep the keyboard open while scrolling (don't dismiss on drag).
        // Tapping outside an input still closes it via keyboardShouldPersistTaps,
        // matching the register-user page behavior.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        automaticallyAdjustKeyboardInsets
      >
        {bootstrapping ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.md }}>
              Loading your draft…
            </Text>
          </View>
        ) : (
          <MultiStepPropertyForm
            key={formKey}
            initial={initialValues}
            initialDraftId={activeDraftId}
            initialStep={initialStep}
            initialCompletedSteps={initialCompletedSteps}
            submitLabel="Submit property"
            resetAfterSaveDraft
            onSubmit={handleFormSubmit}
          />
        )}

        <DraftsList
          activeDraftId={activeDraftId}
          onResume={handleResumeDraft}
          onActiveDeleted={async () => {
            await clearDraft();
            setActiveDraftId(null);
            setInitialValues(undefined);
            setInitialStep(0);
            setInitialCompletedSteps([]);
            setFormKey((k) => k + 1);
          }}
        />
      </ScrollView>

      <SuccessModal
        visible={success === 'submitted'}
        title="Property submitted!"
        message="We've received your listing. An admin will review it shortly — you'll get an email once it's approved."
        ctaLabel="Browse properties"
        onDismiss={async () => {
          setSuccess(null);
          // Fully reset the wizard after a successful submission. The Submit
          // tab stays mounted, so without this the form would still sit on the
          // review step with the just-submitted data. Clear the local snapshot
          // and bump `formKey` to remount the form fresh at step 1.
          await clearDraft();
          setActiveDraftId(null);
          setInitialValues(undefined);
          setInitialStep(0);
          setInitialCompletedSteps([]);
          setFormKey((k) => k + 1);
          // After submission, switch to the public listings tab.
          router.replace('/(tabs)/browse');
        }}
      />

      <SuccessModal
        visible={success === 'draft'}
        title="Draft saved"
        message="Your progress is saved to My Drafts. The form has been cleared so you can start a new property."
        ctaLabel="OK"
        onDismiss={() => setSuccess(null)}
      />
      {/* No <BottomNav /> — the (tabs) layout already renders the tab bar
          natively, and stacking a second one would create a doubled UI. */}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgAlt },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
});
