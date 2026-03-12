// Web Push Notifications Service

class NotificationService {
  constructor() {
    this.isSupported = 'Notification' in window;
    this.permission = this.isSupported ? Notification.permission : 'denied';
  }

  // Request permission for notifications
  async requestPermission() {
    if (!this.isSupported) {
      console.warn('Notifications not supported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  // Show a notification
  show(title, options = {}) {
    if (!this.isSupported || this.permission !== 'granted') {
      console.warn('Notifications not permitted');
      return null;
    }

    const defaultOptions = {
      icon: '/logo192.png',
      badge: '/logo192.png',
      vibrate: [200, 100, 200],
      tag: 'zencapital-notification',
      requireInteraction: false,
      ...options
    };

    try {
      const notification = new Notification(title, defaultOptions);
      
      // Auto close after 5 seconds if not clicked
      setTimeout(() => {
        notification.close();
      }, 5000);

      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      return null;
    }
  }

  // Notification for new property
  notifyNewProperty(property) {
    return this.show('🏠 New Property Available!', {
      body: `${property.name} in ${property.location.city}\nYield: ${property.financials.annual_yield}% | Price: $${property.token_price}/token`,
      tag: `property-${property.id}`,
      data: { type: 'new_property', propertyId: property.id },
      actions: [
        { action: 'view', title: 'View Property' },
        { action: 'close', title: 'Close' }
      ]
    });
  }

  // Notification for price change
  notifyPriceChange(property, oldPrice, newPrice) {
    const change = ((newPrice - oldPrice) / oldPrice * 100).toFixed(1);
    const emoji = newPrice < oldPrice ? '📉' : '📈';
    
    return this.show(`${emoji} Price Alert: ${property.name}`, {
      body: `Token price ${newPrice < oldPrice ? 'decreased' : 'increased'} by ${Math.abs(change)}%\nNew price: $${newPrice}`,
      tag: `price-${property.id}`,
      data: { type: 'price_change', propertyId: property.id },
    });
  }

  // Notification for KYC status
  notifyKYCStatus(status) {
    const messages = {
      approved: { title: '✅ KYC Approved!', body: 'Your identity has been verified. You now have full access.' },
      rejected: { title: '❌ KYC Rejected', body: 'Your KYC submission was rejected. Please check your email for details.' },
      pending: { title: '⏳ KYC Submitted', body: 'Your documents are being reviewed. We\'ll notify you within 48 hours.' }
    };

    const message = messages[status] || messages.pending;
    return this.show(message.title, {
      body: message.body,
      tag: 'kyc-status',
      requireInteraction: true
    });
  }

  // Notification for successful purchase
  notifyPurchaseSuccess(property, tokenAmount, totalCost) {
    return this.show('🎉 Purchase Successful!', {
      body: `You bought ${tokenAmount} tokens of ${property.name}\nTotal: $${totalCost.toLocaleString()}`,
      tag: 'purchase-success',
      data: { type: 'purchase', propertyId: property.id },
      requireInteraction: true
    });
  }

  // Notification for reservation expiring soon
  notifyReservationExpiring(property, hoursLeft) {
    return this.show('⏰ Reservation Expiring Soon!', {
      body: `Your reservation for ${property.name} expires in ${hoursLeft} hours.`,
      tag: `reservation-${property.id}`,
      data: { type: 'reservation', propertyId: property.id },
      requireInteraction: true
    });
  }

  // Notification for tokens almost sold out
  notifyAlmostSoldOut(property, tokensLeft) {
    return this.show('🔥 Almost Sold Out!', {
      body: `Only ${tokensLeft} tokens left for ${property.name}\nDon't miss out!`,
      tag: `soldout-${property.id}`,
      data: { type: 'almost_soldout', propertyId: property.id }
    });
  }

  // Check if permission is granted
  isPermissionGranted() {
    return this.permission === 'granted';
  }

  // Get permission status
  getPermissionStatus() {
    return this.permission;
  }
}

const notificationService = new NotificationService();
export default notificationService;