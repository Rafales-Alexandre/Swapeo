import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { depositLiquidity, withdrawLiquidity, getCollectedFees, approveToken, mintTestTokens, getLiquidityPosition, getConversionRate, getTokenBalance, getPoolTokenBalances } from '../utils/contractServices';
import { TOKEN_OPTIONS, CONTRACT_ADDRESS } from '../utils/constants';
import { validateAmount, validateTokenPair } from '../utils/validation';
import './styles/LiquidityActions.css';

// Type pour représenter un token
interface Token {
  address: string;
  label: string;
}

const LiquidityActions: React.FC<{ account: string }> = ({ account }) => {
  const [activeTab, setActiveTab] = useState<'add' | 'remove'>('add');
  const [amount1, setAmount1] = useState('');
  const [amount2, setAmount2] = useState('');
  const [feesA, setFeesA] = useState<string>('0');
  const [feesB, setFeesB] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState({
    tokenAAmount: '0',
    tokenBAmount: '0',
    poolShare: '0'
  });
  const [poolInfo, setPoolInfo] = useState({
    rate: '0',
    share: '0',
    totalTokenA: '0',
    totalTokenB: '0',
    optimalRatio: true
  });
  const [balances, setBalances] = useState({
    tokenA: '0',
    tokenB: '0'
  });

  // État pour stocker les tokens sélectionnés
  const [selectedTokenA, setSelectedTokenA] = useState<Token>(TOKEN_OPTIONS[0]);
  const [selectedTokenB, setSelectedTokenB] = useState<Token>(TOKEN_OPTIONS[1]);

  // État pour suivre si nous créons une nouvelle paire
  const [isNewPair, setIsNewPair] = useState(false);

  // État pour suivre l'étape actuelle du processus
  const [processStep, setProcessStep] = useState<'idle' | 'approving' | 'depositing'>('idle');

  // Fonction pour mettre à jour la part de la pool
  const updatePoolShare = async () => {
    try {
      const pos = await getLiquidityPosition(account);
      setPosition(pos);
      setPoolInfo(prev => ({ ...prev, share: pos.poolShare }));
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la part de la pool:", error);
    }
  };

  // Fonction pour formater les nombres avec 4 décimales maximum
  const formatNumber = (value: string | number) => {
    console.log("Formatage du nombre:", value);
    
    // Si la valeur est une chaîne vide ou undefined, retourner 0
    if (value === undefined || value === null || value === '') {
      console.log("Valeur vide, retourne 0");
      return '0';
    }
    
    const num = typeof value === 'string' ? Number(value) : value;
    
    // Si la valeur n'est pas un nombre, retourner 0
    if (isNaN(num)) {
      console.log("Valeur non numérique, retourne 0");
      return '0';
    }
    
    // Si le nombre est très petit (proche de zéro), afficher avec plus de précision
    if (Math.abs(num) > 0 && Math.abs(num) < 0.0001) {
      const formatted = num.toExponential(4);
      console.log("Valeur très petite formatée en notation scientifique:", formatted);
      return formatted;
    }
    
    // Si le nombre est très grand, utiliser la notation scientifique
    if (Math.abs(num) > 1000000) {
      const formatted = num.toExponential(4);
      console.log("Valeur très grande formatée en notation scientifique:", formatted);
      return formatted;
    }
    
    // Pour les nombres normaux, utiliser toFixed avec 4 décimales et supprimer les zéros inutiles
    const formatted = num.toFixed(4).replace(/\.?0+$/, '');
    console.log("Valeur formatée:", formatted);
    return formatted;
  };

  // Fonction pour calculer le montant maximum possible en fonction des balances
  const calculateMaxAmount = (isTokenA: boolean) => {
    const tokenABalance = Number(balances.tokenA);
    const tokenBBalance = Number(balances.tokenB);
    const rate = Number(poolInfo.rate);

    if (isTokenA) {
      // Si on calcule pour token A, on prend le minimum entre la balance A et B/rate
      return Math.min(tokenABalance, tokenBBalance / rate);
    } else {
      // Si on calcule pour token B, on prend le minimum entre la balance B et A*rate
      return Math.min(tokenBBalance, tokenABalance * rate);
    }
  };

  // Fonction pour calculer le montant du second token avec une meilleure précision
  const calculateRequiredAmount = (amount: string, isTokenA: boolean) => {
    if (!amount || Number(amount) === 0) return '0';
    
    const totalA = Number(poolInfo.totalTokenA);
    const totalB = Number(poolInfo.totalTokenB);
    const rate = Number(poolInfo.rate);
    
    if (totalA === 0 || totalB === 0 || isNewPair) {
      // Si c'est une nouvelle paire, retourner la même valeur (pas de calcul de ratio)
      // afin de permettre des valeurs indépendantes
      return amount;
    }
    
    const inputAmount = Number(amount);
    
    // Vérification des valeurs invalides
    if (isNaN(inputAmount) || inputAmount <= 0) {
      return '0';
    }
    
    // Calcul avec une meilleure précision
    let requiredAmount;
    if (isTokenA) {
      requiredAmount = inputAmount * rate;
    } else {
      requiredAmount = inputAmount / rate;
    }
    
    // Vérification des limites
    const maxRequired = calculateMaxAmount(!isTokenA);
    if (requiredAmount > maxRequired) {
      requiredAmount = maxRequired;
    }
    
    // Formatage avec plus de précision
    return formatNumber(requiredAmount.toString());
  };

  // Gestionnaire pour la mise à jour des montants avec validation améliorée
  const handleAmountChange = (value: string, isFirstToken: boolean) => {
    const numValue = Number(value);
    const maxAmount = calculateMaxAmount(isFirstToken);

    if (numValue > maxAmount) {
      toast.warning(`Montant maximum possible: ${formatNumber(maxAmount.toString())}`);
      value = maxAmount.toString();
    }

    // Si nous créons une nouvelle paire, permettre des valeurs indépendantes dans les deux inputs
    if (isNewPair) {
      if (isFirstToken) {
        setAmount1(value);
      } else {
        setAmount2(value);
      }
      // Toujours considérer le ratio comme optimal pour une nouvelle paire
      setPoolInfo(prev => ({ ...prev, optimalRatio: true }));
      return;
    }

    // Pour une paire existante, continuer avec le comportement original
    if (isFirstToken) {
      setAmount1(value);
      const requiredAmount = calculateRequiredAmount(value, true);
      setAmount2(requiredAmount);

      // Vérifier le ratio optimal
      const currentRatio = numValue > 0 ? Number(requiredAmount) / numValue : 0;
      const targetRatio = Number(poolInfo.rate);
      const isOptimalRatio = Math.abs(currentRatio - targetRatio) / targetRatio < 0.001;
      setPoolInfo(prev => ({ ...prev, optimalRatio: isOptimalRatio }));

    } else {
      setAmount2(value);
      const requiredAmount = calculateRequiredAmount(value, false);
      setAmount1(requiredAmount);

      // Vérifier le ratio optimal
      const currentRatio = numValue > 0 ? numValue / Number(requiredAmount) : 0;
      const targetRatio = Number(poolInfo.rate);
      const isOptimalRatio = Math.abs(currentRatio - targetRatio) / targetRatio < 0.001;
      setPoolInfo(prev => ({ ...prev, optimalRatio: isOptimalRatio }));
    }
  };

  // Fonction pour définir le montant maximum
  const handleSetMaxAmount = (isTokenA: boolean) => {
    if (isNewPair) {
      // Pour une nouvelle paire, simplement définir le max pour ce token sans calculer l'autre
      const balance = isTokenA ? balances.tokenA : balances.tokenB;
      const safeBalance = Number(balance) * 0.99; // 99% de la balance pour laisser de la marge pour les frais
      
      if (isTokenA) {
        setAmount1(safeBalance.toString());
      } else {
        setAmount2(safeBalance.toString());
      }
      return;
    }
    
    // Pour une paire existante, utiliser la logique originale
    const maxAmount = calculateMaxAmount(isTokenA);
    handleAmountChange(maxAmount.toString(), isTokenA);
  };

  // Fonction pour gérer le changement de token
  const handleTokenChange = async (token: Token, isTokenA: boolean) => {
    if (isTokenA) {
      if (token.address === selectedTokenB.address) {
        toast.error("Vous ne pouvez pas sélectionner le même token des deux côtés.");
        return;
      }
      setSelectedTokenA(token);
    } else {
      if (token.address === selectedTokenA.address) {
        toast.error("Vous ne pouvez pas sélectionner le même token des deux côtés.");
        return;
      }
      setSelectedTokenB(token);
    }

    // Réinitialiser les montants
    setAmount1('');
    setAmount2('');

    // Vérifier si cette paire existe déjà
    await checkPairExists();
  };

  // Fonction pour vérifier si la paire existe
  const checkPairExists = async () => {
    try {
      const rate = await getConversionRate(
        selectedTokenA.address,
        selectedTokenB.address,
        "1"
      );
      
      // Si le taux est 0, cela signifie que la paire n'existe pas encore
      const pairExists = rate !== "0";
      setIsNewPair(!pairExists);
      
      if (!pairExists) {
        console.log("Nouvelle paire détectée, utilisation du ratio 1:1");
        setPoolInfo(prev => ({
          ...prev,
          rate: "1",
          totalTokenA: "0",
          totalTokenB: "0",
          share: "0",
          optimalRatio: true
        }));
      } else {
        console.log("Paire existante détectée, taux de change:", rate);
        setPoolInfo(prev => ({
          ...prev,
          rate: rate,
          optimalRatio: true
        }));
      }
    } catch (error) {
      console.error("Erreur lors de la vérification de la paire:", error);
      setIsNewPair(true);
      setPoolInfo(prev => ({
        ...prev,
        rate: "1",
        totalTokenA: "0",
        totalTokenB: "0",
        share: "0",
        optimalRatio: true
      }));
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Récupérer les frais pour les tokens sélectionnés
        setFeesA(await getCollectedFees(selectedTokenA.address, account));
        setFeesB(await getCollectedFees(selectedTokenB.address, account));

        // Récupérer la position et mettre à jour la part
        await updatePoolShare();
        
        // Vérifier si la paire existe
        await checkPairExists();
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [account, selectedTokenA, selectedTokenB]);

  useEffect(() => {
    const fetchPoolInfo = async () => {
      try {
        console.log("Récupération des informations du pool...");
        
        // Récupérer les réserves du pool et la part de l'utilisateur
        console.log("Récupération de la position de liquidité pour", account);
        const liquidityPosition = await getLiquidityPosition(account);
        console.log("Position de liquidité récupérée:", liquidityPosition);
        
        // Récupérer le taux de change pour les tokens sélectionnés
        console.log("Récupération du taux d'échange pour:", selectedTokenA.label, selectedTokenB.label);
        const rate = await getConversionRate(
          selectedTokenA.address,
          selectedTokenB.address,
          "1"
        );
        console.log("Taux de change récupéré:", rate);

        // Récupérer les balances réelles des tokens de la pool
        console.log("Récupération des balances de la pool...");
        const poolBalances = await getPoolTokenBalances();
        console.log("Balances de la pool récupérées:", poolBalances);

        // Si les balances récupérées directement sont zéro, on garde celles de getLiquidityPosition
        const totalTokenA = poolBalances.tokenABalance === "0" 
          ? liquidityPosition.tokenAAmount 
          : poolBalances.tokenABalance;
          
        const totalTokenB = poolBalances.tokenBBalance === "0" 
          ? liquidityPosition.tokenBAmount 
          : poolBalances.tokenBBalance;
        
        console.log("Totaux finaux utilisés:", {
          totalTokenA,
          totalTokenB
        });

        // Afficher la part de pool avec une meilleure précision
        const poolShare = liquidityPosition.poolShare;
        console.log("Part de pool de l'utilisateur:", poolShare + "%");

        setPoolInfo({
          rate,
          share: poolShare,
          totalTokenA,
          totalTokenB,
          optimalRatio: true
        });

        // Déterminer si c'est une nouvelle paire
        setIsNewPair(rate === "0" || (Number(totalTokenA) === 0 && Number(totalTokenB) === 0));
      } catch (error) {
        console.error("Erreur lors de la récupération des informations du pool:", error);
        // Si erreur, considérer comme une nouvelle paire
        setIsNewPair(true);
        setPoolInfo(prev => ({
          ...prev,
          rate: "1",
          totalTokenA: "0",
          totalTokenB: "0",
          share: "0"
        }));
      }
    };

    fetchPoolInfo();
  }, [account, selectedTokenA, selectedTokenB]);

  useEffect(() => {
    const fetchBalances = async () => {
      try {
        // Récupérer les balances pour les tokens sélectionnés
        const tokenABalance = await getTokenBalance(selectedTokenA.address, account);
        const tokenBBalance = await getTokenBalance(selectedTokenB.address, account);
        
        setBalances({
          tokenA: tokenABalance,
          tokenB: tokenBBalance
        });
      } catch (error) {
        console.error("Error fetching balances:", error);
      }
    };
    
    fetchBalances();
    const interval = setInterval(fetchBalances, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [account, selectedTokenA, selectedTokenB]);

  const handleApprove = async (token: string, amount: string) => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error('Veuillez entrer un montant valide.');
      return;
    }

    setIsLoading(true);
    setProcessStep('approving');
    try {
      await approveToken(token, amount);
      toast.success('Token approuvé avec succès !');
    } catch (error) {
      toast.error(`Échec de l'approbation : ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
      setProcessStep('idle');
    }
  };

  const handleDepositWithApproval = async () => {
    const amountValidation1 = validateAmount(amount1);
    const amountValidation2 = validateAmount(amount2);
    const tokenValidation = validateTokenPair(amount1, amount2);

    if (!amountValidation1.isValid || !amountValidation2.isValid || !tokenValidation.isValid) {
      toast.error(amountValidation1.error || amountValidation2.error || tokenValidation.error);
      return;
    }

    // Vérification des balances avec une marge de sécurité
    const balanceA = Number(balances.tokenA);
    const balanceB = Number(balances.tokenB);
    const amount1Num = Number(amount1);
    const amount2Num = Number(amount2);
    
    if (amount1Num > balanceA * 0.99 || amount2Num > balanceB * 0.99) {
      toast.error('Balance insuffisante pour effectuer ce dépôt (prévoir 1% pour les frais)');
      return;
    }

    setIsLoading(true);
    
    try {
      // Étape 1: Approbation des tokens
      setProcessStep('approving');
      toast.info('Approbation des tokens en cours...');
      await Promise.all([
        approveToken(selectedTokenA.address, amount1),
        approveToken(selectedTokenB.address, amount2)
      ]);
      toast.success('Tokens approuvés avec succès !');
      
      // Étape 2: Dépôt des liquidités
      setProcessStep('depositing');
      toast.info('Dépôt des liquidités en cours...');
      await depositLiquidity(
        selectedTokenA.address,
        selectedTokenB.address,
        amount1,
        amount2
      );
      
      if (isNewPair) {
        toast.success('Nouvelle paire créée avec succès !');
        setIsNewPair(false);
      } else {
        toast.success('Liquidité déposée avec succès !');
      }
      
      setAmount1('');
      setAmount2('');
      await updatePoolShare(); // Mise à jour de la part après le dépôt
      await checkPairExists(); // Vérifier si la paire existe maintenant
    } catch (error) {
      if (processStep === 'approving') {
        toast.error(`Échec de l'approbation : ${(error as Error).message}`);
      } else {
        toast.error(`Échec du dépôt : ${(error as Error).message}`);
      }
    } finally {
      setIsLoading(false);
      setProcessStep('idle');
    }
  };

  // Fonction de retrait avec approbation intégrée si nécessaire
  const handleWithdraw = async () => {
    const validation = validateAmount(amount1);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

    // Vérifier que le montant ne dépasse pas la balance de l'utilisateur
    if (Number(amount1) > Number(position.tokenAAmount)) {
      toast.error(`Vous ne pouvez pas retirer plus que votre balance (${position.tokenAAmount} ${selectedTokenA.label})`);
      return;
    }

    setIsLoading(true);
    try {
      // Nous pourrions ajouter ici une étape d'approbation si nécessaire pour le retrait
      // Dans la plupart des cas, aucune approbation n'est nécessaire pour le retrait
      
      setProcessStep('depositing'); // On utilise 'depositing' même si c'est pour un retrait
      toast.info('Retrait des liquidités en cours...');
      
      await withdrawLiquidity(
        selectedTokenA.address,
        selectedTokenB.address,
        amount1
      );
      toast.success('Liquidité retirée avec succès !');
      setAmount1('');
      await updatePoolShare(); // Mise à jour de la part après le retrait
    } catch (error) {
      toast.error(`Échec du retrait : ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
      setProcessStep('idle');
    }
  };

  const handleMintTokens = async () => {
    setIsLoading(true);
    try {
      await mintTestTokens();
      toast.success('Tokens de test générés avec succès !');
    } catch (error) {
      toast.error(`Échec de la génération de tokens : ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="liquidity-container">
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          {processStep === 'approving' && <div className="loading-text">Approbation des tokens en cours...</div>}
          {processStep === 'depositing' && <div className="loading-text">Dépôt des liquidités en cours...</div>}
        </div>
      )}
      
      <div className="tabs-container">
        <button 
          className={`tab-button ${activeTab === 'add' ? 'active' : ''}`}
          onClick={() => setActiveTab('add')}
        >
          Ajouter des liquidités
        </button>
        <button 
          className={`tab-button ${activeTab === 'remove' ? 'active' : ''}`}
          onClick={() => setActiveTab('remove')}
        >
          Retirer des liquidités
        </button>
      </div>
      
      <div className="token-selection">
        <div className="token-select-container">
          <label>Premier token</label>
          <select 
            value={selectedTokenA.address}
            onChange={(e) => {
              const token = TOKEN_OPTIONS.find(t => t.address === e.target.value);
              if (token) handleTokenChange(token, true);
            }}
          >
            {TOKEN_OPTIONS.map(token => (
              <option key={token.address} value={token.address}>
                {token.label}
              </option>
            ))}
          </select>
        </div>
        
        <div className="token-select-container">
          <label>Second token</label>
          <select 
            value={selectedTokenB.address}
            onChange={(e) => {
              const token = TOKEN_OPTIONS.find(t => t.address === e.target.value);
              if (token) handleTokenChange(token, false);
            }}
          >
            {TOKEN_OPTIONS.map(token => (
              <option key={token.address} value={token.address}>
                {token.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {isNewPair && (
        <div className="new-pair-notice">
          <strong>Nouvelle paire détectée !</strong> Vous êtes le premier à ajouter de la liquidité pour cette paire. Vous pouvez entrer les montants que vous souhaitez indépendamment pour chaque token. Ce premier dépôt déterminera le taux de change initial.
        </div>
      )}

      <div className="token-inputs">
        <div className="token-input-container">
          <div className="token-input-header">
            <span className="token-label">{selectedTokenA.label}</span>
            <span className="token-balance">
              Solde: {formatNumber(balances.tokenA)}
            </span>
          </div>
          <input
            type="text"
            className="token-input"
            placeholder="0.0"
            value={amount1}
            onChange={(e) => handleAmountChange(e.target.value, true)}
            disabled={isLoading}
          />
          <button
            className="max-button"
            onClick={() => handleSetMaxAmount(true)}
            data-tooltip={isNewPair ? "Utiliser 99% de votre solde" : "Utiliser le montant maximum en fonction du ratio de la paire"}
          >
            MAX
          </button>
        </div>

        <div className="token-input-container">
          <div className="token-input-header">
            <span className="token-label">{selectedTokenB.label}</span>
            <span className="token-balance">
              Solde: {formatNumber(balances.tokenB)}
            </span>
          </div>
          <input
            type="text"
            className="token-input"
            placeholder="0.0"
            value={amount2}
            onChange={(e) => handleAmountChange(e.target.value, false)}
            disabled={isLoading}
          />
          <button
            className="max-button"
            onClick={() => handleSetMaxAmount(false)}
            data-tooltip={isNewPair ? "Utiliser 99% de votre solde" : "Utiliser le montant maximum en fonction du ratio de la paire"}
          >
            MAX
          </button>
        </div>
      </div>

      {isNewPair && (
        <div className="pool-info">
          <div className="pool-info-item">
            <span className="pool-info-label">Taux d'échange initial</span>
            <span className="pool-info-value">
              {Number(amount1) > 0 && Number(amount2) > 0 
                ? `1 ${selectedTokenA.label} = ${formatNumber((Number(amount2) / Number(amount1)).toString())} ${selectedTokenB.label}`
                : 'Entrez les montants pour voir le taux d\'échange initial'}
            </span>
          </div>
        </div>
      )}
      
      {!isNewPair && !poolInfo.optimalRatio && (
        <div className="ratio-warning">
          Attention: Le ratio des tokens n'est pas optimal. Cela peut entraîner une perte de valeur.
        </div>
      )}

      {!isNewPair && (
        <div className="pool-info">
          <div className="pool-info-item">
            <span className="pool-info-label">Taux d'échange</span>
            <span className="pool-info-value">1 {selectedTokenA.label} = {formatNumber(poolInfo.rate)} {selectedTokenB.label}</span>
          </div>
          <div className="pool-info-item">
            <span className="pool-info-label">Part de la pool</span>
            <span className="pool-info-value">{formatNumber(poolInfo.share)}%</span>
          </div>
          <div className="pool-info-item">
            <span className="pool-info-label">Réserve {selectedTokenA.label}</span>
            <span className="pool-info-value">{formatNumber(poolInfo.totalTokenA)}</span>
          </div>
          <div className="pool-info-item">
            <span className="pool-info-label">Réserve {selectedTokenB.label}</span>
            <span className="pool-info-value">{formatNumber(poolInfo.totalTokenB)}</span>
          </div>
        </div>
      )}

      <div className="action-buttons">
        {activeTab === 'add' && (
          <button 
            className="action-button deposit"
            onClick={handleDepositWithApproval}
            disabled={isLoading || !amount1 || !amount2 || Number(amount1) <= 0 || Number(amount2) <= 0}
          >
            {isLoading 
              ? (processStep === 'approving' 
                ? 'Approbation en cours...' 
                : 'Dépôt en cours...')
              : (isNewPair 
                ? 'Approuver et créer la paire' 
                : 'Approuver et déposer')}
          </button>
        )}
        
        {activeTab === 'remove' && (
          <button 
            className="action-button withdraw"
            onClick={handleWithdraw}
            disabled={isLoading || !amount1 || Number(amount1) <= 0}
          >
            Retirer des liquidités
          </button>
        )}
        
        {process.env.NODE_ENV === 'development' && (
          <button 
            className="action-button"
            onClick={handleMintTokens}
            disabled={isLoading}
          >
            Obtenir des tokens de test
          </button>
        )}
      </div>
    </div>
  );
};

export default LiquidityActions;