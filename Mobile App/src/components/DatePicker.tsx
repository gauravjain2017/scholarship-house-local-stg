import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/Button';
import { radius, spacing, typography } from '@/theme';
import { useTheme, useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

interface DatePickerProps {
  label?: string;
  /** ISO date string YYYY-MM-DD, or empty */
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  minDate?: Date;
  maxDate?: Date;
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Return the `YYYY-MM-DD` portion of any date string ('' if unparseable).
 * Accepts ISO (`YYYY-MM-DD`, optionally with time) AND the web submitter's
 * `MM/DD/YYYY`. Both are parsed by regex — Hermes can't `new Date("06/21/2026")`.
 */
function dateOnly(s: string | undefined): string {
  if (!s) return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : toIso(d);
}

function parseIso(s: string | undefined): Date {
  const only = dateOnly(s);
  if (!only) return new Date();
  const d = new Date(only + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/** Display format — MM/DD/YYYY to match the submitter web view. */
function prettyLabel(s: string | undefined): string {
  if (!dateOnly(s)) return '';
  const d = parseIso(s);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}/${day}/${d.getFullYear()}`;
}

/**
 * Cross-platform date picker:
 *   - iOS: opens an inline-style picker inside a Modal sheet with a Done button.
 *   - Android: the native dialog from `@react-native-community/datetimepicker`.
 *   - Web: falls back to a native HTML <input type="date"> rendered as a Pressable.
 *
 * Stores ISO `YYYY-MM-DD` strings, matching what the backend expects across
 * admin / submitter / mobile.
 */
export function DatePicker({
  label,
  value,
  onChange,
  placeholder = 'Select a date',
  error,
  hint,
  minDate,
  maxDate,
}: DatePickerProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(parseIso(value));

  const open = () => {
    setTempDate(parseIso(value));
    setShow(true);
  };

  // ── Web: use native <input type="date"> for the best UX ─────────────
  if (Platform.OS === 'web') {
    return (
      <View style={styles.wrap}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <View style={[styles.fieldRow, !!error && styles.fieldError]}>
          {React.createElement('input', {
            type: 'date',
            value: dateOnly(value),
            min: minDate ? toIso(minDate) : undefined,
            max: maxDate ? toIso(maxDate) : undefined,
            onChange: (e: any) => onChange(e.target.value),
            style: {
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 15,
              color: colors.text,
              padding: 0,
            },
          })}
          <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
        </View>
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : hint ? (
          <Text style={styles.hintText}>{hint}</Text>
        ) : null}
      </View>
    );
  }

  // ── Android: open the system dialog directly ─────────────────────────
  const onAndroidChange = (event: DateTimePickerEvent, d?: Date) => {
    setShow(false);
    if (event.type === 'set' && d) onChange(toIso(d));
  };

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable onPress={open} style={[styles.fieldRow, !!error && styles.fieldError]}>
        <Text style={[styles.fieldText, !value && styles.placeholder]} numberOfLines={1}>
          {value ? prettyLabel(value) : placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
      </Pressable>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}

      {show && Platform.OS === 'android' ? (
        <DateTimePicker
          value={parseIso(value)}
          mode="date"
          display="default"
          minimumDate={minDate}
          maximumDate={maxDate}
          onChange={onAndroidChange}
        />
      ) : null}

      {/* iOS: render inside a bottom sheet with a Done button */}
      <Modal visible={show && Platform.OS === 'ios'} transparent animationType="slide" onRequestClose={() => setShow(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShow(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{label ?? 'Select date'}</Text>
            <DateTimePicker
              value={tempDate}
              mode="date"
              display="inline"
              minimumDate={minDate}
              maximumDate={maxDate}
              onChange={(_, d) => d && setTempDate(d)}
            />
            <Button
              title="Done"
              onPress={() => {
                onChange(toIso(tempDate));
                setShow(false);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: {
    ...typography.captionStrong,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    letterSpacing: 0.2,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 50,
    backgroundColor: colors.bgAlt,
    gap: spacing.sm,
  },
  fieldError: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  fieldText: { fontSize: 15, color: colors.text, flex: 1 },
  placeholder: { color: colors.textMuted },
  errorText: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
  hintText: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,20,38,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg,
    padding: spacing.lg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});
