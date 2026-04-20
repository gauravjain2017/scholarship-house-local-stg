import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dealsAPI } from '../api/deals';
import { submittersAPI } from '../api/submitters';
import { disputesAPI } from '../api/disputes';
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
  // console.log('User : ',user?.role)
  const queryClient = useQueryClient();
  const canSubmitOnBehalf =
    hasRole('admin') || hasRole('validator') || hasRole('team_member');

  const [submitAsOther, setSubmitAsOther] = useState(false);
  const [submitUnregisteredSeller, setSubmitUnregisteredSeller] =
    useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmUnsubmit, setConfirmUnsubmit] = useState(null);

  // Convert camelCase field name to human-readable label
  const fieldToLabel = (field) =>
    field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).replace(/_/g, ' ');

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

    /* ===============================
     LISTING INFO
     =============================== */
    description: '',
    priorityFirstAccess: true,
    fiftyFiftyPartner: false,
    turnkey: false,
    doneForYou: false,

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

    /* ===============================
     HOA
     =============================== */
    isHOA: false,
    hoaMonthlyFee: '',

    /* ===============================
     SUBJECT-TO FINANCING
     =============================== */
    subjLoanBalance: '',
    subjInterestRate: '',
    subjLoanMaturity: '',
    subjMonthlyPrincipal: '',
    subjMonthlyInterest: '',
    subjMonthlyTaxesInsurance: '',

    /* ===============================
     SELLER FINANCING
     =============================== */
    sellerLoanAmount: '',
    sellerInterestRate: '',
    sellerLoanMaturity: '',
    sellerMonthlyPayment: '',
    totalMonthlyPayment: '',

    /* ===============================
     STR / ZONING
     =============================== */
    strZoning: '',
    turnkeyFurnished: '',

    // Data confidence (moved to top of STR section)
    strConfidence: '',

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

  const isCreativeFinancing = ['subject-to', 'hybrid', 'seller'].includes(
    formData.financingType
  );

  // Restore saved form data on mount
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);

      setFormData({
        ...defaultFormData,
        ...parsed,
        interiorImages: (parsed.interiorImages || []).filter(
          (v) => typeof v === 'string'
        ),
        exteriorImages: (parsed.exteriorImages || []).filter(
          (v) => typeof v === 'string'
        ),
        additionalImages: (parsed.additionalImages || []).filter(
          (v) => typeof v === 'string'
        ),
        videos: (parsed.videos || []).filter((v) => typeof v === 'string'),
      });
    }
  }, []);

  useEffect(() => {
    if (!isCreativeFinancing) {
      setFormData((prev) => ({
        ...prev,
        subjLoanBalance: '',
        subjInterestRate: '',
        subjLoanMaturity: '',
        subjMonthlyPrincipal: '',
        subjMonthlyInterest: '',
        subjMonthlyTaxesInsurance: '',
        sellerLoanAmount: '',
        sellerInterestRate: '',
        sellerLoanMaturity: '',
        sellerMonthlyPayment: '',
        totalMonthlyPayment: '',
      }));
    }
  }, [isCreativeFinancing]);

  const [errors, setErrors] = useState({});
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

  // Save form data to localStorage
  const handleSave = async () => {
    if (isSaving || isSubmitting) return;

    setIsSaving(true);

    try {
      const [interiorImages, exteriorImages, additionalImages, videos] =
        await Promise.all([
          normalizeMediaArray(formData.interiorImages),
          normalizeMediaArray(formData.exteriorImages),
          normalizeMediaArray(formData.additionalImages),
          normalizeMediaArray(formData.videos),
        ]);

      const normalizedFormData = {
        ...formData,
        interiorImages,
        exteriorImages,
        additionalImages,
        videos,
      };

      // localStorage.setItem(
      //   LOCAL_STORAGE_KEY,
      //   JSON.stringify(normalizedFormData)
      // );

      setFormData(normalizedFormData);

      showNotification('success', 'Your draft has been saved.', 'Draft Saved');
    } catch (err) {
      console.error('Save failed:', err);
      showNotification('error', 'Failed to save draft. Please try again.', 'Save Failed');
    } finally {
      setIsSaving(false);
    }
  };

  const [submissionSearch, setSubmissionSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Notification modal state
  const [notification, setNotification] = useState({ open: false, type: 'success', title: '', message: '' });
  const showNotification = (type, message, title = '') => setNotification({ open: true, type, title, message });
  const closeNotification = () => setNotification((prev) => ({ ...prev, open: false }));

  // Duplicate address detection state
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [proofUploadModalOpen, setProofUploadModalOpen] = useState(false);
  const [duplicateProperty, setDuplicateProperty] = useState(null);
  const [pendingDealData, setPendingDealData] = useState(null);
  const [duplicateCheckLoading, setDuplicateCheckLoading] = useState(false);

  // Calculate annual revenue and NOI (must be after formData is defined)
  const annualRevenue = (() => {
    const rate = parseFloat(formData.strAvgDailyRate) || 0;
    const occ = parseFloat(formData.strOccupancyRate) || 0;
    return rate && occ ? (rate * 365 * (occ / 100)).toFixed(2) : '';
  })();
  const netOperatingIncome = (() => {
    const ar = parseFloat(annualRevenue) || 0;
    const op = parseFloat(formData.strOperatingExpenses) || 0;
    return ar ? (ar - op).toFixed(2) : '';
  })();

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
  };

  const createDealMutation = useMutation({
    mutationFn: dealsAPI.createDeal,
    onSuccess: () => {
      refetchMyDeals();
      queryClient.invalidateQueries(['adminDeals']);

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
    const { errors: stepErrors, firstErrorField } = validateStep(currentStep, formData);
    if (firstErrorField) {
      setErrors(stepErrors);
      showNotification('warning', 'Please fill in all required fields before proceeding.', 'Required Fields');
      const ref = errorRefs.current[firstErrorField];
      if (ref) {
        ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => ref.focus?.({ preventScroll: true }), 300);
      }
      return;
    }

    // Clear errors and mark step completed
    setErrors({});
    setCompletedSteps((prev) =>
      prev.includes(currentStep) ? prev : [...prev, currentStep]
    );
    justTransitioned.current = true;
    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
    scrollToTop();
  };

  const handlePrevStep = () => {
    setErrors({});
    setCurrentStep((prev) => Math.max(prev - 1, 1));
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

    const { submitterFullName, submitterEmail, submitterPhone } = formData;

    if (
      !submitterFullName?.trim() ||
      !submitterEmail?.trim() ||
      !submitterPhone?.trim()
    ) {
      throw new Error(
        'All submitter fields are required when submitting on behalf of another user.'
      );
    }

    if (submitUnregisteredSeller) {
      return true;
    }

    const exists = await submittersAPI.checkExistsByEmail(
      submitterEmail.trim()
    );

    if (!exists) {
      throw new Error('No submitter found with this email.');
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

    /* ===============================
   LISTING INFO
   =============================== */
    description: deal.description || '',
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

    /* ===============================
   HOA
   =============================== */
    isHOA: !!deal.isHOA,
    hoaMonthlyFee: deal.hoaMonthlyFee?.toString() || '',

    /* ===============================
   SUBJECT-TO FINANCING
   =============================== */
    subjLoanBalance: deal.subjLoanBalance?.toString() || '',
    subjInterestRate: deal.subjInterestRate?.toString() || '',
    subjLoanMaturity: deal.subjLoanMaturity || '',
    subjMonthlyPrincipal: deal.subjMonthlyPrincipal?.toString() || '',
    subjMonthlyInterest: deal.subjMonthlyInterest?.toString() || '',
    subjMonthlyTaxesInsurance: deal.subjMonthlyTaxesInsurance?.toString() || '',

    /* ===============================
   SELLER FINANCING
   =============================== */
    sellerLoanAmount: deal.sellerLoanAmount?.toString() || '',
    sellerInterestRate: deal.sellerInterestRate?.toString() || '',
    sellerLoanMaturity: deal.sellerLoanMaturity || '',
    sellerMonthlyPayment: deal.sellerMonthlyPayment?.toString() || '',
    totalMonthlyPayment: deal.totalMonthlyPayment?.toString() || '',

    /* ===============================
   STR / ZONING
   =============================== */
    strZoning: deal.strZoning || '',
    turnkeyFurnished: deal.turnkeyFurnished || '',
    strConfidence: deal.strConfidence || '',
    occupancyRate: deal.occupancyRate?.toString() || '',
    // averageNightlyRate: deal.averageNightlyRate?.toString() || '',

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
    submitterRelationship: 1, category: 1, bedrooms: 1, bathrooms: 1, squareFootage: 1, description: 1,
    streetAddress: 2, addressLine2: 2, city: 2, stateRegion: 2, postalCode: 2,
    price: 3, financingType: 3, emd: 3, downPayment: 3, expectedCloseDate: 3, financialInfo: 3,
    isHOA: 3, hoaMonthlyFee: 3,
    subjLoanBalance: 3, subjInterestRate: 3, subjLoanMaturity: 3,
    subjMonthlyPrincipal: 3, subjMonthlyInterest: 3, subjMonthlyTaxesInsurance: 3,
    sellerLoanAmount: 3, sellerInterestRate: 3, sellerLoanMaturity: 3,
    sellerMonthlyPayment: 3, totalMonthlyPayment: 3,
    strConfidence: 4, turnkeyFurnished: 4, strZoning: 4,
    occupancyRate: 4, averageNightlyRate: 4, managementCommissionPercent: 4,
    interiorImages: 5, exteriorImages: 5, additionalImages: 5, videos: 5,
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

    // Ignore form submissions triggered by Enter key repeat after a step transition
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

    // Validate current step first (e.g. photos on step 5)
    const { errors: stepErrors, firstErrorField: stepErrorField } = validateStep(currentStep, formData);
    if (stepErrorField) {
      setErrors(stepErrors);
      showNotification('warning', 'Please fill in all required fields before submitting.', 'Required Fields');
      const ref = errorRefs.current[stepErrorField];
      if (ref) {
        ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => ref.focus?.({ preventScroll: true }), 300);
      }
      return;
    }

    setIsSubmitting(true);

    const firstErrorField = validateForm();
    if (firstErrorField) {
      // Navigate to the step that contains the first error
      const errorStep = FIELD_TO_STEP[firstErrorField] || currentStep;
      if (errorStep !== currentStep) {
        setCurrentStep(errorStep);
        scrollToTop();
      }
      
      showNotification('warning', 'Please fix the errors in the form before submitting.', 'Validation Error');
      setTimeout(() => {
        const ref = errorRefs.current[firstErrorField];
        if (ref) {
          ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => ref.focus?.({ preventScroll: true }), 300);
        }
      }, errorStep !== currentStep ? 100 : 0);


      setIsSubmitting(false);
      return;
    }

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

      console.log('duplicateResult : ',duplicateResult)
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

        /* ===============================
         PROPERTY
      =============================== */
        category: formData.category,
        description: formData.description,

        streetAddress: formData.streetAddress,
        addressLine2: formData.addressLine2 || null,
        city: formData.city,
        stateRegion: formData.stateRegion,
        postalCode: formData.postalCode,

        bedrooms: Number(formData.bedrooms),
        bathrooms: Number(formData.bathrooms),
        squareFootage: Number(formData.squareFootage),
        yearBuilt: Number(formData.yearBuilt),

        /* ===============================
         FINANCIAL
      =============================== */
        price: Number(formData.price),
        expectedCloseDate: formData.expectedCloseDate || null,
        financingType: formData.financingType,

        emd: numOrNull(formData.emd),
        downPayment: numOrNull(formData.downPayment),
        financialInfo: formData.financialInfo || '',

        /* ===============================
         HOA
      =============================== */
        isHOA: !!formData.isHOA,
        hoaMonthlyFee: formData.isHOA
          ? numOrNull(formData.hoaMonthlyFee)
          : null,

        /* ===============================
         SUBJECT-TO
      =============================== */
        subjLoanBalance: numOrNull(formData.subjLoanBalance),
        subjInterestRate: numOrNull(formData.subjInterestRate),
        subjLoanMaturity: formData.subjLoanMaturity || null,
        subjMonthlyPrincipal: numOrNull(formData.subjMonthlyPrincipal),
        subjMonthlyInterest: numOrNull(formData.subjMonthlyInterest),
        subjMonthlyTaxesInsurance: numOrNull(
          formData.subjMonthlyTaxesInsurance
        ),

        /* ===============================
         SELLER FINANCING
      =============================== */
        sellerLoanAmount: numOrNull(formData.sellerLoanAmount),
        sellerInterestRate: numOrNull(formData.sellerInterestRate),
        sellerLoanMaturity: formData.sellerLoanMaturity || null,
        sellerMonthlyPayment: numOrNull(formData.sellerMonthlyPayment),
        totalMonthlyPayment: numOrNull(formData.totalMonthlyPayment),

        /* ===============================
         STR
      =============================== */
        strZoning: formData.strZoning,
        turnkeyFurnished: formData.turnkeyFurnished,
        strConfidence: formData.strConfidence,

        occupancyRate: numOrNull(formData.occupancyRate),
        // averageNightlyRate: numOrNull(formData.averageNightlyRate),

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
        interiorImages,
        exteriorImages,
        additionalImages,
        videos,

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
      showNotification('success', 'Your property has been submitted successfully!', 'Property Submitted');
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

      // Build new property data
      const newPropertyData = {
        fullName: submitter.fullName,
        email: submitter.email,
        phone: submitter.phone,
        submitterRelationship: formData.submitterRelationship || null,
        allowUnregisteredSeller: submitUnregisteredSeller || null,
        submittedByAdmin: submitAsOther,
        submittedByAdminEmail: submitAsOther ? user.email : null,
        category: formData.category,
        description: formData.description,
        streetAddress: formData.streetAddress,
        addressLine2: formData.addressLine2 || null,
        city: formData.city,
        stateRegion: formData.stateRegion,
        postalCode: formData.postalCode,
        bedrooms: Number(formData.bedrooms),
        bathrooms: Number(formData.bathrooms),
        squareFootage: Number(formData.squareFootage),
        yearBuilt: Number(formData.yearBuilt),
        price: Number(formData.price),
        expectedCloseDate: formData.expectedCloseDate || null,
        financingType: formData.financingType,
        emd: numOrNull(formData.emd),
        downPayment: numOrNull(formData.downPayment),
        financialInfo: formData.financialInfo || '',
        isHOA: !!formData.isHOA,
        hoaMonthlyFee: formData.isHOA
          ? numOrNull(formData.hoaMonthlyFee)
          : null,
        subjLoanBalance: numOrNull(formData.subjLoanBalance),
        subjInterestRate: numOrNull(formData.subjInterestRate),
        subjLoanMaturity: formData.subjLoanMaturity || null,
        subjMonthlyPrincipal: numOrNull(formData.subjMonthlyPrincipal),
        subjMonthlyInterest: numOrNull(formData.subjMonthlyInterest),
        subjMonthlyTaxesInsurance: numOrNull(
          formData.subjMonthlyTaxesInsurance
        ),
        sellerLoanAmount: numOrNull(formData.sellerLoanAmount),
        sellerInterestRate: numOrNull(formData.sellerInterestRate),
        sellerLoanMaturity: formData.sellerLoanMaturity || null,
        sellerMonthlyPayment: numOrNull(formData.sellerMonthlyPayment),
        totalMonthlyPayment: numOrNull(formData.totalMonthlyPayment),
        strZoning: formData.strZoning,
        turnkeyFurnished: formData.turnkeyFurnished,
        strConfidence: formData.strConfidence,
        occupancyRate: numOrNull(formData.occupancyRate),
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
        interiorImages,
        exteriorImages,
        additionalImages,
        videos,
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
                    onChange={(e) => setSubmitAsOther(e.target.checked)}
                  />
                </label>
              </div>
            )}

            {currentStep === 1 && canSubmitOnBehalf && submitAsOther && (
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
                  {currentStep < 5 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSave}
                      disabled={isSaving || isSubmitting}
                    >
                      {isSaving ? 'Saving...' : 'Save Draft'}
                    </Button>
                  )}

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
                    }}
                    className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                  >
                    Yes, Cancel Submission
                  </button>
                </div>
              </div>
            </Modal>
          </form>

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
                              className={`font-medium ${
                                deal.status === 'approved'
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
      />
    </div>
  );
};

export default SubmitterView;
