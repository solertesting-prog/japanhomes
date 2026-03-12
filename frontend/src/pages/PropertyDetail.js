import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { MapPin, TrendingUp, Home, Calendar, ArrowLeft, ShoppingCart, Clock, Bell, BellOff, Heart } from 'lucide-react';
import { api } from '../lib/api';
import { useWallet } from '../contexts/WalletContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { toast } from 'sonner';

const PropertyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { walletAddress, isConnected, connectWallet } = useWallet();
  const { watchProperty, unwatchProperty, isWatching, notificationsEnabled, enableNotifications } = useNotifications();
  const { addFavorite, removeFavorite, isFavorite } = useFavorites();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tokenAmount, setTokenAmount] = useState(1);
  const [purchasing, setPurchasing] = useState(false);
  const [watching, setWatching] = useState(false);
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    loadProperty();
  }, [id]);

  useEffect(() => {
    if (property) {
      setWatching(isWatching(property.id));
      setFavorited(isFavorite(property.id));
    }
  }, [property, isWatching, isFavorite]);

  const loadProperty = async () => {
    try {
      const response = await api.getProperty(id);
      setProperty(response.data);
    } catch (error) {
      console.error('Failed to load property:', error);
      toast.error('Failed to load property details');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!isConnected) {
      connectWallet();
      return;
    }

    if (tokenAmount < 1 || tokenAmount > property.available_tokens) {
      toast.error(`Please enter a valid amount (1-${property.available_tokens})`);
      return;
    }

    setPurchasing(true);
    try {
      // Sign message for purchase
      const message = `Purchase ${tokenAmount} tokens`;
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, walletAddress]
      });

      const response = await api.purchaseTokens({
        property_id: property.id,
        token_amount: parseInt(tokenAmount),
        wallet_address: walletAddress,
        payment_method: 'crypto',
        signature
      });

      toast.success('Purchase successful!');
      loadProperty();
      navigate('/portfolio');
    } catch (error) {
      console.error('Purchase failed:', error);
      toast.error(error.response?.data?.detail || 'Purchase failed. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleReservation = async () => {
    if (!isConnected) {
      connectWallet();
      return;
    }

    try {
      await api.createReservation({
        property_id: property.id,
        token_amount: parseInt(tokenAmount),
        wallet_address: walletAddress
      });
      toast.success('Tokens reserved for 24 hours!');
    } catch (error) {
      console.error('Reservation failed:', error);
      toast.error(error.response?.data?.detail || 'Reservation failed');
    }
  };

  const handleToggleWatch = async () => {
    if (!notificationsEnabled) {
      const granted = await enableNotifications();
      if (!granted) {
        toast.error('Please enable notifications to watch properties');
        return;
      }
    }

    if (watching) {
      unwatchProperty(property.id);
      setWatching(false);
      toast.success('Stopped watching this property');
    } else {
      watchProperty(property.id);
      setWatching(true);
      toast.success('You\'ll be notified about updates for this property');
    }
  };

  const handleToggleFavorite = async () => {
    if (!isConnected) {
      connectWallet();
      return;
    }

    if (favorited) {
      const success = await removeFavorite(property.id);
      if (success) {
        setFavorited(false);
      }
    } else {
      const success = await addFavorite(property.id, property.name);
      if (success) {
        setFavorited(true);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="animate-pulse space-y-8">
            <div className="h-96 bg-gray-200 rounded-sm" />
            <div className="h-64 bg-gray-200 rounded-sm" />
          </div>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 md:px-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Property not found</h2>
          <Button onClick={() => navigate('/marketplace')} variant="outline">
            Back to Marketplace
          </Button>
        </div>
      </div>
    );
  }

  const totalCost = tokenAmount * property.token_price;

  return (
    <div className="min-h-screen bg-[#FAFAF9] pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {/* Back Button */}
        <Button
          onClick={() => navigate('/marketplace')}
          variant="ghost"
          className="mb-6"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Marketplace
        </Button>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            {/* Images */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 aspect-video overflow-hidden rounded-sm">
                <img
                  src={property.images[0]?.url || 'https://via.placeholder.com/800x450'}
                  alt={property.name}
                  className="w-full h-full object-cover"
                  data-testid="property-main-image"
                />
              </div>
              {property.images.slice(1, 4).map((img, idx) => (
                <div key={idx} className="aspect-video overflow-hidden rounded-sm">
                  <img
                    src={img.url}
                    alt={img.alt}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>

            {/* Property Info */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {property.location.city}
                  </span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {property.property_type}
                  </span>
                </div>
                <CardTitle className="font-['Outfit'] text-3xl" data-testid="property-name">
                  {property.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base leading-relaxed text-muted-foreground mb-6" data-testid="property-description">
                  {property.description}
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <Home className="w-5 h-5 text-[#C5A059]" />
                    <div>
                      <div className="text-xs text-muted-foreground">Size</div>
                      <div className="font-['Space_Mono'] font-bold">{property.size_sqm} m²</div>
                    </div>
                  </div>
                  {property.bedrooms && (
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="text-xs text-muted-foreground">Bedrooms</div>
                        <div className="font-['Space_Mono'] font-bold">{property.bedrooms}</div>
                      </div>
                    </div>
                  )}
                  {property.year_built && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-[#C5A059]" />
                      <div>
                        <div className="text-xs text-muted-foreground">Built</div>
                        <div className="font-['Space_Mono'] font-bold">{property.year_built}</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-6 border-t">
                  <h3 className="font-['Outfit'] text-xl font-semibold mb-4">Location</h3>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-5 h-5 text-[#C5A059] mt-1" />
                    <div>
                      <p className="font-medium">{property.location.address}</p>
                      <p className="text-sm text-muted-foreground">
                        {property.location.city}, {property.location.prefecture} {property.location.postal_code}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Info */}
            <Card>
              <CardHeader>
                <CardTitle className="font-['Outfit'] text-2xl">Financial Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Current Valuation</div>
                    <div className="font-['Space_Mono'] text-2xl font-bold">
                      ${property.financials.current_valuation.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Annual Yield</div>
                    <div className="font-['Space_Mono'] text-2xl font-bold text-[#10B981]">
                      {property.financials.annual_yield}%
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Projected Appreciation</div>
                    <div className="font-['Space_Mono'] text-xl font-bold">
                      {property.financials.projected_appreciation}%
                    </div>
                  </div>
                  {property.financials.rental_income_monthly && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Monthly Rental Income</div>
                      <div className="font-['Space_Mono'] text-xl font-bold">
                        ${property.financials.rental_income_monthly.toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Purchase Card */}
          <div className="md:col-span-1">
            <Card className="sticky top-24 border-2 border-[#C5A059]/20" data-testid="purchase-card">
              <CardHeader>
                <CardTitle className="font-['Outfit'] text-2xl">Purchase Tokens</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Token Price</span>
                    <span className="font-['Space_Mono'] font-bold" data-testid="token-price">
                      ${property.token_price}
                    </span>
                  </div>
                  <div className="flex justify-between mb-4">
                    <span className="text-sm text-muted-foreground">Available Tokens</span>
                    <span className="font-['Space_Mono']" data-testid="available-tokens">
                      {property.available_tokens} / {property.total_tokens}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Number of Tokens</label>
                  <Input
                    type="number"
                    min="1"
                    max={property.available_tokens}
                    value={tokenAmount}
                    onChange={(e) => setTokenAmount(e.target.value)}
                    className="h-12 rounded-none"
                    data-testid="token-amount-input"
                  />
                </div>

                <div className="pt-4 border-t">
                  <div className="flex justify-between mb-4">
                    <span className="font-medium">Total Cost</span>
                    <span className="font-['Space_Mono'] text-xl font-bold" data-testid="total-cost">
                      ${totalCost.toLocaleString()}
                    </span>
                  </div>
                </div>

                {property.status === 'sold_out' ? (
                  <Button className="w-full" disabled>
                    Sold Out
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handlePurchase}
                      disabled={purchasing || !property.available_tokens}
                      className="w-full bg-[#181B38] text-white hover:bg-[#181B38]/90 h-12 rounded-none border-l-4 border-[#C5A059] font-medium"
                      data-testid="purchase-btn"
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      {purchasing ? 'Processing...' : isConnected ? 'Buy Now' : 'Connect Wallet to Buy'}
                    </Button>
                    <Button
                      onClick={handleReservation}
                      variant="outline"
                      className="w-full h-12 rounded-none"
                      data-testid="reserve-btn"
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      Reserve for 24h
                    </Button>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={handleToggleFavorite}
                        variant={favorited ? "default" : "outline"}
                        className={`h-12 rounded-none ${favorited ? 'bg-red-500 hover:bg-red-600 text-white' : ''}`}
                        data-testid="favorite-btn"
                      >
                        <Heart className={`w-4 h-4 mr-2 ${favorited ? 'fill-current' : ''}`} />
                        {favorited ? 'Favorited' : 'Add to Favorites'}
                      </Button>
                      
                      <Button
                        onClick={handleToggleWatch}
                        variant={watching ? "default" : "outline"}
                        className={`h-12 rounded-none ${watching ? 'bg-[#C5A059] text-[#181B38] hover:bg-[#C5A059]/90' : ''}`}
                        data-testid="watch-btn"
                      >
                        {watching ? <BellOff className="w-4 h-4 mr-2" /> : <Bell className="w-4 h-4 mr-2" />}
                        {watching ? 'Watching' : 'Watch'}
                      </Button>
                    </div>
                  </>
                )}

                <p className="text-xs text-muted-foreground text-center">
                  All transactions are secured by smart contracts on Polygon blockchain
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetail;