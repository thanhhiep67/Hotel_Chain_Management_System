import api from './axios';
import axios from 'axios';

const BASE_URL = 'http://localhost:8080';

export const getOverview        = (hotelId)               => api.get('/analytics/overview',          { params: { hotelId } });
export const getRevenue         = (hotelId, params)        => api.get('/analytics/revenue',            { params: { hotelId, ...params } });
export const getBookingsByStatus = (hotelId, params)       => api.get('/analytics/bookings-by-status', { params: { hotelId, ...params } });
export const getTopRooms        = (hotelId, params)        => api.get('/analytics/top-rooms',          { params: { hotelId, ...params } });
export const getDiscountStats   = (hotelId, params)        => api.get('/analytics/discounts',          { params: { hotelId, ...params } });
export const getPriceSuggestion = (hotelId)                => api.get('/analytics/price-suggestion',   { params: { hotelId } });
export const getForecast        = (hotelId)                => api.get('/analytics/forecast',            { params: { hotelId } });

export const exportExcel = async (hotelId, from, to) => {
  const token = localStorage.getItem('accessToken');
  const res = await axios.get(`${BASE_URL}/reports/export`, {
    params: { hotelId, from, to },
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'blob',
  });
  // Trigger browser download
  const url  = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href  = url;
  link.download = `bao-cao-${hotelId}-${from}-${to}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
};
