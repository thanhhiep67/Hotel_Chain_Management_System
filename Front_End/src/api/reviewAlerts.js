import api from './axios';

export const getReviewAlerts  = (resolved = false) =>
  api.get('/admin/review-alerts', { params: { resolved } });

export const resolveAlert = (id) =>
  api.patch(`/admin/review-alerts/${id}/resolve`);
