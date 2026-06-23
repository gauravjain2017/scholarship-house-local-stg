const Deal = require('../models/Deal');
const { createResponse, createErrorResponse } = require('../utils/response');
const { deleteS3Objects } = require('../utils/s3Helper');
const { dynamoDB, TABLES } = require('../config/aws');
const { GetCommand } = require('@aws-sdk/lib-dynamodb');

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
    email: result.Item.Email,
    name: result.Item.Name,
    phone: result.Item.Phone || '',
    userType: result.Item.UserType,
  };
}

// Admin: Get all deals with filters
exports.getAllDeals = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const filters = {
      status: params.status,
      category: params.category,
      search: params.search,
    };

    let deals = await Deal.getAll(filters);

    console.log('🧪 ADMIN RAW DEAL SAMPLE:', JSON.stringify(deals[0], null, 2));

    // Attach submitter info to each deal
    for (const deal of deals) {
      // Prefer the canonical field, but fall back for legacy rows
      const email =
        deal.submitterEmail ||
        deal.email || // legacy
        deal.submitter_email || // just in case
        null;

      console.log('🔎 DEAL email used for lookup:', email);

      if (email) {
        const submitter = await getSubmitterByEmail(email);

        if (submitter) {
          deal.submitter = submitter;
        } else {
          deal.submitter = {
            name: deal.submitterName,
            email: deal.submitterEmail,
            phone: deal.submitterPhone,
          };
        }
      } else {
        console.warn(
          '⚠️ No email available to resolve submitter for deal:',
          deal.id
        );
        deal.submitter = null;
      }
    }

    deals = sortDeals(deals, params.sortBy);

    console.log('ADMIN DEAL SAMPLE:', JSON.stringify(deals[0], null, 2));

    return createResponse(200, deals);
  } catch (error) {
    console.error('Error fetching all deals:', error);
    return createErrorResponse(500, 'Failed to fetch deals', error.message);
  }
};

// Admin: Update deal
exports.updateDeal = async (event) => {
  try {
    const { id } = event.pathParameters;
    const updates = JSON.parse(event.body || '{}');

    // Validate required fields if they're being updated
    if (
      updates.title !== undefined &&
      (!updates.title || !updates.title.trim())
    ) {
      return createErrorResponse(400, 'Title is required');
    }
    if (
      updates.category !== undefined &&
      (!updates.category ||
        updates.category === 'All' ||
        !updates.category.trim())
    ) {
      return createErrorResponse(400, 'Valid category is required');
    }
    if (
      updates.price !== undefined &&
      (!updates.price || parseFloat(updates.price) <= 0)
    ) {
      return createErrorResponse(400, 'Valid price is required');
    }
    if (
      updates.streetAddress !== undefined &&
      (!updates.streetAddress || !updates.streetAddress.trim())
    ) {
      return createErrorResponse(400, 'Street address is required');
    }

    // If images are being updated, detect removed images and delete from S3
    if (
      updates.interiorImages !== undefined ||
      updates.exteriorImages !== undefined ||
      updates.additionalImages !== undefined
    ) {
      const existingDeal = await Deal.getById(id);
      if (existingDeal) {
        const oldImages = [
          ...(existingDeal.interiorImages || []),
          ...(existingDeal.exteriorImages || []),
          ...(existingDeal.additionalImages || []),
        ];

        const newImages = [
          ...(updates.interiorImages || existingDeal.interiorImages || []),
          ...(updates.exteriorImages || existingDeal.exteriorImages || []),
          ...(updates.additionalImages || existingDeal.additionalImages || []),
        ];

        const removedImages = oldImages.filter(
          (url) => !newImages.includes(url)
        );

        if (removedImages.length > 0) {
          await deleteS3Objects(removedImages);
        }
      }
    }

    const deal = await Deal.update(id, updates);
    return createResponse(200, deal);
  } catch (error) {
    console.error('Error updating deal:', error);
    return createErrorResponse(500, 'Failed to update deal', error.message);
  }
};

// Admin: Approve deal
exports.approveDeal = async (event) => {
  try {
    const { id } = event.pathParameters;
    const deal = await Deal.updateStatus(id, 'approved');
    return createResponse(200, deal);
  } catch (error) {
    console.error('Error approving deal:', error);
    return createErrorResponse(500, 'Failed to approve deal', error.message);
  }
};

// Admin: Reject deal
exports.rejectDeal = async (event) => {
  try {
    const { id } = event.pathParameters;
    const { reason } = JSON.parse(event.body);

    const deal = await Deal.updateStatus(id, 'rejected', {
      rejectionReason: reason,
    });
    return createResponse(200, deal);
  } catch (error) {
    console.error('Error rejecting deal:', error);
    return createErrorResponse(500, 'Failed to reject deal', error.message);
  }
};

// Admin: Publish deal
exports.publishDeal = async (event) => {
  try {
    const { id } = event.pathParameters;
    const deal = await Deal.updateStatus(id, 'published');
    return createResponse(200, deal);
  } catch (error) {
    console.error('Error publishing deal:', error);
    return createErrorResponse(500, 'Failed to publish deal', error.message);
  }
};

// Admin: Unpublish deal
exports.unpublishDeal = async (event) => {
  try {
    const { id } = event.pathParameters;
    const deal = await Deal.updateStatus(id, 'pending', {
      publishedAt: null,
    });
    return createResponse(200, deal);
  } catch (error) {
    console.error('Error unpublishing deal:', error);
    return createErrorResponse(500, 'Failed to unpublish deal', error.message);
  }
};

// Admin: Delete deal
exports.deleteDeal = async (event) => {
  try {
    const { id } = event.pathParameters;
    await Deal.delete(id);
    return createResponse(200, { message: 'Deal deleted successfully' });
  } catch (error) {
    console.error('Error deleting deal:', error);
    return createErrorResponse(500, 'Failed to delete deal', error.message);
  }
};

// Helper function to sort deals (admin view - no priority sorting)
function sortDeals(deals, sortBy) {
  return deals.sort((a, b) => {
    const priceA = Number(a.price) || 0;
    const priceB = Number(b.price) || 0;

    switch (sortBy) {
      case 'price-low':
        return priceA - priceB;
      case 'price-high':
        return priceB - priceA;
      case 'category':
        return (a.category || '').localeCompare(b.category || '');
      case 'submittedAt':
        return new Date(a.submittedAt) - new Date(b.submittedAt);
      case 'newest':
      default:
        return (
          new Date(b.submittedAt || b.createdAt) -
          new Date(a.submittedAt || a.createdAt)
        );
    }
  });
}
