import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { MultiStepPropertyForm } from '@/components/property-form/MultiStepPropertyForm';
import { BottomNav, BOTTOM_NAV_HEIGHT } from '@/components/BottomNav';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SuccessModal } from '@/components/SuccessModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { createDeal, getDealById, updateMyDeal } from '@/api/deals';
import { createDraft, deleteDraft, getDraftById, updateDraft } from '@/api/drafts';
import { extractApiError } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { buildDealPayload } from '@/utils/buildDealPayload';
import { isoDaysFromNow } from '@/utils/expiry';
import type { PropertyFormInput } from '@/utils/propertyFormSchema';
import { spacing } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

/**
 * Edit screen — two modes:
 *   - ?id=<dealId>   → editing an already-submitted property (PATCH /deals/:id)
 *   - ?draftId=<id>  → resuming a draft. The Save Draft button PUTs to /drafts/:id,
 *                       the Submit button POSTs /deals AND deletes the draft.
 *
 * Uses the same MultiStepPropertyForm as `/properties/new` so the UI is
 * identical to creation — section-by-section steps + step indicator + draft
 * autosave (when in draft mode) + validation-error modal.
 */
export default function EditPropertyScreen() {
  const {
    id,
    draftId,
    renew,
    is_property_status_changed,
    changed_property_status,
    is_financial_terms_changed,
    is_property_edit,
  } = useLocalSearchParams<{
    id?: string;
    draftId?: string;
    renew?: string;
    is_property_status_changed?: string;
    changed_property_status?: string;
    is_financial_terms_changed?: string;
    is_property_edit?: string;
  }>();
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  // Renewal mode: opened from the Renew flow when the user answered "Yes" to a
  // question. We jump straight to the Review step and, on save, stamp the
  // renewal answers + a fresh 20-day expiry and clear the expired flag.
  const isRenew = renew === '1';
  const router = useRouter();
  const navigation = useNavigation();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isDraftMode = !!draftId;
  // Fallback to Browse if we got here via a deep link with no stack history.
  const goBack = () => {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/browse');
    }
  };

  const [successKind, setSuccessKind] = useState<'submitted' | 'updated' | 'draft' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const dealQ = useQuery({
    queryKey: ['deal', id],
    queryFn: () => getDealById(id!),
    enabled: !!id,
  });

  const draftQ = useQuery({
    queryKey: ['draft', draftId],
    queryFn: () => getDraftById(draftId!),
    enabled: isDraftMode,
  });

  const updateDealMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateMyDeal(id!, payload as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-submissions'] });
      qc.invalidateQueries({ queryKey: ['deal', id] });
      setSuccessKind('updated');
    },
    onError: (e) => setErrorMsg(extractApiError(e)),
  });

  const submitFromDraftMut = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const created = await createDeal(payload as any);
      if (draftId) await deleteDraft(draftId).catch(() => {});
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-submissions'] });
      qc.invalidateQueries({ queryKey: ['my-drafts'] });
      setSuccessKind('submitted');
    },
    onError: (e) => setErrorMsg(extractApiError(e)),
  });

  const saveDraftMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) => updateDraft(draftId!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-drafts'] });
      setSuccessKind('draft');
    },
    onError: (e) => setErrorMsg(extractApiError(e)),
  });

  // Fallback for the rare case where the draft id query param is missing on a
  // resumed draft — never expected, but guard against it.
  const createDraftFallbackMut = useMutation({
    mutationFn: createDraft,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-drafts'] }),
    onError: (e) => setErrorMsg(extractApiError(e)),
  });

  const loading = (id && dealQ.isLoading) || (isDraftMode && draftQ.isLoading);
  // Drafts are stored FLAT on the backend (no `payload` wrapper). Older
  // clients wrapped them, so accept whichever shape carries the real fields.
  const rawDraft = draftQ.data as any;
  const initial = (
    isDraftMode
      ? (rawDraft?.payload && typeof rawDraft.payload === 'object' && Object.keys(rawDraft.payload).length > 0
          ? rawDraft.payload
          : rawDraft)
      : dealQ.data
  ) as Partial<PropertyFormInput> | undefined;
  // Always land on step 1 when the Edit page opens — even when resuming a
  // draft. The user explicitly preferred this UX so they can review/edit
  // from the top. The step indicator's icons remain clickable so they can
  // jump straight to any section if they want.
  //
  // Exception: the renewal flow opens directly on the Review step (index 5).
  const initialStep = isRenew ? 5 : 0;
  // All 6 steps are tappable: drafts have likely covered earlier steps;
  // submitted properties have valid data everywhere.
  const initialCompletedSteps = [0, 1, 2, 3, 4, 5];

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!initial) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={{ color: colors.danger }}>Could not load property</Text>
      </View>
    );
  }

  const handleSubmit = async ({
    payload,
    asDraft,
    currentStep,
    draftId: liveDraftId,
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
      // Saving a draft: prefer the draft id from the URL, fall back to the
      // form's own tracked id, then create a new one.
      const effectiveId = draftId || liveDraftId;
      if (effectiveId) {
        await saveDraftMut.mutateAsync(body);
      } else {
        const created = await createDraftFallbackMut.mutateAsync(body);
        if (created?.id) setDraftId(created.id);
      }
      return;
    }

    if (isDraftMode) {
      // Final submit from a draft → POST /deals + delete the draft.
      await submitFromDraftMut.mutateAsync(body);
      return;
    }

    // Editing an already-submitted property → PATCH /deals/:id.
    // In renewal mode, stamp the questionnaire answers, extend the expiry by
    // 20 days, and clear the expired flag so the listing goes live again.
    const finalBody = isRenew
      ? {
          ...body,
          // Persist the answers as real booleans.
          is_property_status_changed: is_property_status_changed === 'true',
          is_financial_terms_changed: is_financial_terms_changed === 'true',
          is_property_edit: is_property_edit === 'true',
          // When the status changed, write it straight into the `status` column
          // as lowercase 'pending' / 'sold'.
          ...(is_property_status_changed === 'true' && changed_property_status
            ? { status: String(changed_property_status).toLowerCase() }
            : {}),
          expiry_date: isoDaysFromNow(20),
          expired_status: false,
        }
      : body;
    await updateDealMut.mutateAsync(finalBody);
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={isDraftMode ? 'Finish your submission' : 'Edit listing'}
        subtitle={
          isDraftMode
            ? 'Pick up where you left off'
            : 'Section-by-section editing'
        }
        onBack={goBack}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        <MultiStepPropertyForm
          initial={initial}
          initialDraftId={draftId ?? null}
          initialStep={initialStep}
          initialCompletedSteps={initialCompletedSteps}
          submitLabel={isDraftMode ? 'Submit property' : isRenew ? 'Renew listing' : 'Save changes'}
          showSaveDraft={isDraftMode}
          // Edit screens never read/write the add-property AsyncStorage
          // snapshot — otherwise opening Edit on a property would show
          // whatever the user last typed into the "Add property" wizard.
          useDraftStorage={false}
          onSubmit={handleSubmit}
        />
      </ScrollView>

      <SuccessModal
        visible={successKind === 'submitted'}
        title="Property submitted!"
        message="Your listing has been submitted for review."
        ctaLabel="Browse properties"
        onDismiss={() => {
          setSuccessKind(null);
          // Land on the public listings after a successful submission
          // (matches the create-flow behavior).
          router.replace('/(tabs)/browse');
        }}
      />

      <SuccessModal
        visible={successKind === 'updated'}
        title={isRenew ? 'Listing renewed' : 'Changes saved'}
        message={
          isRenew
            ? 'Your changes were saved and the listing is active again — it will expire in 20 days.'
            : 'Your property has been updated.'
        }
        ctaLabel="Browse properties"
        onDismiss={() => {
          setSuccessKind(null);
          // Same destination as a fresh submit — user explicitly asked
          // for the browse page after both create and update.
          router.replace('/(tabs)/browse');
        }}
      />

      <SuccessModal
        visible={successKind === 'draft'}
        title="Draft updated"
        message="Your progress is safe. Come back anytime to finish."
        ctaLabel="Continue editing"
        onDismiss={() => setSuccessKind(null)}
      />

      <ConfirmModal
        visible={!!errorMsg}
        title={isDraftMode ? 'Could not save' : 'Update failed'}
        message={errorMsg ?? ''}
        confirmLabel="OK"
        cancelLabel="Close"
        onCancel={() => setErrorMsg(null)}
        onConfirm={() => setErrorMsg(null)}
      />

      <BottomNav />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgAlt },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl + BOTTOM_NAV_HEIGHT,
  },
});
