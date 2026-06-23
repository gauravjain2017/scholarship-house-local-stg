import React from 'react';
import { View } from 'react-native';
import { Controller, useFormContext } from 'react-hook-form';
import { Input } from '@/components/Input';
import { ImageGrid } from '@/components/ImageGrid';
import type { PropertyFormInput } from '@/utils/propertyFormSchema';

/**
 * Step 5 — Photos & Media.
 *
 * All four image groups are optional client-side — the backend's Joi schema
 * is the authority on whether a final submission is allowed. We surface
 * any server-side validation in the ValidationErrorModal so the user sees
 * what's missing without us blocking the form locally.
 */
export function Step5Media() {
  const { control } = useFormContext<PropertyFormInput>();

  return (
    <View>
      <Controller
        control={control}
        name="coverPhoto"
        render={({ field, fieldState }) => (
          <ImageGrid
            label="Cover Photo *"
            value={field.value ?? []}
            onChange={field.onChange}
            mediaType="image"
            folder="properties/cover"
            max={1}
            error={fieldState.error?.message}
            hint="Only 1 image allowed. Used as the primary display image on the website."
          />
        )}
      />

      <Controller
        control={control}
        name="interiorImages"
        render={({ field, fieldState }) => (
          <ImageGrid
            label="Interior Photos"
            value={field.value ?? []}
            onChange={field.onChange}
            mediaType="image"
            folder="properties/interior"
            error={fieldState.error?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="exteriorImages"
        render={({ field, fieldState }) => (
          <ImageGrid
            label="Exterior Photos"
            value={field.value ?? []}
            onChange={field.onChange}
            mediaType="image"
            folder="properties/exterior"
            error={fieldState.error?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="additionalImages"
        render={({ field }) => (
          <ImageGrid
            label="Additional Photos"
            value={field.value ?? []}
            onChange={field.onChange}
            mediaType="image"
            folder="properties/additional"
          />
        )}
      />

      <Controller
        control={control}
        name="videos"
        render={({ field }) => (
          <ImageGrid
            label="Videos"
            value={field.value ?? []}
            onChange={field.onChange}
            mediaType="video"
            folder="properties/videos"
            hint="Tap + to pick a video from your library. We'll upload and link it automatically."
          />
        )}
      />

      <Controller
        control={control}
        name="additionalInfo"
        render={({ field }) => (
          <Input
            label="Additional Information"
            value={field.value}
            onChangeText={field.onChange}
            multiline
            numberOfLines={4}
            placeholder="Add any extra notes, context, or information here..."
          />
        )}
      />
    </View>
  );
}
