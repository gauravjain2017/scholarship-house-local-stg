import NumericInput from '../NumericInput';
import Select from '../Select';
import Textarea from '../Textarea';
import { formatNumber, unformatNumber } from '../../utils/format';

const CATEGORIES = [
  { value: 'SINGLE_FAMILY', label: 'Single Family Home' },
  { value: 'CONDO', label: 'Condo' },
  { value: 'TOWNHOUSE', label: 'Town House' },
  { value: 'TWO_TO_FOUR_UNIT', label: '2–4 Unit Home' },
  {
    value: 'UNIQUE_PROPERTY',
    label: 'Unique Property (Treehouses, Castles, Yurts, Etc.)',
  },
];

const PropertyInformationSection = ({
  formData,
  setFormData,
  handleChange,
  errors,
  errorRefs,
}) => {
  return (
    <div className="mb-12">
      <h2 className="text-2xl font-semibold text-primary mb-2">
        Property Information
      </h2>
      <p className="text-text-secondary mb-8">
        Please provide information about the property.
      </p>

      {/* Property Type (Bullet Choices) */}
      <div className="mb-4">
        {/* Submitter Relationship */}
        <div className="mb-4">
          <Select
            label={
              <span className="text-base md:text-lg font-semibold">
                Your Relationship To This Property{' '}
                <span className="text-red-500">*</span>
              </span>
            }
            name="submitterRelationship"
            value={formData.submitterRelationship ?? ''}
            onChange={handleChange}
            options={[
              {
                value: 'TEAM_MEMBER',
                label: 'I am a Scholarship House team member',
              },
              {
                value: 'REALTOR_LISTING_OWNER',
                label: 'I am a realtor and this is my listing',
              },
              {
                value: 'REALTOR_NOT_LISTING_OWNER',
                label: 'I am a realtor, but this is not my listing',
              },
              {
                value: 'WHOLESALER_HOLDS_CONTRACT',
                label: 'I am a wholesaler and I hold the contract',
              },
              {
                value: 'WHOLESALER_NO_CONTRACT',
                label:
                  'I am a wholesaler, but I don\u2019t hold the contract',
              },
              {
                value: 'REAL_ESTATE_PROFESSIONAL',
                label:
                  'I am a real estate professional, and this is my client',
              },
              {
                value: 'BIRDDOGGER',
                label: 'I am a birddogger and found this property',
              },
            ]}
            error={errors.submitterRelationship}
          />
        </div>

        <label className="block text-base md:text-lg font-semibold text-text-primary mb-3">
          Property Type <span className="text-red-500">*</span>
        </label>

        <div className="flex flex-col space-y-2">
          {CATEGORIES.map(({ value, label }) => (
            <label key={value} className="inline-flex items-center">
              <input
                type="radio"
                name="category"
                value={value}
                checked={formData.category === value}
                onChange={handleChange}
                required
                className="form-radio accent-accent"
              />
              <span className="ml-2 text-text-primary">{label}</span>
            </label>
          ))}
        </div>

        {errors.category && (
          <p className="text-xs text-red-500 mt-1">{errors.category}</p>
        )}
      </div>

      {/* Property Details: Bedrooms, Bathrooms, Year Built, Square Footage */}
      <div className="mb-4">
        <div className="grid grid-cols-2 gap-4 mb-2">
          <div>
            <NumericInput
              label={
                <span className="text-base md:text-lg font-semibold">
                  Bedrooms <span className="text-red-500">*</span>
                </span>
              }
              name="bedrooms"
              type="text"
              inputMode="numeric"
              value={formatNumber(formData.bedrooms ?? '')}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  bedrooms: unformatNumber(e.target.value).replace(
                    /[^0-9]/g,
                    ''
                  ),
                }))
              }
              required
              error={errors.bedrooms}
              placeholder="e.g., 3"
              ref={(el) => (errorRefs.current.bedrooms = el)}
            />
          </div>
          <div>
            <NumericInput
              label={
                <span className="text-base md:text-lg font-semibold">
                  Bathrooms <span className="text-red-500">*</span>
                </span>
              }
              name="bathrooms"
              type="text"
              inputMode="numeric"
              value={formatNumber(formData.bathrooms ?? '')}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  bathrooms: unformatNumber(e.target.value).replace(
                    /[^0-9]/g,
                    ''
                  ),
                }))
              }
              required
              error={errors.bathrooms}
              placeholder="e.g., 2"
              ref={(el) => (errorRefs.current.bathrooms = el)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <NumericInput
              label={
                <span className="text-base md:text-lg font-semibold">
                  Year Built <span className="text-red-500">*</span>
                </span>
              }
              name="yearBuilt"
              type="text"
              inputMode="numeric"
              value={formData.yearBuilt ?? ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  yearBuilt: unformatNumber(e.target.value).replace(
                    /[^0-9]/g,
                    ''
                  ),
                }))
              }
              required
              error={errors.yearBuilt}
              placeholder="e.g., 2005"
              ref={(el) => (errorRefs.current.yearBuilt = el)}
            />
          </div>
          <div>
            <NumericInput
              label={
                <span className="text-base md:text-lg font-semibold">
                  Square Footage <span className="text-red-500">*</span>
                </span>
              }
              name="squareFootage"
              type="text"
              inputMode="numeric"
              value={formatNumber(formData.squareFootage ?? '')}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  squareFootage: unformatNumber(e.target.value).replace(
                    /[^0-9]/g,
                    ''
                  ),
                }))
              }
              required
              error={errors.squareFootage}
              placeholder="e.g., 2,200"
              ref={(el) => (errorRefs.current.squareFootage = el)}
            />
          </div>
        </div>
      </div>

      {/* Description */}
      <Textarea
        label={
          <span className="text-base md:text-lg font-semibold">
            Description
          </span>
        }
        name="description"
        value={formData.description ?? ''}
        onChange={handleChange}
        required
        error={errors.description}
        rows={6}
        placeholder="Describe the property..."
        ref={(el) => (errorRefs.current.description = el)}
      />
    </div>
  );
};

export default PropertyInformationSection;
