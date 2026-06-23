import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import "../styles/main.css";
import SimpleView from './SimpleView';
import { FaSave, FaUndo } from "react-icons/fa";
import { useAuthSafe } from '../contexts/AuthContext';
import { calculatorAPI } from '../api/calculator';
import {
  BONUS_DEPR_RATIO, CLIENT_SPLIT, DEFAULT_OOP_RATIO, YEAR_PRESETS,
  fmt$, fmtPct, runCalc, SectionHeader, DataRow, YearSelector,
} from '../utils/calculatorHelpers';

const SCENARIO_COLORS = [
  { bg: '#f0f6ff', border: '#b8d4f5', header: '#dbeafe', badge: '#1a3a5c' },
  { bg: '#f0fdf9', border: '#99e6cc', header: '#ccf5e7', badge: '#065f46' },
  { bg: '#fffdf0', border: '#fde68a', header: '#fef9c3', badge: '#92400e' },
  { bg: '#faf5ff', border: '#ddd6fe', header: '#ede9fe', badge: '#5b21b6' },
  { bg: '#fff5f5', border: '#fecaca', header: '#fee2e2', badge: '#9f1239' },
];

const fmtComma = (val) => {
  const num = String(val ?? '').replace(/,/g, '');
  if (!num) return '';
  const parsed = Number(num);
  return isNaN(parsed) ? num : parsed.toLocaleString('en-US');
};

const LS_KEY = 'property_calculator_state';

// ── Default scenario factory ─────────────────────────────────────────────────
let _idCounter = 1;
const newScenario = (overrides = {}) => ({
  id: _idCounter++,
  purchasePrice: '',
  oopOverride: null,
  bonusDeprOverride: null,
  cashFlowPct: '8',
  apprPct: '7',
  years: '5',
  federalTaxRate: '32',
  reinvestCashFlow: false,
  ...overrides,
});

function createInitialState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if (saved?.scenarios?.length) {
      const maxId = Math.max(...saved.scenarios.map(s => s.id));
      _idCounter = maxId + 1;
      return {
        activeTab: 'simple',
        scenarios: saved.scenarios,
        expandedScenarios: new Set(saved.expandedScenarios ?? [saved.scenarios[0]?.id]),
        students: saved.students ?? [],
        purchaseInterval: saved.purchaseInterval ?? 5,
        intervalMode: saved.intervalMode ?? 'from-start',
        startYear: saved.startYear ?? new Date().getFullYear(),
        scheduleMode: saved.scheduleMode ?? 'interval',
        customYearsInput: saved.customYearsInput ?? '1, 3, 7',
      };
    }
  } catch {}
  const defaultScenarios = [newScenario(), newScenario(), newScenario()];
  return {
    activeTab: 'simple',
    scenarios: defaultScenarios,
    expandedScenarios: new Set([defaultScenarios[0].id]),
    students: [],
    purchaseInterval: 5,
    intervalMode: 'from-start',
    startYear: new Date().getFullYear(),
    scheduleMode: 'interval',
    customYearsInput: '1, 3, 7',
  };
}

function ShieldIcon() {
  return (
    <div className="relative inline-flex shrink-0">
      <svg viewBox="0 0 32 36" fill="none" className="w-7 h-7" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 2L3 8v10c0 8.284 5.593 15.998 13 18 7.407-2.002 13-9.716 13-18V8L16 2z" fill="#1a3a5c" />
        <path d="M10 17l4 4 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {/* <span className="absolute -top-1 -right-1 inline-flex h-3 w-3 rounded-full bg-red-500 border-2 border-white" /> */}
    </div>
  );
}

// ── Purchase Schedule ────────────────────────────────────────────────────────
function PurchaseSchedule({
  startYear, onStartYearChange,
  scheduleMode, onScheduleModeChange,
  customYearsInput, onCustomYearsChange, parsedCustomYears,
  interval, mode, onIntervalChange, onModeChange,
  onSaveCalculation, onReset, savedFeedback, saving,
}) {
  return (
    <div>
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
              onChange={e => onStartYearChange(parseInt(e.target.value) || new Date().getFullYear())}
              className="w-28 rounded-xl border border-slate-400 px-3 py-2.5 text-sm font-medium text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
          </div>

          {/* Schedule Mode toggle */}
          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-bold uppercase tracking-wider text-black-500">Schedule Type</label>
            <div className="flex rounded-xl border border-slate-200 overflow-hidden">
              {[
                { value: 'interval', label: 'Regular Interval' },
                { value: 'custom', label: 'Custom Years' },
              ].map(opt => (
                <button key={opt.value} type="button" onClick={() => onScheduleModeChange(opt.value)}
                  className={`px-4 py-2.5 text-sm font-bold transition-colors ${scheduleMode === opt.value ? 'bg-[#1a3a5c] text-white' : 'bg-white text-slate-600 hover:text-sky-700 border-slate-400'
                    }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Regular interval controls */}
          {scheduleMode === 'interval' && (
            <>
              <div className="flex flex-col gap-2">
                <label className="text-[12px] font-bold uppercase tracking-wider text-black-500">Buy Every (Years)</label>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(y => (
                    <button key={y} type="button" onClick={() => onIntervalChange(y)}
                      className={`w-9 h-9 rounded-xl text-sm font-bold border transition-colors ${interval === y
                        ? 'bg-[#1a3a5c] text-white border-[#1a3a5c]'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-sky-400 hover:text-sky-700'
                        }`}>
                      {y}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-black-500">Interval Counts From</label>
                <div className="flex rounded-xl border border-slate-200 overflow-hidden">
                  {[
                    { value: 'from-start', label: 'Purchase Date', desc: 'Scenarios may overlap' },
                    { value: 'from-exit', label: 'Exit Date', desc: 'Gap after each sale' },
                  ].map(opt => (
                    <button key={opt.value} type="button" onClick={() => onModeChange(opt.value)}
                      className={`flex flex-col items-center px-5 py-2.5 text-sm font-bold transition-colors ${mode === opt.value ? 'bg-[#1a3a5c] text-white' : 'bg-white text-slate-600 hover:text-sky-700'
                        }`}>
                      {opt.label}
                      <span className={`text-[13px] font-normal mt-0.5 ${mode === opt.value ? 'text-blue-200' : 'text-slate-400'}`}>
                        {opt.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-end pb-1">
                <p className="text-sm text-black-500 italic">
                  {mode === 'from-start'
                    ? `New property every ${interval} yr${interval > 1 ? 's' : ''} from purchase date — scenarios may overlap`
                    : `New property ${interval} yr${interval > 1 ? 's' : ''} after previous exit — no overlap`
                  }
                </p>
              </div>
            </>
          )}

          {/* Custom years controls */}
          {scheduleMode === 'custom' && (
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-black-500">
                Purchase Years (comma-separated)
              </label>
              <input
                type="text"
                value={customYearsInput}
                onChange={e => onCustomYearsChange(e.target.value)}
                placeholder="e.g. 1, 3, 7"
                className="w-64 rounded-xl border border-slate-400 px-3 py-2.5 text-sm font-medium text-slate-800 placeholder-slate-300 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 "
              />
              {parsedCustomYears.length > 0 && (
                <p className="text-[15px] text-black-500">
                  {parsedCustomYears.length} purchase{parsedCustomYears.length > 1 ? 's' : ''} in year{parsedCustomYears.length > 1 ? 's' : ''}{' '}
                  {parsedCustomYears.join(', ')} → calendar years{' '}
                  <strong className="text-[#1a3a5c]">{parsedCustomYears.map(y => startYear + y - 1).join(', ')}</strong>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="ml-auto flex items-center gap-3 flex-wrap cumulative-summary scenario-add-btns">
          <button
            type="button"
            className="px-6 py-3 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2 whitespace-nowrap"
            onClick={onReset}
          >
            <FaUndo size={14} />
            <span>Reset</span>
          </button>
          <button
            type="button"
            disabled={saving}
            className={`px-6 py-3 text-sm font-semibold text-white rounded-lg shadow-md transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed ${savedFeedback ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            onClick={onSaveCalculation}
          >
            <FaSave size={17} />
            <span>{saving ? 'Saving...' : savedFeedback ? 'Saved!' : 'Save Calculation'}</span>
          </button>
        </div>
      </div>
    </div>

  );
}



// ── Scenario input form ──────────────────────────────────────────────────────
function ScenarioForm({ scenario, onChange, prevResult, prevScenario, scenarioIdx }) {
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




  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm mt-8 Scenario-box">
      {/* OOP banner for Scenario 1 */}


      {!prevResult && oopForDisplay > 0 && (
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
              onChange('purchasePrice', '');
              setTimeout(() => onChange('purchasePrice', String(Math.round(oopForDisplay / DEFAULT_OOP_RATIO))), 0);
            }}
            className="shrink-0 self-center rounded-lg bg-sky-500 px-5 py-2 text-xs font-bold text-white hover:bg-sky-600 transition-colors shadow-sm"
          >
            Apply Assumptions ↑
          </button>
        </div>
      )}
      {prevResult && (
        <div className="mt-4 mb-4 flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2.5 oop-banner-pill">
            <span className="text-base">💰</span>
            <p className="text-sm text-blue-700">
              <strong>Scenario {scenarioIdx - 1} exit proceeds: {fmt$(chainedOop)}</strong>
              {prevScenario?.reinvestCashFlow === false && (
                <span className="ml-1 text-blue-500">(cash flow excluded — Reinvest Cash Flow: No)</span>
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
                onChange('purchasePrice', '');
                setTimeout(() => onChange('purchasePrice', String(Math.round((parseFloat(scenario.oopOverride) || chainedOop) / DEFAULT_OOP_RATIO))), 0);
              }}
              className="shrink-0 self-center rounded-lg bg-sky-500 px-5 py-2 text-xs font-bold text-white hover:bg-sky-600 transition-colors shadow-sm"
            >
              Apply Assumptions ↑
            </button>
          )}
        </div>
      )}

      {/* Reinvest Cash Flow toggle */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-slate-700">Reinvest Cash Flow :</span>
        <div className="flex rounded-xl border border-slate-200 overflow-hidden">
          {[{ val: true, label: 'Yes' }, { val: false, label: 'No' }].map(opt => (
            <button key={String(opt.val)} type="button"
              onClick={() => onChange('reinvestCashFlow', opt.val)}
              className={`px-4 py-2 text-sm font-bold transition-colors ${scenario.reinvestCashFlow === opt.val
                ? 'bg-[#1a3a5c] text-white'
                : 'bg-white text-slate-600 hover:text-sky-700'
                }`}>
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 italic">
          {scenario.reinvestCashFlow
            ? 'Cash flow distributions included in next scenario\'s capital'
            : 'Only sale proceeds carry forward to next scenario'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 cash-flow-col">
        {[
          {
            label: 'Purchase Price', field: 'purchasePrice', prefix: '$',
            placeholder: assumedPurchasePrice ? String(assumedPurchasePrice) : '500,000',
            assumedHint: assumedPurchasePrice,
          },
          {
            label: 'Out-of-Pocket', field: 'oopOverride', prefix: '$', placeholder: '150,000',
            autoValue: autoOop ? String(autoOop) : null,
          },
          { label: 'Cash Flow %', field: 'cashFlowPct', suffix: '%', placeholder: '8' },
          { label: 'Appreciation %', field: 'apprPct', suffix: '%', placeholder: '7' },
          { label: 'Federal Tax Rate', field: 'federalTaxRate', suffix: '%', placeholder: '32' },
        ].map(({ label, field, prefix, suffix, placeholder, autoValue, useAsPlaceholder, assumedHint }) => {
          const isUnset = scenario[field] == null;
          const displayValue = isUnset ? (useAsPlaceholder ? '' : (autoValue || '')) : scenario[field];
          const effectivePlaceholder = isUnset && useAsPlaceholder && autoValue ? autoValue : placeholder;
          const isAutoFilled = isUnset && !useAsPlaceholder && !!autoValue;
          return (
            <div key={field} className="flex flex-col gap-1">
              <label className="text-[12px] font-bold uppercase tracking-wider text-black-500 mb-2">{label}</label>
              <div className="relative flex items-center">
                {prefix && <span className="pointer-events-none absolute left-3 text-sm text-black-500">{prefix}</span>}
                <input
                  type={prefix === '$' ? 'text' : 'number'}
                  inputMode={prefix === '$' ? 'numeric' : undefined}
                  value={prefix === '$' ? fmtComma(displayValue) : displayValue}
                  onChange={e => onChange(field, prefix === '$' ? e.target.value.replace(/,/g, '') : e.target.value)}
                  placeholder={effectivePlaceholder}
                  className={`w-full rounded-xl border border-slate-400 bg-white py-2.5 text-sm font-medium text-slate-800 placeholder-black-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 ${prefix ? 'pl-7' : 'pl-3'} ${suffix ? 'pr-10' : 'pr-3'} ${isAutoFilled
                    ? 'border-sky-200 bg-sky-50 text-sky-700 focus:border-sky-400'
                    : 'border-slate-200 bg-white text-slate-800 placeholder-slate-300 focus:border-sky-400'
                    }`}
                />
                {suffix && <span className="pointer-events-none absolute right-3 text-sm text-black-500">{suffix}</span>}
              </div>
              {assumedHint && !scenario[field] && (
                <p className="text-[14px] font-medium text-amber-600 assumed-text">
                  Assumed: {fmt$(assumedHint)} (from Out-of-Pocket)
                </p>
              )}
            </div>
          );
        })}
        <YearSelector value={scenario.years} onChange={val => onChange('years', val)} />
      </div>

      {scenario.oopOverride !== null && (
        <button type="button" onClick={() => onChange('oopOverride', null)}
          className="mt-4 text-[13px] font-medium text-sky-600 hover:text-sky-800 underline underline-offset-2">
          Reset Out-of-Pocket to default
        </button>
      )}
    </div>
  );
}

// ── Pro-forma display (one scenario) ─────────────────────────────────────────
function ProForma({ results, yearOffset, scenario, onTaxRateChange, onApprPctChange, onBonusDeprChange }) {
  const apprPct = scenario.apprPct;
  const startYear = yearOffset + 1;
  const endYear = yearOffset + results.numYears;

  return (
    <div className="space-y-4">

      {/* Summary Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 flex flex-wrap items-stretch gap-3 py-10 px-5">
        <div className="flex flex-col items-center justify-center px-5 py-2 min-w-[110px]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-black-500">Purchase Price</p>
          <p className="text-2xl font-bold text-slate-800 mt-0.5">{fmt$(results.price)}</p>
        </div>
        <div className="flex flex-col items-center justify-center px-5 py-5 min-w-[110px]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-black-500">Out-of-Pocket</p>
          <p className="text-2xl font-bold text-slate-800 mt-0.5">{fmt$(results.oopValue)}</p>
        </div>
        {[
          { label: 'Initial Tax Savings', value: fmt$(results.taxSavings) },
          { label: 'Total Net Cash Inflow', value: fmt$(results.totalDist) },
          { label: 'Total Return & Benefit', value: fmt$(results.totalReturn) },
          { label: 'Annualized Return', value: fmtPct(results.annReturn) },
        ].map(({ label, value }) => (
          <div key={label}
            className="flex flex-1 flex-col items-start justify-center rounded-xl px-5 py-3 min-w-[130px] text-center"
            style={{ backgroundColor: '#1a3a5c' }}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white leading-tight text-left">{label}</p>
            <p className="text-2xl font-bold text-white mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Three-Column */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

        {/* Cash-on-Cash Returns */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden cash-returne">
          <SectionHeader>
            Cash-on-Cash Returns (Yr {startYear}, {yearOffset + results.midYear}, {endYear})
          </SectionHeader>
          <div className="px-5 py-5 space-y-5">
            <DataRow label={`Yr ${startYear} Cash-on-Cash`} value={fmtPct(results.coc1yr)} />
            <DataRow label={`Yr ${yearOffset + results.midYear} Cash-on-Cash`} value={fmtPct(results.cocMidYr)} />
            <DataRow label={`Yr ${endYear} Cash-on-Cash`} value={fmtPct(results.cocNyr)} />
          </div>
        </div>

        {/* Client OOP Investment */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden cash-returne">
          <SectionHeader>Client Out-of-Pocket Investment</SectionHeader>
          <div className="px-5 py-5 space-y-4">
            <DataRow label="LLC Joint Venture Buy-In" value={fmt$(results.oopValue)} />

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-sm font-bold text-slate-700">Total Out-of-Pocket</span>
              <span className="text-sm font-bold text-sky-700">{fmt$(results.oopValue)}</span>
            </div>
          </div>
        </div>

        {/* Client Tax Snapshot */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden cash-returne">
          <SectionHeader>Client Tax Snapshot (Year {startYear})</SectionHeader>
          <div className="px-5 py-5 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-slate-500">Est. Bonus Depreciation</span>
              <div className="flex items-center gap-1">
                <span className="text-sm text-slate-400">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={fmtComma(scenario.bonusDeprOverride != null ? scenario.bonusDeprOverride : results.bonusDepr)}
                  onChange={e => onBonusDeprChange(e.target.value.replace(/,/g, ''))}
                  className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-medium text-right text-slate-800 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
              </div>
            </div>
            {scenario.bonusDeprOverride != null && (
              <button
                type="button"
                onClick={() => onBonusDeprChange(null)}
                className="text-[12px] font-medium text-sky-600 hover:text-sky-800 underline underline-offset-2 -mt-3 block"
              >
                Reset to default ({fmt$(Math.round(results.price * 0.30))})
              </button>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Federal Tax Rate</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={scenario.federalTaxRate}
                  onChange={e => onTaxRateChange(e.target.value)}
                  className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-medium text-right text-slate-800 focus:border-sky-400 focus:outline-none"
                />
                <span className="text-sm font-medium text-slate-600">%</span>
              </div>
            </div>
            <DataRow label="Tax Savings (Bonus Depr.)" value={fmt$(results.taxSavings)} />
          </div>
        </div>
      </div>

      {/* Two-Column */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

        {/* Cash Flow Summary */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden cash-returne">
          <SectionHeader>
            Client {results.numYears}-Year Cash Flow &amp; Equity Growth (Yrs {startYear}–{endYear})
          </SectionHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: '#f0f5fb' }}>
                  {['Year', 'Property Value', 'Appr. Gain', 'Annual Cash Flow'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-black-500 text-right first:text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.yearRows.map(row => (
                  <tr key={row.year} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-slate-700">Yr {yearOffset + row.year}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-800">{fmt$(row.propertyValue)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-emerald-600">{fmt$(row.appreciationGain)}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-sky-700">{fmt$(row.cashFlow)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 total-row">
                  <td className="px-4 py-2.5 font-bold text-slate-700">Total</td>
                  <td className="px-4 py-2.5 text-right font-bold text-slate-800">{fmt$(results.estSalePrice)}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-emerald-600">{fmt$(results.apprGain)}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-sky-700">{fmt$(results.annualCashFlow * results.numYears)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Sale Snapshot */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden cash-returne">
          <SectionHeader>Sale Snapshot at Exit Year {endYear}</SectionHeader>
          <div className="px-5 py-5 space-y-4">
            <DataRow label="Purchase Price" value={fmt$(results.price)} />
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-500 flex items-center gap-1 shrink-0">
                Est. Sale Price (
                <input
                  type="number"
                  value={apprPct}
                  min={0}
                  max={100}
                  onChange={e => {
                    const v = e.target.value;
                    if (v === '' || (parseFloat(v) >= 0 && parseFloat(v) <= 100)) onApprPctChange(v);
                  }}
                  className="w-12 rounded-lg border border-slate-300 px-1.5 py-0.5 text-sm font-medium text-slate-800 text-center focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
                % annual)
              </span>
              <span className="text-sm font-bold whitespace-nowrap text-slate-900">{fmt$(results.estSalePrice)}</span>
            </div>
            <DataRow label="Accelerated Appr. Gain" value={fmt$(results.apprGain)} />
            <DataRow label="Return of Investment" value={fmt$(results.oopValue)} />
            <DataRow label="Net Sale Proceeds (To Be Split 50/50)" value={fmt$(results.netSaleProceeds)} />
          </div>
        </div>
      </div>

      {/* Client Total Return / Benefit */}
      <div>
        <p className="mb-3 text-sm font-semibold text-slate-700">Client Total Return / Benefit</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 benifit-col">
          {[
            { label: 'Initial Out-of-Pocket', value: fmt$(results.oopValue) },
            { label: 'Share of Net Sale Proceeds', value: fmt$(results.clientShare) },
            { label: `${results.numYears}-Year Distributions`, value: fmt$(results.totalDist) },
            { label: 'Estimated Tax Savings', value: fmt$(results.taxSavings) },
            { label: 'Total Est. Return/Benefit', value: fmt$(results.totalReturn) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 leading-tight">{label}</p>
              <p className="text-lg font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Student factory ──────────────────────────────────────────────────────────
let _studentIdCounter = 1;
const newStudent = (idx = 0) => ({
  id: _studentIdCounter++,
  name: '',
  startYear: String(new Date().getFullYear()),
  annualCost: '',
  fundingYears: '4',
});

// ── Year-Based Funding Timeline ───────────────────────────────────────────────
function FundingTimeline({ scenarios, scenarioResults, yearOffsets, students, baseYear }) {
  const scenarioBars = scenarios.map((s, idx) => {
    const result = scenarioResults[idx];
    if (!result) return null;
    const startAbs = baseYear + yearOffsets[idx];
    const endAbs = startAbs + result.numYears - 1;
    return { label: `Scenario ${idx + 1}`, startYear: startAbs, endYear: endAbs, annualCashFlow: result.annualCashFlow };
  }).filter(Boolean);

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
      (year >= bar.startYear && year <= bar.endYear) ? sum + bar.annualCashFlow : sum, 0);
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

        {/* Year axis — flex row mirrors the label+bar row structure so year marks align with bars */}
        <div className="flex items-center gap-3 mb-3 funding-timeline" style={{ minWidth: `${totalSpan * 48 + 108}px` }}>
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

          {/* Scenario rows */}
          {scenarioBars.map((bar, i) => (
            <div key={`sc${i}`} className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-slate-500 w-24 shrink-0 text-right truncate">{bar.label}</span>
              <div className="relative flex-1 h-9 bg-slate-50 rounded-lg">
                {/* Year grid lines */}
                {yearMarkers.map(y => (
                  <div key={y} className="absolute top-0 bottom-0 border-l border-slate-100"
                    style={{ left: `${((y - minYear) / totalSpan) * 100}%` }} />
                ))}
                <div
                  className="absolute h-full rounded-lg flex items-center px-2 overflow-hidden"
                  style={{ ...barStyle(bar.startYear, bar.endYear), backgroundColor: '#1a3a5c' }}>
                  <span className="text-[10px] font-bold text-white whitespace-nowrap">
                    {fmt$(bar.annualCashFlow)}/yr
                  </span>
                </div>
              </div>
              <div className="w-24 shrink-0" />
            </div>
          ))}

          {/* Divider */}
          {scenarioBars.length > 0 && studentBars.length > 0 && (
            <div className="border-t border-dashed border-slate-200 ml-[6.5rem]" />
          )}

          {/* Student rows */}
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
                      {/* Uncovered background — soft amber */}
                      <div className="absolute h-full rounded-lg"
                        style={{ ...barStyle(bar.startYear, bar.endYear), backgroundColor: '#fed7aa' }} />
                      {/* Covered years — teal, per-year blocks */}
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

                  {/* Text overlay */}
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

        {/* ── Cash Flow vs College Cost Comparison ─────────────────────────── */}
        {showComparison && (
          <div className="mt-5" style={{ minWidth: `${totalSpan * 48 + 108}px` }}>
            <div className="ml-[6.5rem] border-t-2 border-dashed border-slate-200 mb-3" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-[6.5rem] mb-2.5 pl-3">
              Cash Flow vs College Cost — Year by Year
            </p>

            <div className="space-y-1.5">

              {/* Row: Combined Cash Flow In */}
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

              {/* Row: Total College Cost */}
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

              {/* Row: CF Applied to College */}
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

              {/* Row: Loan Needed */}
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

              {/* Row: Surplus / Gap */}
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
                          top: '3px',
                          bottom: '3px',
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

            {/* ── Summary Tiles ─────────────────────────────────────────────── */}
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
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#3f897a' }} />
            Student funding period
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#d6a783' }} />
            College cost (uncovered)
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#0f766e' }} />
            CF Applied to College (teal)
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#d97706' }} />
            College Cost row (amber)
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#15803d' }} />
            Surplus (CF &gt; cost)
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#b91c1c' }} />
            Loan Needed / Gap
          </div>
        </div>
      </div>
    </div>
  );
}

// ── College Planning Section ─────────────────────────────────────────────────
function CollegePlanningSection({ students, onAdd, onUpdate, onRemove, totalInvestmentReturn,
  scenarios, scenarioResults, yearOffsets, baseYear }) {
  const grandTotal = students.reduce((sum, s) => {
    return sum + (parseFloat(s.annualCost) || 0) * (parseInt(s.fundingYears) || 4);
  }, 0);

  return (
    <div className="mt-8 rounded-2xl overflow-hidden border-2 border-slate-200">

      {/* Header */}
      <div className="px-5 py-3.5 flex items-center justify-between" style={{ backgroundColor: '#1a3a5c' }}>
        <p className="text-[13px] font-bold uppercase tracking-wider text-white multi-student-text">
          Multi-Student College Planning
        </p>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-bold text-white transition-colors">
          + Add Student {students.length + 1}
        </button>
      </div>

      <div className="bg-white p-5 space-y-4">

        {/* Empty state */}
        {students.length === 0 && (
          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-slate-300">
            <p className="text-sm font-medium text-slate-400 px-4">
              No students added yet — click "Add Student 1" to begin
            </p>
          </div>
        )}

        {/* Student cards */}
        {students.map((student, idx) => {
          const annual = parseFloat(student.annualCost) || 0;
          const yrs = Math.max(1, parseInt(student.fundingYears) || 4);
          const total = annual * yrs;
          const label = student.name.trim() || `Student ${idx + 1}`;

          const stuStart = parseInt(student.startYear) || (baseYear + 2);
          const stuEnd = stuStart + yrs - 1;
          const overlapCashFlow = scenarios.reduce((sum, s, si) => {
            const r = scenarioResults[si];
            if (!r) return sum;
            const scStart = baseYear + (yearOffsets[si] || 0);
            const scEnd = scStart + r.numYears - 1;
            const oStart = Math.max(scStart, stuStart);
            const oEnd = Math.min(scEnd, stuEnd);
            return oEnd >= oStart ? sum + r.annualCashFlow * (oEnd - oStart + 1) : sum;
          }, 0);
          const coverageAmt = Math.min(overlapCashFlow, total);
          const coveragePct = total > 0 ? Math.round((coverageAmt / total) * 100) : null;

          return (
            <div key={student.id} className="rounded-xl border border-slate-200 overflow-hidden">

              {/* Card header */}
              <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: '#d6e8f7' }}>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1a3a5c]">
                  {label}
                </span>
                <button
                  onClick={() => onRemove(student.id)}
                  className="text-[12px] font-semibold text-red-500 hover:text-red-600 transition-colors student-remove-btn">
                  × Remove
                </button>
              </div>

              {/* Inputs */}
              <div className="px-4 py-4 grid grid-cols-2 gap-3 sm:grid-cols-4 multi-student-text">
                <div className="flex flex-col gap-1">
                  <label className="text-[12px] font-bold uppercase tracking-wider text-black-400">Name (optional)</label>
                  <input
                    type="text"
                    value={student.name}
                    onChange={e => onUpdate(student.id, 'name', e.target.value)}
                    placeholder={`Student ${idx + 1}`}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 placeholder-slate-300 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-black-400">College Start Year</label>
                  <input
                    type="number"
                    value={student.startYear}
                    onChange={e => onUpdate(student.id, 'startYear', e.target.value)}
                    placeholder="2028"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 placeholder-slate-300 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-black-400">Est. Annual Cost</label>
                  <div className="relative flex items-center">
                    <span className="pointer-events-none absolute left-3 text-sm text-slate-400">$</span>
                    <input
                      type="number"
                      value={student.annualCost}
                      onChange={e => onUpdate(student.id, 'annualCost', e.target.value)}
                      placeholder="30,000"
                      className="w-full rounded-xl border border-slate-200 bg-white pl-7 pr-3 py-2.5 text-sm font-medium text-slate-800 placeholder-slate-300 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-black-400">Funding Timeline (Yrs)</label>
                  <input
                    type="number"
                    value={student.fundingYears}
                    min={1}
                    max={100}
                    onChange={e => {
                      const v = e.target.value;
                      if (v === '' || (parseInt(v) >= 1 && parseInt(v) <= 100)) onUpdate(student.id, 'fundingYears', v);
                    }}
                    placeholder="4"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 placeholder-slate-300 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                </div>
              </div>

              {/* Per-student summary tiles */}
              {annual > 0 && (
                <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Annual Cost</p>
                    <p className="text-base font-bold text-slate-800">{fmt$(annual)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Funding Years</p>
                    <p className="text-base font-bold text-slate-800">{yrs} yr{yrs !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="rounded-xl px-4 py-3 text-center" style={{ backgroundColor: '#1a3a5c' }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-300 mb-1">Total College Cost</p>
                    <p className="text-base font-bold text-white">{fmt$(total)}</p>
                  </div>
                  <div className={`rounded-xl px-4 py-3 text-center ${coverageAmt > 0 ? 'bg-emerald-50 border border-emerald-100' : 'bg-slate-50 border border-slate-100'}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${coverageAmt > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                      Cash Flow Covered
                    </p>
                    <p className={`text-base font-bold ${coverageAmt > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {coverageAmt > 0 ? fmt$(coverageAmt) : '—'}
                    </p>
                    {coveragePct !== null && coverageAmt > 0 && (
                      <p className="text-[10px] font-bold text-emerald-600 mt-0.5">{coveragePct}% funded</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Planning summary (shows when at least one student has cost entered) */}
        {grandTotal > 0 && (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3" style={{ backgroundColor: '#d6e8f7' }}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#1a3a5c]">College Planning Summary</p>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Total Students</p>
                <p className="text-xl font-bold text-[#1a3a5c]">{students.length}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Total College Cost</p>
                <p className="text-xl font-bold text-[#1a3a5c]">{fmt$(grandTotal)}</p>
              </div>
              {totalInvestmentReturn > 0 && (
                <div className={`col-span-2 sm:col-span-1 text-center rounded-xl px-3 py-2 ${grandTotal <= totalInvestmentReturn ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${grandTotal <= totalInvestmentReturn ? 'text-emerald-700' : 'text-red-700'}`}>
                    {grandTotal <= totalInvestmentReturn ? 'Fully Funded' : 'Funding Gap'}
                  </p>
                  <p className={`text-xl font-bold ${grandTotal <= totalInvestmentReturn ? 'text-emerald-700' : 'text-red-700'}`}>
                    {grandTotal <= totalInvestmentReturn
                      ? `${fmt$(totalInvestmentReturn - grandTotal)} surplus`
                      : `${fmt$(grandTotal - totalInvestmentReturn)} gap`}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add more button (only when at least one card exists) */}
        {students.length > 0 && (
          <div className="flex justify-center pt-1">
            <button
              onClick={onAdd}
              className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 px-6 py-2.5 text-sm font-bold text-slate-500 transition-all hover:border-[#1a3a5c] hover:text-[#1a3a5c]">
              + Add Student {students.length + 1}
            </button>
          </div>
        )}

        {/* Year-based timeline (shows as soon as any scenario has results or any student exists) */}
        <FundingTimeline
          scenarios={scenarios}
          scenarioResults={scenarioResults}
          yearOffsets={yearOffsets}
          students={students}
          baseYear={baseYear}
        />
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function PropertyCalculator() {
  const { user } = useAuthSafe();

  const initRef = useRef(null);
  if (initRef.current === null) initRef.current = createInitialState();
  const init = initRef.current;

  const [activeTab, setActiveTab] = useState(init.activeTab);
  const [scenarios, setScenarios] = useState(init.scenarios);
  const [expandedScenarios, setExpandedScenarios] = useState(init.expandedScenarios);
  const [students, setStudents] = useState(init.students);
  const [purchaseInterval, setPurchaseInterval] = useState(init.purchaseInterval);
  const [intervalMode, setIntervalMode] = useState(init.intervalMode);
  const [startYear, setStartYear] = useState(init.startYear);
  const [scheduleMode, setScheduleMode] = useState(init.scheduleMode);
  const [customYearsInput, setCustomYearsInput] = useState(init.customYearsInput);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const addStudent = () => setStudents(prev => [...prev, newStudent(prev.length)]);
  const removeStudent = (id) => setStudents(prev => prev.filter(s => s.id !== id));
  const updateStudent = (id, field, value) =>
    setStudents(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));

  const updateScenario = (id, field, value) =>
    // setScenarios(prev => prev.map(s => {
    //   if (s.id !== id) return s;
    //   if (field === 'oopOverride') {
    //     if (value === null || value === '') return { ...s, oopOverride: value };
    //     const derivedPrice = Math.round(parseFloat(value) / DEFAULT_OOP_RATIO);
    //     return { ...s, oopOverride: value, purchasePrice: isNaN(derivedPrice) ? s.purchasePrice : String(derivedPrice) };
    //   }
    //   if (field === 'purchasePrice') {
    //     return { ...s, purchasePrice: value, oopOverride: null };
    //   }
    //   return { ...s, [field]: value };
    // }));

    setScenarios(prev => {
      const changedIdx = prev.findIndex(s => s.id === id);
      if (changedIdx === -1) return prev;
      return prev.map((s, i) => {
        if (i === changedIdx) {
          if (field === 'oopOverride') {
            if (value === null || value === '') return { ...s, oopOverride: value };
            return { ...s, oopOverride: value };
          }
          if (field === 'purchasePrice') {
            return { ...s, purchasePrice: value };
          }
          return { ...s, [field]: value };
        }
        // Toggling Reinvest Cash Flow on an earlier scenario invalidates the
        // pushed Purchase Price on every scenario below it — clear so the user
        // can re-Push ↑ with the new chained Out-of-Pocket.
        if (field === 'reinvestCashFlow' && i > changedIdx) {
          return { ...s, purchasePrice: '' };
        }
        return s;
      });
    });

  const removeScenario = (id) => {
    setScenarios(prev => prev.length > 1 ? prev.filter(s => s.id !== id) : prev);
    setExpandedScenarios(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const duplicateScenario = (id) => {
    const src = scenarios.find(s => s.id === id);
    if (!src) return;
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
  };

  const toggleScenario = (id) =>
    setExpandedScenarios(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // ── Parse custom year list ────────────────────────────────────────────────
  const parsedCustomYears = useMemo(() =>
    customYearsInput
      .split(/[\s,]+/)
      .map(s => parseInt(s, 10))
      .filter(n => Number.isFinite(n) && n >= 1)
      .sort((a, b) => a - b)
      .filter((v, i, arr) => i === 0 || arr[i - 1] !== v),
    [customYearsInput]);

  // ── Per-scenario computed results (sequential: prev totalReturn → next OOP) ──
  const scenarioResults = useMemo(() => {
    const results = [];
    let fromExitOffset = 0;

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

      // Compute this scenario's year offset inline (mirrors yearOffsets logic) to avoid circular dep
      let yOffset;
      if (scheduleMode === 'custom' && parsedCustomYears.length > 0) {
        const yr = parsedCustomYears[idx];
        yOffset = yr !== undefined
          ? yr - 1
          : parsedCustomYears[parsedCustomYears.length - 1] - 1 + (idx - parsedCustomYears.length + 1);
      } else if (intervalMode === 'from-start') {
        yOffset = idx * purchaseInterval;
      } else {
        yOffset = fromExitOffset;
      }

      const result = runCalc({
        purchasePrice: effectivePrice,
        oop: s.oopOverride != null ? s.oopOverride : autoOop,
        cashFlowPct: s.cashFlowPct,
        appreciationPct: s.apprPct,
        years: s.years,
        federalTaxRate: s.federalTaxRate,
        bonusDeprOverride: s.bonusDeprOverride,
        scenarioStartYear: startYear + yOffset,
      });

      results.push(result);

      if (scheduleMode !== 'custom' && intervalMode === 'from-exit') {
        const dur = result?.numYears ?? parseInt(s.years) ?? 5;
        fromExitOffset = yOffset + dur + purchaseInterval;
      }
    });
    return results;
  }, [scenarios, students, scheduleMode, parsedCustomYears, intervalMode, purchaseInterval, startYear]);

  // ── Auto-sync scenario count to custom year list ──────────────────────────
  useEffect(() => {
    if (scheduleMode !== 'custom') return;
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
  }, [scheduleMode, parsedCustomYears]);

  // ── Absolute year offsets per scenario ────────────────────────────────────
  const yearOffsets = useMemo(() => {
    if (scheduleMode === 'custom' && parsedCustomYears.length > 0) {
      return scenarios.map((_, idx) => {
        const yr = parsedCustomYears[idx];
        return yr !== undefined
          ? yr - 1
          : parsedCustomYears[parsedCustomYears.length - 1] - 1 + (idx - parsedCustomYears.length + 1);
      });
    }
    if (intervalMode === 'from-start') {
      return scenarios.map((_, idx) => idx * purchaseInterval);
    }
    // from-exit: next scenario starts purchaseInterval years after previous exits
    const offsets = [0];
    scenarioResults.slice(0, -1).forEach((r, i) => {
      const dur = r?.numYears ?? parseInt(scenarios[i].years) ?? 5;
      offsets.push(offsets[i] + dur + purchaseInterval);
    });
    return offsets;
  }, [scheduleMode, parsedCustomYears, scenarioResults, scenarios, purchaseInterval, intervalMode]);

  // ── Add next scenario (OOP auto-chains from previous scenario's total return) ──
  const addScenario = () => {
    const lastScenario = scenarios[scenarios.length - 1];
    const added = newScenario({
      cashFlowPct: lastScenario.cashFlowPct,
      apprPct: lastScenario.apprPct,
      years: lastScenario.years,
      federalTaxRate: lastScenario.federalTaxRate,
    });
    setScenarios(prev => [...prev, added]);
    setExpandedScenarios(prev => new Set([...prev, added.id]));
  };

  // ── Cumulative summary (only when 2+ scenarios have results) ─────────────
  const cumulative = useMemo(() => {
    const valid = scenarioResults.filter(Boolean);
    if (valid.length < 2) return null;
    const totalYears = yearOffsets[scenarios.length - 1] + (scenarioResults[scenarios.length - 1]?.numYears ?? 0);
    const lastValidResult = valid[valid.length - 1];
    return {
      totalDist: valid.reduce((s, r) => s + r.totalDist, 0),
      totalTaxSavings: valid.reduce((s, r) => s + r.taxSavings, 0),
      grandReturn: valid.reduce((s, r) => s + r.totalReturn, 0), // used by CollegePlanningSection
      lastPortfolioValue: lastValidResult?.estSalePrice ?? 0,
      totalYears,
    };
  }, [scenarioResults, yearOffsets, scenarios.length]);

  const lastResult = scenarioResults[scenarioResults.length - 1];

  const handleSaveCalculation = async () => {
    const payload = {
      activeTab,
      scenarios,
      expandedScenarios: [...expandedScenarios],
      students,
      purchaseInterval,
      intervalMode,
      startYear,
      scheduleMode,
      customYearsInput,
      type: 'advanced',
      client_email: user?.email ?? '',
    };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
    try {
      setSaving(true);
      await calculatorAPI.storeCalculator(payload);
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2000);
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save calculation.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    localStorage.removeItem(LS_KEY);
    _idCounter = 1;
    const defaultScenarios = [newScenario(), newScenario(), newScenario()];
    setScenarios(defaultScenarios);
    setExpandedScenarios(new Set([defaultScenarios[0].id]));
    setStudents([]);
    setPurchaseInterval(5);
    setIntervalMode('from-start');
    setStartYear(new Date().getFullYear());
    setScheduleMode('interval');
    setCustomYearsInput('1, 3, 7');
  };

  useEffect(() => {
    const fetchCalculator = async () => {
      try {
        const response = await calculatorAPI.getCalculator(user.email, 'advanced');
        const dbData = response.data.data[0]?.payload;
        if (dbData) {
          if (dbData.scenarios?.length) {
            const maxId = Math.max(...dbData.scenarios.map(s => s.id));
            _idCounter = maxId + 1;
            setScenarios(dbData.scenarios);
          }
          if (dbData.expandedScenarios) setExpandedScenarios(new Set(dbData.expandedScenarios));
          if (dbData.students) setStudents(dbData.students);
          if (dbData.purchaseInterval !== undefined) setPurchaseInterval(dbData.purchaseInterval);
          if (dbData.intervalMode) setIntervalMode(dbData.intervalMode);
          if (dbData.startYear) setStartYear(dbData.startYear);
          if (dbData.scheduleMode) setScheduleMode(dbData.scheduleMode);
          if (dbData.customYearsInput) setCustomYearsInput(dbData.customYearsInput);
          // activeTab intentionally not restored — always starts on 'simple'
          localStorage.setItem(LS_KEY, JSON.stringify(dbData));
        }
      } catch (error) {
        console.error('Failed to fetch calculator data:', error);
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

  // if (loading) {
  //   return (
  //     <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
  //       <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-[#1a3a5c] animate-spin" />
  //       <p className="text-sm font-medium text-slate-500">Loading saved calculation...</p>
  //     </div>
  //   );
  // }

  return (
    <div className="min-h-screen bg-[#f0f5fb] pb-16">
      <div className="w-full px-4 py-8 md:px-6">

        {/* ── Banner ──────────────────────────────────────────────────── */}
        <div className="w-full mb-8 rounded-2xl overflow-hidden relative" style={{
          background: 'linear-gradient(135deg, #0d1f3c 0%, #1a3a5c 40%, #0f2744 70%, #0a1628 100%)',
          minHeight: '160px',
          boxShadow: '0 8px 32px rgba(10, 22, 40, 0.4)'
        }}>
          {/* Decorative circles */}
          <div style={{
            position: 'absolute', right: '-60px', top: '-60px',
            width: '280px', height: '280px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.03)', pointerEvents: 'none'
          }} />
          <div style={{
            position: 'absolute', right: '80px', top: '-30px',
            width: '180px', height: '180px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)', pointerEvents: 'none'
          }} />

          <div className="relative z-10 px-10 py-10 hero-box">
            {/* View Toggle Buttons */}
            <div className="inline-flex items-center mb-4 gap-2 invest-tag">
              {[
                { id: 'simple', label: 'Simple View' },
                { id: 'advanced', label: 'Advanced View' },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className="px-5 py-2 text-xs font-bold uppercase tracking-widest rounded-full transition-all duration-200"
                  style={activeTab === tab.id
                    ? {
                      background: '#ffffff',
                      color: '#0d1f3c',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
                    }
                    : {
                      background: 'rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.55)',
                      border: '1px solid rgba(255,255,255,0.15)',
                    }
                  }
                >
                  {activeTab === tab.id && (
                    <svg className="inline-block mr-1.5 -mt-0.5" width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#0d1f3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3 mt-2">
              50/50 Joint Venture{' '}
              <span style={{ color: '#c9a84c' }}>Pro Forma</span>
            </h1>

            {/* Subtitle */}
            <p className="text-sm text-white/50 max-w-lg banner-p">
              Model your short-term rental investment scenarios with full tax analysis & equity projections
            </p>
          </div>
        </div>

        {/* ── Simple View ─────────────────────────────────────────────────── */}
        {activeTab === 'simple' && <SimpleView />}

        {/* ── Advanced View ───────────────────────────────────────────────── */}
        {activeTab === 'advanced' && <>

          {/* ── Purchase Schedule ───────────────────────────────────────────── */}
          <PurchaseSchedule
            startYear={startYear}
            onStartYearChange={setStartYear}
            scheduleMode={scheduleMode}
            onScheduleModeChange={setScheduleMode}
            customYearsInput={customYearsInput}
            onCustomYearsChange={setCustomYearsInput}
            parsedCustomYears={parsedCustomYears}
            interval={purchaseInterval}
            mode={intervalMode}
            onIntervalChange={setPurchaseInterval}
            onModeChange={setIntervalMode}
            onSaveCalculation={handleSaveCalculation}
            onReset={handleReset}
            savedFeedback={savedFeedback}
            saving={saving}
          />

          {/* ── Scenario sections ────────────────────────────────────────────── */}
          <div className="mt-6">
          {scenarios.map((scenario, idx) => {
            const result = scenarioResults[idx];
            const yOffset = yearOffsets[idx] ?? 0;
            const prevResult = idx > 0 ? scenarioResults[idx - 1] : null;
            const prevScenario = idx > 0 ? scenarios[idx - 1] : null;
            const endYear = yOffset + (result?.numYears ?? parseInt(scenario.years) ?? 5);
            const colors = SCENARIO_COLORS[idx % SCENARIO_COLORS.length];
            const isExpanded = expandedScenarios.has(scenario.id);

            return (
              <div key={scenario.id} className="mb-4 rounded-2xl overflow-hidden "
                style={{ border: `2px solid ${colors.border}` }}>

                {/* Collapsible header */}
                <div
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none f-wrap scenario-add-btns"
                  style={{ background: colors.header }}
                  onClick={() => toggleScenario(scenario.id)}>

                  <span className="inline-flex items-center rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white shrink-0"
                    style={{ background: colors.badge }}>
                    Scenario {idx + 1}
                  </span>

                  <span className="text-sm font-semibold text-slate-600">
                    Years {yOffset + 1}–{endYear}
                  </span>
                  <span className="text-sm text-black-400">
                    {startYear + yOffset} – {startYear + endYear - 1}
                  </span>
                  {result && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/60 text-slate-600 total-return">
                      {fmt$(result.totalReturn)} total return
                    </span>
                  )}

                  <div className="ml-auto flex items-center gap-1 f-wrap" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={addScenario}
                      className="text-xs font-semibold text-sky-600 hover:text-sky-800 transition-colors scenario-btns">
                      + Add Scenario {scenarios.length + 1}
                    </button>

                    <button
                      onClick={() => duplicateScenario(scenario.id)}
                      className="text-xs font-semibold text-sky-600 hover:text-sky-800 transition-colors scenario-btns dup-btn">
                      ⧉ Duplicate
                    </button>
                    {idx > 0 && (
                      <button
                        onClick={() => removeScenario(scenario.id)}
                        className="text-xs font-semibold text-red-400 hover:text-red-600 transition-colors scenario-btns remove-btn">
                        × Remove
                      </button>
                    )}
                  </div>

                  {/* Chevron */}
                  <svg className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 down-arrow ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Collapsible body */}
                {isExpanded && (
                  <div className="p-5" style={{ background: colors.bg }}>
                    <ScenarioForm
                      scenario={scenario}
                      onChange={(field, val) => updateScenario(scenario.id, field, val)}
                      prevResult={prevResult}
                      prevScenario={prevScenario}
                      scenarioIdx={idx + 1}
                    />

                    {!result ? (
                      <div className="mt-4 flex h-32 items-center justify-center rounded-2xl border border-dashed bg-white"
                        style={{ borderColor: colors.border }}>
                        <p className="text-sm font-medium text-slate-400 px-4">
                          {idx === 0
                            ? `Enter a purchase price to generate Scenario 1's pro forma`
                            : `Enter a purchase price or add data in Scenario ${idx} to generate Scenario ${idx + 1}'s pro forma`}
                        </p>
                      </div>
                    ) : (
                      <div className="mt-4">
                        <ProForma
                          results={result}
                          yearOffset={yOffset}
                          scenario={scenario}
                          onTaxRateChange={val => updateScenario(scenario.id, 'federalTaxRate', val)}
                          onApprPctChange={val => updateScenario(scenario.id, 'apprPct', val)}
                          onBonusDeprChange={val => updateScenario(scenario.id, 'bonusDeprOverride', val === null ? null : val)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          </div>


          {/* ── Cumulative summary (2+ scenarios) ────────────────────────────── */}
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
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 leading-tight">{label}</p>
                    <p className="text-xl font-bold text-[#1a3a5c]">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── College Planning Section ──────────────────────────────────────── */}
          <CollegePlanningSection
            students={students}
            onAdd={addStudent}
            onUpdate={updateStudent}
            onRemove={removeStudent}
            totalInvestmentReturn={cumulative ? cumulative.grandReturn : (lastResult?.totalReturn ?? 0)}
            scenarios={scenarios}
            scenarioResults={scenarioResults}
            yearOffsets={yearOffsets}
            baseYear={startYear}
          />

        </>}

      </div>
    </div>
  );
}