import { useState, useMemo, useEffect } from 'react';
import {
  fmt$, runCalc, DEFAULT_OOP_RATIO, YearSelector, SectionHeader, DataRow,
} from '../utils/calculatorHelpers';
import "../styles/main.css";
import { FaSave, FaUndo } from "react-icons/fa";
import { useAuth } from '../contexts/AuthContext';
import { calculatorAPI } from '../api/calculator';

// ── Year-Based Funding Timeline ───────────────────────────────────────────────
function FundingTimeline({ scenarios, scenarioResults, yearOffsets, students = [], baseYear }) {
  // Always build bars — use result numYears when available, else fall back to scenario.years
  const scenarioBars = scenarios.map((s, idx) => {
    const result = scenarioResults[idx];
    const numYrs = result?.numYears ?? Math.max(1, parseInt(s.years) || 5);
    const startAbs = baseYear + (yearOffsets[idx] ?? 0);
    const endAbs = startAbs + numYrs - 1;
    return {
      label: `Scenario ${idx + 1}`,
      startYear: startAbs,
      endYear: endAbs,
      annualCashFlow: result?.annualCashFlow ?? null,
      hasResult: !!result,
    };
  });

  const studentBars = students.map((s, idx) => {
    const startYear = parseInt(s.startYear) || (baseYear + 2);
    const fundingYrs = Math.max(1, parseInt(s.fundingYears) || 4);
    return {
      label: s.name.trim() || `Student ${idx + 1}`,
      startYear,
      endYear: startYear + fundingYrs - 1,
      annualCost: parseFloat(s.annualCost) || 0,
    };
  });

  if (scenarioBars.length === 0 && studentBars.length === 0) return null;

  const allYears = [
    baseYear,
    ...scenarioBars.flatMap(b => [b.startYear, b.endYear]),
    ...studentBars.flatMap(b => [b.startYear, b.endYear]),
  ];
  const minYear = Math.min(...allYears);
  const maxYear = Math.max(...allYears);
  const totalSpan = maxYear - minYear + 1;

  const barStyle = (startYear, endYear) => ({
    left: `${((startYear - minYear) / totalSpan) * 100}%`,
    width: `${((endYear - startYear + 1) / totalSpan) * 100}%`,
  });

  const yearMarkers = Array.from({ length: totalSpan }, (_, i) => minYear + i);

  const yearData = yearMarkers.map(year => {
    const cashFlowIn = scenarioBars.reduce((sum, bar) =>
      (year >= bar.startYear && year <= bar.endYear && bar.annualCashFlow) ? sum + bar.annualCashFlow : sum, 0);
    const collegeCostOut = studentBars.reduce((sum, bar) =>
      (year >= bar.startYear && year <= bar.endYear) ? sum + bar.annualCost : sum, 0);
    const loanNeeded = Math.max(0, collegeCostOut - cashFlowIn);
    const cashFlowApplied = Math.min(cashFlowIn, collegeCostOut);
    return { year, cashFlowIn, collegeCostOut, net: cashFlowIn - collegeCostOut, loanNeeded, cashFlowApplied };
  });

  const totalCFIn = yearData.reduce((s, d) => s + d.cashFlowIn, 0);
  const totalCollege = yearData.reduce((s, d) => s + d.collegeCostOut, 0);
  const totalLoan = yearData.reduce((s, d) => s + d.loanNeeded, 0);
  const totalCFApplied = yearData.reduce((s, d) => s + d.cashFlowApplied, 0);

  const showComparison = scenarioBars.length > 0 && studentBars.some(b => b.annualCost > 0);

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3" style={{ backgroundColor: '#d6e8f7' }}>
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#1a3a5c]">
          Year-Based Funding Timeline
        </p>
      </div>
      <div className="bg-white p-5 overflow-x-auto">

        <div className="flex items-center gap-3 mb-3" style={{ minWidth: `${totalSpan * 48 + 108}px` }}>
          <div className="w-24 shrink-0" />
          <div className="relative flex-1 h-5 pb-4">
            {yearMarkers.map(y => (
              <span
                key={y}
                className="absolute text-[13px] text-black-400 font-medium -translate-x-1/2"
                style={{ left: `${((y - minYear + 0.5) / totalSpan) * 100}%` }}>
                {y}
              </span>
            ))}
            <div className="absolute bottom-0 left-0 right-0 border-b border-slate-200" />
          </div>
          <div className="w-24 shrink-0" />
        </div>

        <div className="space-y-2.5" style={{ minWidth: `${totalSpan * 48 + 108}px` }}>
          {scenarioBars.map((bar, i) => (
            <div key={`sc${i}`} className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-slate-500 w-24 shrink-0 text-right truncate">{bar.label}</span>
              <div className="relative flex-1 h-9 bg-slate-50 rounded-lg">
                {yearMarkers.map(y => (
                  <div key={y} className="absolute top-0 bottom-0 border-l border-slate-100"
                    style={{ left: `${((y - minYear) / totalSpan) * 100}%` }} />
                ))}
                <div
                  className="absolute h-full rounded-lg flex items-center px-2 overflow-hidden"
                  style={{ ...barStyle(bar.startYear, bar.endYear), backgroundColor: '#1a3a5c', opacity: bar.hasResult ? 1 : 0.55 }}>
                  <span className="text-[10px] font-bold text-white whitespace-nowrap">
                    {bar.hasResult ? `${fmt$(bar.annualCashFlow)}/yr` : 'Enter purchase price'}
                  </span>
                </div>
              </div>
              <div className="w-24 shrink-0" />
            </div>
          ))}

          {scenarioBars.length > 0 && studentBars.length > 0 && (
            <div className="border-t border-dashed border-slate-200 ml-[6.5rem]" />
          )}

          {studentBars.map((bar, i) => {
            const overlapCashFlow = scenarioBars.reduce((sum, sb) => {
              const oStart = Math.max(sb.startYear, bar.startYear);
              const oEnd = Math.min(sb.endYear, bar.endYear);
              return oEnd >= oStart ? sum + sb.annualCashFlow * (oEnd - oStart + 1) : sum;
            }, 0);
            const totalCost = bar.annualCost * (bar.endYear - bar.startYear + 1);
            const coveragePct = totalCost > 0 ? Math.round(Math.min(overlapCashFlow / totalCost, 1) * 100) : null;

            return (
              <div key={`st${i}`} className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-slate-500 w-24 shrink-0 text-right truncate">{bar.label}</span>
                <div className="relative flex-1 h-9 bg-slate-50 rounded-lg">
                  {yearMarkers.map(y => (
                    <div key={y} className="absolute top-0 bottom-0 border-l border-slate-100"
                      style={{ left: `${((y - minYear) / totalSpan) * 100}%` }} />
                  ))}
                  {bar.annualCost > 0 ? (
                    <>
                      <div className="absolute h-full rounded-lg"
                        style={{ ...barStyle(bar.startYear, bar.endYear), backgroundColor: '#fed7aa' }} />
                      {yearMarkers.map(y => {
                        if (y < bar.startYear || y > bar.endYear) return null;
                        const yearCF = scenarioBars.reduce((sum, sb) =>
                          (y >= sb.startYear && y <= sb.endYear) ? sum + sb.annualCashFlow : sum, 0);
                        if (!yearCF) return null;
                        return (
                          <div key={`cov-${y}`} className="absolute h-full opacity-80"
                            style={{
                              left: `${((y - minYear) / totalSpan) * 100}%`,
                              width: `${(1 / totalSpan) * 100}%`,
                              backgroundColor: '#0f766e',
                            }} />
                        );
                      })}
                    </>
                  ) : (
                    <div className="absolute h-full rounded-lg"
                      style={{ ...barStyle(bar.startYear, bar.endYear), backgroundColor: '#b45309', opacity: 0.5 }} />
                  )}
                  <div className="absolute h-full flex items-center px-2 overflow-hidden pointer-events-none"
                    style={barStyle(bar.startYear, bar.endYear)}>
                    <span className="text-[10px] font-bold text-white whitespace-nowrap drop-shadow-sm">
                      {bar.annualCost > 0 ? `${fmt$(bar.annualCost)}/yr` : 'cost TBD'}
                      {coveragePct !== null && ` · ${coveragePct}% funded`}
                    </span>
                  </div>
                </div>
                <div className="w-24 shrink-0" />
              </div>
            );
          })}
        </div>

        {showComparison && (
          <div className="mt-5" style={{ minWidth: `${totalSpan * 48 + 108}px` }}>
            <div className="ml-[6.5rem] border-t-2 border-dashed border-slate-200 mb-3" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-[6.5rem] mb-2.5 pl-3">
              Cash Flow vs College Cost — Year by Year
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold w-24 shrink-0 text-right" style={{ color: '#1a3a5c' }}>CF In</span>
                <div className="relative flex-1 h-9 bg-slate-50 rounded-lg overflow-hidden">
                  {yearMarkers.map(y => (
                    <div key={y} className="absolute top-0 bottom-0 border-l border-slate-100"
                      style={{ left: `${((y - minYear) / totalSpan) * 100}%` }} />
                  ))}
                  {yearData.map(({ year, cashFlowIn }) => {
                    if (!cashFlowIn) return null;
                    return (
                      <div key={year} className="absolute h-full flex items-center justify-center"
                        style={{ left: `${((year - minYear) / totalSpan) * 100}%`, width: `${(1 / totalSpan) * 100}%`, backgroundColor: '#1a3a5c' }}>
                        <span className="text-[9px] font-bold text-white truncate px-0.5">{fmt$(cashFlowIn)}</span>
                      </div>
                    );
                  })}
                </div>
                <span className="text-[10px] font-bold w-24 shrink-0 whitespace-nowrap text-right" style={{ color: '#1a3a5c' }}>
                  {fmt$(totalCFIn)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold w-24 shrink-0 text-right" style={{ color: '#b45309' }}>College</span>
                <div className="relative flex-1 h-9 bg-slate-50 rounded-lg overflow-hidden">
                  {yearMarkers.map(y => (
                    <div key={y} className="absolute top-0 bottom-0 border-l border-slate-100"
                      style={{ left: `${((y - minYear) / totalSpan) * 100}%` }} />
                  ))}
                  {yearData.map(({ year, collegeCostOut }) => {
                    if (!collegeCostOut) return null;
                    return (
                      <div key={year} className="absolute h-full flex items-center justify-center"
                        style={{ left: `${((year - minYear) / totalSpan) * 100}%`, width: `${(1 / totalSpan) * 100}%`, backgroundColor: '#b45309' }}>
                        <span className="text-[9px] font-bold text-white truncate px-0.5">{fmt$(collegeCostOut)}</span>
                      </div>
                    );
                  })}
                </div>
                <span className="text-[10px] font-bold w-24 shrink-0 whitespace-nowrap text-right" style={{ color: '#b45309' }}>
                  {fmt$(totalCollege)}
                </span>
              </div>
              {totalCFApplied > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold w-24 shrink-0 text-right" style={{ color: '#0f766e' }}>CF Applied</span>
                  <div className="relative flex-1 h-9 bg-slate-50 rounded-lg overflow-hidden">
                    {yearMarkers.map(y => (
                      <div key={y} className="absolute top-0 bottom-0 border-l border-slate-100"
                        style={{ left: `${((y - minYear) / totalSpan) * 100}%` }} />
                    ))}
                    {yearData.map(({ year, cashFlowApplied }) => {
                      if (!cashFlowApplied) return null;
                      return (
                        <div key={year} className="absolute h-full flex items-center justify-center"
                          style={{ left: `${((year - minYear) / totalSpan) * 100}%`, width: `${(1 / totalSpan) * 100}%`, backgroundColor: '#0f766e' }}>
                          <span className="text-[9px] font-bold text-white truncate px-0.5">{fmt$(cashFlowApplied)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <span className="text-[10px] font-bold w-24 shrink-0 whitespace-nowrap text-right" style={{ color: '#0f766e' }}>
                    {fmt$(totalCFApplied)}
                  </span>
                </div>
              )}
              {totalLoan > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold w-24 shrink-0 text-right" style={{ color: '#b91c1c' }}>Loan Needed</span>
                  <div className="relative flex-1 h-9 bg-slate-50 rounded-lg overflow-hidden">
                    {yearMarkers.map(y => (
                      <div key={y} className="absolute top-0 bottom-0 border-l border-slate-100"
                        style={{ left: `${((y - minYear) / totalSpan) * 100}%` }} />
                    ))}
                    {yearData.map(({ year, loanNeeded }) => {
                      if (!loanNeeded) return null;
                      return (
                        <div key={year} className="absolute h-full flex items-center justify-center"
                          style={{ left: `${((year - minYear) / totalSpan) * 100}%`, width: `${(1 / totalSpan) * 100}%`, backgroundColor: '#b91c1c' }}>
                          <span className="text-[9px] font-bold text-white truncate px-0.5">{fmt$(loanNeeded)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <span className="text-[10px] font-bold w-24 shrink-0 whitespace-nowrap text-right" style={{ color: '#b91c1c' }}>
                    {fmt$(totalLoan)}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-slate-500 w-24 shrink-0 text-right">Surplus/Gap</span>
                <div className="relative flex-1 h-9 bg-slate-50 rounded-lg overflow-hidden">
                  {yearMarkers.map(y => (
                    <div key={y} className="absolute top-0 bottom-0 border-l border-slate-100"
                      style={{ left: `${((y - minYear) / totalSpan) * 100}%` }} />
                  ))}
                  {yearData.map(({ year, cashFlowIn, collegeCostOut, net }) => {
                    if (cashFlowIn === 0 && collegeCostOut === 0) return null;
                    const isSurplus = net >= 0;
                    const label = net > 0 ? `+${fmt$(net)}` : fmt$(net);
                    return (
                      <div key={year} className="absolute flex items-center justify-center"
                        style={{
                          left: `calc(${((year - minYear) / totalSpan) * 100}% + 2px)`,
                          width: `calc(${(1 / totalSpan) * 100}% - 4px)`,
                          top: '3px', bottom: '3px',
                          backgroundColor: isSurplus ? '#15803d' : '#b91c1c',
                          borderRadius: '4px',
                        }}>
                        <span className="text-[9px] font-bold text-white truncate px-0.5">{label}</span>
                      </div>
                    );
                  })}
                </div>
                {(() => {
                  const netTotal = totalCFIn - totalCollege;
                  return (
                    <span className="text-[10px] font-bold w-24 shrink-0 whitespace-nowrap text-right"
                      style={{ color: netTotal >= 0 ? '#15803d' : '#b91c1c' }}>
                      {netTotal >= 0 ? `+${fmt$(netTotal)}` : fmt$(netTotal)}
                    </span>
                  );
                })()}
              </div>
            </div>
            <div className="mt-4 ml-[6.5rem] grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'Total CF Available', value: fmt$(totalCFIn), bg: '#1a3a5c' },
                { label: 'Total College Cost', value: fmt$(totalCollege), bg: '#b45309' },
                { label: 'CF Covers College', value: fmt$(totalCFApplied), bg: '#0f766e' },
                {
                  label: totalLoan > 0 ? 'Total Loan Needed' : 'Fully Funded ✓',
                  value: totalLoan > 0 ? fmt$(totalLoan) : fmt$(totalCFApplied - totalCollege > 0 ? totalCFIn - totalCollege : 0),
                  bg: totalLoan > 0 ? '#b91c1c' : '#15803d',
                },
              ].map(({ label, value, bg }) => (
                <div key={label} className="rounded-xl px-3 py-2.5 text-center" style={{ backgroundColor: bg }}>
                  <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.75)' }}>{label}</p>
                  <p className="text-sm font-bold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-[11px] font-medium text-slate-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#1a3a5c' }} />
            Property CF In (navy)
          </div>
        </div>
      </div>
    </div>
  );
}

const fmtComma = (val) => {
  const num = String(val ?? '').replace(/,/g, '');
  if (!num) return '';
  const parsed = Number(num);
  return isNaN(parsed) ? num : parsed.toLocaleString('en-US');
};

let _idCounter = 1;
const newScenario = (overrides = {}) => ({
  id: _idCounter++,
  purchasePrice: '',
  oopOverride: null,
  cashFlowPct: '8',
  apprPct: '7',
  years: '5',
  federalTaxRate: '32',
  reinvestCashFlow: false,
  ...overrides,
});

const SCENARIO_COLORS = [
  { bg: '#f0f6ff', border: '#b8d4f5', header: '#dbeafe', badge: '#1a3a5c' },
  { bg: '#f0fdf9', border: '#99e6cc', header: '#ccf5e7', badge: '#065f46' },
  { bg: '#fffdf0', border: '#fde68a', header: '#fef9c3', badge: '#92400e' },
  { bg: '#faf5ff', border: '#ddd6fe', header: '#ede9fe', badge: '#5b21b6' },
  { bg: '#fff5f5', border: '#fecaca', header: '#fee2e2', badge: '#9f1239' },
];

export default function SimpleView() {
  const { user } = useAuth();
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customYearsInput, setCustomYearsInput] = useState('1, 6, 11, 16');
  const [scenarios, setScenarios] = useState(() => [
    newScenario(), newScenario(), newScenario(), newScenario(),
  ]);
  const [expandedScenarios, setExpandedScenarios] = useState(
    () => new Set([scenarios[0]?.id]),
  );

  // ── Parse custom year list ────────────────────────────────────────────────
  const parsedCustomYears = useMemo(() =>
    customYearsInput
      .split(/[\s,]+/)
      .map(s => parseInt(s, 10))
      .filter(n => Number.isFinite(n) && n >= 1)
      .sort((a, b) => a - b)
      .filter((v, i, arr) => i === 0 || arr[i - 1] !== v),
    [customYearsInput]);

  // ── Auto-sync scenario count to parsed year list ──────────────────────────
  useEffect(() => {
    const needed = parsedCustomYears.length;
    if (needed === 0) return;
    setScenarios(prev => {
      if (prev.length === needed) return prev;
      if (needed > prev.length) {
        const last = prev[prev.length - 1];
        const extras = Array.from({ length: needed - prev.length }, () => newScenario({
          cashFlowPct: last?.cashFlowPct,
          apprPct: last?.apprPct,
          years: last?.years,
          federalTaxRate: last?.federalTaxRate,
        }));
        return [...prev, ...extras];
      }
      return prev.slice(0, needed);
    });
  }, [parsedCustomYears]);

  // ── Update a field on a scenario (same logic as advanced view) ────────────
  const updateScenario = (id, field, value) => {
    setScenarios(prev => {
      const changedIdx = prev.findIndex(s => s.id === id);
      if (changedIdx === -1) return prev;
      return prev.map((s, i) => {
        if (i === changedIdx) {
          if (field === 'purchasePrice') return { ...s, purchasePrice: value };
          if (field === 'oopOverride') {
            if (value === null || value === '') return { ...s, oopOverride: value };
            return { ...s, oopOverride: value };
          }
          return { ...s, [field]: value };
        }
        // Toggling reinvestCashFlow on an earlier scenario clears downstream purchase prices
        if (field === 'reinvestCashFlow' && i > changedIdx) {
          return { ...s, purchasePrice: '' };
        }
        return s;
      });
    });
  };

  const toggleScenario = (id) =>
    setExpandedScenarios(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const addScenario = () => {
    const last = scenarios[scenarios.length - 1];
    const lastYear = parsedCustomYears.length > 0
      ? parsedCustomYears[parsedCustomYears.length - 1] + 5
      : 6;
    const added = newScenario({
      cashFlowPct: last?.cashFlowPct,
      apprPct: last?.apprPct,
      years: last?.years,
      federalTaxRate: last?.federalTaxRate,
      reinvestCashFlow: last?.reinvestCashFlow ?? false,
    });
    setScenarios(prev => [...prev, added]);
    setExpandedScenarios(prev => new Set([...prev, added.id]));
    setCustomYearsInput(prev => (prev.trim() ? prev + ', ' + lastYear : String(lastYear)));
  };

  const removeScenario = (idx) => {
    if (scenarios.length <= 1) return;
    const removedId = scenarios[idx].id;
    setScenarios(prev => prev.filter((_, i) => i !== idx));
    setExpandedScenarios(prev => { const n = new Set(prev); n.delete(removedId); return n; });
    const years = parsedCustomYears.filter((_, i) => i !== idx);
    setCustomYearsInput(years.join(', '));
  };

  const duplicateScenario = (idx) => {
    const src = scenarios[idx];
    const lastYear = parsedCustomYears.length > 0
      ? parsedCustomYears[parsedCustomYears.length - 1] + 5
      : 6;
    const duped = newScenario({
      purchasePrice: src.purchasePrice,
      oopOverride: src.oopOverride,
      cashFlowPct: src.cashFlowPct,
      apprPct: src.apprPct,
      years: src.years,
      federalTaxRate: src.federalTaxRate,
      reinvestCashFlow: src.reinvestCashFlow,
    });
    setScenarios(prev => [...prev, duped]);
    setExpandedScenarios(prev => new Set([...prev, duped.id]));
    setCustomYearsInput(prev => (prev.trim() ? prev + ', ' + lastYear : String(lastYear)));
  };

  // ── Year offsets derived from parsed custom years ─────────────────────────
  const yearOffsets = useMemo(() =>
    scenarios.map((_, idx) => {
      const yr = parsedCustomYears[idx];
      return yr !== undefined
        ? yr - 1
        : (parsedCustomYears.length > 0
          ? parsedCustomYears[parsedCustomYears.length - 1] - 1 + (idx - parsedCustomYears.length + 1)
          : idx * 5);
    }),
    [scenarios, parsedCustomYears]);

  // ── Sequential results with chaining (same as advanced view) ─────────────
  const scenarioResults = useMemo(() => {
    const results = [];
    scenarios.forEach((s, idx) => {
      const prevResult = idx > 0 ? results[idx - 1] : null;
      const prevScenario = idx > 0 ? scenarios[idx - 1] : null;
      const chainedOop = prevResult
        ? (prevScenario?.reinvestCashFlow !== false
          ? prevResult.totalReturn
          : prevResult.totalReturn - prevResult.totalDist)
        : 0;
      const autoOop = prevResult
        ? chainedOop
        : (s.purchasePrice ? Math.round(parseFloat(s.purchasePrice) * DEFAULT_OOP_RATIO) : 0);

      const oopForPrice = s.oopOverride != null && s.oopOverride !== '' ? parseFloat(s.oopOverride) : autoOop;
      const effectivePrice = s.purchasePrice ||
        (oopForPrice > 0 ? String(Math.round(oopForPrice / DEFAULT_OOP_RATIO)) : '');

      const yr = parsedCustomYears[idx];
      const yOffset = yr !== undefined
        ? yr - 1
        : (parsedCustomYears.length > 0
          ? parsedCustomYears[parsedCustomYears.length - 1] - 1 + (idx - parsedCustomYears.length + 1)
          : idx * 5);

      results.push(runCalc({
        purchasePrice: effectivePrice,
        oop: s.oopOverride != null ? s.oopOverride : autoOop,
        cashFlowPct: s.cashFlowPct,
        appreciationPct: s.apprPct,
        years: s.years,
        federalTaxRate: s.federalTaxRate,
        scenarioStartYear: startYear + yOffset,
      }));
    });
    return results;
  }, [scenarios, parsedCustomYears, startYear]);

  // ── Cumulative summary (2+ scenarios with results) ────────────────────────
  const cumulative = useMemo(() => {
    const valid = scenarioResults.filter(Boolean);
    if (valid.length < 2) return null;
    const totalYears =
      yearOffsets[scenarios.length - 1] + (scenarioResults[scenarios.length - 1]?.numYears ?? 0);
    const lastResult = valid[valid.length - 1];
    return {
      totalDist: valid.reduce((s, r) => s + r.totalDist, 0),
      totalTaxSavings: valid.reduce((s, r) => s + r.taxSavings, 0),
      lastPortfolioValue: lastResult?.estSalePrice ?? 0,
      totalYears,
    };
  }, [scenarioResults, yearOffsets, scenarios.length]);



  const handleReset = () => {
    const defaultScenarios = [newScenario(), newScenario(), newScenario(), newScenario()];
    setStartYear(new Date().getFullYear());
    setScenarios(defaultScenarios);
    setExpandedScenarios(new Set([defaultScenarios[0].id]));
    setCustomYearsInput('1, 6, 11, 16');
  };

  const handleSaveCalculation = async () => {
    try {
      setSaving(true);

      const validScenarios = scenarios.filter(Boolean);

      const payload = validScenarios.map((scenario, idx) => {
        const prevResult = idx > 0 ? scenarioResults[idx - 1] : null;
        const prevScenario = idx > 0 ? validScenarios[idx - 1] : null;

        const chainedOop = prevResult
          ? (
            prevScenario?.reinvestCashFlow !== false
              ? prevResult.totalReturn
              : prevResult.totalReturn - prevResult.totalDist
          )
          : 0;

        const autoOop = prevResult
          ? chainedOop
          : (
            scenario.purchasePrice
              ? Math.round(parseFloat(scenario.purchasePrice) * DEFAULT_OOP_RATIO)
              : 0
          );

        const finalOop =
          scenario.oopOverride != null && scenario.oopOverride !== ''
            ? Number(scenario.oopOverride)
            : autoOop;

        return {
          ...scenario,
          oopValue: finalOop,
        };
      });

      const finalPayload = {
        startYear,
        customYears: parsedCustomYears,
        scenarios: payload,
        type: 'simple',
        client_email: user?.email,
      };

      const response = await calculatorAPI.storeCalculator(finalPayload);

      console.log('Saved successfully:', response.data);
      alert('Calculation saved successfully!');

    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save calculation.');

    } finally {
      setSaving(false);
    }
  };
  useEffect(() => {
    const fetchCalculator = async () => {
      try {
        const userEmail = user?.email;
        const type = 'simple';

        const response = await calculatorAPI.getCalculator(
          userEmail,
          type
        );

        console.log('Retrieved data from database:', response.data);

        const dbstoredData = response.data.data[0]?.payload;

        if (dbstoredData) {
          setStartYear(dbstoredData.startYear);
          setScenarios(dbstoredData.scenarios);

          if (dbstoredData.customYears) {
            setCustomYearsInput(
              dbstoredData.customYears.join(', ')
            );
          }
        }
      } catch (error) {
        console.error('Failed to get calculator data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.email) {
      fetchCalculator();
    } else {
      setLoading(false);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-[#1a3a5c] animate-spin" />
        <p className="text-sm font-medium text-slate-500"></p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Purchase Schedule ──────────────────────────────────────────────── */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm Schedule-box">
        <p className="text-[14px] font-bold uppercase tracking-wider text-[#1a3a5c] detr mb-6">
          Purchase Schedule
        </p>
        <div className="flex flex-wrap gap-6 items-start year-col">

          {/* Start Year */}
          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-bold uppercase tracking-wider text-black-500">Start Year</label>
            <input
              type="number"
              value={startYear}
              onChange={e => setStartYear(parseInt(e.target.value) || new Date().getFullYear())}
              className="w-28 rounded-xl border border-slate-400 px-3 py-2.5 text-sm font-medium text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </div>

          {/* Purchase Years */}
          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-bold uppercase tracking-wider text-black-500">
              Purchase Years (comma-separated)
            </label>
            <input
              type="text"
              value={customYearsInput}
              onChange={e => setCustomYearsInput(e.target.value)}
              placeholder="e.g. 1, 6, 11, 16"
              className="w-64 rounded-xl border border-slate-400 px-3 py-2.5 text-sm font-medium text-slate-800 placeholder-slate-300 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
            {parsedCustomYears.length > 0 && (
              <p className="text-[15px] text-black-500">
                {parsedCustomYears.length} purchase{parsedCustomYears.length > 1 ? 's' : ''} in year{parsedCustomYears.length > 1 ? 's' : ''}{' '}
                {parsedCustomYears.join(', ')} → calendar years{' '}
                <strong className="text-[#1a3a5c]">
                  {parsedCustomYears.map(y => startYear + y - 1).join(', ')}
                </strong>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="ml-auto flex items-center gap-3 flex-wrap cumulative-summary scenario-add-btns">
          <button
            type="button"
            className="px-6 py-3 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2 whitespace-nowrap"
            onClick={handleReset}
          >
            <FaUndo size={14} />
            <span>Reset</span>
          </button>
          <button
            type="button"
            className="px-6 py-3 text-sm font-semibold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap"
            onClick={handleSaveCalculation}
            disabled={saving}
          >
            <FaSave size={17} />
            <span>{saving ? 'Saving...' : 'Save Calculation'}</span>
          </button>
        </div>
      </div>

      {/* ── Scenario cards ─────────────────────────────────────────────────── */}
      {scenarios.map((scenario, idx) => {

        const result = scenarioResults[idx];
        const yOffset = yearOffsets[idx] ?? 0;
        const prevResult = idx > 0 ? scenarioResults[idx - 1] : null;
        const prevScenario = idx > 0 ? scenarios[idx - 1] : null;
        const endYear = yOffset + (result?.numYears ?? parseInt(scenario.years) ?? 5);
        const colors = SCENARIO_COLORS[idx % SCENARIO_COLORS.length];
        const isExpanded = expandedScenarios.has(scenario.id);

        const chainedOop = prevResult
          ? (prevScenario?.reinvestCashFlow !== false
            ? prevResult.totalReturn
            : prevResult.totalReturn - prevResult.totalDist)
          : 0;
        const autoOop = prevResult
          ? chainedOop
          : (scenario.purchasePrice ? Math.round(parseFloat(scenario.purchasePrice) * DEFAULT_OOP_RATIO) : 0);

        const oopForDisplay = scenario.oopOverride != null && scenario.oopOverride !== ''
          ? parseFloat(scenario.oopOverride)
          : autoOop;
        const assumedPurchasePrice = !scenario.purchasePrice && oopForDisplay > 0
          ? Math.round(oopForDisplay / DEFAULT_OOP_RATIO)
          : null;

        const exitRefi = result ? result.oopValue + result.clientShare : 0;
        const taxSavingsYear = result && result.numYears >= 2 ? 2 : 1;

        return (
          <div key={scenario.id} className="mb-4 rounded-2xl overflow-hidden"
            style={{ border: `2px solid ${colors.border}` }}>

            {/* Collapsible header */}
            <div
              className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none f-wrap  scenario-add-btns"
              style={{ background: colors.header }}
              onClick={() => toggleScenario(scenario.id)}
            >
              <span
                className="inline-flex items-center rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white shrink-0"
                style={{ background: colors.badge }}
              >
                Scenario {idx + 1}
              </span>
              <span className="text-sm font-semibold text-slate-600">
                Years {yOffset + 1}–{endYear}
              </span>
              <span className="text-sm text-black-400">
                {startYear + yOffset} – {startYear + endYear - 1}
              </span>

              <div className="ml-auto flex items-center gap-1 f-wrap" onClick={e => e.stopPropagation()}>
                <button
                  onClick={addScenario}
                  className="text-xs font-semibold text-sky-600 hover:text-sky-800 transition-colors scenario-btns">
                  + Add Scenario {scenarios.length + 1}
                </button>
                <button
                  onClick={() => duplicateScenario(idx)}
                  className="text-xs font-semibold text-sky-600 hover:text-sky-800 transition-colors scenario-btns dup-btn">
                  ⧉ Duplicate
                </button>
                {idx > 0 && (
                  <button
                    onClick={() => removeScenario(idx)}
                    className="text-xs font-semibold text-red-400 hover:text-red-600 transition-colors scenario-btns remove-btn">
                    × Remove
                  </button>
                )}
              </div>
              <svg
                className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 down-arrow ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Collapsible body */}
            {isExpanded && (
              <div className="p-5" style={{ background: colors.bg }}>

                {/* OOP banner for Scenario 1 */}
                {idx === 0 && oopForDisplay > 0 && (
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2.5 oop-banner-pill">
                      <span className="text-base">💰</span>
                      <p className="text-sm text-blue-700">
                        <strong>Out-of-Pocket: {fmt$(oopForDisplay)}</strong>
                        {!scenario.oopOverride
                          ? ' — auto-calculated from purchase price.'
                          : ' — you have a custom Out-of-Pocket set.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        updateScenario(scenario.id, 'purchasePrice', '');
                        setTimeout(() =>
                          updateScenario(
                            scenario.id, 'purchasePrice',
                            String(Math.round(oopForDisplay / DEFAULT_OOP_RATIO)),
                          ), 0);
                      }}
                      className="shrink-0 self-center rounded-lg bg-sky-500 px-5 py-2 text-xs font-bold text-white hover:bg-sky-600 transition-colors shadow-sm"
                    >
                      Apply Assumptions ↑
                    </button>
                  </div>
                )}

                {/* Chained OOP banner (scenarios 2+) */}
                {prevResult && (
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2.5 oop-banner-pill">
                      <span className="text-base">💰</span>
                      <p className="text-sm text-blue-700">
                        <strong>Scenario {idx} exit proceeds: {fmt$(chainedOop)}</strong>
                        {prevScenario?.reinvestCashFlow === false && (
                          <span className="ml-1 text-blue-500">
                            (cash flow excluded — Reinvest Cash Flow: No)
                          </span>
                        )}
                        {!scenario.oopOverride
                          ? ' — auto-filled as Out-of-Pocket for this scenario.'
                          : ' — you have a custom Out-of-Pocket set.'}
                      </p>
                    </div>
                    {chainedOop > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          updateScenario(scenario.id, 'purchasePrice', '');
                          setTimeout(() =>
                            updateScenario(
                              scenario.id, 'purchasePrice',
                              String(Math.round((parseFloat(scenario.oopOverride) || chainedOop) / DEFAULT_OOP_RATIO)),
                            ), 0);
                        }}
                        className="shrink-0 self-center rounded-lg bg-sky-500 px-5 py-2 text-xs font-bold text-white hover:bg-sky-600 transition-colors shadow-sm"
                      >
                        Apply Assumptions ↑
                      </button>
                    )}
                  </div>
                )}

                {/* Input card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mt-2 Scenario-box">

                  {/* Reinvest Cash Flow toggle */}
                  <div className="mb-5 flex flex-wrap items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">Reinvest Cash Flow :</span>
                    <div className="flex rounded-xl border border-slate-200 overflow-hidden">
                      {[{ val: true, label: 'Yes' }, { val: false, label: 'No' }].map(opt => (
                        <button
                          key={String(opt.val)}
                          type="button"
                          onClick={() => updateScenario(scenario.id, 'reinvestCashFlow', opt.val)}
                          className={`px-4 py-2 text-sm font-bold transition-colors ${scenario.reinvestCashFlow === opt.val
                            ? 'bg-[#1a3a5c] text-white'
                            : 'bg-white text-slate-600 hover:text-sky-700'
                            }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-slate-400 italic">
                      {scenario.reinvestCashFlow
                        ? "Cash flow distributions included in next scenario's capital"
                        : 'Only sale proceeds carry forward to next scenario'}
                    </span>
                  </div>

                  {/* Input fields */}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 cash-flow-col">
                    {[
                      {
                        label: 'Purchase Price', field: 'purchasePrice', prefix: '$',
                        placeholder: assumedPurchasePrice ? String(assumedPurchasePrice) : '500,000',
                        assumedHint: assumedPurchasePrice, classItem: '',
                      },
                      {
                        label: 'Out-of-Pocket',
                        field: 'oopOverride',
                        prefix: '$',
                        placeholder: autoOop ? String(autoOop) : '150,000',
                        autoValue: autoOop ? String(autoOop) : null,
                      },
                      { label: 'Cash Flow %', field: 'cashFlowPct', suffix: '%', placeholder: '8' },
                      { label: 'Appreciation %', field: 'apprPct', suffix: '%', placeholder: '7' },
                      { label: 'Federal Tax Rate', field: 'federalTaxRate', suffix: '%', placeholder: '32' },
                    ].map(({ label, field, prefix, suffix, placeholder, autoValue, assumedHint, classItem }) => {
                      const isUnset = scenario[field] == null;
                      const displayValue = isUnset ? (autoValue || '') : scenario[field];
                      const isAutoFilled = isUnset && !!autoValue;
                      return (
                        <div key={field} className="flex flex-col gap-1 cash-flow-label">
                          <label className="text-[12px] font-bold uppercase tracking-wider text-black-500 mb-2">
                            {label}
                          </label>
                          <div className="relative flex items-center">
                            {prefix && (
                              <span className={`pointer-events-none absolute left-3 text-sm text-black-500 ${classItem || ''}`}>{prefix}</span>
                            )}
                            <input
                              type={prefix === '$' ? 'text' : 'number'}
                              inputMode={prefix === '$' ? 'numeric' : undefined}
                              value={prefix === '$' ? fmtComma(displayValue) : displayValue}
                              onChange={e => updateScenario(scenario.id, field, prefix === '$' ? e.target.value.replace(/,/g, '') : e.target.value)}
                              placeholder={placeholder}
                              className={`w-full rounded-xl border bg-white py-2.5 text-sm font-medium placeholder-black-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 ${prefix ? 'pl-7' : 'pl-3'
                                } ${suffix ? 'pr-10' : 'pr-3'} ${isAutoFilled
                                  ? 'border-sky-200 bg-sky-50 text-sky-700 focus:border-sky-400'
                                  : 'border-slate-400 text-slate-800'
                                }`}
                            />
                            {suffix && (
                              <span className="pointer-events-none absolute right-3 text-sm text-black-500">{suffix}</span>
                            )}
                          </div>
                          {assumedHint && !scenario[field] && (
                            <p className="text-[12px] font-medium text-amber-600 mt-1">
                              Assumed: {fmt$(assumedHint)} (from Out-of-Pocket)
                            </p>
                          )}
                        </div>
                      );
                    })}
                    <YearSelector
                      value={scenario.years}
                      customYear={true}
                      onChange={val => updateScenario(scenario.id, 'years', val)}
                    />
                  </div>

                  {scenario.oopOverride != null && (
                    <button
                      type="button"
                      onClick={() => updateScenario(scenario.id, 'oopOverride', null)}
                      className="mt-4 text-[13px] font-medium text-sky-600 hover:text-sky-800 underline underline-offset-2"
                    >
                      Reset Out-of-Pocket to default
                    </button>
                  )}
                </div>

                {/* Results */}
                {result ? (
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">

                    {/* Cash Flow table */}
                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden cash-returne">
                      <SectionHeader>
                        Client {result.numYears}-Year Cash Flow &amp; Equity Growth (Yrs {yOffset + 1}–{endYear})
                      </SectionHeader>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr style={{ backgroundColor: '#f0f5fb' }}>
                              {['Year', 'Property Value', 'Exit/Refi', 'Tax Savings', 'Annual Cash Flow'].map(h => (
                                <th
                                  key={h}
                                  className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-black-500 text-right first:text-left whitespace-nowrap"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {result.yearRows.map(row => (
                              <tr key={row.year} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-2.5 font-medium text-slate-700">Yr {yOffset + row.year}</td>
                                <td className="px-4 py-2.5 text-right font-medium text-slate-800">{fmt$(row.propertyValue)}</td>
                                <td className="px-4 py-2.5 text-right font-bold text-slate-800">
                                  {row.year === result.numYears ? fmt$(exitRefi) : ''}
                                </td>
                                <td className="px-4 py-2.5 text-right font-medium text-slate-700">
                                  {row.year === taxSavingsYear ? fmt$(result.taxSavings) : ''}
                                </td>
                                <td className="px-4 py-2.5 text-right font-bold text-sky-700">{fmt$(row.cashFlow)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-slate-200 bg-slate-50 total-row">
                              <td className="px-4 py-2.5 font-bold text-slate-700">Total</td>
                              <td className="px-4 py-2.5 text-right font-bold text-slate-800">{fmt$(result.estSalePrice)}</td>
                              <td className="px-4 py-2.5 text-right font-bold text-slate-800">{fmt$(exitRefi)}</td>
                              <td className="px-4 py-2.5 text-right font-bold text-slate-700">{fmt$(result.taxSavings)}</td>
                              <td className="px-4 py-2.5 text-right font-bold text-sky-700">{fmt$(result.totalDist)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    {/* Sale Snapshot */}
                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden cash-returne">
                      <SectionHeader>Sale Snapshot at Exit Year {endYear}</SectionHeader>
                      <div className="px-5 py-5 space-y-4">
                        <DataRow label="Accelerated Appr. Gain" value={fmt$(result.apprGain)} />
                        <DataRow label="Return of Investment" value={fmt$(result.oopValue)} />
                        <DataRow label="Net Sale Proceeds (To Be Split 50/50)" value={fmt$(result.netSaleProceeds)} />
                        <DataRow label="50% of Sale Proceeds" value={fmt$(result.clientShare)} />
                      </div>
                      <div className="px-5 pb-5 total-est-btn">
                        <div className="rounded-2xl px-5 py-4 text-right" style={{ backgroundColor: '#1a3a5c' }}>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">
                            Total Est. Return/Benefit
                          </p>
                          <p className="text-2xl font-bold text-white">{fmt$(result.totalReturn)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="mt-4 flex h-32 items-center justify-center rounded-2xl border border-dashed bg-white"
                    style={{ borderColor: colors.border }}
                  >
                    <p className="text-sm font-medium text-slate-400 px-4">
                      {idx === 0
                        ? `Enter a purchase price to generate Scenario 1's pro forma`
                        : `Enter data in Scenario ${idx} to generate Scenario ${idx + 1}'s pro forma`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Cumulative Summary (2+ scenarios) ──────────────────────────────── */}
      {cumulative && (
        <div className="mt-4 rounded-2xl overflow-hidden border-2 border-[#1a3a5c]">
          <div className="px-5 py-3.5" style={{ backgroundColor: '#1a3a5c' }}>
            <p className="text-[13px] font-bold uppercase tracking-wider text-white">
              {cumulative.totalYears}-Year Summary — {scenarios.length} Scenarios
            </p>
          </div>
          <div className="bg-white p-5 grid grid-cols-2 gap-4 sm:grid-cols-4 Cumulative-summary">
            <div className="rounded-2xl px-4 py-3 text-center flex flex-col items-center justify-center col-span-2 sm:col-span-1" style={{ backgroundColor: '#1a3a5c' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1.5 leading-tight">
                Total Real Estate Portfolio Value
              </p>
              <p className="text-xl font-bold text-white">{fmt$(cumulative.lastPortfolioValue)}</p>
            </div>
            {[
              { label: 'Total Cash Flow', value: fmt$(cumulative.totalDist) },
              { label: 'Total Tax Savings', value: fmt$(cumulative.totalTaxSavings) },
              { label: 'Total Years', value: `${cumulative.totalYears} yrs` },
            ].map(({ label, value }) => (
              <div key={label} className="text-center py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 leading-tight">
                  {label}
                </p>
                <p className="text-xl font-bold text-[#1a3a5c]">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Year-Based Funding Timeline ─────────────────────────────────────── */}
      <FundingTimeline
        scenarios={scenarios}
        scenarioResults={scenarioResults}
        yearOffsets={yearOffsets}
        students={[]}
        baseYear={startYear}
      />
    </div>
  );
}
