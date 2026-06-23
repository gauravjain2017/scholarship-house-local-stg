import FileUpload from '../FileUpload';
import Textarea from '../Textarea';

const PropertyMediaSection = ({
  formData,
  setFormData,
  handleChange,
  errors,
  errorRefs,
}) => {
  return (
    <>
      {/* Media */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold text-primary mb-2">
          Property Photos and Videos
        </h2>
        <p className="text-text-secondary mb-8">
          Please provide as many detailed photos as you can.
        </p>

        {/* Cover Photo — single image used as the primary display image */}
        <div className="mb-8">
          <FileUpload
            label="Cover Photo"
            accept="image/*"
            multiple={false}
            value={formData.coverPhoto}
            onChange={(urls) =>
              setFormData((prev) => ({
                ...prev,
                coverPhoto: urls,
              }))
            }
            error={errors.coverPhoto}
            required
          />
          <p className="text-sm text-text-secondary -mt-2">
            Only 1 image allowed. This image will be used as the primary
            display image on the website.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <FileUpload
              label="Interior Photos"
              accept="image/*"
              multiple
              value={formData.interiorImages}
              onChange={(urls) =>
                setFormData((prev) => ({
                  ...prev,
                  interiorImages: urls,
                }))
              }
              error={errors.interiorImages}
              required
            />
          </div>

          <div>
            <FileUpload
              label="Exterior Photos"
              accept="image/*"
              multiple
              value={formData.exteriorImages}
              onChange={(urls) =>
                setFormData((prev) => ({
                  ...prev,
                  exteriorImages: urls,
                }))
              }
              error={errors.exteriorImages}
              required
            />
          </div>

          <div>
            <FileUpload
              label="Additional Photos"
              accept="image/*"
              multiple
              value={formData.additionalImages}
              onChange={(urls) =>
                setFormData((prev) => ({
                  ...prev,
                  additionalImages: urls,
                }))
              }
              error={errors.additionalImages}
            />
          </div>

          <div>
            <FileUpload
              label="Videos"
              accept="video/*"
              multiple
              value={formData.videos}
              onChange={(urls) =>
                setFormData((prev) => ({
                  ...prev,
                  videos: urls,
                }))
              }
            />
          </div>
        </div>
      </div>

      {/* Additional Information */}
      <div className="mb-12">
        <Textarea
          label={
            <span className="text-base md:text-lg font-semibold">
              Additional Information
            </span>
          }
          name="additionalInfo"
          value={formData.additionalInfo ?? ''}
          onChange={handleChange}
          rows={6}
          placeholder="Add any extra notes, context, or information here..."
          error={errors.additionalInfo}
          className="w-full"
          ref={(el) => (errorRefs.current.additionalInfo = el)}
        />
      </div>
    </>
  );
};

export default PropertyMediaSection;
