import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const SERVER_URL = API_URL.replace(/\/api\/?$/, '');

const api = axios.create({ baseURL: API_URL, timeout: 20000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('microfund_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
    localStorage.removeItem('microfund_token');
    window.dispatchEvent(new Event('microfund:logout'));
  }
  return Promise.reject(error);
});

export const errorMessage = (error, fallback = 'Something went wrong. Please try again.') => error.response?.data?.error?.message || error.message || fallback;
export default api;
