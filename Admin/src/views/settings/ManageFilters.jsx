import { useState, useEffect } from 'react';
import { dealsAPI } from '../../api/deals';

// All filters that exist in FilterBar, grouped by section
const DEFAULT_FILTERS = [
  // Location
  { key: 'selectedStates', label: 'Location (State)', section: 'Location', type: 'state-selector', enabled: true },
  // Financial
  { key: 'price', label: 'Price', section: 'Financial', type: 'range', enabled: true, min: 0, max: 5000000, step: 10000, format: 'currency' },
  { key: 'downPayment', label: 'Down Payment', section: 'Financial', type: 'range', enabled: true, min: 0, max: 200000, step: 1000, format: 'currency' },
  { key: 'interestRate', label: 'Interest Rate', section: 'Financial', type: 'range', enabled: true, min: 0, max: 10, step: 0.1, format: 'percent' },
  { key: 'monthlyPayment', label: 'Monthly Payment / PITI', section: 'Financial', type: 'range', enabled: true, min: 0, max: 10000, step: 100, format: 'currency' },
  // Property Details
  { key: 'advPropertyType', label: 'Property Type', section: 'Property Details', type: 'select', enabled: true },
  { key: 'advBedroomsMin', label: 'Min Bedrooms', section: 'Property Details', type: 'select', enabled: true },
  { key: 'advBathroomsMin', label: 'Min Bathrooms', section: 'Property Details', type: 'select', enabled: true },
  { key: 'yearBuilt', label: 'Year Built', section: 'Property Details', type: 'range', enabled: true, min: 1900, max: 2026, step: 1, format: 'number' },
  { key: 'sqft', label: 'Square Feet', section: 'Property Details', type: 'range', enabled: true, min: 0, max: 10000, step: 100, format: 'number' },
  // Financing & STR
  { key: 'advFinancing', label: 'Financing Type', section: 'Financing & STR', type: 'select', enabled: true },
  { key: 'turnkeyFurnished', label: 'Turnkey / Furnished', section: 'Financing & STR', type: 'select', enabled: true },
  { key: 'occupancyRate', label: 'Est. Occupancy', section: 'Financing & STR', type: 'range', enabled: true, min: 0, max: 100, step: 1, format: 'percent' },
  // ANR tiers
  { key: 'anr_budget', label: 'ANR - Budget', section: 'Average Nightly Rate', type: 'range', enabled: true, min: 0, max: 1000, step: 10, format: 'currency' },
  { key: 'anr_economy', label: 'ANR - Economy', section: 'Average Nightly Rate', type: 'range', enabled: true, min: 0, max: 1500, step: 10, format: 'currency' },
  { key: 'anr_midscale', label: 'ANR - Midscale', section: 'Average Nightly Rate', type: 'range', enabled: true, min: 0, max: 2000, step: 10, format: 'currency' },
  { key: 'anr_upscale', label: 'ANR - Upscale', section: 'Average Nightly Rate', type: 'range', enabled: true, min: 0, max: 2500, step: 10, format: 'currency' },
  { key: 'anr_luxury', label: 'ANR - Luxury', section: 'Average Nightly Rate', type: 'range', enabled: true, min: 0, max: 5000, step: 10, format: 'currency' },
  // EGR tiers
  { key: 'egr_budget', label: 'EGR - Budget', section: 'Est. Gross Revenue', type: 'range', enabled: true, min: 0, max: 200000, step: 1000, format: 'currency' },
  { key: 'egr_economy', label: 'EGR - Economy', section: 'Est. Gross Revenue', type: 'range', enabled: true, min: 0, max: 300000, step: 1000, format: 'currency' },
  { key: 'egr_midscale', label: 'EGR - Midscale', section: 'Est. Gross Revenue', type: 'range', enabled: true, min: 0, max: 400000, step: 1000, format: 'currency' },
  { key: 'egr_upscale', label: 'EGR - Upscale', section: 'Est. Gross Revenue', type: 'range', enabled: true, min: 0, max: 500000, step: 1000, format: 'currency' },
  { key: 'egr_luxury', label: 'EGR - Luxury', section: 'Est. Gross Revenue', type: 'range', enabled: true, min: 0, max: 1000000, step: 1000, format: 'currency' },
  // Vacation Rental Markets
  { key: 'vacationRentalMarkets', label: 'Vacation Rental Markets', section: 'Vacation Rental Markets', type: 'checkbox-group', enabled: true },
  // Travel Motivations
  { key: 'travelMotivations', label: 'Travel Motivations', section: 'Travel Motivations', type: 'checkbox-group', enabled: true },
  // Tax Benefits
  { key: 'incomeReduction', label: 'Income Reduction', section: 'Tax Benefits', type: 'range', enabled: true, min: 0, max: 150000, step: 1000, format: 'currency' },
  { key: 'taxSavings', label: 'Est. Tax Savings', section: 'Tax Benefits', type: 'range', enabled: true, min: 0, max: 50000, step: 1000, format: 'currency' },
];

const formatValue = (value, format) => {
  if (format === 'currency') return `$${Number(value).toLocaleString('en-US')}`;
  if (format === 'percent') return `${value}%`;
  return Number(value).toLocaleString('en-US');
};

const ManageFilters = () => {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await dealsAPI.getFilterSettings();
      console.log(data)

      if (data.filters && data.filters.length > 0) {
        const merged = DEFAULT_FILTERS.map((def) => {
          const saved = data.filters.find((f) => f.key === def.key);
          return saved ? { ...def, ...saved } : def;
        });
        setFilters(merged);
      }
    } catch (error) {
      console.error('Error loading filter settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await dealsAPI.saveFilterSettings(filters);
      setMessage({ type: 'success', text: 'Filter settings saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving filter settings:', error);
      setMessage({ type: 'error', text: 'Failed to save filter settings.' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const toggleFilter = (key) => {
    setFilters((prev) =>
      prev.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f))
    );
  };

  const updateFilterField = (key, field, value) => {
    setFilters((prev) =>
      prev.map((f) => (f.key === key ? { ...f, [field]: value } : f))
    );
  };

  // Group filters by section
  const sections = {};
  filters.forEach((f) => {
    if (!sections[f.section]) sections[f.section] = [];
    sections[f.section].push(f);
  });

  const sectionIcons = {
    'Location': '\uD83D\uDCCD',
    'Financial': '\uD83D\uDCB0',
    'Property Details': '\uD83C\uDFE0',
    'Financing & STR': '\uD83C\uDFE6',
    'Average Nightly Rate': '\uD83C\uDF19',
    'Est. Gross Revenue': '\uD83D\uDCB5',
    'Vacation Rental Markets': '\uD83C\uDFD6\uFE0F',
    'Travel Motivations': '\u2708\uFE0F',
    'Tax Benefits': '\uD83D\uDCC4',
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading filter settings...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Manage Filters</h1>
           <p className="text-text-secondary text-sm mt-1 pr-3 md:pr-0">
            Control which filters are visible to users, and set the min/max range for each filter.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
           className="inline-flex items-center gap-2 md:px-5 md:py-2.5 px-2 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors md:w-auto w-[65%] text-center justify-center">
          {saving ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </>
          ) : (
            'Save Settings'
          )}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Filter Sections */}
      <div className="space-y-6">
        {Object.entries(sections).map(([sectionName, sectionFilters]) => (
          <div key={sectionName} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Section Header */}
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide flex items-center gap-2">
                <span>{sectionIcons[sectionName] || ''}</span>
                {sectionName}
              </h2>
            </div>

            {/* Filter Rows */}
             <div className="divide-y divide-gray-100 overflow-x-auto md:overflow-x-visible">
              {sectionFilters.map((filter) => (
                <div
                  key={filter.key}
                  className={`w-[600px] md:w-auto px-5 py-4 flex items-center gap-4 transition-colors ${!filter.enabled ? 'bg-gray-50/50 opacity-60' : ''}`}
                >
                  {/* Toggle */}
                  <button
                    onClick={() => toggleFilter(filter.key)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${filter.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${filter.enabled ? 'translate-x-5' : 'translate-x-0'}`}
                    />
                  </button>

                  {/* Filter Name */}
                  <div className="md:w-[270px] shrink-0">
                    <span className="text-sm font-medium text-gray-900">{filter.label}</span>
                    <span className="ml-2 text-xs text-gray-400 capitalize">({filter.type})</span>
                  </div>

                  {/* Range Inputs (only for range type) */}
                  {filter.type === 'range' && (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500 w-8">Min</label>
                        <input
                          type="number"
                          min={0}
                          value={filter.min}
                          onChange={(e) => updateFilterField(filter.key, 'min', filter.key === 'yearBuilt' ? parseInt(e.target.value, 10) || 0 : Math.max(0, Number(e.target.value)))}
                          onKeyDown={(e) => { if (e.key === '-' || (filter.key === 'yearBuilt' && (e.key === '.' || e.key === 'e'))) e.preventDefault(); }}
                          disabled={!filter.enabled}
                          className="w-28 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                        <span className="text-xs text-gray-400">{formatValue(filter.min, filter.format)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500 w-8">Max</label>
                        <input
                          type="number"
                          min={0}
                          value={filter.max}
                          onChange={(e) => updateFilterField(filter.key, 'max', filter.key === 'yearBuilt' ? parseInt(e.target.value, 10) || 0 : Math.max(0, Number(e.target.value)))}
                          onKeyDown={(e) => { if (e.key === '-' || (filter.key === 'yearBuilt' && (e.key === '.' || e.key === 'e'))) e.preventDefault(); }}
                          disabled={!filter.enabled}
                          className="w-28 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                        <span className="text-xs text-gray-400">{formatValue(filter.max, filter.format)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500 w-7">Step</label>
                        <input
                          type="number"
                          min={0}
                          value={filter.step}
                          onChange={(e) => updateFilterField(filter.key, 'step', filter.key === 'yearBuilt' ? parseInt(e.target.value, 10) || 0 : Math.max(0, Number(e.target.value)))}
                          onKeyDown={(e) => { if (e.key === '-' || (filter.key === 'yearBuilt' && (e.key === '.' || e.key === 'e'))) e.preventDefault(); }}
                          disabled={!filter.enabled}
                          className="w-28 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                  )}

                  {/* Non-range types just show enabled/disabled */}
                  {filter.type !== 'range' && (
                    <div className="flex-1">
                      <span className="text-xs text-gray-400">
                        {filter.enabled ? 'Visible to users' : 'Hidden from users'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Save Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

export default ManageFilters;
