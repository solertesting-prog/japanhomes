import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useWallet } from './WalletContext';
import { toast } from 'sonner';

const FavoritesContext = createContext(null);

export const FavoritesProvider = ({ children }) => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const { walletAddress, isConnected } = useWallet();

  useEffect(() => {
    if (isConnected && walletAddress) {
      loadFavorites();
    } else {
      setFavorites([]);
    }
  }, [isConnected, walletAddress]);

  const loadFavorites = async () => {
    if (!walletAddress) return;
    
    setLoading(true);
    try {
      const response = await api.getUserFavorites(walletAddress);
      setFavorites(response.data);
    } catch (error) {
      console.error('Failed to load favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  const addFavorite = async (propertyId, propertyName) => {
    if (!walletAddress) {
      toast.error('Please connect your wallet first');
      return false;
    }

    try {
      await api.addFavorite({
        property_id: propertyId,
        wallet_address: walletAddress,
        notification_enabled: true
      });
      
      await loadFavorites();
      toast.success(`${propertyName} added to favorites!`);
      return true;
    } catch (error) {
      console.error('Failed to add favorite:', error);
      toast.error(error.response?.data?.detail || 'Failed to add to favorites');
      return false;
    }
  };

  const removeFavorite = async (propertyId) => {
    if (!walletAddress) return false;

    try {
      await api.removeFavorite(propertyId, walletAddress);
      await loadFavorites();
      toast.success('Removed from favorites');
      return true;
    } catch (error) {
      console.error('Failed to remove favorite:', error);
      toast.error('Failed to remove from favorites');
      return false;
    }
  };

  const isFavorite = (propertyId) => {
    return favorites.some(fav => fav.property_id === propertyId);
  };

  const toggleNotifications = async (propertyId, enabled) => {
    if (!walletAddress) return false;

    try {
      await api.toggleFavoriteNotifications(propertyId, walletAddress, enabled);
      await loadFavorites();
      toast.success(`Notifications ${enabled ? 'enabled' : 'disabled'}`);
      return true;
    } catch (error) {
      console.error('Failed to toggle notifications:', error);
      toast.error('Failed to update notifications');
      return false;
    }
  };

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        loading,
        addFavorite,
        removeFavorite,
        isFavorite,
        toggleNotifications,
        refreshFavorites: loadFavorites
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within FavoritesProvider');
  }
  return context;
};
