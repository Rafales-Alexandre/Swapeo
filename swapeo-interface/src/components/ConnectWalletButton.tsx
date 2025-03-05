import React, { useState } from 'react';
import './styles/ConnectWalletButton.css';

type UserRole = 'trader' | 'provider';

interface ConnectWalletButtonProps {
  setAccount: (account: string, role: UserRole) => void;
}

const ConnectWalletButton: React.FC<ConnectWalletButtonProps> = ({ setAccount }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('trader');

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAccount(accounts[0], selectedRole);
      } else {
        alert('Veuillez installer MetaMask pour utiliser cette application');
      }
    } catch (error) {
      console.error('Erreur de connexion:', error);
      alert('Erreur lors de la connexion au wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="connect-wallet-container">
      <div className="role-selector">
        <button
          className={`role-button ${selectedRole === 'trader' ? 'active' : ''}`}
          onClick={() => setSelectedRole('trader')}
        >
          Trader
        </button>
        <button
          className={`role-button ${selectedRole === 'provider' ? 'active' : ''}`}
          onClick={() => setSelectedRole('provider')}
        >
          Provider
        </button>
      </div>
      <button
        className={`connect-wallet-button ${isConnecting ? 'connecting' : ''}`}
        onClick={handleConnect}
        disabled={isConnecting}
      >
        {isConnecting ? 'Connexion...' : 'Connecter Wallet'}
      </button>
    </div>
  );
};

export default ConnectWalletButton;