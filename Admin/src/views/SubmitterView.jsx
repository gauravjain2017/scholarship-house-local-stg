import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dealsAPI } from '../api/deals';
import { draftsAPI } from '../api/drafts';
import { submittersAPI } from '../api/submitters';
import { disputesAPI } from '../api/disputes';
import { getAdminUsers } from '../api/admin';
import {
  getPresignedUploadUrl,
  uploadFileToS3WithProgress,
} from '../api/upload';
import { validateDealForm } from '../utils/validateDealForm';
import Input from '../components/Input';
import { formatPhoneDisplay, unformatPhone, formatNumber, unformatNumber, sanitizePercent } from '../utils/format';
import Button from '../components/Button';
import UploadProgressBar from '../components/UploadProgressBar';
import { normalizeMediaArray } from '../utils/uploadFiles';
import Modal from '../components/Modal';
import Loader from '../components/Loader';
import DuplicateAddressModal from '../components/DuplicateAddressModal';
import ProofUploadModal from '../components/ProofUploadModal';
import NotificationModal from '../components/NotificationModal';
import { useAuth } from '../contexts/AuthContext';
import { deriveTurnkey } from '../utils/turnkey';
import { validateStep } from '../utils/validateStep';
import StepIndicator from '../components/submitter/StepIndicator';
import PropertyInformationSection from '../components/submitter/PropertyInformationSection';
import LocationSection from '../components/submitter/LocationSection';
import FinancialInformationSection from '../components/submitter/FinancialInformationSection';
import RentalDataSection from '../components/submitter/RentalDataSection';
import MarketMotivationSection from '../components/submitter/MarketMotivationSection';
import AmenitiesAttractionsSection from '../components/submitter/AmenitiesAttractionsSection';
import PropertyMediaSection from '../components/submitter/PropertyMediaSection';
import ReviewSection from '../components/submitter/ReviewSection';

const USER_TYPE_OPTIONS = [
  { value: 'SUBMITTER', label: 'Submitter' },
  { value: 'REAL_ESTATE_PROFESSIONAL', label: 'Real Estate Professional' },
  { value: 'BIRDDOGGER', label: 'Bird Dogger' },
  { value: 'WHOLESALER', label: 'Wholesaler' },
  { value: 'REALTOR', label: 'Realtor' },
];


const SubmitterView = () => {
  const { user, hasRole } = useAuth();
  const [specialistUsers, setAcquisitionSpecialistUsers] = useState([]);
  const [submitterUsers, setSubmitterUsers] = useState([]);
  const [selectedSubmitterUser, setSelectedSubmitterUser] = useState('');
  const [selectedSpecialistUser, setSelectedSpecialistUser] = useState('');
  // console.log('User : ',user?.role)
  const queryClient = useQueryClient();
  const canSubmitOnBehalf =
    hasRole('admin') || hasRole('validator') || hasRole('team_member');

  const [submitAsOther, setSubmitAsOther] = useState(false);
  const [submitUnregisteredSeller, setSubmitUnregisteredSeller] =
    useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmUnsubmit, setConfirmUnsubmit] = useState(null);

  // Convert camelCase field name to human-readable label
  const fieldToLabel = (field) =>
    field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).replace(/_/g, ' ');

 // Format a validation errors object into a readable, vertically-aligned
  // bulleted list for the notification modal. Returns a JSX node so the
  // modal renders proper line breaks regardless of its CSS. Falls back to
  // the provided default message string if the errors object is empty.
  const formatErrorList = (errorsObj, fallbackMessage) => {
    const messages = Object.values(errorsObj || {}).filter(Boolean);
    if (messages.length === 0) return fallbackMessage;
    if (messages.length === 1) return messages[0];
    return (
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          textAlign: 'left',
        }}
      >
        {messages.map((msg, idx) => (
          <li
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '4px 0',
              lineHeight: 1.5,
            }}
          >
            <span style={{ color: '#d97706', fontWeight: 700, flexShrink: 0 }}>•</span>
            <span>{msg}</span>
          </li>
        ))}
      </ul>
    );
  };




  // Multi-step wizard state
  const TOTAL_STEPS = 6;
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const justTransitioned = useRef(false);

  const defaultFormData = {
    /* ===============================
     PERSONAL / SUBMITTER CONTEXT
     =============================== */
    userType: '',
    submitterFullName: '',
    submitterEmail: '',
    submitterPhone: '',
    submitterUserType: '',
    submitterRelationship: '',
    allowUnregisteredSeller: false,

    /* ===============================
     PROPERTY INFORMATION
     =============================== */
    // Reused for new Property Type options
    category: '',

    /* ===============================
     LOCATION INFORMATION
     =============================== */
    streetAddress: '',
    addressLine2: '',
    city: '',
    stateRegion: '',
    postalCode: '',

    /* ===============================
     PROPERTY DETAILS
     =============================== */
    bedrooms: '',
    bathrooms: '',
    squareFootage: '',
    yearBuilt: '',
    expiry_date: '',

    /* ===============================
     LISTING INFO
     =============================== */
    description: '',
    story: '',
    priorityFirstAccess: true,
    fiftyFiftyPartner: false,
    turnkey: false,
    doneForYou: false,

    /* ===============================
     PROPERTY CONTACT & SOURCE
     =============================== */
    contactName: '',
    contactPhone: '',
    contactRelation: '',
    sourceLink: '',

    /* ===============================
     FINANCIAL INFORMATION
     =============================== */
    // Reused as Purchase Price
    price: '',

    expectedCloseDate: '', // YYYY-MM-DD

    financingType: '',
    emd: '',
    downPayment: '',
    financialInfo: '',
    assignmentFee: '',

    /* ===============================
     HOA
     =============================== */
    isHOA: false,
    hoaMonthlyFee: '',

    /* ===============================
     CREATIVE FINANCING — PRIMARY MORTGAGE
     =============================== */
    hasPrimaryMortgage: '',
    primaryLoanBalance: '',
    primaryInterestRate: '',
    primaryMaturityDate: '',
    primaryPrincipalInterest: '',
    primaryTaxesInsurance: '',

    /* ===============================
     CREATIVE FINANCING — SECOND MORTGAGE
     =============================== */
    hasSecondMortgage: '',
    secondLoanBalance: '',
    secondInterestRate: '',
    secondMaturityDate: '',
    secondPrincipalInterest: '',
    secondTaxesInsurance: '',

    /* ===============================
     CREATIVE FINANCING — SELLER EQUITY
     =============================== */
    hasSellerEquity: '',
    sellerEquityAmount: '',
    sellerEquityInterestRate: '',
    sellerEquityMaturityDate: '',
    sellerEquityPrincipalInterest: '',
    sellerEquityBalloonYears: '',

    /* ===============================
     CREATIVE FINANCING — DEAL TERMS
     =============================== */
    dealTerms: '',
    totalStartingMonthlyPayment: '',

    /* ===============================
     STR / ZONING
     =============================== */
    strZoning: '',
    isOperatingSTR: 'no',
    turnkeyFurnished: '',
    hasStrFinancials: '',
    strFinancialDocs: [],

    // Data confidence (moved to top of STR section)
    strConfidence: '',

    /* ===============================
     STR KEY METRICS
     =============================== */
    averageNightlyRate: '',
    strAnnualRevenue: '',
    strMonthlyRevenue: '',
    strMonthlyUtilities: '',
    strNOI: '',
    strCleaningFee: '',
    strAvgStay: '',
    strManagementFee: '',
    strBookingPlatform: '',
    hasCurrentBookings: '',
    currentBookingsDescription: '',

    /* ===============================
     VACATION RENTAL MARKETS
     =============================== */
    vacationRentalMarkets: [],

    /* ===============================
     UNDERWRITING — OCCUPANCY (%)
     =============================== */
    occupancyRate: null,

    /* ===============================
     LISTING & LINKS
      =============================== */
    strListingLink: '',
    strDataSheetsLink: '',

    /* ===============================
     DESTINATION DEMAND INTELLIGENCE
     =============================== */
    travelMotivations: [],

    guestDemandInsights: '',
    valueAddOpportunities: '',
    localContacts: '',

    /* ===============================
     AMENITIES & ATTRACTIONS
     =============================== */
    amenities: '',
    localAttractions: '',

    /* ===============================
     TAGS & DISCOVERY
     =============================== */
    specialTags: [], // manual (e.g., MOTIVATED_SELLER)
    autoTags: [], // system-generated later

    /* ===============================
     MEDIA
     =============================== */
    coverPhoto: [],
    interiorImages: [],
    exteriorImages: [],
    additionalImages: [],
    videos: [],

    /* ===============================
     ADDITIONAL INFO
     =============================== */
    additionalInfo: '',
  };

  const LOCAL_STORAGE_KEY = 'submitterFormData';
  const [formData, setFormData] = useState({ ...defaultFormData });
  // When initializing formData (submitter OR admin edit)

  // Helper to convert number or empty string to null
  const numOrNull = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  };

  // DateInput emits MM/dd/yyyy; backend requires ISO 8601 (YYYY-MM-DD).
  const toIsoDate = (v) => {
    if (!v) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v;
    const m = String(v).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const [, mm, dd, yyyy] = m;
    return `${yyyy}-${mm}-${dd}`;
  };

  const isCreativeFinancing = ['creative', 'subject-to', 'hybrid', 'seller'].includes(
    formData.financingType
  );

  // Restore saved form data on mount.
  // We persist a snapshot ({ formData, currentStep, completedSteps }) to
  // localStorage every time the user moves between steps. If the session
  // expires and the user logs back in, this effect rehydrates the wizard
  // exactly where they left off. The backup is cleared when the property is
  // successfully submitted or the user explicitly saves a server-side draft.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!saved) return;

      const parsed = JSON.parse(saved);

      // Back-compat: earlier versions stored formData at the top level.
      // New format wraps it: { formData, currentStep, completedSteps }.
      const savedFormData = parsed.formData ? parsed.formData : parsed;
      const savedStep = parsed.currentStep;
      const savedCompleted = parsed.completedSteps;

      setFormData({
        ...defaultFormData,
        ...savedFormData,
        // Media fields hold S3 URL strings after upload. Filter out anything
        // that isn't a string (e.g. in-flight File objects that can't be
        // serialized to JSON) so we only restore successfully uploaded media.
        coverPhoto: (savedFormData.coverPhoto || []).filter(
          (v) => typeof v === 'string'
        ),
        interiorImages: (savedFormData.interiorImages || []).filter(
          (v) => typeof v === 'string'
        ),
        exteriorImages: (savedFormData.exteriorImages || []).filter(
          (v) => typeof v === 'string'
        ),
        additionalImages: (savedFormData.additionalImages || []).filter(
          (v) => typeof v === 'string'
        ),
        videos: (savedFormData.videos || []).filter((v) => typeof v === 'string'),
        strFinancialDocs: (savedFormData.strFinancialDocs || []).filter(
          (v) => typeof v === 'string'
        ),
      });

      // Restore wizard position so the user lands on the step they were on.
      if (
        typeof savedStep === 'number' &&
        savedStep >= 1 &&
        savedStep <= TOTAL_STEPS
      ) {
        setCurrentStep(savedStep);
      }
      if (Array.isArray(savedCompleted)) {
        setCompletedSteps(
          savedCompleted.filter(
            (s) => typeof s === 'number' && s >= 1 && s <= TOTAL_STEPS
          )
        );
      }
    } catch (err) {
      // Corrupt JSON shouldn't break the form — just start fresh.
      console.warn('Failed to restore form from localStorage:', err);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, []);

  // Persist the current wizard state to localStorage. Called whenever the
  // user navigates between steps (Next / Back) so no entered data is ever
  // lost to a refresh or an expired session. We accept explicit `nextStep`
  // and `nextCompleted` args because React state updates are async and we
  // want to persist the *new* values, not the stale ones from this render.
  const persistToLocalStorage = (nextStep, nextCompleted) => {
    try {
      // Strip non-string entries from media arrays — File objects and the
      // like don't survive JSON.stringify and would bloat the payload.
      const serializableFormData = {
        ...formData,
        coverPhoto: (formData.coverPhoto || []).filter(
          (v) => typeof v === 'string'
        ),
        interiorImages: (formData.interiorImages || []).filter(
          (v) => typeof v === 'string'
        ),
        exteriorImages: (formData.exteriorImages || []).filter(
          (v) => typeof v === 'string'
        ),
        additionalImages: (formData.additionalImages || []).filter(
          (v) => typeof v === 'string'
        ),
        videos: (formData.videos || []).filter((v) => typeof v === 'string'),
        strFinancialDocs: (formData.strFinancialDocs || []).filter(
          (v) => typeof v === 'string'
        ),
      };

      const snapshot = {
        formData: serializableFormData,
        currentStep: typeof nextStep === 'number' ? nextStep : currentStep,
        completedSteps: Array.isArray(nextCompleted)
          ? nextCompleted
          : completedSteps,
        savedAt: new Date().toISOString(),
      };

      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(snapshot));
    } catch (err) {
      // Quota exceeded or storage disabled — non-fatal, just log.
      console.warn('Failed to persist form to localStorage:', err);
    }
  };

  // Tracks the previous value of isCreativeFinancing so the wipe effect can
  // distinguish "this is the first time we're seeing this value" from
  // "the user just toggled financingType to a non-creative option".
  // Starts as `null` (never seen) so the first run is always a no-op — this
  // prevents the wipe from clobbering values restored from localStorage on
  // mount, even though the restore effect runs in the same effect pass.
  const prevCreativeRef = useRef(null);

  useEffect(() => {
    const prev = prevCreativeRef.current;
    prevCreativeRef.current = isCreativeFinancing;

    // First run (mount): just record the value and bail. We never wipe on
    // mount because the value we'd be reacting to is whatever was in state
    // *before* the restore effect has finished applying localStorage data.
    if (prev === null) return;

    // Only wipe when the user actively transitions from a creative financing
    // type to a non-creative one. No transition → nothing to clean up.
    if (prev === true && isCreativeFinancing === false) {
      setFormData((prevData) => ({
        ...prevData,
        expectedCloseDate: '',
        emd: '',
        downPayment: '',
        assignmentFee: '',
        hasPrimaryMortgage: '',
        primaryLoanBalance: '',
        primaryInterestRate: '',
        primaryMaturityDate: '',
        primaryPrincipalInterest: '',
        primaryTaxesInsurance: '',
        hasSecondMortgage: '',
        secondLoanBalance: '',
        secondInterestRate: '',
        secondMaturityDate: '',
        secondPrincipalInterest: '',
        secondTaxesInsurance: '',
        hasSellerEquity: '',
        sellerEquityAmount: '',
        sellerEquityInterestRate: '',
        sellerEquityMaturityDate: '',
        sellerEquityPrincipalInterest: '',
        sellerEquityBalloonYears: '',
        dealTerms: '',
        totalStartingMonthlyPayment: '',
      }));
    }
  }, [isCreativeFinancing]);

  const [errors, setErrors] = useState({});
  const [assignUserErrors, setAssignUserErrors] = useState({ submitterUser: '', specialistUser: '' });
  const [resetKey, setResetKey] = useState(0);
  const [submitProgress, setSubmitProgress] = useState({
    stage: null, // Current stage label (e.g., 'Interior Photos')
    completed: 0, // Number of files completed
    total: 0, // Total number of files in current stage
    currentFileProgress: 0, // Progress of current file (0-100)
  });

  // null = not uploading
  // { current: number, total: number } = uploading

  // Use useRef to persist refs across renders
  const errorRefs = useRef({});

  // Build a draft payload from current form state. Unlike submit, draft
  // allows partial/empty fields — we coerce numbers with numOrNull and
  // pass strings through as-is. Media should already be normalized to URLs.
  const buildDraftPayload = ({
    coverPhoto,
    interiorImages,
    exteriorImages,
    additionalImages,
    videos,
    strFinancialDocs,
  }) => {
    const submitterInfo = submitAsOther
      ? {
        fullName: formData.submitterFullName,
        email: formData.submitterEmail,
        phone: formData.submitterPhone,
        userType: formData.submitterUserType,
      }
      : {
        fullName: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        userType: user?.userType || '',
      };

    // Title for list display when user hasn't filled in an address yet
    const derivedTitle =
      [formData.bedrooms && `${formData.bedrooms} Bed`,
      formData.bathrooms && `${formData.bathrooms} Bath`,
      formData.city]
        .filter(Boolean)
        .join(', ') ||
      formData.streetAddress ||
      'Untitled Draft';

    return {
      // Submitter
      submitterFullName: submitterInfo.fullName,
      submitterEmail: submitterInfo.email,
      submitterPhone: submitterInfo.phone,
      submitterUserType: submitterInfo.userType,
      submitterRelationship: formData.submitterRelationship || null,
      allowUnregisteredSeller: submitUnregisteredSeller || null,
      submittedByAdmin: submitAsOther,
      submittedByAdminEmail: submitAsOther ? user?.email : null,

      // Property
      category: formData.category || null,
      description: formData.description || '',
      story: formData.story || '',
      contactName: formData.contactName || '',
      contactPhone: formData.contactPhone || '',
      contactRelation: formData.contactRelation || '',
      sourceLink: formData.sourceLink || '',
      streetAddress: formData.streetAddress || '',
      addressLine2: formData.addressLine2 || null,
      city: formData.city || '',
      stateRegion: formData.stateRegion || '',
      postalCode: formData.postalCode || '',
      bedrooms: numOrNull(formData.bedrooms),
      bathrooms: numOrNull(formData.bathrooms),
      squareFootage: numOrNull(formData.squareFootage),
      yearBuilt: numOrNull(formData.yearBuilt),
      expiry_date: toIsoDate(formData.expiry_date),

      // Financial
      price: numOrNull(formData.price),
      expectedCloseDate: formData.expectedCloseDate || null,
      financingType: formData.financingType || null,
      emd: numOrNull(formData.emd),
      downPayment: numOrNull(formData.downPayment),
      financialInfo: formData.financialInfo || '',
      assignmentFee: numOrNull(formData.assignmentFee),

      // HOA
      isHOA: !!formData.isHOA,
      hoaMonthlyFee: formData.isHOA ? numOrNull(formData.hoaMonthlyFee) : null,

      // Creative financing — Primary mortgage
      hasPrimaryMortgage: formData.hasPrimaryMortgage || null,
      primaryLoanBalance: numOrNull(formData.primaryLoanBalance),
      primaryInterestRate: numOrNull(formData.primaryInterestRate),
      primaryMaturityDate: formData.primaryMaturityDate || null,
      primaryPrincipalInterest: numOrNull(formData.primaryPrincipalInterest),
      primaryTaxesInsurance: numOrNull(formData.primaryTaxesInsurance),

      // Creative financing — Second mortgage
      hasSecondMortgage: formData.hasSecondMortgage || null,
      secondLoanBalance: numOrNull(formData.secondLoanBalance),
      secondInterestRate: numOrNull(formData.secondInterestRate),
      secondMaturityDate: formData.secondMaturityDate || null,
      secondPrincipalInterest: numOrNull(formData.secondPrincipalInterest),
      secondTaxesInsurance: numOrNull(formData.secondTaxesInsurance),

      // Creative financing — Seller equity
      hasSellerEquity: formData.hasSellerEquity || null,
      sellerEquityAmount: numOrNull(formData.sellerEquityAmount),
      sellerEquityInterestRate: numOrNull(formData.sellerEquityInterestRate),
      sellerEquityMaturityDate: formData.sellerEquityMaturityDate || null,
      sellerEquityPrincipalInterest: numOrNull(
        formData.sellerEquityPrincipalInterest
      ),
      sellerEquityBalloonYears: formData.sellerEquityBalloonYears || null,

      // Creative financing — Deal terms
      dealTerms: formData.dealTerms || '',
      totalStartingMonthlyPayment: numOrNull(formData.totalStartingMonthlyPayment),

      // STR
      strZoning: formData.strZoning || null,
      isOperatingSTR: formData.isOperatingSTR || null,
      turnkeyFurnished: formData.turnkeyFurnished || null,
      hasStrFinancials: formData.hasStrFinancials || null,
      strConfidence: formData.strConfidence || null,
      occupancyRate: numOrNull(formData.occupancyRate),

      // STR key metrics
      averageNightlyRate: numOrNull(formData.averageNightlyRate),
      strAnnualRevenue: numOrNull(formData.strAnnualRevenue),
      strMonthlyRevenue: numOrNull(formData.strMonthlyRevenue),
      strMonthlyUtilities: numOrNull(formData.strMonthlyUtilities),
      strNOI: numOrNull(formData.strNOI),
      strCleaningFee: numOrNull(formData.strCleaningFee),
      strAvgStay: numOrNull(formData.strAvgStay),
      strManagementFee: numOrNull(formData.strManagementFee),
      strBookingPlatform: formData.strBookingPlatform || null,
      hasCurrentBookings: formData.hasCurrentBookings || null,
      currentBookingsDescription: formData.currentBookingsDescription || '',

      vacationRentalMarkets: formData.vacationRentalMarkets || [],
      travelMotivations: formData.travelMotivations || [],
      strListingLink: formData.strListingLink || '',
      strDataSheetsLink: formData.strDataSheetsLink || '',

      // Qualitative
      guestDemandInsights: formData.guestDemandInsights || '',
      valueAddOpportunities: formData.valueAddOpportunities || '',
      localContacts: formData.localContacts || '',
      amenities: formData.amenities || '',
      localAttractions: formData.localAttractions || '',
      specialTags: formData.specialTags || [],
      autoTags: formData.autoTags || [],

      // Media (already-uploaded URLs)
      coverPhoto,
      interiorImages,
      exteriorImages,
      additionalImages,
      videos,
      strFinancialDocs,

      // Flags
      priorityFirstAccess: formData.priorityFirstAccess,
      fiftyFiftyPartner: formData.fiftyFiftyPartner,
      turnkey: deriveTurnkey(formData.turnkeyFurnished),
      doneForYou: formData.doneForYou,
      additionalInfo: formData.additionalInfo || '',

      // Wizard progress — so resume jumps to the right step
      draftStep: currentStep,

      // Display helper for drafts list
      title: derivedTitle,
    };
  };

  // Save draft to the backend (draft_properties table).
  // Uploads any pending File objects first so the draft stores real URLs,
  // then creates a new draft record or updates the existing one.
  const handleSave = async () => {
    if (isSaving || isSubmitting) return;

    // Validate required fields on step 1 only before allowing draft save.
    // Later steps can be saved as partial drafts without validation.
    if (currentStep === 1) {
      const { errors: stepErrors, firstErrorField } = validateStep(
        currentStep,
        formData
      );
      if (firstErrorField) {
        setErrors(stepErrors);
        showNotification(
          'warning',
          formatErrorList(stepErrors, 'Please fill in all required fields before saving your draft.'),
          'Required Fields'
        );
        const ref = errorRefs.current[firstErrorField];
        if (ref) {
          ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => ref.focus?.({ preventScroll: true }), 300);
        }
        return;
      }
    }

    setIsSaving(true);

    try {
      // Normalize media: convert any File objects to uploaded URLs.
      // normalizeMediaArray already handles the mix of File + URL entries.
      const [
        coverPhoto,
        interiorImages,
        exteriorImages,
        additionalImages,
        videos,
        strFinancialDocs,
      ] = await Promise.all([
        normalizeMediaArray(formData.coverPhoto),
        normalizeMediaArray(formData.interiorImages),
        normalizeMediaArray(formData.exteriorImages),
        normalizeMediaArray(formData.additionalImages),
        normalizeMediaArray(formData.videos),
        normalizeMediaArray(formData.strFinancialDocs),
      ]);

      // Reflect uploaded URLs back into form state so the UI no longer
      // holds raw File objects after save.
      setFormData((prev) => ({
        ...prev,
        coverPhoto,
        interiorImages,
        exteriorImages,
        additionalImages,
        videos,
        strFinancialDocs,
      }));

      const payload = buildDraftPayload({
        coverPhoto,
        interiorImages,
        exteriorImages,
        additionalImages,
        videos,
        strFinancialDocs,
      });

      let savedDraft;
      if (currentDraftId) {
        savedDraft = await draftsAPI.updateDraft(currentDraftId, payload);
      } else {
        savedDraft = await draftsAPI.createDraft(payload);
        const newId = savedDraft?.id || savedDraft?.data?.id;
        if (newId) setCurrentDraftId(newId);
      }

      // Refresh drafts list
      queryClient.invalidateQueries(['myDrafts']);

      // Clear stale localStorage backup — backend is now source of truth
      localStorage.removeItem(LOCAL_STORAGE_KEY);

      // Re-enable the Resume button for this draft now that the in-memory
      // edits have been persisted to the backend.
      setResumedDraftId(null);

      showNotification('success', 'Your draft has been saved.', 'Draft Saved');
    } catch (err) {
      console.error('Save failed:', err);
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Failed to save draft. Please try again.';
      showNotification('error', message, 'Save Failed');
    } finally {
      setIsSaving(false);
    }
  };

  // Resume a saved draft: load its data into the form and remember its id
  // so subsequent saves update the same record.
  const handleResumeDraft = (draft) => {
    const restored = {
      ...defaultFormData,
      ...mapPropertyToFormData(draft),
      // mapPropertyToFormData is tuned for `properties` records; make sure
      // draft-specific fields flow through.
      coverPhoto: (draft.coverPhoto || []).filter(
        (v) => typeof v === 'string'
      ),
      interiorImages: (draft.interiorImages || []).filter(
        (v) => typeof v === 'string'
      ),
      exteriorImages: (draft.exteriorImages || []).filter(
        (v) => typeof v === 'string'
      ),
      additionalImages: (draft.additionalImages || []).filter(
        (v) => typeof v === 'string'
      ),
      videos: (draft.videos || []).filter((v) => typeof v === 'string'),
      strFinancialDocs: (draft.strFinancialDocs || []).filter(
        (v) => typeof v === 'string'
      ),
    };
    setFormData(restored);
    setCurrentDraftId(draft.id);
    setResumedDraftId(draft.id);
    setErrors({});
    setResetKey((prev) => prev + 1);

    // Jump to the step the user was on when they saved
    const resumeStep =
      draft.draftStep && draft.draftStep >= 1 && draft.draftStep <= TOTAL_STEPS
        ? draft.draftStep
        : 1;
    setCurrentStep(resumeStep);
    // Mark all earlier steps as completed so the user can navigate freely
    setCompletedSteps(
      Array.from({ length: resumeStep - 1 }, (_, i) => i + 1)
    );
    setIsSubmitted(false);
    scrollToTop();
    showNotification(
      'success',
      'Draft loaded. You can continue where you left off.',
      'Draft Resumed'
    );
  };

  // Delete a draft from the backend
  const handleDeleteDraft = async (draftId) => {
    try {
      await draftsAPI.deleteDraft(draftId);
      if (currentDraftId === draftId) setCurrentDraftId(null);
      if (resumedDraftId === draftId) setResumedDraftId(null);
      queryClient.invalidateQueries(['myDrafts']);
      setConfirmDeleteDraft(null);
      showNotification('success', 'Draft deleted.', 'Draft Deleted');
    } catch (err) {
      console.error('Delete draft failed:', err);
      showNotification(
        'error',
        'Failed to delete draft. Please try again.',
        'Delete Failed'
      );
    }
  };

  const [submissionSearch, setSubmissionSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Tracks the draft id the user is currently editing. Set when user resumes
  // a saved draft or after the first Save Draft click, so subsequent saves
  // update the same record rather than creating duplicates.
  const [currentDraftId, setCurrentDraftId] = useState(null);
  // Tracks the draft id that was just resumed and hasn't been re-saved yet.
  // Used to disable that draft's Resume button until the user clicks Save Draft.
  const [resumedDraftId, setResumedDraftId] = useState(null);
  // Draft pending deletion confirmation
  const [confirmDeleteDraft, setConfirmDeleteDraft] = useState(null);

  // Notification modal state
  const [notification, setNotification] = useState({ open: false, type: 'success', title: '', message: '', onClose: null, closeOnBackdrop: true });
  const showNotification = (type, message, title = '', onClose = null, closeOnBackdrop = true) =>
    setNotification({ open: true, type, title, message, onClose, closeOnBackdrop });
  const closeNotification = () => {
    const cb = notification.onClose;
    setNotification((prev) => ({ ...prev, open: false, onClose: null }));
    cb?.();
  };

  // Duplicate address detection state
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [proofUploadModalOpen, setProofUploadModalOpen] = useState(false);
  const [duplicateProperty, setDuplicateProperty] = useState(null);
  const [pendingDealData, setPendingDealData] = useState(null);
  const [duplicateCheckLoading, setDuplicateCheckLoading] = useState(false);

  // Fetch user's previous submissions
  // Get the user's email from the form or context (here from formData)
  // Show all submissions for now (admin/debug mode)
  // Fetch user's previous submissions using getMyDeals
  const {
    data: myDeals,
    isLoading: loadingDeals,
    refetch: refetchMyDeals,
  } = useQuery({
    queryKey: ['myDeals', user?.email],
    queryFn: () => (user?.email ? dealsAPI.getMyDeals(user.email) : []),
    enabled: !!user?.email,
  });

  // Fetch user's saved drafts from the draft_properties table
  const {
    data: myDrafts,
    isLoading: loadingDrafts,
  } = useQuery({
    queryKey: ['myDrafts', user?.email],
    queryFn: () => (user?.email ? draftsAPI.getMyDrafts(user.email) : []),
    enabled: !!user?.email,
  });

  // Refetch submission history after a new property is submitted
  // Track whether the form was successfully submitted (to show review instead of resetting)
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleNewSubmission = () => {
    setFormData({ ...defaultFormData });
    setErrors({});
    setResetKey((prev) => prev + 1);
    setCurrentStep(1);
    setCompletedSteps([]);
    setIsSubmitted(false);
    // Clear any draft-edit tracking so this is a truly fresh submission
    setCurrentDraftId(null);
    setResumedDraftId(null);
    // Clear the localStorage backup so the new submission starts blank
    // instead of rehydrating the just-submitted property on next mount.
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  // Reset the entire wizard: wipe every field across all steps, drop the
  // localStorage backup, and send the user back to step 1. Triggered by the
  // "Reset" button after confirmation. Unlike Cancel (which exits the
  // submission flow), Reset is meant for users who want to start the form
  // over from scratch while staying in the submission view.
  const handleResetForm = () => {
    setFormData({ ...defaultFormData });
    setErrors({});
    setResetKey((prev) => prev + 1);
    setCurrentStep(1);
    setCompletedSteps([]);
    // Drop any draft-edit linkage — a reset produces a fresh submission,
    // not an update to an existing server-side draft.
    setCurrentDraftId(null);
    setResumedDraftId(null);
    // Clear the prefill snapshot so the wizard doesn't rehydrate the data
    // we just wiped on the next mount.
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setConfirmReset(false);
    scrollToTop();
    showNotification(
      'success',
      'Form has been reset. All steps are now empty.',
      'Form Reset'
    );
  };

  const createDealMutation = useMutation({
    mutationFn: dealsAPI.createDeal,
    onSuccess: async () => {
      refetchMyDeals();
      queryClient.invalidateQueries(['adminDeals']);

      // If this submission was promoted from a saved draft, remove the draft
      // record from the draft_properties table so it doesn't linger.
      if (currentDraftId) {
        try {
          await draftsAPI.deleteDraft(currentDraftId);
        } catch (err) {
          // Non-fatal — the deal was created successfully; just log.
          console.warn('Failed to delete draft after submission:', err);
        }
        queryClient.invalidateQueries(['myDrafts']);
        setCurrentDraftId(null);
        setResumedDraftId(null);
      }

      setErrors({});
      setCurrentStep(6);
      setCompletedSteps([1, 2, 3, 4, 5]);
      setIsSubmitting(false);
      setIsSubmitted(true);
    },
    onError: () => {
      setIsSubmitting(false);
    },
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Step navigation
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNextStep = () => {
    // Validate current step

    if (currentStep === 1 && submitAsOther) {
      const newAssignErrors = { submitterUser: '', specialistUser: '' };
      if (!selectedSubmitterUser) newAssignErrors.submitterUser = 'Please select a Real Estate Professional.';
      // if (!selectedSpecialistUser) newAssignErrors.specialistUser = 'Please select an Acquisition Specialist.';
      if (newAssignErrors.submitterUser) {
        setAssignUserErrors(newAssignErrors);
        showNotification('warning', 'Please assign both a Real Estate Professional and an Acquisition Specialist before proceeding.', 'Required Fields');
        return;
      }
      setAssignUserErrors({ submitterUser: '', specialistUser: '' });
    }

    // Clear errors and mark step completed
    setErrors({});
    const nextCompleted = completedSteps.includes(currentStep)
      ? completedSteps
      : [...completedSteps, currentStep];
    setCompletedSteps(nextCompleted);

    // Arm the submit guard for one tick. Advancing from step 4 to step 5 turns
    // the "Next" button into a type="submit" button at the same DOM position;
    // React flushes that re-render synchronously during the same click, so the
    // browser then fires a spurious form submit on the step we just landed on.
    // The guard makes handleSubmit ignore that one submit. We clear it on the
    // next tick (after any spurious submit has fired) so a later, deliberate
    // "Submit" click still goes through.
    justTransitioned.current = true;

    const nextStep = Math.min(currentStep + 1, TOTAL_STEPS);
    setCurrentStep(nextStep);

    // Persist the validated step's data so nothing is lost if the session
    // expires or the tab is closed before final submission.
    persistToLocalStorage(nextStep, nextCompleted);

    scrollToTop();

    setTimeout(() => {
      justTransitioned.current = false;
    }, 0);
  };

  const handlePrevStep = () => {
    setErrors({});
    const nextStep = Math.max(currentStep - 1, 1);
    setCurrentStep(nextStep);
    // Persist on Back as well — any data the user typed on the current step
    // should survive even if they navigate backwards and then close the tab.
    persistToLocalStorage(nextStep, completedSteps);
    scrollToTop();
  };

  const handleStepClick = (step) => {
    // Don't allow navigation after submission (read-only review mode)
    if (isSubmitted) return;
    // Allow going back to any completed step or current step
    if (step <= currentStep || completedSteps.includes(step)) {
      setErrors({});
      setCurrentStep(step);
      scrollToTop();
    }
  };
  const submitter = submitAsOther
    ? {
      fullName: formData.submitterFullName,
      email: formData.submitterEmail,
      phone: formData.submitterPhone,
      userType: formData.submitterUserType,
    }
    : {
      fullName: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      userType: user?.userType || '',
    };

  const validateSubmitterOverride = async () => {
    if (!submitAsOther) return true;

    if (!selectedSubmitterUser) {
      setCurrentStep(1);
      scrollToTop();
      throw new Error(
        'Step 1 (Assign Users) – Please select a Real Estate Professional before submitting.'
      );
    }

    return true;
  };

  const mapPropertyToFormData = (deal) => ({
    /* ===============================
   SUBMITTER CONTEXT
   =============================== */
    submitterRelationship: deal.submitterRelationship || '',
    allowUnregisteredSeller: deal.allowUnregisteredSeller || false,

    /* ===============================
   PROPERTY INFORMATION
   =============================== */
    category: deal.category || '',

    /* ===============================
   LOCATION INFORMATION
   =============================== */
    streetAddress: deal.streetAddress || '',
    addressLine2: deal.addressLine2 || '',
    city: deal.city || '',
    stateRegion: deal.stateRegion || '',
    postalCode: deal.postalCode || '',

    /* ===============================
   PROPERTY DETAILS
   =============================== */
    bedrooms: deal.bedrooms?.toString() || '',
    bathrooms: deal.bathrooms?.toString() || '',
    yearBuilt: deal.yearBuilt?.toString() || '',
    squareFootage: deal.squareFootage?.toString() || '',
    expiry_date: deal.expiry_date || '',

    /* ===============================
   LISTING INFO
   =============================== */
    description: deal.description || '',
    story: deal.story || '',
    contactName: deal.contactName || '',
    contactPhone: deal.contactPhone || '',
    contactRelation: deal.contactRelation || '',
    sourceLink: deal.sourceLink || '',
    priorityFirstAccess: !!deal.priorityFirstAccess,
    fiftyFiftyPartner: !!deal.fiftyFiftyPartner,
    turnkey: deriveTurnkey(formData.turnkeyFurnished),
    doneForYou: !!deal.doneForYou,

    /* ===============================
   FINANCIAL INFORMATION
   =============================== */
    price: deal.price?.toString() || '',
    expectedCloseDate: deal.expectedCloseDate || '',
    financingType: deal.financingType || '',
    emd: deal.emd?.toString() || '',
    downPayment: deal.downPayment?.toString() || '',
    financialInfo: deal.financialInfo || '',
    assignmentFee: deal.assignmentFee?.toString() || '',

    /* ===============================
   HOA
   =============================== */
    isHOA: !!deal.isHOA,
    hoaMonthlyFee: deal.hoaMonthlyFee?.toString() || '',

    /* ===============================
   CREATIVE FINANCING — PRIMARY MORTGAGE
   =============================== */
    hasPrimaryMortgage: deal.hasPrimaryMortgage || '',
    primaryLoanBalance: deal.primaryLoanBalance?.toString() || '',
    primaryInterestRate: deal.primaryInterestRate?.toString() || '',
    primaryMaturityDate: deal.primaryMaturityDate || '',
    primaryPrincipalInterest: deal.primaryPrincipalInterest?.toString() || '',
    primaryTaxesInsurance: deal.primaryTaxesInsurance?.toString() || '',

    /* ===============================
   CREATIVE FINANCING — SECOND MORTGAGE
   =============================== */
    hasSecondMortgage: deal.hasSecondMortgage || '',
    secondLoanBalance: deal.secondLoanBalance?.toString() || '',
    secondInterestRate: deal.secondInterestRate?.toString() || '',
    secondMaturityDate: deal.secondMaturityDate || '',
    secondPrincipalInterest: deal.secondPrincipalInterest?.toString() || '',
    secondTaxesInsurance: deal.secondTaxesInsurance?.toString() || '',

    /* ===============================
   CREATIVE FINANCING — SELLER EQUITY
   =============================== */
    hasSellerEquity: deal.hasSellerEquity || '',
    sellerEquityAmount: deal.sellerEquityAmount?.toString() || '',
    sellerEquityInterestRate: deal.sellerEquityInterestRate?.toString() || '',
    sellerEquityMaturityDate: deal.sellerEquityMaturityDate || '',
    sellerEquityPrincipalInterest:
      deal.sellerEquityPrincipalInterest?.toString() || '',
    sellerEquityBalloonYears: deal.sellerEquityBalloonYears?.toString() || '',

    /* ===============================
   CREATIVE FINANCING — DEAL TERMS
   =============================== */
    dealTerms: deal.dealTerms || '',
    totalStartingMonthlyPayment: deal.totalStartingMonthlyPayment?.toString() || '',

    /* ===============================
   STR / ZONING
   =============================== */
    strZoning: deal.strZoning || '',
    isOperatingSTR: deal.isOperatingSTR || 'no',
    turnkeyFurnished: deal.turnkeyFurnished || '',
    hasStrFinancials: deal.hasStrFinancials || '',
    strFinancialDocs: (deal.strFinancialDocs || []).filter(
      (v) => typeof v === 'string'
    ),
    strConfidence: deal.strConfidence || '',
    occupancyRate: deal.occupancyRate?.toString() || '',

    /* ===============================
   STR KEY METRICS
   =============================== */
    averageNightlyRate: deal.averageNightlyRate?.toString() || '',
    strAnnualRevenue: deal.strAnnualRevenue?.toString() || '',
    strMonthlyRevenue: deal.strMonthlyRevenue?.toString() || '',
    strMonthlyUtilities: deal.strMonthlyUtilities?.toString() || '',
    strNOI: deal.strNOI?.toString() || '',
    strCleaningFee: deal.strCleaningFee?.toString() || '',
    strAvgStay: deal.strAvgStay?.toString() || '',
    strManagementFee: deal.strManagementFee?.toString() || '',
    strBookingPlatform: deal.strBookingPlatform || '',
    hasCurrentBookings: deal.hasCurrentBookings || '',
    currentBookingsDescription: deal.currentBookingsDescription || '',

    /* ===============================
   VACATION RENTAL MARKETS
   =============================== */
    vacationRentalMarkets: deal.vacationRentalMarkets || [],

    /* ===============================
   LINKS
   =============================== */
    strListingLink: deal.strListingLink || '',
    strDataSheetsLink: deal.strDataSheetsLink || '',

    /* ===============================
   DESTINATION DEMAND
   =============================== */
    travelMotivations: deal.travelMotivations || [],
    guestDemandInsights: deal.guestDemandInsights || '',
    valueAddOpportunities: deal.valueAddOpportunities || '',
    localContacts: deal.localContacts || '',

    /* ===============================
   AMENITIES & ATTRACTIONS
   =============================== */
    amenities: deal.amenities || '',
    localAttractions: deal.localAttractions || '',

    /* ===============================
   TAGS & DISCOVERY
   =============================== */
    specialTags: deal.specialTags || [],
    autoTags: deal.autoTags || [],

    /* ===============================
   MEDIA
   =============================== */
    coverPhoto: deal.coverPhoto || [],
    interiorImages: deal.interiorImages || [],
    exteriorImages: deal.exteriorImages || [],
    additionalImages: deal.additionalImages || [],
    videos: deal.videos || [],

    /* ===============================
   ADDITIONAL INFO
   =============================== */
    additionalInfo: deal.additionalInfo || '',
  });

  const handleUnsubmit = async (dealId) => {
    try {
      const response = await unsubmitDealMutation.mutateAsync(dealId);

      const updatedDeal = response.data;

      // Remove from submissions list immediately
      queryClient.setQueryData(['myDeals'], (old = []) =>
        old.filter((d) => d.id !== dealId)
      );

      // Load deal back into the form
      const restoredFormData = {
        ...defaultFormData,
        ...mapPropertyToFormData(updatedDeal),
      };
      setFormData(restoredFormData);

      // Persist draft so refresh works
      localStorage.setItem(
        'submitterFormData',
        JSON.stringify(restoredFormData)
      );
      localStorage.setItem(
        'submitterInteriorImages',
        JSON.stringify(updatedDeal.interiorImages || [])
      );
      localStorage.setItem(
        'submitterExteriorImages',
        JSON.stringify(updatedDeal.exteriorImages || [])
      );
      localStorage.setItem(
        'submitterAdditionalImages',
        JSON.stringify(updatedDeal.additionalImages || [])
      );
      localStorage.setItem(
        'submitterVideos',
        JSON.stringify(updatedDeal.videos || [])
      );

      localStorage.setItem('submitterFormData', JSON.stringify(formData));
      setConfirmUnsubmit(null);
    } catch (err) {
      showNotification('error', 'Failed to unsubmit property. Please try again.', 'Unsubmit Failed');
    }
  };

  const unsubmitDealMutation = useMutation({
    mutationFn: (dealId) => dealsAPI.unsubmitDeal(dealId),
    onSuccess: () => {
      // keep UI in sync
      queryClient.invalidateQueries(['myDeals']);
    },
  });

  const FIELD_TO_STEP = {
    submitterRelationship: 1, category: 1, bedrooms: 1, bathrooms: 1, squareFootage: 1, description: 1, story: 1, expiry_date: 1, yearBuilt: 1,
    isHOA: 1, hoaMonthlyFee: 1,
    contactName: 1, contactPhone: 1, contactRelation: 1, sourceLink: 1,
    streetAddress: 2, addressLine2: 2, city: 2, stateRegion: 2, postalCode: 2,
    price: 3, financingType: 3, emd: 3, downPayment: 3, expectedCloseDate: 3, financialInfo: 3, assignmentFee: 3,
    hasPrimaryMortgage: 3, primaryLoanBalance: 3, primaryInterestRate: 3, primaryMaturityDate: 3,
    primaryPrincipalInterest: 3, primaryTaxesInsurance: 3,
    hasSecondMortgage: 3, secondLoanBalance: 3, secondInterestRate: 3, secondMaturityDate: 3,
    secondPrincipalInterest: 3, secondTaxesInsurance: 3,
    hasSellerEquity: 3, sellerEquityAmount: 3, sellerEquityInterestRate: 3, sellerEquityMaturityDate: 3,
    sellerEquityPrincipalInterest: 3, sellerEquityBalloonYears: 3,
    dealTerms: 3, totalStartingMonthlyPayment: 3,
    strZoning: 4, isOperatingSTR: 4, turnkeyFurnished: 4, hasStrFinancials: 4, strConfidence: 4,
    occupancyRate: 4, averageNightlyRate: 4, strAnnualRevenue: 4, strMonthlyRevenue: 4,
    strMonthlyUtilities: 4, strNOI: 4, strCleaningFee: 4, strAvgStay: 4, strManagementFee: 4,
    strBookingPlatform: 4, strFinancialDocs: 4,
    hasCurrentBookings: 4, currentBookingsDescription: 4,
    coverPhoto: 5, interiorImages: 5, exteriorImages: 5, additionalImages: 5, videos: 5,
  };

  const validateForm = () => {
    const { errors, firstErrorField } = validateDealForm(formData, {
      requireMedia: true,
      requireRequiredFields: true,
    });

    setErrors(errors);
    return firstErrorField;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Swallow the spurious submit that the browser fires immediately after a
    // step transition (see handleNextStep — the advancing button becomes a
    // submit button mid-click). The guard is armed for a single tick, so a
    // deliberate "Submit" click on the final step always goes through.
    if (justTransitioned.current) {
      justTransitioned.current = false;
      return;
    }

    // If not on the submit step, treat implicit submission (Enter key) as "Next"
    if (currentStep < 5) {
      handleNextStep();
      return;
    }

    if (isSubmitting || isSaving) return;

   


    // Validate all steps before submitting
    const STEP_LABELS = {
      1: 'Property Information',
      2: 'Location',
      3: 'Financial Information',
      4: 'Rental Data',
      5: 'Photos & Media',
    };

    const allErrors = {};
    let firstErrorStep = null;
    let firstErrorField = null;

    for (let step = 1; step <= 5; step++) {
      const { errors: sErrors, firstErrorField: sFirst } = validateStep(step, formData);
      if (sFirst) {
        Object.assign(allErrors, sErrors);
        if (firstErrorStep === null) {
          firstErrorStep = step;
          firstErrorField = sFirst;
        }
      }
    }

    if (firstErrorField) {
      setErrors(allErrors);

      const errorsByStep = {};
      Object.entries(allErrors).forEach(([field, msg]) => {
        const step = FIELD_TO_STEP[field] || 1;
        if (!errorsByStep[step]) errorsByStep[step] = [];
        errorsByStep[step].push(msg);
      });

      const errorContent = (
        <div>
          <p className="mb-4 text-gray-600">
           Please complete the following required fields before submitting.
          </p>
          <div className="space-y-3">
            {Object.entries(errorsByStep).map(([step, msgs]) => (
              <div
                key={step}
                className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
              >
                <div className="font-semibold text-amber-700 mb-2">
                  Step {step} — {STEP_LABELS[step]}
                </div>
                <ul className="space-y-1.5">
                  {msgs.map((msg, i) => (
                    <li key={i} className="flex items-start gap-2 leading-snug">
                      <span className="text-amber-500 font-bold flex-shrink-0 mt-0.5">•</span>
                      <span className="text-gray-700">{msg}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      );

      const goToFirstError = () => {
        const needsStepChange = firstErrorStep !== currentStep;
        if (needsStepChange) {
          setCurrentStep(firstErrorStep);
          scrollToTop();
        }
        setTimeout(() => {
          const ref = errorRefs.current[firstErrorField];
          if (ref) {
            ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => ref.focus?.({ preventScroll: true }), 300);
          }
        }, needsStepChange ? 150 : 0);
      };

      showNotification('warning', errorContent, 'Required Fields Missing', goToFirstError, false);

      return;
    }

    setIsSubmitting(true);

    try {
      await validateSubmitterOverride();

      // Check for duplicate address before proceeding
      setDuplicateCheckLoading(true);


      const duplicateResult = await disputesAPI.checkDuplicate({
        streetAddress: formData.streetAddress,
        city: formData.city,
        stateRegion: formData.stateRegion,
        postalCode: formData.postalCode,
      });
      setDuplicateCheckLoading(false);

      console.log('duplicateResult : ', duplicateResult)
      if (duplicateResult.isDuplicate) {
        // Store form data for later and show duplicate modal
        setDuplicateProperty(duplicateResult.existingProperty);
        setDuplicateModalOpen(true);
        setIsSubmitting(false);
        return;
      }

      // No duplicate found, proceed with normal submission
      await proceedWithSubmission();
    } catch (err) {
      console.error('Submission failed:', err);
      setDuplicateCheckLoading(false);

      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Failed to submit property.';

      showNotification('error', message, 'Submission Failed');
      setIsSubmitting(false);
    }
  };

  // Extracted submission logic for reuse after duplicate check
  const proceedWithSubmission = async () => {
    try {



      setIsSubmitting(true);

      const coverPhoto = await uploadWithProgress(
        'Cover Photo',
        formData.coverPhoto
      );

      const interiorImages = await uploadWithProgress(
        'Interior Photos',
        formData.interiorImages
      );

      const exteriorImages = await uploadWithProgress(
        'Exterior Photos',
        formData.exteriorImages
      );

      const additionalImages = await uploadWithProgress(
        'Additional Photos',
        formData.additionalImages
      );

      const videos = await uploadWithProgress('Videos', formData.videos);

      const strFinancialDocs = await uploadWithProgress(
        'STR Financial Documents',
        formData.strFinancialDocs
      );

      const selectedUserObj = submitAsOther
        ? submitterUsers.find((u) => u.id === selectedSubmitterUser)
        : null;

      const submitter = submitAsOther
        ? {
          fullName: selectedUserObj?.name || '',
          email: selectedUserObj?.email || '',
          phone: selectedUserObj?.phone || '',
          userType: selectedUserObj?.role || selectedUserObj?.userType || '',
        }
        : {
          fullName: user?.name || '',
          email: user?.email || '',
          phone: user?.phone || '',
          userType: user?.userType || '',
        };

      const dealData = {
        /* ===============================
         SUBMITTER
      =============================== */
        fullName: submitter.fullName,
        email: submitter.email,
        phone: submitter.phone,
        submitterRelationship: formData.submitterRelationship || null,
        allowUnregisteredSeller: submitUnregisteredSeller || null,

        submittedByAdmin: submitAsOther,
        submittedByAdminEmail: submitAsOther ? user.email : null,
        submittedForUserId: submitAsOther ? selectedSubmitterUser || null : null,
        assignedSpecialistId: submitAsOther ? selectedSpecialistUser || null : null,

        /* ===============================
         PROPERTY
      =============================== */
        category: formData.category,
        description: formData.description,
        story: formData.story || '',
        contactName: formData.contactName || '',
        contactPhone: formData.contactPhone || '',
        contactRelation: formData.contactRelation || '',
        sourceLink: formData.sourceLink || '',

        streetAddress: formData.streetAddress,
        addressLine2: formData.addressLine2 || null,
        city: formData.city,
        stateRegion: formData.stateRegion,
        postalCode: formData.postalCode,

        bedrooms: Number(formData.bedrooms),
        bathrooms: Number(formData.bathrooms),
        squareFootage: Number(formData.squareFootage),
        yearBuilt: Number(formData.yearBuilt),
        expiry_date: toIsoDate(formData.expiry_date),

        /* ===============================
         FINANCIAL
      =============================== */
        price: Number(formData.price),
        expectedCloseDate: formData.expectedCloseDate || null,
        financingType: formData.financingType,

        emd: numOrNull(formData.emd),
        downPayment: numOrNull(formData.downPayment),
        financialInfo: formData.financialInfo || '',
        assignmentFee: numOrNull(formData.assignmentFee),

        /* ===============================
         HOA
      =============================== */
        isHOA: !!formData.isHOA,
        hoaMonthlyFee: formData.isHOA
          ? numOrNull(formData.hoaMonthlyFee)
          : null,

        /* ===============================
         CREATIVE FINANCING — PRIMARY MORTGAGE
      =============================== */
        hasPrimaryMortgage: formData.hasPrimaryMortgage || null,
        primaryLoanBalance: numOrNull(formData.primaryLoanBalance),
        primaryInterestRate: numOrNull(formData.primaryInterestRate),
        primaryMaturityDate: formData.primaryMaturityDate || null,
        primaryPrincipalInterest: numOrNull(formData.primaryPrincipalInterest),
        primaryTaxesInsurance: numOrNull(formData.primaryTaxesInsurance),

        /* ===============================
         CREATIVE FINANCING — SECOND MORTGAGE
      =============================== */
        hasSecondMortgage: formData.hasSecondMortgage || null,
        secondLoanBalance: numOrNull(formData.secondLoanBalance),
        secondInterestRate: numOrNull(formData.secondInterestRate),
        secondMaturityDate: formData.secondMaturityDate || null,
        secondPrincipalInterest: numOrNull(formData.secondPrincipalInterest),
        secondTaxesInsurance: numOrNull(formData.secondTaxesInsurance),

        /* ===============================
         CREATIVE FINANCING — SELLER EQUITY
      =============================== */
        hasSellerEquity: formData.hasSellerEquity || null,
        sellerEquityAmount: numOrNull(formData.sellerEquityAmount),
        sellerEquityInterestRate: numOrNull(formData.sellerEquityInterestRate),
        sellerEquityMaturityDate: formData.sellerEquityMaturityDate || null,
        sellerEquityPrincipalInterest: numOrNull(
          formData.sellerEquityPrincipalInterest
        ),
        sellerEquityBalloonYears: formData.sellerEquityBalloonYears || null,

        /* ===============================
         CREATIVE FINANCING — DEAL TERMS
      =============================== */
        dealTerms: formData.dealTerms || '',
        totalStartingMonthlyPayment: numOrNull(formData.totalStartingMonthlyPayment),

        /* ===============================
         STR
      =============================== */
        strZoning: formData.strZoning,
        isOperatingSTR: formData.isOperatingSTR || null,
        turnkeyFurnished: formData.turnkeyFurnished,
        hasStrFinancials: formData.hasStrFinancials || null,
        strConfidence: formData.strConfidence,

        occupancyRate: numOrNull(formData.occupancyRate),

        /* ===============================
         STR KEY METRICS
      =============================== */
        averageNightlyRate: numOrNull(formData.averageNightlyRate),
        strAnnualRevenue: numOrNull(formData.strAnnualRevenue),
        strMonthlyRevenue: numOrNull(formData.strMonthlyRevenue),
        strMonthlyUtilities: numOrNull(formData.strMonthlyUtilities),
        strNOI: numOrNull(formData.strNOI),
        strCleaningFee: numOrNull(formData.strCleaningFee),
        strAvgStay: numOrNull(formData.strAvgStay),
        strManagementFee: numOrNull(formData.strManagementFee),
        strBookingPlatform: formData.strBookingPlatform || null,
        hasCurrentBookings: formData.hasCurrentBookings || null,
        currentBookingsDescription: formData.currentBookingsDescription || '',

        vacationRentalMarkets: formData.vacationRentalMarkets || [],
        travelMotivations: formData.travelMotivations || [],

        strListingLink: formData.strListingLink || '',
        strDataSheetsLink: formData.strDataSheetsLink || '',

        /* ===============================
         QUALITATIVE
      =============================== */
        guestDemandInsights: formData.guestDemandInsights || '',
        valueAddOpportunities: formData.valueAddOpportunities || '',
        localContacts: formData.localContacts || '',

        amenities: formData.amenities || '',
        localAttractions: formData.localAttractions || '',

        specialTags: formData.specialTags || [],
        autoTags: formData.autoTags || [],

        /* ===============================
         MEDIA (URLs ONLY)
      =============================== */
        coverPhoto,
        interiorImages,
        exteriorImages,
        additionalImages,
        videos,
        strFinancialDocs,

        /* ===============================
         FLAGS
      =============================== */
        priorityFirstAccess: formData.priorityFirstAccess,
        fiftyFiftyPartner: formData.fiftyFiftyPartner,
        turnkey: deriveTurnkey(formData.turnkeyFurnished),
        doneForYou: formData.doneForYou,
        additionalInfo: formData.additionalInfo || '',
      };

      console.log('FINAL dealData:', JSON.stringify(dealData, null, 2));

      await createDealMutation.mutateAsync(dealData);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      showNotification(
        'success',
        'Your listing will expire in 20 days. You will receive an email notification once the listing expires so you can renew it.',
        'Property Submitted'
      );
    } catch (err) {
      console.error('Submission failed:', err);

      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Failed to submit property.';

      showNotification('error', message, 'Submission Failed');
    } finally {
      setSubmitProgress({
        stage: null,
        completed: 0,
        total: 0,
        currentFileProgress: 0,
      });
      setIsSubmitting(false);
    }
  };

  // Handle when user claims ownership of a duplicate property
  const handleClaimOwnership = () => {
    setDuplicateModalOpen(false);
    setProofUploadModalOpen(true);
  };

  // Handle when user doesn't claim ownership - proceed with normal submission
  const handleProceedWithoutClaim = async () => {
    setDuplicateModalOpen(false);
    setDuplicateProperty(null);
    await proceedWithSubmission();
  };

  // Handle proof upload completion - create dispute and submit
  const handleProofUploadComplete = async (proofUrl) => {
    try {
      setIsSubmitting(true);
      setProofUploadModalOpen(false);

      // First upload all media
      const coverPhoto = await uploadWithProgress(
        'Cover Photo',
        formData.coverPhoto
      );
      const interiorImages = await uploadWithProgress(
        'Interior Photos',
        formData.interiorImages
      );
      const exteriorImages = await uploadWithProgress(
        'Exterior Photos',
        formData.exteriorImages
      );
      const additionalImages = await uploadWithProgress(
        'Additional Photos',
        formData.additionalImages
      );
      const videos = await uploadWithProgress('Videos', formData.videos);

      const strFinancialDocs = await uploadWithProgress(
        'STR Financial Documents',
        formData.strFinancialDocs
      );

      const selectedUserObj = submitAsOther
        ? submitterUsers.find((u) => u.id === selectedSubmitterUser)
        : null;

      const submitter = submitAsOther
        ? {
          fullName: selectedUserObj?.name || '',
          email: selectedUserObj?.email || '',
          phone: selectedUserObj?.phone || '',
          userType: selectedUserObj?.role || selectedUserObj?.userType || '',
        }
        : {
          fullName: user?.name || '',
          email: user?.email || '',
          phone: user?.phone || '',
          userType: user?.userType || '',
        };

      // Build new property data
      const newPropertyData = {
        fullName: submitter.fullName,
        email: submitter.email,
        phone: submitter.phone,
        submitterRelationship: formData.submitterRelationship || null,
        allowUnregisteredSeller: submitUnregisteredSeller || null,
        submittedByAdmin: submitAsOther,
        submittedByAdminEmail: submitAsOther ? user.email : null,
        submittedForUserId: submitAsOther ? selectedSubmitterUser || null : null,
        assignedSpecialistId: submitAsOther ? selectedSpecialistUser || null : null,
        category: formData.category,
        description: formData.description,
        story: formData.story || '',
        contactName: formData.contactName || '',
        contactPhone: formData.contactPhone || '',
        contactRelation: formData.contactRelation || '',
        sourceLink: formData.sourceLink || '',
        streetAddress: formData.streetAddress,
        addressLine2: formData.addressLine2 || null,
        city: formData.city,
        stateRegion: formData.stateRegion,
        postalCode: formData.postalCode,
        bedrooms: Number(formData.bedrooms),
        bathrooms: Number(formData.bathrooms),
        squareFootage: Number(formData.squareFootage),
        yearBuilt: Number(formData.yearBuilt),
        expiry_date: toIsoDate(formData.expiry_date),
        price: Number(formData.price),
        expectedCloseDate: formData.expectedCloseDate || null,
        financingType: formData.financingType,
        emd: numOrNull(formData.emd),
        downPayment: numOrNull(formData.downPayment),
        financialInfo: formData.financialInfo || '',
        assignmentFee: numOrNull(formData.assignmentFee),
        isHOA: !!formData.isHOA,
        hoaMonthlyFee: formData.isHOA
          ? numOrNull(formData.hoaMonthlyFee)
          : null,
        hasPrimaryMortgage: formData.hasPrimaryMortgage || null,
        primaryLoanBalance: numOrNull(formData.primaryLoanBalance),
        primaryInterestRate: numOrNull(formData.primaryInterestRate),
        primaryMaturityDate: formData.primaryMaturityDate || null,
        primaryPrincipalInterest: numOrNull(formData.primaryPrincipalInterest),
        primaryTaxesInsurance: numOrNull(formData.primaryTaxesInsurance),
        hasSecondMortgage: formData.hasSecondMortgage || null,
        secondLoanBalance: numOrNull(formData.secondLoanBalance),
        secondInterestRate: numOrNull(formData.secondInterestRate),
        secondMaturityDate: formData.secondMaturityDate || null,
        secondPrincipalInterest: numOrNull(formData.secondPrincipalInterest),
        secondTaxesInsurance: numOrNull(formData.secondTaxesInsurance),
        hasSellerEquity: formData.hasSellerEquity || null,
        sellerEquityAmount: numOrNull(formData.sellerEquityAmount),
        sellerEquityInterestRate: numOrNull(formData.sellerEquityInterestRate),
        sellerEquityMaturityDate: formData.sellerEquityMaturityDate || null,
        sellerEquityPrincipalInterest: numOrNull(
          formData.sellerEquityPrincipalInterest
        ),
        sellerEquityBalloonYears: formData.sellerEquityBalloonYears || null,
        dealTerms: formData.dealTerms || '',
        totalStartingMonthlyPayment: numOrNull(formData.totalStartingMonthlyPayment),
        strZoning: formData.strZoning,
        isOperatingSTR: formData.isOperatingSTR || null,
        turnkeyFurnished: formData.turnkeyFurnished,
        hasStrFinancials: formData.hasStrFinancials || null,
        strConfidence: formData.strConfidence,
        occupancyRate: numOrNull(formData.occupancyRate),
        averageNightlyRate: numOrNull(formData.averageNightlyRate),
        strAnnualRevenue: numOrNull(formData.strAnnualRevenue),
        strMonthlyRevenue: numOrNull(formData.strMonthlyRevenue),
        strMonthlyUtilities: numOrNull(formData.strMonthlyUtilities),
        strNOI: numOrNull(formData.strNOI),
        strCleaningFee: numOrNull(formData.strCleaningFee),
        strAvgStay: numOrNull(formData.strAvgStay),
        strManagementFee: numOrNull(formData.strManagementFee),
        strBookingPlatform: formData.strBookingPlatform || null,
        hasCurrentBookings: formData.hasCurrentBookings || null,
        currentBookingsDescription: formData.currentBookingsDescription || '',
        vacationRentalMarkets: formData.vacationRentalMarkets || [],
        travelMotivations: formData.travelMotivations || [],
        strListingLink: formData.strListingLink || '',
        strDataSheetsLink: formData.strDataSheetsLink || '',
        guestDemandInsights: formData.guestDemandInsights || '',
        valueAddOpportunities: formData.valueAddOpportunities || '',
        localContacts: formData.localContacts || '',
        amenities: formData.amenities || '',
        localAttractions: formData.localAttractions || '',
        specialTags: formData.specialTags || [],
        autoTags: formData.autoTags || [],
        coverPhoto,
        interiorImages,
        exteriorImages,
        additionalImages,
        videos,
        strFinancialDocs,
        priorityFirstAccess: formData.priorityFirstAccess,
        fiftyFiftyPartner: formData.fiftyFiftyPartner,
        turnkey: deriveTurnkey(formData.turnkeyFurnished),
        doneForYou: formData.doneForYou,
        additionalInfo: formData.additionalInfo || '',
      };

      // Create dispute with the new property data and proof
      await disputesAPI.createDispute({
        existingPropertyId: duplicateProperty.id,
        newPropertyData,
        proofUrl,
        claimsOwnership: true,
      });

      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setDuplicateProperty(null);
      setFormData({ ...defaultFormData });
      setErrors({});
      setResetKey((prev) => prev + 1);
      refetchMyDeals();

      showNotification(
        'success',
        'Your ownership claim has been submitted. The original property owner has been notified and you will receive an email once the dispute is resolved.',
        'Ownership Claim Submitted'
      );
    } catch (err) {
      console.error('Failed to create dispute:', err);
      showNotification(
        'error',
        err?.response?.data?.error ||
        err?.message ||
        'Failed to submit ownership claim. Please try again.',
        'Claim Failed'
      );
    } finally {
      setSubmitProgress({
        stage: null,
        completed: 0,
        total: 0,
        currentFileProgress: 0,
      });
      setIsSubmitting(false);
    }
  };

  // Handle closing proof upload modal without completing
  const handleProofUploadClose = () => {
    setProofUploadModalOpen(false);
    // Re-open duplicate modal so user can choose again
    setDuplicateModalOpen(true);
  };

  const uploadWithProgress = async (label, media) => {
    const files = media.filter((v) => v instanceof File);
    const existing = media.filter((v) => typeof v === 'string');

    if (files.length === 0) return existing;

    setSubmitProgress({
      stage: label,
      completed: 0,
      total: files.length,
      currentFileProgress: 0,
    });

    const uploaded = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Reset current file progress
      setSubmitProgress((p) => ({
        ...p,
        currentFileProgress: 0,
      }));

      try {
        // Get presigned URL
        const { uploadUrl, fileUrl } = await getPresignedUploadUrl(
          file.name,
          file.type
        );

        // Upload with progress tracking
        await uploadFileToS3WithProgress(uploadUrl, file, (percent) => {
          setSubmitProgress((p) => ({
            ...p,
            currentFileProgress: percent,
          }));
        });

        uploaded.push(fileUrl);
      } catch (err) {
        console.error(`Failed to upload ${file.name}:`, err);
        // Fallback to normalizeMediaArray if progress upload fails
        const [url] = await normalizeMediaArray([file]);
        uploaded.push(url);
      }

      setSubmitProgress((p) => ({
        ...p,
        completed: i + 1,
        currentFileProgress: 100,
      }));
    }

    return [...existing, ...uploaded];
  };

  const fetchUsers = async () => {
    try {
      const res = await getAdminUsers();
      const allUsers = res.data;

      const submitterUsers = allUsers.filter(
        user => user.role === 'submitter' 
      );
      const specialistUsers = allUsers.filter(
        user => user.role === 'acquisition_specialist'
      );

      setSubmitterUsers(submitterUsers);
      setAcquisitionSpecialistUsers(specialistUsers);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);


  return (
    <div className="bg-app min-h-screen">
      {/* Upload Progress Bar Modal */}
      <UploadProgressBar
        stage={submitProgress.stage}
        completed={submitProgress.completed}
        total={submitProgress.total}
        currentFileProgress={submitProgress.currentFileProgress}
        isVisible={!!submitProgress.stage}
      />

      <div className="container mx-auto px-4 py-12">
        <div className=" mx-auto">
          {/* <h1 className="text-4xl font-bold text-primary mb-8">
            Submit a Property Listing
          </h1> */}

          {/* Step Indicator */}
          <StepIndicator
            currentStep={currentStep}
            onStepClick={handleStepClick}
            completedSteps={completedSteps}
          />

          <form
            onSubmit={handleSubmit}
            className="bg-surface border border-border-subtle rounded-xl shadow-sm p-8 mb-12"
          >
            {/* Submit on behalf of another user — shown on step 1 only */}
            {currentStep === 1 && canSubmitOnBehalf && (
              <div className="mb-8 rounded-xl border border-border-subtle p-6 bg-panel">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="text-lg font-semibold text-text-primary">
                      Submitting for Someone Else?
                    </div>
                    <p className="text-sm text-text-secondary mt-2">
                      Select this option if you are submitting a property on
                      behalf of a client, team member, or external user.
                    </p>
                  </div>

                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={submitAsOther}
                    onChange={(e) => {
                    setSubmitAsOther(e.target.checked);
                    if (!e.target.checked) setAssignUserErrors({ submitterUser: '', specialistUser: '' });
                  }}
                  />
                </label>
              </div>
            )}

            {/* {currentStep === 1 && canSubmitOnBehalf && submitAsOther && (
              <div className="border border-border-subtle rounded-xl p-6 mb-8 bg-panel">
                <div className="font-semibold text-text-primary mb-4">
                  Seller Information
                </div>

                <Input
                  label={
                    <span>
                      Full Name <span className="text-red-500">*</span>
                    </span>
                  }
                  value={formData.submitterFullName}
                  required
                  placeholder="John Doe"
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      submitterFullName: e.target.value,
                    }))
                  }
                />

                <Input
                  label={
                    <span>
                      Email <span className="text-red-500">*</span>
                    </span>
                  }
                  type="email"
                  value={formData.submitterEmail}
                  required
                  placeholder="email@example.com"
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      submitterEmail: e.target.value,
                    }))
                  }
                />

                <Input
                  label={
                    <span>
                      Phone <span className="text-red-500">*</span>
                    </span>
                  }
                  required
                  placeholder="(555) 123-4567"
                  inputMode="tel"
                  autoComplete="tel"
                  value={formatPhoneDisplay(formData.submitterPhone)}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      submitterPhone: unformatPhone(e.target.value),
                    }))
                  }
                />
                <p className="text-sm text-text-secondary mt-2">
                  This information must exactly match a registered user in our
                  system.
                </p>
                <div className="mt-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={submitUnregisteredSeller}
                      onChange={(e) =>
                        setSubmitUnregisteredSeller(e.target.checked)
                      }
                    />
                    <div>
                      <div className="text-sm font-medium text-text-primary">
                        Seller does not have a registered account
                      </div>
                      <p className="text-xs text-text-secondary mt-1">
                        Select this if the seller is not yet registered in the
                        system. The property will be submitted using the
                        information entered above.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )} */}

            {/*Users Select box*/}
            {currentStep === 1 && canSubmitOnBehalf && submitAsOther && (
              <div className="mb-8 rounded-xl border border-border-subtle p-6 bg-panel">
                <div className="font-semibold text-text-primary mb-4">Assign Users</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Real Estate Professionals <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedSubmitterUser}
                      onChange={(e) => {
                        setSelectedSubmitterUser(e.target.value);
                        if (e.target.value) setAssignUserErrors((prev) => ({ ...prev, submitterUser: '' }));
                      }}
                      className={`w-full border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-teal-500 ${assignUserErrors.submitterUser ? 'border-red-500' : 'border-border-subtle'}`}
                    >
                      <option value="">Select a Real Estate Professional</option>
                      {submitterUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name || u.email}
                        </option>
                      ))}
                    </select>
                    {assignUserErrors.submitterUser && (
                      <p className="mt-1 text-sm text-red-500">{assignUserErrors.submitterUser}</p>
                    )}
                  </div>
                  {/* <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">
                      Acquisition Specialists <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedSpecialistUser}
                      onChange={(e) => {
                        setSelectedSpecialistUser(e.target.value);
                        if (e.target.value) setAssignUserErrors((prev) => ({ ...prev, specialistUser: '' }));
                      }}
                      className={`w-full border rounded-lg px-3 py-2 bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-teal-500 ${assignUserErrors.specialistUser ? 'border-red-500' : 'border-border-subtle'}`}
                    >
                      <option value="">Select an Acquisition Specialist</option>
                      {specialistUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name || u.email}
                        </option>
                      ))}
                    </select>
                    {assignUserErrors.specialistUser && (
                      <p className="mt-1 text-sm text-red-500">{assignUserErrors.specialistUser}</p>
                    )}
                  </div> */}
                </div>
              </div>
            )}

            {/* Step 1: Property Information */}
            {currentStep === 1 && (
              <PropertyInformationSection
                formData={formData}
                setFormData={setFormData}
                handleChange={handleChange}
                errors={errors}
                errorRefs={errorRefs}
              />
            )}

            {/* Step 2: Location */}
            {currentStep === 2 && (
              <LocationSection
                formData={formData}
                handleChange={handleChange}
                errors={errors}
                errorRefs={errorRefs}
              />
            )}

            {/* Step 3: Financial Information */}
            {currentStep === 3 && (
              <FinancialInformationSection
                formData={formData}
                setFormData={setFormData}
                handleChange={handleChange}
                errors={errors}
                errorRefs={errorRefs}
                isCreativeFinancing={isCreativeFinancing}
              />
            )}

            {/* Step 4: Rental Data + Market Motivation + Amenities */}
            {currentStep === 4 && (
              <>
                <RentalDataSection
                  formData={formData}
                  setFormData={setFormData}
                  handleChange={handleChange}
                  errors={errors}
                  errorRefs={errorRefs}
                />
                <MarketMotivationSection
                  formData={formData}
                  handleChange={handleChange}
                  errorRefs={errorRefs}
                />
                <AmenitiesAttractionsSection
                  formData={formData}
                  setFormData={setFormData}
                  handleChange={handleChange}
                  errorRefs={errorRefs}
                />
              </>
            )}

            {/* Step 5: Photos & Media */}
            {currentStep === 5 && (
              <PropertyMediaSection
                formData={formData}
                setFormData={setFormData}
                handleChange={handleChange}
                errors={errors}
                errorRefs={errorRefs}
              />
            )}

            {/* Step 6: Review */}
            {currentStep === 6 && (
              <>
                {isSubmitted && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-300 rounded-xl flex items-center gap-3">
                    <svg className="w-6 h-6 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-green-800 font-medium">Your property has been submitted successfully! Here is a summary of your submission.</span>
                  </div>
                )}
                <ReviewSection
                  formData={formData}
                  onEditStep={isSubmitted ? undefined : (step) => {
                    setCurrentStep(step);
                    scrollToTop();
                  }}
                />
              </>
            )}


            {/* Step Navigation */}
            {isSubmitted ? (
              <div className="flex items-center justify-center pt-6 border-t border-border-subtle">
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleNewSubmission}
                >
                  Submit Another Property
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-6 border-t border-border-subtle flex-wrap">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={currentStep === 1 ? () => setConfirmCancel(true) : handlePrevStep}
                >
                  {currentStep === 1 ? 'Cancel' : (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                      Back
                    </span>
                  )}
                </Button>

                <span className="text-sm text-text-secondary">
                  Step {currentStep} of {TOTAL_STEPS}
                </span>

                <div className="flex items-center gap-3 mt-4 md:mt-0 form_btn_width">
                  {/* Save Draft is available on every step (1-6) */}
                  <Button className="bg-white text-teal-700 border border-teal-300 hover:bg-teal-50"
                    type="button"
                    variant="outline"
                    onClick={handleSave}
                    disabled={isSaving || isSubmitting}
                  >
                    {isSaving ? 'Saving...' : 'Save Draft'}
                  </Button>

                  {/* Reset wipes the localStorage prefill and empties every
                      step. Confirmation modal prevents accidental clicks. */}
                  <Button className="bg-white text-red-700 border border-red-300 hover:bg-red-50"
                    type="button"
                    variant="outline"
                    onClick={() => setConfirmReset(true)}
                    disabled={isSaving || isSubmitting}
                  >
                    Reset
                  </Button>

                  {currentStep >= 5 ? (
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={isSaving || isSubmitting || createDealMutation.isPending}
                    >
                      <span className="flex items-center gap-1">
                        {isSubmitting ? 'Submitting...' : 'Submit'}
                        {!isSubmitting && (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleNextStep}
                    >
                      <span className="flex items-center gap-1">
                        Next
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Cancel Confirmation Modal */}
            <Modal
              isOpen={confirmCancel}
              onClose={() => setConfirmCancel(false)}
              title="Cancel Submission"
              size="sm"
            >
              <div className="space-y-4">
                <p className="text-text-secondary">
                  Are you sure you want to cancel this submission?
                </p>

                <div className="bg-yellow-50 p-3 rounded text-sm text-yellow-800">
                  This will clear the form and permanently delete any saved
                  progress, including uploaded photos and videos.
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    onClick={() => setConfirmCancel(false)}
                    className="px-4 py-2 rounded border border-border-subtle text-text-primary hover:bg-app"
                  >
                    Keep Editing
                  </button>

                  <button
                    onClick={() => {
                      localStorage.removeItem('submitterFormData');
                      localStorage.removeItem('submitterInteriorImages');
                      localStorage.removeItem('submitterExteriorImages');
                      localStorage.removeItem('submitterAdditionalImages');
                      localStorage.removeItem('submitterVideos');

                      setFormData({ ...defaultFormData });
                      setErrors({});
                      setResetKey((prev) => prev + 1);
                      setCurrentStep(1);
                      setCompletedSteps([]);
                      setConfirmCancel(false);
                      // Reset draft-edit tracking. Cancel only clears the form;
                      // the saved draft remains in My Drafts for later resume.
                      setCurrentDraftId(null);
                      setResumedDraftId(null);
                    }}
                    className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                  >
                    Yes, Cancel Submission
                  </button>
                </div>
              </div>
            </Modal>

            {/* Reset Confirmation Modal — prevents accidental wipe of the
                prefilled localStorage data and all step inputs. */}
            <Modal
              isOpen={confirmReset}
              onClose={() => setConfirmReset(false)}
              title="Reset Form"
              size="sm"
            >
              <div className="space-y-4">
                <p className="text-text-secondary">
                  Are you sure you want to reset the form?
                </p>

                <div className="bg-yellow-50 p-3 rounded text-sm text-yellow-800">
                  This will clear every field across all steps and remove the
                  locally saved progress. This action cannot be undone.
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="px-4 py-2 rounded border border-border-subtle text-text-primary hover:bg-app"
                  >
                    Keep My Data
                  </button>

                  <button
                    onClick={handleResetForm}
                    className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                  >
                    Yes, Reset Form
                  </button>
                </div>
              </div>
            </Modal>
          </form>

          {/* My Drafts */}
          {!loadingDrafts && myDrafts && myDrafts.length > 0 && (
            <div className="bg-surface border border-border-subtle rounded-xl shadow-sm p-8 mb-6">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
                <h2 className="text-2xl font-semibold text-primary">
                  My Drafts
                </h2>
                <span className="text-sm text-text-secondary">
                  {myDrafts.length} draft
                  {myDrafts.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-3">
                {[...myDrafts]
                  .sort((a, b) => {
                    const dateA = new Date(a.updated_at || a.created_at || 0);
                    const dateB = new Date(b.updated_at || b.created_at || 0);
                    return dateB - dateA;
                  })
                  .map((draft) => {
                    const isCurrentlyEditing = draft.id === currentDraftId;
                    const draftTitle =
                      draft.title ||
                      draft.streetAddress ||
                      (draft.city ? `Draft in ${draft.city}` : 'Untitled draft');
                    const lastSaved = draft.updated_at || draft.created_at;
                    return (
                      <div
                        key={draft.id}
                        className={`border rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap ${isCurrentlyEditing
                          ? 'border-blue-400 bg-blue-50'
                          : 'border-border-subtle bg-surface hover:bg-app'
                          }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-text-primary truncate">
                              {draftTitle}
                            </h3>
                            {isCurrentlyEditing && (
                              <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-600 text-white">
                                Editing now
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-text-secondary">
                            {draft.draftStep
                              ? `Step ${draft.draftStep} of ${TOTAL_STEPS}`
                              : 'Incomplete'}
                            {lastSaved && (
                              <>
                                {' · '}
                                Last saved{' '}
                                {new Date(lastSaved).toLocaleString()}
                              </>
                            )}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">

                          <Button
                            type="button"
                            variant="primary"
                            onClick={() => handleResumeDraft(draft)}
                            disabled={draft.id === resumedDraftId}
                            title={
                              draft.id === resumedDraftId
                                ? 'Already resumed — save your draft to resume again'
                                : undefined
                            }
                          >
                            Resume
                          </Button>

                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setConfirmDeleteDraft(draft)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Delete Draft Confirmation Modal */}
              <Modal
                isOpen={!!confirmDeleteDraft}
                onClose={() => setConfirmDeleteDraft(null)}
                title="Delete Draft"
                size="sm"
              >
                {confirmDeleteDraft && (
                  <div className="space-y-4">
                    <p className="text-text-secondary">
                      Are you sure you want to delete this draft? This action
                      cannot be undone.
                    </p>
                    <div className="bg-app border border-border-subtle p-3 rounded text-sm text-text-secondary">
                      <strong>
                        {confirmDeleteDraft.title ||
                          confirmDeleteDraft.streetAddress ||
                          'Untitled draft'}
                      </strong>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <button
                        onClick={() => setConfirmDeleteDraft(null)}
                        className="px-4 py-2 rounded border border-border-subtle text-text-primary hover:bg-app"
                      >
                        Keep Draft
                      </button>
                      <button
                        onClick={() =>
                          handleDeleteDraft(confirmDeleteDraft.id)
                        }
                        className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                      >
                        Delete Draft
                      </button>
                    </div>
                  </div>
                )}
              </Modal>
            </div>
          )}

          {/* Previous Submissions */}
          <div className="bg-surface border border-border-subtle rounded-xl shadow-sm p-8">
            <h2 className="text-2xl font-semibold text-primary mb-6">
              My Previous Submissions
            </h2>

            {/* Search Bar */}
            <div className="mb-6">
              <Input
                placeholder="Search your submissions..."
                value={submissionSearch}
                onChange={(e) => setSubmissionSearch(e.target.value)}
              />
            </div>

            {loadingDeals ? (
              <Loader />
            ) : myDeals && myDeals.length > 0 ? (
              <div className="space-y-3">
                {[...myDeals]
                  .filter((deal) => deal.status !== 'draft')
                  .filter(
                    (deal) =>
                      deal.title
                        .toLowerCase()
                        .includes(submissionSearch.toLowerCase()) ||
                      deal.status
                        .toLowerCase()
                        .includes(submissionSearch.toLowerCase())
                  )
                  .sort((a, b) => {
                    const dateA = new Date(a.submittedAt);
                    const dateB = new Date(b.submittedAt);
                    const validA = !isNaN(dateA.getTime());
                    const validB = !isNaN(dateB.getTime());
                    if (validA && validB) return dateB - dateA;
                    if (validA) return -1;
                    if (validB) return 1;
                    return 0;
                  })
                  .map((deal) => (
                    <details
                      key={deal.id}
                      className="border border-border-subtle rounded-lg overflow-hidden"
                    >
                      <summary className="p-4 flex items-center justify-between cursor-pointer hover:bg-app bg-surface">
                        <div className="flex-1">
                          <h3 className="font-medium text-text-primary">
                            {deal.title}
                          </h3>
                          <p className="text-sm text-text-secondary">
                            Status:{' '}
                            <span
                              className={`font-medium ${deal.status === 'approved'
                                ? 'text-green-600'
                                : deal.status === 'published'
                                  ? 'text-blue-600'
                                  : deal.status === 'rejected'
                                    ? 'text-red-600'
                                    : 'text-yellow-600'
                                }`}
                            >
                              {deal.status}
                            </span>
                            {deal.status === 'rejected' &&
                              deal.rejectionReason && (
                                <span className="ml-2 text-xs text-red-600 italic">
                                  (Click to see reason)
                                </span>
                              )}
                          </p>
                          <p className="text-xs text-text-secondary">
                            Submitted:{' '}
                            {new Date(deal.submittedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-text-primary">
                            ${parseInt(deal.price).toLocaleString('en-US')}
                          </p>
                          {deal.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setConfirmUnsubmit(deal);
                              }}
                            >
                              Unsubmit
                            </Button>
                          )}
                        </div>
                      </summary>
                      {deal.status === 'rejected' && deal.rejectionReason && (
                        <div className="px-4 pb-4 bg-app border-t border-border-subtle">
                          <p className="text-sm font-medium text-text-primary mb-1">
                            Rejection Reason:
                          </p>
                          <p className="text-sm text-text-secondary">
                            {deal.rejectionReason}
                          </p>
                        </div>
                      )}
                    </details>
                  ))}
                <Modal
                  isOpen={!!confirmUnsubmit}
                  onClose={() => setConfirmUnsubmit(null)}
                  title="Unsubmit Property"
                  size="sm"
                >
                  {confirmUnsubmit && (
                    <div className="space-y-4">
                      <p className="text-text-secondary">
                        Are you sure you want to unsubmit this property?
                      </p>

                      <div className="bg-app border border-border-subtle p-3 rounded text-sm text-text-secondary">
                        This will remove the property from review and allow you
                        to edit and resubmit it later.
                      </div>

                      <div className="flex justify-end gap-2 pt-4">
                        <button
                          onClick={() => setConfirmUnsubmit(null)}
                          className="px-4 py-2 rounded border border-border-subtle text-text-primary hover:bg-app"
                        >
                          Keep Submitted
                        </button>

                        <button
                          onClick={() => handleUnsubmit(confirmUnsubmit.id)}
                          className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                        >
                          Unsubmit Property
                        </button>
                      </div>
                    </div>
                  )}
                </Modal>
              </div>
            ) : (
              <p className="text-text-secondary text-center py-8">
                No previous submissions yet. Submit your first property above!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Duplicate Address Detection Modal */}
      <DuplicateAddressModal
        isOpen={duplicateModalOpen}
        onClose={() => {
          setDuplicateModalOpen(false);
          setDuplicateProperty(null);
        }}
        existingProperty={duplicateProperty}
        onClaimOwnership={handleClaimOwnership}
        onProceedWithoutClaim={handleProceedWithoutClaim}
        isLoading={isSubmitting}
      />

      {/* Proof Upload Modal */}
      <ProofUploadModal
        isOpen={proofUploadModalOpen}
        onClose={handleProofUploadClose}
        onUploadComplete={handleProofUploadComplete}
        title="Upload Proof of Ownership"
        description="Please upload a document that proves your ownership of this property (e.g., deed, title, purchase agreement, or contract). This will be reviewed by our team."
      />

      {/* Notification Modal */}
      <NotificationModal
        isOpen={notification.open}
        onClose={closeNotification}
        type={notification.type}
        title={notification.title}
        message={notification.message}
        closeOnBackdrop={notification.closeOnBackdrop}
      />
    </div>
  );
};

export default SubmitterView;
