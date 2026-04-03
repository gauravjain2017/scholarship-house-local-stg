import { useState } from 'react';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMutation } from '@tanstack/react-query';
import { getAdminUsers, updateAdminUser, getAdminUser } from '../api/admin';

import { validateDealForm } from '../utils/validateDealForm';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import Modal from '../components/Modal';
import csvParser from '../api/csvParser';
import { authAPI } from '../api/auth';
import { passwordResetAPI } from '../api/passwordReset';
import {
  formatPhoneDisplay,
} from '../utils/format';

const ITEMS_PER_PAGE = 10;

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

// Utility to map userType to label
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

const UserManagement = () => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryType = new URLSearchParams(location.search).get('type');
  const isPendingView = queryType === 'pending';
  const isActiveView = queryType === 'active';

  const [editingUser, setEditingUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [confirmAction, setConfirmAction] = useState(null);
  const [userPage, setUserPage] = useState(1);

  const [userFilters, setUserFilters] = useState({
    search: '',
    role: 'All',
    priority: 'All',
  });

  const [loadingUsers, setLoadingUsers] = useState(true);

  // Pending registrations state
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [showApproveUsers, setShowApproveUsers] = useState(false);

  // Bulk CSV registration state
  const [csvUsers, setCsvUsers] = useState([]);
  const [csvError, setCsvError] = useState('');
  const [csvFileName, setCsvFileName] = useState('');
  const [csvRegistering, setCsvRegistering] = useState(false);
  const [csvResults, setCsvResults] = useState([]);

  // Reset to page 1 when filters change
  useEffect(() => { setUserPage(1); }, [userFilters, isActiveView]);

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

  useEffect(() => {
    const loadPending = async () => {
      setLoadingPending(true);
      try {
        const data = await authAPI.getPendingRegistrations();
        setPendingUsers(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingPending(false);
      }
    };

    loadPending();
  }, []);

  const pendingCount = pendingUsers.length;

  useEffect(() => {
    if (pendingCount > 0) {
      setShowApproveUsers(false);
    }
  }, [pendingCount]);

  // Mutations
  const deactivateUserMutation = useMutation({
    mutationFn: ({ email, updates }) => updateAdminUser(email, updates),
    onSuccess: (_res, { email, updates }) => {
      setUsers((prev) =>
        prev.map((u) => (u.email === email ? { ...u, ...updates } : u))
      );
    },
  });

  const handleApproveUser = (user) => {
    setConfirmAction({ type: 'approve', user });
  };

  const handleRejectUser = (user) => {
    setConfirmAction({ type: 'reject', user });
  };

  const confirmUserAction = async () => {
    const { type, user } = confirmAction;
    try {
      if (type === 'approve') {
        await authAPI.approveRegistration(user.email);
      } else {
        await authAPI.rejectRegistration(user.email);
      }
      setPendingUsers((prev) => prev.filter((u) => u.email !== user.email));
      setConfirmAction(null);
    } catch (err) {
      console.error(`${type} failed`, err);
      alert(`Failed to ${type} user`);
    }
  };

  // CSV Upload
  const handleCsvUpload = (e) => {
    setCsvError('');
    setCsvUsers([]);
    const file = e.target.files[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const users = csvParser.parseUserCSV(event.target.result);
        setCsvUsers(users);
      } catch (err) {
        setCsvError('Failed to parse CSV: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleRegisterUsers = async () => {
    setCsvRegistering(true);
    setCsvResults([]);
    try {
      const payload = {
        submitters: csvUsers.map((u) => ({
          Name: u.name,
          Email: u.email,
          Phone: u.phone,
          UserType: u.role,
          Access: { priority: !!u.priority },
        })),
      };

      const response = await fetch('/api/submitters/bulk-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      setCsvResults(data.results || []);
    } catch (err) {
      setCsvResults([{ email: '', status: 'error', message: err.message }]);
    } finally {
      setCsvRegistering(false);
    }
  };

  const handleRowClick = (u) => {
    const encryptedEmail = btoa(u.email);
    navigate(`/admin/user/${encryptedEmail}`);
  };

  const saveUserEdits = async () => {
    if (!editingUser) return;

    try {
      const payload = {
        UserType: editingUser.role,
        Access: {
          priority: !!editingUser.Access?.priority,
          partnership: !!editingUser.Access?.partnership,
          turnkey: !!editingUser.Access?.turnkey,
        },
      };

      await updateAdminUser(editingUser.email, payload);
      const res = await getAdminUsers();
      setUsers(res.data);
      setEditingUser(null);
    } catch (err) {
      console.error('Failed to save user edits:', err);
      if (err.response?.status === 403 && err.response?.data?.error?.includes('admin role')) {
        alert('Permission Denied: Only administrators can assign the admin role.');
      } else {
        alert('Failed to update user: ' + (err.response?.data?.error || err.message || 'Unknown error'));
      }
    }
  };

  // Filtering
  const filteredUsers = users.filter((u) => {
    if (isActiveView && u.isActive === false) return false;
    const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
    if (userFilters.search && !fullName.includes(userFilters.search.toLowerCase())) return false;
    if (userFilters.role !== 'All' && u.role !== userFilters.role) return false;
    if (userFilters.priority === 'priority' && !u.priorityFirstAccess) return false;
    if (userFilters.priority === 'nonpriority' && u.priorityFirstAccess) return false;
    return true;
  });

  const paginatedUsers = filteredUsers.slice(
    (userPage - 1) * ITEMS_PER_PAGE,
    userPage * ITEMS_PER_PAGE
  );

  if (isPendingView) {
    return (
      <div className="container mx-auto px-4 py-8">
        {/* Pending User Approvals — standalone view */}
        <div className="bg-surface border border-border-subtle rounded-xl shadow-sm">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex flex-col gap-2">
              <button onClick={() => navigate('/admin/users')} className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors w-fit">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-text-primary">Pending User Registrations</h2>
                {pendingCount > 0 && (
                  <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full bg-accent text-white">
                    {pendingCount}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="px-6 pb-6">
            {loadingPending ? (
              <div className="py-8 text-text-secondary">Loading pending registrations…</div>
            ) : pendingUsers.length === 0 ? (
              <div className="py-6 text-text-secondary">No pending registration requests.</div>
            ) : (
              <div className="overflow-x-auto">
                <div className="bg-surface border border-border-subtle rounded-xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-surface border-b">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[180px]">Full Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[220px]">Email</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[140px]">Phone</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[160px]">Requested Role</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[120px]">Submitted</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase min-w-[160px]">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingUsers.map((u) => (
                          <tr key={u.email} className="border-b last:border-b-0">
                            <td className="px-6 py-4 text-sm text-text-primary">{u.firstName} {u.lastName}</td>
                            <td className="px-4 py-4 text-sm text-text-primary">{u.email}</td>
                            <td className="px-4 py-4 text-sm text-text-primary">
                              {u.phone ? formatPhoneDisplay(u.phone) : '—'}
                            </td>
                            <td className="px-4 py-4 text-sm text-text-primary">
                              {getUserTypeLabel(u.requestedUserType)}
                            </td>
                            <td className="px-4 py-4 text-sm text-text-secondary">
                              {new Date(u.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-4 text-right space-x-2">
                              <Button size="sm" variant="success" onClick={() => handleApproveUser(u)}>Approve</Button>
                              <Button size="sm" variant="danger" onClick={() => handleRejectUser(u)}>Reject</Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Confirm Approve/Reject Modal */}
        <Modal
          isOpen={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          title={confirmAction?.type === 'approve' ? 'Approve Registration' : 'Reject Registration'}
          size="sm"
        >
          {confirmAction && (
            <div className="space-y-4">
              <p className="text-text-primary">
                Are you sure you want to <strong>{confirmAction.type}</strong> this registration?
              </p>
              <div className="bg-surface border border-border-subtle p-3 rounded text-sm">
                <div><strong>Name:</strong> {confirmAction.user.firstName} {confirmAction.user.lastName}</div>
                <div><strong>Email:</strong> {confirmAction.user.email}</div>
                <div><strong>Requested Role:</strong> {getUserTypeLabel(confirmAction.user.requestedUserType)}</div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => setConfirmAction(null)}
                  className="px-4 py-2 rounded border border-border-subtle text-text-primary hover:bg-app"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmUserAction}
                  className={`px-4 py-2 rounded ${confirmAction.type === 'approve'
                    ? 'bg-primary text-white hover:bg-primary-dark'
                    : 'border border-primary text-primary hover:bg-app'
                    }`}
                >
                  {confirmAction.type === 'approve' ? 'Approve User' : 'Reject User'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">

      {/* ===================== */}
      {/* Bulk User Registration */}
      {/* ===================== */}
      <div className="bg-surface border border-border-subtle rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-xl font-bold text-text-primary mb-4">
          Bulk User Registration (CSV File Upload)
        </h2>
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
          <input
            type="file"
            accept=".csv"
            onChange={handleCsvUpload}
            className="block"
          />
          {csvFileName && (
            <span className="text-sm text-text-secondary">{csvFileName}</span>
          )}
        </div>
        {csvError && <div className="text-text-secondary mb-2">{csvError}</div>}
        {csvUsers.length > 0 && (
          <div className="overflow-x-auto mt-2">
            <table className="min-w-full border text-sm">
              <thead className="bg-surface border-b">
                <tr>
                  <th className="px-2 py-1 border">Name</th>
                  <th className="px-2 py-1 border">Email</th>
                  <th className="px-2 py-1 border">Phone</th>
                  <th className="px-2 py-1 border">Role</th>
                  <th className="px-2 py-1 border">Premium</th>
                </tr>
              </thead>
              <tbody>
                {csvUsers.map((user, idx) => (
                  <tr key={idx}>
                    <td className="px-2 py-1 border">{user.name}</td>
                    <td className="px-2 py-1 border">{user.email}</td>
                    <td className="px-2 py-1 border">
                      {user.phone ? formatPhoneDisplay(user.phone) : '—'}
                    </td>
                    <td className="px-2 py-1 border">{user.role}</td>
                    <td className="px-2 py-1 border">
                      {user.access?.priority ? 'Yes' : 'No'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center gap-4 mt-4">
              <Button onClick={handleRegisterUsers} disabled={csvRegistering}>
                {csvRegistering ? 'Registering...' : 'Register Users'}
              </Button>
              {csvResults.length > 0 && (
                <span className="text-sm text-text-primary">
                  Registration complete. See results below.
                </span>
              )}
            </div>
            {csvResults.length > 0 && (
              <div className="mt-4">
                <table className="min-w-full border text-xs">
                  <thead className="bg-surface border-b">
                    <tr>
                      <th className="px-2 py-1 border">Email</th>
                      <th className="px-2 py-1 border">Status</th>
                      <th className="px-2 py-1 border">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvResults.map((r, idx) => (
                      <tr key={idx}>
                        <td className="px-2 py-1 border">{r.email}</td>
                        <td className={`px-2 py-1 border ${r.status === 'success' ? 'text-text-primary' : 'text-text-secondary'}`}>
                          {r.status}
                        </td>
                        <td className="px-2 py-1 border">{r.message || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===================== */}
      {/* Pending User Approvals */}
      {/* ===================== */}
      <div className="bg-surface border border-border-subtle rounded-xl shadow-sm mb-6">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-text-primary">
              Pending User Registrations
            </h2>
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full bg-accent text-white">
                {pendingCount}
              </span>
            )}
          </div>
          <button
            onClick={() => navigate('/admin/users?type=pending')}
            className="text-sm text-accent hover:underline"
          >
            View
          </button>
        </div>
      </div>

      {/* Confirm Approve/Reject Modal */}
      <Modal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.type === 'approve' ? 'Approve Registration' : 'Reject Registration'}
        size="sm"
      >
        {confirmAction && (
          <div className="space-y-4">
            <p className="text-text-primary">
              Are you sure you want to <strong>{confirmAction.type}</strong> this registration?
            </p>
            <div className="bg-surface border border-border-subtle p-3 rounded text-sm">
              <div><strong>Name:</strong> {confirmAction.user.firstName} {confirmAction.user.lastName}</div>
              <div><strong>Email:</strong> {confirmAction.user.email}</div>
              <div><strong>Requested Role:</strong> {getUserTypeLabel(confirmAction.user.requestedUserType)}</div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded border border-border-subtle text-text-primary hover:bg-app"
              >
                Cancel
              </button>
              <button
                onClick={confirmUserAction}
                className={`px-4 py-2 rounded ${confirmAction.type === 'approve'
                  ? 'bg-primary text-white hover:bg-primary-dark'
                  : 'border border-primary text-primary hover:bg-app'
                  }`}
              >
                {confirmAction.type === 'approve' ? 'Approve User' : 'Reject User'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ===================== */}
      {/* User Management Dashboard */}
      {/* ===================== */}
      <h1 className="text-3xl font-bold text-text-primary mb-8">
        User Management Dashboard
      </h1>

      {/* Filters */}
      <div className="bg-surface border border-border-subtle rounded-xl shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            placeholder="Search users by full name..."
            value={userFilters.search}
            onChange={(e) => setUserFilters((prev) => ({ ...prev, search: e.target.value }))}
          />
          <Select
            value={userFilters.role}
            onChange={(e) => setUserFilters((prev) => ({ ...prev, role: e.target.value }))}
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
            value={userFilters.priority}
            onChange={(e) => setUserFilters((prev) => ({ ...prev, priority: e.target.value }))}
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
            Showing {Math.min((userPage - 1) * ITEMS_PER_PAGE + 1, filteredUsers.length)}–{Math.min(userPage * ITEMS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length} users
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setUserFilters({ search: '', role: 'All', priority: 'All' })}
          >
            Reset Filters
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-surface border border-border-subtle rounded-xl shadow-sm overflow-hidden mb-12">
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
                      <span className="text-sm font-medium" style={{ color: '#475569' }}>Loading users…</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-text-secondary">No users found</td>
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
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingUser({
                              ...u,
                              Access: {
                                priority: !!u.priorityFirstAccess,
                                partnership: !!u.partnershipAccess,
                                turnkey: !!u.turnkeyAccess,
                              },
                            });
                          }}
                        >
                          Edit
                        </Button>
                        {u.isActive === false ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); deactivateUserMutation.mutate({ email: u.email, updates: { isActive: true } }); }}
                          >
                            Reactivate
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={(e) => { e.stopPropagation(); deactivateUserMutation.mutate({ email: u.email, updates: { isActive: false } }); }}
                          >
                            Deactivate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={userPage}
          totalItems={filteredUsers.length}
          onPageChange={setUserPage}
        />
      </div>

      {/* Edit User Modal */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="Edit User"
        size="sm"
      >
        {editingUser && (
          <div className="space-y-6">
            {/* Identity (read-only) */}
            <div className="bg-surface border border-border-subtle rounded-lg p-3 text-sm">
              <div><span className="font-medium">Name:</span> {editingUser.firstName} {editingUser.lastName}</div>
              <div><span className="font-medium">Email:</span> {editingUser.email}</div>
              <div><span className="font-medium">Phone Number:</span> {editingUser.phone ? formatPhoneDisplay(editingUser.phone) : 'N/A'}</div>
            </div>

            {/* Role */}
            <Select
              label="User Role"
              value={editingUser.role}
              onChange={(e) => setEditingUser((prev) => ({ ...prev, role: e.target.value }))}
              options={[
                ...(user?.role === 'admin' ? [{ value: 'admin', label: 'Admin' }] : []),
                { value: 'team_member', label: 'Team Member' },
                { value: 'submitter', label: 'Submitter' },
                { value: 'client', label: 'Client' },
              ]}
            />

            {/* Property Access Permissions */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-700 mb-2">Property Type Access</div>

              {/* Premium Access */}
              <div className="bg-surface border border-border-subtle rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!editingUser.Access?.priority}
                    onChange={(e) =>
                      setEditingUser((prev) => ({
                        ...prev,
                        Access: { ...(prev.Access || {}), priority: e.target.checked },
                      }))
                    }
                    className="mt-1 w-5 h-5 accent-accent"
                  />
                  <div>
                    <div className="text-base font-semibold text-text-primary">View Premium Properties</div>
                    <div className="text-sm text-text-secondary">Grants access to view Premium property listings.</div>
                  </div>
                </label>
              </div>

              {/* Partnership Access */}
              <div className="bg-surface border border-border-subtle rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!editingUser.Access?.partnership}
                    onChange={(e) =>
                      setEditingUser((prev) => ({
                        ...prev,
                        Access: { ...(prev.Access || {}), partnership: e.target.checked },
                      }))
                    }
                    className="mt-1 w-5 h-5 accent-accent"
                  />
                  <div>
                    <div className="text-base font-semibold text-text-primary">View Partnership Properties</div>
                    <div className="text-sm text-text-secondary">Grants access to view Partnership property listings.</div>
                  </div>
                </label>
              </div>

              {/* Turnkey Access */}
              <div className="bg-surface border border-border-subtle rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!editingUser.Access?.turnkey}
                    onChange={(e) =>
                      setEditingUser((prev) => ({
                        ...prev,
                        Access: { ...(prev.Access || {}), turnkey: e.target.checked },
                      }))
                    }
                    className="mt-1 w-5 h-5 accent-accent"
                  />
                  <div>
                    <div className="text-base font-semibold text-text-primary">View Turnkey Properties</div>
                    <div className="text-sm text-text-secondary">Grants access to view Turnkey property listings.</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Password Reset */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Password Reset</div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={async () => {
                    if (!confirm(`Send password reset email to ${editingUser.email}?`)) return;
                    try {
                      await passwordResetAPI.adminTriggerPasswordReset(editingUser.email);
                      alert('Password reset email sent successfully!');
                    } catch (err) {
                      alert('Failed to send reset email: ' + (err.response?.data?.error || err.message));
                    }
                  }}
                >
                  Send Reset Email
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={async () => {
                    if (!confirm(`Set a temporary password for ${editingUser.email}?`)) return;
                    try {
                      await passwordResetAPI.adminSetTemporaryPassword(editingUser.email);
                      alert('Temporary password set and emailed to user!');
                    } catch (err) {
                      alert('Failed to set temporary password: ' + (err.response?.data?.error || err.message));
                    }
                  }}
                >
                  Set Temp Password
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                &quot;Send Reset Email&quot; sends a secure link. &quot;Set Temp Password&quot; generates a temporary password.
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setEditingUser(null)}>Cancel</Button>
              <Button variant="primary" onClick={saveUserEdits}>Save Changes</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UserManagement;
