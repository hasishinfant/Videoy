import api from './axios';

export const getLiveSessions = () =>
  api.get('/api/admin/sessions/live');

export const getAllSessions = (limit = 50, offset = 0) =>
  api.get(`/api/admin/sessions?limit=${limit}&offset=${offset}`);

export const forceEndSession = (token) =>
  api.patch(`/api/admin/sessions/${token}/end`);

export const getStats = () =>
  api.get('/api/admin/stats');
