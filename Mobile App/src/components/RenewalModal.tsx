import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { YesNoRow } from '@/components/property-form/YesNoRow';
import { radius, shadows, spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

export interface RenewalAnswers {
  is_property_status_changed: boolean;
  /** 'Pending' | 'Sold' — only meaningful when is_property_status_changed. */
  changed_property_status: string;
  is_financial_terms_changed: boolean;
  is_property_edit: boolean;
}

interface RenewalModalProps {
  visible: boolean;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (answers: RenewalAnswers) => void;
}

const STATUS_OPTIONS = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Sold', label: 'Sold' },
];

/**
 * Renewal questionnaire shown before re-activating an expired listing.
 *   1. Has the status of this property changed?  → if yes, Pending / Sold
 *   2. Have the financial terms of the deal changed?
 *   3. Would you like to make edits to the property?
 *
 * Any "Yes" routes the user into the Edit → Review flow; all "No" renews
 * directly. The parent decides; this component only collects answers.
 */
export function RenewalModal({ visible, loading, onCancel, onSubmit }: RenewalModalProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [q1, setQ1] = useState<'yes' | 'no' | ''>('');
  const [status, setStatus] = useState('');
  const [q2, setQ2] = useState<'yes' | 'no' | ''>('');
  const [q3, setQ3] = useState<'yes' | 'no' | ''>('');
  const [error, setError] = useState<string | null>(null);

  // Reset whenever the modal is (re)opened so a previous answer set doesn't leak.
  useEffect(() => {
    if (visible) {
      setQ1('');
      setStatus('');
      setQ2('');
      setQ3('');
      setError(null);
    }
  }, [visible]);

  const submit = () => {
    if (!q1 || !q2 || !q3) {
      setError('Please answer all questions.');
      return;
    }
    if (q1 === 'yes' && !status) {
      setError('Please select the new property status.');
      return;
    }
    setError(null);
    onSubmit({
      is_property_status_changed: q1 === 'yes',
      changed_property_status: q1 === 'yes' ? status : '',
      is_financial_terms_changed: q2 === 'yes',
      is_property_edit: q3 === 'yes',
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconRing}>
            <Ionicons name="refresh" size={26} color={colors.primary} />
          </View>
          <Text style={styles.title}>Renew listing</Text>
          <Text style={styles.subtitle}>
            A few quick questions before we re-activate this property.
          </Text>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <YesNoRow
              label="Has the status of this property changed?"
              value={q1}
              onChange={setQ1}
              required
            />
            {q1 === 'yes' ? (
              <View style={styles.statusWrap}>
                <Text style={styles.statusLabel}>Select Status *</Text>
                <View style={styles.statusRow}>
                  {STATUS_OPTIONS.map((opt) => {
                    const selected = status === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => setStatus(opt.value)}
                        style={[styles.statusOption, selected && styles.statusOptionSelected]}
                      >
                        <View style={[styles.dot, selected && styles.dotSelected]}>
                          {selected ? <View style={styles.dotInner} /> : null}
                        </View>
                        <Text style={[styles.statusText, selected && styles.statusTextSelected]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <YesNoRow
              label="Have the financial terms of the deal changed?"
              value={q2}
              onChange={setQ2}
              required
            />

            <YesNoRow
              label="Would you like to make edits to the property?"
              value={q3}
              onChange={setQ3}
              required
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.row}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={onCancel}
              disabled={loading}
              style={styles.btn}
            />
            <Button
              title="Continue"
              onPress={submit}
              loading={loading}
              disabled={loading}
              style={styles.btn}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const RING = 52;

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,20,38,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 380,
    maxHeight: '85%',
    ...shadows.cardStrong,
  },
  iconRing: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: { ...typography.h2, color: colors.text, textAlign: 'center' },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  body: { alignSelf: 'stretch' },
  statusWrap: { marginBottom: spacing.md },
  statusLabel: {
    ...typography.captionStrong,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    letterSpacing: 0.2,
  },
  statusRow: { flexDirection: 'row', gap: spacing.md },
  statusOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgAlt,
  },
  statusOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  dotSelected: { borderColor: colors.primary },
  dotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  statusText: { ...typography.body, color: colors.text },
  statusTextSelected: { color: colors.primary, fontWeight: '600' },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
    marginTop: spacing.md,
  },
  btn: { flex: 1, minHeight: 48 },
});
