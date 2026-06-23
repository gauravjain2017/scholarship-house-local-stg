import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { dealsAPI } from '../api/deals';
import { useAuthSafe } from './AuthContext';

export const DEFAULT_CUSTOMER_FILTERS = {
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
  selectedStatuses: [],
  vacationRentalMarkets: [],
  travelMotivations: [],
};

const CustomerFiltersContext = createContext(null);

export function CustomerFiltersProvider({ children }) {
  const { isAuthenticated, user } = useAuthSafe();

  const [filters, setFilters] = useState(DEFAULT_CUSTOMER_FILTERS);
  const [hasSavedBuyBox, setHasSavedBuyBox] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [savedFiltersSnapshot, setSavedFiltersSnapshot] = useState(null);


  // Run the saved-buy-box merge at most once per session. Without this guard,
  // navigating back to /deals would re-fetch and clobber any in-progress edits.
  const loadedSavedFiltersRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (loadedSavedFiltersRef.current) return;
    loadedSavedFiltersRef.current = true;

    (async () => {
      try {
        const res = await dealsAPI.getFilter();
        if (res?.data?.filters_json) {
          setFilters((prev) => ({ ...prev, ...res.data.filters_json }));
          setHasSavedBuyBox(true);
          setSavedFiltersSnapshot({ ...DEFAULT_CUSTOMER_FILTERS, ...res.data.filters_json }); 

        }
      } catch (err) {
        console.error('Failed to fetch saved filters:', err);
      }
    })();
  }, [isAuthenticated]);

  // Reset on logout / user switch so one user's filters don't leak to another.
  useEffect(() => {
    if (!user) {
      setFilters(DEFAULT_CUSTOMER_FILTERS);
      setHasSavedBuyBox(false);
      setCurrentPage(1);
      setSavedFiltersSnapshot(null);
      loadedSavedFiltersRef.current = false;
    }
  }, [user]);

  return (
    <CustomerFiltersContext.Provider
      value={{
        filters,
        setFilters,
        hasSavedBuyBox,
        setHasSavedBuyBox,
        currentPage,
        setCurrentPage,
        savedFiltersSnapshot,
        setSavedFiltersSnapshot,
      }}
    >
      {children}
    </CustomerFiltersContext.Provider>
  );
}

export function useCustomerFilters() {
  const ctx = useContext(CustomerFiltersContext);
  if (!ctx) {
    throw new Error('useCustomerFilters must be used inside <CustomerFiltersProvider>');
  }
  return ctx;
}
