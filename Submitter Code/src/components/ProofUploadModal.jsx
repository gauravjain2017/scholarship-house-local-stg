/**
 * ProofUploadModal
 *
 * Modal for uploading proof of ownership documents for dispute resolution.
 */

import { useState, useRef } from 'react';
import Modal from './Modal';
import Button from './Button';
import { FiUpload, FiFile, FiX, FiCheck, FiAlertCircle } from 'react-icons/fi';
import { getPresignedUploadUrl, uploadFileToS3 } from '../api/upload';

const ProofUploadModal = ({
  isOpen,
  onClose,
  onUploadComplete,
  disputeId,
  title = 'Upload Proof of Ownership',
  description = 'Please upload a document that proves your ownership of this property (e.g., deed, title, purchase agreement, or contract).',
}) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [uploadedUrl, setUploadedUrl] = useState(null);
  const fileInputRef = useRef(null);

  const acceptedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  const maxFileSize = 10 * 1024 * 1024; // 10MB

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setError(null);

    // Validate file type
    if (!acceptedTypes.includes(selectedFile.type)) {
      setError(
        'Invalid file type. Please upload a PDF, image, or Word document.'
      );
      return;
    }

    // Validate file size
    if (selectedFile.size > maxFileSize) {
      setError('File is too large. Maximum size is 10MB.');
      return;
    }

    setFile(selectedFile);
    setUploadedUrl(null);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Get presigned URL
      const { url, key } = await getPresignedUploadUrl(
        file.name,
        file.type,
        'dispute-proofs'
      );

      // Upload to S3
      await uploadFileToS3(url, file, (progress) => {
        setUploadProgress(Math.round(progress));
      });

      // Construct the final URL
      const finalUrl = url.split('?')[0]; // Remove query params to get the object URL
      setUploadedUrl(finalUrl);

      // Call the completion handler
      if (onUploadComplete) {
        await onUploadComplete(finalUrl);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setUploadedUrl(null);
    setUploadProgress(0);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    handleRemoveFile();
    onClose();
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        {/* Description */}
        <p className="text-sm text-gray-600">{description}</p>

        {/* File Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            file
              ? 'border-accent bg-accent/5'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onClick={() => !file && fileInputRef.current?.click()}
        >
          {!file ? (
            <div className="space-y-2 cursor-pointer">
              <FiUpload className="mx-auto text-3xl text-gray-400" />
              <p className="text-sm text-gray-600">
                <span className="text-accent font-medium">Click to upload</span>
              </p>
              <p className="text-xs text-gray-500">
                PDF, images, or Word documents (max 10MB)
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FiFile className="text-2xl text-accent" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              {!uploading && !uploadedUrl && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile();
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <FiX />
                </button>
              )}
              {uploadedUrl && <FiCheck className="text-green-500 text-xl" />}
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-accent h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Success Message */}
        {uploadedUrl && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
            <FiCheck className="text-green-500" />
            <p className="text-sm text-green-700">
              Document uploaded successfully! You can close this dialog.
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
            <FiAlertCircle className="text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Accepted File Types Info */}
        <div className="text-xs text-gray-500">
          <p className="font-medium mb-1">Accepted documents:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Property deed or title</li>
            <li>Purchase agreement or contract</li>
            <li>Property tax statement with your name</li>
            <li>Insurance documents showing ownership</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={uploading}
            className="flex-1"
          >
            {uploadedUrl ? 'Close' : 'Cancel'}
          </Button>
          {!uploadedUrl && (
            <Button
              type="button"
              onClick={handleUpload}
              disabled={!file || uploading}
              className="flex-1"
            >
              {uploading ? 'Uploading...' : 'Upload Document'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ProofUploadModal;
