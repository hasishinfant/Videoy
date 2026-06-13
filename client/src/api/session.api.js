import api from './axios';

export const createSession = () =>
  api.post('/api/sessions');

export const listSessions = () =>
  api.get('/api/sessions');

export const getSession = (token) =>
  api.get(`/api/sessions/${token}`);

export const endSession = (token) =>
  api.patch(`/api/sessions/${token}/end`);

export const getSessionSummary = (token) =>
  api.get(`/api/sessions/${token}/summary`);
