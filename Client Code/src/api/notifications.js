import api from './api';

export const notificationsAPI = {
  // Admin-only endpoints (for /notifications page)
  getAll: () => api.get('/admin/notifications'),
  getById: (id) => api.get(`/admin/notifications/${id}`),
  markAsRead: (id) => api.patch(`/admin/notifications/${id}/read`),
  delete: (id) => api.delete(`/admin/notifications/${id}`),

  // Non-admin endpoints (for /property-notifications page — client role)
  getMyNotifications: () => api.get('/notifications/client'),
  myGetById: (id) => api.get(`/notifications/${id}`),
  myMarkAsRead: (id) => api.patch(`/notifications/${id}/read`),
  myDelete: (id) => api.delete(`/notifications/${id}`),
};
