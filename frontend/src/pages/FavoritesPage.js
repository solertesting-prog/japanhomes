import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Heart, Bell, BellOff, TrendingUp } from 'lucide-react';
import { api } from '../lib/api';
import { useWallet } from '../contexts/WalletContext';
import { useFavorites } from '../contexts/FavoritesContext';

const FavoritesPage = () => {
  const { isConnected, walletAddress } = useWallet();
  const navigate = useNavigate();
  const { favorites, removeFavorite, toggleNotifications, loading } = useFavorites();
  const [favoritesWithDetails, setFavoritesWithDetails] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(true);

  useEffect(() => {
    if (!isConnected) {
      navigate('/');
      return;
    }
    loadFavoritesDetails();
  }, [isConnected, favorites]);

  const loadFavoritesDetails = async () => {
    if (!walletAddress) return;
    
    setLoadingDetails(true);
    try {
      const response = await api.getFavoritesWithDetails(walletAddress);
      setFavoritesWithDetails(response.data);
    } catch (error) {
      console.error('Failed to load favorites with details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleRemove = async (propertyId) => {
    await removeFavorite(propertyId);
    loadFavoritesDetails();
  };

  const handleToggleNotification = async (propertyId, currentStatus) => {
    await toggleNotifications(propertyId, !currentStatus);
    loadFavoritesDetails();
  };

  if (loading || loadingDetails) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="animate-pulse space-y-8">
            <div className="h-32 bg-gray-200 rounded-sm" />
            <div className="grid md:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <div key={i} className="h-96 bg-gray-200 rounded-sm" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF9] pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {/* Header */}
        <div className="mb-12">
          <h1 className="font-['Outfit'] text-4xl md:text-6xl font-bold tracking-tight mb-4" data-testid="favorites-title">
            My Favorites
          </h1>
          <p className="text-base md:text-lg text-muted-foreground">
            Properties you're interested in with personalized notifications
          </p>
        </div>

        {/* Favorites Grid */}
        {favoritesWithDetails.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-8" data-testid="favorites-grid">
            {favoritesWithDetails.map(({ favorite, property }, idx) => (
              <Card key={idx} className="border-2 border-[#C5A059]/20 hover:border-[#C5A059]/50 transition" data-testid={`favorite-card-${idx}`}>
                <CardContent className="p-0">
                  {/* Property Image */}
                  <Link to={`/property/${property.id}`}>
                    <div className="aspect-video overflow-hidden rounded-t-sm">
                      <img
                        src={property.images[0]?.url || 'https://via.placeholder.com/400x300'}
                        alt={property.name}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  </Link>

                  <div className="p-6">
                    {/* Property Info */}
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          {property.location.city}
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {property.property_type}
                        </span>
                      </div>
                      <Link to={`/property/${property.id}`}>
                        <h3 className="font-['Outfit'] text-xl font-medium mb-2 hover:text-[#C5A059] transition">
                          {property.name}
                        </h3>
                      </Link>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {property.description}
                      </p>
                    </div>

                    {/* Financials */}
                    <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-border">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Annual Yield</div>
                        <div className="font-['Space_Mono'] text-lg font-bold text-[#10B981]">
                          {property.financials.annual_yield}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Token Price</div>
                        <div className="font-['Space_Mono'] text-lg font-bold">
                          ${property.token_price}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        onClick={() => handleToggleNotification(property.id, favorite.notification_enabled)}
                        variant="outline"
                        className="h-10 rounded-none"
                        data-testid={`toggle-notification-${idx}`}
                      >
                        {favorite.notification_enabled ? (
                          <Bell className="w-4 h-4 mr-2 text-[#C5A059]" />
                        ) : (
                          <BellOff className="w-4 h-4 mr-2" />
                        )}
                        {favorite.notification_enabled ? 'Notifying' : 'Notify Off'}
                      </Button>
                      
                      <Button
                        onClick={() => handleRemove(property.id)}
                        variant="outline"
                        className="h-10 rounded-none hover:bg-red-50 hover:text-red-600 hover:border-red-600"
                        data-testid={`remove-favorite-${idx}`}
                      >
                        <Heart className="w-4 h-4 mr-2 fill-current" />
                        Remove
                      </Button>
                    </div>

                    {/* Added Date */}
                    <p className="text-xs text-muted-foreground text-center mt-3">
                      Added {new Date(favorite.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <Heart className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-medium mb-2">No favorites yet</h3>
              <p className="text-muted-foreground mb-6">
                Start adding properties to your favorites to get personalized notifications
              </p>
              <Link to="/marketplace">
                <Button className="bg-[#181B38] text-white hover:bg-[#181B38]/90 rounded-none">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Browse Properties
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default FavoritesPage;
