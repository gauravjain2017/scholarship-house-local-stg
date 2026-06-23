/**
 * Deal Controllers
 * Normalized, DynamoDB-safe
 *
 * FILE: backend/src/controllers/dealController.js
 */

const { v4: uuidv4 } = require('uuid');
const { dynamoDB, TABLES } = require('../config/aws');
const {
  GetCommand,
  PutCommand,
  ScanCommand,
  QueryCommand,
  DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');
const backendConstants = require('../../backend_constants');
const dealStorage = backendConstants.dealStorage;
const Submitter = require('../models/Submitter');
const { generateAddressKey } = require('../utils/addressNormalizer');
const BuyBox = require('../models/BuyBox');
const ManageFilter = require('../models/ManageFilter');
const ManageTaxRate = require('../models/ManageTaxRate');
const { createNotification } = require('../services/notificationService');
const {
  generateAutoTags,
  mergeWithExistingTags,
} = require('../utils/autoTagger');

/* ------------------ UTIL ------------------ */

const stripUndefined = (obj) => {
  Object.keys(obj).forEach((key) => {
    const v = obj[key];
    if (v === undefined) delete obj[key];
    if (typeof v === 'number' && Number.isNaN(v)) delete obj[key];
  });
  return obj;
};

function generateDealTitle({ bedrooms, bathrooms, city, stateRegion }) {
  const bed = bedrooms ? `${bedrooms} Bedroom` : '';
  const bath = bathrooms ? `${bathrooms} Bathroom` : '';
  const location = city && stateRegion ? `in ${city}, ${stateRegion}` : '';

  return [bed, bath, location].filter(Boolean).join(', ');
}

/* ------------------ CREATE DEAL ------------------ */

const createDeal = async (req, res) => {
  const body = req.body;
  if (body.submittedByAdmin && !body.allowUnregisteredSeller) {
    const isAdmin =
      String(req.user?.role || req.user?.userType || '').toLowerCase() ===
      'admin';

    if (!isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const submitter = await Submitter.findByEmail(body.email);

    if (!submitter) {
      return res.status(400).json({
        error: 'Submitter does not exist',
      });
    }
    if (body.submittedByAdmin && body.email !== submitter.Email) {
      return res.status(400).json({
        error: 'Submitter email mismatch',
      });
    }

    // ---- Normalization helpers ----
    const normalizePhone = (v) => String(v || '').replace(/\D/g, '');
    const normalizeName = (v) =>
      String(v || '')
        .trim()
        .toLowerCase();
    const normalizeType = (v) =>
      String(v || '')
        .trim()
        .toUpperCase();

    // ---- Field comparisons ----
    const mismatches = [];

    if (normalizeName(body.fullName) !== normalizeName(submitter.Name)) {
      mismatches.push('name');
    }

    if (normalizePhone(body.phone) !== normalizePhone(submitter.Phone)) {
      mismatches.push('phone');
    }

    if (mismatches.length > 0) {
      return res.status(400).json({
        error: 'Submitter information does not match records',
        mismatchedFields: mismatches,
      });
    }
  }

  const submitterEmail = body.submittedByAdmin
    ? body.email.toLowerCase()
    : req.user.email.toLowerCase();

  if (!submitterEmail) {
    console.error('❌ NO SUBMITTER EMAIL IN JWT:', req.user);
    return res.status(401).json({
      error: 'Authenticated user email missing — cannot create deal',
    });
  }

  // Get submitterName from body, trimming empty strings to null
  let submitterName =
    body.submitterFullName?.trim() || body.fullName?.trim() || null;

  // If no submitterName provided, look up from submitter record
  if (!submitterName) {
    try {
      const submitterRecord = await Submitter.get(submitterEmail);
      submitterName = submitterRecord?.Name || null;
    } catch (lookupErr) {
      console.warn('Could not look up submitter name:', lookupErr.message);
    }
  }

  const {
    fullName,
    email,
    phone,
    userType: submitterUserType,
    ...safeSource
  } = body;

  try {
    const propertyId = uuidv4();
    const title = generateDealTitle({
      bedrooms: body.bedrooms,
      bathrooms: body.bathrooms,
      city: body.city,
      stateRegion: body.stateRegion,
    });
    const submittedAt = new Date().toISOString();

    // Generate normalized address for duplicate detection
    const normalizedAddress = generateAddressKey({
      streetAddress: body.streetAddress,
      city: body.city,
      stateRegion: body.stateRegion,
      postalCode: body.postalCode,
    });

    let resolvedSubmitterUserType = null;

    if (!body.allowUnregisteredSeller) {
      const submitter = await Submitter.findByEmail(body.email);
      resolvedSubmitterUserType = submitter?.UserType || null;
    } else {
      resolvedSubmitterUserType = 'External';
    }

    /* ------------------ MAIN ITEM ------------------ */
    const propertyItem = stripUndefined({
      id: propertyId,
      title,
      status: 'pending',
      submittedAt,
      submitterEmail: submitterEmail.toLowerCase(),
      submitterName,
      submitterPhone: body.phone,
      submitterUserType: resolvedSubmitterUserType,
      unregisteredSeller: !!body.allowUnregisteredSeller,
      priorityFirstAccess: true,
      fiftyFiftyPartner: false,
      fiftyFiftyPreApproved: false,
      doneForYou: false,
      normalizedAddress,
      ...safeSource,
    });

    // Generate auto-tags and merge with any existing special tags
    const autoTags = generateAutoTags(propertyItem);
    propertyItem.autoTags = autoTags;
    propertyItem.specialTags = mergeWithExistingTags(
      propertyItem,
      body.specialTags
    );

    if (!propertyItem.submitterEmail) {
      console.warn(
        '⚠️ Property item is missing submitterEmail:',
        JSON.stringify(propertyItem, null, 2)
      );
    }

    await dealStorage.addNewDeal(propertyItem);

    await createNotification('new_property', propertyId, { action_performer_id: submitterEmail });

    return res.status(201).json(propertyItem);
  } catch (error) {
    console.error('❌ ERROR CREATING DEAL');
    console.error(error);

    return res.status(500).json({
      error: 'Failed to create deal',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

/* ------------------ READ ENDPOINTS ------------------ */

async function getSubmitterByEmail(email) {
  if (!email) return null;

  const result = await dynamoDB.send(
    new GetCommand({
      TableName: TABLES.SUBMITTERS,
      Key: { Email: email.toLowerCase() },
    })
  );

  if (!result.Item) return null;

  return {
    name: result.Item.Name,
    email: result.Item.Email,
    phone: result.Item.Phone || '',
    userType: result.Item.UserType,
  };
}

const getPublishedDeals = async (req, res) => {
  try {

    console.log('request : ', req.query)
    const { search, premium, state_regions, minDownPayment, maxDownPayment, interestRateMin, subjectToInterestRateMax, advMonthlyPaymentMin, advMonthlyPaymentMax, advPropertyType, advBedroomsMin, advBathroomsMin, advYearBuiltMin, advYearBuiltMax, advSqftMin, advSqftMax, turnkeyFurnished,
      anrMin_budget, anrMax_budget, anrMin_economy, anrMax_economy, anrMin_midscale, anrMax_midscale, anrMin_upscale, anrMax_upscale, anrMin_luxury, anrMax_luxury,
      egrMin_budget, egrMax_budget, egrMin_economy, egrMax_economy, egrMin_midscale, egrMax_midscale, egrMin_upscale, egrMax_upscale, egrMin_luxury, egrMax_luxury,
      incomeReductionMin, incomeReductionMax, taxSavingsMin, taxSavingsMax, sortBy, selectedStatuses
    } = req.query;

    console.log('search : ',search)


    let deals = await dealStorage.getDealsByStatusScan(['published', 'sold', 'pending','approved']);

    // Always exclude expired properties from browse listings
    deals = deals.filter((d) => d.expired_status != true);

    // Status filter (from customer checkbox selection)
    if (selectedStatuses) {
      const statusList = Array.isArray(selectedStatuses)
        ? selectedStatuses
        : selectedStatuses.split(',').map((s) => s.trim());
      if (statusList.length > 0) {
        deals = deals.filter((d) => statusList.includes(d.status));
      }
    }

    // State/Region filter
    if (state_regions) {
      const regions = Array.isArray(state_regions) ? state_regions : typeof state_regions === 'object' ? Object.values(state_regions) : state_regions.split(',');
      const regionSet = new Set(regions.map((r) => r.trim().toUpperCase()));
      deals = deals.filter((d) => d.stateRegion && regionSet.has(d.stateRegion.trim().toUpperCase()));
    }

    // Down Payment range filter
    if (minDownPayment) {
      const min = Number(minDownPayment);
      deals = deals.filter((d) => d.downPayment != null && Number(d.downPayment) >= min);
    }
    if (maxDownPayment) {
      const max = Number(maxDownPayment);
      deals = deals.filter((d) => d.downPayment != null && Number(d.downPayment) <= max);
    }

    // Subject To Interest Rate filter
    if (interestRateMin) {
      const min = parseFloat(interestRateMin);
      deals = deals.filter((d) => d.subjInterestRate != null && parseFloat(d.subjInterestRate) >= min);
    }
    if (subjectToInterestRateMax) {
      const max = parseFloat(subjectToInterestRateMax);
      deals = deals.filter((d) => d.subjInterestRate != null && parseFloat(d.subjInterestRate) <= max);
    }

    // Property Type filter
    if (advPropertyType) {
      deals = deals.filter((d) => d.category && d.category.toLowerCase() === advPropertyType.toLowerCase());
    }

    // Bedrooms filter (min)
    if (advBedroomsMin) {
      const min = Number(advBedroomsMin);
      deals = deals.filter((d) => d.bedrooms != null && Number(d.bedrooms) >= min);
    }

    if (advBathroomsMin) {
      const min = Number(advBathroomsMin);
      deals = deals.filter((d) => d.bathrooms != null && Number(d.bathrooms) >= min);
    }

    if (advYearBuiltMin) {
      const min = Number(advYearBuiltMin);
      deals = deals.filter((d) => d.yearBuilt != null && Number(d.yearBuilt) >= min);
    }
    if (advYearBuiltMax) {
      const max = Number(advYearBuiltMax);
      deals = deals.filter((d) => d.yearBuilt != null && Number(d.yearBuilt) <= max);
    }

    if (advSqftMin) {
      const min = Number(advSqftMin);
      deals = deals.filter((d) => d.squareFootage != null && Number(d.squareFootage) >= min);
    }
    if (advSqftMax) {
      const max = Number(advSqftMax);
      deals = deals.filter((d) => d.squareFootage != null && Number(d.squareFootage) <= max);
    }

    //Montly Payment Process
    if (advMonthlyPaymentMin) {
      const min = Number(advMonthlyPaymentMin);
      deals = deals.filter((d) => d.totalMonthlyPayment != null && Number(d.totalMonthlyPayment) >= min);
    }
    if (advMonthlyPaymentMax) {
      const max = Number(advMonthlyPaymentMax);
      deals = deals.filter((d) => d.totalMonthlyPayment != null && parseFloat(d.totalMonthlyPayment) <= max);
    }
    if (turnkeyFurnished) {
      if (turnkeyFurnished.toUpperCase() === 'FURNISHED') {
        deals = deals.filter((d) => d.turnkeyFurnished && ['TURNKEY_OPERATING', 'FURNISHED_NOT_OPERATING'].includes(d.turnkeyFurnished.toUpperCase()));
      } else {
        deals = deals.filter((d) => d.turnkeyFurnished && ['NOT_FURNISHED', 'PARTIALLY_FURNISHED'].includes(d.turnkeyFurnished.toUpperCase()));
      }
    }

    // Average Nightly Rate (ANR) per-tier filters
    const anrTiers = ['budget', 'economy', 'midscale', 'upscale', 'luxury'];
    for (const tier of anrTiers) {
      const minVal = req.query[`anrMin_${tier}`];
      const maxVal = req.query[`anrMax_${tier}`];
      if (minVal) {
        const min = Number(minVal);
        deals = deals.filter((d) => d[`anr_${tier}`] != null && Number(d[`anr_${tier}`]) >= min);
      }
      if (maxVal) {
        const max = Number(maxVal);
        deals = deals.filter((d) => d[`anr_${tier}`] != null && Number(d[`anr_${tier}`]) <= max);
      }
    }

    // Estimated Gross Revenue (EGR) per-tier filters
    const egrTiers = ['budget', 'economy', 'midscale', 'upscale', 'luxury'];
    for (const tier of egrTiers) {
      const minVal = req.query[`egrMin_${tier}`];
      const maxVal = req.query[`egrMax_${tier}`];
      if (minVal) {
        const min = Number(minVal);
        deals = deals.filter((d) => d[`egr_${tier}`] != null && Number(d[`egr_${tier}`]) >= min);
      }
      if (maxVal) {
        const max = Number(maxVal);
        deals = deals.filter((d) => d[`egr_${tier}`] != null && Number(d[`egr_${tier}`]) <= max);
      }
    }

    // Tax Benefits filters
    if (incomeReductionMin) {
      const min = Number(incomeReductionMin);
      deals = deals.filter((d) => d.incomeReduction != null && Number(d.incomeReduction) >= min);
    }


    if (incomeReductionMax) {
      const max = Number(incomeReductionMax);
      deals = deals.filter((d) => d.incomeReduction != null && Number(d.incomeReduction) <= max);
    }
    if (taxSavingsMin) {
      const min = Number(taxSavingsMin);
      deals = deals.filter((d) => d.taxSavings != null && Number(d.taxSavings) >= min);
    }
    if (taxSavingsMax) {
      const max = Number(taxSavingsMax);
      deals = deals.filter((d) => d.taxSavings != null && Number(d.taxSavings) <= max);
    }


    // Search filter
    if (search) {
      const q = String(search).toLowerCase();
      deals = deals.filter((d) => {
        const streetNum = String(d.streetAddress || '').trim().split(' ')[0].replace(/\D/g, '');
        const postal = String(d.postalCode || '').trim();
        let propertyId = '';
        if (streetNum && postal) propertyId = `${streetNum}-${postal}`;
        else if (streetNum) propertyId = streetNum;
        else if (postal) propertyId = postal;

        return (
          String(d.title || '').toLowerCase().includes(q) ||
          String(d.description || '').toLowerCase().includes(q) ||
          propertyId.toLowerCase().includes(q)
        );
      });
    }

    // Premium filter
    if (premium === 'true') {
      deals = deals.filter((d) => d.priorityFirstAccess === true);
    }

    // Enrich submitter info (parallel lookups to avoid N+1 sequential queries)
    const uniqueEmails = [
      ...new Set(
        deals
          .map((d) => (d.submitterEmail || d.email || '').toLowerCase())
          .filter(Boolean)
      ),
    ];
    const submitterResults = await Promise.all(
      uniqueEmails.map((email) => getSubmitterByEmail(email))
    );
    const submitterMap = {};
    uniqueEmails.forEach((email, i) => {
      submitterMap[email] = submitterResults[i];
    });

    for (const deal of deals) {
      const email = (deal.submitterEmail || deal.email || '').toLowerCase();
      deal.submitter = email ? submitterMap[email] || null : null;

      deal.fullName = deal.submitter?.name || '';
      deal.email = deal.submitter?.email || '';
      deal.phone = deal.submitter?.phone || '';
      deal.userType = deal.submitter?.userType || '';
    }

    // PROPERTY TYPE ACCESS ENFORCEMENT
    const userEmail = req.user?.email;
    const usersDetail = await Submitter.listAll(req.query);
    const usersDetailArr = usersDetail.find(u => u.email === userEmail);

    const isAdmin = req.user?.role === 'admin';
    const isTeamMember = req.user?.role === 'team_member';

    // const hasPriority = req.user?.priority === true;
    // const hasPartnership = req.user?.partnership === true;
    // const hasTurnkey = req.user?.turnkey === true;

    const hasPriority = usersDetailArr?.priorityFirstAccess;
    const hasPartnership = usersDetailArr?.partnershipAccess;
    const hasTurnkey = usersDetailArr?.turnkeyAccess;






    // Filter deals based on property type permissions
    if (!isAdmin && !isTeamMember) {
      deals = deals.filter((d) => {
        // Check Priority access
        if (d.priorityFirstAccess === true && !hasPriority) {
          return false;
        }
        // Check Partnership access
        if (d.fiftyFiftyPartner === true && !hasPartnership) {
          return false;
        }
        // Check Turnkey access
        if (d.turnkeyFurnished && d.turnkeyFurnished !== 'NOT_FURNISHED' && !hasTurnkey) {
          return false;
        }
        return true;
      });
    }

    let favoriteSet = new Set();

    try {
      const email = req.user?.email;
      if (email) {
        const favResult = await dynamoDB.send(
          new QueryCommand({
            TableName: TABLES.USER_FAVORITES,
            KeyConditionExpression: '#email = :email',
            ExpressionAttributeNames: {
              '#email': 'email',
            },
            ExpressionAttributeValues: {
              ':email': email,
            },
          })
        );

        const favoriteIds = (favResult.Items || []).map(
          (item) => item.propertyId
        );
        favoriteSet = new Set(favoriteIds);
      }
    } catch (favErr) {
      // Favorites should NEVER break deal delivery
      console.warn('⚠️ Failed to fetch favorites:', favErr?.name || favErr);
    }

    // Sort by user-selected option
    if (sortBy == 'price-high') {
      deals.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    } else if (sortBy == 'price-low') {
      deals.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (sortBy == 'newest') {
      deals.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
    } else if (sortBy == 'oldest') {
      deals.sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0));
    }

    // Promote favorites to top (stable sort)
    deals.sort((a, b) => {
      const aFav = favoriteSet.has(a.id);
      const bFav = favoriteSet.has(b.id);

      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });




    res.json(deals);
  } catch (error) {
    console.error('❌ Error fetching published deals:', error);
    res.status(500).json({ error: error });
  }
};



const getDealById = async (req, res) => {
  try {
    const { id } = req.params;

    const [deal, records, usersDetail] = await Promise.all([
      dealStorage.getDealById(id),
      ManageTaxRate.getAll(),
      Submitter.listAll(req.query),
    ]);

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    // ENRICH WITH SUBMITTER INFO (same logic as published/admin)
    const email =
      deal.submitterEmail ||
      deal.email || // legacy fallback
      null;
    if (email) {
      const submitter = await getSubmitterByEmail(email);
      if (submitter) {
        deal.submitter = submitter;
      } else {
        deal.submitter = {
          name: deal.submitterName,
          email: deal.submitterEmail,
          phone: deal.submitterPhone,
          userType: deal.submitterUserType,
        };
      }
    } else {
      deal.submitter = null;
    }

    const userEmail = req.user?.email;
    const usersDetailArr = usersDetail.find(u => u.email === userEmail);

    const isAdmin = req.user?.role === 'admin';
    const isTeamMember = req.user?.role === 'team_member';
    const isSubmitter = req.user?.role === 'submitter';

    // Submitters may only view their own deals
    if (isSubmitter) {
      if (!deal.submitterEmail || deal.submitterEmail !== userEmail) {
        return res.status(404).json({ error: 'Deal not found' });
      }
      return res.json({ ...deal, taxRateSettings: records ?? [] });
    }

    const hasPriority = usersDetailArr?.priorityFirstAccess;
    const hasPartnership = usersDetailArr?.partnershipAccess;
    const hasTurnkey = usersDetailArr?.turnkeyAccess;

    // Check property type access permissions
    if (!isAdmin && !isTeamMember) {
      // Check Priority access
      if (deal.priorityFirstAccess === true && !hasPriority) {
        return res.status(403).json({
          error: 'Priority access required',
        });
      }
      // Check Partnership access
      if (deal.fiftyFiftyPartner === true && !hasPartnership) {
        return res.status(403).json({
          error: 'Partnership access required',
        });
      }
      // Check Turnkey access
      if (deal.turnkeyFurnished && deal.turnkeyFurnished !== 'NOT_FURNISHED' && !hasTurnkey) {
        return res.status(403).json({
          error: 'Turnkey access required',
        });
      }
    }

    return res.json({ ...deal, taxRateSettings: records ?? [] });
  } catch (error) {
    console.error('❌ Error fetching deal:', error);
    return res.status(500).json({ error: 'Failed to fetch deal' });
  }
};

const getMySubmissions = async (req, res) => {
  try {
    // Only allow authenticated users
    if (!req.user || !req.user.email) {
      console.error('❌ req.user missing email:', req.user);
      return res.status(401).json({
        error: 'Authenticated user email missing — cannot create deal',
      });
    }
    const allDeals = await dealStorage.getAllDeals();
    const myDeals = (allDeals || []).filter(
      (deal) =>
        deal.submitterEmail?.toLowerCase() === req.user.email.toLowerCase() &&
        deal.status !== 'draft'
    );
 
    res.json(myDeals);
  } catch (error) {
    console.error('❌ Error fetching submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
};

const markAsSold = async (req, res) => {
  try {
    const { id } = req.params;

    const deal = await dealStorage.getDealById(id);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    await dealStorage.updateDeal(id, {
      status: 'sold',
      soldAt: new Date().toISOString(),
      soldBy: req.user.email,
    });

    const updated = await dealStorage.getDealById(id);
    res.json(updated);
  } catch (err) {
    console.error('❌ markAsSold failed:', err);
    res.status(500).json({ error: 'Failed to mark as sold' });
  }
};

const revertSold = async (req, res) => {
  try {
    const { id } = req.params;

    const deal = await dealStorage.getDealById(id);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    if (deal.status !== 'sold') {
      return res.status(400).json({ error: 'Deal is not sold' });
    }

    await dealStorage.updateDeal(id, {
      status: 'published',
      soldAt: null,
      soldBy: null,
    });

    const updated = await dealStorage.getDealById(id);
    res.json(updated);
  } catch (err) {
    console.error('❌ revertSold failed:', err);
    res.status(500).json({ error: 'Failed to revert sold status' });
  }
};

const updateMyDeal = async (req, res) => {
  try {
    const { id } = req.params;
    const userEmail = req.user.email.toLowerCase();

    const deal = await dealStorage.getDealById(id);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    if ((deal.submitterEmail || '').toLowerCase() !== userEmail) {
      return res.status(403).json({
        error: 'Not authorized to edit this deal',
      });
    }

    const currentStatus = String(deal.status || '').toLowerCase();
    const LOCKED = new Set(['published', 'approved', 'sold']);
    if (LOCKED.has(currentStatus)) {
      return res.status(400).json({
        error:
          'Approved, published, or sold properties cannot be edited. Contact an admin.',
      });
    }

    const ALLOWED_FIELDS = ['title', 'description', 'story', 'price', 'discountPrice', 'status', 'submitterRelationship', 'streetAddress', 'addressLine2', 'city', 'stateRegion', 'postalCode', 'category', 'turnkey', 'turnkeyFurnished', 'bedrooms', 'bathrooms', 'yearBuilt', 'squareFootage', 'expiry_date', 'isHOA', 'hoaMonthlyFee', 'financingType', 'emd', 'downPayment', 'expectedCloseDate', 'financialInfo', 'assignmentFee', 'subjLoanBalance', 'subjInterestRate', 'subjLoanMaturity', 'subjMonthlyPrincipal', 'subjMonthlyInterest', 'subjMonthlyTaxesInsurance', 'sellerLoanAmount', 'sellerInterestRate', 'sellerLoanMaturity', 'sellerMonthlyPayment', 'totalMonthlyPayment', 'strZoning', 'strConfidence', 'strListingLink', 'strDataSheetsLink', 'vacationRentalMarkets', 'travelMotivations', 'guestDemandInsights', 'valueAddOpportunities', 'localContacts', 'interiorImages', 'exteriorImages', 'additionalImages', 'videos', 'strFinancialDocs', 'specialTags', 'additionalInfo',
      // STR operating status + key metrics
      'isOperatingSTR', 'hasStrFinancials',
      'occupancyRate', 'averageNightlyRate', 'strAnnualRevenue', 'strMonthlyRevenue', 'strMonthlyUtilities', 'strNOI', 'strCleaningFee', 'strAvgStay', 'strManagementFee', 'strBookingPlatform',
      // Creative financing — primary / second mortgage + seller equity + deal terms
      'hasPrimaryMortgage', 'primaryLoanBalance', 'primaryInterestRate', 'primaryMaturityDate', 'primaryPrincipalInterest', 'primaryTaxesInsurance',
      'hasSecondMortgage', 'secondLoanBalance', 'secondInterestRate', 'secondMaturityDate', 'secondPrincipalInterest', 'secondTaxesInsurance',
      'hasSellerEquity', 'sellerEquityAmount', 'sellerEquityInterestRate', 'sellerEquityMaturityDate', 'sellerEquityPrincipalInterest', 'sellerEquityBalloonYears',
      'dealTerms', 'totalStartingMonthlyPayment',
      // Current bookings (STR)
      'hasCurrentBookings', 'currentBookingsDescription',
      // Property contact, amenities/attractions, cover photo
      'contactName', 'contactPhone', 'contactRelation', 'sourceLink',
      'amenities', 'localAttractions', 'coverPhoto',
      // Submission source tracking (e.g. 'mobile_app') — kept on edits too.
      'submitted_source',
    ];
    // Submitters may set 'sold' too (e.g. when renewing an expired listing they
    // report it actually sold). 'sold' stamps the same soldAt/soldBy metadata as
    // the admin mark-sold path so the record stays consistent.
    const ALLOWED_STATUSES = new Set(['pending', 'sold']);

    const updates = {};
    for (const key of ALLOWED_FIELDS) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.status !== undefined) {
      const nextStatus = String(updates.status).toLowerCase();
      if (!ALLOWED_STATUSES.has(nextStatus)) {
        return res.status(400).json({
          error: 'Submitters may only set status to pending, or sold.',
        });
      }
      updates.status = nextStatus;
      if (nextStatus === 'sold') {
        updates.soldAt = new Date().toISOString();
        updates.soldBy = req.user.email;
        // A sold listing is no longer active, so it shouldn't read as expired.
        updates.expired_status = false;
      }
    }

    if (updates.price !== undefined && updates.price !== null && updates.price !== '') {
      const num = Number(updates.price);
      if (Number.isNaN(num)) {
        return res.status(400).json({ error: 'Price must be a number' });
      }
      updates.price = num;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No editable fields provided' });
    }

    updates.updatedAt = new Date().toISOString();

    await dealStorage.updateDeal(id, updates);
    const updated = await dealStorage.getDealById(id);
    return res.json(updated);
  } catch (err) {
    console.error('❌ updateMyDeal failed:', err);
    return res.status(500).json({ error: 'Failed to update deal' });
  }
};

const unsubmitDeal = async (req, res) => {
  try {
    const { id } = req.params;
    const userEmail = req.user.email.toLowerCase();

    const deal = await dealStorage.getDealById(id);

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    if (deal.submitterEmail !== userEmail) {
      return res.status(403).json({
        error: 'Not authorized to unsubmit this deal',
      });
    }

    if (deal.status !== 'pending') {
      return res.status(400).json({
        error: 'Only pending submissions can be unsubmitted',
      });
    }

    // DELETE from DynamoDB
    await dynamoDB.send(
      new DeleteCommand({
        TableName: TABLES.PROPERTIES,
        Key: { id },
      })
    );

    // Return the deleted deal so frontend can restore form
    return res.json({
      ...deal,
      status: 'draft',
      submittedAt: null,
    });
  } catch (err) {
    console.error('❌ Unsubmit failed:', err);
    return res.status(500).json({ error: 'Failed to unsubmit deal' });
  }
};

/* ------------ PUBLIC DEAL (no auth) ------------ */

const getPublicDealById = async (req, res) => {
  try {
    const { id } = req.params;

    const deal = await dealStorage.getDealById(id);

    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Only allow viewing published or sold deals publicly
    if (deal.status !== 'published' && deal.status !== 'sold' && deal.status !== 'pending') {
     return res.status(404).json({ error: 'Deal not found' });
    }

    // Enrich with submitter info
    const email = deal.submitterEmail || deal.email || null;
    if (email) {
      const submitter = await getSubmitterByEmail(email);
      if (submitter) {
        deal.submitter = submitter;
      } else {
        deal.submitter = {
          name: deal.submitterName,
          email: deal.submitterEmail,
          phone: deal.submitterPhone,
          userType: deal.submitterUserType,
        };
      }
    } else {
      deal.submitter = null;
    }

    // Hide sensitive address fields for public view

    return res.json(deal);
  } catch (error) {
    console.error('Error fetching public deal:', error);
    return res.status(500).json({ error: 'Failed to fetch deal' });
  }
};

/* ------------- STORE FILTER (per user) ------------- */

const getfilter = async (req, res) => {
  try {
    const userEmail = req.user.email;
    const buyBoxes = await BuyBox.findByUserId(userEmail);

    if (!buyBoxes || buyBoxes.length === 0) {
      return res.json({ data: null });
    }

    return res.json({ data: buyBoxes[0] });
  } catch (error) {
    console.error('Error fetching filter:', error);
    return res.status(500).json({ error: 'Failed to fetch filter' });
  }
};

const storefilter = async (req, res) => {
  try {
    const { name, filters_json } = req.body;
    
    const userEmail = req.user.email;

    // Fetch client data from DynamoDB by email
    const user = await Submitter.findByEmail(userEmail);
    if (!user) {
      return res.status(404).json({ error: 'not found' });
    }

    const userName = user.Name || `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();

    if (!filters_json || Object.keys(filters_json).length === 0) {
      return res.status(400).json({ error: 'No filter data provided' });
    }

    const existingBuyBoxes = await BuyBox.findByUserId(userEmail);
    let buyBox;

    if (existingBuyBoxes && existingBuyBoxes.length > 0) {
      buyBox = await BuyBox.update(existingBuyBoxes[0].id, {
        name: name || userName,
        filters_json,
        is_active: true,
      });
      return res.json({ message: 'Filter updated successfully', data: buyBox });
    }

    buyBox = await BuyBox.create({
      user_id: userEmail,
      name: name || userName,
      filters_json,
      is_active: true,
    });

    return res.json({ message: 'Filter saved successfully', data: buyBox });
  } catch (error) {
    console.error('Error storing filter:', error);
    return res.status(500).json({ error: 'Failed to store filter' });
  }
};
const deletefilter = async (req, res) => {
  try {
    const userEmail = req.user.email;

    console.log('Attempting to delete filter for user:', userEmail);

    const buyBoxes = await BuyBox.findByUserId(userEmail);

    if (!buyBoxes || buyBoxes.length === 0) {
      return res.status(404).json({ error: 'No saved buy box found' });
    }

    await BuyBox.delete(buyBoxes[0].id);
    return res.json({ message: 'Buy box deleted successfully' });
  } catch (error) {
    console.error('Error deleting filter:', error);
    return res.status(500).json({ error: 'Failed to delete filter' });
  }
};

const getManageFilter = async (req, res) => {
  try {
    const filters = await ManageFilter.getAll();

    const mapped = filters.map((f) => ({
      key: f.slug,
      label: f.label,
      section: f.section,
      enabled: f.enabled,
      min: f.min_value,
      max: f.max_value,
      format: f.format,
      step: f.step,
    }));

    return res.json({ filters: mapped });
  } catch (error) {
    console.error('Error getting manage filters:', error);
    return res.status(500).json({ error: 'Failed to get filters' });
  }
};

const storeManageFilter = async (req, res) => {
  try {
    const filters = req.body;

    if (!Array.isArray(filters) || filters.length === 0) {
      return res.status(400).json({ error: 'Filters array is required' });
    }

    const existingFilters = await ManageFilter.getAll();
    const existingBySlug = {};
    for (const f of existingFilters) {
      existingBySlug[f.slug] = f;
    }

    const results = [];

    for (const filter of filters) {
      try {
        const filterData = {
          label: filter.label,
          slug: filter.key,
          min_value: filter.min ?? null,
          max_value: filter.max ?? null,
          section: filter.section,
          enabled: filter.enabled ?? true,
          format: filter.format ?? null,
          step: filter.step ?? null,
        };

        const existing = existingBySlug[filter.key];

        if (existing) {
          // Update existing filter by slug
          const updated = await ManageFilter.update(existing.id, filterData);
          results.push({ slug: filter.key, status: 'updated', data: updated });
        } else {
          // Create new filter
          const created = await ManageFilter.create(filterData);
          results.push({ slug: filter.key, status: 'created', data: created });
        }
      } catch (err) {
        results.push({ slug: filter.key, status: 'error', message: err.message });
      }
    }

    return res.json({ message: 'Filters saved successfully', results });
  } catch (error) {
    console.error('Error storing manage filters:', error);
    return res.status(500).json({ error: 'Failed to store filters' });
  }
}

const getManageTaxRate = async (req, res) => {
  try {
    const records = await ManageTaxRate.getAll();
    if (records.length === 0) {
      return res.json({ settings: null });
    }
    return res.json({ settings: records[0] });
  } catch (error) {
    console.error('Error getting tax rate settings:', error);
    return res.status(500).json({ error: 'Failed to get tax rate settings' });
  }
};

const storeManageTaxRate = async (req, res) => {
  try {
    const data = req.body;

    const existing = await ManageTaxRate.getAll();

    let result;
    if (existing.length > 0) {
      result = await ManageTaxRate.update(existing[0].id, data);
    } else {
      result = await ManageTaxRate.create(data);
    }

    return res.json({ settings: result });
  } catch (error) {
    console.error('Error storing tax rate settings:', error);
    return res.status(500).json({ error: 'Failed to store tax rate settings' });
  }
}

module.exports = {
  createDeal,
  getPublishedDeals,
  getDealById,
  getPublicDealById,
  getMySubmissions,
  updateMyDeal,
  unsubmitDeal,
  markAsSold,
  revertSold,
  storefilter,
  getfilter,
  deletefilter,
  storeManageFilter,
  getManageFilter,
  storeManageTaxRate,
  getManageTaxRate,
};
