import React, { useState } from 'react';
import './styles/ConnectWalletButton.css';
import { requestAccount } from '../utils/contractServices';

interface ConnectWalletButtonProps {
  setAccount: (account: string | null) => void;
}

const ConnectWalletButton: React.FC<ConnectWalletButtonProps> = ({ setAccount }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const account = await requestAccount();
      if (account) {
        setAccount(account);
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button 
      className={`connect-wallet-btn ${isLoading ? 'loading' : ''}`}
      onClick={handleConnect}
      disabled={isLoading}
    >
      {isLoading ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
};

export default ConnectWalletButton;