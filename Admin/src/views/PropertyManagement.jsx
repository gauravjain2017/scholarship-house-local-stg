import { useState, useRef, useEffect } from 'react';
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
import '../styles/main.css';
import {
  formatNumber,
  unformatNumber,
  formatPhoneDisplay,
} from '../utils/format';
import { deriveTurnkey } from '../utils/turnkey';
import { useHasPermission } from '../utils/roles';

// Convert camelCase field name to human-readable label
const fieldToLabel = (field) =>
  field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).replace(/_/g, ' ');

// Utility function to format numbers with commas
const formatPrice = (price) => {
  const parsed = parseFloat(price);
  if (isNaN(parsed) || !price) return 'Not set';
  return parseInt(parsed).toLocaleString('en-US');
};

// STR Financial Documents uploader (PDF / Excel / image). File objects are
// uploaded to S3 on save; existing items arrive as URL strings and are shown
// as downloadable links.
const StrDocsField = ({ value = [], onChange, label = 'Upload STR Financial Documents' }) => {
  const [dragActive, setDragActive] = useState(false);
  const docName = (doc) => (doc instanceof File ? doc.name : String(doc).split('/').pop());
  const addDocs = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (incoming.length) onChange([...(value || []), ...incoming]);
  };
  const removeDoc = (idx) => onChange((value || []).filter((_, i) => i !== idx));
  const onDrag = (e, active) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(active);
  };
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-text-primary mb-2">{label}</label>
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}
        onDragEnter={(e) => onDrag(e, true)}
        onDragOver={(e) => onDrag(e, true)}
        onDragLeave={(e) => onDrag(e, false)}
        onDrop={(e) => {
          onDrag(e, false);
          addDocs(e.dataTransfer.files);
        }}
      >
        <input
          type="file"
          accept=".pdf,.xls,.xlsx,.csv,image/*"
          multiple
          onChange={(e) => {
            addDocs(e.target.files);
            e.target.value = '';
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div className="text-center pointer-events-none">
          <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 13h6m-6 4h6m2 4H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-2 text-sm text-gray-600">Drag and drop files here, or click to select</p>
          <p className="text-xs text-gray-500 mt-1">PDF, Excel, or image files accepted</p>
        </div>
      </div>
      {value?.length > 0 && (
        <ul className="mt-3 space-y-2">
          {value.map((doc, idx) => (
            <li
              key={idx}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
            >
              {typeof doc === 'string' ? (
                <a href={doc} target="_blank" rel="noopener noreferrer" download className="truncate text-blue-600 underline">
                  ⬇ {docName(doc)}
                </a>
              ) : (
                <span className="truncate text-text-primary">{docName(doc)}</span>
              )}
              <button
                type="button"
                onClick={() => removeDoc(idx)}
                className="shrink-0 text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
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
  { value: 'needs-approval', label: 'Needs Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'published', label: 'Active' },
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

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
];

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

// Maps each validatable field to the accordion section it lives in, so a
// validation error can open just that section (closing the others).
const FIELD_SECTION = {
  submitterRelationship: 'userInfo',
  category: 'property', bedrooms: 'property', bathrooms: 'property', squareFootage: 'property',
  yearBuilt: 'property', isHOA: 'property', hoaMonthlyFee: 'property', description: 'property',
  story: 'property', contactName: 'property', contactPhone: 'property', contactRelation: 'property', sourceLink: 'property',
  streetAddress: 'location', addressLine2: 'location', city: 'location', stateRegion: 'location', postalCode: 'location',
  financingType: 'financial', price: 'financial', downPayment: 'financial', assignmentFee: 'financial',
  emd: 'financial', expectedCloseDate: 'financial', financialInfo: 'financial', dealTerms: 'financial', totalStartingMonthlyPayment: 'financial',
  hasPrimaryMortgage: 'financial', primaryLoanBalance: 'financial', primaryInterestRate: 'financial', primaryMaturityDate: 'financial', primaryPrincipalInterest: 'financial', primaryTaxesInsurance: 'financial',
  hasSecondMortgage: 'financial', secondLoanBalance: 'financial', secondInterestRate: 'financial', secondMaturityDate: 'financial', secondPrincipalInterest: 'financial', secondTaxesInsurance: 'financial',
  hasSellerEquity: 'financial', sellerEquityAmount: 'financial', sellerEquityInterestRate: 'financial', sellerEquityMaturityDate: 'financial', sellerEquityPrincipalInterest: 'financial', sellerEquityBalloonYears: 'financial',
  strZoning: 'rentalMarkets', isOperatingSTR: 'rentalMarkets', turnkeyFurnished: 'rentalMarkets', hasStrFinancials: 'rentalMarkets',
  strConfidence: 'rentalMarkets', strListingLink: 'rentalMarkets', strDataSheetsLink: 'rentalMarkets',
  occupancyRate: 'rentalMarkets', averageNightlyRate: 'rentalMarkets', strAnnualRevenue: 'rentalMarkets', strMonthlyRevenue: 'rentalMarkets',
  strMonthlyUtilities: 'rentalMarkets', strNOI: 'rentalMarkets', strCleaningFee: 'rentalMarkets', strAvgStay: 'rentalMarkets',
  strManagementFee: 'rentalMarkets', strBookingPlatform: 'rentalMarkets', guestDemandInsights: 'rentalMarkets',
  hasCurrentBookings: 'rentalMarkets', currentBookingsDescription: 'rentalMarkets', strFinancialDocs: 'rentalMarkets',
  valueAddOpportunities: 'rentalMarkets', localContacts: 'rentalMarkets', amenities: 'rentalMarkets', localAttractions: 'rentalMarkets',
  coverPhoto: 'photosVideos', interiorImages: 'photosVideos', exteriorImages: 'photosVideos',
  additionalImages: 'photosVideos', videos: 'photosVideos', additionalInfo: 'photosVideos',
};

const AccordionSection = ({ title, isOpen, onToggle, children }) => {
  const icon = ACCORDION_ICONS[title] || UNDERWRITING_ICON;
  return (
    <div className={`rounded-xl overflow-hidden transition-all duration-200 border coll-ps ${isOpen ? 'border-blue-200 shadow-sm' : 'border-border-subtle shadow-sm hover:shadow-md'}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-all duration-200 ${isOpen ? 'bg-blue-50 hover:bg-blue-100/70' : 'bg-white hover:bg-gray-50'}`}
      >
        <span className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-colors ${isOpen ? 'bg-white text-blue-600 ring-1 ring-blue-200' : 'bg-amber-100 text-black-600'}`}>
          {icon}
        </span>
        <span className="text-[12] font-semibold truncate flex-1 text-text-primary">{title}</span>
        <svg
          className={`w-4 h-4 shrink-0 transition-transform duration-300 svg-icon ${isOpen ? 'rotate-180 text-blue-500' : 'text-gray-400'}`}
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

  // Optimistic status update: patch the deal's status in the adminDeals cache
  // immediately so the badge changes the moment an action fires — keeping the
  // menu/modal close and the badge update in sync (no "updates later" lag).
  // Returns a snapshot used to roll back if the request fails.
  const optimisticStatusUpdate = async (dealId, newStatus) => {
    await queryClient.cancelQueries({ queryKey: ['adminDeals'], exact: false });
    const previous = queryClient.getQueriesData({ queryKey: ['adminDeals'], exact: false });
    queryClient.setQueriesData({ queryKey: ['adminDeals'], exact: false }, (old) =>
      Array.isArray(old) ? old.map((d) => (d?.id === dealId ? { ...d, status: newStatus } : d)) : old
    );
    return previous;
  };
  const rollbackStatus = (previous) => {
    (previous || []).forEach(([key, data]) => queryClient.setQueryData(key, data));
  };

  const editErrorRefs = useRef({});
  const incomeReductionManualRef = useRef(false);
  const renewalSaveRef = useRef({ active: false, statusChange: null });
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
    fiftyFiftyProForma: false,
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
  const [confirmApproveAndPublishId, setConfirmApproveAndPublishId] = useState(null);
  const [confirmUnpublishId, setConfirmUnpublishId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [reactivateDeal, setReactivateDeal] = useState(null);
  const [reactivateDate, setReactivateDate] = useState('');
  const [reactivateError, setReactivateError] = useState('');

  const [renewalDeal, setRenewalDeal] = useState(null);
  const [renewalAnswers, setRenewalAnswers] = useState({ statusChanged: null, newStatus: null, financialChanged: null, wantsEdits: null });
  const [pendingRenewal, setPendingRenewal] = useState(false);
  const [renewalStatusChange, setRenewalStatusChange] = useState(null);

  // Notification modal state
  const [notification, setNotification] = useState({ open: false, type: 'success', title: '', message: '', onClose: null });
  const showNotification = (type, message, title = '', onClose = null) => setNotification({ open: true, type, title, message, onClose });
  const closeNotification = () => {
    const cb = notification.onClose;
    setNotification((prev) => ({ ...prev, open: false, onClose: null }));
    cb?.();
  };

  // Copy full address to clipboard + transient "copied" toast.
  const [addressCopied, setAddressCopied] = useState(false);
  const copyAddress = async (addr) => {
    if (!addr) return;
    try {
      await navigator.clipboard.writeText(addr);
    } catch {
      /* clipboard may be unavailable in some browsers/contexts */
    }
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 1800);
  };

  // Disputes state
  const [showDisputes, setShowDisputes] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [disputeResolution, setDisputeResolution] = useState('');
  const [disputeAdminNotes, setDisputeAdminNotes] = useState('');
  const [disputeStatusFilter, setDisputeStatusFilter] = useState('All');



  // Reset to page 1 when filters or sort change
  useEffect(() => { setDealPage(1); }, [filters, sortField, sortDirection]);

  // Map needs-approval → pending for the API; claimedAt sub-filtering is client-side
  const apiFilters = filters.status === 'needs-approval'
    ? { ...filters, status: 'pending' }
    : filters;

  // Fetch deals
  const { data: deals, isLoading } = useQuery({
    queryKey: ['adminDeals', filters],
    queryFn: () => dealsAPI.getAllDeals(apiFilters),
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
    // console.log('editingDeal : ', editingDeal.price)
    const price = Number(editingDeal.price) || 0;
    const sqft = Number(editingDeal.squareFootage) || 0;
    // if (lastSyncedSquareFootageRef.current === sqft) return;
    // lastSyncedSquareFootageRef.current = sqft;
    const computed = Math.round(price * 0.20);
    setEditingDeal((p) => ({
      ...p,
      expenseDesignFurnishing: computed ? String(computed) : '',
    }));
  }, [editingDeal?.price]);

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
    onMutate: (dealId) => optimisticStatusUpdate(dealId, 'approved'),
    onError: (_e, _v, previous) => rollbackStatus(previous),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeals'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['myDeals'], exact: false });
      setConfirmApproveId(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ dealId, reason }) => dealsAPI.rejectDeal(dealId, reason),
    onMutate: ({ dealId }) => optimisticStatusUpdate(dealId, 'rejected'),
    onError: (_e, _v, previous) => rollbackStatus(previous),
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
    onMutate: (dealId) => optimisticStatusUpdate(dealId, 'published'),
    onError: (_e, _v, previous) => rollbackStatus(previous),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeals'], exact: false });
      queryClient.invalidateQueries(['publishedDeals']);
      queryClient.invalidateQueries({ queryKey: ['myDeals'], exact: false });
      setConfirmPublishId(null);
    },
  });

  const approveAndPublishMutation = useMutation({
    mutationFn: async (dealId) => {
      await dealsAPI.approveDeal(dealId);
      await dealsAPI.publishDeal(dealId);
    },
    onMutate: (dealId) => optimisticStatusUpdate(dealId, 'published'),
    onError: (_e, _v, previous) => rollbackStatus(previous),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeals'], exact: false });
      queryClient.invalidateQueries(['publishedDeals']);
      queryClient.invalidateQueries({ queryKey: ['myDeals'], exact: false });
      setConfirmApproveAndPublishId(null);
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
      const isRenewal = renewalSaveRef.current.active;
      renewalSaveRef.current = { active: false, statusChange: null };
      setPendingRenewal(false);
      setRenewalStatusChange(null);
      showNotification(
        'success',
        isRenewal ? 'Property updated and renewed with a new 20-day expiry.' : 'The deal has been updated successfully!',
        isRenewal ? 'Property Renewed' : 'Deal Updated'
      );
    },
  });

  const markAsSoldMutation = useMutation({
    mutationFn: dealsAPI.markAsSold,
    onMutate: (dealId) => optimisticStatusUpdate(dealId, 'sold'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeals'], exact: false });
      queryClient.invalidateQueries(['publishedDeals']);
      setConfirmSoldId(null);
    },
    onError: (err, _v, previous) => {
      rollbackStatus(previous);
      showNotification('error', err?.response?.data?.error || err?.message || 'Failed to mark property as sold', 'Action Failed');
    },
  });

  const revertSoldMutation = useMutation({
    mutationFn: dealsAPI.revertSold,
    onMutate: (dealId) => optimisticStatusUpdate(dealId, 'published'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeals'], exact: false });
      queryClient.invalidateQueries(['publishedDeals']);
      setConfirmRevertSoldId(null);
    },
    onError: (err, _v, previous) => {
      rollbackStatus(previous);
      showNotification('error', err?.response?.data?.error || err?.message || 'Failed to revert sold status', 'Action Failed');
    },
  });


  const markAsPendingMutation = useMutation({
    mutationFn: (dealId) => dealsAPI.updateDeal(dealId, { status: 'pending' }),
    onMutate: (dealId) => optimisticStatusUpdate(dealId, 'pending'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeals'], exact: false });
      queryClient.invalidateQueries(['publishedDeals']);
      queryClient.invalidateQueries({ queryKey: ['myDeals'], exact: false });
      showNotification('success', 'Deal has been marked as pending.', 'Status Updated');
    },
    onError: (err, _v, previous) => {
      rollbackStatus(previous);
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

  const computeRenewalExpiryDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 20);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const renewMutation = useMutation({
    mutationFn: ({ dealId, is_property_status_changed, changed_property_status, is_financial_terms_changed, is_property_edit }) => {
      const updates = {
        expired_status: false,
        expiry_date: computeRenewalExpiryDate(),
        is_property_status_changed,
        is_financial_terms_changed,
        is_property_edit,
      };
      if (is_property_status_changed && changed_property_status) {
        updates.changed_property_status = changed_property_status;
        updates.status = changed_property_status;
      }
      return dealsAPI.updateDeal(dealId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDeals'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['publishedDeals'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['myDeals'], exact: false });
      setRenewalDeal(null);
      setRenewalAnswers({ statusChanged: null, newStatus: null, financialChanged: null, wantsEdits: null });
      showNotification('success', 'Property has been renewed with a new 20-day expiry.', 'Property Renewed');
    },
    onError: (err) => {
      showNotification('error', err?.response?.data?.error || err?.message || 'Failed to renew property', 'Action Failed');
    },
  });

  const openRenewalModal = (deal) => {
    setRenewalDeal(deal);
    setRenewalAnswers({ statusChanged: null, newStatus: null, financialChanged: null, wantsEdits: null });
  };

  const handleRenewalProceed = async () => {
    const { statusChanged, newStatus, financialChanged, wantsEdits } = renewalAnswers;
    if (!statusChanged || !financialChanged || !wantsEdits) return;
    if (statusChanged === 'yes' && !newStatus) return;

    const anyYes = statusChanged === 'yes' || financialChanged === 'yes' || wantsEdits === 'yes';
    const deal = renewalDeal;

    if (anyYes) {
      const statusToApply = statusChanged === 'yes' ? newStatus : null;
      setPendingRenewal(true);
      setRenewalStatusChange(statusToApply);
      renewalSaveRef.current = { active: true, statusChange: statusToApply };
      setRenewalDeal(null);
      setRenewalAnswers({ statusChanged: null, newStatus: null, financialChanged: null, wantsEdits: null });
      await openManageProperty(deal);
    } else {
      renewMutation.mutate({
        dealId: deal.id,
        is_property_status_changed: false,
        changed_property_status: null,
        is_financial_terms_changed: false,
        is_property_edit: false,
      });
    }
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
    // Default empty/legacy financing types to "creative" so the dropdown shows a
    // selection and the creative financing fields display (matches submit form).
    const _ft = String(nextDeal.financingType || '').toLowerCase();
    if (!_ft || ['subject-to', 'hybrid', 'seller'].includes(_ft)) {
      nextDeal.financingType = 'creative';
    }
    // Default "operating as STR" to "No" when nothing is selected.
    if (!nextDeal.isOperatingSTR) nextDeal.isOperatingSTR = 'no';
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
    seedIfEmpty('expenseDesignFurnishing', Math.round(price * 0.20));
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
      assignmentFee: stripNumber(deal.assignmentFee),
      subjLoanBalance: stripNumber(deal.subjLoanBalance),
      subjMonthlyPrincipal: stripNumber(deal.subjMonthlyPrincipal),
      subjMonthlyInterest: stripNumber(deal.subjMonthlyInterest),
      subjMonthlyTaxesInsurance: stripNumber(deal.subjMonthlyTaxesInsurance),
      sellerLoanAmount: stripNumber(deal.sellerLoanAmount),
      sellerMonthlyPayment: stripNumber(deal.sellerMonthlyPayment),
      totalMonthlyPayment: stripNumber(deal.totalMonthlyPayment),
      totalStartingMonthlyPayment: stripNumber(deal.totalStartingMonthlyPayment),
      // Creative financing — primary mortgage
      primaryLoanBalance: stripNumber(deal.primaryLoanBalance),
      primaryInterestRate: stripNumber(deal.primaryInterestRate),
      primaryPrincipalInterest: stripNumber(deal.primaryPrincipalInterest),
      primaryTaxesInsurance: stripNumber(deal.primaryTaxesInsurance),
      // Creative financing — second mortgage
      secondLoanBalance: stripNumber(deal.secondLoanBalance),
      secondInterestRate: stripNumber(deal.secondInterestRate),
      secondPrincipalInterest: stripNumber(deal.secondPrincipalInterest),
      secondTaxesInsurance: stripNumber(deal.secondTaxesInsurance),
      // Creative financing — seller equity
      sellerEquityAmount: stripNumber(deal.sellerEquityAmount),
      sellerEquityInterestRate: stripNumber(deal.sellerEquityInterestRate),
      sellerEquityPrincipalInterest: stripNumber(deal.sellerEquityPrincipalInterest),
      // STR key metrics
      occupancyRate: stripNumber(deal.occupancyRate),
      averageNightlyRate: stripNumber(deal.averageNightlyRate),
      strAnnualRevenue: stripNumber(deal.strAnnualRevenue),
      strMonthlyRevenue: stripNumber(deal.strMonthlyRevenue),
      strMonthlyUtilities: stripNumber(deal.strMonthlyUtilities),
      strNOI: stripNumber(deal.strNOI),
      strCleaningFee: stripNumber(deal.strCleaningFee),
      strAvgStay: stripNumber(deal.strAvgStay),
      strManagementFee: stripNumber(deal.strManagementFee),
      expectedCloseDate: normalizeEmpty(deal.expectedCloseDate),
      subjLoanMaturity: normalizeEmpty(deal.subjLoanMaturity),
      sellerLoanMaturity: normalizeEmpty(deal.sellerLoanMaturity),
      primaryMaturityDate: normalizeEmpty(deal.primaryMaturityDate),
      secondMaturityDate: normalizeEmpty(deal.secondMaturityDate),
      sellerEquityMaturityDate: normalizeEmpty(deal.sellerEquityMaturityDate),
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

  // On a validation error: open all accordion sections so the invalid field is
  // rendered, then scroll to it and focus/highlight it (the field already shows
  // a red border via its `error` prop).
  const focusEditError = (field) => {
    // Open only the section that holds the invalid field (close the others),
    // like the add-property submission. Unmapped (underwriting) fields fall
    // back to expanding everything so they remain reachable.
    const section = FIELD_SECTION[field];
    if (section) {
      setOpenAccordions((prev) => {
        const allClosed = Object.fromEntries(Object.keys(prev).map((k) => [k, false]));
        return { ...allClosed, [section]: true };
      });
    } else {
      expandAllAccordions();
    }
    setTimeout(() => {
      const ref = editErrorRefs.current[field];
      if (ref) {
        ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => ref.focus?.({ preventScroll: true }), 300);
      }
    }, 180);
  };

  // Show the same popup as the add-property submission. On dismiss, open the
  // sections and scroll to / highlight the first invalid field.
  const showValidationPopup = (errors, firstErrorField) => {
    const list = Object.entries(errors)
      .slice(0, 5)
      .map(([f, m]) => `${fieldToLabel(f)}: ${m}`)
      .join('\n• ');
    const extra = Object.keys(errors).length - 5;
    const suffix = extra > 0 ? `\n...and ${extra} more` : '';
    showNotification(
      'warning',
      `Please complete the following required fields before saving:\n• ${list}${suffix}`,
      'Required Fields Missing',
      () => focusEditError(firstErrorField)
    );
  };

  const saveManageProperty = async () => {
    // Validate edit fields
    const editResult = validateAdminEdit();
    if (editResult.firstErrorField) {
      showValidationPopup(editResult.errors, editResult.firstErrorField);
      return;
    }

    // Validate underwriting fields
    const uwResult = validateUnderwriting();
    if (uwResult.firstErrorField) {
      showValidationPopup(uwResult.errors, uwResult.firstErrorField);
      return;
    }

    const { id, status: _status, submittedAt, publishedAt, submitter, submitterEmail, ...editable } = editingDeal;

    // Underwriting expense totals
    const totalOneTime = (
      (Number(editable.expenseEntryDownPayment) || (Number(editable.downPayment) || 0) + (Number(editable.assignmentFee) || 0)) +
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
      coverPhoto: await normalizeMediaArray(editable.coverPhoto || []),
      interiorImages: await normalizeMediaArray(editable.interiorImages),
      exteriorImages: await normalizeMediaArray(editable.exteriorImages),
      additionalImages: await normalizeMediaArray(editable.additionalImages),
      videos: await normalizeMediaArray(editable.videos),
      strFinancialDocs: await normalizeMediaArray(editable.strFinancialDocs || []),
      underwritingImages: await normalizeMediaArray(editable.underwritingImages || []),
      expenseTotalOneTime: totalOneTime,
      expenseTotalAnnual: totalAnnualExpenses,
    });

    if (renewalSaveRef.current.active) {
      normalizedUpdates.expired_status = false;
      normalizedUpdates.expiry_date = computeRenewalExpiryDate();
      normalizedUpdates.is_property_status_changed = !!renewalSaveRef.current.statusChange;
      normalizedUpdates.is_financial_terms_changed = true;
      normalizedUpdates.is_property_edit = true;
      if (renewalSaveRef.current.statusChange) {
        normalizedUpdates.changed_property_status = renewalSaveRef.current.statusChange;
        normalizedUpdates.status = renewalSaveRef.current.statusChange;
      }
    }

    updateMutation.mutate({ dealId: id, updates: normalizedUpdates });
  };

  const exportToCSV = () => {
    const getStatusLabel = (deal) =>
      deal.status === 'pending' && deal.claimedAt != null ? 'Pending'
        : deal.status === 'pending' && deal.claimedAt == null ? 'Needs Approval'
          : deal.status === 'published' ? 'Active'
            : deal.status
              ? deal.status.charAt(0).toUpperCase() + deal.status.slice(1)
              : '';

    const headers = [
      'Property ID', 'Submitted Date', 'Full Address', 'City', 'State', 'Zip',
      'Bedrooms', 'Bathrooms', 'Price', 'Financing Type', 'Status',
      'Submitted By', 'Contact Name', 'Contact Phone',
    ];

    const rows = filteredDeals.map((deal) => [
      getPropertyId(deal),
      deal.submittedAt ? new Date(deal.submittedAt).toLocaleDateString() : '',
      deal.streetAddress || '',
      deal.city || '',
      deal.stateRegion || '',
      deal.postalCode || '',
      deal.bedrooms ?? '',
      deal.bathrooms ?? '',
      deal.price ? `$${Number(deal.price).toLocaleString()}` : '',
      deal.financingType || '',
      getStatusLabel(deal),
      deal.submitterName || deal.submittedBy?.name || '',
      deal.contactName || '',
      deal.contactPhone ? formatPhoneDisplay(deal.contactPhone) : '',
    ]);

    const escape = (val) => {
      const s = String(val);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const statusLabel = filters.status === 'All' ? 'all' : filters.status.toLowerCase().replace(/\s+/g, '-');
    a.href = url;
    a.download = `properties-${statusLabel}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

  // Sub-filter pending by claimedAt after sort
  if (filters.status === 'pending') {
    filteredDeals = filteredDeals.filter((d) => d.claimedAt != null);
  } else if (filters.status === 'needs-approval') {
    filteredDeals = filteredDeals.filter((d) => d.claimedAt == null);
  }

  const paginatedDeals = filteredDeals.slice(
    (dealPage - 1) * ITEMS_PER_PAGE,
    dealPage * ITEMS_PER_PAGE
  );


  console.log('paginatedDeals : ', paginatedDeals)

  // Sold properties stay fully visible/usable (no dimming) — they are a normal status.
  const dimClass = () => '';

  // Mirrors SubmitterView: creative financing flow gates the creative fields.
  const isCreativeFinancingEdit = ['creative', 'subject-to', 'hybrid', 'seller'].includes(
    editingDeal?.financingType
  );
  const isOperatingSTREdit = editingDeal?.isOperatingSTR === 'yes';
  const hasStrFinancialsEdit = editingDeal?.hasStrFinancials === 'yes';


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
                      {(useHasPermission('property_management.manage_edit_property') || useHasPermission('property_management.approve_property') || useHasPermission('property_management.reject_property') || useHasPermission('property_management.delete_property') || useHasPermission('property_management.mark_as_pending_property') || useHasPermission('property_management.published_property') || useHasPermission('property_management.mark_as_sold_property')) && (<th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Actions</th>)}
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
      <div className="mb-6">
        <h1 className="text-1xl md:text-1xl font-bold text-text-primary">
          Property Management Dashboard
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Review, approve, and manage every submitted property in one place.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-surface border border-border-subtle rounded-xl shadow-sm p-6 pb-2 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

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
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={exportToCSV}
              disabled={filteredDeals.length === 0}
            >
              Export CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setFilters({ status: 'All', search: '' }); setSortField('submittedAt'); setSortDirection('desc'); }}
            >
              Reset Filters
            </Button>
          </div>
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
                <thead className="bg-gray-50/70 border-b border-border-subtle">
                  <tr>
                    {/* View Listing — plain header (button is the only listing link) */}
                    <th className="px-3 py-3 text-left text-xs font-medium text-text-secondary uppercase min-w-[110px]">View Listing</th>
                    <SortableHeader label="Property Id" field="id" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="min-w-[120px]" />
                    <SortableHeader label="Submitted Date" field="submittedAt" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="min-w-[130px]" />
                    <SortableHeader label="Full Address" field="streetAddress" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="min-w-[200px]" />
                    <SortableHeader label="Bed / Bath" field="bedrooms" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="min-w-[120px]" />
                    <SortableHeader label="Submitted By" field="submitterName" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="min-w-[130px]" />
                    <SortableHeader label="Main Point of Contact" field="submitterName" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="min-w-[130px]" />
                    <SortableHeader label="Price" field="price" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="min-w-[90px]" />
                    <SortableHeader label="Financing" field="financingType" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="min-w-[100px]" />
                    <SortableHeader
                      label="Status"
                      field="status"
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      className="min-w-[120px] bg-surface"
                    />

                    {useHasPermission('property_management.manage_edit_property') && (<th className="px-3 py-3 text-center text-xs font-medium text-text-secondary uppercase min-w-[60px] bg-surface">
                      Actions
                    </th>)}
                  </tr>
                </thead>

                {/* BODY */}
                <tbody className="divide-y property-table">
                  {paginatedDeals.map((deal) => {
                    const addr = [deal.streetAddress, deal.city, deal.stateRegion, deal.postalCode].filter(Boolean).join(', ');
                    const statusClass =
                      deal.status === 'published'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : deal.status === 'sold'
                          ? 'bg-slate-100 text-slate-600 border border-slate-200'
                          : deal.status === 'rejected'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : deal.status === 'pending' && deal.claimedAt != null
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : deal.status === 'pending' && deal.claimedAt == null
                                ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200';


                    const statusLabel =
                      deal.status === 'pending' && deal.claimedAt != null ? 'Pending'
                        : deal.status === 'pending' && deal.claimedAt == null ? 'Needs Approval'
                          : deal.status === 'published' ? 'Active'
                            : deal.status;





                    return (
                      <tr key={deal.id} className="hover:bg-blue-50/40 transition-colors">

                        {/* View Listing — the only column that opens the listing */}
                        <td className={`px-3 py-3 min-w-[110px] ${dimClass(deal)}`}>
                          <button
                            type="button"
                            onClick={() => navigate(`/deal-details/${deal.id}`, { state: { from: '/admin/properties' } })}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors whitespace-nowrap"
                          >
                            View Listing
                          </button>
                        </td>

                        <td className={`px-3 py-3 text-sm text-text-secondary min-w-[120px] ${dimClass(deal)}`}>
                          {getPropertyId(deal) || '—'}
                        </td>

                        <td className={`px-3 py-3 text-sm text-text-secondary min-w-[100px] ${dimClass(deal)}`}>
                          {deal.submittedAt ? new Date(deal.submittedAt).toLocaleDateString() : '—'}
                        </td>

                        {/* Full Address — click to copy (accent color + copy icon signal it's interactive) */}
                        <td className={`px-3 py-3 text-sm min-w-[200px] ${dimClass(deal)}`}>
                          {addr ? (
                            <button
                              type="button"
                              onClick={() => copyAddress(addr)}
                              title="Click to copy address"
                              className="group inline-flex items-start gap-1.5 text-left text-accent hover:underline cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-70 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <span>{addr}</span>
                            </button>
                          ) : '—'}
                        </td>

                        {/* Bed/Bath */}
                        <td className={`px-3 py-3 text-sm text-text-primary min-w-[120px] ${dimClass(deal)}`}>
                          {(deal.bedrooms || deal.bathrooms)
                            ? `${deal.bedrooms || 0} Bed / ${deal.bathrooms || 0} Bath`
                            : '—'}
                        </td>

                        <td className={`px-3 py-3 text-sm text-text-primary min-w-[130px] ${dimClass(deal)}`}>
                          {deal.submitterName || '—'}
                        </td>

                        <td className={`px-3 py-3 text-sm text-text-primary min-w-[130px] ${dimClass(deal)}`}>
                          {deal.contactName || '—'}
                        </td>



                        <td className={`px-3 py-3 text-sm font-bold text-text-primary min-w-[90px] ${dimClass(deal)}`}>
                          ${formatPrice(Number(deal.price) || 0)}
                        </td>

                        <td className={`px-3 py-3 text-sm min-w-[100px] ${dimClass(deal)}`}>
                          {FINANCING_LABELS[deal.financingType?.toLowerCase()] || deal.financingType || ''}
                        </td>

                        {/* ✅ STICKY STATUS CELL — badge opens the status/action menu (moved from Actions) */}
                        <td className={`px-3 py-3 min-w-[120px] bg-white ${dimClass(deal)}`}>
                          <div className="relative inline-block">
                            <button
                              ref={openActionMenu === deal.id ? actionBtnRef : undefined}
                              onClick={(e) => toggleActionMenu(deal.id, e.currentTarget)}
                              title="Change Status"
                              className={`inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap capitalize cursor-pointer transition hover:shadow-sm ${statusClass}`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                              {statusLabel}
                              <svg className="w-3 h-3 opacity-60" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                            </button>
                            {openActionMenu === deal.id && (
                              <div
                                ref={actionMenuRef}
                                className={`absolute right-0 bg-white border border-border-subtle rounded-xl shadow-lg p-2 min-w-[170px]
                                ${menuDirection === 'down' ? 'top-full mt-2' : 'bottom-full mb-2'}
                                `}
                                style={{ zIndex: 9999 }}
                              >

                                {(deal.status === 'pending' && deal.claimedAt == null && useHasPermission('property_management.approve_property')) &&
                                  (<button className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-green-50 text-green-700 transition-colors" onClick={() => { handleApprove(deal.id); setOpenActionMenu(null); }}>Approve</button>)
                                }

                                {(deal.status === 'pending' && deal.claimedAt == null && useHasPermission('property_management.reject_property')) &&
                                  (<button className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-red-50 text-red-600 transition-colors" onClick={() => { handleReject(deal); setOpenActionMenu(null); }}>Reject</button>)
                                }

                                {deal.status === 'pending' && deal.claimedAt != null && user?.role === 'admin' && useHasPermission('property_management.published_property') && (
                                  <button className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-emerald-50 text-emerald-700 transition-colors" onClick={() => { setConfirmApproveAndPublishId(deal.id); setOpenActionMenu(null); }}>Active</button>
                                )}

                                {deal.status === 'pending' && deal.claimedAt != null && (user?.role === 'admin' || user?.role === 'team_member') && useHasPermission('property_management.mark_as_sold_property') && (
                                  <button className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-100 text-slate-600 transition-colors" onClick={() => { handleMarkAsSold(deal.id); setOpenActionMenu(null); }}>Sold</button>
                                )}

                                {deal.status === 'pending' && deal.claimedAt != null && useHasPermission('property_management.reject_property') && (
                                  <button className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-red-50 text-red-600 transition-colors" onClick={() => { handleReject(deal); setOpenActionMenu(null); }}>Reject</button>
                                )}


                                {(deal.status === 'rejected' && user?.role === 'admin' && useHasPermission('property_management.approve_property')) &&
                                  (<button
                                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-green-50 text-green-700 transition-colors"
                                    onClick={() => { handleApprove(deal.id); setOpenActionMenu(null); }}
                                  >
                                    Approve
                                  </button>)
                                }

                                {(deal.status === 'rejected' && user?.role === 'admin' && useHasPermission('property_management.delete_property')) &&
                                  (<button
                                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                                    onClick={() => { setSelectedDeal(deal); setShowDeleteModal(true); setOpenActionMenu(null); }}
                                  >
                                    Delete
                                  </button>)
                                }




                                {deal.status === 'rejected' && user?.role === 'team_member' && (
                                  <span className="block px-3 py-2 text-sm text-gray-400">Awaiting Admin Delete</span>
                                )}

                                {deal.status === 'approved' && user?.role === 'admin' && useHasPermission('property_management.published_property') && (
                                  <button className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-blue-50 text-blue-700 transition-colors" onClick={() => { handlePublish(deal.id); setOpenActionMenu(null); }}>Active</button>

                                )}
                                {deal.status === 'approved' && user?.role === 'team_member' && (
                                  <span className="block px-3 py-2 text-sm text-gray-400">Awaiting Admin Publish</span>
                                )}
                                {deal.status === 'published' && user?.role === 'admin' && useHasPermission('property_management.approve_property') && (
                                  <button
                                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-green-50 text-green-700 transition-colors"
                                    onClick={() => { handleApprove(deal.id); setOpenActionMenu(null); }}
                                  >
                                    Approve
                                  </button>
                                )}

                                {deal.status !== 'pending' && (user?.role === 'admin' || user?.role === 'team_member') && useHasPermission('property_management.mark_as_pending_property') && (
                                  <button
                                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-red-50 text-orange-600 transition-colors"
                                    onClick={() => { handleMarkAsPending(deal.id); setOpenActionMenu(null); }}
                                  >Pending</button>
                                )}


                                {(deal.status === 'published' || deal.status === 'approved') &&
                                  (user?.role === 'admin' || user?.role === 'team_member') &&
                                  useHasPermission('property_management.mark_as_sold_property') && (
                                    <button
                                      className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-amber-50 text-amber-700 transition-colors"
                                      onClick={() => {
                                        handleMarkAsSold(deal.id);
                                        setOpenActionMenu(null);
                                      }}
                                    >
                                      Sold
                                    </button>
                                  )}


                                {deal.status === 'sold' && (user?.role === 'admin' || user?.role === 'team_member') && useHasPermission('property_management.mark_as_sold_property') && (
                                  <button className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-blue-50 text-blue-700 transition-colors" onClick={() => { handleRevertSold(deal.id); setOpenActionMenu(null); }}>Revert Sold</button>
                                )}






                              </div>
                            )}
                          </div>
                        </td>

                        {/* ✅ STICKY ACTION CELL — edit icon opens the edit popup directly */}
                        {useHasPermission('property_management.manage_edit_property') && (
                          <td className="px-3 py-3 text-center min-w-[60px] bg-white">
                            {deal.expired_status === true ? (
                              <button
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
                                onClick={() => openRenewalModal(deal)}
                                title="Renew property"
                              >
                                Renew
                              </button>
                            ) : (


                              <button
                                className="p-2 rounded-lg transition-colors hover:bg-gray-100 text-text-secondary hover:text-text-primary"
                                onClick={() => openManageProperty(deal)}
                                title="Edit property"
                              >
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={1.8}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                              </button>



                            )}
                          </td>
                        )}

                      </tr>
                    );
                  })}
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
            <div className="px-6 py-3 bg-white to-blue-50/40 border-b border-blue-100 flex items-center justify-between gap-4 flex-wrap table-col">
              <div className="min-w-0 flex-1 aprv-col">
                <div className="flex items-center gap-5 flex-wrap aprv-box">
                  <div className="text-[14] font-semibold text-text-primary truncate max-w-full">{editingDeal.title || 'Untitled Property'}</div>
                  {editingDeal.status && (
                    <span className={`px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${editingDeal.status === 'pending' && editingDeal.claimedAt != null ? 'bg-amber-100 text-amber-700' :
                      editingDeal.status === 'pending' && editingDeal.claimedAt == null ? 'bg-orange-100 text-orange-700' :
                        editingDeal.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                          editingDeal.status === 'published' ? 'bg-blue-100 text-blue-700' :
                            editingDeal.status === 'sold' ? 'bg-gray-200 text-gray-700' :
                              editingDeal.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                'bg-gray-100 text-gray-700'
                      }`}>
                      {editingDeal.status === 'pending' && editingDeal.claimedAt != null
                        ? 'Pending'
                        : editingDeal.status === 'pending' && editingDeal.claimedAt == null
                          ? 'Needs Approval'
                          : editingDeal.status}
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-secondary truncate mt-1 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 min-w-0">
                    <svg className="w-3 h-3 shrink-0 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="truncate aprv-text">{[editingDeal.streetAddress, editingDeal.city, editingDeal.stateRegion].filter(Boolean).join(', ') || '—'}</span>
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
                <button type="button" onClick={expandAllAccordions} className="text-[11] font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-100 transition-colors">Expand all</button>
                <span className="h-4 w-px bg-blue-200" />
                <button type="button" onClick={collapseAllAccordions} className="text-[11] font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-100 transition-colors">Collapse all</button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto bg-gray-100 px-6 py-5 space-y-3">

              {pendingRenewal && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-sm font-medium px-4 py-2.5 rounded-lg">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Renewal in progress — make your edits and click <strong className="ml-1">Save &amp; Renew</strong> to complete. Expiry will be set to 20 days from today.
                </div>
              )}

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

              {/* ═══ Property Accordion (mirrors submit Step 1: Property Information) ═══ */}
              <AccordionSection title="Property" isOpen={openAccordions.property} onToggle={() => toggleAccordion('property')}>
                {/* Property Type + specs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select label="Property Type" value={editingDeal.category || ''} error={editErrors.category} ref={(el) => (editErrorRefs.current.category = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, category: e.target.value }))} options={CATEGORIES.filter((opt) => opt.value !== 'All')} />
                  <Input label="Bedrooms" type="text" inputMode="numeric" value={formatNumber(editingDeal.bedrooms || '')} error={editErrors.bedrooms} ref={(el) => (editErrorRefs.current.bedrooms = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, bedrooms: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                  <Input label="Bathrooms" type="text" inputMode="numeric" value={formatNumber(editingDeal.bathrooms || '')} error={editErrors.bathrooms} ref={(el) => (editErrorRefs.current.bathrooms = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, bathrooms: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                  <Input label="Square Footage" type="text" inputMode="numeric" value={formatNumber(editingDeal.squareFootage || '')} error={editErrors.squareFootage} ref={(el) => (editErrorRefs.current.squareFootage = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, squareFootage: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                  <Input label="Year Built" type="text" inputMode="numeric" value={editingDeal.yearBuilt || ''} error={editErrors.yearBuilt} ref={(el) => (editErrorRefs.current.yearBuilt = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, yearBuilt: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />


                  <Select
                    label="Is This Property In An HOA?"
                    value={editingDeal.isHOA ? 'YES' : 'NO'}
                    onChange={(e) => { const isHOA = e.target.value === 'YES'; setEditingDeal((prev) => ({ ...prev, isHOA, hoaMonthlyFee: isHOA ? prev.hoaMonthlyFee : null })); }}
                    options={[{ value: 'NO', label: 'No' }, { value: 'YES', label: 'Yes' }]}
                  />
                  {editingDeal.isHOA && (
                    <Input label="HOA Monthly Fee ($)" type="text" inputMode="numeric" value={formatNumber(editingDeal.hoaMonthlyFee || '')} error={editErrors.hoaMonthlyFee} ref={(el) => (editErrorRefs.current.hoaMonthlyFee = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, hoaMonthlyFee: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                  )}

                  <Input label="Title" value={editingDeal.title || ''} readOnly className="bg-app cursor-not-allowed" />

                </div>




                <Textarea label="Listing Description" value={editingDeal.description || ''} error={editErrors.description} ref={(el) => (editErrorRefs.current.description = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, description: e.target.value }))} />

                <Textarea label="Seller's Intentions" value={editingDeal.story || ''} error={editErrors.story} ref={(el) => (editErrorRefs.current.story = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, story: e.target.value }))} />

                {/* Property's Main Point of Contact (mirrors submit Step 1) */}
                <div>
                  <h3 className="text-base font-semibold text-text-primary mb-3">Property's Main Point of Contact</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input label="Name" value={editingDeal.contactName || ''} error={editErrors.contactName} ref={(el) => (editErrorRefs.current.contactName = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, contactName: e.target.value }))} placeholder="Full name" />
                    <Input label="Phone Number" type="tel" inputMode="numeric" value={editingDeal.contactPhone || ''} error={editErrors.contactPhone} ref={(el) => (editErrorRefs.current.contactPhone = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, contactPhone: e.target.value.replace(/[^0-9]/g, '') }))} placeholder="e.g., 5555555555" />
                    <Input label="Relation to Property" value={editingDeal.contactRelation || ''} error={editErrors.contactRelation} ref={(el) => (editErrorRefs.current.contactRelation = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, contactRelation: e.target.value }))} placeholder="e.g., Owner, Agent, Wholesaler" />
                  </div>
                </div>

                {/* Source Link (mirrors submit Step 1) */}
                <Input label="Source Link" type="url" value={editingDeal.sourceLink || ''} onChange={(e) => setEditingDeal((prev) => ({ ...prev, sourceLink: e.target.value }))} placeholder="https://..." />

              </AccordionSection>

              {/* ═══ Location Accordion ═══ */}
              <AccordionSection title="Location" isOpen={openAccordions.location} onToggle={() => toggleAccordion('location')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Street Address" value={editingDeal.streetAddress || ''} error={editErrors.streetAddress} ref={(el) => (editErrorRefs.current.streetAddress = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, streetAddress: e.target.value }))} />
                  <Input label="Address Line 2" value={editingDeal.addressLine2 || ''} onChange={(e) => setEditingDeal((prev) => ({ ...prev, addressLine2: e.target.value }))} />
                  <Input label="City" value={editingDeal.city || ''} error={editErrors.city} ref={(el) => (editErrorRefs.current.city = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, city: e.target.value }))} />
                  <Select label="State/Region/Province" value={editingDeal.stateRegion || ''} error={editErrors.stateRegion} ref={(el) => (editErrorRefs.current.stateRegion = el)} placeholderLabel="Select State" onChange={(e) => setEditingDeal((prev) => ({ ...prev, stateRegion: e.target.value }))} options={US_STATES.map((s) => ({ value: s.code, label: s.name }))} />
                  <Input label="Postal/Zip Code" value={editingDeal.postalCode || ''} error={editErrors.postalCode} ref={(el) => (editErrorRefs.current.postalCode = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, postalCode: e.target.value }))} />
                </div>
              </AccordionSection>

              {/* ═══ Financial Accordion ═══ */}
              <AccordionSection title="Financial" isOpen={openAccordions.financial} onToggle={() => toggleAccordion('financial')}>
                {/* Type of Financing + Purchase Price (mirrors submit Step 3) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select label="Type of Financing" value={editingDeal.financingType || ''} error={editErrors.financingType} ref={(el) => (editErrorRefs.current.financingType = el)} disabled={editingDeal.status === 'sold'} onChange={(e) => setEditingDeal((prev) => ({ ...prev, financingType: e.target.value }))} options={[{ value: 'traditional', label: 'Traditional Financing' }, { value: 'creative', label: 'Creative Financing' }]} />
                  <Input label="Purchase Price ($)" type="text" inputMode="numeric" value={formatNumber(editingDeal.price || '')} error={editErrors.price} ref={(el) => (editErrorRefs.current.price = el)} disabled={editingDeal.status === 'sold'} onChange={(e) => setEditingDeal((prev) => ({ ...prev, price: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                </div>

                {/* Admin-only: Discount Price */}
                <div>
                  <label className="flex items-center gap-3 cursor-pointer mt-2">
                    <input type="checkbox" checked={!!editingDeal.discountPrice} onChange={(e) => setEditingDeal((prev) => ({ ...prev, discountPrice: e.target.checked }))} className="w-5 h-5 accent-accent" />
                    <span className="text-sm font-medium text-text-primary">Discount Price</span>
                  </label>
                </div>

                {/* TRADITIONAL: Additional Financial Information only */}
                {!isCreativeFinancingEdit && (
                  <Textarea label="Additional Financial Information" value={editingDeal.financialInfo || ''} error={editErrors.financialInfo} ref={(el) => (editErrorRefs.current.financialInfo = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, financialInfo: e.target.value }))} />
                )}

                {/* CREATIVE: full conditional flow (mirrors submit Step 3) */}
                {isCreativeFinancingEdit && (
                  <div className="space-y-6 mt-2">
                    {/* Expected Close of Escrow + EMD + Assignment Fee */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <DateInput label="Expected Close of Escrow" name="expectedCloseDate" value={editingDeal.expectedCloseDate ?? ''} error={editErrors.expectedCloseDate} ref={(el) => (editErrorRefs.current.expectedCloseDate = el)} disabled={editingDeal.status === 'sold'} onChange={(e) => setEditingDeal((prev) => ({ ...prev, expectedCloseDate: e.target.value }))} allowManualInput={true} placeholder="Select date" />
                      <Input label="Earnest Money Deposit (EMD) ($)" type="text" inputMode="numeric" value={formatNumber(editingDeal.emd || '')} error={editErrors.emd} ref={(el) => (editErrorRefs.current.emd = el)} disabled={editingDeal.status === 'sold'} onChange={(e) => setEditingDeal((prev) => ({ ...prev, emd: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                      <Input label="Down Payment (Excluding closing costs) ($)" type="text" inputMode="numeric" value={formatNumber(editingDeal.downPayment || '')} disabled={editingDeal.status === 'sold'} onChange={(e) => setEditingDeal((prev) => ({ ...prev, downPayment: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                      <Input label="Assignment Fee ($)" type="text" inputMode="numeric" value={formatNumber(editingDeal.assignmentFee || '')} disabled={editingDeal.status === 'sold'} onChange={(e) => setEditingDeal((prev) => ({ ...prev, assignmentFee: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />





                    </div>

                    {/* Assignment Fee explainer */}
                    <div className="rounded-lg text-[12] rounded-xl border-l-4 border-amber-400 bg-gradient-to-r from-amber-50 to-transparent px-4 py-5">
                      <div className="flex items-center gap-2 font-semibold text-[14px] font-bold uppercase tracking-wider text-amber-700 mb-1">
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                        </svg>
                        How the Assignment Fee works on the public website
                      </div>
                      <p className="mt-1.5 mb-1 text-[14px] leading-relaxed text-slate-600 leading-relaxed">
                        The Assignment Fee is <strong>not shown</strong> to clients. Instead, it is automatically
                        added to both the <strong>Price</strong> and the <strong>Down Payment</strong> displayed
                        on the public listing — this is the retail price clients see.
                      </p>
                      {(() => {
                        const fee = Number(editingDeal.assignmentFee) || 0;
                        const price = Number(editingDeal.price) || 0;
                        const down = Number(editingDeal.downPayment) || 0;
                        if (!fee) return null;
                        return (
                          <div className="mt-2 pt-2 border-t border-blue-200 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-medium text-blue-800">
                            <div className="rounded mt-2 px-3 py-3 border-slate-200 bg-white rounded-xl border border-gray-100 ">
                              <div className="text-sky-700 font-bold text-[13px] uppercase tracking-wide mb-0.5">Assignment Fee</div>
                              <div className="text-[14px] mt-2 font-bold text-gray-800">${fee.toLocaleString('en-US')}</div>
                            </div>
                            <div className="rounded mt-2 px-3 py-3 border-slate-200 bg-white rounded-xl border border-gray-100 ">
                              <div className="text-sky-700 font-bold text-[13px] uppercase tracking-wide mb-0.5">Public Price</div>
                              <div className="text-[14px] mt-2 font-bold text-gray-800">${(price + fee).toLocaleString('en-US')}</div>
                              <div className="text-blue-600 mt-2 text-[12px]">(${price.toLocaleString('en-US')} + Assignment fees)</div>
                            </div>
                            <div className="rounded mt-2 px-3 py-3 border-slate-200 bg-white rounded-xl border border-gray-100 ">
                              <div className="text-sky-700 font-bold text-[13px] uppercase tracking-wide mb-0.5">Public Down Payment</div>
                              <div className="text-[14px] mt-2 font-bold text-gray-800">${(down + fee).toLocaleString('en-US')}</div>
                              <div className="text-blue-600 mt-2 text-[12px]">(${down.toLocaleString('en-US')} + Assignment fees)</div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* PRIMARY MORTGAGE */}
                    <Select label="Is There a Primary Mortgage?" value={editingDeal.hasPrimaryMortgage || ''} onChange={(e) => setEditingDeal((prev) => ({ ...prev, hasPrimaryMortgage: e.target.value }))} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
                    {editingDeal.hasPrimaryMortgage === 'yes' && (
                      <div className="border border-border rounded-lg p-4">
                        <p className="text-base font-semibold text-text-primary mb-4">Primary Mortgage Details</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                          <Input label="Loan Balance ($)" type="text" inputMode="numeric" value={formatNumber(editingDeal.primaryLoanBalance || '')} onChange={(e) => setEditingDeal((prev) => ({ ...prev, primaryLoanBalance: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                          <Input label="Interest Rate (%)" type="text" inputMode="decimal" value={editingDeal.primaryInterestRate ?? ''} onChange={(e) => setEditingDeal((prev) => ({ ...prev, primaryInterestRate: e.target.value.replace(/[^0-9.]/g, '') }))} />
                          <DateInput label="Maturity Date" name="primaryMaturityDate" value={editingDeal.primaryMaturityDate ?? ''} onChange={(e) => setEditingDeal((prev) => ({ ...prev, primaryMaturityDate: e.target.value }))} placeholder="Select date" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Input label="Combined Principal & Interest ($)" type="text" inputMode="numeric" value={formatNumber(editingDeal.primaryPrincipalInterest || '')} onChange={(e) => setEditingDeal((prev) => ({ ...prev, primaryPrincipalInterest: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                          <Input label="Taxes & Insurance ($)" type="text" inputMode="numeric" value={formatNumber(editingDeal.primaryTaxesInsurance || '')} onChange={(e) => setEditingDeal((prev) => ({ ...prev, primaryTaxesInsurance: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                        </div>
                      </div>
                    )}

                    {/* SECOND MORTGAGE */}
                    <Select label="Is There a Second Mortgage?" value={editingDeal.hasSecondMortgage || ''} onChange={(e) => setEditingDeal((prev) => ({ ...prev, hasSecondMortgage: e.target.value }))} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
                    {editingDeal.hasSecondMortgage === 'yes' && (
                      <div className="border border-border rounded-lg p-4">
                        <p className="text-base font-semibold text-text-primary mb-4">Second Mortgage Details</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                          <Input label="Loan Balance ($)" type="text" inputMode="numeric" value={formatNumber(editingDeal.secondLoanBalance || '')} onChange={(e) => setEditingDeal((prev) => ({ ...prev, secondLoanBalance: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                          <Input label="Interest Rate (%)" type="text" inputMode="decimal" value={editingDeal.secondInterestRate ?? ''} onChange={(e) => setEditingDeal((prev) => ({ ...prev, secondInterestRate: e.target.value.replace(/[^0-9.]/g, '') }))} />
                          <DateInput label="Maturity Date" name="secondMaturityDate" value={editingDeal.secondMaturityDate ?? ''} onChange={(e) => setEditingDeal((prev) => ({ ...prev, secondMaturityDate: e.target.value }))} placeholder="Select date" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Input label="Combined Principal & Interest ($)" type="text" inputMode="numeric" value={formatNumber(editingDeal.secondPrincipalInterest || '')} onChange={(e) => setEditingDeal((prev) => ({ ...prev, secondPrincipalInterest: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                          <Input label="Taxes & Insurance ($)" type="text" inputMode="numeric" value={formatNumber(editingDeal.secondTaxesInsurance || '')} onChange={(e) => setEditingDeal((prev) => ({ ...prev, secondTaxesInsurance: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                        </div>
                      </div>
                    )}

                    {/* SELLER EQUITY */}
                    <Select label="Is There Any Seller Equity?" value={editingDeal.hasSellerEquity || ''} onChange={(e) => setEditingDeal((prev) => ({ ...prev, hasSellerEquity: e.target.value }))} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
                    {editingDeal.hasSellerEquity === 'yes' && (
                      <div className="border border-border rounded-lg p-4">
                        <p className="text-base font-semibold text-text-primary mb-4">Seller Equity Details</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                          <Input label="Seller Loan Amount ($)" type="text" inputMode="numeric" value={formatNumber(editingDeal.sellerEquityAmount || '')} onChange={(e) => setEditingDeal((prev) => ({ ...prev, sellerEquityAmount: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                          <Input label="Interest Rate (%)" type="text" inputMode="decimal" value={editingDeal.sellerEquityInterestRate ?? ''} onChange={(e) => setEditingDeal((prev) => ({ ...prev, sellerEquityInterestRate: e.target.value.replace(/[^0-9.]/g, '') }))} />
                          <DateInput label="Maturity Date" name="sellerEquityMaturityDate" value={editingDeal.sellerEquityMaturityDate ?? ''} onChange={(e) => setEditingDeal((prev) => ({ ...prev, sellerEquityMaturityDate: e.target.value }))} placeholder="Select date" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Input label="Combined Principal & Interest ($)" type="text" inputMode="numeric" value={formatNumber(editingDeal.sellerEquityPrincipalInterest || '')} onChange={(e) => setEditingDeal((prev) => ({ ...prev, sellerEquityPrincipalInterest: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                          <Select label="When Is the Balloon Payment Due?" value={editingDeal.sellerEquityBalloonYears || ''} onChange={(e) => setEditingDeal((prev) => ({ ...prev, sellerEquityBalloonYears: e.target.value }))} options={Array.from({ length: 30 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} ${i + 1 === 1 ? 'Year' : 'Years'}` }))} />
                        </div>
                      </div>
                    )}

                    {/* DEAL TERMS */}
                    <Textarea label="Deal Terms" value={editingDeal.dealTerms || ''} error={editErrors.dealTerms} ref={(el) => (editErrorRefs.current.dealTerms = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, dealTerms: e.target.value }))} rows={6} placeholder="Describe the deal terms, financing details, or any nuances of this transaction..." />

                    {/* TOTAL STARTING MONTHLY PAYMENT — displayed below Deal Terms */}
                    <NumericInput label="Total Starting Monthly Payment ($)" value={formatNumber(editingDeal.totalStartingMonthlyPayment || '')} error={editErrors.totalStartingMonthlyPayment} ref={(el) => (editErrorRefs.current.totalStartingMonthlyPayment = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, totalStartingMonthlyPayment: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} placeholder="e.g., 3,500" />
                  </div>
                )}
              </AccordionSection>

              {/* ═══ Rental Markets Accordion ═══ */}
              <AccordionSection title="Rental Markets" isOpen={openAccordions.rentalMarkets} onToggle={() => toggleAccordion('rentalMarkets')}>
                {/* 1. STR Zoning */}
                <Select label="Confirm STR Zoning Availability" value={editingDeal.strZoning || ''} error={editErrors.strZoning} ref={(el) => (editErrorRefs.current.strZoning = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, strZoning: e.target.value }))} options={[{ value: 'YES', label: 'Yes — Property is approved for STR' }, { value: 'NO', label: 'No — Property is not approved for STR' }, { value: 'UNSURE', label: 'Unsure' }]} />

                {/* 2. Currently operating as STR? */}
                <Select label="Is This Property Currently Operating as an STR?" value={editingDeal.isOperatingSTR || ''} error={editErrors.isOperatingSTR} ref={(el) => (editErrorRefs.current.isOperatingSTR = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, isOperatingSTR: e.target.value }))} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />

                {isOperatingSTREdit && (
                  <div className="space-y-4">
                    <Input label="Link to Current Airbnb or VRBO Listing" value={editingDeal.strListingLink || ''} onChange={(e) => setEditingDeal((prev) => ({ ...prev, strListingLink: e.target.value }))} placeholder="https://..." />

                    <Select label="Is It Turnkey or Furnished?" value={editingDeal.turnkeyFurnished || ''} error={editErrors.turnkeyFurnished} ref={(el) => (editErrorRefs.current.turnkeyFurnished = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, turnkeyFurnished: e.target.value }))} options={[{ value: 'TURNKEY_OPERATING', label: 'Yes — Turnkey / Furnished' }, { value: 'PARTIALLY_FURNISHED', label: 'Partially Furnished' }, { value: 'NOT_FURNISHED', label: 'No — Not Turnkey' }]} />

                    <Select label="Do You Have Access to the STR Financials?" value={editingDeal.hasStrFinancials || ''} onChange={(e) => setEditingDeal((prev) => ({ ...prev, hasStrFinancials: e.target.value }))} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />

                    {hasStrFinancialsEdit && (
                      <div className="border border-border rounded-lg p-4 space-y-4">
                        {/* Upload STR Financial Documents — displayed above Link to STR Data Sheets */}
                        <StrDocsField value={editingDeal.strFinancialDocs || []} onChange={(docs) => setEditingDeal((prev) => ({ ...prev, strFinancialDocs: docs }))} />

                        <Input label="Link to STR Data Sheets (If Applicable)" value={editingDeal.strDataSheetsLink || ''} error={editErrors.strDataSheetsLink} ref={(el) => (editErrorRefs.current.strDataSheetsLink = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, strDataSheetsLink: e.target.value }))} placeholder="https://..." />

                        <hr className="border-border" />
                        <p className="text-base font-semibold text-text-primary">STR Key Metrics</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Input label="Occupancy Rate (%)" value={editingDeal.occupancyRate || ''} error={editErrors.occupancyRate} ref={(el) => (editErrorRefs.current.occupancyRate = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, occupancyRate: e.target.value.replace(/[^0-9.]/g, '') }))} placeholder="e.g., 75" />
                          <NumericInput label="Average Nightly Rate ($)" value={formatNumber(editingDeal.averageNightlyRate || '')} error={editErrors.averageNightlyRate} ref={(el) => (editErrorRefs.current.averageNightlyRate = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, averageNightlyRate: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} placeholder="e.g., 225" />
                          <NumericInput label="Annual Gross Revenue ($)" value={formatNumber(editingDeal.strAnnualRevenue || '')} error={editErrors.strAnnualRevenue} ref={(el) => (editErrorRefs.current.strAnnualRevenue = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, strAnnualRevenue: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} placeholder="e.g., 65,000" />
                          <NumericInput label="Average Monthly Revenue ($)" value={formatNumber(editingDeal.strMonthlyRevenue || '')} error={editErrors.strMonthlyRevenue} ref={(el) => (editErrorRefs.current.strMonthlyRevenue = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, strMonthlyRevenue: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} placeholder="e.g., 5,400" />
                          <NumericInput label="Monthly Utilities ($)" value={formatNumber(editingDeal.strMonthlyUtilities || '')} error={editErrors.strMonthlyUtilities} ref={(el) => (editErrorRefs.current.strMonthlyUtilities = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, strMonthlyUtilities: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} placeholder="e.g., 300" />
                          <NumericInput label="Net Operating Income — NOI ($)" value={formatNumber(editingDeal.strNOI || '')} error={editErrors.strNOI} ref={(el) => (editErrorRefs.current.strNOI = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, strNOI: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} placeholder="e.g., 42,000" />
                          <NumericInput label="Cleaning Fee per Stay ($)" value={formatNumber(editingDeal.strCleaningFee || '')} error={editErrors.strCleaningFee} ref={(el) => (editErrorRefs.current.strCleaningFee = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, strCleaningFee: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} placeholder="e.g., 150" />
                          <Input label="Average Length of Stay (Nights)" value={editingDeal.strAvgStay || ''} error={editErrors.strAvgStay} ref={(el) => (editErrorRefs.current.strAvgStay = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, strAvgStay: e.target.value.replace(/[^0-9.]/g, '') }))} placeholder="e.g., 3" />
                          <Input label="Property Management Fee (%)" value={editingDeal.strManagementFee || ''} error={editErrors.strManagementFee} ref={(el) => (editErrorRefs.current.strManagementFee = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, strManagementFee: e.target.value.replace(/[^0-9.]/g, '') }))} placeholder="e.g., 20" />
                          <Select label="Primary Booking Platform" value={editingDeal.strBookingPlatform || ''} error={editErrors.strBookingPlatform} ref={(el) => (editErrorRefs.current.strBookingPlatform = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, strBookingPlatform: e.target.value }))} options={[{ value: 'AIRBNB', label: 'Airbnb' }, { value: 'VRBO', label: 'VRBO' }, { value: 'BOTH', label: 'Both Airbnb & VRBO' }, { value: 'DIRECT', label: 'Direct Booking' }, { value: 'OTHER', label: 'Other' }]} />
                        </div>

                        {/* Current bookings — displayed after Primary Booking Platform */}
                        <Select label="Does It Have Current Bookings?" value={editingDeal.hasCurrentBookings || ''} error={editErrors.hasCurrentBookings} ref={(el) => (editErrorRefs.current.hasCurrentBookings = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, hasCurrentBookings: e.target.value }))} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
                        {editingDeal.hasCurrentBookings === 'yes' && (
                          <Input label="Current Bookings — Brief Description" type="text" value={editingDeal.currentBookingsDescription || ''} error={editErrors.currentBookingsDescription} ref={(el) => (editErrorRefs.current.currentBookingsDescription = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, currentBookingsDescription: e.target.value }))} placeholder="Briefly describe the current bookings (e.g., dates, number of reservations, revenue already secured)." />
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Confidence in data */}
                <Select label="How Confident Are You In The Accuracy Of The Following Data?" value={editingDeal.strConfidence || ''} error={editErrors.strConfidence} ref={(el) => (editErrorRefs.current.strConfidence = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, strConfidence: e.target.value }))} options={[{ value: 'FIRST_HAND', label: 'I have first-hand information and can verify accuracy' }, { value: 'AIRDNA', label: 'The information is based on AirDNA or similar data' }, { value: 'DIRECTIONAL_ONLY', label: 'The information is directional only' }]} />

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

                {/* Amenities & Attractions (mirrors submit Step 4 optional section) */}
                <Textarea label={<span className="text-base font-semibold">Amenities</span>} value={editingDeal.amenities || ''} error={editErrors.amenities} ref={(el) => (editErrorRefs.current.amenities = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, amenities: e.target.value }))} rows={3} placeholder="Examples: pool, hot tub, EV charger, game room, crib, high chair, fast Wi-Fi..." />
                <Textarea label={<span className="text-base font-semibold">Local Attractions</span>} value={editingDeal.localAttractions || ''} error={editErrors.localAttractions} ref={(el) => (editErrorRefs.current.localAttractions = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, localAttractions: e.target.value }))} rows={3} placeholder="Nearby beaches, parks, venues, ski resorts, downtown districts, etc." />
              </AccordionSection>

              {/* ═══ Property Photos and Videos Accordion ═══ */}
              <AccordionSection title="Property Photos and Videos" isOpen={openAccordions.photosVideos} onToggle={() => toggleAccordion('photosVideos')}>
                <FileUpload label="Cover Photo" accept="image/*" multiple={false} value={editingDeal.coverPhoto || []} onChange={(urls) => setEditingDeal((prev) => ({ ...prev, coverPhoto: urls }))} error={editErrors?.coverPhoto} ref={(el) => (editErrorRefs.current.coverPhoto = el)} />
                <p className="text-sm text-text-secondary -mt-2 mb-2">Only 1 image allowed. This image will be used as the primary display image on the website.</p>
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
              {/* <AccordionSection title="Market Definition" isOpen={openAccordions.marketDefinition} onToggle={() => toggleAccordion('marketDefinition')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select label="Market Type" value={editingDeal.underwritingMarketType || ''} error={editErrors.underwritingMarketType} ref={(el) => (editErrorRefs.current.underwritingMarketType = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, underwritingMarketType: e.target.value }))} options={[{ value: 'MARKET', label: 'Market' }, { value: 'SUBMARKET', label: 'Submarket' }]} />
                  <Select label="Market Size (Active Listings)" value={editingDeal.underwritingMarketSize || ''} error={editErrors.underwritingMarketSize} ref={(el) => (editErrorRefs.current.underwritingMarketSize = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, underwritingMarketSize: e.target.value }))} options={[{ value: '<50', label: 'Less Than 50' }, { value: '51-100', label: '51–100' }, { value: '101-250', label: '101–250 (Recommended)' }, { value: '251-500', label: '251–500 (Recommended)' }, { value: '500+', label: 'Over 500' }]} />
                </div>
              </AccordionSection> */}

              {/* ═══ Total Market Revenue Accordion ═══ */}
              <AccordionSection title="Total Market Revenue" isOpen={openAccordions.totalMarketRevenue} onToggle={() => toggleAccordion('totalMarketRevenue')}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select label="Market Type" value={editingDeal.underwritingMarketType || ''} error={editErrors.underwritingMarketType} ref={(el) => (editErrorRefs.current.underwritingMarketType = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, underwritingMarketType: e.target.value }))} options={[{ value: 'MARKET', label: 'Market' }, { value: 'SUBMARKET', label: 'Submarket' }]} />
                  <Select label="Market Size (Active Listings)" value={editingDeal.underwritingMarketSize || ''} error={editErrors.underwritingMarketSize} ref={(el) => (editErrorRefs.current.underwritingMarketSize = el)} onChange={(e) => setEditingDeal((prev) => ({ ...prev, underwritingMarketSize: e.target.value }))} options={[{ value: '<50', label: 'Less Than 50' }, { value: '51-100', label: '51–100' }, { value: '101-250', label: '101–250 (Recommended)' }, { value: '251-500', label: '251–500 (Recommended)' }, { value: '500+', label: 'Over 500' }]} />
                </div>
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
                    <div>
                      <NumericInput
                        label="Entry or Down Payment ($)"
                        value={formatNumber(
                          editingDeal.expenseEntryDownPayment ||
                          String((Number(editingDeal.downPayment) || 0) + (Number(editingDeal.assignmentFee) || 0))
                        )}
                        error={editErrors.expenseEntryDownPayment}
                        ref={(el) => (editErrorRefs.current.expenseEntryDownPayment = el)}
                        onChange={(e) => setEditingDeal((prev) => ({ ...prev, expenseEntryDownPayment: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))}
                      />
                      {!editingDeal.expenseEntryDownPayment && (
                        <p className="text-[12] text-blue-500 mt-1">Auto-filled from Down Payment + Assignment Fee</p>
                      )}
                    </div>
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
                            (Number(editingDeal.expenseEntryDownPayment) || (Number(editingDeal.downPayment) || 0) + (Number(editingDeal.assignmentFee) || 0)) +
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

              </AccordionSection>

              {/* ═══ 50-50 Partnership Pro Forma Accordion ═══ */}
              <AccordionSection title="50-50 Partnership Pro Forma" isOpen={openAccordions.fiftyFiftyProForma} onToggle={() => toggleAccordion('fiftyFiftyProForma')}>
                {/* 50-50 Partnership Available */}
                <div className="bg-surface border border-border-subtle rounded-lg p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={!!editingDeal.fiftyFiftyPartner} onChange={(e) => setEditingDeal((prev) => ({ ...prev, fiftyFiftyPartner: e.target.checked }))} className="mt-1 w-5 h-5 accent-accent" />
                    <div>
                      <div className="text-base font-semibold text-text-primary">50-50 Partnership Available</div>
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
                {/* 50-50 Partnership Pro Forma */}
                {/* 50-50 Partnership Pre-Approved */}
                <div className="bg-surface border border-border-subtle rounded-lg p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={!!editingDeal.fiftyFiftyPreApproved} onChange={(e) => setEditingDeal((prev) => ({ ...prev, fiftyFiftyPreApproved: e.target.checked }))} className="mt-1 w-5 h-5 accent-accent" />
                    <div>
                      <div className="text-base font-semibold text-text-primary">50-50 Partnership Pre-Approved</div>
                      <div className="text-sm text-text-secondary mt-0.5">This property is pre-approved for a 50-50 partnership but has not yet been purchased.</div>
                    </div>
                  </label>
                  {editingDeal.fiftyFiftyPreApproved && (
                    <div className="mt-4 ml-8 flex items-end gap-4">
                      <div className="w-80">
                        <label className="block text-sm font-medium text-text-secondary mb-1 ">
                          Custom JV Values ($)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={editingDeal.preApprovedJvValues ? Number(editingDeal.preApprovedJvValues).toLocaleString('en-US') : ''}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, '');
                            setEditingDeal((prev) => ({ ...prev, preApprovedJvValues: raw }));
                          }}
                          className="w-full px-3 py-2 bg-app border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                          placeholder="e.g. 60,000"
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer mb-1">
                        <input
                          type="checkbox"
                          checked={!!editingDeal.preApprovedCostsIncluded}
                          onChange={(e) =>
                            setEditingDeal((prev) => ({
                              ...prev,
                              preApprovedCostsIncluded: e.target.checked,
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
                <FileUpload accept="image/*,application/pdf" multiple value={editingDeal.underwritingImages || []} onChange={(urls) => setEditingDeal((prev) => ({ ...prev, underwritingImages: urls }))} error={editErrors?.underwritingImages} ref={(el) => (editErrorRefs.current.underwritingImages = el)} />
              </AccordionSection>

            </div>

            {/* Footer */}
            <div className="bg-white border-t border-border-subtle px-6 py-3.5 flex items-center justify-between gap-3 shrink-0">
              <span className="text-xs text-text-secondary" />
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setEditingDeal(null)}>Cancel</Button>
                <Button variant="primary" onClick={saveManageProperty} loading={updateMutation.isPending}>{pendingRenewal ? 'Save & Renew' : 'Save Changes'}</Button>
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

      {/* Approve & Publish Confirm Modal (pending → Active) */}
      <Modal isOpen={!!confirmApproveAndPublishId} onClose={() => setConfirmApproveAndPublishId(null)} title="Set as Active" size="sm">
        <div className="space-y-4">
          <p className="text-text-primary">This will approve and publish the deal to customer view.</p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setConfirmApproveAndPublishId(null)} className="min-w-[100px]">Cancel</Button>
            <Button variant="primary" onClick={() => approveAndPublishMutation.mutate(confirmApproveAndPublishId)} loading={approveAndPublishMutation.isPending} className="min-w-[120px]">Confirm</Button>
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

      {/* Renewal Questions Modal */}
      <Modal
        isOpen={!!renewalDeal}
        onClose={() => { setRenewalDeal(null); setRenewalAnswers({ statusChanged: null, newStatus: null, financialChanged: null, wantsEdits: null }); }}
        title="Renew Property"
        size="lg"
      >
        {renewalDeal && (
          <div className="space-y-6">

            {/* Property info strip */}
            <div className="grid grid-cols-2 gap-3 bg-gray-50 border border-border-subtle rounded-xl p-4 text-sm">
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wide mb-0.5">Property</p>
                <p className="font-semibold text-text-primary">{renewalDeal.title || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wide mb-0.5">Submitted By</p>
                <p className="font-semibold text-text-primary">{renewalDeal.submitterEmail || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wide mb-0.5">Expired On</p>
                <p className="font-semibold text-text-primary">{renewalDeal.expiry_date || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wide mb-0.5">New Expiry After Renewal</p>
                <p className="font-semibold text-green-600">20 days from today</p>
              </div>
            </div>

            <div className="space-y-5">

              {/* Q1 */}
              <div className="rounded-xl border border-border-subtle overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-border-subtle">
                  <p className="text-sm font-semibold text-text-primary">1. Has the status of this property changed?</p>
                </div>
                <div className="grid grid-cols-2 divide-x divide-border-subtle">
                  {['yes', 'no'].map((opt) => {
                    const selected = renewalAnswers.statusChanged === opt;
                    return (
                      <label
                        key={opt}
                        className={`flex items-center gap-3 px-5 py-4 cursor-pointer transition-colors ${selected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      >
                        <input
                          type="radio"
                          name="statusChanged"
                          value={opt}
                          checked={selected}
                          onChange={() => setRenewalAnswers((prev) => ({ ...prev, statusChanged: opt, newStatus: opt === 'no' ? null : prev.newStatus }))}
                          className="w-4 h-4 accent-blue-600"
                        />
                        <span className={`text-sm font-medium ${selected ? 'text-blue-700' : 'text-text-primary'}`}>
                          {opt === 'yes' ? 'Yes' : 'No'}
                        </span>
                      </label>
                    );
                  })}
                </div>

                {renewalAnswers.statusChanged === 'yes' && (
                  <div className="border-t border-border-subtle bg-amber-50 px-4 py-3">
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Select new status</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[{ value: 'pending', label: 'Pending', color: 'orange' }, { value: 'sold', label: 'Sold', color: 'gray' }].map((opt) => {
                        const sel = renewalAnswers.newStatus === opt.value;
                        return (
                          <label
                            key={opt.value}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${sel ? 'border-amber-500 bg-white shadow-sm' : 'border-border-subtle bg-white hover:border-amber-300'}`}
                          >
                            <input
                              type="radio"
                              name="newStatus"
                              value={opt.value}
                              checked={sel}
                              onChange={() => setRenewalAnswers((prev) => ({ ...prev, newStatus: opt.value }))}
                              className="w-4 h-4 accent-amber-500"
                            />
                            <span className={`text-sm font-medium ${sel ? 'text-amber-700' : 'text-text-primary'}`}>{opt.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Q2 */}
              <div className="rounded-xl border border-border-subtle overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-border-subtle">
                  <p className="text-sm font-semibold text-text-primary">2. Have the financial terms of the deal changed?</p>
                </div>
                <div className="grid grid-cols-2 divide-x divide-border-subtle">
                  {['yes', 'no'].map((opt) => {
                    const selected = renewalAnswers.financialChanged === opt;
                    return (
                      <label
                        key={opt}
                        className={`flex items-center gap-3 px-5 py-4 cursor-pointer transition-colors ${selected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      >
                        <input
                          type="radio"
                          name="financialChanged"
                          value={opt}
                          checked={selected}
                          onChange={() => setRenewalAnswers((prev) => ({ ...prev, financialChanged: opt }))}
                          className="w-4 h-4 accent-blue-600"
                        />
                        <span className={`text-sm font-medium ${selected ? 'text-blue-700' : 'text-text-primary'}`}>
                          {opt === 'yes' ? 'Yes' : 'No'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Q3 */}
              <div className="rounded-xl border border-border-subtle overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-border-subtle">
                  <p className="text-sm font-semibold text-text-primary">3. Would you like to make edits to the property?</p>
                </div>
                <div className="grid grid-cols-2 divide-x divide-border-subtle">
                  {['yes', 'no'].map((opt) => {
                    const selected = renewalAnswers.wantsEdits === opt;
                    return (
                      <label
                        key={opt}
                        className={`flex items-center gap-3 px-5 py-4 cursor-pointer transition-colors ${selected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      >
                        <input
                          type="radio"
                          name="wantsEdits"
                          value={opt}
                          checked={selected}
                          onChange={() => setRenewalAnswers((prev) => ({ ...prev, wantsEdits: opt }))}
                          className="w-4 h-4 accent-blue-600"
                        />
                        <span className={`text-sm font-medium ${selected ? 'text-blue-700' : 'text-text-primary'}`}>
                          {opt === 'yes' ? 'Yes' : 'No'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

            </div>

            {(renewalAnswers.statusChanged === 'yes' || renewalAnswers.financialChanged === 'yes' || renewalAnswers.wantsEdits === 'yes') && (
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <svg className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-amber-700">You will be redirected to the listing edit screen before the renewal is completed.</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-1 border-t border-border-subtle">
              <Button
                variant="secondary"
                onClick={() => { setRenewalDeal(null); setRenewalAnswers({ statusChanged: null, newStatus: null, financialChanged: null, wantsEdits: null }); }}
                className="min-w-[110px]"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleRenewalProceed}
                loading={renewMutation.isPending}
                disabled={
                  !renewalAnswers.statusChanged ||
                  !renewalAnswers.financialChanged ||
                  !renewalAnswers.wantsEdits ||
                  (renewalAnswers.statusChanged === 'yes' && !renewalAnswers.newStatus)
                }
                className="min-w-[140px]"
              >
                {renewalAnswers.statusChanged === 'yes' || renewalAnswers.financialChanged === 'yes' || renewalAnswers.wantsEdits === 'yes'
                  ? 'Go to Edit'
                  : 'Renew'}
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

      {/* Transient toast shown when a full address is copied */}
      {addressCopied && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Address copied to clipboard
        </div>
      )}
    </div>
  );
};

export default PropertyManagement;
