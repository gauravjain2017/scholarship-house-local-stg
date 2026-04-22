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

// Convert camelCase field name to human-readable label
const fieldToLabel = (field) =>
  field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).replace(/_/g, ' ');

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
  { value: 'expired', label: 'Expired' },
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

const ACCORDION_ICONS = {
  'User Information': (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  ),
  'Property': (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  ),
  'Location': (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  ),
  'Financial': (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'Additional': (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  'Rental Markets': (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 3.03v.568c0 .334.148.65.405.864l1.068.89c.442.369.535 1.01.216 1.49l-.51.766a2.25 2.25 0 01-1.161.886l-.143.048a1.107 1.107 0 00-.57 1.664c.369.555.169 1.307-.427 1.605L9 13.125l.423 1.059a.956.956 0 01-1.652.928l-.679-.906a1.125 1.125 0 00-1.906.172L4.5 15.75l-.612.153M12.75 3.031a9 9 0 00-8.862 12.872M12.75 3.031a9 9 0 016.69 14.036m0 0l-.177-.529A2.25 2.25 0 0017.128 15H16.5l-.324-.324a1.453 1.453 0 00-2.328.377l-.036.073a1.586 1.586 0 01-.982.816l-.99.282c-.55.157-.894.702-.8 1.267l.073.438c.08.474.49.821.97.821.846 0 1.598.542 1.865 1.345l.215.643m5.276-3.67a9.012 9.012 0 01-5.276 3.67" />
    </svg>
  ),
  'Property Photos and Videos': (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21zm16.5-13.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  ),
};

const UNDERWRITING_ICON = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);

const AccordionSection = ({ title, isOpen, onToggle, children }) => {
  const icon = ACCORDION_ICONS[title] || UNDERWRITING_ICON;
  return (
    <div className={`rounded-xl overflow-hidden transition-all duration-200 border ${isOpen ? 'border-blue-200 shadow-sm' : 'border-border-subtle shadow-sm hover:shadow-md'}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-all duration-200 ${isOpen ? 'bg-blue-50 hover:bg-blue-100/70' : 'bg-white hover:bg-gray-50'}`}
      >
        <span className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-colors ${isOpen ? 'bg-white text-blue-600 ring-1 ring-blue-200' : 'bg-blue-50 text-blue-600'}`}>
          {icon}
        </span>
        <span className="text-sm font-semibold truncate flex-1 text-text-primary">{title}</span>
        <svg
          className={`w-4 h-4 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-blue-500' : 'text-gray-400'}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="border-t border-blue-100 rounded-b-xl px-5 py-5 space-y-5 bg-white">
          {children}
        </div>
      )}
    </div>
  );
};

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
  const incomeReductionManualRef = useRef(false);
  // Refs hold the last source value each derived expense was synced from, so the
  // effects only overwrite the field when its source actually changes — preserving
  // any manual override the user has typed in the derived field.
  const lastSyncedClosingCostsSrcRef = useRef(null); // { price, financingType }
  const lastSyncedSquareFootageRef = useRef(null);
  const lastSyncedMonthlyPaymentRef = useRef(null);
  const lastSyncedHoaMonthlyRef = useRef(null);
  const lastSyncedCleaningSrcRef = useRef(null);

  const [openAccordions, setOpenAccordions] = useState({
    userInfo: true,
    property: false,
    location: false,
    financial: false,
    additional: false,
    rentalMarkets: false,
    photosVideos: false,
    marketDefinition: false,
    totalMarketRevenue: false,
    anr: false,
    egr: false,
    costSegregation: false,
    estimatedExpenses: false,
    marketAnalysis: false,
    top10Properties: false,
    underwritingImages: false,
  });
  const toggleAccordion = (key) => setOpenAccordions((prev) => {
    const isOpen = prev[key];
    const allClosed = Object.fromEntries(Object.keys(prev).map((k) => [k, false]));
    return { ...allClosed, [key]: !isOpen };
  });
  const expandAllAccordions = () => setOpenAccordions((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, true])));
  const collapseAllAccordions = () => setOpenAccordions((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, false])));

  const [editingDeal, setEditingDeal] = useState(null);
  const [topPropCount, setTopPropCount] = useState(1);
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
  const [reactivateDeal, setReactivateDeal] = useState(null);
  const [reactivateDate, setReactivateDate] = useState('');
  const [reactivateError, setReactivateError] = useState('');

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

  // console.log('deals : ',deals)

  const dealId = "8c925576-5ca1-4a31-9b63-0439c7339360";
  const selectedDeal1 = deals?.find(
    (deal) => deal.id === dealId
  );
  console.log(selectedDeal1);


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

  // Auto-compute EGR = Occupancy % × ANR for each tier whenever inputs change
  useEffect(() => {
    if (!editingDeal) return;
    const tiers = ['budget', 'economy', 'midscale', 'upscale', 'luxury'];
    const updates = {};
    let changed = false;
    tiers.forEach((tier) => {
      const anr = Number(editingDeal[`anr_${tier}`]) || 0;
      const occ = Number(editingDeal[`occupancyRate_${tier}`]) || 0;
      const daysOcc = (occ / 100) * 365;
      const raw = daysOcc * anr;
      let computedStr;
      if (!raw) computedStr = '';
      else if (raw < 1) computedStr = raw.toFixed(2);
      else computedStr = String(Math.round(raw));
      const currentStr = String(editingDeal[`egr_${tier}`] ?? '');
      if (computedStr !== currentStr) {
        updates[`egr_${tier}`] = computedStr;
        changed = true;
      }
    });
    if (changed) setEditingDeal((prev) => ({ ...prev, ...updates }));
  }, [
    editingDeal?.anr_budget, editingDeal?.occupancyRate_budget,
    editingDeal?.anr_economy, editingDeal?.occupancyRate_economy,
    editingDeal?.anr_midscale, editingDeal?.occupancyRate_midscale,
    editingDeal?.anr_upscale, editingDeal?.occupancyRate_upscale,
    editingDeal?.anr_luxury, editingDeal?.occupancyRate_luxury,
  ]);

  // Auto-compute comp Revenue = 365 × (Occupancy % / 100) × Daily Rate for each property
  const compRatesKey = editingDeal
    ? Array.from({ length: topPropCount }, (_, i) => i + 1)
        .map((n) => `${editingDeal[`comp_${n}_occupancy`] ?? ''}|${editingDeal[`comp_${n}_dailyRate`] ?? ''}`)
        .join(',')
    : '';
  useEffect(() => {
    if (!editingDeal) return;
    const updates = {};
    let changed = false;
    for (let num = 1; num <= topPropCount; num++) {
      const occ = Number(editingDeal[`comp_${num}_occupancy`]) || 0;
      const rate = Number(editingDeal[`comp_${num}_dailyRate`]) || 0;
      const computed = Math.round(365 * (occ / 100) * rate);
      const current = Number(editingDeal[`comp_${num}_grossRevenue`]) || 0;
      if (computed !== current) {
        updates[`comp_${num}_grossRevenue`] = computed ? String(computed) : '';
        changed = true;
      }
    }
    if (changed) setEditingDeal((prev) => ({ ...prev, ...updates }));
  }, [compRatesKey, topPropCount]);

  // Auto-compute AGR (Assumed Gross Revenue) and derived expenses from Budget tier
  // AGR        = 365 × (Budget Occupancy Rate % / 100) × Budget ANR
  // Sales Tax  = AGR × 6%
  // OTA Fees   = AGR × 15%
  // Management = AGR × 25%
  useEffect(() => {
    if (!editingDeal) return;
    const occ = Number(editingDeal.occupancyRate_budget) || 0;
    const nightRate = Number(editingDeal.anr_budget) || 0;
    const agr = Math.round(365 * (occ / 100) * nightRate);
    const salesTax = Math.round(agr * 0.06);
    const otaFees = Math.round(agr * 0.15);
    const management = Math.round(agr * 0.25);

    const updates = {};
    if (String(agr || '') !== String(editingDeal.agr || '')) {
      updates.agr = agr ? String(agr) : '';
    }
    if (String(salesTax || '') !== String(editingDeal.expenseSalesTax || '')) {
      updates.expenseSalesTax = salesTax ? String(salesTax) : '';
    }
    if (String(otaFees || '') !== String(editingDeal.expenseOTAFees || '')) {
      updates.expenseOTAFees = otaFees ? String(otaFees) : '';
    }
    if (String(management || '') !== String(editingDeal.expenseManagement || '')) {
      updates.expenseManagement = management ? String(management) : '';
    }
    if (Object.keys(updates).length) setEditingDeal((prev) => ({ ...prev, ...updates }));
  }, [editingDeal?.occupancyRate_budget, editingDeal?.anr_budget]);

  // Auto-compute Income Reduction and Tax Savings
  // Income Reduction = Cost Segregation % × Purchase Price  (or direct $ value when mode = 'value')
  // Tax Savings      = Income Reduction × Tax Rate
  useEffect(() => {
    if (!editingDeal) return;
    const mode = editingDeal.costSegregationMode || 'percent';
    const price = Number(editingDeal.price) || 0;
    const segPct = Number(editingDeal.costSegregationPercent) || 0;
    const segVal = Number(editingDeal.costSegregationValue) || 0;
    const taxRate = Number(editingDeal.effectiveTaxRate) || 0;

    const autoIncomeReduction = mode === 'value'
      ? Math.round(segVal)
      : Math.round((segPct / 100) * price);
    const effectiveIncomeReduction = incomeReductionManualRef.current
      ? Number(editingDeal.incomeReduction) || 0
      : autoIncomeReduction;
    const taxSavings = Math.round(effectiveIncomeReduction * (taxRate / 100));

    const updates = {};
    if (!incomeReductionManualRef.current &&
      String(autoIncomeReduction || '') !== String(editingDeal.incomeReduction || '')) {
      updates.incomeReduction = autoIncomeReduction ? String(autoIncomeReduction) : '';
    }
    if (String(taxSavings || '') !== String(editingDeal.taxSavings || '')) {
      updates.taxSavings = taxSavings ? String(taxSavings) : '';
    }
    if (Object.keys(updates).length) setEditingDeal((prev) => ({ ...prev, ...updates }));
  }, [
    editingDeal?.costSegregationMode,
    editingDeal?.costSegregationPercent,
    editingDeal?.costSegregationValue,
    editingDeal?.effectiveTaxRate,
    editingDeal?.price,
    editingDeal?.incomeReduction,
  ]);

  // Each derived expense auto-populates from its source inputs but stays manually
  // editable. Each effect only overwrites the field when its source actually
  // changes (tracked via ref), so user overrides aren't stomped by unrelated
  // re-renders.

  // Closing Costs = 3% of price (Traditional) or 1% (all other financing types)
  useEffect(() => {
    if (!editingDeal) return;
    const price = Number(editingDeal.price) || 0;
    const financingType = editingDeal.financingType || '';
    const prev = lastSyncedClosingCostsSrcRef.current;
    if (prev && prev.price === price && prev.financingType === financingType) return;
    lastSyncedClosingCostsSrcRef.current = { price, financingType };
    const rate = financingType === 'traditional' ? 0.03 : 0.01;
    const computed = Math.round(price * rate);
    setEditingDeal((p) => ({
      ...p,
      expenseClosingCosts: computed ? String(computed) : '',
    }));
  }, [editingDeal?.price, editingDeal?.financingType]);

  // Design / Renovation = Square Footage × $45
  useEffect(() => {
    if (!editingDeal) return;
    const sqft = Number(editingDeal.squareFootage) || 0;
    if (lastSyncedSquareFootageRef.current === sqft) return;
    lastSyncedSquareFootageRef.current = sqft;
    const computed = Math.round(sqft * 45);
    setEditingDeal((p) => ({
      ...p,
      expenseDesignFurnishing: computed ? String(computed) : '',
    }));
  }, [editingDeal?.squareFootage]);

  // Principal & Interest = Total Monthly Payment × 12
  useEffect(() => {
    if (!editingDeal) return;
    const monthlyPayment = Number(editingDeal.totalMonthlyPayment) || 0;
    if (lastSyncedMonthlyPaymentRef.current === monthlyPayment) return;
    lastSyncedMonthlyPaymentRef.current = monthlyPayment;
    const computed = Math.round(monthlyPayment * 12);
    setEditingDeal((p) => ({
      ...p,
      expensePrincipalInterest: computed ? String(computed) : '',
    }));
  }, [editingDeal?.totalMonthlyPayment]);

  // HOA Fees (Annual) = HOA Monthly Fee × 12
  useEffect(() => {
    if (!editingDeal) return;
    const hoaMonthly = Number(editingDeal.hoaMonthlyFee) || 0;
    if (lastSyncedHoaMonthlyRef.current === hoaMonthly) return;
    lastSyncedHoaMonthlyRef.current = hoaMonthly;
    const computed = Math.round(hoaMonthly * 12);
    setEditingDeal((p) => ({
      ...p,
      expenseHOAFees: computed ? String(computed) : '',
    }));
  }, [editingDeal?.hoaMonthlyFee]);

  // Cleaning Fee = ANR × ((365 × Occupancy%) / 3)
  useEffect(() => {
    if (!editingDeal) return;
    const anr = Number(editingDeal.anr_budget) || 0;
    const occ = Number(editingDeal.occupancyRate_budget) || 0;
    const srcKey = `${anr}|${occ}`;
    if (lastSyncedCleaningSrcRef.current === srcKey) return;
    lastSyncedCleaningSrcRef.current = srcKey;
    const computed = Math.round(anr * ((365 * (occ / 100)) / 3));
    setEditingDeal((p) => ({
      ...p,
      expenseCleaning: computed ? String(computed) : '',
    }));
  }, [editingDeal?.anr_budget, editingDeal?.occupancyRate_budget]);

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
      queryClient.invalidateQueries({ queryKey: ['publishedDeals'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['deal'], exact: false });
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


  const markAsPendingMutation = useMutation({
    mutationFn: (dealId) => dealsAPI.updateDeal(dealId, { status: 'pending' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeals'], exact: false });
      queryClient.invalidateQueries(['publishedDeals']);
      queryClient.invalidateQueries({ queryKey: ['myDeals'], exact: false });
      showNotification('success', 'Deal has been marked as pending.', 'Status Updated');
    },
    onError: (err) => {
      showNotification('error', err?.response?.data?.error || err?.message || 'Failed to mark deal as pending', 'Action Failed');
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: ({ dealId, newExpiryDate }) =>
      dealsAPI.updateDeal(dealId, { expired_status: false, expiry_date: newExpiryDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeals'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['publishedDeals'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['myDeals'], exact: false });
      setReactivateDeal(null);
      setReactivateDate('');
      setReactivateError('');
      showNotification('success', 'Property has been reactivated with a new expiry date.', 'Property Reactivated');
    },
    onError: (err) => {
      showNotification('error', err?.response?.data?.error || err?.message || 'Failed to reactivate property', 'Action Failed');
    },
  });

  const openReactivateModal = (deal) => {
    setReactivateDeal(deal);
    setReactivateDate('');
    setReactivateError('');
  };

  const submitReactivate = () => {
    if (!reactivateDate) {
      setReactivateError('Please select a new expiry date.');
      return;
    }
    const [mm, dd, yyyy] = reactivateDate.split('/');
    const picked = new Date(`${yyyy}-${mm}-${dd}`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(picked.getTime()) || picked <= today) {
      setReactivateError('Expiry date must be in the future.');
      return;
    }
    reactivateMutation.mutate({ dealId: reactivateDeal.id, newExpiryDate: reactivateDate });
  };



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

  const computeDefaultExpiration = (deal) => {
    const base = deal?.createdAt || deal?.submittedAt;
    const d = base ? new Date(base) : new Date();
    if (isNaN(d.getTime())) return '';
    d.setMonth(d.getMonth() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleMarkAsPending = (dealId) => {
    if (markAsPendingMutation.isPending) return;
    markAsPendingMutation.mutate(dealId);
  };


  const openManageProperty = async (deal) => {
    setEditErrors({});
    let nextDeal = { ...deal };
    const email = deal.submitterEmail || deal.email || null;

    if (email) {
      try {
        const res = await api.get(`/submitters/by-email/${encodeURIComponent(email)}`);
        nextDeal.submitter = res.data;
      } catch (err) {
        console.error('Submitter fetch failed:', err);
      }
    }

    nextDeal.vacationRentalMarkets = Array.isArray(nextDeal.vacationRentalMarkets) ? nextDeal.vacationRentalMarkets : [];
    nextDeal.expiry_date = nextDeal.expiry_date;

    // Underwriting seeding logic
    const price = Number(nextDeal?.price) || 0;
    const segPct = Number(nextDeal?.costSegregationPercent) || 0;
    const auto = Math.round((segPct / 100) * price);
    const existing = Number(nextDeal?.incomeReduction) || 0;
    incomeReductionManualRef.current = existing > 0 && existing !== auto;

    const financingType = nextDeal?.financingType || '';
    const sqft = Number(nextDeal?.squareFootage) || 0;
    const monthlyPayment = Number(nextDeal?.totalMonthlyPayment) || 0;
    const hoaMonthly = Number(nextDeal?.hoaMonthlyFee) || 0;
    const anrBudget = Number(nextDeal?.anr_budget) || 0;
    const occBudget = Number(nextDeal?.occupancyRate_budget) || 0;
    const closingRate = financingType === 'traditional' ? 0.03 : 0.01;

    const seedIfEmpty = (field, computed) => {
      if (!nextDeal[field] && computed) nextDeal[field] = String(computed);
    };
    const computedClosing = Math.round(price * closingRate);
    nextDeal.expenseClosingCosts = computedClosing ? String(computedClosing) : '';
    seedIfEmpty('expenseDesignFurnishing', Math.round(sqft * 45));
    const computedPI = Math.round(monthlyPayment * 12);
    nextDeal.expensePrincipalInterest = computedPI ? String(computedPI) : '';
    seedIfEmpty('expenseHOAFees', Math.round(hoaMonthly * 12));
    seedIfEmpty('expenseCleaning', Math.round(anrBudget * ((365 * (occBudget / 100)) / 3)));

    lastSyncedClosingCostsSrcRef.current = { price, financingType };
    lastSyncedSquareFootageRef.current = sqft;
    lastSyncedMonthlyPaymentRef.current = monthlyPayment;
    lastSyncedHoaMonthlyRef.current = hoaMonthly;
    lastSyncedCleaningSrcRef.current = `${anrBudget}|${occBudget}`;

    setOpenAccordions((prev) => {
      const allClosed = Object.fromEntries(Object.keys(prev).map((k) => [k, false]));
      return { ...allClosed, userInfo: true };
    });

    let initialTopPropCount = 1;
    Object.keys(nextDeal).forEach((key) => {
      const match = key.match(/^comp_(\d+)_(title|dailyRate|occupancy|link|grossRevenue)$/);
      if (match && nextDeal[key]) {
        const idx = Number(match[1]);
        if (idx > initialTopPropCount) initialTopPropCount = idx;
      }
    });
    setTopPropCount(initialTopPropCount);

    setEditingDeal(nextDeal);
  };


  const validateAdminEdit = () => {
    const { errors, firstErrorField } = validateDealForm(editingDeal, {
      requireMedia: true,
      requireRequiredFields: true,
    });
    setEditErrors(errors);
    return { firstErrorField, errors };
  };

  const validateUnderwriting = () => {
    const normalized = normalizeUnderwritingForSave(editingDeal);
    const { errors, firstErrorField } = validateDealForm(normalized, {
      requireMedia: false,
      requireRequiredFields: false,
    });
    setEditErrors(errors);
    return { firstErrorField, errors };
  };

  const normalizeForSave = (deal) => {
    const normalizeEmpty = (v) => (v === '' || v === undefined ? null : v);
    const stripNumber = (v) => (typeof v === 'string' ? v.replace(/[^0-9.-]/g, '') : v);

    // Convert all empty strings to null
    const normalized = {};
    Object.keys(deal).forEach((key) => {
      normalized[key] = normalizeEmpty(deal[key]);
    });

    return {
      ...normalized,
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
      expiry_date: normalizeEmpty(deal.expiry_date),
    };
  };

  const normalizeUnderwritingForSave = (deal) => {
    const normalized = { ...deal };
    Object.keys(normalized).forEach((key) => {
      normalized[key] = normalized[key] === '' ? null : normalized[key];
    });
    return normalized;
  };

  const saveManageProperty = async () => {
    // Validate edit fields
    const editResult = validateAdminEdit();
    if (editResult.firstErrorField) {
      const errorMessages = Object.entries(editResult.errors).slice(0, 5).map(([field, msg]) => `${fieldToLabel(field)}: ${msg}`).join('\n• ');
      const extraCount = Object.keys(editResult.errors).length - 5;
      const suffix = extraCount > 0 ? `\n...and ${extraCount} more` : '';
      showNotification('warning', `• ${errorMessages}${suffix}`, 'Validation Error');
      const ref = editErrorRefs.current[editResult.firstErrorField];
      ref?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      ref?.focus?.();
      return;
    }

    // Validate underwriting fields
    const uwResult = validateUnderwriting();
    if (uwResult.firstErrorField) {
      const errorMessages = Object.entries(uwResult.errors).slice(0, 5).map(([field, msg]) => `${fieldToLabel(field)}: ${msg}`).join('\n• ');
      const extraCount = Object.keys(uwResult.errors).length - 5;
      const suffix = extraCount > 0 ? `\n...and ${extraCount} more` : '';
      showNotification('warning', `• ${errorMessages}${suffix}`, 'Validation Error');
      const ref = editErrorRefs.current[uwResult.firstErrorField];
      ref?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => ref?.focus?.({ preventScroll: true }), 300);
      return;
    }

    const { id, status, submittedAt, publishedAt, submitter, submitterEmail, ...editable } = editingDeal;

    // Underwriting expense totals
    const totalOneTime = (
      (Number(editable.expenseEntryDownPayment) || 0) +
      (Number(editable.expenseClosingCosts) || 0) +
      (Number(editable.expenseDesignFurnishing) || 0)
    );

    const totalAnnualExpenses = (
      (Number(editable.expensePrincipalInterest) || 0) +
      (Number(editable.expensePropertyTaxes) || 0) +
      (Number(editable.expenseInsurance) || 0) +
      (Number(editable.expenseManagement) || 0) +
      (Number(editable.expenseOTAFees) || 0) +
      (Number(editable.expenseCleaning) || 0) +
      (Number(editable.expenseMaintenanceRepairs) || 0) +
      (Number(editable.expenseUtilities) || 0) +
      (Number(editable.expenseHOAFees) || 0) +
      (Number(editable.expenseSalesTax) || 0) +
      (Number(editable.expenseAdvertising) || 0) +
      (Number(editable.expenseMisc) || 0)
    );

    const normalizedUpdates = normalizeForSave({
      ...editable,
      turnkey: deriveTurnkey(editable.turnkeyFurnished),
      interiorImages: await normalizeMediaArray(editable.interiorImages),
      exteriorImages: await normalizeMediaArray(editable.exteriorImages),
      additionalImages: await normalizeMediaArray(editable.additionalImages),
      videos: await normalizeMediaArray(editable.videos),
      underwritingImages: await normalizeMediaArray(editable.underwritingImages || []),
      expenseTotalOneTime: totalOneTime,
      expenseTotalAnnual: totalAnnualExpenses,
    });

    updateMutation.mutate({ dealId: id, updates: normalizedUpdates });
  };

  // Compute display Property ID from street address + postal code
  const getPropertyId = (deal) => {
    const streetNum = (deal.streetAddress || '').trim().split(' ')[0].replace(/\D/g, '');
    const postal = (deal.postalCode || '').trim();
    if (!streetNum && !postal) return '';
    if (!streetNum) return postal;
    if (!postal) return streetNum;
    return `${streetNum}-${postal}`;
  };

  // Sort/filter deals
  let filteredDeals = deals || [];
  const dateFields = ['submittedAt'];
  const numericFields = ['price', 'downPayment', 'subjInterestRate', 'totalMonthlyPayment', 'strMarketScore'];

  filteredDeals = filteredDeals.slice().sort((a, b) => {
    const dir = sortDirection === 'asc' ? 1 : -1;
    if (sortField === 'id') {
      return getPropertyId(a).localeCompare(getPropertyId(b)) * dir;
    }
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
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${dispute.status === 'resolved' || dispute.status === 'auto_resolved'
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
      <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-8">
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
                    <SortableHeader label="Property Id" field="id" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="min-w-[120px]" />
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
                      onClick={() => navigate(`/deal-details/${deal.id}`, { state: { from: '/admin/properties' } })}
                    >

                      <td className={`px-3 py-3 text-sm text-text-secondary min-w-[120px] ${dimClass(deal)}`}>
                        {getPropertyId(deal) || '—'}
                      </td>

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
                        className={`px-3 py-3 text-center min-w-[60px] sticky right-0 bg-white ${openActionMenu === deal.id ? 'z-50' : 'z-20'}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {deal.expired_status === true ? (
                          <button
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                            onClick={() => openReactivateModal(deal)}
                            title="Reactivate property"
                          >
                            Reactivate
                          </button>
                        ) : (
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
                                  onClick={() => { if (deal.status !== 'published' && deal.status !== 'sold') { openManageProperty(deal); setOpenActionMenu(null); } }}
                                  disabled={deal.status === 'published' || deal.status === 'sold'}
                                >Manage Property</button>
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
                                  <button
                                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-green-50 text-green-700 transition-colors"
                                    onClick={() => { handleApprove(deal.id); setOpenActionMenu(null); }}
                                  >
                                    Approve
                                  </button>
                                )}

                                {deal.status !== 'pending' && (user?.role === 'admin' || user?.role === 'team_member') && (
                                  <button
                                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-red-50 text-orange-600 transition-colors"
                                    onClick={() => { handleMarkAsPending(deal.id); setOpenActionMenu(null); }}
                                  >Mark as Pending</button>
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
                        )}
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

      {/* Manage Property Modal */}
      {editingDeal && (
        <Modal isOpen={!!editingDeal} onClose={() => { setEditingDeal(null); setEditErrors({}); }} title="Manage Property" size="xl">
          <div className="-mx-6 -my-6 flex flex-col max-h-[calc(100vh-10rem)] rounded-b-lg overflow-hidden">
            {/* Property context header */}
            <div className="px-6 py-3 bg-gradient-to-r from-blue-50 to-blue-50/40 border-b border-blue-100 flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm font-semibold text-text-primary truncate max-w-full">{editingDeal.title || 'Untitled Property'}</div>
                  {editingDeal.status && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${editingDeal.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      editingDeal.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        editingDeal.status === 'published' ? 'bg-blue-100 text-blue-700' :
                          editingDeal.status === 'sold' ? 'bg-gray-200 text-gray-700' :
                            editingDeal.status === 'rejected' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'
                      }`}>
                      {editingDeal.status}
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-secondary truncate mt-1 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 min-w-0">
                    <svg className="w-3 h-3 shrink-0 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="truncate">{[editingDeal.streetAddress, editingDeal.city, editingDeal.stateRegion].filter(Boolean).join(', ') || '—'}</span>
                  </span>
                  {editingDeal.price && (
                    <>
                      <span className="text-border-subtle">•</span>
                      <span className="font-semibold text-text-primary">${formatPrice(editingDeal.price)}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={expandAllAccordions} className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-100 transition-colors">Expand all</button>
                <span className="h-4 w-px bg-blue-200" />
                <button type="button" onClick={collapseAllAccordions} className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-100 transition-colors">Collapse all</button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto bg-gray-100 px-6 py-5 space-y-3">

              {/* ═══ User Information Accordion ═══ */}
              <AccordionSection title="User Information" isOpen={openAccordions.userInfo} onToggle={() => toggleAccordion('userInfo')}>
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
                <div className="bg-surface border border-border-subtle rounded-lg p-4" style={{ display: 'none' }}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={!!editingDeal.priorityFirstAccess} onChange={(e) => setEditingDeal((prev) => ({ ...prev, priorityFirstAccess: e.target.checked }))} className="mt-1 w-5 h-5 accent-accent" />
                    <div>
                      <div className="text-base font-semibold text-text-primary">Premium First Access</div>
                      <div className="text-sm text-text-secondary mt-0.5">Give this property early visibility to VIP users before public release.</div>
                    </div>
                  </label>
                </div>
              </AccordionSection>

              {/* ═══ Property Accordion ═══ */}
              <AccordionSection title="Property" isOpen={openAccordions.property} onToggle={() => toggleAccordion('property')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Year Built" type="text" inputMode="numeric" value={editingDeal.yearBuilt || ''} error={editErrors.yearBuilt} ref={(el) => (editErrorRefs.current.yearBuilt = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, yearBuilt: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                  <Input label="Bedrooms" type="text" inputMode="numeric" value={formatNumber(editingDeal.bedrooms || '')} error={editErrors.bedrooms} ref={(el) => (editErrorRefs.current.bedrooms = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, bedrooms: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                  <Input label="Bathrooms" type="text" inputMode="numeric" value={formatNumber(editingDeal.bathrooms || '')} error={editErrors.bathrooms} ref={(el) => (editErrorRefs.current.bathrooms = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, bathrooms: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                  <DateInput
                    label="Property Expiry Date"
                    name="expiry_date"
                    value={editingDeal.expiry_date ?? ''}
                    error={editErrors.expiry_date}
                    ref={(el) => (editErrorRefs.current.expiry_date = el)}
                    onChange={(e) => setEditingDeal((prev) => ({ ...prev, expiry_date: e.target.value }))}
                    placeholder="Select date"
                  />
                  <Input label="Square Footage" type="text" inputMode="numeric" value={formatNumber(editingDeal.squareFootage || '')} error={editErrors.squareFootage} ref={(el) => (editErrorRefs.current.squareFootage = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, squareFootage: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                  <Select label="Category" value={editingDeal.category || ''} error={editErrors.category} ref={(el) => (editErrorRefs.current.category = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, category: e.target.value }))} options={CATEGORIES.filter((opt) => opt.value !== 'All')} />
                </div>
                <Input label="Title" value={editingDeal.title || ''} readOnly className="bg-app cursor-not-allowed" />
                <Textarea label="Description" value={editingDeal.description || ''} error={editErrors.description} ref={(el) => (editErrorRefs.current.description = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, description: e.target.value }))} />
              </AccordionSection>

              {/* ═══ Location Accordion ═══ */}
              <AccordionSection title="Location" isOpen={openAccordions.location} onToggle={() => toggleAccordion('location')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Street Address" value={editingDeal.streetAddress || ''} error={editErrors.streetAddress} ref={(el) => (editErrorRefs.current.streetAddress = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, streetAddress: e.target.value }))} />
                  <Input label="Address Line 2" value={editingDeal.addressLine2 || ''} onChange={(e) => setEditingDeal((prev) => ({ ...prev, addressLine2: e.target.value }))} />
                  <Input label="City" value={editingDeal.city || ''} error={editErrors.city} ref={(el) => (editErrorRefs.current.city = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, city: e.target.value }))} />
                  <Input label="State/Region/Province" value={editingDeal.stateRegion || ''} error={editErrors.stateRegion} ref={(el) => (editErrorRefs.current.stateRegion = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, stateRegion: e.target.value }))} />
                  <Input label="Postal/Zip Code" value={editingDeal.postalCode || ''} error={editErrors.postalCode} ref={(el) => (editErrorRefs.current.postalCode = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, postalCode: e.target.value }))} />
                </div>
              </AccordionSection>

              {/* ═══ Financial Accordion ═══ */}
              <AccordionSection title="Financial" isOpen={openAccordions.financial} onToggle={() => toggleAccordion('financial')}>
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
                  <label className="flex items-center gap-3 cursor-pointer mt-2">
                    <input type="checkbox" checked={!!editingDeal.discountPrice} onChange={(e) => setEditingDeal((prev) => ({ ...prev, discountPrice: e.target.checked }))} className="w-5 h-5 accent-accent" />
                    <span className="text-sm font-medium text-text-primary">Discount Price</span>
                  </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select label="Financing Type" value={editingDeal.financingType || ''} error={editErrors.financingType} ref={(el) => (editErrorRefs.current.financingType = el)} disabled={editingDeal.status === 'sold'} onChange={(e) => setEditingDeal((prev) => ({ ...prev, financingType: e.target.value }))} options={[{ value: 'traditional', label: 'Traditional' }, { value: 'subject-to', label: 'Subject-To' }, { value: 'hybrid', label: 'Hybrid' }, { value: 'seller', label: 'Seller Financing' }, { value: 'cash', label: 'Cash' }]} />
                  <Input label="EMD" type="text" inputMode="numeric" value={formatNumber(editingDeal.emd || '')} error={editErrors.emd} ref={(el) => (editErrorRefs.current.emd = el)} disabled={editingDeal.status === 'sold'} onChange={(e) => setEditingDeal((prev) => ({ ...prev, emd: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                  <Input label="Down Payment" type="text" inputMode="numeric" value={formatNumber(editingDeal.downPayment || '')} disabled={editingDeal.status === 'sold'} onChange={(e) => setEditingDeal((prev) => ({ ...prev, downPayment: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                  <DateInput label="Expected Close of Escrow" name="expectedCloseDate" value={editingDeal.expectedCloseDate ?? ''} error={editErrors.expectedCloseDate} ref={(el) => (editErrorRefs.current.expectedCloseDate = el)} disabled={editingDeal.status === 'sold'} onChange={(e) => setEditingDeal((prev) => ({ ...prev, expectedCloseDate: e.target.value }))} placeholder="Select date" />
                </div>
                <Textarea label="Additional Financial Information" value={editingDeal.financialInfo || ''} error={editErrors.financialInfo} ref={(el) => (editErrorRefs.current.financialInfo = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, financialInfo: e.target.value }))} />
              </AccordionSection>

              {/* ═══ Additional Accordion ═══ */}
              <AccordionSection title="Additional" isOpen={openAccordions.additional} onToggle={() => toggleAccordion('additional')}>
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
              </AccordionSection>

              {/* ═══ Rental Markets Accordion ═══ */}
              <AccordionSection title="Rental Markets" isOpen={openAccordions.rentalMarkets} onToggle={() => toggleAccordion('rentalMarkets')}>
                <CheckboxGroup label="Vacation Rental Markets" options={VACATION_RENTAL_MARKETS} values={editingDeal.vacationRentalMarkets || []} onChange={(vals) => setEditingDeal((prev) => ({ ...prev, vacationRentalMarkets: vals }))} />

                {/* Travel Motivations */}
                <div>
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

                <Textarea label={<span className="text-base font-semibold">What Do Rental Guests Want Most in This Area?</span>} value={editingDeal.guestDemandInsights || ''} error={editErrors.guestDemandInsights} ref={(el) => (editErrorRefs.current.guestDemandInsights = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, guestDemandInsights: e.target.value }))} rows={4} placeholder="Insights into guest expectations, amenities, or experiences..." />
                <Textarea label={<span className="text-base font-semibold">How Can We Add Value to This Property to Increase Income?</span>} value={editingDeal.valueAddOpportunities || ''} error={editErrors.valueAddOpportunities} ref={(el) => (editErrorRefs.current.valueAddOpportunities = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, valueAddOpportunities: e.target.value }))} rows={4} placeholder="Examples: pool, hot tub, bikes, beach gear, game tables, etc." />
                <Textarea label={<span className="text-base font-semibold">Recommended Property Managers, Contractors, or Cleaning Companies</span>} value={editingDeal.localContacts || ''} error={editErrors.localContacts} ref={(el) => (editErrorRefs.current.localContacts = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, localContacts: e.target.value }))} rows={4} placeholder="List any trusted local contacts buyers could use..." />
              </AccordionSection>

              {/* ═══ Property Photos and Videos Accordion ═══ */}
              <AccordionSection title="Property Photos and Videos" isOpen={openAccordions.photosVideos} onToggle={() => toggleAccordion('photosVideos')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FileUpload label="Interior Photos" accept="image/*" multiple value={editingDeal.interiorImages || []} onChange={(urls) => setEditingDeal((prev) => ({ ...prev, interiorImages: urls }))} error={editErrors?.interiorImages} ref={(el) => (editErrorRefs.current.interiorImages = el)} />
                  <FileUpload label="Exterior Photos" accept="image/*" multiple value={editingDeal.exteriorImages || []} onChange={(urls) => setEditingDeal((prev) => ({ ...prev, exteriorImages: urls }))} error={editErrors?.exteriorImages} ref={(el) => (editErrorRefs.current.exteriorImages = el)} />
                  <div className="col-span-full">
                    <FileUpload label="Additional Photos" accept="image/*" multiple value={editingDeal.additionalImages || []} onChange={(urls) => setEditingDeal((prev) => ({ ...prev, additionalImages: urls }))} error={editErrors?.additionalImages} />
                  </div>
                </div>
                <FileUpload label="Videos" accept="video/*" multiple value={editingDeal.videos || []} onChange={(urls) => setEditingDeal((prev) => ({ ...prev, videos: urls }))} />
                <Input label="Special Tags (comma separated)" value={(editingDeal.specialTags || []).join(', ')} onChange={(e) => setEditingDeal((prev) => ({ ...prev, specialTags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} />
                <Textarea label="Additional Info" value={editingDeal.additionalInfo || ''} error={editErrors.additionalInfo} ref={(el) => (editErrorRefs.current.additionalInfo = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, additionalInfo: e.target.value }))} />
              </AccordionSection>

              {/* ── Underwriting & Analysis divider ── */}
              <div className="flex items-center gap-3 pt-4 pb-2">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-300 to-blue-300" />
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-blue-200 shadow-sm text-[11px] font-bold uppercase tracking-widest text-blue-600">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Underwriting & Analysis
                </span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent via-blue-300 to-blue-300" />
              </div>

              {/* ═══ Market Definition Accordion ═══ */}
              <AccordionSection title="Market Definition" isOpen={openAccordions.marketDefinition} onToggle={() => toggleAccordion('marketDefinition')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select label="Market Type" value={editingDeal.underwritingMarketType || ''} error={editErrors.underwritingMarketType} ref={(el) => (editErrorRefs.current.underwritingMarketType = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, underwritingMarketType: e.target.value }))} options={[{ value: 'MARKET', label: 'Market' }, { value: 'SUBMARKET', label: 'Submarket' }]} />
                  <Select label="Market Size (Active Listings)" value={editingDeal.underwritingMarketSize || ''} error={editErrors.underwritingMarketSize} ref={(el) => (editErrorRefs.current.underwritingMarketSize = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, underwritingMarketSize: e.target.value }))} options={[{ value: '<50', label: 'Less Than 50' }, { value: '51-100', label: '51–100' }, { value: '101-250', label: '101–250 (Recommended)' }, { value: '251-500', label: '251–500 (Recommended)' }, { value: '500+', label: 'Over 500' }]} />
                </div>
              </AccordionSection>

              {/* ═══ Total Market Revenue Accordion ═══ */}
              <AccordionSection title="Total Market Revenue" isOpen={openAccordions.totalMarketRevenue} onToggle={() => toggleAccordion('totalMarketRevenue')}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[12, 24, 36, 48, 60, 72, 84].map((m) => (
                    <NumericInput key={m} label={`${m} Months ($)`} value={formatNumber(editingDeal[`marketRevenue_${m}m`] || '')} error={editErrors[`marketRevenue_${m}m`]} ref={(el) => (editErrorRefs.current[`marketRevenue_${m}m`] = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, [`marketRevenue_${m}m`]: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                  ))}
                </div>
              </AccordionSection>

              {/* ═══ Average Nightly Rate (ANR) Accordion ═══ */}
              <AccordionSection title="Average Nightly Rate (ANR)" isOpen={openAccordions.anr} onToggle={() => toggleAccordion('anr')}>
                {/* AGR calculated from Budget tier */}
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                  <div className="text-xs text-text-secondary font-medium mb-1">AGR — 365 × Budget Occupancy Rate × Budget ANR</div>
                  <div className="text-base font-semibold text-primary">
                    ${Number(editingDeal?.agr || 0).toLocaleString('en-US')}
                  </div>
                  <div className="text-xs text-text-secondary mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>Sales Tax (6%): <span className="font-semibold text-text-primary">${Math.round((Number(editingDeal?.agr) || 0) * 0.06).toLocaleString('en-US')}</span></div>
                    <div>OTA Fees (15%): <span className="font-semibold text-text-primary">${Math.round((Number(editingDeal?.agr) || 0) * 0.15).toLocaleString('en-US')}</span></div>
                    <div>Management (25%): <span className="font-semibold text-text-primary">${Math.round((Number(editingDeal?.agr) || 0) * 0.25).toLocaleString('en-US')}</span></div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {['budget', 'economy', 'midscale', 'upscale', 'luxury'].map((tier) => {
                    const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
                    return (
                      <div key={tier} className="border border-border-subtle rounded-lg p-3 space-y-2">
                        <div className="text-xs font-semibold text-primary uppercase tracking-wide">{tierLabel}</div>
                        <NumericInput label="ANR ($)" value={formatNumber(editingDeal[`anr_${tier}`] || '')} error={editErrors[`anr_${tier}`]} ref={(el) => (editErrorRefs.current[`anr_${tier}`] = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, [`anr_${tier}`]: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                        <NumericInput label="Occupancy Rate (%)" value={editingDeal[`occupancyRate_${tier}`] ?? ''} error={editErrors[`occupancyRate_${tier}`]} ref={(el) => (editErrorRefs.current[`occupancyRate_${tier}`] = el)} onChange={(e) => { let val = unformatNumber(e.target.value).replace(/[^0-9.]/g, ''); if (val !== '' && Number(val) > 100) val = '100'; if (val !== '' && Number(val) < 0) val = '0'; setEditingDeal((prev) => ({ ...prev, [`occupancyRate_${tier}`]: val })); }} />
                      </div>
                    );
                  })}
                </div>
              </AccordionSection>

              {/* ═══ Estimated Gross Revenue (EGR) Accordion ═══ */}
              <AccordionSection title="Estimated Gross Revenue (EGR)" isOpen={openAccordions.egr} onToggle={() => toggleAccordion('egr')}>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {['budget', 'economy', 'midscale', 'upscale', 'luxury'].map((tier) => (
                    <NumericInput key={tier} label={tier.charAt(0).toUpperCase() + tier.slice(1) + ' ($)'} value={formatNumber(editingDeal[`egr_${tier}`] || '')} error={editErrors[`egr_${tier}`]} ref={(el) => (editErrorRefs.current[`egr_${tier}`] = el)} onChange={(e) => { let val = unformatNumber(e.target.value).replace(/[^0-9.]/g, ''); const firstDot = val.indexOf('.'); if (firstDot !== -1) val = val.slice(0, firstDot + 1) + val.slice(firstDot + 1).replace(/\./g, ''); const [intPart, decPart] = val.split('.'); if (decPart !== undefined) val = `${intPart}.${decPart.slice(0, 2)}`; setEditingDeal((prev) => ({ ...prev, [`egr_${tier}`]: val })); }} />
                  ))}
                </div>
              </AccordionSection>

              {/* ═══ Cost Segregation Accordion ═══ */}
              <AccordionSection title="Cost Segregation, Bonus Depreciation, and Tax Scholarships" isOpen={openAccordions.costSegregation} onToggle={() => toggleAccordion('costSegregation')}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label="Purchase Price ($)" type="text" inputMode="numeric" value={formatNumber(editingDeal?.price || '')} disabled />
                  <NumericInput label="Cost Segregation (%)" value={editingDeal.costSegregationPercent || ''} error={editErrors.costSegregationPercent} ref={(el) => (editErrorRefs.current.costSegregationPercent = el)} onChange={(e) => {
                    let val = unformatNumber(e.target.value).replace(/[^0-9.]/g, '');
                    if (val !== '' && Number(val) > 100) val = '100';
                    if (val !== '' && Number(val) < 0) val = '0';
                    incomeReductionManualRef.current = false;
                    setEditingDeal((prev) => ({ ...prev, costSegregationPercent: val }));
                  }} />
                  <NumericInput
                    label="Income Reduction ($)"
                    value={formatNumber(editingDeal.incomeReduction || '')}
                    error={editErrors.incomeReduction}
                    ref={(el) => (editErrorRefs.current.incomeReduction = el)}
                    onChange={(e) => {
                      const next = unformatNumber(e.target.value).replace(/[^0-9]/g, '');
                      incomeReductionManualRef.current = true;
                      setEditingDeal((prev) => {
                        const taxRate = Number(prev.effectiveTaxRate) || 0;
                        const newIncome = Number(next) || 0;
                        const taxSavings = Math.round(newIncome * (taxRate / 100));
                        return {
                          ...prev,
                          incomeReduction: next,
                          taxSavings: taxSavings ? String(taxSavings) : '',
                        };
                      });
                    }}
                  />
                  <NumericInput label="Tax Rate (%)" value={editingDeal.effectiveTaxRate || ''} error={editErrors.effectiveTaxRate} ref={(el) => (editErrorRefs.current.effectiveTaxRate = el)} onChange={(e) => {
                    let val = unformatNumber(e.target.value).replace(/[^0-9.]/g, '');
                    if (val !== '' && Number(val) > 100) val = '100';
                    if (val !== '' && Number(val) < 0) val = '0';
                    setEditingDeal((prev) => ({ ...prev, effectiveTaxRate: val }));
                  }} />
                  <NumericInput
                    label="Tax Savings ($)"
                    value={formatNumber(editingDeal.taxSavings || '')}
                    error={editErrors.taxSavings}
                    ref={(el) => (editErrorRefs.current.taxSavings = el)}
                    onChange={(e) => {
                      const val = unformatNumber(e.target.value).replace(/[^0-9]/g, '');
                      setEditingDeal((prev) => ({
                        ...prev,
                        taxSavings: val,
                      }));
                    }}
                  />
                </div>
              </AccordionSection>

              {/* ═══ Estimated Expenses Accordion ═══ */}
              <AccordionSection title="Estimated Expenses" isOpen={openAccordions.estimatedExpenses} onToggle={() => toggleAccordion('estimatedExpenses')}>
                {/* One-Time Fees */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">One-Time Fees</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <NumericInput
                      label="Entry or Down Payment ($)"
                      value={formatNumber(editingDeal.expenseEntryDownPayment || '')}
                      error={editErrors.expenseEntryDownPayment}
                      ref={(el) => (editErrorRefs.current.expenseEntryDownPayment = el)}
                      onChange={(e) => setEditingDeal((prev) => ({ ...prev, expenseEntryDownPayment: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))}
                    />
                    <NumericInput
                      label={`Closing Costs ($)`}
                      value={formatNumber(editingDeal.expenseClosingCosts || '')}
                      error={editErrors.expenseClosingCosts}
                      ref={(el) => (editErrorRefs.current.expenseClosingCosts = el)}
                      onChange={(e) => setEditingDeal((prev) => ({ ...prev, expenseClosingCosts: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))}
                    />
                    <NumericInput
                      label="Design/Furnishing/Setup/Renovations"
                      value={formatNumber(editingDeal.expenseDesignFurnishing || '')}
                      error={editErrors.expenseDesignFurnishing}
                      ref={(el) => (editErrorRefs.current.expenseDesignFurnishing = el)}
                      onChange={(e) => setEditingDeal((prev) => ({ ...prev, expenseDesignFurnishing: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))}
                    />
                    <div className="flex flex-col justify-end">
                      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                        <div className="text-xs text-text-secondary font-medium mb-1">Total One-Time</div>
                        <div className="text-base font-semibold text-primary">
                          ${Number(
                            (Number(editingDeal.expenseEntryDownPayment) || 0) +
                            (Number(editingDeal.expenseClosingCosts) || 0) +
                            (Number(editingDeal.expenseDesignFurnishing) || 0)
                          ).toLocaleString('en-US')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Annual Fees and Expenses */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Annual Fees and Expenses</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <NumericInput
                      label="Principal and Interest ($)"
                      value={formatNumber(editingDeal.expensePrincipalInterest || '')}
                      error={editErrors.expensePrincipalInterest}
                      ref={(el) => (editErrorRefs.current.expensePrincipalInterest = el)}
                      onChange={(e) => setEditingDeal((prev) => ({ ...prev, expensePrincipalInterest: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))}
                    />
                    <NumericInput
                      label="Property Taxes ($)"
                      value={formatNumber(editingDeal.expensePropertyTaxes || '')}
                      error={editErrors.expensePropertyTaxes}
                      ref={(el) => (editErrorRefs.current.expensePropertyTaxes = el)}
                      onChange={(e) => setEditingDeal((prev) => ({ ...prev, expensePropertyTaxes: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))}
                    />
                    <NumericInput
                      label="Insurance ($)"
                      value={formatNumber(editingDeal.expenseInsurance || '')}
                      error={editErrors.expenseInsurance}
                      ref={(el) => (editErrorRefs.current.expenseInsurance = el)}
                      onChange={(e) => setEditingDeal((prev) => ({ ...prev, expenseInsurance: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))}
                    />
                    <NumericInput
                      label="Management ($)"
                      value={formatNumber(editingDeal.expenseManagement || '')}
                      error={editErrors.expenseManagement}
                      ref={(el) => (editErrorRefs.current.expenseManagement = el)}
                      onChange={(e) => setEditingDeal((prev) => ({ ...prev, expenseManagement: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))}
                    />
                    <NumericInput
                      label="OTA Fees — Airbnb, VRBO, etc. ($)"
                      value={formatNumber(editingDeal.expenseOTAFees || '')}
                      error={editErrors.expenseOTAFees}
                      ref={(el) => (editErrorRefs.current.expenseOTAFees = el)}
                      onChange={(e) => setEditingDeal((prev) => ({ ...prev, expenseOTAFees: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))}
                    />
                    <NumericInput
                      label="Cleaning ($)"
                      value={formatNumber(editingDeal.expenseCleaning || '')}
                      error={editErrors.expenseCleaning}
                      ref={(el) => (editErrorRefs.current.expenseCleaning = el)}
                      onChange={(e) => setEditingDeal((prev) => ({ ...prev, expenseCleaning: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))}
                    />
                    <NumericInput
                      label="Maintenance and Repairs ($)"
                      value={formatNumber(editingDeal.expenseMaintenanceRepairs || '')}
                      error={editErrors.expenseMaintenanceRepairs}
                      ref={(el) => (editErrorRefs.current.expenseMaintenanceRepairs = el)}
                      onChange={(e) => setEditingDeal((prev) => ({ ...prev, expenseMaintenanceRepairs: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))}
                    />
                    <NumericInput
                      label="Utilities and Expenses($)"
                      value={formatNumber(editingDeal.expenseUtilities || '')}
                      error={editErrors.expenseUtilities}
                      ref={(el) => (editErrorRefs.current.expenseUtilities = el)}
                      onChange={(e) => setEditingDeal((prev) => ({ ...prev, expenseUtilities: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))}
                    />
                    <NumericInput
                      label="HOA Fees ($) — HOA Monthly Fee × 12"
                      value={formatNumber(editingDeal.expenseHOAFees || '')}
                      error={editErrors.expenseHOAFees}
                      ref={(el) => (editErrorRefs.current.expenseHOAFees = el)}
                      onChange={(e) => setEditingDeal((prev) => ({ ...prev, expenseHOAFees: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))}
                    />
                    <NumericInput
                      label="Sales Tax ($)"
                      value={formatNumber(editingDeal.expenseSalesTax || '')}
                      error={editErrors.expenseSalesTax}
                      ref={(el) => (editErrorRefs.current.expenseSalesTax = el)}
                      onChange={(e) => setEditingDeal((prev) => ({ ...prev, expenseSalesTax: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))}
                    />
                    <NumericInput
                      label="Advertising ($)"
                      value={formatNumber(editingDeal.expenseAdvertising || '')}
                      error={editErrors.expenseAdvertising}
                      ref={(el) => (editErrorRefs.current.expenseAdvertising = el)}
                      onChange={(e) => setEditingDeal((prev) => ({ ...prev, expenseAdvertising: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))}
                    />
                    <NumericInput
                      label="Misc Expense ($)"
                      value={formatNumber(editingDeal.expenseMisc || '')}
                      error={editErrors.expenseMisc}
                      ref={(el) => (editErrorRefs.current.expenseMisc = el)}
                      onChange={(e) => setEditingDeal((prev) => ({ ...prev, expenseMisc: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))}
                    />
                    <div className="flex flex-col justify-end">
                      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                        <div className="text-xs text-text-secondary font-medium mb-1">Total Annual Expenses</div>
                        <div className="text-base font-semibold text-primary">
                          ${Number(
                            (Number(editingDeal.expensePrincipalInterest) || 0) +
                            (Number(editingDeal.expensePropertyTaxes) || 0) +
                            (Number(editingDeal.expenseInsurance) || 0) +
                            (Number(editingDeal.expenseManagement) || 0) +
                            (Number(editingDeal.expenseOTAFees) || 0) +
                            (Number(editingDeal.expenseCleaning) || 0) +
                            (Number(editingDeal.expenseMaintenanceRepairs) || 0) +
                            (Number(editingDeal.expenseUtilities) || 0) +
                            (Number(editingDeal.expenseHOAFees) || 0) +
                            (Number(editingDeal.expenseSalesTax) || 0) +
                            (Number(editingDeal.expenseAdvertising) || 0) +
                            (Number(editingDeal.expenseMisc) || 0)
                          ).toLocaleString('en-US')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionSection>

              {/* ═══ Market Analysis Accordion ═══ */}
              <AccordionSection title="Market Analysis and Investment Analyzer Worksheet" isOpen={openAccordions.marketAnalysis} onToggle={() => toggleAccordion('marketAnalysis')}>
                <Input label="Worksheet / Analysis Link" type="url" value={editingDeal.marketAnalysisLink || ''} error={editErrors.marketAnalysisLink} ref={(el) => (editErrorRefs.current.marketAnalysisLink = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, marketAnalysisLink: e.target.value }))} />
                {/* 50-50 Partnership Opportunity */}
                <div className="bg-surface border border-border-subtle rounded-lg p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={!!editingDeal.fiftyFiftyPartner} onChange={(e) => setEditingDeal((prev) => ({ ...prev, fiftyFiftyPartner: e.target.checked }))} className="mt-1 w-5 h-5 accent-accent" />
                    <div>
                      <div className="text-base font-semibold text-text-primary">50-50 Partnership Opportunity</div>
                      <div className="text-sm text-text-secondary mt-0.5">Mark this property as a potential 50-50 partnership.</div>
                    </div>
                  </label>
                  {editingDeal.fiftyFiftyPartner && (
                    <div className="mt-4 ml-8 flex items-end gap-4">
                      <div className="w-80">
                        <label className="block text-sm font-medium text-text-secondary mb-1">
                          Custom JV Values ($)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={editingDeal.customJvValues ? Number(editingDeal.customJvValues).toLocaleString('en-US') : ''}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, '');
                            setEditingDeal((prev) => ({ ...prev, customJvValues: raw }));
                          }}
                          className="w-full px-3 py-2 bg-app border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                          placeholder="e.g. 60,000"
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer mb-1">
                        <input
                          type="checkbox"
                          checked={!!editingDeal.costsIncluded}
                          onChange={(e) =>
                            setEditingDeal((prev) => ({
                              ...prev,
                              costsIncluded: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 accent-accent"
                        />
                        <span className="text-sm text-text-primary whitespace-nowrap">
                          Mark costs as "Included"
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              </AccordionSection>

              {/* ═══ Top 10 Properties Accordion ═══ */}
              <AccordionSection title="Top Properties Listing (Airbnb)" isOpen={openAccordions.top10Properties} onToggle={() => toggleAccordion('top10Properties')}>
                <p className="text-sm text-text-secondary">The following are examples of the top properties in the area to show <span className="font-semibold">Potential Gross Revenue</span> if you could get this property to the top of the market.</p>
                <p className="text-xs text-text-secondary italic">This DOES NOT suggest that this property in its current condition will produce this level of revenue.</p>
                <div className="space-y-6">
                  {Array.from({ length: topPropCount }, (_, i) => i + 1).map((num) => (
                    <div key={num} className="space-y-4 border border-blue-100 rounded-lg overflow-hidden bg-white">
                      <h4 className="font-semibold text-primary bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white text-blue-600 text-xs font-bold ring-1 ring-blue-200">{num}</span>
                          Property {num}
                        </span>
                        {num === topPropCount && num > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDeal((prev) => ({
                                ...prev,
                                [`comp_${num}_title`]: '',
                                [`comp_${num}_dailyRate`]: '',
                                [`comp_${num}_occupancy`]: '',
                                [`comp_${num}_link`]: '',
                                [`comp_${num}_grossRevenue`]: '',
                              }));
                              setTopPropCount((c) => Math.max(1, c - 1));
                            }}
                            className="text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </h4>
                      <div className="px-4 pb-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Input label="Property Title" value={editingDeal[`comp_${num}_title`] || ''} error={editErrors[`comp_${num}_title`]} ref={(el) => (editErrorRefs.current[`comp_${num}_title`] = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, [`comp_${num}_title`]: e.target.value }))} />
                          <NumericInput label="Daily Rate ($)" value={formatNumber(editingDeal[`comp_${num}_dailyRate`] || '')} error={editErrors[`comp_${num}_dailyRate`]} ref={(el) => (editErrorRefs.current[`comp_${num}_dailyRate`] = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, [`comp_${num}_dailyRate`]: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                          <NumericInput label="Occupancy (%)" value={editingDeal[`comp_${num}_occupancy`] || ''} error={editErrors[`comp_${num}_occupancy`]} ref={(el) => (editErrorRefs.current[`comp_${num}_occupancy`] = el)} onChange={(e) => { let val = e.target.value.replace(/[^0-9.]/g, ''); if (val !== '' && Number(val) > 100) val = '100'; if (val !== '' && Number(val) < 0) val = '0'; setEditingDeal((prev) => ({ ...prev, [`comp_${num}_occupancy`]: val })); }} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Input label="Airbnb Listing Link" type="url" value={editingDeal[`comp_${num}_link`] || ''} error={editErrors[`comp_${num}_link`]} ref={(el) => (editErrorRefs.current[`comp_${num}_link`] = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, [`comp_${num}_link`]: e.target.value }))} />
                          <NumericInput label="Revenue ($)" value={formatNumber(editingDeal[`comp_${num}_grossRevenue`] || '')} error={editErrors[`comp_${num}_grossRevenue`]} ref={(el) => (editErrorRefs.current[`comp_${num}_revenue`] = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, [`comp_${num}_grossRevenue`]: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setTopPropCount((c) => c + 1)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 px-3 py-2 rounded-lg border border-dashed border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <span className="text-base leading-none">+</span> Add Property
                  </button>
                </div>
              </AccordionSection>

              {/* ═══ Underwriting Images Accordion ═══ */}
              <AccordionSection title="Underwriting Images" isOpen={openAccordions.underwritingImages} onToggle={() => toggleAccordion('underwritingImages')}>
                <p className="text-sm text-text-secondary">Upload supporting screenshots, spreadsheets, analyses, or reference images used during underwriting.</p>
                <FileUpload accept="image/*" multiple value={editingDeal.underwritingImages || []} onChange={(urls) => setEditingDeal((prev) => ({ ...prev, underwritingImages: urls }))} error={editErrors?.underwritingImages} ref={(el) => (editErrorRefs.current.underwritingImages = el)} />
              </AccordionSection>

              {Object.keys(editErrors).length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50/60 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <p className="font-semibold text-red-700 text-sm">Please fix the following errors:</p>
                  </div>
                  <ul className="space-y-1.5 ml-7">
                    {Object.entries(editErrors).map(([field, message]) => (
                      <li key={field}>
                        <button
                          type="button"
                          className="text-sm text-red-600 hover:text-red-800 hover:underline text-left"
                          onClick={() => { const ref = editErrorRefs.current[field]; ref?.scrollIntoView({ behavior: 'smooth', block: 'center' }); ref?.focus?.(); }}
                        >
                          <span className="font-medium">{fieldToLabel(field)}:</span> {message}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-white border-t border-border-subtle px-6 py-3.5 flex items-center justify-between gap-3 shrink-0">
              <span className="text-xs text-text-secondary">
                {Object.keys(editErrors).length > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-red-600 font-medium">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    {Object.keys(editErrors).length} error{Object.keys(editErrors).length > 1 ? 's' : ''} remaining
                  </span>
                )}
              </span>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setEditingDeal(null)}>Cancel</Button>
                <Button variant="primary" onClick={saveManageProperty} loading={updateMutation.isPending}>Save Changes</Button>
              </div>
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

      {/* Reactivate Modal */}
      <Modal
        isOpen={!!reactivateDeal}
        onClose={() => { setReactivateDeal(null); setReactivateDate(''); setReactivateError(''); }}
        title="Reactivate Property"
        size="sm"
      >
        {reactivateDeal && (
          <div className="space-y-4">
            <p className="text-text-primary">
              Set a new expiry date to reactivate this property. The property will no longer be marked as expired.
            </p>
            <div className="bg-surface border border-border-subtle p-3 rounded text-sm space-y-1">
              <div><strong>Title:</strong> {reactivateDeal.title}</div>
              <div><strong>Submitted By:</strong> {reactivateDeal.submitterEmail || '—'}</div>
              <div><strong>Current Expiry:</strong> {reactivateDeal.expiry_date || '—'}</div>
            </div>
            <DateInput
              label="New Expiry Date"
              name="reactivate_expiry_date"
              value={reactivateDate}
              error={reactivateError}
              onChange={(e) => { setReactivateDate(e.target.value); setReactivateError(''); }}
              placeholder="Select a future date"
              required
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => { setReactivateDeal(null); setReactivateDate(''); setReactivateError(''); }}
                className="min-w-[100px]"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={submitReactivate}
                loading={reactivateMutation.isPending}
                className="min-w-[130px]"
              >
                Reactivate
              </Button>
            </div>
          </div>
        )}
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
