import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMutation } from '@tanstack/react-query';
import { getAdminUsers, updateAdminUser } from '../api/admin';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import { formatPhoneDisplay } from '../utils/format';

const ITEMS_PER_PAGE = 10;

function getUserTypeLabel(type) {
  if (!type) return '';
  const map = {
    admin: 'Admin',
    submitter: 'Submitter',
    validator: 'Validator',
    realtor: 'Realtor',
    wholesaler: 'Wholesaler',
    birddogger: 'Bird Dogger',
    team_member: 'Team Member',
    client: 'Client',
    real_estate_professional: 'Real Estate Professional',
  };
  return (
    map[type] || type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')
  );
}

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
        ‹
      </button>
      {getPages().map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="px-2 py-1 text-sm text-text-secondary">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`px-3 py-1 rounded text-sm border transition-colors ${p === currentPage
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
        ›
      </button>
    </div>
  );
};

const DeactivatedUsers = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    search: '',
    role: 'All',
    priority: 'All',
  });

  useEffect(() => { setCurrentPage(1); }, [filters]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const res = await getAdminUsers();
        setUsers(res.data);
      } catch (err) {
        console.error('Failed to fetch users:', err);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [isAuthenticated, user]);

  const reactivateUserMutation = useMutation({
    mutationFn: ({ email, updates }) => updateAdminUser(email, updates),
    onSuccess: (_res, { email, updates }) => {
      setUsers((prev) =>
        prev.map((u) => (u.email === email ? { ...u, ...updates } : u))
      );
    },
  });

  const handleRowClick = (u) => {
    const encryptedEmail = btoa(u.email);
    navigate(`/admin/user/${encryptedEmail}`);
  };

  // Filter only deactivated users
  const deactivatedUsers = users.filter((u) => u.isActive === false);

  const filteredUsers = deactivatedUsers.filter((u) => {
    const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
    if (filters.search && !fullName.includes(filters.search.toLowerCase())) return false;
    if (filters.role !== 'All' && u.role !== filters.role) return false;
    if (filters.priority === 'priority' && !u.priorityFirstAccess) return false;
    if (filters.priority === 'nonpriority' && u.priorityFirstAccess) return false;
    return true;
  });

  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back button */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors w-fit"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>
      </div>

      <h1 className="text-3xl font-bold text-text-primary mb-8">
        Deactivated User Accounts
      </h1>

      {/* Filters */}
      <div className="bg-surface border border-border-subtle rounded-xl shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            placeholder="Search users by full name..."
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          />
          <Select
            value={filters.role}
            onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}
            showPlaceholder={false}
            options={[
              { value: 'All', label: 'All Roles' },
              { value: 'admin', label: 'Admin' },
              { value: 'team_member', label: 'Team Member' },
              { value: 'submitter', label: 'Submitter' },
              { value: 'client', label: 'Client' },
            ]}
          />
          <Select
            value={filters.priority}
            onChange={(e) => setFilters((prev) => ({ ...prev, priority: e.target.value }))}
            showPlaceholder={false}
            options={[
              { value: 'All', label: 'All Users' },
              { value: 'priority', label: 'Premium Access Only' },
              { value: 'nonpriority', label: 'Non-Premium Only' },
            ]}
          />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            Showing {filteredUsers.length === 0 ? 0 : Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredUsers.length)}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length} deactivated users
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFilters({ search: '', role: 'All', priority: 'All' })}
          >
            Reset Filters
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-surface border border-border-subtle rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[180px]">Full Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[200px]">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[140px]">Phone</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[120px]">Role</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[110px]">Premium</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[120px]">Join Date</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-text-secondary uppercase min-w-[160px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loadingUsers ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <svg className="animate-spin h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="#E5EBF4" strokeWidth="3" />
                        <path fill="#1E7AC0" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
                      </svg>
                      <span className="text-sm font-medium" style={{ color: '#475569' }}>Loading deactivated users…</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-text-secondary">No deactivated users found</td>
                </tr>
              ) : (
                paginatedUsers.map((u) => (
                  <tr key={u.email} className="hover:bg-app cursor-pointer" onClick={() => handleRowClick(u)}>
                    <td className="px-6 py-3 font-medium text-text-primary">{u.firstName} {u.lastName}</td>
                    <td className="px-4 py-3 text-sm text-text-primary">{u.email}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {u.phone ? formatPhoneDisplay(u.phone) : '—'}
                    </td>
                    <td className="px-3 py-3 text-sm capitalize">{u.role.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-3">
                      {u.priorityFirstAccess && (
                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          Premium
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-text-secondary">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          reactivateUserMutation.mutate({ email: u.email, updates: { isActive: true } });
                        }}
                      >
                        Reactivate
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalItems={filteredUsers.length}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
};

export default DeactivatedUsers;
