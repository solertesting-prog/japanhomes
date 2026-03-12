import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const api = {
  // Auth
  connectWallet: (data) => axios.post(`${API}/auth/connect-wallet`, data),
  verifySignature: (data) => axios.post(`${API}/auth/verify-signature`, data),
  getProfile: (walletAddress) => axios.get(`${API}/auth/profile/${walletAddress}`),
  getBalance: (walletAddress) => axios.get(`${API}/auth/balance/${walletAddress}`),

  // Properties
  getProperties: (params) => axios.get(`${API}/properties`, { params }),
  getProperty: (id) => axios.get(`${API}/properties/${id}`),
  getFeaturedProperties: () => axios.get(`${API}/properties/featured/list`),
  createProperty: (data) => axios.post(`${API}/properties`, data),
  updateProperty: (id, data) => axios.put(`${API}/properties/${id}`, data),

  // Transactions
  purchaseTokens: (data) => axios.post(`${API}/transactions/purchase`, data),
  getWalletTransactions: (walletAddress) => axios.get(`${API}/transactions/wallet/${walletAddress}`),
  getTransactionStatus: (txHash) => axios.get(`${API}/transactions/status/${txHash}`),
  getPortfolio: (walletAddress) => axios.get(`${API}/transactions/portfolio/${walletAddress}`),

  // Reservations
  createReservation: (data) => axios.post(`${API}/reservations`, data),
  getUserReservations: (walletAddress) => axios.get(`${API}/reservations/wallet/${walletAddress}`),
  cancelReservation: (id) => axios.put(`${API}/reservations/${id}/cancel`),

  // KYC
  submitKYC: (data, walletAddress) => axios.post(`${API}/kyc/submit?wallet_address=${walletAddress}`, data),
  getKYCStatus: (walletAddress) => axios.get(`${API}/kyc/status/${walletAddress}`),

  // Admin
  getAllUsers: (params) => axios.get(`${API}/admin/users`, { params }),
  getKYCRequests: (params) => axios.get(`${API}/admin/kyc-requests`, { params }),
  approveKYC: (walletAddress) => axios.put(`${API}/admin/kyc/${walletAddress}/approve`),
  rejectKYC: (walletAddress, reason) => axios.put(`${API}/admin/kyc/${walletAddress}/reject?reason=${reason}`),
  getAnalytics: () => axios.get(`${API}/admin/analytics`),
  deleteProperty: (id) => axios.delete(`${API}/admin/properties/${id}`),
};

export default api;