import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PropertyFormInput } from '@/utils/propertyFormSchema';

/**
 * AsyncStorage parallel of the admin form's localStorage draft autosave
 * (admin/views/SubmitterView.jsx — key "submitterFormData").
 *
 *   - Saves snapshot { formData, currentStep, completedSteps, savedAt }
 *   - Saves on step navigation (Next / Back / step pill tap), NOT on every keystroke
 *   - Restored on mount, then merged onto defaults (defaults fill gaps)
 *   - Cleared after successful submission OR when explicitly saved as a draft on the server
 */

export const DRAFT_KEY = 'submitterFormData';

export interface FormDraft {
  formData: Partial<PropertyFormInput>;
  currentStep: number;
  completedSteps: number[];
  /**
   * Server-side draft id once the user has explicitly saved to the backend.
   * Survives refresh so a subsequent "Save" PUTs the same record instead of
   * creating a duplicate.
   */
  draftId?: string | null;
  savedAt: number;
}

export async function loadDraft(): Promise<FormDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FormDraft;
    if (!parsed || typeof parsed !== 'object' || !parsed.formData) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveDraft(snapshot: Omit<FormDraft, 'savedAt'>): Promise<void> {
  try {
    // Drop any File / blob-shaped media objects — only keep S3 URL strings.
    const cleanForm: Partial<PropertyFormInput> = { ...snapshot.formData };
    (['interiorImages', 'exteriorImages', 'additionalImages', 'videos'] as const).forEach((k) => {
      const arr = cleanForm[k];
      if (Array.isArray(arr)) cleanForm[k] = arr.filter((u) => typeof u === 'string') as any;
    });
    if (cleanForm.propertyPdf && typeof cleanForm.propertyPdf !== 'string') {
      cleanForm.propertyPdf = '';
    }

    const payload: FormDraft = {
      formData: cleanForm,
      currentStep: snapshot.currentStep,
      completedSteps: snapshot.completedSteps,
      draftId: snapshot.draftId ?? null,
      savedAt: Date.now(),
    };
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // Persistence failures shouldn't block the user from continuing.
  }
}

export async function clearDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch {
    /* noop */
  }
}
