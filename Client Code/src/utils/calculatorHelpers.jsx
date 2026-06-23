import { useState } from 'react';

export const BONUS_DEPR_RATIO = 0.30;
export const CLIENT_SPLIT = 0.50;
export const DEFAULT_OOP_RATIO = 0.30;
export const YEAR_PRESETS = [5, 6, 7, 8, 9, 10];

export const fmt$ = (val) => {
  const n = parseFloat(val);
  if (isNaN(n)) return '—';
  const abs = Math.abs(Math.round(n));
  const s = `$${abs.toLocaleString('en-US')}`;
  return n < 0 ? `-${s}` : (n === 0 ? '$0' : s);
};

export const fmtPct = (val, decimals = 2) => {
  const n = parseFloat(val);
  if (isNaN(n)) return '—';
  return `${n.toFixed(decimals)}%`;
};

export function runCalc({ purchasePrice, oop, cashFlowPct, appreciationPct, years, federalTaxRate,
  bonusDeprOverride = null, scenarioStartYear = new Date().getFullYear() }) {
  const price = parseFloat(purchasePrice) || 0;
  if (!price) return null;

  const numYears = Math.max(1, Math.min(50, parseInt(years) || 5));
  const cfRate = (parseFloat(cashFlowPct) || 8) / 100;
  const apprRate = (parseFloat(appreciationPct) || 7) / 100;
  const taxRate = (parseFloat(federalTaxRate) || 32) / 100;
  const oopValue = parseFloat(oop) || Math.round(price * DEFAULT_OOP_RATIO);

  const bonusDepr = (bonusDeprOverride != null && bonusDeprOverride !== '')
    ? (parseFloat(bonusDeprOverride) || 0)
    : Math.round(price * BONUS_DEPR_RATIO);
  const taxSavings = Math.round(taxRate * bonusDepr);
  const annualCashFlow = Math.round(oopValue * cfRate);

  const estSalePrice = Math.round(price * Math.pow(1 + apprRate, numYears));
  const apprGain = estSalePrice - price;
  const netSaleProceeds = Math.max(0, apprGain - oopValue);
  const clientShare = Math.round(netSaleProceeds * CLIENT_SPLIT);

  const midYear = Math.min(3, numYears);

  let cumulativeCF = 0;
  const yearRows = Array.from({ length: numYears }, (_, i) => {
    const yr = i + 1;
    const calendarYear = scenarioStartYear + yr - 1;
    const propVal = Math.round(price * Math.pow(1 + apprRate, yr));
    const apprGainYr = propVal - price;
    cumulativeCF += annualCashFlow;
    return { year: yr, calendarYear, cashFlow: annualCashFlow, propertyValue: propVal, appreciationGain: apprGainYr, cumulativeCashFlow: cumulativeCF };
  });

  const totalDist = annualCashFlow * numYears;
  const totalReturn = oopValue + clientShare + totalDist + taxSavings;
  const annReturn = oopValue > 0 ? ((Math.pow(totalReturn / oopValue, 1 / numYears) - 1) * 100) : null;
  const coc1yr = oopValue > 0 ? ((taxSavings + annualCashFlow) / oopValue * 100) : null;
  const cocMidYr = oopValue > 0 ? ((taxSavings + annualCashFlow * midYear) / oopValue * 100) : null;
  const cocNyr = oopValue > 0 ? (totalReturn / oopValue * 100) : null;

  return {
    price, oopValue, numYears, midYear, cfRate, apprRate, taxRate,
    bonusDepr, taxSavings, annualCashFlow, totalDist,
    estSalePrice, apprGain, netSaleProceeds, clientShare,
    totalReturn, annReturn, coc1yr, cocMidYr, cocNyr, yearRows,
  };
}

export function SectionHeader({ children }) {
  return (
    <div className="px-5 py-3" style={{ backgroundColor: '#d6e8f7' }}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#1a3a5c]">{children}</p>
    </div>
  );
}

export function DataRow({ label, value, bold, blue }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={`text-sm ${bold ? 'font-bold text-slate-700' : 'text-slate-500'}`}>{label}</span>
      <span className={`text-sm font-bold whitespace-nowrap ${blue ? 'text-sky-700' : 'text-slate-900'}`}>{value}</span>
    </div>
  );
}

export function YearSelector({ value, onChange,customYear = false }) {
  const customYearValue = customYear ? [5] : YEAR_PRESETS;
  const isPreset = customYearValue.map(String).includes(String(value));
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold uppercase tracking-wider text-black-500">Timeline (Years)</label>
      <div className="flex flex-wrap gap-1.5">
        {customYearValue.map(y => (
          <button key={y} type="button" onClick={() => onChange(String(y))}
            className={`px-3 py-2 rounded-xl text-sm font-bold border transition-colors ${String(value) === String(y)
              ? 'bg-[#1a3a5c] text-white border-[#1a3a5c]'
              : 'bg-white text-slate-600 border-slate-200 hover:border-sky-400 hover:text-sky-700'
            }`}>
            {y}yr
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-black-400 shrink-0">Custom:</span>
        <input
          type="number"
          value={isPreset ? '' : value}
          onChange={e => onChange(e.target.value)}
          placeholder="e.g. 15"
          className={`w-24 rounded-xl border px-3 py-1.5 text-sm font-medium text-slate-800 focus:outline-none ${!isPreset && value ? 'border-sky-400 ring-2 ring-sky-100 bg-sky-50' : 'border-slate-200 bg-white'}`}
        />
      </div>
    </div>
  );
}
