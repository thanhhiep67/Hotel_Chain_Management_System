import api from './axios';

export const getPlatformStats  = ()                            => api.get('/stats');
export const getCityCounts     = (cities)                      => api.get('/stats/cities', { params: { cities } });
export const searchHotels      = (params)                      => api.get('/hotels', { params });
export const getHotelById      = (id)                          => api.get(`/hotels/${id}`);
export const getMyHotels       = ()                            => api.get('/hotels/my-hotels');
export const createHotel       = (data)                        => api.post('/hotels', data);
export const updateHotel       = (id, data)                    => api.put(`/hotels/${id}`, data);
export const deleteHotel       = (id)                          => api.delete(`/hotels/${id}`);
export const getNearbyHotels   = (lat, lng, radiusKm = 10, limit = 20) =>
  api.get('/hotels/nearby', { params: { lat, lng, radiusKm, limit } });
