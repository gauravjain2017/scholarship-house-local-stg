import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { radius, spacing, typography } from '@/theme';
import { useThemedStyles, type ThemeColors } from '@/context/ThemeContext';

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  label?: string;
  error?: string;
  placeholder?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function Select({
  label,
  error,
  placeholder = 'Select…',
  value,
  options,
  onChange,
  disabled,
}: SelectProps) {
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable
        onPress={() => !disabled && setOpen(true)}
        style={[
          styles.input,
          !!selected && styles.inputSelected,
          !!error && styles.inputError,
          disabled && styles.inputDisabled,
        ]}
      >
        <Text
          style={[
            styles.valueText,
            !selected && styles.placeholderText,
            !!selected && styles.valueTextSelected,
          ]}
          numberOfLines={1}
        >
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={styles.caret}>▾</Text>
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            {label ? <Text style={styles.sheetTitle}>{label}</Text> : null}
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      isSelected && styles.optionSelected,
                      pressed && styles.optionPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isSelected && styles.optionTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  // Match Input's label so Select fields sit cleanly next to text fields in
  // shared forms (register, profile edit, property submit).
  label: {
    ...typography.captionStrong,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    letterSpacing: 0.2,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.bg,
    minHeight: 48,
  },
  inputError: { borderColor: colors.danger },
  inputDisabled: { opacity: 0.5 },
  /**
   * When a value is picked, deepen the border so users get an unambiguous
   * "this field is selected" signal. Without this, a placeholder and a
   * filled-but-stale value can look almost identical.
   */
  inputSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  valueText: { fontSize: 15, color: colors.text, flex: 1 },
  valueTextSelected: { fontWeight: '600', color: colors.primary },
  placeholderText: { color: colors.textMuted, fontWeight: '400' },
  caret: { color: colors.textMuted, marginLeft: spacing.sm, fontSize: 14 },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    maxHeight: '70%',
  },
  sheetTitle: {
    ...typography.caption,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  option: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  optionSelected: { backgroundColor: 'rgba(30,122,192,0.08)' },
  optionPressed: { backgroundColor: 'rgba(0,0,0,0.05)' },
  optionText: { fontSize: 15, color: colors.text },
  optionTextSelected: { color: colors.primary, fontWeight: '600' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
