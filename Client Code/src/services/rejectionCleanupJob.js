const backendConstants = require('../../backend_constants');
const { dealStorage } = backendConstants;

const deleteExpiredRejectedDeals = async () => {
  const now = new Date().toISOString();

  const allDeals = await dealStorage.getAllDeals();

  const toDelete = allDeals.filter(
    (d) =>
      d.status === 'rejected' &&
      d.rejectionDelete &&
      d.rejectionDelete <= now
  );

  console.log(
    `[rejectionCleanup] Found ${toDelete.length} rejected properties to delete`
  );
  const results = [];
  for (const deal of toDelete) {
    try {
      await dealStorage.deleteDeal(deal.id);
      results.push({ id: deal.id, deleted: true });
      console.log(
        `[rejectionCleanup] Deleted rejected property ${deal.id} (rejectionDelete: ${deal.rejectionDelete})`
      );
    } catch (err) {
      console.error(
        `[rejectionCleanup] Failed to delete property ${deal.id}:`,
        err.message
      );
      results.push({ id: deal.id, deleted: false, error: err.message });
    }
  }

  console.log(
    `[rejectionCleanup] Done — ${results.filter((r) => r.deleted).length}/${toDelete.length} deleted`
  );
  return results;
};

module.exports = { deleteExpiredRejectedDeals };
