import React, { useEffect, useState } from 'react';
import { getNetworkName } from '../../utils/contractServices';
import './DashboardLayout.css';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [networkName, setNetworkName] = useState<string>("Unknown Network");

  useEffect(() => {
    const fetchNetworkName = async () => {
      const name = await getNetworkName();
      setNetworkName(name);
    };
    fetchNetworkName();
  }, []);

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
            {networkName} Network
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