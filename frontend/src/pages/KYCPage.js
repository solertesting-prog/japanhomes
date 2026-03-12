import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { CheckCircle, AlertCircle, Clock, FileText } from 'lucide-react';
import { api } from '../lib/api';
import { useWallet } from '../contexts/WalletContext';
import { toast } from 'sonner';

const KYCPage = () => {
  const { walletAddress, isConnected, user } = useWallet();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    document_type: 'passport',
    document_number: '',
    document_url: ''
  });
  const [submitting, setSubmitting] = useState(false);

  if (!isConnected) {
    navigate('/');
    return null;
  }

  const kycStatus = user?.kyc_status || 'not_submitted';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await api.submitKYC(formData, walletAddress);
      toast.success('KYC submitted successfully!');
      window.location.reload();
    } catch (error) {
      console.error('KYC submission failed:', error);
      toast.error(error.response?.data?.detail || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStatusBadge = () => {
    const statusConfig = {
      not_submitted: { icon: FileText, text: 'Not Submitted', color: 'bg-gray-100 text-gray-800' },
      pending: { icon: Clock, text: 'Under Review', color: 'bg-yellow-100 text-yellow-800' },
      approved: { icon: CheckCircle, text: 'Approved', color: 'bg-green-100 text-green-800' },
      rejected: { icon: AlertCircle, text: 'Rejected', color: 'bg-red-100 text-red-800' }
    };

    const config = statusConfig[kycStatus] || statusConfig.not_submitted;
    const Icon = config.icon;

    return (
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${config.color}`} data-testid="kyc-status-badge">
        <Icon className="w-4 h-4" />
        <span className="font-medium">{config.text}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9] pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 md:px-8">
        {/* Header */}
        <div className="mb-12">
          <h1 className="font-['Outfit'] text-4xl md:text-6xl font-bold tracking-tight mb-4" data-testid="kyc-title">
            KYC Verification
          </h1>
          <p className="text-base md:text-lg text-muted-foreground">
            Complete your identity verification to unlock full platform access
          </p>
        </div>

        {/* Status Card */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium mb-2">Verification Status</h3>
                <p className="text-sm text-muted-foreground">Your current KYC status</p>
              </div>
              {renderStatusBadge()}
            </div>
          </CardContent>
        </Card>

        {/* KYC Form */}
        {(kycStatus === 'not_submitted' || kycStatus === 'rejected') && (
          <Card>
            <CardHeader>
              <CardTitle className="font-['Outfit'] text-2xl">Submit KYC Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6" data-testid="kyc-form">
                <div>
                  <Label htmlFor="full_name">Full Name *</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                    className="h-12 rounded-none mt-2"
                    placeholder="Enter your full legal name"
                    data-testid="full-name-input"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="h-12 rounded-none mt-2"
                    placeholder="your.email@example.com"
                    data-testid="email-input"
                  />
                </div>

                <div>
                  <Label htmlFor="document_type">Document Type *</Label>
                  <Select
                    value={formData.document_type}
                    onValueChange={(value) => setFormData({ ...formData, document_type: value })}
                  >
                    <SelectTrigger className="h-12 rounded-none mt-2" data-testid="document-type-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="passport">Passport</SelectItem>
                      <SelectItem value="drivers_license">Driver's License</SelectItem>
                      <SelectItem value="national_id">National ID</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="document_number">Document Number *</Label>
                  <Input
                    id="document_number"
                    value={formData.document_number}
                    onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                    required
                    className="h-12 rounded-none mt-2"
                    placeholder="Enter document number"
                    data-testid="document-number-input"
                  />
                </div>

                <div>
                  <Label htmlFor="document_url">Document Upload URL *</Label>
                  <Input
                    id="document_url"
                    value={formData.document_url}
                    onChange={(e) => setFormData({ ...formData, document_url: e.target.value })}
                    required
                    className="h-12 rounded-none mt-2"
                    placeholder="https://your-document-url.com/document.jpg"
                    data-testid="document-url-input"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload your document to a secure service and paste the URL here
                  </p>
                </div>

                <div className="pt-4">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-[#181B38] text-white hover:bg-[#181B38]/90 h-12 rounded-none border-l-4 border-[#C5A059] font-medium"
                    data-testid="submit-kyc-btn"
                  >
                    {submitting ? 'Submitting...' : 'Submit KYC'}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Your information is encrypted and securely stored. We review KYC submissions within 48 hours.
                </p>
              </form>
            </CardContent>
          </Card>
        )}

        {kycStatus === 'pending' && (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="w-16 h-16 mx-auto mb-4 text-[#C5A059]" />
              <h3 className="text-xl font-medium mb-2">Under Review</h3>
              <p className="text-muted-foreground mb-6">
                Your KYC documents are being reviewed. We'll notify you within 48 hours.
              </p>
            </CardContent>
          </Card>
        )}

        {kycStatus === 'approved' && (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-[#10B981]" />
              <h3 className="text-xl font-medium mb-2">Verification Complete!</h3>
              <p className="text-muted-foreground mb-6">
                Your identity has been verified. You now have full access to all platform features.
              </p>
              <Button
                onClick={() => navigate('/marketplace')}
                className="bg-[#181B38] text-white hover:bg-[#181B38]/90 rounded-none"
              >
                Start Investing
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default KYCPage;