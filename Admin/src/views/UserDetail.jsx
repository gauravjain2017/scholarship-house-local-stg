import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAdminUser } from '../api/admin';
import { formatPhoneDisplay } from '../utils/format';

function getUserTypeLabel(type) {
  if (!type) return '—';
  const map = {
    admin: 'Admin',
    submitter: 'Submitter',
    // validator: 'Validator',
    // realtor: 'Realtor',
    // wholesaler: 'Wholesaler',
    // birddogger: 'Bird Dogger',
    team_member: 'Team Member',
    client: 'Client',
    // real_estate_professional: 'Real Estate Professional',
  };
  return map[type] || type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
}

const InfoRow = ({ label, value }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">{label}</span>
    <span className="text-sm text-text-primary">{value || '—'}</span>
  </div>
);

const AccessBadge = ({ granted, label }) => (
  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm bg-surface border-border-subtle text-text-secondary`}>
    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${granted ? 'bg-green-500' : 'bg-gray-300'}`} />
    {label}
  </div>
);

const UserDetail = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await getAdminUser(token);
        setUserData(res.data);
      } catch (err) {
        setError('Failed to load user data.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [token]);

  const initials = (() => {
    if (!userData?.Name) return '';
    const parts = userData.Name.trim().split(/\s+/);
    return parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : parts[0][0].toUpperCase();
  })();

  const isActive = userData?.isActive !== false;

  console.log('userData : ',userData)

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back button */}
      <button
        onClick={() => navigate('/admin/users')}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors mb-6"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Users
      </button>

      {/* Loading */}
      {loading && (
        <div className="bg-surface border border-border-subtle rounded-xl shadow-sm p-10 text-center text-text-secondary">
          Loading user...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-surface border border-border-subtle rounded-xl shadow-sm p-10 text-center text-text-secondary">
          {error}
        </div>
      )}

      {/* User data */}
      {userData && (
        <div className="space-y-4">

          {/* Profile header card */}
          <div className="bg-surface border border-border-subtle rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-5">
              {/* Avatar */}
              <div className="w-16 h-16 rounded-full bg-accent/15 text-accent flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-bold text-accent">{initials}</span>
              </div>

              {/* Name + badges */}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-text-primary truncate">
                  {userData.Name}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    {getUserTypeLabel(userData.UserType || userData.role)}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                  {userData.priorityFirstAccess && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      Premium Access
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Contact info */}
            <div className="bg-surface border border-border-subtle rounded-xl shadow-sm p-6">
              <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Contact Information
              </h2>
              <div className="space-y-4">
                <InfoRow label="Email" value={userData.Email || userData.email} />
                <InfoRow
                  label="Phone"
                  value={
                    (userData.Phone || userData.phone)
                      ? formatPhoneDisplay(userData.Phone || userData.phone)
                      : null
                  }
                />
              </div>
            </div>

            {/* Account info */}
            <div className="bg-surface border border-border-subtle rounded-xl shadow-sm p-6">
              <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Account Details
              </h2>
              <div className="space-y-4">
                <InfoRow label="Role" value={getUserTypeLabel(userData.UserType || userData.role)} />
                <InfoRow label="Status" value={isActive ? 'Active' : 'Inactive'} />
                <InfoRow
                  label="Member Since"
                  value={userData.createdAt ? new Date(userData.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null}
                />
              </div>
            </div>
          </div>

          {/* Property access permissions */}
          <div className="bg-surface border border-border-subtle rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Property Access Permissions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <AccessBadge granted={!!userData.Access.priority} label="Premium Properties" />
              <AccessBadge granted={!!userData.Access.partnership} label="Partnership Properties" />
              <AccessBadge granted={!!userData.Access.turnkey} label="Turnkey Properties" />
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default UserDetail;
