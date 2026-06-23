import { useState, useRef, useEffect } from 'react';
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
import { formatNumber, unformatNumber } from '../utils/format';
import '../styles/main.css';
import DealDetailView from './DealDetailView';
import DealCard, {
  hasValue,
  isTurnkeyDeal,
  getDealImages,
  normalizeTurnkey,
  PROPERTY_TYPES,
  SORT_OPTIONS,
  FINANCING_OPTIONS,
} from '../components/DealCard';


const hasAnyValue = (...values) => values.some(hasValue);
const hasAnyObjectValue = (obj) => Object.values(obj).some(hasValue);

const formatPrice = (price) => parseInt(parseFloat(price)).toLocaleString('en-US');

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
     selectedStatuses: ['published', 'sold', 'pending'],
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
	selectedStatuses: filters.selectedStatuses?.length > 0 ? filters.selectedStatuses : null,

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
          navigate(location.state?.from === 'admin-properties' ? '/admin/properties' : '/deal-details');
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
                  navigate(`/deal-details/${deal.id}`, { state: { from: '/deals' } });
                }}
                favorites={favorites}
                addFavoriteMutation={addFavoriteMutation}
                removeFavoriteMutation={removeFavoriteMutation}
				showFilterSidebar={showFilterSidebar}
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
	  selectedStatuses: ['published', 'sold', 'pending'],
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



export { DealDetailView };
export default CustomerView;

