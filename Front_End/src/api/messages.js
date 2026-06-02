import api from './axios';

export const getThreads       = (params)              => api.get('/messages/threads', { params });
export const getThreadInfo    = (threadId)            => api.get(`/messages/thread-info/${threadId}`);
export const getMessages      = (threadId, params)    => api.get(`/messages/${threadId}`, { params });
export const sendMessage      = (data)                => api.post('/messages', data);
export const markMessagesRead = (threadId)            => api.patch(`/messages/${threadId}/read`);
export const uploadImage      = (file)                => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/messages/upload-image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const getOnlineStatus  = (userIds)             => api.get('/messages/online-status', {
  params: { userIds: userIds.join(',') },
});
