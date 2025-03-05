import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { getContractBalanceInETH, getNetworkStats, getAccountBalance, getNetworkName } from '../utils/contractServices';
import './styles/ContractInfo.css';

const ContractInfo: React.FC<{ account: string; onDisconnect: () => void }> = ({ account, onDisconnect }) => {
  const [balance, setBalance] = useState<string>("0");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [networkName, setNetworkName] = useState<string>("Unknown Network");
  const [networkStats, setNetworkStats] = useState({
    gasPrice: '0',
    blockNumber: '0'
  });

  const fetchData = async () => {
    try {
      setError(null);
      const [contractBalance, stats, network] = await Promise.all([
        getContractBalanceInETH(),
        getNetworkStats(),
        getNetworkName()
      ]);
      setBalance(contractBalance);
      setNetworkStats(stats);
      setNetworkName(network);
      setIsLoading(false);
      toast('Données mises à jour');
    } catch (error) {
      console.error('Error fetching data:', error);
      toast('Erreur lors de la mise à jour des données');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(account);
      toast('Adresse copiée');
    } catch (err) {
      toast('Erreur lors de la copie');
    }
  };

  const handleDisconnect = () => {
    onDisconnect();
    toast('Wallet disconnected');
  };

  useEffect(() => {
    const fetchBalance = async () => {
      setIsLoading(true);
      try {
        const accountBalance = await getAccountBalance();
        setBalance(accountBalance);
      } catch (err) {
        setError("Erreur lors de la récupération du solde");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="contract-info">
      <div className="info-grid">
        <div className="info-item">
          <div className="info-label">Network Status</div>
          <div className="status-value">
            <span className="status-dot active"></span>
            Connected to {networkName}
          </div>
        </div>

        <div className="info-item">
          <div className="info-label">Contract ETH Balance</div>
          <div className="balance-value">
            {isLoading ? (
              <div className="loading-text">Loading...</div>
            ) : error ? (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            ) : (
              <span className="eth-amount">{balance} ETH</span>
            )}
          </div>
        </div>

        <div className="info-item">
          <div className="info-label">Your Address</div>
          <div className="address-container">
            <code className="address-value">{formatAddress(account)}</code>
            <button 
              className="copy-button"
              onClick={copyToClipboard}
            >
              Copy
            </button>
          </div>
        </div>

        <div className="info-item">
          <div className="info-label">Connection</div>
          <button className="disconnect-button" onClick={handleDisconnect}>
            Disconnect Wallet
          </button>
        </div>
      </div>

      <div className="network-stats">
        <div className="stat-item">
          <span className="stat-label">Gas Price</span>
          <span className="stat-value">{networkStats.gasPrice} Gwei</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Block Number</span>
          <span className="stat-value">#{networkStats.blockNumber}</span>
        </div>
      </div>
    </div>
  );
};

export default ContractInfo;