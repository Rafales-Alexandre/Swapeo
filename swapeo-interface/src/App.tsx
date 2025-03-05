import React, { useState } from 'react';
import BlockchainCube from './components/effects/BlockchainCube';
import Card from './components/common/Card';
import ConnectWalletButton from './components/ConnectWalletButton';
import TokenSwap from './components/TokenSwap';
import LiquidityActions from './components/LiquidityActions';
import ContractInfo from './components/ContractInfo';
import swapeoLogo from './assets/swapeo_logo.svg';
import swapeoStatus from './assets/swapeo_status.svg';
import swapeoSwap from './assets/swapeo_swap.svg';
import swapeoLiquidity from './assets/swapeo_liquidity.svg';
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
            <img src={swapeoLogo} alt="Swapeo Logo" className="app-logo" />
            <span className="title-text">Swapeo</span>
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
            title="Enter Swapeo"
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
              icon={<img src={swapeoStatus} alt="Status" className="card-icon" />}
            >
              <ContractInfo account={account} onDisconnect={handleDisconnect} />
            </Card>

            <Card
              title="Token Exchange"
              subtitle="Execute secure token transfers"
              icon={<img src={swapeoSwap} alt="Swap" className="card-icon" />}
            >
              <TokenSwap account={account} />
            </Card>

            <Card
              title="Liquidity"
              subtitle="Manage system resources"
              icon={<img src={swapeoLiquidity} alt="Liquidity" className="card-icon" />}
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