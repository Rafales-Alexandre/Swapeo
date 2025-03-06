import React, { useState } from 'react';
import BlockchainCube from './components/effects/BlockchainCube';
import Card from './components/common/Card';
import ConnectWalletButton from './components/ConnectWalletButton';
import TokenSwap from './components/TokenSwap';
import LiquidityActions from './components/LiquidityActions';
import swapeoLogo from './assets/swapeo_logo.svg';
import swapeoSwap from './assets/swapeo_swap.svg';
import swapeoLiquidity from './assets/swapeo_liquidity.svg';
import './App.css';

type UserRole = 'trader' | 'provider';

const App: React.FC = () => {
  const [account, setAccount] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('trader');

  const handleDisconnect = () => {
    setAccount(null);
    setUserRole('trader');
  };

  const handleConnect = (account: string, role: UserRole) => {
    setAccount(account);
    setUserRole(role);
  };

  return (
    <>
      <div className="app-container">
        <BlockchainCube />
        <header className="app-header">
          <div className="app-title">
            <img src={swapeoLogo} alt="Swapeo Logo" className="app-logo" />
            <span className="title-text">Swapeo</span>
          </div>
          {account && (
            <div className="header-account">
              <div className="status-badge">
                <span className="status-dot"></span>
                Connecté en tant que {userRole === 'trader' ? 'Trader' : 'Provider'}
              </div>
              <div className="wallet-address">
                {account.slice(0, 6)}...{account.slice(-4)}
              </div>
              <button 
                className="disconnect-button"
                onClick={handleDisconnect}
              >
                Déconnecter
              </button>
            </div>
          )}
        </header>

        {!account ? (
          <Card
            title="Bienvenue sur Swapeo"
            subtitle="Connectez votre wallet pour accéder au réseau"
            icon="🔌"
            className="welcome-card"
          >
            <ConnectWalletButton setAccount={handleConnect} />
          </Card>
        ) : (
          <div className="cards-grid">
            {userRole === 'trader' ? (
              <Card
                title="Échange de Tokens"
                subtitle="Effectuez des transferts de tokens sécurisés"
                icon={<img src={swapeoSwap} alt="Swap" className="card-icon" />}
              >
                <TokenSwap account={account} />
              </Card>
            ) : (
              <Card
                title="Liquidité"
                subtitle="Gérez les ressources du système"
                icon={<img src={swapeoLiquidity} alt="Liquidité" className="card-icon" />}
              >
                <LiquidityActions account={account} />
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default App;