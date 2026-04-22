import api from './api';

/**
 * Drafts API client
 *
 * Backend endpoints (adjust paths if yours differ):
 *   POST   /drafts         -> createDraft(payload)
 *   GET    /drafts/mine    -> getMyDrafts(email)   (requires ?email=)
 *   GET    /drafts/:id     -> getDraftById(id)
 *   PUT    /drafts/:id     -> updateDraft(id, payload)
 *   DELETE /drafts/:id     -> deleteDraft(id)
 *
 * All endpoints target the `draft_properties` DynamoDB table.
 */

export const createDraft = (payload) =>
  api.post('/drafts', payload);

export const updateDraft = (id, payload) =>
  api.put(`/drafts/${id}`, payload);

export const getMyDrafts = (email) =>
  api.get('/drafts/mine', { params: { email } });

export const getDraftById = (id) =>
  api.get(`/drafts/${id}`);

export const deleteDraft = (id) =>
  api.delete(`/drafts/${id}`);

// Grouped export for components that prefer `draftsAPI.method(...)` style.
// Each method unwraps `res.data` so callers get the payload directly
// (matching the pattern dealsAPI likely uses in SubmitterView).
export const draftsAPI = {
  createDraft: async (payload) => {
    const res = await createDraft(payload);
    return res?.data?.data ?? res?.data;
  },
  updateDraft: async (id, payload) => {
    const res = await updateDraft(id, payload);
    return res?.data?.data ?? res?.data;
  },
  getMyDrafts: async (email) => {
    if (!email) return [];
    const res = await getMyDrafts(email);
    const list = res?.data?.data ?? res?.data ?? [];
    return Array.isArray(list) ? list : [];
  },
  getDraftById: async (id) => {
    const res = await getDraftById(id);
    return res?.data?.data ?? res?.data;
  },
  deleteDraft: async (id) => {
    await deleteDraft(id);
  },
};

export default draftsAPI;
