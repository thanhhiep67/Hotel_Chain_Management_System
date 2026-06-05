import api from './axios';

export const getHotelReviews = (hotelId, params) =>
  api.get(`/reviews/hotel/${hotelId}`, { params });

export const createReview = (data) => api.post('/reviews', data);

export const uploadReviewImage = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/messages/upload-image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
