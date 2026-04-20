import Textarea from '../Textarea';

const AmenitiesAttractionsSection = ({
  formData,
  setFormData,
  handleChange,
  errorRefs,
}) => {
  return (
    <details className="mt-8 border border-border-subtle rounded-xl">
      <summary className="cursor-pointer px-4 py-3 bg-panel font-semibold text-primary rounded-t-lg focus:outline-none focus:ring-2 focus:ring-accent">
        Amenities, Attractions & Tags (Optional)
      </summary>

      <div className="p-6 space-y-6 bg-surface">
        <Textarea
          label={
            <span className="text-base md:text-lg font-semibold">
              Amenities
            </span>
          }
          name="amenities"
          value={formData.amenities ?? ''}
          onChange={handleChange}
          rows={3}
          placeholder="Examples: pool, hot tub, EV charger, game room, crib, high chair, fast Wi-Fi..."
          ref={(el) => (errorRefs.current.amenities = el)}
        />

        <Textarea
          label={
            <span className="text-base md:text-lg font-semibold">
              Local Attractions
            </span>
          }
          name="localAttractions"
          value={formData.localAttractions ?? ''}
          onChange={handleChange}
          rows={3}
          placeholder="Nearby beaches, parks, venues, ski resorts, downtown districts, etc."
          ref={(el) => (errorRefs.current.localAttractions = el)}
        />

        <div>
          <h3 className="text-lg font-medium text-primary mb-2">
            Special Tags
          </h3>
          <p className="text-sm text-text-secondary mb-3">
            Some tags will be added automatically based on listing
            data. You may also manually select applicable tags
            below.
          </p>
          <div className="flex flex-col space-y-2">
            {[
              {
                value: 'MOTIVATED_SELLER',
                label: 'Motivated Seller',
              },
              { value: 'OFF_MARKET', label: 'Off-Market Property' },
            ].map(({ value, label }) => (
              <label
                key={value}
                className="flex items-center space-x-2"
              >
                <input
                  type="checkbox"
                  checked={
                    formData.specialTags?.includes(value) || false
                  }
                  onChange={(e) => {
                    setFormData((prev) => ({
                      ...prev,
                      specialTags: e.target.checked
                        ? [...(prev.specialTags || []), value]
                        : prev.specialTags.filter(
                            (t) => t !== value
                          ),
                    }));
                  }}
                />
                <span className="text-sm text-text-primary">
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>
        <p className="text-xs text-text-secondary">
          Automatic tags such as "low entry fee" or "low interest
          rate" may be applied later based on pricing and financing
          data.
        </p>
      </div>
    </details>
  );
};

export default AmenitiesAttractionsSection;
