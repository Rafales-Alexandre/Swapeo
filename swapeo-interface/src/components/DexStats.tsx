import React from 'react';
import { TOKENS } from '../utils/constants';
import './styles/DexStats.css';

interface DexStatsProps {
  className?: string;
}

const DexStats: React.FC<DexStatsProps> = ({ className }) => {
  // Données statiques pour le développement
  const mockStats = {
    availableTokens: [
      { address: TOKENS.TOKEN_A, balance: "1000" },
      { address: TOKENS.TOKEN_B, balance: "2000" }
    ],
    swapCount: 0,
    users: [],
    liquidityProviders: []
  };

  return (
    <div className={`dex-stats ${className || ''}`}>
      <h2>Statistiques du DEX</h2>
      
      <div className="stats-section">
        <h3>Tokens Disponibles</h3>
        <ul>
          {mockStats.availableTokens.map((token, index) => (
            <li key={index}>
              {token.address.substring(0, 6)}...{token.address.substring(38)} : {token.balance}
            </li>
          ))}
        </ul>
      </div>

      <div className="stats-section">
        <h3>Activité</h3>
        <p>Nombre total de swaps : {mockStats.swapCount}</p>
        <p>Nombre d'utilisateurs uniques : {mockStats.users.length}</p>
        <p>Nombre de fournisseurs de liquidité : {mockStats.liquidityProviders.length}</p>
      </div>
    </div>
  );
};

export default DexStats; 