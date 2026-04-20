import { useState, useEffect } from 'react';
import { dealsAPI } from '../../api/deals';

const DEFAULT_SETTINGS = {
federal_tax_rate: '',
};

const ManageTaxRates = () => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await dealsAPI.getTaxRateSettings();
        if (data.settings) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...Object.fromEntries(
              Object.entries(data.settings).filter(([_, v]) => v !== null)
            ),
          });
        }
      } catch (error) {
        console.error('Error loading tax rate settings:', error);
      }
    };
    loadSettings();
  }, []);

  const numberFields = [
  { key: 'federal_tax_rate', label: 'Federal Tax Rate' },
  ];

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleNumberInput = (key, value) => {
    if (value === '') { setSettings(prev => ({ ...prev, [key]: '' })); return; }
    const num = parseInt(value.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      setSettings(prev => ({ ...prev, [key]: num }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await dealsAPI.saveTaxRateSettings(settings);
      setMessage({ type: 'success', text: 'Tax Saved successfully' });
    } catch (error) {
      console.error('Error saving tax rate settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings.' });
    }
    setSaving(false);
    setTimeout(() => setMessage(null), 3000);
  };

  // Returns inline style for blue-filled track up to thumb position
  const getTrackStyle = (key, min, max) => {
    const pct = ((settings[key] - min) / (max - min)) * 100;
    return {
      background: `linear-gradient(to right, #2563eb ${pct}%, #e5e7eb ${pct}%)`,
    };
  };

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Manage Tax Rates</h1>
          <p className="text-sm text-gray-500 mt-1">Configure tax rates and financial parameters for deal calculations.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving && (
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          )}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Range Input Fields */}
     
      {/* Number Input Fields */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-200">
   
        {numberFields.map((field) => (
          <div key={field.key} className="px-6 py-5 flex items-center justify-between gap-6">
            <div className="min-w-[250px]">
              <label className="text-sm font-medium text-gray-900">{field.label}</label>
            </div>
            <div className="flex-1 max-w-md">
              <div className="flex items-center gap-2 max-w-[160px]">
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="100"
                  step="1"
                  value={settings[field.key]}
                  onChange={(e) => handleNumberInput(field.key, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === '.' || e.key === 'e' || e.key === 'E') e.preventDefault();
                  }}
                  onBlur={(e) => {
                    if (e.target.value === '') setSettings(prev => ({ ...prev, [field.key]: 0 }));
                  }}
                  placeholder="0"
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <span className="text-sm font-semibold text-gray-600">%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving && (
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          )}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

    </div>
  );
};

export default ManageTaxRates;