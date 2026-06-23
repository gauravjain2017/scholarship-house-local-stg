/**
 * DuplicateAddressModal
 *
 * Shown when a user tries to submit a property that already exists in the system.
 * Offers options to claim ownership or proceed without claiming.
 */

import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { FiAlertTriangle, FiUpload, FiX } from 'react-icons/fi';

const DuplicateAddressModal = ({
  isOpen,
  onClose,
  existingProperty,
  onClaimOwnership,
  onProceedWithoutClaim,
  isLoading = false,
}) => {
  const [selectedOption, setSelectedOption] = useState(null);

  const handleContinue = () => {
    if (selectedOption === 'claim') {
      onClaimOwnership();
    } else if (selectedOption === 'no-claim') {
      onProceedWithoutClaim();
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Duplicate Address Detected"
      maxWidth="max-w-lg"
    >
      <div className="space-y-6">
        {/* Warning Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <FiAlertTriangle className="text-amber-500 text-xl flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-800 font-medium">
              A property at this address already exists in our system.
            </p>
            <p className="text-amber-700 text-sm mt-1">
              Please review the existing property information below and choose
              how to proceed.
            </p>
          </div>
        </div>

        {/* Existing Property Info */}
        {existingProperty && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">
              Existing Property
            </h4>
            <div className="space-y-1 text-sm text-gray-600">
              <p>
                <span className="font-medium">Address:</span>{' '}
                {existingProperty.streetAddress}, {existingProperty.city},{' '}
                {existingProperty.stateRegion} {existingProperty.postalCode}
              </p>
              <p>
                <span className="font-medium">Submitted:</span>{' '}
                {formatDate(existingProperty.submittedAt)}
              </p>
              <p>
                <span className="font-medium">Status:</span>{' '}
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    existingProperty.status === 'published'
                      ? 'bg-green-100 text-green-800'
                      : existingProperty.status === 'approved'
                        ? 'bg-blue-100 text-blue-800'
                        : existingProperty.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {existingProperty.status}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Options */}
        <div className="space-y-3">
          <p className="font-medium text-gray-900">
            How would you like to proceed?
          </p>

          {/* Option 1: Claim Ownership */}
          <label
            className={`block border rounded-lg p-4 cursor-pointer transition-all ${
              selectedOption === 'claim'
                ? 'border-accent bg-accent/5 ring-2 ring-accent/20'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="duplicateOption"
                value="claim"
                checked={selectedOption === 'claim'}
                onChange={() => setSelectedOption('claim')}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FiUpload className="text-accent" />
                  <span className="font-medium text-gray-900">
                    I own this property
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  I will upload proof of ownership (deed, title, or purchase
                  agreement). The existing submission will be flagged for
                  review, and an admin will verify ownership before approving
                  either submission.
                </p>
                <p className="text-xs text-amber-600 mt-2 font-medium">
                  Note: Both properties will be temporarily unpublished during
                  the review process.
                </p>
              </div>
            </div>
          </label>

          {/* Option 2: Don't Claim */}
          <label
            className={`block border rounded-lg p-4 cursor-pointer transition-all ${
              selectedOption === 'no-claim'
                ? 'border-accent bg-accent/5 ring-2 ring-accent/20'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="duplicateOption"
                value="no-claim"
                checked={selectedOption === 'no-claim'}
                onChange={() => setSelectedOption('no-claim')}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FiX className="text-gray-500" />
                  <span className="font-medium text-gray-900">
                    I do not own this property
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  I acknowledge that a property at this address already exists.
                  My submission will proceed normally but may be reviewed
                  alongside the existing property.
                </p>
              </div>
            </div>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleContinue}
            disabled={!selectedOption || isLoading}
            className="flex-1"
          >
            {isLoading ? 'Processing...' : 'Continue'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DuplicateAddressModal;
