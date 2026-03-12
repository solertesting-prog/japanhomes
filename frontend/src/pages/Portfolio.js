import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { TrendingUp, Home, DollarSign, Activity } from 'lucide-react';
import { api } from '../lib/api';
import { useWallet } from '../contexts/WalletContext';

const Portfolio = () => {
  const { walletAddress, isConnected } = useWallet();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConnected) {
      navigate('/');
      return;
    }
    loadPortfolioData();
  }, [isConnected, walletAddress]);

  const loadPortfolioData = async () => {
    setLoading(true);
    try {
      const [portfolioRes, transactionsRes] = await Promise.all([
        api.getPortfolio(walletAddress),
        api.getWalletTransactions(walletAddress)
      ]);
      setPortfolio(portfolioRes.data);
      setTransactions(transactionsRes.data);
    } catch (error) {
      console.error('Failed to load portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="animate-pulse space-y-8">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="h-32 bg-gray-200 rounded-sm" />
              <div className="h-32 bg-gray-200 rounded-sm" />
              <div className="h-32 bg-gray-200 rounded-sm" />
            </div>
            <div className="h-96 bg-gray-200 rounded-sm" />
          </div>
        </div>
      </div>
    );
  }

  const totalInvested = portfolio?.portfolio.reduce((sum, p) => sum + p.total_invested, 0) || 0;
  const totalProperties = portfolio?.total_properties || 0;

  return (
    <div className="min-h-screen bg-[#FAFAF9] pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {/* Header */}
        <div className="mb-12">
          <h1 className="font-['Outfit'] text-4xl md:text-6xl font-bold tracking-tight mb-4" data-testid="portfolio-title">
            My Portfolio
          </h1>
          <p className="text-base md:text-lg text-muted-foreground">
            Track your tokenized real estate investments
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card data-testid="total-invested-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <DollarSign className="w-4 h-4" />
                Total Invested
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-['Space_Mono'] text-3xl font-bold">
                ${totalInvested.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="properties-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Home className="w-4 h-4" />
                Properties Owned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-['Space_Mono'] text-3xl font-bold">
                {totalProperties}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="transactions-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Activity className="w-4 h-4" />
                Total Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-['Space_Mono'] text-3xl font-bold">
                {transactions.length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Properties List */}
        {portfolio?.portfolio && portfolio.portfolio.length > 0 ? (
          <Card className="mb-12">
            <CardHeader>
              <CardTitle className="font-['Outfit'] text-2xl">Your Properties</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4" data-testid="properties-list">
                {portfolio.portfolio.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 border border-border rounded-sm hover:border-[#C5A059]/50 transition"
                    data-testid={`portfolio-item-${idx}`}
                  >
                    <div className="flex items-center gap-4">
                      {item.property_details?.images?.[0] && (
                        <div className="w-16 h-16 rounded-sm overflow-hidden">
                          <img
                            src={item.property_details.images[0].url}
                            alt={item.property_name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div>
                        <h3 className="font-medium mb-1">{item.property_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {item.property_details?.location?.city || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-['Space_Mono'] font-bold mb-1">
                        {item.total_tokens} tokens
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Invested: ${item.total_invested.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Avg: ${item.average_price.toFixed(2)}
                      </div>
                    </div>
                    <Link to={`/property/${item.property_id}`}>
                      <Button variant="outline" size="sm" className="rounded-none">
                        View Property
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-12">
            <CardContent className="py-12 text-center">
              <Home className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-medium mb-2">No properties yet</h3>
              <p className="text-muted-foreground mb-6">Start investing in tokenized real estate today</p>
              <Link to="/marketplace">
                <Button className="bg-[#181B38] text-white hover:bg-[#181B38]/90 rounded-none">
                  Browse Properties
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="font-['Outfit'] text-2xl">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length > 0 ? (
              <div className="space-y-3" data-testid="transactions-list">
                {transactions.slice(0, 10).map((tx, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 border border-border rounded-sm"
                    data-testid={`transaction-${idx}`}
                  >
                    <div>
                      <div className="font-medium mb-1">
                        {tx.transaction_type === 'purchase' ? 'Purchased' : 'Transaction'} - {tx.property_name}
                      </div>
                      <div className="text-sm text-muted-foreground font-['Space_Mono']">
                        {tx.tx_hash.substring(0, 10)}...{tx.tx_hash.substring(tx.tx_hash.length - 8)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-['Space_Mono'] font-bold">
                        {tx.token_amount} tokens
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ${tx.total_amount.toLocaleString()}
                      </div>
                      <div className="text-xs">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                          tx.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {tx.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No transactions yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Portfolio;