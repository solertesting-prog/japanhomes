import React, { useState, useEffect } from 'react';
import { X, Bell } from 'lucide-react';
import { Button } from './ui/button';
import { useNotifications } from '../contexts/NotificationContext';
import { useWallet } from '../contexts/WalletContext';

const NotificationPrompt = () => {
  const [show, setShow] = useState(false);
  const { notificationsEnabled, enableNotifications } = useNotifications();
  const { isConnected } = useWallet();

  useEffect(() => {
    // Show prompt after 5 seconds if user is connected and hasn't enabled notifications
    const dismissed = localStorage.getItem('notificationPromptDismissed');
    
    if (isConnected && !notificationsEnabled && !dismissed) {
      const timer = setTimeout(() => {
        setShow(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, notificationsEnabled]);

  const handleEnable = async () => {
    const granted = await enableNotifications();
    if (granted) {
      setShow(false);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('notificationPromptDismissed', 'true');
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm" data-testid="notification-prompt">
      <div className="bg-white rounded-sm shadow-lg border-2 border-[#C5A059] p-6">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          data-testid="dismiss-notification-prompt"
        >
          <X className="w-4 h-4" />
        </button>
        
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-[#181B38] rounded-sm flex items-center justify-center flex-shrink-0">
            <Bell className="w-6 h-6 text-[#C5A059]" />
          </div>
          <div className="flex-1">
            <h3 className="font-['Outfit'] text-lg font-semibold mb-2">
              Stay Updated
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Enable notifications to get alerts about new properties, price changes, and your transactions.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleEnable}
                className="bg-[#181B38] text-white hover:bg-[#181B38]/90 rounded-none flex-1"
                data-testid="enable-notifications-btn"
              >
                Enable Notifications
              </Button>
              <Button
                onClick={handleDismiss}
                variant="outline"
                className="rounded-none"
                data-testid="maybe-later-btn"
              >
                Maybe Later
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationPrompt;