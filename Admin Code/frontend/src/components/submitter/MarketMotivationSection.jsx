import Textarea from '../Textarea';

const MarketMotivationSection = ({
  formData,
  handleChange,
  errorRefs,
}) => {
  return (
    <details className="mt-8 border border-border-subtle rounded-xl">
      <summary className="cursor-pointer px-4 py-3 bg-panel font-semibold text-primary rounded-t-lg focus:outline-none focus:ring-2 focus:ring-accent">
        Market Motivation & Travel Drivers (Optional)
      </summary>

      <div className="p-6 space-y-6 bg-surface">
        <p className="text-sm text-text-secondary">
          These insights help buyers understand demand drivers and
          guest behavior.
        </p>

        <Textarea
          label={
            <span className="text-base md:text-lg font-semibold">
              What Do Rental Guests Want Most in This Area?
            </span>
          }
          name="guestDemandInsights"
          value={formData.guestDemandInsights ?? ''}
          onChange={handleChange}
          rows={4}
          placeholder="Insights into guest expectations, amenities, or experiences..."
          ref={(el) => (errorRefs.current.guestDemandInsights = el)}
        />

        <Textarea
          label={
            <span className="text-base md:text-lg font-semibold">
              How Can We Add Value to This Property to Increase
              Income?
            </span>
          }
          name="valueAddOpportunities"
          value={formData.valueAddOpportunities ?? ''}
          onChange={handleChange}
          rows={4}
          placeholder="Examples: pool, hot tub, bikes, beach gear, game tables, etc."
          ref={(el) =>
            (errorRefs.current.valueAddOpportunities = el)
          }
        />

        <Textarea
          label={
            <span className="text-base md:text-lg font-semibold">
              Recommended Property Managers, Contractors, or
              Cleaning: Companies
            </span>
          }
          name="localContacts"
          value={formData.localContacts ?? ''}
          onChange={handleChange}
          rows={4}
          placeholder="List any trusted local contacts buyers could use..."
          ref={(el) => (errorRefs.current.localContacts = el)}
        />
      </div>
    </details>
  );
};

export default MarketMotivationSection;
