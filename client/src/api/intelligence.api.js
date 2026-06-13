import api from './axios';

export const getOverview = () =>
  api.get('/api/intelligence/overview');

export const getTopIssues = (limit = 10) =>
  api.get(`/api/intelligence/issues?limit=${limit}`);
