import React from 'react';

// helpers
const hasValue = (v) =>
  v !== null &&
  v !== undefined &&
  v !== '' &&
  !(typeof v === 'number' && Number.isNaN(v));

const formatValue = (value, unit) => {
  if (!hasValue(value)) return '—';

  if (unit === '$') {
    return `$${Number(value).toLocaleString('en-US')}`;
  }

  if (unit === '%') {
    return `${Number(value)}%`;
  }

  return value;
};

/**
 * TieredMetric
 *
 * Props:
 * - title: string
 * - unit: '$' | '%' | null
 * - data: { [label: string]: number | null }
 *
 * Example:
 * data={{
 *   '12 Months': 125000,
 *   '24 Months': 238000,
 * }}
 */
const TieredMetric = ({ title, unit, data }) => {
  if (!data || typeof data !== 'object') return null;

  const entries = Object.entries(data).filter(([, v]) => hasValue(v));
  if (entries.length === 0) return null;

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-4 gap-y-3">
        {entries.map(([label, value]) => (
          <div key={label}>
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatValue(value, unit)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TieredMetric;
