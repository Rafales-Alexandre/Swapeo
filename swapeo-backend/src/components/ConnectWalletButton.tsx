import React, { useState } from 'react';
import { toast } from 'react-toastify';
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
  const [isConnecting, setIsConnecting] = useState(false);

  const handleClick = async () => {
    if (!isConnected && !isConnecting) {
      setIsConnecting(true);
      try {
        const account = await requestAccount();
        if (account) {
          setAccount(account);
          toast.success('Wallet connecté avec succès !');
        }
      } catch (error: any) {
        console.error('Failed to connect wallet:', error);
        toast.error(error.message || 'Erreur lors de la connexion du wallet');
      } finally {
        setIsConnecting(false);
      }
    }
  };

  const getButtonText = () => {
    if (isConnecting) return 'Connexion en cours...';
    if (isConnected) return `Connecté: ${address?.slice(0, 6)}...${address?.slice(-4)}`;
    return 'Connecter Wallet';
  };

  return (
    <div className="connect-wallet-container">
      <button
        className={`connect-wallet-button ${isConnected ? 'connected' : ''} ${isConnecting ? 'loading' : ''}`}
        onClick={handleClick}
        disabled={isConnecting || isConnected}
        onMouseEnter={() => {}}
        onMouseLeave={() => {}}
      >
        <span>
          {isConnected && <div className="status-dot" />}
          {getButtonText()}
        </span>
      </button>
      {isConnected && (
        <div className="connection-status">
          <div className="status-dot" />
          Réseau: Hardhat Local
        </div>
      )}
    </div>
  );
};

export default ConnectWalletButton; 