import { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { dealsAPI } from '../../api/deals';
import { useAuth } from '../../contexts/AuthContext';
import logoDarkBlue from '../../assets/icons/logo-scholarship-house/logo-dark-blue.png';
import Button from '../Button';
import Loader from '../Loader';
import Input from '../Input';
import Select from '../Select';
import DateInput from '../DateInput';
import Modal from '../Modal';
import NotificationModal from '../NotificationModal';
import Textarea from '../Textarea';
import FileUpload from '../FileUpload';
import { normalizeMediaArray } from '../../utils/uploadFiles';
import { formatNumber, unformatNumber, formatPhoneDisplay } from '../../utils/format';
import { deriveTurnkey } from '../../utils/turnkey';
import { validateDealForm } from '../../utils/validateDealForm';
import { useHasPermission } from '../../utils/roles';



const fieldToLabel = (field) =>
    field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).replace(/_/g, ' ');

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
                className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
                    dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
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


// Utility function to format numbers with commas
const formatPrice = (price) => {
  const parsed = parseFloat(price);
  if (isNaN(parsed) || !price) return 'Not set';
  return parseInt(parsed).toLocaleString('en-US');
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

// Per-section icons for the Edit Property accordion (mirror admin's Manage Property).
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

// Collapsible accordion section for the Edit Property modal (mirrors admin's
// Manage Property modal). Renders its children only when open.
const AccordionSection = ({ title, isOpen, onToggle, children }) => {
    const icon = ACCORDION_ICONS[title] || null;
    return (
        <div className={`rounded-xl overflow-hidden transition-all duration-200 border ${isOpen ? 'border-blue-200 shadow-sm' : 'border-border-subtle shadow-sm hover:shadow-md'}`}>
            <button
                type="button"
                onClick={onToggle}
                className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-all duration-200 ${isOpen ? 'bg-blue-50 hover:bg-blue-100/70' : 'bg-white hover:bg-gray-50'}`}
            >
                <span className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-colors ${isOpen ? 'bg-white text-blue-600 ring-1 ring-blue-200' : 'bg-amber-100 text-gray-700'}`}>
                    {icon}
                </span>
                <span className="text-sm font-semibold truncate flex-1 text-text-primary">{title}</span>
                <svg className={`w-4 h-4 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-blue-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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

const CATEGORIES = [
    { value: 'SINGLE_FAMILY', label: 'Single Family Home' },
    { value: 'CONDO', label: 'Condo' },
    { value: 'TOWNHOUSE', label: 'Town House' },
    { value: 'TWO_TO_FOUR_UNIT', label: '2–4 Unit Home' },
    { value: 'UNIQUE_PROPERTY', label: 'Unique Property (Treehouses, Castles, Yurts, Etc.)' },
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

const TRAVEL_MOTIVATIONS = [
    'Conventions & Conferences', 'Exhibitions & Trade Shows', 'Medical Facilities',
    'College Activities', 'Sporting Events', 'Theme Parks', 'Relax & Unwind',
    'Sportsman Destinations – Fishing & Hunting',
    'Outdoor Activities – Hiking, Biking, Rafting, Skiing, Boating',
    'State & National Park Visits', 'Unplug & Disconnect', 'Experience a Unique Culture',
    'Romantic Getaway', 'Historic Districts & Attractions',
    'Bleisure – Business & Leisure Travel', 'Food & Wine Tasting', 'Art & Cultural Experience',
];

const SUBMITTER_RELATIONSHIP_OPTIONS = [
    { value: 'TEAM_MEMBER', label: 'Team Member' },
    { value: 'REALTOR_LISTING_OWNER', label: 'Realtor – Listing Owner' },
    { value: 'REALTOR_NOT_LISTING_OWNER', label: 'Realtor – Not Listing Owner' },
    { value: 'WHOLESALER_HOLDS_CONTRACT', label: 'Wholesaler – Holds Contract' },
    { value: 'WHOLESALER_NO_CONTRACT', label: 'Wholesaler – No Contract' },
    { value: 'REAL_ESTATE_PROFESSIONAL', label: 'Real Estate Professional' },
    { value: 'BIRDDOGGER', label: 'Bird Dogger' },
];

const TURNKEY_OPTIONS = [
    { value: 'TURNKEY_OPERATING', label: 'Turnkey and Currently Operating As a Short-Term Rental.' },
    { value: 'FURNISHED_NOT_OPERATING', label: 'Fully Furnished but not Currently Operating As a Short-Term Rental.' },
    { value: 'PARTIALLY_FURNISHED', label: 'Partially Furnished but not Currently Operating As a Short-Term Rental.' },
    { value: 'NOT_FURNISHED', label: 'Not Furnished or Currently Operating as a Short-Term Rental.' },
];

const FINANCING_OPTIONS = [
    { value: 'traditional', label: 'Traditional' },
    { value: 'subject-to', label: 'Subject-To' },
    { value: 'hybrid', label: 'Hybrid' },
    { value: 'seller', label: 'Seller Financing' },
    { value: 'cash', label: 'Cash' },
];

const generateDealTitle = ({ bedrooms, bathrooms, city, stateRegion }) => {
    if (!bedrooms || !bathrooms || !city || !stateRegion) return '';
    return `${bedrooms} Bedroom, ${bathrooms} Bathroom in ${city}, ${stateRegion}`;
};

const getUserTypeLabel = (type) => {
    if (!type) return '';
    const map = {
        admin: 'Admin', submitter: 'Submitter', validator: 'Validator',
        realtor: 'Realtor', wholesaler: 'Wholesaler', birddogger: 'Bird Dogger',
        team_member: 'Team Member', client: 'Client',
        real_estate_professional: 'Real Estate Professional',
    };
    return map[type] || type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
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

const ITEMS_PER_PAGE = 10;

// Numeric pagination strip with smart ellipsis — same component used in
// the admin Property Management page, so the two screens feel consistent.
// Renders nothing when there's only one page.
const Pagination = ({ currentPage, totalItems, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    if (totalPages <= 1) return null;

    const getPages = () => {
        const pages = [];
        if (totalPages <= 7) {
            // Few enough pages to render them all without ellipsis.
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            // First page, optional left ellipsis, the window around
            // the current page, optional right ellipsis, last page.
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
        return pages;
    };

    return (
        <div className="px-6 py-4 bg-surface border-t border-border-subtle flex items-center justify-center gap-1">
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded text-sm border border-border-subtle disabled:opacity-40 hover:bg-app transition-colors"
                aria-label="Previous page"
            >
                ‹
            </button>
            {getPages().map((p, i) =>
                p === '...' ? (
                    <span
                        key={`ellipsis-${i}`}
                        className="px-2 py-1 text-sm text-text-secondary"
                    >
                        …
                    </span>
                ) : (
                    <button
                        key={p}
                        onClick={() => onPageChange(p)}
                        className={`px-3 py-1 rounded text-sm border transition-colors ${
                            p === currentPage
                                ? 'bg-primary text-white border-primary'
                                : 'border-border-subtle hover:bg-app text-text-primary'
                        }`}
                        aria-current={p === currentPage ? 'page' : undefined}
                    >
                        {p}
                    </button>
                )
            )}
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded text-sm border border-border-subtle disabled:opacity-40 hover:bg-app transition-colors"
                aria-label="Next page"
            >
                ›
            </button>
        </div>
    );
};

// Only 'published' and 'approved' deals are considered Active (visible/live).
// Style + display label for each known status. Lookup is by lowercase
// status string. Anything not in the map falls through to the
// neutral grey "Inactive" treatment so the UI never crashes on a
// new/unknown status.
const STATUS_STYLES = {
    pending: {
        label: 'Needs Approval',
        bg: 'bg-orange-50',
        text: 'text-orange-700',
        ring: 'ring-orange-200',
        dot: 'bg-orange-500',
    },
    approved: {
        label: 'Approved',
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        ring: 'ring-blue-200',
        dot: 'bg-blue-500',
    },
    rejected: {
        label: 'Rejected',
        bg: 'bg-red-50',
        text: 'text-red-700',
        ring: 'ring-red-200',
        dot: 'bg-red-500',
    },
    published: {
        label: 'Active',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        ring: 'ring-emerald-200',
        dot: 'bg-emerald-500',
    },
    sold: {
        label: 'Sold',
        bg: 'bg-purple-50',
        text: 'text-purple-700',
        ring: 'ring-purple-200',
        dot: 'bg-purple-500',
    },
    draft: {
        label: 'Draft',
        bg: 'bg-gray-100',
        text: 'text-gray-600',
        ring: 'ring-gray-200',
        dot: 'bg-gray-400',
    },
};

const ACTIVE_STATUSES = new Set(['published', 'approved']);

const isActive = (status) => ACTIVE_STATUSES.has(String(status || '').toLowerCase());

const getLastUpdated = (deal) =>
    deal.updatedAt || deal.publishedAt || deal.submittedAt || deal.createdAt || null;

// Display-friendly property ID — matches the format used on the admin
// Property Management page so the same identifier appears everywhere.
// Combines the leading numeric portion of the street address with the
// postal code: "1748 N Hayden Rd" + "85006"  ->  "1748-85006".
const getPropertyId = (deal) => {
    const streetNum = (deal.streetAddress || '').trim().split(' ')[0].replace(/\D/g, '');
    const postal = (deal.postalCode || '').trim();
    if (!streetNum && !postal) return '';
    if (!streetNum) return postal;
    if (!postal) return streetNum;
    return `${streetNum}-${postal}`;
};

const formatDate = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const StatusBadge = ({ status }) => {
    const key = String(status || '').toLowerCase();
    // Fall back to a neutral grey badge for unknown / missing statuses
    // so we still show something useful instead of nothing.
    const style = STATUS_STYLES[key] || {
        label: status ? String(status) : 'Unknown',
        bg: 'bg-gray-100',
        text: 'text-gray-600',
        ring: 'ring-gray-200',
        dot: 'bg-gray-400',
    };
    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${style.bg} ${style.text} ${style.ring}`}
            title={`Raw status: ${status || 'unknown'}`}
        >
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            {style.label}
        </span>
    );
};

// Maps each validatable field to the accordion section it lives in, so a
// validation error can open the right section before scrolling to the field.
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

const MyProperties = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [search, setSearch] = useState('');
    // Active status tab. 'All' shows everything; the other values match
    // the canonical lowercase status strings used on deals so that
    // (deal.status || '').toLowerCase() === statusFilter just works.
    const [statusFilter, setStatusFilter] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [editing, setEditing] = useState(null);
    const [editForm, setEditForm] = useState(null);
    const [editErrors, setEditErrors] = useState({});
    const editErrorRefs = useRef({});
    const [notification, setNotification] = useState({ open: false, type: 'info', title: '', message: '' });

    // Edit modal accordion (mirrors admin's Manage Property modal). First
    // section open by default; toggling one closes the others.
    const [openAccordions, setOpenAccordions] = useState({
        userInfo: true,
        property: false,
        location: false,
        financial: false,
        rentalMarkets: false,
        photosVideos: false,
    });
    const toggleAccordion = (key) =>
        setOpenAccordions((prev) => {
            const isOpen = prev[key];
            const allClosed = Object.fromEntries(Object.keys(prev).map((k) => [k, false]));
            return { ...allClosed, [key]: !isOpen };
        });
    const expandAllAccordions = () =>
        setOpenAccordions((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, true])));
    const collapseAllAccordions = () =>
        setOpenAccordions((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, false])));

    // Conditional-flow flags for the edit modal (mirror the submit wizard).
    const isCreativeFinancingEdit = ['creative', 'subject-to', 'hybrid', 'seller'].includes(editForm?.financingType);
    const isOperatingSTREdit = editForm?.isOperatingSTR === 'yes';
    const hasStrFinancialsEdit = editForm?.hasStrFinancials === 'yes';

    const { data: deals = [], isLoading, error, } = useQuery({
        queryKey: ['myProperties', user?.email],
        queryFn: dealsAPI.getMyDeals,
        enabled: !!user?.email,
        staleTime: 0,
    });

    const deleteMutation = useMutation({
        mutationFn: dealsAPI.unsubmitDeal,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['myProperties'] });
            setPendingDelete(null);
            setNotification({
                open: true,
                type: 'success',
                title: 'Property Deleted',
                message: 'The property has been removed from your submissions.',
            });
        },
        onError: (err) => {
            setPendingDelete(null);
            setNotification({
                open: true,
                type: 'error',
                title: 'Delete Failed',
                message:
                    err?.response?.data?.message ||
                    'Could not delete this property. Published or approved properties must be removed by an admin.',
            });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ dealId, updates }) => dealsAPI.updateMyDeal(dealId, updates),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['myProperties'] });
            setEditing(null);
            setEditForm(null);
            setEditErrors({});
            setNotification({
                open: true,
                type: 'success',
                title: 'Property Updated',
                message: 'The deal has been updated successfully!',
            });
        },
        onError: (err) => {
            setNotification({
                open: true,
                type: 'error',
                title: 'Update Failed',
                message:
                    err?.response?.data?.error ||
                    err?.response?.data?.message ||
                    'Could not update this property. Please try again.',
            });
        },
    });

    // Status tab definitions. Order drives the tab strip rendering.
    // The `match` function is what decides whether a deal belongs in
    // that tab — usually a simple lowercase compare against deal.status,
    // but kept as a callback so each tab can have its own logic if
    // needed (e.g. an "Active" tab that aggregates several statuses).
    const STATUS_TABS = useMemo(() => [
        { key: 'All',       label: 'All Statuses', match: () => true },
        { key: 'pending',   label: 'Pending',      match: (s) => s === 'pending' },
        { key: 'approved',  label: 'Approved',     match: (s) => s === 'approved' },
        { key: 'rejected',  label: 'Rejected',     match: (s) => s === 'rejected' },
        { key: 'published', label: 'Published',    match: (s) => s === 'published' },
        { key: 'sold',      label: 'Sold',         match: (s) => s === 'sold' },
    ], []);

    // Count per tab — drives the "(N)" pill on each tab. Computed off
    // the unfiltered deals list so a tab's count never depends on the
    // search box or the currently-active tab.
    const statusCounts = useMemo(() => {
        const counts = {};
        for (const tab of STATUS_TABS) counts[tab.key] = 0;
        for (const d of deals) {
            const s = String(d.status || '').toLowerCase();
            for (const tab of STATUS_TABS) {
                if (tab.match(s)) counts[tab.key] += 1;
            }
        }
        return counts;
    }, [deals, STATUS_TABS]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        const activeTab = STATUS_TABS.find((t) => t.key === statusFilter) || STATUS_TABS[0];

        const list = deals.filter((d) => {
            const status = String(d.status || '').toLowerCase();
            // 1. Status tab gate
            if (!activeTab.match(status)) return false;
            // 2. Free-text search on title/status (unchanged behavior)
            if (!term) return true;
            return (
                (d.title || '').toLowerCase().includes(term) ||
                status.includes(term)
            );
        });
        return [...list].sort(
            (a, b) => new Date(getLastUpdated(b) || 0) - new Date(getLastUpdated(a) || 0)
        );
    }, [deals, search, statusFilter, STATUS_TABS]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const page = Math.min(currentPage, totalPages);
    const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const canDelete = (deal) => String(deal.status || '').toLowerCase() === 'pending';

    // Click-to-copy full address + transient "copied" toast.
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

    const handleEdit = (deal) => {
        const status = String(deal.status || '').toLowerCase();
        if (status === 'published' || status === 'sold' || status === 'approved') {
            setNotification({
                open: true,
                type: 'info',
                title: 'Editing Unavailable',
                message:
                    'Approved or published properties cannot be edited directly. Contact an admin to request changes.',
            });
            return;
        }
        setEditErrors({});
        // Always reopen on the first ("User Information") section.
        setOpenAccordions({ userInfo: true, property: false, location: false, financial: false, rentalMarkets: false, photosVideos: false });
        setEditing(deal);
        // Old listings may have an empty or legacy financing type. Default those
        // to "creative" so the dropdown shows a selection and the creative
        // financing fields (Expected Close, EMD, mortgages, etc.) display.
        const ft = String(deal.financingType || '').toLowerCase();
        const normalizedFinancing = (!ft || ['subject-to', 'hybrid', 'seller'].includes(ft)) ? 'creative' : deal.financingType;
        setEditForm({
            ...deal,
            financingType: normalizedFinancing,
            isOperatingSTR: deal.isOperatingSTR || 'no',
            status: status || 'pending',
            vacationRentalMarkets: Array.isArray(deal.vacationRentalMarkets) ? deal.vacationRentalMarkets : [],
            travelMotivations: Array.isArray(deal.travelMotivations) ? deal.travelMotivations : [],
            specialTags: Array.isArray(deal.specialTags) ? deal.specialTags : [],
            coverPhoto: deal.coverPhoto || [],
            interiorImages: deal.interiorImages || [],
            exteriorImages: deal.exteriorImages || [],
            additionalImages: deal.additionalImages || [],
            videos: deal.videos || [],
        });
    };

    useEffect(() => {
        if (!editForm) return;
        const generatedTitle = generateDealTitle({
            bedrooms: editForm.bedrooms,
            bathrooms: editForm.bathrooms,
            city: editForm.city,
            stateRegion: editForm.stateRegion,
        });
        if (generatedTitle && generatedTitle !== editForm.title) {
            setEditForm((f) => ({ ...f, title: generatedTitle }));
        }
    }, [editForm?.bedrooms, editForm?.bathrooms, editForm?.city, editForm?.stateRegion]);

    const closeEdit = () => {
        if (updateMutation.isPending) return;
        setEditing(null);
        setEditForm(null);
        setEditErrors({});
    };

    const normalizeForSave = (deal) => {
        const normalizeEmpty = (v) => (v === '' || v === undefined ? null : v);
        const stripNumber = (v) => (typeof v === 'string' ? v.replace(/[^0-9.-]/g, '') : v);

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
            bedrooms: stripNumber(deal.bedrooms),
            bathrooms: stripNumber(deal.bathrooms),
            subjLoanBalance: stripNumber(deal.subjLoanBalance),
            subjInterestRate: stripNumber(deal.subjInterestRate),
            subjMonthlyPrincipal: stripNumber(deal.subjMonthlyPrincipal),
            subjMonthlyInterest: stripNumber(deal.subjMonthlyInterest),
            subjMonthlyTaxesInsurance: stripNumber(deal.subjMonthlyTaxesInsurance),
            sellerLoanAmount: stripNumber(deal.sellerLoanAmount),
            sellerInterestRate: stripNumber(deal.sellerInterestRate),
            sellerMonthlyPayment: stripNumber(deal.sellerMonthlyPayment),
            totalMonthlyPayment: stripNumber(deal.totalMonthlyPayment),
            totalStartingMonthlyPayment: stripNumber(deal.totalStartingMonthlyPayment),
            assignmentFee: stripNumber(deal.assignmentFee),
            expectedCloseDate: normalizeEmpty(deal.expectedCloseDate),
            subjLoanMaturity: normalizeEmpty(deal.subjLoanMaturity),
            sellerLoanMaturity: normalizeEmpty(deal.sellerLoanMaturity),
            expiry_date: normalizeEmpty(deal.expiry_date),
        };
    };

    const validateMyEdit = () => {
        const { errors, firstErrorField } = validateDealForm(editForm, {
            requireMedia: true,
            requireRequiredFields: true,
        });
        setEditErrors(errors);
        return { firstErrorField, errors };
    };

    const handleEditSave = async () => {
        if (!editing || !editForm) return;

        const { firstErrorField, errors } = validateMyEdit();
        if (firstErrorField) {
            // Show the same kind of popup as the add-property submission. When
            // the user dismisses it, open the accordion section that holds the
            // first invalid field, scroll to it, and focus/highlight it (the
            // field already shows a red border via its `error` prop).
            const errorMessages = Object.entries(errors)
                .slice(0, 5)
                .map(([field, msg]) => `${fieldToLabel(field)}: ${msg}`)
                .join('\n• ');
            const extraCount = Object.keys(errors).length - 5;
            const suffix = extraCount > 0 ? `\n...and ${extraCount} more` : '';

            const goToFirstError = () => {
                const section = FIELD_SECTION[firstErrorField];
                if (section) {
                    setOpenAccordions((prev) => {
                        const allClosed = Object.fromEntries(Object.keys(prev).map((k) => [k, false]));
                        return { ...allClosed, [section]: true };
                    });
                }
                setTimeout(() => {
                    const ref = editErrorRefs.current[firstErrorField];
                    if (ref) {
                        ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        setTimeout(() => ref.focus?.({ preventScroll: true }), 300);
                    }
                }, 180);
            };

            setNotification({
                open: true,
                type: 'warning',
                title: 'Required Fields Missing',
                message: `Please complete the following required fields before saving:\n• ${errorMessages}${suffix}`,
                onClose: goToFirstError,
            });
            return;
        }

        const {
            id, submittedAt, publishedAt, createdAt, updatedAt,
            submitter, submitterEmail, submitterName, submitterPhone, submitterUserType,
            ...editable
        } = editForm;

        const normalizedUpdates = normalizeForSave({
            ...editable,
            title: editForm.title?.trim(),
            turnkey: deriveTurnkey(editable.turnkeyFurnished),
            coverPhoto: await normalizeMediaArray(editable.coverPhoto || []),
            interiorImages: await normalizeMediaArray(editable.interiorImages || []),
            exteriorImages: await normalizeMediaArray(editable.exteriorImages || []),
            additionalImages: await normalizeMediaArray(editable.additionalImages || []),
            videos: await normalizeMediaArray(editable.videos || []),
            strFinancialDocs: await normalizeMediaArray(editable.strFinancialDocs || []),
        });

        updateMutation.mutate({ dealId: id, updates: normalizedUpdates });
    };

    console.log('editForm : ',editForm)

    return (
        <div className="bg-app min-h-screen">
            <div className="mb-2">
                <div className="bg-surface p-4 mb-4 pt-10 pb-10">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-1">
                        <div />
                        <div className="flex items-center justify-center gap-3">
                            <img src={logoDarkBlue} alt="Scholarship House" className="h-14 w-auto opacity-80" />
                            <h1 className="text-3xl md:text-4xl font-bold text-primary">My Properties</h1>
                        </div>
                        <div />
                    </div>
                    <p className="text-center text-text-secondary mb-2">Properties you have submitted</p>
                    <div className="h-1 w-20 bg-accent rounded-full mx-auto" />
                </div>
            </div>

            <div className="container mx-auto pt-2 pb-8 px-4 lg:px-4 min-h-screen">
                <div className="bg-surface border border-border-subtle rounded-xl shadow-sm">
                    {/* Status tab strip — mirrors the admin Property Management page.
                        Each tab's count is computed off the full deals list so the
                        numbers don't change when you type in the search box or
                        switch tabs. */}
                    <div className="px-4 pt-3 border-b border-border-subtle">
                        <div className="flex items-center gap-1 min-w-max">
                            {STATUS_TABS.map((tab) => {
                                const isActiveTab = statusFilter === tab.key;
                                return (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => {
                                            setStatusFilter(tab.key);
                                            setCurrentPage(1);
                                        }}
                                        className={
                                            'inline-flex items-center gap-1.5 px-4 py-2.5 -mb-px text-sm font-medium transition-colors border-b-2 ' +
                                            (isActiveTab
                                                ? 'text-primary border-primary'
                                                : 'text-text-secondary border-transparent hover:text-text-primary')
                                        }
                                    >
                                        <span>{tab.label}</span>
                                        <span className={
                                            'text-xs ' +
                                            (isActiveTab ? 'text-primary/70' : 'text-text-secondary/70')
                                        }>
                                            ({statusCounts[tab.key] ?? 0})
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="p-4 border-b border-border-subtle flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="text-sm text-text-secondary">
                            Showing {paginated.length} of {filtered.length} propert
                            {filtered.length !== 1 ? 'ies' : 'y'}
                        </div>
                        <div className="w-full md:w-72">
                            <Input
                                placeholder="Search by name or status..."
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="p-12">
                            <Loader />
                        </div>
                    ) : error ? (
                        <div className="p-12 text-center text-text-secondary">
                            Could not load your properties. Please try again.
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="p-12 text-center text-text-secondary">
                            {deals.length === 0
                                ? 'You have not submitted any properties yet.'
                                : 'No properties match your search.'}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50/70 border-b border-border-subtle">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">View Listing</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">Property ID</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">Submitted Date</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">Full Address</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">Bed / Bath</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">Submitted By</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">Price</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">Status</th>
                                        {(useHasPermission('my_property.can_edit') || useHasPermission('my_property.can_delete')) && (
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wide">Actions</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle">
                                    {paginated.map((deal) => {
                                        const deletable = canDelete(deal);
                                        const addr = [deal.streetAddress, deal.city, deal.stateRegion, deal.postalCode].filter(Boolean).join(', ');
                                        return (
                                            <tr key={deal.id} className="hover:bg-blue-50/40 transition-colors">
                                                {/* View Listing — the only column that opens the listing */}
                                                <td className="px-4 py-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate(`/deal-details/${deal.id}`, { state: { from: '/my-properties' } })}
                                                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors whitespace-nowrap"
                                                    >
                                                        View Listing
                                                    </button>
                                                </td>

                                                {/* Property ID */}
                                                <td className="px-4 py-3 text-sm font-mono text-text-secondary whitespace-nowrap">
                                                    {getPropertyId(deal) || '—'}
                                                </td>

                                                {/* Submitted Date */}
                                                <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
                                                    {deal.submittedAt ? formatDate(deal.submittedAt) : '—'}
                                                </td>

                                                {/* Full Address — click to copy */}
                                                <td className="px-4 py-3 text-sm">
                                                    {addr ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => copyAddress(addr)}
                                                            title="Click to copy address"
                                                            className="group inline-flex items-start gap-1.5 text-left text-accent hover:underline cursor-pointer max-w-[230px]"
                                                        >
                                                            <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-70 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                            </svg>
                                                            <span>{addr}</span>
                                                        </button>
                                                    ) : '—'}
                                                </td>

                                                {/* Bed / Bath */}
                                                <td className="px-4 py-3 text-sm text-text-primary whitespace-nowrap">
                                                    {(deal.bedrooms || deal.bathrooms) ? `${deal.bedrooms || 0} Bed / ${deal.bathrooms || 0} Bath` : '—'}
                                                </td>

                                                {/* Submitted By */}
                                                <td className="px-4 py-3 text-sm text-text-primary whitespace-nowrap">
                                                    {deal.submitterName || '—'}
                                                </td>

                                                {/* Price */}
                                                <td className="px-4 py-3 text-sm font-semibold text-text-primary whitespace-nowrap">
                                                    {deal.price ? `$${formatPrice(deal.price)}` : '—'}
                                                </td>

                                                {/* Status — read-only label (submitters cannot change status) */}
                                                <td className="px-4 py-3">
                                                    <StatusBadge status={deal.status} />
                                                </td>

                                                {/* Actions — edit + delete icons */}
                                                {(useHasPermission('my_property.can_edit') || useHasPermission('my_property.can_delete')) && (
                                                    <td className="px-4 py-3">
                                                        <div className="flex justify-end gap-1.5">
                                                            {useHasPermission('my_property.can_edit') && (
                                                                <button
                                                                    type="button"
                                                                    disabled={!deletable}
                                                                    title={deletable ? 'Edit this property' : 'Only pending properties can be edited'}
                                                                    onClick={() => deletable && handleEdit(deal)}
                                                                    className={`p-2 rounded-lg transition-colors ${deletable ? 'text-text-secondary hover:text-text-primary hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}
                                                                >
                                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                    </svg>
                                                                </button>
                                                            )}
                                                            {useHasPermission('my_property.can_delete') && (
                                                                <button
                                                                    type="button"
                                                                    disabled={!deletable || deleteMutation.isPending}
                                                                    title={deletable ? 'Delete this property' : 'Only pending properties can be deleted'}
                                                                    onClick={() => deletable && setPendingDelete(deal)}
                                                                    className={`p-2 rounded-lg transition-colors ${deletable ? 'text-red-500 hover:text-red-700 hover:bg-red-50' : 'text-gray-300 cursor-not-allowed'}`}
                                                                >
                                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                    </svg>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <Pagination
                        currentPage={page}
                        totalItems={filtered.length}
                        onPageChange={setCurrentPage}
                    />
                </div>
            </div>

            <Modal
                isOpen={!!pendingDelete}
                onClose={() => setPendingDelete(null)}
                title="Delete Property"
                size="sm"
            >
                {pendingDelete && (
                    <div className="space-y-4">
                        <p className="text-text-secondary">
                            Are you sure you want to delete{' '}
                            <span className="font-medium text-text-primary">{pendingDelete.title}</span>? This
                            action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setPendingDelete(null)}>
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                disabled={deleteMutation.isPending}
                                onClick={() => deleteMutation.mutate(pendingDelete.id)}
                            >
                                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal
                isOpen={!!editing && !!editForm}
                onClose={closeEdit}
                title="Edit Property"
                size="xl"
            >
                {editForm && (
                    <div className="space-y-4 max-h-[80vh] overflow-y-auto px-1 pb-1">
                        <div className="flex items-center justify-end gap-3">
                            <button type="button" onClick={expandAllAccordions} className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-100 transition-colors">Expand all</button>
                            <span className="text-border-subtle">|</span>
                            <button type="button" onClick={collapseAllAccordions} className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-100 transition-colors">Collapse all</button>
                        </div>

                        {/* ===== User Information ===== */}
                        <AccordionSection title="User Information" isOpen={openAccordions.userInfo} onToggle={() => toggleAccordion('userInfo')}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Full Name" value={editForm?.submitter?.name || editForm?.submitterName || user?.name || ''} readOnly className="cursor-not-allowed bg-app" />
                                <Input label="Email" value={editForm?.submitter?.email || editForm?.submitterEmail || user?.email || ''} readOnly className="cursor-not-allowed bg-app" />
                                <Input label="Phone" value={formatPhoneDisplay(editForm?.submitter?.phone || editForm?.submitterPhone || user?.phone || '')} readOnly className="cursor-not-allowed bg-app" />
                                <Input label="User Type" value={getUserTypeLabel(editForm?.submitter?.userType || editForm?.submitterUserType || user?.userType) || ''} readOnly className="cursor-not-allowed bg-app" />
                                <Select
                                    label="Submitter Relationship"
                                    value={editForm.submitterRelationship || ''}
                                    onChange={(e) => setEditForm((f) => ({ ...f, submitterRelationship: e.target.value }))}
                                    options={SUBMITTER_RELATIONSHIP_OPTIONS}
                                />
                            </div>
                        </AccordionSection>

                        {/* ===== Property ===== */}
                        <AccordionSection title="Property" isOpen={openAccordions.property} onToggle={() => toggleAccordion('property')}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Select label="Property Type" value={editForm.category || ''} error={editErrors.category} ref={(el) => (editErrorRefs.current.category = el)} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))} options={CATEGORIES} />
                                <Input label="Bedrooms" type="text" inputMode="numeric" value={formatNumber(editForm.bedrooms || '')} error={editErrors.bedrooms} ref={(el) => (editErrorRefs.current.bedrooms = el)} onChange={(e) => setEditForm((f) => ({ ...f, bedrooms: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                                <Input label="Bathrooms" type="text" inputMode="numeric" value={formatNumber(editForm.bathrooms || '')} error={editErrors.bathrooms} ref={(el) => (editErrorRefs.current.bathrooms = el)} onChange={(e) => setEditForm((f) => ({ ...f, bathrooms: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                                <Input label="Square Footage" type="text" inputMode="numeric" value={formatNumber(editForm.squareFootage || '')} error={editErrors.squareFootage} ref={(el) => (editErrorRefs.current.squareFootage = el)} onChange={(e) => setEditForm((f) => ({ ...f, squareFootage: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                                <Input label="Year Built" type="text" inputMode="numeric" value={editForm.yearBuilt || ''} error={editErrors.yearBuilt} ref={(el) => (editErrorRefs.current.yearBuilt = el)} onChange={(e) => setEditForm((f) => ({ ...f, yearBuilt: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                                <Select label="Is This Property In An HOA?" value={editForm.isHOA ? 'YES' : 'NO'} onChange={(e) => { const isHOA = e.target.value === 'YES'; setEditForm((f) => ({ ...f, isHOA, hoaMonthlyFee: isHOA ? f.hoaMonthlyFee : null })); }} options={[{ value: 'NO', label: 'No' }, { value: 'YES', label: 'Yes' }]} />
                                {editForm.isHOA && (
                                    <Input label="HOA Monthly Fee ($)" type="text" inputMode="numeric" value={formatNumber(editForm.hoaMonthlyFee || '')} error={editErrors.hoaMonthlyFee} ref={(el) => (editErrorRefs.current.hoaMonthlyFee = el)} onChange={(e) => setEditForm((f) => ({ ...f, hoaMonthlyFee: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                                )}
                                <Input label="Title" value={editForm.title || ''} readOnly className="bg-app cursor-not-allowed" />
                            </div>

                            <Textarea label="Listing Description" value={editForm.description || ''} error={editErrors.description} ref={(el) => (editErrorRefs.current.description = el)} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
                            <Textarea label="Seller's Intentions" value={editForm.story || ''} error={editErrors.story} ref={(el) => (editErrorRefs.current.story = el)} onChange={(e) => setEditForm((f) => ({ ...f, story: e.target.value }))} />

                            <div>
                                <h3 className="text-base font-semibold text-text-primary mb-3">Property's Main Point of Contact</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Input label="Name" value={editForm.contactName || ''} error={editErrors.contactName} ref={(el) => (editErrorRefs.current.contactName = el)} onChange={(e) => setEditForm((f) => ({ ...f, contactName: e.target.value }))} placeholder="Full name" />
                                    <Input label="Phone Number" type="tel" inputMode="numeric" value={editForm.contactPhone || ''} error={editErrors.contactPhone} ref={(el) => (editErrorRefs.current.contactPhone = el)} onChange={(e) => setEditForm((f) => ({ ...f, contactPhone: e.target.value.replace(/[^0-9]/g, '') }))} placeholder="e.g., 5555555555" />
                                    <Input label="Relation to Property" value={editForm.contactRelation || ''} error={editErrors.contactRelation} ref={(el) => (editErrorRefs.current.contactRelation = el)} onChange={(e) => setEditForm((f) => ({ ...f, contactRelation: e.target.value }))} placeholder="e.g., Owner, Agent, Wholesaler" />
                                </div>
                            </div>

                            <Input label="Source Link" type="url" value={editForm.sourceLink || ''} onChange={(e) => setEditForm((f) => ({ ...f, sourceLink: e.target.value }))} placeholder="https://..." />
                        </AccordionSection>

                        {/* ===== Location ===== */}
                        <AccordionSection title="Location" isOpen={openAccordions.location} onToggle={() => toggleAccordion('location')}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Street Address" value={editForm.streetAddress || ''} error={editErrors.streetAddress} ref={(el) => (editErrorRefs.current.streetAddress = el)} onChange={(e) => setEditForm((f) => ({ ...f, streetAddress: e.target.value }))} />
                                <Input label="Address Line 2" value={editForm.addressLine2 || ''} onChange={(e) => setEditForm((f) => ({ ...f, addressLine2: e.target.value }))} />
                                <Input label="City" value={editForm.city || ''} error={editErrors.city} ref={(el) => (editErrorRefs.current.city = el)} onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))} />
                                <Select label="State/Region/Province" value={editForm.stateRegion || ''} error={editErrors.stateRegion} ref={(el) => (editErrorRefs.current.stateRegion = el)} onChange={(e) => setEditForm((f) => ({ ...f, stateRegion: e.target.value }))} options={US_STATES.map((s) => ({ value: s.code, label: s.name }))} />
                                <Input label="Postal/Zip Code" value={editForm.postalCode || ''} error={editErrors.postalCode} ref={(el) => (editErrorRefs.current.postalCode = el)} onChange={(e) => setEditForm((f) => ({ ...f, postalCode: e.target.value }))} />
                            </div>
                        </AccordionSection>

                        {/* ===== Financial ===== */}
                        <AccordionSection title="Financial" isOpen={openAccordions.financial} onToggle={() => toggleAccordion('financial')}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Select label="Type of Financing" value={editForm.financingType || ''} error={editErrors.financingType} ref={(el) => (editErrorRefs.current.financingType = el)} onChange={(e) => setEditForm((f) => ({ ...f, financingType: e.target.value }))} options={[{ value: 'traditional', label: 'Traditional Financing' }, { value: 'creative', label: 'Creative Financing' }]} />
                                <Input label="Purchase Price ($)" type="text" inputMode="numeric" value={formatNumber(editForm.price || '')} error={editErrors.price} ref={(el) => (editErrorRefs.current.price = el)} onChange={(e) => setEditForm((f) => ({ ...f, price: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                            </div>

                            {!isCreativeFinancingEdit && (
                                <Textarea label="Additional Financial Information" value={editForm.financialInfo || ''} error={editErrors.financialInfo} ref={(el) => (editErrorRefs.current.financialInfo = el)} onChange={(e) => setEditForm((f) => ({ ...f, financialInfo: e.target.value }))} />
                            )}

                            {isCreativeFinancingEdit && (
                                <div className="space-y-6 mt-2">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <DateInput label="Expected Close of Escrow" name="expectedCloseDate" value={editForm.expectedCloseDate ?? ''} error={editErrors.expectedCloseDate} ref={(el) => (editErrorRefs.current.expectedCloseDate = el)} onChange={(e) => setEditForm((f) => ({ ...f, expectedCloseDate: e.target.value }))} placeholder="Select date" />
                                        <Input label="Earnest Money Deposit (EMD) ($)" type="text" inputMode="numeric" value={formatNumber(editForm.emd || '')} error={editErrors.emd} ref={(el) => (editErrorRefs.current.emd = el)} onChange={(e) => setEditForm((f) => ({ ...f, emd: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                                        <Input label="Down Payment (Excluding closing costs) ($)" type="text" inputMode="numeric" value={formatNumber(editForm.downPayment || '')} onChange={(e) => setEditForm((f) => ({ ...f, downPayment: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                                        <Input label="Assignment Fee ($)" type="text" inputMode="numeric" value={formatNumber(editForm.assignmentFee || '')} onChange={(e) => setEditForm((f) => ({ ...f, assignmentFee: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                                    </div>

                                    {/* Assignment Fee explainer */}
                                    <div className="rounded-xl border-l-4 border-amber-400 bg-gradient-to-r from-amber-50 to-transparent px-4 py-5">
                                        <div className="flex items-center gap-2 text-[14px] font-bold uppercase tracking-wider text-amber-700 mb-1">
                                            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                                            </svg>
                                            How the Assignment Fee works on the public website
                                        </div>
                                        <p className="mt-1.5 mb-1 text-[14px] leading-relaxed text-slate-600">
                                            The Assignment Fee is <strong>not shown</strong> to clients. Instead, it is automatically added to both the <strong>Price</strong> and the <strong>Down Payment</strong> displayed on the public listing — this is the retail price clients see.
                                        </p>
                                        {(() => {
                                            const fee = Number(editForm.assignmentFee) || 0;
                                            const price = Number(editForm.price) || 0;
                                            const down = Number(editForm.downPayment) || 0;
                                            if (!fee) return null;
                                            return (
                                                <div className="mt-2 pt-2 border-t border-blue-200 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-medium text-blue-800">
                                                    <div className="mt-2 px-3 py-3 bg-white rounded-xl border border-gray-100">
                                                        <div className="text-sky-700 font-bold text-[13px] uppercase tracking-wide mb-0.5">Assignment Fee</div>
                                                        <div className="text-[14px] mt-2 font-bold text-gray-800">${fee.toLocaleString('en-US')}</div>
                                                    </div>
                                                    <div className="mt-2 px-3 py-3 bg-white rounded-xl border border-gray-100">
                                                        <div className="text-sky-700 font-bold text-[13px] uppercase tracking-wide mb-0.5">Public Price</div>
                                                        <div className="text-[14px] mt-2 font-bold text-gray-800">${(price + fee).toLocaleString('en-US')}</div>
                                                        <div className="text-blue-600 mt-2 text-[12px]">(${price.toLocaleString('en-US')} + Assignment fees)</div>
                                                    </div>
                                                    <div className="mt-2 px-3 py-3 bg-white rounded-xl border border-gray-100">
                                                        <div className="text-sky-700 font-bold text-[13px] uppercase tracking-wide mb-0.5">Public Down Payment</div>
                                                        <div className="text-[14px] mt-2 font-bold text-gray-800">${(down + fee).toLocaleString('en-US')}</div>
                                                        <div className="text-blue-600 mt-2 text-[12px]">(${down.toLocaleString('en-US')} + Assignment fees)</div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* PRIMARY MORTGAGE */}
                                    <Select label="Is There a Primary Mortgage?" value={editForm.hasPrimaryMortgage || ''} onChange={(e) => setEditForm((f) => ({ ...f, hasPrimaryMortgage: e.target.value }))} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
                                    {editForm.hasPrimaryMortgage === 'yes' && (
                                        <div className="border border-border rounded-lg p-4">
                                            <p className="text-base font-semibold text-text-primary mb-4">Primary Mortgage Details</p>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                                                <Input label="Loan Balance ($)" type="text" inputMode="numeric" value={formatNumber(editForm.primaryLoanBalance || '')} onChange={(e) => setEditForm((f) => ({ ...f, primaryLoanBalance: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                                                <Input label="Interest Rate (%)" type="text" inputMode="decimal" value={editForm.primaryInterestRate ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, primaryInterestRate: e.target.value.replace(/[^0-9.]/g, '') }))} />
                                                <DateInput label="Maturity Date" name="primaryMaturityDate" value={editForm.primaryMaturityDate ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, primaryMaturityDate: e.target.value }))} placeholder="Select date" />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <Input label="Combined Principal & Interest ($)" type="text" inputMode="numeric" value={formatNumber(editForm.primaryPrincipalInterest || '')} onChange={(e) => setEditForm((f) => ({ ...f, primaryPrincipalInterest: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                                                <Input label="Taxes & Insurance ($)" type="text" inputMode="numeric" value={formatNumber(editForm.primaryTaxesInsurance || '')} onChange={(e) => setEditForm((f) => ({ ...f, primaryTaxesInsurance: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                                            </div>
                                        </div>
                                    )}

                                    {/* SECOND MORTGAGE */}
                                    <Select label="Is There a Second Mortgage?" value={editForm.hasSecondMortgage || ''} onChange={(e) => setEditForm((f) => ({ ...f, hasSecondMortgage: e.target.value }))} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
                                    {editForm.hasSecondMortgage === 'yes' && (
                                        <div className="border border-border rounded-lg p-4">
                                            <p className="text-base font-semibold text-text-primary mb-4">Second Mortgage Details</p>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                                                <Input label="Loan Balance ($)" type="text" inputMode="numeric" value={formatNumber(editForm.secondLoanBalance || '')} onChange={(e) => setEditForm((f) => ({ ...f, secondLoanBalance: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                                                <Input label="Interest Rate (%)" type="text" inputMode="decimal" value={editForm.secondInterestRate ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, secondInterestRate: e.target.value.replace(/[^0-9.]/g, '') }))} />
                                                <DateInput label="Maturity Date" name="secondMaturityDate" value={editForm.secondMaturityDate ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, secondMaturityDate: e.target.value }))} placeholder="Select date" />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <Input label="Combined Principal & Interest ($)" type="text" inputMode="numeric" value={formatNumber(editForm.secondPrincipalInterest || '')} onChange={(e) => setEditForm((f) => ({ ...f, secondPrincipalInterest: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                                                <Input label="Taxes & Insurance ($)" type="text" inputMode="numeric" value={formatNumber(editForm.secondTaxesInsurance || '')} onChange={(e) => setEditForm((f) => ({ ...f, secondTaxesInsurance: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                                            </div>
                                        </div>
                                    )}

                                    {/* SELLER EQUITY */}
                                    <Select label="Is There Any Seller Equity?" value={editForm.hasSellerEquity || ''} onChange={(e) => setEditForm((f) => ({ ...f, hasSellerEquity: e.target.value }))} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
                                    {editForm.hasSellerEquity === 'yes' && (
                                        <div className="border border-border rounded-lg p-4">
                                            <p className="text-base font-semibold text-text-primary mb-4">Seller Equity Details</p>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                                                <Input label="Seller Loan Amount ($)" type="text" inputMode="numeric" value={formatNumber(editForm.sellerEquityAmount || '')} onChange={(e) => setEditForm((f) => ({ ...f, sellerEquityAmount: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                                                <Input label="Interest Rate (%)" type="text" inputMode="decimal" value={editForm.sellerEquityInterestRate ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, sellerEquityInterestRate: e.target.value.replace(/[^0-9.]/g, '') }))} />
                                                <DateInput label="Maturity Date" name="sellerEquityMaturityDate" value={editForm.sellerEquityMaturityDate ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, sellerEquityMaturityDate: e.target.value }))} placeholder="Select date" />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <Input label="Combined Principal & Interest ($)" type="text" inputMode="numeric" value={formatNumber(editForm.sellerEquityPrincipalInterest || '')} onChange={(e) => setEditForm((f) => ({ ...f, sellerEquityPrincipalInterest: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} />
                                                <Select label="When Is the Balloon Payment Due?" value={editForm.sellerEquityBalloonYears || ''} onChange={(e) => setEditForm((f) => ({ ...f, sellerEquityBalloonYears: e.target.value }))} options={Array.from({ length: 30 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} ${i + 1 === 1 ? 'Year' : 'Years'}` }))} />
                                            </div>
                                        </div>
                                    )}

                                    <Textarea label="Deal Terms" value={editForm.dealTerms || ''} error={editErrors.dealTerms} ref={(el) => (editErrorRefs.current.dealTerms = el)} onChange={(e) => setEditForm((f) => ({ ...f, dealTerms: e.target.value }))} rows={6} placeholder="Describe the deal terms, financing details, or any nuances of this transaction..." />

                                    {/* TOTAL STARTING MONTHLY PAYMENT — displayed below Deal Terms */}
                                    <Input label="Total Starting Monthly Payment ($)" type="text" inputMode="numeric" value={formatNumber(editForm.totalStartingMonthlyPayment || '')} error={editErrors.totalStartingMonthlyPayment} ref={(el) => (editErrorRefs.current.totalStartingMonthlyPayment = el)} onChange={(e) => setEditForm((f) => ({ ...f, totalStartingMonthlyPayment: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} placeholder="e.g., 3,500" />
                                </div>
                            )}
                        </AccordionSection>

                        {/* ===== Rental Markets ===== */}
                        <AccordionSection title="Rental Markets" isOpen={openAccordions.rentalMarkets} onToggle={() => toggleAccordion('rentalMarkets')}>
                            <Select label="Confirm STR Zoning Availability" value={editForm.strZoning || ''} error={editErrors.strZoning} ref={(el) => (editErrorRefs.current.strZoning = el)} onChange={(e) => setEditForm((f) => ({ ...f, strZoning: e.target.value }))} options={[{ value: 'YES', label: 'Yes — Property is approved for STR' }, { value: 'NO', label: 'No — Property is not approved for STR' }, { value: 'UNSURE', label: 'Unsure' }]} />

                            <Select label="Is This Property Currently Operating as an STR?" value={editForm.isOperatingSTR || ''} error={editErrors.isOperatingSTR} ref={(el) => (editErrorRefs.current.isOperatingSTR = el)} onChange={(e) => setEditForm((f) => ({ ...f, isOperatingSTR: e.target.value }))} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />

                            {isOperatingSTREdit && (
                                <div className="space-y-4">
                                    <Input label="Link to Current Airbnb or VRBO Listing" value={editForm.strListingLink || ''} onChange={(e) => setEditForm((f) => ({ ...f, strListingLink: e.target.value }))} placeholder="https://..." />
                                    <Select label="Is It Turnkey or Furnished?" value={editForm.turnkeyFurnished || ''} error={editErrors.turnkeyFurnished} ref={(el) => (editErrorRefs.current.turnkeyFurnished = el)} onChange={(e) => setEditForm((f) => ({ ...f, turnkeyFurnished: e.target.value }))} options={[{ value: 'TURNKEY_OPERATING', label: 'Yes — Turnkey / Furnished' }, { value: 'PARTIALLY_FURNISHED', label: 'Partially Furnished' }, { value: 'NOT_FURNISHED', label: 'No — Not Turnkey' }]} />
                                    <Select label="Do You Have Access to the STR Financials?" value={editForm.hasStrFinancials || ''} onChange={(e) => setEditForm((f) => ({ ...f, hasStrFinancials: e.target.value }))} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
                                    {hasStrFinancialsEdit && (
                                        <div className="border border-border rounded-lg p-4 space-y-4">
                                            {/* Upload STR Financial Documents — displayed above Link to STR Data Sheets */}
                                            <StrDocsField value={editForm.strFinancialDocs || []} onChange={(docs) => setEditForm((f) => ({ ...f, strFinancialDocs: docs }))} />

                                            <Input label="Link to STR Data Sheets (If Applicable)" value={editForm.strDataSheetsLink || ''} error={editErrors.strDataSheetsLink} ref={(el) => (editErrorRefs.current.strDataSheetsLink = el)} onChange={(e) => setEditForm((f) => ({ ...f, strDataSheetsLink: e.target.value }))} placeholder="https://..." />
                                            <hr className="border-border" />
                                            <p className="text-base font-semibold text-text-primary">STR Key Metrics</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <Input label="Occupancy Rate (%)" value={editForm.occupancyRate || ''} onChange={(e) => setEditForm((f) => ({ ...f, occupancyRate: e.target.value.replace(/[^0-9.]/g, '') }))} placeholder="e.g., 75" />
                                                <Input label="Average Nightly Rate ($)" type="text" inputMode="numeric" value={formatNumber(editForm.averageNightlyRate || '')} onChange={(e) => setEditForm((f) => ({ ...f, averageNightlyRate: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} placeholder="e.g., 225" />
                                                <Input label="Annual Gross Revenue ($)" type="text" inputMode="numeric" value={formatNumber(editForm.strAnnualRevenue || '')} onChange={(e) => setEditForm((f) => ({ ...f, strAnnualRevenue: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} placeholder="e.g., 65,000" />
                                                <Input label="Average Monthly Revenue ($)" type="text" inputMode="numeric" value={formatNumber(editForm.strMonthlyRevenue || '')} onChange={(e) => setEditForm((f) => ({ ...f, strMonthlyRevenue: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} placeholder="e.g., 5,400" />
                                                <Input label="Monthly Utilities ($)" type="text" inputMode="numeric" value={formatNumber(editForm.strMonthlyUtilities || '')} onChange={(e) => setEditForm((f) => ({ ...f, strMonthlyUtilities: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} placeholder="e.g., 300" />
                                                <Input label="Net Operating Income — NOI ($)" type="text" inputMode="numeric" value={formatNumber(editForm.strNOI || '')} onChange={(e) => setEditForm((f) => ({ ...f, strNOI: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} placeholder="e.g., 42,000" />
                                                <Input label="Cleaning Fee per Stay ($)" type="text" inputMode="numeric" value={formatNumber(editForm.strCleaningFee || '')} onChange={(e) => setEditForm((f) => ({ ...f, strCleaningFee: unformatNumber(e.target.value).replace(/[^0-9]/g, '') }))} placeholder="e.g., 150" />
                                                <Input label="Average Length of Stay (Nights)" value={editForm.strAvgStay || ''} onChange={(e) => setEditForm((f) => ({ ...f, strAvgStay: e.target.value.replace(/[^0-9.]/g, '') }))} placeholder="e.g., 3" />
                                                <Input label="Property Management Fee (%)" value={editForm.strManagementFee || ''} onChange={(e) => setEditForm((f) => ({ ...f, strManagementFee: e.target.value.replace(/[^0-9.]/g, '') }))} placeholder="e.g., 20" />
                                                <Select label="Primary Booking Platform" value={editForm.strBookingPlatform || ''} onChange={(e) => setEditForm((f) => ({ ...f, strBookingPlatform: e.target.value }))} options={[{ value: 'AIRBNB', label: 'Airbnb' }, { value: 'VRBO', label: 'VRBO' }, { value: 'BOTH', label: 'Both Airbnb & VRBO' }, { value: 'DIRECT', label: 'Direct Booking' }, { value: 'OTHER', label: 'Other' }]} />
                                            </div>

                                            {/* Current bookings — displayed after Primary Booking Platform */}
                                            <Select label="Does It Have Current Bookings?" value={editForm.hasCurrentBookings || ''} error={editErrors.hasCurrentBookings} ref={(el) => (editErrorRefs.current.hasCurrentBookings = el)} onChange={(e) => setEditForm((f) => ({ ...f, hasCurrentBookings: e.target.value }))} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
                                            {editForm.hasCurrentBookings === 'yes' && (
                                                <Input label="Current Bookings — Brief Description" type="text" value={editForm.currentBookingsDescription || ''} error={editErrors.currentBookingsDescription} ref={(el) => (editErrorRefs.current.currentBookingsDescription = el)} onChange={(e) => setEditForm((f) => ({ ...f, currentBookingsDescription: e.target.value }))} placeholder="Briefly describe the current bookings (e.g., dates, number of reservations, revenue already secured)." />
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <Select label="How Confident Are You In The Accuracy Of The Following Data?" value={editForm.strConfidence || ''} error={editErrors.strConfidence} ref={(el) => (editErrorRefs.current.strConfidence = el)} onChange={(e) => setEditForm((f) => ({ ...f, strConfidence: e.target.value }))} options={[{ value: 'FIRST_HAND', label: 'I have first-hand information and can verify accuracy' }, { value: 'AIRDNA', label: 'The information is based on AirDNA or similar data' }, { value: 'DIRECTIONAL_ONLY', label: 'The information is directional only' }]} />

                            <CheckboxGroup
                                label="Vacation Rental Markets"
                                options={VACATION_RENTAL_MARKETS}
                                values={editForm.vacationRentalMarkets || []}
                                onChange={(vals) => setEditForm((f) => ({ ...f, vacationRentalMarkets: vals }))}
                            />

                            <div>
                                <label className="block text-base font-semibold text-text-primary mb-2">Why Do People Travel to This Destination?</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {TRAVEL_MOTIVATIONS.map((reason) => (
                                        <label key={reason} className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                checked={editForm.travelMotivations?.includes(reason) || false}
                                                onChange={(e) => setEditForm((f) => ({
                                                    ...f,
                                                    travelMotivations: e.target.checked
                                                        ? [...(f.travelMotivations || []), reason]
                                                        : (f.travelMotivations || []).filter((r) => r !== reason),
                                                }))}
                                            />
                                            <span className="text-sm text-text-primary">{reason}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <Textarea label={<span className="text-base font-semibold">What Do Rental Guests Want Most in This Area?</span>} value={editForm.guestDemandInsights || ''} onChange={(e) => setEditForm((f) => ({ ...f, guestDemandInsights: e.target.value }))} rows={4} placeholder="Insights into guest expectations, amenities, or experiences..." />
                            <Textarea label={<span className="text-base font-semibold">How Can We Add Value to This Property to Increase Income?</span>} value={editForm.valueAddOpportunities || ''} onChange={(e) => setEditForm((f) => ({ ...f, valueAddOpportunities: e.target.value }))} rows={4} placeholder="Examples: pool, hot tub, bikes, beach gear, game tables, etc." />
                            <Textarea label={<span className="text-base font-semibold">Recommended Property Managers, Contractors, or Cleaning Companies</span>} value={editForm.localContacts || ''} onChange={(e) => setEditForm((f) => ({ ...f, localContacts: e.target.value }))} rows={4} placeholder="List any trusted local contacts buyers could use..." />

                            <Textarea label={<span className="text-base font-semibold">Amenities</span>} value={editForm.amenities || ''} onChange={(e) => setEditForm((f) => ({ ...f, amenities: e.target.value }))} rows={3} placeholder="Examples: pool, hot tub, EV charger, game room, crib, high chair, fast Wi-Fi..." />
                            <Textarea label={<span className="text-base font-semibold">Local Attractions</span>} value={editForm.localAttractions || ''} onChange={(e) => setEditForm((f) => ({ ...f, localAttractions: e.target.value }))} rows={3} placeholder="Nearby beaches, parks, venues, ski resorts, downtown districts, etc." />
                        </AccordionSection>

                        {/* ===== Property Photos and Videos ===== */}
                        <AccordionSection title="Property Photos and Videos" isOpen={openAccordions.photosVideos} onToggle={() => toggleAccordion('photosVideos')}>
                            <div className="mb-2">
                                <FileUpload label="Cover Photo" accept="image/*" multiple={false} value={editForm.coverPhoto || []} error={editErrors.coverPhoto} ref={(el) => (editErrorRefs.current.coverPhoto = el)} onChange={(urls) => setEditForm((f) => ({ ...f, coverPhoto: urls }))} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FileUpload label="Interior Photos" accept="image/*" multiple value={editForm.interiorImages || []} onChange={(urls) => setEditForm((f) => ({ ...f, interiorImages: urls }))} />
                                <FileUpload label="Exterior Photos" accept="image/*" multiple value={editForm.exteriorImages || []} onChange={(urls) => setEditForm((f) => ({ ...f, exteriorImages: urls }))} />
                                <div className="col-span-full">
                                    <FileUpload label="Additional Photos" accept="image/*" multiple value={editForm.additionalImages || []} onChange={(urls) => setEditForm((f) => ({ ...f, additionalImages: urls }))} />
                                </div>
                            </div>
                            <div className="mt-6">
                                <FileUpload label="Videos" accept="video/*" multiple value={editForm.videos || []} onChange={(urls) => setEditForm((f) => ({ ...f, videos: urls }))} />
                            </div>
                            <Textarea label="Additional Information" value={editForm.additionalInfo || ''} onChange={(e) => setEditForm((f) => ({ ...f, additionalInfo: e.target.value }))} rows={3} placeholder="Add any extra notes, context, or information here..." />
                        </AccordionSection>

                        <div className="mt-6 border-t border-border-subtle pt-6 flex justify-end gap-3">
                            <Button variant="outline" onClick={closeEdit} disabled={updateMutation.isPending}>
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleEditSave}
                                loading={updateMutation.isPending}
                                disabled={updateMutation.isPending}
                            >
                                Save Changes
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            <NotificationModal
                isOpen={notification.open}
                onClose={() => {
                    const cb = notification.onClose;
                    setNotification((n) => ({ ...n, open: false, onClose: null }));
                    cb?.();
                }}
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

export default MyProperties;
