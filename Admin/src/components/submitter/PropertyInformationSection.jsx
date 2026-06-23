import { useEffect } from 'react';
import NumericInput from '../NumericInput';
import Select from '../Select';
import Textarea from '../Textarea';
import DateInput from '../DateInput';
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
  // Hidden auto field: on the Add Property page, expiry_date is always set to
  // today + 20 days so it is saved with the submission. This section is only
  // rendered in the add/submit flow (never the edit-property modals).
  useEffect(() => {
    if (formData.expiry_date) return; // keep an existing value (e.g. resumed draft)
    const d = new Date();
    d.setDate(d.getDate() + 20);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setFormData((prev) => ({ ...prev, expiry_date: `${mm}/${dd}/${yyyy}` }));
  }, [formData.expiry_date, setFormData]);

  return (
    <div className="mb-12">
      {/* Hidden expiry_date — auto-set to today + 20 days, saved on submit */}
      <input type="hidden" name="expiry_date" value={formData.expiry_date ?? ''} readOnly />

      <h2 className="text-2xl font-semibold text-primary mb-2">
        Property Information
      </h2>
      <p className="text-text-secondary mb-8">
        Please provide information about the property.
      </p>

      {/* Property Type (Bullet Choices) */}
      <div className="mb-4">
        {/* Submitter Relationship + Property Expiry Date */}
        <div className="grid grid-cols-1 md:grid-cols gap-4 mb-4">
          <div>
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
                  label: 'I am a CFS team member',
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
                  label: 'I am a wholesaler and I have the contrac',
                },
                {
                  value: 'WHOLESALER_NO_CONTRACT',
                  label:
                    'I am a wholesaler, but I don\u2019t have the contract',
                },
                {
                  value: 'REAL_ESTATE_PROFESSIONAL',
                  label:
                    'I am a real estate professional and this is my client',
                },
                {
                  value: 'BIRDDOGGER',
                  label: 'I am a birddogger and found this property',
                },
              ]}
              error={errors.submitterRelationship}
            />
          </div>
          
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
      </div>

      {/* HOA Information */}
      <div className="mb-4">
        <Select
          label={
            <span className="text-base md:text-lg font-semibold">
              Is This Property In An HOA?
            </span>
          }
          name="isHOA"
          value={formData.isHOA ? 'yes' : 'no'}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              isHOA: e.target.value === 'yes',
            }))
          }
          options={[
            { value: 'no', label: 'No' },
            { value: 'yes', label: 'Yes' },
          ]}
        />

        {formData.isHOA && (
          <div className="mt-3">
            <NumericInput
              label={
                <span>
                  HOA Monthly Fee ($) <span className="text-red-500">*</span>
                </span>
              }
              name="hoaMonthlyFee"
              type="text"
              inputMode="numeric"
              value={formatNumber(formData.hoaMonthlyFee ?? '')}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  hoaMonthlyFee: unformatNumber(e.target.value).replace(
                    /[^0-9]/g,
                    ''
                  ),
                }))
              }
              error={errors.hoaMonthlyFee}
              ref={(el) => (errorRefs.current.hoaMonthlyFee = el)}
            />
          </div>
        )}
      </div>

      {/* Description */}
      <Textarea
        label={
          <span className="text-base md:text-lg font-semibold">
            Listing Description
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


      {/* Story */}
      <Textarea
        label={
          <span className="text-base md:text-lg font-semibold">
            Seller's Intentions
          </span>
        }
        name="story"
        value={formData.story ?? ''}
        onChange={handleChange}
        error={errors.story}
        rows={6}
        placeholder="Why is the seller selling this property at this time? What are their goals and motivations?"
        ref={(el) => (errorRefs.current.story = el)}
      />
      <p className="text-sm text-text-secondary -mt-2 mb-4">
        Why is the seller selling this property at this time? What are their
        goals and motivations?
      </p>

      <hr className="my-8 border-border" />

      {/* Property's Main Point of Contact */}
      <div className="mb-6">
        <h3 className="text-base md:text-lg font-semibold text-text-primary mb-4">
          Property's Main Point of Contact
        </h3>
        <div className="border border-border rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="contactName"
                value={formData.contactName ?? ''}
                onChange={handleChange}
                placeholder="Full name"
                ref={(el) => (errorRefs.current.contactName = el)}
                className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent ${errors.contactName ? 'border-red-500' : 'border-border'}`}
              />
              {errors.contactName && (
                <p className="text-xs text-red-500 mt-1">{errors.contactName}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                name="contactPhone"
                inputMode="numeric"
                value={formData.contactPhone ?? ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    contactPhone: e.target.value.replace(/[^0-9]/g, ''),
                  }))
                }
                placeholder="e.g., 5555555555"
                ref={(el) => (errorRefs.current.contactPhone = el)}
                className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent ${errors.contactPhone ? 'border-red-500' : 'border-border'}`}
              />
              {errors.contactPhone && (
                <p className="text-xs text-red-500 mt-1">{errors.contactPhone}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                Relation to Property <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="contactRelation"
                value={formData.contactRelation ?? ''}
                onChange={handleChange}
                placeholder="e.g., Owner, Agent, Wholesaler"
                ref={(el) => (errorRefs.current.contactRelation = el)}
                className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent ${errors.contactRelation ? 'border-red-500' : 'border-border'}`}
              />
              {errors.contactRelation && (
                <p className="text-xs text-red-500 mt-1">{errors.contactRelation}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Source Link */}
      <div className="mb-6">
        <label className="block text-base md:text-lg font-semibold text-text-primary mb-1">
          Source Link
        </label>
        <p className="text-sm text-text-secondary mb-2">
          Paste the URL to the original listing site here.
        </p>
        <input
          type="url"
          name="sourceLink"
          value={formData.sourceLink ?? ''}
          onChange={handleChange}
          placeholder="https://..."
          className="w-full border border-accent rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        {errors.sourceLink && (
          <p className="text-xs text-red-500 mt-1">{errors.sourceLink}</p>
        )}
      </div>

      {/* About Your Listing Expiration */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-700 mb-1 flex items-center gap-2">
          <span>🗓️</span> About Your Listing Expiration
        </h4>
        <p className="text-sm text-blue-700">
          Your property listing will expire 20 days from the date of submission. You will be
          notified 3 days before expiration so you can review the property details and make
          sure everything is still accurate and up to date before resubmitting.
        </p>
      </div>

    </div>
  );
};

export default PropertyInformationSection;
