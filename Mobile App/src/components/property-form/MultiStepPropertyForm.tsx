import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FormProvider, useForm } from 'react-hook-form';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { StepIndicator } from '@/components/StepIndicator';
import { ValidationErrorModal } from '@/components/ValidationErrorModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  defaultPropertyFormValues,
  FIELD_LABELS,
  normalizeFormSnapshot,
  stepSchemas,
  STEPS,
  type PropertyFormInput,
} from '@/utils/propertyFormSchema';
import { spacing, typography } from '@/theme';
import { useThemedStyles, type ThemeColors } from '@/context/ThemeContext';
import { useNetwork } from '@/context/NetworkContext';

import { Step1PropertyInfo } from './steps/Step1PropertyInfo';
import { Step2Location } from './steps/Step2Location';
import { Step3Financial } from './steps/Step3Financial';
import { Step4Rental } from './steps/Step4Rental';
import { Step5Media } from './steps/Step5Media';
import { Step6Review } from './steps/Step6Review';
import { clearDraft, loadDraft, saveDraft } from './draftStorage';

export interface MultiStepFormSubmit {
  payload: PropertyFormInput;
  asDraft: boolean;
  /** Current step the user is on — written into the draft so Resume opens here. */
  currentStep: number;
  /** Internal draft id, if we already created one on a previous Save. */
  draftId: string | null;
  /** Called by the parent once a fresh server draft is created so we can
   *  switch future Saves to PUT /drafts/{id} instead of creating new ones. */
  setDraftId: (id: string) => void;
}

interface Props {
  initial?: Partial<PropertyFormInput>;
  /** If editing a server draft, pass its id so subsequent saves PUT to it. */
  initialDraftId?: string | null;
  /** When resuming a draft, the step the user was on when they saved. */
  initialStep?: number;
  /** When resuming, the steps already completed (controls indicator checkmarks). */
  initialCompletedSteps?: number[];
  submitLabel?: string;
  showSaveDraft?: boolean;
  /**
   * When true, a successful "Save as draft" wipes the form back to a blank
   * step 1 (new property) instead of staying on the current draft. Used by the
   * Add-property tab so saving parks the draft in "My Drafts" and starts fresh.
   */
  resetAfterSaveDraft?: boolean;
  /**
   * Whether to use the AsyncStorage step-by-step autosave ("submitterFormData").
   * Defaults to true (the add-property flow). Edit screens pass false so a
   * previously-saved add-property snapshot can't clobber the deal being edited.
   */
  useDraftStorage?: boolean;
  onSubmit: (data: MultiStepFormSubmit) => Promise<unknown> | unknown;
}

const STEP_COMPONENTS = [
  Step1PropertyInfo,
  Step2Location,
  Step3Financial,
  Step4Rental,
  Step5Media,
  Step6Review,
];

/** Lets the Review step jump back to a specific step (Edit shortcut). */
const StepNavContext = createContext<{ goToStep: (index: number) => void }>({
  goToStep: () => {},
});
export const useStepNav = () => useContext(StepNavContext);

export function MultiStepPropertyForm({
  initial,
  initialDraftId = null,
  initialStep = 0,
  initialCompletedSteps = [],
  submitLabel = 'Submit property',
  showSaveDraft = true,
  useDraftStorage = true,
  resetAfterSaveDraft = false,
  onSubmit,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const { isOffline } = useNetwork();
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [completedSteps, setCompletedSteps] = useState<number[]>(initialCompletedSteps);
  const [submitting, setSubmitting] = useState<'submit' | 'draft' | null>(null);
  // When the AsyncStorage twin is disabled, treat the draft as already loaded
  // so persist()'s readiness gate doesn't matter.
  const [draftLoaded, setDraftLoaded] = useState(!useDraftStorage);
  const [draftId, setDraftId] = useState<string | null>(initialDraftId);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);

  /**
   * Only the truly-optional media fields are filtered out of step validation.
   * Interior + Exterior photos are required client-side (see step5Schema) so
   * we deliberately let those issues surface in the ValidationErrorModal.
   */
  const OPTIONAL_IMAGE_FIELDS = new Set([
    'additionalImages',
    'videos',
  ]);

  const filterIssues = (
    issues: { path: (string | number)[]; message: string }[],
  ) =>
    issues.filter((i) => {
      const key = String(i.path[0] ?? '');
      return !OPTIONAL_IMAGE_FIELDS.has(key);
    });

  /**
   * Build the bulleted list shown in the ValidationErrorModal. Mirrors the
   * admin's `formatErrorList` (SubmitterView.jsx) — most zod messages in
   * propertyFormSchema already start with the field name (e.g. "Bedrooms is
   * required"), so prepending the label again would render duplicated text
   * like "Bedrooms: Bedrooms is required". We only add the label prefix
   * when the message doesn't already begin with it.
   */
  const formatIssues = (issues: { path: (string | number)[]; message: string }[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const i of filterIssues(issues)) {
      const key = String(i.path[0] ?? '');
      const label = FIELD_LABELS[key] ?? key;
      const raw = (i.message ?? '').trim();
      let msg: string;
      if (!raw || raw === 'Required') {
        msg = `${label} is required`;
      } else if (raw.toLowerCase().startsWith(label.toLowerCase())) {
        // Message already names the field — use it verbatim.
        msg = raw;
      } else {
        msg = `${label}: ${raw}`;
      }
      if (!seen.has(msg)) {
        seen.add(msg);
        out.push(msg);
      }
    }
    return out;
  };

  const methods = useForm<PropertyFormInput>({
    mode: 'onSubmit',
    // Normalize the parent-supplied `initial` so null arrays / strings coming
    // back from a draft are coerced before they ever hit zod validation.
    defaultValues: {
      ...defaultPropertyFormValues,
      ...(normalizeFormSnapshot(initial as Record<string, unknown>) as Partial<PropertyFormInput>),
    },
    shouldUnregister: false,
  });

  // ─── Auto-clear validation errors when the user types/picks in a field ────
  // RHF's setError() with type 'manual' doesn't auto-clear; we subscribe to
  // form changes and clear the error for the field that just changed.
  useEffect(() => {
    const sub = methods.watch((_, info) => {
      if (info.name) methods.clearErrors(info.name as keyof PropertyFormInput);
    });
    return () => sub.unsubscribe();
  }, [methods]);

  // ─── Defensive re-hydration of edit-mode initial values ──────────────────
  // `useForm({ defaultValues })` only reads defaults at first render. Some
  // collapsed-by-default Controllers (Amenities, Local Attractions) mount
  // later, and in certain edge cases the initial values weren't reflected in
  // the field's `value` even though they were in defaultValues. Force a
  // one-time reset right after mount in edit mode so every field — including
  // those inside collapsibles — is guaranteed to display the server data.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (useDraftStorage) return;          // add-property flow handles its own restore
    if (hydratedRef.current) return;       // run exactly once per mount
    if (!initial) return;                  // nothing to hydrate from yet
    hydratedRef.current = true;
    methods.reset({
      ...defaultPropertyFormValues,
      ...(normalizeFormSnapshot(initial as Record<string, unknown>) as Partial<PropertyFormInput>),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  // ─── Draft autosave (AsyncStorage twin of admin's submitterFormData) ─────
  // Only runs in the add-property flow. Edit screens disable this so a stale
  // add-property snapshot doesn't overwrite the deal/draft they're editing.
  useEffect(() => {
    if (!useDraftStorage) return;
    let cancelled = false;
    loadDraft().then((draft) => {
      if (cancelled) return;
      if (draft) {
        const normalized = normalizeFormSnapshot(draft.formData as Record<string, unknown>);
        methods.reset({
          ...defaultPropertyFormValues,
          ...(normalizeFormSnapshot(initial as Record<string, unknown>) as Partial<PropertyFormInput>),
          ...(normalized as Partial<PropertyFormInput>),
        });
        setCurrentStep(draft.currentStep ?? 0);
        setCompletedSteps(draft.completedSteps ?? []);
        // Restoring the saved draftId means a subsequent "Save" after refresh
        // updates the existing server record instead of creating a duplicate.
        if (draft.draftId && !initialDraftId) {
          setDraftId(draft.draftId);
        }
      }
      setDraftLoaded(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (nextStep: number, nextCompleted: number[]) => {
    if (!useDraftStorage) return;
    if (!draftLoaded) return;
    saveDraft({
      formData: methods.getValues(),
      currentStep: nextStep,
      completedSteps: nextCompleted,
      draftId,
    });
  };

  const goNext = async () => {
    const stepSchema = stepSchemas[currentStep];
    const values = methods.getValues();
    const result = stepSchema.safeParse(values);

    if (!result.success) {
      // Drop optional-image "Required" issues — if those are the ONLY
      // problems, the user should still be allowed to advance.
      const realIssues = filterIssues(result.error.issues);

      if (realIssues.length > 0) {
        methods.clearErrors();
        realIssues.forEach((issue) => {
          const path = issue.path[0] as keyof PropertyFormInput;
          if (path) methods.setError(path, { type: 'manual', message: issue.message });
        });
        // Surface ALL real errors in a bulleted modal (matches admin's "Required Fields" dialog).
        setValidationErrors(formatIssues(realIssues));
        return;
      }
      // Only phantom image issues — fall through and advance.
    }

    methods.clearErrors();
    const newCompleted = completedSteps.includes(currentStep)
      ? completedSteps
      : [...completedSteps, currentStep];
    const newStep = Math.min(currentStep + 1, STEPS.length - 1);
    setCompletedSteps(newCompleted);
    setCurrentStep(newStep);
    persist(newStep, newCompleted);
  };

  const goBack = () => {
    methods.clearErrors();
    const newStep = Math.max(currentStep - 1, 0);
    setCurrentStep(newStep);
    persist(newStep, completedSteps);
  };

  // Reset the whole wizard back to a blank step 1 — mirrors the web
  // SubmitterView's "Reset" button. Wipes every field, clears the saved
  // draft + AsyncStorage snapshot, and drops any draft-edit linkage.
  const handleReset = () => {
    methods.reset(defaultPropertyFormValues);
    methods.clearErrors();
    setCompletedSteps([]);
    setCurrentStep(0);
    setDraftId(null);
    setValidationErrors([]);
    if (useDraftStorage) clearDraft();
    setConfirmReset(false);
  };

  const handleFinalSubmit = async () => {
    setSubmitting('submit');
    try {
      const values = methods.getValues();
      // No client-side pre-submit validation here: the backend's Joi schema
      // is the authoritative check. If it rejects, surface the returned
      // `details` list in the same ValidationErrorModal.
      try {
        await onSubmit({
          payload: values,
          asDraft: false,
          currentStep,
          draftId,
          setDraftId,
        });
        // Only clear the add-property AsyncStorage snapshot when this form
        // owns it. Otherwise we'd wipe an unrelated in-progress add-property
        // draft just because the user submitted an edit.
        if (useDraftStorage) await clearDraft();
      } catch (err: any) {
        const data = err?.response?.data;
        const details = Array.isArray(data?.details) ? data.details : null;
        if (details && details.length > 0) {
          setValidationErrors(
            details.map((d: { field?: string; message?: string }) => {
              const label = (d.field && FIELD_LABELS[d.field]) || d.field || 'Field';
              const msg = d.message ?? 'Required';
              return msg.includes(label) ? msg : `${label}: ${msg}`;
            }),
          );
        }
        // Re-throw so the parent's mutation onError can also fire its own
        // Alert / toast if it wants — but our modal is the user-visible one.
        throw err;
      }
    } finally {
      setSubmitting(null);
    }
  };

  const handleSaveDraft = async () => {
    // Mirror admin: on the FIRST step, all required fields must be valid
    // before we let the user persist a draft. Later steps may save with
    // partially-filled data (the user is mid-wizard).
    if (currentStep === 0) {
      const stepSchema = stepSchemas[0];
      const result = stepSchema.safeParse(methods.getValues());
      if (!result.success) {
        methods.clearErrors();
        result.error.issues.forEach((issue) => {
          const path = issue.path[0] as keyof PropertyFormInput;
          if (path) methods.setError(path, { type: 'manual', message: issue.message });
        });
        setValidationErrors(formatIssues(result.error.issues));
        return;
      }
    }
    setSubmitting('draft');
    try {
      await onSubmit({
        payload: methods.getValues(),
        asDraft: true,
        currentStep,
        draftId,
        setDraftId: (id: string) => {
          setDraftId(id);
          // Also write the new id into the AsyncStorage snapshot immediately
          // so a refresh-then-save picks up the same record. Skip when the
          // AsyncStorage twin is disabled (edit flow).
          if (useDraftStorage) {
            saveDraft({
              formData: methods.getValues(),
              currentStep,
              completedSteps,
              draftId: id,
            });
          }
        },
      });
      if (resetAfterSaveDraft) {
        // Add-property flow: the draft is now parked in "My Drafts" — wipe the
        // wizard back to a blank step 1 so the user starts a fresh property.
        handleReset();
      } else {
        // Re-persist with the (possibly already-set) draftId so future saves PUT.
        persist(currentStep, completedSteps);
      }
    } finally {
      setSubmitting(null);
    }
  };

  const StepComponent = STEP_COMPONENTS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <FormProvider {...methods}>
      <View style={styles.container}>
        <Card padding="sm" style={styles.indicatorCard}>
          <StepIndicator
            steps={STEPS}
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepPress={(idx) => {
              if (idx <= currentStep || completedSteps.includes(idx)) {
                setCurrentStep(idx);
                persist(idx, completedSteps);
              }
            }}
          />
        </Card>

        <Card padding="lg" style={styles.contentCard}>
          <Text style={styles.eyebrow}>
            STEP {currentStep + 1} OF {STEPS.length}
          </Text>
          <Text style={styles.stepTitle}>{STEPS[currentStep].label}</Text>
          <StepNavContext.Provider
            value={{
              goToStep: (idx) => {
                if (idx < 0 || idx >= STEPS.length) return;
                setCurrentStep(idx);
                persist(idx, completedSteps);
              },
            }}
          >
            <StepComponent />
          </StepNavContext.Provider>
        </Card>

        <View style={styles.navRow}>
          <Button
            title="← Back"
            variant="secondary"
            onPress={goBack}
            disabled={currentStep === 0 || submitting !== null}
            style={styles.navBtn}
          />
          {isLastStep ? (
            <Button
              title={submitLabel}
              onPress={handleFinalSubmit}
              loading={submitting === 'submit'}
              // Submitting needs the network — block it while offline so the
              // user gets the disabled state + hint instead of a failed POST.
              disabled={submitting !== null || isOffline}
              style={styles.navBtnPrimary}
            />
          ) : (
            <Button
              title="Next →"
              onPress={goNext}
              disabled={submitting !== null}
              style={styles.navBtnPrimary}
            />
          )}
        </View>

        {showSaveDraft && (
          <Button
            title={draftId ? 'Update saved draft' : 'Save as draft'}
            variant="secondary"
            icon={draftId ? 'sync-outline' : 'save-outline'}
            onPress={handleSaveDraft}
            loading={submitting === 'draft'}
            disabled={submitting !== null || isOffline}
            style={styles.saveDraftBtn}
          />
        )}

        {isOffline && (
          <Text style={styles.offlineHint}>
            You're offline — connect to the internet to submit or save.
          </Text>
        )}

        {showSaveDraft && (
          <Button
            title="Reset form"
            variant="dangerGhost"
            icon="refresh-outline"
            onPress={() => setConfirmReset(true)}
            disabled={submitting !== null}
            style={styles.resetBtn}
          />
        )}
      </View>

      <ValidationErrorModal
        visible={validationErrors.length > 0}
        errors={validationErrors}
        onDismiss={() => setValidationErrors([])}
      />

      <ConfirmModal
        visible={confirmReset}
        title="Reset form?"
        message="This clears every field across all steps and starts a fresh submission. This can't be undone."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(false)}
      />
    </FormProvider>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: { paddingBottom: spacing.xxl },
  indicatorCard: { marginBottom: spacing.md },
  contentCard: {},
  eyebrow: {
    ...typography.captionStrong,
    color: colors.primary,
    letterSpacing: 1.5,
    fontSize: 11,
  },
  stepTitle: {
    ...typography.h2,
    color: colors.text,
    marginTop: 2,
    marginBottom: spacing.md,
    letterSpacing: -0.3,
  },
  navRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  navBtn: { flex: 1, minHeight: 52 },
  navBtnPrimary: { flex: 2, minHeight: 52 },
  // Secondary actions stack full-width below the Back/Next row so every button
  // shares the same width — a cleaner, more balanced footer than mixed widths.
  saveDraftBtn: { marginTop: spacing.md, alignSelf: 'stretch' },
  resetBtn: { marginTop: spacing.sm, alignSelf: 'stretch' },
  offlineHint: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
