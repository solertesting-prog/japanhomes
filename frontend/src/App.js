import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { WalletProvider } from './contexts/WalletContext';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import Marketplace from './pages/Marketplace';
import PropertyDetail from './pages/PropertyDetail';
import Portfolio from './pages/Portfolio';
import KYCPage from './pages/KYCPage';
import './App.css';

function App() {
  return (
    <WalletProvider>
      <BrowserRouter>
        <div className="App min-h-screen bg-[#FAFAF9]">
          <Navbar />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/property/:id" element={<PropertyDetail />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/dashboard" element={<Portfolio />} />
            <Route path="/kyc" element={<KYCPage />} />
          </Routes>
          <Toaster position="top-right" richColors />
        </div>
      </BrowserRouter>
    </WalletProvider>
  );
}

export default App;