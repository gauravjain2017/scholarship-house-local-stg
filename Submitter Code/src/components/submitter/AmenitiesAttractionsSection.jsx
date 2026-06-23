import Textarea from '../Textarea';

const AmenitiesAttractionsSection = ({
  formData,
  handleChange,
  errorRefs,
}) => {
  return (
    <details className="mt-8 border border-border-subtle rounded-xl">
      <summary className="cursor-pointer px-4 py-3 bg-panel font-semibold text-primary rounded-t-lg focus:outline-none focus:ring-2 focus:ring-accent">
        Amenities & Attractions (Optional)
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
      </div>
    </details>
  );
};

export default AmenitiesAttractionsSection;
