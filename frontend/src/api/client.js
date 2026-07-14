import axios from 'axios';

const client = axios.create({
  // In dev, '/api' is proxied to the Express backend by vite.config.js.
  // In production, frontend and backend live on different domains, so set
  // VITE_API_URL to your deployed backend's URL (e.g. https://api.example.com/api).
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach the JWT to every request once the user is logged in.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('settleup_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If the token is invalid/expired, the backend returns 401 - clear it and
// let the AuthContext redirect to login rather than showing a broken screen.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('settleup_token');
    }
    return Promise.reject(error);
  }
);

export default client;
