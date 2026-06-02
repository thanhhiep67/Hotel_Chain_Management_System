import api from './axios';

export const getMyNotifications  = (params) => api.get('/notifications', { params });
export const markAllNotifRead    = ()  => api.patch('/notifications/read-all');
export const clearAllNotifs      = ()  => api.delete('/notifications');
