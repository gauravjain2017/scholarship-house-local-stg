import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getFavorites, addFavorite, removeFavorite } from '../api/favorites';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { dealsAPI } from '../api/deals';
import { useAuthSafe } from '../contexts/AuthContext';
import logoDarkBlue from '../assets/icons/logo-scholarship-house/logo-dark-blue.png';
import Button from '../components/Button';
import Loader from '../components/Loader';
import FilterBar from '../components/FilterBar';
import DealCard, {
  hasValue,
  isTurnkeyDeal,
  getDealImages,
  normalizeTurnkey,
  PROPERTY_TYPES,
  SORT_OPTIONS,
  FINANCING_OPTIONS,
} from '../components/DealCard';

// ─── CustomerView ─────────────────────────────────────────────────────────────

const CustomerView = () => {
  const { user, isAuthenticated } = useAuthSafe();
  const canViewAddress = user?.role === 'admin' || user?.role === 'team_member';
  const navigate = useNavigate();
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
    advBedroomsMin: '',
    advBedroomsMax: '',
    advBathroomsMin: '',
    advBathroomsMax: '',
    advSqftMin: '',
    advSqftMax: '',
    advYearBuiltMin: '',
    advYearBuiltMax: '',
    advFinancing: '',
    advMonthlyPaymentMax: '',
    isHOA: false,
    hoaMonthlyFeeMax: '',
    strZoning: '',
    strConfidence: '',
    turnkey: false,
    occupancyRateMin: '',
    occupancyRateMax: '',
    avgNightlyRateMin: '',
    avgNightlyRateMax: '',
    priorityFirstAccess: false,
    fiftyFiftyPartner: false,
    doneForYou: false,
    vacationRentalMarkets: [],
    travelMotivations: [],
  });

  const [showPriceCard, setShowPriceCard] = useState(false);
  const [showPropertyTypeCard, setShowPropertyTypeCard] = useState(false);
  const [showSortByCard, setShowSortByCard] = useState(false);
  const [showAdvancedCard, setShowAdvancedCard] = useState(false);
  const priceCardRef = useRef(null);
  const propertyTypeCardRef = useRef(null);
  const sortByCardRef = useRef(null);
  const advCardRef = useRef(null);

  useEffect(() => {
    function handleClick(event) {
      if (showPriceCard && priceCardRef.current && !priceCardRef.current.contains(event.target))
        setShowPriceCard(false);
      if (showPropertyTypeCard && propertyTypeCardRef.current && !propertyTypeCardRef.current.contains(event.target))
        setShowPropertyTypeCard(false);
      if (showSortByCard && sortByCardRef.current && !sortByCardRef.current.contains(event.target))
        setShowSortByCard(false);
      if (showAdvancedCard && advCardRef.current && !advCardRef.current.contains(event.target))
        setShowAdvancedCard(false);
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
  };

  const { data: deals, isLoading } = useQuery({
    queryKey: ['publishedDeals', normalizedFilters],
    queryFn: () => dealsAPI.getPublishedDeals(normalizedFilters),
    staleTime: 0,
    keepPreviousData: true,
  });

  const queryClient = useQueryClient();

  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites'],
    queryFn: getFavorites,
    enabled: isAuthenticated,
  });

  const [optimisticFavorites, setOptimisticFavorites] = useState(new Set());
  const favoriteSet = new Set(favorites);
  optimisticFavorites.forEach((id) => favoriteSet.add(id));

  const addFavoriteMutation = useMutation({
    mutationFn: addFavorite,
    onMutate: async (propertyId) => {
      setOptimisticFavorites((prev) => { const next = new Set(prev); next.add(propertyId); return next; });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['favorites'] }); },
    onError: (_err, propertyId) => {
      setOptimisticFavorites((prev) => { const next = new Set(prev); next.delete(propertyId); return next; });
    },
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: removeFavorite,
    onMutate: async (propertyId) => {
      setOptimisticFavorites((prev) => { const next = new Set(prev); next.delete(propertyId); return next; });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['favorites'] }); },
  });

  // ── Filter only favorited deals ──────────────────────────────────────────
  const filteredDeals = (deals || []).filter((deal) => {
    // Only show favorited deals
    if (!favoriteSet.has(deal.id)) return false;

    if (filters.propertyType !== 'All' && deal.category !== filters.propertyType) return false;
    if (filters.search && !`${deal.title} ${deal.description}`.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.city && deal.city?.toLowerCase() !== filters.city.toLowerCase()) return false;
    if (filters.stateRegion && deal.stateRegion?.toLowerCase() !== filters.stateRegion.toLowerCase()) return false;
    if (filters.postalCode && deal.postalCode !== filters.postalCode) return false;
    if (filters.minPrice && Number(deal.price) < Number(filters.minPrice)) return false;
    if (filters.maxPrice && Number(deal.price) > Number(filters.maxPrice)) return false;
    if (filters.advFinancing && deal.financingType !== filters.advFinancing) return false;
    if (filters.advYearBuiltMin && Number(deal.yearBuilt) < Number(filters.advYearBuiltMin)) return false;
    if (filters.advYearBuiltMax && Number(deal.yearBuilt) > Number(filters.advYearBuiltMax)) return false;
    if (filters.isHOA && !deal.isHOA) return false;
    if (filters.hoaMonthlyFeeMin && Number(deal.hoaMonthlyFee) < Number(filters.hoaMonthlyFeeMin)) return false;
    if (filters.hoaMonthlyFeeMax && Number(deal.hoaMonthlyFee) > Number(filters.hoaMonthlyFeeMax)) return false;
    if (filters.advBedroomsMin && Number(deal.bedrooms) < Number(filters.advBedroomsMin)) return false;
    if (filters.advBedroomsMax && Number(deal.bedrooms) > Number(filters.advBedroomsMax)) return false;
    if (filters.advBathroomsMin && Number(deal.bathrooms) < Number(filters.advBathroomsMin)) return false;
    if (filters.advBathroomsMax && Number(deal.bathrooms) > Number(filters.advBathroomsMax)) return false;
    if (filters.advSqftMin && Number(deal.squareFootage) < Number(filters.advSqftMin)) return false;
    if (filters.advSqftMax && Number(deal.squareFootage) > Number(filters.advSqftMax)) return false;
    if (filters.advMonthlyPaymentMax && Number(deal.totalMonthlyPayment) > Number(filters.advMonthlyPaymentMax)) return false;
    if (filters.strZoning && deal.strZoning?.toUpperCase() !== filters.strZoning) return false;
    if (filters.advShortTerm && normalizeTurnkey(deal.turnkeyFurnished) !== 'TURNKEY_OPERATING') return false;
    if (filters.strConfidence && deal.strConfidence?.toUpperCase().replace(/\s+/g, '_') !== filters.strConfidence) return false;
    if (filters.turnkey && !isTurnkeyDeal(deal)) return false;
    if (filters.doneForYou && !deal.doneForYou) return false;
    if (filters.fiftyFiftyPartner && !deal.fiftyFiftyPartner) return false;
    if (filters.fiftyFiftyPreApproved && !deal.fiftyFiftyPreApproved) return false;
    if (filters.occupancyRateMin && Number(deal.occupancyRate) < Number(filters.occupancyRateMin)) return false;
    if (filters.occupancyRateMax && Number(deal.occupancyRate) > Number(filters.occupancyRateMax)) return false;
    if (filters.avgNightlyRateMin && Number(deal.averageNightlyRate) < Number(filters.avgNightlyRateMin)) return false;
    if (filters.avgNightlyRateMax && Number(deal.averageNightlyRate) > Number(filters.avgNightlyRateMax)) return false;
    if (filters.underwritingMarketType && deal.underwritingMarketType !== filters.underwritingMarketType) return false;
    if (filters.underwritingMarketSize && deal.underwritingMarketSize !== filters.underwritingMarketSize) return false;
    if (filters.amenities?.length && !filters.amenities.every((a) => deal.amenities?.includes(a))) return false;
    if (filters.vacationRentalMarkets?.length && !filters.vacationRentalMarkets.every((m) => deal.vacationRentalMarkets?.includes(m))) return false;
    if (filters.specialTags?.length && !filters.specialTags.every((t) => deal.specialTags?.includes(t))) return false;
    if (filters.localAttractions?.length && !filters.localAttractions.every((l) => deal.localAttractions?.includes(l))) return false;
    if (filters.travelMotivations?.length && !filters.travelMotivations.every((m) => deal.travelMotivations?.includes(m))) return false;
    if (filters.priorityFirstAccess && !deal.priorityFirstAccess) return false;
    return true;
  });

  const sortFn = (a, b) => {
    switch (filters.sortBy) {
      case 'oldest': return new Date(a.publishedAt) - new Date(b.publishedAt);
      case 'price-low': return Number(a.discountedPrice) - Number(b.discountedPrice);
      case 'price-high': return Number(b.discountedPrice) - Number(a.discountedPrice);
      case 'discount': return Number(b.discountPercentage) - Number(a.discountPercentage);
      case 'newest':
      default: return new Date(b.publishedAt) - new Date(a.publishedAt);
    }
  };

  const sortedDeals = [...filteredDeals].sort(sortFn);
  const totalPages = Math.ceil(sortedDeals.length / dealsPerPage);
  const paginatedDeals = sortedDeals.slice(
    (currentPage - 1) * dealsPerPage,
    currentPage * dealsPerPage
  );

  return (
    <div className="bg-app min-h-screen">
      <div className="mb-2">
        <div className="bg-surface p-4 mb-4 pt-10 pb-10">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-1">
            <div />
            <div className="flex items-center justify-center gap-3">
              <img src={logoDarkBlue} alt="Scholarship House" className="h-14 w-auto opacity-80" />
              <h1 className="text-3xl md:text-4xl font-bold text-primary">Favorite Properties</h1>
            </div>
            <div />
          </div>
          <p className="text-center text-text-secondary mb-2">Your saved favorite properties</p>
          <div className="h-1 w-20 bg-accent rounded-full mx-auto" />
        </div>
      </div>

      <div className="container mx-auto pt-2 pb-8 px-4 lg:px-4">
        {/* Filters */}
        {/* <div className="container mb-6">
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
          />
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">
              Showing {paginatedDeals.length} of {sortedDeals.length} favorite propert{sortedDeals.length !== 1 ? 'ies' : 'y'}
            </p>
            <Button
              className="bg-gray-100 border-gray-200 text-gray-700 hover:bg-[#e5e7eb] focus:outline-none focus:ring-0"
              size="sm"
              variant="outline"
              onClick={() => {
                setFilters({
                  propertyType: 'All', search: '', sortBy: 'newest',
                  minPrice: '', maxPrice: '', downPayment: '',
                  city: '', stateRegion: '', postalCode: '',
                  advFinancing: '', advMonthlyPaymentMax: '',
                  isHOA: false, hoaMonthlyFeeMin: '', hoaMonthlyFeeMax: '',
                  advBedroomsMin: '', advBedroomsMax: '',
                  advBathroomsMin: '', advBathroomsMax: '',
                  advSqftMin: '', advSqftMax: '',
                  advYearBuiltMin: '', advYearBuiltMax: '',
                  strZoning: '', strConfidence: '',
                  occupancyRateMin: '', occupancyRateMax: '',
                  avgNightlyRateMin: '', avgNightlyRateMax: '',
                  turnkey: false, advShortTerm: false,
                  priorityFirstAccess: false, fiftyFiftyPartner: false, doneForYou: false,
                  vacationRentalMarkets: [], travelMotivations: [], specialTags: [],
                });
                setCurrentPage(1);
              }}
            >
              Clear Filters
            </Button>
          </div>
        </div> */}



<div className="container mb-3 flex items-center justify-between">
  
  {/* Left Side */}
  <div className="flex items-center md:gap-2 gap-1">
<span className="text-sm text-gray-500 font_12">
    Showing {paginatedDeals.length} of {sortedDeals.length} favorite propert
    {sortedDeals.length !== 1 ? 'ies' : 'y'}
  </span>
  </div>

 

</div>

        {isLoading ? (
          <Loader />
        ) : sortedDeals.length === 0 ? (
          <div className="bg-surface border border-border-subtle rounded-2xl shadow-sm p-12 text-center">
            <p className="text-text-secondary text-lg">
              {favorites.length === 0
                ? 'You have no favorite properties yet. Browse properties and star the ones you like!'
                : 'No favorite properties found matching your criteria.'}
            </p>
          </div>
        ) : (
          <>
            {/* FAVORITES GRID */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5 mb-8">
              {paginatedDeals.map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  onClick={() => {
                    window.scrollTo(0, 0);
                    navigate(`/deal-details/${deal.id}`, { state: { from: '/favorite-properties' } });
                  }}
                  favorites={favorites}
                  addFavoriteMutation={addFavoriteMutation}
                  removeFavoriteMutation={removeFavoriteMutation}
                />
              ))}
            </div>

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
      </div>
    </div>
  );
};

export default CustomerView;
