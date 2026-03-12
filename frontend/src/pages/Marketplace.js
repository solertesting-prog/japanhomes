import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Search, SlidersHorizontal } from 'lucide-react';
import { api } from '../lib/api';

const Marketplace = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    city: 'all',
    property_type: 'all',
    min_yield: '',
    max_price: '',
    status: 'active'
  });

  useEffect(() => {
    loadProperties();
  }, [filters]);

  const loadProperties = async () => {
    setLoading(true);
    try {
      const params = {};
      
      // Only add non-empty and non-'all' filters
      if (filters.city && filters.city !== 'all') params.city = filters.city;
      if (filters.property_type && filters.property_type !== 'all') params.property_type = filters.property_type;
      if (filters.min_yield) params.min_yield = filters.min_yield;
      if (filters.max_price) params.max_price = filters.max_price;
      if (filters.status) params.status = filters.status;
      
      const response = await api.getProperties(params);
      setProperties(response.data);
    } catch (error) {
      console.error('Failed to load properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProperties = properties.filter((property) =>
    property.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    property.location.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#FAFAF9] pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {/* Header */}
        <div className="mb-12">
          <h1 className="font-['Outfit'] text-4xl md:text-6xl font-bold tracking-tight mb-4" data-testid="marketplace-title">
            Property Marketplace
          </h1>
          <p className="text-base md:text-lg text-muted-foreground">
            Discover and invest in tokenized properties across Japan
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white p-6 rounded-sm border border-border mb-8" data-testid="search-filters">
          <div className="grid md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Search properties or cities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 rounded-none"
                  data-testid="search-input"
                />
              </div>
            </div>
            <Select value={filters.city} onValueChange={(value) => setFilters({ ...filters, city: value })}>
              <SelectTrigger className="h-12 rounded-none" data-testid="city-filter">
                <SelectValue placeholder="City" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                <SelectItem value="Tokyo">Tokyo</SelectItem>
                <SelectItem value="Kyoto">Kyoto</SelectItem>
                <SelectItem value="Osaka">Osaka</SelectItem>
                <SelectItem value="Yokohama">Yokohama</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.property_type} onValueChange={(value) => setFilters({ ...filters, property_type: value })}>
              <SelectTrigger className="h-12 rounded-none" data-testid="type-filter">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="apartment">Apartment</SelectItem>
                <SelectItem value="house">House</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="land">Land</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={loadProperties}
              className="bg-[#181B38] text-white hover:bg-[#181B38]/90 h-12 rounded-none"
              data-testid="apply-filters-btn"
            >
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Apply Filters
            </Button>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-sm text-muted-foreground" data-testid="results-count">
            {loading ? 'Loading...' : `${filteredProperties.length} properties found`}
          </p>
        </div>

        {/* Properties Grid */}
        {loading ? (
          <div className="grid md:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-[500px] bg-gray-200 animate-pulse rounded-sm" />
            ))}
          </div>
        ) : filteredProperties.length > 0 ? (
          <div className="grid md:grid-cols-3 gap-8" data-testid="properties-grid">
            {filteredProperties.map((property) => (
              <Link key={property.id} to={`/property/${property.id}`}>
                <div
                  className="group relative overflow-hidden bg-card border border-border/50 hover:border-[#C5A059]/50 transition-all duration-300 rounded-sm hover:shadow-md cursor-pointer"
                  data-testid={`property-card-${property.id}`}
                >
                  {property.featured && (
                    <div className="absolute top-4 left-4 z-10 bg-[#C5A059] text-[#181B38] px-3 py-1 text-xs font-bold uppercase tracking-wider">
                      Featured
                    </div>
                  )}
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
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {property.property_type}
                      </span>
                    </div>
                    <h3 className="font-['Outfit'] text-xl font-medium mb-3 line-clamp-2">
                      {property.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {property.description}
                    </p>
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Annual Yield</span>
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
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Available</span>
                        <span className="font-['Space_Mono']">
                          {property.available_tokens}/{property.total_tokens}
                        </span>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-border">
                      <Button
                        className="w-full bg-[#181B38] text-white hover:bg-[#181B38]/90 rounded-none border-l-4 border-[#C5A059]"
                        data-testid={`view-details-btn-${property.id}`}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-sm border border-border" data-testid="no-results">
            <p className="text-lg text-muted-foreground mb-4">No properties found matching your criteria.</p>
            <Button
              onClick={() => {
                setSearchQuery('');
                setFilters({ city: 'all', property_type: 'all', min_yield: '', max_price: '', status: 'active' });
              }}
              variant="outline"
              className="rounded-none"
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Marketplace;