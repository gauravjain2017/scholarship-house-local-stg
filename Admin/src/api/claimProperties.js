import api from './api';

export const claimPropertiesAPI = {
  getAll: async (filters = {}) => {
    const response = await api.get('/admin/claim-properties', { params: filters });
    return response.data;
  },

  updateStatus: async (id, status, extra = {}) => {
    const response = await api.patch(`/admin/claim-properties/${id}`, { status, ...extra });
    return response.data;
  },

  approve: async (id, notes = '') => {
    const response = await api.patch(`/admin/claim-properties/${id}`, { claim_id: id, status: 'approved', notes });
    return response.data;
  },

  reject: async (id, reason) => {
    const response = await api.patch(`/admin/claim-properties/${id}`, { claim_id: id, status: 'rejected', reason });
    return response.data;
  },

  remove: async (id) => {
    const response = await api.delete(`/admin/claim-properties/${id}`);
    return response.data;
  },
};

export default claimPropertiesAPI;
