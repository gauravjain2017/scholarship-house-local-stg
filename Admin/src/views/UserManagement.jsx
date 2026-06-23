/**
 * ================================================================================
 *  UserManagement.jsx
 * ================================================================================
 *  Full-featured admin User Management dashboard.
 *
 *  Features implemented:
 *    1.  Add / Edit / Delete / Activate / Deactivate user flows.
 *    2.  A settings (gear) icon in the Action column that toggles an
 *        action menu (Edit, Activate/Deactivate, Delete, Reset password).
 *    3.  Redesigned layout — status tabs, stat cards, modern table UI.
 *    4.  Add and Edit share a single unified modal ("UserFormModal").
 *    5.  Clean, well-commented code.
 *    6.  Status tabs: All / Active / Inactive / Rejected / Pending.
 *    7.  Search works on Name, Email and Phone (partial, case-insensitive).
 *    8.  Edit form contains every field from Register.jsx + Profile.jsx, plus:
 *           a) View Premium Properties
 *           b) View Partnership Properties
 *           c) View Turnkey Properties
 * ================================================================================
 */


import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMutation } from '@tanstack/react-query';
import {
  getAdminUsers,
  getAdminUser,
  updateAdminUser,
  createAdminUser,
  deleteAdminUser,
  updateRegistration,
  getPublicRoles,
  getRoles,
} from '../api/admin';
import { authAPI } from '../api/auth';
import { passwordResetAPI } from '../api/passwordReset';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import Modal from '../components/Modal';
import { formatPhoneDisplay, unformatPhone } from '../utils/format';
import { useHasPermission } from '../utils/roles';
import globalVariable from '../utils/globalVariable';
import "../styles/main.css";

/* ================================================================================
 *  Constants
 * ================================================================================ */

const ITEMS_PER_PAGE = 10;

// Status tabs shown above the table. The `key` is used for filtering.
const STATUS_TABS = [
  { key: 'all', label: 'All Users' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'pending', label: 'Pending' },
];

// Options used in the filter dropdown and as fallback in the edit form's "Role" select.
const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'team_member', label: 'Team Member' },
  { value: 'submitter', label: 'Submitter' },
  { value: 'client', label: 'Client' },
];

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
];

// Portals shown in the portal-selection step of the Add User flow.
const PORTALS = [
  {
    value: 'admin',
    label: 'Admin Portal',
    description: 'Platform administrators and team members',
  },
  {
    value: 'submitter',
    label: 'Submitter Portal',
    description: 'Property submitters and agents',
  },
  {
    value: 'client',
    label: 'Client Portal',
    description: 'Buyers and property viewers',
  },
];



/* ================================================================================
 *  Helpers
 * ================================================================================ */

/** Human-readable role label. Pass allRoles for dynamic role name lookup. */
const getRoleLabel = (role, allRoles = []) => {
  if (!role) return '—';
  const dynamic = allRoles.find((r) => r.role_slug === role);
  if (dynamic) return dynamic.role_name;
  const match = ROLE_OPTIONS.find((r) => r.value === role);
  return match ? match.label : role.replace(/_/g, ' ');
};

/** Derive a single status string from the user object. */
const getUserStatus = (u) => {
  if (u.isRejected) return 'rejected';
  if (u.isPending) return 'pending';
  if (u.isActive === false) return 'inactive';
  return 'active';
};

/** Pill colour for each status value. */
const STATUS_STYLES = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-200 text-gray-700',
  rejected: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
};

/* ================================================================================
 *  Pagination (kept from original)
 * ================================================================================ */

const Pagination = ({ currentPage, totalItems, onPageChange }) => {
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  if (totalPages <= 1) return null;

  // Build a condensed page list: always show first and last, ellipses in between.
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="px-6 py-4 bg-surface border-t border-border-subtle flex items-center justify-center gap-1">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1 rounded text-sm border border-border-subtle disabled:opacity-40 hover:bg-app"
      >
        ‹
      </button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`e-${i}`} className="px-2 py-1 text-sm text-text-secondary">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`px-3 py-1 rounded text-sm border ${p === currentPage
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
        className="px-3 py-1 rounded text-sm border border-border-subtle disabled:opacity-40 hover:bg-app"
      >
        ›
      </button>
    </div>
  );
};

/* ================================================================================
 *  Row-level action menu (gear icon + dropdown)
 *  --------------------------------------------------------------------------------
 *  Renders the gear button, and when clicked, shows a floating menu of
 *  contextual actions for that user. Closes on outside click.
 * ================================================================================ */

const RowActionMenu = ({ user, isOpen, onOpen, onClose, onAction }) => {
  const menuRef = useRef(null);

  // Close menu when the user clicks anywhere outside of it.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Gear / settings icon button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          isOpen ? onClose() : onOpen();
        }}
        className="p-2 rounded-full hover:bg-app transition-colors"
        title="Settings"
        aria-label="User actions"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5 text-text-secondary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.325 4.317a1 1 0 011.35 0l1.04.95a1 1 0 00.83.254l1.4-.21a1 1 0 011.155.68l.44 1.336a1 1 0 00.6.6l1.337.44a1 1 0 01.68 1.156l-.21 1.4a1 1 0 00.254.83l.95 1.04a1 1 0 010 1.35l-.95 1.04a1 1 0 00-.254.83l.21 1.4a1 1 0 01-.68 1.156l-1.337.44a1 1 0 00-.6.6l-.44 1.337a1 1 0 01-1.156.68l-1.4-.21a1 1 0 00-.83.254l-1.04.95a1 1 0 01-1.35 0l-1.04-.95a1 1 0 00-.83-.254l-1.4.21a1 1 0 01-1.156-.68l-.44-1.336a1 1 0 00-.6-.6l-1.337-.44a1 1 0 01-.68-1.156l.21-1.4a1 1 0 00-.254-.83l-.95-1.04a1 1 0 010-1.35l.95-1.04a1 1 0 00.254-.83l-.21-1.4a1 1 0 01.68-1.156l1.337-.44a1 1 0 00.6-.6l.44-1.337a1 1 0 011.156-.68l1.4.21a1 1 0 00.83-.254l1.04-.95z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed z-50 w-48 rounded-lg border border-border-subtle bg-white shadow-lg"
          style={{
            top: (() => {
              const btn = menuRef.current?.querySelector('button');
              return btn ? btn.getBoundingClientRect().bottom + 4 + 'px' : '0px';
            })(),
            right: (() => {
              const btn = menuRef.current?.querySelector('button');
              if (!btn) return '0px';
              const rect = btn.getBoundingClientRect();
              return window.innerWidth - rect.right + 'px';
            })(),
          }}
        >
          <div className="py-1 text-sm">
            {/* Pending registration users */}
            {user._source === 'pending_reg' && useHasPermission('user_management.approve_user') && (
              <MenuItem onClick={() => onAction('approve', user)}>
                <CheckIcon /> Approve
              </MenuItem>
            )}
            {user._source === 'pending_reg' && getUserStatus(user) === 'pending' && useHasPermission('user_management.reject_user') && (
              <MenuItem onClick={() => onAction('reject', user)}>
                <PauseIcon /> Reject
              </MenuItem>
            )}
            {/* Rejected registration users: also allow Edit, Reset and Delete */}
            {user._source === 'pending_reg' && getUserStatus(user) === 'rejected' && useHasPermission('user_management.edit_user') && (
              <MenuItem onClick={() => onAction('edit', user)}>
                <EditIcon /> Edit User
              </MenuItem>
            )}
            {user._source === 'pending_reg' && getUserStatus(user) === 'rejected' && useHasPermission('user_management.reset_password') && (
              <MenuItem onClick={() => onAction('reset', user)}>
                <KeyIcon /> Reset Password
              </MenuItem>
            )}
            {user._source === 'pending_reg' && getUserStatus(user) === 'rejected' && useHasPermission('user_management.delete_user') && (
              <>
                <div className="my-1 border-t border-border-subtle" />
                <MenuItem danger onClick={() => onAction('delete', user)}>
                  <TrashIcon /> Delete User
                </MenuItem>
              </>
            )}

            {/* Regular users: full action set */}
            {!user._source && useHasPermission('user_management.edit_user') && (
              <MenuItem onClick={() => onAction('edit', user)}>
                <EditIcon /> Edit User
              </MenuItem>
            )}
            {!user._source && user.isActive === false && useHasPermission('user_management.approve_user') && (
              <MenuItem onClick={() => onAction('approve', user)}>
                <CheckIcon /> Approve
              </MenuItem>
            )}


            {!user._source && user.isActive === true && useHasPermission('user_management.reject_user') && (
              <MenuItem onClick={() => onAction('reject', user)}>
                <PauseIcon /> Reject
              </MenuItem>
            )}
            {!user._source && useHasPermission('user_management.reset_password') && (
              <MenuItem onClick={() => onAction('reset', user)}>
                <KeyIcon /> Reset Password
              </MenuItem>
            )}
            {!user._source && (
              <>
                <div className="my-1 border-t border-border-subtle" />
                {useHasPermission('user_management.delete_user') && (
                  <MenuItem danger onClick={() => onAction('delete', user)}>
                    <TrashIcon /> Delete User
                  </MenuItem>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Single clickable row inside the dropdown menu.
const MenuItem = ({ children, onClick, danger }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-app transition-colors ${danger ? 'text-red-600' : 'text-text-primary'
      }`}
  >
    {children}
  </button>
);

/* ================================================================================
 *  Tiny inline icons (to avoid pulling in another icon lib)
 * ================================================================================ */

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a2 2 0 012-2h2a2 2 0 012 2v3" />
  </svg>
);
const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);
const PauseIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const KeyIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a4 4 0 11-8 0 4 4 0 018 0zM9 14l-2 2m0 0l2 2m-2-2h11" />
  </svg>
);
const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);
const SearchIcon = () => (
  <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10A7 7 0 113 10a7 7 0 0114 0z" />
  </svg>
);

/* Custom checkbox that renders identically across all browsers */
const CustomCheckbox = ({ checked, indeterminate, onChange, size = 'md' }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);

  const dim = size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';
  const iDim = size === 'lg' ? 'w-3 h-3' : 'w-2.5 h-2.5';
  const isOn = checked || indeterminate;

  return (
    <span className={`relative flex-shrink-0 inline-flex ${dim} cursor-pointer`}>
      <span
        aria-hidden="true"
        className={`${dim} rounded border-2 flex items-center justify-center transition-all duration-150 ${isOn ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'
          }`}
      >
        {indeterminate && !checked ? (
          <svg className={`${iDim} text-white`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" d="M5 12h14" />
          </svg>
        ) : checked ? (
          <svg className={`${iDim} text-white`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : null}
      </span>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        style={{ margin: 0 }}
      />
    </span>
  );
};

/* ================================================================================
 *  Main page component
 * ================================================================================ */

const UserManagement = () => {
  const { user: currentUser, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const _hasOwnListing = useHasPermission('user_management.own_user_listing');
  const isSuperAdmin = globalVariable.super_admin.includes(currentUser?.email || '');
  const isOwnListing = !isSuperAdmin && _hasOwnListing;

  /* ---------------------- data ---------------------- */
  const [users, setUsers] = useState([]);
  const [pendingRegs, setPendingRegs] = useState([]);
  const [rejectRegs, setRejectRegs] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);


  /* ---------------------- UI state ------------------- */
  const [search, setSearch] = useState('');
  // const [roleFilter, setRoleFilter] = useState('All');
  const queryParams = new URLSearchParams(location.search);
  const [roleFilter, setRoleFilter] = useState(queryParams.get('role') || 'All');
  const validTabs = STATUS_TABS.map((t) => t.key);
  const initialTab = queryParams.get('type') || 'all';
  const [statusTab, setStatusTab] = useState(validTabs.includes(initialTab) ? initialTab : 'all');
  const [page, setPage] = useState(1);
  const [openMenuEmail, setOpenMenuEmail] = useState(null); // gear-menu open for this email
  const [formModal, setFormModal] = useState({ open: false, mode: 'add', user: null });
  const [confirmModal, setConfirmModal] = useState(null);  // { type, user }

  /* ---------------------- fetch on mount ------------- */

  const [allRoles, setAllRoles] = useState([]);

  useEffect(() => {
    const fetchAllRoles = async () => {
      try {
        const res = await getRoles();
        setAllRoles(res.data?.data || []);
      } catch (err) {
        console.error('Failed to fetch roles:', err);
      }
    };
    fetchAllRoles();
  }, []);


  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, currentUser]);

  const fetchUsers = async (justApprovedEmail = null) => {
    setLoadingUsers(true);

    try {
      const [usersRes, pendingRes, rejectRes] = await Promise.all([
        getAdminUsers(),
        authAPI.getPendingRegistrations(),
        authAPI.getRejectRegistrations()
      ]);

      // Approved / all users
      let fetchedUsers = usersRes?.data || [];

      // When own_user_listing is active the backend may not return `specialist`
      // on a newly-approved user, causing them to be filtered out immediately
      // after approval. Patch it locally so they remain visible.
      if (justApprovedEmail && isOwnListing) {
        const approvedLower = justApprovedEmail.toLowerCase();
        fetchedUsers = fetchedUsers.map((u) =>
          (u.email || '').toLowerCase() === approvedLower
            ? { ...u, specialist: currentUser?.email || '' }
            : u
        );
      }

      setUsers(fetchedUsers);

      // Pending registrations
      const regs =
        pendingRes?.registrations ||
        pendingRes?.data ||
        (Array.isArray(pendingRes) ? pendingRes : []);

      // Rejected registrations
      const rejectUsers =
        rejectRes?.registrations ||
        rejectRes?.data ||
        (Array.isArray(rejectRes) ? rejectRes : []);

      setPendingRegs(regs);
      setRejectRegs(rejectUsers);

    } catch (err) {
      console.error("Failed to fetch users:", err);
      setUsers([]);
      setPendingRegs([]);
      setRejectRegs([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  /* ---------------------- mutation: activate / deactivate ------ */
  const toggleActiveMutation = useMutation({
    mutationFn: ({ email, updates }) => updateAdminUser(email, updates),
    onSuccess: (_res, { email, updates }) => {
      setUsers((prev) =>
        prev.map((u) => (u.email === email ? { ...u, ...updates } : u))
      );
    },
  });

  /* ---------------------- pending registrations normalised --- */
  const normalizedPendingRegs = useMemo(() =>
    pendingRegs.map((reg) => ({
      ...reg,
      firstName: reg.firstName || reg.first_name || '',
      lastName: reg.lastName || reg.last_name || '',
      email: reg.email || reg.Email || '',
      phone: reg.phone || reg.Phone || '',
      role: reg.requestedUserType || reg.userType || reg.UserType || '',
      isPending: reg.status === 'pending',
      isRejected: reg.status === 'rejected',
      isActive: false,
      createdAt: reg.createdAt || reg.created_at,
      _source: 'pending_reg',
    })),
    [pendingRegs]
  );

  console.log('rejectRegs : ', rejectRegs)

  const normalizedRejectRegs = useMemo(() =>
    rejectRegs.map((reg) => ({
      ...reg,
      firstName: reg.firstName || reg.first_name || '',
      lastName: reg.lastName || reg.last_name || '',
      email: reg.email || reg.Email || '',
      phone: reg.phone || reg.Phone || '',
      role: reg.requestedUserType || reg.userType || reg.UserType || '',
      isPending: reg.status === 'pending',
      isRejected: reg.status === 'rejected',
      isActive: false,
      createdAt: reg.createdAt || reg.created_at,
      _source: 'pending_reg',
    })),
    [rejectRegs]
  );

  const allUsers = useMemo(() => {
    // Users in the main list are authoritative (approved/active/inactive).
    // Only include pending/rejected registrations that are NOT already in the
    // main list — this prevents an approved user from being overridden by their
    // stale pending-registration record and showing as "Pending" again.
    const regularEmails = new Set(users.map((u) => (u.email || '').toLowerCase()));
    return [
      ...users,
      ...normalizedPendingRegs.filter((r) => !regularEmails.has((r.email || '').toLowerCase())),
      ...normalizedRejectRegs.filter((r) => !regularEmails.has((r.email || '').toLowerCase())),
    ];
  }, [users, normalizedPendingRegs, normalizedRejectRegs]);

  /* ---------------------- deep filtering --------------------- */
  // Reset page whenever any filter changes.
  useEffect(() => { setPage(1); }, [statusTab, search, roleFilter]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (roleFilter && roleFilter !== 'All') {
      params.set('role', roleFilter);
    } else {
      params.delete('role');
    }
    navigate({ search: params.toString() }, { replace: true });
  }, [roleFilter]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const currentEmail = (currentUser?.email || '').toLowerCase();

    return allUsers.filter((u) => {
      /* ---- own user listing: only show users assigned to current user ---- */
      if (isOwnListing) {
        if ((u.specialist || '').toLowerCase() !== currentEmail) return false;
      }

      /* ---- status tab ---- */
      if (statusTab !== 'all' && getUserStatus(u) !== statusTab) return false;

      /* ---- role dropdown ---- */
      if (roleFilter && roleFilter !== 'All' && u.role !== roleFilter) return false;

      /* ---- search across name + email + phone ---- */
      if (q) {
        const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
        const email = (u.email || '').toLowerCase();
        const phone = (u.phone || '').toLowerCase();
        const phonePretty = formatPhoneDisplay(u.phone || '').toLowerCase();

        const matches =
          fullName.includes(q) ||
          email.includes(q) ||
          phone.includes(q) ||
          phonePretty.includes(q);

        if (!matches) return false;
      }
      return true;
    });
  }, [allUsers, statusTab, search, roleFilter, isOwnListing, currentUser]);

  // Current page slice of the filtered list.
  const paginatedUsers = filteredUsers.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );


  /* ---------------------- counts for stat cards -------------- */
  // Apply role filter + own-listing filter so counts match what the user can actually see.
  const roleFilteredUsers = useMemo(() => {
    const currentEmail = (currentUser?.email || '').toLowerCase();
    return allUsers.filter((u) => {
      if (isOwnListing && (u.specialist || '').toLowerCase() !== currentEmail) return false;
      if (roleFilter && roleFilter !== 'All' && u.role !== roleFilter) return false;
      return true;
    });
  }, [allUsers, roleFilter, isOwnListing, currentUser]);

  const counts = useMemo(() => ({
    total: roleFilteredUsers.length,
    active: roleFilteredUsers.filter((u) => getUserStatus(u) === 'active').length,
    inactive: roleFilteredUsers.filter((u) => getUserStatus(u) === 'inactive').length,
    rejected: roleFilteredUsers.filter((u) => getUserStatus(u) === 'rejected').length,
    pending: roleFilteredUsers.filter((u) => getUserStatus(u) === 'pending').length,
  }), [roleFilteredUsers]);

  /* ---------------------- action dispatcher ------------------ */
  // Called when a menu item is clicked. Opens the appropriate modal / mutation.
  const handleAction = async (type, user) => {
    setOpenMenuEmail(null);  // close the gear menu

    switch (type) {
      case 'edit': {
        // Rejected reg users live in pending_registrations and have no detail
        // endpoint — open the modal immediately with the row data we have.
        if (user._source) {
          setFormModal({ open: true, mode: 'edit', user });
          break;
        }

        // For regular users, fetch the fresh record FIRST and only then open
        // the modal. Opening the modal with stale row data (and patching it
        // a second later when the API returns) caused a visible flash where
        // firstName/lastName showed the previous value for ~2s — the list
        // endpoint and the detail endpoint can disagree on those fields.
        try {
          const emailToken = btoa(user.email);
          const res = await getAdminUser(emailToken);
          const apiUser = res?.data?.user || res?.data?.data || res?.data || {};
          // Merge the row data UNDER the API data so the API (authoritative,
          // freshest) wins for every field it returns. Row data only fills
          // gaps for fields the detail endpoint doesn't include.
          setFormModal({
            open: true,
            mode: 'edit',
            user: { ...user, ...apiUser },
          });
        } catch (err) {
          console.error('Failed to load full user record:', err);
          // Fallback: open with row data so the user isn't blocked.
          setFormModal({ open: true, mode: 'edit', user });
        }
        break;
      }

      case 'activate':
        toggleActiveMutation.mutate({ email: user.email, updates: { isActive: true } });
        break;

      case 'deactivate':
        setConfirmModal({ type: 'deactivate', user });
        break;

      case 'approve':
        if (user._source === 'pending_reg') {
          setConfirmModal({ type: 'approve_reg', user });
        } else {
          toggleActiveMutation.mutate({ email: user.email, updates: { isActive: true } });
        }
        break;

      case 'reject':
        if (user._source === 'pending_reg') {
          setConfirmModal({ type: 'reject_reg', user });
        } else {
          setConfirmModal({ type: 'deactivate', user });
        }
        break;

      case 'delete':
        setConfirmModal({ type: 'delete', user });
        break;

      case 'reset':
        setConfirmModal({ type: 'reset', user });
        break;

      default:
        break;
    }
  };

  // Confirm handler shared by delete / deactivate / reset-password modals.
  const handleConfirm = async () => {
    if (!confirmModal) return;
    const { type, user } = confirmModal;
    try {
      if (type === 'delete') {
        await deleteAdminUser(user.email);
        setUsers((prev) => prev.filter((u) => u.email !== user.email));
      } else if (type === 'deactivate') {
        await updateAdminUser(user.email, { isActive: false });
        setUsers((prev) =>
          prev.map((u) => (u.email === user.email ? { ...u, isActive: false } : u))
        );
      } else if (type === 'reset') {
        await passwordResetAPI.requestPasswordReset(user.email, 'admin');
        alert('Password reset email sent.');
      } else if (type === 'approve_reg') {
        await authAPI.approveRegistration(user.email);
        await fetchUsers(user.email);
      } else if (type === 'reject_reg') {
        await authAPI.rejectRegistration(user.email);
        await fetchUsers();
      }
    } catch (err) {
      console.error(`${type} failed`, err);
      alert(`Failed to ${type} user: ${err.response?.data?.error || err.message}`);
    } finally {
      setConfirmModal(null);
    }
  };

  /* ---------------------- Add / Edit submit ------------------ */
  const handleFormSubmit = async (payload) => {
    try {
      if (formModal.mode === 'add') {
        await createAdminUser(payload);
      } else if (formModal.user?._source === 'pending_reg') {
        const key = formModal.user.email || formModal.user.Email;
        await updateRegistration(key, payload);
      } else {
        const key = formModal.user.email || formModal.user.Email;
        await updateAdminUser(key, payload);
      }
      await fetchUsers();
      setFormModal({ open: false, mode: 'add', user: null });
    } catch (err) {
      console.error('Save failed', err);
      alert('Failed to save user: ' + (err.response?.data?.error || err.message));
    }
  };


  /* =============================================================
   *  Render
   * ============================================================= */
  return (
    <div className="container mx-auto px-4 py-8">

      {/* ================= Page Header ================= */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">User Management</h1>
          <p className="text-sm text-text-secondary mt-1">
            Add, edit, activate, deactivate and manage all platform users.
          </p>
        </div>
        {useHasPermission('user_management.add_new_user') && <Button
          variant="primary"
          onClick={() => setFormModal({ open: true, mode: 'add', user: null })}
          className="flex items-center gap-2 add_user_btn"
        >
          <PlusIcon /> Add User
        </Button>}
      </div>

      {/* ================= Stat Cards ================= */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard label="Total" value={counts.total} color="bg-blue-50 text-blue-700" />
        <StatCard label="Active" value={counts.active} color="bg-green-50 text-green-700" />
        <StatCard label="Inactive" value={counts.inactive} color="bg-gray-100 text-gray-700" />
        <StatCard label="Rejected" value={counts.rejected} color="bg-red-50 text-red-700" />
        <StatCard label="Pending" value={counts.pending} color="bg-yellow-50 text-yellow-700" />
      </div>

      {/* ================= Tabs + Search + Role filter ================= */}
      <div className="bg-surface border border-border-subtle rounded-xl shadow-sm mb-4">
        {/* Status tabs */}
        <div className="flex flex-wrap gap-1 px-4 pt-4 border-b border-border-subtle">
          {STATUS_TABS.map((tab) => {
            const active = statusTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setStatusTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${active
                  ? 'border-primary text-primary bg-blue-50/50'
                  : 'border-transparent text-text-secondary hover:text-text-primary hover:bg-app'
                  }`}
              >
                {tab.label}
                <span className="ml-2 text-xs text-text-secondary">
                  ({tab.key === 'all' ? counts.total : counts[tab.key]})
                </span>
              </button>
            );
          })}
        </div>

        {/* Search + role filter row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
          {/* Search input with an icon prefix */}
          <div className="relative md:col-span-2">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <SearchIcon />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or phone…"
              className="w-full pl-10 pr-4 py-2.5 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            showPlaceholder={false}
            options={[
              { value: '', label: 'All Roles' },
              ...allRoles.map((r) => ({ value: r.role_slug, label: r.role_name }))
            ]}
          />
        </div>
      </div>

      {/* ================= Users Table ================= */}
      <div className="bg-surface border border-border-subtle rounded-xl shadow-sm">
        <div className="overflow-x-auto overflow-y-visible">


          <table className="w-full">
            <thead className="bg-app/40 border-b border-border-subtle">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Joined</th>
                {(useHasPermission('user_management.edit_user') || useHasPermission('user_management.reset_password') || useHasPermission('user_management.delete_user') || useHasPermission('user_management.approve_user') || useHasPermission('user_management.reject_user')) && <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">Action</th>}
              </tr>
            </thead>

            <tbody className="divide-y divide-border-subtle">
              {loadingUsers ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="#E5EBF4" strokeWidth="3" />
                        <path fill="#1E7AC0" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
                      </svg>
                      <span className="text-sm text-text-secondary">Loading users…</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-14 text-center text-text-secondary">
                    No users found for the current filters.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => {
                  const status = getUserStatus(u);
                  return (
                    <tr key={u.email} className="hover:bg-app/40 transition-colors">
                      {/* Name + avatar bubble */}
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
                            {(u.firstName?.[0] || '?').toUpperCase()}
                            {(u.lastName?.[0] || '').toUpperCase()}
                          </div>
                          <div className="font-medium text-text-primary">
                            {u.firstName} {u.lastName}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-sm text-text-primary">{u.email}</td>

                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {u.phone ? formatPhoneDisplay(u.phone) : '—'}
                      </td>

                      <td className="px-4 py-3 text-sm capitalize">
                        {getRoleLabel(u.role, allRoles)}
                      </td>

                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[status]}`}>
                          {status}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-sm text-text-secondary">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                      </td>

                      {/* Gear settings icon with dropdown */}
                      {(useHasPermission('user_management.edit_user') || useHasPermission('user_management.reset_password') || useHasPermission('user_management.delete_user') || useHasPermission('user_management.approve_user') || useHasPermission('user_management.reject_user')) && <td className="px-4 py-3 text-right">
                        <RowActionMenu
                          user={u}
                          isOpen={openMenuEmail === u.email}
                          onOpen={() => setOpenMenuEmail(u.email)}
                          onClose={() => setOpenMenuEmail(null)}
                          onAction={handleAction}
                        />
                      </td>}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={page}
          totalItems={filteredUsers.length}
          onPageChange={setPage}
        />
      </div>

      {/* ================= Unified Add / Edit modal ================= */}
      <UserFormModal
        open={formModal.open}
        mode={formModal.mode}
        user={formModal.user}
        currentUser={currentUser}
        allRoles={allRoles}
        onClose={() => setFormModal({ open: false, mode: 'add', user: null })}
        onSubmit={handleFormSubmit}
      />

      {/* ================= Confirmation Modal ================= */}
      <ConfirmModal
        action={confirmModal}
        onCancel={() => setConfirmModal(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
};

/* ================================================================================
 *  <StatCard> — a small summary tile used in the page header
 * ================================================================================ */

const StatCard = ({ label, value, color }) => (
  <div className="bg-surface border border-border-subtle rounded-xl p-4 shadow-sm  border_top_total">
    <div className={`inline-flex px-2 py-0.5 rounded text-xs font-bold mb-2 ${color} border_radius50`}>
      {label}
    </div>
    <div className="text-2xl font-bold text-text-primary">{value}</div>
  </div>
);

/* ================================================================================
 *  <ConfirmModal> — generic yes/no dialog for destructive or dangerous actions
 * ================================================================================ */

const ConfirmModal = ({ action, onCancel, onConfirm }) => {
  if (!action) return null;

  const COPY = {
    delete: {
      title: 'Delete User',
      text: 'This will permanently remove the user. This action cannot be undone.',
      button: 'Delete',
      variant: 'danger',
    },
    deactivate: {
      title: 'Deactivate User',
      text: 'The user will no longer be able to sign in until reactivated.',
      button: 'Deactivate',
      variant: 'danger',
    },
    reset: {
      title: 'Reset Password',
      text: 'A password reset email will be sent to the user.',
      button: 'Send Reset Email',
      variant: 'primary',
    },
    approve_reg: {
      title: 'Approve Registration',
      text: 'This will approve the registration request and grant the user access to the platform.',
      button: 'Approve',
      variant: 'primary',
    },
    reject_reg: {
      title: 'Reject Registration',
      text: 'This will reject the registration request. The user will not be granted access.',
      button: 'Reject',
      variant: 'danger',
    },
  };

  const copy = COPY[action.type];

  return (
    <Modal isOpen={!!action} onClose={onCancel} title={copy.title} size="sm">
      <div className="space-y-4">
        <p className="text-text-primary">{copy.text}</p>
        <div className="bg-app/50 border border-border-subtle p-3 rounded text-sm">
          <div><strong>Name:</strong> {action.user.firstName} {action.user.lastName}</div>
          <div><strong>Email:</strong> {action.user.email}</div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant={copy.variant} onClick={onConfirm}>{copy.button}</Button>
        </div>
      </div>
    </Modal>
  );
};

/* ================================================================================
 *  <UserFormModal>
 *  --------------------------------------------------------------------------------
 *  The single shared modal for both Add and Edit.
 *  Contains every field from Register.jsx + Profile.jsx:
 *    - First name, Last name, Email, Phone
 *    - User type / role
 *    - Password + Confirm password (Add mode only)
 *    - Address, City, State, Zip
 *    - Three property access toggles (Premium, Partnership, Turnkey)
 * ================================================================================ */

const UserFormModal = ({ open, mode, user, currentUser, allRoles = [], onClose, onSubmit }) => {
  const EMPTY = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    userType: '',
    role: '',
    password: '',
    confirmPassword: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    // Property Type Access — default all three to TRUE for the
    // add-user case so a freshly-created user can see Premium /
    // Partnership / Turnkey listings out of the box. Edit mode does
    // NOT use this default; it builds its own Access object from the
    // existing user record below (line ~1143), so toggling a checkbox
    // off and saving still persists exactly the user's choices.
    Access: { priority: true, partnership: true, turnkey: true },
    isActive: true,
  };

  // step: 'portal' (select portal first) | 'form' (fill details)
  const [step, setStep] = useState('portal');
  const [selectedPortal, setSelectedPortal] = useState(null);
  const [portalRoles, setPortalRoles] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(false);

  const [formData, setFormData] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const errorRef = useRef(null);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [error]);

  /* ---- reset state whenever the modal opens/closes ---- */
  useEffect(() => {
    // When the modal CLOSES, clear everything so the next open starts fresh.
    // This prevents a previously-saved (or previously-edited) user's values
    // from briefly showing through before the new data loads.
    if (!open) {
      setFormData(EMPTY);
      setStep('portal');
      setSelectedPortal(null);
      setPortalRoles([]);
      setError('');
      setSaving(false);
      return;
    }

    if (mode === 'edit' && user) {
      const addr = user.Address || user.address || {};
      setFormData({
        firstName: user.firstName || user.FirstName || user.first_name || '',
        lastName: user.lastName || user.LastName || user.last_name || '',
        email: user.email || user.Email || '',
        phone: user.phone || user.Phone || '',
        userType: user.userType || user.UserType || user.role || '',
        role: user.role || user.UserType || user.userType || '',
        password: '',
        confirmPassword: '',
        address: addr.street || addr.Street || '',
        city: addr.city || addr.City || '',
        state: addr.state || addr.State || '',
        zip: addr.zip || addr.Zip || '',
        Access: {
          priority: !!(user.Access?.priority ?? user.priorityFirstAccess),
          partnership: !!(user.Access?.partnership ?? user.partnershipAccess),
          turnkey: !!(user.Access?.turnkey ?? user.turnkeyAccess),
        },
        isActive: user.isActive !== false,
      });
      setStep('form');
    } else {
      setFormData(EMPTY);
      setStep('portal');
      setSelectedPortal(null);
      setPortalRoles([]);
    }
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, user]);

  /* ---- portal selection handler — fetches roles for that portal ---- */
  const handlePortalSelect = async (portal) => {
    setSelectedPortal(portal);
    setLoadingRoles(true);
    setPortalRoles([]);
    try {
      const res = await getPublicRoles();
      const roles = res.data?.data || [];
      setPortalRoles(roles);
      setFormData((prev) => ({ ...prev, role: roles.length > 0 ? roles[0].role_slug : '' }));
    } catch (err) {
      console.error('Failed to fetch roles for portal:', err);
      setPortalRoles([]);
      setFormData((prev) => ({ ...prev, role: '' }));
    } finally {
      setLoadingRoles(false);
    }
    setStep('form');
  };

  /* ---- generic field setter ---- */
  const setField = (name, value) =>
    setFormData((prev) => ({ ...prev, [name]: value }));

  const setAccess = (key, value) =>
    setFormData((prev) => ({
      ...prev,
      Access: { ...prev.Access, [key]: value },
    }));

  /* ---- client-side validation ---- */
  const validate = () => {
    if (!formData.firstName.trim() || !formData.lastName.trim())
      return 'First name and last name are required.';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email))
      return 'Please enter a valid email address.';
    const digits = (formData.phone || '').replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 12)
      return 'Phone number must be between 8 and 12 digits.';
    if (!formData.role) return 'Please select a role.';
    if (mode === 'add') {
      if (formData.password.length < 8)
        return 'Password must be at least 8 characters.';
      if (formData.password !== formData.confirmPassword)
        return 'Passwords do not match.';
    }
    return '';
  };


  /* ---- submit ---- */
  const handleSubmit = async () => {
    const msg = validate();
    if (msg) { setError(msg); return; }
    setSaving(true);
    // Build address object once and send under both casings — the backend may
    // expect either `address` (matches Profile.jsx) or `Address` (legacy).
    const addressPayload = {
      street: (formData.address || '').trim(),
      city: (formData.city || '').trim(),
      state: (formData.state || '').trim(),
      zip: (formData.zip || '').trim(),
    };
    const payload = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: unformatPhone(formData.phone),
      UserType: formData.userType || formData.role,
      userType: formData.userType || formData.role,
      role: formData.role,
      address: addressPayload,
      Address: addressPayload,
      Access: {
        priority: !!formData.Access.priority,
        partnership: !!formData.Access.partnership,
        turnkey: !!formData.Access.turnkey,
      },
      isActive: !!formData.isActive,
      assignedPermissions: {},
    };

    if (mode === 'add') payload.password = formData.password;

    try {
      await onSubmit(payload);
    } finally {
      setSaving(false);
    }
  };

  /* ---- role options: portal-specific (add) or all dynamic roles (edit) ---- */
  const roleOptions = portalRoles.length > 0
    ? portalRoles.map((r) => ({ value: r.role_slug, label: r.role_name }))
    : (mode === 'edit'
      ? allRoles.map((r) => ({ value: r.role_slug, label: r.role_name }))
      : []
    );

  /* ---- modal title ---- */
  const modalTitle =
    mode === 'edit'
      ? 'Edit User'
      : step === 'portal'
        ? 'Select Portal'
        : `Add New User — ${selectedPortal?.label}`;

  return (
    <Modal isOpen={open} onClose={onClose} title={modalTitle} size="lg">

      {/* ===== Step 1: Portal selection (Add mode only) ===== */}
      {mode === 'add' && step === 'portal' && (
        <div className="space-y-4 py-2">
          <p className="text-sm text-text-secondary">
            Choose the portal for which you want to create a user. The available roles will be loaded accordingly.
          </p>
          <div className="flex flex-col gap-3">
            {PORTALS.map((portal) => (
              <button
                key={portal.value}
                type="button"
                onClick={() => handlePortalSelect(portal)}
                className="flex items-center gap-4 p-4 border border-border-subtle rounded-xl hover:border-primary hover:bg-blue-50/40 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold text-text-primary">{portal.label}</div>
                  <div className="text-sm text-text-secondary">{portal.description}</div>
                </div>
                <svg className="w-5 h-5 text-text-secondary ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
          <div className="flex justify-end pt-2 border-t border-border-subtle">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ===== Step 2: User form ===== */}
      {(mode === 'edit' || step === 'form') && (
        <div className="space-y-6">
          {error && (
            <div ref={errorRef} className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          {/* ===== Basic info ===== */}
          <Section title="Basic Information">
            <Grid2>
              <Field label="First Name" required>
                <Input
                  value={formData.firstName}
                  onChange={(e) => setField('firstName', e.target.value)}
                  placeholder="John"
                />
              </Field>
              <Field label="Last Name" required>
                <Input
                  value={formData.lastName}
                  onChange={(e) => setField('lastName', e.target.value)}
                  placeholder="Doe"
                />
              </Field>
              <Field label="Email" required>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setField('email', e.target.value)}
                  placeholder="john@example.com"
                  disabled={mode === 'edit'}
                />
              </Field>
              <Field label="Phone" required>
                <Input
                  type="tel"
                  value={formatPhoneDisplay(formData.phone)}
                  onChange={(e) => setField('phone', unformatPhone(e.target.value))}
                  placeholder="555 123 4567"
                />
              </Field>
            </Grid2>
          </Section>

          {/* ===== Role & Access ===== */}
          <Section title="Role & Access">
            <Grid2>
              <Field label="Role" required>
                {loadingRoles ? (
                  <div className="h-10 flex items-center gap-2 text-sm text-text-secondary">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="#E5EBF4" strokeWidth="3" />
                      <path fill="#1E7AC0" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
                    </svg>
                    Loading roles…
                  </div>
                ) : (


                  <Select
                    value={formData.role}
                    onChange={(e) => setField('role', e.target.value)}
                    showPlaceholder={false}
                    options={roleOptions}
                  />

                )}
              </Field>
            </Grid2>

            {/* Three property-access toggles */}
            <div className="space-y-3 mt-4">
              <div className="text-sm font-medium text-text-primary">Property Type Access</div>
              <AccessToggle
                checked={formData.Access.priority}
                onChange={(v) => setAccess('priority', v)}
                title="View Premium Properties"
                description="Grants access to view Premium property listings."
              />
              <AccessToggle
                checked={formData.Access.partnership}
                onChange={(v) => setAccess('partnership', v)}
                title="View Partnership Properties"
                description="Grants access to view Partnership property listings."
              />
              <AccessToggle
                checked={formData.Access.turnkey}
                onChange={(v) => setAccess('turnkey', v)}
                title="View Turnkey Properties"
                description="Grants access to view Turnkey property listings."
              />
            </div>
          </Section>

          {/* ===== Address ===== */}
          <Section title="Address">
            <Grid2>
              <Field label="Street">
                <Input
                  value={formData.address}
                  onChange={(e) => setField('address', e.target.value)}
                  placeholder="123 Main St"
                />
              </Field>
              <Field label="City">
                <Input
                  value={formData.city}
                  onChange={(e) => setField('city', e.target.value)}
                  placeholder="Springfield"
                />
              </Field>
              <Field label="State">
                <Select
                  value={formData.state}
                  onChange={(e) => setField('state', e.target.value)}
                  showPlaceholder={true}
                  placeholder="Select a state"
                  options={US_STATES.map((s) => ({ value: s.code, label: s.name }))}
                />
              </Field>
              <Field label="ZIP">
                <Input
                  value={formData.zip}
                  onChange={(e) => setField('zip', e.target.value)}
                  placeholder="62704"
                />
              </Field>
            </Grid2>
          </Section>

          {/* ===== Password (Add mode only) ===== */}
          {mode === 'add' && (
            <Section title="Password">
              <Grid2>
                <Field label="Password" required>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setField('password', e.target.value)}
                    placeholder="Minimum 8 characters"
                  />
                </Field>
                <Field label="Confirm Password" required>
                  <Input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setField('confirmPassword', e.target.value)}
                    placeholder="Re-enter password"
                  />
                </Field>
              </Grid2>
            </Section>
          )}

          {/* ===== Status toggle (Edit mode only) ===== */}
          {mode === 'edit' && (
            <Section title="Status">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <CustomCheckbox
                  checked={formData.isActive}
                  onChange={(e) => setField('isActive', e.target.checked)}
                />
                <span className="text-sm">Account is active</span>
              </label>
            </Section>
          )}

          {/* ===== Footer ===== */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
            {mode === 'add' && (
              <Button
                variant="secondary"
                onClick={() => { setStep('portal'); setError(''); }}
                disabled={saving}
              >
                Back
              </Button>
            )}
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving…' : (mode === 'add' ? 'Create User' : 'Save Changes')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

/* ================================================================================
 *  Small presentational helpers used by UserFormModal
 * ================================================================================ */

const Section = ({ title, children }) => (
  <div>
    <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-3">
      {title}
    </h3>
    {children}
  </div>
);

const Grid2 = ({ children }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
);

const Field = ({ label, required, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

const AccessToggle = ({ checked, onChange, title, description }) => (
  <div className="bg-surface border border-border-subtle rounded-lg p-4">
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 w-5 h-5 accent-accent"
      />
      <div>
        <div className="text-base font-semibold text-text-primary">{title}</div>
        <div className="text-sm text-text-secondary">{description}</div>
      </div>
    </label>
  </div>
);

export default UserManagement;
