import { useState } from 'react';
import Input from '../Input';
import Select from '../Select';
import { formatNumber, unformatNumber, sanitizePercent } from '../../utils/format';

const RentalDataSection = ({
  formData,
  setFormData,
  handleChange,
  errors,
  errorRefs,
}) => {
  const setField = (name, value) =>
    setFormData((prev) => ({ ...prev, [name]: value }));

  // STR financial documents (PDF / Excel / image). File objects are uploaded
  // to S3 on submit; existing edit-mode items arrive as URL strings.
  const [docDragActive, setDocDragActive] = useState(false);

  const addStrDocs = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    setFormData((prev) => ({
      ...prev,
      strFinancialDocs: [...(prev.strFinancialDocs || []), ...incoming],
    }));
  };

  const removeStrDoc = (idx) =>
    setFormData((prev) => ({
      ...prev,
      strFinancialDocs: (prev.strFinancialDocs || []).filter((_, i) => i !== idx),
    }));

  const docDrag = (e, active) => {
    e.preventDefault();
    e.stopPropagation();
    setDocDragActive(active);
  };

  const docDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDocDragActive(false);
    addStrDocs(e.dataTransfer.files);
  };

  const strDocName = (doc) =>
    doc instanceof File ? doc.name : String(doc).split('/').pop();

  const moneyField = (name, label, placeholder) => (
    <Input
      label={label}
      name={name}
      type="text"
      inputMode="numeric"
      value={formatNumber(formData[name] ?? '')}
      onChange={(e) =>
        setField(name, unformatNumber(e.target.value).replace(/[^0-9]/g, ''))
      }
      placeholder={placeholder}
      error={errors[name]}
      ref={(el) => (errorRefs.current[name] = el)}
    />
  );

  const percentField = (name, label, placeholder) => (
    <Input
      label={label}
      name={name}
      type="text"
      inputMode="decimal"
      value={formData[name] ?? ''}
      onChange={(e) => setField(name, sanitizePercent(e.target.value))}
      placeholder={placeholder}
      error={errors[name]}
      ref={(el) => (errorRefs.current[name] = el)}
    />
  );

  const numberField = (name, label, placeholder) => (
    <Input
      label={label}
      name={name}
      type="text"
      inputMode="numeric"
      value={formData[name] ?? ''}
      onChange={(e) => setField(name, e.target.value.replace(/[^0-9.]/g, ''))}
      placeholder={placeholder}
      error={errors[name]}
      ref={(el) => (errorRefs.current[name] = el)}
    />
  );

  const yesNo = (name, label) => (
    <div className="mb-6" ref={(el) => (errorRefs.current[name] = el)}>
      <label className="block text-base md:text-lg font-semibold text-text-primary mb-2">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="flex items-center gap-6">
        {[
          ['yes', 'Yes'],
          ['no', 'No'],
        ].map(([val, lbl]) => (
          <label key={val} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={val}
              checked={formData[name] === val}
              onChange={() => setField(name, val)}
              className="h-4 w-4 text-accent focus:ring-accent"
            />
            <span className="text-sm text-text-primary">{lbl}</span>
          </label>
        ))}
      </div>
      {errors[name] && (
        <p className="mt-1 text-sm text-red-500">{errors[name]}</p>
      )}
    </div>
  );

  const isOperating = formData.isOperatingSTR === 'yes';
  const hasFinancials = formData.hasStrFinancials === 'yes';
  const zoningFlag =
    formData.strZoning === 'NO' || formData.strZoning === 'UNSURE';

  return (
    <div className="mb-12">
      <h2 className="text-2xl font-semibold text-primary mb-2">
        Short-Term Rental Data
      </h2>
      <p className="text-text-secondary mb-6">
        Please provide as much information as you can. Only include the
        information that you know to be accurate. If you don't know the
        information, just leave it blank.
      </p>

      {/* 1. STR Zoning */}
      <div className="mb-6">
        <label className="block text-base md:text-lg font-semibold text-text-primary mb-2">
          Confirm STR Zoning Availability{' '}
          <span className="text-red-500">*</span>
        </label>
        <p className="text-sm text-text-secondary mb-3">
          Do you know if the zoning for this property allows you to operate as a
          Short-Term Rental without any HOA, city, county, state, or other
          restrictions?
        </p>
        <Select
          name="strZoning"
          value={formData.strZoning ?? ''}
          onChange={handleChange}
          required
          options={[
            { value: 'YES', label: 'Yes — Property is approved for STR' },
            { value: 'NO', label: 'No — Property is not approved for STR' },
            { value: 'UNSURE', label: 'Unsure' },
          ]}
          error={errors.strZoning}
        />
        {zoningFlag && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            ⚠️ This property will be internally flagged for review before
            publishing, as STR zoning has not been confirmed.
          </div>
        )}
      </div>

      {/* 2. Currently operating as STR? */}
      {yesNo('isOperatingSTR', 'Is This Property Currently Operating as an STR?')}

      {/* STR Yes: Airbnb link + Turnkey + Financials */}
      {isOperating && (
        <div className="mb-6">
          <Input
            label="Link to Current Airbnb or VRBO Listing"
            name="strListingLink"
            value={formData.strListingLink ?? ''}
            onChange={handleChange}
            error={errors.strListingLink}
            placeholder="https://..."
            className="w-full"
            ref={(el) => (errorRefs.current.strListingLink = el)}
          />

          <div className="mt-4">
            <Select
              label={
                <span className="text-base md:text-lg font-semibold">
                  Is It Turnkey or Furnished?
                </span>
              }
              name="turnkeyFurnished"
              value={formData.turnkeyFurnished ?? ''}
              onChange={handleChange}
              options={[
                {
                  value: 'TURNKEY_OPERATING',
                  label: 'Yes — Turnkey / Furnished',
                },
                {
                  value: 'PARTIALLY_FURNISHED',
                  label: 'Partially Furnished',
                },
                {
                  value: 'NOT_FURNISHED',
                  label: 'No — Not Turnkey',
                },
              ]}
              error={errors.turnkeyFurnished}
            />
          </div>

          {/* Do you have access to financials? */}
          <div className="mt-4">
            {yesNo('hasStrFinancials', 'Do You Have Access to the STR Financials?')}
          </div>

          {hasFinancials && (
            <div className="border border-border rounded-lg p-4">
              {/* Upload STR Financial Documents — displayed above Link to STR Data Sheets */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Upload STR Financial Documents
                </label>
                <div
                  className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
                    docDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                  }`}
                  onDragEnter={(e) => docDrag(e, true)}
                  onDragOver={(e) => docDrag(e, true)}
                  onDragLeave={(e) => docDrag(e, false)}
                  onDrop={docDrop}
                >
                  <input
                    type="file"
                    accept=".pdf,.xls,.xlsx,.csv,image/*"
                    multiple
                    onChange={(e) => {
                      addStrDocs(e.target.files);
                      e.target.value = '';
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="text-center pointer-events-none">
                    <svg
                      className="mx-auto h-10 w-10 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                        d="M9 13h6m-6 4h6m2 4H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"
                      />
                    </svg>
                    <p className="mt-2 text-sm text-gray-600">
                      Drag and drop files here, or click to select
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      PDF, Excel, or image files accepted
                    </p>
                  </div>
                </div>

                {formData.strFinancialDocs?.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {formData.strFinancialDocs.map((doc, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                      >
                        {typeof doc === 'string' ? (
                          <a
                            href={doc}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-accent underline"
                          >
                            {strDocName(doc)}
                          </a>
                        ) : (
                          <span className="truncate text-text-primary">
                            {strDocName(doc)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeStrDoc(idx)}
                          className="shrink-0 text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Input
                label="Link to STR Data Sheets (If Applicable)"
                name="strDataSheetsLink"
                value={formData.strDataSheetsLink ?? ''}
                onChange={handleChange}
                error={errors.strDataSheetsLink}
                placeholder="https://..."
                className="w-full"
                ref={(el) => (errorRefs.current.strDataSheetsLink = el)}
              />

              <hr className="my-4 border-border" />
              <p className="text-base font-semibold text-text-primary mb-1">
                STR Key Metrics
              </p>
              <p className="text-sm text-text-secondary mb-4">
                Fill in what you know. Leave blank anything you're unsure of.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {percentField('occupancyRate', 'Occupancy Rate (%)', 'e.g., 75')}
                {moneyField('averageNightlyRate', 'Average Nightly Rate ($)', 'e.g., 225')}
                {moneyField('strAnnualRevenue', 'Annual Gross Revenue ($)', 'e.g., 65,000')}
                {moneyField('strMonthlyRevenue', 'Average Monthly Revenue ($)', 'e.g., 5,400')}
                {moneyField('strMonthlyUtilities', 'Monthly Utilities ($)', 'e.g., 300')}
                {moneyField('strNOI', 'Net Operating Income — NOI ($)', 'e.g., 42,000')}
                {moneyField('strCleaningFee', 'Cleaning Fee per Stay ($)', 'e.g., 150')}
                {numberField('strAvgStay', 'Average Length of Stay (Nights)', 'e.g., 3')}
                {percentField('strManagementFee', 'Property Management Fee (%)', 'e.g., 20')}
                <Select
                  label="Primary Booking Platform"
                  name="strBookingPlatform"
                  value={formData.strBookingPlatform ?? ''}
                  onChange={handleChange}
                  options={[
                    { value: 'AIRBNB', label: 'Airbnb' },
                    { value: 'VRBO', label: 'VRBO' },
                    { value: 'BOTH', label: 'Both Airbnb & VRBO' },
                    { value: 'DIRECT', label: 'Direct Booking' },
                    { value: 'OTHER', label: 'Other' },
                  ]}
                  error={errors.strBookingPlatform}
                />
              </div>

              {/* Current bookings — displayed after Primary Booking Platform */}
              <div className="mt-4">
                <Select
                  label={
                    <span className="text-base md:text-lg font-semibold">
                      Does It Have Current Bookings?
                    </span>
                  }
                  name="hasCurrentBookings"
                  value={formData.hasCurrentBookings ?? ''}
                  onChange={handleChange}
                  options={[
                    { value: 'yes', label: 'Yes' },
                    { value: 'no', label: 'No' },
                  ]}
                  error={errors.hasCurrentBookings}
                />
                {formData.hasCurrentBookings === 'yes' && (
                  <div className="mt-4">
                    <Input
                      label="Current Bookings — Brief Description"
                      name="currentBookingsDescription"
                      type="text"
                      value={formData.currentBookingsDescription ?? ''}
                      onChange={handleChange}
                      error={errors.currentBookingsDescription}
                      placeholder="Briefly describe the current bookings (e.g., dates, number of reservations, revenue already secured)."
                      ref={(el) => (errorRefs.current.currentBookingsDescription = el)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Confidence in data */}
      <Select
        label={
          <span className="text-base md:text-lg font-semibold">
            How Confident Are You In The Accuracy Of The Following Data?
          </span>
        }
        name="strConfidence"
        value={formData.strConfidence ?? ''}
        onChange={handleChange}
        required
        options={[
          {
            value: 'FIRST_HAND',
            label: 'I have first-hand information and can verify accuracy',
          },
          {
            value: 'AIRDNA',
            label: 'The information is based on AirDNA or similar data',
          },
          {
            value: 'DIRECTIONAL_ONLY',
            label: 'The information is directional only',
          },
        ]}
        error={errors.strConfidence}
      />

      {/* Vacation Rental Markets */}
      <div className="mb-6 mt-4">
        <label className="block text-base md:text-lg font-semibold text-text-primary mb-2">
          Vacation Rental Market(s)
        </label>
        <p className="text-sm text-text-secondary mb-3">
          Select all the markets that apply to this property.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            ['BEACH', 'Beach Destinations'],
            ['MOUNTAIN', 'Mountain Destinations'],
            ['URBAN', 'Cities / Urban Destinations'],
            ['LAKE', 'Lake Destinations'],
            ['NATURE_PARKS', 'Nature / State & National Parks'],
            ['THEME_PARKS', 'Theme Parks'],
            ['COLLEGE_TOWN', 'College Towns'],
            ['OFF_BEATEN_PATH', 'Off The Beaten Path'],
          ].map(([value, label]) => (
            <label
              key={value}
              className="flex items-center space-x-2 cursor-pointer"
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border-subtle text-accent focus:ring-accent"
                checked={formData.vacationRentalMarkets?.includes(value) || false}
                onChange={(e) => {
                  setFormData((prev) => {
                    const current = prev.vacationRentalMarkets || [];
                    return {
                      ...prev,
                      vacationRentalMarkets: e.target.checked
                        ? current.includes(value)
                          ? current
                          : [...current, value]
                        : current.filter((v) => v !== value),
                    };
                  });
                }}
              />
              <span className="text-sm text-text-primary">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Why Do People Travel */}
      <div className="mb-6">
        <label className="block text-base md:text-lg font-semibold text-text-primary mb-3">
          Why Do People Travel to This Destination?
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
          ].map((reason) => (
            <label key={reason} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.travelMotivations?.includes(reason) || false}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    travelMotivations: e.target.checked
                      ? [...(prev.travelMotivations || []), reason]
                      : prev.travelMotivations.filter((r) => r !== reason),
                  }));
                }}
              />
              <span className="text-sm text-text-primary">{reason}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RentalDataSection;
