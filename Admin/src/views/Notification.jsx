import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { notificationsAPI } from '../api/notifications';
import globalVariable from '../utils/globalVariable';
import Loader from '../components/Loader';

const ALLOWED_NOTIFICATION_EMAILS = [
  'developertesting@gmail.com',
  'raviwebspin@gmail.com',
  'lance@collegefundingsecrets.com',
];

const ITEMS_PER_PAGE = 10;

const NOTIFICATION_TYPE_LABELS = {
  new_registration: 'New Registration',
};

const getTypeLabel = (type) =>
  NOTIFICATION_TYPE_LABELS[type] || type?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Notification';

const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const timeAgo = (iso) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
};

/* ---------- Pagination ---------- */
const Pagination = ({ currentPage, totalItems, onPageChange }) => {
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  if (totalPages <= 1) return null;

  const getPages = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="px-6 py-4 bg-surface border-t border-border-subtle flex items-center justify-center gap-1">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1 rounded text-sm border border-border-subtle disabled:opacity-40 hover:bg-app transition-colors"
      >
        &#8249;
      </button>
      {getPages().map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="px-2 py-1 text-sm text-text-secondary">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`px-3 py-1 rounded text-sm border transition-colors ${
              p === currentPage
                ? 'bg-primary text-white border-primary'
                : 'border-border-subtle hover:bg-app text-text-primary'
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1 rounded text-sm border border-border-subtle disabled:opacity-40 hover:bg-app transition-colors"
      >
        &#8250;
      </button>
    </div>
  );
};

/* ---------- Notification Page ---------- */
const Notification = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all'); // all | unread | read
  const [confirmDelete, setConfirmDelete] = useState(null);

  const userEmail = (user?.email || '').toLowerCase();
  const isSuperAdmin = globalVariable.super_admin.includes(userEmail);
  const isTeamMember = (user?.role || '').toLowerCase() === 'team_member';
  const hasAccess = isSuperAdmin || isTeamMember;

  useEffect(() => {
    if (!hasAccess) {
      navigate('/', { replace: true });
    }
  }, [hasAccess, navigate]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsAPI.getAll().then((res) => res.data.notifications),
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => notificationsAPI.markAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => notificationsAPI.delete(id),
    onSuccess: () => {
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const rawNotifications = data || [];

  // Visibility rule:
  const notifications = isSuperAdmin ? rawNotifications : rawNotifications.filter((n) => (n.admin_email || '').toLowerCase() === userEmail  );
 
  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.notify;
    if (filter === 'read') return n.notify;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  const handleNotificationClick = (n) => {
    navigate(`/notifications/${n.id}`);
  };

  const unreadCount = notifications.filter((n) => !n.notify).length;

  if (isLoading) return <Loader fullScreen />;

  return (
    <div className="p-6 mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">Notifications</h1>
          <p className="text-sm text-text-secondary mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up'}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-app rounded-lg p-1 w-fit">
        {[
          { key: 'all', label: 'All', count: notifications.length },
          { key: 'unread', label: 'Unread', count: unreadCount },
          { key: 'read', label: 'Read', count: notifications.length - unreadCount },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-surface text-primary shadow-sm'
                : 'text-text-secondary hover:text-primary'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 text-xs opacity-70">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Error state */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-red-700 text-sm">
          Failed to load notifications: {error?.message || 'Unknown error'}
        </div>
      )}

      {/* Notification list */}
      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-12 h-12 mx-auto mb-3 text-text-secondary/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <p className="text-text-secondary text-sm">No notifications found</p>
          </div>
        ) : (
          <>
            {paginated.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`flex items-start gap-4 px-5 py-4 border-b border-border-subtle last:border-b-0 transition-colors cursor-pointer hover:bg-accent/[0.06] ${
                  !n.notify ? 'bg-accent/[0.03]' : ''
                }`}
              >
                {/* Unread indicator */}
                <div className="pt-1.5 flex-shrink-0">
                  {!n.notify ? (
                    <span className="block w-2.5 h-2.5 rounded-full bg-accent" />
                  ) : (
                    <span className="block w-2.5 h-2.5 rounded-full bg-transparent" />
                  )}
                </div>

                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                    !n.notify ? 'bg-accent/10 text-accent' : 'bg-gray-100 text-text-secondary'
                  }`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-sm ${!n.notify ? 'font-semibold text-primary' : 'text-text-primary'}`}>
                        {getTypeLabel(n.notification_type)}
                      </p>
                      {n.action_performer_id && (
                        <p className="text-xs text-text-secondary mt-0.5 truncate">
                          {n.action_performer_id}
                        </p>
                      )}
                      {n.admin_email && (
                        <p className="text-xs text-text-secondary mt-0.5">
                          To: {n.admin_email}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-text-secondary whitespace-nowrap flex-shrink-0">
                      {timeAgo(n.created_at)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 mt-2">
                    {!n.notify && (
                      <button
                        onClick={(e) => { e.stopPropagation(); markReadMutation.mutate(n.id); }}
                        disabled={markReadMutation.isPending}
                        className="text-xs text-accent hover:text-accent-light font-medium transition-colors"
                      >
                        Mark as read
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(n.id); }}
                      className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <Pagination currentPage={page} totalItems={filtered.length} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-30">
          <div className="bg-surface rounded-lg shadow-lg p-6 w-80">
            <div className="mb-4 text-lg font-semibold text-primary">
              Delete this notification?
            </div>
            <p className="text-sm text-text-secondary mb-4">Are you want to delete this Notification?</p>
            <div className="flex justify-end space-x-2">
              <button
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-red-500 hover:bg-red-600 text-white text-sm"
                onClick={() => deleteMutation.mutate(confirmDelete)}
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

export default Notification;
