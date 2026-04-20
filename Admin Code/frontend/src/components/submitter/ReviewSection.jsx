const CATEGORY_LABELS = {
  SINGLE_FAMILY: 'Single Family Home',
  CONDO: 'Condo',
  TOWNHOUSE: 'Town House',
  TWO_TO_FOUR_UNIT: '2-4 Unit Home',
  UNIQUE_PROPERTY: 'Unique Property',
};

const RELATIONSHIP_LABELS = {
  TEAM_MEMBER: 'Scholarship House team member',
  REALTOR_LISTING_OWNER: 'Realtor (my listing)',
  REALTOR_NOT_LISTING_OWNER: 'Realtor (not my listing)',
  WHOLESALER_HOLDS_CONTRACT: 'Wholesaler (holds contract)',
  WHOLESALER_NO_CONTRACT: 'Wholesaler (no contract)',
  REAL_ESTATE_PROFESSIONAL: 'Real estate professional',
  BIRDDOGGER: 'Birddogger',
};

const CONFIDENCE_LABELS = {
  FIRST_HAND: 'First-hand information',
  AIRDNA: 'AirDNA or similar data',
  DIRECTIONAL_ONLY: 'Directional only',
};

const TURNKEY_LABELS = {
  TURNKEY_OPERATING: 'Turnkey & Currently Operating',
  FURNISHED_NOT_OPERATING: 'Fully Furnished, Not Operating',
  PARTIALLY_FURNISHED: 'Partially Furnished',
  NOT_FURNISHED: 'Not Furnished',
};

const ZONING_LABELS = {
  YES: 'Yes',
  NO: 'No',
  UNSURE: 'Not Sure',
};

const ReviewField = ({ label, value }) => {
  if (!value && value !== 0) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 py-2 border-b border-border-subtle last:border-b-0">
      <span className="text-sm font-medium text-text-secondary min-w-[200px]">{label}</span>
      <span className="text-sm text-text-primary">{value}</span>
    </div>
  );
};

const isVideoFile = (file) => {
  if (typeof file === 'string') {
    return /\.(mp4|webm|ogg|mov|avi)(\?.*)?$/i.test(file);
  }
  return file?.type?.startsWith('video/');
};

const ReviewImages = ({ label, images }) => {
  if (!images?.length) return null;
  return (
    <div className="py-2 border-b border-border-subtle last:border-b-0">
      <span className="text-sm font-medium text-text-secondary">{label}</span>
      <div className="flex flex-wrap gap-2 mt-2">
        {images.map((img, i) => {
          const src = typeof img === 'string' ? img : URL.createObjectURL(img);
          const isVideo = isVideoFile(img);
          return (
            <div key={i} className="w-20 h-20 rounded-lg overflow-hidden border border-border-subtle bg-app">
              {isVideo ? (
                <video src={src} className="w-full h-full object-cover" muted />
              ) : (
                <img src={src} alt={`${label} ${i + 1}`} className="w-full h-full object-cover" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ReviewSection = ({ formData, onEditStep }) => {
  const formatCurrency = (val) => {
    if (!val) return null;
    return `$${Number(val).toLocaleString()}`;
  };

  const isReadOnly = !onEditStep;

  const SectionHeader = ({ step, title }) => {
    if (isReadOnly) {
      return (
        <div className="w-full flex items-center px-6 py-4 bg-surface border-b border-border-subtle">
          <h3 className="text-lg font-semibold text-primary">{title}</h3>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => onEditStep(step)}
        className="w-full flex items-center justify-between px-6 py-4 bg-surface hover:bg-app transition-colors border-b border-border-subtle"
      >
        <h3 className="text-lg font-semibold text-primary">{title}</h3>
        <span className="text-sm text-accent font-medium">Edit</span>
      </button>
    );
  };

  return (
    <div className="mb-12">
      <h2 className="text-2xl font-semibold text-primary mb-2">
        {isReadOnly ? 'Submission Summary' : 'Review Your Submission'}
      </h2>
      <p className="text-text-secondary mb-8">
        {isReadOnly
          ? 'Here are the details of your submitted property.'
          : 'Please review all details before submitting. Click any section header to go back and edit.'}
      </p>

      {/* Property Information */}
      <div className="mb-6 bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <SectionHeader step={1} title="Property Information" />
        <div className="px-6 py-3">
          <ReviewField label="Relationship" value={RELATIONSHIP_LABELS[formData.submitterRelationship]} />
          <ReviewField label="Property Type" value={CATEGORY_LABELS[formData.category]} />
          <ReviewField label="Bedrooms" value={formData.bedrooms} />
          <ReviewField label="Bathrooms" value={formData.bathrooms} />
          <ReviewField label="Year Built" value={formData.yearBuilt} />
          <ReviewField label="Square Footage" value={formData.squareFootage ? Number(formData.squareFootage).toLocaleString() : null} />
          <ReviewField label="Description" value={formData.description} />
        </div>
      </div>

      {/* Location */}
      <div className="mb-6 bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <SectionHeader step={2} title="Location" />
        <div className="px-6 py-3">
          <ReviewField label="Street Address" value={formData.streetAddress} />
          <ReviewField label="Address Line 2" value={formData.addressLine2} />
          <ReviewField label="City" value={formData.city} />
          <ReviewField label="State / Region" value={formData.stateRegion} />
          <ReviewField label="Postal / Zip Code" value={formData.postalCode} />
        </div>
      </div>

      {/* Financial */}
      <div className="mb-6 bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <SectionHeader step={3} title="Financial Information" />
        <div className="px-6 py-3">
          <ReviewField label="Price" value={formatCurrency(formData.price)} />
          <ReviewField label="Financing Type" value={formData.financingType} />
          <ReviewField label="Expected Close" value={formData.expectedCloseDate} />
          <ReviewField label="EMD" value={formatCurrency(formData.emd)} />
          <ReviewField label="Down Payment" value={formatCurrency(formData.downPayment)} />
          <ReviewField label="Additional Info" value={formData.financialInfo} />
          <ReviewField label="HOA" value={formData.isHOA ? 'Yes' : 'No'} />
          {formData.isHOA && <ReviewField label="HOA Monthly Fee" value={formatCurrency(formData.hoaMonthlyFee)} />}
        </div>
      </div>

      {/* Rental Data */}
      <div className="mb-6 bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <SectionHeader step={4} title="Rental Data" />
        <div className="px-6 py-3">
          <ReviewField label="Data Confidence" value={CONFIDENCE_LABELS[formData.strConfidence]} />
          <ReviewField label="Turnkey/Furnished" value={TURNKEY_LABELS[formData.turnkeyFurnished]} />
          <ReviewField label="STR Zoning" value={ZONING_LABELS[formData.strZoning]} />
          <ReviewField label="Occupancy Rate" value={formData.occupancyRate ? `${formData.occupancyRate}%` : null} />
          {formData.vacationRentalMarkets?.length > 0 && (
            <ReviewField label="Vacation Markets" value={formData.vacationRentalMarkets.join(', ')} />
          )}
          {formData.travelMotivations?.length > 0 && (
            <ReviewField label="Travel Motivations" value={formData.travelMotivations.join(', ')} />
          )}
          <ReviewField label="Listing Link" value={formData.strListingLink} />
          <ReviewField label="Data Sheets Link" value={formData.strDataSheetsLink} />
          <ReviewField label="Guest Demand" value={formData.guestDemandInsights} />
          <ReviewField label="Value Add" value={formData.valueAddOpportunities} />
          <ReviewField label="Local Contacts" value={formData.localContacts} />
          <ReviewField label="Amenities" value={formData.amenities} />
          <ReviewField label="Attractions" value={formData.localAttractions} />
          {formData.specialTags?.length > 0 && (
            <ReviewField label="Special Tags" value={formData.specialTags.join(', ')} />
          )}
        </div>
      </div>

      {/* Photos */}
      <div className="mb-6 bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <SectionHeader step={5} title="Photos & Media" />
        <div className="px-6 py-3">
          <ReviewImages label="Interior Photos" images={formData.interiorImages} />
          <ReviewImages label="Exterior Photos" images={formData.exteriorImages} />
          <ReviewImages label="Additional Photos" images={formData.additionalImages} />
          <ReviewImages label="Videos" images={formData.videos} />
          <ReviewField label="Additional Information" value={formData.additionalInfo} />
        </div>
      </div>
    </div>
  );
};

export default ReviewSection;
