import api from './api';

export const calculatorAPI = {
  storeCalculator: (data) => api.post('/calculators', data),
  getCalculator: (email, type) => api.get(`/calculators/${email}/${type}`),
};