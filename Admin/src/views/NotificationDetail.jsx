import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { notificationsAPI } from '../api/notifications';
import { dealsAPI } from '../api/deals';
import Loader from '../components/Loader';

const ALLOWED_NOTIFICATION_EMAILS = [
  'developertesting@gmail.com',
  'raviwebspin@gmail.com',
  'lance@collegefundingsecrets.com',
];

const NOTIFICATION_TYPE_LABELS = {
  new_registration: 'New Registration',
};

const getTypeLabel = (type) =>
  NOTIFICATION_TYPE_LABELS[type] || type?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Notification';

const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const NotificationDetail = () => {

  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const passedNotification = location.state?.notification;

  const hasAccess = ALLOWED_NOTIFICATION_EMAILS.includes(user?.email?.toLowerCase());

  useEffect(() => {
    if (!hasAccess) {
      navigate('/', { replace: true });
    }
  }, [hasAccess, navigate]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['notification', id],
    queryFn: () => notificationsAPI.getById(id).then((res) => res.data.notification),
    enabled: !!id && !passedNotification,
    initialData: passedNotification || undefined,
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId) => notificationsAPI.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification', id] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (notificationId) => notificationsAPI.delete(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      navigate('/notifications', { replace: true });
    },
  });

  // Fetch property details when notification references a deal
  const isPropertyNotification =
    data?.notification_type === 'new_property' ||
    data?.notification_type === 'deal_expired';
  const { data: property, isLoading: propertyLoading } = useQuery({
    queryKey: ['deal', data?.type_id],
    queryFn: () => dealsAPI.getDealById(data.type_id),
    enabled: !!data?.type_id && isPropertyNotification,
  });


  // Auto mark as read when notification loads and is unread
  useEffect(() => {
    if (data && !data.notify) {
      markReadMutation.mutate(data.id);
    }
  }, [data?.id, data?.notify]);

  if (isLoading) return <Loader fullScreen />;

  if (isError) {
    return (
      <div className="p-6 mx-auto ">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          Failed to load notification: {error?.message || 'Unknown error'}
        </div>
        <button
          onClick={() => navigate('/notifications')}
          className="mt-4 text-sm text-accent hover:text-accent-light font-medium"
        >
          Back to Notifications
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 mx-auto max-w-2xl">
        <p className="text-text-secondary">Notification not found.</p>
        <button
          onClick={() => navigate('/notifications')}
          className="mt-4 text-sm text-accent hover:text-accent-light font-medium"
        >
          Back to Notifications
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/notifications')}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary font-medium mb-6 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Notifications
      </button>

      {/* Notification card */}
      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border-subtle">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-accent flex-shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-primary">
                {getTypeLabel(data.notification_type)}
              </h1>
              <p className="text-sm text-text-secondary mt-0.5">
                {formatDate(data.created_at)}
              </p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              data.notify
                ? 'bg-green-50 text-green-600'
                : 'bg-accent/10 text-accent'
            }`}>
              {data.notify ? 'Read' : 'Unread'}
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.action_performer_id && (
              <div className="bg-app rounded-lg p-4">
                <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">From</p>
                <p className="text-sm text-text-primary font-medium">{data.action_performer_id}</p>
              </div>
            )}
            {data.admin_email && (
              <div className="bg-app rounded-lg p-4">
                <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">To</p>
                <p className="text-sm text-text-primary font-medium">{data.admin_email}</p>
              </div>
            )}
            {data.type_id && (
              <div className="bg-app rounded-lg p-4">
                <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">Reference</p>
                <p className="text-sm text-text-primary font-medium">{data.type_id}</p>
              </div>
            )}
            <div className="bg-app rounded-lg p-4">
              <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">Type</p>
              <p className="text-sm text-text-primary font-medium">{getTypeLabel(data.notification_type)}</p>
            </div>
          </div>
        </div>

        {/* Property Details (for new_property notifications) */}
        {isPropertyNotification && data.type_id && (
          <div className="px-6 py-5 border-t border-border-subtle">
            <h2 className="text-sm font-semibold text-primary uppercase tracking-wide mb-4">Property Details</h2>
            {propertyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader />
              </div>
            ) : property ? (
              <div className="space-y-4">
                {/* Title & Status */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-primary">{property.title || 'Untitled Property'}</h3>
                    <button
                      type="button"
                      onClick={() => navigate(`/deal-details/${data.type_id}`)}
                      className="inline-flex items-center gap-1 text-sm text-accent hover:text-accent-light font-medium"
                    >
                      View Property
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 17L17 7" />
                        <path d="M7 7h10v10" />
                      </svg>
                    </button>
                  </div>
                  {property.status && (
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      property.status === 'published' ? 'bg-green-50 text-green-600' :
                      property.status === 'approved' ? 'bg-blue-50 text-blue-600' :
                      property.status === 'rejected' ? 'bg-red-50 text-red-600' :
                      property.status === 'sold' ? 'bg-purple-50 text-purple-600' :
                      'bg-yellow-50 text-yellow-600'
                    }`}>
                      {property.status.charAt(0).toUpperCase() + property.status.slice(1)}
                    </span>
                  )}
                </div>

                {/* Address */}
                {(property.streetAddress || property.city) && (
                  <div className="bg-app rounded-lg p-4">
                    <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">Address</p>
                    <p className="text-sm text-text-primary font-medium">
                      {[property.streetAddress, property.addressLine2, property.city, property.stateRegion, property.postalCode]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                )}

                {/* Key Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {property.price && (
                    <div className="bg-app rounded-lg p-4">
                      <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">Price</p>
                      <p className="text-sm text-text-primary font-semibold">
                        ${Number(property.price).toLocaleString('en-US')}
                      </p>
                    </div>
                  )}
                  {property.bedrooms && (
                    <div className="bg-app rounded-lg p-4">
                      <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">Bedrooms</p>
                      <p className="text-sm text-text-primary font-medium">{property.bedrooms}</p>
                    </div>
                  )}
                  {property.bathrooms && (
                    <div className="bg-app rounded-lg p-4">
                      <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">Bathrooms</p>
                      <p className="text-sm text-text-primary font-medium">{property.bathrooms}</p>
                    </div>
                  )}
                  {property.squareFootage && (
                    <div className="bg-app rounded-lg p-4">
                      <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">Sq Ft</p>
                      <p className="text-sm text-text-primary font-medium">{Number(property.squareFootage).toLocaleString('en-US')}</p>
                    </div>
                  )}
                </div>

                {/* Additional Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {property.category && (
                    <div className="bg-app rounded-lg p-4">
                      <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">Category</p>
                      <p className="text-sm text-text-primary font-medium">
                        {property.category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </p>
                    </div>
                  )}
                  {property.yearBuilt && (
                    <div className="bg-app rounded-lg p-4">
                      <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">Year Built</p>
                      <p className="text-sm text-text-primary font-medium">{property.yearBuilt}</p>
                    </div>
                  )}
                  {property.financingType && (
                    <div className="bg-app rounded-lg p-4">
                      <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">Financing</p>
                      <p className="text-sm text-text-primary font-medium">
                        {property.financingType.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </p>
                    </div>
                  )}
                  {property.downPayment && (
                    <div className="bg-app rounded-lg p-4">
                      <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">Down Payment</p>
                      <p className="text-sm text-text-primary font-medium">${Number(property.downPayment).toLocaleString('en-US')}</p>
                    </div>
                  )}
                  {property.emd && (
                    <div className="bg-app rounded-lg p-4">
                      <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">EMD</p>
                      <p className="text-sm text-text-primary font-medium">${Number(property.emd).toLocaleString('en-US')}</p>
                    </div>
                  )}
                  {property.expectedCloseDate && (
                    <div className="bg-app rounded-lg p-4">
                      <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">Expected Close</p>
                      <p className="text-sm text-text-primary font-medium">
                        {new Date(property.expectedCloseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                </div>

                {/* STR Data */}
                {property.strAnnualRevenue && (
                  <div>
                    <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-2 mt-2">Short-Term Rental Data</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {property.strAnnualRevenue && (
                        <div className="bg-app rounded-lg p-4">
                          <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">Annual Revenue</p>
                          <p className="text-sm text-text-primary font-medium">${Number(property.strAnnualRevenue).toLocaleString('en-US')}</p>
                        </div>
                      )}
                      {property.strAvgDailyRate && (
                        <div className="bg-app rounded-lg p-4">
                          <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">Avg Daily Rate</p>
                          <p className="text-sm text-text-primary font-medium">${Number(property.strAvgDailyRate).toLocaleString('en-US')}</p>
                        </div>
                      )}
                      {property.strOccupancyRate && (
                        <div className="bg-app rounded-lg p-4">
                          <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">Occupancy Rate</p>
                          <p className="text-sm text-text-primary font-medium">{property.strOccupancyRate}%</p>
                        </div>
                      )}
                      {property.strNetOperatingIncome && (
                        <div className="bg-app rounded-lg p-4">
                          <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">Net Operating Income</p>
                          <p className="text-sm text-text-primary font-medium">${Number(property.strNetOperatingIncome).toLocaleString('en-US')}</p>
                        </div>
                      )}
                      {property.strMarketScore && (
                        <div className="bg-app rounded-lg p-4">
                          <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">Market Score</p>
                          <p className="text-sm text-text-primary font-medium">{property.strMarketScore}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Submitter Info */}
                {(property.submitterName || property.submitterEmail) && (
                  <div>
                    <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-2 mt-2">Submitted By</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {property.submitterName && (
                        <div className="bg-app rounded-lg p-4">
                          <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">Name</p>
                          <p className="text-sm text-text-primary font-medium">{property.submitterName}</p>
                        </div>
                      )}
                      {property.submitterEmail && (
                        <div className="bg-app rounded-lg p-4">
                          <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">Email</p>
                          <p className="text-sm text-text-primary font-medium">{property.submitterEmail}</p>
                        </div>
                      )}
                      {property.submitterPhone && (
                        <div className="bg-app rounded-lg p-4">
                          <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">Phone</p>
                          <p className="text-sm text-text-primary font-medium">{property.submitterPhone}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Description */}
                {property.description && (
                  <div className="bg-app rounded-lg p-4">
                    <p className="text-xs text-text-secondary font-medium uppercase tracking-wide mb-1">Description</p>
                    <p className="text-sm text-text-primary">{property.description}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-text-secondary py-4">Property details could not be loaded.</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border-subtle bg-app/50">
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-4 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 font-medium transition-colors"
          >
            Delete Notification
          </button>
          {!data.notify && (
            <button
              onClick={() => markReadMutation.mutate(data.id)}
              disabled={markReadMutation.isPending}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              Mark as Read
            </button>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
          <div className="bg-surface rounded-lg shadow-lg p-6 w-80">
            <div className="mb-4 text-lg font-semibold text-primary">
              Delete this notification?
            </div>
            <p className="text-sm text-text-secondary mb-4">Are you sure you want to delete this notification?</p>
            <div className="flex justify-end space-x-2">
              <button
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-red-500 hover:bg-red-600 text-white text-sm"
                onClick={() => deleteMutation.mutate(data.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDetail;
