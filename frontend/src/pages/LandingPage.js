import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowRight, TrendingUp, Shield, Zap, Globe } from 'lucide-react';
import { api } from '../lib/api';
import { useWallet } from '../contexts/WalletContext';

const LandingPage = () => {
  const [featuredProperties, setFeaturedProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const { connectWallet, isConnected } = useWallet();

  useEffect(() => {
    loadFeaturedProperties();
  }, []);

  const loadFeaturedProperties = async () => {
    try {
      const response = await api.getFeaturedProperties();
      setFeaturedProperties(response.data);
    } catch (error) {
      console.error('Failed to load featured properties:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      {/* Hero Section */}
      <section
        className="relative h-screen flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1764268845537-f3ce51fd6a6b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzh8MHwxfHNlYXJjaHwzfHxtb2Rlcm4lMjB0b2t5byUyMGFyY2hpdGVjdHVyZSUyMHNreXNjcmFwZXIlMjBuaWdodHxlbnwwfHx8fDE3NzMzMjIyNTB8MA&ixlib=rb-4.1.0&q=85)',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
        data-testid="hero-section"
      >
        <div className="absolute inset-0 bg-[#181B38]/70" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 text-center">
          <h1 className="font-['Outfit'] text-5xl md:text-7xl font-bold tracking-tight text-white mb-6" data-testid="hero-title">
            Tokenized Real Estate
            <br />
            <span className="text-[#C5A059]">in Japan</span>
          </h1>
          <p className="text-base md:text-lg leading-relaxed text-white/90 mb-8 max-w-2xl mx-auto" data-testid="hero-description">
            Invest in premium Japanese properties through blockchain technology. 
            Own fractions of Tokyo apartments, Kyoto machiya, and commercial spaces.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isConnected ? (
              <Link to="/marketplace">
                <Button
                  className="bg-[#C5A059] text-[#181B38] hover:bg-[#C5A059]/90 h-12 px-8 rounded-none font-medium text-base"
                  data-testid="explore-properties-btn"
                >
                  Explore Properties
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            ) : (
              <Button
                onClick={connectWallet}
                className="bg-[#C5A059] text-[#181B38] hover:bg-[#C5A059]/90 h-12 px-8 rounded-none font-medium text-base"
                data-testid="get-started-btn"
              >
                Get Started
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            )}
            <Link to="/marketplace">
              <Button
                variant="outline"
                className="h-12 px-8 rounded-none border-white text-white hover:bg-white hover:text-[#181B38] font-medium text-base"
                data-testid="view-marketplace-btn"
              >
                View Marketplace
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 md:py-32" data-testid="features-section">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <h2 className="font-['Outfit'] text-3xl md:text-5xl font-semibold tracking-tight text-center mb-16">
            Why ZenCapital?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 border border-border/50 bg-gradient-to-br from-white/50 to-transparent rounded-sm" data-testid="feature-card-1">
              <div className="w-12 h-12 bg-[#181B38] rounded-sm flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-[#C5A059]" />
              </div>
              <h3 className="font-['Outfit'] text-2xl font-medium mb-3">Secure & Transparent</h3>
              <p className="text-base leading-relaxed text-muted-foreground">
                All transactions recorded on Polygon blockchain. Smart contracts ensure security and transparency.
              </p>
            </div>
            <div className="p-8 border border-border/50 bg-gradient-to-br from-white/50 to-transparent rounded-sm" data-testid="feature-card-2">
              <div className="w-12 h-12 bg-[#181B38] rounded-sm flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-[#C5A059]" />
              </div>
              <h3 className="font-['Outfit'] text-2xl font-medium mb-3">Fractional Ownership</h3>
              <p className="text-base leading-relaxed text-muted-foreground">
                Start investing from as low as $100. Own tokens representing real property shares.
              </p>
            </div>
            <div className="p-8 border border-border/50 bg-gradient-to-br from-white/50 to-transparent rounded-sm" data-testid="feature-card-3">
              <div className="w-12 h-12 bg-[#181B38] rounded-sm flex items-center justify-center mb-4">
                <Globe className="w-6 h-6 text-[#C5A059]" />
              </div>
              <h3 className="font-['Outfit'] text-2xl font-medium mb-3">Global Access</h3>
              <p className="text-base leading-relaxed text-muted-foreground">
                Invest in Japanese real estate from anywhere in the world. No geographical limitations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Properties */}
      <section className="py-24 md:py-32 bg-white" data-testid="featured-properties-section">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex justify-between items-center mb-12">
            <h2 className="font-['Outfit'] text-3xl md:text-5xl font-semibold tracking-tight">
              Featured Properties
            </h2>
            <Link to="/marketplace">
              <Button variant="outline" className="rounded-none" data-testid="view-all-btn">
                View All
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
          
          {loading ? (
            <div className="grid md:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-96 bg-gray-200 animate-pulse rounded-sm" />
              ))}
            </div>
          ) : featuredProperties.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-8">
              {featuredProperties.map((property) => (
                <Link key={property.id} to={`/property/${property.id}`}>
                  <div
                    className="group relative overflow-hidden bg-card border border-border/50 hover:border-[#C5A059]/50 transition-colors duration-500 rounded-sm cursor-pointer"
                    data-testid={`property-card-${property.id}`}
                  >
                    <div className="aspect-video overflow-hidden">
                      <img
                        src={property.images[0]?.url || 'https://via.placeholder.com/400x300'}
                        alt={property.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <div className="p-6">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          {property.location.city}
                        </span>
                      </div>
                      <h3 className="font-['Outfit'] text-xl font-medium mb-3">{property.name}</h3>
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Yield</span>
                          <span className="font-['Space_Mono'] font-bold text-[#10B981]">
                            {property.financials.annual_yield}%
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Token Price</span>
                          <span className="font-['Space_Mono'] font-bold">
                            ${property.token_price}
                          </span>
                        </div>
                      </div>
                      <Button
                        className="w-full bg-[#181B38] text-white hover:bg-[#181B38]/90 rounded-none"
                        data-testid={`view-property-btn-${property.id}`}
                      >
                        View Property
                      </Button>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No featured properties available yet.</p>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 md:py-32 bg-[#181B38] text-white" data-testid="cta-section">
        <div className="max-w-7xl mx-auto px-4 md:px-8 text-center">
          <h2 className="font-['Outfit'] text-3xl md:text-5xl font-semibold tracking-tight mb-6">
            Start Your Investment Journey
          </h2>
          <p className="text-base md:text-lg leading-relaxed text-white/90 mb-8 max-w-2xl mx-auto">
            Join thousands of investors building wealth through tokenized real estate.
          </p>
          {!isConnected && (
            <Button
              onClick={connectWallet}
              className="bg-[#C5A059] text-[#181B38] hover:bg-[#C5A059]/90 h-12 px-8 rounded-none font-medium text-base"
              data-testid="cta-connect-btn"
            >
              Connect Wallet to Get Started
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          )}
        </div>
      </section>
    </div>
  );
};

export default LandingPage;