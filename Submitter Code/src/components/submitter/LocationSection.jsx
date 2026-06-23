import Input from '../Input';

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

const LocationSection = ({
  formData,
  handleChange,
  errors,
  errorRefs,
}) => {
  return (
    <div className="mb-8">
      <h3 className="text-xl font-medium text-primary mb-1">
        Location Information
      </h3>
      <p className="text-sm text-text-secondary mb-6">
        Address will not be shown publicly to our clients but will be
        used internally by our team.
      </p>

      <div className="mb-2">
        <Input
          label={
            <span className="text-base md:text-lg font-semibold">
              Street Address <span className="text-red-500">*</span>
            </span>
          }
          name="streetAddress"
          value={formData.streetAddress ?? ''}
          onChange={handleChange}
          required
          placeholder="e.g., 123 Main St"
          error={errors.streetAddress}
          ref={(el) => (errorRefs.current.streetAddress = el)}
        />
      </div>
      <div className="mb-2">
        <Input
          label={
            <span className="text-base md:text-lg font-semibold">
              Address Line 2
            </span>
          }
          name="addressLine2"
          value={formData.addressLine2 ?? ''}
          onChange={handleChange}
          placeholder="Apt, Suite, etc. (optional)"
        />
      </div>
      <div className="flex space-x-4 mb-2">
        <div className="flex-1">
          <Input
            label={
              <span className="text-base md:text-lg font-semibold">
                City <span className="text-red-500">*</span>
              </span>
            }
            name="city"
            value={formData.city ?? ''}
            onChange={handleChange}
            required
            placeholder="e.g., Nashville"
            error={errors.city}
            ref={(el) => (errorRefs.current.city = el)}
          />
        </div>
        <div className="flex-1">
          <div ref={(el) => (errorRefs.current.stateRegion = el)}>
            <label className="block mb-1">
              <span className="text-base md:text-lg font-semibold">
                State <span className="text-red-500">*</span>
              </span>
            </label>
            <select
              name="stateRegion"
              value={formData.stateRegion ?? ''}
              onChange={handleChange}
              required
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${
                errors.stateRegion ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select State</option>
              {US_STATES.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name}
                </option>
              ))}
            </select>
            {errors.stateRegion && (
              <p className="text-red-500 text-sm mt-1">{errors.stateRegion}</p>
            )}
          </div>
        </div>
      </div>
      <div className="mb-2">
        <Input
          label={
            <span className="text-base md:text-lg font-semibold">
              Postal/Zip Code <span className="text-red-500">*</span>
            </span>
          }
          name="postalCode"
          value={formData.postalCode ?? ''}
          onChange={handleChange}
          required
          placeholder="e.g., 37201"
          error={errors.postalCode}
          ref={(el) => (errorRefs.current.postalCode = el)}
        />
      </div>
    </div>
  );
};

export default LocationSection;
