import { useState, useMemo, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  HiOutlineDocumentArrowUp,
  HiOutlineDocumentText,
  HiOutlineTableCells,
  HiOutlineTag,
  HiOutlineChevronDown,
  HiOutlineCheck,
  HiOutlineInformationCircle,
  HiOutlineSparkles,
  HiOutlineMagnifyingGlass,
  HiOutlineClipboardDocument,
  HiOutlineExclamationTriangle,
  HiOutlineCheckCircle,
  HiOutlineTrash,
  HiOutlineArrowDownTray,
} from 'react-icons/hi2';

import Button from '../components/Button';
import Loader from '../components/Loader';
import Modal from '../components/Modal';
import NotificationModal from '../components/NotificationModal';
import { parsePropertyFile } from '../utils/pdfImportParser';
import { propertyImportAPI } from '../api/propertyImport';

// Sample files shipped in src/assets/sample files/. Vite's `?url` query
// asks the bundler to emit each file as a static asset and give us back
// its production-safe URL (with cache-busting hash). The path matches
// the folder on disk: src/assets/sample files/ (note the space).
import samplePdfUrl  from '../assets/sample files/sample-property-import.pdf?url';
import sampleXlsxUrl from '../assets/sample files/sample-property-import.xlsx?url';

/* ------------------------------------------------------------------ */
/* Display config                                                     */
/* ------------------------------------------------------------------ */
const COLUMNS = [
  { key: 'submitterRelationship', label: 'Relationship',      width: 'min-w-[160px]' },
  { key: 'category',              label: 'Type',              width: 'min-w-[140px]' },
  { key: 'streetAddress',         label: 'Address',           width: 'min-w-[200px]' },
  { key: 'addressLine2',          label: 'Address Line 2',    width: 'min-w-[120px]' },
  { key: 'city',                  label: 'City',              width: 'min-w-[120px]' },
  { key: 'stateRegion',           label: 'State',             width: 'min-w-[70px]'  },
  { key: 'postalCode',            label: 'ZIP',               width: 'min-w-[80px]'  },
  { key: 'bedrooms',              label: 'Beds',              width: 'min-w-[60px]'  },
  { key: 'bathrooms',             label: 'Baths',             width: 'min-w-[60px]'  },
  { key: 'squareFootage',         label: 'Sq Ft',             width: 'min-w-[80px]'  },
  { key: 'yearBuilt',             label: 'Year',              width: 'min-w-[70px]'  },
  { key: 'price',                 label: 'Price',             width: 'min-w-[110px]' },
  { key: 'emd',                   label: 'EMD',               width: 'min-w-[100px]' },
  { key: 'downPayment',           label: 'Down Payment',      width: 'min-w-[120px]' },
  { key: 'assignmentFee',         label: 'Assignment Fee',    width: 'min-w-[120px]' },
  { key: 'financingType',         label: 'Financing',         width: 'min-w-[140px]' },
  { key: 'expiry_date',           label: 'Expires',           width: 'min-w-[110px]' },
  { key: 'expectedCloseDate',     label: 'Close Date',        width: 'min-w-[110px]' },
 
  { key: 'strConfidence',         label: 'Confidence',        width: 'min-w-[140px]' },
  { key: 'turnkeyFurnished',      label: 'Turnkey/Furnished', width: 'min-w-[160px]' },
  { key: 'strZoning',             label: 'STR Zoning',        width: 'min-w-[100px]' },
  { key: 'description',           label: 'Description',       width: 'min-w-[260px]' },
  { key: 'story',                 label: 'Story',             width: 'min-w-[180px]' },
  { key: 'financialInfo',         label: 'Financial Info',    width: 'min-w-[180px]' },
  { key: 'additionalInfo',        label: 'Additional Info',   width: 'min-w-[180px]' },
  { key: 'interiorImages',        label: 'Interior',          width: 'min-w-[80px]'  },
  { key: 'exteriorImages',        label: 'Exterior',          width: 'min-w-[80px]'  },
];

const CATEGORY_LABELS = {
  SINGLE_FAMILY:    'Single Family',
  CONDO:            'Condo',
  TOWNHOUSE:        'Town House',
  TWO_TO_FOUR_UNIT: '2–4 Unit',
  UNIQUE_PROPERTY:  'Unique',
};

const RELATIONSHIP_LABELS = {
  TEAM_MEMBER:               'Team Member',
  REALTOR_LISTING_OWNER:     'Realtor (own listing)',
  REALTOR_NOT_LISTING_OWNER: 'Realtor (other listing)',
  WHOLESALER_HOLDS_CONTRACT: 'Wholesaler (contract)',
  WHOLESALER_NO_CONTRACT:    'Wholesaler (no contract)',
  REAL_ESTATE_PROFESSIONAL:  'RE Professional',
  BIRDDOGGER:                'Birddogger',
};

const FINANCING_LABELS = {
  'traditional': 'Traditional',
  'subject-to':  'Subject-to',
  'hybrid':      'Hybrid',
  'seller':      'Seller',
  'cash':        'Cash Only',
};

const STR_CONFIDENCE_LABELS = {
  FIRST_HAND:       'First-hand',
  AIRDNA:           'AirDNA',
  DIRECTIONAL_ONLY: 'Directional',
};

const TURNKEY_LABELS = {
  TURNKEY_OPERATING:       'Turnkey + Operating',
  FURNISHED_NOT_OPERATING: 'Furnished',
  PARTIALLY_FURNISHED:     'Partial',
  NOT_FURNISHED:           'Not Furnished',
};

const STR_ZONING_LABELS = {
  YES: 'Yes', NO: 'No', UNSURE: 'Unsure',
};

const ENUM_LABELS = {
  category:              CATEGORY_LABELS,
  submitterRelationship: RELATIONSHIP_LABELS,
  financingType:         FINANCING_LABELS,
  strConfidence:         STR_CONFIDENCE_LABELS,
  turnkeyFurnished:      TURNKEY_LABELS,
  strZoning:             STR_ZONING_LABELS,
};

/* ------------------------------------------------------------------ */
/* "Expected format" reference data — keeps the upload-screen card    */
/* in sync with what the parser will accept. ACCEPTED_INPUTS mirrors  */
/* the *_MAP keys in pdfImportParser.js (display label -> canonical). */
/* ------------------------------------------------------------------ */
const ACCEPTED_INPUTS = {
  category: {
    SINGLE_FAMILY:    ['Single Family', 'Single-Family'],
    CONDO:            ['Condo'],
    TOWNHOUSE:        ['Town House', 'Townhouse'],
    TWO_TO_FOUR_UNIT: ['2-4 Unit Home', '2–4 Unit Home', '2 to 4 Unit', '2-4 Unit'],
    UNIQUE_PROPERTY:  ['Unique Property', 'Unique'],
  },
  submitterRelationship: {
    TEAM_MEMBER:               ['Team Member'],
    REALTOR_LISTING_OWNER:     ['Listing Realtor'],
    REALTOR_NOT_LISTING_OWNER: ['Non Listing Realtor'],
    WHOLESALER_HOLDS_CONTRACT: ['Contract Wholesaler'],
    WHOLESALER_NO_CONTRACT:    ['Non Contract Wholesaler'],
    REAL_ESTATE_PROFESSIONAL:  ['Client Representative'],
    BIRDDOGGER:                ['Property Birddogger'],
  },
  financingType: {
    'traditional': ['Traditional'],
    'subject-to':  ['Subject-to', 'Subject to'],
    'hybrid':      ['Hybrid'],
    'seller':      ['Seller Financing', 'Seller'],
    'cash':        ['Cash Only', 'Cash'],
  },
  strConfidence: {
    FIRST_HAND:       ['First-hand', 'First hand'],
    AIRDNA:           ['AirDNA'],
    DIRECTIONAL_ONLY: ['Directional Only', 'Directional'],
  },
  turnkeyFurnished: {
    TURNKEY_OPERATING:       ['Turnkey'],
    FURNISHED_NOT_OPERATING: ['Fully Furnished'],
    PARTIALLY_FURNISHED:     ['Partially Furnished'],
    NOT_FURNISHED:           ['Not Furnished'],
  },
  strZoning: {
    YES:    ['Yes'],
    NO:     ['No'],
    UNSURE: ['Not Sure', 'Unsure'],
  },
};

const FIELDS = [
  { key: 'submitterRelationship', label: 'Your Relationship To This Property', aliases: ['Submitter Relationship', 'Relationship'], required: true,  type: 'enum',     note: 'Who is submitting this listing and in what capacity.', enumKey: 'submitterRelationship' },
  { key: 'category',              label: 'Property Type',                      aliases: ['Type', 'Category'],                       required: true,  type: 'enum',     note: 'The structural type of the property.', enumKey: 'category' },
  { key: 'streetAddress',         label: 'Street Address',                     aliases: ['Address', 'Street'],                      required: true,  type: 'text',     note: 'Street number and name. Use Address Line 2 / Unit / Apt for apartment numbers.' },
  { key: 'city',                  label: 'City',                                                                                    required: true,  type: 'text',     note: 'Plain city name — no state suffix.' },
  { key: 'stateRegion',           label: 'State',                              aliases: ['State/Region'],                           required: true,  type: 'state',    note: 'Two-letter US state code (e.g. NC, TX). Full state names are auto-converted.' },
  { key: 'postalCode',            label: 'Postal/Zip Code',                    aliases: ['ZIP', 'ZIP Code', 'Postal Code'],         required: true,  type: 'zip',      note: '5-digit ZIP. ZIP+4 (e.g. 28801-1234) is also accepted.' },
  { key: 'bedrooms',              label: 'Bedrooms',                           aliases: ['Beds'],                                   required: true,  type: 'integer',  note: 'Whole number — fractions are rejected.' },
  { key: 'bathrooms',             label: 'Bathrooms',                          aliases: ['Baths'],                                  required: true,  type: 'number',   note: 'Whole number — fractions are rejected.' },
  { key: 'squareFootage',         label: 'Square Footage',                     aliases: ['Sq Ft', 'SqFt'],                          required: true,  type: 'integer',  note: 'Whole number, no commas needed — they are stripped.' },
  { key: 'yearBuilt',             label: 'Year Built',                                                                              required: true,  type: 'year',     note: 'Four-digit year (e.g. 2005).' },
  { key: 'price',                 label: 'Price',                                                                                   required: true,  type: 'currency', note: 'USD. Symbols and commas (e.g. $525,000) are accepted and stripped.' },
  { key: 'financingType',         label: 'Type of Financing',                  aliases: ['Financing', 'Financing Type'],            required: true,  type: 'enum',     note: 'How the deal can be financed by the buyer.', enumKey: 'financingType' },
  { key: 'expiry_date',           label: 'Property Expiry Date',               aliases: ['Expiry Date', 'Listing Expiry', 'Expires'], required: true, type: 'date',    note: 'YYYY-MM-DD format. Other common formats are auto-normalized.' },
  { key: 'strConfidence',         label: 'Data Confidence',                    aliases: ['STR Confidence'],                         required: true,  type: 'enum',     note: 'How sure you are the numbers are accurate.', enumKey: 'strConfidence' },
  { key: 'turnkeyFurnished',      label: 'Turnkey/Furnished',                  aliases: ['Turnkey or Furnished STR Property?'],     required: true,  type: 'enum',     note: 'Furnishing and operational state of the property.', enumKey: 'turnkeyFurnished' },
  { key: 'strZoning',             label: 'STR Zoning',                         aliases: ['Confirm STR Zoning Availability'],        required: true,  type: 'enum',     note: 'Whether the area allows short-term rentals.', enumKey: 'strZoning' },
  { key: 'description',           label: 'Description',                                                                             required: true,  type: 'text',     note: 'Free-form marketing description. May span multiple lines until the next field.' },
  { key: 'interiorImages',        label: 'Interior Photos',                    aliases: ['Interior Images'],                        required: true,  type: 'urls',     note: 'One or more image URLs separated by commas' },
  { key: 'exteriorImages',        label: 'Exterior Photos',                    aliases: ['Exterior Images'],                        required: true,  type: 'urls',     note: 'One or more image URLs separated by commas' },

  // ----- Optional fields -----
  { key: 'addressLine2',          label: 'Address Line 2',                     aliases: ['Unit', 'Apt'],                            required: false, type: 'text',     note: 'Apartment / unit / suite number. Optional.' },
  { key: 'story',                 label: 'Story',                              aliases: ['Property Story', 'Background Story'],     required: false, type: 'text',     note: 'Narrative background or backstory of the property.' },
  { key: 'expectedCloseDate',     label: 'Expected Close of Escrow',           aliases: ['Expected Close Date', 'Close of Escrow'], required: false, type: 'date',     note: 'YYYY-MM-DD format. When you expect escrow to close.' },
  { key: 'emd',                   label: 'Earnest Money Deposit (EMD) ($)',    aliases: ['EMD', 'Earnest Money Deposit'],           required: false, type: 'currency', note: 'USD amount. Symbols and commas are stripped.' },
  { key: 'downPayment',           label: 'Down Payment (Excluding closing costs) ($)', aliases: ['Down Payment'],                   required: false, type: 'currency', note: 'USD amount. Excludes closing costs.' },
  { key: 'assignmentFee',         label: 'Assignment Fee ($)',                 aliases: ['Assignment Fee'],                         required: false, type: 'currency', note: 'USD amount. For wholesale assignments.' },
  { key: 'financialInfo',         label: 'Additional Financial Information',   aliases: ['Financial Information', 'Financial Info'], required: false, type: 'text',    note: 'Any extra notes about financing, terms, or numbers.' },

  { key: 'additionalInfo',        label: 'Additional Information',             aliases: ['Additional Info', 'Notes'],               required: false, type: 'text',     note: 'Free-form notes that don\u2019t fit anywhere else.' },
];

const TYPE_BADGES = {
  text:     { label: 'Text',     cls: 'bg-gray-100 text-gray-700'    },
  enum:     { label: 'Choice',   cls: 'bg-purple-50 text-purple-700' },
  integer:  { label: 'Integer',  cls: 'bg-blue-50 text-blue-700'     },
  number:   { label: 'Number',   cls: 'bg-blue-50 text-blue-700'     },
  currency: { label: 'Currency', cls: 'bg-teal-50 text-teal-700'     },
  year:     { label: 'Year',     cls: 'bg-blue-50 text-blue-700'     },
  zip:      { label: 'ZIP',      cls: 'bg-blue-50 text-blue-700'     },
  state:    { label: 'State',    cls: 'bg-amber-50 text-amber-700'   },
  date:     { label: 'Date',     cls: 'bg-amber-50 text-amber-700'   },
  urls:     { label: 'URLs',     cls: 'bg-pink-50 text-pink-700'     },
  list:     { label: 'List',     cls: 'bg-gray-100 text-gray-700'    },
};

const SAMPLE_LINES = [
  { f: 'Your Relationship To This Property', v: 'Listing Realtor',                                       r: true  },
  { f: 'Property Type',                      v: 'Single Family',                                         r: true  },
  { f: 'Street Address',                     v: '123 Maple Street',                                      r: true  },
  { f: 'City',                               v: 'Asheville',                                             r: true  },
  { f: 'State',                              v: 'NC',                                                    r: true  },
  { f: 'Postal/Zip Code',                    v: '28801',                                                 r: true  },
  { f: 'Bedrooms',                           v: '4',                                                     r: true  },
  { f: 'Bathrooms',                          v: '3',                                                     r: true  },
  { f: 'Square Footage',                     v: '2400',                                                  r: true  },
  { f: 'Year Built',                         v: '2005',                                                  r: true  },
  { f: 'Price',                              v: '525000',                                                r: true  },
  { f: 'Type of Financing',                  v: 'Subject-to',                                            r: true  },
  { f: 'Property Expiry Date',               v: '2026-08-01',                                            r: true  },
  { f: 'Data Confidence',                    v: 'First-hand',                                            r: true  },
  { f: 'Turnkey/Furnished',                  v: 'Turnkey',                                               r: true  },
  { f: 'STR Zoning',                         v: 'Yes',                                                   r: true  },
  { f: 'Description',                        v: 'Beautifully renovated mountain retreat...',             r: true  },
  { f: 'Interior Photos',                    v: 'https://example.com/a.jpg, https://example.com/b.jpg',  r: true  },
  { f: 'Exterior Photos',                    v: 'https://example.com/c.jpg',                             r: true  },

  // Optional fields — `r: false` so no `*` marker is rendered.
  { f: 'Story',                              v: 'Story Info',                                            r: false },
  { f: 'Address Line 2',                     v: 'Apt 4B',                                                r: false },
  { f: 'Expected Close of Escrow',           v: '2026-09-14',                                            r: false },
  { f: 'Earnest Money Deposit (EMD) ($)',    v: '5000',                                                  r: false },
  { f: 'Down Payment (Excluding closing costs) ($)', v: '105000',                                        r: false },
  { f: 'Assignment Fee ($)',                 v: '15000',                                                 r: false },
  { f: 'Additional Financial Information',   v: 'Lender requires 30-day close.',                         r: false },
  { f: 'Additional Information',             v: 'HOA includes pool and lawn care.',                      r: false },
];

const ENUM_GROUPS = [
  { key: 'category',              title: 'Property Type',     field: 'Property Type',                      labels: CATEGORY_LABELS,       inputs: ACCEPTED_INPUTS.category              },
  { key: 'submitterRelationship', title: 'Relationship',      field: 'Your Relationship To This Property', labels: RELATIONSHIP_LABELS,   inputs: ACCEPTED_INPUTS.submitterRelationship },
  { key: 'financingType',         title: 'Financing',         field: 'Type of Financing',                  labels: FINANCING_LABELS,      inputs: ACCEPTED_INPUTS.financingType         },
  { key: 'strConfidence',         title: 'Data Confidence',   field: 'How Confident Are You In The Accuracy Of The Following Data?',                    labels: STR_CONFIDENCE_LABELS, inputs: ACCEPTED_INPUTS.strConfidence         },
  { key: 'turnkeyFurnished',      title: 'Turnkey / Furnished', field: 'Turnkey or Furnished STR Property?',                labels: TURNKEY_LABELS,        inputs: ACCEPTED_INPUTS.turnkeyFurnished      },
  { key: 'strZoning',             title: 'STR Zoning',        field: 'Confirm STR Zoning Availability',                         labels: STR_ZONING_LABELS,     inputs: ACCEPTED_INPUTS.strZoning             },
];

const formatMoney = (n) => {
  if (!n) return '';
  const num = Number(String(n).replace(/[^0-9.]/g, ''));
  return Number.isFinite(num) ? num.toLocaleString('en-US') : '';
};

/* ------------------------------------------------------------------ */
/* Sub-components                                                     */
/* ------------------------------------------------------------------ */

const Dropzone = ({ onFile, isParsing }) => {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files) => {
    const file = files?.[0];
    if (!file) return;
    if (!/\.(pdf|xlsx|xls|csv)$/i.test(file.name)) {
      alert('Please upload a PDF, XLSX, XLS, or CSV file.');
      return;
    }
    onFile(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={`
        cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors
        ${dragOver ? 'border-primary bg-blue-50' : 'border-border-subtle bg-app hover:bg-blue-50/40'}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <HiOutlineDocumentArrowUp className="mx-auto h-12 w-12 text-primary mb-3" />
      <p className="text-base font-semibold text-text-primary">
        {isParsing ? 'Reading your file…' : 'Drop a PDF or Excel file here, or click to browse'}
      </p>
      <p className="text-sm text-text-secondary mt-1">
        Supported: <strong>.pdf</strong>, <strong>.xlsx</strong>, <strong>.xls</strong>, <strong>.csv</strong>
      </p>
      <p className="text-xs text-text-secondary mt-3">
        For PDFs: one block per property, fields formatted as <code className="bg-white px-1 rounded">Field: Value</code>.
        For Excel: one row per property, headers matching the field names.
      </p>
      {isParsing && <div className="mt-4"><Loader /></div>}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Expected-format reference card — replaces the old <pre> snippet.   */
/* Three tabs: Sample / Field Reference / Allowed Values.             */
/* ------------------------------------------------------------------ */
const InfoTile = ({ icon, title, body }) => (
  <div className="rounded-lg border border-gray-200 bg-gray-50/40 p-3">
    <div className="flex items-center gap-2 text-gray-700 mb-1.5">
      {icon}
      <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
    </div>
    <div className="text-[13px] text-gray-600 leading-relaxed">{body}</div>
  </div>
);

const ExpectedFormatCard = () => {
  const [tab, setTab] = useState('sample');
  const [openEnum, setOpenEnum] = useState('category');
  const [fieldSearch, setFieldSearch] = useState('');
  const [requiredOnly, setRequiredOnly] = useState(false);
  const [copied, setCopied] = useState(false);

  const filteredFields = FIELDS.filter((f) => {
    if (requiredOnly && !f.required) return false;
    if (!fieldSearch) return true;
    const q = fieldSearch.toLowerCase();
    return (
      f.label.toLowerCase().includes(q) ||
      f.key.toLowerCase().includes(q) ||
      (f.aliases || []).some((a) => a.toLowerCase().includes(q))
    );
  });

  const tabs = [
    { id: 'sample',    label: 'Sample',          icon: HiOutlineDocumentText },
    { id: 'reference', label: 'Field Reference', icon: HiOutlineTableCells   },
    { id: 'enums',     label: 'Allowed Values',  icon: HiOutlineTag          },
  ];

  const copySample = () => {
    const text =
      SAMPLE_LINES.map((l) => `${l.f}: ${l.v}`).join('\n') + '\n\n----';
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mt-8 rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100 bg-gradient-to-br from-blue-50/40 via-white to-white">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
              <HiOutlineSparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-base leading-tight">
                Expected format
              </h3>
              <p className="text-sm text-gray-600 mt-1 max-w-xl">
                One property per block (PDF) or per row (Excel). Required fields are marked with{' '}
                <span className="text-red-500 font-semibold">*</span>. Field labels are flexible —
                the parser accepts common aliases.
              </p>
            </div>
          </div>
          <div className="text-xs text-gray-500 inline-flex items-center gap-1.5 self-start mt-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
            <span>{FIELDS.filter((f) => f.required).length} required &middot; {FIELDS.length} total fields</span>
          </div>
        </div>

        {/* Tab selector */}
        <div className="mt-4 inline-flex items-center gap-1 p-1 rounded-lg bg-gray-100/80 border border-gray-200/60">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                ${tab === id
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200/60'
                  : 'text-gray-600 hover:text-gray-900'}
              `}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="p-5">

        {/* ========== SAMPLE ========== */}
        {tab === 'sample' && (
          <div>
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 overflow-hidden font-mono text-[13px] leading-6">
              <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold font-sans">
                  Property Block &mdash; PDF / TXT
                </span>
                <button
                  onClick={copySample}
                  className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-900 font-sans transition-colors"
                >
                  {copied
                    ? <HiOutlineCheck className="h-3 w-3 text-green-600" />
                    : <HiOutlineClipboardDocument className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="px-4 py-3 overflow-x-auto">
                {SAMPLE_LINES.map((line, idx) => (
                  <div
                    key={idx}
                    className="flex items-baseline group hover:bg-blue-50/30 -mx-2 px-2 rounded transition-colors"
                  >
                    <span className="text-gray-400 select-none w-7 text-right tabular-nums text-[11px]">
                      {idx + 1}
                    </span>
                    <span className="ml-3 text-blue-700">{line.f}</span>
                    <span className="text-gray-400">:</span>
                    <span className="ml-2 text-gray-800 truncate">{line.v}</span>
                    {line.r && (
                      <span className="ml-auto pl-3 text-red-500 select-none" title="Required field">
                        *
                      </span>
                    )}
                  </div>
                ))}
				
      
				
				
              </div>
            </div>

           <div className="mt-4 grid sm:grid-cols-2 gap-3">
  <InfoTile
    icon={<HiOutlineDocumentText className="h-4 w-6" />}
    title="PDF"
    body={<>One block per property, fields as <code className="px-1 bg-white rounded border border-gray-200 text-[11px]">Field: Value</code>.</>}
  />
  <InfoTile
    icon={<HiOutlineTableCells className="h-4 w-6" />}
    title="Excel / CSV"
    body={<>One row per property. Headers must match field names (the <code className="px-1 bg-white rounded border border-gray-200 text-[11px]">*</code> suffix is optional).</>}
  />
</div>
			
			
          </div>
        )}

        {/* ========== FIELD REFERENCE ========== */}
        {tab === 'reference' && (
          <div>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[220px]">
                <input
                  type="text"
                  value={fieldSearch}
                  onChange={(e) => setFieldSearch(e.target.value)}
                  placeholder="Search fields, aliases, or types…"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                />
                <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={requiredOnly}
                  onChange={(e) => setRequiredOnly(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Required only
              </label>
              <span className="text-xs text-gray-500 ml-auto">
                Showing <strong className="text-gray-700">{filteredFields.length}</strong> of {FIELDS.length}
              </span>
            </div>

            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-600">Field</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-600 w-24">Type</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-600 w-24">Required</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-600">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFields.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                        No fields match your search.
                      </td>
                    </tr>
                  ) : filteredFields.map((f, idx) => {
                    const badge = TYPE_BADGES[f.type] || TYPE_BADGES.text;
                    return (
                      <tr
                        key={f.key}
                        className={`border-b border-gray-100 last:border-b-0 hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                      >
                        <td className="px-4 py-3 align-top">
                          <div className="font-medium text-gray-900 leading-tight">
                            {f.label}
                            {f.required && <span className="text-red-500 ml-1">*</span>}
                          </div>
                          {f.aliases?.length > 0 && (
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              also: {f.aliases.join(', ')}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          {f.required ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              Required
                            </span>
                          ) : (
                            <span className="text-[11px] text-gray-500">Optional</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-gray-700 leading-relaxed">
                          {f.note}
                          {f.type === 'enum' && (
                            <button
                              onClick={() => { setTab('enums'); setOpenEnum(f.enumKey); }}
                              className="ml-1 text-blue-600 hover:text-blue-800 hover:underline text-[12px]"
                            >
                              See accepted values →
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========== ENUMS ========== */}
        {tab === 'enums' && (
          <div>
            <div className="flex items-start gap-2 p-3 mb-4 rounded-lg bg-blue-50 border border-blue-100">
              <HiOutlineInformationCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-900 leading-relaxed">
                These fields only accept a fixed set of values. The parser is case-insensitive and
                accepts the alternative phrasings shown on the right &mdash; anything else is
                flagged as a validation error in the preview.
              </p>
            </div>

            <div className="space-y-2">
              {ENUM_GROUPS.map((group) => {
                const isOpen = openEnum === group.key;
                const count = Object.keys(group.labels).length;
                return (
                  <div key={group.key} className="rounded-lg border border-gray-200 overflow-hidden bg-white">
                    <button
                      onClick={() => setOpenEnum(isOpen ? null : group.key)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center text-[11px] font-bold tabular-nums">
                          {count}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{group.title}</div>
                          <div className="text-xs text-gray-500">
                            Field: <code className="px-1 py-0.5 bg-gray-100 rounded text-[11px]">{group.field}</code>
                          </div>
                        </div>
                      </div>
                      <HiOutlineChevronDown
                        className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {isOpen && (
                      <div className="border-t border-gray-100 bg-gray-50/40">
                        <div className="grid grid-cols-1 md:grid-cols-12 px-4 py-2 border-b border-gray-100 text-[11px] uppercase tracking-wider font-semibold text-gray-500">
                          <div className="md:col-span-4">Display Label</div>
                          <div className="md:col-span-8">Accepted Inputs (case-insensitive)</div>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {Object.entries(group.labels).map(([code, displayLabel]) => {
                            const inputs = group.inputs[code] || [];
                            return (
                              <div
                                key={code}
                                className="grid grid-cols-1 md:grid-cols-12 px-4 py-3 gap-2 hover:bg-white transition-colors"
                              >
                                <div className="md:col-span-4">
                                  <div className="font-medium text-gray-900 text-sm">{displayLabel}</div>
                                  <div className="text-[11px] text-gray-500 font-mono mt-0.5">{code}</div>
                                </div>
                                <div className="md:col-span-8 flex flex-wrap gap-1.5 items-start">
                                  {inputs.map((input, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-gray-200 text-[12px] text-gray-700 font-mono"
                                    >
                                      <HiOutlineCheck className="h-3 w-3 text-green-600" />
                                      {input}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const FieldCell = ({ value, error, columnKey }) => {
  // Numeric / monetary columns get right-aligned for tabular readability.
  const MONEY_KEYS  = ['price', 'emd', 'downPayment', 'assignmentFee'];
  const isNumeric   = ['bedrooms', 'bathrooms', 'squareFootage', 'yearBuilt', ...MONEY_KEYS].includes(columnKey);
  const isCount     = columnKey === 'interiorImages' || columnKey === 'exteriorImages' || columnKey === 'images';

  let display;
  if (isCount) {
    const arr = Array.isArray(value) ? value : (value ? [value] : []);
    display = arr.length
      ? <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-medium">{arr.length}</span>
      : <span className="text-gray-400">—</span>;
  } else if (MONEY_KEYS.includes(columnKey)) {
    const formatted = formatMoney(value);
    display = formatted
      ? <span className="font-medium text-gray-900">${formatted}</span>
      : <span className="text-gray-400">—</span>;
  }  else if (columnKey === 'streetAddress') {
    // Address gets the link-style emphasis since it's now the primary
    // identifier for each row in the preview.
    const text = String(value ?? '').trim();
    display = text
      ? <span className="font-medium text-gray-900" title={text}>{text}</span>
      : <span className="text-gray-400">—</span>;
  } else if (ENUM_LABELS[columnKey]) {
    display = value
      ? <span className="text-gray-700" title={value}>{ENUM_LABELS[columnKey][value] || value}</span>
      : <span className="text-gray-400">—</span>;
  } else {
    const text = String(value ?? '').trim();
    display = text
      ? <span title={text} className="line-clamp-2 text-gray-700">{text}</span>
      : <span className="text-gray-400">—</span>;
  }

  return (
    <td
      className={`px-3 py-2.5 align-middle  ${
        isNumeric || isCount ? 'text-right' : ''
      } ${error ? 'bg-red-50' : ''}`}
      title={error || undefined}
    >
      {display}
      {error && (
        <div className={`text-xs text-red-600 mt-1 font-medium ${isNumeric || isCount ? 'text-right' : ''}`}>
          {error}
        </div>
      )}
    </td>
  );
};

const StatusBadge = ({ row }) => {
  const errorCount = Object.keys(row.errors).length;
  if (errorCount === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs font-medium">
        <HiOutlineCheckCircle className="h-3.5 w-3.5" />
        Ready
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-xs font-medium">
      <HiOutlineExclamationTriangle className="h-3.5 w-3.5" />
      {errorCount} issue{errorCount > 1 ? 's' : ''}
    </span>
  );
};

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */
const PDFImport = ({ open, onClose, onSuccess }) => {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [filter, setFilter] = useState('all'); // all | valid | invalid
  const [notification, setNotification] = useState({
    open: false, type: 'info', title: '', message: '',
  });

  /* ----- Parse a freshly dropped file -------------------------------- */
  const handleFile = async (f) => {
    setFile(f);
    setIsParsing(true);
    setParseError('');
    setRows([]);
    try {
      const { rows: parsedRows } = await parsePropertyFile(f);
      if (parsedRows.length === 0) {
        setParseError(
          "We couldn't find any property rows in this file. " +
          "For PDFs, make sure each property uses 'Field: Value' lines and is " +
          "separated by a row of dashes. For Excel, the first row should be " +
          "headers and there should be at least one data row."
        );
      } else {
        setRows(parsedRows);
      }
    } catch (err) {
      console.error('File parse failed', err);
      setParseError(err?.message || 'Failed to read this file.');
    } finally {
      setIsParsing(false);
    }
  };

  /* ----- Toggle inclusion of a single row --------------------------- */
  const toggleRow = (id) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        // Rows with errors can never be selected.
        if (Object.keys(r.errors).length > 0) return { ...r, include: false };
        return { ...r, include: !r.include };
      })
    );
  };

  /* ----- Bulk select / deselect ------------------------------------- */
  const setAll = (include) => {
    setRows((prev) =>
      prev.map((r) =>
        Object.keys(r.errors).length === 0 ? { ...r, include } : r
      )
    );
  };

  /* ----- Drop a row entirely ---------------------------------------- */
  const removeRow = (id) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  /* ----- Reset to the upload screen --------------------------------- */
  const reset = () => {
    setFile(null);
    setRows([]);
    setParseError('');
    setFilter('all');
  };

  /* ----- Commit selected rows --------------------------------------- */
  const commitMutation = useMutation({
    mutationFn: () => propertyImportAPI.commitImport(rows),
    onSuccess: (result) => {
      // Refresh every page that lists properties. PropertyManagement uses
      // 'adminDeals'; MyProperties uses 'myProperties'. Invalidate both so
      // newly-imported rows appear instantly without a hard refresh,
      // regardless of which page launched the modal.
      queryClient.invalidateQueries({ queryKey: ['adminDeals'],   exact: false });
      queryClient.invalidateQueries({ queryKey: ['myProperties'], exact: false });

      // Build a result message that mentions whichever buckets are non-zero.
      const parts = [];
      if (result.created) parts.push(`created ${result.created}`);
      if (result.updated) parts.push(`updated ${result.updated}`);
      if (result.skipped) parts.push(`skipped ${result.skipped}`);
      if (result.failed?.length) parts.push(`${result.failed.length} failed`);
      const summary = parts.length
        ? parts.join(', ').replace(/^./, (c) => c.toUpperCase())
        : 'No changes';

      setNotification({
        open: true,
        type: 'success',
        title: 'Import complete',
        message: `${summary}.`,
      });
      reset();
      onClose?.();
      // Let the parent page do any additional refresh logic — e.g.
      // invalidate a custom query key or scroll to the top of the list.
      onSuccess?.(result);
    },
    onError: (err) => {
      setNotification({
        open: true,
        type: 'error',
        title: 'Import failed',
        message: err?.response?.data?.message || err?.message || 'Could not import properties.',
      });
    },
  });

  /* ----- Derived view state ----------------------------------------- */
  const stats = useMemo(() => ({
    total: rows.length,
    valid: rows.filter((r) => Object.keys(r.errors).length === 0).length,
    invalid: rows.filter((r) => Object.keys(r.errors).length > 0).length,
    selected: rows.filter((r) => r.include).length,
  }), [rows]);

  const visibleRows = useMemo(() => {
    if (filter === 'valid')   return rows.filter((r) => Object.keys(r.errors).length === 0);
    if (filter === 'invalid') return rows.filter((r) => Object.keys(r.errors).length > 0);
    return rows;
  }, [rows, filter]);

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */
  return (
    <>
      <Modal
        isOpen={open}
        onClose={onClose}
        title="Import Properties"
        size="xl"
      >
        <div className="bg-app -mx-6 px-6 py-4 min-h-[50vh]">

          {/* ---------- Step 1: upload ---------- */}
          {rows.length === 0 && (
            <div className="max-w-3xl mx-auto">
              {/* Sample-file downloads — gives the user a working
                  template before they try to build their own file. The
                  href values come from Vite asset imports so they're
                  hashed and safe in production builds. The `download`
                  attribute forces a save dialog instead of opening the
                  file in a new tab. */}
              <div className="flex items-center justify-end gap-2 mb-4">
                <span className="text-xs text-text-secondary mr-1">
                  Need a template?
                </span>
                <a
                  href={samplePdfUrl}
                  download="sample-property-import.pdf"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border-subtle bg-surface hover:bg-app text-text-primary transition-colors"
                  title="Download sample PDF"
                >
                  <HiOutlineArrowDownTray className="h-4 w-4" />
                  Sample PDF
                </a>
                <a
                  href={sampleXlsxUrl}
                  download="sample-property-import.xlsx"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-border-subtle bg-surface hover:bg-app text-text-primary transition-colors"
                  title="Download sample Excel"
                >
                  <HiOutlineArrowDownTray className="h-4 w-4" />
                  Sample Excel
                </a>
              </div>

              <Dropzone onFile={handleFile} isParsing={isParsing} />

              {parseError && (
                <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
                  <strong className="block mb-1">Couldn't parse the PDF</strong>
                  {parseError}
                </div>
              )}

              <ExpectedFormatCard />
            </div>
          )}

          {/* ---------- Step 2: preview ---------- */}
          {rows.length > 0 && (
            <>
              {/* Summary bar */}
              <div className="bg-surface border border-border-subtle rounded-xl p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-medium text-text-primary">
                    {file?.name}
                  </span>
                  <span className="text-text-secondary">
                    {stats.total} row{stats.total === 1 ? '' : 's'} parsed
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-medium">
                    {stats.valid} ready
                  </span>
                  {stats.invalid > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-800 text-xs font-medium">
                      {stats.invalid} need fixing
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-flex rounded-md border border-border-subtle bg-app text-xs">
                    {[
                      { value: 'all', label: `All (${stats.total})` },
                      { value: 'valid', label: `Ready (${stats.valid})` },
                      { value: 'invalid', label: `Issues (${stats.invalid})` },
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setFilter(value)}
                        className={`px-3 py-1.5 transition-colors ${
                          filter === value
                            ? 'bg-primary text-white'
                            : 'hover:bg-white text-text-secondary'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setAll(true)}>
                    Select all valid
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setAll(false)}>
                    Clear
                  </Button>
                  <Button variant="outline" size="sm" onClick={reset}>
                    Upload another
                  </Button>
                </div>
              </div>

              {/* Preview table — clean tabular look (light header, zebra rows) */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-3 w-10 text-left">
                          <input
                            type="checkbox"
                            checked={stats.selected > 0 && stats.selected === stats.valid}
                            ref={(el) => { if (el) el.indeterminate = stats.selected > 0 && stats.selected < stats.valid; }}
                            onChange={(e) => setAll(e.target.checked)}
                            className="w-4 h-4 rounded"
                            aria-label="Select all valid rows"
                          />
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 w-10">#</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 min-w-[90px]">
                          Status
                        </th>
                        {COLUMNS.map((col) => {
                          const isNumeric = ['price', 'emd', 'downPayment', 'assignmentFee', 'bedrooms', 'bathrooms', 'squareFootage', 'yearBuilt', 'interiorImages', 'exteriorImages'].includes(col.key);
                          return (
                            <th
                              key={col.key}
                              className={`px-3 py-3 text-xs font-semibold text-gray-700 ${col.width} ${isNumeric ? 'text-right' : 'text-left'}`}
                            >
                              {col.label}
                            </th>
                          );
                        })}
                        <th className="px-3 py-3 w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.length === 0 ? (
                        <tr>
                          <td colSpan={COLUMNS.length + 4} className="px-6 py-10 text-center text-gray-500">
                            No rows match this filter.
                          </td>
                        </tr>
                      ) : visibleRows.map((row, idx) => {
                        const hasErrors = Object.keys(row.errors).length > 0;
                        // Zebra striping — even rows white, odd rows light gray.
                        // Error rows override the stripe with a soft red wash.
                        const stripeBg = hasErrors
                          ? 'bg-red-50'
                          : (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60');

                        return (
                          <tr
                            key={row.id}
                            className={`${stripeBg} border-b border-gray-100 last:border-b-0 hover:bg-blue-50/30 transition-colors`}
                          >
                            <td className="px-3 py-2.5 align-middle">
                              <input
                                type="checkbox"
                                checked={row.include}
                                disabled={hasErrors}
                                onChange={() => toggleRow(row.id)}
                                className="w-4 h-4 rounded"
                                aria-label={`Include row ${idx + 1}`}
                              />
                            </td>
                            <td className="px-3 py-2.5 text-gray-500 align-middle">
                              {idx + 1}
                            </td>
                            <td className="px-3 py-2.5 align-middle">
                              <StatusBadge row={row} />
                              {hasErrors && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Lines {row.sourceLines[0]}–{row.sourceLines[1]}
                                </div>
                              )}
                            </td>
                            {COLUMNS.map((col) => (
                              <FieldCell
                                key={col.key}
                                value={row.data[col.key]}
                                error={row.errors[col.key]}
                                columnKey={col.key}
                              />
                            ))}
                            <td className="px-3 py-2.5 align-middle">
                              <button
                                onClick={() => removeRow(row.id)}
                                className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                                aria-label="Remove row"
                                title="Remove this row from the import"
                              >
                                <HiOutlineTrash className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer (inside modal body — Modal component handles its own chrome) */}
        {rows.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border-subtle flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-text-secondary">
              {stats.selected} of {stats.valid} valid row{stats.valid === 1 ? '' : 's'} selected.
              Existing properties at the same address will be updated.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                onClick={() => commitMutation.mutate()}
                disabled={stats.selected === 0 || commitMutation.isPending}
              >
                {commitMutation.isPending
                  ? 'Importing…'
                  : `Import ${stats.selected} propert${stats.selected === 1 ? 'y' : 'ies'}`}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <NotificationModal
        open={notification.open}
        type={notification.type}
        title={notification.title}
        message={notification.message}
        onClose={() => setNotification((n) => ({ ...n, open: false }))}
      />
    </>
  );
};

export default PDFImport;
