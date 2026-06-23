import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { ConfirmModal } from '@/components/ConfirmModal';
import { deleteDraft, getMyDrafts } from '@/api/drafts';
import { extractApiError } from '@/api/client';
import { formatListingTitle } from '@/utils/propertyId';
import { radius, spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';
import type { Draft } from '@/types';
import { STEPS } from '@/utils/propertyFormSchema';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface DraftsListProps {
  activeDraftId: string | null;
  onResume: (draft: Draft) => void;
  /** Notify parent if the currently-active draft was deleted so it can reset state. */
  onActiveDeleted?: () => void;
  /**
   * Custom element to render when the user has zero drafts. Default behavior
   * (when omitted) is to render nothing — keeps the panel under the property
   * form unobtrusive. The standalone Drafts tab passes a friendly empty card.
   */
  emptyState?: React.ReactNode;
}

/**
 * "My Drafts" panel that appears below the property form, matching the admin
 * layout. Shows backend-saved drafts; the one currently being edited gets an
 * "Editing now" badge.
 */
export function DraftsList({ activeDraftId, onResume, onActiveDeleted, emptyState }: DraftsListProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const qc = useQueryClient();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-drafts'],
    queryFn: getMyDrafts,
  });

  const removeMut = useMutation({
    mutationFn: deleteDraft,
    onSuccess: (_data, deletedId) => {
      qc.invalidateQueries({ queryKey: ['my-drafts'] });
      if (deletedId === activeDraftId) onActiveDeleted?.();
      setPendingDeleteId(null);
    },
    onError: (e) => {
      setPendingDeleteId(null);
      setDeleteError(extractApiError(e));
    },
  });

  if (isLoading) {
    return (
      <Card style={styles.card}>
        <ActivityIndicator color={colors.primary} />
      </Card>
    );
  }
  if (error) return null;
  const drafts: Draft[] = Array.isArray(data) ? data : [];
  if (drafts.length === 0) {
    // Render the parent-supplied empty state (Drafts tab) or stay hidden
    // (panel below the create-property wizard).
    return emptyState ? <>{emptyState}</> : null;
  }

  const pendingDraft = pendingDeleteId ? drafts.find((d) => d.id === pendingDeleteId) : null;

  return (
    <>
      <Card padding="lg" style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.heading}>My Drafts</Text>
          <Text style={styles.count}>
            {drafts.length} draft{drafts.length === 1 ? '' : 's'}
          </Text>
        </View>

        <View style={{ gap: spacing.md }}>
          {drafts.map((d) => (
            <DraftRow
              key={d.id}
              draft={d}
              isActive={d.id === activeDraftId}
              onResume={() => onResume(d)}
              onDelete={() => setPendingDeleteId(d.id)}
            />
          ))}
        </View>
      </Card>

      <ConfirmModal
        visible={!!pendingDeleteId}
        title="Delete draft"
        message={
          pendingDraft
            ? `Are you sure you want to delete this draft? This cannot be undone.`
            : 'Are you sure you want to delete this draft? This cannot be undone.'
        }
        confirmLabel={removeMut.isPending ? 'Deleting…' : 'Delete'}
        cancelLabel="Cancel"
        destructive
        loading={removeMut.isPending}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => pendingDeleteId && removeMut.mutate(pendingDeleteId)}
      />

      <ConfirmModal
        visible={!!deleteError}
        title="Delete failed"
        message={deleteError ?? ''}
        confirmLabel="OK"
        cancelLabel="Close"
        onCancel={() => setDeleteError(null)}
        onConfirm={() => setDeleteError(null)}
      />
    </>
  );
}

interface DraftRowProps {
  draft: Draft;
  isActive: boolean;
  onResume: () => void;
  onDelete: () => void;
}

function DraftRow({ draft, isActive, onResume, onDelete }: DraftRowProps) {
  const styles = useThemedStyles(makeStyles);
  // The backend stores drafts FLAT (fields on the root, no `payload` wrapper)
  // but some older clients wrap. Read from whichever is populated.
  const d = draft as any;
  const p = (d.payload && typeof d.payload === 'object' && Object.keys(d.payload).length > 0
    ? d.payload
    : d) as any;
  // Compose the canonical title — "{#} {beds} Bedroom, {baths} Bathroom in
  // City, ST" — so drafts read identically to live submitter listings. Falls
  // back through the stored title, then street/category, then "Untitled draft".
  const stored = d.title ?? p.title;
  const street = p.streetAddress || p.address?.street;
  const category = p.category;

  const built = formatListingTitle({
    streetAddress: p.streetAddress,
    address: p.address,
    city: p.city,
    state: p.state,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
  });

  let title = 'Untitled draft';
  if (built) {
    title = built;
  } else if (stored && typeof stored === 'string' && stored.trim()) {
    title = stored.trim();
  } else if (street) {
    title = String(street);
  } else if (category) {
    title = String(category).replace(/_/g, ' ');
  }

  const step = d.draftStep ?? (p.draftStep as number | undefined);
  // Backend timestamps use snake_case (`updated_at` / `created_at`); axios
  // helpers may also expose camelCase. Accept whichever is present.
  const updated = draft.updatedAt ?? d.updated_at ?? draft.createdAt ?? d.created_at;
  const updatedPretty = updated ? new Date(updated).toLocaleString() : '';

  return (
    <View style={[styles.row, isActive && styles.rowActive]}>
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {isActive ? <Badge label="Editing now" tone="info" /> : null}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {step !== undefined ? `Step ${step + 1} of ${STEPS.length} · ` : ''}
          {updatedPretty ? `Last saved ${updatedPretty}` : ''}
        </Text>
      </View>

      <View style={styles.actions}>
        {/* Resume is meaningless for the draft already loaded into the form —
            tapping it would just re-hydrate the same record. Disable + relabel
            so the "Editing now" badge above isn't contradicted by an active CTA. */}
        <ActionPill
          label={isActive ? 'Editing' : 'Resume'}
          icon={isActive ? 'pencil-outline' : 'create-outline'}
          tone="primary"
          disabled={isActive}
          onPress={onResume}
        />
        <ActionPill
          label="Delete"
          icon="trash-outline"
          tone="danger"
          onPress={onDelete}
        />
      </View>
    </View>
  );
}

interface ActionPillProps {
  label: string;
  icon: IoniconsName;
  tone: 'primary' | 'danger';
  disabled?: boolean;
  onPress: () => void;
}

/**
 * Compact pill-style action button used in the drafts list, matching the
 * submitter listing pattern (icon + short label, tinted background instead of
 * a full filled button). Stays touch-friendly via a 40px min height.
 */
function ActionPill({ label, icon, tone, disabled, onPress }: ActionPillProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const palette =
    tone === 'danger'
      ? { bg: colors.dangerSoft, fg: colors.danger, border: colors.danger }
      : { bg: colors.primarySoft, fg: colors.primary, border: colors.primary };
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: palette.bg, borderColor: palette.border },
        disabled && styles.pillDisabled,
        pressed && !disabled && styles.pillPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={16} color={palette.fg} />
      <Text style={[styles.pillLabel, { color: palette.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  card: { marginTop: spacing.xl },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  heading: { ...typography.h2, color: colors.text },
  count: { ...typography.captionStrong, color: colors.primaryAccent },
  row: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.bgAlt,
  },
  rowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  title: { ...typography.bodyStrong, color: colors.text, flexShrink: 1 },
  meta: { ...typography.caption, color: colors.textMuted },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    justifyContent: 'flex-end',
  },
  actionBtn: { flex: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: 1.25,
  },
  pillDisabled: { opacity: 0.55 },
  pillPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  pillLabel: { ...typography.captionStrong, letterSpacing: 0.3 },
});
