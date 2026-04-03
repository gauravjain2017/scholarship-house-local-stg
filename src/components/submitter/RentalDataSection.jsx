import Input from '../Input';
import Select from '../Select';
import { sanitizePercent } from '../../utils/format';

const RentalDataSection = ({
  formData,
  setFormData,
  handleChange,
  errors,
  errorRefs,
}) => {
  return (
    <div className="mb-12">
      <h2 className="text-2xl font-semibold text-primary mb-2">
        Short-Term Rental Data
      </h2>
      <p className="text-text-secondary mb-6">
        Please provide as much information as you can. Only include
        the information that you know to be accurate. If you don't
        know the information, just leave it blank.
      </p>

      <Select
        label={
          <span className="text-base md:text-lg font-semibold">
            How Confident Are You In The Accuracy Of The Following
            Data?
          </span>
        }
        name="strConfidence"
        value={formData.strConfidence ?? ''}
        onChange={handleChange}
        required
        options={[
          {
            value: 'FIRST_HAND',
            label:
              'I have first-hand information and can verify accuracy',
          },
          {
            value: 'AIRDNA',
            label:
              'The information is based on AirDNA or similar data',
          },
          {
            value: 'DIRECTIONAL_ONLY',
            label: 'The information is directional only',
          },
        ]}
        error={errors.strConfidence}
      />

      <Select
        label={
          <span className="text-base md:text-lg font-semibold">
            Turnkey or Furnished STR Property?
          </span>
        }
        name="turnkeyFurnished"
        value={formData.turnkeyFurnished ?? ''}
        onChange={handleChange}
        required
        options={[
          {
            value: 'TURNKEY_OPERATING',
            label:
              'Turnkey and Currently Operating As a Short-Term Rental.',
          },
          {
            value: 'FURNISHED_NOT_OPERATING',
            label:
              'Fully Furnished but not Currently Operating As a Short-Term Rental.',
          },
          {
            value: 'PARTIALLY_FURNISHED',
            label:
              'Partially Furnished but not Currently Operating As a Short-Term Rental.',
          },
          {
            value: 'NOT_FURNISHED',
            label:
              'Not Furnished or Currently Operating as a Short-Term Rental.',
          },
        ]}
        error={errors.turnkeyFurnished}
      />

      <div className="mb-6">
        <label className="block text-base md:text-lg font-semibold text-text-primary mb-2">
          Confirm STR Zoning Availability{' '}
          <span className="text-red-500">*</span>
        </label>
        <p className="text-sm text-text-secondary mb-4">
          Do you know if the zoning for this property allows you to
          operate as a Short-Term Rental without any HOA, city,
          county, state, or other restrictions?
        </p>
        <Select
          name="strZoning"
          value={formData.strZoning ?? ''}
          onChange={handleChange}
          required
          options={[
            { value: 'YES', label: 'Yes' },
            { value: 'NO', label: 'No' },
            { value: 'UNSURE', label: 'Not Sure' },
          ]}
          error={errors.strZoning}
        />
      </div>

      <div className="mb-2">
        <Input
          label={
            <span className="text-base md:text-lg font-semibold">
              Occupancy Rate (%)
            </span>
          }
          name="occupancyRate"
          type="text"
          inputMode="decimal"
          value={formData.occupancyRate ?? ''}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              occupancyRate: sanitizePercent(e.target.value),
            }))
          }
          placeholder="Enter occupancy rate as a percentage (e.g., 75 for 75%)"
          ref={(el) => (errorRefs.current.occupancyRate = el)}
        />
      </div>

      <div className="mb-6">
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
                checked={
                  formData.vacationRentalMarkets?.includes(value) ||
                  false
                }
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
              <span className="text-sm text-text-primary">
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

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
            <label
              key={reason}
              className="flex items-center space-x-2"
            >
              <input
                type="checkbox"
                checked={
                  formData.travelMotivations?.includes(reason) ||
                  false
                }
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    travelMotivations: e.target.checked
                      ? [...(prev.travelMotivations || []), reason]
                      : prev.travelMotivations.filter(
                          (r) => r !== reason
                        ),
                  }));
                }}
              />
              <span className="text-sm text-text-primary">
                {reason}
              </span>
            </label>
          ))}
        </div>
      </div>

      <Input
        label="Link to Current Airbnb or VRBO Listing (If Applicable)"
        name="strListingLink"
        value={formData.strListingLink ?? ''}
        onChange={handleChange}
        error={errors.strListingLink}
        className="w-full mt-4"
        ref={(el) => (errorRefs.current.strListingLink = el)}
      />
      <Input
        label="Link to STR Data Sheets (If Applicable)"
        name="strDataSheetsLink"
        value={formData.strDataSheetsLink ?? ''}
        onChange={handleChange}
        error={errors.strDataSheetsLink}
        className="w-full mt-4"
        ref={(el) => (errorRefs.current.strDataSheetsLink = el)}
      />
    </div>
  );
};

export default RentalDataSection;
