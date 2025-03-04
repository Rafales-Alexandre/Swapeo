import React, { useState } from 'react';
import './styles/ConnectWalletButton.css';
import { requestAccount } from '../utils/contractServices';

interface ConnectWalletButtonProps {
  setAccount: (account: string) => void;
  isConnected?: boolean;
  isLoading?: boolean;
  address?: string;
}

const ConnectWalletButton: React.FC<ConnectWalletButtonProps> = ({
  setAccount,
  isConnected = false,
  isLoading = false,
  address
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = async () => {
    if (!isConnected && !isLoading) {
      try {
        const account = await requestAccount();
        if (account) {
          setAccount(account);
        }
      } catch (error) {
        console.error('Failed to connect wallet:', error);
      }
    }
  };

  const getButtonText = () => {
    if (isLoading) return 'Connecting...';
    if (isConnected) return `Connected: ${address?.slice(0, 6)}...${address?.slice(-4)}`;
    return 'Connect Wallet';
  };

  return (
    <div className="connect-wallet-container">
      <button
        className={`connect-wallet-button ${isConnected ? 'connected' : ''} ${isLoading ? 'loading' : ''}`}
        onClick={handleClick}
        disabled={isLoading || isConnected}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span>
          {isConnected && <div className="status-dot" />}
          {getButtonText()}
        </span>
      </button>
      {isConnected && (
        <div className="connection-status">
          <div className="status-dot" />
          Network: Ethereum
        </div>
      )}
    </div>
  );
};

export default ConnectWalletButton;