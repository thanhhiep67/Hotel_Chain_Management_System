import api from './axios';

export const createPayment  = (data)   => api.post('/payments/create', data);
export const getMyPayments  = (params) => api.get('/payments/my-payments', { params });
export const getPaymentById = (id)     => api.get(`/payments/${id}`);
