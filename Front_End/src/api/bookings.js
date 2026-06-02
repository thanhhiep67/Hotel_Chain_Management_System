import api from './axios';

export const createBooking      = (data)        => api.post('/bookings', data);
export const getMyBookings      = (params)      => api.get('/bookings/my', { params });
export const cancelBooking      = (id, reason)  => api.patch(`/bookings/${id}/cancel`, { reason });
export const getRoomById        = (id)          => api.get(`/rooms/${id}`);
export const getRoomBookedDates = (id)          => api.get(`/rooms/${id}/booked-dates`);

// Staff / Owner management
export const getHotelBookings = (hotelId, params) => api.get(`/bookings/hotel/${hotelId}`, { params });
export const confirmBooking   = (id)              => api.patch(`/bookings/${id}/confirm`);
export const rejectBooking    = (id, reason)      => api.patch(`/bookings/${id}/reject`, { reason });
export const checkInBooking   = (id)              => api.patch(`/bookings/${id}/check-in`);
export const checkOutBooking  = (id)              => api.patch(`/bookings/${id}/check-out`);

// Single booking lookup (STAFF / OWNER / USER)
export const getBookingById = (id) => api.get(`/bookings/${id}`);

// Payment
export const payBooking = (id) => api.patch(`/bookings/${id}/pay`);

// QR check-in
// responseType: 'blob' — server trả PNG trực tiếp, không phải JSON
export const getCheckInQr = (id)      => api.get(`/bookings/${id}/qr`, { responseType: 'blob' });
export const scanQr        = (payload) => api.post('/bookings/verify-qr', { payload });
