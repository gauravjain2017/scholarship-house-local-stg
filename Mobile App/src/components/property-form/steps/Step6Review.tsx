import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Controller, useFormContext } from 'react-hook-form';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/components/Input';
import {
  BALLOON_YEARS_OPTIONS,
  CATEGORY_OPTIONS,
  FINANCING_OPTIONS,
  RELATIONSHIP_OPTIONS,
  STR_BOOKING_PLATFORM_OPTIONS,
  STR_CONFIDENCE_OPTIONS,
  STR_ZONING_OPTIONS,
  TRAVEL_MOTIVATIONS,
  TURNKEY_OPTIONS,
  VACATION_RENTAL_MARKETS,
  type PropertyFormInput,
} from '@/utils/propertyFormSchema';
import { US_STATE_OPTIONS } from '@/utils/usStates';
import { radius, spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';
import { useStepNav } from '../MultiStepPropertyForm';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function labelFor(options: { value: string; label: string }[], value?: string) {
  if (!value) return undefined;
  return options.find((o) => o.value === value)?.label ?? value;
}

function labelsFor(
  options: { value: string; label: string }[],
  values: string[] | undefined,
): string[] {
  if (!values || values.length === 0) return [];
  return values.map((v) => options.find((o) => o.value === v)?.label ?? v);
}

interface ReviewRow {
  label: string;
  value: string;
  chips?: string[];
}

interface Section {
  title: string;
  icon: IoniconName;
  tint: string;
  stepIndex: number;
  rows: ReviewRow[];
}

export function Step6Review() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { control, watch } = useFormContext<PropertyFormInput>();
  const { goToStep } = useStepNav();
  const all = watch();
  const a = all as any;

  // ── Value formatters (accept string | number | undefined from form state) ──
  const money = (v: unknown): string | undefined => {
    if (v === '' || v == null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? `$${n.toLocaleString('en-US')}` : undefined;
  };
  const pct = (v: unknown): string | undefined =>
    v === '' || v == null ? undefined : `${v}%`;
  const yesNo = (v: unknown): string | undefined =>
    v === 'yes' ? 'Yes' : v === 'no' ? 'No' : undefined;
  const text = (v: unknown): string | undefined => {
    const s = typeof v === 'string' ? v.trim() : v == null ? '' : String(v);
    return s === '' ? undefined : s;
  };
  // Dates: display MM/DD/YYYY (matches the submitter web view + the DatePicker).
  const dateText = (v: unknown): string | undefined => {
    if (typeof v !== 'string') return undefined;
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return text(v);
    return `${m[2]}/${m[3]}/${m[1]}`;
  };

  /** Build a section, dropping rows whose value is empty (chips kept when non-empty). */
  const section = (
    title: string,
    icon: IoniconName,
    tint: string,
    stepIndex: number,
    raw: { label: string; value?: string; chips?: string[] }[],
  ): Section => ({
    title,
    icon,
    tint,
    stepIndex,
    rows: raw
      .filter((r) => (r.chips ? r.chips.length > 0 : !!r.value))
      .map((r) => ({ label: r.label, value: r.value ?? '', chips: r.chips })),
  });

  const isCreative =
    all.financingType === 'creative' ||
    all.financingType === 'subject-to' ||
    all.financingType === 'hybrid' ||
    all.financingType === 'seller';
  const isOperating = all.isOperatingSTR === 'yes';
  const hasFinancials = all.hasStrFinancials === 'yes';

  const sections: Section[] = [
    section('Property Information', 'home-outline', colors.primarySoft, 0, [
      { label: 'Relationship', value: labelFor(RELATIONSHIP_OPTIONS, all.submitterRelationship) },
      { label: 'Property Type', value: labelFor(CATEGORY_OPTIONS, all.category) },
      { label: 'Bedrooms', value: text(all.bedrooms) },
      { label: 'Bathrooms', value: text(all.bathrooms) },
      { label: 'Year Built', value: text(all.yearBuilt) },
      { label: 'Square Footage', value: text(all.squareFootage) },
      { label: 'HOA', value: all.isHOA === 'yes' ? 'Yes' : all.isHOA === 'no' ? 'No' : undefined },
      ...(all.isHOA === 'yes'
        ? [{ label: 'HOA Monthly Fee', value: money(all.hoaMonthlyFee) }]
        : []),
      { label: 'Listing Description', value: text(all.description) },
      { label: "Seller's Intentions", value: text(all.story) },
      { label: 'Contact Name', value: text(a.contactName) },
      { label: 'Contact Phone', value: text(a.contactPhone) },
      { label: 'Contact Relation', value: text(a.contactRelation) },
      { label: 'Source Link', value: text(a.sourceLink) },
    ]),

    section('Location', 'location-outline', '#E8F5E9', 1, [
      { label: 'Street Address', value: text(all.streetAddress) },
      { label: 'Address Line 2', value: text(all.addressLine2) },
      { label: 'City', value: text(all.city) },
      { label: 'State / Region', value: labelFor(US_STATE_OPTIONS, all.stateRegion) },
      { label: 'Postal / Zip Code', value: text(all.postalCode) },
    ]),

    section('Financial Information', 'cash-outline', '#FFF7E0', 2, [
      { label: 'Financing Type', value: labelFor(FINANCING_OPTIONS, all.financingType) },
      { label: 'Purchase Price', value: money(all.price) },
      // Traditional
      ...(!isCreative ? [{ label: 'Additional Info', value: text(all.financialInfo) }] : []),
      // Creative
      ...(isCreative
        ? [
            { label: 'Expected Close of Escrow', value: dateText(all.expectedCloseDate) },
            { label: 'Earnest Money Deposit (EMD)', value: money(all.emd) },
            { label: 'Down Payment', value: money(all.downPayment) },
            { label: 'Assignment Fee', value: money(all.assignmentFee) },
            { label: 'Primary Mortgage?', value: yesNo(a.hasPrimaryMortgage) },
            ...(a.hasPrimaryMortgage === 'yes'
              ? [
                  { label: 'Primary Loan Balance', value: money(a.primaryLoanBalance) },
                  { label: 'Primary Interest Rate', value: pct(a.primaryInterestRate) },
                  { label: 'Primary Maturity Date', value: dateText(a.primaryMaturityDate) },
                  { label: 'Primary Principal & Interest', value: money(a.primaryPrincipalInterest) },
                  { label: 'Primary Taxes & Insurance', value: money(a.primaryTaxesInsurance) },
                ]
              : []),
            { label: 'Second Mortgage?', value: yesNo(a.hasSecondMortgage) },
            ...(a.hasSecondMortgage === 'yes'
              ? [
                  { label: 'Second Loan Balance', value: money(a.secondLoanBalance) },
                  { label: 'Second Interest Rate', value: pct(a.secondInterestRate) },
                  { label: 'Second Maturity Date', value: dateText(a.secondMaturityDate) },
                  { label: 'Second Principal & Interest', value: money(a.secondPrincipalInterest) },
                  { label: 'Second Taxes & Insurance', value: money(a.secondTaxesInsurance) },
                ]
              : []),
            { label: 'Seller Equity?', value: yesNo(a.hasSellerEquity) },
            ...(a.hasSellerEquity === 'yes'
              ? [
                  { label: 'Seller Loan Amount', value: money(a.sellerEquityAmount) },
                  { label: 'Seller Interest Rate', value: pct(a.sellerEquityInterestRate) },
                  { label: 'Seller Maturity Date', value: dateText(a.sellerEquityMaturityDate) },
                  { label: 'Seller Principal & Interest', value: money(a.sellerEquityPrincipalInterest) },
                  { label: 'Balloon Payment Due', value: labelFor(BALLOON_YEARS_OPTIONS, a.sellerEquityBalloonYears) },
                ]
              : []),
            { label: 'Deal Terms', value: text(a.dealTerms) },
            { label: 'Total Starting Monthly Payment', value: money(a.totalStartingMonthlyPayment) },
          ]
        : []),
    ]),

    section('Short-Term Rental Data', 'calendar-outline', '#F3E8FF', 3, [
      { label: 'STR Zoning', value: labelFor(STR_ZONING_OPTIONS, all.strZoning) },
      { label: 'Operating as STR?', value: yesNo(all.isOperatingSTR) },
      ...(isOperating
        ? [
            { label: 'Listing Link', value: text(all.strListingLink) },
            { label: 'Turnkey / Furnished', value: labelFor(TURNKEY_OPTIONS, all.turnkeyFurnished) },
            { label: 'Access to STR Financials?', value: yesNo(all.hasStrFinancials) },
            ...(hasFinancials
              ? [
                  {
                    label: 'STR Financial Documents',
                    value: a.strFinancialDocs?.length
                      ? `${a.strFinancialDocs.length} file(s) uploaded`
                      : undefined,
                  },
                  { label: 'Data Sheets Link', value: text(all.strDataSheetsLink) },
                  { label: 'Occupancy Rate', value: pct(all.occupancyRate) },
                  { label: 'Average Nightly Rate', value: money(a.averageNightlyRate) },
                  { label: 'Annual Gross Revenue', value: money(a.strAnnualRevenue) },
                  { label: 'Average Monthly Revenue', value: money(a.strMonthlyRevenue) },
                  { label: 'Monthly Utilities', value: money(a.strMonthlyUtilities) },
                  { label: 'Net Operating Income (NOI)', value: money(a.strNOI) },
                  { label: 'Cleaning Fee per Stay', value: money(a.strCleaningFee) },
                  { label: 'Average Length of Stay', value: a.strAvgStay ? `${a.strAvgStay} night(s)` : undefined },
                  { label: 'Property Management Fee', value: pct(a.strManagementFee) },
                  { label: 'Primary Booking Platform', value: labelFor(STR_BOOKING_PLATFORM_OPTIONS, a.strBookingPlatform) },
                  { label: 'Current Bookings?', value: yesNo(a.hasCurrentBookings) },
                  ...(a.hasCurrentBookings === 'yes'
                    ? [{ label: 'Current Bookings Details', value: text(a.currentBookingsDescription) }]
                    : []),
                ]
              : []),
          ]
        : []),
      { label: 'Data Confidence', value: labelFor(STR_CONFIDENCE_OPTIONS, all.strConfidence) },
      { label: 'Vacation Markets', chips: labelsFor(VACATION_RENTAL_MARKETS, all.vacationRentalMarkets) },
      { label: 'Travel Motivations', chips: labelsFor(TRAVEL_MOTIVATIONS, all.travelMotivations) },
      { label: 'Guest Demand', value: text(all.guestDemandInsights) },
      { label: 'Value Add', value: text(all.valueAddOpportunities) },
      { label: 'Local Contacts', value: text(all.localContacts) },
      { label: 'Amenities', value: text(all.amenities) },
      { label: 'Local Attractions', value: text(all.localAttractions) },
    ]),

    section('Photos & Media', 'images-outline', '#FEE2E2', 4, [
      { label: 'Cover Photo', value: all.coverPhoto?.length ? 'Added' : undefined },
      { label: 'Interior Photos', value: all.interiorImages?.length ? String(all.interiorImages.length) : undefined },
      { label: 'Exterior Photos', value: all.exteriorImages?.length ? String(all.exteriorImages.length) : undefined },
      { label: 'Additional Photos', value: all.additionalImages?.length ? String(all.additionalImages.length) : undefined },
      { label: 'Videos', value: all.videos?.length ? String(all.videos.length) : undefined },
    ]),
  ];

  return (
    <View>
      <View style={styles.intro}>
        <View style={styles.introIcon}>
          <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary} />
        </View>
        <Text style={styles.introText}>
          Review your submission. Tap{' '}
          <Text style={styles.introTextStrong}>Edit</Text> on any section to make changes.
        </Text>
      </View>

      {sections.map((sec) => (
        <View key={sec.title} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: sec.tint }]}>
              <Ionicons name={sec.icon} size={18} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>{sec.title}</Text>
            <Pressable
              onPress={() => goToStep(sec.stepIndex)}
              hitSlop={8}
              style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${sec.title}`}
            >
              <Ionicons name="create-outline" size={14} color={colors.primary} />
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          </View>

          <View style={styles.sectionBody}>
            {sec.rows.length === 0 ? (
              <View style={styles.row}>
                <Text style={styles.rowValueMuted}>Nothing entered</Text>
              </View>
            ) : (
              sec.rows.map((row, idx) => {
                const showChips = row.chips !== undefined;
                const isLast = idx === sec.rows.length - 1;
                return (
                  <View key={row.label} style={[styles.row, !isLast && styles.rowDivider]}>
                    <Text style={styles.rowLabel}>{row.label}</Text>
                    {showChips ? (
                      <View style={styles.chipsWrap}>
                        {row.chips!.map((c) => (
                          <View key={c} style={styles.chip}>
                            <Text style={styles.chipText}>{c}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.rowValue}>{row.value}</Text>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </View>
      ))}

      <View style={styles.notesCard}>
        <View style={styles.notesHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
          </View>
          <Text style={styles.sectionTitle}>Additional Information</Text>
        </View>
        <Controller
          control={control}
          name="additionalInfo"
          render={({ field }) => (
            <Input
              value={field.value}
              onChangeText={field.onChange}
              multiline
              numberOfLines={4}
              placeholder="Add any extra notes, context, or information here..."
            />
          )}
        />
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  introIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 19,
  },
  introTextStrong: {
    color: colors.primary,
    fontWeight: '700',
  },
  section: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.bgAlt,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    ...typography.bodyStrong,
    color: colors.text,
    flex: 1,
    fontSize: 15,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#D7E4FF',
  },
  editBtnPressed: {
    backgroundColor: colors.primarySoft,
    transform: [{ scale: 0.97 }],
  },
  editBtnText: {
    ...typography.tiny,
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  sectionBody: {
    paddingHorizontal: spacing.md,
  },
  row: {
    paddingVertical: spacing.sm + 2,
    gap: 4,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    ...typography.tiny,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  rowValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  rowValueMuted: {
    ...typography.body,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#D7E4FF',
  },
  chipText: {
    ...typography.tiny,
    color: colors.primary,
    fontWeight: '600',
    fontSize: 12,
  },
  notesCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
});
