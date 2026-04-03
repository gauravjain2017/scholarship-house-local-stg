/**
 * Per-step validation for the multi-step submitter form.
 * Returns { errors, firstErrorField } for the given step.
 */
export function validateStep(step, formData) {
  const errors = {};

  const isEmpty = (v) =>
    v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

  switch (step) {
    case 1: {
      // Property Information
      if (!formData.submitterRelationship) {
        errors.submitterRelationship = 'Your relationship to this property is required';
      }
      if (!formData.category) {
        errors.category = 'Property type is required';
      }
      if (!formData.bedrooms || isEmpty(formData.bedrooms)) {
        errors.bedrooms = 'Bedrooms is required';
      }
      if (!formData.bathrooms || isEmpty(formData.bathrooms)) {
        errors.bathrooms = 'Bathrooms is required';
      }
      if (!formData.squareFootage || isEmpty(formData.squareFootage)) {
        errors.squareFootage = 'Square footage is required';
      }
      if (!formData.description || formData.description.length < 30) {
        errors.description = 'Description must be at least 30 characters';
      }
      break;
    }

    case 2: {
      // Location
      if (!formData.streetAddress?.trim()) {
        errors.streetAddress = 'Street address is required';
      }
      if (!formData.city?.trim()) {
        errors.city = 'City is required';
      }
      if (!formData.stateRegion?.trim()) {
        errors.stateRegion = 'State/Region is required';
      }
      if (!formData.postalCode?.trim()) {
        errors.postalCode = 'Postal code is required';
      }
      break;
    }

    case 3: {
      // Financial Information
      if (isEmpty(formData.price)) {
        errors.price = 'Price is required';
      } else {
        const n = Number(formData.price);
        if (Number.isNaN(n) || n <= 0) {
          errors.price = 'Price must be a positive number';
        }
      }
      if (!formData.financingType) {
        errors.financingType = 'Financing type is required';
      }
      break;
    }

    case 4: {
      // Rental Data
      if (!formData.strConfidence) {
        errors.strConfidence = 'STR Data Confidence is required';
      }
      if (!formData.turnkeyFurnished) {
        errors.turnkeyFurnished = 'Turnkey/Furnished status is required';
      }
      if (!formData.strZoning) {
        errors.strZoning = 'STR Zoning is required';
      }
      break;
    }

    case 5: {
      // Photos & Media
      if (!formData.interiorImages?.length) {
        errors.interiorImages = 'At least 1 interior photo is required';
      }
      if (!formData.exteriorImages?.length) {
        errors.exteriorImages = 'At least 1 exterior photo is required';
      }
      break;
    }

    case 6:
      // Review step — no validation needed, already validated per-step
      break;

    default:
      break;
  }

  return {
    errors,
    firstErrorField: Object.keys(errors)[0] || null,
  };
}
