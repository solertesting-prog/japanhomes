import React, { createContext, useContext, useEffect, useState } from 'react';
import notificationService from '../lib/notifications';
import { api } from '../lib/api';
import { useWallet } from './WalletContext';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [watchedProperties, setWatchedProperties] = useState([]);
  const { isConnected, walletAddress } = useWallet();

  useEffect(() => {
    // Check if notifications are already enabled
    const enabled = notificationService.isPermissionGranted();
    setNotificationsEnabled(enabled);

    // Load watched properties from localStorage
    const saved = localStorage.getItem('watchedProperties');
    if (saved) {
      setWatchedProperties(JSON.parse(saved));
    }
  }, []);

  // Monitor property changes
  useEffect(() => {
    if (!notificationsEnabled || watchedProperties.length === 0) return;

    const interval = setInterval(async () => {
      try {
        // Check for updates on watched properties
        for (const propertyId of watchedProperties) {
          const response = await api.getProperty(propertyId);
          const property = response.data;

          // Check if almost sold out (less than 10% available)
          const availablePercent = (property.available_tokens / property.total_tokens) * 100;
          if (availablePercent < 10 && availablePercent > 0) {
            notificationService.notifyAlmostSoldOut(property, property.available_tokens);
          }
        }
      } catch (error) {
        console.error('Error checking property updates:', error);
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [notificationsEnabled, watchedProperties]);

  const enableNotifications = async () => {
    const granted = await notificationService.requestPermission();
    setNotificationsEnabled(granted);
    return granted;
  };

  const watchProperty = (propertyId) => {
    if (!watchedProperties.includes(propertyId)) {
      const updated = [...watchedProperties, propertyId];
      setWatchedProperties(updated);
      localStorage.setItem('watchedProperties', JSON.stringify(updated));
      return true;
    }
    return false;
  };

  const unwatchProperty = (propertyId) => {
    const updated = watchedProperties.filter(id => id !== propertyId);
    setWatchedProperties(updated);
    localStorage.setItem('watchedProperties', JSON.stringify(updated));
  };

  const isWatching = (propertyId) => {
    return watchedProperties.includes(propertyId);
  };

  return (
    <NotificationContext.Provider
      value={{
        notificationsEnabled,
        enableNotifications,
        watchProperty,
        unwatchProperty,
        isWatching,
        watchedProperties,
        notificationService
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};