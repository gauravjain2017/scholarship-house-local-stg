import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Badge, type BadgeTone } from './Badge';
import { StarRating } from './StarRating';
import { radius, shadows, spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

interface PropertyCardProps {
  imageUri?: string;
  title: string;
  /** Property category — shown as a "Type:" subtitle on the wide layout. */
  category?: string;
  /** Beds/baths summary — e.g. "3 BR · 2 BA" */
  bedsBaths?: string;
  /** Total area — e.g. "2000 sqft" */
  area?: string;
  location?: string;
  /** Pre-formatted published date — e.g. "Jun 10, 2026". Omitted when unknown. */
  publishedDate?: string;
  /** Human-readable reference shown on the wide card — e.g. "5128-34747". */
  propertyId?: string;
  price: string;          // pre-formatted: "$129,300"
  priceSuffix?: string;   // e.g. "/mo"
  badgeLabel?: string;
  badgeTone?: BadgeTone;
  rating?: number;        // 0–5
  variant?: 'horizontal' | 'wide';
  onPress?: () => void;
  /** Show inline Edit / Delete buttons inside the card footer. */
  onEdit?: () => void;
  onDelete?: () => void;
  /** When provided + `false`, the Edit button is rendered greyed-out. The tap still
   *  fires `onEdit` so the parent can surface a "locked" explanation modal. */
  editEnabled?: boolean;
  /** When provided + `false`, the Delete button is rendered greyed-out. The tap still
   *  fires `onDelete` so the parent can surface a "locked" explanation modal. */
  deleteEnabled?: boolean;
  deleteDisabledHint?: string;
  deleting?: boolean;
  /** Tap the Renew button (only rendered when `showRenew` is true). */
  onRenew?: () => void;
  /** Show a prominent Renew button (used for expired listings). */
  showRenew?: boolean;
}

/**
 * Listing card.
 *
 *   `horizontal` — narrow (220px) for horizontal scrollers ("Trending Listings").
 *   `wide`       — full-width row with image on the left, body on the right,
 *                  status badge top-right, and action footer (Edit / Delete).
 *                  Used on the Home tab's "Latest Listings" section.
 */
function PropertyCardBase({
  imageUri,
  title,
  category,
  bedsBaths,
  area,
  location,
  publishedDate,
  propertyId,
  price,
  priceSuffix,
  badgeLabel,
  badgeTone = 'rent',
  rating,
  variant = 'horizontal',
  onPress,
  onEdit,
  onDelete,
  editEnabled = true,
  deleteEnabled = true,
  deleteDisabledHint,
  deleting,
  onRenew,
  showRenew,
}: PropertyCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  if (variant === 'horizontal') {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.cardCompact,
          pressed && { transform: [{ scale: 0.98 }] },
        ]}
      >
        <View style={[styles.imageWrap, { height: 130 }]}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} contentFit="cover" transition={200} cachePolicy="memory-disk" />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Text style={styles.placeholderIcon}>🏠</Text>
            </View>
          )}
          {badgeLabel ? (
            <View style={styles.badgePos}>
              <Badge label={badgeLabel} tone={badgeTone} />
            </View>
          ) : null}
        </View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {location ? (
            <Text style={styles.location} numberOfLines={1}>
              <Text style={styles.pin}>◉ </Text>
              {location}
            </Text>
          ) : null}
          {publishedDate ? (
            <Text style={styles.published} numberOfLines={1}>
              <Text style={styles.publishedLabel}>Published: </Text>
              {publishedDate}
            </Text>
          ) : null}
          <View style={styles.footer}>
            <Text style={styles.price}>
              {price}
              {priceSuffix ? <Text style={styles.priceSuffix}>{priceSuffix}</Text> : null}
            </Text>
            {rating !== undefined ? <StarRating rating={rating} size={11} /> : null}
          </View>
        </View>
      </Pressable>
    );
  }

  // ── Wide variant: polished image-on-top card with rich body + action footer.
  const hasActions = !!(onEdit || onDelete);
  const showCategory = !!category && category !== '—';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cardWide,
        pressed && { transform: [{ scale: 0.99 }], opacity: 0.97 },
      ]}
    >
      <View style={styles.wideImageWrap}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} contentFit="cover" transition={200} cachePolicy="memory-disk" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.placeholderIcon}>🏠</Text>
          </View>
        )}

        {badgeLabel ? (
          <View style={styles.wideBadgePos}>
            <Badge label={badgeLabel} tone={badgeTone} />
          </View>
        ) : null}

        <View style={styles.widePricePill}>
          <Text style={styles.widePricePillText}>
            {price}
            {priceSuffix ? <Text style={styles.widePricePillSuffix}>{priceSuffix}</Text> : null}
          </Text>
        </View>
      </View>

      <View style={styles.wideBody}>
        <Text style={styles.wideTitle} numberOfLines={2}>
          {title}
        </Text>

        {location ? (
          <View style={styles.wideLocRow}>
            <Ionicons name="location-outline" size={14} color={colors.textMuted} />
            <Text style={styles.wideLocText} numberOfLines={1}>{location}</Text>
          </View>
        ) : null}

        {(bedsBaths || area || showCategory) ? (
          <View style={styles.wideChipsRow}>
            {bedsBaths ? (
              <View style={styles.chip}>
                <Ionicons name="bed-outline" size={13} color={colors.primary} />
                <Text style={styles.chipText}>{bedsBaths}</Text>
              </View>
            ) : null}
            {area ? (
              <View style={styles.chip}>
                <Ionicons name="resize-outline" size={13} color={colors.primary} />
                <Text style={styles.chipText}>{area}</Text>
              </View>
            ) : null}
            {showCategory ? (
              <View style={styles.chip}>
                <Ionicons name="home-outline" size={13} color={colors.primary} />
                <Text style={styles.chipText}>{category}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {(propertyId || publishedDate) ? (
          <View style={styles.wideMetaFooter}>
            {propertyId ? (
              <Text style={styles.wideMetaLine}>
                <Text style={styles.wideMetaLineLabel}>Property ID: </Text>{propertyId}
              </Text>
            ) : null}
            {publishedDate ? (
              <Text style={styles.wideMetaLine}>
                <Text style={styles.wideMetaLineLabel}>Published: </Text>{publishedDate}
              </Text>
            ) : null}
          </View>
        ) : null}

      {showRenew && onRenew ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onRenew();
          }}
          style={({ pressed }) => [styles.renewBtn, pressed && { opacity: 0.9 }]}
        >
          <Ionicons name="refresh-outline" size={16} color="#fff" />
          <Text style={styles.renewLabel}>Renew listing</Text>
        </Pressable>
      ) : null}

      {hasActions ? (
        <View style={styles.actions}>
          {onEdit ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                // Always fire onEdit — the parent decides whether to navigate
                // or surface a "locked" popup based on the property's status.
                onEdit();
              }}
              style={({ pressed }) => [
                styles.actionBtn,
                editEnabled ? styles.actionEdit : styles.actionEditDisabled,
                pressed && editEnabled && { opacity: 0.85 },
              ]}
              disabled={deleting}
            >
              <Ionicons
                name="create-outline"
                size={16}
                color={editEnabled ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.actionLabel,
                  { color: editEnabled ? colors.primary : colors.textMuted },
                ]}
              >
                Edit
              </Text>
            </Pressable>
          ) : null}
          {onDelete ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                // Always fire onDelete — the parent decides whether to confirm
                // or surface a "locked" popup based on the property's status.
                onDelete();
              }}
              style={({ pressed }) => [
                styles.actionBtn,
                deleteEnabled ? styles.actionDelete : styles.actionDeleteDisabled,
                pressed && deleteEnabled && { opacity: 0.85 },
              ]}
              disabled={deleting}
            >
              <Ionicons
                name="trash-outline"
                size={16}
                color={deleteEnabled ? colors.danger : colors.textMuted}
              />
              <Text
                style={[
                  styles.actionLabel,
                  { color: deleteEnabled ? colors.danger : colors.textMuted },
                ]}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {!deleteEnabled && onDelete && deleteDisabledHint ? (
        <Text style={styles.disabledHint}>{deleteDisabledHint}</Text>
      ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Memoized so a parent re-render (filter changes, favorite toggles, pagination)
 * doesn't re-render every visible card — only cards whose own props actually
 * change. For the memo to bite, parents should pass stable handlers (useCallback).
 */
export const PropertyCard = React.memo(PropertyCardBase);

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  // Shared
  imageWrap: { position: 'relative', backgroundColor: colors.bgAlt },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderIcon: { fontSize: 42 },
  badgePos: { position: 'absolute', top: spacing.sm, left: spacing.sm },
  title: { ...typography.h3, color: colors.text },
  location: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  pin: { color: colors.primaryAccent, fontSize: 9 },
  published: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  publishedLabel: { fontWeight: '700', color: colors.text },
  price: { ...typography.price, color: colors.primary },
  priceSuffix: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '500',
  },

  // Compact (horizontal scroll)
  cardCompact: {
    width: 220,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.card,
  },
  body: { padding: spacing.md },
  footer: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // Wide (vertical list) — polished image-on-top card
  cardWide: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.card,
  },
  wideImageWrap: {
    position: 'relative',
    width: '100%',
    height: 180,
    backgroundColor: colors.bgAlt,
  },
  wideBadgePos: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
  },
  widePricePill: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    backgroundColor: 'rgba(16,24,40,0.82)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  widePricePillText: { ...typography.price, color: '#fff' },
  widePricePillSuffix: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },
  wideBody: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  wideTitle: {
    ...typography.h3,
    color: colors.text,
    lineHeight: 23,
  },
  wideLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  wideLocText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },
  wideChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  chipText: {
    ...typography.tiny,
    color: colors.text,
    fontWeight: '600',
  },
  wideMetaFooter: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 2,
  },
  wideMetaLine: {
    ...typography.caption,
    color: colors.textMuted,
  },
  wideMetaLineLabel: {
    fontWeight: '700',
    color: colors.text,
  },

  // Actions — refined, balanced pair. Edit = blue tint, Delete = soft red tint.
  // Same visual weight, equal width, subtle borders for a premium look.
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  actionEdit: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  actionEditDisabled: {
    backgroundColor: colors.bgAlt,
    borderColor: colors.border,
  },
  actionDelete: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  actionDeleteDisabled: {
    backgroundColor: colors.bgAlt,
    borderColor: colors.border,
  },
  actionLabel: {
    ...typography.captionStrong,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  renewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: spacing.md,
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  renewLabel: {
    ...typography.captionStrong,
    fontSize: 13,
    letterSpacing: 0.2,
    color: '#fff',
  },
  disabledHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
