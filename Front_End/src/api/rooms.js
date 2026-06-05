import api from './axios';

export const createRoom       = (data)     => api.post('/rooms', data);
export const updateRoom       = (id, data) => api.put(`/rooms/${id}`, data);
export const deleteRoom       = (id)       => api.delete(`/rooms/${id}`);
export const getAvailableRooms = (params)  => api.get('/rooms/available', { params });
