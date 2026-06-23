import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Controller, useFormContext } from 'react-hook-form';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Row } from '@/components/Row';
import {
  CATEGORY_OPTIONS,
  IS_HOA_OPTIONS,
  RELATIONSHIP_OPTIONS,
  type PropertyFormInput,
} from '@/utils/propertyFormSchema';
import { radius, spacing, typography } from '@/theme';
import { useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

/** ISO (YYYY-MM-DD) for `n` days from today. */
function isoDaysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Numeric input sanitizers. We store the cleaned STRING (zod's `requiredNumber`
 * preprocess coerces it to a number on submit), so an invalid keystroke like
 * "-", "," or "." can never turn the field into a stuck `NaN`.
 */
const onlyDigits = (v: string) => v.replace(/[^0-9]/g, '');
const digitsWithDecimal = (v: string) =>
  v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');

/**
 * Step 1 — Property Information.
 * Field order, labels, and dropdown options mirror
 * admin/components/submitter/PropertyInformationSection.jsx exactly.
 *
 * `expiry_date` is a hidden auto field: on the add flow it's set to today + 20
 * days and never shown. We never overwrite an existing value, so the edit flow
 * keeps the property's original expiry date untouched.
 */
export function Step1PropertyInfo() {
  const styles = useThemedStyles(makeStyles);
  const { control, watch, getValues, setValue, formState: { errors } } =
    useFormContext<PropertyFormInput>();
  const isHOA = watch('isHOA');

  useEffect(() => {
    const current = getValues('expiry_date');
    if (!current) {
      setValue('expiry_date', isoDaysFromNow(20));
    }
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View>
      <Controller
        control={control}
        name="submitterRelationship"
        render={({ field }) => (
          <Select
            label="Your Relationship To This Property *"
            placeholder="Select an option"
            value={field.value}
            options={RELATIONSHIP_OPTIONS}
            onChange={field.onChange}
            error={errors.submitterRelationship?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="category"
        render={({ field }) => (
          <View style={styles.radioWrap}>
            <Text style={styles.radioLabel}>Property Type *</Text>
            <View style={{ gap: spacing.sm }}>
              {CATEGORY_OPTIONS.map((opt) => {
                const selected = field.value === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => field.onChange(opt.value)}
                    style={[styles.radioRow, selected && styles.radioRowSelected]}
                  >
                    <View style={[styles.radioDot, selected && styles.radioDotSelected]}>
                      {selected ? <View style={styles.radioInner} /> : null}
                    </View>
                    <Text style={[styles.radioText, selected && styles.radioTextSelected]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.category?.message ? (
              <Text style={styles.errorText}>{errors.category.message}</Text>
            ) : null}
          </View>
        )}
      />

      <Row>
        <Controller
          control={control}
          name="bedrooms"
          render={({ field }) => (
            <Input
              label="Bedrooms *"
              value={String(field.value ?? '')}
              onChangeText={(v) => field.onChange(onlyDigits(v))}
              keyboardType="number-pad"
              placeholder="e.g., 3"
              error={errors.bedrooms?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="bathrooms"
          render={({ field }) => (
            <Input
              label="Bathrooms *"
              value={String(field.value ?? '')}
              onChangeText={(v) => field.onChange(digitsWithDecimal(v))}
              keyboardType="decimal-pad"
              placeholder="e.g., 2"
              error={errors.bathrooms?.message}
            />
          )}
        />
      </Row>

      <Row>
        <Controller
          control={control}
          name="squareFootage"
          render={({ field }) => (
            <Input
              label="Square Footage *"
              value={String(field.value ?? '')}
              onChangeText={(v) => field.onChange(onlyDigits(v))}
              keyboardType="number-pad"
              placeholder="e.g., 2200"
              error={errors.squareFootage?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="yearBuilt"
          render={({ field }) => (
            <Input
              label="Year Built *"
              value={field.value == null || field.value === 0 ? '' : String(field.value)}
              onChangeText={(v) => field.onChange(onlyDigits(v))}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="e.g., 2005"
              error={errors.yearBuilt?.message}
            />
          )}
        />
      </Row>

      {/* ───── HOA ───── */}
      <Controller
        control={control}
        name="isHOA"
        render={({ field }) => (
          <Select
            label="Is This Property In An HOA?"
            placeholder="Select an option"
            value={field.value}
            options={IS_HOA_OPTIONS}
            onChange={field.onChange}
          />
        )}
      />

      {isHOA === 'yes' ? (
        <Controller
          control={control}
          name="hoaMonthlyFee"
          render={({ field }) => (
            <Input
              label="HOA Monthly Fee ($) *"
              value={field.value == null ? '' : String(field.value)}
              onChangeText={(v) => field.onChange(v === '' ? undefined : v)}
              keyboardType="numeric"
              error={errors.hoaMonthlyFee?.message}
            />
          )}
        />
      ) : null}

      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <Input
            label="Listing Description *"
            value={field.value}
            onChangeText={field.onChange}
            multiline
            numberOfLines={6}
            placeholder="Describe the property..."
            error={errors.description?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="story"
        render={({ field }) => (
          <Input
            label="Seller's Intentions"
            value={field.value}
            onChangeText={field.onChange}
            multiline
            numberOfLines={6}
            placeholder="Why is the seller selling this property at this time? What are their goals and motivations?"
            hint="Why is the seller selling this property at this time? What are their goals and motivations?"
          />
        )}
      />

      {/* ───── Property's Main Point of Contact ───── */}
      <Text style={styles.sectionHeading}>Property's Main Point of Contact</Text>

      <Controller
        control={control}
        name="contactName"
        render={({ field }) => (
          <Input
            label="Name *"
            value={field.value}
            onChangeText={field.onChange}
            placeholder="Full name"
            error={errors.contactName?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="contactPhone"
        render={({ field }) => (
          <Input
            label="Phone Number *"
            value={field.value}
            onChangeText={(v) => field.onChange(v.replace(/[^0-9]/g, ''))}
            keyboardType="phone-pad"
            placeholder="e.g., 5555555555"
            error={errors.contactPhone?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="contactRelation"
        render={({ field }) => (
          <Input
            label="Relation to Property *"
            value={field.value}
            onChangeText={field.onChange}
            placeholder="e.g., Owner, Agent, Wholesaler"
            error={errors.contactRelation?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="sourceLink"
        render={({ field }) => (
          <Input
            label="Source Link"
            value={field.value}
            onChangeText={field.onChange}
            autoCapitalize="none"
            keyboardType="url"
            placeholder="https://..."
            hint="Paste the URL to the original listing site here."
          />
        )}
      />

      {/* About Your Listing Expiration */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>🗓️ About Your Listing Expiration</Text>
        <Text style={styles.infoText}>
          Your property listing will expire 20 days from the date of submission. You will be
          notified 3 days before expiration so you can review the property details and make sure
          everything is still accurate and up to date before resubmitting.
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  sectionHeading: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  radioWrap: { marginBottom: spacing.lg },
  radioLabel: {
    ...typography.captionStrong,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    letterSpacing: 0.2,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgAlt,
  },
  radioRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  radioDotSelected: { borderColor: colors.primary },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  radioText: { ...typography.body, color: colors.text, flex: 1 },
  radioTextSelected: { color: colors.primary, fontWeight: '600' },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  infoBox: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  infoTitle: {
    ...typography.captionStrong,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  infoText: {
    ...typography.caption,
    color: colors.primary,
    lineHeight: 18,
  },
});
