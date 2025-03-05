import './styles/StatsBanner.css';

const StatsBanner = () => {
  return (
    <div className="stats-banner">
      <div className="stat-card">
        <div className="stat-title">Total Value Locked</div>
        <div className="stat-value">$1.2M</div>
        <div className="stat-change positive">+5.2%</div>
      </div>
      
      <div className="stat-card">
        <div className="stat-title">24h Volume</div>
        <div className="stat-value">$458K</div>
        <div className="stat-change positive">+12.3%</div>
      </div>
      
      <div className="stat-card">
        <div className="stat-title">Total Trades</div>
        <div className="stat-value">2,345</div>
        <div className="stat-change">Today: 123</div>
      </div>
      
      <div className="stat-card">
        <div className="stat-title">Gas Price</div>
        <div className="stat-value">32 Gwei</div>
        <div className="stat-change negative">-2.1%</div>
      </div>
    </div>
  );
};

export default StatsBanner; 