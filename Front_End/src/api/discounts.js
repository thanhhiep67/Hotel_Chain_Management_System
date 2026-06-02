import api from './axios';

export const validateDiscount   = (data)       => api.post('/discounts/validate', data);
export const createDiscount     = (data)        => api.post('/discounts', data);
export const updateDiscount     = (id, data)    => api.put(`/discounts/${id}`, data);
export const getMyDiscounts     = (params)      => api.get('/discounts', { params });
export const getActiveDiscounts = ()            => api.get('/discounts/active');
export const toggleDiscount     = (id)          => api.patch(`/discounts/${id}/toggle`);
export const deleteDiscount     = (id)          => api.delete(`/discounts/${id}`);
