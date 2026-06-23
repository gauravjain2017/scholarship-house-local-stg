export const BONUS_DEPR_RATIO = 0.30;
export const CLIENT_SPLIT = 0.50;
export const DEFAULT_OOP_RATIO = 0.30;
export const YEAR_PRESETS = [5, 6, 7, 8, 9, 10];

export const fmt$ = (val: unknown): string => {
  const n = parseFloat(String(val));
  if (isNaN(n)) return '—';
  const abs = Math.abs(Math.round(n));
  const s = `$${abs.toLocaleString('en-US')}`;
  return n < 0 ? `-${s}` : n === 0 ? '$0' : s;
};

export const fmtPct = (val: unknown, decimals = 2): string => {
  const n = parseFloat(String(val));
  if (isNaN(n)) return '—';
  return `${n.toFixed(decimals)}%`;
};

export interface CalcResult {
  price: number;
  oopValue: number;
  numYears: number;
  midYear: number;
  cfRate: number;
  apprRate: number;
  taxRate: number;
  bonusDepr: number;
  taxSavings: number;
  annualCashFlow: number;
  totalDist: number;
  estSalePrice: number;
  apprGain: number;
  netSaleProceeds: number;
  clientShare: number;
  totalReturn: number;
  annReturn: number | null;
  coc1yr: number | null;
  cocMidYr: number | null;
  cocNyr: number | null;
  yearRows: YearRow[];
}

export interface YearRow {
  year: number;
  calendarYear: number;
  cashFlow: number;
  propertyValue: number;
  appreciationGain: number;
  cumulativeCashFlow: number;
}

export interface RunCalcParams {
  purchasePrice: string | number;
  oop: string | number;
  cashFlowPct: string | number;
  appreciationPct: string | number;
  years: string | number;
  federalTaxRate: string | number;
  bonusDeprOverride?: string | number | null;
  scenarioStartYear?: number;
}

export function runCalc(params: RunCalcParams): CalcResult | null {
  const { purchasePrice, oop, cashFlowPct, appreciationPct, years,
    federalTaxRate, bonusDeprOverride = null,
    scenarioStartYear = new Date().getFullYear() } = params;

  const price = parseFloat(String(purchasePrice)) || 0;
  if (!price) return null;

  const numYears = Math.max(1, Math.min(50, parseInt(String(years)) || 5));
  const cfRate = (parseFloat(String(cashFlowPct)) || 8) / 100;
  const apprRate = (parseFloat(String(appreciationPct)) || 7) / 100;
  const taxRate = (parseFloat(String(federalTaxRate)) || 32) / 100;
  const oopValue = parseFloat(String(oop)) || Math.round(price * DEFAULT_OOP_RATIO);

  const bonusDepr =
    bonusDeprOverride != null && bonusDeprOverride !== ''
      ? parseFloat(String(bonusDeprOverride)) || 0
      : Math.round(price * BONUS_DEPR_RATIO);
  const taxSavings = Math.round(taxRate * bonusDepr);
  const annualCashFlow = Math.round(oopValue * cfRate);

  const estSalePrice = Math.round(price * Math.pow(1 + apprRate, numYears));
  const apprGain = estSalePrice - price;
  const netSaleProceeds = Math.max(0, apprGain - oopValue);
  const clientShare = Math.round(netSaleProceeds * CLIENT_SPLIT);

  const midYear = Math.min(3, numYears);

  let cumulativeCF = 0;
  const yearRows: YearRow[] = Array.from({ length: numYears }, (_, i) => {
    const yr = i + 1;
    const propVal = Math.round(price * Math.pow(1 + apprRate, yr));
    cumulativeCF += annualCashFlow;
    return {
      year: yr,
      calendarYear: scenarioStartYear + yr - 1,
      cashFlow: annualCashFlow,
      propertyValue: propVal,
      appreciationGain: propVal - price,
      cumulativeCashFlow: cumulativeCF,
    };
  });

  const totalDist = annualCashFlow * numYears;
  const totalReturn = oopValue + clientShare + totalDist + taxSavings;
  const annReturn = oopValue > 0 ? (Math.pow(totalReturn / oopValue, 1 / numYears) - 1) * 100 : null;
  const coc1yr = oopValue > 0 ? ((taxSavings + annualCashFlow) / oopValue) * 100 : null;
  const cocMidYr = oopValue > 0 ? ((taxSavings + annualCashFlow * midYear) / oopValue) * 100 : null;
  const cocNyr = oopValue > 0 ? (totalReturn / oopValue) * 100 : null;

  return {
    price, oopValue, numYears, midYear, cfRate, apprRate, taxRate,
    bonusDepr, taxSavings, annualCashFlow, totalDist,
    estSalePrice, apprGain, netSaleProceeds, clientShare,
    totalReturn, annReturn, coc1yr, cocMidYr, cocNyr, yearRows,
  };
}

export interface Scenario {
  id: number;
  purchasePrice: string;
  oopOverride: string | null;
  cashFlowPct: string;
  apprPct: string;
  years: string;
  federalTaxRate: string;
  reinvestCashFlow: boolean;
  bonusDeprOverride: string | null;
}

let _idCounter = 1;
export const resetIdCounter = (maxId: number) => { _idCounter = maxId + 1; };
export const newScenario = (overrides: Partial<Scenario> = {}): Scenario => ({
  id: _idCounter++,
  purchasePrice: '',
  oopOverride: null,
  cashFlowPct: '8',
  apprPct: '7',
  years: '5',
  federalTaxRate: '32',
  reinvestCashFlow: false,
  bonusDeprOverride: null,
  ...overrides,
});

export function getChainedOop(prevResult: CalcResult | null, prevScenario: Scenario | null): number {
  if (!prevResult) return 0;
  return prevScenario?.reinvestCashFlow !== false
    ? prevResult.totalReturn
    : prevResult.totalReturn - prevResult.totalDist;
}

export function getAutoOop(
  scenario: Scenario,
  prevResult: CalcResult | null,
  prevScenario: Scenario | null,
): number {
  const chained = getChainedOop(prevResult, prevScenario);
  if (prevResult) return chained;
  return scenario.purchasePrice
    ? Math.round(parseFloat(scenario.purchasePrice) * DEFAULT_OOP_RATIO)
    : 0;
}

export function computeScenarioResults(
  scenarios: Scenario[],
  parsedCustomYears: number[],
  startYear: number,
  scheduleMode: 'custom' | 'interval',
  intervalMode: 'from-start' | 'from-exit',
  purchaseInterval: number,
): (CalcResult | null)[] {
  const results: (CalcResult | null)[] = [];
  let fromExitOffset = 0;

  scenarios.forEach((s, idx) => {
    const prevResult = idx > 0 ? results[idx - 1] ?? null : null;
    const prevScenario = idx > 0 ? scenarios[idx - 1] : null;
    const autoOop = getAutoOop(s, prevResult, prevScenario);
    const oopForPrice = s.oopOverride != null && s.oopOverride !== '' ? parseFloat(s.oopOverride) : autoOop;
    const effectivePrice = s.purchasePrice ||
      (oopForPrice > 0 ? String(Math.round(oopForPrice / DEFAULT_OOP_RATIO)) : '');

    let yOffset: number;
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
}

export function getYearOffsets(
  scenarios: Scenario[],
  parsedCustomYears: number[],
  scheduleMode: 'custom' | 'interval',
  intervalMode: 'from-start' | 'from-exit',
  purchaseInterval: number,
  scenarioResults: (CalcResult | null)[],
): number[] {
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
  const offsets = [0];
  scenarioResults.slice(0, -1).forEach((r, i) => {
    const dur = r?.numYears ?? parseInt(scenarios[i].years) ?? 5;
    offsets.push(offsets[i] + dur + purchaseInterval);
  });
  return offsets;
}

export function parsePurchaseYears(input: string): number[] {
  return input
    .split(/[\s,]+/)
    .map(s => parseInt(s, 10))
    .filter(n => Number.isFinite(n) && n >= 1)
    .sort((a, b) => a - b)
    .filter((v, i, arr) => i === 0 || arr[i - 1] !== v);
}
