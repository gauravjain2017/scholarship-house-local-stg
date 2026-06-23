import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ScreenHeader } from '@/components/ScreenHeader';
import { useNotificationsHeader } from '@/hooks/useNotificationsHeader';

import {
  CalcResult,
  DEFAULT_OOP_RATIO,
  Scenario,
  YEAR_PRESETS,
  computeScenarioResults,
  fmt$,
  fmtPct,
  getAutoOop,
  getChainedOop,
  getYearOffsets,
  newScenario,
  parsePurchaseYears,
  resetIdCounter,
  runCalc,
} from '@/utils/jvCalculatorHelpers';
import { spacing } from '@/theme';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { calculatorAPI } from '@/api/calculator';

type JvPalette = ReturnType<typeof makeP>;
function makeP(isDark: boolean) {
  return isDark
    ? {
      navy: '#1B3A5C', navyDark: '#1A2742', gold: '#E5C76B', teal: '#2DD4BF', sky: '#38BDF8', danger: '#F87171',
      cardBg: '#131A2A', pageBg: '#0B1220', divider: '#243042', label: '#9AA7BD', text: '#F1F5F9', muted: '#7E8BA1',
      heading: '#93C5FD',          // text/icons that were NAVY sitting on light surfaces
      surfaceTint: '#1A2336',      // section bars / card headers (was #F4F8FE)
      surfaceInput: '#1E2738',     // affix backgrounds (was #F4F7FC)
      chipTrack: '#1E2738',        // segmented-control track (was #EEF2F9)
      rowAlt: '#172030',           // table alt row (was #F4F8FE)
      emptyBg: '#161E2D', emptyIconBg: '#1E2738', statTileBg: '#1A2336',
      accentFill: '#1E2A44',       // small accent tiles (was NAVY_DARK)
      autoBg: '#10243A', autoText: '#7DD3FC',  // autofilled input (was #F0F9FF / #0369A1)
      footBg: '#1B2740', footText: '#93C5FD',  // table footer (was #DBEAFE / #1E40AF)
      oopBg: '#10243A', oopBorder: '#1E3A5F', oopText: '#93C5FD',
      green: '#34D399', greenDark: '#86EFAC', greenSoftBg: '#0F2A1E', greenSoftBorder: '#1C4D38',
      redSoftBg: '#2A1620', redSoftBorder: '#4D2535',
      scenario: [
        { bg: '#10243A', border: '#1E3A5F', header: '#15304D', badge: '#2563EB', text: '#BFDBFE', metaClr: '#60A5FA', returnClr: '#93C5FD' },
        { bg: '#0F2A1E', border: '#1C4D38', header: '#143D2A', badge: '#16A34A', text: '#BBF7D0', metaClr: '#4ADE80', returnClr: '#86EFAC' },
        { bg: '#2A2310', border: '#4D3F18', header: '#3A2F12', badge: '#D97706', text: '#FDE68A', metaClr: '#FBBF24', returnClr: '#FCD34D' },
        { bg: '#231A33', border: '#3D2F52', header: '#2E2342', badge: '#7C3AED', text: '#DDD6FE', metaClr: '#A78BFA', returnClr: '#C4B5FD' },
        { bg: '#2A1620', border: '#4D2535', header: '#3A1B28', badge: '#BE123C', text: '#FECDD3', metaClr: '#FB7185', returnClr: '#FDA4AF' },
      ],
    }
    : {
      navy: '#1B3A5C', navyDark: '#0D1F3C', gold: '#C9A84C', teal: '#0E7C7B', sky: '#38BDF8', danger: '#EF4444',
      cardBg: '#FFFFFF', pageBg: '#E6EDF8', divider: '#E2E8F0', label: '#64748B', text: '#0F172A', muted: '#94A3B8',
      heading: '#1B3A5C',
      surfaceTint: '#F4F8FE', surfaceInput: '#F4F7FC', chipTrack: '#EEF2F9', rowAlt: '#F4F8FE',
      emptyBg: '#FAFBFD', emptyIconBg: '#F1F5F9', statTileBg: '#F2F6FC',
      accentFill: '#0D1F3C', autoBg: '#F0F9FF', autoText: '#0369A1',
      footBg: '#DBEAFE', footText: '#1E40AF',
      oopBg: '#EFF6FF', oopBorder: '#BFDBFE', oopText: '#1D4ED8',
      green: '#16A34A', greenDark: '#15803D', greenSoftBg: '#F0FDF4', greenSoftBorder: '#86EFAC',
      redSoftBg: '#FFF5F5', redSoftBorder: '#FCA5A5',
      scenario: [
        { bg: '#EFF6FF', border: '#93C5FD', header: '#DBEAFE', badge: '#2563EB', text: '#1E3A8A', metaClr: '#60A5FA', returnClr: '#1D4ED8' },
        { bg: '#F0FDF4', border: '#86EFAC', header: '#DCFCE7', badge: '#16A34A', text: '#14532D', metaClr: '#4ADE80', returnClr: '#166534' },
        { bg: '#FFFBEB', border: '#FCD34D', header: '#FEF9C3', badge: '#D97706', text: '#78350F', metaClr: '#FBBF24', returnClr: '#92400E' },
        { bg: '#F5F3FF', border: '#C4B5FD', header: '#EDE9FE', badge: '#7C3AED', text: '#3B0764', metaClr: '#A78BFA', returnClr: '#5B21B6' },
        { bg: '#FFF1F2', border: '#FCA5A5', header: '#FFE4E6', badge: '#BE123C', text: '#4C0519', metaClr: '#FB7185', returnClr: '#881337' },
      ],
    };
}
function useJv() {
  const { isDark } = useTheme();
  const P = useMemo(() => makeP(isDark), [isDark]);
  const t = useMemo(() => makeT(P), [P]);
  const a = useMemo(() => makeA(P), [P]);
  const s = useMemo(() => makeS(P), [P]);
  const tl = useMemo(() => makeTl(P), [P]);
  return { P, t, a, s, tl };
}

// ── Formatting helpers ─────────────────────────────────────────────────────────
const fmtComma = (val: string | number | null | undefined): string => {
  const num = String(val ?? '').replace(/,/g, '');
  if (!num) return '';
  const parsed = Number(num);
  return isNaN(parsed) ? num : parsed.toLocaleString('en-US');
};

// ── Atoms ──────────────────────────────────────────────────────────────────────
function SectionHeaderBar({ children, icon }: { children: React.ReactNode; icon?: string }) {
  const { P, a } = useJv();
  return (
    <View style={a.sectionBar}>
      <View style={a.sectionBarAccent} />
      {icon && <Ionicons name={icon as any} size={13} color={P.heading} style={{ marginRight: 6 }} />}
      <Text style={a.sectionBarText}>{children}</Text>
    </View>
  );
}

function DataRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  const { P, a } = useJv();
  return (
    <View style={a.dataRow}>
      <Text style={a.dataLabel}>{label}</Text>
      <Text style={[a.dataValue, highlight && { color: P.teal, fontWeight: '800' }]}>{value}</Text>
    </View>
  );
}

function Chip({ label, active, onPress, color }: { label: string; active: boolean; onPress: () => void; color?: string }) {
  const { P, a } = useJv();
  return (
    <Pressable
      onPress={onPress}
      style={[a.chip, active && { backgroundColor: color ?? P.navy, borderColor: color ?? P.navy }]}
    >
      <Text style={[a.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

function SegmentedControl({
  options, value, onChange,
}: { options: { val: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  const { a } = useJv();
  return (
    <View style={a.segment}>
      {options.map(opt => (
        <Pressable
          key={opt.val}
          onPress={() => onChange(opt.val)}
          style={[a.segBtn, value === opt.val && a.segBtnActive]}
        >
          <Text style={[a.segText, value === opt.val && a.segTextActive]}>{opt.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function FieldInput({
  label, value, onChange, prefix, suffix, placeholder, autoFilled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  prefix?: string; suffix?: string; placeholder?: string; autoFilled?: boolean;
}) {
  const { P, a } = useJv();
  return (
    <View style={a.fieldWrap}>
      <Text style={a.fieldLabel}>{label}</Text>
      <View style={[a.inputBox, autoFilled && a.inputBoxAuto]}>
        {prefix ? <Text style={a.affix}>{prefix}</Text> : null}
        <TextInput
          style={[a.input, autoFilled && { color: P.autoText }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={P.muted}
          keyboardType="numeric"
          returnKeyType="done"
        />
        {suffix ? <Text style={a.affix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

function YearSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { P, a } = useJv();
  const isPreset = YEAR_PRESETS.map(String).includes(String(value));
  return (
    <View style={a.fieldWrap}>
      <Text style={a.fieldLabel}>TIMELINE (YEARS)</Text>
      <View style={a.yearRow}>
        {YEAR_PRESETS.map(y => (
          <Chip
            key={y}
            label={`${y}yr`}
            active={String(value) === String(y)}
            onPress={() => onChange(String(y))}
          />
        ))}
      </View>
      <View style={[a.inputBox, { marginTop: 8 }]}>
        <TextInput
          style={a.input}
          value={isPreset ? '' : value}
          onChangeText={onChange}
          placeholder="Custom e.g. 15"
          placeholderTextColor={P.muted}
          keyboardType="numeric"
          returnKeyType="done"
        />
      </View>
    </View>
  );
}

// ── OOP info strip ─────────────────────────────────────────────────────────────
function OopStrip({ label, onApply }: { label: string; onApply?: () => void }) {
  const { a } = useJv();
  return (
    <View style={a.oopStrip}>
      <Ionicons name="information-circle" size={15} color="#2563EB" />
      <Text style={a.oopStripText} numberOfLines={2}>{label}</Text>
      {onApply && (
        <Pressable style={a.oopApplyBtn} onPress={onApply}>
          <Text style={a.oopApplyText}>Apply</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Scenario input card ────────────────────────────────────────────────────────
function ScenarioInputs({
  scenario, onChange, prevResult, prevScenario, scenarioIdx,
}: {
  scenario: Scenario; onChange: (field: string, val: any) => void;
  prevResult: CalcResult | null; prevScenario: Scenario | null; scenarioIdx: number;
}) {
  const { a } = useJv();
  const chainedOop = getChainedOop(prevResult, prevScenario);
  const autoOop = getAutoOop(scenario, prevResult, prevScenario);
  const oopForDisplay = scenario.oopOverride != null && scenario.oopOverride !== ''
    ? parseFloat(scenario.oopOverride) : autoOop;
  const assumedPP = !scenario.purchasePrice && oopForDisplay > 0
    ? Math.round(oopForDisplay / DEFAULT_OOP_RATIO) : null;

  return (
    <View>
      {scenarioIdx === 1 && oopForDisplay > 0 && (
        <OopStrip
          label={`Out-of-Pocket: ${fmt$(oopForDisplay)}${!scenario.oopOverride ? ' — auto-calculated.' : ' — custom.'}`}
          onApply={() => {
            onChange('purchasePrice', '');
            setTimeout(() => onChange('purchasePrice', String(Math.round(oopForDisplay / DEFAULT_OOP_RATIO))), 0);
          }}
        />
      )}
      {prevResult && (
        <OopStrip
          label={`S${scenarioIdx - 1} exit proceeds: ${fmt$(chainedOop)}${!scenario.oopOverride ? ' — auto-filled.' : ' — custom.'}`}
          onApply={chainedOop > 0 ? () => {
            onChange('purchasePrice', '');
            setTimeout(() => onChange('purchasePrice', String(Math.round((parseFloat(scenario.oopOverride ?? '') || chainedOop) / DEFAULT_OOP_RATIO))), 0);
          } : undefined}
        />
      )}

      <View style={a.inputCard}>
        {/* Reinvest row */}
        <View style={a.reinvestRow}>
          <View style={{ flex: 1 }}>
            <Text style={a.reinvestLabel}>Reinvest Cash Flow</Text>
            <Text style={a.reinvestHint}>Roll distributions into next purchase</Text>
          </View>
          <SegmentedControl
            options={[{ val: 'true', label: 'Yes' }, { val: 'false', label: 'No' }]}
            value={String(scenario.reinvestCashFlow)}
            onChange={v => onChange('reinvestCashFlow', v === 'true')}
          />
        </View>

        <View style={a.divider} />

        {/* Fields 2-col grid */}
        <View style={a.fieldsGrid}>
          {[
            {
              key: 'purchasePrice', label: 'PURCHASE PRICE', prefix: '$',
              placeholder: assumedPP ? fmtComma(assumedPP) : '500,000'
            },
            {
              key: 'oopOverride', label: 'OUT-OF-POCKET', prefix: '$',
              placeholder: autoOop ? fmtComma(autoOop) : '150,000',
              autoValue: autoOop ? String(autoOop) : null
            },
            { key: 'cashFlowPct', label: 'CASH FLOW %', suffix: '%', placeholder: '8' },
            { key: 'apprPct', label: 'APPRECIATION %', suffix: '%', placeholder: '7' },
            { key: 'federalTaxRate', label: 'FED. TAX RATE', suffix: '%', placeholder: '32' },
          ].map(({ key, label, prefix, suffix, placeholder, autoValue }: any) => {
            const raw = (scenario as any)[key];
            const isUnset = raw == null;
            const displayVal = isUnset ? (autoValue || '') : raw;
            const isAutoFilled = isUnset && !!autoValue;
            return (
              <FieldInput
                key={key}
                label={label}
                value={prefix === '$' ? fmtComma(displayVal) : String(displayVal)}
                onChange={v => onChange(key, prefix === '$' ? v.replace(/,/g, '') : v)}
                prefix={prefix}
                suffix={suffix}
                placeholder={placeholder}
                autoFilled={isAutoFilled}
              />
            );
          })}
          <YearSelector value={scenario.years} onChange={v => onChange('years', v)} />
        </View>

        {scenario.oopOverride != null && (
          <Pressable onPress={() => onChange('oopOverride', null)} style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
            <Text style={a.resetLink}>↩ Reset Out-of-Pocket to default</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ── Cash flow table ────────────────────────────────────────────────────────────
function CashFlowTable({
  result, yOffset, showExitRefi = false,
}: { result: CalcResult; yOffset: number; showExitRefi?: boolean }) {
  const { P, t } = useJv();
  const exitRefi = result.oopValue + result.clientShare;
  const taxSavingsYear = result.numYears >= 2 ? 2 : 1;

  const flexes = showExitRefi ? [0.48, 1.05, 0.82, 0.82, 0.88] : [0.48, 1.1, 1.05, 0.88];
  const headers = showExitRefi
    ? ['Yr', 'Prop Value', 'Exit/Refi', 'Tax Sav.', 'Cash Flow']
    : ['Yr', 'Prop Value', 'Appr. Gain', 'Cash Flow'];

  const cellStyle = (idx: number, extra?: object) => [
    t.cell, { flex: flexes[idx] }, idx > 0 && t.cellRight, extra,
  ];

  return (
    <View>
      {/* header */}
      <View style={[t.row, t.headRow]}>
        {headers.map((h, i) => (
          <Text key={h} numberOfLines={1} style={[t.cell, { flex: flexes[i] }, i > 0 && t.cellRight, t.headText]}>{h}</Text>
        ))}
      </View>

      {/* body */}
      {result.yearRows.map((row, ri) => (
        <View key={row.year} style={[t.row, ri % 2 === 1 && t.rowAlt]}>
          <Text numberOfLines={1} style={cellStyle(0)}>Yr {yOffset + row.year}</Text>
          <Text numberOfLines={1} style={cellStyle(1)}>{fmt$(row.propertyValue)}</Text>
          {showExitRefi ? (
            <>
              <Text numberOfLines={1} style={cellStyle(2)}>
                {row.year === result.numYears ? fmt$(exitRefi) : '—'}
              </Text>
              <Text numberOfLines={1} style={cellStyle(3)}>
                {row.year === taxSavingsYear ? fmt$(result.taxSavings) : '—'}
              </Text>
            </>
          ) : (
            <Text numberOfLines={1} style={[...cellStyle(2) as any, { color: P.teal }]}>{fmt$(row.appreciationGain)}</Text>
          )}
          <Text numberOfLines={1} style={[...cellStyle(showExitRefi ? 4 : 3) as any, { color: P.heading, fontWeight: '700' }]}>
            {fmt$(row.cashFlow)}
          </Text>
        </View>
      ))}

      {/* footer */}
      <View style={[t.row, t.footRow]}>
        <Text numberOfLines={1} style={[t.cell, { flex: flexes[0] }, t.footText]}>Total</Text>
        <Text numberOfLines={1} style={[t.cell, { flex: flexes[1] }, t.cellRight, t.footText]}>{fmt$(result.estSalePrice)}</Text>
        {showExitRefi ? (
          <>
            <Text numberOfLines={1} style={[t.cell, { flex: flexes[2] }, t.cellRight, t.footText]}>{fmt$(exitRefi)}</Text>
            <Text numberOfLines={1} style={[t.cell, { flex: flexes[3] }, t.cellRight, t.footText]}>{fmt$(result.taxSavings)}</Text>
          </>
        ) : (
          <Text numberOfLines={1} style={[t.cell, { flex: flexes[2] }, t.cellRight, t.footText, { color: P.teal }]}>
            {fmt$(result.apprGain)}
          </Text>
        )}
        <Text numberOfLines={1} style={[t.cell, { flex: flexes[showExitRefi ? 4 : 3] }, t.cellRight, t.footText, { color: P.heading }]}>
          {fmt$(result.totalDist)}
        </Text>
      </View>
    </View>
  );
}

// ── Stat tile ──────────────────────────────────────────────────────────────────
function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const { P, s } = useJv();
  return (
    <View style={[s.statTile, accent && s.statTileAccent]}>
      <Text style={[s.statTileLabel, accent && { color: 'rgba(255,255,255,0.6)' }]}>{label}</Text>
      <Text style={[s.statTileValue, accent && { color: P.gold }]}>{value}</Text>
    </View>
  );
}

// ── Reset-to-default button ──────────────────────────────────────────────────────
function ResetButton({ onReset }: { onReset: () => void }) {
  const { P, a } = useJv();
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setConfirming(true)}
        hitSlop={8}
        style={({ pressed }) => [a.resetBtn, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="refresh" size={13} color={P.heading} />
        <Text style={a.resetBtnText}>Reset</Text>
      </Pressable>
      <ConfirmModal
        visible={confirming}
        title="Reset plan?"
        message="This clears every value you have entered and restores the default purchase schedule and scenarios."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onReset();
        }}
      />
    </>
  );
}

// ── Simple View ────────────────────────────────────────────────────────────────
function SimpleView() {
  const { P, a, s } = useJv();
  const { user } = useAuth();

  const sb = useMemo(() => ({
    saveBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, backgroundColor: P.gold, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20, shadowColor: P.gold, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 4 },
    saveLabel: { fontSize: 14, fontWeight: '700' as const, color: P.navyDark, letterSpacing: 0.2 },
    resetBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, backgroundColor: P.cardBg, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18, borderWidth: 1, borderColor: P.divider },
    resetLabel: { fontSize: 14, fontWeight: '600' as const, color: P.text, letterSpacing: 0.2 },
    actionRow: { flexDirection: 'row' as const, justifyContent: 'flex-end' as const, gap: 10 },
  }), [P.gold, P.navyDark, P.cardBg, P.divider, P.text]);

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [customYearsInput, setCY] = useState('1, 6, 11, 16');
  const [scenarios, setScenarios] = useState<Scenario[]>(() =>
    [newScenario(), newScenario(), newScenario(), newScenario()]);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([scenarios[0].id]));

  const parsedYears = useMemo(() => parsePurchaseYears(customYearsInput), [customYearsInput]);

  useEffect(() => {
    const needed = parsedYears.length;
    if (!needed) return;
    setScenarios(prev => {
      if (prev.length === needed) return prev;
      if (needed > prev.length) {
        const last = prev[prev.length - 1];
        return [...prev, ...Array.from({ length: needed - prev.length }, () =>
          newScenario({ cashFlowPct: last?.cashFlowPct, apprPct: last?.apprPct, years: last?.years, federalTaxRate: last?.federalTaxRate }))];
      }
      return prev.slice(0, needed);
    });
  }, [parsedYears.length]);

  const updateScenario = (id: number, field: string, value: any) =>
    setScenarios(prev => {
      const ci = prev.findIndex(s => s.id === id);
      if (ci === -1) return prev;
      return prev.map((s, i) => {
        if (i === ci) return { ...s, [field]: value };
        if (field === 'reinvestCashFlow' && i > ci) return { ...s, purchasePrice: '' };
        return s;
      });
    });

  const toggleExpand = (id: number) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const addScenario = () => {
    const last = scenarios[scenarios.length - 1];
    const lastY = parsedYears.length > 0 ? parsedYears[parsedYears.length - 1] + 5 : 6;
    const added = newScenario({ cashFlowPct: last?.cashFlowPct, apprPct: last?.apprPct, years: last?.years, federalTaxRate: last?.federalTaxRate, reinvestCashFlow: last?.reinvestCashFlow });
    setScenarios(prev => [...prev, added]);
    setExpanded(prev => new Set([...prev, added.id]));
    setCY(prev => prev.trim() ? `${prev}, ${lastY}` : String(lastY));
  };

  const removeScenario = (idx: number) => {
    if (scenarios.length <= 1) return;
    const removedId = scenarios[idx].id;
    setScenarios(prev => prev.filter((_, i) => i !== idx));
    setExpanded(prev => { const n = new Set(prev); n.delete(removedId); return n; });
    setCY(parsedYears.filter((_, i) => i !== idx).join(', '));
  };

  const duplicateScenario = (idx: number) => {
    const src = scenarios[idx];
    const lastY = parsedYears.length > 0 ? parsedYears[parsedYears.length - 1] + 5 : 6;
    const duped = newScenario({ purchasePrice: src.purchasePrice, oopOverride: src.oopOverride, cashFlowPct: src.cashFlowPct, apprPct: src.apprPct, years: src.years, federalTaxRate: src.federalTaxRate, reinvestCashFlow: src.reinvestCashFlow });
    setScenarios(prev => [...prev, duped]);
    setExpanded(prev => new Set([...prev, duped.id]));
    setCY(prev => prev.trim() ? `${prev}, ${lastY}` : String(lastY));
  };

  const yearOffsets = useMemo(() =>
    scenarios.map((_, idx) => {
      const yr = parsedYears[idx];
      return yr !== undefined
        ? yr - 1
        : parsedYears.length > 0
          ? parsedYears[parsedYears.length - 1] - 1 + (idx - parsedYears.length + 1)
          : idx * 5;
    }), [scenarios.length, parsedYears]);

  const results = useMemo(() =>
    computeScenarioResults(scenarios, parsedYears, startYear, 'custom', 'from-start', 5),
    [scenarios, parsedYears, startYear]);

  const cumulative = useMemo(() => {
    const valid = results.filter(Boolean) as CalcResult[];
    if (valid.length < 2) return null;
    const totalYears = yearOffsets[scenarios.length - 1] + (results[scenarios.length - 1]?.numYears ?? 0);
    return {
      totalDist: valid.reduce((s, r) => s + r.totalDist, 0),
      totalTaxSavings: valid.reduce((s, r) => s + r.taxSavings, 0),
      lastPortfolioValue: valid[valid.length - 1].estSalePrice,
      totalYears,
    };
  }, [results, yearOffsets, scenarios.length]);

  const resetAll = () => {
    const fresh = [newScenario(), newScenario(), newScenario(), newScenario()];
    setStartYear(new Date().getFullYear());
    setCY('1, 6, 11, 16');
    setScenarios(fresh);
    setExpanded(new Set([fresh[0].id]));
  };

  const handleSaveCalculation = async () => {
    try {
      setSaving(true);
      const payload = {
        startYear,
        customYears: parsedYears,
        scenarios: scenarios.map((scenario, idx) => {
          const prevResult = idx > 0 ? results[idx - 1] ?? null : null;
          const prevScenario = idx > 0 ? scenarios[idx - 1] : null;
          const chainedOop = prevResult
            ? (prevScenario?.reinvestCashFlow !== false
              ? prevResult.totalReturn
              : prevResult.totalReturn - prevResult.totalDist)
            : 0;
          const autoOop = prevResult
            ? chainedOop
            : (scenario.purchasePrice ? Math.round(parseFloat(scenario.purchasePrice) * DEFAULT_OOP_RATIO) : 0);
          const finalOop = scenario.oopOverride != null && scenario.oopOverride !== ''
            ? Number(scenario.oopOverride)
            : autoOop;
          return { ...scenario, oopValue: finalOop };
        }),
        type: 'simple' as const,
        client_email: user?.email,
      };
      console.log('Save Calculation payload:', JSON.stringify(payload, null, 2));
      await calculatorAPI.storeCalculator(payload);
    } catch (error: any) {
      const status = error?.response?.status;
      console.error(`Save failed (${status ?? 'network'}):`, error?.response?.data ?? error?.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const fetchSaved = async () => {
      try {
        const res = await calculatorAPI.getCalculator(user?.email, 'simple');
        const saved = res.data?.data?.[0]?.payload;
        if (saved) {
          if (saved.startYear) setStartYear(saved.startYear);
          if (saved.scenarios) setScenarios(saved.scenarios);
          if (saved.customYears?.length) setCY(saved.customYears.join(', '));
        }
      } catch (error: any) {
        // 404 = no saved calculation yet — not an error worth reporting
        if (error?.response?.status !== 404) {
          console.error('Failed to load saved calculation:', error);
        }
      } finally {
        setLoading(false);
      }
    };
    if (user?.email) {
      fetchSaved();
    } else {
      setLoading(false);
    }
  }, [user?.email]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: P.divider, borderTopColor: P.navy, opacity: 0.8 }} />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>

      {/* Purchase Schedule card */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <View style={s.cardHeaderIconWrap}>
            <Ionicons name="calendar-outline" size={15} color={P.heading} />
          </View>
          <Text style={s.cardHeaderText}>PURCHASE SCHEDULE</Text>
        </View>
        <View style={s.cardBody}>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={[a.fieldWrap, { flex: 0, minWidth: 90 }]}>
              <Text style={a.fieldLabel}>START YEAR</Text>
              <View style={a.inputBox}>
                <TextInput
                  style={a.input}
                  value={String(startYear)}
                  onChangeText={v => setStartYear(parseInt(v) || new Date().getFullYear())}
                  keyboardType="numeric"
                  returnKeyType="done"
                />
              </View>
            </View>
            <View style={[a.fieldWrap, { flex: 1 }]}>
              <Text style={a.fieldLabel}>PURCHASE YEARS (comma-separated)</Text>
              <View style={a.inputBox}>
                <TextInput
                  style={a.input}
                  value={customYearsInput}
                  onChangeText={setCY}
                  placeholder="e.g. 1, 6, 11, 16"
                  placeholderTextColor={P.muted}
                  returnKeyType="done"
                />
              </View>
              {parsedYears.length > 0 && (
                <Text style={a.hint}>
                  {parsedYears.length} purchase{parsedYears.length > 1 ? 's' : ''} → {' '}
                  <Text style={{ color: P.heading, fontWeight: '700' }}>
                    {parsedYears.map(y => startYear + y - 1).join(', ')}
                  </Text>
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Save & Reset action row */}
      <View style={sb.actionRow}>
        <Pressable
          style={({ pressed }) => [sb.resetBtn, pressed && { opacity: 0.7 }]}
          onPress={resetAll}
        >
          <Ionicons name="refresh-outline" size={15} color={P.text} />
          <Text style={sb.resetLabel}>Reset</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [sb.saveBtn, pressed && { opacity: 0.8 }]}
          onPress={handleSaveCalculation}
          disabled={saving}
        >
          <Ionicons name="save-outline" size={15} color={P.navyDark} />
          <Text style={sb.saveLabel}>{saving ? 'Saving…' : 'Save Calculation'}</Text>
        </Pressable>
      </View>

      {/* Scenario cards */}
      {scenarios.map((scenario, idx) => {
        const result = results[idx];
        const yOffset = yearOffsets[idx] ?? 0;
        const prevResult = idx > 0 ? results[idx - 1] ?? null : null;
        const prevScenario = idx > 0 ? scenarios[idx - 1] : null;
        const endYear = yOffset + (result?.numYears ?? parseInt(scenario.years) ?? 5);
        const c = P.scenario[idx % P.scenario.length];
        const isExpanded = expanded.has(scenario.id);

        return (
          <View key={scenario.id} style={[s.scenarioCard, { borderColor: c.border }]}>
            {/* header row */}
            <Pressable style={[s.scenarioHeader, { backgroundColor: c.header }]} onPress={() => toggleExpand(scenario.id)}>
              <View style={[s.badge, { backgroundColor: c.badge }]}>
                <Text style={s.badgeText}>S{idx + 1}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.scenarioTitle, { color: c.text }]}>Scenario {idx + 1}</Text>
                <Text style={[s.scenarioMeta, { color: c.metaClr }]}>
                  Yrs {yOffset + 1}–{endYear}  ·  {startYear + yOffset}–{startYear + endYear - 1}
                </Text>
                {result && <Text style={[s.scenarioReturn, { color: c.returnClr }]}>{fmt$(result.totalReturn)} return</Text>}
              </View>
              <View style={s.scenarioActions}>
                <Pressable onPress={addScenario} hitSlop={10} style={s.iconBtn}>
                  <Ionicons name="add" size={14} color={P.heading} />
                </Pressable>
                <Pressable onPress={() => duplicateScenario(idx)} hitSlop={10} style={s.iconBtn}>
                  <Ionicons name="copy-outline" size={14} color={P.heading} />
                </Pressable>
                {idx > 0 && (
                  <Pressable onPress={() => removeScenario(idx)} hitSlop={10} style={[s.iconBtn, { borderColor: P.danger }]}>
                    <Ionicons name="trash-outline" size={14} color={P.danger} />
                  </Pressable>
                )}
                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={P.muted} />
              </View>
            </Pressable>

            {/* body */}
            {isExpanded && (
              <View style={[s.scenarioBody, { backgroundColor: c.bg }]}>
                <ScenarioInputs
                  scenario={scenario}
                  onChange={(field, val) => updateScenario(scenario.id, field, val)}
                  prevResult={prevResult}
                  prevScenario={prevScenario}
                  scenarioIdx={idx + 1}
                />

                {result ? (
                  <View style={{ gap: spacing.md, marginTop: spacing.md }}>
                    {/* Cash flow table */}
                    <View style={s.tableCard}>
                      <SectionHeaderBar icon="trending-up-outline">
                        {result.numYears}-Year Cash Flow & Equity  (Yrs {yOffset + 1}–{endYear})
                      </SectionHeaderBar>
                      <View style={s.tableWrap}>
                        <CashFlowTable result={result} yOffset={yOffset} showExitRefi />
                      </View>
                    </View>

                    {/* Sale snapshot */}
                    <View style={s.tableCard}>
                      <SectionHeaderBar icon="home-outline">Sale Snapshot — Exit Yr {endYear}</SectionHeaderBar>
                      <View style={{ padding: spacing.md, gap: 7 }}>
                        <DataRow label="Accelerated Appr. Gain" value={fmt$(result.apprGain)} />
                        <DataRow label="Return of Investment" value={fmt$(result.oopValue)} />
                        <DataRow label="Net Sale Proceeds (50/50)" value={fmt$(result.netSaleProceeds)} />
                        <DataRow label="50% of Sale Proceeds" value={fmt$(result.clientShare)} />
                        <View style={[s.totalBox, { backgroundColor: P.navyDark }]}>
                          <View>
                            <Text style={s.totalBoxLabel}>Total Est. Return/Benefit</Text>
                          </View>
                          <Text style={s.totalBoxValue}>{fmt$(result.totalReturn)}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={s.emptyBox}>
                    <View style={s.emptyIconWrap}>
                      <Ionicons name="calculator-outline" size={26} color={P.muted} />
                    </View>
                    <Text style={s.emptyBoxTitle}>
                      {idx === 0 ? 'Enter Purchase Price' : `Complete Scenario ${idx} First`}
                    </Text>
                    <Text style={s.emptyBoxText}>
                      {idx === 0
                        ? 'Add a purchase price above to generate the pro forma'
                        : `Scenario ${idx} needs a purchase price before this one can calculate`}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}

      {/* Cumulative summary */}
      {cumulative && (
        <View style={[s.cumulCard, { borderColor: P.navy }]}>
          <View style={[s.cumulHeader, { backgroundColor: P.navyDark }]}>
            <View style={s.cumulCircle1} />
            <View style={s.cumulCircle2} />
            <View style={s.cumulHeaderInner}>
              <View style={s.cumulIconWrap}>
                <Ionicons name="stats-chart" size={16} color={P.gold} />
              </View>
              <View>
                <Text style={s.cumulHeaderText}>{cumulative.totalYears}-Year Portfolio Summary</Text>
                <Text style={s.cumulHeaderSub}>{scenarios.length} Scenarios Combined</Text>
              </View>
            </View>
          </View>
          <View style={s.cumulBody}>
            <StatTile label="Portfolio Value" value={fmt$(cumulative.lastPortfolioValue)} accent />
            <StatTile label="Total Cash Flow" value={fmt$(cumulative.totalDist)} />
            <StatTile label="Total Tax Savings" value={fmt$(cumulative.totalTaxSavings)} />
            <StatTile label="Total Years" value={`${cumulative.totalYears} yrs`} />
          </View>
        </View>
      )}

      {/* Year-Based Funding Timeline — same graph as the web client's Simple
          view (rendered with no students, matching client SimpleView.jsx). */}
      <CollegePlanningTimeline
        scenarios={scenarios}
        results={results}
        yearOffsets={yearOffsets}
        students={[]}
        startYear={startYear}
      />
    </View>
  );
}

// ── Advanced View ──────────────────────────────────────────────────────────────
function AdvancedView() {
  const { P, a, s } = useJv();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [scheduleMode, setScheduleMode] = useState<'interval' | 'custom'>('interval');
  const [purchaseInterval, setPurchaseInterval] = useState(5);
  const [intervalMode, setIntervalMode] = useState<'from-start' | 'from-exit'>('from-start');
  const [customYearsInput, setCY] = useState('1, 3, 7');
  const [scenarios, setScenarios] = useState<Scenario[]>(() =>
    [newScenario(), newScenario(), newScenario()]);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([scenarios[0].id]));

  const sb = useMemo(() => ({
    saveBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, backgroundColor: P.gold, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20, shadowColor: P.gold, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 4 },
    saveLabel: { fontSize: 14, fontWeight: '700' as const, color: P.navyDark, letterSpacing: 0.2 },
    resetBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, backgroundColor: P.cardBg, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18, borderWidth: 1, borderColor: P.divider },
    resetLabel: { fontSize: 14, fontWeight: '600' as const, color: P.text, letterSpacing: 0.2 },
    actionRow: { flexDirection: 'row' as const, justifyContent: 'flex-end' as const, gap: 10 },
  }), [P.gold, P.navyDark, P.cardBg, P.divider, P.text]);

  const [students, setStudents] = useState<{ id: number; name: string; startYear: string; annualCost: string; fundingYears: string }[]>([]);
  const _sId = useRef(1);
  const newStudent = () => ({ id: _sId.current++, name: '', startYear: String(new Date().getFullYear()), annualCost: '', fundingYears: '4' });
  const addStudent = () => setStudents(prev => [...prev, newStudent()]);
  const removeStudent = (id: number) => setStudents(prev => prev.filter(s => s.id !== id));
  const updateStudent = (id: number, field: string, val: string) =>
    setStudents(prev => prev.map(s => s.id === id ? { ...s, [field]: val } : s));

  const parsedYears = useMemo(() => parsePurchaseYears(customYearsInput), [customYearsInput]);

  useEffect(() => {
    if (scheduleMode !== 'custom') return;
    const needed = parsedYears.length;
    if (!needed) return;
    setScenarios(prev => {
      if (prev.length === needed) return prev;
      if (needed > prev.length) {
        const last = prev[prev.length - 1];
        return [...prev, ...Array.from({ length: needed - prev.length }, () =>
          newScenario({ cashFlowPct: last?.cashFlowPct, apprPct: last?.apprPct, years: last?.years, federalTaxRate: last?.federalTaxRate }))];
      }
      return prev.slice(0, needed);
    });
  }, [scheduleMode, parsedYears.length]);

  const updateScenario = (id: number, field: string, value: any) =>
    setScenarios(prev => {
      const ci = prev.findIndex(s => s.id === id);
      if (ci === -1) return prev;
      return prev.map((s, i) => {
        if (i === ci) return { ...s, [field]: value };
        if (field === 'reinvestCashFlow' && i > ci) return { ...s, purchasePrice: '' };
        return s;
      });
    });

  const toggleExpand = (id: number) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const addScenario = () => {
    const last = scenarios[scenarios.length - 1];
    const added = newScenario({ cashFlowPct: last?.cashFlowPct, apprPct: last?.apprPct, years: last?.years, federalTaxRate: last?.federalTaxRate });
    setScenarios(prev => [...prev, added]);
    setExpanded(prev => new Set([...prev, added.id]));
  };

  const removeScenario = (id: number) => {
    setScenarios(prev => prev.length > 1 ? prev.filter(s => s.id !== id) : prev);
    setExpanded(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const duplicateScenario = (id: number) => {
    const src = scenarios.find(s => s.id === id);
    if (!src) return;
    const duped = newScenario({ purchasePrice: src.purchasePrice, oopOverride: src.oopOverride, cashFlowPct: src.cashFlowPct, apprPct: src.apprPct, years: src.years, federalTaxRate: src.federalTaxRate, reinvestCashFlow: src.reinvestCashFlow });
    setScenarios(prev => [...prev, duped]);
    setExpanded(prev => new Set([...prev, duped.id]));
  };

  const results = useMemo(() =>
    computeScenarioResults(scenarios, parsedYears, startYear, scheduleMode, intervalMode, purchaseInterval),
    [scenarios, parsedYears, startYear, scheduleMode, intervalMode, purchaseInterval]);

  const yearOffsets = useMemo(() =>
    getYearOffsets(scenarios, parsedYears, scheduleMode, intervalMode, purchaseInterval, results),
    [scenarios, parsedYears, scheduleMode, intervalMode, purchaseInterval, results]);

  const cumulative = useMemo(() => {
    const valid = results.filter(Boolean) as CalcResult[];
    if (valid.length < 2) return null;
    const totalYears = yearOffsets[scenarios.length - 1] + (results[scenarios.length - 1]?.numYears ?? 0);
    return {
      totalDist: valid.reduce((s, r) => s + r.totalDist, 0),
      totalTaxSavings: valid.reduce((s, r) => s + r.taxSavings, 0),
      grandReturn: valid.reduce((s, r) => s + r.totalReturn, 0),
      lastPortfolioValue: valid[valid.length - 1].estSalePrice,
      totalYears,
    };
  }, [results, yearOffsets, scenarios.length]);

  const lastResult = results[results.length - 1];

  const resetAll = () => {
    const fresh = [newScenario(), newScenario(), newScenario()];
    setStartYear(new Date().getFullYear());
    setScheduleMode('interval');
    setPurchaseInterval(5);
    setIntervalMode('from-start');
    setCY('1, 3, 7');
    setScenarios(fresh);
    setExpanded(new Set([fresh[0].id]));
    setStudents([]);
  };

  const handleSaveCalculation = async () => {
    const payload = {
      startYear,
      scheduleMode,
      purchaseInterval,
      intervalMode,
      customYears: parsedYears,
      customYearsInput,
      expandedScenarios: [...expanded],
      scenarios,
      students,
      type: 'advanced' as const,
      client_email: user?.email,
    };
    try {
      setSaving(true);
      await calculatorAPI.storeCalculator(payload);
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
    } catch (error: any) {
      const status = error?.response?.status;
      console.error(`Save failed (${status ?? 'network'}):`, error?.response?.data ?? error?.message);
      Alert.alert('Save Failed', 'Failed to save calculation. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const fetchSaved = async () => {
      try {
        const res = await calculatorAPI.getCalculator(user?.email, 'advanced');
        const saved = res.data?.data?.[0]?.payload;
        if (saved) {
          if (saved.startYear) setStartYear(saved.startYear);
          if (saved.scheduleMode) setScheduleMode(saved.scheduleMode);
          if (saved.purchaseInterval !== undefined) setPurchaseInterval(saved.purchaseInterval);
          if (saved.intervalMode) setIntervalMode(saved.intervalMode);
          if (saved.customYearsInput) setCY(saved.customYearsInput);
          if (saved.scenarios?.length) {
            const maxId = Math.max(...saved.scenarios.map((s: Scenario) => s.id));
            resetIdCounter(maxId);
            setScenarios(saved.scenarios);
          }
          if (saved.expandedScenarios?.length) setExpanded(new Set(saved.expandedScenarios));
          if (saved.students) setStudents(saved.students);
        }
      } catch (error: any) {
        if (error?.response?.status !== 404) {
          console.error('Failed to load saved calculation:', error);
        }
      } finally {
        setLoading(false);
      }
    };
    if (user?.email) {
      fetchSaved();
    } else {
      setLoading(false);
    }
  }, [user?.email]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: P.divider, borderTopColor: P.navy, opacity: 0.8 }} />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      {/* Purchase Schedule */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <View style={s.cardHeaderIconWrap}>
            <Ionicons name="calendar-outline" size={15} color={P.heading} />
          </View>
          <Text style={s.cardHeaderText}>PURCHASE SCHEDULE</Text>
          <ResetButton onReset={resetAll} />
        </View>
        <View style={s.cardBody}>
          <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
            <View style={[a.fieldWrap, { flex: 0, minWidth: 90 }]}>
              <Text style={a.fieldLabel}>START YEAR</Text>
              <View style={a.inputBox}>
                <TextInput
                  style={a.input}
                  value={String(startYear)}
                  onChangeText={v => setStartYear(parseInt(v) || new Date().getFullYear())}
                  keyboardType="numeric"
                  returnKeyType="done"
                />
              </View>
            </View>
            <View style={[a.fieldWrap, { flex: 1, minWidth: 120 }]}>
              <Text style={a.fieldLabel}>SCHEDULE TYPE</Text>
              <SegmentedControl
                options={[{ val: 'interval', label: 'Interval' }, { val: 'custom', label: 'Custom' }]}
                value={scheduleMode}
                onChange={v => setScheduleMode(v as any)}
              />
            </View>
          </View>

          {scheduleMode === 'interval' && (
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <View style={a.fieldWrap}>
                <Text style={a.fieldLabel}>BUY EVERY (YEARS)</Text>
                <View style={a.yearRow}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(y => (
                    <Chip key={y} label={String(y)} active={purchaseInterval === y} onPress={() => setPurchaseInterval(y)} />
                  ))}
                </View>
              </View>
              <View style={a.fieldWrap}>
                <Text style={a.fieldLabel}>INTERVAL COUNTS FROM</Text>
                <SegmentedControl
                  options={[{ val: 'from-start', label: 'Purchase Date' }, { val: 'from-exit', label: 'Exit Date' }]}
                  value={intervalMode}
                  onChange={v => setIntervalMode(v as any)}
                />
                <Text style={a.hint}>
                  {intervalMode === 'from-start'
                    ? `New property every ${purchaseInterval} yr${purchaseInterval > 1 ? 's' : ''} from purchase`
                    : `New property ${purchaseInterval} yr${purchaseInterval > 1 ? 's' : ''} after previous exit`}
                </Text>
              </View>
            </View>
          )}

          {scheduleMode === 'custom' && (
            <View style={[a.fieldWrap, { marginTop: spacing.sm }]}>
              <Text style={a.fieldLabel}>PURCHASE YEARS (comma-separated)</Text>
              <View style={a.inputBox}>
                <TextInput
                  style={a.input}
                  value={customYearsInput}
                  onChangeText={setCY}
                  placeholder="e.g. 1, 3, 7"
                  placeholderTextColor={P.muted}
                  returnKeyType="done"
                />
              </View>
              {parsedYears.length > 0 && (
                <Text style={a.hint}>
                  {parsedYears.length} purchase{parsedYears.length > 1 ? 's' : ''} → {' '}
                  <Text style={{ color: P.heading, fontWeight: '700' }}>
                    {parsedYears.map(y => startYear + y - 1).join(', ')}
                  </Text>
                </Text>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Save & Reset action row */}
      <View style={sb.actionRow}>
        <Pressable
          style={({ pressed }) => [sb.resetBtn, pressed && { opacity: 0.7 }]}
          onPress={resetAll}
        >
          <Ionicons name="refresh-outline" size={15} color={P.text} />
          <Text style={sb.resetLabel}>Reset</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [sb.saveBtn, savedFeedback && { backgroundColor: P.green }, pressed && { opacity: 0.8 }]}
          onPress={handleSaveCalculation}
          disabled={saving}
        >
          <Ionicons name={savedFeedback ? 'checkmark-outline' : 'save-outline'} size={15} color={P.navyDark} />
          <Text style={sb.saveLabel}>{saving ? 'Saving…' : savedFeedback ? 'Saved!' : 'Save Calculation'}</Text>
        </Pressable>
      </View>

      {/* Scenario cards */}
      {scenarios.map((scenario, idx) => {
        const result = results[idx];
        const yOffset = yearOffsets[idx] ?? 0;
        const prevResult = idx > 0 ? results[idx - 1] ?? null : null;
        const prevScenario = idx > 0 ? scenarios[idx - 1] : null;
        const endYear = yOffset + (result?.numYears ?? parseInt(scenario.years) ?? 5);
        const c = P.scenario[idx % P.scenario.length];
        const isExpanded = expanded.has(scenario.id);

        return (
          <View key={scenario.id} style={[s.scenarioCard, { borderColor: c.border }]}>
            <Pressable style={[s.scenarioHeader, { backgroundColor: c.header }]} onPress={() => toggleExpand(scenario.id)}>
              <View style={[s.badge, { backgroundColor: c.badge }]}>
                <Text style={s.badgeText}>S{idx + 1}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.scenarioTitle, { color: c.text }]}>Scenario {idx + 1}</Text>
                <Text style={[s.scenarioMeta, { color: c.metaClr }]}>
                  Yrs {yOffset + 1}–{endYear}  ·  {startYear + yOffset}–{startYear + endYear - 1}
                </Text>
                {result && <Text style={[s.scenarioReturn, { color: c.returnClr }]}>{fmt$(result.totalReturn)} return</Text>}
              </View>
              <View style={s.scenarioActions}>
                <Pressable onPress={addScenario} hitSlop={10} style={s.iconBtn}>
                  <Ionicons name="add" size={14} color={P.heading} />
                </Pressable>
                <Pressable onPress={() => duplicateScenario(scenario.id)} hitSlop={10} style={s.iconBtn}>
                  <Ionicons name="copy-outline" size={14} color={P.heading} />
                </Pressable>
                {idx > 0 && (
                  <Pressable onPress={() => removeScenario(scenario.id)} hitSlop={10} style={[s.iconBtn, { borderColor: P.danger }]}>
                    <Ionicons name="trash-outline" size={14} color={P.danger} />
                  </Pressable>
                )}
                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={P.muted} />
              </View>
            </Pressable>

            {isExpanded && (
              <View style={[s.scenarioBody, { backgroundColor: c.bg }]}>
                <ScenarioInputs
                  scenario={scenario}
                  onChange={(field, val) => updateScenario(scenario.id, field, val)}
                  prevResult={prevResult}
                  prevScenario={prevScenario}
                  scenarioIdx={idx + 1}
                />

                {result ? (
                  <View style={{ gap: spacing.md, marginTop: spacing.md }}>
                    {/* Summary metric strip */}
                    <View style={s.metricStrip}>
                      {[
                        { label: 'Purchase Price', value: fmt$(result.price), accent: false },
                        { label: 'Out-of-Pocket', value: fmt$(result.oopValue), accent: false },
                        { label: 'Tax Savings', value: fmt$(result.taxSavings), accent: true },
                        { label: 'Net Cash Inflow', value: fmt$(result.totalDist), accent: true },
                        { label: 'Total Return', value: fmt$(result.totalReturn), accent: true },
                        { label: 'Annualized Rtn', value: fmtPct(result.annReturn), accent: true },
                      ].map(item => (
                        <View key={item.label} style={[s.metricItem, item.accent && s.metricItemAccent]}>
                          <Text style={[s.metricLabel, item.accent && { color: 'rgba(255,255,255,0.55)' }]}>{item.label}</Text>
                          <Text style={[s.metricValue, item.accent && { color: P.gold }]}>{item.value}</Text>
                        </View>
                      ))}
                    </View>

                    {/* CoC + OOP + Tax snapshot row */}
                    <View style={{ gap: spacing.sm }}>
                      <View style={s.tableCard}>
                        <SectionHeaderBar icon="speedometer-outline">
                          Cash-on-Cash Returns (Yr {yOffset + 1}, {yOffset + result.midYear}, {yOffset + result.numYears})
                        </SectionHeaderBar>
                        <View style={{ padding: spacing.md, gap: 7 }}>
                          <DataRow label={`Yr ${yOffset + 1} CoC`} value={fmtPct(result.coc1yr)} />
                          <DataRow label={`Yr ${yOffset + result.midYear} CoC`} value={fmtPct(result.cocMidYr)} />
                          <DataRow label={`Yr ${yOffset + result.numYears} CoC`} value={fmtPct(result.cocNyr)} />
                        </View>
                      </View>

                      <View style={s.tableCard}>
                        <SectionHeaderBar icon="wallet-outline">Client Out-of-Pocket Investment</SectionHeaderBar>
                        <View style={{ padding: spacing.md, gap: 7 }}>
                          <DataRow label="LLC JV Buy-In" value={fmt$(result.oopValue)} />
                          <View style={[a.dataRow, { borderTopWidth: 1, borderTopColor: P.divider, paddingTop: 8, marginTop: 2 }]}>
                            <Text style={[a.dataLabel, { fontWeight: '700', color: P.text }]}>Total Out-of-Pocket</Text>
                            <Text style={[a.dataValue, { color: P.teal, fontSize: 14 }]}>{fmt$(result.oopValue)}</Text>
                          </View>
                        </View>
                      </View>

                      <View style={s.tableCard}>
                        <SectionHeaderBar icon="receipt-outline">Tax Snapshot (Year {yOffset + 1})</SectionHeaderBar>
                        <View style={{ padding: spacing.md, gap: 8 }}>
                          <View style={s.inlineEditRow}>
                            <Text style={a.dataLabel}>Est. Bonus Depreciation</Text>
                            <View style={s.inlineInput}>
                              <Text style={s.inlineAffix}>$</Text>
                              <TextInput
                                style={s.inlineTextInput}
                                value={fmtComma(scenario.bonusDeprOverride != null ? scenario.bonusDeprOverride : result.bonusDepr)}
                                onChangeText={v => updateScenario(scenario.id, 'bonusDeprOverride', v.replace(/,/g, ''))}
                                keyboardType="numeric"
                                returnKeyType="done"
                              />
                            </View>
                          </View>
                          {scenario.bonusDeprOverride != null && (
                            <Pressable onPress={() => updateScenario(scenario.id, 'bonusDeprOverride', null)}>
                              <Text style={a.resetLink}>↩ Reset ({fmt$(Math.round(result.price * 0.30))})</Text>
                            </Pressable>
                          )}
                          <View style={s.inlineEditRow}>
                            <Text style={a.dataLabel}>Federal Tax Rate</Text>
                            <View style={s.inlineInput}>
                              <TextInput
                                style={s.inlineTextInput}
                                value={scenario.federalTaxRate}
                                onChangeText={v => updateScenario(scenario.id, 'federalTaxRate', v)}
                                keyboardType="numeric"
                                returnKeyType="done"
                              />
                              <Text style={s.inlineAffix}>%</Text>
                            </View>
                          </View>
                          <DataRow label="Tax Savings (Bonus Depr.)" value={fmt$(result.taxSavings)} />
                        </View>
                      </View>
                    </View>

                    {/* Cash flow table */}
                    <View style={s.tableCard}>
                      <SectionHeaderBar icon="trending-up-outline">
                        {result.numYears}-Year Cash Flow & Equity (Yrs {yOffset + 1}–{yOffset + result.numYears})
                      </SectionHeaderBar>
                      <View style={s.tableWrap}>
                        <CashFlowTable result={result} yOffset={yOffset} />
                      </View>
                    </View>

                    {/* Sale snapshot */}
                    <View style={s.tableCard}>
                      <SectionHeaderBar icon="home-outline">Sale Snapshot — Exit Yr {yOffset + result.numYears}</SectionHeaderBar>
                      <View style={{ padding: spacing.md, gap: 7 }}>
                        <DataRow label="Purchase Price" value={fmt$(result.price)} />
                        {/* Editable appreciation % — recalculates the sale price
                            (and downstream gains) on change, matching the web. */}
                        <View style={[a.dataRow, { alignItems: 'center' }]}>
                          <View style={s.salePriceLabel}>
                            <Text style={a.dataLabel} numberOfLines={1}>Est. Sale Price (</Text>
                            <View style={s.inlineInputSm}>
                              <TextInput
                                style={s.inlineTextInputSm}
                                value={scenario.apprPct == null ? '' : String(scenario.apprPct)}
                                onChangeText={v => updateScenario(scenario.id, 'apprPct', v.replace(/[^0-9.]/g, ''))}
                                keyboardType="decimal-pad"
                                returnKeyType="done"
                                maxLength={5}
                                placeholder="7"
                                placeholderTextColor={P.muted}
                              />
                            </View>
                            <Text style={a.dataLabel} numberOfLines={1}>% p.a.)</Text>
                          </View>
                          <Text style={[a.dataValue, { marginLeft: 8 }]}>{fmt$(result.estSalePrice)}</Text>
                        </View>
                        <DataRow label="Accelerated Appr. Gain" value={fmt$(result.apprGain)} />
                        <DataRow label="Return of Investment" value={fmt$(result.oopValue)} />
                        <DataRow label="Net Sale Proceeds (50/50)" value={fmt$(result.netSaleProceeds)} />
                      </View>
                    </View>

                    {/* Return tiles */}
                    <View style={s.tilesRow}>
                      {[
                        { label: 'Initial OOP', value: fmt$(result.oopValue) },
                        { label: 'Sale Proceeds (50%)', value: fmt$(result.clientShare) },
                        { label: `${result.numYears}-Yr Distributions`, value: fmt$(result.totalDist) },
                        { label: 'Est. Tax Savings', value: fmt$(result.taxSavings) },
                        { label: 'Total Return / Benefit', value: fmt$(result.totalReturn) },
                      ].map(item => (
                        <View key={item.label} style={s.returnTile}>
                          <Text style={s.returnTileLabel}>{item.label}</Text>
                          <Text style={s.returnTileValue}>{item.value}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : (
                  <View style={s.emptyBox}>
                    <View style={s.emptyIconWrap}>
                      <Ionicons name="calculator-outline" size={26} color={P.muted} />
                    </View>
                    <Text style={s.emptyBoxTitle}>
                      {idx === 0 ? 'Enter Purchase Price' : `Complete Scenario ${idx} First`}
                    </Text>
                    <Text style={s.emptyBoxText}>
                      {idx === 0 ? 'Add a purchase price above to generate the pro forma' : `Scenario ${idx} needs a purchase price before this one can calculate`}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}

      {/* Cumulative summary */}
      {cumulative && (
        <View style={[s.cumulCard, { borderColor: P.navy }]}>
          <View style={[s.cumulHeader, { backgroundColor: P.navyDark }]}>
            <View style={s.cumulCircle1} />
            <View style={s.cumulCircle2} />
            <View style={s.cumulHeaderInner}>
              <View style={s.cumulIconWrap}>
                <Ionicons name="stats-chart" size={16} color={P.gold} />
              </View>
              <View>
                <Text style={s.cumulHeaderText}>{cumulative.totalYears}-Year Portfolio Summary</Text>
                <Text style={s.cumulHeaderSub}>{scenarios.length} Scenarios Combined</Text>
              </View>
            </View>
          </View>
          <View style={s.cumulBody}>
            <StatTile label="Portfolio Value" value={fmt$(cumulative.lastPortfolioValue)} accent />
            <StatTile label="Total Cash Flow" value={fmt$(cumulative.totalDist)} />
            <StatTile label="Total Tax Savings" value={fmt$(cumulative.totalTaxSavings)} />
            <StatTile label="Total Years" value={`${cumulative.totalYears} yrs`} />
          </View>
        </View>
      )}

      {/* College planning */}
      <View style={[s.card, { borderWidth: 2, borderColor: P.divider }]}>
        <View style={[s.cardHeader, { backgroundColor: P.navyDark, borderBottomWidth: 0, justifyContent: 'space-between' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[s.cardHeaderIconWrap, { backgroundColor: 'rgba(201,168,76,0.2)' }]}>
              <Ionicons name="school-outline" size={15} color={P.gold} />
            </View>
            <Text style={[s.cardHeaderText, { color: '#fff', flex: 0 }]}>COLLEGE PLANNING</Text>
          </View>
          <Pressable onPress={addStudent} style={s.addStudentBtn}>
            <Ionicons name="add-circle-outline" size={13} color={P.gold} />
            <Text style={s.addStudentText}>+ Student {students.length + 1}</Text>
          </Pressable>
        </View>

        <View style={{ padding: spacing.md, gap: spacing.md }}>
          {students.length === 0 && (
            <View style={s.emptyBox}>
              <View style={s.emptyIconWrap}>
                <Ionicons name="school-outline" size={26} color={P.muted} />
              </View>
              <Text style={s.emptyBoxTitle}>No Students Added</Text>
              <Text style={s.emptyBoxText}>Tap "+ Student 1" to model college funding from investment returns</Text>
            </View>
          )}

          {students.map((student, idx) => {
            const annual = parseFloat(student.annualCost) || 0;
            const yrs = Math.max(1, parseInt(student.fundingYears) || 4);
            const total = annual * yrs;
            const label = student.name.trim() || `Student ${idx + 1}`;
            const stuStart = parseInt(student.startYear) || (startYear + 2);
            const stuEnd = stuStart + yrs - 1;
            const overlapCF = scenarios.reduce((sum, _sc, si) => {
              const r = results[si];
              if (!r) return sum;
              const scStart = startYear + (yearOffsets[si] || 0);
              const scEnd = scStart + r.numYears - 1;
              const oStart = Math.max(scStart, stuStart);
              const oEnd = Math.min(scEnd, stuEnd);
              return oEnd >= oStart ? sum + r.annualCashFlow * (oEnd - oStart + 1) : sum;
            }, 0);
            const coverageAmt = Math.min(overlapCF, total);
            const coveragePct = total > 0 ? Math.round((coverageAmt / total) * 100) : null;

            return (
              <View key={student.id} style={s.studentCard}>
                <View style={[s.studentHeader, { backgroundColor: P.oopBg }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={s.studentBadge}>
                      <Text style={s.studentBadgeText}>{idx + 1}</Text>
                    </View>
                    <Text style={s.studentName}>{label}</Text>
                  </View>
                  <Pressable onPress={() => removeStudent(student.id)} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color={P.danger} />
                  </Pressable>
                </View>
                <View style={s.studentFields}>
                  {[
                    { key: 'name', label: 'NAME', placeholder: `Student ${idx + 1}`, numeric: false },
                    { key: 'startYear', label: 'COLLEGE START', placeholder: '2028', numeric: true },
                    { key: 'annualCost', label: 'ANNUAL COST ($)', placeholder: '30,000', numeric: true },
                    { key: 'fundingYears', label: 'YEARS', placeholder: '4', numeric: true },
                  ].map(f => (
                    <View key={f.key} style={[a.fieldWrap, { flex: 1, minWidth: 100 }]}>
                      <Text style={a.fieldLabel}>{f.label}</Text>
                      <View style={a.inputBox}>
                        <TextInput
                          style={a.input}
                          value={(student as any)[f.key]}
                          onChangeText={v => updateStudent(student.id, f.key, v)}
                          placeholder={f.placeholder}
                          placeholderTextColor={P.muted}
                          keyboardType={f.numeric ? 'numeric' : 'default'}
                          returnKeyType="done"
                        />
                      </View>
                    </View>
                  ))}
                </View>
                {annual > 0 && (
                  <View style={s.studentStats}>
                    {[
                      { label: 'Annual', value: fmt$(annual) },
                      { label: 'Total', value: fmt$(total) },
                      { label: 'CF Covered', value: coverageAmt > 0 ? `${fmt$(coverageAmt)} (${coveragePct}%)` : '—' },
                    ].map(st => (
                      <View key={st.label} style={s.studentStat}>
                        <Text style={s.studentStatLabel}>{st.label}</Text>
                        <Text style={s.studentStatValue}>{st.value}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          {students.length > 0 && students.some(st => parseFloat(st.annualCost) > 0) && (() => {
            const grandTotal = students.reduce((sum, st) =>
              sum + (parseFloat(st.annualCost) || 0) * (parseInt(st.fundingYears) || 4), 0);
            const totalReturn = cumulative ? cumulative.grandReturn : (lastResult?.totalReturn ?? 0);
            const isFunded = grandTotal <= totalReturn;
            return (
              <View style={[s.fundingBadge, { borderColor: isFunded ? P.greenSoftBorder : P.redSoftBorder, backgroundColor: isFunded ? P.greenSoftBg : P.redSoftBg }]}>
                <View style={[s.fundingIconWrap, { backgroundColor: isFunded ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)' }]}>
                  <Ionicons name={isFunded ? 'checkmark-circle' : 'alert-circle'} size={22} color={isFunded ? P.green : P.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.fundingStatus, { color: isFunded ? P.greenDark : P.danger }]}>
                    {isFunded ? 'Fully Funded' : 'Funding Gap'}
                  </Text>
                  <Text style={[s.fundingAmount, { color: isFunded ? P.greenDark : P.danger }]}>
                    {isFunded ? `${fmt$(totalReturn - grandTotal)} surplus` : `${fmt$(grandTotal - totalReturn)} gap`}
                  </Text>
                  <Text style={s.fundingHint}>
                    College: {fmt$(grandTotal)}  ·  Total return: {fmt$(totalReturn)}
                  </Text>
                </View>
              </View>
            );
          })()}
        </View>
      </View>

      <CollegePlanningTimeline
        scenarios={scenarios}
        results={results}
        yearOffsets={yearOffsets}
        students={students}
        startYear={startYear}
      />
    </View>
  );
}

// ── College Planning Timeline ──────────────────────────────────────────────────
function CollegePlanningTimeline({
  scenarios, results, yearOffsets, students, startYear,
}: {
  scenarios: Scenario[];
  results: (CalcResult | null)[];
  yearOffsets: number[];
  students: { id: number; name: string; startYear: string; annualCost: string; fundingYears: string }[];
  startYear: number;
}) {
  const { P, s, tl } = useJv();
  let minYear = startYear;
  let maxYear = startYear;
  // Use result numYears when available, else fall back to the scenario's own `years` field
  scenarios.forEach((sc, i) => {
    const r = results[i];
    const numYrs = r?.numYears ?? Math.max(1, parseInt(sc.years) || 5);
    const scStart = startYear + (yearOffsets[i] ?? 0);
    const scEnd = scStart + numYrs - 1;
    if (scStart < minYear) minYear = scStart;
    if (scEnd > maxYear) maxYear = scEnd;
  });
  students.forEach(st => {
    const stEnd = (parseInt(st.startYear) || startYear) + (parseInt(st.fundingYears) || 4) - 1;
    if (stEnd > maxYear) maxYear = stEnd;
  });

  const years = Array.from({ length: Math.max(1, maxYear - minYear + 1) }, (_, i) => minYear + i);

  const COL_W = 68;
  const LABEL_W = 92;
  const TOTAL_W = 72;

  const yearData = years.map(yr => {
    let cfIn = 0;
    scenarios.forEach((_, i) => {
      const r = results[i];
      if (!r) return;
      const scStart = startYear + yearOffsets[i];
      const scEnd = scStart + r.numYears - 1;
      if (yr >= scStart && yr <= scEnd) cfIn += r.annualCashFlow;
    });
    let college = 0;
    students.forEach(st => {
      const stStart = parseInt(st.startYear) || startYear;
      const stEnd = stStart + (parseInt(st.fundingYears) || 4) - 1;
      if (yr >= stStart && yr <= stEnd) college += parseFloat(st.annualCost) || 0;
    });
    const cfApplied = Math.min(cfIn, college);
    const loanNeeded = Math.max(0, college - cfIn);
    const surplus = cfIn - college;
    return { year: yr, cfIn, college, cfApplied, loanNeeded, surplus };
  });

  const totalCF = yearData.reduce((s, d) => s + d.cfIn, 0);
  const totalCollege = yearData.reduce((s, d) => s + d.college, 0);
  const totalApplied = yearData.reduce((s, d) => s + d.cfApplied, 0);
  const totalLoan = yearData.reduce((s, d) => s + d.loanNeeded, 0);
  const totalSurplus = yearData.reduce((s, d) => s + d.surplus, 0);

  // Mirror the web client's FundingTimeline: the cash-flow-vs-college comparison
  // table, summary tiles, and extended legend only appear once a student with a
  // cost exists. The Simple view passes no students, so it shows just the
  // scenario bars + minimal legend — identical to the web Simple view.
  const showComparison = students.some((st) => (parseFloat(st.annualCost) || 0) > 0);

  return (
    <View style={{ backgroundColor: P.cardBg, borderRadius: 14, borderWidth: 2, borderColor: P.divider, shadowColor: P.navy, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3, overflow: 'visible' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: P.navyDark, paddingHorizontal: 14, paddingVertical: 12, borderTopLeftRadius: 14, borderTopRightRadius: 14 }}>
        <View style={[s.cardHeaderIconWrap, { backgroundColor: 'rgba(201,168,76,0.2)' }]}>
          <Ionicons name="bar-chart-outline" size={15} color={P.gold} />
        </View>
        <Text style={[s.cardHeaderText, { color: '#fff' }]}>YEAR-BASED FUNDING TIMELINE</Text>
      </View>

      {/* Horizontal scroll area */}
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ padding: 14 }}>
        <View>
          {/* Year header row */}
          <View style={{ flexDirection: 'row', marginLeft: LABEL_W, marginBottom: 6 }}>
            {years.map(yr => (
              <View key={yr} style={{ width: COL_W, alignItems: 'center' }}>
                <Text style={tl.yearLabel}>{yr}</Text>
              </View>
            ))}
            <View style={{ width: TOTAL_W }} />
          </View>

          {/* Scenario gantt bars */}
          {scenarios.map((sc, i) => {
            const r = results[i];
            const numYrs = r?.numYears ?? Math.max(1, parseInt(sc.years) || 5);
            const scStart = startYear + (yearOffsets[i] ?? 0);
            const scEnd = scStart + numYrs - 1;
            const startOff = Math.max(0, scStart - minYear);
            const endOff = Math.min(years.length - 1, scEnd - minYear);
            const span = Math.max(1, endOff - startOff + 1);
            const c = P.scenario[i % P.scenario.length];
            return (
              <View key={sc.id} style={tl.ganttRow}>
                <Text style={[tl.rowLabel, { width: LABEL_W }]}>Scenario {i + 1}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {startOff > 0 && <View style={{ width: startOff * COL_W }} />}
                  <View style={[tl.ganttBar, { width: span * COL_W - 4, backgroundColor: c.badge }]}>
                    <Text style={tl.ganttText} numberOfLines={1}>
                      {r ? `${fmt$(r.annualCashFlow)}/yr` : 'Enter purchase price'}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}

          {/* Student gantt bars */}
          {students.map((st, i) => {
            const stStart = parseInt(st.startYear) || startYear;
            const stYrs = parseInt(st.fundingYears) || 4;
            const stEnd = stStart + stYrs - 1;
            const annual = parseFloat(st.annualCost) || 0;
            const startOff = Math.max(0, stStart - minYear);
            const endOff = Math.min(years.length - 1, stEnd - minYear);
            const span = endOff - startOff + 1;
            if (span <= 0) return null;
            const name = st.name.trim() || `Student ${i + 1}`;
            const totalCost = annual * stYrs;
            let overlapCF = 0;
            scenarios.forEach((_, si) => {
              const r = results[si];
              if (!r) return;
              const scStart2 = startYear + yearOffsets[si];
              const scEnd2 = scStart2 + r.numYears - 1;
              const oStart = Math.max(scStart2, stStart);
              const oEnd = Math.min(scEnd2, stEnd);
              if (oEnd >= oStart) overlapCF += r.annualCashFlow * (oEnd - oStart + 1);
            });
            const fundedPct = totalCost > 0 ? Math.round((Math.min(overlapCF, totalCost) / totalCost) * 100) : 0;
            return (
              <View key={st.id} style={tl.ganttRow}>
                <Text style={[tl.rowLabel, { width: LABEL_W }]}>{name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {startOff > 0 && <View style={{ width: startOff * COL_W }} />}
                  <View style={[tl.ganttBar, { width: span * COL_W - 4, backgroundColor: P.green }]}>
                    <Text style={tl.ganttText} numberOfLines={1}>{fmt$(annual)}/yr · {fundedPct}% funded</Text>
                  </View>
                </View>
              </View>
            );
          })}

          {showComparison && (
            <>
              {/* Divider */}
              <View style={{ height: 1, backgroundColor: P.divider, marginVertical: 12, marginLeft: LABEL_W }} />
              <Text style={{ fontSize: 9, fontWeight: '800', color: P.heading, letterSpacing: 0.7, textTransform: 'uppercase', marginLeft: LABEL_W, marginBottom: 8 }}>
                CASH FLOW VS COLLEGE COST — YEAR BY YEAR
              </Text>

              {/* CF In row */}
              <View style={tl.tableRow}>
                <Text style={[tl.rowLabel, { width: LABEL_W }]}>CF In</Text>
                {yearData.map((d, i) => (
                  <View key={i} style={[tl.tableCell, { width: COL_W - 3, backgroundColor: d.cfIn > 0 ? P.navyDark : '#CBD5E1' }]}>
                    <Text style={tl.cellTxt} numberOfLines={1}>{d.cfIn > 0 ? fmt$(d.cfIn) : '—'}</Text>
                  </View>
                ))}
                <Text style={[tl.totalTxt, { color: P.heading, width: TOTAL_W }]}>{totalCF > 0 ? fmt$(totalCF) : '—'}</Text>
              </View>

              {/* College row */}
              <View style={tl.tableRow}>
                <Text style={[tl.rowLabel, { width: LABEL_W, color: '#D97706' }]}>College</Text>
                {yearData.map((d, i) => (
                  d.college > 0
                    ? <View key={i} style={[tl.tableCell, { width: COL_W - 3, backgroundColor: '#D97706' }]}>
                      <Text style={tl.cellTxt} numberOfLines={1}>{fmt$(d.college)}</Text>
                    </View>
                    : <View key={i} style={{ width: COL_W - 3 }} />
                ))}
                <Text style={[tl.totalTxt, { color: '#D97706', width: TOTAL_W }]}>{fmt$(totalCollege)}</Text>
              </View>

              {/* CF Applied row */}
              <View style={tl.tableRow}>
                <Text style={[tl.rowLabel, { width: LABEL_W, color: P.teal }]}>CF Applied</Text>
                {yearData.map((d, i) => (
                  d.cfApplied > 0
                    ? <View key={i} style={[tl.tableCell, { width: COL_W - 3, backgroundColor: P.teal }]}>
                      <Text style={tl.cellTxt} numberOfLines={1}>{fmt$(d.cfApplied)}</Text>
                    </View>
                    : <View key={i} style={{ width: COL_W - 3 }} />
                ))}
                <Text style={[tl.totalTxt, { color: P.teal, width: TOTAL_W }]}>{fmt$(totalApplied)}</Text>
              </View>

              {/* Loan Needed row */}
              <View style={tl.tableRow}>
                <Text style={[tl.rowLabel, { width: LABEL_W, color: P.danger }]}>Loan Needed</Text>
                {yearData.map((d, i) => (
                  d.loanNeeded > 0
                    ? <View key={i} style={[tl.tableCell, { width: COL_W - 3, backgroundColor: P.danger }]}>
                      <Text style={tl.cellTxt} numberOfLines={1}>{fmt$(d.loanNeeded)}</Text>
                    </View>
                    : <View key={i} style={{ width: COL_W - 3 }} />
                ))}
                <Text style={[tl.totalTxt, { color: P.danger, width: TOTAL_W }]}>{fmt$(totalLoan)}</Text>
              </View>

              {/* Surplus / Gap row */}
              <View style={tl.tableRow}>
                <Text style={[tl.rowLabel, { width: LABEL_W, color: P.teal }]}>Surplus/Gap</Text>
                {yearData.map((d, i) => {
                  const c = d.surplus < 0 ? P.danger : P.green;
                  return (
                    <View key={i} style={[tl.tableCell, { width: COL_W - 3, backgroundColor: c }]}>
                      <Text style={tl.cellTxt} numberOfLines={1}>{d.surplus >= 0 ? '+' : ''}{fmt$(d.surplus)}</Text>
                    </View>
                  );
                })}
                <Text style={[tl.totalTxt, { color: totalSurplus >= 0 ? P.green : P.danger, width: TOTAL_W }]}>
                  {totalSurplus >= 0 ? '+' : ''}{fmt$(totalSurplus)}
                </Text>
              </View>

              <View style={{ height: 6 }} />
            </>
          )}
        </View>
      </ScrollView>

      {/* Summary tiles — only with the college comparison (matches web) */}
      {showComparison && (
        <View style={tl.summaryRow}>
          {([
            { label: 'TOTAL CF AVAILABLE', value: fmt$(totalCF), bg: P.navyDark },
            { label: 'TOTAL COLLEGE COST', value: fmt$(totalCollege), bg: '#D97706' },
            { label: 'CF COVERS COLLEGE', value: fmt$(totalApplied), bg: P.teal },
            { label: 'TOTAL LOAN NEEDED', value: fmt$(totalLoan), bg: P.danger },
          ] as const).map(tile => (
            <View key={tile.label} style={[tl.summaryTile, { backgroundColor: tile.bg }]}>
              <Text style={tl.summaryTileLabel}>{tile.label}</Text>
              <Text style={tl.summaryTileValue}>{tile.value}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Legend — full set with the comparison; just the scenario bar otherwise */}
      <View style={tl.legend}>
        {(showComparison
          ? [
            { color: P.navyDark, label: 'Property CF In (navy)' },
            { color: P.green, label: 'Student funding period' },
            { color: P.teal, label: 'CF Applied to College (teal)' },
            { color: '#D97706', label: 'College Cost row (amber)' },
            { color: P.green, label: 'Surplus (CF > cost)' },
            { color: P.danger, label: 'Loan Needed / Gap' },
          ]
          : [{ color: P.navyDark, label: 'Property CF In (navy)' }]
        ).map(item => (
          <View key={item.label} style={tl.legendItem}>
            <View style={[tl.legendDot, { backgroundColor: item.color }]} />
            <Text style={tl.legendText}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Root screen ────────────────────────────────────────────────────────────────
export default function JvCalculatorScreen() {
  const { P, s } = useJv();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const headerBell = useNotificationsHeader();
  const [activeTab, setActiveTab] = useState<'simple' | 'advanced'>('simple');

  return (
    <View style={{ flex: 1, backgroundColor: P.pageBg }}>
      {/* Shared app header — same as Browse / Favorites (pinned, self-pads safe area) */}
      <ScreenHeader
        title="JV Calculator"
        subtitle="Pro forma investment modeling"
        iconName="calculator"
        onProfilePress={() => router.push('/(tabs)/profile')}
        {...headerBell}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: insets.bottom + 80 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Banner */}
          <View style={s.banner}>
            {/* Decorative circles */}
            <View style={s.bannerCircle1} />
            <View style={s.bannerCircle2} />
            <View style={s.bannerDot1} />
            <View style={s.bannerDot2} />
            <View style={s.bannerDot3} />

            <View style={s.bannerTop}>
              <View style={s.bannerBadge}>
                <Ionicons name="business" size={12} color={P.gold} />
                <Text style={s.bannerBadgeText}>50 / 50 JV</Text>
              </View>
              {/* Tabs */}
              <View style={s.tabs}>
                {([{ id: 'simple', label: 'Simple' }, { id: 'advanced', label: 'Advanced' }] as const).map(tab => (
                  <Pressable
                    key={tab.id}
                    onPress={() => setActiveTab(tab.id)}
                    style={[s.tabBtn, activeTab === tab.id && s.tabBtnActive]}
                  >
                    <Text style={[s.tabBtnText, activeTab === tab.id && s.tabBtnTextActive]}>{tab.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={s.bannerContent}>
              <Text style={s.bannerEyebrow}>JOINT VENTURE</Text>
              <Text style={s.bannerTitle}>Pro Forma{'\n'}<Text style={{ color: P.gold }}>Calculator</Text></Text>
              <Text style={s.bannerSub}>
                Model STR investment scenarios with tax analysis & equity projections
              </Text>
            </View>

            <View style={s.bannerFooter}>
              <View style={s.bannerPill}>
                <Ionicons name="home-outline" size={11} color="rgba(255,255,255,0.5)" />
                <Text style={s.bannerPillText}>Real Estate</Text>
              </View>
              <View style={s.bannerPillDivider} />
              <View style={s.bannerPill}>
                <Ionicons name="layers-outline" size={11} color="rgba(255,255,255,0.5)" />
                <Text style={s.bannerPillText}>Multi-Scenario</Text>
              </View>
              <View style={s.bannerPillDivider} />
              <View style={s.bannerPill}>
                <Ionicons name="trending-up-outline" size={11} color="rgba(255,255,255,0.5)" />
                <Text style={s.bannerPillText}>Tax Optimized</Text>
              </View>
            </View>
          </View>

          {activeTab === 'simple' ? <SimpleView /> : <AdvancedView />}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Table styles (t) ───────────────────────────────────────────────────────────
const makeT = (P: JvPalette) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  headRow: { backgroundColor: P.navy, borderBottomWidth: 0 },
  rowAlt: { backgroundColor: P.rowAlt },
  footRow: { backgroundColor: P.footBg, borderTopWidth: 1.5, borderTopColor: P.heading },
  cell: { paddingHorizontal: 6, paddingVertical: 9, fontSize: 10.5, color: P.text },
  cellRight: { textAlign: 'right', fontWeight: '600' },
  headText: { fontSize: 8.5, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase', color: '#fff' },
  footText: { fontWeight: '800', fontSize: 10.5, color: P.footText },
});

// ── Atom styles (a) ────────────────────────────────────────────────────────────
const makeA = (P: JvPalette) => StyleSheet.create({
  // section bar
  sectionBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: P.surfaceTint, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: P.divider },
  sectionBarAccent: { width: 3, height: 16, borderRadius: 2, backgroundColor: P.heading, marginRight: 8 },
  sectionBarText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase', color: P.heading, flex: 1 },

  // data row
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: P.emptyIconBg },
  dataLabel: { fontSize: 12.5, color: P.label, flex: 1 },
  dataValue: { fontSize: 13, fontWeight: '700', color: P.text },

  // chip
  chip: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: P.divider, backgroundColor: P.cardBg },
  chipText: { fontSize: 12, fontWeight: '700', color: P.label },

  // segmented control — floating pill style
  segment: { flexDirection: 'row', borderRadius: 10, backgroundColor: P.chipTrack, padding: 3, alignSelf: 'flex-start' },
  segBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8 },
  segBtnActive: { backgroundColor: P.navy, shadowColor: P.navy, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3 },
  segText: { fontSize: 12, fontWeight: '700', color: P.label },
  segTextActive: { color: '#fff' },

  // field
  fieldWrap: { gap: 5 },
  fieldLabel: { fontSize: 10, fontWeight: '800', color: P.label, letterSpacing: 0.8, textTransform: 'uppercase' },
  inputBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: P.divider, borderRadius: 10, backgroundColor: P.cardBg, height: 44, overflow: 'hidden' },
  inputBoxAuto: { borderColor: P.sky, backgroundColor: P.autoBg },
  input: { flex: 1, height: 44, paddingHorizontal: 12, fontSize: 14, color: P.text },
  affix: { paddingHorizontal: 11, fontSize: 13, color: P.muted, backgroundColor: P.surfaceInput, alignSelf: 'stretch', lineHeight: 44, textAlignVertical: 'center' },

  // year row
  yearRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },

  // hint
  hint: { fontSize: 11, color: P.label, marginTop: 4 },

  // oop strip
  oopStrip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: P.oopBg, borderRadius: 10, padding: 11, marginBottom: 10, borderWidth: 1, borderColor: P.oopBorder },
  oopStripText: { flex: 1, fontSize: 11, color: P.oopText, lineHeight: 15 },
  oopApplyBtn: { backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  oopApplyText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // input card (inside scenario)
  inputCard: { backgroundColor: P.cardBg, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: P.divider, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  reinvestRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, flexWrap: 'wrap', gap: 10 },
  reinvestLabel: { fontSize: 13.5, fontWeight: '700', color: P.text },
  reinvestHint: { fontSize: 11, color: P.muted, marginTop: 2 },
  divider: { height: 1, backgroundColor: P.divider },
  fieldsGrid: { padding: 14, gap: 14 },

  // misc
  assumedHint: { fontSize: 10, color: '#D97706', fontWeight: '600', marginTop: 2 },
  resetLink: { fontSize: 12, color: '#2563EB', fontWeight: '600', textDecorationLine: 'underline' },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: P.divider, backgroundColor: P.cardBg },
  resetBtnText: { fontSize: 11, fontWeight: '800', color: P.heading, letterSpacing: 0.3 },
});

// ── Screen styles (s) ─────────────────────────────────────────────────────────
const makeS = (P: JvPalette) => StyleSheet.create({
  // banner
  banner: { backgroundColor: P.navyDark, borderRadius: 22, padding: 22, marginBottom: 20, overflow: 'hidden' },
  bannerCircle1: { position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: 90, borderWidth: 1, borderColor: 'rgba(201,168,76,0.18)', backgroundColor: 'rgba(201,168,76,0.07)' },
  bannerCircle2: { position: 'absolute', top: 15, right: 30, width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: 'rgba(201,168,76,0.12)', backgroundColor: 'rgba(201,168,76,0.05)' },
  bannerDot1: { position: 'absolute', bottom: 28, left: 22, width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(201,168,76,0.4)' },
  bannerDot2: { position: 'absolute', bottom: 50, left: 44, width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(201,168,76,0.22)' },
  bannerDot3: { position: 'absolute', top: 65, right: 115, width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)' },

  bannerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  bannerBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(201,168,76,0.15)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)' },
  bannerBadgeText: { fontSize: 11, fontWeight: '800', color: P.gold, letterSpacing: 0.6 },

  bannerContent: { marginBottom: 18 },
  bannerEyebrow: { fontSize: 10, fontWeight: '800', color: 'rgba(201,168,76,0.7)', letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 6 },
  bannerTitle: { fontSize: 32, fontWeight: '900', color: '#fff', lineHeight: 38, marginBottom: 10 },
  bannerSub: { fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 19, maxWidth: '88%' },

  bannerFooter: { flexDirection: 'row', alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  bannerPill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bannerPillText: { fontSize: 10.5, fontWeight: '600', color: 'rgba(255,255,255,0.42)', letterSpacing: 0.2 },
  bannerPillDivider: { width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.12)', marginHorizontal: 12 },

  // tab switcher
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 3 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  tabBtnActive: { backgroundColor: P.gold, shadowColor: P.gold, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 3 },
  tabBtnText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.45)' },
  tabBtnTextActive: { color: P.navyDark, fontWeight: '800' },

  // generic card
  card: { backgroundColor: P.cardBg, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: P.divider, shadowColor: '#1B3A5C', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: P.surfaceTint, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: P.divider },
  cardHeaderIconWrap: { width: 30, height: 30, borderRadius: 9, backgroundColor: 'rgba(27,58,92,0.09)', alignItems: 'center', justifyContent: 'center' },
  cardHeaderText: { fontSize: 11, fontWeight: '800', color: P.heading, letterSpacing: 0.7, textTransform: 'uppercase', flex: 1 },
  cardBody: { padding: 14, gap: 12 },

  // scenario card
  scenarioCard: { borderRadius: 14, borderWidth: 2, overflow: 'hidden', backgroundColor: P.cardBg, shadowColor: '#1B3A5C', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  scenarioHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  badge: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  scenarioTitle: { fontSize: 14, fontWeight: '800' },
  scenarioMeta: { fontSize: 11.5, fontWeight: '500' },
  scenarioReturn: { fontSize: 12, fontWeight: '800', marginTop: 1 },
  scenarioActions: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  iconBtn: { width: 30, height: 30, borderRadius: 9, borderWidth: 1.5, borderColor: P.divider, backgroundColor: P.cardBg, alignItems: 'center', justifyContent: 'center' },
  scenarioBody: { padding: 14, gap: 12 },

  // empty state
  emptyBox: { alignItems: 'center', gap: 10, padding: 32, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: P.divider, backgroundColor: P.emptyBg, marginTop: 8 },
  emptyIconWrap: { width: 52, height: 52, borderRadius: 16, backgroundColor: P.emptyIconBg, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  emptyBoxTitle: { fontSize: 14, fontWeight: '700', color: P.text },
  emptyBoxText: { fontSize: 12.5, color: P.muted, textAlign: 'center', lineHeight: 18 },

  // table card
  tableCard: { backgroundColor: P.cardBg, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: P.divider, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  tableWrap: { padding: 0 },

  // total box
  totalBox: { borderRadius: 12, padding: 16, marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalBoxLabel: { fontSize: 8.5, fontWeight: '700', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.6 },
  totalBoxValue: { fontSize: 22, fontWeight: '900', color: P.gold },

  // metric strip (advanced)
  metricStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricItem: { flex: 1, minWidth: '43%', backgroundColor: P.cardBg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: P.divider, gap: 4, borderTopWidth: 3, borderTopColor: P.divider },
  metricItemAccent: { backgroundColor: P.accentFill, borderColor: P.accentFill, borderTopColor: P.gold },
  metricLabel: { fontSize: 9, fontWeight: '800', color: P.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  metricValue: { fontSize: 16, fontWeight: '900', color: P.text },

  // inline editable field (tax snapshot)
  inlineEditRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  inlineInput: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: P.divider, borderRadius: 8, height: 34, overflow: 'hidden' },
  inlineTextInput: { width: 72, height: 34, paddingHorizontal: 8, fontSize: 13, color: P.text, textAlign: 'right' },
  inlineAffix: { paddingHorizontal: 7, fontSize: 12, color: P.muted, backgroundColor: P.surfaceInput, alignSelf: 'stretch', lineHeight: 34, textAlignVertical: 'center' },
  // Inline appreciation-% editor inside the Sale Snapshot's "Est. Sale Price" row.
  // No fixed height (so bold text isn't vertically clipped) and no wrap (so the
  // trailing "% p.a.)" never drops to a cut-off second line).
  salePriceLabel: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  inlineInputSm: { borderWidth: 1.5, borderColor: P.sky, borderRadius: 7, backgroundColor: P.autoBg, justifyContent: 'center', marginHorizontal: 5, paddingHorizontal: 2 },
  inlineTextInputSm: { minWidth: 40, paddingVertical: 3, paddingHorizontal: 4, fontSize: 13, fontWeight: '700', color: P.autoText, textAlign: 'center' },

  // return tiles (advanced)
  tilesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  returnTile: { flex: 1, minWidth: '43%', backgroundColor: P.cardBg, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: P.divider, gap: 6, borderLeftWidth: 3, borderLeftColor: P.teal },
  returnTileLabel: { fontSize: 9, fontWeight: '800', color: P.muted, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.4 },
  returnTileValue: { fontSize: 15, fontWeight: '900', color: P.text, textAlign: 'center' },

  // cumulative card
  cumulCard: { borderRadius: 14, borderWidth: 2, overflow: 'hidden', shadowColor: P.navy, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  cumulHeader: { paddingHorizontal: 16, paddingVertical: 16, overflow: 'hidden' },
  cumulCircle1: { position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: 60, borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)', backgroundColor: 'rgba(201,168,76,0.07)' },
  cumulCircle2: { position: 'absolute', top: 10, right: 50, width: 55, height: 55, borderRadius: 28, backgroundColor: 'rgba(201,168,76,0.05)' },
  cumulHeaderInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cumulIconWrap: { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(201,168,76,0.2)', alignItems: 'center', justifyContent: 'center' },
  cumulHeaderText: { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  cumulHeaderSub: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  cumulBody: { backgroundColor: P.cardBg, padding: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  // stat tile
  statTile: { flex: 1, minWidth: '43%', backgroundColor: P.statTileBg, borderRadius: 12, padding: 14, alignItems: 'center', gap: 5, borderWidth: 1, borderColor: P.divider },
  statTileAccent: { backgroundColor: P.accentFill, borderColor: P.accentFill },
  statTileLabel: { fontSize: 9, fontWeight: '800', color: P.muted, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
  statTileValue: { fontSize: 17, fontWeight: '900', color: P.text, textAlign: 'center' },

  // college planning
  addStudentBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(201,168,76,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)' },
  addStudentText: { color: P.gold, fontSize: 11.5, fontWeight: '700' },

  studentCard: { borderRadius: 12, borderWidth: 1, borderColor: P.divider, overflow: 'hidden', backgroundColor: P.cardBg, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  studentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 },
  studentBadge: { width: 24, height: 24, borderRadius: 7, backgroundColor: P.navy, alignItems: 'center', justifyContent: 'center' },
  studentBadgeText: { fontSize: 11, fontWeight: '900', color: '#fff' },
  studentName: { fontSize: 13, fontWeight: '800', color: P.heading, letterSpacing: 0.3 },
  studentFields: { padding: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  studentStats: { flexDirection: 'row', padding: 10, gap: 8, backgroundColor: P.surfaceInput, borderTopWidth: 1, borderTopColor: P.divider },
  studentStat: { flex: 1, alignItems: 'center', backgroundColor: P.cardBg, borderRadius: 10, padding: 9, borderWidth: 1, borderColor: P.divider },
  studentStatLabel: { fontSize: 9, fontWeight: '800', color: P.muted, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },
  studentStatValue: { fontSize: 13, fontWeight: '800', color: P.text, textAlign: 'center', marginTop: 2 },

  fundingBadge: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, borderWidth: 1.5, padding: 14 },
  fundingIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fundingStatus: { fontSize: 13, fontWeight: '800' },
  fundingAmount: { fontSize: 20, fontWeight: '900', marginTop: 2 },
  fundingHint: { fontSize: 11, color: P.muted, marginTop: 3 },
});

// ── Timeline styles (tl) ──────────────────────────────────────────────────────
const makeTl = (P: JvPalette) => StyleSheet.create({
  yearLabel: { fontSize: 10, fontWeight: '700', color: P.label, textAlign: 'center' },
  rowLabel: { fontSize: 11, fontWeight: '700', color: P.text, alignSelf: 'center', paddingRight: 6 },
  ganttRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  ganttBar: { height: 30, borderRadius: 6, justifyContent: 'center', paddingHorizontal: 10 },
  ganttText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  tableRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 3 },
  tableCell: { height: 26, borderRadius: 4, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 },
  cellTxt: { fontSize: 9, fontWeight: '700', color: '#fff', textAlign: 'center' },
  totalTxt: { fontSize: 11, fontWeight: '800', textAlign: 'right', alignSelf: 'center' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: P.divider },
  summaryTile: { flex: 1, minWidth: '43%', borderRadius: 10, padding: 14, alignItems: 'center', gap: 4 },
  summaryTileLabel: { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  summaryTileValue: { fontSize: 18, fontWeight: '900', color: '#fff', textAlign: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: P.divider },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 10, color: P.label },
});
