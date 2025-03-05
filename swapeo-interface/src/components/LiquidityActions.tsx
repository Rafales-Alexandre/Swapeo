import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { depositLiquidity, withdrawLiquidity, getCollectedFees, approveToken, mintTestTokens, getLiquidityPosition, getConversionRate, getTokenBalance } from '../utils/contractServices';
import { TOKEN_OPTIONS, CONTRACT_ADDRESS } from '../utils/constants';
import { validateAmount, validateTokenPair } from '../utils/validation';
import './styles/LiquidityActions.css';

const LiquidityActions: React.FC<{ account: string }> = ({ account }) => {
  const [activeTab, setActiveTab] = useState<'add' | 'remove'>('add');
  const [amount1, setAmount1] = useState('');
  const [amount2, setAmount2] = useState('');
  const [feesA, setFeesA] = useState<string>('0');
  const [feesB, setFeesB] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
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
    const num = typeof value === 'string' ? Number(value) : value;
    if (isNaN(num)) return '0';
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
    
    if (totalA === 0 || totalB === 0) {
      // Premier dépôt, on utilise le ratio 1:1
      const maxAmount = calculateMaxAmount(isTokenA);
      if (Number(amount) > maxAmount) {
        return formatNumber(maxAmount.toString());
      }
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
    const maxAmount = calculateMaxAmount(isTokenA);
    handleAmountChange(maxAmount.toString(), isTokenA);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Récupérer les frais
        const tokenA = TOKEN_OPTIONS[0].address;
        const tokenB = TOKEN_OPTIONS[1].address;
        setFeesA(await getCollectedFees(tokenA, account));
        setFeesB(await getCollectedFees(tokenB, account));

        // Récupérer la position et mettre à jour la part
        await updatePoolShare();
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [account]);

  useEffect(() => {
    const fetchPoolInfo = async () => {
      try {
        // Récupérer le taux de change et les totaux du pool
        const rate = await getConversionRate(
          TOKEN_OPTIONS[0].address,
          TOKEN_OPTIONS[1].address,
          "1"
        );

        // Récupérer les totaux du pool depuis le contrat principal
        const totalA = await getTokenBalance(TOKEN_OPTIONS[0].address, CONTRACT_ADDRESS);
        const totalB = await getTokenBalance(TOKEN_OPTIONS[1].address, CONTRACT_ADDRESS);

        setPoolInfo({
          rate,
          share: position.poolShare,
          totalTokenA: totalA,
          totalTokenB: totalB,
          optimalRatio: true
        });
      } catch (error) {
        console.error("Erreur lors de la récupération des informations du pool:", error);
        toast.error("Impossible de récupérer les informations du pool");
      }
    };

    fetchPoolInfo();
    const interval = setInterval(fetchPoolInfo, 30000);
    return () => clearInterval(interval);
  }, [position.poolShare]);

  useEffect(() => {
    const fetchBalances = async () => {
      try {
        // Récupérer les balances de l'utilisateur connecté
        const balanceA = await getTokenBalance(TOKEN_OPTIONS[0].address, account);
        const balanceB = await getTokenBalance(TOKEN_OPTIONS[1].address, account);

        setBalances({
          tokenA: balanceA,
          tokenB: balanceB
        });
      } catch (error) {
        console.error("Erreur lors de la récupération des balances:", error);
        toast.error("Impossible de récupérer vos balances. Veuillez vérifier votre connexion.");
      }
    };

    if (account) {
      fetchBalances();
      const interval = setInterval(fetchBalances, 30000);
      return () => clearInterval(interval);
    }
  }, [account]);

  const handleApprove = async (token: string, amount: string) => {
    const validation = validateAmount(amount);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

    setIsApproving(true);
    try {
      await approveToken(token, amount);
      const tokenLabel = TOKEN_OPTIONS.find(t => t.address === token)?.label;
      toast.success(`Approved ${tokenLabel} successfully!`);
    } catch (error) {
      toast.error(`Approval failed: ${(error as Error).message}`);
    } finally {
      setIsApproving(false);
    }
  };

  const handleApproveAll = async () => {
    const amountValidation1 = validateAmount(amount1);
    const amountValidation2 = validateAmount(amount2);

    if (!amountValidation1.isValid || !amountValidation2.isValid) {
      toast.error(amountValidation1.error || amountValidation2.error);
      return;
    }

    setIsApproving(true);
    try {
      await Promise.all([
        approveToken(TOKEN_OPTIONS[0].address, amount1),
        approveToken(TOKEN_OPTIONS[1].address, amount2)
      ]);
      toast.success('Les deux tokens ont été approuvés avec succès !');
    } catch (error) {
      toast.error(`Échec de l'approbation : ${(error as Error).message}`);
    } finally {
      setIsApproving(false);
    }
  };

  const handleDeposit = async () => {
    const amountValidation1 = validateAmount(amount1);
    const amountValidation2 = validateAmount(amount2);
    const tokenValidation = validateTokenPair(amount1, amount2);

    if (!amountValidation1.isValid || !amountValidation2.isValid || !tokenValidation.isValid) {
      toast.error(amountValidation1.error || amountValidation2.error || tokenValidation.error);
      return;
    }

    // Vérification du ratio avec une tolérance plus large
    const expectedAmount2 = calculateRequiredAmount(amount1, true);
    const ratio = Math.abs(Number(amount2) - Number(expectedAmount2)) / Number(expectedAmount2);
    const tolerance = 0.01; // Augmentation de la tolérance à 1%

    if (ratio > tolerance && Number(poolInfo.totalTokenA) > 0) {
      toast.warning(`Le ratio n'est pas optimal. Montant recommandé pour le token B: ${formatNumber(expectedAmount2)}`);
      // On ne bloque plus la transaction, on laisse l'utilisateur décider
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
      await depositLiquidity(
        TOKEN_OPTIONS[0].address,
        TOKEN_OPTIONS[1].address,
        amount1,
        amount2
      );
      toast.success('Liquidité déposée avec succès !');
      setAmount1('');
      setAmount2('');
      await updatePoolShare(); // Mise à jour de la part après le dépôt
    } catch (error) {
      toast.error(`Échec du dépôt : ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const validation = validateAmount(amount1);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

    // Vérifier que le montant ne dépasse pas la balance de l'utilisateur
    if (Number(amount1) > Number(position.tokenAAmount)) {
      toast.error(`Vous ne pouvez pas retirer plus que votre balance (${position.tokenAAmount} TokenA)`);
      return;
    }

    setIsLoading(true);
    try {
      await withdrawLiquidity(
        TOKEN_OPTIONS[0].address,
        TOKEN_OPTIONS[1].address,
        amount1
      );
      toast.success('Liquidity withdrawn successfully!');
      setAmount1('');
      await updatePoolShare(); // Mise à jour de la part après le retrait
    } catch (error) {
      toast.error(`Withdrawal failed: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMintTokens = async () => {
    setIsLoading(true);
    try {
      await mintTestTokens();
      toast.success('Test tokens minted successfully!');
    } catch (error) {
      toast.error(`Failed to mint tokens: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="liquidity-container">
      <div className="tabs-container">
        <button
          className={`tab-button ${activeTab === 'add' ? 'active' : ''}`}
          onClick={() => setActiveTab('add')}
        >
          Ajouter de la liquidité
        </button>
        <button
          className={`tab-button ${activeTab === 'remove' ? 'active' : ''}`}
          onClick={() => setActiveTab('remove')}
        >
          Retirer de la liquidité
        </button>
      </div>

      <div className="token-inputs">
        <div className="token-input-container">
          <div className="token-input-header">
            <span className="token-label">Token A</span>
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
            data-tooltip="Utiliser le montant maximum"
          >
            MAX
          </button>
        </div>

        <div className="token-input-container">
          <div className="token-input-header">
            <span className="token-label">Token B</span>
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
            data-tooltip="Utiliser le montant maximum"
          >
            MAX
          </button>
        </div>
      </div>

      {!poolInfo.optimalRatio && (
        <div className="ratio-warning">
          Attention: Le ratio des tokens n'est pas optimal. Cela peut entraîner une perte de valeur.
        </div>
      )}

      <div className="pool-info">
        <div className="pool-info-item">
          <span className="pool-info-label">Taux d'échange</span>
          <span className="pool-info-value">1 A = {formatNumber(poolInfo.rate)} B</span>
        </div>
        <div className="pool-info-item">
          <span className="pool-info-label">Part de la pool</span>
          <span className="pool-info-value">{formatNumber(poolInfo.share)}%</span>
        </div>
        <div className="pool-info-item">
          <span className="pool-info-label">Total Token A</span>
          <span className="pool-info-value">{formatNumber(poolInfo.totalTokenA)}</span>
        </div>
        <div className="pool-info-item">
          <span className="pool-info-label">Total Token B</span>
          <span className="pool-info-value">{formatNumber(poolInfo.totalTokenB)}</span>
        </div>
      </div>

      <div className="action-buttons">
        {activeTab === 'add' ? (
          <>
            <button
              className={`action-button approve ${isLoading ? 'loading' : ''}`}
              onClick={handleApproveAll}
              disabled={isLoading || !amount1 || !amount2}
            >
              {isLoading ? 'Approbation...' : 'Approuver'}
            </button>
            <button
              className={`action-button deposit ${isLoading ? 'loading' : ''}`}
              onClick={handleDeposit}
              disabled={isLoading || !amount1 || !amount2}
            >
              {isLoading ? 'Dépôt...' : 'Déposer'}
            </button>
          </>
        ) : (
          <>
            <div className="fees-section">
              <div className="fees-info">
                <span className="fees-label">Frais collectés</span>
                <div className="fees-value">
                  {formatNumber(feesA)} A / {formatNumber(feesB)} B
                </div>
              </div>
            </div>
            <button
              className={`action-button withdraw ${isLoading ? 'loading' : ''}`}
              onClick={handleWithdraw}
              disabled={isLoading || Number(position.poolShare) === 0}
            >
              {isLoading ? 'Retrait...' : 'Retirer'}
            </button>
          </>
        )}
      </div>

      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
        </div>
      )}
    </div>
  );
};

export default LiquidityActions;