import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { uploadLocalFile } from '@/api/upload';
import { extractApiError } from '@/api/client';
import { propertySchema, type PropertyInput } from '@/utils/validation';
import { radius, spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';
import type { Property } from '@/types';

export interface PropertyFormSubmit {
  payload: Partial<Property>;
  asDraft: boolean;
}

interface Props {
  initial?: Partial<Property>;
  initialImages?: string[];
  submitLabel?: string;
  showSaveDraft?: boolean;
  onSubmit: (data: PropertyFormSubmit) => Promise<unknown> | unknown;
}

export function PropertyForm({
  initial,
  initialImages = [],
  submitLabel = 'Submit property',
  showSaveDraft = true,
  onSubmit,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [images, setImages] = useState<string[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState<'submit' | 'draft' | null>(null);

  const { control, handleSubmit, getValues, formState: { errors } } = useForm<PropertyInput>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      title: initial?.title ?? '',
      description: initial?.description ?? '',
      propertyType: initial?.propertyType ?? '',
      price: initial?.price ?? 0,
      street: initial?.address?.street ?? '',
      city: initial?.address?.city ?? '',
      state: initial?.address?.state ?? '',
      country: initial?.address?.country ?? 'USA',
      zip: initial?.address?.zip ?? '',
      bedrooms: initial?.bedrooms ?? 0,
      bathrooms: initial?.bathrooms ?? 0,
      area: initial?.area ?? 0,
      // Backend returns amenities as `string | string[]` — coerce to a single
      // comma-separated string for this textarea.
      amenities: Array.isArray(initial?.amenities)
        ? (initial?.amenities ?? []).filter((s): s is string => typeof s === 'string').join(', ')
        : (initial?.amenities ?? ''),
      contactName: initial?.contactName ?? '',
      contactEmail: initial?.contactEmail ?? '',
      contactPhone: initial?.contactPhone ?? '',
    },
  });

  const buildPayload = (form: PropertyInput): Partial<Property> => ({
    title: form.title,
    description: form.description || undefined,
    propertyType: form.propertyType,
    price: form.price,
    address: {
      street: form.street,
      city: form.city,
      state: form.state,
      country: form.country,
      zip: form.zip,
    },
    bedrooms: form.bedrooms,
    bathrooms: form.bathrooms,
    area: form.area,
    amenities: form.amenities ? form.amenities.split(',').map((s) => s.trim()).filter(Boolean) : [],
    contactName: form.contactName || undefined,
    contactEmail: form.contactEmail || undefined,
    contactPhone: form.contactPhone || undefined,
    images,
  });

  const addImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to attach images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10,
    });
    if (result.canceled) return;

    setUploading(true);
    try {
      const urls = await Promise.all(
        result.assets.map((a) => uploadLocalFile(a.uri, a.mimeType || 'image/jpeg', 'properties')),
      );
      setImages((prev) => [...prev, ...urls]);
    } catch (err) {
      Alert.alert('Upload failed', extractApiError(err));
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (url: string) => setImages((prev) => prev.filter((u) => u !== url));

  const onValidSubmit = async (form: PropertyInput) => {
    setSubmitting('submit');
    try {
      await onSubmit({ payload: buildPayload(form), asDraft: false });
    } finally {
      setSubmitting(null);
    }
  };

  const onSaveDraft = async () => {
    // Drafts can be partial — bypass validation and send raw values.
    setSubmitting('draft');
    try {
      const raw = getValues();
      await onSubmit({ payload: buildPayload(raw as PropertyInput), asDraft: true });
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <View>
      <SectionTitle>Basics</SectionTitle>
      <Controller control={control} name="title" render={({ field }) => (
        <Input label="Title*" value={field.value} onChangeText={field.onChange} error={errors.title?.message} placeholder="3 BR home in Tampa" />
      )} />
      <Controller control={control} name="description" render={({ field }) => (
        <Input label="Description" value={field.value} onChangeText={field.onChange} multiline numberOfLines={4} error={errors.description?.message} />
      )} />
      <Controller control={control} name="propertyType" render={({ field }) => (
        <Input label="Property type*" value={field.value} onChangeText={field.onChange} error={errors.propertyType?.message} placeholder="Single Family / Condo / …" />
      )} />
      <Controller control={control} name="price" render={({ field }) => (
        <Input label="Price (USD)*" value={String(field.value ?? '')} onChangeText={field.onChange} keyboardType="numeric" error={errors.price?.message} />
      )} />

      <SectionTitle>Address</SectionTitle>
      <Controller control={control} name="street" render={({ field }) => (
        <Input label="Street*" value={field.value} onChangeText={field.onChange} error={errors.street?.message} />
      )} />
      <Row>
        <Controller control={control} name="city" render={({ field }) => (
          <Input label="City*" value={field.value} onChangeText={field.onChange} error={errors.city?.message} />
        )} />
        <Controller control={control} name="state" render={({ field }) => (
          <Input label="State*" value={field.value} onChangeText={field.onChange} error={errors.state?.message} />
        )} />
      </Row>
      <Row>
        <Controller control={control} name="country" render={({ field }) => (
          <Input label="Country*" value={field.value} onChangeText={field.onChange} error={errors.country?.message} />
        )} />
        <Controller control={control} name="zip" render={({ field }) => (
          <Input label="ZIP*" value={field.value} onChangeText={field.onChange} error={errors.zip?.message} />
        )} />
      </Row>

      <SectionTitle>Details</SectionTitle>
      <Row>
        <Controller control={control} name="bedrooms" render={({ field }) => (
          <Input label="Bedrooms" value={String(field.value ?? '')} onChangeText={field.onChange} keyboardType="numeric" />
        )} />
        <Controller control={control} name="bathrooms" render={({ field }) => (
          <Input label="Bathrooms" value={String(field.value ?? '')} onChangeText={field.onChange} keyboardType="numeric" />
        )} />
      </Row>
      <Controller control={control} name="area" render={({ field }) => (
        <Input label="Area (sq ft)" value={String(field.value ?? '')} onChangeText={field.onChange} keyboardType="numeric" />
      )} />
      <Controller control={control} name="amenities" render={({ field }) => (
        <Input label="Amenities (comma separated)" value={field.value} onChangeText={field.onChange} placeholder="Pool, Garage, Solar" />
      )} />

      <SectionTitle>Contact</SectionTitle>
      <Controller control={control} name="contactName" render={({ field }) => (
        <Input label="Contact name" value={field.value} onChangeText={field.onChange} />
      )} />
      <Controller control={control} name="contactEmail" render={({ field }) => (
        <Input label="Contact email" value={field.value} onChangeText={field.onChange} autoCapitalize="none" inputMode="email" error={errors.contactEmail?.message} />
      )} />
      <Controller control={control} name="contactPhone" render={({ field }) => (
        <Input label="Contact phone" value={field.value} onChangeText={field.onChange} keyboardType="phone-pad" />
      )} />

      <SectionTitle>Photos</SectionTitle>
      <FlatList
        horizontal
        data={images}
        keyExtractor={(url) => url}
        contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}
        ListEmptyComponent={
          <Text style={[typography.caption, { color: colors.textMuted }]}>No photos attached yet.</Text>
        }
        renderItem={({ item }) => (
          <Pressable onLongPress={() => removeImage(item)}>
            <Image source={{ uri: item }} style={styles.thumb} />
          </Pressable>
        )}
      />
      <Button title={uploading ? 'Uploading…' : '+ Add photos'} variant="secondary" onPress={addImages} loading={uploading} />

      <View style={{ height: spacing.xl }} />
      <Button
        title={submitLabel}
        onPress={handleSubmit(onValidSubmit)}
        loading={submitting === 'submit'}
        disabled={uploading || submitting !== null}
      />
      {showSaveDraft && (
        <Button
          title="Save as draft"
          variant="ghost"
          onPress={onSaveDraft}
          loading={submitting === 'draft'}
          disabled={uploading || submitting !== null}
          style={{ marginTop: spacing.sm }}
        />
      )}
    </View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm, letterSpacing: 1 }]}>
      {String(children).toUpperCase()}
    </Text>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      {React.Children.map(children, (c) => (
        <View style={{ flex: 1 }}>{c}</View>
      ))}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  thumb: {
    width: 96, height: 96, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgAlt,
  },
});
