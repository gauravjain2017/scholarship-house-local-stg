import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { uploadLocalFile } from '@/api/upload';
import { extractApiError } from '@/api/client';
import { radius, spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

interface DocumentUploadProps {
  label: string;
  value: string[]; // public S3 URLs (what gets submitted)
  onChange: (next: string[]) => void;
  hint?: string;
  error?: string;
  folder?: string;
}

interface Pending {
  id: string;
  name: string;
}

// PDF, Excel (.xls/.xlsx), CSV, and images — matches the submitter's
// `accept=".pdf,.xls,.xlsx,.csv,image/*"`.
const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/comma-separated-values',
  'image/*',
];

/** Derive a human-friendly file name from an S3 URL (strips query + path). */
function nameFromUrl(url: string): string {
  try {
    const noQuery = url.split('?')[0];
    return decodeURIComponent(noQuery.split('/').pop() || 'document');
  } catch {
    return 'document';
  }
}

function iconFor(name: string): React.ComponentProps<typeof Ionicons>['name'] {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'document-text-outline';
  if (lower.endsWith('.csv') || lower.endsWith('.xls') || lower.endsWith('.xlsx'))
    return 'grid-outline';
  if (/\.(png|jpe?g|gif|webp|heic)$/.test(lower)) return 'image-outline';
  return 'document-outline';
}

/**
 * Document picker + uploader for PDF / Excel / CSV / image files.
 * Mirrors admin/components/submitter/RentalDataSection.jsx's STR financial-doc
 * upload: a drop target (here a button) plus a list of uploaded files with a
 * Remove action. The form state holds ONLY S3 URLs, so the payload is correct.
 */
export function DocumentUpload({
  label,
  value,
  onChange,
  hint,
  error,
  folder = 'properties/documents',
}: DocumentUploadProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [pending, setPending] = useState<Pending[]>([]);
  // Mirror the latest committed value so concurrent upload callbacks read the
  // freshest list (same race fix as ImageGrid).
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const pick = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ACCEPTED_TYPES,
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;

    const newPending: Pending[] = result.assets.map((a, i) => ({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
      name: a.name || 'document',
    }));
    setPending((p) => [...p, ...newPending]);

    result.assets.forEach(async (asset, idx) => {
      const p = newPending[idx];
      try {
        const url = await uploadLocalFile(
          asset.uri,
          asset.mimeType || 'application/octet-stream',
          folder,
        );
        const next = [...valueRef.current, url];
        valueRef.current = next;
        onChange(next);
        setPending((prev) => prev.filter((x) => x.id !== p.id));
      } catch (err) {
        setPending((prev) => prev.filter((x) => x.id !== p.id));
        Alert.alert('Upload failed', extractApiError(err));
      }
    });
  };

  const remove = (url: string) => onChange(value.filter((u) => u !== url));

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>

      {value.map((url) => {
        const name = nameFromUrl(url);
        return (
          <View key={url} style={styles.fileRow}>
            <Ionicons name={iconFor(name)} size={18} color={colors.primary} />
            <Pressable style={styles.fileNameWrap} onPress={() => Linking.openURL(url)}>
              <Text style={styles.fileName} numberOfLines={1}>
                {name}
              </Text>
            </Pressable>
            <Pressable onPress={() => remove(url)} hitSlop={8}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        );
      })}

      {pending.map((p) => (
        <View key={p.id} style={styles.fileRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.fileName, styles.fileNameWrap]} numberOfLines={1}>
            {p.name}
          </Text>
        </View>
      ))}

      <Pressable onPress={pick} style={styles.addBtn}>
        <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
        <Text style={styles.addBtnText}>Upload Document</Text>
      </Pressable>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: {
    ...typography.captionStrong,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    letterSpacing: 0.2,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    marginBottom: spacing.sm,
  },
  fileNameWrap: { flex: 1 },
  fileName: { ...typography.body, color: colors.text },
  removeText: { ...typography.caption, color: colors.danger, fontWeight: '600' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  addBtnText: { ...typography.bodyStrong, color: colors.primary },
  errorText: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
  hintText: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
