// API client configuration

import axios, { AxiosError, AxiosInstance } from 'axios';
import { getToken, removeToken } from './auth';

const API_URL = import.meta.env.VITE_API_BASE_URL;

const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper function to remove undefined values from objects
const removeUndefined = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (obj[key] !== undefined) {
        cleaned[key] = removeUndefined(obj[key]);
      }
    }
    return cleaned;
  }
  return obj;
};

// Request interceptor: Add token to all requests and clean undefined values
apiClient.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // If FormData, don't set Content-Type and don't clean data
    if (config.data instanceof FormData) {
      // Let the browser set Content-Type with boundary for multipart/form-data
      delete config.headers['Content-Type'];
      console.log('API Request (FormData):', {
        method: config.method,
        url: config.url,
        baseURL: config.baseURL,
        fullURL: `${config.baseURL}${config.url}`,
        hasToken: !!token,
        dataType: 'FormData',
      });
      return config;
    }
    
    // Remove undefined values from request data (only for non-FormData)
    if (config.data && typeof config.data === 'object') {
      config.data = removeUndefined(config.data);
    }
    
    console.log('API Request:', {
      method: config.method,
      url: config.url,
      baseURL: config.baseURL,
    });
    
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor: Handle 401 errors globally
apiClient.interceptors.response.use(
  (response) => {
    console.log('API Response:', {
      status: response.status,
      url: response.config.url,
      method: response.config.method,
    });
    return response;
  },
  (error: AxiosError) => {
    console.error('API Response Error:', {
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method,
      message: error.message,
      data: error.response?.data,
    });
    
    if (error.response?.status === 401) {
      removeToken();
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;

