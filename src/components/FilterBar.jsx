import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button';
import Input from './Input';
import '../styles/main.css';

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
];

const STATE_CODE_TO_NAME = Object.fromEntries(US_STATES.map((s) => [s.code, s.name]));

const currentYear = new Date().getFullYear();

/* ───── Accordion Section ───── */
const AccordionSection = ({ title, icon, open, onToggle, children }) => {
  return (
    <div className="rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-100 rounded-xl hover:bg-gray-100 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-bold text-gray-800 uppercase tracking-wide whitespace-nowrap">
          {icon && <span className="text-base shrink-0">{icon}</span>}
          {title}
        </span>
        <svg
          className={`w-4 h-4 shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 pb-5 pt-4">{children}</div>}
    </div>
  );
};

/* ───── Dual-thumb Range Slider (debounced) ───── */
const RangeSlider = ({ label, min, max, step = 1, valueMin, valueMax, onChange, format = (v) => v, debounceMs = 500 }) => {
  const [localMin, setLocalMin] = useState(valueMin);
  const [localMax, setLocalMax] = useState(valueMax);
  const timerRef = useRef(null);

  // Sync local state when parent value changes (e.g. filter reset)
  useEffect(() => { setLocalMin(valueMin); }, [valueMin]);
  useEffect(() => { setLocalMax(valueMax); }, [valueMax]);

  const debouncedOnChange = useCallback(
    (newMin, newMax) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onChange(newMin, newMax);
      }, debounceMs);
    },
    [onChange, debounceMs]
  );

  // Cleanup timer on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const pctMin = ((localMin - min) / (max - min)) * 100;
  const pctMax = ((localMax - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-medium text-blue-600">
          {format(localMin)} &ndash; {format(localMax)}
        </span>
      </div>
      <div className="relative h-6 flex items-center">
        {/* Track background */}
        <div className="absolute inset-x-0 h-1.5 bg-gray-200 rounded-full" />
        {/* Active range */}
        <div
          className="absolute h-1.5 bg-blue-500 rounded-full"
          style={{ left: `${pctMin}%`, right: `${100 - pctMax}%` }}
        />
        {/* Min thumb */}
        <input
          type="range"
          min={min} max={max} step="any"
          value={localMin}
          onChange={(e) => {
            const raw = Number(e.target.value);
            let v = Math.round((raw - min) / step) * step + min;
            if (v < min) v = min;
            if (v > max) v = max;
            if (max - v < step) v = max;
            if (v - min < step) v = min;
            if (v <= localMax) {
              setLocalMin(v);
              debouncedOnChange(v, localMax);
            }
          }}
          className="absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-blue-500 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow [&::-moz-range-thumb]:cursor-pointer"
          style={{ zIndex: pctMin > 50 ? 5 : 3 }}
        />
        {/* Max thumb */}
        <input
          type="range"
          min={min} max={max} step="any"
          value={localMax}
          onChange={(e) => {
            const raw = Number(e.target.value);
            let v = Math.round((raw - min) / step) * step + min;
            if (v < min) v = min;
            if (v > max) v = max;
            if (max - v < step) v = max;
            if (v - min < step) v = min;
            if (v >= localMin) {
              setLocalMax(v);
              debouncedOnChange(localMin, v);
            }
          }}
          className="absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-blue-500 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow [&::-moz-range-thumb]:cursor-pointer"
          style={{ zIndex: pctMax > 50 ? 3 : 5 }}
        />
      </div>
    </div>
  );
};

/* ───── State Selector (pill + modal popup) ───── */
const StateSelector = ({ selected = [], onChange }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(selected);

  const handleOpen = () => {
    setDraft(selected);
    setOpen(true);
  };

  const toggleState = (code) => {
    setDraft((prev) =>
      prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code]
    );
  };

  const handleApply = () => {
    onChange(draft);
    setOpen(false);
  };

  const removeState = (code) => {
    onChange(selected.filter((s) => s !== code));
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Select States
        </button>
        {selected.map((code) => (
          <span
            key={code}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-sm font-medium text-blue-700"
          >
            {STATE_CODE_TO_NAME[code] || code}
            <button
              type="button"
              onClick={() => removeState(code)}
              className="ml-0.5 text-blue-400 hover:text-red-500 transition-colors"
              aria-label={`Remove ${STATE_CODE_TO_NAME[code] || code}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
      </div>

    {/* Modal overlay - rendered via portal to escape sidebar overflow */}
      {open && createPortal(
        <div className="popup-zindex fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 md:p-8 p-4 my-5 md:my-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 flex-wrap">
              <h2 className="text-xl font-bold text-gray-900 mb-2 md:mb-0">Select States</h2>
              <div className="flex items-center gap-2 justify-between">
                <button
                  type="button"
                  onClick={() => setDraft([])}
                  className="md:px-4 px-8 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Uncheck All
                </button>
                <button
                  type="button"
                  onClick={() => setDraft(US_STATES.map((s) => s.code))}
                  className="md:px-4 px-8 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Check All
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* States grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-x-4 gap-y-3 mb-8">
              {US_STATES.map(({ code, name }) => (
                <label key={code} className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-600">
                  <input
                    type="checkbox"
                    checked={draft.includes(code)}
                    onChange={() => toggleState(code)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {name}
                </label>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-[50%] md:w-[auto]  px-6 py-2.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="w-[50%] md:w-[auto] px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

const FilterChip = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`
      inline-flex items-center gap-2 px-4 py-2 rounded-full
      border text-sm font-medium transition
      ${active
        ? 'bg-surface-muted border-accent text-primary'
        : 'bg-surface border-gray-300 text-gray-700 hover:bg-surface-alt'
      }
    `}
  >
    {label}
    <span className="text-xs opacity-60">▾</span>
  </button>
);

const Section = ({ title, children }) => (
  <div className="mb-6">
    <h4 className="text-sm font-semibold text-gray-900 mb-3">{title}</h4>
    {children}
  </div>
);

// Active Filter Tag Component
const ActiveFilterTag = ({ label, value, onRemove }) => (
  <span className="inline-flex items-center gap-1 px-3 py-1 bg-accent/10 border border-accent/30 rounded-full text-sm text-primary">
    <span className="font-medium">{label}:</span>
    <span>{value}</span>
    <button
      onClick={onRemove}
      className="ml-1 hover:text-red-500 transition-colors"
      aria-label={`Remove ${label} filter`}
    >
      ×
    </button>
  </span>
);

export default function FilterBar({
  filters,
  setFilters,
  setCurrentPage,

  PROPERTY_TYPES,
  SORT_OPTIONS,
  FINANCING_OPTIONS,

  // Admin-specific props
  showStatusFilter = false,
  showSubmitterSearch = false,

  // Card visibility states
  showPropertyTypeCard,
  setShowPropertyTypeCard,
  showPriceCard,
  setShowPriceCard,
  showSortByCard,
  setShowSortByCard,
  showAdvancedCard,
  setShowAdvancedCard,
  showStatusCard,
  setShowStatusCard,

  // Refs for click-outside handling
  propertyTypeCardRef,
  priceCardRef,
  sortByCardRef,
  advCardRef,
  advToggleRef,
  statusCardRef,

  // Sidebar mode (client layout) - hides top bar, shows only filter sections
  sidebarMode = false,

  // Filter config from manage_filters (array of { key, enabled, min, max, step, ... })
  filterConfig = null,
}) {
  // Helper: check if a filter key is enabled (defaults to true if no config)
  const isFilterEnabled = (key) => {
    if (!filterConfig) return true;
    const cfg = filterConfig.find((f) => f.key === key);
    return cfg ? cfg.enabled !== false : true;
  };

  // Helper: get range config (min, max, step) from filterConfig, with fallback defaults
  const getRangeConfig = (key, defaults) => {
    if (!filterConfig) return defaults;
    const cfg = filterConfig.find((f) => f.key === key);
    if (!cfg) return defaults;
    return {
      min: cfg.min !== undefined ? cfg.min : defaults.min,
      max: cfg.max !== undefined ? cfg.max : defaults.max,
      step: cfg.step !== undefined ? cfg.step : defaults.step,
    };
  };

  // Helper: check if any filter in a section is enabled
  const isSectionEnabled = (keys) => {
    if (!filterConfig) return true;
    return keys.some((key) => isFilterEnabled(key));
  };
  const [openSection, setOpenSection] = useState('status');

  const toggleSection = (key) => {
    setOpenSection((prev) => (prev === key ? null : key));
  };

  const updateFilters = (updater) => {
    setFilters((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // Log all filter details when any filter changes
      const changedKeys = Object.keys(next).filter(
        (key) => JSON.stringify(next[key]) !== JSON.stringify(prev[key])
      );
      if (changedKeys.length > 0) {
        const changedValues = {};
        changedKeys.forEach((key) => { changedValues[key] = next[key]; });
        // console.log(`Filter changed → ${changedKeys.join(', ')}`, changedValues);
        // console.log('All active filters:', next);
      }
      return next;
    });
  };

  const closeAll = () => {
    setShowPropertyTypeCard?.(false);
    setShowPriceCard?.(false);
    setShowSortByCard?.(false);
    setShowAdvancedCard?.(false);
    setShowStatusCard?.(false);
  };

  // Calculate active filters for display
  const getActiveFilters = () => {
    const active = [];
    if (filters.propertyType && filters.propertyType !== 'All') {
      const label =
        PROPERTY_TYPES?.find((t) => t.value === filters.propertyType)?.label ||
        filters.propertyType;
      active.push({
        key: 'propertyType',
        label: 'Property Type',
        value: label,
      });
    }

    if (filters.status && filters.status !== 'All') {
      active.push({
        key: 'status',
        label: 'Status',
        value: filters.status.charAt(0).toUpperCase() + filters.status.slice(1),
      });
    }

    if (filters.minPrice) {
      active.push({
        key: 'minPrice',
        label: 'Min Price',
        value: `$${Number(filters.minPrice).toLocaleString()}`,
      });
    }

    if (filters.maxPrice) {
      active.push({
        key: 'maxPrice',
        label: 'Max Price',
        value: `$${Number(filters.maxPrice).toLocaleString()}`,
      });
    }

    if (filters.city) {
      active.push({ key: 'city', label: 'City', value: filters.city });
    }

    if (filters.stateRegion) {
      active.push({
        key: 'stateRegion',
        label: 'State',
        value: filters.stateRegion,
      });
    }

    if (filters.advBedroomsMin) {
      active.push({
        key: 'advBedroomsMin',
        label: 'Min Beds',
        value: filters.advBedroomsMin,
      });
    }

    if (filters.advBedroomsMax) {
      active.push({
        key: 'advBedroomsMax',
        label: 'Max Beds',
        value: filters.advBedroomsMax,
      });
    }

    if (filters.advBathroomsMin) {
      active.push({
        key: 'advBathroomsMin',
        label: 'Min Baths',
        value: filters.advBathroomsMin,
      });
    }

    if (filters.advBathroomsMax) {
      active.push({
        key: 'advBathroomsMax',
        label: 'Max Baths',
        value: filters.advBathroomsMax,
      });
    }

    if (filters.advFinancing) {
      const label =
        FINANCING_OPTIONS?.find((f) => f.value === filters.advFinancing)
          ?.label || filters.advFinancing;
      active.push({ key: 'advFinancing', label: 'Financing', value: label });
    }

    if (filters.turnkey) {
      active.push({ key: 'turnkey', label: 'Flag', value: 'Turnkey' });
    }

    if (filters.priorityFirstAccess) {
      active.push({
        key: 'priorityFirstAccess',
        label: 'Flag',
        value: 'Premium',
      });
    }

    if (filters.fiftyFiftyPartner) {
      active.push({ key: 'fiftyFiftyPartner', label: 'Flag', value: '50-50 Partnership' });
    }

    if (filters.submitterSearch) {
      active.push({
        key: 'submitterSearch',
        label: 'Submitter',
        value: filters.submitterSearch,
      });
    }

    if (filters.selectedStates?.length > 0) {
      active.push({
        key: 'selectedStates',
        label: 'States',
        value: filters.selectedStates.length <= 3
          ? filters.selectedStates.join(', ')
          : `${filters.selectedStates.length} selected`,
      });
    }

    if (filters.selectedStatuses && filters.selectedStatuses.length < 3) {
      active.push({
        key: 'selectedStatuses',
        label: 'Status',
        value: filters.selectedStatuses.length === 0
          ? 'None'
          : filters.selectedStatuses.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(', '),
      });
    }

    if (filters.minDownPayment) {
      active.push({
        key: 'minDownPayment',
        label: 'Min Down Payment',
        value: `$${Number(filters.minDownPayment).toLocaleString()}`,
      });
    }

    if (filters.maxDownPayment) {
      active.push({
        key: 'maxDownPayment',
        label: 'Max Down Payment',
        value: `$${Number(filters.maxDownPayment).toLocaleString()}`,
      });
    }

    if (filters.interestRateMin) {
      active.push({
        key: 'interestRateMin',
        label: 'Min Interest Rate',
        value: `${filters.interestRateMin}%`,
      });
    }

    if (filters.subjectToInterestRateMax) {
      active.push({
        key: 'subjectToInterestRateMax',
        label: 'Max Interest Rate',
        value: `${filters.subjectToInterestRateMax}%`,
      });
    }

    if (filters.advMonthlyPaymentMin) {
      active.push({
        key: 'advMonthlyPaymentMin',
        label: 'Min Monthly Payment',
        value: `$${Number(filters.advMonthlyPaymentMin).toLocaleString()}`,
      });
    }

    if (filters.advMonthlyPaymentMax) {
      active.push({
        key: 'advMonthlyPaymentMax',
        label: 'Max Monthly Payment',
        value: `$${Number(filters.advMonthlyPaymentMax).toLocaleString()}`,
      });
    }

    // ANR filters
    ['budget', 'economy', 'midscale', 'upscale', 'luxury'].forEach((tier) => {
      if (filters[`anrMin_${tier}`]) {
        active.push({ key: `anrMin_${tier}`, label: `ANR Min (${tier})`, value: `$${Number(filters[`anrMin_${tier}`]).toLocaleString()}` });
      }
      if (filters[`anrMax_${tier}`]) {
        active.push({ key: `anrMax_${tier}`, label: `ANR Max (${tier})`, value: `$${Number(filters[`anrMax_${tier}`]).toLocaleString()}` });
      }
    });

    // EGR filters
    ['budget', 'economy', 'midscale', 'upscale', 'luxury'].forEach((tier) => {
      if (filters[`egrMin_${tier}`]) {
        active.push({ key: `egrMin_${tier}`, label: `EGR Min (${tier})`, value: `$${Number(filters[`egrMin_${tier}`]).toLocaleString()}` });
      }
      if (filters[`egrMax_${tier}`]) {
        active.push({ key: `egrMax_${tier}`, label: `EGR Max (${tier})`, value: `$${Number(filters[`egrMax_${tier}`]).toLocaleString()}` });
      }
    });

    if (filters.vacationRentalMarkets?.length > 0) {
      active.push({
        key: 'vacationRentalMarkets',
        label: 'Markets',
        value: `${filters.vacationRentalMarkets.length} selected`,
      });
    }

    if (filters.selectedTags?.length > 0) {
      active.push({
        key: 'selectedTags',
        label: 'Tags',
        value: `${filters.selectedTags.length} selected`,
      });
    }
    if (filters.travelMotivations?.length > 0) {
      active.push({
        key: 'travelMotivations',
        label: 'Motivations',
        value: `${filters.travelMotivations.length} selected`,
      });
    }

    // Property Type (advanced accordion filter)
    if (filters.advPropertyType) {
      const label = filters.advPropertyType.replace(/_/g, ' ');
      active.push({ key: 'advPropertyType', label: 'Property Type', value: label });
    }

    // Year Built
    if (filters.advYearBuiltMin) {
      active.push({ key: 'advYearBuiltMin', label: 'Year Built Min', value: filters.advYearBuiltMin });
    }
    if (filters.advYearBuiltMax) {
      active.push({ key: 'advYearBuiltMax', label: 'Year Built Max', value: filters.advYearBuiltMax });
    }

    // Square Feet
    if (filters.advSqftMin) {
      active.push({ key: 'advSqftMin', label: 'Min Sq Ft', value: Number(filters.advSqftMin).toLocaleString() });
    }
    if (filters.advSqftMax) {
      active.push({ key: 'advSqftMax', label: 'Max Sq Ft', value: Number(filters.advSqftMax).toLocaleString() });
    }

    // Turnkey / Furnished
    if (filters.turnkeyFurnished) {
      const label = filters.turnkeyFurnished === 'FURNISHED' ? 'Furnished' : 'Not Furnished';
      active.push({ key: 'turnkeyFurnished', label: 'Turnkey / Furnished', value: label });
    }

    // Est. Occupancy
    if (filters.occupancyRateMin) {
      active.push({ key: 'occupancyRateMin', label: 'Min Occupancy', value: `${filters.occupancyRateMin}%` });
    }
    if (filters.occupancyRateMax && Number(filters.occupancyRateMax) < 100) {
      active.push({ key: 'occupancyRateMax', label: 'Max Occupancy', value: `${filters.occupancyRateMax}%` });
    }

    // Tax Benefits - Income Reduction
    if (filters.incomeReductionMin) {
      active.push({ key: 'incomeReductionMin', label: 'Min Income Reduction', value: `$${Number(filters.incomeReductionMin).toLocaleString()}` });
    }
    if (filters.incomeReductionMax) {
      active.push({ key: 'incomeReductionMax', label: 'Max Income Reduction', value: `$${Number(filters.incomeReductionMax).toLocaleString()}` });
    }

    // Tax Benefits - Est. Tax Savings
    if (filters.taxSavingsMin) {
      active.push({ key: 'taxSavingsMin', label: 'Min Tax Savings', value: `$${Number(filters.taxSavingsMin).toLocaleString()}` });
    }
    if (filters.taxSavingsMax) {
      active.push({ key: 'taxSavingsMax', label: 'Max Tax Savings', value: `$${Number(filters.taxSavingsMax).toLocaleString()}` });
    }

    return active;
  };

  const clearFilter = (key) => {
    const defaultValues = {
      propertyType: 'All',
      status: 'All',
      minPrice: '',
      maxPrice: '',
      city: '',
      stateRegion: '',
      advPropertyType: '',
      advBedroomsMin: '',
      advBedroomsMax: '',
      advBathroomsMin: '',
      advBathroomsMax: '',
      advYearBuiltMin: '',
      advYearBuiltMax: '',
      advSqftMin: '',
      advSqftMax: '',
      advFinancing: '',
      turnkey: false,
      turnkeyFurnished: '',
      priorityFirstAccess: false,
      submitterSearch: '',
      selectedStates: [],
      selectedStatuses: ['published', 'sold', 'pending'],
      vacationRentalMarkets: [],
      travelMotivations: [],
      selectedTags: [],
      minDownPayment: '',
      maxDownPayment: '',
      interestRateMin: '',
      subjectToInterestRateMax: '',
      advMonthlyPaymentMin: '',
      advMonthlyPaymentMax: '',
      occupancyRateMin: '',
      occupancyRateMax: '',
      incomeReductionMin: '',
      incomeReductionMax: '',
      taxSavingsMin: '',
      taxSavingsMax: '',
    };

    updateFilters((p) => ({ ...p, [key]: defaultValues[key] ?? '' }));
    setCurrentPage?.(1);
  };

  const clearAllFilters = () => {
    updateFilters((p) => ({
      ...p,
      propertyType: 'All',
      status: 'All',
      search: '',
      submitterSearch: '',
      minPrice: '',
      maxPrice: '',
      minDownPayment: '',
      maxDownPayment: '',
      city: '',
      stateRegion: '',
      postalCode: '',
      advPropertyType: '',
      advBedroomsMin: '',
      advBedroomsMax: '',
      advBathroomsMin: '',
      advBathroomsMax: '',
      advSqftMin: '',
      advSqftMax: '',
      advYearBuiltMin: '',
      advYearBuiltMax: '',
      advFinancing: '',
      advMonthlyPaymentMax: '',
      isHOA: false,
      hoaMonthlyFeeMin: '',
      hoaMonthlyFeeMax: '',
      turnkey: false,
      turnkeyFurnished: '',
      priorityFirstAccess: false,
      fiftyFiftyPartner: false,
      doneForYou: false,
      occupancyRateMin: '',
      occupancyRateMax: '',
      incomeReductionMin: '',
      incomeReductionMax: '',
      taxSavingsMin: '',
      taxSavingsMax: '',
      avgNightlyRateMin: '',
      avgNightlyRateMax: '',
      anrMin_budget: '', anrMax_budget: '',
      anrMin_economy: '', anrMax_economy: '',
      anrMin_midscale: '', anrMax_midscale: '',
      anrMin_upscale: '', anrMax_upscale: '',
      anrMin_luxury: '', anrMax_luxury: '',
      egrMin_budget: '', egrMax_budget: '',
      egrMin_economy: '', egrMax_economy: '',
      egrMin_midscale: '', egrMax_midscale: '',
      egrMin_upscale: '', egrMax_upscale: '',
      egrMin_luxury: '', egrMax_luxury: '',
      selectedStates: [],
      selectedStatuses: ['published', 'sold', 'pending'],
      vacationRentalMarkets: [],
      travelMotivations: [],
      selectedTags: [],
      subjectToInterestRateMax: '',
    }));
    setCurrentPage?.(1);
  };

  const activeFilters = getActiveFilters();

  // console.log('activeFilters : ',activeFilters)

  const renderFilterSections = () => (
    <>
     

      {/* 50-50 Partnership Filter */}
      {isFilterEnabled('fiftyFiftyPartner') && (
      <div className="px-4 py-3 border-b border-gray-100">
        <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-600">
          <input
            type="checkbox"
            checked={!!filters.fiftyFiftyPartner}
            onChange={(e) => { setFilters((p) => ({ ...p, fiftyFiftyPartner: e.target.checked })); setCurrentPage?.(1); }}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          50-50 Partnership Opportunity
        </label>
      </div>
      )}
	  
	  
      {/* Status Filter */}
      <AccordionSection title="Property Status" icon={<span role="img" aria-label="status">&#x1F3F7;</span>} open={openSection === 'status'} onToggle={() => toggleSection('status')}>
        <div className="flex flex-col gap-1.5">
          {[
            { value: 'published', label: 'Published' },
            { value: 'pending', label: 'Pending' },
            { value: 'sold', label: 'Sold' },
          ].map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-600">
              <input
                type="checkbox"
                checked={(filters.selectedStatuses || ['published', 'sold', 'pending']).includes(value)}
                onChange={(e) => {
                  const current = filters.selectedStatuses || ['published', 'sold', 'pending'];
                  const updated = e.target.checked
                    ? [...current, value]
                    : current.filter((s) => s !== value);
                  setFilters((p) => ({ ...p, selectedStatuses: updated }));
                  setCurrentPage?.(1);
                }}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {label}
            </label>
          ))}
        </div>
      </AccordionSection>

      {/* 1. Location (State) */}
      {isFilterEnabled('selectedStates') && (
      <AccordionSection title="Location (State)" icon={<span role="img" aria-label="location">&#x1F4CD;</span>} open={openSection === 'location'} onToggle={() => toggleSection('location')}>
        <StateSelector
          selected={filters.selectedStates || []}
          onChange={(states) => {
            updateFilters((p) => ({ ...p, selectedStates: states }));
            setCurrentPage?.(1);
          }}
        />
      </AccordionSection>
      )}

      {/* 2. Financial */}
      {isSectionEnabled(['price', 'downPayment', 'interestRate', 'monthlyPayment']) && (
      <AccordionSection title="Financial" icon={<span role="img" aria-label="money">&#x1F4B0;</span>} open={openSection === 'financial'} onToggle={() => toggleSection('financial')}>
        <div className="space-y-5">
          <div className={`grid grid-cols-1 ${sidebarMode ? '' : 'md:grid-cols-2'} gap-x-8 gap-y-5`}>
            {isFilterEnabled('price') && (() => { const rc = getRangeConfig('price', { min: 0, max: 5000000, step: 10000 }); return (
            <RangeSlider
              label="Price"
              min={rc.min} max={rc.max} step={rc.step}
              valueMin={Number(filters.minPrice) || rc.min}
              valueMax={Number(filters.maxPrice) || rc.max}
              onChange={(lo, hi) => {
                updateFilters((p) => ({
                  ...p,
                  minPrice: lo === rc.min ? '' : String(lo),
                  maxPrice: hi === rc.max ? '' : String(hi),
                }));
                setCurrentPage?.(1);
              }}
              format={(v) => `$${Number(v).toLocaleString()}`}
            />); })()}
            {isFilterEnabled('downPayment') && (() => { const rc = getRangeConfig('downPayment', { min: 0, max: 200000, step: 1000 }); return (
            <RangeSlider
              label="Down Payment"
              min={rc.min} max={rc.max} step={rc.step}
              valueMin={Number(filters.minDownPayment) || rc.min}
              valueMax={Number(filters.maxDownPayment) || rc.max}
              onChange={(lo, hi) => {
                updateFilters((p) => ({
                  ...p,
                  minDownPayment: lo === rc.min ? '' : String(lo),
                  maxDownPayment: hi === rc.max ? '' : String(hi),
                }));
                setCurrentPage?.(1);
              }}
              format={(v) => `$${Number(v).toLocaleString()}`}
            />); })()}
            {isFilterEnabled('interestRate') && (() => { const rc = getRangeConfig('interestRate', { min: 0, max: 10, step: 0.1 }); return (
            <RangeSlider
              label="Interest Rate"
              min={rc.min} max={rc.max} step={rc.step}
              valueMin={Number(filters.interestRateMin) || rc.min}
              valueMax={Number(filters.subjectToInterestRateMax) || rc.max}
              onChange={(lo, hi) => {
                updateFilters((p) => ({
                  ...p,
                  interestRateMin: lo === rc.min ? '' : String(lo),
                  subjectToInterestRateMax: hi === rc.max ? '' : String(hi),
                }));
                setCurrentPage?.(1);
              }}
              format={(v) => `${Number(v).toFixed(1)}%`}
            />); })()}
            {isFilterEnabled('monthlyPayment') && (() => { const rc = getRangeConfig('monthlyPayment', { min: 0, max: 10000, step: 100 }); return (
            <RangeSlider
              label="Monthly Payment / PITI"
              min={rc.min} max={rc.max} step={rc.step}
              valueMin={Number(filters.advMonthlyPaymentMin) || rc.min}
              valueMax={Number(filters.advMonthlyPaymentMax) || rc.max}
              onChange={(lo, hi) => {
                updateFilters((p) => ({
                  ...p,
                  advMonthlyPaymentMin: lo === rc.min ? '' : String(lo),
                  advMonthlyPaymentMax: hi === rc.max ? '' : String(hi),
                }));
                setCurrentPage?.(1);
              }}
              format={(v) => `$${Number(v).toLocaleString()}`}
            />); })()}
          </div>
        </div>
      </AccordionSection>
      )}

      {/* 3. Property Details */}
      {isSectionEnabled(['advPropertyType', 'advBedroomsMin', 'advBathroomsMin', 'yearBuilt', 'sqft']) && (
      <AccordionSection title="Property Details" icon={<span role="img" aria-label="house">&#x1F3E0;</span>} open={openSection === 'property'} onToggle={() => toggleSection('property')}>
        <div className="space-y-5">
          <div className={`grid grid-cols-1 ${sidebarMode ? 'gap-y-4' : 'md:grid-cols-4 gap-x-6 gap-y-5'}`}>
            {isFilterEnabled('advPropertyType') && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Property Type</label>
              <div className="relative">
                <select
                  className="appearance-none w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0AAFE5] focus:border-[#1E7AC0] cursor-pointer"
                  value={filters.advPropertyType || ''}
                  onChange={(e) => {
                    updateFilters((p) => ({ ...p, advPropertyType: e.target.value }));
                    setCurrentPage?.(1);
                  }}
                >
                  <option value="">All Types</option>
                  <option value="Single_Family">Single Family</option>
                  <option value="Multi_Family">Multi Family</option>
                  <option value="Condo">Condo</option>
                  <option value="Townhouse">Townhouse</option>
                  <option value="Land">Land</option>
                </select>
                <svg className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            )}
            {isFilterEnabled('advBedroomsMin') && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Min Bedrooms</label>
              <div className="relative">
                <select
                  className="appearance-none w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0AAFE5] focus:border-[#1E7AC0] cursor-pointer"
                  value={filters.advBedroomsMin || ''}
                  onChange={(e) => {
                    updateFilters((p) => ({ ...p, advBedroomsMin: e.target.value }));
                    setCurrentPage?.(1);
                  }}
                >
                  <option value="">Any</option>
                  <option value="1">1+</option>
                  <option value="2">2+</option>
                  <option value="3">3+</option>
                  <option value="4">4+</option>
                  <option value="5">5+</option>
                </select>
                <svg className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            )}
            {isFilterEnabled('advBathroomsMin') && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Min Bathrooms</label>
              <div className="relative">
                <select
                  className="appearance-none w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0AAFE5] focus:border-[#1E7AC0] cursor-pointer"
                  value={filters.advBathroomsMin || ''}
                  onChange={(e) => {
                    updateFilters((p) => ({ ...p, advBathroomsMin: e.target.value }));
                    setCurrentPage?.(1);
                  }}
                >
                  <option value="">Any</option>
                  <option value="1">1+</option>
                  <option value="2">2+</option>
                  <option value="3">3+</option>
                  <option value="4">4+</option>
                  <option value="5">5+</option>
                </select>
                <svg className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            )}
            {isFilterEnabled('yearBuilt') && (() => { const rc = getRangeConfig('yearBuilt', { min: 1900, max: currentYear, step: 1 }); return (
            <RangeSlider
              label="Year Built"
              min={rc.min} max={rc.max} step={Math.max(1, Math.round(rc.step))}
              valueMin={Number(filters.advYearBuiltMin) || rc.min}
              valueMax={Number(filters.advYearBuiltMax) || rc.max}
              onChange={(lo, hi) => {
                const loInt = Math.round(lo);
                const hiInt = Math.round(hi);
                updateFilters((p) => ({
                  ...p,
                  advYearBuiltMin: loInt === rc.min ? '' : String(loInt),
                  advYearBuiltMax: hiInt === rc.max ? '' : String(hiInt),
                }));
                setCurrentPage?.(1);
              }}
              format={(v) => Math.round(Number(v))}
            />); })()}
          </div>
          {isFilterEnabled('sqft') && (() => { const rc = getRangeConfig('sqft', { min: 0, max: 10000, step: 100 }); return (
          <RangeSlider
            label="Square Feet"
            min={rc.min} max={rc.max} step={rc.step}
            valueMin={Number(filters.advSqftMin) || rc.min}
            valueMax={Number(filters.advSqftMax) || rc.max}
            onChange={(lo, hi) => {
              updateFilters((p) => ({
                ...p,
                advSqftMin: lo === rc.min ? '' : String(lo),
                advSqftMax: hi === rc.max ? '' : String(hi),
              }));
              setCurrentPage?.(1);
            }}
            format={(v) => Number(v).toLocaleString()}
          />); })()}
        </div>
      </AccordionSection>
      )}

      {/* 4. Financing & STR */}
      {isSectionEnabled(['advFinancing', 'turnkeyFurnished', 'occupancyRate']) && (
      <AccordionSection title="Financing & STR" icon={<span role="img" aria-label="bank">&#x1F3E6;</span>} open={openSection === 'financing'} onToggle={() => toggleSection('financing')}>
        <div className={`grid ${sidebarMode ? 'grid-cols-1 gap-4' : 'grid-cols-3 gap-6'} items-start`}>
          {isFilterEnabled('advFinancing') && (
          <div>
            <label className="block text-sm text-gray-500 mb-1">Financing Type</label>
            <div className="relative">
              <select
                className="appearance-none w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0AAFE5] focus:border-[#1E7AC0] bg-white text-sm cursor-pointer"
                value={filters.advFinancing}
                onChange={(e) => setFilters((p) => ({ ...p, advFinancing: e.target.value }))}
              >
                <option value="">All</option>
                {FINANCING_OPTIONS?.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <svg className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          )}
          {isFilterEnabled('turnkeyFurnished') && (
          <div>
            <label className="block text-sm text-gray-500 mb-1">Turnkey / Furnished</label>
            <div className="relative">
              <select
                className="appearance-none w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0AAFE5] focus:border-[#1E7AC0] bg-white text-sm cursor-pointer"
                value={filters.turnkeyFurnished || ''}
                onChange={(e) => setFilters((p) => ({ ...p, turnkeyFurnished: e.target.value }))}
              >
                <option value="">All</option>
                <option value="FURNISHED">Furnished</option>
                <option value="NOT_FURNISHED">Not Furnished</option>
              </select>
              <svg className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          )}
          {isFilterEnabled('occupancyRate') && (() => { const rc = getRangeConfig('occupancyRate', { min: 0, max: 100, step: 1 }); return (
          <RangeSlider
            label="Est. Occupancy"
            min={rc.min} max={rc.max} step={rc.step}
            valueMin={filters.occupancyRateMin || rc.min}
            valueMax={filters.occupancyRateMax || rc.max}
            onChange={(newMin, newMax) => setFilters((p) => ({ ...p, occupancyRateMin: newMin, occupancyRateMax: newMax }))}
            format={(v) => `${v}%`}
          />); })()}
        </div>
      </AccordionSection>
      )}

      {/* 5. Average Nightly Rate (ANR) */}
      {isSectionEnabled(['anr_budget', 'anr_economy', 'anr_midscale', 'anr_upscale', 'anr_luxury']) && (
      <AccordionSection title="Average Nightly Rate" icon={<span role="img" aria-label="moon">&#x1F319;</span>} open={openSection === 'anr'} onToggle={() => toggleSection('anr')}>
        <div className={`grid grid-cols-1 ${sidebarMode ? '' : 'md:grid-cols-3'} gap-x-8 gap-y-5`}>
          {[
            { key: 'budget', label: 'Budget', configKey: 'anr_budget', defaultMax: 1000 },
            { key: 'economy', label: 'Economy', configKey: 'anr_economy', defaultMax: 1500 },
            { key: 'midscale', label: 'Midscale', configKey: 'anr_midscale', defaultMax: 2000 },
            { key: 'upscale', label: 'Upscale', configKey: 'anr_upscale', defaultMax: 2500 },
            { key: 'luxury', label: 'Luxury', configKey: 'anr_luxury', defaultMax: 5000 },
          ].filter(({ configKey }) => isFilterEnabled(configKey)).map(({ key, label, configKey, defaultMax }) => {
            const rc = getRangeConfig(configKey, { min: 0, max: defaultMax, step: 10 });
            return (
            <RangeSlider
              key={`anr_${key}`}
              label={label}
              min={rc.min} max={rc.max} step={rc.step}
              valueMin={Number(filters[`anrMin_${key}`]) || rc.min}
              valueMax={Number(filters[`anrMax_${key}`]) || rc.max}
              onChange={(lo, hi) => {
                updateFilters((p) => ({
                  ...p,
                  [`anrMin_${key}`]: lo === rc.min ? '' : String(lo),
                  [`anrMax_${key}`]: hi === rc.max ? '' : String(hi),
                }));
                setCurrentPage?.(1);
              }}
              format={(v) => `$${Number(v).toLocaleString()}`}
            />);
          })}
        </div>
      </AccordionSection>
      )}

      {/* 6. Estimated Gross Revenue (EGR) */}
      {isSectionEnabled(['egr_budget', 'egr_economy', 'egr_midscale', 'egr_upscale', 'egr_luxury']) && (
      <AccordionSection title="Estimated Gross Revenue" icon={<span role="img" aria-label="dollar">&#x1F4B5;</span>} open={openSection === 'egr'} onToggle={() => toggleSection('egr')}>
        <div className={`grid grid-cols-1 ${sidebarMode ? '' : 'md:grid-cols-3'} gap-x-8 gap-y-5`}>
          {[
            { key: 'budget', label: 'Budget', configKey: 'egr_budget', defaultMax: 200000 },
            { key: 'economy', label: 'Economy', configKey: 'egr_economy', defaultMax: 300000 },
            { key: 'midscale', label: 'Midscale', configKey: 'egr_midscale', defaultMax: 400000 },
            { key: 'upscale', label: 'Upscale', configKey: 'egr_upscale', defaultMax: 500000 },
            { key: 'luxury', label: 'Luxury', configKey: 'egr_luxury', defaultMax: 1000000 },
          ].filter(({ configKey }) => isFilterEnabled(configKey)).map(({ key, label, configKey, defaultMax }) => {
            const rc = getRangeConfig(configKey, { min: 0, max: defaultMax, step: 1000 });
            return (
            <RangeSlider
              key={`egr_${key}`}
              label={label}
              min={rc.min} max={rc.max} step={rc.step}
              valueMin={Number(filters[`egrMin_${key}`]) || rc.min}
              valueMax={Number(filters[`egrMax_${key}`]) || rc.max}
              onChange={(lo, hi) => {
                updateFilters((p) => ({
                  ...p,
                  [`egrMin_${key}`]: lo === rc.min ? '' : String(lo),
                  [`egrMax_${key}`]: hi === rc.max ? '' : String(hi),
                }));
                setCurrentPage?.(1);
              }}
              format={(v) => `$${Number(v).toLocaleString()}`}
            />);
          })}
        </div>
      </AccordionSection>
      )}

      {/* 7. Vacation Rental Markets */}
      {isFilterEnabled('vacationRentalMarkets') && (
      <AccordionSection title="Vacation Rental Markets" icon={<span role="img" aria-label="palm">&#x1F3D6;</span>} open={openSection === 'vacationMarkets'} onToggle={() => toggleSection('vacationMarkets')}>
        <div className={`grid ${sidebarMode ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
          {[
            { key: 'BEACH', label: 'Beach Destinations' },
            { key: 'MOUNTAIN', label: 'Mountain Destinations' },
            { key: 'URBAN', label: 'Cities / Urban Destinations' },
            { key: 'LAKE', label: 'Lake Destinations' },
            { key: 'NATURE_PARKS', label: 'Nature / Parks & National Parks' },
            { key: 'THEME_PARKS', label: 'Theme Parks' },
            { key: 'COLLEGE_TOWN', label: 'College Towns' },
            { key: 'OFF_BEATEN_PATH', label: 'Off the Beaten Path' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-600">
              <input
                type="checkbox"
                checked={(filters.vacationRentalMarkets || []).includes(key)}
                onChange={() => {
                  const current = filters.vacationRentalMarkets || [];
                  const updated = current.includes(key)
                    ? current.filter((m) => m !== key)
                    : [...current, key];
                  updateFilters((p) => ({ ...p, vacationRentalMarkets: updated }));
                  setCurrentPage?.(1);
                }}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {label}
            </label>
          ))}
        </div>
      </AccordionSection>
      )}

      {/* 7b. Why Do People Travel to This Destination? */}
      {isFilterEnabled('travelMotivations') && (
      <AccordionSection title="Travel Motivations" icon={<span role="img" aria-label="travel">&#x2708;</span>} open={openSection === 'travelMotivationsFilter'} onToggle={() => toggleSection('travelMotivationsFilter')}>
        <div className={`grid ${sidebarMode ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
          {[
            'Conventions & Conferences',
            'Exhibitions & Trade Shows',
            'Medical Facilities',
            'College Activities',
            'Sporting Events',
            'Theme Parks',
            'Relax & Unwind',
            'Sportsman Destinations – Fishing & Hunting',
            'Outdoor Activities – Hiking, Biking, Rafting, Skiing, Boating',
            'State & National Park Visits',
            'Unplug & Disconnect',
            'Experience a Unique Culture',
            'Romantic Getaway',
            'Historic Districts & Attractions',
            'Bleisure – Business & Leisure Travel',
            'Food & Wine Tasting',
            'Art & Cultural Experience',
          ].map((item) => (
            <label key={item} className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-600">
              <input
                type="checkbox"
                checked={(filters.travelMotivations || []).includes(item)}
                onChange={() => {
                  const current = filters.travelMotivations || [];
                  const updated = current.includes(item)
                    ? current.filter((m) => m !== item)
                    : [...current, item];
                  updateFilters((p) => ({ ...p, travelMotivations: updated }));
                  setCurrentPage?.(1);
                }}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {item}
            </label>
          ))}
        </div>
      </AccordionSection>
      )}

      {/* 7c. Tags Filter */}
      <AccordionSection title="Tags" icon={<span role="img" aria-label="tags">&#x1F3F7;</span>} open={openSection === 'tagsFilter'} onToggle={() => toggleSection('tagsFilter')}>
        <div className={`grid ${sidebarMode ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
          {[
            { key: 'jv',         label: '50/50 Joint Venture',     icon: '🤝' },
            { key: 'turnkey',    label: 'Turnkey Fully Furnished', icon: '🏠' },
            { key: 'creative',   label: 'Creative Financing',      icon: '💡' },
            { key: 'lowrate',    label: 'Low Interest Rate',       icon: '📉' },
            { key: 'lowentry',   label: 'Low Entry Fee',           icon: '🔑' },
            { key: 'discounted', label: 'Discounted Price',        icon: '🏷️' },
          ].map(({ key, label, icon }) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-600">
              <input
                type="checkbox"
                checked={(filters.selectedTags || []).includes(key)}
                onChange={() => {
                  const current = filters.selectedTags || [];
                  const updated = current.includes(key)
                    ? current.filter((t) => t !== key)
                    : [...current, key];
                  updateFilters((p) => ({ ...p, selectedTags: updated }));
                  setCurrentPage?.(1);
                }}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>{icon}</span>
              {label}
            </label>
          ))}
        </div>
      </AccordionSection>

      {/* 8. Tax Benefits */}
      {isSectionEnabled(['incomeReduction', 'taxSavings']) && (
      <AccordionSection title="Tax Benefits" icon={<span role="img" aria-label="document">&#x1F4C4;</span>} open={openSection === 'tax'} onToggle={() => toggleSection('tax')}>
        <div className={`grid grid-cols-1 ${sidebarMode ? '' : 'md:grid-cols-2'} gap-x-8 gap-y-5`}>
          {isFilterEnabled('incomeReduction') && (() => { const rc = getRangeConfig('incomeReduction', { min: 0, max: 150000, step: 1000 }); return (
          <RangeSlider
            label="Income Reduction"
            min={rc.min} max={rc.max} step={rc.step}
            valueMin={Number(filters.incomeReductionMin) || rc.min}
            valueMax={Number(filters.incomeReductionMax) || rc.max}
            onChange={(lo, hi) => {
              updateFilters((p) => ({
                ...p,
                incomeReductionMin: lo === rc.min ? '' : String(lo),
                incomeReductionMax: hi === rc.max ? '' : String(hi),
              }));
              setCurrentPage?.(1);
            }}
            format={(v) => `$${Number(v).toLocaleString()}`}
          />); })()}
          {isFilterEnabled('taxSavings') && (() => { const rc = getRangeConfig('taxSavings', { min: 0, max: 50000, step: 1000 }); return (
          <RangeSlider
            label="Est. Tax Savings"
            min={rc.min} max={rc.max} step={rc.step}
            valueMin={Number(filters.taxSavingsMin) || rc.min}
            valueMax={Number(filters.taxSavingsMax) || rc.max}
            onChange={(lo, hi) => {
              updateFilters((p) => ({
                ...p,
                taxSavingsMin: lo === rc.min ? '' : String(lo),
                taxSavingsMax: hi === rc.max ? '' : String(hi),
              }));
              setCurrentPage?.(1);
            }}
            format={(v) => `$${Number(v).toLocaleString()}`}
          />); })()}
        </div>
      </AccordionSection>
      )}
    </>
  );

  // Sidebar mode: only render the filter accordion sections (no top bar)
  if (sidebarMode) {
    return (
      <div className="space-y-4">
        {/* Inline filter sections - always visible in sidebar mode */}
        <div ref={advCardRef} className="space-y-4">
          {renderFilterSections()}
        </div>

        {/* Active Filter Tags */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-400 mr-1">Active:</span>
            {activeFilters.map((filter) => (
              <ActiveFilterTag
                key={filter.key}
                label={filter.label}
                value={filter.value}
                onRemove={() => clearFilter(filter.key)}
              />
            ))}
            {/* <button
              onClick={clearAllFilters}
              className="ml-1 text-xs text-red-400 hover:text-red-600 hover:underline transition-colors"
            >
              Clear All
            </button> */}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-5 py-6 mb-4 relative">
      {/* Top row */}
      <div className="flex items-center gap-3 relative z-30 flex-wrap">

        {/* Search input */}
        <div className="flex items-center gap-2 flex-1 min-w-0 pr-3 px-4 py-2 rounded-lg transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200">
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by title, Description ..."
            value={filters.search}
            onChange={(e) => {
              updateFilters((p) => ({ ...p, search: e.target.value }));
              setCurrentPage?.(1);
            }}
            className="w-full text-sm text-gray-700 placeholder-gray-400 bg-transparent outline-none"
          />

          {/* Submitter Search - Admin only */}
          {showSubmitterSearch && (
            <input
              type="text"
              placeholder="Search by submitter..."
              value={filters.submitterSearch || ''}
              onChange={(e) => {
                updateFilters((prev) => ({ ...prev, submitterSearch: e.target.value }));
                setCurrentPage?.(1);
              }}
              className="text-sm text-gray-700 placeholder-gray-400 bg-transparent outline-none border-l border-gray-200 pl-3 ml-2"
            />
          )}
        </div>

        {/* Status Filter - Admin only */}
        {showStatusFilter && (
          <div className="relative shrink-0">
            <button
              className={`flex items-center gap-2 text-sm font-medium whitespace-nowrap px-4 py-2 rounded-lg transition-colors ${filters.status !== 'All' ? 'bg-blue-50 text-primary' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              onClick={() => {
                closeAll();
                setShowStatusCard?.(true);
              }}
            >
              {filters.status === 'All'
                ? 'Status'
                : filters.status.charAt(0).toUpperCase() + filters.status.slice(1)}
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showStatusCard && (
              <div
                ref={statusCardRef}
                className="absolute left-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 w-56 z-40"
              >
                {[
                  { value: 'All', label: 'All Statuses' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' },
                  { value: 'published', label: 'Published' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    className={`block w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-50 ${filters.status === opt.value ? 'font-semibold text-primary' : 'text-gray-700'
                      }`}
                    onClick={() => {
                      updateFilters((p) => ({ ...p, status: opt.value }));
                      closeAll();
                      setCurrentPage?.(1);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sort */}
        <div className="relative shrink-0">
          <button
            className={`border border-gray-200 flex items-center gap-2 text-sm font-medium whitespace-nowrap px-4 py-2 rounded-lg transition-colors ${filters.sortBy !== 'newest' ? 'bg-blue-50 text-primary' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            onClick={() => {
              closeAll();
              setShowSortByCard?.(true);
            }}
          >
            {SORT_OPTIONS?.find((s) => s.value === filters.sortBy)?.label || 'Newest First'}
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showSortByCard && (
            <div
              ref={sortByCardRef}
              className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 w-56 z-40"
            >
              {SORT_OPTIONS?.map((opt) => (
                <button
                  key={opt.value}
                  className={`block w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-50 ${filters.sortBy === opt.value ? 'font-semibold text-primary' : 'text-gray-700'
                    }`}
                  onClick={() => {
                    updateFilters((p) => ({ ...p, sortBy: opt.value }));
                    closeAll();
                    setCurrentPage?.(1);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Advanced Filters Toggle */}
        <div className="shrink-0 advanced_filters" ref={advToggleRef}>
          <button
            className={`bg-gray-100 inline-flex items-center gap-2 text-sm font-medium whitespace-nowrap px-4 py-2 rounded-lg border transition-colors ${showAdvancedCard ? 'border-primary text-primary bg-blue-50' : 'border-gray-200 text-gray-700 hover:bg-gray-200'
              }`}
            onClick={() => {
              setShowPropertyTypeCard?.(false);
              setShowPriceCard?.(false);
              setShowSortByCard?.(false);
              setShowStatusCard?.(false);
              setShowAdvancedCard?.(!showAdvancedCard);
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 .71 1.71l-6.42 6.42A1 1 0 0 0 14 12v5.38a1 1 0 0 1-.55.9l-4 2A1 1 0 0 1 8 19.38V12a1 1 0 0 0-.29-.71L1.29 4.71A1 1 0 0 1 2 3"
              />
            </svg>
            Filters
            {activeFilters.length > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-600 rounded-full">
                {activeFilters.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Inline Filter Sections */}
      {showAdvancedCard && (
        <div ref={advCardRef} className="mt-4 space-y-3">
          {renderFilterSections()}
        </div>
      )}

      {/* Active Filter Tags */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-400 mr-1">Active filters:</span>
          {activeFilters.map((filter) => (
            <ActiveFilterTag
              key={filter.key}
              label={filter.label}
              value={filter.value}
              onRemove={() => clearFilter(filter.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
