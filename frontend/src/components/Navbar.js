import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { Button } from './ui/button';
import { Wallet, Menu, X, TrendingUp } from 'lucide-react';

const Navbar = () => {
  const { walletAddress, isConnected, connectWallet, disconnectWallet } = useWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  return (
    <nav className="fixed top-0 w-full z-50 bg-white/60 dark:bg-black/60 backdrop-blur-xl border-b border-border">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2" data-testid="nav-logo">
            <div className="w-8 h-8 bg-[#181B38] rounded-sm flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[#C5A059]" />
            </div>
            <span className="font-['Outfit'] text-xl font-bold tracking-tight">ZenCapital</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link to="/marketplace" className="text-sm font-medium hover:text-[#C5A059] transition" data-testid="nav-marketplace">
              Marketplace
            </Link>
            <Link to="/dashboard" className="text-sm font-medium hover:text-[#C5A059] transition" data-testid="nav-dashboard">
              Dashboard
            </Link>
            <Link to="/portfolio" className="text-sm font-medium hover:text-[#C5A059] transition" data-testid="nav-portfolio">
              Portfolio
            </Link>
            {isConnected && (
              <>
                <Link to="/favorites" className="text-sm font-medium hover:text-[#C5A059] transition" data-testid="nav-favorites">
                  Favorites
                </Link>
                <Link to="/kyc" className="text-sm font-medium hover:text-[#C5A059] transition" data-testid="nav-kyc">
                  KYC
                </Link>
              </>
            )}
          </div>

          {/* Wallet Button */}
          <div className="hidden md:block">
            {isConnected ? (
              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 bg-[#181B38]/10 rounded-sm">
                  <span className="text-xs font-['Space_Mono'] text-[#181B38]" data-testid="wallet-address">
                    {formatAddress(walletAddress)}
                  </span>
                </div>
                <Button
                  onClick={disconnectWallet}
                  variant="outline"
                  size="sm"
                  className="rounded-none border-[#181B38] hover:bg-[#181B38] hover:text-white"
                  data-testid="disconnect-wallet-btn"
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                onClick={connectWallet}
                className="bg-[#181B38] text-white hover:bg-[#181B38]/90 h-10 px-6 rounded-none border-l-4 border-[#C5A059] font-medium"
                data-testid="connect-wallet-btn"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Connect Wallet
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2"
            data-testid="mobile-menu-btn"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-black border-b border-border" data-testid="mobile-menu">
          <div className="px-4 py-4 space-y-3">
            <Link
              to="/marketplace"
              className="block py-2 text-sm font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Marketplace
            </Link>
            <Link
              to="/dashboard"
              className="block py-2 text-sm font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              to="/portfolio"
              className="block py-2 text-sm font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Portfolio
            </Link>
            {isConnected && (
              <Link
                to="/kyc"
                className="block py-2 text-sm font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                KYC
              </Link>
            )}
            <div className="pt-3 border-t">
              {isConnected ? (
                <Button
                  onClick={() => {
                    disconnectWallet();
                    setMobileMenuOpen(false);
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Disconnect {formatAddress(walletAddress)}
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    connectWallet();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full bg-[#181B38] text-white"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect Wallet
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;