/**
 * Admin Controllers
 * Handle business logic for admin operations
 */
const backendConstants = require('../../backend_constants');
const dealStorage = backendConstants.dealStorage;

const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const Submitter = require('../models/Submitter');
const { dynamoDB, TABLES } = require('../config/aws');
const {
  generateAutoTags,
  mergeWithExistingTags,
} = require('../utils/autoTagger');
const { notifyMatchingUsers } = require('../services/dealPublishNotifier');

exports.getPendingRegistrations = async (req, res) => {
  try {
    const result = await dynamoDB.send(
      new ScanCommand({
        TableName: TABLES.PENDING_REGISTRATIONS,
        FilterExpression: '#status = :pending',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':pending': 'pending',
        },
      })
    );

    res.json(result.Items || []);
  } catch (err) {
    console.error('getPendingRegistrations error:', err);
    res.status(500).json({ error: 'Failed to fetch pending registrations' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    console.log('getAllUsers hit, query:', req.query);
    const users = await Submitter.listAll(req.query);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { email } = req.params;
    const updates = req.body;
    const timestamp = new Date().toISOString();

    // Check if trying to assign admin role
    if (updates.role === 'admin' || updates.userType === 'admin') {
      // Only admins can assign admin role
      if (req.user.role !== 'admin') {
        console.warn(
          `[AUDIT] ${timestamp} | ROLE_ASSIGNMENT_DENIED | ` +
            `Requester: ${req.user.email} (${req.user.role}) | ` +
            `Target: ${email} | Attempted Role: admin | ` +
            `Reason: Non-admin cannot assign admin role`
        );
        return res.status(403).json({
          error: 'Only administrators can assign the admin role',
          message: 'You do not have permission to assign admin privileges',
        });
      }
      console.log(
        `[AUDIT] ${timestamp} | ROLE_ASSIGNMENT_GRANTED | ` +
          `Admin: ${req.user.email} | Target: ${email} | New Role: admin`
      );
    }

    const updated = await Submitter.updateByEmail(email, updates);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const deactivateUser = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const updated = await Submitter.updateByEmail(email, {
      isActive: false,
    });

    return res.json({
      success: true,
      user: updated,
    });
  } catch (err) {
    console.error('Deactivate user error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get all pending deals
 */
const getPendingDeals = async (req, res) => {
  try {
    const deals = await dealStorage.getDealsByStatus('pending');
    res.json(deals);
  } catch (error) {
    console.error('Error fetching pending deals:', error);
    res.status(500).json({ error: 'Failed to fetch pending deals' });
  }
};

/**
 * Get all deals (for admin dashboard)
 */
const getAllDeals = async (req, res) => {
  try {

    console.log('Query : ',req.query)
    const { status, category, search } = req.query;

    let deals = await dealStorage.getAllDeals();

    if (status && status !== 'All' && status !=='expired') {
      deals = deals.filter((d) => d.status === status);
    }

    if(status == 'expired'){
      deals = deals.filter((d) => d.expired_status == true);
    }

    if (category && category !== 'All') {
      deals = deals.filter(
        (d) => d.category?.toLowerCase() === category.toLowerCase()
      );
    }

    if (search) {
      const q = search.toLowerCase();
      deals = deals.filter((d) => {
        const fullAddress = [d.streetAddress, d.city, d.stateRegion, d.postalCode]
          .filter(Boolean)
          .join(', ')
          .toLowerCase();
        const streetNum = (d.streetAddress || '').trim().split(' ')[0].replace(/\D/g, '');
        const postal = (d.postalCode || '').trim();
        const propertyId = streetNum && postal ? `${streetNum}-${postal}` : streetNum || postal || '';
        return (
          propertyId.toLowerCase().includes(q) ||
          d.title?.toLowerCase().includes(q) ||
          d.description?.toLowerCase().includes(q) ||
          fullAddress.includes(q) ||
          d.submitterName?.toLowerCase().includes(q) ||
          d.submitterEmail?.toLowerCase().includes(q) ||
          String(d.price || '').includes(q) ||
          String(d.downPayment || '').includes(q) ||
          String(d.subjInterestRate || '').includes(q) ||
          String(d.totalMonthlyPayment || '').includes(q) ||
          d.financingType?.toLowerCase().includes(q) ||
          d.status?.toLowerCase().includes(q)
        );
      });
    }

    res.json(deals);
  } catch (error) {
    console.error('Error fetching all deals:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
};

/**
 * Update a deal
 */
const updateDeal = async (req, res) => {
  try {
    const dealId = req.params.id;
    const updateData = req.body;

    // Check if deal exists
    const existingDeal = await dealStorage.getDealById(dealId);
    if (!existingDeal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.submittedAt;

    // Merge existing deal with updates for auto-tag generation
    const mergedDeal = { ...existingDeal, ...updateData };

    // Regenerate auto-tags based on updated data
    const autoTags = generateAutoTags(mergedDeal);
    updateData.autoTags = autoTags;

    // Merge auto-tags with any manual/special tags
    updateData.specialTags = mergeWithExistingTags(
      mergedDeal,
      updateData.specialTags || existingDeal.specialTags
    );

    const updatedDeal = await dealStorage.updateDeal(dealId, updateData);

    res.json(updatedDeal);
  } catch (error) {
    console.error('Error updating deal:', error);
    res.status(500).json({ error: 'Failed to update deal' });
  }
};

/**
 * Approve a deal
 */
const approveDeal = async (req, res) => {
  try {
    const dealId = req.params.id;

    // Check if deal exists
    const exists = await dealStorage.checkDealExistence(dealId);
    if (!exists) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    await dealStorage.approveDeal(dealId);
    const updatedDeal = await dealStorage.getDealById(dealId);

    res.json(updatedDeal);
  } catch (error) {
    console.error('Error approving deal:', error);
    res.status(500).json({ error: 'Failed to approve deal' });
  }
};

/**
 * Reject a deal
 */
const rejectDeal = async (req, res) => {
  try {
    const dealId = req.params.id;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    // Check if deal exists
    const exists = await dealStorage.checkDealExistence(dealId);
    if (!exists) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    await dealStorage.rejectDeal(dealId, reason);
    const updatedDeal = await dealStorage.getDealById(dealId);

    res.json(updatedDeal);
  } catch (error) {
    console.error('Error rejecting deal:', error);
    res.status(500).json({ error: 'Failed to reject deal' });
  }
};

/**
 * Publish a deal to customer view
 */
const publishDeal = async (req, res) => {
  try {
    // Only admins can publish
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Only administrators can publish properties',
        message: 'Please submit this property for admin review instead',
      });
    }

    const dealId = req.params.id;

    // Check if deal exists
    const deal = await dealStorage.getDealById(dealId);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Cannot publish sold properties
    if (deal.status === 'sold') {
      return res.status(400).json({
        error: 'Cannot publish a sold property',
      });
    }

    // Check if deal is approved
    if (deal.status !== 'approved') {
      return res
        .status(400)
        .json({ error: 'Only approved deals can be published' });
    }

    await dealStorage.publishDeal(dealId);
    const updatedDeal = await dealStorage.getDealById(dealId);

    // Notify users whose saved filters match this deal.
    // Fire-and-forget: errors are caught inside notifyMatchingUsers so they
    // never prevent the HTTP 200 response from reaching the admin.
	console.log('send notification....');
	
	
    notifyMatchingUsers(updatedDeal).catch((err) =>
      console.error('❌ Background notifyMatchingUsers error:', err)
    );

    res.json(updatedDeal);
  } catch (error) {
    console.error('Error publishing deal:', error);
    res.status(500).json({ error: 'Failed to publish deal' });
  }
};

/**
 * Unpublish a deal
 */
const unpublishDeal = async (req, res) => {
  try {
    // Only admins can unpublish
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Only administrators can unpublish properties',
      });
    }

    const dealId = req.params.id;

    // Check if deal exists
    const deal = await dealStorage.getDealById(dealId);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Only published deals can be unpublished
    if (deal.status !== 'published') {
      return res.status(400).json({ error: 'Deal is not published' });
    }

    await dealStorage.unpublishDeal(dealId);

    const updatedDeal = await dealStorage.getDealById(dealId);
    res.json(updatedDeal);
  } catch (error) {
    console.error('Error unpublishing deal:', error);
    res.status(500).json({ error: 'Failed to unpublish deal' });
  }
};

/**
 * Delete a deal (admin only, rejected deals only)
 */
const deleteDeal = async (req, res) => {
  try {
    // Only admins can delete
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Only administrators can delete properties',
      });
    }

    const dealId = req.params.id;

    // Check if deal exists
    const deal = await dealStorage.getDealById(dealId);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Only rejected deals can be deleted
    if (deal.status !== 'rejected') {
      return res.status(400).json({
        error: 'Only rejected properties can be permanently deleted',
      });
    }

    await dealStorage.deleteDeal(dealId);

    res.json({
      success: true,
      message: 'Rejected deal deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting deal:', error);
    res.status(500).json({ error: 'Failed to delete deal' });
  }
};

const getAdminUser = async (req, res) => {
  try {
    const { email } = req.params;
    const decodedEmail = Buffer.from(email, 'base64').toString('utf-8');
    const user = await Submitter.findByEmail(decodedEmail);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error('getAdminUser error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

module.exports = {
  getAdminUser,
  getAllUsers,
  updateUser,
  deactivateUser,
  getPendingDeals,
  getAllDeals,
  updateDeal,
  approveDeal,
  rejectDeal,
  publishDeal,
  unpublishDeal,
  deleteDeal,
};
