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

const FINANCING_LABELS = {
  traditional: 'Traditional Financing',
  creative: 'Creative Financing',
};

const BOOKING_PLATFORM_LABELS = {
  AIRBNB: 'Airbnb',
  VRBO: 'VRBO',
  BOTH: 'Both Airbnb & VRBO',
  DIRECT: 'Direct Booking',
  OTHER: 'Other',
};

const yesNoLabel = (v) => (v === 'yes' ? 'Yes' : v === 'no' ? 'No' : null);

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
          <ReviewField label="HOA" value={formData.isHOA ? 'Yes' : 'No'} />
          {formData.isHOA && <ReviewField label="HOA Monthly Fee" value={formatCurrency(formData.hoaMonthlyFee)} />}
          <ReviewField label="Description" value={formData.description} />
          <ReviewField label="Seller's Intentions" value={formData.story} />
          <ReviewField label="Contact Name" value={formData.contactName} />
          <ReviewField label="Contact Phone" value={formData.contactPhone} />
          <ReviewField label="Contact Relation" value={formData.contactRelation} />
          <ReviewField label="Source Link" value={formData.sourceLink} />
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
          <ReviewField label="Financing Type" value={FINANCING_LABELS[formData.financingType] || formData.financingType} />
          <ReviewField label="Purchase Price" value={formatCurrency(formData.price)} />

          {/* Traditional financing */}
          {formData.financingType === 'traditional' && (
            <ReviewField label="Additional Info" value={formData.financialInfo} />
          )}

          {/* Creative financing */}
          {formData.financingType === 'creative' && (
            <>
              <ReviewField label="Expected Close of Escrow" value={formData.expectedCloseDate} />
              <ReviewField label="Earnest Money Deposit (EMD)" value={formatCurrency(formData.emd)} />
              <ReviewField label="Down Payment (Excluding closing costs)" value={formatCurrency(formData.downPayment)} />
              <ReviewField label="Assignment Fee" value={formatCurrency(formData.assignmentFee)} />

              <ReviewField label="Primary Mortgage?" value={yesNoLabel(formData.hasPrimaryMortgage)} />
              {formData.hasPrimaryMortgage === 'yes' && (
                <>
                  <ReviewField label="Primary Loan Balance" value={formatCurrency(formData.primaryLoanBalance)} />
                  <ReviewField label="Primary Interest Rate" value={formData.primaryInterestRate ? `${formData.primaryInterestRate}%` : null} />
                  <ReviewField label="Primary Maturity Date" value={formData.primaryMaturityDate} />
                  <ReviewField label="Primary Principal & Interest" value={formatCurrency(formData.primaryPrincipalInterest)} />
                  <ReviewField label="Primary Taxes & Insurance" value={formatCurrency(formData.primaryTaxesInsurance)} />
                </>
              )}

              <ReviewField label="Second Mortgage?" value={yesNoLabel(formData.hasSecondMortgage)} />
              {formData.hasSecondMortgage === 'yes' && (
                <>
                  <ReviewField label="Second Loan Balance" value={formatCurrency(formData.secondLoanBalance)} />
                  <ReviewField label="Second Interest Rate" value={formData.secondInterestRate ? `${formData.secondInterestRate}%` : null} />
                  <ReviewField label="Second Maturity Date" value={formData.secondMaturityDate} />
                  <ReviewField label="Second Principal & Interest" value={formatCurrency(formData.secondPrincipalInterest)} />
                  <ReviewField label="Second Taxes & Insurance" value={formatCurrency(formData.secondTaxesInsurance)} />
                </>
              )}

              <ReviewField label="Seller Equity?" value={yesNoLabel(formData.hasSellerEquity)} />
              {formData.hasSellerEquity === 'yes' && (
                <>
                  <ReviewField label="Seller Loan Amount" value={formatCurrency(formData.sellerEquityAmount)} />
                  <ReviewField label="Seller Interest Rate" value={formData.sellerEquityInterestRate ? `${formData.sellerEquityInterestRate}%` : null} />
                  <ReviewField label="Seller Maturity Date" value={formData.sellerEquityMaturityDate} />
                  <ReviewField label="Seller Principal & Interest" value={formatCurrency(formData.sellerEquityPrincipalInterest)} />
                  <ReviewField label="Balloon Payment Due" value={formData.sellerEquityBalloonYears ? `${formData.sellerEquityBalloonYears} Year${Number(formData.sellerEquityBalloonYears) > 1 ? 's' : ''}` : null} />
                </>
              )}

              <ReviewField label="Deal Terms" value={formData.dealTerms} />
              <ReviewField label="Total Starting Monthly Payment" value={formatCurrency(formData.totalStartingMonthlyPayment)} />
            </>
          )}
        </div>
      </div>

      {/* Rental Data */}
      <div className="mb-6 bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <SectionHeader step={4} title="Short-Term Rental Data" />
        <div className="px-6 py-3">
          <ReviewField label="STR Zoning Approved" value={ZONING_LABELS[formData.strZoning]} />
          <ReviewField label="Currently Operating as STR?" value={yesNoLabel(formData.isOperatingSTR)} />

          {formData.isOperatingSTR === 'yes' && (
            <>
              <ReviewField label="Listing Link" value={formData.strListingLink} />
              <ReviewField label="Turnkey/Furnished" value={TURNKEY_LABELS[formData.turnkeyFurnished]} />
              <ReviewField label="Access to STR Financials?" value={yesNoLabel(formData.hasStrFinancials)} />

              {formData.hasStrFinancials === 'yes' && (
                <>
                  {formData.strFinancialDocs?.length > 0 && (
                    <ReviewField
                      label="STR Financial Documents"
                      value={`${formData.strFinancialDocs.length} file${formData.strFinancialDocs.length > 1 ? 's' : ''} uploaded`}
                    />
                  )}
                  <ReviewField label="Data Sheets Link" value={formData.strDataSheetsLink} />
                  <ReviewField label="Occupancy Rate" value={formData.occupancyRate ? `${formData.occupancyRate}%` : null} />
                  <ReviewField label="Average Nightly Rate" value={formatCurrency(formData.averageNightlyRate)} />
                  <ReviewField label="Annual Gross Revenue" value={formatCurrency(formData.strAnnualRevenue)} />
                  <ReviewField label="Average Monthly Revenue" value={formatCurrency(formData.strMonthlyRevenue)} />
                  <ReviewField label="Monthly Utilities" value={formatCurrency(formData.strMonthlyUtilities)} />
                  <ReviewField label="Net Operating Income (NOI)" value={formatCurrency(formData.strNOI)} />
                  <ReviewField label="Cleaning Fee per Stay" value={formatCurrency(formData.strCleaningFee)} />
                  <ReviewField label="Average Length of Stay" value={formData.strAvgStay ? `${formData.strAvgStay} night${Number(formData.strAvgStay) > 1 ? 's' : ''}` : null} />
                  <ReviewField label="Property Management Fee" value={formData.strManagementFee ? `${formData.strManagementFee}%` : null} />
                  <ReviewField label="Primary Booking Platform" value={BOOKING_PLATFORM_LABELS[formData.strBookingPlatform] || formData.strBookingPlatform} />
                </>
              )}
            </>
          )}

          <ReviewField label="Current Bookings?" value={yesNoLabel(formData.hasCurrentBookings)} />
          {formData.hasCurrentBookings === 'yes' && (
            <ReviewField label="Current Bookings Details" value={formData.currentBookingsDescription} />
          )}
          <ReviewField label="Data Confidence" value={CONFIDENCE_LABELS[formData.strConfidence]} />
          {formData.vacationRentalMarkets?.length > 0 && (
            <ReviewField label="Vacation Markets" value={formData.vacationRentalMarkets.join(', ')} />
          )}
          {formData.travelMotivations?.length > 0 && (
            <ReviewField label="Travel Motivations" value={formData.travelMotivations.join(', ')} />
          )}
          <ReviewField label="Guest Demand" value={formData.guestDemandInsights} />
          <ReviewField label="Value Add" value={formData.valueAddOpportunities} />
          <ReviewField label="Local Contacts" value={formData.localContacts} />
          <ReviewField label="Amenities" value={formData.amenities} />
          <ReviewField label="Attractions" value={formData.localAttractions} />
        </div>
      </div>

      {/* Photos */}
      <div className="mb-6 bg-panel border border-border-subtle rounded-xl overflow-hidden">
        <SectionHeader step={5} title="Photos & Media" />
        <div className="px-6 py-3">
          <ReviewImages label="Cover Photo" images={formData.coverPhoto} />
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
