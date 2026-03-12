import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';

const WalletContext = createContext(null);

export const WalletProvider = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if wallet was previously connected
    const savedAddress = localStorage.getItem('walletAddress');
    if (savedAddress) {
      setWalletAddress(savedAddress);
      setIsConnected(true);
      loadUserProfile(savedAddress);
    }
  }, []);

  const loadUserProfile = async (address) => {
    try {
      const response = await api.getProfile(address);
      setUser(response.data);
    } catch (error) {
      console.error('Failed to load user profile:', error);
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('Please install MetaMask or another Web3 wallet');
      return;
    }

    setIsConnecting(true);
    try {
      // Request accounts
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      const address = accounts[0];
      const message = `Sign this message to connect to ZenCapital. Timestamp: ${Date.now()}`;
      
      // Sign message
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, address]
      });

      // Connect to backend
      const response = await api.connectWallet({
        wallet_address: address,
        signature,
        message
      });

      setWalletAddress(address);
      setIsConnected(true);
      setUser(response.data.user);
      localStorage.setItem('walletAddress', address);

      // Switch to Polygon Amoy if needed
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x13882' }], // Polygon Amoy
        });
      } catch (switchError) {
        // Chain not added, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x13882',
              chainName: 'Polygon Amoy Testnet',
              nativeCurrency: {
                name: 'MATIC',
                symbol: 'MATIC',
                decimals: 18
              },
              rpcUrls: ['https://rpc-amoy.polygon.technology/'],
              blockExplorerUrls: ['https://amoy.polygonscan.com/']
            }]
          });
        }
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      alert('Failed to connect wallet. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setIsConnected(false);
    setUser(null);
    localStorage.removeItem('walletAddress');
  };

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        isConnected,
        isConnecting,
        user,
        connectWallet,
        disconnectWallet,
        refreshUser: () => loadUserProfile(walletAddress)
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
};