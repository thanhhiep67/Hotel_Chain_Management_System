import api from './axios';

export const searchHotels  = (params)       => api.get('/hotels', { params });
export const getHotelById  = (id)           => api.get(`/hotels/${id}`);
export const getMyHotels   = ()             => api.get('/hotels/my-hotels');
export const createHotel   = (data)         => api.post('/hotels', data);
export const updateHotel   = (id, data)     => api.put(`/hotels/${id}`, data);
export const deleteHotel   = (id)           => api.delete(`/hotels/${id}`);
