import React from 'react';
import './DashboardLayout.css';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <div className="dashboard-layout">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">⚡</span>
            <h1>DEX Dashboard</h1>
          </div>
          <div className="network-badge">
            <span className="network-indicator"></span>
            Hardhat Network
          </div>
        </div>
      </header>
      <main className="dashboard-main">
        <div className="dashboard-grid">{children}</div>
      </main>
      <footer className="dashboard-footer">
        <p>Powered by Ethereum • Built with ❤️</p>
      </footer>
    </div>
  );
};

export default DashboardLayout; 