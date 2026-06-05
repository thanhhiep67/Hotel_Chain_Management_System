import api from './axios';

export const getHybridRecommendations = (size = 6) =>
  api.get('/recommendations', { params: { size } });

// Individual signals — kept for debugging / admin use
export const getRecommendations = (size = 8) =>
  api.get('/recommendations/rooms', { params: { size } });

export const getCollaborativeRecommendations = (size = 8) =>
  api.get('/recommendations/rooms/collaborative', { params: { size } });
