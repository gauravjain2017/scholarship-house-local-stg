/**
 * MyDisputes Page
 *
 * Shows users their ownership disputes and allows them to upload proof of ownership.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { disputesAPI } from '../api/disputes';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/Button';
import Loader from '../components/Loader';
import ProofUploadModal from '../components/ProofUploadModal';
import {
  FiAlertTriangle,
  FiClock,
  FiCheck,
  FiX,
  FiUpload,
  FiFileText,
  FiExternalLink,
} from 'react-icons/fi';

const DISPUTE_STATUS_CONFIG = {
  pending_both: {
    label: 'Awaiting Proof',
    color: 'bg-amber-100 text-amber-800',
    icon: FiClock,
  },
  pending_original: {
    label: 'Waiting for Other Party',
    color: 'bg-blue-100 text-blue-800',
    icon: FiClock,
  },
  pending_new: {
    label: 'Awaiting Your Proof',
    color: 'bg-amber-100 text-amber-800',
    icon: FiAlertTriangle,
  },
  pending_review: {
    label: 'Under Review',
    color: 'bg-purple-100 text-purple-800',
    icon: FiFileText,
  },
  resolved: {
    label: 'Resolved',
    color: 'bg-green-100 text-green-800',
    icon: FiCheck,
  },
  auto_resolved: {
    label: 'Auto-Resolved',
    color: 'bg-gray-100 text-gray-800',
    icon: FiCheck,
  },
};

const RESOLUTION_LABELS = {
  original_owner: 'Original submitter verified as owner',
  new_owner: 'New submitter verified as owner',
  both_valid: 'Both parties verified',
  both_invalid: 'Neither party could be verified',
  timeout_original: 'Original submitter did not respond',
  timeout_new: 'New submitter did not respond',
  timeout_both: 'Neither party responded',
};

const MyDisputes = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState(null);

  const {
    data: disputes = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['myDisputes'],
    queryFn: disputesAPI.getMyDisputes,
    enabled: !!user,
  });

  const uploadProofMutation = useMutation({
    mutationFn: ({ disputeId, proofUrl }) =>
      disputesAPI.uploadProof(disputeId, proofUrl),
    onSuccess: () => {
      queryClient.invalidateQueries(['myDisputes']);
      setUploadModalOpen(false);
      setSelectedDispute(null);
    },
  });

  const handleUploadProof = (dispute) => {
    setSelectedDispute(dispute);
    setUploadModalOpen(true);
  };

  const handleProofUploadComplete = async (proofUrl) => {
    if (!selectedDispute) return;
    await uploadProofMutation.mutateAsync({
      disputeId: selectedDispute.disputeId,
      proofUrl,
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDaysRemaining = (deadline) => {
    if (!deadline) return null;
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const needsUserProof = (dispute) => {
    const userEmail = user?.email?.toLowerCase();
    if (
      dispute.originalSubmitterEmail === userEmail &&
      !dispute.originalProofUrl
    ) {
      return true;
    }
    if (dispute.newSubmitterEmail === userEmail && !dispute.newProofUrl) {
      return true;
    }
    return false;
  };

  const userWon = (dispute) => {
    if (!dispute.resolution) return null;
    const userEmail = user?.email?.toLowerCase();
    const isOriginal = dispute.originalSubmitterEmail === userEmail;

    const winningResolutions = isOriginal
      ? ['original_owner', 'timeout_new', 'both_valid']
      : ['new_owner', 'timeout_original', 'both_valid'];

    return winningResolutions.includes(dispute.resolution);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Error loading disputes</p>
          <p className="text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          My Ownership Disputes
        </h1>
        <p className="text-gray-600 mt-1">
          Manage disputes for properties you've submitted or claimed ownership
          of.
        </p>
      </div>

      {disputes.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <FiCheck className="mx-auto text-4xl text-green-500 mb-3" />
          <h3 className="text-lg font-medium text-gray-900">
            No Active Disputes
          </h3>
          <p className="text-gray-600 mt-1">
            You don't have any ownership disputes at this time.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => {
            const statusConfig = DISPUTE_STATUS_CONFIG[dispute.status] || {
              label: dispute.status,
              color: 'bg-gray-100 text-gray-800',
              icon: FiClock,
            };
            const StatusIcon = statusConfig.icon;
            const daysRemaining = getDaysRemaining(dispute.deadline);
            const showUploadButton =
              needsUserProof(dispute) &&
              !['resolved', 'auto_resolved'].includes(dispute.status);
            const won = userWon(dispute);
            const isOriginal =
              dispute.originalSubmitterEmail === user?.email?.toLowerCase();

            return (
              <div
                key={dispute.disputeId}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
              >
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusIcon
                      className={`text-lg ${
                        dispute.status === 'resolved' ||
                        dispute.status === 'auto_resolved'
                          ? won
                            ? 'text-green-500'
                            : 'text-red-500'
                          : 'text-amber-500'
                      }`}
                    />
                    <div>
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${statusConfig.color}`}
                      >
                        {statusConfig.label}
                      </span>
                      {won !== null && (
                        <span
                          className={`ml-2 inline-block px-2 py-1 rounded text-xs font-medium ${
                            won
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {won ? 'Won' : 'Lost'}
                        </span>
                      )}
                    </div>
                  </div>
                  {daysRemaining !== null &&
                    !['resolved', 'auto_resolved'].includes(dispute.status) && (
                      <div
                        className={`text-sm font-medium ${
                          daysRemaining <= 7 ? 'text-red-600' : 'text-gray-600'
                        }`}
                      >
                        {daysRemaining > 0
                          ? `${daysRemaining} days remaining`
                          : 'Deadline passed'}
                      </div>
                    )}
                </div>

                {/* Content */}
                <div className="px-6 py-4">
                  {/* Property Address */}
                  <div className="mb-4">
                    <p className="text-sm text-gray-500">Property Address</p>
                    <p className="font-medium text-gray-900">
                      {dispute.originalProperty?.streetAddress ||
                        dispute.normalizedAddress}
                      , {dispute.originalProperty?.city},{' '}
                      {dispute.originalProperty?.stateRegion}
                    </p>
                  </div>

                  {/* Dispute Details */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Your Role</p>
                      <p className="font-medium text-gray-900">
                        {isOriginal ? 'Original Submitter' : 'New Claimant'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Created</p>
                      <p className="font-medium text-gray-900">
                        {formatDate(dispute.createdAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Your Proof</p>
                      <p className="font-medium">
                        {(
                          isOriginal
                            ? dispute.originalProofUrl
                            : dispute.newProofUrl
                        ) ? (
                          <a
                            href={
                              isOriginal
                                ? dispute.originalProofUrl
                                : dispute.newProofUrl
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline inline-flex items-center gap-1"
                          >
                            View Document <FiExternalLink className="text-xs" />
                          </a>
                        ) : (
                          <span className="text-amber-600">Not uploaded</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Deadline</p>
                      <p className="font-medium text-gray-900">
                        {formatDate(dispute.deadline)}
                      </p>
                    </div>
                  </div>

                  {/* Resolution */}
                  {dispute.resolution && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-sm text-gray-500">Resolution</p>
                      <p className="font-medium text-gray-900">
                        {RESOLUTION_LABELS[dispute.resolution] ||
                          dispute.resolution}
                      </p>
                      {dispute.adminNotes && (
                        <p className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">Admin Notes:</span>{' '}
                          {dispute.adminNotes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Upload Button */}
                  {showUploadButton && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <FiAlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm text-amber-800 font-medium">
                              Action Required
                            </p>
                            <p className="text-sm text-amber-700 mt-1">
                              Please upload proof of ownership to support your
                              claim. If you don't respond by the deadline, the
                              dispute will be resolved in favor of the other
                              party.
                            </p>
                            <Button
                              onClick={() => handleUploadProof(dispute)}
                              className="mt-3"
                              size="sm"
                            >
                              <FiUpload className="mr-2" />
                              Upload Proof of Ownership
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      <ProofUploadModal
        isOpen={uploadModalOpen}
        onClose={() => {
          setUploadModalOpen(false);
          setSelectedDispute(null);
        }}
        onUploadComplete={handleProofUploadComplete}
        disputeId={selectedDispute?.disputeId}
      />
    </div>
  );
};

export default MyDisputes;
