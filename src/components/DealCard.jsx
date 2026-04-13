/**
 * DealCard.jsx — Shared listing card used by CustomerView and FavoriteProperty.
 *
 * Props:
 *   deal                 – deal object from API
 *   onClick              – called when "View Details" is clicked
 *   favorites            – array of favorited property IDs
 *   addFavoriteMutation  – react-query mutation to add a favorite
 *   removeFavoriteMutation – react-query mutation to remove a favorite
 *   canViewAddress       – boolean; show street address for admin/team only
 *   showFilterSidebar    – boolean; affects card CSS class (CustomerView only)
 */

import { useState } from 'react';
import ImageCarousel from '../components/ImageCarousel';
import Button from '../components/Button';

// ─── Pure helpers (no external deps) ─────────────────────────────────────────

export const formatPrice = (price) =>
  parseInt(parseFloat(price)).toLocaleString('en-US');

export const hasValue = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'number') return !Number.isNaN(v) && v !== 0;
  return true;
};

export const normalizeTurnkey = (value) =>
  value?.toString().toUpperCase().replace(/-/g, '_');

export const isTurnkeyDeal = (deal) =>
  ['TURNKEY_OPERATING', 'FURNISHED_NOT_OPERATING'].includes(
    normalizeTurnkey(deal?.turnkeyFurnished)
  );

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
    .filter((img) => typeof img === 'string' && img.trim().length > 0);

export const PROPERTY_TYPES = [
  { value: 'SINGLE_FAMILY', label: 'Single Family Home' },
  { value: 'CONDO', label: 'Condo' },
  { value: 'TOWNHOUSE', label: 'Town House' },
  { value: 'TWO_TO_FOUR_UNIT', label: '2–4 Unit Home' },
  { value: 'UNIQUE_PROPERTY', label: 'Unique Property (Treehouses, Castles, Yurts, Etc.)' },
];

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
];

export const FINANCING_OPTIONS = [
  { value: 'traditional', label: 'Traditional Financing' },
  { value: 'subject-to', label: 'Creative Financing (Subject-to)' },
  { value: 'hybrid', label: 'Creative Financing (Hybrid)' },
  { value: 'seller', label: 'Creative Financing (Seller Financing)' },
  { value: 'cash', label: 'Cash Only' },
];

const getPropertyTypeLabel = (value) => {
  if (!value) return '';
  const match = PROPERTY_TYPES.find((t) => t.value === value);
  return match ? match.label : value;
};

const shortFinancingLabel = (type) => {
  const map = {
    traditional: 'Conventional',
    'subject-to': 'Subject-to',
    hybrid: 'Hybrid',
    seller: 'Seller Finance',
    cash: 'Cash Only',
  };
  return map[type] || (type ? type.charAt(0).toUpperCase() + type.slice(1) : '—');
};

const fmt$ = (val) => {
  const n = parseFloat(val);
  if (!n || Number.isNaN(n)) return '—';
  return `$${parseInt(n).toLocaleString('en-US')}`;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const MetricPill = ({ label, value, highlight = false }) => (
  <div className="flex flex-col bg-gray-50 border border-border-subtle rounded-lg px-3 py-2 min-w-0">
    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-900 mb-0.5 whitespace-nowrap">
      {label}
    </span>
    <span className={`text-[14px] font-semibold whitespace-nowrap ${highlight ? 'text-blue-600' : 'text-gray-900'}`}>
      {value}
    </span>
  </div>
);

// ─── DealCard ─────────────────────────────────────────────────────────────────

const DealCard = ({
  deal,
  onClick,
  favorites,
  addFavoriteMutation,
  removeFavoriteMutation,
  canViewAddress = false,
  showFilterSidebar = true,
}) => {
  const isFavorited = favorites.includes(deal.id);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyLink = (e) => {
    e.stopPropagation();
    const publicUrl = `${window.location.origin}/property/${deal.id}`;
    navigator.clipboard.writeText(publicUrl).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const toggleFavorite = (e) => {
    e.stopPropagation();
    if (isFavorited) removeFavoriteMutation.mutate(deal.id);
    else addFavoriteMutation.mutate(deal.id);
  };

  const tierRows = [
    { tier: 'Budget',   occupancy: deal.occupancyRate_budget,   rate: deal.anr_budget,   revenue: deal.egr_budget },
    { tier: 'Economy',  occupancy: deal.occupancyRate_economy,  rate: deal.anr_economy,  revenue: deal.egr_economy },
    { tier: 'Midscale', occupancy: deal.occupancyRate_midscale, rate: deal.anr_midscale, revenue: deal.egr_midscale },
    { tier: 'Upscale',  occupancy: deal.occupancyRate_upscale,  rate: deal.anr_upscale,  revenue: deal.egr_upscale },
    { tier: 'Luxury',   occupancy: deal.occupancyRate_luxury,   rate: deal.anr_luxury,   revenue: deal.egr_luxury },
  ].filter((row) => hasValue(row.rate) || hasValue(row.revenue));

  const incomeReduction = hasValue(deal.incomeReduction) ? deal.incomeReduction : null;
  const taxSavings      = hasValue(deal.taxSavings)      ? deal.taxSavings      : null;

  // Derived tag flags
  const interestRate        = parseFloat(deal.subjInterestRate || deal.sellerInterestRate);
  const downPayment         = parseFloat(deal.downPayment);
  const price               = parseFloat(deal.price);
  const downPaymentPercent  = price > 0 ? (downPayment / price) * 100 : null;
  const normalizedFinancing = (deal.financingType || '').toUpperCase().replace(/[\s_-]+/g, '');
  const isCreativeFinancing =
    normalizedFinancing === 'SELLER' ||
    normalizedFinancing === 'SUBJECTTO' ||
    normalizedFinancing === 'HYBRID';

  const tags = [
    { key: 'jv',         show: deal.fiftyFiftyPartner === true,                                          label: '50/50 Joint Venture',    color: 'bg-violet-50 text-violet-700 ring-violet-200', icon: '🤝' },
    { key: 'turnkey',    show: isTurnkeyDeal(deal),                                                      label: 'Turnkey Fully Furnished', color: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: '🏠' },
    { key: 'creative',   show: isCreativeFinancing,                                                      label: 'Creative Financing',      color: 'bg-amber-50 text-amber-700 ring-amber-200', icon: '💡' },
    { key: 'lowrate',    show: !isNaN(interestRate) && interestRate > 0 && interestRate < 5,             label: 'Low Interest Rate',       color: 'bg-sky-50 text-sky-700 ring-sky-200', icon: '📉' },
    { key: 'lowentry',   show: downPaymentPercent !== null && downPaymentPercent < 10,                   label: 'Low Entry Fee',           color: 'bg-teal-50 text-teal-700 ring-teal-200', icon: '🔑' },
    { key: 'discounted', show: deal.discountPrice === true,                                              label: 'Discounted Price',        color: 'bg-rose-50 text-rose-700 ring-rose-200', icon: '🏷️' },
  ].filter((t) => t.show);

  return (
    <div
      className={`group bg-surface border border-border-subtle rounded-2xl overflow-hidden shadow-sm transition hover:shadow-lg hover:-translate-y-1 h-full flex flex-col${!showFilterSidebar ? ' scroll_filter' : ''}`}
    >
      {/* ── Image ── */}
      <div className="relative h-48 bg-app flex-shrink-0">
        {/* Badges top-left (placeholder — add badge content here if needed) */}
        <div className="absolute top-2 left-2 flex flex-col gap-1.5 z-20" />
   
        {/* SOLD badge — top-right, shown only when deal status is SOLD */}
        {deal.status?.toUpperCase() === 'SOLD' && (
          <>
            {/* Dim overlay */}
            <div className="absolute inset-0 z-10  rounded-t-2xl pointer-events-none"  />
            {/* Badge */}
            <div className="absolute top-3 left-3 z-30 flex items-center gap-1 bg-red-600 text-white text-[11px] font-extrabold uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg ring-2 ring-white" >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Sold
            </div>
          </>
        )}
   
   
        {/* Favorite button */}
        <button
          onClick={toggleFavorite}
          className="absolute top-2 right-2 z-20 bg-surface border border-border-subtle rounded-full p-2 shadow hover:scale-105 transition"
          title={isFavorited ? 'Unfavorite' : 'Favorite'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill={isFavorited ? '#F59E0B' : 'none'}
            stroke="#F59E0B"
            strokeWidth={2}
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 2.5l2.938 5.95 6.562.955-4.75 4.63 1.12 6.53L12 17.77l-5.87 3.09 1.12-6.53-4.75-4.63 6.562-.955L12 2.5z"
            />
          </svg>
        </button>

        <ImageCarousel
          images={
            Array.isArray(deal.exteriorImages) && deal.exteriorImages.length > 0
              ? deal.exteriorImages
              : getDealImages(deal)
          }
          alt={deal.title}
          className="w-full h-full"
          counterOnHover={null}
          bottomLabel={getPropertyTypeLabel(deal.category) || null}
        />
      </div>

      {/* ── Body ── */}
      <div className="p-4 flex flex-col flex-1 gap-3">

        {/* Title */}
        <h3 className="flex gap-1.5 font-semibold text-primary text-sm leading-snug md:min-h-[2.5rem] svg_width items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-3.5 h-3.5 shrink-0 mt-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 01-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0116 0" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {deal.yearBuilt} {deal.title}
        </h3>

        {/* Price */}
        <p className="text-2xl font-bold text-primary leading-none">
          ${formatPrice(deal.price)}
        </p>

        {/* Property ID */}
        <p className="text-xs text-text-secondary">
          <span className="font-bold">Property ID:</span>{' '}
          {(() => {
            const streetNum = deal.streetAddress?.trim().split(' ')[0].replace(/\D/g, '') || '';
            const postal = deal.postalCode?.trim() || '';
            if (!streetNum && !postal) return '—';
            if (!streetNum) return postal;
            if (!postal) return streetNum;
            return `${streetNum}-${postal}`;
          })()}
        </p>

        <hr className="border-gray-100" />
		
		    {/* Tags */}
        {tags.length > 0 && (
          <div className="tag_outer flex flex-wrap gap-2 items-center mt-2">
            <div className="inline-flex items-center gap-1">
              <span className="text-sky-600">🏷️</span>
              <h2 className="text-[13px] font-bold uppercase tracking-wide text-sky-700">Tags</h2>
            </div>
            {tags.map((tag) => (
              <span
                key={tag.key}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ${tag.color}`}
              >
                <span>{tag.icon}</span>
                {tag.label}
              </span>
            ))}
          </div>
        )}
		  <hr className="border-gray-100" />
		

        {/* Interest Rate / Down / PITI */}
        <div className="flex justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50 p-3 interest_rate">
          <MetricPill
            label="Interest Rate"
            value={
              hasValue(deal.subjInterestRate)
                ? `${deal.subjInterestRate}%`
                : hasValue(deal.sellerInterestRate)
                ? `${deal.sellerInterestRate}%`
                : '—'
            }
          />
          <MetricPill label="Down" value={hasValue(deal.downPayment) ? fmt$(deal.downPayment) : '—'} />
          <MetricPill
            label="PITI"
            value={hasValue(deal.totalMonthlyPayment) ? `${fmt$(deal.totalMonthlyPayment)}/mo` : '—'}
            highlight
          />
        </div>

        {/* Financing / Turnkey / Occupancy */}
        <div className="flex justify-between gap-2 interest_rate mt-1">
          <MetricPill
            label="Financing"
            value={hasValue(deal.financingType) ? shortFinancingLabel(deal.financingType) : '—'}
          />
          <MetricPill label="Turnkey" value={isTurnkeyDeal(deal) ? 'Yes' : 'No'} />
          <MetricPill
            label="Occupancy"
            value={hasValue(deal.occupancyRate) ? `${deal.occupancyRate}%` : '—'}
          />
        </div>

        {/* Nightly Rate & Revenue Tiers */}
        {tierRows.length > 0 && (
          <div className="rounded-xl border border-gray-100 bg-gray-50">
            <p className="text-sm font-bold text-sky-700 mb-1 p-3 border-b border-gray-300">
              Nightly Rate &amp; Revenue Tiers
            </p>
            <div className="p-3 overflow-y-auto scroll_bar">
              <table className="w-full text-xs table_width">
                <thead>
                  <tr className="text-[10px] font-semibold uppercase text-gray-900">
                    <th className="text-left pb-1">Tier</th>
                    <th className="text-right pb-1">Occupancy (%)</th>
                    <th className="text-right pb-1">Avg Nightly Rate</th>
                    <th className="text-right pb-1">Est. Gross Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {tierRows.map((row) => (
                    <tr key={row.tier} className="border-t border-gray-200">
                      <td className="py-1.5 text-gray-900">{row.tier}</td>
                      <td className="py-1.5 text-right font-semibold text-gray-900">
                        {hasValue(row.occupancy) ? `${row.occupancy}%` : '—'}
                      </td>
                      <td className="py-1.5 text-right font-semibold text-gray-900">
                        {hasValue(row.rate) ? fmt$(row.rate) : '—'}
                      </td>
                      <td className="py-1.5 text-right font-semibold text-sky-700">
                        {hasValue(row.revenue) ? fmt$(row.revenue) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Income Reduction / Tax Savings */}
        <div className="grid grid-cols-2 gap-2 income_boxes">
          <MetricPill label="Est. Income Reduction" value={hasValue(incomeReduction) ? fmt$(incomeReduction) : '—'} />
          <MetricPill label="Est. Tax Savings" value={hasValue(taxSavings) ? fmt$(taxSavings) : '—'} highlight />
        </div>

    
  {/* Address — admin/team only */}
        {canViewAddress &&
          (hasValue(deal.streetAddress) || hasValue(deal.city) || hasValue(deal.stateRegion) || hasValue(deal.postalCode)) && (
            <p className="text-xs text-text-secondary italic">
              {deal.streetAddress}
              {deal.city && `, ${deal.city}`}
              {deal.stateRegion && `, ${deal.stateRegion}`}
              {deal.postalCode && ` ${deal.postalCode}`}
            </p>
          )}

        {/* Footer: Copy Link + View Details */}
   {/* Footer: Copy Link + View Details */}
        <div className="flex items-center justify-between mt-auto pt-1">
          {deal.status?.toUpperCase() !== 'PENDING' ? (
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition px-2 py-1 rounded-md hover:bg-blue-50"
              title="Copy public link"
            >
              {linkCopied ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" />
                  </svg>
                  <span>Copy Link</span>
                </>
              )}
            </button>
          ) : (
            <div></div>
          )}

          <Button size="sm" variant="primary" onClick={onClick}>
            View Details
          </Button>
        </div>
		
		
		
      </div>
    </div>
  );
};

export default DealCard;
