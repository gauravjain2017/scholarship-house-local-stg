import api from './api';

export const submittersAPI = {
  checkExistsByEmail: async (email) => {
    const res = await api.get('/submitters/exists', {
      params: { email },
    });
    return res.data.exists;
  },
};

export const getAdminUsers = (params = {}) =>
  api.get('/admin/users', { params });

export default submittersAPI;
