import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Controller, useFormContext } from 'react-hook-form';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { DatePicker } from '@/components/DatePicker';
import { YesNoRow } from '../YesNoRow';
import {
  BALLOON_YEARS_OPTIONS,
  FINANCING_OPTIONS,
  type PropertyFormInput,
} from '@/utils/propertyFormSchema';
import { radius, spacing, typography } from '@/theme';
import { useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

/**
 * Sanitize a decimal-input string so the form state preserves what the user
 * actually typed — including a trailing "." (e.g. "7." while still mid-typing
 * "7.5") and trailing zeros ("7.50"). zod's `optionalNumericish` preprocess +
 * buildDealPayload's `numOrNull` coerce strings to numbers at submit time.
 * Returns `undefined` for empty input so the field reads as "no value".
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
 * Step 3 — Financial Information.
 * Mirrors admin/components/submitter/FinancialInformationSection.jsx:
 *   - Type of financing (traditional / creative) + purchase price
 *   - Traditional → "Additional Financial Information" only
 *   - Creative → close-of-escrow / EMD / down payment / assignment fee,
 *     Primary mortgage, Second mortgage, Seller equity (each Yes/No gated),
 *     Deal Terms, Total Starting Monthly Payment
 *
 * (HOA moved to Step 1 — Property Information — to match the submitter.)
 */
export function Step3Financial() {
  const styles = useThemedStyles(makeStyles);
  const { control, watch, formState: { errors } } = useFormContext<PropertyFormInput>();
  const financingType = watch('financingType');
  const hasPrimaryMortgage = watch('hasPrimaryMortgage');
  const hasSecondMortgage = watch('hasSecondMortgage');
  const hasSellerEquity = watch('hasSellerEquity');

  // Legacy values (subject-to / hybrid / seller) still map to the creative flow
  // so older records open with their fields visible.
  const isCreative =
    financingType === 'creative' ||
    financingType === 'subject-to' ||
    financingType === 'hybrid' ||
    financingType === 'seller';

  /** Money / number field bound to an optional numeric form field. */
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

  const dateField = (name: keyof PropertyFormInput, label: string) => (
    <Controller
      control={control}
      name={name as any}
      render={({ field }) => (
        <DatePicker label={label} value={field.value as any} onChange={field.onChange} />
      )}
    />
  );

  return (
    <View>
      <Controller
        control={control}
        name="financingType"
        render={({ field }) => (
          <Select
            label="Type of Financing *"
            placeholder="Select a financing type"
            value={field.value}
            options={FINANCING_OPTIONS}
            onChange={field.onChange}
            error={errors.financingType?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="price"
        render={({ field }) => (
          <Input
            label="Purchase Price ($) *"
            value={String(field.value ?? '')}
            onChangeText={(v) => field.onChange(sanitizeDecimal(v) as any)}
            keyboardType="decimal-pad"
            placeholder="e.g. 500,000"
            error={errors.price?.message}
          />
        )}
      />

      {/* ───── Traditional financing ───── */}
      {!isCreative ? (
        <Controller
          control={control}
          name="financialInfo"
          render={({ field }) => (
            <Input
              label="Additional Financial Information"
              value={field.value}
              onChangeText={field.onChange}
              multiline
              numberOfLines={5}
              placeholder="Include any relevant financial details, notes, or context about this transaction…"
            />
          )}
        />
      ) : null}

      {/* ───── Creative financing ───── */}
      {isCreative ? (
        <View>
          {dateField('expectedCloseDate', 'Expected Close of Escrow')}
          {moneyField('emd', 'Earnest Money Deposit (EMD) ($)')}
          {moneyField('downPayment', 'Down Payment (Excluding closing costs) ($)')}
          {moneyField('assignmentFee', 'Assignment Fee ($)')}

          {/* Primary mortgage */}
          <Controller
            control={control}
            name="hasPrimaryMortgage"
            render={({ field }) => (
              <YesNoRow
                label="Is There a Primary Mortgage?"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          {hasPrimaryMortgage === 'yes' ? (
            <View style={styles.condBlock}>
              <Text style={styles.condTitle}>Primary Mortgage Details</Text>
              {moneyField('primaryLoanBalance', 'Loan Balance ($)')}
              {moneyField('primaryInterestRate', 'Interest Rate (%)')}
              {dateField('primaryMaturityDate', 'Maturity Date')}
              {moneyField('primaryPrincipalInterest', 'Combined Principal & Interest ($)')}
              {moneyField('primaryTaxesInsurance', 'Taxes & Insurance ($)')}
            </View>
          ) : null}

          {/* Second mortgage */}
          <Controller
            control={control}
            name="hasSecondMortgage"
            render={({ field }) => (
              <YesNoRow
                label="Is There a Second Mortgage?"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          {hasSecondMortgage === 'yes' ? (
            <View style={styles.condBlock}>
              <Text style={styles.condTitle}>Second Mortgage Details</Text>
              {moneyField('secondLoanBalance', 'Loan Balance ($)')}
              {moneyField('secondInterestRate', 'Interest Rate (%)')}
              {dateField('secondMaturityDate', 'Maturity Date')}
              {moneyField('secondPrincipalInterest', 'Combined Principal & Interest ($)')}
              {moneyField('secondTaxesInsurance', 'Taxes & Insurance ($)')}
            </View>
          ) : null}

          {/* Seller equity */}
          <Controller
            control={control}
            name="hasSellerEquity"
            render={({ field }) => (
              <YesNoRow
                label="Is There Any Seller Equity?"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          {hasSellerEquity === 'yes' ? (
            <View style={styles.condBlock}>
              <Text style={styles.condTitle}>Seller Equity Details</Text>
              {moneyField('sellerEquityAmount', 'Seller Loan Amount ($)')}
              {moneyField('sellerEquityInterestRate', 'Interest Rate (%)')}
              {dateField('sellerEquityMaturityDate', 'Maturity Date')}
              {moneyField('sellerEquityPrincipalInterest', 'Combined Principal & Interest ($)')}
              <Controller
                control={control}
                name="sellerEquityBalloonYears"
                render={({ field }) => (
                  <Select
                    label="When Is the Balloon Payment Due?"
                    placeholder="Select an option"
                    value={field.value}
                    options={BALLOON_YEARS_OPTIONS}
                    onChange={field.onChange}
                  />
                )}
              />
            </View>
          ) : null}

          <Controller
            control={control}
            name="dealTerms"
            render={({ field }) => (
              <Input
                label="Deal Terms"
                value={field.value}
                onChangeText={field.onChange}
                multiline
                numberOfLines={5}
                placeholder="Describe the deal terms, financing details, and any nuances of this transaction."
              />
            )}
          />

          {moneyField('totalStartingMonthlyPayment', 'Total Starting Monthly Payment ($)')}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  condBlock: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  condTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
});
