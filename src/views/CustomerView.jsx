import { useState, useRef, useEffect } from 'react';
import { getLatLongFromAddress, getOSMMapElement } from '../api/mapping';
import { useQuery } from '@tanstack/react-query';
import { getFavorites, addFavorite, removeFavorite } from '../api/favorites';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { dealsAPI } from '../api/deals';
import { useAuth } from '../contexts/AuthContext';
import { useAuthSafe } from '../contexts/AuthContext';
import logoDarkBlue from '../assets/icons/logo-scholarship-house/logo-dark-blue.png';
import Button from '../components/Button';
import Input from '../components/Input';
import Select from '../components/Select';
import Loader from '../components/Loader';
import FilterBar from '../components/FilterBar';
import Modal from '../components/Modal';
import ImageCarousel from '../components/ImageCarousel';
import VideoCarousel from '../components/VideoCarousel';
import TieredMetric from '../components/TieredMetric';
import Metric from '../components/Metric';
import TagSection from '../components/TagSection';
import { formatNumber, unformatNumber } from '../utils/format';
import '../styles/main.css';

// Helper component to render OSM map iframe

function OSMMap({ coords }) {
  const mapRef = useRef(null);
  useEffect(() => {
    if (coords && mapRef.current) {
      mapRef.current.innerHTML = '';
      const iframe = getOSMMapElement(coords.latitude, coords.longitude);
      iframe.height = '225'; // half the previous height
      mapRef.current.appendChild(iframe);
    }
  }, [coords]);
  return <div ref={mapRef} style={{ width: '100%', minHeight: 225 }} />;
}

const formatPrice = (price) => {
  return parseInt(parseFloat(price)).toLocaleString('en-US');
};

const isValidUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch (err) {
      return false;
    }
  };

const hasValue = (v) => {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'number') return !Number.isNaN(v) && v !== 0;
  return true;
};

const hasAnyValue = (...values) => values.some(hasValue);

const hasAnyObjectValue = (obj) => Object.values(obj).some(hasValue);

const normalizeTurnkey = (value) =>
  value?.toString().toUpperCase().replace(/-/g, '_');

const isTurnkeyDeal = (deal) =>
  ['TURNKEY_OPERATING', 'FURNISHED_NOT_OPERATING'].includes(
    normalizeTurnkey(deal.turnkeyFurnished)
  );

const getDealImages = (deal) =>
  [
    ...(Array.isArray(deal?.interiorImages) ? deal.interiorImages : []),
    ...(Array.isArray(deal?.exteriorImages) ? deal.exteriorImages : []),
    ...(Array.isArray(deal?.additionalImages) ? deal.additionalImages : []),
  ]
    .map((img) => {
      if (typeof img === 'string') return img;
      if (img && typeof img === 'object' && img.url) return img.url;
      return null;
    })
    .filter((img) => typeof img === 'string' && img.trim().length > 0);

const PROPERTY_TYPES = [
  { value: 'SINGLE_FAMILY', label: 'Single Family Home' },
  { value: 'CONDO', label: 'Condo' },
  { value: 'TOWNHOUSE', label: 'Town House' },
  { value: 'TWO_TO_FOUR_UNIT', label: '2–4 Unit Home' },
  {
    value: 'UNIQUE_PROPERTY',
    label: 'Unique Property (Treehouses, Castles, Yurts, Etc.)',
  },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
];

const FINANCING_OPTIONS = [
  { value: 'traditional', label: 'Traditional Financing' },
  { value: 'subject-to', label: 'Creative Financing (Subject-to)' },
  { value: 'hybrid', label: 'Creative Financing (Hybrid)' },
  { value: 'seller', label: 'Creative Financing (Seller Financing)' },
  { value: 'cash', label: 'Cash Only' },
];

const MONTHS = [
  { key: '12m', label: '12 Months' },
  { key: '24m', label: '24 Months' },
  { key: '36m', label: '36 Months' },
  { key: '48m', label: '48 Months' },
  { key: '60m', label: '60 Months' },
  { key: '72m', label: '72 Months' },
  { key: '84m', label: '84 Months' },
];

const VACATION_RENTAL_MARKET_LABELS = {
  BEACH: 'Beach',
  MOUNTAIN: 'Mountain',
  URBAN: 'Urban',
  LAKE: 'Lake',
  NATURE_PARKS: 'Nature / Parks',
  THEME_PARKS: 'Theme Parks',
  COLLEGE_TOWN: 'College Town',
  OFF_BEATEN_PATH: 'Off the Beaten Path',
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

const CustomerView = () => {
  const { user, isAuthenticated } = useAuthSafe();
  // Hide address for non-admin/team members
  const canViewAddress = user?.role === 'admin' || user?.role === 'team_member';
  const isClient = user?.role === 'client';
  const [showFilterSidebar, setShowFilterSidebar] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { dealId } = useParams();
  const [filters, setFilters] = useState({
    search: '',
    propertyType: 'All',
    minPrice: '',
    maxPrice: '',
    downPayment: '',
    sortBy: 'newest',
    city: '',
    stateRegion: '',
    postalCode: '',

    selectedStates: [],

    minDownPayment: '',
    maxDownPayment: '',
    interestRateMin: '',
    subjectToInterestRateMax: '',
    advMonthlyPaymentMin: '',
    advMonthlyPaymentMax: '',

    advPropertyType: '',
    advBedroomsMin: '',
    advBedroomsMax: '',
    advBathroomsMin: '',
    advBathroomsMax: '',
    advSqftMin: '',
    advSqftMax: '',
    advYearBuiltMin: '',
    advYearBuiltMax: '',

    advFinancing: '',
    turnkeyFurnished: '',

    isHOA: false,
    hoaMonthlyFeeMax: '',

    strZoning: '',
    strConfidence: '',
    turnkey: false,

    occupancyRateMin: '',
    occupancyRateMax: '',
    avgNightlyRateMin: '',
    avgNightlyRateMax: '',

    anrMin_budget: '', anrMax_budget: '',
    anrMin_economy: '', anrMax_economy: '',
    anrMin_midscale: '', anrMax_midscale: '',
    anrMin_upscale: '', anrMax_upscale: '',
    anrMin_luxury: '', anrMax_luxury: '',

    egrMin_budget: '', egrMax_budget: '',
    egrMin_economy: '', egrMax_economy: '',
    egrMin_midscale: '', egrMax_midscale: '',
    egrMin_upscale: '', egrMax_upscale: '',
    egrMin_luxury: '', egrMax_luxury: '',

    incomeReductionMin: '',
    incomeReductionMax: '',
    taxSavingsMin: '',
    taxSavingsMax: '',

    priorityFirstAccess: false,
    fiftyFiftyPartner: false,
    doneForYou: false,

    vacationRentalMarkets: [],
    travelMotivations: [],
  });

  const [hasSavedBuyBox, setHasSavedBuyBox] = useState(false);
  const [buyBoxModal, setBuyBoxModal] = useState({ open: false, type: '', message: '' });
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(false);

  // Filter config from manage_filters (controls visibility & range values)
  const [filterConfig, setFilterConfig] = useState(null);

  useEffect(() => {
    const fetchFilterConfig = async () => {
      try {
        const data = await dealsAPI.getFilterSettings();
        if (data.filters && data.filters.length > 0) {
          setFilterConfig(data.filters);
        }
      } catch (err) {
        console.error('Failed to fetch filter config:', err);
      }
    };
    fetchFilterConfig();
  }, []);

  // Fetch saved buy box filters on mount
  useEffect(() => {
    const fetchSavedFilters = async () => {
      try {
        const res = await dealsAPI.getFilter();
        if (res?.data?.filters_json) {
          setFilters((prev) => ({ ...prev, ...res.data.filters_json }));
          setHasSavedBuyBox(true);
        }
      } catch (err) {
        console.error('Failed to fetch saved filters:', err);
      }
    };
    fetchSavedFilters();
  }, []);

  const [showPriceCard, setShowPriceCard] = useState(false);
  const [showPropertyTypeCard, setShowPropertyTypeCard] = useState(false);
  const [showSortByCard, setShowSortByCard] = useState(false);
  const [showAdvancedCard, setShowAdvancedCard] = useState(false);
  const priceCardRef = useRef(null);
  const propertyTypeCardRef = useRef(null);
  const sortByCardRef = useRef(null);
  const advCardRef = useRef(null);
  const advToggleRef = useRef(null);
  // Close price card on click outside
  useEffect(() => {
    function handleClick(event) {
      if (
        showPriceCard &&
        priceCardRef.current &&
        !priceCardRef.current.contains(event.target)
      )
        setShowPriceCard(false);
      if (
        showPropertyTypeCard &&
        propertyTypeCardRef.current &&
        !propertyTypeCardRef.current.contains(event.target)
      )
        setShowPropertyTypeCard(false);
      if (
        showSortByCard &&
        sortByCardRef.current &&
        !sortByCardRef.current.contains(event.target)
      )
        setShowSortByCard(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPriceCard, showPropertyTypeCard, showSortByCard, showAdvancedCard]);
  const [currentPage, setCurrentPage] = useState(1);
  const dealsPerPage = 12;

  const normalizedFilters = {
    search: filters.search || '',
    propertyType: filters.propertyType !== 'All' ? filters.propertyType : null,
    sortBy: filters.sortBy || 'newest',
    // Financial filters
    minPrice: filters.minPrice || null,
    maxPrice: filters.maxPrice || null,
    minDownPayment: filters.minDownPayment || null,
    maxDownPayment: filters.maxDownPayment || null,
    interestRateMin: filters.interestRateMin || null,
    subjectToInterestRateMax: filters.subjectToInterestRateMax || null,
    advMonthlyPaymentMin: filters.advMonthlyPaymentMin || null,
    advMonthlyPaymentMax: filters.advMonthlyPaymentMax || null,
    // Property Details
    advPropertyType: filters.advPropertyType || null,
    advBedroomsMin: filters.advBedroomsMin || null,
    advBathroomsMin: filters.advBathroomsMin || null,
    advYearBuiltMin: filters.advYearBuiltMin || null,
    advYearBuiltMax: filters.advYearBuiltMax || null,
    advSqftMin: filters.advSqftMin || null,
    advSqftMax: filters.advSqftMax || null,
    selectedStates: filters.selectedStates || null,
    // Financing & STR
    advFinancing: filters.advFinancing || null,
    turnkeyFurnished: filters.turnkeyFurnished || null,
    occupancyRateMin: filters.occupancyRateMin || null,
    occupancyRateMax: filters.occupancyRateMax || null,
    // ANR per-tier
    anrMin_budget: filters.anrMin_budget || null,
    anrMax_budget: filters.anrMax_budget || null,
    anrMin_economy: filters.anrMin_economy || null,
    anrMax_economy: filters.anrMax_economy || null,
    anrMin_midscale: filters.anrMin_midscale || null,
    anrMax_midscale: filters.anrMax_midscale || null,
    anrMin_upscale: filters.anrMin_upscale || null,
    anrMax_upscale: filters.anrMax_upscale || null,
    anrMin_luxury: filters.anrMin_luxury || null,
    anrMax_luxury: filters.anrMax_luxury || null,
    // EGR per-tier
    egrMin_budget: filters.egrMin_budget || null,
    egrMax_budget: filters.egrMax_budget || null,
    egrMin_economy: filters.egrMin_economy || null,
    egrMax_economy: filters.egrMax_economy || null,
    egrMin_midscale: filters.egrMin_midscale || null,
    egrMax_midscale: filters.egrMax_midscale || null,
    egrMin_upscale: filters.egrMin_upscale || null,
    egrMax_upscale: filters.egrMax_upscale || null,
    egrMin_luxury: filters.egrMin_luxury || null,
    egrMax_luxury: filters.egrMax_luxury || null,
    // Tax Benefits
    incomeReductionMin: filters.incomeReductionMin || null,
    incomeReductionMax: filters.incomeReductionMax || null,
    taxSavingsMin: filters.taxSavingsMin || null,
    taxSavingsMax: filters.taxSavingsMax || null,
  };


  const { data: deals, isLoading } = useQuery({
    queryKey: ['publishedDeals', normalizedFilters],
    queryFn: () => dealsAPI.getPublishedDeals(normalizedFilters),
    staleTime: 0,
    keepPreviousData: true,
  });


  // Fetch single deal for detail view
  const { data: selectedDeal, isLoading: isDealLoading } = useQuery({
    queryKey: ['deal', dealId],
    queryFn: () => dealsAPI.getDealById(dealId),
    enabled: !!dealId,
  });




  const queryClient = useQueryClient();

  // Fetch favorites
  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites'],
    queryFn: getFavorites,
    enabled: isAuthenticated,
  });

  const [optimisticFavorites, setOptimisticFavorites] = useState(new Set());
  const favoriteSet = new Set(favorites);
  optimisticFavorites.forEach((id) => favoriteSet.add(id));

  // Mutations
  const addFavoriteMutation = useMutation({
    mutationFn: addFavorite,

    onMutate: async (propertyId) => {
      setOptimisticFavorites((prev) => {
        const next = new Set(prev);
        next.add(propertyId);
        return next;
      });
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },

    onError: (_err, propertyId) => {
      setOptimisticFavorites((prev) => {
        const next = new Set(prev);
        next.delete(propertyId);
        return next;
      });
    },
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: removeFavorite,

    onMutate: async (propertyId) => {
      setOptimisticFavorites((prev) => {
        const next = new Set(prev);
        next.delete(propertyId);
        return next;
      });
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  const saveFilterMutation = useMutation({
    mutationFn: (payload) => dealsAPI.storefilter(payload),
    onSuccess: (res) => {
      console.log("Saved successfully", res);
      setHasSavedBuyBox(true);
      setBuyBoxModal({ open: true, type: 'success', message: 'Buy Box saved successfully!' });
    },
    onError: (err) => {
      console.error("Error saving filters", err);
      setBuyBoxModal({ open: true, type: 'error', message: 'Failed to save Buy Box. Please try again.' });
    }
  });

  const deleteFilterMutation = useMutation({
    mutationFn: () => dealsAPI.deleteFilter(),
    onSuccess: () => {
      setHasSavedBuyBox(false);
      clearAllFiltersHandler();
      setBuyBoxModal({ open: true, type: 'success', message: 'Buy Box deleted successfully!' });
    },
    onError: (err) => {
      console.error("Error deleting buy box", err);
      setBuyBoxModal({ open: true, type: 'error', message: 'Failed to delete Buy Box. Please try again.' });
    }
  });

  const filteredDeals = (deals || []).filter((deal) => {
    // console.log('deals : ',deals)

    if (
      filters.propertyType !== 'All' &&
      deal.category !== filters.propertyType
    )
      return false;

    if (
      filters.search &&
      !`${deal.title} ${deal.description}`
        .toLowerCase()
        .includes(filters.search.toLowerCase())
    )
      return false;
    if (filters.city && deal.city?.toLowerCase() !== filters.city.toLowerCase())
      return false;

    if (
      filters.stateRegion &&
      deal.stateRegion?.toLowerCase() !== filters.stateRegion.toLowerCase()
    )
      return false;

    if (filters.postalCode && deal.postalCode !== filters.postalCode)
      return false;

    if (filters.minPrice && Number(deal.price) < Number(filters.minPrice))
      return false;

    if (filters.maxPrice && Number(deal.price) > Number(filters.maxPrice))
      return false;

    if (filters.advFinancing && deal.financingType !== filters.advFinancing)
      return false;

    if (
      filters.advYearBuiltMin &&
      Number(deal.yearBuilt) < Number(filters.advYearBuiltMin)
    )
      return false;

    if (
      filters.advYearBuiltMax &&
      Number(deal.yearBuilt) > Number(filters.advYearBuiltMax)
    )
      return false;

    if (filters.isHOA && !deal.isHOA) return false;

    if (
      filters.hoaMonthlyFeeMin &&
      Number(deal.hoaMonthlyFee) < Number(filters.hoaMonthlyFeeMin)
    )
      return false;

    if (
      filters.hoaMonthlyFeeMax &&
      Number(deal.hoaMonthlyFee) > Number(filters.hoaMonthlyFeeMax)
    )
      return false;

    if (
      filters.advBedroomsMin &&
      Number(deal.bedrooms) < Number(filters.advBedroomsMin)
    )
      return false;

    if (
      filters.advBedroomsMax &&
      Number(deal.bedrooms) > Number(filters.advBedroomsMax)
    )
      return false;

    if (
      filters.advBathroomsMin &&
      Number(deal.bathrooms) < Number(filters.advBathroomsMin)
    )
      return false;

    if (
      filters.advBathroomsMax &&
      Number(deal.bathrooms) > Number(filters.advBathroomsMax)
    )
      return false;

    if (
      filters.advSqftMin &&
      Number(deal.squareFootage) < Number(filters.advSqftMin)
    )
      return false;

    if (
      filters.advSqftMax &&
      Number(deal.squareFootage) > Number(filters.advSqftMax)
    )
      return false;

    if (
      filters.advMonthlyPaymentMax &&
      Number(deal.totalMonthlyPayment) > Number(filters.advMonthlyPaymentMax)
    )
      return false;

    if (
      filters.strZoning &&
      deal.strZoning?.toUpperCase() !== filters.strZoning
    )
      return false;

    if (
      filters.advShortTerm &&
      normalizeTurnkey(deal.turnkeyFurnished) !== 'TURNKEY_OPERATING'
    ) {
      return false;
    }

    if (
      filters.strConfidence &&
      deal.strConfidence?.toUpperCase().replace(/\s+/g, '_') !==
      filters.strConfidence
    )
      return false;

    if (filters.turnkey && !isTurnkeyDeal(deal)) return false;

    if (filters.doneForYou && !deal.doneForYou) return false;

    if (filters.fiftyFiftyPartner && !deal.fiftyFiftyPartner) return false;

    if (
      filters.occupancyRateMin &&
      Number(deal.occupancyRate) < Number(filters.occupancyRateMin)
    )
      return false;

    if (
      filters.occupancyRateMax &&
      Number(deal.occupancyRate) > Number(filters.occupancyRateMax)
    )
      return false;
    if (
      filters.avgNightlyRateMin &&
      Number(deal.averageNightlyRate) < Number(filters.avgNightlyRateMin)
    )
      return false;

    if (
      filters.avgNightlyRateMax &&
      Number(deal.averageNightlyRate) > Number(filters.avgNightlyRateMax)
    )
      return false;

    if (
      filters.underwritingMarketType &&
      deal.underwritingMarketType !== filters.underwritingMarketType
    )
      return false;

    if (
      filters.underwritingMarketSize &&
      deal.underwritingMarketSize !== filters.underwritingMarketSize
    )
      return false;

    if (
      filters.amenities?.length &&
      !filters.amenities.every((a) => deal.amenities?.includes(a))
    )
      return false;

    if (
      filters.vacationRentalMarkets?.length &&
      !filters.vacationRentalMarkets.every((m) =>
        deal.vacationRentalMarkets?.includes(m)
      )
    )
      return false;

    if (
      filters.specialTags?.length &&
      !filters.specialTags.every((t) => deal.specialTags?.includes(t))
    )
      return false;

    if (
      filters.localAttractions?.length &&
      !filters.localAttractions.every((l) => deal.localAttractions?.includes(l))
    )
      return false;

    if (
      filters.travelMotivations?.length &&
      !filters.travelMotivations.every((m) =>
        deal.travelMotivations?.includes(m)
      )
    )
      return false;

    if (filters.priorityFirstAccess && !deal.priorityFirstAccess) return false;

    return true;
  });

  

  const sortFn = (a, b) => {
    switch (filters.sortBy) {
      case 'oldest':
        return new Date(a.publishedAt) - new Date(b.publishedAt);
      case 'price-low':
        return Number(a.discountedPrice) - Number(b.discountedPrice);
      case 'price-high':
        return Number(b.discountedPrice) - Number(a.discountedPrice);
      case 'discount':
        return Number(b.discountPercentage) - Number(a.discountPercentage);
      case 'newest':
      default:
        return new Date(b.publishedAt) - new Date(a.publishedAt);
    }
  };



const sortedDeals = [...filteredDeals].sort(sortFn);
  const paginatedNonFavoritedDeals = sortedDeals.slice(
    (currentPage - 1) * dealsPerPage,
    currentPage * dealsPerPage
  );
const totalPages = Math.ceil(sortedDeals.length / dealsPerPage);
  
  

  if (dealId && isDealLoading) {
    return <Loader />;
  }

  if (selectedDeal) {
    window.scrollTo(0, 0);
    return (
      <DealDetailView
        deal={selectedDeal}
        onBack={() => {
          window.scrollTo(0, 0);
          navigate(location.state?.from === 'admin-properties' ? '/admin/properties' : '/deals');
        }}
        backLabel={location.state?.from === 'admin-properties' ? '← Back to Property Management' : '← Back to Properties'}
        canViewAddress={canViewAddress}
      />
    );
  }

  // Shared property grid content
  const renderPropertyGrid = (gridCols = 'grid-cols-1 md:grid-cols-3 lg:grid-cols-4') => (
    <>
      {isLoading ? (
        <Loader />
      ) : filteredDeals.length === 0 ? (
        <div className="bg-surface border border-border-subtle rounded-2xl shadow-sm p-12 text-center">
          <p className="text-text-secondary text-lg">
            No properties found matching your criteria
          </p>
        </div>
      ) : (
        <>

          {/* ALL OTHER PROPERTIES */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            {paginatedNonFavoritedDeals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                onClick={() => {
                  window.scrollTo(0, 0);
                  navigate(`/deals/${deal.id}`);
                }}
                favorites={favorites}
                addFavoriteMutation={addFavoriteMutation}
                removeFavoriteMutation={removeFavoriteMutation}
              />
            ))}
          </div>

          {/* PAGINATION (only for non-favorites) */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center space-x-2">
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => prev - 1)}
              >
                Previous
              </Button>
              {[...Array(totalPages)].map((_, i) => (
                <Button
                  key={i}
                  size="sm"
                  variant={currentPage === i + 1 ? 'primary' : 'outline'}
                  onClick={() => setCurrentPage(i + 1)}
                >
                  {i + 1}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => prev + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );

  const forDeleteFilters = () => {
    setDeleteConfirmModal(true);
  };

  const forSaveFilters = () => {
    // Keys to exclude from buy box (not filter criteria)
    const excludeKeys = ['search', 'sortBy', 'propertyType', 'city', 'stateRegion', 'postalCode', 'downPayment', 'isHOA', 'hoaMonthlyFeeMax', 'hoaMonthlyFeeMin', 'strZoning', 'strConfidence', 'turnkey', 'priorityFirstAccess', 'fiftyFiftyPartner', 'doneForYou', 'submitterSearch', 'status', 'advShortTerm'];

    const filteredData = {};
    for (const [key, value] of Object.entries(filters)) {
      if (excludeKeys.includes(key)) continue;
      if (value === '' || value === null || value === undefined) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      if (value === false) continue;
      filteredData[key] = value;
    }

    if (Object.keys(filteredData).length > 0) {
      saveFilterMutation.mutate({ filters_json: filteredData });
    } else {
      setBuyBoxModal({ open: true, type: 'error', message: 'Please select at least one filter before saving Buy Box.' });
    }
  };



  const clearAllFiltersHandler = () => {
    setFilters({
      propertyType: 'All',
      search: '',
      sortBy: 'newest',
      minPrice: '',
      maxPrice: '',
      downPayment: '',
      city: '',
      stateRegion: '',
      postalCode: '',
      selectedStates: [],
      minDownPayment: '',
      maxDownPayment: '',
      interestRateMin: '',
      subjectToInterestRateMax: '',
      advMonthlyPaymentMin: '',
      advMonthlyPaymentMax: '',
      advPropertyType: '',
      advFinancing: '',
      turnkeyFurnished: '',
      isHOA: false,
      hoaMonthlyFeeMin: '',
      hoaMonthlyFeeMax: '',
      advBedroomsMin: '',
      advBedroomsMax: '',
      advBathroomsMin: '',
      advBathroomsMax: '',
      advSqftMin: '',
      advSqftMax: '',
      advYearBuiltMin: '',
      advYearBuiltMax: '',
      strZoning: '',
      strConfidence: '',
      occupancyRateMin: '',
      occupancyRateMax: '',
      avgNightlyRateMin: '',
      avgNightlyRateMax: '',
      anrMin_budget: '', anrMax_budget: '',
      anrMin_economy: '', anrMax_economy: '',
      anrMin_midscale: '', anrMax_midscale: '',
      anrMin_upscale: '', anrMax_upscale: '',
      anrMin_luxury: '', anrMax_luxury: '',
      egrMin_budget: '', egrMax_budget: '',
      egrMin_economy: '', egrMax_economy: '',
      egrMin_midscale: '', egrMax_midscale: '',
      egrMin_upscale: '', egrMax_upscale: '',
      egrMin_luxury: '', egrMax_luxury: '',
      incomeReductionMin: '',
      incomeReductionMax: '',
      taxSavingsMin: '',
      taxSavingsMax: '',
      turnkey: false,
      advShortTerm: false,
      priorityFirstAccess: false,
      fiftyFiftyPartner: false,
      doneForYou: false,
      vacationRentalMarkets: [],
      travelMotivations: [],
      specialTags: [],
    });
    setCurrentPage(1);
  };

  

  // --- CLIENT LAYOUT: collapsible sidebar filters ---
  if (isClient) {
    return (
      <div className="bg-app min-h-screen">
        {/* Top bar */}
        <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm box-border">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between flex-wrap">
            {/* Left: Filters toggle */}
            {(!showFilterSidebar) && (
              <button onClick={() => setShowFilterSidebar((v) => !v)} className={`inline-flex items-center gap-2 md:px-4 md:py-2 px-2 py-2 rounded-lg text-sm font-medium border transition-colors ${showFilterSidebar
                ? 'bg-blue-50 border-primary text-primary'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >

                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 4a1 1 0 0 1 1-1h16a1 1 0 0 1 .71 1.71l-6.42 6.42A1 1 0 0 0 14 12v5.38a1 1 0 0 1-.55.9l-4 2A1 1 0 0 1 8 19.38V12a1 1 0 0 0-.29-.71L1.29 4.71A1 1 0 0 1 2 3"
                  />
                </svg>
                Filters
              </button>
            )}


            {/* Right: Title + count + sort */}
            <div className="flex items-center md:gap-4 ml-auto gap-2 mt-2 md:mt-0 flex_wrap">
              <div className="flex items-center md:gap-2 gap-1">
                <img
                  src={logoDarkBlue}
                  alt="Scholarship House"
                  className="h-8 w-auto opacity-80"
                />
                <h1 className="md:text-xl font-bold text-primary text-sm">
                  Browse Properties
                </h1>
              </div>
              <span className="text-sm text-gray-500 font_12">
                Showing{' '}
                {paginatedNonFavoritedDeals.length} of{' '}
                {sortedDeals.length} propert
                {sortedDeals.length !== 1 ? 'ies' : 'y'}
              </span>
              {/* Sort dropdown */}
              <div className="relative">
                <select
                  className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200 select_width"
                  value={filters.sortBy}
                  onChange={(e) => {
                    setFilters((p) => ({ ...p, sortBy: e.target.value }));
                    setCurrentPage(1);
                  }}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <svg className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Main content area with optional sidebar */}
        <div className="flex">
          {/* Filter Sidebar */}
          {showFilterSidebar && (
            <div className="fixed_div">
              <aside className="w-[320px] shrink-0 bg-white border-r border-gray-200 overflow-y-auto sticky top-[57px] h-[calc(100vh-57px)] clientView">
                <div className="px-5 py-6">
                  {/* Save Buy Box + Delete + Collapse */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <button
                        className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={forSaveFilters}
                        disabled={saveFilterMutation.isPending}
                      >
                        {saveFilterMutation.isPending ? (
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        )}
                        {saveFilterMutation.isPending ? 'Saving...' : 'Save Buy Box'}
                      </button>
                      {hasSavedBuyBox && (
                        <button
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-700 transition-colors"
                          onClick={forDeleteFilters}
                          title="Delete saved Buy Box"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => setShowFilterSidebar(false)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Collapse filters"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* FILTERS heading */}
                  <h2 className="text-lg font-bold text-gray-900 tracking-wide mb-5">FILTERS</h2>

                  {/* Search */}
                  <div className="mb-5">
                    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200">
                      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search..."
                        value={filters.search}
                        onChange={(e) => {
                          setFilters((p) => ({ ...p, search: e.target.value }));
                          setCurrentPage(1);
                        }}
                        className="w-full text-sm text-gray-700 placeholder-gray-400 bg-transparent outline-none"
                      />
                    </div>
                    {/* <p className="text-sm text-gray-500 mt-2">
                      <span className="font-semibold text-blue-600">{filteredDeals.length}</span> of {deals?.length || 0} properties
                    </p> */}
                  </div>

                  {/* Inline FilterBar sections rendered as sidebar */}
                  <FilterBar
                    filters={filters}
                    setFilters={setFilters}
                    setCurrentPage={setCurrentPage}
                    PROPERTY_TYPES={PROPERTY_TYPES}
                    SORT_OPTIONS={SORT_OPTIONS}
                    FINANCING_OPTIONS={FINANCING_OPTIONS}
                    showPropertyTypeCard={showPropertyTypeCard}
                    setShowPropertyTypeCard={setShowPropertyTypeCard}
                    showPriceCard={showPriceCard}
                    setShowPriceCard={setShowPriceCard}
                    showSortByCard={showSortByCard}
                    setShowSortByCard={setShowSortByCard}
                    showAdvancedCard={true}
                    setShowAdvancedCard={setShowAdvancedCard}
                    propertyTypeCardRef={propertyTypeCardRef}
                    priceCardRef={priceCardRef}
                    sortByCardRef={sortByCardRef}
                    advCardRef={advCardRef}
                    advToggleRef={advToggleRef}
                    sidebarMode
                    filterConfig={filterConfig}
                  />

                  {/* Clear Filters */}
                  <div className="mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={clearAllFiltersHandler}
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </aside>
            </div>
          )}

          {/* Property Grid */}
          <div className="flex-1 container mx-auto px-4 pt-6 pb-8">
            {renderPropertyGrid(
              showFilterSidebar
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-1 md:grid-cols-3 lg:grid-cols-4'
            )}
          </div>
        </div>

        {/* Buy Box Success/Error Modal */}
        <Modal isOpen={buyBoxModal.open} onClose={() => setBuyBoxModal({ open: false, type: '', message: '' })} title={buyBoxModal.type === 'success' ? 'Success' : 'Error'} size="sm">
          <div className="text-center">
            {buyBoxModal.type === 'success' ? (
              <div className="mx-auto flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="mx-auto flex items-center justify-center w-14 h-14 rounded-full bg-red-100 mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
            <p className="text-gray-700 text-base mb-6">{buyBoxModal.message}</p>
            <button
              onClick={() => setBuyBoxModal({ open: false, type: '', message: '' })}
              className={`px-6 py-2.5 rounded-lg text-white font-medium transition-colors ${buyBoxModal.type === 'success' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
            >
              OK
            </button>
          </div>
        </Modal>

        {/* Delete Buy Box Confirm Modal */}
        <Modal isOpen={deleteConfirmModal} onClose={() => setDeleteConfirmModal(false)} title="Delete Buy Box" size="sm">
          <p className="text-gray-600 mb-2">Are you sure you want to <strong>delete</strong> your saved Buy Box?</p>
          <p className="text-sm text-gray-400 mb-6">This action cannot be undone. All your saved filter criteria will be removed.</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteConfirmModal(false)}
              className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >Cancel
            </button>
            <button
              onClick={() => {
                setDeleteConfirmModal(false);
                deleteFilterMutation.mutate();
              }}
              className="px-5 py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
            >
              Delete Buy Box
            </button>
          </div>
        </Modal>
      </div>
    );
  }

  // --- ADMIN / TEAM MEMBER LAYOUT (unchanged) ---
  return (
    <div className="bg-app min-h-screen">
      <div className="container mx-auto px-4 pt-2 pb-8">
        <div className="md:mb-8 mt-3 mb-6">
          <div className="bg-surface border border-border-subtle rounded-3xl md:p-10 md:mb-4 shadow-sm mb-5 p-5">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center md:mb-2 mb-0">
              <div />
              <div className="flex items-center justify-center md:gap-3 gap-1 propertie_box">
                <img
                  src={logoDarkBlue}
                  alt="Scholarship House"
                  className="h-14 w-auto opacity-80"
                />
                <h1 className="text-4xl font-bold text-primary">
                  Browse Properties
                </h1>
              </div>
              <div />
            </div>

             <p className="text-center text-text-secondary md:mb-6 mb-2">
              Search for real estate properties
            </p>
            <div className="h-1 w-32 bg-accent rounded-full mx-auto mb-2" />
          </div>
        </div>

        {/* Filters */}
         <div className="bg-surface border border-border-subtle rounded-2xl p-4 shadow-sm mb-6 adminFilter">
          <FilterBar
            filters={filters}
            setFilters={setFilters}
            setCurrentPage={setCurrentPage}
            PROPERTY_TYPES={PROPERTY_TYPES}
            SORT_OPTIONS={SORT_OPTIONS}
            FINANCING_OPTIONS={FINANCING_OPTIONS}
            showPropertyTypeCard={showPropertyTypeCard}
            setShowPropertyTypeCard={setShowPropertyTypeCard}
            showPriceCard={showPriceCard}
            setShowPriceCard={setShowPriceCard}
            showSortByCard={showSortByCard}
            setShowSortByCard={setShowSortByCard}
            showAdvancedCard={showAdvancedCard}
            setShowAdvancedCard={setShowAdvancedCard}
            propertyTypeCardRef={propertyTypeCardRef}
            priceCardRef={priceCardRef}
            sortByCardRef={sortByCardRef}
            advCardRef={advCardRef}
            advToggleRef={advToggleRef}
            filterConfig={filterConfig}
          />
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-text-secondary">
              Showing{' '}
              {paginatedNonFavoritedDeals.length} of{' '}
              {sortedDeals.length} propert
              {sortedDeals.length !== 1 ? 'ies' : 'y'}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={clearAllFiltersHandler}
            >
              Clear Filters
            </Button>
          </div>
        </div>

        {renderPropertyGrid()}
      </div>
    </div>
  );
};

const getPropertyTypeLabel = (value) => {
  if (!value) return '';
  const match = PROPERTY_TYPES.find((t) => t.value === value);
  return match ? match.label : value;
};



const TierRow = ({ title, tiers }) => {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
      <p className="text-sm font-semibold text-gray-700 mb-2">
        {title}
      </p>
      <div className="grid grid-cols-5 gap-1">
        {tiers.map(({ label, value }) => (
          <div key={label} className="text-center">
            <p className="text-[12px] text-gray-900 mb-0.5">{label}</p>
            <p className="text-[14px] font-semibold text-gray-900">
              {hasValue(value) ? formatCompact(value) : '—'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};



const MetricPill = ({ label, value, highlight = false }) => (
  <div className="flex flex-col bg-gray-50 border border-border-subtle rounded-lg px-3 py-2 min-w-0 test">
    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-900 mb-0.5 whitespace-nowrap">
      {label}
    </span>
    <span
      className={`text-[14px] font-semibold whitespace-nowrap ${highlight ? 'text-blue-600' : 'text-gray-900'
        }`}
    >
      {value}
    </span>
  </div>
);

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

const formatCompact = (val) => {
  const n = parseFloat(val);
  if (!n || Number.isNaN(n)) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
};

const fmt$ = (val) => {
  const n = parseFloat(val);
  if (!n || Number.isNaN(n)) return '—';
  return `$${parseInt(n).toLocaleString('en-US')}`;
};


const DealCard = ({
  deal,
  onClick,
  favorites,
  addFavoriteMutation,
  removeFavoriteMutation,
  canViewAddress,
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
    if (isFavorited) {
      removeFavoriteMutation.mutate(deal.id);
    } else {
      addFavoriteMutation.mutate(deal.id);
    }
  };

  const anrTiers = [
    { label: 'Budget', value: deal.anr_budget },
    { label: 'Economy', value: deal.anr_economy },
    { label: 'Midscale', value: deal.anr_midscale },
    { label: 'Upscale', value: deal.anr_upscale },
    { label: 'Luxury', value: deal.anr_luxury },
  ];


  const egrTiers = [
    { label: 'Budget', value: deal.egr_budget },
    { label: 'Economy', value: deal.egr_economy },
    { label: 'Midscale', value: deal.egr_midscale },
    { label: 'Upscale', value: deal.egr_upscale },
    { label: 'Luxury', value: deal.egr_luxury },
  ];

const incomeReduction = hasValue(deal.incomeReduction) ? deal.incomeReduction : null;
const taxSavings = hasValue(deal.taxSavings) ? deal.taxSavings : null;

  return (
    <div
      className="
        group bg-surface border border-border-subtle rounded-2xl
        overflow-hidden shadow-sm
        transition hover:shadow-lg hover:-translate-y-1
        h-full flex flex-col
      "
    >
      {/* ── Image ── */}
      <div className="relative h-48 bg-app flex-shrink-0">
        {/* Badges top-left */}
        <div className="absolute top-2 left-2 flex flex-col gap-1.5 z-20">
          {deal.priorityFirstAccess && (
            <div
               className="text-white px-2 py-1 rounded-lg text-xs font-bold border-2 shadow-lg text-center"
              style={{
                minWidth: 80,
                maxWidth: 100,
                border: '2px solid #FFD166',
                background: 'linear-gradient(90deg, #FFD166 0%, #E09F3E 100%)',
                color: '#000',
              }}
            >
              Premium
            </div>
          )}
          {deal.fiftyFiftyPartner && (
            <div
              className="text-white px-2 py-1 rounded-lg text-xs font-bold shadow-lg border-2 text-center"
              style={{
                minWidth: 80,
                maxWidth: 100,
                background: 'linear-gradient(90deg, #99CC66 0%, #6FBF4A 100%)',
                borderColor: '#6FBF4A',
                color: '#1F3D1A',
              }}
            >
              50/50 Partnership
            </div>
          )}
          {isTurnkeyDeal(deal) && (
            <div
               className="text-white px-2 py-1 rounded-lg text-xs font-bold shadow-lg border-2 text-center flex flex-col items-center"
              style={{
                minWidth: 80,
                maxWidth: 100,
                background: 'linear-gradient(90deg, #84CC16 0%, #65A30D 100%)',
                borderColor: '#84CC16',
                color: '#fff',
              }}
            >
              <span>Turnkey</span>
              <span className="text-[10px] font-normal">Fully Furnished</span>
            </div>
          )}
        </div>

        {/* Favorite button top-right */}
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
              d="M12 2.5l2.938 5.95 6.562.955-4.75 4.63
               1.12 6.53L12 17.77l-5.87 3.09
               1.12-6.53-4.75-4.63
               6.562-.955L12 2.5z"
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
        <h3 className="flex gap-1.5 font-semibold text-primary text-sm leading-snug md:min-h-[2.5rem]">
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

        {/* Rate / Down / PITI — always shown */}
         <div className="grid grid-cols-3 gap-4 rounded-xl border border-gray-100 bg-gray-50 p-3 interest_rate">
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
          <MetricPill
            label="Down"
            value={hasValue(deal.downPayment) ? fmt$(deal.downPayment) : '—'}
          />
          <MetricPill
            label="PITI"
            value={
              hasValue(deal.totalMonthlyPayment)
                ? `${fmt$(deal.totalMonthlyPayment)}/mo`
                : '—'
            }
            highlight
          />



        </div>

        {/* Financing / Turnkey / Occupancy — always shown */}
        <div className="grid grid-cols-3 gap-2 interest_rate mt-1">
          <MetricPill
            label="Financing"
            value={
              hasValue(deal.financingType)
                ? shortFinancingLabel(deal.financingType)
                : '—'
            }
          />
          <MetricPill
            label="Turnkey"
            value={isTurnkeyDeal(deal) ? 'Yes' : 'No'}
          />
          <MetricPill
            label="Occupancy"
            value={hasValue(deal.occupancyRate) ? `${deal.occupancyRate}%` : '—'}
          />
        </div>

        {/* ANR Tiers — always shown, individual values show — if missing */}
        <TierRow
          title="Average Nightly Rate (ANR)"
          tiers={anrTiers}
        />

        {/* EGR Tiers — always shown, individual values show — if missing */}
        <TierRow
          title="Estimated Gross Revenue (Potential)"
          tiers={egrTiers}
        />

        {/* Income Reduction / Tax Savings — always shown */}
         <div className="grid grid-cols-2 gap-2 income_boxes">
          <MetricPill label="Income Reduction" value={hasValue(incomeReduction) ? fmt$(incomeReduction) : '—'} />
          <MetricPill label="Est. Tax Savings" value={hasValue(taxSavings) ? fmt$(taxSavings) : '—'} highlight
          />
        </div>
        <hr className="border-gray-100 mt-2" />

        {/* Address (admin / team only) */}
        {canViewAddress &&
          (hasValue(deal.streetAddress) ||
            hasValue(deal.city) ||
            hasValue(deal.stateRegion) ||
            hasValue(deal.postalCode)) && (
            <p className="text-xs text-text-secondary italic">
              {deal.streetAddress}
              {deal.city && `, ${deal.city}`}
              {deal.stateRegion && `, ${deal.stateRegion}`}
              {deal.postalCode && ` ${deal.postalCode}`}
            </p>
          )}

        {/* Footer: Copy Link + View Details */}
        <div className="flex items-center justify-between mt-auto pt-1">
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

          <Button size="sm" variant="primary" onClick={onClick}>
            View Details
          </Button>
        </div>
      </div>
    </div>
  );
};


const DealDetailView = ({ deal, onBack, canViewAddress, bckProperty = true, backLabel = '← Back to Properties' }) => {
  // Helper to show only valid values
  const show = (v) =>
    v !== null &&
    v !== undefined &&
    v !== '' &&
    !(typeof v === 'number' && Number.isNaN(v));

  const hasAny = (...values) => values.some(show);

  // Helper to format enum-like fields to human readable
  const humanizeEnum = (value) => {
    if (!value || typeof value !== 'string') return '';
    return value
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const PROPERTY_TYPE_LABELS = PROPERTY_TYPES.reduce(
    (acc, { value, label }) => {
      acc[value] = label;
      return acc;
    },
    {}
  );

  // Map state
  const [mapCoords, setMapCoords] = useState(null);
  const [mapError, setMapError] = useState(null);
  const [mapLoading, setMapLoading] = useState(false);

  // Handler to fetch coordinates when address is clicked
  const handleAddressClick = async () => {
    // If map is open, close it
    // console.log('mapCoords : ',mapCoords)
    // console.log('mapLoading : ',mapLoading)
    // console.log('mapError : ',mapError)

    if (mapCoords || mapLoading || mapError) {
      setMapCoords(null);
      setMapError(null);
      setMapLoading(false);
      return;
    }
    // Otherwise, open map
    setMapLoading(true);
    setMapError(null);
    setMapCoords(null);
    try {
      const address = [
        deal.streetAddress,
        deal.city,
        deal.stateRegion,
        deal.postalCode,
      ]
        .filter(Boolean)
        .join(', ');
      const coords = await getLatLongFromAddress(address);
      console.log('Coords : ',coords)
      setMapCoords(coords);
    } catch (err) {
      setMapError(err.message || 'Failed to load map');
    } finally {
      setMapLoading(false);
    }
  };

  const hasMarketRevenue = hasAnyObjectValue({
    m12: deal.marketRevenue_12m,
    m24: deal.marketRevenue_24m,
    m36: deal.marketRevenue_36m,
    m48: deal.marketRevenue_48m,
    m60: deal.marketRevenue_60m,
    m72: deal.marketRevenue_72m,
    m84: deal.marketRevenue_84m,
  });

  const hasMarketOccupancy = hasAnyObjectValue({
    m12: deal.marketOccupancy_12m,
    m24: deal.marketOccupancy_24m,
    m36: deal.marketOccupancy_36m,
    m48: deal.marketOccupancy_48m,
    m60: deal.marketOccupancy_60m,
    m72: deal.marketOccupancy_72m,
    m84: deal.marketOccupancy_84m,
  });

  const hasANR = MONTHS.some(({ key }) =>
    hasAnyObjectValue({
      budget: deal[`anr_${key}_budget`],
      economy: deal[`anr_${key}_economy`],
      midscale: deal[`anr_${key}_midscale`],
      upscale: deal[`anr_${key}_upscale`],
      luxury: deal[`anr_${key}_luxury`],
    })
  );

  const hasProjectedRevenue = MONTHS.some(({ key }) =>
    hasAnyObjectValue({
      budget: deal[`projectedRevenue_${key}_budget`],
      economy: deal[`projectedRevenue_${key}_economy`],
      midscale: deal[`projectedRevenue_${key}_midscale`],
      upscale: deal[`projectedRevenue_${key}_upscale`],
      luxury: deal[`projectedRevenue_${key}_luxury`],
    })
  );

  const hasMarketSection =
    hasAnyValue(deal.underwritingMarketType, deal.underwritingMarketSize) ||
    hasMarketRevenue ||
    hasMarketOccupancy ||
    hasANR ||
    hasProjectedRevenue;

  console.log(deal)

  return (
    <div className="py-8">
      <div className="container mx-auto px-4">

        {bckProperty && (
          <Button variant="outline" onClick={onBack} className="mb-6">
            {backLabel}
          </Button>
        )}


        {/* Sold Property Banner */}
        {deal.status === 'sold' && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-red-800 mb-2">
                  This Property Has Been Sold
                </h2>
                <p className="text-red-700 text-base mb-2">
                  This listing is no longer available for purchase.
                </p>
                {deal.soldAt && (
                  <p className="text-red-600 text-sm">
                    Sold on{' '}
                    {new Date(deal.soldAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="bg-surface border border-gray-200 rounded-3xl shadow-sm overflow-hidden relative">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 ">
            <div>
              {/* Videos */}
              {Array.isArray(deal.videos) && deal.videos.length > 0 && (
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-primary mb-2">
                    Videos
                  </h1>
                  <VideoCarousel
                    videos={deal.videos}
                    className="w-full h-64 rounded-lg overflow-hidden"
                  />
                </div>
              )}
              {/* Exterior Photos with Badges */}
              {Array.isArray(deal.exteriorImages) &&
                deal.exteriorImages.length > 0 && (
                  <div className="mb-6 relative">
                    <h1 className="text-2xl font-bold text-primary mb-2">
                      Exterior Photos
                    </h1>
                    <div className="relative">
                      {/* Badges positioned over exterior images */}
                      <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex flex-col gap-1.5 sm:gap-2 z-20">
                        {deal.status === 'sold' && (
                          <div
                            className="text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm font-bold
                             flex flex-col items-center border-2 shadow-lg"
                            style={{
                              minWidth: 80,
                              maxWidth: 120,
                              border: '2px solid #DC2626',
                              background:
                                'linear-gradient(90deg, #DC2626 0%, #991B1B 100%)',
                              color: '#FFFFFF',
                            }}
                          >
                            <span className="text-sm sm:text-base font-bold">
                              SOLD
                            </span>
                            {deal.soldAt && (
                              <span className="text-xs font-normal">
                                {new Date(deal.soldAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        )}
                        {deal.priorityFirstAccess && (
                          <div
                            className="text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm font-bold
                             flex flex-col items-center border-2 shadow-lg"
                            style={{
                              minWidth: 80,
                              maxWidth: 120,
                              border: '2px solid #FFD166',
                              background:
                                'linear-gradient(90deg, #FFD166 0%, #E09F3E 100%)',
                              color: '#4B2E05',
                            }}
                          >
                            <span className="text-sm sm:text-base font-bold">
                              Premium
                            </span>
                            <span className="text-xs font-normal">
                              {deal.priorityCountdown
                                ? deal.priorityCountdown.type === 'days'
                                  ? `${deal.priorityCountdown.value} days left`
                                  : deal.priorityCountdown.type === 'hours'
                                    ? `${deal.priorityCountdown.value} hours left`
                                    : deal.priorityCountdown.type === 'minutes'
                                      ? `${deal.priorityCountdown.value} min left`
                                      : deal.priorityCountdown.type ===
                                        'expired'
                                        ? 'Expired'
                                        : ''
                                : (() => {
                                  const now = new Date();
                                  const submitted = deal.submittedAt
                                    ? new Date(deal.submittedAt)
                                    : null;
                                  if (!submitted) return '';
                                  const msInDay = 1000 * 60 * 60 * 24;
                                  const daysElapsed = Math.floor(
                                    (now - submitted) / msInDay
                                  );
                                  const daysLeft = Math.max(
                                    0,
                                    7 - daysElapsed
                                  );
                                  return `${daysLeft} days left`;
                                })()}
                            </span>
                          </div>
                        )}

                        {deal.fiftyFiftyPartner && (
                          <div
                            className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm font-bold shadow-lg border-2 text-center"
                            style={{
                              minWidth: 80,
                              maxWidth: 120,
                              background:
                                'linear-gradient(90deg, #99CC66 0%, #6FBF4A 100%)',
                              borderColor: '#6FBF4A',
                              color: '#1F3D1A',
                            }}
                          >
                            50/50 Partnership
                          </div>
                        )}

                        {isTurnkeyDeal(deal) && (
                          <div
                            className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm font-bold shadow-lg border-2 text-center flex flex-col items-center"
                            style={{
                              minWidth: 80,
                              maxWidth: 120,
                              background:
                                'linear-gradient(90deg, #84CC16 0%, #65A30D 100%)',
                              borderColor: '#84CC16',
                              color: '#1A2E05',
                            }}
                          >
                            <span>Turnkey</span>
                            <span className="text-xs font-normal">
                              Fully Furnished
                            </span>
                          </div>
                        )}
                      </div>
                      <ImageCarousel
                        images={deal.exteriorImages}
                        alt={`${deal.title} exterior`}
                        className="w-full h-96 rounded-lg overflow-hidden"
                        counterOnHover
                      />
                    </div>
                  </div>
                )}

              {/* Fallback: Show badges on interior images if no exterior images */}
              {(!Array.isArray(deal.exteriorImages) ||
                deal.exteriorImages.length === 0) &&
                Array.isArray(deal.interiorImages) &&
                deal.interiorImages.length > 0 && (
                  <div className="mb-6 relative">
                    <h1 className="text-2xl font-bold text-primary mb-2">
                      Interior Photos
                    </h1>
                    <div className="relative">
                      {/* Badges positioned over interior images (fallback) */}
                      <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex flex-col gap-1.5 sm:gap-2 z-20">
                        {deal.status === 'sold' && (
                          <div
                            className="text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm font-bold
                             flex flex-col items-center border-2 shadow-lg"
                            style={{
                              minWidth: 80,
                              maxWidth: 120,
                              border: '2px solid #DC2626',
                              background:
                                'linear-gradient(90deg, #DC2626 0%, #991B1B 100%)',
                              color: '#FFFFFF',
                            }}
                          >
                            <span className="text-sm sm:text-base font-bold">
                              SOLD
                            </span>
                            {deal.soldAt && (
                              <span className="text-xs font-normal">
                                {new Date(deal.soldAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        )}
                        {deal.priorityFirstAccess && (
                          <div
                            className="text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm font-bold
                             flex flex-col items-center border-2 shadow-lg"
                            style={{
                              minWidth: 80,
                              maxWidth: 120,
                              border: '2px solid #FFD166',
                              background:
                                'linear-gradient(90deg, #FFD166 0%, #E09F3E 100%)',
                              color: '#4B2E05',
                            }}
                          >
                            <span className="text-sm sm:text-base font-bold">
                              Premium
                            </span>
                            <span className="text-xs font-normal">
                              {deal.priorityCountdown
                                ? deal.priorityCountdown.type === 'days'
                                  ? `${deal.priorityCountdown.value} days left`
                                  : deal.priorityCountdown.type === 'hours'
                                    ? `${deal.priorityCountdown.value} hours left`
                                    : deal.priorityCountdown.type === 'minutes'
                                      ? `${deal.priorityCountdown.value} min left`
                                      : deal.priorityCountdown.type ===
                                        'expired'
                                        ? 'Expired'
                                        : ''
                                : (() => {
                                  const now = new Date();
                                  const submitted = deal.submittedAt
                                    ? new Date(deal.submittedAt)
                                    : null;
                                  if (!submitted) return '';
                                  const msInDay = 1000 * 60 * 60 * 24;
                                  const daysElapsed = Math.floor(
                                    (now - submitted) / msInDay
                                  );
                                  const daysLeft = Math.max(
                                    0,
                                    7 - daysElapsed
                                  );
                                  return `${daysLeft} days left`;
                                })()}
                            </span>
                          </div>
                        )}

                        {deal.fiftyFiftyPartner && (
                          <div
                            className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm font-bold shadow-lg border-2 text-center"
                            style={{
                              minWidth: 80,
                              maxWidth: 120,
                              background:
                                'linear-gradient(90deg, #99CC66 0%, #6FBF4A 100%)',
                              borderColor: '#6FBF4A',
                              color: '#1F3D1A',
                            }}
                          >
                            50/50 Partnership
                          </div>
                        )}

                        {isTurnkeyDeal(deal) && (
                          <div
                            className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm font-bold shadow-lg border-2 text-center flex flex-col items-center"
                            style={{
                              minWidth: 80,
                              maxWidth: 120,
                              background:
                                'linear-gradient(90deg, #84CC16 0%, #65A30D 100%)',
                              borderColor: '#84CC16',
                              color: '#1A2E05',
                            }}
                          >
                            <span>Turnkey</span>
                            <span className="text-xs font-normal">
                              Fully Furnished
                            </span>
                          </div>
                        )}
                      </div>
                      <ImageCarousel
                        images={deal.interiorImages}
                        alt={`${deal.title} interior`}
                        className="w-full h-96 rounded-lg overflow-hidden"
                        counterOnHover
                      />
                    </div>
                  </div>
                )}

              {/* Interior Photos (when exterior images exist) */}
              {Array.isArray(deal.exteriorImages) &&
                deal.exteriorImages.length > 0 &&
                Array.isArray(deal.interiorImages) &&
                deal.interiorImages.length > 0 && (
                  <div className="mb-6">
                    <h1 className="text-2xl font-bold text-primary mb-2">
                      Interior Photos
                    </h1>
                    <ImageCarousel
                      images={deal.interiorImages}
                      alt={`${deal.title} interior`}
                      className="w-full h-96 rounded-lg overflow-hidden"
                      counterOnHover
                    />
                  </div>
                )}

              {/* Additional Photos */}
              {Array.isArray(deal.additionalImages) &&
                deal.additionalImages.length > 0 && (
                  <div className="mb-6">
                    <h1 className="text-2xl font-bold text-primary mb-2">
                      Additional Photos
                    </h1>
                    <ImageCarousel
                      images={deal.additionalImages}
                      alt={`${deal.title} additional`}
                      className="w-full h-96 rounded-lg overflow-hidden"
                      counterOnHover
                    />
                  </div>
                )}
            </div>

            <div>
              <div className="mb-2">
                <span className="text-sm text-text-secondary font-semibold">
                  Published by: {deal.submitter?.name || 'Unknown'}
                  {deal.submitter?.userType && (
                    <span> ({getUserTypeLabel(deal.submitter.userType)})</span>
                  )}
                </span>
              </div>
              <h1 className="text-3xl font-bold text-primary mb-2">
                {deal.title}
              </h1>
              {/* --- Property Details --- */}
              <div className="mb-6 mt-4">
                <h2 className="font-semibold text-primary mb-3 text-xl">
                  Property Details
                </h2>
                <div className="flex flex-wrap gap-6 bg-app rounded-xl p-4 justify-between">
                  {show(deal.category) && (
                    <div>
                      <span className="text-text-secondary text-sm text-gray-500">Type</span>
                      <p className="font-semibold text-primary text-sm">
                        {PROPERTY_TYPE_LABELS[deal.category] ??
                          humanizeEnum(deal.category)}
                      </p>
                    </div>
                  )}

                  {show(deal.bedrooms) && (
                    <div>
                      <span className="text-text-secondary text-sm text-gray-500">
                        Bedrooms
                      </span>
                      <p className="text-xl font-semibold text-primary">
                        {deal.bedrooms}
                      </p>
                    </div>
                  )}
                  {show(deal.bathrooms) && (
                    <div>
                      <span className="text-text-secondary text-sm text-gray-500">
                        Bathrooms
                      </span>
                      <p className="text-xl font-semibold text-primary">
                        {deal.bathrooms}
                      </p>
                    </div>
                  )}
                  {show(deal.squareFootage) && (
                    <div>
                      <span className="text-text-secondary text-sm text-gray-500">
                        Square Footage
                      </span>
                      <p className="text-xl font-semibold text-primary">
                        {formatNumber(deal.squareFootage)} sqft
                      </p>
                    </div>
                  )}
                  {show(deal.yearBuilt) && (
                    <div>
                      <span className="text-text-secondary text-sm text-gray-500">
                        Year Built
                      </span>
                      <p className="text-xl font-semibold text-primary">
                        {deal.yearBuilt}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* --- Listing Info --- */}
              <div className="mb-6">
                <div className="flex flex-wrap gap-6">
                  {canViewAddress &&
                    (deal.streetAddress ||
                      deal.city ||
                      deal.stateRegion ||
                      deal.postalCode) && (
                      <div
                        className="w-full mb-2"
                        style={{ position: 'relative' }}
                      >
                        <span className="text-text-secondary text-sm block">
                          Address
                        </span>
                        <span
                          className="text-lg cursor-pointer select-none address-map-trigger block mt-1"
                          onClick={handleAddressClick}
                          title={
                            mapCoords || mapLoading || mapError
                              ? 'Click to hide map'
                              : 'Click to view on map'
                          }
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                        >
                          <span
                            style={{
                              textDecoration: 'none',
                              transition: 'text-decoration 0.2s',
                            }}
                            className="address-map-text"
                          >
                            {deal.streetAddress}
                            {deal.streetAddress ? ',' : ''} {deal.city}
                            {deal.city ? ',' : ''} {deal.stateRegion}{' '}
                            {deal.postalCode}
                          </span>
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: '1.1em',
                              color: '#888',
                            }}
                          >
                            ⓘ
                          </span>
                        </span>
                        <style>{`
                    .address-map-trigger .address-map-text {
                      text-decoration: none;
                    }
                    .address-map-trigger:hover .address-map-text {
                      text-decoration: underline !important;
                    }
                  `}</style>
                        {(mapLoading || mapError) && (
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: '100%',
                              zIndex: 10,
                              width: '100%',
                              maxWidth: 350,
                              background: 'white',
                            }}
                          >
                            {mapLoading && (
                              <div className="text-blue-600 w-full">
                                Loading map...
                              </div>
                            )}
                            {mapError && (
                              <div className="text-red-600 w-full">
                                {mapError}
                              </div>
                            )}
                          </div>
                        )}
                        {mapCoords && (
                          <div
                            className="border rounded overflow-hidden w-full"
                            style={{ maxWidth: 350, marginTop: 8 }}
                          >
                            {/* Render OSM map iframe */}
                            <OSMMap coords={mapCoords} />
                          </div>
                        )}
                      </div>
                    )}

                  {/* {show(deal.description) && (
                    <div className="w-full max-w-full overflow-hidden">
                      <span className="block font-semibold text-primary mb-3 text-xl">
                        Description1
                      </span>
                      
                    </div>
                  )} */}

                  <details className="focus:outline-none focus:ring-0 rounded-lg overflow-hidden border border-gray-200 w-full">
                    <summary className="cursor-pointer px-4 py-3 bg-panel font-semibold text-primary focus:outline-none">
                      Description
                    </summary>

                    <div className="p-4 space-y-8">
                      <p className="text-text-secondary whitespace-pre-wrap break-words max-w-full">
                        {deal.description}
                      </p>
                    </div>
                  </details>










                  <div className="flex flex-wrap gap-6 bg-app rounded-xl p-4 justify-between w-full">
                    {show(deal.price) && (
                      <div>
                        <span className="text-text-secondary text-sm text-gray-500">
                          Price
                        </span>
                        <p className="text-3xl font-extrabold text-primary">
                          ${formatPrice(deal.price)}
                        </p>
                      </div>
                    )}

                    {show(deal.isHOA) && (
                      <div>
                        <span className="text-text-secondary text-sm text-gray-500">
                          Is this property a part of an HOA?
                        </span>
                        <p className="text-xl font-semibold text-primary">
                          {deal.isHOA ? 'Yes' : 'No'}
                        </p>
                      </div>
                    )}

                    {deal.isHOA && show(deal.hoaMonthlyFee) && (
                      <div>
                        <span className="text-text-secondary text-sm text-gray-500">
                          HOA Monthly Fee
                        </span>
                        <p className="text-xl font-semibold text-primary">
                          ${formatPrice(deal.hoaMonthlyFee)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* --- Financing --- */}
              {hasAny(
                deal.financingType,
                deal.emd,
                deal.downPayment,
                deal.subjLoanBalance,
                deal.subjInterestRate,
                deal.subjLoanMaturity,
                deal.subjMonthlyPrincipal,
                deal.subjMonthlyInterest,
                deal.subjMonthlyTaxesInsurance,
                deal.sellerLoanAmount,
                deal.sellerInterestRate,
                deal.sellerLoanMaturity,
                deal.sellerMonthlyPayment,
                deal.totalMonthlyPayment,
                deal.strConfidence,
                deal.strMarketScore,
                deal.strOccupancyRate,
                deal.strAvgDailyRate,
                deal.strAnnualRevenue,
                deal.strOperatingExpenses,
                deal.strNetOperatingIncome,
                deal.turnkeyFurnished,
                deal.strListingLink,
                deal.strDataSheetsLink
              ) && (
                  <details className="mb-6 focus:outline-none focus:ring-0 rounded-lg overflow-hidden border border-gray-200">
                    <summary className="cursor-pointer px-4 py-3 bg-panel font-semibold text-primary focus:outline-none">
                      Financing & STR Details
                    </summary>

                    <div className="p-4 space-y-4">
                      {/* --- Financing --- */}
                      {hasAny(deal.financingType, deal.emd, deal.downPayment) && (
                        <div>
                          <div className="flex flex-wrap gap-6 border border-gray-200 rounded-lg p-4">
                            {show(deal.financingType) && (
                              <div>
                                <span className="text-text-secondary text-sm">
                                  Financing Type
                                </span>
                                <p className="text-lg font-semibold text-gray-900">
                                  {humanizeEnum(deal.financingType)}
                                </p>
                              </div>
                            )}
                            {show(deal.emd) && (
                              <div>
                                <span className="text-text-secondary text-sm">
                                  EMD
                                </span>
                                <p className="text-xl font-semibold text-primary">
                                  ${formatPrice(deal.emd)}
                                </p>
                              </div>
                            )}
                            {show(deal.downPayment) && (
                              <div>
                                <span className="text-text-secondary text-sm">
                                  Down Payment
                                </span>
                                <p className="text-lg font-semibold text-gray-900">
                                  ${formatPrice(deal.downPayment)}
                                </p>
                              </div>
                            )}
                            {show(deal.totalMonthlyPayment) && (
                              <div>
                                <span className="text-text-secondary text-sm">
                                  Total Monthly Payment
                                </span>
                                <p className="text-lg font-semibold text-gray-900">
                                  ${formatPrice(deal.totalMonthlyPayment)}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* --- Subject-to Loan Info --- */}
                      {hasAny(
                        deal.subjLoanBalance,
                        deal.subjInterestRate,
                        deal.subjLoanMaturity,
                        deal.subjMonthlyPrincipal,
                        deal.subjMonthlyInterest,
                        deal.subjMonthlyTaxesInsurance
                      ) && (
                          <div className="border border-gray-200 rounded-lg p-4">
                            <h2 className="mb-1 font-semibold text-gray-900">
                              Subject-to Loan Info
                            </h2>
                            <div className="flex flex-wrap gap-6">
                              {show(deal.subjLoanBalance) && (
                                <div>
                                  <span className="text-text-secondary text-sm">
                                    Loan Balance
                                  </span>
                                  <p className="text-lg font-semibold text-gray-900">
                                    ${formatPrice(deal.subjLoanBalance)}
                                  </p>
                                </div>
                              )}
                              {show(deal.subjInterestRate) && (
                                <div>
                                  <span className="text-text-secondary text-sm">
                                    Interest Rate
                                  </span>
                                  <p className="text-lg font-semibold text-gray-900">
                                    {deal.subjInterestRate}%
                                  </p>
                                </div>
                              )}
                              {show(deal.subjLoanMaturity) && (
                                <div>
                                  <span className="text-text-secondary text-sm">
                                    Loan Maturity
                                  </span>
                                  <p className="text-lg font-semibold text-gray-900">
                                    {deal.subjLoanMaturity}
                                  </p>
                                </div>
                              )}
                              {show(deal.subjMonthlyPrincipal) && (
                                <div>
                                  <span className="text-text-secondary text-sm">
                                    Monthly Principal
                                  </span>
                                  <p className="text-xl font-semibold text-primary">
                                    ${formatPrice(deal.subjMonthlyPrincipal)}
                                  </p>
                                </div>
                              )}
                              {show(deal.subjMonthlyInterest) && (
                                <div>
                                  <span className="text-text-secondary text-sm">
                                    Monthly Interest
                                  </span>
                                  <p className="text-xl font-semibold text-primary">
                                    ${formatPrice(deal.subjMonthlyInterest)}
                                  </p>
                                </div>
                              )}
                              {show(deal.subjMonthlyTaxesInsurance) && (
                                <div>
                                  <span className="text-text-secondary text-sm">
                                    Monthly Taxes & Insurance
                                  </span>
                                  <p className="text-xl font-semibold text-primary">
                                    ${formatPrice(deal.subjMonthlyTaxesInsurance)}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                      {/* --- Seller Financing Info --- */}
                      {hasAny(
                        deal.sellerLoanAmount,
                        deal.sellerInterestRate,
                        deal.sellerLoanMaturity,
                        deal.sellerMonthlyPayment,
                        deal.totalMonthlyPayment
                      ) && (
                          <div>
                            <h2 className="font-semibold text-primary mb-3">
                              Seller Financing Info
                            </h2>
                            <div className="flex flex-wrap gap-6">
                              {show(deal.sellerLoanAmount) && (
                                <div>
                                  <span className="text-text-secondary text-sm">
                                    Loan Amount
                                  </span>
                                  <p className="text-xl font-semibold text-primary">
                                    ${formatPrice(deal.sellerLoanAmount)}
                                  </p>
                                </div>
                              )}
                              {show(deal.sellerInterestRate) && (
                                <div>
                                  <span className="text-text-secondary text-sm">
                                    Interest Rate
                                  </span>
                                  <p className="text-xl font-semibold text-primary">
                                    {deal.sellerInterestRate}%
                                  </p>
                                </div>
                              )}
                              {show(deal.sellerLoanMaturity) && (
                                <div>
                                  <span className="text-text-secondary text-sm">
                                    Loan Maturity
                                  </span>
                                  <p className="text-xl font-semibold text-primary">
                                    {deal.sellerLoanMaturity}
                                  </p>
                                </div>
                              )}
                              {show(deal.sellerMonthlyPayment) && (
                                <div>
                                  <span className="text-text-secondary text-sm">
                                    Monthly Payment
                                  </span>
                                  <p className="text-xl font-semibold text-primary">
                                    ${formatPrice(deal.sellerMonthlyPayment)}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                      {/* --- STR Data --- */}
                      {hasAny(
                        deal.strConfidence,
                        deal.strMarketScore,
                        deal.strOccupancyRate,
                        deal.strAvgDailyRate,
                        deal.strAnnualRevenue,
                        deal.strOperatingExpenses,
                        deal.strNetOperatingIncome,
                        deal.turnkeyFurnished
                      ) && (
                          <div className="border border-gray-200 rounded-lg p-4">
                            <h2 className="mb-1 font-semibold text-gray-900">
                              Short-Term Rental (STR) Data
                            </h2>
                            <div className="flex flex-wrap gap-6">
                              {show(deal.strConfidence) && (
                                <div>
                                  {' '}
                                  <span className="text-text-secondary text-sm">
                                    {' '}
                                    STR Confidence{' '}
                                  </span>{' '}
                                  <p className="text-lg font-semibold text-gray-900">
                                    {' '}
                                    {humanizeEnum(deal.strConfidence)}{' '}
                                  </p>{' '}
                                </div>
                              )}{' '}
                              {show(deal.strZoning) && (
                                <div>
                                  <span className="text-text-secondary text-sm">
                                    STR Zoning
                                  </span>
                                  <p className="text-lg font-semibold text-gray-900">
                                    {humanizeEnum(deal.strZoning)}
                                  </p>
                                </div>
                              )}
                              {show(deal.occupancyRate) && (
                                <Metric
                                  label="Occupancy Rate"
                                  value={`${deal.occupancyRate}%`}
                                />
                              )}
                              {show(deal.averageNightlyRate) && (
                                <Metric
                                  label="Average Nightly Rate"
                                  value={`$${formatPrice(deal.averageNightlyRate)}`}
                                />
                              )}
                              {show(deal.turnkeyFurnished) && (
                                <div>
                                  {' '}
                                  <span className="text-text-secondary text-sm">
                                    {' '}
                                    Turnkey/Furnished{' '}
                                  </span>{' '}
                                  <p className="text-lg font-semibold text-gray-900">
                                    {' '}
                                    {humanizeEnum(deal.turnkeyFurnished)}{' '}
                                  </p>{' '}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                      {/* --- STR Links --- */}
                      {hasAny(deal.strListingLink, deal.strDataSheetsLink) && (
                        <div>
                          <h2 className="font-semibold text-primary mb-3">
                            STR Links
                          </h2>

                          <div className="flex flex-col gap-2 text-sm">
                            {deal.strListingLink && (
                              <div className="flex flex-wrap gap-1">
                                <span className="font-medium text-text-secondary">
                                  Listing:
                                </span>
                                {/* <a
                                  href={isValidUrl(deal.strListingLink) ? deal.strListingLink : "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-700 underline break-all"
                                >
                                  {deal.strListingLink}
                                </a> */}
                                <a
                                  href={isValidUrl(deal.strListingLink) ? deal.strListingLink : "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => {
                                    if (!isValidUrl(deal.strListingLink)) {
                                      e.preventDefault();
                                    }
                                  }}
                                  className="text-blue-700 underline break-all"
                                >
                                  {deal.strListingLink}
                                </a>
                              </div>
                            )}

                            {deal.strDataSheetsLink && (
                              <div className="flex flex-wrap gap-1">
                                <span className="font-medium text-text-secondary">
                                  Data Sheets:
                                </span>
                                {/* <a
                                  href={isValidUrl(deal.strDataSheetsLink) ? deal.strDataSheetsLink : "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-700 underline break-all"
                                >
                                  {deal.strDataSheetsLink}
                                </a> */}
                                <a
                                  href={isValidUrl(deal.strDataSheetsLink) ? deal.strDataSheetsLink : "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => {
                                    if (!isValidUrl(deal.strDataSheetsLink)) {
                                      e.preventDefault();
                                    }
                                  }}
                                  className="text-blue-700 underline break-all"
                                >
                                  {deal.strDataSheetsLink}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </details>
                )}

              {/* --- Market & Investment Analysis --- */}
              {hasAnyValue(
                deal.underwritingMarketType,
                deal.underwritingMarketSize,
                deal.anr_budget,
                deal.egr_budget,
                deal.marketAnalysisLink,
                deal.comp_1_link
              ) && (
                  <details className="mb-6 rounded-lg overflow-hidden border border-gray-200">
                    <summary className="cursor-pointer px-4 py-3 bg-panel font-semibold text-primary">
                      Market & Investment Analysis
                    </summary>

                    <div className="p-6 space-y-4">
                      {/* Market Context */}
                      {hasAnyValue(
                        deal.underwritingMarketType,
                        deal.underwritingMarketSize
                      ) && (
                          <section className="space-y-2 border border-gray-200 rounded-lg p-4">
                            <h4 className="font-semibold text-gray-900 mb-3">
                              Market Context
                            </h4>

                            <div className="flex flex-wrap gap-6">
                              {show(deal.underwritingMarketType) && (
                                <div>
                                  <span className="text-text-secondary text-sm">
                                    Market Type
                                  </span>
                                  <p className="text-lg font-semibold text-gray-900">
                                    {humanizeEnum(deal.underwritingMarketType)}
                                  </p>
                                </div>
                              )}

                              {show(deal.underwritingMarketSize) && (
                                <div>
                                  <span className="text-text-secondary text-sm">
                                    Market Size
                                  </span>
                                  <p className="text-lg font-semibold text-gray-900">
                                    {deal.underwritingMarketSize}
                                  </p>
                                </div>
                              )}
                            </div>
                          </section>
                        )}

                      {/* Average Nightly Rate */}
                      {hasAnyValue(
                        deal.anr_budget,
                        deal.anr_economy,
                        deal.anr_midscale,
                        deal.anr_upscale,
                        deal.anr_luxury
                      ) && (
                          <TieredMetric
                            title="Average Nightly Rate (ANR)"
                            unit="$"
                            data={{
                              Budget: deal.anr_budget,
                              Economy: deal.anr_economy,
                              Midscale: deal.anr_midscale,
                              Upscale: deal.anr_upscale,
                              Luxury: deal.anr_luxury,
                            }}
                          />
                        )}

                      {/* Estimated Gross Revenue */}
                      {hasAnyValue(
                        deal.egr_budget,
                        deal.egr_economy,
                        deal.egr_midscale,
                        deal.egr_upscale,
                        deal.egr_luxury
                      ) && (
                          <TieredMetric
                            title="Estimated Gross Revenue (Potential)"
                            unit="$"
                            data={{
                              Budget: deal.egr_budget,
                              Economy: deal.egr_economy,
                              Midscale: deal.egr_midscale,
                              Upscale: deal.egr_upscale,
                              Luxury: deal.egr_luxury,
                            }}
                          />
                        )}

                      {/* Market Analysis Worksheet */}
                      {show(deal.marketAnalysisLink) && (
                        <section className="space-y-2">
                          <h4 className="font-semibold text-primary">
                            Market Analysis & Investment Worksheet
                          </h4>

                          <a
                            href={deal.marketAnalysisLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline text-sm"
                          >
                            View Market Analysis Worksheet
                          </a>
                        </section>
                      )}

                      {/* Top Properties (Comps) */}
                      {hasAnyValue(
                        deal.comp_1_link,
                        deal.comp_2_link,
                        deal.comp_3_link,
                        deal.comp_4_link,
                        deal.comp_5_link,
                        deal.comp_6_link
                      ) && (
                          <section className="space-y-4">
                            <div className="space-y-1">
                              <h4 className="font-semibold text-primary">
                                Top Properties (Comps)
                              </h4>

                              <p className="text-sm text-text-secondary">
                                These properties represent top-performing listings
                                in the area and are shown to illustrate
                                <span className="font-semibold">
                                  {' '}
                                  potential gross revenue{' '}
                                </span>
                                if this property were positioned at the top of the
                                market.
                              </p>

                              <p className="text-xs italic text-text-secondary">
                                This does NOT suggest that this property in its
                                current condition will achieve these results. These
                                examples are for illustrative purposes only.
                              </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {[1, 2, 3, 4, 5, 6].map((num) => {
                                const link = deal[`comp_${num}_link`];
                                const revenue = deal[`comp_${num}_grossRevenue`];

                                if (!link && !revenue) return null;

                                return (
                                  <div
                                    key={num}
                                    className="border rounded-lg p-4 space-y-1 border-gray-200"
                                  >
                                    <span className="text-sm text-text-secondary">
                                      Property {num}
                                    </span>

                                    {link && (
                                      <a
                                        href={link.includes(' ') ? '#' : link}
                                        {...(!link.includes(' ') && { target: '_blank', rel: 'noopener noreferrer' })}
                                        className="block text-primary underline text-sm truncate"
                                      >
                                        View Listing
                                      </a>
                                    )}

                                    <p className="text-sm">
                                      <span className="text-text-secondary">
                                        Gross Revenue:
                                      </span>{' '}
                                      <span className="font-semibold text-primary">
                                        ${formatPrice(revenue)}
                                      </span>
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </section>
                        )}
                      {/* --- Underwriting Images --- */}
                      {Array.isArray(deal.underwritingImages) &&
                        deal.underwritingImages.length > 0 && (
                          <section className="space-y-1 pt-2 border-t border-border-subtle">
                            <h4 className="font-semibold text-primary">
                              Underwriting Materials
                            </h4>

                            <p className="mt-4 text-sm text-text-secondary">
                              Supporting screenshots, analyses, and reference
                              materials used during underwriting.
                            </p>

                            <div className="flex justify-center">
                              <div className="w-full max-w-sm">
                                <ImageCarousel
                                  images={deal.underwritingImages}
                                  alt={`${deal.title} underwriting`}
                                  className="w-full aspect-square rounded-md overflow-hidden"
                                  counterOnHover
                                />
                              </div>
                            </div>
                          </section>
                        )}
                    </div>
                  </details>
                )}

              {hasAnyValue(
                deal.travelMotivations?.length,
                deal.vacationRentalMarkets?.length,
                deal.guestDemandInsights,
                deal.valueAddOpportunities,
                deal.localAttractions,
                deal.amenities,
                deal.localContacts
              ) && (
                  <details className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
                    <summary className="cursor-pointer px-4 py-3 bg-panel font-semibold text-primary">
                      Market Context & Demand
                    </summary>

                    <div className="p-4 space-y-4">
                      {deal.travelMotivations?.length > 0 && (
                        <TagSection
                          title="Why People Travel Here"
                          tags={deal.travelMotivations}
                        />
                      )}

                      {deal.vacationRentalMarkets?.length > 0 && (
                        <TagSection
                          title="Vacation Rental Markets"
                          tags={(deal.vacationRentalMarkets || []).map(
                            (m) => VACATION_RENTAL_MARKET_LABELS[m] || m
                          )}
                        />
                      )}

                      {show(deal.guestDemandInsights) && (
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-1">
                            Guest Demand Insights
                          </h3>
                          <p className="text-gray-700 whitespace-pre-wrap">
                            {deal.guestDemandInsights}
                          </p>
                        </div>
                      )}

                      {show(deal.valueAddOpportunities) && (
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-1">
                            Value-Add Opportunities
                          </h3>
                          <p className="text-gray-700 whitespace-pre-wrap">
                            {deal.valueAddOpportunities}
                          </p>
                        </div>
                      )}

                      {show(deal.localAttractions) && (
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-1">
                            Local Attractions
                          </h3>
                          <p className="text-gray-700 whitespace-pre-wrap">
                            {deal.localAttractions}
                          </p>
                        </div>
                      )}

                      {show(deal.amenities) && (
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-1">
                            Amenities
                          </h3>
                          <p className="text-gray-700 whitespace-pre-wrap">
                            {deal.amenities}
                          </p>
                        </div>
                      )}

                      {show(deal.localContacts) && (
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-1">
                            Local Contacts
                          </h3>
                          <p className="text-gray-700 whitespace-pre-wrap">
                            {deal.localContacts}
                          </p>
                        </div>
                      )}
                    </div>
                  </details>
                )}

              {/* --- Additional Info --- */}
              {show(deal.additionalInfo) && (
                <div className="mb-6">
                  <h2 className="font-semibold text-gray-900 mb-3">
                    Additional Info
                  </h2>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {deal.additionalInfo}
                  </p>
                </div>
              )}

              <div className="mt-6 text-sm text-gray-500">
                <p>
                  Published:{' '}
                  {new Date(
                    deal.publishedAt || deal.submittedAt
                  ).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { DealDetailView };
export default CustomerView;
