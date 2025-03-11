import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { depositLiquidity, withdrawLiquidity, getCollectedFees, approveToken, mintTestTokens, getLiquidityPosition, getConversionRate, getTokenBalance, getPoolTokenBalances, getContract, getContractDiagnostics } from '../utils/contractServices';
import { registerLiquidityDeposit, registerLiquidityWithdrawal, registerToken } from '../services/api';
import { TOKEN_OPTIONS, CONTRACT_ADDRESS } from '../utils/constants';
import { validateAmount, validateTokenPair } from '../utils/validation';
import './styles/LiquidityActions.css';
import { formatUnits } from 'ethers';

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
    poolShare: '0',
    lpBalanceA: '0',
    lpBalanceB: '0'
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

  const [diagnosticData, setDiagnosticData] = useState<any>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

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
    // Si la valeur est une chaîne vide ou undefined, retourner 0
    if (value === undefined || value === null || value === '') {
      return '0';
    }
    
    const num = typeof value === 'string' ? Number(value) : value;
    
    // Si la valeur n'est pas un nombre, retourner 0
    if (isNaN(num)) {
      return '0';
    }
    
    // Si le nombre est très petit (proche de zéro), afficher avec plus de précision
    if (Math.abs(num) > 0 && Math.abs(num) < 0.0001) {
      return num.toExponential(4);
    }
    
    // Si le nombre est très grand, utiliser la notation scientifique
    if (Math.abs(num) > 1000000) {
      return num.toExponential(4);
    }
    
    // Pour les nombres normaux, utiliser toFixed avec 4 décimales et supprimer les zéros inutiles
    return num.toFixed(4).replace(/\.?0+$/, '');
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
      // Récupérer le taux de conversion pour vérifier si la paire existe
      const rate = await getConversionRate(
        selectedTokenA.address,
        selectedTokenB.address,
        "1"
      );
      
      // Si le taux est 0, la paire n'existe pas
      const exists = rate !== "0";
      setIsNewPair(!exists);
      return exists;
    } catch (error) {
      console.error("Erreur lors de la vérification de l'existence de la paire:", error);
      setIsNewPair(true);
      return false;
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
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
        // Récupérer les réserves du pool et la part de l'utilisateur
        const liquidityPosition = await getLiquidityPosition(account);
        
        // Récupérer le taux de change pour les tokens sélectionnés
        const rate = await getConversionRate(
          selectedTokenA.address,
          selectedTokenB.address,
          "1"
        );

        // Récupérer les balances réelles des tokens de la pool
        const poolBalances = await getPoolTokenBalances();
        
        // Si les balances récupérées directement sont zéro, on garde celles de getLiquidityPosition
        const totalTokenA = poolBalances.tokenABalance === "0" 
          ? liquidityPosition.tokenAAmount 
          : poolBalances.tokenABalance;
          
        const totalTokenB = poolBalances.tokenBBalance === "0" 
          ? liquidityPosition.tokenBAmount 
          : poolBalances.tokenBBalance;

        // Afficher la part de pool avec une meilleure précision
        const poolShare = liquidityPosition.poolShare;

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

    if (amount1Num > balanceA * 0.99) {
      toast.error(`Solde insuffisant pour ${selectedTokenA.label}`);
      return;
    }

    if (amount2Num > balanceB * 0.99) {
      toast.error(`Solde insuffisant pour ${selectedTokenB.label}`);
      return;
    }

    setIsLoading(true);
    try {
      setProcessStep('approving');
      toast.info('Approbation des tokens en cours...');
      
      // Approuver les deux tokens
      await approveToken(selectedTokenA.address, amount1);
      await approveToken(selectedTokenB.address, amount2);
      
      setProcessStep('depositing');
      toast.info('Dépôt de liquidité en cours...');
      
      // Effectuer le dépôt
      await depositLiquidity(
        selectedTokenA.address,
        selectedTokenB.address,
        amount1,
        amount2
      );
      
      // Enregistrer le dépôt dans le backend
      try {
        // Convertir les montants en chaînes
        const tokenAAmountStr = amount1;
        const tokenBAmountStr = amount2;
        
        await registerLiquidityDeposit(
          account,
          selectedTokenA.address,
          selectedTokenB.address,
          tokenAAmountStr,
          tokenBAmountStr
        );
      } catch (backendError) {
        console.error("Erreur lors de l'enregistrement du dépôt dans le backend:", backendError);
        // Ne pas faire échouer l'opération si seulement l'enregistrement échoue
      }
      
      toast.success('Liquidité ajoutée avec succès !');
      setAmount1('');
      setAmount2('');
      await updatePoolShare(); // Mise à jour de la part après le dépôt
      
    } catch (error) {
      console.error("Erreur lors du dépôt de liquidité:", error);
      toast.error(`Erreur lors du dépôt de liquidité: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setIsLoading(false);
      setProcessStep('idle');
    }
  };

  // Fonction de retrait de toute la liquidité
  const handleWithdrawAll = async () => {
    setIsLoading(true);
    try {
      // Récupérer la balance LP complète de l'utilisateur depuis le contrat
      const contract = getContract();
      if (!contract) {
        throw new Error("Le contrat n'est pas initialisé");
      }
      
      // Vérifier si la paire existe
      const pairKey = await contract.pairKeys(selectedTokenA.address, selectedTokenB.address);
      
      // Vérifier si la paire existe dans le contrat
      if (!pairKey || pairKey === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        toast.error("Cette paire n'existe pas dans le contrat");
        setIsLoading(false);
        return;
      }
      
      // Récupérer les données de la paire
      const pair = await contract.pairs(pairKey);
      
      // Récupérer les balances LP directement du contrat
      const userLPBalanceA = await contract.lpBalances(selectedTokenA.address, account);
      const userLPBalanceB = await contract.lpBalances(selectedTokenB.address, account);
      
      // Afficher les balances LP réelles pour le débogage
      const lpBalanceAFormatted = formatUnits(userLPBalanceA, 18);
      const lpBalanceBFormatted = formatUnits(userLPBalanceB, 18);
      console.log("Balance LP réelle pour TokenA:", lpBalanceAFormatted);
      console.log("Balance LP réelle pour TokenB:", lpBalanceBFormatted);
      
      // Vérifier que les balances LP sont strictement supérieures à zéro
      if ((!userLPBalanceA || userLPBalanceA <= 0n) && (!userLPBalanceB || userLPBalanceB <= 0n)) {
        toast.error("Vous n'avez pas de liquidité à retirer pour cette paire");
        setIsLoading(false);
        return;
      }
      
      // Dans ce contrat, les balances LP ne sont pas proportionnelles aux réserves du pool
      // Nous devons donc utiliser directement la balance LP de TokenA avec un facteur de sécurité
      const safetyFactor = 0.95; // 95% pour éviter les erreurs de précision
      const amountToWithdraw = (Number(lpBalanceAFormatted) * safetyFactor).toString();
      
      console.log("Montant à retirer (TokenA):", amountToWithdraw);
      
      setProcessStep('depositing'); // On utilise 'depositing' même si c'est pour un retrait
      toast.info('Retrait des liquidités en cours...');
      
      // Vérifier que le montant formaté est supérieur à zéro
      if (Number(amountToWithdraw) <= 0) {
        throw new Error("Le montant à retirer doit être supérieur à zéro");
      }
      
      // Retirer la liquidité
      await withdrawLiquidity(
        selectedTokenA.address,
        selectedTokenB.address,
        amountToWithdraw
      );
      
      // Enregistrer le retrait dans le backend
      try {
        await registerLiquidityWithdrawal(
          account,
          selectedTokenA.address,
          selectedTokenB.address,
          position.tokenAAmount,
          position.tokenBAmount
        );
      } catch (backendError) {
        console.error("Erreur lors de l'enregistrement du retrait dans le backend:", backendError);
        // Ne pas faire échouer l'opération si seulement l'enregistrement échoue
      }
      
      toast.success('Liquidité retirée avec succès !');
      await updatePoolShare(); // Mise à jour de la part après le retrait
      
    } catch (error) {
      console.error("Erreur lors du retrait de liquidité:", error);
      toast.error(`Erreur lors du retrait de liquidité: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
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

  // Fonction pour récupérer et afficher les diagnostics du contrat
  const handleShowDiagnostics = async () => {
    try {
      setIsLoading(true);
      const data = await getContractDiagnostics(account);
      setDiagnosticData(data);
      setShowDiagnostics(true);
      setIsLoading(false);
    } catch (error) {
      console.error("Erreur lors de la récupération des diagnostics:", error);
      toast.error("Erreur lors de la récupération des diagnostics");
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
        {/* <button 
          className="refresh-button" 
          onClick={updatePoolShare}
          disabled={isLoading}
        >
          Rafraîchir les données
        </button>
        <button 
          className="diagnostic-button" 
          onClick={handleShowDiagnostics}
          disabled={isLoading}
        >
          Diagnostics
        </button> */}
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

      {/* Affichage des champs de saisie uniquement pour l'ajout de liquidité */}
      {activeTab === 'add' && (
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
      )}

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

      {/* Affichage spécifique pour le retrait de liquidité */}
      {activeTab === 'remove' && (
        <div className="position-summary">
          <h3 className="summary-title">Votre position</h3>
          <div className="summary-item">
            <span className="item-label">{selectedTokenA.label}:</span>
            <span className="item-value">{formatNumber(position.tokenAAmount)}</span>
          </div>
          <div className="summary-item">
            <span className="item-label">{selectedTokenB.label}:</span>
            <span className="item-value">{formatNumber(position.tokenBAmount)}</span>
          </div>
          <div className="summary-item">
            <span className="item-label">Part du pool:</span>
            <span className="item-value">{position.poolShare}%</span>
          </div>
          <div className="summary-item">
            <span className="item-label">Balance LP {selectedTokenA.label}:</span>
            <span className="item-value">{formatNumber(position.lpBalanceA)}</span>
          </div>
          <div className="summary-item">
            <span className="item-label">Balance LP {selectedTokenB.label}:</span>
            <span className="item-value">{formatNumber(position.lpBalanceB)}</span>
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
            onClick={handleWithdrawAll}
            disabled={isLoading || Number(position.tokenAAmount) <= 0}
          >
            {isLoading ? 'Retrait en cours...' : 'Retirer toute la liquidité'}
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

      {/* Affichage des diagnostics */}
      {showDiagnostics && diagnosticData && (
        <div className="diagnostics-panel">
          <h3>Diagnostics du contrat</h3>
          <button 
            className="close-button"
            onClick={() => setShowDiagnostics(false)}
          >
            Fermer
          </button>
          
          <div className="diagnostics-section">
            <h4>Informations de la paire</h4>
            <p>Clé de la paire: <span className="highlight">{diagnosticData.pairInfo.pairKey}</span></p>
            <p>Token A: <span className="highlight">{diagnosticData.pairInfo.tokenA}</span></p>
            <p>Token B: <span className="highlight">{diagnosticData.pairInfo.tokenB}</span></p>
            <p>Réserve A: <span className="highlight">{diagnosticData.pairInfo.reserveA}</span></p>
            <p>Réserve B: <span className="highlight">{diagnosticData.pairInfo.reserveB}</span></p>
            <p><i>Ces valeurs représentent les réserves totales de tokens dans le contrat.</i></p>
          </div>
          
          <div className="diagnostics-section">
            <h4>Balances LP de l'utilisateur</h4>
            <p>Token A ({selectedTokenA.label}): <span className="highlight">{diagnosticData.userLPBalances.tokenA.balance}</span></p>
            <p>Token B ({selectedTokenB.label}): <span className="highlight">{diagnosticData.userLPBalances.tokenB.balance}</span></p>
            <p><i>Ces valeurs représentent votre contribution en liquidité pour chaque token.</i></p>
            <p><i>Dans ce contrat, les balances LP sont égales aux montants de tokens que vous avez fournis.</i></p>
          </div>
          
          <div className="diagnostics-section">
            <h4>Valeurs totales des réserves</h4>
            <p>Total LP Balance A: <span className="highlight">{diagnosticData.reserveValues.totalLPBalanceA}</span></p>
            <p>Total LP Balance B: <span className="highlight">{diagnosticData.reserveValues.totalLPBalanceB}</span></p>
            <p><i>Ces valeurs représentent la somme de toutes les contributions en liquidité pour chaque token.</i></p>
            
            {/* Calcul et affichage du ratio */}
            {(() => {
              const reserveA = Number(diagnosticData.pairInfo.reserveA);
              const reserveB = Number(diagnosticData.pairInfo.reserveB);
              const lpBalanceA = Number(diagnosticData.userLPBalances.tokenA.balance);
              const lpBalanceB = Number(diagnosticData.userLPBalances.tokenB.balance);
              
              const ratioAtoB = reserveB / reserveA;
              const expectedB = lpBalanceA * ratioAtoB;
              const difference = Math.abs(expectedB - lpBalanceB);
              const percentDifference = (difference / lpBalanceB) * 100;
              
              const colorClass = percentDifference > 10 ? "error" : percentDifference > 5 ? "warning" : "highlight";
              
              return (
                <>
                  <p>Ratio A:B dans le pool: <span className="highlight">{ratioAtoB.toFixed(6)}</span></p>
                  <p>B attendu basé sur votre A: <span className="highlight">{expectedB.toFixed(6)}</span></p>
                  <p>Différence avec B réel: <span className={colorClass}>{difference.toFixed(6)} ({percentDifference.toFixed(2)}%)</span></p>
                  <p><i><strong>Note importante:</strong> Dans ce contrat, les balances LP ne sont pas proportionnelles aux réserves du pool. 
                  Cela explique la grande différence entre la valeur attendue et la valeur réelle. 
                  Le contrat stocke directement les montants de tokens fournis, sans ajustement proportionnel.</i></p>
                </>
              );
            })()}
          </div>
          
          <div className="diagnostics-section">
            <h4>Recommandations pour le retrait</h4>
            {(() => {
              const lpBalanceA = Number(diagnosticData.userLPBalances.tokenA.balance);
              const lpBalanceB = Number(diagnosticData.userLPBalances.tokenB.balance);
              
              const safetyFactor = 0.95;
              const amountToWithdraw = (lpBalanceA * safetyFactor).toFixed(6);
              
              return (
                <>
                  <p>Montant recommandé à retirer (TokenA): <span className="highlight">{amountToWithdraw}</span></p>
                  <p><i>Cette valeur est basée sur votre balance LP de TokenA avec un facteur de sécurité de 95%.</i></p>
                  <p><i><strong>Explication:</strong> Étant donné que les balances LP ne sont pas proportionnelles aux réserves du pool, 
                  nous recommandons d'utiliser directement votre balance LP de TokenA pour le retrait, 
                  avec un facteur de sécurité pour éviter les erreurs de précision.</i></p>
                </>
              );
            })()}
          </div>
          
          <div className="diagnostics-section">
            <h4>Adresse du contrat</h4>
            <p>{diagnosticData.contractAddress}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiquidityActions;