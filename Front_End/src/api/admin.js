import api from './axios';

export const getAdminHotels      = (params) => api.get('/hotels/admin', { params });
export const updateHotelStatus   = (id, status) => api.patch(`/hotels/${id}/status`, { status });

export const getAdminUsers       = (params) => api.get('/admin/users', { params });
export const updateUserStatus    = (id, status) => api.patch(`/admin/users/${id}/status`, { status });
export const deleteAdminUser     = (id) => api.delete(`/admin/users/${id}`);
