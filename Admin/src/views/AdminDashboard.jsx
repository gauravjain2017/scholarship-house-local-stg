import { useState } from 'react';
import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAdminUsers, updateAdminUser } from '../api/admin';

import { dealsAPI } from '../api/deals';
import { disputesAPI } from '../api/disputes';
import { validateDealForm } from '../utils/validateDealForm';
import NumericInput from '../components/NumericInput';
import Button from '../components/Button';
import Input from '../components/Input';
import DateInput from '../components/DateInput';
import Select from '../components/Select';
import Modal from '../components/Modal';
import Loader from '../components/Loader';
import Textarea from '../components/Textarea';
import FileUpload from '../components/FileUpload';
import { uploadFiles, normalizeMediaArray } from '../utils/uploadFiles';
import csvParser from '../api/csvParser';
import { authAPI } from '../api/auth';
import api from '../api/api';
import { passwordResetAPI } from '../api/passwordReset';
import {
  formatNumber,
  unformatNumber,
  formatPhoneDisplay,
  unformatPhone,
} from '../utils/format';
import { deriveTurnkey } from '../utils/turnkey';

// Utility function to format numbers with commas
const formatPrice = (price) => {
  const parsed = parseFloat(price);
  if (isNaN(parsed) || !price) return 'Not set';
  return parseInt(parsed).toLocaleString('en-US');
};

const normalizeCategory = (value) =>
  value?.toString().toUpperCase().replace(/\s+/g, '_');

const CATEGORIES = [
  { value: 'All', label: 'All Categories' },
  { value: 'SINGLE_FAMILY', label: 'Single Family Home' },
  { value: 'CONDO', label: 'Condo' },
  { value: 'TOWNHOUSE', label: 'Town House' },
  { value: 'TWO_TO_FOUR_UNIT', label: '2–4 Unit Home' },
  {
    value: 'UNIQUE_PROPERTY',
    label: 'Unique Property (Treehouses, Castles, Yurts, Etc.)',
  },
];

const CATEGORY_LABEL_MAP = Object.fromEntries(
  CATEGORIES.map(({ value, label }) => [value, label])
);

const STATUS_FILTERS = [
  { value: 'All', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'published', label: 'Published' },
  { value: 'sold', label: 'Sold' },
];

const FINANCING_LABELS = {
  traditional: 'Traditional',
  'subject-to': 'Subject-To',
  hybrid: 'Hybrid',
  seller: 'Seller',
  cash: 'Cash',
};

const STR_CONFIDENCE_LABELS = {
  very_confident: 'Very Confident',
  confident: 'Confident',
  unsure: 'Unsure',
  none: 'None',
  // legacy/alternate values for compatibility
  'very-confident': 'Very Confident',
  researched: 'Confident',
  'not-sure': 'Unsure',
  'no-data': 'None',
};

const VACATION_RENTAL_MARKETS = [
  { value: 'BEACH', label: 'Beach Destinations' },
  { value: 'MOUNTAIN', label: 'Mountain Destinations' },
  { value: 'URBAN', label: 'Cities / Urban Destinations' },
  { value: 'LAKE', label: 'Lake Destinations' },
  { value: 'NATURE_PARKS', label: 'Nature / State & National Parks' },
  { value: 'THEME_PARKS', label: 'Theme Parks' },
  { value: 'COLLEGE_TOWN', label: 'College Towns' },
  { value: 'OFF_BEATEN_PATH', label: 'Off The Beaten Path' },
];

const TRAVEL_MOTIVATIONS = [
  'Conventions & Conferences',
  'Exhibitions & Trade Shows',
  'Medical Facilities',
  'College Activities',
  'Sporting Events',
  'Theme Parks',
  'Relax & Unwind',
  'Sportsman Destinations – Fishing & Hunting',
  'Outdoor Activities – Hiking, Biking, Rafting, Skiing, Boating',
  'State & National Park Visits',
  'Unplug & Disconnect',
  'Experience a Unique Culture',
  'Romantic Getaway',
  'Historic Districts & Attractions',
  'Bleisure – Business & Leisure Travel',
  'Food & Wine Tasting',
  'Art & Cultural Experience',
];

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
        ›
      </button>
    </div>
  );
};

const MAX_TITLE_LENGTH = 28; // Adjust as needed for table width
const truncateTitle = (title) => {
  if (!title) return '';
  return title.length > MAX_TITLE_LENGTH
    ? title.slice(0, MAX_TITLE_LENGTH - 3) + '...'
    : title;
};

const MAX_EMAIL_LENGTH = 22; // Adjust as needed for table width
const truncateEmail = (email) => {
  if (!email) return '';
  return email.length > MAX_EMAIL_LENGTH
    ? email.slice(0, MAX_EMAIL_LENGTH - 3) + '...'
    : email;
};

const generateDealTitle = ({ bedrooms, bathrooms, city, stateRegion }) => {
  if (!bedrooms || !bathrooms || !city || !stateRegion) return '';
  return `${bedrooms} Bedroom, ${bathrooms} Bathroom in ${city}, ${stateRegion}`;
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

// Utility to get submitter field from deal or deal.submitter
function getSubmitterField(deal, field) {
  // Debug: log deal and field access
  // (Uncomment for deep debugging)
  // console.log('[getSubmitterField] deal:', deal, 'field:', field, 'value:', deal?.submitter?.[field] || deal?.[field]);
  if (
    deal &&
    deal.submitter &&
    typeof deal.submitter === 'object' &&
    field in deal.submitter
  ) {
    return deal.submitter[field] || '';
  }
  return deal && deal[field] ? deal[field] : '';
}

const CheckboxGroup = ({ label, options, values = [], onChange }) => {
  const toggle = (value) => {
    onChange(
      values.includes(value)
        ? values.filter((v) => v !== value)
        : [...values, value]
    );
  };

  return (
    <div>
      <div className="font-semibold text-text-primary mb-2">{label}</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {options.map(({ value, label }) => (
          <label
            key={value}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <input
              type="checkbox"
              checked={values.includes(value)}
              onChange={() => toggle(value)}
              className="w-4 h-4 rounded"
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const [editingUser, setEditingUser] = useState(null);
  const editErrorRefs = useRef({});

  const [editingDeal, setEditingDeal] = useState(null);
  const [underwritingDeal, setUnderwritingDeal] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [users, setUsers] = useState([]);

  const [userFilters, setUserFilters] = useState({
    search: '',
    userType: 'All',
    priorityFirstAccess: 'All',
    role: 'All',
  });

  
  const [userPage, setUserPage] = useState(1);
  const [dealPage, setDealPage] = useState(1);
  const { user, isAuthenticated } = useAuth();

  // Disputes state
  const [showDisputes, setShowDisputes] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [disputeResolution, setDisputeResolution] = useState('');
  const [disputeAdminNotes, setDisputeAdminNotes] = useState('');
  const [disputeStatusFilter, setDisputeStatusFilter] = useState('All');

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const fetchUsers = async () => {
      try {
        const res = await getAdminUsers();
        setUsers(res.data);
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
    };

    fetchUsers();
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!editingDeal) return;

    const generatedTitle = generateDealTitle({
      bedrooms: editingDeal.bedrooms,
      bathrooms: editingDeal.bathrooms,
      city: editingDeal.city,
      stateRegion: editingDeal.stateRegion,
    });

    if (generatedTitle && generatedTitle !== editingDeal.title) {
      setEditingDeal((prev) => ({
        ...prev,
        title: generatedTitle,
      }));
    }
  }, [
    editingDeal?.bedrooms,
    editingDeal?.bathrooms,
    editingDeal?.city,
    editingDeal?.stateRegion,
  ]);

  useEffect(() => {
    if (!editingDeal) return;
  }, [editingDeal]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const pendingCount = pendingUsers.length;

  useEffect(() => {
    if (pendingCount > 0) {
      setShowApproveUsers(true);
    }
  }, [pendingCount]);

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
0
  // Bulk registration result state
  const [csvRegistering, setCsvRegistering] = useState(false);
  const [csvResults, setCsvResults] = useState([]);

  // Register users with backend
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
          Access: {
            priority: !!u.priority,
          },
        })),
      };

      console.log('BULK REGISTER PAYLOAD:', payload);

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
  // Approve User Registrations state
  const [showApproveUsers, setShowApproveUsers] = useState(false);

  // Bulk User Registration state
  const [csvUsers, setCsvUsers] = useState([]);
  const [csvError, setCsvError] = useState('');
  const [csvFileName, setCsvFileName] = useState('');

  // Handle CSV file upload and parse
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
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    category: 'All',
    status: 'All',
    search: '',
    sortBy: 'newest',
  });
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [editErrors, setEditErrors] = useState({});
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

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

      console.log('Saving user updates:', editingUser.email, payload);

      await updateAdminUser(editingUser.email, payload);

      // Refresh users list
      const res = await getAdminUsers();
      setUsers(res.data);

      setEditingUser(null);
    } catch (err) {
      console.error('Failed to save user edits:', err);

      // Check if it's a 403 error for admin role assignment
      if (
        err.response?.status === 403 &&
        err.response?.data?.error?.includes('admin role')
      ) {
        alert(
          'Permission Denied: Only administrators can assign the admin role.\n\n' +
            err.response.data.message ||
            'You do not have permission to assign admin privileges.'
        );
      } else {
        alert(
          'Failed to update user: ' +
            (err.response?.data?.error || err.message || 'Unknown error')
        );
      }
    }
  };


  // Reset to page 1 when filters change
  useEffect(() => { setUserPage(1); }, [userFilters]);
  useEffect(() => { setDealPage(1); }, [filters]);

  const filteredUsers = users.filter((user) => {
    // name search
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    if (
      userFilters.search &&
      !fullName.includes(userFilters.search.toLowerCase())
    ) {
      return false;
    }

    // role filter
    if (userFilters.role !== 'All' && user.role !== userFilters.role) {
      return false;
    }

    // priority filter
    if (userFilters.priority === 'priority' && !user.priorityFirstAccess) {
      return false;
    }
    if (userFilters.priority === 'nonpriority' && user.priorityFirstAccess) {
      return false;
    }

    return true;
  });

  // Apply pagination to filtered users
  const paginatedUsers = filteredUsers.slice(
    (userPage - 1) * ITEMS_PER_PAGE,
    userPage * ITEMS_PER_PAGE
  );

  // Fetch pending deals
  const { data: deals, isLoading } = useQuery({
    queryKey: ['adminDeals', filters],
    queryFn: () => dealsAPI.getAllDeals(filters),
  });


  // Fetch disputes
  const {
    data: disputes,
    isLoading: loadingDisputes,
    refetch: refetchDisputes,
  } = useQuery({
    queryKey: ['adminDisputes'],
    queryFn: () => disputesAPI.getAllDisputes(),
  });

  // Filter disputes by status
  const filteredDisputes = (disputes || []).filter((dispute) => {
    if (disputeStatusFilter === 'All') return true;
    return dispute.status === disputeStatusFilter;
  });

  // Count pending disputes
  const pendingDisputesCount = (disputes || []).filter(
    (d) =>
      d.status === 'pending_both' ||
      d.status === 'pending_original' ||
      d.status === 'pending_new' ||
      d.status === 'pending_review'
  ).length;

  // Resolve dispute mutation
  const resolveDisputeMutation = useMutation({
    mutationFn: ({ disputeId, resolution, adminNotes }) =>
      disputesAPI.resolveDispute(disputeId, resolution, adminNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDisputes'] });
      queryClient.invalidateQueries({ queryKey: ['adminDeals'], exact: false });
      setSelectedDispute(null);
      setDisputeResolution('');
      setDisputeAdminNotes('');
      alert('Dispute resolved successfully!');
    },
    onError: (err) => {
      alert(
        err?.response?.data?.error ||
          err?.message ||
          'Failed to resolve dispute'
      );
    },
  });

  // Mutations
  const deactivateUserMutation = useMutation({
    mutationFn: ({ email, updates }) => updateAdminUser(email, updates),

    onSuccess: (_res, { email, updates }) => {
      setUsers((prev) =>
        prev.map((u) => (u.email === email ? { ...u, ...updates } : u))
      );
    },
  });

  const approveMutation = useMutation({
    mutationFn: dealsAPI.approveDeal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeals'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['myDeals'], exact: false });
      alert('Deal approved!');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ dealId, reason }) => dealsAPI.rejectDeal(dealId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeals'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['myDeals'], exact: false });
      setShowRejectModal(false);
      setRejectReason('');
      alert('Deal rejected');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: dealsAPI.deleteDeal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeals'], exact: false });
      setShowDeleteModal(false);
      setSelectedDeal(null);
    },
  });

  const publishMutation = useMutation({
    mutationFn: dealsAPI.publishDeal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeals'], exact: false });
      queryClient.invalidateQueries(['publishedDeals']);
      queryClient.invalidateQueries({ queryKey: ['myDeals'], exact: false });
      alert('Deal published to customer view!');
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: dealsAPI.unpublishDeal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeals'], exact: false });
      queryClient.invalidateQueries(['publishedDeals']);
      queryClient.invalidateQueries({ queryKey: ['myDeals'], exact: false });
      alert('Deal unpublished and returned to pending status');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ dealId, updates }) => dealsAPI.updateDeal(dealId, updates),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeals'], exact: false });
      await queryClient.refetchQueries({ queryKey: ['adminDeals'], exact: false });
      setEditingDeal(null);
      alert('Deal updated successfully!');
    },
  });

  const markAsSoldMutation = useMutation({
    mutationFn: dealsAPI.markAsSold,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeals'], exact: false });
      queryClient.invalidateQueries(['publishedDeals']);
      alert('Property marked as sold!');
    },
    onError: (err) => {
      alert(
        err?.response?.data?.error ||
          err?.message ||
          'Failed to mark property as sold'
      );
    },
  });

  const revertSoldMutation = useMutation({
    mutationFn: dealsAPI.revertSold,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeals'], exact: false });
      queryClient.invalidateQueries(['publishedDeals']);
      alert('Sold status reverted! Property is now published again.');
    },
    onError: (err) => {
      alert(
        err?.response?.data?.error ||
          err?.message ||
          'Failed to revert sold status'
      );
    },
  });

  const handleApprove = (dealId) => {
    if (approveMutation.isPending) return;
    if (confirm('Approve this deal?')) {
      approveMutation.mutate(dealId);
    }
  };

  const handleReject = (deal) => {
    setSelectedDeal(deal);
    setShowRejectModal(true);
  };

  const confirmReject = () => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    rejectMutation.mutate({ dealId: selectedDeal.id, reason: rejectReason });
  };

  const handleMarkAsSold = (dealId) => {
    if (markAsSoldMutation.isPending) return;
    if (
      confirm(
        'Mark this property as sold?\n\nThis will:\n• Remove it from public listings\n• Prevent republishing\n• Lock availability fields\n\nYou can revert this later if needed.'
      )
    ) {
      markAsSoldMutation.mutate(dealId);
    }
  };

  const handleRevertSold = (dealId) => {
    if (revertSoldMutation.isPending) return;
    if (
      confirm(
        'Revert sold status?\n\nThis will restore the property to published status and make it visible to clients again.'
      )
    ) {
      revertSoldMutation.mutate(dealId);
    }
  };

  const handlePublish = (dealId) => {
    if (publishMutation.isPending) return;

    // Find the deal to check if it's sold
    const deal = filteredDeals.find((d) => d.id === dealId);
    if (deal?.status === 'sold') {
      alert(
        'Cannot publish a sold property. Please revert the sold status first.'
      );
      return;
    }

    if (confirm('Publish this deal to customer view?')) {
      publishMutation.mutate(dealId);
    }
  };

  const handleUnpublish = (dealId) => {
    if (unpublishMutation.isPending) return;
    if (confirm('Unpublish this deal? It will return to pending status.')) {
      unpublishMutation.mutate(dealId);
    }
  };

  const handleEdit = async (deal) => {
    
    let nextDeal = { ...deal };

    const email = deal.submitterEmail || deal.email || null;

    if (!email) {
      console.warn('No email on deal, cannot fetch submitter');
      setEditingDeal({
        ...nextDeal,
        vacationRentalMarkets: Array.isArray(nextDeal.vacationRentalMarkets)
          ? nextDeal.vacationRentalMarkets
          : [],
      });

      return;
    }

    try {
      const res = await api.get(
        `/submitters/by-email/${encodeURIComponent(email)}`
      );

      nextDeal.submitter = res.data;

      if (res.ok) {
        const submitter = await res.json();
        nextDeal.submitter = submitter;
      }
    } catch (err) {
      console.error('Submitter fetch failed:', err);
    }

    setEditingDeal({
      ...nextDeal,
      vacationRentalMarkets: Array.isArray(nextDeal.vacationRentalMarkets)
        ? nextDeal.vacationRentalMarkets
        : [],
    });
  };

  const isExternalSubmitter =
    editingDeal?.submitter?.userType === 'External' ||
    editingDeal?.submitterUserType === 'External';

  const openUnderwriting = (deal) => {
    setUnderwritingDeal({ ...deal });
  };

  function normalizeForValidation(deal) {
    const normalize = (v) => {
      if (v === '') return null;
      if (typeof v === 'string') {
        const stripped = v.replace(/[^0-9.-]/g, '');
        return stripped === '' ? null : stripped;
      }
      return v;
    };

    const normalized = { ...deal };
    Object.keys(normalized).forEach((k) => {
      normalized[k] = normalize(normalized[k]);
    });

    return normalized;
  }

  const validateAdminEdit = () => {
    const { errors, firstErrorField } = validateDealForm(editingDeal, {
      requireMedia: true,
      requireRequiredFields: true,
    });

    setEditErrors(errors);
    return firstErrorField;
  };

  const normalizeUnderwritingForSave = (deal) => {
    const normalizeEmpty = (v) => (v === '' ? null : v);

    const normalized = { ...deal };

    Object.keys(normalized).forEach((key) => {
      normalized[key] = normalizeEmpty(normalized[key]);
    });

    return normalized;
  };

  const validateUnderwriting = () => {
    const normalized = normalizeUnderwritingForSave(underwritingDeal);

    const { errors, firstErrorField } = validateDealForm(normalized, {
      requireMedia: false,
      requireRequiredFields: false,
    });

    setEditErrors(errors);
    return firstErrorField;
  };

  const normalizeEmpty = (v) => (v === '' ? null : v);

  const normalizeForSave = (deal) => {
    const normalizeEmpty = (v) => (v === '' || v === undefined ? null : v);

    const stripNumber = (v) =>
      typeof v === 'string' ? v.replace(/[^0-9.-]/g, '') : v;

    return {
      ...deal,

      // ---- numeric fields ----
      price: stripNumber(deal.price),
      hoaMonthlyFee: stripNumber(deal.hoaMonthlyFee),
      emd: stripNumber(deal.emd),
      downPayment: stripNumber(deal.downPayment),
      squareFootage: stripNumber(deal.squareFootage),
      yearBuilt: stripNumber(deal.yearBuilt),
      subjLoanBalance: stripNumber(deal.subjLoanBalance),
      subjMonthlyPrincipal: stripNumber(deal.subjMonthlyPrincipal),
      subjMonthlyInterest: stripNumber(deal.subjMonthlyInterest),
      subjMonthlyTaxesInsurance: stripNumber(deal.subjMonthlyTaxesInsurance),
      sellerLoanAmount: stripNumber(deal.sellerLoanAmount),
      sellerMonthlyPayment: stripNumber(deal.sellerMonthlyPayment),
      totalMonthlyPayment: stripNumber(deal.totalMonthlyPayment),

      // ---- dates ----
      expectedCloseDate: normalizeEmpty(deal.expectedCloseDate),
      subjLoanMaturity: normalizeEmpty(deal.subjLoanMaturity),
      sellerLoanMaturity: normalizeEmpty(deal.sellerLoanMaturity),
    };
  };

  const saveEdit = async () => {
    const firstErrorField = validateAdminEdit();
    if (firstErrorField) {
      alert('Please fix errors before saving.');
      const ref = editErrorRefs.current[firstErrorField];
      ref?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      ref?.focus?.();
      return;
    }

    const {
      id,
      status,
      submittedAt,
      publishedAt,
      submitter,
      submitterEmail,
      ...editable
    } = editingDeal;

    const normalizedUpdates = normalizeForSave({
      ...editable,

      turnkey: deriveTurnkey(editable.turnkeyFurnished),

      interiorImages: await normalizeMediaArray(editable.interiorImages),
      exteriorImages: await normalizeMediaArray(editable.exteriorImages),
      additionalImages: await normalizeMediaArray(editable.additionalImages),
      videos: await normalizeMediaArray(editable.videos),
    });

    updateMutation.mutate({
      dealId: id,
      updates: normalizedUpdates,
    });
  };

  const saveUnderwriting = async () => {
    const firstErrorField = validateUnderwriting();

    if (firstErrorField) {
      alert('Please fix errors before saving underwriting.');

      const ref = editErrorRefs.current[firstErrorField];
      ref?.scrollIntoView({ behavior: 'smooth', block: 'center' });

      setTimeout(() => {
        ref?.focus?.({ preventScroll: true });
      }, 300);

      return;
    }

    const normalized = normalizeUnderwritingForSave({
      ...underwritingDeal,
      underwritingImages: await normalizeMediaArray(
        underwritingDeal.underwritingImages || []
      ),
    });
    const { id, ...updates } = normalized;

    updateMutation.mutate(
      { dealId: id, updates },
      { onSuccess: () => setUnderwritingDeal(null) }
    );
  };

  let filteredDeals = deals || [];
  // STR Score filter (if present)
  if (filters.sortBy === 'strMarketScore') {
    filteredDeals = filteredDeals.slice().sort((a, b) => {
      const scoreA = Number(a.strMarketScore) || 0;
      const scoreB = Number(b.strMarketScore) || 0;
      return scoreB - scoreA;
    });
  } else if (filters.sortBy === 'submittedAt') {
    // Oldest first by submission date
    filteredDeals = filteredDeals.slice().sort((a, b) => {
      const dateA = new Date(a.submittedAt);
      const dateB = new Date(b.submittedAt);
      const validA = !isNaN(dateA.getTime());
      const validB = !isNaN(dateB.getTime());
      if (validA && validB) return dateA - dateB;
      if (validA) return -1;
      if (validB) return 1;
      return 0;
    });
  } else {
    // Default: Newest first by submission date
    filteredDeals = filteredDeals.slice().sort((a, b) => {
      const dateA = new Date(a.submittedAt);
      const dateB = new Date(b.submittedAt);
      const validA = !isNaN(dateA.getTime());
      const validB = !isNaN(dateB.getTime());
      if (validA && validB) return dateB - dateA;
      if (validA) return -1;
      if (validB) return 1;
      return 0;
    });
  }


  const paginatedDeals = filteredDeals.slice(
    (dealPage - 1) * ITEMS_PER_PAGE,
    dealPage * ITEMS_PER_PAGE
  );

  const dimClass = (deal) => (deal.status === 'sold' ? 'opacity-60' : '');

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Bulk User Registration Card */}
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
                        <td
                          className={`px-2 py-1 border ${
                            r.status === 'success'
                              ? 'text-text-primary'
                              : 'text-text-secondary'
                          }`}
                        >
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
      {/* Pending User Approvals */}
      <div className="bg-surface border border-border-subtle rounded-xl shadow-sm mb-6">
        <button
          onClick={() => setShowApproveUsers((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-4 text-left"
        >
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

          <span className="text-sm text-accent">
            {showApproveUsers ? 'Hide' : 'Show'}
          </span>
        </button>

        {showApproveUsers && (
          <div className="px-6 pb-6">
            {loadingPending ? (
              <div className="py-8 text-text-secondary">
                Loading pending registrations…
              </div>
            ) : pendingUsers.length === 0 ? (
              <div className="py-6 text-text-secondary">
                No pending registration requests.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="bg-surface border border-border-subtle rounded-xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-surface border-b">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[180px]">
                            Full Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[220px]">
                            Email
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[140px]">
                            Phone
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[160px]">
                            Requested Role
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[120px]">
                            Submitted
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase min-w-[160px]">
                            Actions
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {pendingUsers.map((u) => (
                          <tr
                            key={u.email}
                            className="border-b last:border-b-0"
                          >
                            <td className="px-6 py-4 text-sm text-text-primary">
                              {u.firstName} {u.lastName}
                            </td>
                            <td className="px-4 py-4 text-sm text-text-primary">
                              {u.email}
                            </td>
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
                              <Button
                                size="sm"
                                variant="success"
                                onClick={() => handleApproveUser(u)}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleRejectUser(u)}
                              >
                                Reject
                              </Button>
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
        )}
      </div>
      <Modal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={
          confirmAction?.type === 'approve'
            ? 'Approve Registration'
            : 'Reject Registration'
        }
        size="sm"
      >
        {confirmAction && (
          <div className="space-y-4">
            <p className="text-text-primary">
              Are you sure you want to <strong>{confirmAction.type}</strong>{' '}
              this registration?
            </p>

            <div className="bg-surface border border-border-subtle p-3 rounded text-sm">
              <div>
                <strong>Name:</strong> {confirmAction.user.firstName}{' '}
                {confirmAction.user.lastName}
              </div>
              <div>
                <strong>Email:</strong> {confirmAction.user.email}
              </div>
              <div>
                <strong>Requested Role:</strong>{' '}
                {getUserTypeLabel(confirmAction.user.requestedUserType)}
              </div>
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
                className={`px-4 py-2 rounded ${
                  confirmAction.type === 'approve'
                    ? 'bg-primary text-white hover:bg-primary-dark'
                    : 'border border-primary text-primary hover:bg-app'
                }`}
              >
                {confirmAction.type === 'approve'
                  ? 'Approve User'
                  : 'Reject User'}
              </button>
            </div>
          </div>
        )}
      </Modal>
      {/* ===================== */}
      {/* User Management */}
      {/* ===================== */}
      <h1 className="text-3xl font-bold text-text-primary mb-8">
        User Management Dashboard
      </h1>
      {/* Filters */}
      <div className="bg-surface border border-border-subtle rounded-xl shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <Input
            placeholder="Search users by full name..."
            value={userFilters.search}
            onChange={(e) =>
              setUserFilters((prev) => ({ ...prev, search: e.target.value }))
            }
          />

          {/* Role Filter */}
          <Select
            value={userFilters.role}
            onChange={(e) =>
              setUserFilters((prev) => ({ ...prev, role: e.target.value }))
            }
            showPlaceholder={false}
            options={[
              { value: 'All', label: 'All Roles' },
              { value: 'admin', label: 'Admin' },
              { value: 'team_member', label: 'Team Member' },
              { value: 'submitter', label: 'Submitter' },
              { value: 'client', label: 'Client' },
            ]}
          />

          {/* Premium Filter */}
          <Select
            value={userFilters.priority}
            onChange={(e) =>
              setUserFilters((prev) => ({ ...prev, priority: e.target.value }))
            }
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
            onClick={() =>
              setUserFilters({ search: '', role: 'All', priority: 'All' })
            }
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
                <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[180px]">
                  Full Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[200px]">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[140px]">
                  Phone
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[120px]">
                  Role
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[110px]">
                  Premium
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[120px]">
                  Join Date
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium text-text-secondary uppercase min-w-[160px]">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-text-secondary"
                  >
                    No users found
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr key={user.email} className="hover:bg-app">
                    <td className="px-6 py-3 font-medium text-text-primary">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-primary">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {user.phone ? formatPhoneDisplay(user.phone) : '—'}
                    </td>
                    <td className="px-3 py-3 text-sm capitalize">
                      {user.role.replace(/_/g, ' ')}
                    </td>
                    <td className="px-3 py-3">
                      {user.priorityFirstAccess && (
                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          Premium
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-text-secondary">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setEditingUser({
                              ...user,
                              Access: {
                                priority: !!user.priorityFirstAccess,
                                partnership: !!user.partnershipAccess,
                                turnkey: !!user.turnkeyAccess,
                              },
                            })
                          }
                        >
                          Edit
                        </Button>

                        {user.isActive === false ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              deactivateUserMutation.mutate({
                                email: user.email,
                                updates: { isActive: true },
                              })
                            }
                          >
                            Reactivate
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              console.log('Deactivating user:', {
                                email: user.email,
                                updates: { isActive: false },
                              });

                              deactivateUserMutation.mutate({
                                email: user.email,
                                updates: { isActive: false },
                              });
                            }}
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

        {/* Pagination Controls */}
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
              <div>
                <span className="font-medium">Name:</span>{' '}
                {editingUser.firstName} {editingUser.lastName}
              </div>
              <div>
                <span className="font-medium">Email:</span> {editingUser.email}
              </div>
              <div>
                <span className="font-medium">Phone Number:</span>{' '}
                {editingUser.phone
                  ? formatPhoneDisplay(editingUser.phone)
                  : 'N/A'}
              </div>
            </div>

            {/* Role */}
            <Select
              label="User Role"
              value={editingUser.role}
              onChange={(e) =>
                setEditingUser((prev) => ({
                  ...prev,
                  role: e.target.value,
                }))
              }
              options={[
                ...(user?.role === 'admin'
                  ? [{ value: 'admin', label: 'Admin' }]
                  : []),
                { value: 'team_member', label: 'Team Member' },
                { value: 'submitter', label: 'Submitter' },
                // {
                //   value: 'real_estate_professional',
                //   label: 'Real Estate Professional',
                // },
                // { value: 'wholesaler', label: 'Wholesaler' },
                // { value: 'realtor', label: 'Realtor' },
                // { value: 'birddogger', label: 'Bird Dogger' },
                { value: 'client', label: 'Client' },
              ]}
            />

            {/* Property Access Permissions */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-700 mb-2">
                Property Type Access
              </div>

              {/* Premium Access */}
              <div className="bg-surface border border-border-subtle rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!editingUser.Access?.priority}
                    onChange={(e) =>
                      setEditingUser((prev) => ({
                        ...prev,
                        Access: {
                          ...(prev.Access || {}),
                          priority: e.target.checked,
                        },
                      }))
                    }
                    className="mt-1 w-5 h-5 accent-accent"
                  />
                  <div>
                    <div className="text-base font-semibold text-text-primary">
                      View Premium Properties
                    </div>
                    <div className="text-sm text-text-secondary">
                      Grants access to view Premium property listings.
                    </div>
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
                        Access: {
                          ...(prev.Access || {}),
                          partnership: e.target.checked,
                        },
                      }))
                    }
                    className="mt-1 w-5 h-5 accent-accent"
                  />
                  <div>
                    <div className="text-base font-semibold text-text-primary">
                      View Partnership Properties
                    </div>
                    <div className="text-sm text-text-secondary">
                      Grants access to view Partnership property listings.
                    </div>
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
                        Access: {
                          ...(prev.Access || {}),
                          turnkey: e.target.checked,
                        },
                      }))
                    }
                    className="mt-1 w-5 h-5 accent-accent"
                  />
                  <div>
                    <div className="text-base font-semibold text-text-primary">
                      View Turnkey Properties
                    </div>
                    <div className="text-sm text-text-secondary">
                      Grants access to view Turnkey property listings.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Password Reset (placeholder) */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">
                Password Reset
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={async () => {
                    if (
                      !confirm(
                        `Send password reset email to ${editingUser.email}?`
                      )
                    )
                      return;
                    try {
                      await passwordResetAPI.adminTriggerPasswordReset(
                        editingUser.email
                      );
                      alert('Password reset email sent successfully!');
                    } catch (err) {
                      alert(
                        'Failed to send reset email: ' +
                          (err.response?.data?.error || err.message)
                      );
                    }
                  }}
                >
                  Send Reset Email
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={async () => {
                    if (
                      !confirm(
                        `Set a temporary password for ${editingUser.email}? They will receive it via email.`
                      )
                    )
                      return;
                    try {
                      await passwordResetAPI.adminSetTemporaryPassword(
                        editingUser.email
                      );
                      alert('Temporary password set and emailed to user!');
                    } catch (err) {
                      alert(
                        'Failed to set temporary password: ' +
                          (err.response?.data?.error || err.message)
                      );
                    }
                  }}
                >
                  Set Temp Password
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                &quot;Send Reset Email&quot; sends a secure link. &quot;Set Temp
                Password&quot; generates a temporary password.
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => saveUserEdits()}>
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>
      {/* ===================== */}
      {/* Ownership Disputes Management */}
      {/* ===================== */}
      <div className="bg-surface border border-border-subtle rounded-xl shadow-sm mb-6">
        <button
          onClick={() => setShowDisputes((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-text-primary">
              Ownership Disputes
            </h2>

            {pendingDisputesCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full bg-red-500 text-white">
                {pendingDisputesCount}
              </span>
            )}
          </div>

          <span className="text-sm text-accent">
            {showDisputes ? 'Hide' : 'Show'}
          </span>
        </button>

        {showDisputes && (
          <div className="px-6 pb-6">
            {/* Status Filter */}
            <div className="mb-4">
              <Select
                value={disputeStatusFilter}
                onChange={(e) => setDisputeStatusFilter(e.target.value)}
                showPlaceholder={false}
                options={[
                  { value: 'All', label: 'All Statuses' },
                  { value: 'pending_both', label: 'Pending Both' },
                  { value: 'pending_original', label: 'Pending Original' },
                  { value: 'pending_new', label: 'Pending New' },
                  { value: 'pending_review', label: 'Ready for Review' },
                  { value: 'resolved', label: 'Resolved' },
                  { value: 'auto_resolved', label: 'Auto-Resolved' },
                ]}
              />
            </div>

            {loadingDisputes ? (
              <div className="py-8 text-text-secondary">
                Loading disputes...
              </div>
            ) : filteredDisputes.length === 0 ? (
              <div className="py-6 text-text-secondary">
                No ownership disputes found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                        Address
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                        Original Owner
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                        New Claimant
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">
                        Deadline
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredDisputes.map((dispute) => (
                      <tr key={dispute.disputeId} className="hover:bg-app">
                        <td className="px-4 py-3 text-sm text-text-primary">
                          {dispute.normalizedAddress}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="text-text-primary">
                            {dispute.originalSubmitterEmail}
                          </div>
                          <div className="text-xs text-text-secondary">
                            {dispute.originalProofUrl ? (
                              <a
                                href={dispute.originalProofUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accent hover:underline"
                              >
                                View Proof
                              </a>
                            ) : (
                              <span className="text-yellow-600">
                                No proof uploaded
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="text-text-primary">
                            {dispute.newSubmitterEmail}
                          </div>
                          <div className="text-xs text-text-secondary">
                            {dispute.newProofUrl ? (
                              <a
                                href={dispute.newProofUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accent hover:underline"
                              >
                                View Proof
                              </a>
                            ) : (
                              <span className="text-yellow-600">
                                No proof uploaded
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              dispute.status === 'resolved' ||
                              dispute.status === 'auto_resolved'
                                ? 'bg-green-100 text-green-700'
                                : dispute.status === 'pending_review'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {dispute.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">
                          {new Date(dispute.deadline).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedDispute(dispute);
                              setDisputeResolution('');
                              setDisputeAdminNotes('');
                            }}
                          >
                            {dispute.status === 'resolved' ||
                            dispute.status === 'auto_resolved'
                              ? 'View'
                              : 'Review'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Dispute Resolution Modal */}
      <Modal
        isOpen={!!selectedDispute}
        onClose={() => setSelectedDispute(null)}
        title="Review Ownership Dispute"
        size="lg"
      >
        {selectedDispute && (
          <div className="space-y-6 max-h-[80vh] overflow-y-auto">
            {/* Dispute Info */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">
                Property Address
              </h4>
              <p className="text-sm text-gray-600">
                {selectedDispute.normalizedAddress}
              </p>
              <div className="mt-2 flex gap-4 text-xs text-gray-500">
                <span>
                  Created:{' '}
                  {new Date(selectedDispute.createdAt).toLocaleDateString()}
                </span>
                <span>
                  Deadline:{' '}
                  {new Date(selectedDispute.deadline).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Side by Side Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Original Owner */}
              <div className="border border-border-subtle rounded-lg p-4">
                <h4 className="font-medium text-text-primary mb-3">
                  Original Owner
                </h4>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">Email:</span>{' '}
                    {selectedDispute.originalSubmitterEmail}
                  </p>
                  <p>
                    <span className="font-medium">Property ID:</span>{' '}
                    {selectedDispute.originalPropertyId}
                  </p>
                  <div className="pt-2">
                    <span className="font-medium">Proof Document:</span>
                    {selectedDispute.originalProofUrl ? (
                      <a
                        href={selectedDispute.originalProofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block mt-1 text-accent hover:underline"
                      >
                        View Document
                      </a>
                    ) : (
                      <p className="mt-1 text-yellow-600">Not uploaded</p>
                    )}
                  </div>
                </div>
              </div>

              {/* New Claimant */}
              <div className="border border-border-subtle rounded-lg p-4">
                <h4 className="font-medium text-text-primary mb-3">
                  New Claimant
                </h4>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">Email:</span>{' '}
                    {selectedDispute.newSubmitterEmail}
                  </p>
                  <p>
                    <span className="font-medium">Property ID:</span>{' '}
                    {selectedDispute.newPropertyId || 'Pending creation'}
                  </p>
                  <div className="pt-2">
                    <span className="font-medium">Proof Document:</span>
                    {selectedDispute.newProofUrl ? (
                      <a
                        href={selectedDispute.newProofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block mt-1 text-accent hover:underline"
                      >
                        View Document
                      </a>
                    ) : (
                      <p className="mt-1 text-yellow-600">Not uploaded</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Resolution Section */}
            {selectedDispute.status !== 'resolved' &&
              selectedDispute.status !== 'auto_resolved' && (
                <div className="border-t pt-4">
                  <h4 className="font-medium text-text-primary mb-3">
                    Resolve Dispute
                  </h4>

                  <div className="space-y-4">
                    <Select
                      label="Resolution"
                      value={disputeResolution}
                      onChange={(e) => setDisputeResolution(e.target.value)}
                      options={[
                        {
                          value: 'original_owner',
                          label: 'Original Owner Wins',
                        },
                        { value: 'new_owner', label: 'New Claimant Wins' },
                        {
                          value: 'both_valid',
                          label: 'Both Valid (Different Units)',
                        },
                        { value: 'both_invalid', label: 'Both Invalid' },
                      ]}
                    />

                    <Textarea
                      label="Admin Notes"
                      value={disputeAdminNotes}
                      onChange={(e) => setDisputeAdminNotes(e.target.value)}
                      placeholder="Add notes about your decision..."
                      rows={3}
                    />

                    <div className="flex justify-end gap-3">
                      <Button
                        variant="secondary"
                        onClick={() => setSelectedDispute(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => {
                          if (!disputeResolution) {
                            alert('Please select a resolution');
                            return;
                          }
                          resolveDisputeMutation.mutate({
                            disputeId: selectedDispute.disputeId,
                            resolution: disputeResolution,
                            adminNotes: disputeAdminNotes,
                          });
                        }}
                        disabled={
                          !disputeResolution || resolveDisputeMutation.isPending
                        }
                      >
                        {resolveDisputeMutation.isPending
                          ? 'Resolving...'
                          : 'Resolve Dispute'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

            {/* Already Resolved */}
            {(selectedDispute.status === 'resolved' ||
              selectedDispute.status === 'auto_resolved') && (
              <div className="border-t pt-4">
                <h4 className="font-medium text-text-primary mb-3">
                  Resolution Details
                </h4>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2 text-sm">
                  <p>
                    <span className="font-medium">Resolution:</span>{' '}
                    {selectedDispute.resolution?.replace(/_/g, ' ')}
                  </p>
                  {selectedDispute.resolvedBy && (
                    <p>
                      <span className="font-medium">Resolved By:</span>{' '}
                      {selectedDispute.resolvedBy}
                    </p>
                  )}
                  {selectedDispute.resolvedAt && (
                    <p>
                      <span className="font-medium">Resolved At:</span>{' '}
                      {new Date(selectedDispute.resolvedAt).toLocaleString()}
                    </p>
                  )}
                  {selectedDispute.adminNotes && (
                    <p>
                      <span className="font-medium">Admin Notes:</span>{' '}
                      {selectedDispute.adminNotes}
                    </p>
                  )}
                </div>

                <div className="flex justify-end mt-4">
                  <Button
                    variant="secondary"
                    onClick={() => setSelectedDispute(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>{' '}
      <h1 className="text-3xl font-bold text-text-primary mb-8">
        Property Management Dashboard
      </h1>
      {/* Filters */}
      <div className="bg-surface border border-border-subtle rounded-xl shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            placeholder="Search properties..."
            value={filters.search}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, search: e.target.value }))
            }
          />
          <Select
            value={filters.category}
            showPlaceholder={false}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                category: e.target.value,
              }))
            }
            options={CATEGORIES}
          />
          <Select
            value={filters.status}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                status: e.target.value,
              }))
            }
            options={STATUS_FILTERS}
            showPlaceholder={false}
          />
          <Select
            value={filters.sortBy}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, sortBy: e.target.value }))
            }
            options={[
              { value: 'newest', label: 'Newest First' },
              { value: 'submittedAt', label: 'Oldest First' },
            ]}
            showPlaceholder={false}
          />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            Showing {filteredDeals.length}{' '}
            {filteredDeals.length === 1 ? 'property' : 'properties'}
          </p>

          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setFilters({
                status: 'All',
                search: '',
                sortBy: 'newest',
                category: 'All',
              })
            }
          >
            Reset Filters
          </Button>
        </div>
      </div>
      {/* Properties Table */}
      <div className="bg-surface border border-border-subtle rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <Loader />
        ) : filteredDeals.length === 0 ? (
          <div className="p-8 text-center text-text-secondary">
            No properties found matching your filters
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[180px] max-w-[260px]">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[120px] max-w-[180px]">
                    Email
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[110px]">
                    Category
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[90px]">
                    Price
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[90px]">
                    Premium
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[110px]">
                    Financing
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[90px]">
                    Status
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[110px]">
                    Submitted
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-text-secondary uppercase min-w-[120px]">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {paginatedDeals.map((deal) => (
                  <tr key={deal.id} className="hover:bg-app">
                    <td
                      className={`px-6 py-3 font-medium text-text-primary min-w-[180px] max-w-[260px] ${dimClass(deal)}`}
                      title={deal.title}
                    >
                      {truncateTitle(deal.title)}
                    </td>
                    <td
                      className={`px-4 py-3 text-sm text-text-primary min-w-[120px] max-w-[180px] ${dimClass(deal)}`}
                    >
                      {deal.submitterEmail ? (
                        truncateEmail(deal.submitterEmail)
                      ) : (
                        <span className="text-text-secondary">—</span>
                      )}
                    </td>

                    <td
                      className={`px-3 py-3 text-sm text-text-secondary capitalize min-w-[110px] ${dimClass(deal)}`}
                    >
                      {CATEGORY_LABEL_MAP[normalizeCategory(deal.category)] ||
                        deal.category}
                    </td>
                    <td
                      className={`px-3 py-3 text-sm font-bold text-text-primary min-w-[90px] ${dimClass(deal)}`}
                    >
                      ${formatPrice(deal.price)}
                    </td>
                    <td
                      className={`px-3 py-3 text-left min-w-[90px] ${dimClass(deal)}`}
                    >
                      {deal.priorityFirstAccess && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          Premium
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-3 py-3 text-sm text-text-secondary min-w-[110px] ${dimClass(deal)}`}
                    >
                      {FINANCING_LABELS[deal.financingType?.toLowerCase()] ||
                        deal.financingType ||
                        ''}
                    </td>
                    <td className={`px-3 py-3 min-w-[90px] ${dimClass(deal)}`}>
                      <span
                        className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-medium ${
                          deal.status === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : deal.status === 'rejected'
                              ? 'bg-red-100 text-red-700'
                              : deal.status === 'published'
                                ? 'bg-blue-100 text-blue-700'
                                : deal.status === 'sold'
                                  ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-white'
                                  : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {deal.status === 'sold' ? (
                          <span className="flex flex-col leading-tight items-center">
                            <span className="font-semibold">Sold</span>
                            {deal.soldAt && (
                              <span className="text-[10px] opacity-90 font-normal">
                                {new Date(deal.soldAt).toLocaleDateString()}
                              </span>
                            )}
                          </span>
                        ) : (
                          deal.status
                        )}
                      </span>
                    </td>
                    <td
                      className={`px-3 py-3 text-sm text-text-secondary min-w-[110px] ${dimClass(deal)}`}
                    >
                      {new Date(deal.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3 text-right min-w-[120px]">
                      <div className="flex justify-end space-x-2">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              deal.status !== 'published' &&
                              deal.status !== 'sold' &&
                              openUnderwriting(deal)
                            }
                            disabled={
                              deal.status === 'published' ||
                              deal.status === 'sold'
                            }
                            className={
                              deal.status === 'published' ||
                              deal.status === 'sold'
                                ? 'cursor-not-allowed opacity-50'
                                : ''
                            }
                          >
                            Underwriting
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              deal.status !== 'published' && handleEdit(deal)
                            }
                            disabled={
                              deal.status === 'published' ||
                              deal.status === 'sold'
                            }
                            className={
                              deal.status === 'published' ||
                              deal.status === 'sold'
                                ? 'cursor-not-allowed opacity-50'
                                : ''
                            }
                          >
                            Edit
                          </Button>

                          {deal.status === 'published' && (
                            <div
                              className="absolute bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-surface border border-border-subtle text-text-primary text-xs rounded shadow-lg right-0"
                              style={{ zIndex: 50 }}
                            >
                              This property cannot be edited while published.
                              Unpublish it first to make changes.
                            </div>
                          )}
                        </div>
                        {deal.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => handleApprove(deal.id)}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleReject(deal)}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {deal.status === 'rejected' &&
                          user?.role === 'admin' && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => {
                                setSelectedDeal(deal);
                                setShowDeleteModal(true);
                              }}
                            >
                              Delete
                            </Button>
                          )}

                        {/* Admin: Publish button for approved deals */}
                        {deal.status === 'approved' &&
                          user?.role === 'admin' && (
                            <div className="relative group">
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handlePublish(deal.id)}
                                disabled={deal.status === 'sold'}
                                className={
                                  deal.status === 'sold'
                                    ? 'cursor-not-allowed opacity-50'
                                    : ''
                                }
                              >
                                Publish
                              </Button>
                              {deal.status === 'sold' && (
                                <div className="absolute bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-surface border border-border-subtle text-text-primary text-xs rounded shadow-lg right-0">
                                  Sold properties cannot be published. Revert
                                  the sold status first.
                                </div>
                              )}
                            </div>
                          )}
                        {/* Team Member: Submit for Approval button for approved deals */}
                        {deal.status === 'approved' &&
                          user?.role === 'team_member' && (
                            <div className="relative group">
                              <Button
                                size="sm"
                                variant="primary"
                                disabled
                                onClick={() =>
                                  alert(
                                    'This property has been approved and is ready for admin to publish.'
                                  )
                                }
                              >
                                Awaiting Admin Publish
                              </Button>
                              <div className="absolute bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-surface border border-border-subtle text-text-primary text-xs rounded shadow-lg right-0">
                                Only administrators can publish properties to
                                the customer view.
                              </div>
                            </div>
                          )}
                        {/* Team Member: Awaiting Admin Delete (rejected deals) */}
                        {deal.status === 'rejected' &&
                          user?.role === 'team_member' && (
                            <div className="relative group">
                              <Button
                                size="sm"
                                variant="danger"
                                disabled
                                onClick={() =>
                                  alert(
                                    'This property can only be permanently deleted by an administrator.'
                                  )
                                }
                              >
                                Awaiting Admin Delete
                              </Button>

                              <div className="absolute bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-surface border border-border-subtle text-text-primary text-xs rounded shadow-lg right-0">
                                Only administrators can permanently delete
                                rejected properties.
                              </div>
                            </div>
                          )}

                        {deal.status === 'published' &&
                          user?.role === 'admin' && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleUnpublish(deal.id)}
                            >
                              Unpublish
                            </Button>
                          )}
                        {deal.status === 'published' &&
                          (user?.role === 'admin' ||
                            user?.role === 'team_member') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkAsSold(deal.id)}
                              className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white border-amber-500"
                            >
                              Mark Sold
                            </Button>
                          )}
                        {deal.status === 'sold' &&
                          (user?.role === 'admin' ||
                            user?.role === 'team_member') && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleRevertSold(deal.id)}
                            >
                              Revert Sold
                            </Button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Deals Pagination */}
        <Pagination
          currentPage={dealPage}
          totalItems={filteredDeals.length}
          onPageChange={setDealPage}
        />
      </div>
      {/* Edit Modal */}
      {editingDeal && (
        <Modal
          isOpen={!!editingDeal}
          onClose={() => setEditingDeal(null)}
          title="Edit Deal"
          size="xl"
        >
          <div className="space-y-4 max-h-[80vh] overflow-y-auto">
            {/* --- Personal Info --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                value={
                  editingDeal?.submitter?.name ||
                  editingDeal?.submitterName ||
                  ''
                }
                readOnly
                className="cursor-not-allowed bg-app"
              />

              <Input
                label="Email"
                value={
                  editingDeal?.submitter?.email ||
                  editingDeal?.submitterEmail ||
                  ''
                }
                readOnly
                className="cursor-not-allowed bg-app"
              />

              <Input
                label="Phone"
                value={formatPhoneDisplay(
                  editingDeal?.submitter?.phone ||
                    editingDeal?.submitterPhone ||
                    ''
                )}
                readOnly
                className="cursor-not-allowed bg-app"
              />

              <Input
                label="User Type"
                value={
                  getUserTypeLabel(
                    editingDeal?.submitter?.userType ||
                      editingDeal?.submitterUserType
                  ) || ''
                }
                readOnly
                className="cursor-not-allowed bg-app"
              />

              <Select
                label="Submitter Relationship"
                value={editingDeal.submitterRelationship || ''}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    submitterRelationship: e.target.value,
                  }))
                }
                options={[
                  {
                    value: 'TEAM_MEMBER',
                    label: 'Team Member',
                  },
                  {
                    value: 'REALTOR_LISTING_OWNER',
                    label: 'Realtor – Listing Owner',
                  },
                  {
                    value: 'REALTOR_NOT_LISTING_OWNER',
                    label: 'Realtor – Not Listing Owner',
                  },
                  {
                    value: 'WHOLESALER_HOLDS_CONTRACT',
                    label: 'Wholesaler – Holds Contract',
                  },
                  {
                    value: 'WHOLESALER_NO_CONTRACT',
                    label: 'Wholesaler – No Contract',
                  },
                  {
                    value: 'REAL_ESTATE_PROFESSIONAL',
                    label: 'Real Estate Professional',
                  },
                  { value: 'BIRDDOGGER', label: 'Bird Dogger' },
                ]}
              />
            </div>
            <div className="bg-surface border border-border-subtle rounded-lg p-4 mb-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!editingDeal.priorityFirstAccess}
                  onChange={(e) =>
                    setEditingDeal((prev) => ({
                      ...prev,
                      priorityFirstAccess: e.target.checked,
                    }))
                  }
                  className="mt-1 w-5 h-5 accent-accent"
                />

                <div>
                  <div className="text-base font-semibold text-text-primary">
                    Premium First Access
                  </div>
                  <div className="text-sm text-text-secondary mt-0.5">
                    Give this property early visibility to VIP users before
                    public release.
                  </div>
                </div>
              </label>
            </div>
            <div className="bg-surface border border-border-subtle rounded-lg p-4 mb-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!editingDeal.fiftyFiftyPartner}
                  onChange={(e) =>
                    setEditingDeal((prev) => ({
                      ...prev,
                      fiftyFiftyPartner: e.target.checked,
                    }))
                  }
                  className="mt-1 w-5 h-5 accent-accent"
                />
                <div>
                  <div className="text-base font-semibold text-text-primary">
                    50-50 Partnership Opportunity
                  </div>
                  <div className="text-sm text-text-secondary mt-0.5">
                    Mark this property as a potential 50-50 partnership.
                  </div>
                </div>
              </label>
            </div>
            {/* --- Address --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Street Address"
                value={editingDeal.streetAddress || ''}
                error={editErrors.streetAddress}
                ref={(el) => (editErrorRefs.current.streetAddress = el)}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    streetAddress: e.target.value,
                  }))
                }
              />

              <Input
                label="Address Line 2"
                value={editingDeal.addressLine2 || ''}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    addressLine2: e.target.value,
                  }))
                }
              />

              <Input
                label="City"
                value={editingDeal.city || ''}
                error={editErrors.city}
                ref={(el) => (editErrorRefs.current.city = el)}
                onChange={(e) =>
                  setEditingDeal((prev) => ({ ...prev, city: e.target.value }))
                }
              />

              <Input
                label="State/Region/Province"
                value={editingDeal.stateRegion || ''}
                error={editErrors.stateRegion}
                ref={(el) => (editErrorRefs.current.stateRegion = el)}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    stateRegion: e.target.value,
                  }))
                }
              />
              <Input
                label="Postal/Zip Code"
                value={editingDeal.postalCode || ''}
                error={editErrors.postalCode}
                ref={(el) => (editErrorRefs.current.postalCode = el)}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    postalCode: e.target.value,
                  }))
                }
              />
            </div>
            {/* --- Property Details --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Category"
                value={editingDeal.category || ''}
                error={editErrors.category}
                ref={(el) => (editErrorRefs.current.category = el)}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    category: e.target.value,
                  }))
                }
                options={CATEGORIES.filter((opt) => opt.value !== 'All')}
              />

              <Select
                label="Turnkey/Furnished"
                value={editingDeal.turnkeyFurnished || ''}
                error={editErrors.turnkeyFurnished}
                ref={(el) => (editErrorRefs.current.turnkeyFurnished = el)}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    turnkeyFurnished: e.target.value,
                  }))
                }
                options={[
                  {
                    value: 'TURNKEY_OPERATING',
                    label:
                      'Turnkey and Currently Operating As a Short-Term Rental.',
                  },
                  {
                    value: 'FURNISHED_NOT_OPERATING',
                    label:
                      'Fully Furnished but not Currently Operating As a Short-Term Rental.',
                  },
                  {
                    value: 'PARTIALLY_FURNISHED',
                    label:
                      'Partially Furnished but not Currently Operating As a Short-Term Rental.',
                  },
                  {
                    value: 'NOT_FURNISHED',
                    label:
                      'Not Furnished or Currently Operating as a Short-Term Rental.',
                  },
                ]}
              />

              <Input
                label="Bedrooms"
                type="text"
                inputMode="numeric"
                min={0}
                step={1}
                value={formatNumber(editingDeal.bedrooms || '')}
                error={editErrors.bedrooms}
                ref={(el) => (editErrorRefs.current.bedrooms = el)}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    bedrooms: unformatNumber(e.target.value).replace(
                      /[^0-9]/g,
                      ''
                    ),
                  }))
                }
              />

              <Input
                label="Bathrooms"
                type="text"
                inputMode="numeric"
                min={0}
                step={0.5}
                value={formatNumber(editingDeal.bathrooms || '')}
                error={editErrors.bathrooms}
                ref={(el) => (editErrorRefs.current.bathrooms = el)}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    bathrooms: unformatNumber(e.target.value).replace(
                      /[^0-9]/g,
                      ''
                    ),
                  }))
                }
              />

              <Input
                label="Year Built"
                type="text"
                inputMode="numeric"
                min={1800}
                step={1}
                value={editingDeal.yearBuilt || ''}
                error={editErrors.yearBuilt}
                ref={(el) => (editErrorRefs.current.yearBuilt = el)}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    yearBuilt: unformatNumber(e.target.value).replace(
                      /[^0-9]/g,
                      ''
                    ),
                  }))
                }
              />

              <Input
                label="Square Footage"
                type="text"
                inputMode="numeric"
                min={0}
                step={1}
                value={formatNumber(editingDeal.squareFootage || '')}
                error={editErrors.squareFootage}
                ref={(el) => (editErrorRefs.current.squareFootage = el)}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    squareFootage: unformatNumber(e.target.value).replace(
                      /[^0-9]/g,
                      ''
                    ),
                  }))
                }
              />
            </div>
            {/* --- Listing Info --- */}
            <Input
              label="Title"
              value={editingDeal.title || ''}
              readOnly
              className="bg-app cursor-not-allowed"
            />

            <Textarea
              label="Description"
              value={editingDeal.description || ''}
              error={editErrors.description}
              ref={(el) => (editErrorRefs.current.description = el)}
              onChange={(e) =>
                setEditingDeal((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="HOA"
                value={editingDeal.isHOA ? 'YES' : 'NO'}
                onChange={(e) => {
                  const isHOA = e.target.value === 'YES';
                  setEditingDeal((prev) => ({
                    ...prev,
                    isHOA,
                    hoaMonthlyFee: isHOA ? prev.hoaMonthlyFee : null,
                  }));
                }}
                options={[
                  { value: 'NO', label: 'No' },
                  { value: 'YES', label: 'Yes' },
                ]}
              />

              <Input
                label="HOA Monthly Fee"
                type="text"
                inputMode="numeric"
                value={formatNumber(editingDeal.hoaMonthlyFee || '')}
                error={editErrors.hoaMonthlyFee}
                ref={(el) => (editErrorRefs.current.hoaMonthlyFee = el)}
                disabled={!editingDeal.isHOA}
                className={
                  !editingDeal.isHOA ? 'bg-app cursor-not-allowed' : ''
                }
                placeholder={editingDeal.isHOA ? '' : 'N/A'}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    hoaMonthlyFee: unformatNumber(e.target.value).replace(
                      /[^0-9]/g,
                      ''
                    ),
                  }))
                }
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Price"
                type="text"
                inputMode="numeric"
                min={0}
                step={1}
                value={formatNumber(editingDeal.price || '')}
                error={editErrors.price}
                ref={(el) => (editErrorRefs.current.price = el)}
                disabled={editingDeal.status === 'sold'}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    price: unformatNumber(e.target.value).replace(
                      /[^0-9]/g,
                      ''
                    ),
                  }))
                }
              />
            </div>
            {/* --- Financing --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Financing Type"
                value={editingDeal.financingType || ''}
                error={editErrors.financingType}
                ref={(el) => (editErrorRefs.current.financingType = el)}
                disabled={editingDeal.status === 'sold'}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    financingType: e.target.value,
                  }))
                }
                options={[
                  { value: 'traditional', label: 'Traditional' },
                  { value: 'subject-to', label: 'Subject-To' },
                  { value: 'hybrid', label: 'Hybrid' },
                  { value: 'seller', label: 'Seller Financing' },
                  { value: 'cash', label: 'Cash' },
                ]}
              />

              <Input
                label="EMD"
                type="text"
                inputMode="numeric"
                min={0}
                step={1}
                value={formatNumber(editingDeal.emd || '')}
                error={editErrors.emd}
                ref={(el) => (editErrorRefs.current.emd = el)}
                disabled={editingDeal.status === 'sold'}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    emd: unformatNumber(e.target.value).replace(/[^0-9]/g, ''),
                  }))
                }
              />

              <Input
                label="Down Payment"
                type="text"
                inputMode="numeric"
                min={0}
                step={1}
                value={formatNumber(editingDeal.downPayment || '')}
                disabled={editingDeal.status === 'sold'}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    downPayment: unformatNumber(e.target.value).replace(
                      /[^0-9]/g,
                      ''
                    ),
                  }))
                }
              />

              <DateInput
                label="Expected Close of Escrow"
                name="expectedCloseDate"
                value={editingDeal.expectedCloseDate ?? ''}
                error={editErrors.expectedCloseDate}
                ref={(el) => (editErrorRefs.current.expectedCloseDate = el)}
                disabled={editingDeal.status === 'sold'}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    expectedCloseDate: e.target.value,
                  }))
                }
                placeholder="Select date"
              />
            </div>
            <Textarea
              label="Additional Financial Information"
              value={editingDeal.financialInfo || ''}
              error={editErrors.financialInfo}
              ref={(el) => (editErrorRefs.current.financialInfo = el)}
              onChange={(e) =>
                setEditingDeal((prev) => ({
                  ...prev,
                  financialInfo: e.target.value,
                }))
              }
            />
            {/* --- Subject-to Loan Info --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Subject-to Loan Balance"
                type="text"
                inputMode="numeric"
                min={0}
                step={1}
                value={formatNumber(editingDeal.subjLoanBalance || '')}
                error={editErrors.subjLoanBalance}
                ref={(el) => (editErrorRefs.current.subjLoanBalance = el)}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    subjLoanBalance: unformatNumber(e.target.value).replace(
                      /[^0-9]/g,
                      ''
                    ),
                  }))
                }
              />

              <Input
                label="Subject-to Interest Rate"
                type="text"
                inputMode="numeric"
                min={0}
                step={0.01}
                value={formatNumber(editingDeal.subjInterestRate || '')}
                error={editErrors.subjInterestRate}
                ref={(el) => (editErrorRefs.current.subjInterestRate = el)}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    subjInterestRate: unformatNumber(e.target.value).replace(
                      /[^0-9]/g,
                      ''
                    ),
                  }))
                }
              />
              <DateInput
                label="Subject-to Loan Maturity"
                name="subjLoanMaturity"
                value={editingDeal.subjLoanMaturity ?? ''}
                error={editErrors.subjLoanMaturity}
                ref={(el) => (editErrorRefs.current.subjLoanMaturity = el)}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    subjLoanMaturity: e.target.value,
                  }))
                }
                placeholder="Select date"
              />
              <Input
                label="Subject-to Monthly Principal"
                type="text"
                inputMode="numeric"
                min={0}
                step={1}
                value={formatNumber(editingDeal.subjMonthlyPrincipal || '')}
                error={editErrors.subjMonthlyPrincipal}
                ref={(el) => (editErrorRefs.current.subjMonthlyPrincipal = el)}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    subjMonthlyPrincipal: unformatNumber(
                      e.target.value
                    ).replace(/[^0-9]/g, ''),
                  }))
                }
              />
              <Input
                label="Subject-to Monthly Interest"
                type="text"
                inputMode="numeric"
                min={0}
                step={1}
                value={formatNumber(editingDeal.subjMonthlyInterest || '')}
                error={editErrors.subjMonthlyInterest}
                ref={(el) => (editErrorRefs.current.subjMonthlyInterest = el)}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    subjMonthlyInterest: unformatNumber(e.target.value).replace(
                      /[^0-9]/g,
                      ''
                    ),
                  }))
                }
              />
              <Input
                label="Subject-to Monthly Taxes & Insurance"
                type="text"
                inputMode="numeric"
                min={0}
                step={1}
                value={formatNumber(
                  editingDeal.subjMonthlyTaxesInsurance || ''
                )}
                error={editErrors.subjMonthlyTaxesInsurance}
                ref={(el) =>
                  (editErrorRefs.current.subjMonthlyTaxesInsurance = el)
                }
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    subjMonthlyTaxesInsurance: unformatNumber(
                      e.target.value
                    ).replace(/[^0-9]/g, ''),
                  }))
                }
              />
            </div>
            {/* --- Seller Financing Info --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Seller Loan Amount"
                type="text"
                inputMode="numeric"
                min={0}
                step={1}
                value={formatNumber(editingDeal.sellerLoanAmount || '')}
                error={editErrors.sellerLoanAmount}
                ref={(el) => (editErrorRefs.current.sellerLoanAmount = el)}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    sellerLoanAmount: unformatNumber(e.target.value).replace(
                      /[^0-9]/g,
                      ''
                    ),
                  }))
                }
              />

              <Input
                label="Seller Interest Rate"
                type="text"
                inputMode="numeric"
                min={0}
                step={0.01}
                value={formatNumber(editingDeal.sellerInterestRate || '')}
                error={editErrors.sellerInterestRate}
                ref={(el) => (editErrorRefs.current.sellerInterestRate = el)}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    sellerInterestRate: unformatNumber(e.target.value).replace(
                      /[^0-9]/g,
                      ''
                    ),
                  }))
                }
              />
              <DateInput
                label="Seller Loan Maturity"
                name="sellerLoanMaturity"
                value={editingDeal.sellerLoanMaturity ?? ''}
                error={editErrors.sellerLoanMaturity}
                ref={(el) => (editErrorRefs.current.sellerLoanMaturity = el)}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    sellerLoanMaturity: e.target.value,
                  }))
                }
                placeholder="Select date"
              />

              <Input
                label="Seller Monthly Payment"
                type="text"
                inputMode="numeric"
                min={0}
                step={1}
                value={formatNumber(editingDeal.sellerMonthlyPayment || '')}
                error={editErrors.sellerMonthlyPayment}
                ref={(el) => (editErrorRefs.current.sellerMonthlyPayment = el)}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    sellerMonthlyPayment: unformatNumber(
                      e.target.value
                    ).replace(/[^0-9]/g, ''),
                  }))
                }
              />

              <Input
                label="Total Monthly Payment"
                type="text"
                inputMode="numeric"
                min={0}
                step={1}
                value={formatNumber(editingDeal.totalMonthlyPayment || '')}
                error={editErrors.totalMonthlyPayment}
                ref={(el) => (editErrorRefs.current.totalMonthlyPayment = el)}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    totalMonthlyPayment: unformatNumber(e.target.value).replace(
                      /[^0-9]/g,
                      ''
                    ),
                  }))
                }
              />
            </div>
            {/* --- STR Data --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="STR Zoning"
                value={editingDeal.strZoning || ''}
                error={editErrors.strZoning}
                ref={(el) => (editErrorRefs.current.strZoning = el)}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    strZoning: e.target.value,
                  }))
                }
                options={[
                  { value: 'YES', label: 'Yes' },
                  { value: 'NO', label: 'No' },
                  { value: 'UNSURE', label: 'Unsure' },
                ]}
              />

              <Select
                label="STR Confidence"
                value={editingDeal.strConfidence || ''}
                error={editErrors.strConfidence}
                ref={(el) => (editErrorRefs.current.strConfidence = el)}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    strConfidence: e.target.value,
                  }))
                }
                options={[
                  { value: 'FIRST_HAND', label: 'First Hand information' },
                  { value: 'AIRDNA', label: 'Based on AirDNA' },
                  {
                    value: 'DIRECTIONAL_ONLY',
                    label: 'Directional only / not fully confident',
                  },
                ]}
              />

              <Input
                label="STR Listing Link"
                value={editingDeal.strListingLink || ''}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    strListingLink: e.target.value,
                  }))
                }
              />

              <Input
                label="STR Data Sheets Link"
                value={editingDeal.strDataSheetsLink || ''}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    strDataSheetsLink: e.target.value,
                  }))
                }
              />
            </div>
            <CheckboxGroup
              label="Vacation Rental Markets"
              options={VACATION_RENTAL_MARKETS}
              values={editingDeal.vacationRentalMarkets || []}
              onChange={(vals) =>
                setEditingDeal((prev) => ({
                  ...prev,
                  vacationRentalMarkets: vals,
                }))
              }
            />
            {/* --- Local Insights --- */}
            <div className="mb-6">
              <label className="block text-base font-semibold text-text-primary mb-2">
                Why Do People Travel to This Destination?
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  'Conventions & Conferences',
                  'Exhibitions & Trade Shows',
                  'Medical Facilities',
                  'College Activities',
                  'Sporting Events',
                  'Theme Parks',
                  'Relax & Unwind',
                  'Sportsman Destinations – Fishing & Hunting',
                  'Outdoor Activities – Hiking, Biking, Rafting, Skiing, Boating',
                  'State & National Park Visits',
                  'Unplug & Disconnect',
                  'Experience a Unique Culture',
                  'Romantic Getaway',
                  'Historic Districts & Attractions',
                  'Bleisure – Business & Leisure Travel',
                  'Food & Wine Tasting',
                  'Art & Cultural Experience',
                ].map((reason) => (
                  <label key={reason} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={
                        editingDeal.travelMotivations?.includes(reason) || false
                      }
                      onChange={(e) => {
                        setEditingDeal((prev) => ({
                          ...prev,
                          travelMotivations: e.target.checked
                            ? [...(prev.travelMotivations || []), reason]
                            : (prev.travelMotivations || []).filter(
                                (r) => r !== reason
                              ),
                        }));
                      }}
                    />
                    <span className="text-sm text-text-primary">{reason}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <Textarea
                label={
                  <span className="text-base font-semibold">
                    What Do Rental Guests Want Most in This Area?
                  </span>
                }
                value={editingDeal.guestDemandInsights || ''}
                error={editErrors.guestDemandInsights}
                ref={(el) => (editErrorRefs.current.guestDemandInsights = el)}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    guestDemandInsights: e.target.value,
                  }))
                }
                rows={4}
                placeholder="Insights into guest expectations, amenities, or experiences..."
              />

              <Textarea
                label={
                  <span className="text-base font-semibold">
                    How Can We Add Value to This Property to Increase Income?
                  </span>
                }
                value={editingDeal.valueAddOpportunities || ''}
                error={editErrors.valueAddOpportunities}
                ref={(el) => (editErrorRefs.current.valueAddOpportunities = el)}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    valueAddOpportunities: e.target.value,
                  }))
                }
                rows={4}
                placeholder="Examples: pool, hot tub, bikes, beach gear, game tables, etc."
              />

              <Textarea
                label={
                  <span className="text-base font-semibold">
                    Recommended Property Managers, Contractors, or Cleaning
                    Companies
                  </span>
                }
                value={editingDeal.localContacts || ''}
                error={editErrors.localContacts}
                ref={(el) => (editErrorRefs.current.localContacts = el)}
                onChange={(e) =>
                  setEditingDeal((prev) => ({
                    ...prev,
                    localContacts: e.target.value,
                  }))
                }
                rows={4}
                placeholder="List any trusted local contacts buyers could use..."
              />
            </div>
            {/* --- Media --- */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-text-primary mb-4">
                Property Photos and Videos
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FileUpload
                  label="Interior Photos"
                  accept="image/*"
                  multiple
                  value={editingDeal.interiorImages || []}
                  onChange={(urls) =>
                    setEditingDeal((prev) => ({
                      ...prev,
                      interiorImages: urls,
                    }))
                  }
                  error={editErrors?.interiorImages}
                  ref={(el) => (editErrorRefs.current.interiorImages = el)}
                />

                <FileUpload
                  label="Exterior Photos"
                  accept="image/*"
                  multiple
                  value={editingDeal.exteriorImages || []}
                  onChange={(urls) =>
                    setEditingDeal((prev) => ({
                      ...prev,
                      exteriorImages: urls,
                    }))
                  }
                  error={editErrors?.exteriorImages}
                  ref={(el) => (editErrorRefs.current.exteriorImages = el)}
                />

                <div className="col-span-full">
                  <FileUpload
                    label="Additional Photos"
                    accept="image/*"
                    multiple
                    value={editingDeal.additionalImages || []}
                    onChange={(urls) =>
                      setEditingDeal((prev) => ({
                        ...prev,
                        additionalImages: urls,
                      }))
                    }
                    error={editErrors?.additionalImages}
                  />
                </div>
              </div>

              <div className="mt-6">
                <FileUpload
                  label="Videos"
                  accept="video/*"
                  multiple
                  value={editingDeal.videos || []}
                  onChange={(urls) =>
                    setEditingDeal((prev) => ({
                      ...prev,
                      videos: urls,
                    }))
                  }
                />
              </div>
            </div>
            <Input
              label="Special Tags (comma separated)"
              value={(editingDeal.specialTags || []).join(', ')}
              onChange={(e) =>
                setEditingDeal((prev) => ({
                  ...prev,
                  specialTags: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
            />
            {/* --- Additional Info --- */}
            <Textarea
              label="Additional Info"
              value={editingDeal.additionalInfo || ''}
              error={editErrors.additionalInfo}
              ref={(el) => (editErrorRefs.current.additionalInfo = el)}
              onChange={(e) =>
                setEditingDeal((prev) => ({
                  ...prev,
                  additionalInfo: e.target.value,
                }))
              }
            />
            {Object.keys(editErrors).length > 0 && (
              <div className="mb-4 rounded border border-border-subtle bg-surface p-4">
                <p className="font-semibold text-text-primary mb-2">
                  Please fix the following errors:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-text-secondary">
                  {Object.entries(editErrors).map(([field, message]) => (
                    <li key={field}>
                      <button
                        type="button"
                        onClick={() => {
                          const ref = editErrorRefs.current[field];
                          ref?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                          });
                          ref?.focus?.();
                        }}
                      >
                        {field}: {message}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-6 border-t border-border-subtle pt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setEditingDeal(null)}>
                Cancel
              </Button>

              <Button
                variant="primary"
                onClick={saveEdit}
                loading={updateMutation.isPending}
              >
                Save Changes
              </Button>
            </div>
          </div>
                 {' '}
        </Modal>
      )}
      {/* Underwriting Modal */}
      {underwritingDeal && (
        <Modal
          isOpen={!!underwritingDeal}
          onClose={() => setUnderwritingDeal(null)}
          title="Underwriting & Analysis"
          size="xl"
        >
          <div className="space-y-10 max-h-[80vh] overflow-y-auto">
            {/* Underwriting & Market Analysis */}
            <div className="p-6 space-y-10">
              {/* Market Definition */}
              <section className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-text-primary">
                    Market Definition
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    label="Market Type"
                    value={underwritingDeal.underwritingMarketType || ''}
                    error={editErrors.underwritingMarketType}
                    ref={(el) =>
                      (editErrorRefs.current.underwritingMarketType = el)
                    }
                    onChange={(e) =>
                      setUnderwritingDeal((prev) => ({
                        ...prev,
                        underwritingMarketType: e.target.value,
                      }))
                    }
                    options={[
                      { value: 'MARKET', label: 'Market' },
                      { value: 'SUBMARKET', label: 'Submarket' },
                    ]}
                  />

                  <Select
                    label="Market Size (Active Listings)"
                    value={underwritingDeal.underwritingMarketSize || ''}
                    error={editErrors.underwritingMarketSize}
                    ref={(el) =>
                      (editErrorRefs.current.underwritingMarketSize = el)
                    }
                    onChange={(e) =>
                      setUnderwritingDeal((prev) => ({
                        ...prev,
                        underwritingMarketSize: e.target.value,
                      }))
                    }
                    options={[
                      { value: '<50', label: 'Less Than 50' },
                      { value: '51-100', label: '51–100' },
                      { value: '101-250', label: '101–250 (Recommended)' },
                      { value: '251-500', label: '251–500 (Recommended)' },
                      { value: '500+', label: 'Over 500' },
                    ]}
                  />
                </div>
              </section>

              {/* Total Market Revenue */}
              <section className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-text-primary">
                    Total Market Revenue
                  </h3>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[12, 24, 36, 48, 60, 72, 84].map((m) => (
                    <NumericInput
                      key={m}
                      label={`${m} Months ($)`}
                      value={formatNumber(
                        underwritingDeal[`marketRevenue_${m}m`] || ''
                      )}
                      error={editErrors[`marketRevenue_${m}m`]}
                      ref={(el) =>
                        (editErrorRefs.current[`marketRevenue_${m}m`] = el)
                      }
                      onChange={(e) =>
                        setUnderwritingDeal((prev) => ({
                          ...prev,
                          [`marketRevenue_${m}m`]: unformatNumber(
                            e.target.value
                          ).replace(/[^0-9]/g, ''),
                        }))
                      }
                    />
                  ))}
                </div>
              </section>

              {/* Market Occupancy */}
              <section className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-text-primary">
                    Estimated Occupancy
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4 max-w-xs">
                  <NumericInput
                    label="Occupancy (%)"
                    value={underwritingDeal?.occupancyRate ?? ''}
                    error={editErrors.occupancyRate}
                    ref={(el) => (editErrorRefs.current.occupancyRate = el)}
                    onChange={(e) =>
                      setUnderwritingDeal((prev) => ({
                        ...prev,
                        occupancyRate: unformatNumber(e.target.value).replace(
                          /[^0-9.]/g,
                          ''
                        ),
                      }))
                    }
                  />
                </div>
              </section>

              {/* Average Nightly Rate */}
              <section className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-text-primary">
                    Average Nightly Rate (ANR)
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {['budget', 'economy', 'midscale', 'upscale', 'luxury'].map(
                    (tier) => (
                      <NumericInput
                        key={tier}
                        label={
                          tier.charAt(0).toUpperCase() + tier.slice(1) + ' ($)'
                        }
                        value={formatNumber(
                          underwritingDeal[`anr_${tier}`] || ''
                        )}
                        error={editErrors[`anr_${tier}`]}
                        ref={(el) =>
                          (editErrorRefs.current[`anr_${tier}`] = el)
                        }
                        onChange={(e) =>
                          setUnderwritingDeal((prev) => ({
                            ...prev,
                            [`anr_${tier}`]: unformatNumber(
                              e.target.value
                            ).replace(/[^0-9]/g, ''),
                          }))
                        }
                      />
                    )
                  )}
                </div>
              </section>

              {/* Estimated Gross Revenue */}
              <section className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-text-primary">
                    Estimated Gross Revenue (EGR)
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {['budget', 'economy', 'midscale', 'upscale', 'luxury'].map(
                    (tier) => (
                      <NumericInput
                        key={tier}
                        label={
                          tier.charAt(0).toUpperCase() + tier.slice(1) + ' ($)'
                        }
                        value={formatNumber(
                          underwritingDeal[`egr_${tier}`] || ''
                        )}
                        error={editErrors[`egr_${tier}`]}
                        ref={(el) =>
                          (editErrorRefs.current[`egr_${tier}`] = el)
                        }
                        onChange={(e) =>
                          setUnderwritingDeal((prev) => ({
                            ...prev,
                            [`egr_${tier}`]: unformatNumber(
                              e.target.value
                            ).replace(/[^0-9]/g, ''),
                          }))
                        }
                      />
                    )
                  )}
                </div>
              </section>

              {/* Cost Segregation, Bonus Depreciation, and Tax Scholarships */}
              <section className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-text-primary">
                    Cost Segregation, Bonus Depreciation, and Tax Scholarships
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Purchase Price */}
                  <Input
                    label="Purchase Price ($)"
                    type="text"
                    inputMode="numeric"
                    placeholder="$1,000,000"
                    value={formatNumber(underwritingDeal?.price || '')}
                    disabled
                  />

                  <NumericInput
                    label="Cost Segregation (%)"
                    placeholder="30%"
                    value={underwritingDeal.costSegregationPercent || ''}
                    error={editErrors.costSegregationPercent}
                    ref={(el) =>
                      (editErrorRefs.current.costSegregationPercent = el)
                    }
                    onChange={(e) =>
                      setUnderwritingDeal((prev) => ({
                        ...prev,
                        costSegregationPercent: unformatNumber(
                          e.target.value
                        ).replace(/[^0-9.]/g, ''),
                      }))
                    }
                  />

                  <NumericInput
                    label="Income Reduction ($)"
                    placeholder="$300,000"
                    value={formatNumber(underwritingDeal.incomeReduction || '')}
                    error={editErrors.incomeReduction}
                    ref={(el) => (editErrorRefs.current.incomeReduction = el)}
                    onChange={(e) =>
                      setUnderwritingDeal((prev) => ({
                        ...prev,
                        incomeReduction: unformatNumber(e.target.value).replace(
                          /[^0-9]/g,
                          ''
                        ),
                      }))
                    }
                  />

                  <NumericInput
                    label="Tax Rate (%)"
                    placeholder="20%"
                    value={underwritingDeal.effectiveTaxRate || ''}
                    error={editErrors.effectiveTaxRate}
                    ref={(el) => (editErrorRefs.current.effectiveTaxRate = el)}
                    onChange={(e) =>
                      setUnderwritingDeal((prev) => ({
                        ...prev,
                        effectiveTaxRate: unformatNumber(
                          e.target.value
                        ).replace(/[^0-9.]/g, ''),
                      }))
                    }
                  />

                  <NumericInput
                    label="Tax Savings ($)"
                    placeholder="$60,000"
                    value={formatNumber(underwritingDeal.taxSavings || '')}
                    error={editErrors.taxSavings}
                    ref={(el) => (editErrorRefs.current.taxSavings = el)}
                    onChange={(e) =>
                      setUnderwritingDeal((prev) => ({
                        ...prev,
                        taxSavings: unformatNumber(e.target.value).replace(
                          /[^0-9]/g,
                          ''
                        ),
                      }))
                    }
                  />
                </div>
              </section>

              {/* Market Analysis and Investment Analyzer Worksheet */}
              <section className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-text-primary">
                    Market Analysis and Investment Analyzer Worksheet
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <Input
                    label="Worksheet / Analysis Link"
                    type="url"
                    value={underwritingDeal.marketAnalysisLink || ''}
                    error={editErrors.marketAnalysisLink}
                    ref={(el) =>
                      (editErrorRefs.current.marketAnalysisLink = el)
                    }
                    onChange={(e) =>
                      setUnderwritingDeal((prev) => ({
                        ...prev,
                        marketAnalysisLink: e.target.value,
                      }))
                    }
                  />
                </div>
              </section>

              {/* Top Properties (Comps) */}
              <section className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-text-primary">
                    Top Properties (Comps)
                  </h3>

                  <p className="text-sm text-text-secondary">
                    The following are examples of the top properties in the area
                    to show
                    <span className="font-semibold">
                      {' '}
                      Potential Gross Revenue{' '}
                    </span>
                    if you could get this property to the top of the market.
                  </p>

                  <p className="text-xs text-text-secondary italic">
                    This DOES NOT suggest that this property in its current
                    condition will produce this level of revenue. These examples
                    are only to show the
                    <span className="font-semibold"> “Potential” </span>
                    revenue.
                  </p>
                </div>

                <div className="space-y-6">
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <div key={num} className="space-y-4">
                      <h4 className="font-medium text-text-primary">
                        Property {num}
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Property Link */}
                        <Input
                          label="Property Link"
                          type="url"
                          value={underwritingDeal[`comp_${num}_link`] || ''}
                          error={editErrors[`comp_${num}_link`]}
                          ref={(el) =>
                            (editErrorRefs.current[`comp_${num}_link`] = el)
                          }
                          onChange={(e) =>
                            setUnderwritingDeal((prev) => ({
                              ...prev,
                              [`comp_${num}_link`]: e.target.value,
                            }))
                          }
                        />

                        {/* Gross Revenue */}
                        <NumericInput
                          label="Gross Revenue ($)"
                          value={formatNumber(
                            underwritingDeal[`comp_${num}_grossRevenue`] || ''
                          )}
                          error={editErrors[`comp_${num}_grossRevenue`]}
                          ref={(el) =>
                            (editErrorRefs.current[`comp_${num}_grossRevenue`] =
                              el)
                          }
                          onChange={(e) =>
                            setUnderwritingDeal((prev) => ({
                              ...prev,
                              [`comp_${num}_grossRevenue`]: unformatNumber(
                                e.target.value
                              ).replace(/[^0-9]/g, ''),
                            }))
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              {/* --- Underwriting Media --- */}
              <section className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-text-primary">
                    Underwriting Images
                  </h3>
                  <p className="text-sm text-text-secondary">
                    Upload supporting screenshots, spreadsheets, analyses, or
                    reference images used during underwriting.
                  </p>
                </div>

                <FileUpload
                  accept="image/*"
                  multiple
                  value={underwritingDeal.underwritingImages || []}
                  onChange={(urls) =>
                    setUnderwritingDeal((prev) => ({
                      ...prev,
                      underwritingImages: urls,
                    }))
                  }
                  error={editErrors?.underwritingImages}
                  ref={(el) => (editErrorRefs.current.underwritingImages = el)}
                />
              </section>
            </div>

            <div className="mt-6 border-t border-border-subtle pt-6 flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setUnderwritingDeal(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={saveUnderwriting}
                loading={updateMutation.isPending}
              >
                Save Underwriting
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Deal"
      >
        <div className="space-y-4">
          <p className="text-text-primary">
            Please provide a reason for rejecting this deal:
          </p>

          <textarea
            className="w-full px-3 py-2 border border-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            rows="4"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection..."
          />

          <div className="flex justify-end gap-3 items-center">
            <Button
              variant="secondary"
              onClick={() => setShowRejectModal(false)}
              className="min-w-[120px]"
            >
              Cancel
            </Button>

            <Button
              variant="danger"
              onClick={confirmReject}
              loading={rejectMutation.isPending}
              className="min-w-[140px]"
            >
              Confirm Reject
            </Button>
          </div>
        </div>
      </Modal>
      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Property"
        size="sm"
      >
        {selectedDeal && (
          <div className="space-y-4">
            <p className="text-text-primary">
              This action is permanent and cannot be undone.
            </p>

            <div className="bg-surface border border-border-subtle p-3 rounded text-sm">
              <div>
                <strong>Title:</strong> {selectedDeal.title}
              </div>
              <div>
                <strong>Submitted By:</strong>{' '}
                {selectedDeal.submitterEmail || '—'}
              </div>
              <div>
                <strong>Status:</strong> {selectedDeal.status}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-red-600 font-medium">
                Type DELETE to confirm:
              </p>

              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                }}
              >
                Cancel
              </Button>

              <Button
                variant="danger"
                disabled={
                  deleteConfirmText !== 'DELETE' || deleteMutation.isLoading
                }
                onClick={() => {
                  deleteMutation.mutate(selectedDeal.id);
                }}
              >
                Permanently Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminDashboard;
