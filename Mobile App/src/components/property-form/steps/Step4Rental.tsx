import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Controller, useFormContext } from 'react-hook-form';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { MultiSelectChips } from '@/components/MultiSelectChips';
import { Collapsible } from '@/components/Collapsible';
import { DocumentUpload } from '@/components/DocumentUpload';
import { YesNoRow } from '../YesNoRow';
import { radius, spacing, typography } from '@/theme';
import { useThemedStyles, type ThemeColors } from '@/context/ThemeContext';
import {
  STR_BOOKING_PLATFORM_OPTIONS,
  STR_CONFIDENCE_OPTIONS,
  STR_ZONING_OPTIONS,
  TRAVEL_MOTIVATIONS,
  TURNKEY_OPTIONS,
  VACATION_RENTAL_MARKETS,
  YES_NO_OPTIONS,
  type PropertyFormInput,
} from '@/utils/propertyFormSchema';

/**
 * Decimal-input sanitizer — keeps the raw string in form state so a trailing
 * "." (mid-typing "7.5") and trailing zeros ("7.50") survive between
 * keystrokes. zod's `optionalNumericish` + buildDealPayload's `numOrNull`
 * coerce strings → numbers at submit.
 */
function sanitizeDecimal(v: string): string | undefined {
  if (v === '') return undefined;
  let cleaned = v.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    cleaned =
      cleaned.slice(0, firstDot + 1) +
      cleaned.slice(firstDot + 1).replace(/\./g, '');
  }
  return cleaned === '' ? undefined : cleaned;
}

/**
 * Step 4 — Short-Term Rental Data.
 * Mirrors admin/components/submitter/RentalDataSection.jsx +
 *   MarketMotivationSection.jsx (collapsible) +
 *   AmenitiesAttractionsSection.jsx (collapsible).
 *
 * Conditional flow:
 *   STR Zoning (required) → warning when NO/UNSURE
 *   Is it currently operating as an STR? (required)
 *     yes → Listing link, Turnkey/Furnished, "Have STR financials?"
 *       yes → financial docs, data-sheet link, key metrics, booking platform,
 *             current bookings (+ description)
 *   Data Confidence (required), markets, travel motivations, collapsibles.
 */
export function Step4Rental() {
  const styles = useThemedStyles(makeStyles);
  const { control, watch, formState: { errors } } = useFormContext<PropertyFormInput>();
  const strZoning = watch('strZoning');
  const isOperatingSTR = watch('isOperatingSTR');
  const hasStrFinancials = watch('hasStrFinancials');
  const hasCurrentBookings = watch('hasCurrentBookings');

  const zoningFlag = strZoning === 'NO' || strZoning === 'UNSURE';
  const isOperating = isOperatingSTR === 'yes';
  const hasFinancials = hasStrFinancials === 'yes';

  const moneyField = (name: keyof PropertyFormInput, label: string, placeholder?: string) => (
    <Controller
      control={control}
      name={name as any}
      render={({ field }) => (
        <Input
          label={label}
          value={field.value == null ? '' : String(field.value)}
          onChangeText={(v) => field.onChange(sanitizeDecimal(v) as any)}
          keyboardType="decimal-pad"
          placeholder={placeholder}
        />
      )}
    />
  );

  return (
    <View>
      {/* 1. STR Zoning */}
      <Controller
        control={control}
        name="strZoning"
        render={({ field }) => (
          <Select
            label="Confirm STR Zoning Availability *"
            placeholder="Select an option"
            value={field.value}
            options={STR_ZONING_OPTIONS}
            onChange={field.onChange}
            error={errors.strZoning?.message}
          />
        )}
      />
      {zoningFlag ? (
        <View style={styles.warnBox}>
          <Text style={styles.warnText}>
            ⚠️ This property will be internally flagged for review before publishing,
            as STR zoning has not been confirmed.
          </Text>
        </View>
      ) : null}

      {/* 2. Currently operating as STR? */}
      <Controller
        control={control}
        name="isOperatingSTR"
        render={({ field }) => (
          <YesNoRow
            label="Is This Property Currently Operating as an STR?"
            value={field.value}
            onChange={field.onChange}
            required
            error={errors.isOperatingSTR?.message}
          />
        )}
      />

      {/* STR Yes: Listing link + Turnkey + Financials */}
      {isOperating ? (
        <View>
          <Controller
            control={control}
            name="strListingLink"
            render={({ field }) => (
              <Input
                label="Link to Current Airbnb or VRBO Listing"
                value={field.value}
                onChangeText={field.onChange}
                autoCapitalize="none"
                keyboardType="url"
                placeholder="https://…"
              />
            )}
          />

          <Controller
            control={control}
            name="turnkeyFurnished"
            render={({ field }) => (
              <Select
                label="Is It Turnkey or Furnished?"
                placeholder="Select an option"
                value={field.value}
                options={TURNKEY_OPTIONS}
                onChange={field.onChange}
                error={errors.turnkeyFurnished?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="hasStrFinancials"
            render={({ field }) => (
              <YesNoRow
                label="Do You Have Access to the STR Financials?"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />

          {hasFinancials ? (
            <View style={styles.condBlock}>
              <Controller
                control={control}
                name="strFinancialDocs"
                render={({ field }) => (
                  <DocumentUpload
                    label="Upload STR Financial Documents"
                    value={field.value ?? []}
                    onChange={field.onChange}
                    folder="properties/str-financials"
                    hint="PDF, Excel, or image files accepted."
                  />
                )}
              />

              <Controller
                control={control}
                name="strDataSheetsLink"
                render={({ field }) => (
                  <Input
                    label="Link to STR Data Sheets (If Applicable)"
                    value={field.value}
                    onChangeText={field.onChange}
                    autoCapitalize="none"
                    keyboardType="url"
                    placeholder="https://…"
                  />
                )}
              />

              <Text style={styles.metricsTitle}>STR Key Metrics</Text>
              <Text style={styles.metricsHelp}>
                Fill in what you know. Leave blank anything you're unsure of.
              </Text>

              {moneyField('occupancyRate', 'Occupancy Rate (%)', 'e.g. 75')}
              {moneyField('averageNightlyRate', 'Average Nightly Rate ($)', 'e.g. 225')}
              {moneyField('strAnnualRevenue', 'Annual Gross Revenue ($)', 'e.g. 65,000')}
              {moneyField('strMonthlyRevenue', 'Average Monthly Revenue ($)', 'e.g. 5,400')}
              {moneyField('strMonthlyUtilities', 'Monthly Utilities ($)', 'e.g. 300')}
              {moneyField('strNOI', 'Net Operating Income — NOI ($)', 'e.g. 42,000')}
              {moneyField('strCleaningFee', 'Cleaning Fee per Stay ($)', 'e.g. 150')}
              {moneyField('strAvgStay', 'Average Length of Stay (Nights)', 'e.g. 3')}
              {moneyField('strManagementFee', 'Property Management Fee (%)', 'e.g. 20')}

              <Controller
                control={control}
                name="strBookingPlatform"
                render={({ field }) => (
                  <Select
                    label="Primary Booking Platform"
                    placeholder="Select an option"
                    value={field.value}
                    options={STR_BOOKING_PLATFORM_OPTIONS}
                    onChange={field.onChange}
                  />
                )}
              />

              <Controller
                control={control}
                name="hasCurrentBookings"
                render={({ field }) => (
                  <Select
                    label="Does It Have Current Bookings?"
                    placeholder="Select an option"
                    value={field.value}
                    options={YES_NO_OPTIONS}
                    onChange={field.onChange}
                  />
                )}
              />
              {hasCurrentBookings === 'yes' ? (
                <Controller
                  control={control}
                  name="currentBookingsDescription"
                  render={({ field }) => (
                    <Input
                      label="Current Bookings — Brief Description"
                      value={field.value}
                      onChangeText={field.onChange}
                      multiline
                      numberOfLines={3}
                      placeholder="Briefly describe the current bookings (e.g., dates, number of reservations, revenue already secured)."
                    />
                  )}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* 3. Confidence in data */}
      <Controller
        control={control}
        name="strConfidence"
        render={({ field }) => (
          <Select
            label="How Confident Are You In The Accuracy Of The Following Data? *"
            placeholder="Select an option"
            value={field.value}
            options={STR_CONFIDENCE_OPTIONS}
            onChange={field.onChange}
            error={errors.strConfidence?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="vacationRentalMarkets"
        render={({ field }) => (
          <MultiSelectChips
            label="Vacation Rental Market(s)"
            options={VACATION_RENTAL_MARKETS}
            value={field.value ?? []}
            onChange={field.onChange}
          />
        )}
      />

      <Controller
        control={control}
        name="travelMotivations"
        render={({ field }) => (
          <MultiSelectChips
            label="Why Do People Travel to This Destination?"
            options={TRAVEL_MOTIVATIONS}
            value={field.value ?? []}
            onChange={field.onChange}
          />
        )}
      />

      {/* ───── Collapsible: Market Motivation & Travel Drivers (Optional) ───── */}
      <Collapsible
        title="Market Motivation & Travel Drivers (Optional)"
        subtitle="These insights help buyers understand demand drivers and guest behavior."
      >
        <Controller
          control={control}
          name="guestDemandInsights"
          render={({ field }) => (
            <Input
              label="What Do Rental Guests Want Most in This Area?"
              value={field.value}
              onChangeText={field.onChange}
              multiline
              numberOfLines={4}
              placeholder="Insights into guest expectations, amenities, or experiences…"
            />
          )}
        />
        <Controller
          control={control}
          name="valueAddOpportunities"
          render={({ field }) => (
            <Input
              label="How Can We Add Value to This Property to Increase Income?"
              value={field.value}
              onChangeText={field.onChange}
              multiline
              numberOfLines={4}
              placeholder="Examples: pool, hot tub, bikes, beach gear, game tables, etc."
            />
          )}
        />
        <Controller
          control={control}
          name="localContacts"
          render={({ field }) => (
            <Input
              label="Recommended Property Managers, Contractors, or Cleaning Companies"
              value={field.value}
              onChangeText={field.onChange}
              multiline
              numberOfLines={4}
              placeholder="List any trusted local contacts buyers could use…"
            />
          )}
        />
      </Collapsible>

      {/* ───── Collapsible: Amenities & Attractions (Optional) ───── */}
      <Collapsible title="Amenities & Attractions (Optional)">
        <Controller
          control={control}
          name="amenities"
          render={({ field }) => (
            <Input
              label="Amenities"
              value={field.value}
              onChangeText={field.onChange}
              multiline
              numberOfLines={3}
              placeholder="Examples: pool, hot tub, EV charger, game room, crib, high chair, fast Wi-Fi…"
            />
          )}
        />
        <Controller
          control={control}
          name="localAttractions"
          render={({ field }) => (
            <Input
              label="Local Attractions"
              value={field.value}
              onChangeText={field.onChange}
              multiline
              numberOfLines={3}
              placeholder="Nearby beaches, parks, venues, ski resorts, downtown districts, etc."
            />
          )}
        />
      </Collapsible>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  warnBox: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  warnText: {
    ...typography.caption,
    color: colors.warning,
    lineHeight: 18,
  },
  condBlock: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricsTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  metricsHelp: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
});
