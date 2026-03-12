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

// Add trailing slash to URLs except those with path parameters
axiosInstance.interceptors.request.use((config) => {
  if (config.url) {
    // Don't add trailing slash if URL has path parameters (contains segments after base)
    // or if it already ends with slash, or contains query params
    const hasPathParams = config.url.split('/').length > 2; // More than just /resource/
    const hasQueryParams = config.url.includes('?');
    const endsWithSlash = config.url.endsWith('/');
    
    // Only add trailing slash for simple resource URLs like /properties/
    if (!hasPathParams && !hasQueryParams && !endsWithSlash) {
      config.url += '/';
    }
  }
  return config;
});

export const api = {
  // Auth
  connectWallet: (data) => axiosInstance.post('/auth/connect-wallet/', data),
  verifySignature: (data) => axiosInstance.post('/auth/verify-signature/', data),
  getProfile: (walletAddress) => axiosInstance.get(`/auth/profile/${walletAddress}`),
  getBalance: (walletAddress) => axiosInstance.get(`/auth/balance/${walletAddress}`),

  // Properties
  getProperties: (params) => axiosInstance.get('/properties/', { params }),
  getProperty: (id) => axiosInstance.get(`/properties/${id}`),
  getFeaturedProperties: () => axiosInstance.get('/properties/featured/list/'),
  createProperty: (data) => axiosInstance.post('/properties/', data),
  updateProperty: (id, data) => axiosInstance.put(`/properties/${id}`, data),

  // Transactions
  purchaseTokens: (data) => axiosInstance.post('/transactions/purchase/', data),
  getWalletTransactions: (walletAddress) => axiosInstance.get(`/transactions/wallet/${walletAddress}`),
  getTransactionStatus: (txHash) => axiosInstance.get(`/transactions/status/${txHash}`),
  getPortfolio: (walletAddress) => axiosInstance.get(`/transactions/portfolio/${walletAddress}`),

  // Reservations
  createReservation: (data) => axiosInstance.post('/reservations/', data),
  getUserReservations: (walletAddress) => axiosInstance.get(`/reservations/wallet/${walletAddress}`),
  cancelReservation: (id) => axiosInstance.put(`/reservations/${id}/cancel`),

  // KYC
  submitKYC: (data, walletAddress) => axiosInstance.post(`/kyc/submit?wallet_address=${walletAddress}`, data),
  getKYCStatus: (walletAddress) => axiosInstance.get(`/kyc/status/${walletAddress}`),

  // Admin
  getAllUsers: (params) => axiosInstance.get('/admin/users/', { params }),
  getKYCRequests: (params) => axiosInstance.get('/admin/kyc-requests/', { params }),
  approveKYC: (walletAddress) => axiosInstance.put(`/admin/kyc/${walletAddress}/approve`),
  rejectKYC: (walletAddress, reason) => axiosInstance.put(`/admin/kyc/${walletAddress}/reject?reason=${reason}`),
  getAnalytics: () => axiosInstance.get('/admin/analytics/'),
  deleteProperty: (id) => axiosInstance.delete(`/admin/properties/${id}`),

  // Favorites
  addFavorite: (data) => axiosInstance.post('/favorites/', data),
  getUserFavorites: (walletAddress) => axiosInstance.get(`/favorites/wallet/${walletAddress}`),
  getFavoritesWithDetails: (walletAddress) => axiosInstance.get(`/favorites/wallet/${walletAddress}/details`),
  removeFavorite: (propertyId, walletAddress) => axiosInstance.delete(`/favorites/${propertyId}?wallet_address=${walletAddress}`),
  toggleFavoriteNotifications: (propertyId, walletAddress, enabled) => 
    axiosInstance.put(`/favorites/${propertyId}/notifications?wallet_address=${walletAddress}&enabled=${enabled}`),

  // Recommendations
  getRecommendationsForUser: (walletAddress, limit = 6) => 
    axiosInstance.get(`/recommendations/for-user/${walletAddress}?limit=${limit}`),
  getSimilarProperties: (propertyId, limit = 4) => 
    axiosInstance.get(`/recommendations/similar/${propertyId}?limit=${limit}`),
  getTrendingProperties: (limit = 6) => 
    axiosInstance.get(`/recommendations/trending?limit=${limit}`),
};

export default api;