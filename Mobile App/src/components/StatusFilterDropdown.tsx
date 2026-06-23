import React, { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, shadows, spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

export interface StatusFilterOption {
  key: string;
  label: string;
  count: number;
  /** Accent dot color. Defaults to the brand primary. */
  color?: string;
}

interface StatusFilterDropdownProps {
  options: StatusFilterOption[];
  value: string;
  onChange: (key: string) => void;
  /** Page gutter so the trigger lines up with the rest of the screen. */
  paddingHorizontal?: number;
}

type Anchor = { x: number; y: number; width: number; height: number };

/**
 * Status filter rendered as an anchored dropdown rather than a row of pills.
 *
 * The trigger shows the active status (with a colored dot + live count); tapping
 * it opens a menu positioned directly beneath the trigger (measured at open
 * time) listing every status with its count and a check on the current one.
 */
export function StatusFilterDropdown({
  options,
  value,
  onChange,
  paddingHorizontal = spacing.lg,
}: StatusFilterDropdownProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const triggerRef = useRef<View>(null);

  const active = options.find((o) => o.key === value) ?? options[0];

  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  };

  const select = (key: string) => {
    setOpen(false);
    if (key !== value) onChange(key);
  };

  return (
    <View style={[styles.wrap, { paddingHorizontal }]}>
      <Pressable
        ref={triggerRef}
        onPress={openMenu}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
        accessibilityRole="button"
        accessibilityLabel={`Filter by status. Showing ${active?.label}, ${active?.count} ${
          active?.count === 1 ? 'property' : 'properties'
        }`}
      >
        <View style={styles.triggerLeft}>
          <View style={[styles.dot, { backgroundColor: active?.color ?? colors.primary }]} />
          <Text style={styles.triggerLabel} numberOfLines={1}>
            {active?.label}
          </Text>
          <View style={styles.triggerCount}>
            <Text style={styles.triggerCountText}>{active?.count ?? 0}</Text>
          </View>
        </View>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        {/* Full-screen tap target to dismiss. The menu is a sibling above it so
            taps inside the menu hit its rows, not the backdrop. */}
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />

        {anchor ? (
          <View
            style={[
              styles.menu,
              {
                top: anchor.y + anchor.height + 6,
                left: anchor.x,
                width: anchor.width,
              },
            ]}
          >
            {options.map((opt, i) => {
              const selected = opt.key === value;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => select(opt.key)}
                  style={({ pressed }) => [
                    styles.row,
                    i > 0 && styles.rowBorder,
                    selected && styles.rowSelected,
                    pressed && !selected && styles.rowPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <View style={[styles.dot, { backgroundColor: opt.color ?? colors.primary }]} />
                  <Text
                    style={[styles.rowLabel, selected && styles.rowLabelSelected]}
                    numberOfLines={1}
                  >
                    {opt.label}
                  </Text>
                  <View style={[styles.rowCount, selected && styles.rowCountSelected]}>
                    <Text
                      style={[styles.rowCountText, selected && styles.rowCountTextSelected]}
                    >
                      {opt.count}
                    </Text>
                  </View>
                  {selected ? (
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={colors.primary}
                      style={styles.check}
                    />
                  ) : (
                    <View style={styles.check} />
                  )}
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  wrap: { paddingTop: spacing.md, paddingBottom: spacing.xs },

  // Trigger
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  triggerPressed: { opacity: 0.92 },
  triggerLeft: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  triggerLabel: { ...typography.bodyStrong, color: colors.text },

  dot: { width: 9, height: 9, borderRadius: 5 },

  triggerCount: {
    minWidth: 22,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerCountText: { ...typography.tiny, fontWeight: '700', color: colors.primary },

  // Menu
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16,24,40,0.18)',
  },
  menu: {
    position: 'absolute',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.cardStrong,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    backgroundColor: colors.card,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowSelected: { backgroundColor: colors.primarySoft },
  rowPressed: { backgroundColor: colors.bgAlt },
  rowLabel: { ...typography.body, color: colors.text, flex: 1 },
  rowLabelSelected: { fontWeight: '700', color: colors.primary },
  rowCount: {
    minWidth: 22,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.bgAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCountSelected: { backgroundColor: '#fff' },
  rowCountText: { ...typography.tiny, fontWeight: '700', color: colors.textSecondary },
  rowCountTextSelected: { color: colors.primary },
  check: { width: 20, marginLeft: 2 },
});
