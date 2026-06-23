import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { uploadLocalFile } from '@/api/upload';
import { extractApiError } from '@/api/client';
import { radius, spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

interface ImageGridProps {
  label: string;
  value: string[]; // public S3 URLs (what gets submitted)
  onChange: (next: string[]) => void;
  error?: string;
  hint?: string;
  mediaType?: 'image' | 'video';
  folder?: string;
  max?: number;
}

interface PendingUpload {
  id: string;
  localUri: string;
}

/**
 * Tile grid for picking & uploading photos/videos.
 *
 * Display strategy:
 *   - During upload: local URI thumbnail with spinner overlay
 *   - After upload: render the local URI again (kept in a session-only ref)
 *     instead of fetching from S3 — avoids CORS / mixed-content / cache lag
 *     issues that would otherwise leave the tile blank on the web preview.
 *   - The form state still contains ONLY S3 URLs, so the backend payload is
 *     correct.
 *
 * Falls back to the S3 URL if there's no local URI in memory (e.g. a draft
 * resumed from the server).
 */
export function ImageGrid({
  label,
  value,
  onChange,
  error,
  hint,
  mediaType = 'image',
  folder = 'properties',
  max,
}: ImageGridProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  // True while the picker is open / selected assets are being prepared, so we
  // can show an immediate loader before the per-tile upload spinners appear.
  const [processing, setProcessing] = useState(false);
  // S3 URL → local file URI used for the immediate-preview swap-in.
  // Resets when the component unmounts; not persisted.
  const localPreviews = useRef<Record<string, string>>({});
  // Mirror the latest committed `value` so concurrent upload callbacks read
  // the freshest list. Without this, parallel uploads each call
  // `onChange([...value, url])` with the SAME stale closure-captured `value`
  // and last-write-wins drops all but one URL — which manifested as picked
  // images "disappearing" after selection.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Don't show a "Required" error after the user already has at least one item.
  const showError = !!error && value.length === 0;

  /** Shared post-pick handler — turns ImagePicker assets into pending tiles
   *  and uploads each one to S3, then swaps the URL into form state. */
  const handlePickedAssets = (assets: ImagePicker.ImagePickerAsset[]) => {
    if (!assets || assets.length === 0) return;

    const newPending: PendingUpload[] = assets.map((a) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      localUri: a.uri,
    }));
    setPending((p) => [...p, ...newPending]);

    newPending.forEach(async (p, idx) => {
      const asset = assets[idx];
      try {
        const url = await uploadLocalFile(
          asset.uri,
          asset.mimeType || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg'),
          folder,
        );
        // Remember the local URI for this S3 URL so the tile renders something
        // even if the S3 fetch is slow / CORS-blocked on web preview.
        localPreviews.current[url] = asset.uri;
        // Append to the ref's current list (which already includes siblings
        // that resolved earlier in the same batch) and mutate it synchronously
        // BEFORE calling onChange, so a sibling completing right after also
        // sees this url.
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

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access in Settings to upload.');
      return;
    }

    setProcessing(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes:
          mediaType === 'video'
            ? ImagePicker.MediaTypeOptions.Videos
            : ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: mediaType !== 'video',
        quality: 0.85,
        selectionLimit: max ? Math.max(1, max - value.length - pending.length) : 10,
      });
      if (result.canceled) return;
      handlePickedAssets(result.assets);
    } finally {
      setProcessing(false);
    }
  };

  const takeWithCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow camera access in Settings to take photos.');
      return;
    }

    setProcessing(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes:
          mediaType === 'video'
            ? ImagePicker.MediaTypeOptions.Videos
            : ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
      if (result.canceled) return;
      handlePickedAssets(result.assets);
    } finally {
      setProcessing(false);
    }
  };

  const pick = () => {
    if (max !== undefined && value.length + pending.length >= max) {
      Alert.alert('Limit reached', `You can upload up to ${max} item${max === 1 ? '' : 's'}.`);
      return;
    }

    // Native action sheet style chooser. Three-button Alert renders as a
    // bottom sheet on Android and a centered dialog on iOS — both surface
    // "Take Photo" alongside "Choose from Library", matching common mobile UX.
    const takeLabel = mediaType === 'video' ? 'Record Video' : 'Take Photo';
    const libraryLabel = mediaType === 'video' ? 'Choose Video' : 'Choose from Library';

    Alert.alert(
      mediaType === 'video' ? 'Add video' : 'Add photo',
      undefined,
      [
        { text: takeLabel, onPress: takeWithCamera },
        { text: libraryLabel, onPress: pickFromLibrary },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true },
    );
  };

  const remove = (url: string) => {
    delete localPreviews.current[url];
    onChange(value.filter((u) => u !== url));
  };

  // Source-URI resolver: prefer the in-memory local URI, fall back to S3.
  const previewFor = (url: string) => localPreviews.current[url] ?? url;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.grid}>
        {/* Uploaded — display local URI when we have it */}
        {value.map((url) => (
          <View key={url} style={styles.tile}>
            {mediaType === 'video' ? (
              <View style={[styles.media, styles.videoTile]}>
                <Ionicons name="play-circle" size={36} color="#fff" />
              </View>
            ) : (
              <Image
                source={{ uri: previewFor(url) }}
                style={styles.media}
                resizeMode="cover"
              />
            )}
            <Pressable style={styles.remove} onPress={() => remove(url)} hitSlop={6}>
              <Ionicons name="close" size={14} color="#fff" />
            </Pressable>
          </View>
        ))}

        {/* In-flight uploads — local thumbnail with spinner overlay */}
        {pending.map((p) => (
          <View key={p.id} style={styles.tile}>
            {mediaType === 'video' ? (
              <View style={[styles.media, styles.videoTile]}>
                <Ionicons name="play-circle" size={36} color="#fff" />
              </View>
            ) : (
              <Image source={{ uri: p.localUri }} style={styles.media} resizeMode="cover" />
            )}
            <View style={styles.uploadOverlay}>
              <ActivityIndicator color="#fff" />
            </View>
          </View>
        ))}

        {/* Immediate loader while the picker prepares the selected assets. */}
        {processing ? (
          <View style={[styles.tile, styles.loadingTile]}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingLabel}>Loading…</Text>
          </View>
        ) : null}

        <Pressable
          onPress={pick}
          style={[styles.tile, styles.addTile]}
          disabled={processing || (max !== undefined && value.length + pending.length >= max)}
        >
          <Ionicons name="add" size={28} color={colors.primary} />
          <Text style={styles.addLabel}>Add</Text>
        </Pressable>
      </View>

      {showError ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

const TILE = 92;

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: {
    ...typography.captionStrong,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    letterSpacing: 0.2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.bgAlt,
    position: 'relative',
  },
  media: { width: '100%', height: '100%' },
  videoTile: {
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTile: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: {
    ...typography.tiny,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  loadingTile: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLabel: {
    ...typography.tiny,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 4,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,20,38,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(11,20,38,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
  hintText: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
