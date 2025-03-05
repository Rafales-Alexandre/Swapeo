import { useEffect, useState } from 'react';
import { getNetworkName } from '../../utils/contractServices';
import './Navbar.css';

const Navbar = ({ account }: { account: string | null }) => {
  const [networkName, setNetworkName] = useState<string>("Unknown Network");

  useEffect(() => {
    const fetchNetworkName = async () => {
      const name = await getNetworkName();
      setNetworkName(name);
    };
    fetchNetworkName();
  }, []);

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <div className="navbar-left">
          <div className="logo">
            <span className="logo-icon">⚡</span>
            <span className="logo-text">DEX</span>
          </div>
          <div className="nav-tabs">
            <button className="nav-tab active">Dashboard</button>
            <button className="nav-tab">Analytics</button>
            <button className="nav-tab">Documentation</button>
          </div>
        </div>
        
        <div className="navbar-right">
          {account ? (
            <div className="account-info">
              <div className="network-pill">
                <span className="network-dot"></span>
                {networkName}
              </div>
              <div className="address-pill">
                {`${account.slice(0, 6)}...${account.slice(-4)}`}
              </div>
            </div>
          ) : (
            <div className="connect-prompt">
              Connect wallet to start trading
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 