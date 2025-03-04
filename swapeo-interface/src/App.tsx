import React, { useState } from 'react';
import BlockchainCube from './components/effects/BlockchainCube';
import Card from './components/common/Card';
import ConnectWalletButton from './components/ConnectWalletButton';
import ContractInfo from './components/ContractInfo';
import TokenSwap from './components/TokenSwap';
import LiquidityActions from './components/LiquidityActions';
import './App.css';

const App: React.FC = () => {
  const [account, setAccount] = useState<string | null>(null);

  const handleDisconnect = () => {
    setAccount(null);
  };

  return (
    <>
      <div className="app-container">
          <BlockchainCube />
        <header className="app-header">
          <div className="app-title">
            <span className="app-logo">⚡</span>
            <span className="title-text">Matrix DEX</span>
          </div>
          {account && (
            <div className="status-badge">
              <span className="status-dot"></span>
              Connected to Network
            </div>
          )}
        </header>

        {!account ? (
          <Card
            title="Enter the Matrix"
            subtitle="Connect your wallet to access the network"
            icon="🔌"
            className="welcome-card"
          >
            <ConnectWalletButton setAccount={setAccount} />
          </Card>
        ) : (
          <div className="cards-grid">
            <Card
              title="System Status"
              subtitle="Monitor network parameters"
              icon="📊"
            >
              <ContractInfo account={account} onDisconnect={handleDisconnect} />
            </Card>

            <Card
              title="Token Exchange"
              subtitle="Execute secure token transfers"
              icon="🔄"
            >
              <TokenSwap account={account} />
            </Card>

            <Card
              title="Liquidity Matrix"
              subtitle="Manage system resources"
              icon="💧"
            >
              <LiquidityActions account={account} />
            </Card>
          </div>
        )}
      </div>
    </>
  );
};

export default App;