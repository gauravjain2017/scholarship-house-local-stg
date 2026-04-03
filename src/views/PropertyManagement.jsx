import { useState, useRef, useEffect } from 'react';
import { HiOutlineCog6Tooth } from 'react-icons/hi2';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
import NotificationModal from '../components/NotificationModal';
import FileUpload from '../components/FileUpload';
import { normalizeMediaArray } from '../utils/uploadFiles';
import api from '../api/api';
import {
  formatNumber,
  unformatNumber,
  formatPhoneDisplay,
} from '../utils/format';
import { deriveTurnkey } from '../utils/turnkey';

// Utility function to format numbers with commas
const formatPrice = (price) => {
  const parsed = parseFloat(price);
  if (isNaN(parsed) || !price) return 'Not set';
  return parseInt(parsed).toLocaleString('en-US');
};

const CATEGORIES = [
  { value: 'All', label: 'All Categories' },
  { value: 'SINGLE_FAMILY', label: 'Single Family Home' },
  { value: 'CONDO', label: 'Condo' },
  { value: 'TOWNHOUSE', label: 'Town House' },
  { value: 'TWO_TO_FOUR_UNIT', label: '2–4 Unit Home' },
  { value: 'UNIQUE_PROPERTY', label: 'Unique Property (Treehouses, Castles, Yurts, Etc.)' },
];

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

const ITEMS_PER_PAGE = 10;

const SortableHeader = ({ label, field, sortField, sortDirection, onSort, className = '' }) => (
  <th
    className={`px-3 py-3 text-left text-xs font-medium text-text-secondary uppercase cursor-pointer select-none hover:text-text-primary transition-colors ${className}`}
    onClick={() => onSort(field)}
  >
    <span className="inline-flex items-center gap-1">
      {label}
      {sortField === field ? (
        <span className="text-text-primary">{sortDirection === 'asc' ? '▲' : '▼'}</span>
      ) : (
        <span className="opacity-30">▲</span>
      )}
    </span>
  </th>
);

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

const MAX_TITLE_LENGTH = 28;
const truncateTitle = (title) => {
  if (!title) return '';
  return title.length > MAX_TITLE_LENGTH ? title.slice(0, MAX_TITLE_LENGTH - 3) + '...' : title;
};

const generateDealTitle = ({ bedrooms, bathrooms, city, stateRegion }) => {
  if (!bedrooms || !bathrooms || !city || !stateRegion) return '';
  return `${bedrooms} Bedroom, ${bathrooms} Bathroom in ${city}, ${stateRegion}`;
};

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
  return map[type] || type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
}

const CheckboxGroup = ({ label, options, values = [], onChange }) => {
  const toggle = (value) => {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  };

  return (
    <div>
      <div className="font-semibold text-text-primary mb-2">{label}</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {options.map(({ value, label }) => (
          <label key={value} className="flex items-center gap-2 text-sm cursor-pointer">
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

const PropertyManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const editErrorRefs = useRef({});

  const [editingDeal, setEditingDeal] = useState(null);
  const [underwritingDeal, setUnderwritingDeal] = useState(null);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [dealPage, setDealPage] = useState(1);

  const statusParam = searchParams.get('status');
  const [filters, setFilters] = useState({
    status: statusParam || 'All',
    search: '',
  });

  const [sortField, setSortField] = useState('submittedAt');
  const [sortDirection, setSortDirection] = useState('desc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Actions menu state
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const [menuDirection, setMenuDirection] = useState('up');
  const actionMenuRef = useRef(null);
  const actionBtnRef = useRef(null);

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target) &&
          actionBtnRef.current && !actionBtnRef.current.contains(e.target)) {
        setOpenActionMenu(null);
      }
    };
    if (openActionMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openActionMenu]);

  const toggleActionMenu = (dealId, btnElement) => {
    if (openActionMenu === dealId) {
      setOpenActionMenu(null);
      return;
    }
    // Determine if popup should open up or down based on button position
    if (btnElement) {
      const rect = btnElement.getBoundingClientRect();
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      setMenuDirection(spaceAbove < 250 ? 'down' : 'down');
    }
    setOpenActionMenu(dealId);
  };

  const [editErrors, setEditErrors] = useState({});
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [confirmApproveId, setConfirmApproveId] = useState(null);
  const [confirmSoldId, setConfirmSoldId] = useState(null);
  const [confirmRevertSoldId, setConfirmRevertSoldId] = useState(null);
  const [confirmPublishId, setConfirmPublishId] = useState(null);
  const [confirmUnpublishId, setConfirmUnpublishId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Notification modal state
  const [notification, setNotification] = useState({ open: false, type: 'success', title: '', message: '' });
  const showNotification = (type, message, title = '') => setNotification({ open: true, type, title, message });
  const closeNotification = () => setNotification((prev) => ({ ...prev, open: false }));

  // Disputes state
  const [showDisputes, setShowDisputes] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [disputeResolution, setDisputeResolution] = useState('');
  const [disputeAdminNotes, setDisputeAdminNotes] = useState('');
  const [disputeStatusFilter, setDisputeStatusFilter] = useState('All');

  

  // Reset to page 1 when filters or sort change
  useEffect(() => { setDealPage(1); }, [filters, sortField, sortDirection]);

  // Fetch deals
  const { data: deals, isLoading } = useQuery({
    queryKey: ['adminDeals', filters],
    queryFn: () => dealsAPI.getAllDeals(filters),
  });

  // Fetch disputes
  const {
    data: disputes,
    isLoading: loadingDisputes,
  } = useQuery({
    queryKey: ['adminDisputes'],
    queryFn: () => disputesAPI.getAllDisputes(),
  });

  // Filter disputes by status
  const filteredDisputes = (disputes || []).filter((dispute) => {
    if (disputeStatusFilter === 'All') return true;
    return dispute.status === disputeStatusFilter;
  });

  const pendingDisputesCount = (disputes || []).filter(
    (d) =>
      d.status === 'pending_both' ||
      d.status === 'pending_original' ||
      d.status === 'pending_new' ||
      d.status === 'pending_review'
  ).length;

  // Auto-generate deal title when key fields change
  useEffect(() => {
    if (!editingDeal) return;
    const generatedTitle = generateDealTitle({
      bedrooms: editingDeal.bedrooms,
      bathrooms: editingDeal.bathrooms,
      city: editingDeal.city,
      stateRegion: editingDeal.stateRegion,
    });
    if (generatedTitle && generatedTitle !== editingDeal.title) {
      setEditingDeal((prev) => ({ ...prev, title: generatedTitle }));
    }
  }, [editingDeal?.bedrooms, editingDeal?.bathrooms, editingDeal?.city, editingDeal?.stateRegion]);

  // Mutations
  const resolveDisputeMutation = useMutation({
    mutationFn: ({ disputeId, resolution, adminNotes }) =>
      disputesAPI.resolveDispute(disputeId, resolution, adminNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDisputes'] });
      queryClient.invalidateQueries({ queryKey: ['adminDeals'], exact: false });
      setSelectedDispute(null);
      setDisputeResolution('');
      setDisputeAdminNotes('');
      showNotification('success', 'Dispute has been resolved successfully!', 'Dispute Resolved');
    },
    onError: (err) => {
      showNotification('error', err?.response?.data?.error || err?.message || 'Failed to resolve dispute', 'Resolution Failed');
    },
  });

  const approveMutation = useMutation({
    mutationFn: dealsAPI.approveDeal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeals'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['myDeals'], exact: false });
      setConfirmApproveId(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ dealId, reason }) => dealsAPI.rejectDeal(dealId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeals'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['myDeals'], exact: false });
      setShowRejectModal(false);
      setRejectReason('');
      showNotification('info', 'The deal has been rejected.', 'Deal Rejected');
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
      setConfirmPublishId(null);
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: dealsAPI.unpublishDeal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeals'], exact: false });
      queryClient.invalidateQueries(['publishedDeals']);
      queryClient.invalidateQueries({ queryKey: ['myDeals'], exact: false });
      setConfirmUnpublishId(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ dealId, updates }) => dealsAPI.updateDeal(dealId, updates),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeals'], exact: false });
      await queryClient.refetchQueries({ queryKey: ['adminDeals'], exact: false });
      setEditingDeal(null);
      showNotification('success', 'The deal has been updated successfully!', 'Deal Updated');
    },
  });

  const markAsSoldMutation = useMutation({
    mutationFn: dealsAPI.markAsSold,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeals'], exact: false });
      queryClient.invalidateQueries(['publishedDeals']);
      setConfirmSoldId(null);
    },
    onError: (err) => {
      showNotification('error', err?.response?.data?.error || err?.message || 'Failed to mark property as sold', 'Action Failed');
    },
  });

  const revertSoldMutation = useMutation({
    mutationFn: dealsAPI.revertSold,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeals'], exact: false });
      queryClient.invalidateQueries(['publishedDeals']);
      setConfirmRevertSoldId(null);
    },
    onError: (err) => {
      showNotification('error', err?.response?.data?.error || err?.message || 'Failed to revert sold status', 'Action Failed');
    },
  });

  // Handlers
  const handleApprove = (dealId) => {
    if (approveMutation.isPending) return;
    setConfirmApproveId(dealId);
  };

  const handleReject = (deal) => {
    setSelectedDeal(deal);
    setShowRejectModal(true);
  };

  const confirmReject = () => {
    if (!rejectReason.trim()) { showNotification('warning', 'Please provide a reason for rejection.', 'Missing Information'); return; }
    rejectMutation.mutate({ dealId: selectedDeal.id, reason: rejectReason });
  };

  const handleMarkAsSold = (dealId) => {
    if (markAsSoldMutation.isPending) return;
    setConfirmSoldId(dealId);
  };

  const handleRevertSold = (dealId) => {
    if (revertSoldMutation.isPending) return;
    setConfirmRevertSoldId(dealId);
  };

  const handlePublish = (dealId) => {
    if (publishMutation.isPending) return;
    const deal = filteredDeals.find((d) => d.id === dealId);
    if (deal?.status === 'sold') { showNotification('warning', 'Cannot publish a sold property. Please revert the sold status first.', 'Action Not Allowed'); return; }
    setConfirmPublishId(dealId);
  };

  const handleUnpublish = (dealId) => {
    if (unpublishMutation.isPending) return;
    setConfirmUnpublishId(dealId);
  };

  const handleEdit = async (deal) => {
    let nextDeal = { ...deal };
    const email = deal.submitterEmail || deal.email || null;

    if (!email) {
      setEditingDeal({ ...nextDeal, vacationRentalMarkets: Array.isArray(nextDeal.vacationRentalMarkets) ? nextDeal.vacationRentalMarkets : [] });
      return;
    }

    try {
      const res = await api.get(`/submitters/by-email/${encodeURIComponent(email)}`);
      nextDeal.submitter = res.data;
    } catch (err) {
      console.error('Submitter fetch failed:', err);
    }

    setEditingDeal({
      ...nextDeal,
      vacationRentalMarkets: Array.isArray(nextDeal.vacationRentalMarkets) ? nextDeal.vacationRentalMarkets : [],
    });
  };

  const openUnderwriting = (deal) => setUnderwritingDeal({ ...deal });


  const validateAdminEdit = () => {
    const { errors, firstErrorField } = validateDealForm(editingDeal, {
      requireMedia: true,
      requireRequiredFields: true,
    });
    setEditErrors(errors);
    return firstErrorField;
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

  const normalizeForSave = (deal) => {
    const normalizeEmpty = (v) => (v === '' || v === undefined ? null : v);
    const stripNumber = (v) => (typeof v === 'string' ? v.replace(/[^0-9.-]/g, '') : v);

    return {
      ...deal,
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
      expectedCloseDate: normalizeEmpty(deal.expectedCloseDate),
      subjLoanMaturity: normalizeEmpty(deal.subjLoanMaturity),
      sellerLoanMaturity: normalizeEmpty(deal.sellerLoanMaturity),
    };
  };

  const normalizeUnderwritingForSave = (deal) => {
    const normalized = { ...deal };
    Object.keys(normalized).forEach((key) => {
      normalized[key] = normalized[key] === '' ? null : normalized[key];
    });
    return normalized;
  };

  const saveEdit = async () => {
    const firstErrorField = validateAdminEdit();
    if (firstErrorField) {
      showNotification('warning', 'Please fix the errors before saving.', 'Validation Error');
      const ref = editErrorRefs.current[firstErrorField];
      ref?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      ref?.focus?.();
      return;
    }

    const { id, status, submittedAt, publishedAt, submitter, submitterEmail, ...editable } = editingDeal;

    const normalizedUpdates = normalizeForSave({
      ...editable,
      turnkey: deriveTurnkey(editable.turnkeyFurnished),
      interiorImages: await normalizeMediaArray(editable.interiorImages),
      exteriorImages: await normalizeMediaArray(editable.exteriorImages),
      additionalImages: await normalizeMediaArray(editable.additionalImages),
      videos: await normalizeMediaArray(editable.videos),
    });

    updateMutation.mutate({ dealId: id, updates: normalizedUpdates });
  };

  const saveUnderwriting = async () => {
    const firstErrorField = validateUnderwriting();
    if (firstErrorField) {
      showNotification('warning', 'Please fix the errors before saving underwriting.', 'Validation Error');
      const ref = editErrorRefs.current[firstErrorField];
      ref?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => ref?.focus?.({ preventScroll: true }), 300);
      return;
    }

    const normalized = normalizeUnderwritingForSave({
      ...underwritingDeal,
      underwritingImages: await normalizeMediaArray(underwritingDeal.underwritingImages || []),
    });
    const { id, ...updates } = normalized;

    updateMutation.mutate(
      { dealId: id, updates },
      { onSuccess: () => setUnderwritingDeal(null) }
    );
  };

  // Sort/filter deals
  let filteredDeals = deals || [];
  const dateFields = ['submittedAt'];
  const numericFields = ['price', 'downPayment', 'subjInterestRate', 'totalMonthlyPayment', 'strMarketScore'];

  filteredDeals = filteredDeals.slice().sort((a, b) => {
    const dir = sortDirection === 'asc' ? 1 : -1;
    if (dateFields.includes(sortField)) {
      const dA = new Date(a[sortField]), dB = new Date(b[sortField]);
      const vA = !isNaN(dA.getTime()), vB = !isNaN(dB.getTime());
      if (vA && vB) return (dA - dB) * dir;
      return vA ? -1 : vB ? 1 : 0;
    }
    if (numericFields.includes(sortField)) {
      return ((Number(a[sortField]) || 0) - (Number(b[sortField]) || 0)) * dir;
    }
    const valA = (a[sortField] || '').toString().toLowerCase();
    const valB = (b[sortField] || '').toString().toLowerCase();
    return valA.localeCompare(valB) * dir;
  });

  const paginatedDeals = filteredDeals.slice(
    (dealPage - 1) * ITEMS_PER_PAGE,
    dealPage * ITEMS_PER_PAGE
  );

  // console.log('Deals : ',paginatedDeals)

  const dimClass = (deal) => (deal.status === 'sold' ? 'opacity-60' : '');

  return (
    <div className="container mx-auto px-4 py-8">

      {/* ===================== */}
      {/* Ownership Disputes */}
      {/* ===================== */}
      <div className="bg-surface border border-border-subtle rounded-xl shadow-sm mb-6">
        <button
          onClick={() => setShowDisputes((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-text-primary">Ownership Disputes</h2>
            {pendingDisputesCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full bg-red-500 text-white">
                {pendingDisputesCount}
              </span>
            )}
          </div>
          <span className="text-sm text-accent">{showDisputes ? 'Hide' : 'Show'}</span>
        </button>

        {showDisputes && (
          <div className="px-6 pb-6">
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
              <div className="py-8 text-text-secondary">Loading disputes...</div>
            ) : filteredDisputes.length === 0 ? (
              <div className="py-6 text-text-secondary">No ownership disputes found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Address</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Original Owner</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">New Claimant</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Deadline</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredDisputes.map((dispute) => (
                      <tr key={dispute.disputeId} className="hover:bg-app">
                        <td className="px-4 py-3 text-sm text-text-primary">{dispute.normalizedAddress}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="text-text-primary">{dispute.originalSubmitterEmail}</div>
                          <div className="text-xs text-text-secondary">
                            {dispute.originalProofUrl ? (
                              <a href={dispute.originalProofUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">View Proof</a>
                            ) : (
                              <span className="text-yellow-600">No proof uploaded</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="text-text-primary">{dispute.newSubmitterEmail}</div>
                          <div className="text-xs text-text-secondary">
                            {dispute.newProofUrl ? (
                              <a href={dispute.newProofUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">View Proof</a>
                            ) : (
                              <span className="text-yellow-600">No proof uploaded</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            dispute.status === 'resolved' || dispute.status === 'auto_resolved'
                              ? 'bg-green-100 text-green-700'
                              : dispute.status === 'pending_review'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-yellow-100 text-yellow-700'
                          }`}>
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
                            onClick={() => { setSelectedDispute(dispute); setDisputeResolution(''); setDisputeAdminNotes(''); }}
                          >
                            {dispute.status === 'resolved' || dispute.status === 'auto_resolved' ? 'View' : 'Review'}
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
      <Modal isOpen={!!selectedDispute} onClose={() => setSelectedDispute(null)} title="Review Ownership Dispute" size="lg">
        {selectedDispute && (
          <div className="space-y-6 max-h-[80vh] overflow-y-auto">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Property Address</h4>
              <p className="text-sm text-gray-600">{selectedDispute.normalizedAddress}</p>
              <div className="mt-2 flex gap-4 text-xs text-gray-500">
                <span>Created: {new Date(selectedDispute.createdAt).toLocaleDateString()}</span>
                <span>Deadline: {new Date(selectedDispute.deadline).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-border-subtle rounded-lg p-4">
                <h4 className="font-medium text-text-primary mb-3">Original Owner</h4>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Email:</span> {selectedDispute.originalSubmitterEmail}</p>
                  <p><span className="font-medium">Property ID:</span> {selectedDispute.originalPropertyId}</p>
                  <div className="pt-2">
                    <span className="font-medium">Proof Document:</span>
                    {selectedDispute.originalProofUrl ? (
                      <a href={selectedDispute.originalProofUrl} target="_blank" rel="noopener noreferrer" className="block mt-1 text-accent hover:underline">View Document</a>
                    ) : (
                      <p className="mt-1 text-yellow-600">Not uploaded</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="border border-border-subtle rounded-lg p-4">
                <h4 className="font-medium text-text-primary mb-3">New Claimant</h4>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Email:</span> {selectedDispute.newSubmitterEmail}</p>
                  <p><span className="font-medium">Property ID:</span> {selectedDispute.newPropertyId || 'Pending creation'}</p>
                  <div className="pt-2">
                    <span className="font-medium">Proof Document:</span>
                    {selectedDispute.newProofUrl ? (
                      <a href={selectedDispute.newProofUrl} target="_blank" rel="noopener noreferrer" className="block mt-1 text-accent hover:underline">View Document</a>
                    ) : (
                      <p className="mt-1 text-yellow-600">Not uploaded</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {selectedDispute.status !== 'resolved' && selectedDispute.status !== 'auto_resolved' && (
              <div className="border-t pt-4">
                <h4 className="font-medium text-text-primary mb-3">Resolve Dispute</h4>
                <div className="space-y-4">
                  <Select
                    label="Resolution"
                    value={disputeResolution}
                    onChange={(e) => setDisputeResolution(e.target.value)}
                    options={[
                      { value: 'original_owner', label: 'Original Owner Wins' },
                      { value: 'new_owner', label: 'New Claimant Wins' },
                      { value: 'both_valid', label: 'Both Valid (Different Units)' },
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
                    <Button variant="secondary" onClick={() => setSelectedDispute(null)}>Cancel</Button>
                    <Button
                      variant="primary"
                      onClick={() => {
                        if (!disputeResolution) { showNotification('warning', 'Please select a resolution before proceeding.', 'Missing Selection'); return; }
                        resolveDisputeMutation.mutate({ disputeId: selectedDispute.disputeId, resolution: disputeResolution, adminNotes: disputeAdminNotes });
                      }}
                      disabled={!disputeResolution || resolveDisputeMutation.isPending}
                    >
                      {resolveDisputeMutation.isPending ? 'Resolving...' : 'Resolve Dispute'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {(selectedDispute.status === 'resolved' || selectedDispute.status === 'auto_resolved') && (
              <div className="border-t pt-4">
                <h4 className="font-medium text-text-primary mb-3">Resolution Details</h4>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2 text-sm">
                  <p><span className="font-medium">Resolution:</span> {selectedDispute.resolution?.replace(/_/g, ' ')}</p>
                  {selectedDispute.resolvedBy && <p><span className="font-medium">Resolved By:</span> {selectedDispute.resolvedBy}</p>}
                  {selectedDispute.resolvedAt && <p><span className="font-medium">Resolved At:</span> {new Date(selectedDispute.resolvedAt).toLocaleString()}</p>}
                  {selectedDispute.adminNotes && <p><span className="font-medium">Admin Notes:</span> {selectedDispute.adminNotes}</p>}
                </div>
                <div className="flex justify-end mt-4">
                  <Button variant="secondary" onClick={() => setSelectedDispute(null)}>Close</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ===================== */}
      {/* Property Management Dashboard */}
      {/* ===================== */}
      <h1 className="text-3xl font-bold text-text-primary mb-8">
        Property Management Dashboard
      </h1>

      {/* Filters */}
      <div className="bg-surface border border-border-subtle rounded-xl shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            placeholder="Search properties..."
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          />
          <Select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            options={STATUS_FILTERS}
            showPlaceholder={false}
          />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            Showing {filteredDeals.length === 0 ? 0 : Math.min((dealPage - 1) * ITEMS_PER_PAGE + 1, filteredDeals.length)}–{Math.min(dealPage * ITEMS_PER_PAGE, filteredDeals.length)} of {filteredDeals.length}{' '}
            {filteredDeals.length === 1 ? 'property' : 'properties'}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setFilters({ status: 'All', search: '' }); setSortField('submittedAt'); setSortDirection('desc'); }}
          >
            Reset Filters
          </Button>
        </div>
      </div>

      {/* Properties Table */}
	  
<div className="table-card bg-surface border border-border-subtle rounded-xl shadow-sm">
 

	 {isLoading ? (
  <Loader />
) : filteredDeals.length === 0 ? (
  <div className="p-8 text-center text-text-secondary">
    No properties found matching your filters
  </div>
) : (
  <div className="relative">
    
	
	
<div className="flex w-full items-center">
  <div className="ml-auto flex gap-2 mt-2 mr-2">

    {/* LEFT BUTTON */}
    <button
      onClick={() =>
        document
          .getElementById("tableScroll")
          .scrollBy({ left: -300, behavior: "smooth" })
      }
      className="p-2 rounded-md bg-gray-100 hover:bg-gray-200 transition"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-4 h-4 text-gray-500 hover:text-gray-700"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </button>

    {/* RIGHT BUTTON */}
    <button
      onClick={() =>
        document
          .getElementById("tableScroll")
          .scrollBy({ left: 300, behavior: "smooth" })
      }
      className="p-2 rounded-md bg-gray-100 hover:bg-gray-200 transition"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-4 h-4 text-gray-500 hover:text-gray-700"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>

  </div>
</div>

   <div id="tableScroll" className="overflow-x-auto overflow-y-visible relative">
      <table className="w-full relative">
        
        {/* HEADER */}
        <thead className="bg-surface border-b">
          <tr>
            <SortableHeader label="Submitted" field="submittedAt" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="min-w-[100px]" />
            <SortableHeader label="Title" field="title" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="min-w-[180px] max-w-[260px]" />
            <SortableHeader label="Full Address" field="streetAddress" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="min-w-[200px]" />
            <SortableHeader label="Submitted By" field="submitterName" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="min-w-[130px]" />
            <SortableHeader label="Price" field="price" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="min-w-[90px]" />
            <SortableHeader label="Down Payment" field="downPayment" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="min-w-[110px]" />
            <SortableHeader label="Interest Rate" field="subjInterestRate" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="min-w-[110px]" />
            <SortableHeader label="Monthly Payment" field="totalMonthlyPayment" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="min-w-[130px]" />
            <SortableHeader label="Priority" field="priorityFirstAccess" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="min-w-[90px]" />
            <SortableHeader label="Financing" field="financingType" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="min-w-[100px]" />

            {/* ✅ STICKY STATUS */}
            <SortableHeader
              label="Status"
              field="status"
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              className="min-w-[90px] sticky right-[60px] bg-surface z-20"
            />

            {/* ✅ STICKY ACTION */}
            <th className="px-3 py-3 text-center text-xs font-medium text-text-secondary uppercase min-w-[60px] sticky right-0 bg-surface z-20">
              Actions
            </th>
          </tr>
        </thead>

        {/* BODY */}
        <tbody className="divide-y">
          {paginatedDeals.map((deal) => (
            <tr
              key={deal.id}
              className="hover:bg-app cursor-pointer"
              onClick={() => navigate(`/deals/${deal.id}`, { state: { from: 'admin-properties' } })}
            >

              <td className={`px-3 py-3 text-sm text-text-secondary min-w-[100px] ${dimClass(deal)}`}>
                {deal.submittedAt ? new Date(deal.submittedAt).toLocaleDateString() : '—'}
              </td>

              <td className={`px-3 py-3 font-medium text-text-primary min-w-[180px] max-w-[260px] ${dimClass(deal)}`}>
                {truncateTitle(deal.title)}
              </td>

              <td className={`px-3 py-3 text-sm text-text-primary min-w-[200px] ${dimClass(deal)}`}>
                {[deal.streetAddress, deal.city, deal.stateRegion, deal.postalCode].filter(Boolean).join(', ') || '—'}
              </td>

              <td className={`px-3 py-3 text-sm text-text-primary min-w-[130px] ${dimClass(deal)}`}>
                {deal.submitterName || '—'}
              </td>

              <td className={`px-3 py-3 text-sm font-bold text-text-primary min-w-[90px] ${dimClass(deal)}`}>
                ${formatPrice(deal.price)}
              </td>

              <td className={`px-3 py-3 text-sm min-w-[110px] ${dimClass(deal)}`}>
                {deal.downPayment ? `$${formatPrice(deal.downPayment)}` : '—'}
              </td>

              <td className={`px-3 py-3 text-sm min-w-[110px] ${dimClass(deal)}`}>
                {deal.subjInterestRate ? `${deal.subjInterestRate}%` : '—'}
              </td>

              <td className={`px-3 py-3 text-sm min-w-[130px] ${dimClass(deal)}`}>
                {deal.totalMonthlyPayment ? `$${formatPrice(deal.totalMonthlyPayment)}` : '—'}
              </td>

              <td className={`px-3 py-3 min-w-[90px] ${dimClass(deal)}`}>
                {deal.priorityFirstAccess && (
                  <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                    Premium
                  </span>
                )}
              </td>

              <td className={`px-3 py-3 text-sm min-w-[100px] ${dimClass(deal)}`}>
                {FINANCING_LABELS[deal.financingType?.toLowerCase()] || deal.financingType || ''}
              </td>

              {/* ✅ STICKY STATUS CELL */}
              <td className={`px-3 py-3 min-w-[90px] sticky right-[60px] bg-white z-10 ${dimClass(deal)}`}>
                <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                  {deal.status}
                </span>
              </td>

              {/* ✅ STICKY ACTION CELL */}
          <td
  className="px-3 py-3 text-center min-w-[60px] sticky right-0 bg-white z-20"
  onClick={(e) => e.stopPropagation()}
>
                <div className="relative inline-block">
                     

			<button
			ref={openActionMenu === deal.id ? actionBtnRef : undefined}
			className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-text-secondary hover:text-text-primary"
			onClick={(e) => toggleActionMenu(deal.id, e.currentTarget)} 
			title="Actions"
			>
			<HiOutlineCog6Tooth className="w-5 h-5" />
			</button>
			{openActionMenu === deal.id && (
			<div
			ref={actionMenuRef}
			className={`absolute right-0 bg-white border border-border-subtle rounded-xl shadow-lg p-2 min-w-[170px]
			${menuDirection === 'down' ? 'top-full mt-2' : 'bottom-full mb-2'}
			`}
			style={{ zIndex: 9999 }}
			>

			<button
className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${deal.status === 'published' || deal.status === 'sold' ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-50 text-text-primary'}`}
onClick={() => { if (deal.status !== 'published' && deal.status !== 'sold') { openUnderwriting(deal); setOpenActionMenu(null); } }}
disabled={deal.status === 'published' || deal.status === 'sold'}
>Underwriting</button>
<button
className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${deal.status === 'published' || deal.status === 'sold' ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-50 text-text-primary'}`}
onClick={() => { if (deal.status !== 'published' && deal.status !== 'sold') { handleEdit(deal); setOpenActionMenu(null); } }}
disabled={deal.status === 'published' || deal.status === 'sold'}
>Edit</button>
{deal.status === 'pending' && (
<>
<button className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-green-50 text-green-700 transition-colors" onClick={() => { handleApprove(deal.id); setOpenActionMenu(null); }}>Approve</button>
<button className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-red-50 text-red-600 transition-colors" onClick={() => { handleReject(deal); setOpenActionMenu(null); }}>Reject</button>
</>
)}

{deal.status === 'rejected' && user?.role === 'admin' && (
  <>
    <button
      className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-green-50 text-green-700 transition-colors"
      onClick={() => { handleApprove(deal.id); setOpenActionMenu(null); }}
    >
      Approve
    </button>
    <button
      className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-red-50 text-red-600 transition-colors"
      onClick={() => { setSelectedDeal(deal); setShowDeleteModal(true); setOpenActionMenu(null); }}
    >
      Delete
    </button>
  </>
)}


{deal.status === 'rejected' && user?.role === 'team_member' && (
<span className="block px-3 py-2 text-sm text-gray-400">Awaiting Admin Delete</span>
)}
{deal.status === 'approved' && user?.role === 'admin' && (
<button className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-blue-50 text-blue-700 transition-colors" onClick={() => { handlePublish(deal.id); setOpenActionMenu(null); }}>Publish</button>
)}
{deal.status === 'approved' && user?.role === 'team_member' && (
<span className="block px-3 py-2 text-sm text-gray-400">Awaiting Admin Publish</span>
)}
{deal.status === 'published' && user?.role === 'admin' && (
<button className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-blue-50 text-blue-700 transition-colors" onClick={() => { handleUnpublish(deal.id); setOpenActionMenu(null); }}>Unpublish</button>
)}
{deal.status === 'published' && (user?.role === 'admin' || user?.role === 'team_member') && (
<button className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-amber-50 text-amber-700 transition-colors" onClick={() => { handleMarkAsSold(deal.id); setOpenActionMenu(null); }}>Mark Sold</button>
)}
{deal.status === 'sold' && (user?.role === 'admin' || user?.role === 'team_member') && (
<button className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-blue-50 text-blue-700 transition-colors" onClick={() => { handleRevertSold(deal.id); setOpenActionMenu(null); }}>Revert Sold</button>
)}

		
							
							
							
							
                          </div>
                        )}
                      </div>
              </td>

            </tr>
          ))}
        </tbody>

      </table>
    </div>
  </div>
)}
		
		
        <Pagination currentPage={dealPage} totalItems={filteredDeals.length} onPageChange={setDealPage} />
      </div>

      {/* Edit Modal */}
      {editingDeal && (
        <Modal isOpen={!!editingDeal} onClose={() => setEditingDeal(null)} title="Edit Deal" size="xl">
          <div className="space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Full Name" value={editingDeal?.submitter?.name || editingDeal?.submitterName || ''} readOnly className="cursor-not-allowed bg-app" />
              <Input label="Email" value={editingDeal?.submitter?.email || editingDeal?.submitterEmail || ''} readOnly className="cursor-not-allowed bg-app" />
              <Input label="Phone" value={formatPhoneDisplay(editingDeal?.submitter?.phone || editingDeal?.submitterPhone || '')} readOnly className="cursor-not-allowed bg-app" />
              <Input label="User Type" value={getUserTypeLabel(editingDeal?.submitter?.userType || editingDeal?.submitterUserType) || ''} readOnly className="cursor-not-allowed bg-app" />
              <Select
                label="Submitter Relationship"
                value={editingDeal.submitterRelationship || ''}
                onChange={(e) => setEditingDeal((prev) => ({ ...prev, submitterRelationship: e.target.value }))}
                options={[
                  { value: 'TEAM_MEMBER', label: 'Team Member' },
                  { value: 'REALTOR_LISTING_OWNER', label: 'Realtor – Listing Owner' },
                  { value: 'REALTOR_NOT_LISTING_OWNER', label: 'Realtor – Not Listing Owner' },
                  { value: 'WHOLESALER_HOLDS_CONTRACT', label: 'Wholesaler – Holds Contract' },
                  { value: 'WHOLESALER_NO_CONTRACT', label: 'Wholesaler – No Contract' },
                  { value: 'REAL_ESTATE_PROFESSIONAL', label: 'Real Estate Professional' },
                  { value: 'BIRDDOGGER', label: 'Bird Dogger' },
                ]}
              />
            </div>

            <div className="bg-surface border border-border-subtle rounded-lg p-4 mb-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={!!editingDeal.priorityFirstAccess} onChange={(e) => setEditingDeal((prev) => ({ ...prev, priorityFirstAccess: e.target.checked }))} className="mt-1 w-5 h-5 accent-accent" />
                <div>
                  <div className="text-base font-semibold text-text-primary">Premium First Access</div>
                  <div className="text-sm text-text-secondary mt-0.5">Give this property early visibility to VIP users before public release.</div>
                </div>
              </label>
            </div>

            <div className="bg-surface border border-border-subtle rounded-lg p-4 mb-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={!!editingDeal.fiftyFiftyPartner} onChange={(e) => setEditingDeal((prev) => ({ ...prev, fiftyFiftyPartner: e.target.checked }))} className="mt-1 w-5 h-5 accent-accent" />
                <div>
                  <div className="text-base font-semibold text-text-primary">50-50 Partnership Opportunity</div>
                  <div className="text-sm text-text-secondary mt-0.5">Mark this property as a potential 50-50 partnership.</div>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Street Address" value={editingDeal.streetAddress || ''} error={editErrors.streetAddress} ref={(el) => (editErrorRefs.current.streetAddress = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, streetAddress: e.target.value }))} />
              <Input label="Address Line 2" value={editingDeal.addressLine2 || ''} onChange={(e) => setEditingDeal((prev) => ({ ...prev, addressLine2: e.target.value }))} />
              <Input label="City" value={editingDeal.city || ''} error={editErrors.city} ref={(el) => (editErrorRefs.current.city = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, city: e.target.value }))} />
              <Input label="State/Region/Province" value={editingDeal.stateRegion || ''} error={editErrors.stateRegion} ref={(el) => (editErrorRefs.current.stateRegion = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, stateRegion: e.target.value }))} />
              <Input label="Postal/Zip Code" value={editingDeal.postalCode || ''} error={editErrors.postalCode} ref={(el) => (editErrorRefs.current.postalCode = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, postalCode: e.target.value }))} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label="Category" value={editingDeal.category || ''} error={editErrors.category} ref={(el) => (editErrorRefs.current.category = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, category: e.target.value }))} options={CATEGORIES.filter((opt) => opt.value !== 'All')} />
              <Select
                label="Turnkey/Furnished"
                value={editingDeal.turnkeyFurnished || ''}
                error={editErrors.turnkeyFurnished}
                ref={(el) => (editErrorRefs.current.turnkeyFurnished = el)}
                onChange={(e) => setEditingDeal((prev) => ({ ...prev, turnkeyFurnished: e.target.value }))}
                options={[
                  { value: 'TURNKEY_OPERATING', label: 'Turnkey and Currently Operating As a Short-Term Rental.' },
                  { value: 'FURNISHED_NOT_OPERATING', label: 'Fully Furnished but not Currently Operating As a Short-Term Rental.' },
                  { value: 'PARTIALLY_FURNISHED', label: 'Partially Furnished but not Currently Operating As a Short-Term Rental.' },
                  { value: 'NOT_FURNISHED', label: 'Not Furnished or Currently Operating as a Short-Term Rental.' },
                ]}
              />
              <Input label="Bedrooms" type="text" inputMode="numeric" value={formatNumber(editingDeal.bedrooms || '')} error={editErrors.bedrooms} ref={(el) => (editErrorRefs.current.bedrooms = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, bedrooms: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
              <Input label="Bathrooms" type="text" inputMode="numeric" value={formatNumber(editingDeal.bathrooms || '')} error={editErrors.bathrooms} ref={(el) => (editErrorRefs.current.bathrooms = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, bathrooms: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
              <Input label="Year Built" type="text" inputMode="numeric" value={editingDeal.yearBuilt || ''} error={editErrors.yearBuilt} ref={(el) => (editErrorRefs.current.yearBuilt = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, yearBuilt: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
              <Input label="Square Footage" type="text" inputMode="numeric" value={formatNumber(editingDeal.squareFootage || '')} error={editErrors.squareFootage} ref={(el) => (editErrorRefs.current.squareFootage = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, squareFootage: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
            </div>

            <Input label="Title" value={editingDeal.title || ''} readOnly className="bg-app cursor-not-allowed" />
            <Textarea label="Description" value={editingDeal.description || ''} error={editErrors.description} ref={(el) => (editErrorRefs.current.description = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, description: e.target.value }))} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="HOA"
                value={editingDeal.isHOA ? 'YES' : 'NO'}
                onChange={(e) => { const isHOA = e.target.value === 'YES'; setEditingDeal((prev) => ({ ...prev, isHOA, hoaMonthlyFee: isHOA ? prev.hoaMonthlyFee : null })); }}
                options={[{ value: 'NO', label: 'No' }, { value: 'YES', label: 'Yes' }]}
              />
              <Input label="HOA Monthly Fee" type="text" inputMode="numeric" value={formatNumber(editingDeal.hoaMonthlyFee || '')} error={editErrors.hoaMonthlyFee} ref={(el) => (editErrorRefs.current.hoaMonthlyFee = el)} disabled={!editingDeal.isHOA} className={!editingDeal.isHOA ? 'bg-app cursor-not-allowed' : ''} placeholder={editingDeal.isHOA ? '' : 'N/A'} onChange={(e) => setEditingDeal((prev) => ({ ...prev, hoaMonthlyFee: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Price" type="text" inputMode="numeric" value={formatNumber(editingDeal.price || '')} error={editErrors.price} ref={(el) => (editErrorRefs.current.price = el)} disabled={editingDeal.status === 'sold'} onChange={(e) => setEditingDeal((prev) => ({ ...prev, price: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label="Financing Type" value={editingDeal.financingType || ''} error={editErrors.financingType} ref={(el) => (editErrorRefs.current.financingType = el)} disabled={editingDeal.status === 'sold'} onChange={(e) => setEditingDeal((prev) => ({ ...prev, financingType: e.target.value }))} options={[{ value: 'traditional', label: 'Traditional' }, { value: 'subject-to', label: 'Subject-To' }, { value: 'hybrid', label: 'Hybrid' }, { value: 'seller', label: 'Seller Financing' }, { value: 'cash', label: 'Cash' }]} />
              <Input label="EMD" type="text" inputMode="numeric" value={formatNumber(editingDeal.emd || '')} error={editErrors.emd} ref={(el) => (editErrorRefs.current.emd = el)} disabled={editingDeal.status === 'sold'} onChange={(e) => setEditingDeal((prev) => ({ ...prev, emd: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
              <Input label="Down Payment" type="text" inputMode="numeric" value={formatNumber(editingDeal.downPayment || '')} disabled={editingDeal.status === 'sold'} onChange={(e) => setEditingDeal((prev) => ({ ...prev, downPayment: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
              <DateInput label="Expected Close of Escrow" name="expectedCloseDate" value={editingDeal.expectedCloseDate ?? ''} error={editErrors.expectedCloseDate} ref={(el) => (editErrorRefs.current.expectedCloseDate = el)} disabled={editingDeal.status === 'sold'} onChange={(e) => setEditingDeal((prev) => ({ ...prev, expectedCloseDate: e.target.value }))} placeholder="Select date" />
            </div>

            <Textarea label="Additional Financial Information" value={editingDeal.financialInfo || ''} error={editErrors.financialInfo} ref={(el) => (editErrorRefs.current.financialInfo = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, financialInfo: e.target.value }))} />

            {/* Subject-to Loan Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Subject-to Loan Balance" type="text" inputMode="numeric" value={formatNumber(editingDeal.subjLoanBalance || '')} error={editErrors.subjLoanBalance} ref={(el) => (editErrorRefs.current.subjLoanBalance = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, subjLoanBalance: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
              <Input label="Subject-to Interest Rate" type="text" inputMode="numeric" value={formatNumber(editingDeal.subjInterestRate || '')} error={editErrors.subjInterestRate} ref={(el) => (editErrorRefs.current.subjInterestRate = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, subjInterestRate: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
              <DateInput label="Subject-to Loan Maturity" name="subjLoanMaturity" value={editingDeal.subjLoanMaturity ?? ''} error={editErrors.subjLoanMaturity} ref={(el) => (editErrorRefs.current.subjLoanMaturity = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, subjLoanMaturity: e.target.value }))} placeholder="Select date" />
              <Input label="Subject-to Monthly Principal" type="text" inputMode="numeric" value={formatNumber(editingDeal.subjMonthlyPrincipal || '')} error={editErrors.subjMonthlyPrincipal} ref={(el) => (editErrorRefs.current.subjMonthlyPrincipal = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, subjMonthlyPrincipal: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
              <Input label="Subject-to Monthly Interest" type="text" inputMode="numeric" value={formatNumber(editingDeal.subjMonthlyInterest || '')} error={editErrors.subjMonthlyInterest} ref={(el) => (editErrorRefs.current.subjMonthlyInterest = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, subjMonthlyInterest: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
              <Input label="Subject-to Monthly Taxes & Insurance" type="text" inputMode="numeric" value={formatNumber(editingDeal.subjMonthlyTaxesInsurance || '')} error={editErrors.subjMonthlyTaxesInsurance} ref={(el) => (editErrorRefs.current.subjMonthlyTaxesInsurance = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, subjMonthlyTaxesInsurance: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
            </div>

            {/* Seller Financing Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Seller Loan Amount" type="text" inputMode="numeric" value={formatNumber(editingDeal.sellerLoanAmount || '')} error={editErrors.sellerLoanAmount} ref={(el) => (editErrorRefs.current.sellerLoanAmount = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, sellerLoanAmount: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
              <Input label="Seller Interest Rate" type="text" inputMode="numeric" value={formatNumber(editingDeal.sellerInterestRate || '')} error={editErrors.sellerInterestRate} ref={(el) => (editErrorRefs.current.sellerInterestRate = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, sellerInterestRate: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
              <DateInput label="Seller Loan Maturity" name="sellerLoanMaturity" value={editingDeal.sellerLoanMaturity ?? ''} error={editErrors.sellerLoanMaturity} ref={(el) => (editErrorRefs.current.sellerLoanMaturity = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, sellerLoanMaturity: e.target.value }))} placeholder="Select date" />
              <Input label="Seller Monthly Payment" type="text" inputMode="numeric" value={formatNumber(editingDeal.sellerMonthlyPayment || '')} error={editErrors.sellerMonthlyPayment} ref={(el) => (editErrorRefs.current.sellerMonthlyPayment = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, sellerMonthlyPayment: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
              <Input label="Total Monthly Payment" type="text" inputMode="numeric" value={formatNumber(editingDeal.totalMonthlyPayment || '')} error={editErrors.totalMonthlyPayment} ref={(el) => (editErrorRefs.current.totalMonthlyPayment = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, totalMonthlyPayment: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
            </div>

            {/* STR Data */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label="STR Zoning" value={editingDeal.strZoning || ''} error={editErrors.strZoning} ref={(el) => (editErrorRefs.current.strZoning = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, strZoning: e.target.value }))} options={[{ value: 'YES', label: 'Yes' }, { value: 'NO', label: 'No' }, { value: 'UNSURE', label: 'Unsure' }]} />
              <Select label="STR Confidence" value={editingDeal.strConfidence || ''} error={editErrors.strConfidence} ref={(el) => (editErrorRefs.current.strConfidence = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, strConfidence: e.target.value }))} options={[{ value: 'FIRST_HAND', label: 'First Hand information' }, { value: 'AIRDNA', label: 'Based on AirDNA' }, { value: 'DIRECTIONAL_ONLY', label: 'Directional only / not fully confident' }]} />
              <Input label="STR Listing Link" value={editingDeal.strListingLink || ''} onChange={(e) => setEditingDeal((prev) => ({ ...prev, strListingLink: e.target.value }))} />
              <Input label="STR Data Sheets Link" value={editingDeal.strDataSheetsLink || ''} onChange={(e) => setEditingDeal((prev) => ({ ...prev, strDataSheetsLink: e.target.value }))} />
            </div>

            <CheckboxGroup label="Vacation Rental Markets" options={VACATION_RENTAL_MARKETS} values={editingDeal.vacationRentalMarkets || []} onChange={(vals) => setEditingDeal((prev) => ({ ...prev, vacationRentalMarkets: vals }))} />

            {/* Travel Motivations */}
            <div className="mb-6">
              <label className="block text-base font-semibold text-text-primary mb-2">Why Do People Travel to This Destination?</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {['Conventions & Conferences', 'Exhibitions & Trade Shows', 'Medical Facilities', 'College Activities', 'Sporting Events', 'Theme Parks', 'Relax & Unwind', 'Sportsman Destinations – Fishing & Hunting', 'Outdoor Activities – Hiking, Biking, Rafting, Skiing, Boating', 'State & National Park Visits', 'Unplug & Disconnect', 'Experience a Unique Culture', 'Romantic Getaway', 'Historic Districts & Attractions', 'Bleisure – Business & Leisure Travel', 'Food & Wine Tasting', 'Art & Cultural Experience'].map((reason) => (
                  <label key={reason} className="flex items-center space-x-2">
                    <input type="checkbox" checked={editingDeal.travelMotivations?.includes(reason) || false} onChange={(e) => setEditingDeal((prev) => ({ ...prev, travelMotivations: e.target.checked ? [...(prev.travelMotivations || []), reason] : (prev.travelMotivations || []).filter((r) => r !== reason) }))} />
                    <span className="text-sm text-text-primary">{reason}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <Textarea label={<span className="text-base font-semibold">What Do Rental Guests Want Most in This Area?</span>} value={editingDeal.guestDemandInsights || ''} error={editErrors.guestDemandInsights} ref={(el) => (editErrorRefs.current.guestDemandInsights = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, guestDemandInsights: e.target.value }))} rows={4} placeholder="Insights into guest expectations, amenities, or experiences..." />
              <Textarea label={<span className="text-base font-semibold">How Can We Add Value to This Property to Increase Income?</span>} value={editingDeal.valueAddOpportunities || ''} error={editErrors.valueAddOpportunities} ref={(el) => (editErrorRefs.current.valueAddOpportunities = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, valueAddOpportunities: e.target.value }))} rows={4} placeholder="Examples: pool, hot tub, bikes, beach gear, game tables, etc." />
              <Textarea label={<span className="text-base font-semibold">Recommended Property Managers, Contractors, or Cleaning Companies</span>} value={editingDeal.localContacts || ''} error={editErrors.localContacts} ref={(el) => (editErrorRefs.current.localContacts = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, localContacts: e.target.value }))} rows={4} placeholder="List any trusted local contacts buyers could use..." />
            </div>

            {/* Media */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-text-primary mb-4">Property Photos and Videos</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FileUpload label="Interior Photos" accept="image/*" multiple value={editingDeal.interiorImages || []} onChange={(urls) => setEditingDeal((prev) => ({ ...prev, interiorImages: urls }))} error={editErrors?.interiorImages} ref={(el) => (editErrorRefs.current.interiorImages = el)} />
                <FileUpload label="Exterior Photos" accept="image/*" multiple value={editingDeal.exteriorImages || []} onChange={(urls) => setEditingDeal((prev) => ({ ...prev, exteriorImages: urls }))} error={editErrors?.exteriorImages} ref={(el) => (editErrorRefs.current.exteriorImages = el)} />
                <div className="col-span-full">
                  <FileUpload label="Additional Photos" accept="image/*" multiple value={editingDeal.additionalImages || []} onChange={(urls) => setEditingDeal((prev) => ({ ...prev, additionalImages: urls }))} error={editErrors?.additionalImages} />
                </div>
              </div>
              <div className="mt-6">
                <FileUpload label="Videos" accept="video/*" multiple value={editingDeal.videos || []} onChange={(urls) => setEditingDeal((prev) => ({ ...prev, videos: urls }))} />
              </div>
            </div>

            <Input label="Special Tags (comma separated)" value={(editingDeal.specialTags || []).join(', ')} onChange={(e) => setEditingDeal((prev) => ({ ...prev, specialTags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} />
            <Textarea label="Additional Info" value={editingDeal.additionalInfo || ''} error={editErrors.additionalInfo} ref={(el) => (editErrorRefs.current.additionalInfo = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, additionalInfo: e.target.value }))} />

            {Object.keys(editErrors).length > 0 && (
              <div className="mb-4 rounded border border-border-subtle bg-surface p-4">
                <p className="font-semibold text-text-primary mb-2">Please fix the following errors:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-text-secondary">
                  {Object.entries(editErrors).map(([field, message]) => (
                    <li key={field}>
                      <button type="button" onClick={() => { const ref = editErrorRefs.current[field]; ref?.scrollIntoView({ behavior: 'smooth', block: 'center' }); ref?.focus?.(); }}>
                        {field}: {message}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 border-t border-border-subtle pt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setEditingDeal(null)}>Cancel</Button>
              <Button variant="primary" onClick={saveEdit} loading={updateMutation.isPending}>Save Changes</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Underwriting Modal */}
      {underwritingDeal && (
        <Modal isOpen={!!underwritingDeal} onClose={() => setUnderwritingDeal(null)} title="Underwriting & Analysis" size="xl">
          <div className="space-y-10 max-h-[80vh] overflow-y-auto">
            <div className="p-6 space-y-10">
              {/* Market Definition */}
              <section className="space-y-6">
                <h3 className="text-lg font-semibold text-text-primary">Market Definition</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select label="Market Type" value={underwritingDeal.underwritingMarketType || ''} error={editErrors.underwritingMarketType} ref={(el) => (editErrorRefs.current.underwritingMarketType = el)} onChange={(e) => setUnderwritingDeal((prev) => ({ ...prev, underwritingMarketType: e.target.value }))} options={[{ value: 'MARKET', label: 'Market' }, { value: 'SUBMARKET', label: 'Submarket' }]} />
                  <Select label="Market Size (Active Listings)" value={underwritingDeal.underwritingMarketSize || ''} error={editErrors.underwritingMarketSize} ref={(el) => (editErrorRefs.current.underwritingMarketSize = el)} onChange={(e) => setUnderwritingDeal((prev) => ({ ...prev, underwritingMarketSize: e.target.value }))} options={[{ value: '<50', label: 'Less Than 50' }, { value: '51-100', label: '51–100' }, { value: '101-250', label: '101–250 (Recommended)' }, { value: '251-500', label: '251–500 (Recommended)' }, { value: '500+', label: 'Over 500' }]} />
                </div>
              </section>

              {/* Total Market Revenue */}
              <section className="space-y-6">
                <h3 className="text-lg font-semibold text-text-primary">Total Market Revenue</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[12, 24, 36, 48, 60, 72, 84].map((m) => (
                    <NumericInput key={m} label={`${m} Months ($)`} value={formatNumber(underwritingDeal[`marketRevenue_${m}m`] || '')} error={editErrors[`marketRevenue_${m}m`]} ref={(el) => (editErrorRefs.current[`marketRevenue_${m}m`] = el)} onChange={(e) => setUnderwritingDeal((prev) => ({ ...prev, [`marketRevenue_${m}m`]: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                  ))}
                </div>
              </section>

              {/* Market Occupancy */}
              <section className="space-y-6">
                <h3 className="text-lg font-semibold text-text-primary">Estimated Occupancy</h3>
                <div className="grid grid-cols-1 gap-4 max-w-xs">
                  <NumericInput label="Occupancy (%)" value={underwritingDeal?.occupancyRate ?? ''} error={editErrors.occupancyRate} ref={(el) => (editErrorRefs.current.occupancyRate = el)} onChange={(e) => setUnderwritingDeal((prev) => ({ ...prev, occupancyRate: unformatNumber(e.target.value).replace(/[^0-9.]/g, '') }))} />
                </div>
              </section>

              {/* ANR */}
              <section className="space-y-6">
                <h3 className="text-lg font-semibold text-text-primary">Average Nightly Rate (ANR)</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {['budget', 'economy', 'midscale', 'upscale', 'luxury'].map((tier) => (
                    <NumericInput key={tier} label={tier.charAt(0).toUpperCase() + tier.slice(1) + ' ($)'} value={formatNumber(underwritingDeal[`anr_${tier}`] || '')} error={editErrors[`anr_${tier}`]} ref={(el) => (editErrorRefs.current[`anr_${tier}`] = el)} onChange={(e) => setUnderwritingDeal((prev) => ({ ...prev, [`anr_${tier}`]: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                  ))}
                </div>
              </section>

              {/* EGR */}
              <section className="space-y-6">
                <h3 className="text-lg font-semibold text-text-primary">Estimated Gross Revenue (EGR)</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {['budget', 'economy', 'midscale', 'upscale', 'luxury'].map((tier) => (
                    <NumericInput key={tier} label={tier.charAt(0).toUpperCase() + tier.slice(1) + ' ($)'} value={formatNumber(underwritingDeal[`egr_${tier}`] || '')} error={editErrors[`egr_${tier}`]} ref={(el) => (editErrorRefs.current[`egr_${tier}`] = el)} onChange={(e) => setUnderwritingDeal((prev) => ({ ...prev, [`egr_${tier}`]: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                  ))}
                </div>
              </section>

              {/* Cost Segregation */}
              <section className="space-y-6">
                <h3 className="text-lg font-semibold text-text-primary">Cost Segregation, Bonus Depreciation, and Tax Scholarships</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label="Purchase Price ($)" type="text" inputMode="numeric" value={formatNumber(underwritingDeal?.price || '')} disabled />
                  <NumericInput label="Cost Segregation (%)" value={underwritingDeal.costSegregationPercent || ''} error={editErrors.costSegregationPercent} ref={(el) => (editErrorRefs.current.costSegregationPercent = el)} onChange={(e) => setUnderwritingDeal((prev) => ({ ...prev, costSegregationPercent: unformatNumber(e.target.value).replace(/[^0-9.]/g, '') }))} />
                 
				<NumericInput
  label="Income Reduction ($)"
  value={formatNumber(underwritingDeal.incomeReduction || '')}
  error={editErrors.incomeReduction}
  ref={(el) => (editErrorRefs.current.incomeReduction = el)}
  onChange={(e) =>
    setUnderwritingDeal((prev) => ({
      ...prev,
      incomeReduction: unformatNumber(e.target.value).replace(/[^0-9]/g, ''),
    }))
  }
/>
				  
                  <NumericInput label="Tax Rate (%)" value={underwritingDeal.effectiveTaxRate || ''} error={editErrors.effectiveTaxRate} ref={(el) => (editErrorRefs.current.effectiveTaxRate = el)} onChange={(e) => setUnderwritingDeal((prev) => ({ ...prev, effectiveTaxRate: unformatNumber(e.target.value).replace(/[^0-9.]/g, '') }))} />
				  
                {/* ✅ Tax Savings — validated on submit via validateDealForm (0 to $500,000) */}
<NumericInput
  label="Tax Savings ($)"
  value={formatNumber(underwritingDeal.taxSavings || '')}
  error={editErrors.taxSavings}
  ref={(el) => (editErrorRefs.current.taxSavings = el)}
  onChange={(e) =>
    setUnderwritingDeal((prev) => ({
      ...prev,
      taxSavings: unformatNumber(e.target.value).replace(/[^0-9]/g, ''),
    }))
  }
/>

				  
				  
                </div>
              </section>

              {/* Market Analysis */}
              <section className="space-y-6">
                <h3 className="text-lg font-semibold text-text-primary">Market Analysis and Investment Analyzer Worksheet</h3>
                <Input label="Worksheet / Analysis Link" type="url" value={underwritingDeal.marketAnalysisLink || ''} error={editErrors.marketAnalysisLink} ref={(el) => (editErrorRefs.current.marketAnalysisLink = el)} onChange={(e) => setUnderwritingDeal((prev) => ({ ...prev, marketAnalysisLink: e.target.value }))} />
              </section>

              {/* Top Properties / Comps */}
              <section className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">Top Properties (Comps)</h3>
                  <p className="text-sm text-text-secondary">The following are examples of the top properties in the area to show <span className="font-semibold">Potential Gross Revenue</span> if you could get this property to the top of the market.</p>
                  <p className="text-xs text-text-secondary italic">This DOES NOT suggest that this property in its current condition will produce this level of revenue.</p>
                </div>
                <div className="space-y-6">
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <div key={num} className="space-y-4">
                      <h4 className="font-medium text-text-primary">Property {num}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Property Link" type="url" value={underwritingDeal[`comp_${num}_link`] || ''} error={editErrors[`comp_${num}_link`]} ref={(el) => (editErrorRefs.current[`comp_${num}_link`] = el)} onChange={(e) => setUnderwritingDeal((prev) => ({ ...prev, [`comp_${num}_link`]: e.target.value }))} />
                        <Input label="Listing ID" value={underwritingDeal[`comp_${num}_id`] || ''} error={editErrors[`comp_${num}_id`]} ref={(el) => (editErrorRefs.current[`comp_${num}_id`] = el)} onChange={(e) => setUnderwritingDeal((prev) => ({ ...prev, [`comp_${num}_id`]: e.target.value }))} />
                        <NumericInput label="Gross Revenue ($)" value={formatNumber(underwritingDeal[`comp_${num}_grossRevenue`] || '')} error={editErrors[`comp_${num}_grossRevenue`]} ref={(el) => (editErrorRefs.current[`comp_${num}_grossRevenue`] = el)} onChange={(e) => setUnderwritingDeal((prev) => ({ ...prev, [`comp_${num}_grossRevenue`]: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Underwriting Images */}
              <section className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">Underwriting Images</h3>
                  <p className="text-sm text-text-secondary">Upload supporting screenshots, spreadsheets, analyses, or reference images used during underwriting.</p>
                </div>
                <FileUpload accept="image/*" multiple value={underwritingDeal.underwritingImages || []} onChange={(urls) => setUnderwritingDeal((prev) => ({ ...prev, underwritingImages: urls }))} error={editErrors?.underwritingImages} ref={(el) => (editErrorRefs.current.underwritingImages = el)} />
              </section>
            </div>

            <div className="mt-6 border-t border-border-subtle pt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setUnderwritingDeal(null)}>Cancel</Button>
              <Button variant="primary" onClick={saveUnderwriting} loading={updateMutation.isPending}>Save Underwriting</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Approve Confirm Modal */}
      <Modal isOpen={!!confirmApproveId} onClose={() => setConfirmApproveId(null)} title="Approve Deal" size="sm">
        {confirmApproveId && (() => {
          const deal = filteredDeals?.find((d) => d.id === confirmApproveId);
          return (
            <div className="space-y-4">
              <p className="text-text-primary">Are you sure you want to <strong>approve</strong> this deal?</p>
              {deal && (
                <div className="bg-surface border border-border-subtle p-3 rounded text-sm space-y-1">
                  <div><strong>Title:</strong> {deal.title}</div>
                  <div><strong>Submitted By:</strong> {deal.submitterEmail || '—'}</div>
                  <div><strong>Price:</strong> ${formatPrice(deal.price)}</div>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" onClick={() => setConfirmApproveId(null)} className="min-w-[100px]">Cancel</Button>
                <Button variant="success" onClick={() => approveMutation.mutate(confirmApproveId)} loading={approveMutation.isPending} className="min-w-[130px]">Approve Deal</Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Mark as Sold Confirm Modal */}
      <Modal isOpen={!!confirmSoldId} onClose={() => setConfirmSoldId(null)} title="Mark as Sold" size="sm">
        <div className="space-y-4">
          <p className="text-text-primary">Mark this property as sold?</p>
          <div className="bg-surface border border-border-subtle p-3 rounded text-sm space-y-1">
            <p className="font-medium text-text-primary">This will:</p>
            <ul className="list-disc list-inside space-y-1 text-text-secondary">
              <li>Remove it from public listings</li>
              <li>Prevent republishing</li>
              <li>Lock availability fields</li>
            </ul>
            <p className="text-text-secondary pt-1">You can revert this later if needed.</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setConfirmSoldId(null)} className="min-w-[100px]">Cancel</Button>
            <Button variant="primary" onClick={() => markAsSoldMutation.mutate(confirmSoldId)} loading={markAsSoldMutation.isPending} className="min-w-[140px]">Mark as Sold</Button>
          </div>
        </div>
      </Modal>

      {/* Revert Sold Confirm Modal */}
      <Modal isOpen={!!confirmRevertSoldId} onClose={() => setConfirmRevertSoldId(null)} title="Revert Sold Status" size="sm">
        <div className="space-y-4">
          <p className="text-text-primary">Revert sold status?</p>
          <p className="text-sm text-text-secondary">This will restore the property to published status and make it visible to clients again.</p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setConfirmRevertSoldId(null)} className="min-w-[100px]">Cancel</Button>
            <Button variant="primary" onClick={() => revertSoldMutation.mutate(confirmRevertSoldId)} loading={revertSoldMutation.isPending} className="min-w-[140px]">Revert Sold</Button>
          </div>
        </div>
      </Modal>

      {/* Publish Confirm Modal */}
      <Modal isOpen={!!confirmPublishId} onClose={() => setConfirmPublishId(null)} title="Publish Deal" size="sm">
        <div className="space-y-4">
          <p className="text-text-primary">Publish this deal to customer view?</p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setConfirmPublishId(null)} className="min-w-[100px]">Cancel</Button>
            <Button variant="primary" onClick={() => publishMutation.mutate(confirmPublishId)} loading={publishMutation.isPending} className="min-w-[120px]">Publish</Button>
          </div>
        </div>
      </Modal>

      {/* Unpublish Confirm Modal */}
      <Modal isOpen={!!confirmUnpublishId} onClose={() => setConfirmUnpublishId(null)} title="Unpublish Deal" size="sm">
        <div className="space-y-4">
          <p className="text-text-primary">Unpublish this deal? It will return to pending status.</p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setConfirmUnpublishId(null)} className="min-w-[100px]">Cancel</Button>
            <Button variant="danger" onClick={() => unpublishMutation.mutate(confirmUnpublishId)} loading={unpublishMutation.isPending} className="min-w-[130px]">Unpublish</Button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} title="Reject Deal">
        <div className="space-y-4">
          <p className="text-text-primary">Please provide a reason for rejecting this deal:</p>
          <textarea className="w-full px-3 py-2 border border-border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-accent" rows="4" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection..." />
          <div className="flex justify-end gap-3 items-center">
            <Button variant="secondary" onClick={() => setShowRejectModal(false)} className="min-w-[120px]">Cancel</Button>
            <Button variant="danger" onClick={confirmReject} loading={rejectMutation.isPending} className="min-w-[140px]">Confirm Reject</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Property" size="sm">
        {selectedDeal && (
          <div className="space-y-4">
            <p className="text-text-primary">This action is permanent and cannot be undone.</p>
            <div className="bg-surface border border-border-subtle p-3 rounded text-sm">
              <div><strong>Title:</strong> {selectedDeal.title}</div>
              <div><strong>Submitted By:</strong> {selectedDeal.submitterEmail || '—'}</div>
              <div><strong>Status:</strong> {selectedDeal.status}</div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-red-600 font-medium">Type DELETE to confirm:</p>
              <Input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder="DELETE" />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}>Cancel</Button>
              <Button variant="danger" disabled={deleteConfirmText !== 'DELETE' || deleteMutation.isLoading} onClick={() => deleteMutation.mutate(selectedDeal.id)}>Permanently Delete</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Notification Modal */}
      <NotificationModal
        isOpen={notification.open}
        onClose={closeNotification}
        type={notification.type}
        title={notification.title}
        message={notification.message}
      />
    </div>
  );
};

export default PropertyManagement;
