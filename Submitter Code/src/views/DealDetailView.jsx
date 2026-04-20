import { useEffect, useMemo, useRef, useState } from 'react';
import { getLatLongFromAddress, getOSMMapElement } from '../api/mapping';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { dealsAPI } from '../api/deals';
import { useAuthSafe } from '../contexts/AuthContext';
import Loader from '../components/Loader';
import '../styles/main.css';

export const PROPERTY_TYPES = [
  { value: 'SINGLE_FAMILY', label: 'Single Family Home' },
  { value: 'CONDO', label: 'Condo' },
  { value: 'TOWNHOUSE', label: 'Town House' },
  { value: 'TWO_TO_FOUR_UNIT', label: '2–4 Unit Home' },
  { value: 'UNIQUE_PROPERTY', label: 'Unique Property' },
];

export const MONTHS = [
  { key: '12m', label: '12 Months' },
  { key: '24m', label: '24 Months' },
  { key: '36m', label: '36 Months' },
  { key: '48m', label: '48 Months' },
  { key: '60m', label: '60 Months' },
  { key: '72m', label: '72 Months' },
  { key: '84m', label: '84 Months' },
];

export const VACATION_RENTAL_MARKET_LABELS = {
  BEACH: 'Beach',
  MOUNTAIN: 'Mountain',
  URBAN: 'Urban',
  LAKE: 'Lake',
  NATURE_PARKS: 'Nature / Parks',
  THEME_PARKS: 'Theme Parks',
  COLLEGE_TOWN: 'College Town',
  OFF_BEATEN_PATH: 'Off the Beaten Path',
};

export const formatPrice = (price) => {
  const n = parseFloat(price);
  if (Number.isNaN(n)) return '0';
  return parseInt(n, 10).toLocaleString('en-US');
};

export const hasValue = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'number') return !Number.isNaN(v) && v !== 0;
  return true;
};

export const hasAnyValue = (...values) => values.some(hasValue);
export const hasAnyObjectValue = (obj = {}) => Object.values(obj).some(hasValue);
export const normalizeTurnkey = (value) => value?.toString?.().toUpperCase().replace(/-/g, '_');
export const isTurnkeyDeal = (deal) =>
  ['TURNKEY_OPERATING', 'FURNISHED_NOT_OPERATING'].includes(normalizeTurnkey(deal?.turnkeyFurnished));

export const getDealImages = (deal) =>
  [
    ...(Array.isArray(deal?.exteriorImages) ? deal.exteriorImages : []),
    ...(Array.isArray(deal?.interiorImages) ? deal.interiorImages : []),
    ...(Array.isArray(deal?.additionalImages) ? deal.additionalImages : []),

  ]
    .map((img) => {
      if (typeof img === 'string') return img;
      if (img && typeof img === 'object' && img.url) return img.url;
      return null;
    })
    .filter(Boolean);

export function getUserTypeLabel(type) {
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

const fmt$ = (val) => {
  const n = parseFloat(val);
  if (Number.isNaN(n) || !n) return '—';
  return `$${parseInt(n, 10).toLocaleString('en-US')}`;
};

const formatCompact = (val) => {
  const n = parseFloat(val);
  if (Number.isNaN(n) || !n) return '—';
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n)}`;
};

const humanizeEnum = (value) => {
  if (!value || typeof value !== 'string') return '—';
  return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

/**
 * Single source of truth for all 50/50 JV pro-forma numbers.
 * Every derived value in the section is computed here once and
 * consumed by reference — nothing is recalculated inline.
 *
 * Rate constants (mirrors the spreadsheet INPUTS sheet):
 *   JV_EQUITY_PCT       = 30 %  (INPUTS!B12  — client LLC buy-in share)
 *   FEDERAL_TAX_RATE    = deal.effectiveTaxRate ?? 37 %  (INPUTS!B42 — falls back to 37 % if not set)
 *   PREFERRED_DIST_RATE =  8 %  (INPUTS!B39  — annual preferred distribution)
 *   APPRECIATION_RATE   =  7 %  (INPUTS!B??  — annual appreciation used for FV)
 *   HOLD_YEARS          =  5    (INPUTS!B??  — exit / hold period)
 *   CLIENT_SPLIT        = 50 %  (50/50 partner share of net sale proceeds)

 */

const computeProForma = (deal, taxRateSettings) => {
  // ── Rate constants ────────────────────────────────────────────────────────
  const JV_EQUITY_PCT = 0.30;
  const FEDERAL_TAX_RATE = taxRateSettings?.federal_tax_rate ? parseFloat(taxRateSettings?.federal_tax_rate) / 100 : 0;
  const FEDERAL_TAX_PERCENTAGE = taxRateSettings?.federal_tax_rate || 0;
  const APPRECIATION_RATE = 1.07;
  const HOLD_YEARS = 5;

  //const PREFERRED_DIST_RATE = taxRateSettings?.preferred_dist_rate ? parseFloat(taxRateSettings.preferred_dist_rate) / 100: 0;
  //const CLIENT_SPLIT        = taxRateSettings?.client_share_forced_appreciation ? parseFloat(taxRateSettings.client_share_forced_appreciation) / 100: 0;

  const PREFERRED_DIST_RATE = 0.08;
  const CLIENT_SPLIT = 0.50;

  // ── Base inputs ───────────────────────────────────────────────────────────
  const purchasePrice = deal.price || 0;

  // ── Primary derived values ────────────────────────────────────────────────
  // LLC JV Buy-In = Purchase Price × 30 %  (INPUTS!B12)


  //const llcBuyIn = purchasePrice ? purchasePrice * JV_EQUITY_PCT : (deal.downPayment || 0);

  const llcBuyIn = deal.costsIncluded && deal.customJvValues ? parseInt(deal.customJvValues) : purchasePrice
    ? purchasePrice * JV_EQUITY_PCT : (deal.downPayment || 0);

  // Out-of-Pocket = LLC Buy-In + Design/Setup + Start-Up
  const totalOOP = llcBuyIn;

  // Bonus Depreciation = Cost-Seg % × Purchase Price  (INPUTS!B44)
  const bonusDepr = purchasePrice * JV_EQUITY_PCT;

  // Initial Tax Savings = Federal Tax Rate × Bonus Depreciation  (EXEC_SUMMARY!W19)
  const taxSavings = purchasePrice
    ? Math.round(FEDERAL_TAX_RATE * bonusDepr)
    : (deal.taxSavings || 0);

  // Annual preferred distribution = LLC Buy-In × 8 %  (INPUTS!B39)
  const annualDist = Math.round(totalOOP * PREFERRED_DIST_RATE);


  // Total 5-year distributions
  const totalDist = Math.round(annualDist * HOLD_YEARS);

  // Est. Sale Price = FV(7 %, 5 yrs, Purchase Price)  (EXEC_SUMMARY!S24)
  const estSalePrice = purchasePrice
    ? Math.round(purchasePrice * Math.pow(APPRECIATION_RATE, HOLD_YEARS))
    : 0;


  // Accelerated Appreciation Gain = Est. Sale Price − Purchase Price
  const apprGain = estSalePrice - purchasePrice;

  // Net Sale Proceeds (after returning OOP) split 50/50
  const netProceeds = apprGain - llcBuyIn;

  const clientShare = apprGain - totalOOP;
  const netSales = Math.round(clientShare * CLIENT_SPLIT);


  // Total Return & Benefit = OOP + Client Share + 5-yr Distributions + Tax Savings
  const totalReturn = purchasePrice
    ? Math.round(totalOOP + Math.round(netSales) + totalDist + taxSavings)
    : (deal.totalReturnBenefit || deal.totalReturnAndBenefit || 0);
  // Annualized Return = RATE(5, 0, −OOP, TotalReturn)
  const annualizedReturn = purchasePrice && llcBuyIn > 0
    ? `${((Math.pow(totalReturn / llcBuyIn, 1 / HOLD_YEARS) - 1) * 100).toFixed(2)}%`
    : (deal.annualizedReturn ? `${deal.annualizedReturn}%` : '—');

  // 1-Yr Cash-on-Cash = (Year-1 Distribution + Tax Savings) / OOP
  const cashOnCash = purchasePrice && llcBuyIn > 0
    ? `${(((annualDist + taxSavings) / llcBuyIn) * 100).toFixed(0)}%`
    : (deal.cashOnCashReturn ? `${deal.cashOnCashReturn}%` : '—');

  // Federal tax rate label (may be overridden on the deal)
  const federalTaxRateLabel = deal.effectiveTaxRate ? `${deal.effectiveTaxRate}%` : '37%';


  // 1-Yr CoC = (Year-1 annualDist + taxSavings) / totalOOP  → Excel: 45%
  const cashOnCash1yr = purchasePrice && totalOOP > 0
    ? `${(((annualDist + taxSavings) / totalOOP) * 100).toFixed(2)}%`
    : (deal.cashOnCashReturn ? `${deal.cashOnCashReturn}%` : '—');

  // 3-Yr CoC = (annualDist×3 + taxSavings) / totalOOP  → Excel: 61%
  const cashOnCash3yr = purchasePrice && totalOOP > 0
    ? `${(((annualDist * 3 + taxSavings) / totalOOP) * 100).toFixed(2)}%`
    : '—';

  // 5-Yr CoC = totalReturn / totalOOP − 1  (total cash-on-cash over 5 yrs)
  // Excel EXEC_SUMMARY col 22: 1.94092 displayed — that's total return ratio − 1
  const cashOnCash5yr = purchasePrice && totalOOP > 0
    ? `${((totalReturn / totalOOP) * 100).toFixed(2)}%`
    : '—';
  return {
    // constants (for display)
    purchasePrice,
    llcBuyIn,
    totalOOP,
    bonusDepr,
    taxSavings,
    annualDist,
    totalDist,
    estSalePrice,
    apprGain,
    clientShare,
    totalReturn,
    annualizedReturn,
    cashOnCash,
    netSales,
    FEDERAL_TAX_RATE,
    FEDERAL_TAX_PERCENTAGE,
    cashOnCash1yr,
    cashOnCash3yr,
    cashOnCash5yr,
    federalTaxRateLabel,
  };
};
// popup LLC Joint Venture Buy 
const LLC_INCLUDED_ITEMS = [
  { icon: '🏠', category: 'Acquisition', items: ['Earnest Money Deposit', 'Home Inspection', 'Title Report', 'Entry / Down', 'Entry Fee', 'Closing Costs', 'Real Estate Agent Commissions', 'Wholesale Fees'] },
  { icon: '🎨', category: 'Design & Setup', items: ['Design Market Research', 'On-Site Measurements and Photos', 'Renovations', 'Furniture and Décor', 'Theming and Design Setup and Staging'] },
  { icon: '⚖️', category: 'Legal & Admin', items: ['Setting Up the LLC', 'Adding Client to LLC', 'Setting Up Utilities', 'Utility Deposits', 'Third Party Mortgage Payment Services'] },
  { icon: '💰', category: 'Financial Carry', items: ['Back Payments (When Mortgages Are Behind)', 'Back Taxes (When Applicable)', 'Mortgage Payments During Setup', 'Monthly Expenses During Setup'] },
  { icon: '🚀', category: 'Launch & Marketing', items: ['Management Onboarding', 'Professional Photo Shoot', 'Property Listing Setup', 'Initial Marketing', 'Etc'] },
];

const WhatsIncludedModal = ({ onClose }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ border: '1px solid #e2e8f0' }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-2xl px-6 py-5"
          style={{ background: 'linear-gradient(135deg, #0369a1 0%, #0284c7 100%)', borderBottom: '1px solid #0284c7' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-xl">📋</div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-sky-200">LLC Joint Venture Buy-In</p>
              <h2 className="text-lg font-bold text-white">What's Included</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 hover:bg-white/20 hover:text-white transition-colors text-lg font-semibold"
          >✕</button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-500 leading-relaxed">
            The LLC Joint Venture Buy-In is a comprehensive investment that covers every aspect of getting your property
            acquisition-ready and revenue-generating from day one.
          </p>
          {LLC_INCLUDED_ITEMS.map((section) => (
            <div key={section.category}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{section.icon}</span>
                <h3 className="text-xs font-bold uppercase tracking-widest text-sky-700">{section.category}</h3>
              </div>
              <div className="space-y-1.5 pl-7">
                {section.items.map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sky-400" />
                    <span className="text-sm text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 rounded-b-2xl border-t border-slate-100 bg-slate-50 px-6 py-4">
          <p className="text-center text-xs text-slate-400">
            All items above are covered within your LLC Joint Venture Buy-In investment.
          </p>
        </div>
      </div>
    </div>
  );
};



const getUrl = (img) => (typeof img === 'string' ? img : img?.url || '');

function OSMMap({ coords }) {
  const mapRef = useRef(null);

  useEffect(() => {
    if (coords && mapRef.current) {
      mapRef.current.innerHTML = '';
      const iframe = getOSMMapElement(coords.latitude, coords.longitude);
      iframe.height = '225';
      iframe.width = '100%';
      iframe.style.border = '0';
      mapRef.current.appendChild(iframe);
    }
  }, [coords]);

  return <div ref={mapRef} className="w-full min-h-[225px]" />;
}

const ImageLightbox = ({ images, startIndex, onClose }) => {
  const [current, setCurrent] = useState(startIndex || 0);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setCurrent((i) => (i + 1) % images.length);
      if (e.key === 'ArrowLeft') setCurrent((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [images.length, onClose]);

  if (!images?.length) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 p-4 md:p-8" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute right-5 top-5 h-10 w-10 rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"
      >
        ✕
      </button>

      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCurrent((i) => (i - 1 + images.length) % images.length);
            }}
            className="absolute left-4 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full bg-white/10 text-2xl text-white backdrop-blur hover:bg-white/20"
          >
            ‹
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCurrent((i) => (i + 1) % images.length);
            }}
            className="absolute right-4 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full bg-white/10 text-2xl text-white backdrop-blur hover:bg-white/20"
          >
            ›
          </button>
        </>
      )}

      <div className="flex h-full items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <img
          src={getUrl(images[current])}
          alt={`Property photo ${current + 1}`}
          className="max-h-[80vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
        />
      </div>

      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2 overflow-x-auto rounded-full bg-white/10 px-3 py-2 backdrop-blur">
        {images.map((img, index) => (
          <img
            key={`${getUrl(img)}-${index}`}
            src={getUrl(img)}
            alt="thumbnail"
            onClick={(e) => {
              e.stopPropagation();
              setCurrent(index);
            }}
            className={`h-14 w-14 cursor-pointer rounded-lg object-cover ring-2 ${index === current ? 'ring-white' : 'ring-transparent opacity-70'
              }`}
          />
        ))}
      </div>
    </div>
  );
};

const SectionHeading = ({ title, icon }) => (
  <div className="mb-4 flex items-center gap-2 revenue-hed">
    <span className="text-sky-600">{icon}</span>
    <h2 className=" text-[18px] font-bold uppercase tracking-wide text-sky-700">{title}</h2>
  </div>
);

const SoftCard = ({ className = '', children }) => (
  <div className={`${className}`}>{children}</div>
);

const TieredMetric = ({ title, unit = '', data = {} }) => (
  <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5">
    <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{title}</p>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {Object.entries(data).map(([tier, val]) => (
        <div key={tier} className="rounded-2xl bg-slate-50 px-3 py-3 text-center">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{tier}</p>
          <p className="text-[13px] font-bold text-slate-800 ">
            {val !== null && val !== undefined && val !== '' && !Number.isNaN(parseFloat(val))
              ? `${unit}${parseInt(val, 10).toLocaleString('en-US')}`
              : '—'}
          </p>
        </div>
      ))}
    </div>
  </div>
);

const StatItem = ({ label, value, valueClassName = '' }) => (
  <div className="str-box">
    <p className="mb-1 text-[11px] font-bold uppercase text-gray-700">{label}</p>
    <p className={`text-[13px] font-semibold text-gray-900 ${valueClassName}`}>{value || '—'}</p>
  </div>
);

const DetailRow = ({ label, value, emphasized = false }) => (
  <div
    className={`flex items-center justify-between gap-4 rounded-2xl md:px-4 px-1 py-2 ${emphasized ? 'bg-white shadow-sm ring-1 ring-sky-100 total_row' : ''
      }`}
  >
    <span className="text-sm text-gray-500">{label}</span>
    <span className={`text-sm font-bold ${emphasized ? 'text-sky-600' : 'text-gray-800'}`}>
      {value || '—'}
    </span>
  </div>
);

const DataTable = ({ columns, rows }) => (
  <div className="overflow-hidden">
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm tier-table-detail">
        <thead>
          <tr className="border-b border-slate-200 text-left row-bg">
            {columns.map((column) => (
              <th
                key={column.key}
                className={`pb-3 text-xs font-bold uppercase tracking-[0.14em] text-gray-600 ${column.align === 'right' ? 'text-right' : ''
                  }`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-slate-200 revenue-tier ">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`py-3 text-gray-600 ${column.align === 'left' ? 'text-left' : ''
                    } ${column.valueClassName || 'text-gray-700'}`}
                >
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const PropertyGallery = ({ images, onOpen }) => {
  const hero = images[0];
  const sideImages = images.slice(1, 5);

  if (!hero) {
    return (
      <SoftCard className="p-8">
        <div className="flex h-[320px] items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          No property images available
        </div>
      </SoftCard>
    );
  }

  return (
    <SoftCard className="">
      <div className="grid gap-2 md:grid-cols-[1.05fr_1fr]">
        <button className="group relative overflow-hidden rounded-xl" onClick={() => onOpen(0)}>
          <img
            src={hero}
            alt="Main property"
            className="h-[260px] w-full object-cover transition duration-300 group-hover:scale-[1.02] md:h-[400px]"
          />
        </button>

        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, idx) => {
            const img = sideImages[idx] || hero;
            const realIndex = images.findIndex((x) => x === img);
            const isLast = idx === 3 && images.length > 5;

            return (
              <button
                key={`${img}-${idx}`}
                className="group relative overflow-hidden rounded-xl"
                onClick={() => onOpen(realIndex >= 0 ? realIndex : idx + 1)}
              >
                <img
                  src={img}
                  alt={`Property ${idx + 2}`}
                  className="h-[129px] w-full object-cover transition duration-300 group-hover:scale-[1.03] md:h-[196px]"
                />
                {isLast && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/45 text-lg font-semibold text-white">
                    Show all photos
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </SoftCard>
  );
};

const DealDetailView = ({
  deal,
  onBack,
  canViewAddress,
  bckProperty = true,
  backLabel = 'Back to Properties',
}) => {
  const [mapCoords, setMapCoords] = useState(null);
  const [mapError, setMapError] = useState(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [taxSectionRate, setTaxSectionRate] = useState(null);       // Tax Savings section
  const [jvSectionRate, setJvSectionRate] = useState(null);         // 50/50 JV section
  const [showIncludedModal, setShowIncludedModal] = useState(false);

  const [editableOccupancy, setEditableOccupancy] = useState(null);
  const [editableANR, setEditableANR] = useState(null);

  const PROPERTY_TYPE_LABELS = useMemo(
    () => PROPERTY_TYPES.reduce((acc, item) => ({ ...acc, [item.value]: item.label }), {}),
    []
  );

  const allImages = useMemo(() => getDealImages(deal), [deal]);

  const openLightbox = (index = 0) => setLightbox({ images: allImages, index });
  const closeLightbox = () => setLightbox(null);

  const handleAddressClick = async () => {
    if (mapCoords || mapLoading || mapError) {
      setMapCoords(null);
      setMapError(null);
      setMapLoading(false);
      return;
    }

    setMapLoading(true);
    setMapError(null);
    setMapCoords(null);

    try {
      const address = [deal.streetAddress, deal.city, deal.stateRegion, deal.postalCode]
        .filter(Boolean)
        .join(', ');
      const coords = await getLatLongFromAddress(address);
      setMapCoords(coords);
    } catch (err) {
      setMapError(err?.message || 'Failed to load map');
    } finally {
      setMapLoading(false);
    }
  };

  if (!deal) return <Loader />;

  // u2500u2500 Pro-forma figures u2014 computed ONCE, referenced everywhere below u2500u2500u2500u2500u2500u2500u2500u2500
  // const pf = computeProForma(deal);
  const pf = computeProForma(deal, deal.taxRateSettings?.[0]);

  // ── 50/50 JV section — active values driven by jvSectionRate input ────────
  const activeJvFederalRate = jvSectionRate !== null
    ? jvSectionRate
    : (pf.FEDERAL_TAX_RATE * 100);
  const activeTaxSavings = Math.round((activeJvFederalRate / 100) * pf.bonusDepr);

  const activeTotalReturn = pf.purchasePrice
    ? Math.round(pf.totalOOP + pf.netSales + pf.totalDist + activeTaxSavings)
    : pf.totalReturn;

  const activeCashOnCash1yr = pf.purchasePrice && pf.totalOOP > 0
    ? `${(((pf.annualDist + activeTaxSavings) / pf.totalOOP) * 100).toFixed(2)}%`
    : pf.cashOnCash1yr;
  const activeCashOnCash3yr = pf.purchasePrice && pf.totalOOP > 0
    ? `${(((pf.annualDist * 3 + activeTaxSavings) / pf.totalOOP) * 100).toFixed(2)}%`
    : pf.cashOnCash3yr;
  const activeCashOnCash5yr = pf.purchasePrice && pf.totalOOP > 0
    ? `${((activeTotalReturn / pf.totalOOP) * 100).toFixed(2)}%`
    : pf.cashOnCash5yr;
  const activeAnnualizedReturn = pf.purchasePrice && pf.llcBuyIn > 0
    ? `${((Math.pow(activeTotalReturn / pf.llcBuyIn, 1 / 5) - 1) * 100).toFixed(2)}%`
    : pf.annualizedReturn;

  const titleLine =
    [deal.yearBuilt, deal.bedrooms ? `${deal.bedrooms} Bed` : null, deal.bathrooms ? `${deal.bathrooms} Bath` : null]
      .filter(Boolean)
      .join(' | ') || deal.title;

  const submittedName = deal.submittedBy?.name || deal.submitter?.name || deal.submittedBy || 'Unknown';
  const submittedPhone = deal.submittedBy?.phone || deal.submitter?.phone || deal.submittedBy || '-';


  const submittedRole = deal.submittedBy?.userType ? `(${getUserTypeLabel(deal.submittedBy.userType)})` : deal.submitter?.userType ? `(${getUserTypeLabel(deal.submitter.userType)})` : '';

  const hasMarketRevenue = hasAnyObjectValue({
    m12: deal.marketRevenue12m,
    m24: deal.marketRevenue24m,
    m36: deal.marketRevenue36m,
    m48: deal.marketRevenue48m,
    m60: deal.marketRevenue60m,
    m72: deal.marketRevenue72m,
    m84: deal.marketRevenue84m,
  });

  const hasMarketOccupancy = hasAnyObjectValue({
    m12: deal.marketOccupancy12m,
    m24: deal.marketOccupancy24m,
    m36: deal.marketOccupancy36m,
    m48: deal.marketOccupancy48m,
    m60: deal.marketOccupancy60m,
    m72: deal.marketOccupancy72m,
    m84: deal.marketOccupancy84m,
  });

  const tierRows = [
    { tier: 'Budget', rate: deal.anr_budget ?? deal.anrbudget, revenue: deal.egr_budget ?? deal.egrbudget, occupancy: deal.occupancyRate_budget },
    { tier: 'Economy', rate: deal.anr_economy ?? deal.anreconomy, revenue: deal.egr_economy ?? deal.egreconomy, occupancy: deal.occupancyRate_economy },
    { tier: 'Midscale', rate: deal.anr_midscale ?? deal.anrmidscale, revenue: deal.egr_midscale ?? deal.egrmidscale, occupancy: deal.occupancyRate_midscale },
    { tier: 'Upscale', rate: deal.anr_upscale ?? deal.anrupscale, revenue: deal.egr_upscale ?? deal.egrupscale, occupancy: deal.occupancyRate_upscale },
    { tier: 'Luxury', rate: deal.anr_luxury ?? deal.anrluxury, revenue: deal.egr_luxury ?? deal.egrluxury, occupancy: deal.occupancyRate_luxury },
  ].filter((row) => hasAnyValue(row.rate, row.revenue));

  const marketRows = MONTHS.map(({ key, label }) => ({
    period: label,
    revenue: hasValue(deal[`marketRevenue${key}`]) ? formatCompact(deal[`marketRevenue${key}`]) : '—',
    occupancy: hasValue(deal[`marketOccupancy${key}`]) ? `${deal[`marketOccupancy${key}`]}%` : '—',
  })).filter((row) => row.revenue !== '—' || row.occupancy !== '—');

  const compRows = [1, 2, 3, 4, 5, 6]
    .map((num) => {
      const link = deal[`comp${num}link`];
      const revenue = deal[`comp${num}grossRevenue`];
      if (!hasAnyValue(link, revenue)) return null;
      return {
        name: link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sky-700 underline-offset-4 hover:underline"
          >
            Comparable {num}
          </a>
        ) : (
          `Comparable ${num}`
        ),
        revenue: fmt$(revenue),
      };
    })
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-white pb-16 text-slate-900">
      {lightbox && <ImageLightbox images={lightbox.images} startIndex={lightbox.index} onClose={closeLightbox} />}
      {showIncludedModal && <WhatsIncludedModal onClose={() => setShowIncludedModal(false)} />}

      <div className="mx-auto max-w-[1320px] px-4 py-8 md:px-6 lg:px-6">
        {bckProperty && (
          <button
            onClick={onBack}
            className="mb-8 inline-flex items-center gap-2 text-base font-medium text-gray-700 transition hover:text-slate-700"
          >
            <span className="text-lg">←</span> {backLabel}
          </button>
        )}
        <div className="p-6 px-3 md:px-8 md:p-8 rounded-2xl border border-slate-200 bg-slate-50/90">
          {deal.status === 'sold' && (
            <div className="mb-8 rounded-3xl border border-red-200 bg-red-50 px-6 py-5 text-red-800">
              <h3 className="text-lg font-semibold">This Property Has Been Sold</h3>
              <p className="mt-1 text-sm text-red-700">This listing is no longer available for purchase.</p>
            </div>
          )}

          <PropertyGallery images={allImages} onOpen={openLightbox} />

          {/* ── Tags Row (full width, below gallery) ─────────────────────────── */}
          {(() => {
            const interestRate = parseFloat(deal.subjInterestRate || deal.sellerInterestRate);
            const downPayment = parseFloat(deal.downPayment);
            const price = parseFloat(deal.price);
            const downPaymentPercent = price > 0 ? (downPayment / price) * 100 : null;


            const normalizedFinancingType = (deal.financingType || '').toUpperCase().replace(/[\s_-]+/g, '');
            const isCreativeFinancing =
              normalizedFinancingType === 'SELLER' ||
              normalizedFinancingType === 'SUBJECTTO' ||
              normalizedFinancingType === 'HYBRID';

            const tags = [
              {
                key: 'jv',
                show: deal.fiftyFiftyPartner === true,
                label: '50/50 Joint Venture',
                color: 'bg-violet-50 text-violet-700 ring-violet-200',
                icon: '🤝',
              },
              {
                key: 'turnkey',
                show: isTurnkeyDeal(deal),
                label: 'Turnkey Fully Furnished',
                color: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
                icon: '🏠',
              },
              {
                key: 'creative',
                show: isCreativeFinancing,
                label: 'Creative Financing',
                color: 'bg-amber-50 text-amber-700 ring-amber-200',
                icon: '💡',
              },
              {
                key: 'lowrate',
                show: !isNaN(interestRate) && interestRate > 0 && interestRate < 5,
                label: 'Low Interest Rate',
                color: 'bg-sky-50 text-sky-700 ring-sky-200',
                icon: '📉',
              },
              {
                key: 'lowentry',
                show: downPaymentPercent !== null && downPaymentPercent < 10,
                label: 'Low Entry Fee',
                color: 'bg-teal-50 text-teal-700 ring-teal-200',
                icon: '🔑',
              },
              {
                key: 'discounted',
                show: (deal.discountPrice) ? true : false,
                label: 'Discounted Price',
                color: 'bg-rose-50 text-rose-700 ring-rose-200',
                icon: '🏷️',
              },
            ].filter((t) => t.show);

            if (tags.length === 0) return null;

            return (
              <div className="mt-6 pt-6 border-t border-slate-200 w-full">

                <div className="flex flex-wrap md:gap-4 gap-2 items-center">
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <span className="text-sky-600">🏷️</span>
                    <h2 className="text-[16px] font-bold uppercase tracking-wide text-sky-700">Tags</h2>
                  </div>
                  {tags.map((tag) => (
                    <span
                      key={tag.key}
                      className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold ring-1 ${tag.color}`}
                    >
                      <span>{tag.icon}</span>
                      {tag.label}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}




          <div className="mt-8 grid gap-8 lg:grid-cols-[1.02fr_0.98fr]">
            <div>
              <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-slate-500">

                {hasValue(deal.propertyId || deal.id) && (
                  <span className="rounded-full bg-sky-50 px-4 py-2 font-semibold text-sky-700">
                    ID:{' '}
                    {(() => {
                      const streetNum = deal.streetAddress?.trim().split(' ')[0].replace(/\D/g, '') || '';
                      const postal = deal.postalCode?.trim() || '';

                      if (!streetNum && !postal) return '—';
                      if (!streetNum) return postal;
                      if (!postal) return streetNum;

                      return `${streetNum}-${postal}`;
                    })()}
                  </span>
                )}



                {(deal.publishedAt || deal.submittedAt) && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb',
                    borderRadius: 99, padding: '4px 12px', fontSize: 12,
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                    Published: {new Date(deal.publishedAt || deal.submittedAt).toLocaleDateString('en-GB')}
                  </span>
                )}
              </div>

              <h1 className="text-1xl font-bold leading-tight text-gray-900 md:text-2xl">
                {titleLine}
              </h1>

              {canViewAddress &&
                hasAnyValue(deal.streetAddress, deal.city, deal.stateRegion, deal.postalCode) && (
                  <div className="mt-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-3 text-slate-500">
                      {/* Location pin icon + address */}
                      <span className="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin w-4 h-4"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        <span>
                          {[deal.city, deal.stateRegion].filter(Boolean).join(', ') ||
                            [deal.streetAddress, deal.city, deal.stateRegion, deal.postalCode]
                              .filter(Boolean)
                              .join(', ')}
                        </span>
                      </span>

                      <button
                        onClick={handleAddressClick}
                        className="text-sm font-medium text-sky-700 underline underline-offset-4"
                      >
                        {mapCoords ? 'Hide map' : 'View map'}
                      </button>
                    </div>

                    {/* Map below address */}
                    {mapLoading && (
                      <p className="text-xs text-gray-400">Loading map…</p>
                    )}
                    {mapError && (
                      <p className="text-xs text-red-500">{mapError}</p>
                    )}
                    {mapCoords && (
                      <div className="rounded-lg overflow-hidden border border-gray-200">
                        <OSMMap coords={mapCoords} />
                      </div>
                    )}
                  </div>
                )}





              <div className="mt-2 text-1xl font-bold text-sky-700 md:text-2xl">
                ${formatPrice(deal.price)}
              </div>

              {hasValue(deal.discountedPrice) && deal.discountedPrice !== deal.price && (
                <p className="mt-2 text-sm text-slate-400 line-through">${formatPrice(deal.discountedPrice)}</p>
              )}

              <SoftCard className="mt-6 p-6 bg-white rounded-xl border border-gray-100 rooms-col">
                <div className="grid gap-6 grid-cols-2 lg:grid-cols-5 fontcolor_light">
                  <StatItem label="Type" value={PROPERTY_TYPE_LABELS[deal.category] || humanizeEnum(deal.category)} />
                  <StatItem label="Bedrooms" value={deal.bedrooms || '—'} />
                  <StatItem label="Bathrooms" value={deal.bathrooms || '—'} />
                  <StatItem
                    label="Sqft"
                    value={hasValue(deal.squareFootage) ? Number(deal.squareFootage).toLocaleString('en-US') : '—'}
                  />
                  <StatItem label="Year Built" value={deal.yearBuilt || '—'} />
                </div>
              </SoftCard>

              <p className="mt-4 text-sm text-slate-500">
                Published by: <span className="font-semibold text-slate-700">{submittedName}</span> {submittedRole}
              </p>

            </div>

            <div className="space-y-5">
              <div>
                <SectionHeading title="Financing & STR Details" icon="🏛" />
                <SoftCard className="mt-2">
                  <div className="p-5 border border-gray-100 grid gap-6 grid-cols-2 lg:grid-cols-3 bg-white rounded-xl str-main">
                    <StatItem label="Financing Type" value={humanizeEnum(deal.financingType)} />
                    <StatItem
                      label="Interest Rate"
                      value={
                        hasAnyValue(deal.subjInterestRate, deal.sellerInterestRate)
                          ? `${deal.subjInterestRate || deal.sellerInterestRate}%`
                          : '—'
                      }
                    />

                    {(() => {
                      const interestRate = parseFloat(deal.subjInterestRate || deal.sellerInterestRate);
                      const downPayment = parseFloat(deal.downPayment);
                      const price = parseFloat(deal.price);
                      const downPaymentPercent = price > 0 ? (downPayment / price) * 100 : null;

                      const isPremium =
                        isTurnkeyDeal(deal) &&
                        deal.fiftyFiftyPartner === true &&
                        (!isNaN(interestRate) && interestRate > 0 && interestRate < 5) &&
                        (downPaymentPercent !== null && downPaymentPercent < 10);

                      //return <StatItem label="Premium Property" value={isPremium ? 'Yes' : 'No'} />;
                    })()}
                    <StatItem label="50/50 Property" value={deal.fiftyFiftyPartner ? 'Yes' : 'No'} />
                    <StatItem label="Entry / Down" value={fmt$(deal.downPayment)} />
                    <StatItem
                      label="Monthly Payment"
                      value={hasValue(deal.totalMonthlyPayment) ? `${fmt$(deal.totalMonthlyPayment)}/mo` : '—'}
                    />

                    <StatItem
                      label="HOA"
                      value={
                        deal.isHOA ? (hasValue(deal.hoaMonthlyFee) ? `${fmt$(deal.hoaMonthlyFee)}/mo` : 'Yes') : 'No'
                      }
                    />
                  </div>
                </SoftCard>
              </div>

              <SoftCard className="p-4 border border-border-subtle bg-white rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-100 text-xl text-sky-700">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#0369a1"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="w-5 h-5"
                    >
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-700">Contact</p>
                    {canViewAddress ? (
                      <p className="text-[15px] font-semibold text-slate-800">
                        {deal.contactName || submittedName}
                        {submittedPhone ? ` · ${submittedPhone}` : ''}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-700">
                        Contact information not available
                      </p>
                    )}
                  </div>
                </div>
              </SoftCard>
            </div>
          </div>

          {hasValue(deal.description) && (
            <section className="mt-12 border-t border-slate-200 description-box bg-white rounded-xl border border-gray-100">
              <SectionHeading title="Description" icon="✦" />
              <p className="text-sm text-gray-600">{deal.description}</p>
            </section>
          )}




          {(hasAnyValue(
            deal.underwritingMarketType,
            deal.underwritingMarketSize,
            deal.strZoning,
            deal.strConfidence,
            deal.occupancyRate,
            deal.averageNightlyRate
          ) ||
            compRows.length > 0) && (
              <section className="mt-10 border-t border-slate-200 pt-10">
                <SectionHeading title="Market Research" icon="↗" />
                <SoftCard className="">
                  <div className="grid gap-4 grid-cols-2 xl:grid-cols-4 p-4 border border-gray-100 bg-amber-50 rounded-xl">
                    <SoftCard className="">
                      <StatItem label="Market Type" value={humanizeEnum(deal.underwritingMarketType)} />
                    </SoftCard>
                    <SoftCard className="">
                      <StatItem label="Market Size" value={humanizeEnum(deal.underwritingMarketSize)} />
                    </SoftCard>
                    <SoftCard className="">
                      <StatItem label="STR Zoning" value={deal.strZoning || '—'} />
                    </SoftCard>
                    <SoftCard className="">
                      <StatItem label="STR Confidence" value={humanizeEnum(deal.strConfidence)} />
                    </SoftCard>
                  </div>



                  {compRows.length > 0 && (
                    <div className="mt-6">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Top Comparable Properties
                      </p>
                      <div className="space-y-3">
                        {compRows.slice(0, 2).map((row, index) => (
                          <div
                            key={index}
                            className="flex flex-col gap-2 rounded-2xl bg-white px-4 py-4 md:flex-row md:items-center md:justify-between"
                          >
                            <div className="text-lg font-medium text-slate-800">{row.name}</div>
                            <div className="text-sm text-slate-500">
                              Revenue: <span className="font-semibold text-slate-800">{row.revenue}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}


                </SoftCard>
              </section>
            )}








          {tierRows.length > 0 && (
            <section className="mt-12 border-t border-slate-200 pt-10 table_sec description-box bg-white rounded-xl border border-gray-100">
              <SectionHeading title="Nightly Rate & Revenue Tiers" icon="📊" />
              <DataTable
                columns={[
                  { key: 'tier', label: 'Tier' },
                  { key: 'occupancy', label: 'Occupancy Rate (%)', align: 'right', valueClassName: 'text-right font-semibold text-slate-800' },
                  { key: 'rate', label: 'Avg Nightly Rate', align: 'right', valueClassName: 'text-right font-semibold text-slate-800' },
                  { key: 'revenue', label: 'Est. Gross Revenue', align: 'right', valueClassName: 'text-right font-semibold text-sky-700' },
                ]}
                rows={tierRows.map((row) => ({
                  tier: row.tier,
                  occupancy: hasValue(row.occupancy) ? `${row.occupancy}%` : '—',
                  rate: fmt$(row.rate),
                  revenue: fmt$(row.revenue),
                }))}
              />
            </section>
          )}

          {/* Top Properties (Comps) */}
          {hasAnyValue(
            deal.comp_1_link, deal.comp_2_link, deal.comp_3_link,
            deal.comp_4_link, deal.comp_5_link, deal.comp_6_link,
            deal.comp_7_link, deal.comp_8_link, deal.comp_9_link, deal.comp_10_link
          ) && (
              <section className="mt-12 border-t border-slate-200 pt-10 table_sec description-box bg-white rounded-xl border border-gray-100">
                <div className="mb-6 space-y-1 comps">
                  <div className="flex items-center gap-2 revenue-hed">
                    <span className="text-sky-600">🏆</span>
                    <h2 className="text-[18px] font-bold uppercase tracking-wide text-sky-700">Top Properties (Comps)</h2>
                  </div>
                  <p className="text-sm text-gray-600">
                    These properties represent top-performing listings in the area and are shown to illustrate{' '}
                    <span className="font-semibold">potential gross revenue</span>{' '}
                    if this property were positioned at the top of the market.
                  </p>
                  <p className="text-xs italic text-gray-400">
                    This does NOT suggest that this property in its current condition will achieve these results. These examples are for illustrative purposes only.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm mobile_width tier-table-detail">
                    <thead>
                      <tr className="border-b border-slate-200 text-left row-bg">
                        <th className="pb-3 text-xs font-bold uppercase tracking-[0.14em] text-gray-600">Property</th>

                        <th className="pb-3 text-xs font-bold uppercase tracking-[0.14em] text-gray-600 text-right">Occupancy</th>
                        <th className="pb-3 text-xs font-bold uppercase tracking-[0.14em] text-gray-600 text-right">Daily Rate</th>
                        <th className="pb-3 text-xs font-bold uppercase tracking-[0.14em] text-gray-600 text-right">Revenue</th>

                      </tr>
                    </thead>
                    <tbody className="">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                        const link = deal[`comp_${num}_link`];
                        const revenue = deal[`comp_${num}_grossRevenue`];
                        const title = deal[`comp_${num}_title`] || `Property ${num}`;
                        if (!link && !revenue) return null;
                        const href = link && !link.includes(' ') ? link : '#';
                        return (
                          <tr key={num} className="hover:bg-slate-50 transition-colors border-b border-slate-200 revenue-tier">
                            <td className="py-4 w-[190px] md:w-[400px]">
                              {link ? (
                                <a
                                  href={href}
                                  target={href !== '#' ? '_blank' : undefined}
                                  rel={href !== '#' ? 'noopener noreferrer' : undefined}
                                  className="uppercase font-medium text-sky-700 hover:underline underline-offset-4"
                                >
                                  {title}
                                </a>
                              ) : (
                                <span className="font-medium text-gray-800">{title}</span>
                              )}
                            </td>

                            <td className="py-4 text-right font-semibold text-gray-800">
                              {deal[`comp_${num}_occupancy`] ? `${deal[`comp_${num}_occupancy`]}%` : '—'}
                            </td>
                            <td className="py-4 text-right font-semibold text-gray-800">
                              {deal[`comp_${num}_dailyRate`] ? `$${formatPrice(deal[`comp_${num}_dailyRate`])}` : '—'}
                            </td>
                            <td className="py-4 text-right font-semibold text-gray-800">
                              {revenue ? `$${formatPrice(revenue)}` : '—'}
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}


          {/* ── Underwriting Images ───────────────────────────────────────── */}
          {/* ── Underwriting Images ───────────────────────────────────────── */}
          {Array.isArray(deal.underwritingImages) && deal.underwritingImages.length > 0 && (
            <section className="mt-10 border-t border-slate-200 pt-10 description-box bg-white rounded-xl border border-gray-100">
              <SectionHeading title="Underwriting Materials" icon="📋" />
              <p className="mb-4 text-sm text-slate-500">Supporting screenshots, analyses, and reference materials used during underwriting.</p>
              {(() => {
                const uwImages = deal.underwritingImages
                  .map((img) => (typeof img === 'string' ? img : img?.url || ''))
                  .filter(Boolean);
                const MAX_VISIBLE = 8;
                const visibleImages = uwImages.length > MAX_VISIBLE ? uwImages.slice(0, MAX_VISIBLE) : uwImages;
                const remaining = uwImages.length - MAX_VISIBLE;

                return (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 p-6 bg-white rounded-xl border border-gray-100">
                    {visibleImages.map((url, idx) => {
                      const isLast = idx === MAX_VISIBLE - 1 && remaining > 0;
                      return (
                        <button
                          key={`uw-${idx}`}
                          className="group relative overflow-hidden rounded-xl border border-gray-100"
                          onClick={() => setLightbox({ images: uwImages, index: idx })}
                        >
                          <img
                            src={url}
                            alt={`Underwriting ${idx + 1}`}
                            className="h-40 w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                          />
                          {isLast && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 transition duration-300 group-hover:bg-black/60">
                              <span className="text-2xl">🖼️</span>
                              <span className="text-sm font-semibold text-white">Show all photos</span>
                              <span className="text-xs text-white/80">+{remaining} more</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </section>
          )}


          <section className="mt-12 border-t border-slate-200 pt-10">
            <SectionHeading title="Scholarship House Signature Process" icon="🏢" />
            <SoftCard className="p-5 border border-gray-100 bg-white rounded-xl">

              {(() => {
                const anrValues = [
                  deal.anr_budget,
                  deal.anr_economy,
                  deal.anr_midscale,
                  deal.anr_upscale,
                  deal.anr_luxury,
                ]
                  .map((v) => parseFloat(v))
                  .filter((v) => !isNaN(v) && v > 0);

                const overallAvgANR =
                  anrValues.length > 0
                    ? anrValues.reduce((sum, v) => sum + v, 0) / anrValues.length
                    : 0;

                const baseANR = Math.round(parseInt(deal.averageNightRate || 0) || overallAvgANR || 0);
                const avgANR = editableANR !== null && editableANR !== '' ? Math.round(Number(editableANR)) : (editableANR === '' ? 0 : baseANR);

                const occupancy = editableOccupancy !== null && editableOccupancy !== ''
                  ? Math.round(Number(editableOccupancy))
                  : Math.round(parseFloat(deal.occupancyRate || 0)) || 0;

                const estimatedRevenue = Math.round(365 * ((occupancy || 0) / 100) * (avgANR || 0));

                return (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <SoftCard className="bg-amber-50 p-5 border border-gray-50 rounded-xl price_size">
                        <p className="mb-1 text-[11px] font-bold uppercase text-gray-700">Occupancy Rate</p>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={editableOccupancy !== null && editableOccupancy !== '' ? Math.round(Number(editableOccupancy)) : (editableOccupancy === '' ? '' : Math.round(parseFloat(deal.occupancyRate || 0)) || 0)}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') { setEditableOccupancy(''); return; }
                              const num = Math.round(parseFloat(val));
                              if (!isNaN(num) && num >= 0 && num <= 100) setEditableOccupancy(num);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === '.' || e.key === 'e' || e.key === 'E') e.preventDefault();
                            }}
                            onBlur={(e) => {
                              if (e.target.value === '') setEditableOccupancy(0);
                            }}
                            placeholder="0"
                            className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-[15px] font-bold text-gray-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />




                          <span className="text-[15px] font-bold text-gray-900">%</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">Max value is 100%</p>
                      </SoftCard>

                      <SoftCard className="p-5 bg-emerald-50 border border-gray-50 rounded-xl price_size">
                        <p className="mb-1 text-[11px] font-bold uppercase text-gray-700">Avg Nightly Rate</p>
                        <div className="flex items-center gap-1">
                          <span className="text-[15px] font-bold text-gray-900">$</span>
                          <input
                            type="number"
                            min="0"
                            max="5000"
                            step="1"
                            value={editableANR !== null && editableANR !== '' ? Math.round(Number(editableANR)) : (editableANR === '' ? '' : baseANR || 0)}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') { setEditableANR(''); return; }
                              const num = Math.round(parseFloat(val));
                              if (!isNaN(num) && num >= 0 && num <= 5000) setEditableANR(num);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === '.' || e.key === 'e' || e.key === 'E') e.preventDefault();
                            }}
                            onBlur={(e) => {
                              if (e.target.value === '') setEditableANR(0);
                            }}
                            placeholder="0"
                            className="w-40 rounded-lg border border-slate-300 px-2 py-1 text-[15px] font-bold text-gray-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                        </div>
                        {editableANR !== null && editableANR !== '' && Math.round(Number(editableANR)) >= 5000 ? (
                          <p className="mt-1 text-[11px] text-red-500 font-medium pl-4">Max value is $5,000</p>
                        ) : (
                          <p className="mt-1 text-[12px] text-slate-400 pl-4">Enter a value up to $5,000</p>
                        )}
                      </SoftCard>
                    </div>

                    {(() => {
                      const annualExpenses = Math.round(parseFloat(deal.expenseTotalAnnual || 0));
                      const hasExpenses = hasValue(deal.expenseTotalAnnual);
                      const netRevenue = estimatedRevenue - annualExpenses;
                      return (
                        <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50 overflow-hidden px-6 py-5 space-y-4 gross-revenue">
                          {/* Estimated Gross Revenue */}
                          <div className="flex items-start justify-between gap-4 gr-box">
                            <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-slate-400 shrink-0 pt-1">
                              Estimated Gross Revenue
                            </span>
                            <div className="text-right">
                              <p className="text-xl font-bold text-sky-700">
                                ${estimatedRevenue.toLocaleString('en-US')}
                              </p>
                              <p className="mt-0.5 text-[11px] italic text-slate-400">
                                365 x {occupancy || 0}% occupancy x ${Math.round(Number(avgANR || 0)).toLocaleString('en-US')}/night
                              </p>
                            </div>
                          </div>

                          {/* Net Revenue — only shown when expenseTotalAnnual exists */}
                          {hasExpenses && (
                            <>
                              <div className="flex items-center gap-3 annual-exp">
                                <div className="flex-1 border-t border-dashed border-sky-200" />
                                <span className="text-[12px] font-semibold uppercase tracking-widest text-slate-400 shrink-0 gr-text">
                                  minus ${annualExpenses.toLocaleString('en-US')} annual expenses
                                </span>
                                <div className="flex-1 border-t border-dashed border-sky-200" />
                              </div>

                              <div className="flex items-start justify-between gap-4 gr-box">
                                <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-emerald-500 shrink-0 pt-1">
                                  Net Revenue
                                </span>
                                <div className="text-right">
                                  <p className={`text-xl font-bold ${netRevenue < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                    {netRevenue < 0 ? '-' : ''}${Math.abs(netRevenue).toLocaleString('en-US')}
                                  </p>

                                  <p className="mt-0.5 text-[11px] italic text-slate-400">
                                    Gross Revenue - Total Annual Expenses
                                  </p>


                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}

                  </>
                );
              })()}
            </SoftCard>
          </section>
          <div className="mt-5 flex items-start gap-3 rounded-xl border-l-4 border-amber-400 bg-gradient-to-r from-amber-50 to-transparent px-4 py-3">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Disclaimer</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">
                These expenses are only estimates and it is your responsibility to do your own due diligence for more accurate numbers.
              </p>
            </div>
          </div>



          {(hasValue(deal.incomeReduction) || hasValue(pf.FEDERAL_TAX_PERCENTAGE)) && (
            <section className="mt-10 border-t border-slate-200 pt-10">
              <SectionHeading title="Tax Savings" icon="💲" />
              <SoftCard className="">
                {(() => {

                  const federalRate = taxSectionRate !== null ? taxSectionRate : pf.FEDERAL_TAX_PERCENTAGE;
                  const incomeReduction = parseFloat(deal.incomeReduction) || 0;
                  const estTaxSavings = (federalRate / 100) * incomeReduction;
                  return (
                    <div className="grid gap-4 md:grid-cols-3">
                      <SoftCard className="p-5 border border-gray-100 bg-white rounded-xl">
                        <p className="mb-1 text-[11px] font-bold uppercase text-gray-700">Federal Tax Rate</p>
                        <div className="flex items-center gap-1">

                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={taxSectionRate !== null && taxSectionRate !== '' ? taxSectionRate : (taxSectionRate === '' ? '' : pf.FEDERAL_TAX_PERCENTAGE)}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') {
                                setTaxSectionRate('');
                                return;
                              }
                              // Reject if decimal point present
                              if (val.includes('.')) return;
                              const num = parseInt(val, 10);
                              if (!isNaN(num) && num >= 0 && num <= 100) {
                                setTaxSectionRate(num);
                              }
                            }}
                            onKeyDown={(e) => {
                              // Block decimal point and 'e' (scientific notation)
                              if (e.key === '.' || e.key === 'e' || e.key === 'E') {
                                e.preventDefault();
                              }
                              const current = e.target.value;
                              if (e.key === '0' && current !== '' && current !== '0') {
                                const cursorAt = e.target.selectionStart;
                                if (cursorAt === 0) {
                                  e.preventDefault();
                                }
                              }
                            }}
                            onBlur={(e) => {
                              if (e.target.value === '') {
                                setTaxSectionRate('');
                              }
                            }}
                            placeholder="0"
                            className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-[15px] font-bold text-gray-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />



                          <span className="text-[15px] font-bold text-gray-900">%</span>
                        </div>
                      </SoftCard>
                      <SoftCard className="p-5 border border-gray-100 bg-amber-50 rounded-xl font_15">
                        <StatItem label="Est. Income Reduction" value={fmt$(incomeReduction)} />
                      </SoftCard>
                      <SoftCard className="bg-sky-50 p-5 border border-border-subtle rounded-xl font_15">
                        <StatItem
                          label="Est. Tax Savings"
                          value={estTaxSavings > 0 ? fmt$(estTaxSavings) : '$0'}
                          valueClassName="text-sky-700"
                        />
                      </SoftCard>
                    </div>
                  );
                })()}
              </SoftCard>
            </section>
          )}



          {deal.fiftyFiftyPartner && (
            <section className="mt-10 border-t border-slate-200 pt-10">
              <SectionHeading title="50/50 Joint Venture Pro Forma" icon="🛡" />
              <SoftCard className="">
                <SoftCard className="bg-sky-50 p-5 border border-border-subtle rounded-xl">
                  <div className="grid gap-2 gap-y-5 grid-cols-2 xl:grid-cols-6 text-left md:text-center">
                    {/* Purchase Price = INPUTS!B11 */}
                    <div className="text-size-19 rounded-lg py-3 px-3 bg-white md:flex md:justify-center md:items-center"> <StatItem label="Purchase Price" value={fmt$(pf.purchasePrice)} /></div>
                    {/* Out-of-Pocket = LLC Buy-In (INPUTS!B12) */}
                    <div className="text-size-19 rounded-lg py-3 px-3 bg-white md:flex md:justify-center md:items-center">  <StatItem label="Out-of-Pocket" value={fmt$(pf.llcBuyIn)} /></div>
                    {/* Initial Tax Savings = FederalTaxRate × BonusDepr (EXEC_SUMMARY!W19) */}
                    <div className="violet-text bg-accent rounded-lg py-3 px-3 md:flex md:justify-center md:items-center"><StatItem label="Initial Tax Savings" value={fmt$(activeTaxSavings)} /></div>
                    {/* Total Net Cash Inflow = 5-yr preferred distributions */}
                    <div className="violet-text bg-accent rounded-lg py-3 px-3 md:flex md:justify-center md:items-center"><StatItem label="Total Net Cash Inflow" value={fmt$(pf.totalDist || (deal.netCashInflow || deal.totalNetCashInflow))} /></div>
                    {/* Total Return & Benefit = OOP + ClientShare + Distributions + TaxSavings */}
                    <div className="violet-text bg-accent rounded-lg py-3 px-3 md:flex md:justify-center md:items-center"> <StatItem label="Total Return & Benefit" value={fmt$(activeTotalReturn)} /></div>
                    {/* Annualized Return = RATE(5, 0, −OOP, TotalReturn) */}
                    <div className="violet-text bg-accent rounded-lg py-3 px-3 md:flex md:justify-center md:items-center"> <StatItem label="Annualized Return" value={activeAnnualizedReturn} /></div>
                    {/* 1-Yr Cash-on-Cash = (Year1 Dist + TaxSavings) / OOP */}

                  </div>
                </SoftCard>

                <div className="mt-6 grid gap-6 xl:grid-cols-3">
                  <SoftCard className="border border-gray-100 bg-white rounded-xl">
                    <h3 className="p-5 mb-1 text-[17px] font-semibold text-white bg-accent table_head1 market-box">Cash-on-cash returns (Year 1, 3, 5)</h3>
                    <div className="space-y-2 p-2">
                      <DetailRow
                        label="1-Yr Cash-on-Cash"
                        value={activeCashOnCash1yr}
                      />


                      <DetailRow label="3-Yr Cash-on-Cash" value={activeCashOnCash3yr} />
                      <DetailRow
                        label="5-Yr Cash-on-Cash"
                        value={activeCashOnCash5yr}
                      />

                    </div>
                  </SoftCard>

                  <SoftCard className="border border-gray-100 bg-white rounded-xl">
                    <h3 className="p-5 mb-1 text-[17px] font-semibold text-white bg-accent table_head1 market-box">Client Out-of-Pocket Investment</h3>
                    <div className="space-y-2 p-2">
                      {/* LLC JV Buy-In = PurcPrice × 30 %  (INPUTS!B12) */}
                      <DetailRow label="LLC Joint Venture Buy-In" value={fmt$(pf.llcBuyIn)} />
                      {/* Fixed setup / furnish costs */}



                      <button
                        onClick={() => setShowIncludedModal(true)}
                        className="group flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-sky-50 my-1"
                        style={{ border: '1px dashed #bae6fd', background: 'transparent' }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-100 text-sm">📋</span>
                          <span className="text-sm font-semibold text-sky-700 group-hover:text-sky-800 group-hover:underline underline-offset-2">
                            What’s Included in the LLC Joint Venture Buy-In
                          </span>
                        </div>
                        <span className="flex-shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700 group-hover:bg-sky-200">
                          View All →
                        </span>
                      </button>

                      {/* Total OOP = LLC Buy-In + Design + Start-Up */}
                      <DetailRow label="Total Out-of-Pocket" value={fmt$(pf.totalOOP)} emphasized />
                    </div>
                  </SoftCard>

                  <SoftCard className="border border-gray-100 bg-white rounded-xl">
                    <h3 className="p-5 mb-1 text-[17px] font-semibold text-white bg-accent table_head1 market-box">Client Tax Snapshot (Year 1)</h3>
                    <div className="space-y-2 p-2">
                      {/* Bonus Depreciation = CostSeg % × PurcPrice  (INPUTS!B44) */}
                      <DetailRow label="Est. Bonus Depreciation" value={fmt$(pf.bonusDepr)} />
                      {/* Federal Tax Rate = 37 %  (INPUTS!B42) */}
                      <div className="flex items-center justify-between gap-4 rounded-2xl md:px-4 px-1 py-2">
                        <span className="text-sm text-gray-500">Federal Tax Rate</span>
                        <div className="flex items-center gap-1">

                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={jvSectionRate !== null && jvSectionRate !== '' ? jvSectionRate : (jvSectionRate === '' ? '' : pf.FEDERAL_TAX_RATE * 100)}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') {
                                setJvSectionRate('');
                                return;
                              }
                              if (val.includes('.')) return;
                              const num = parseInt(val, 10);
                              if (!isNaN(num) && num >= 0 && num <= 100) {
                                setJvSectionRate(num);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === '.' || e.key === 'e' || e.key === 'E') {
                                e.preventDefault();
                              }
                            }}
                            onBlur={(e) => {
                              if (e.target.value === '' || e.target.value === null) {
                                setJvSectionRate(0);
                              }
                            }}
                            placeholder="0"
                            className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-bold text-gray-800 text-center focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />



                          <span className="text-sm font-bold text-gray-800">%</span>
                        </div>
                      </div>
                      {/* Tax Savings = FederalTaxRate × BonusDepr  (EXEC_SUMMARY!W19) */}
                      <DetailRow label="Tax Savings (Bonus Depr.)" value={fmt$(activeTaxSavings)} />
                    </div>
                  </SoftCard>
                </div>

                {/* 5-Year Cash Flow + Sale Snapshot — 2 columns */}
                <div className="mt-6 grid gap-6 xl:grid-cols-2">
                  <SoftCard className="border border-gray-100 bg-white rounded-xl">
                    <h3 className="p-5 mb-1 text-[17px] font-semibold text-white bg-accent table_head1 market-box">Client 5-Year Cash Flow Summary</h3>
                    <div className="space-y-2 p-2">
                      {/* Annual distributions = LLC Buy-In × 8 % preferred rate  (INPUTS!B39) */}
                      {[1, 2, 3, 4, 5].map((yr) => (
                        <DetailRow key={yr} label={`Year ${yr}`} value={fmt$(pf.annualDist)} />
                      ))}
                      {/* Totals = annualDist × 5 */}
                      <DetailRow label="Totals" value={fmt$(pf.totalDist)} emphasized />
                    </div>
                  </SoftCard>

                  <SoftCard className="border border-gray-100 bg-white rounded-xl">
                    <h3 className="p-5 mb-1 text-[17px] font-semibold text-white bg-accent table_head1 market-box">Sale Snapshot at Exit Year</h3>
                    <div className="space-y-2 p-2">
                      {/* Purchase Price = INPUTS!B11 */}
                      <DetailRow label="Purchase Price" value={fmt$(pf.purchasePrice)} />
                      {/* Est. Sale Price = FV(7 %, 5 yrs, PurcPrice)  (EXEC_SUMMARY!S24) */}
                      <DetailRow label="Est. Sale Price (7% annual)" value={fmt$(pf.estSalePrice)} />
                      {/* Accelerated Appreciation Gain = EstSalePrice − PurcPrice */}
                      <DetailRow label="Accelerated Appr. Gain" value={fmt$(pf.apprGain)} />
                      {/* Return of Investment = LLC Buy-In */}
                      <DetailRow label="Return of Investment" value={fmt$(pf.totalOOP)} />
                      {/* Net Sale Proceeds 50/50 = (Gain − OOP) × 50 % */}
                      <DetailRow label="Net Sale Proceeds (To Be Split 50/50)" value={fmt$(pf.clientShare)} />
                    </div>
                  </SoftCard>
                </div>

                {/* Client Total Return / Benefit — full width below */}
                <div className="mt-6">
                  <SoftCard className="total_return p-5 border border-gray-100 bg-white rounded-xl">
                    <h3 className="mb-4 text-[15px] font-semibold text-slate-800">Client Total Return / Benefit</h3>
                    <div className="grid gap-2 gap-y-5 md:gap-y-0 grid-cols-2 xl:grid-cols-5 total_return_outer">
                      {/* Initial OOP = LLC Buy-In */}
                      <DetailRow label="Initial Out-of-Pocket" value={fmt$(pf.totalOOP)} />
                      {/* Share of Net Sale Proceeds = clientShare */}
                      <DetailRow label="Share of Net Sale Proceeds" value={fmt$(pf.netSales)} />
                      {/* 5-Year Distributions */}
                      <DetailRow label="5-Year Distributions" value={fmt$(pf.totalDist)} />
                      {/* Est. Tax Savings */}
                      <DetailRow label="Estimated Tax Savings" value={fmt$(activeTaxSavings)} />
                      {/* Total = OOP + ClientShare + Distributions + TaxSavings */}
                      <DetailRow label="Total Est. Return/Benefit" value={fmt$(Math.round(activeTotalReturn))} emphasized />
                    </div>
                  </SoftCard>
                </div>



                {/* Notes Section */}
                <div className=" border-t border-slate-200 mt-6 bg-slate-50  py-5">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">Notes</p>
                  <ol className="space-y-1.5 text-[12px] text-gray-500 list-none">
                    <li>(1) Does not include the mortgage paydown (that's a bonus benefit not calculated).</li>
                    <li>(2) Annual operating cash flow and sale profit pool are split per the Revenue Share agreement and rate.</li>
                    <li>(3) Annualized Return = compound annual growth rate over the length of the project.</li>
                    <li>(4) Cash-On-Cash: How much cash income the investment produces over a given period. Year 1 includes the tax savings cash inflow from Bonus Depreciation.</li>
                    <li>(5) Based on the estimated accelerated appreciation gain from selling as a business.</li>
                  </ol>
                </div>


              </SoftCard>
            </section>
          )}



          {/* ── Estimated Expenses ─────────────────────────────────── */}


          {(() => {
            const oneTimeFields = [
              { label: 'Entry or Down Payment', value: deal.expenseEntryDownPayment },
              { label: 'Closing Costs', value: deal.expenseClosingCosts },
              { label: 'Design/Furnishing/Setup/Renovations', value: deal.expenseDesignFurnishing },
            ];
            const annualFields = [
              { label: 'Principal and Interest', value: deal.expensePrincipalInterest },
              { label: 'Property Taxes', value: deal.expensePropertyTaxes },
              { label: 'Insurance', value: deal.expenseInsurance },
              { label: 'Management', value: deal.expenseManagement },
              { label: 'OTA Fees — Airbnb, VRBO, etc.', value: deal.expenseOTAFees },
              { label: 'Cleaning', value: deal.expenseCleaning },
              { label: 'Maintenance and Repairs', value: deal.expenseMaintenanceRepairs },
              { label: 'Utilities', value: deal.expenseUtilities },
              { label: 'HOA Fees', value: deal.expenseHOAFees },
              { label: 'Sales Tax', value: deal.expenseSalesTax },
              { label: 'Advertising', value: deal.expenseAdvertising },
              { label: 'Misc Expense', value: deal.expenseMisc },
            ];
            const hasOneTime = oneTimeFields.some((f) => hasValue(f.value)) || hasValue(deal.expenseTotalOneTime);
            const hasAnnual = annualFields.some((f) => hasValue(f.value)) || hasValue(deal.expenseTotalAnnual);
            if (!hasOneTime && !hasAnnual) return null;
            return (
              <section className="mt-8 border-t border-slate-200 pt-10">
                <SectionHeading title="Estimated Expenses" icon="$" />
                <SoftCard className="p-6 bg-white rounded-xl border border-gray-100 one_time_fees">
                  {hasOneTime && (
                    <>
                      <p className="mb-3 pb-4 text-[14px] font-semibold text-slate-800 uppercase border-b border-gray-300">One-Time Fees</p>
                      <div className="space-y-1 mb-4">
                        {oneTimeFields.filter((f) => hasValue(f.value)).map((f) => (
                          <DetailRow key={f.label} label={f.label} value={fmt$(f.value)} />
                        ))}
                        {hasValue(deal.expenseTotalOneTime) && (
                          <DetailRow label="Total One-Time" value={fmt$(deal.expenseTotalOneTime)} emphasized />
                        )}
                      </div>
                    </>
                  )}
                  {hasAnnual && (
                    <>
                      <p className="mb-3 pb-4 pt-4 text-[14px] font-semibold text-slate-800 uppercase border-b border-gray-300">Annual Fees and Expenses</p>
                      <div className="space-y-1">
                        {annualFields.filter((f) => hasValue(f.value)).map((f) => (
                          <DetailRow key={f.label} label={f.label} value={fmt$(f.value)} />
                        ))}
                        {hasValue(deal.expenseTotalAnnual) && (
                          <DetailRow label="Total Annual Expenses" value={fmt$(deal.expenseTotalAnnual)} emphasized />
                        )}
                      </div>
                    </>
                  )}
                </SoftCard>
              </section>
            );
          })()}



          {(hasMarketRevenue || hasMarketOccupancy || marketRows.length > 0) && (
            <section className="mt-10 border-t border-slate-200 pt-10">
              <SectionHeading title="Market Revenue & Occupancy" icon="📈" />
              <DataTable
                columns={[
                  { key: 'period', label: 'Period' },
                  {
                    key: 'revenue',
                    label: 'Market Revenue',
                    align: 'right',
                    valueClassName: 'text-right font-semibold text-sky-700',
                  },
                  {
                    key: 'occupancy',
                    label: 'Market Occupancy',
                    align: 'right',
                    valueClassName: 'text-right font-semibold text-slate-800',
                  },
                ]}
                rows={marketRows}
              />
            </section>
          )}

          {compRows.length > 0 && (
            <section className="mt-12 border-t border-slate-200 pt-10">
              <SectionHeading title="Underwriting Comps" icon="🧾" />
              <DataTable
                columns={[
                  { key: 'name', label: 'Property' },
                  {
                    key: 'revenue',
                    label: 'Gross Revenue',
                    align: 'right',
                    valueClassName: 'text-right font-semibold text-sky-700',
                  },
                ]}
                rows={compRows}
              />
            </section>
          )}

          {(hasValue(deal.guestDemandInsights) ||
            hasValue(deal.valueAddOpportunities) ||
            hasValue(deal.localAttractions) ||
            hasValue(deal.amenities) ||
            hasValue(deal.localContacts) ||
            (Array.isArray(deal.travelMotivations) && deal.travelMotivations.length > 0) ||
            (Array.isArray(deal.vacationRentalMarkets) && deal.vacationRentalMarkets.length > 0)) && (
              <section className="mt-10 border-t border-slate-200 pt-10">
                <SectionHeading title="Market Context & Demand" icon="🌎" />
                <div className="grid gap-5 lg:grid-cols-2">
                  {Array.isArray(deal.travelMotivations) && deal.travelMotivations.length > 0 && (
                    <SoftCard className="border border-gray-100 bg-white rounded-xl">
                      <h3 className="p-5 mb-1 text-[17px] font-semibold text-white bg-accent table_head1 uppercase market-box">Why People Travel Here</h3>
                      <div className="flex flex-wrap gap-2 p-5">
                        {deal.travelMotivations.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-white px-3 py-2 text-sm text-slate-600 ring-1 ring-slate-200"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </SoftCard>
                  )}

                  {Array.isArray(deal.vacationRentalMarkets) && deal.vacationRentalMarkets.length > 0 && (
                    <SoftCard className="border border-gray-100 bg-white rounded-xl">
                      <h3 className="p-5 mb-1 text-[17px] font-semibold text-white bg-accent table_head1 uppercase market-box">Vacation Rental Markets</h3>
                      <div className="flex flex-wrap gap-2 p-5">
                        {deal.vacationRentalMarkets.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-white px-3 py-2 text-sm text-gray-600 ring-1 ring-slate-200"
                          >
                            {VACATION_RENTAL_MARKET_LABELS[tag] || humanizeEnum(tag)}
                          </span>
                        ))}
                      </div>
                    </SoftCard>
                  )}

                  {hasValue(deal.guestDemandInsights) && (
                    <SoftCard className="border border-gray-100 bg-white rounded-xl">
                      <h3 className="p-5 mb-1 text-[17px] font-semibold text-white bg-accent table_head1 uppercase market-box">Guest Demand Insights</h3>
                      <p className="whitespace-pre-wrap text-gray-600 p-5">{deal.guestDemandInsights}</p>
                    </SoftCard>
                  )}

                  {hasValue(deal.valueAddOpportunities) && (
                    <SoftCard className="border border-gray-100 bg-white rounded-xl">
                      <h3 className="p-5 mb-1 text-[17px] font-semibold text-white bg-accent table_head1 uppercase">Value-Add Opportunities</h3>
                      <p className="whitespace-pre-wrap text-gray-600 p-5">{deal.valueAddOpportunities}</p>
                    </SoftCard>
                  )}

                  {hasValue(deal.localAttractions) && (
                    <SoftCard className="border border-gray-100 bg-white rounded-xl">
                      <h3 className="p-5 mb-1 text-[17px] font-semibold text-white bg-accent table_head1 uppercase uppercase market-box">Local Attractions</h3>
                      <p className="whitespace-pre-wrap text-gray-600 p-5">{deal.localAttractions}</p>
                    </SoftCard>
                  )}

                  {hasValue(deal.amenities) && (
                    <SoftCard className="border border-gray-100 bg-white rounded-xl">
                      <h3 className="p-5 mb-1 text-[17px] font-semibold text-white bg-accent table_head1 uppercase uppercase">Amenities</h3>
                      <p className="whitespace-pre-wrap text-gray-600 p-5">{deal.amenities}</p>
                    </SoftCard>
                  )}


                </div>
              </section>
            )}




          {hasValue(deal.additionalInfo) && (
            <section className="mt-10 border-t border-slate-200 pt-10">
              <SectionHeading title="Additional Info" icon="ℹ" />
              <SoftCard className="">
                <p className="whitespace-pre-wrap text-gray-600">{deal.additionalInfo}</p>
              </SoftCard>
            </section>
          )}
        </div>
      </div>
    </div>
  );


};



const DealDetailPage = () => {
  const { dealId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthSafe();

  const loginUserRole = user?.role;


  const canViewAddress = user?.role === 'admin' || user?.role === 'team_member';

  const { data: deal, isLoading, isError } = useQuery({
    queryKey: ['deal', dealId],
    queryFn: () => dealsAPI.getDealById(dealId),
    enabled: !!dealId,
  });
  
   if(user?.userType == 'submitter'){
    console.log('user email : ', user?.email);
    console.log('property email : ',deal?.submitterEmail)
      if(user?.email != deal?.submitterEmail){
         navigate('/my-properties');
         return;
      }
  }

  const ALLOWED_STATUSES = ['published', 'sold', 'pending'];
  const isPrivileged = loginUserRole === 'admin' || loginUserRole === 'team_member';
  const propertyVisible = isPrivileged || ALLOWED_STATUSES.includes(deal?.status);


  if (isLoading) return <Loader />;

  if (isError || !deal || !propertyVisible) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg text-slate-500">Deal not found.</p>
        <button
          onClick={() => navigate(location.state?.from || '/deals')}
          className="mt-4 text-sm text-sky-700 underline underline-offset-4"
        >
          Back to Properties
        </button>
      </div>
    );
  }

  const handleBack = () => {
    window.scrollTo(0, 0);
    if (location.state?.from === 'admin-properties') navigate('/admin/properties');
    else if (location.state?.from === '/favorite-properties') navigate('/favorite-properties');
    else if (location.state?.from === '/admin/properties') navigate('/admin/properties');
	else if (location.state?.from === '/my-properties') navigate('/my-properties');
    else navigate('/deals');
  };

  const backLabel =
    location.state?.from === 'admin-properties'
      ? 'Back to Property Management'
      : location.state?.from === '/favorite-properties'
        ? 'Back to Favorite Properties'
        : location.state?.from === '/admin/properties'
          ? 'Back to Properties'
           : location.state?.from === '/my-properties'
            ? 'Back to My Properties'
            : 'Back to Deals';


  return <DealDetailView deal={deal} onBack={handleBack} backLabel={backLabel} canViewAddress={canViewAddress} />;
};


export { DealDetailView };
export default DealDetailPage;