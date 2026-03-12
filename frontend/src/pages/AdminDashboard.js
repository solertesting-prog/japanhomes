import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Users, Home, CheckCircle, Clock, TrendingUp, DollarSign } from 'lucide-react';
import { api } from '../lib/api';
import { useWallet } from '../contexts/WalletContext';
import { toast } from 'sonner';

const AdminDashboard = () => {
  const { isConnected, user } = useWallet();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [kycRequests, setKycRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConnected) {
      navigate('/');
      return;
    }
    // In production, check if user.role === 'admin'
    loadDashboardData();
  }, [isConnected]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, kycRes, usersRes] = await Promise.all([
        api.getAnalytics(),
        api.getKYCRequests({ status: 'pending' }),
        api.getAllUsers({ limit: 10 })
      ]);
      setAnalytics(analyticsRes.data);
      setKycRequests(kycRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load admin dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveKYC = async (walletAddress) => {
    try {
      await api.approveKYC(walletAddress);
      toast.success('KYC approved successfully');
      loadDashboardData();
    } catch (error) {
      console.error('Failed to approve KYC:', error);
      toast.error('Failed to approve KYC');
    }
  };

  const handleRejectKYC = async (walletAddress) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      await api.rejectKYC(walletAddress, reason);
      toast.success('KYC rejected');
      loadDashboardData();
    } catch (error) {
      console.error('Failed to reject KYC:', error);
      toast.error('Failed to reject KYC');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="animate-pulse space-y-8">
            <div className="grid md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-sm" />
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
          <h1 className="font-['Outfit'] text-4xl md:text-6xl font-bold tracking-tight mb-4" data-testid="admin-title">
            Admin Dashboard
          </h1>
          <p className="text-base md:text-lg text-muted-foreground">
            Platform management and analytics
          </p>
        </div>

        {/* Analytics Cards */}
        {analytics && (
          <div className="grid md:grid-cols-4 gap-6 mb-12">
            <Card data-testid="total-users-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Users className="w-4 h-4" />
                  Total Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-['Space_Mono'] text-3xl font-bold">
                  {analytics.users.total}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {analytics.users.kyc_approved} KYC approved
                </div>
              </CardContent>
            </Card>

            <Card data-testid="total-properties-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Home className="w-4 h-4" />
                  Properties
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-['Space_Mono'] text-3xl font-bold">
                  {analytics.properties.total}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {analytics.properties.active} active
                </div>
              </CardContent>
            </Card>

            <Card data-testid="total-transactions-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <TrendingUp className="w-4 h-4" />
                  Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-['Space_Mono'] text-3xl font-bold">
                  {analytics.transactions.total}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {analytics.transactions.recent_30d} last 30 days
                </div>
              </CardContent>
            </Card>

            <Card data-testid="total-volume-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <DollarSign className="w-4 h-4" />
                  Total Volume
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-['Space_Mono'] text-3xl font-bold">
                  ${analytics.transactions.total_volume.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  ${analytics.transactions.recent_volume_30d.toLocaleString()} last 30d
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="kyc" className="space-y-6">
          <TabsList className="bg-white border border-border" data-testid="admin-tabs">
            <TabsTrigger value="kyc" className="data-[state=active]:bg-[#181B38] data-[state=active]:text-white">
              KYC Requests ({kycRequests.length})
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-[#181B38] data-[state=active]:text-white">
              Users
            </TabsTrigger>
          </TabsList>

          {/* KYC Requests Tab */}
          <TabsContent value="kyc" data-testid="kyc-tab">
            <Card>
              <CardHeader>
                <CardTitle className="font-['Outfit'] text-2xl">Pending KYC Requests</CardTitle>
              </CardHeader>
              <CardContent>
                {kycRequests.length > 0 ? (
                  <div className="space-y-4">
                    {kycRequests.map((request, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-4 border border-border rounded-sm"
                        data-testid={`kyc-request-${idx}`}
                      >
                        <div className="flex-1">
                          <h3 className="font-medium mb-1">{request.full_name || 'N/A'}</h3>
                          <p className="text-sm text-muted-foreground mb-2">{request.email || 'N/A'}</p>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="font-['Space_Mono']">
                              {request.wallet_address?.substring(0, 10)}...{request.wallet_address?.substring(request.wallet_address.length - 8)}
                            </span>
                            <span className="text-muted-foreground">
                              Submitted: {request.kyc_submitted_at ? new Date(request.kyc_submitted_at).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleApproveKYC(request.wallet_address)}
                            className="bg-green-600 hover:bg-green-700 text-white rounded-none"
                            size="sm"
                            data-testid={`approve-kyc-${idx}`}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            onClick={() => handleRejectKYC(request.wallet_address)}
                            variant="destructive"
                            className="rounded-none"
                            size="sm"
                            data-testid={`reject-kyc-${idx}`}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No pending KYC requests</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" data-testid="users-tab">
            <Card>
              <CardHeader>
                <CardTitle className="font-['Outfit'] text-2xl">Recent Users</CardTitle>
              </CardHeader>
              <CardContent>
                {users.length > 0 ? (
                  <div className="space-y-3">
                    {users.map((user, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-4 border border-border rounded-sm"
                        data-testid={`user-${idx}`}
                      >
                        <div>
                          <h3 className="font-medium mb-1">{user.full_name || 'Anonymous'}</h3>
                          <p className="text-sm font-['Space_Mono'] text-muted-foreground">
                            {user.wallet_address?.substring(0, 10)}...{user.wallet_address?.substring(user.wallet_address.length - 8)}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                            user.kyc_status === 'approved' ? 'bg-green-100 text-green-800' :
                            user.kyc_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            KYC: {user.kyc_status}
                          </span>
                          <div className="text-sm text-muted-foreground mt-1">
                            Invested: ${user.total_invested?.toLocaleString() || 0}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No users found
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;