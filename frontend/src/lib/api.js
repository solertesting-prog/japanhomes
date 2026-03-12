import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Create axios instance with trailing slash handling
const axiosInstance = axios.create({
  baseURL: API,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add trailing slash to all URLs
axiosInstance.interceptors.request.use((config) => {
  if (config.url && !config.url.endsWith('/') && !config.url.includes('?')) {
    config.url += '/';
  }
  return config;
});

export const api = {
  // Auth
  connectWallet: (data) => axiosInstance.post('/auth/connect-wallet/', data),
  verifySignature: (data) => axiosInstance.post('/auth/verify-signature/', data),
  getProfile: (walletAddress) => axiosInstance.get(`/auth/profile/${walletAddress}/`),
  getBalance: (walletAddress) => axiosInstance.get(`/auth/balance/${walletAddress}/`),

  // Properties
  getProperties: (params) => axiosInstance.get('/properties/', { params }),
  getProperty: (id) => axiosInstance.get(`/properties/${id}/`),
  getFeaturedProperties: () => axiosInstance.get('/properties/featured/list/'),
  createProperty: (data) => axiosInstance.post('/properties/', data),
  updateProperty: (id, data) => axiosInstance.put(`/properties/${id}/`, data),

  // Transactions
  purchaseTokens: (data) => axiosInstance.post('/transactions/purchase/', data),
  getWalletTransactions: (walletAddress) => axiosInstance.get(`/transactions/wallet/${walletAddress}/`),
  getTransactionStatus: (txHash) => axiosInstance.get(`/transactions/status/${txHash}/`),
  getPortfolio: (walletAddress) => axiosInstance.get(`/transactions/portfolio/${walletAddress}/`),

  // Reservations
  createReservation: (data) => axiosInstance.post('/reservations/', data),
  getUserReservations: (walletAddress) => axiosInstance.get(`/reservations/wallet/${walletAddress}/`),
  cancelReservation: (id) => axiosInstance.put(`/reservations/${id}/cancel/`),

  // KYC
  submitKYC: (data, walletAddress) => axiosInstance.post(`/kyc/submit/?wallet_address=${walletAddress}`, data),
  getKYCStatus: (walletAddress) => axiosInstance.get(`/kyc/status/${walletAddress}/`),

  // Admin
  getAllUsers: (params) => axiosInstance.get('/admin/users/', { params }),
  getKYCRequests: (params) => axiosInstance.get('/admin/kyc-requests/', { params }),
  approveKYC: (walletAddress) => axiosInstance.put(`/admin/kyc/${walletAddress}/approve/`),
  rejectKYC: (walletAddress, reason) => axiosInstance.put(`/admin/kyc/${walletAddress}/reject/?reason=${reason}`),
  getAnalytics: () => axiosInstance.get('/admin/analytics/'),
  deleteProperty: (id) => axiosInstance.delete(`/admin/properties/${id}/`),
};

export default api;