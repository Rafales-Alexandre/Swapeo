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
      // Premier dépôt, on vérifie si le montant est dans les limites des balances
      const maxAmount = calculateMaxAmount(isTokenA);
      if (Number(amount) > maxAmount) {
        return formatNumber(maxAmount.toString());
      }
      return amount;
    }
    
    const inputAmount = Number(amount);
    const requiredAmount = isTokenA ? inputAmount * rate : inputAmount / rate;
    
    // Vérifier si le montant calculé est dans les limites des balances
    const maxRequired = calculateMaxAmount(!isTokenA);
    return formatNumber(Math.min(requiredAmount, maxRequired).toString());
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

        // Récupérer la position
        const pos = await getLiquidityPosition(account);
        setPosition(pos);
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

        console.log("Balances récupérées:", {
          tokenA: balanceA,
          tokenB: balanceB,
          account: account
        });

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

    // Vérifier que les montants respectent exactement le ratio du pool
    const expectedAmount2 = calculateRequiredAmount(amount1, true);
    const ratio = Math.abs(Number(amount2) - Number(expectedAmount2)) / Number(expectedAmount2);
    const tolerance = 0.001; // 0.1% de tolérance maximum

    if (ratio > tolerance && Number(poolInfo.totalTokenA) > 0) {
      toast.error(`Les montants doivent respecter exactement le ratio du pool (${formatNumber(poolInfo.rate)} TKB par TKA)`);
      // Correction automatique des montants
      setAmount2(expectedAmount2);
      return;
    }

    // Vérifier les balances
    if (Number(amount1) > Number(balances.tokenA) || Number(amount2) > Number(balances.tokenB)) {
      toast.error('Balance insuffisante pour effectuer ce dépôt');
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
      {/* Tab Navigation */}
      <div className="liquidity-tabs">
        <button 
          className={`tab-btn ${activeTab === 'add' ? 'active' : ''}`}
          onClick={() => setActiveTab('add')}
        >
          Add Liquidity
        </button>
        <button 
          className={`tab-btn ${activeTab === 'remove' ? 'active' : ''}`}
          onClick={() => setActiveTab('remove')}
        >
          Remove Liquidity
        </button>
      </div>

      {/* Mode Title */}
      <div className="mode-title">
        <h2>{activeTab === 'add' ? 'Ajouter de la Liquidité' : 'Retirer de la Liquidité'}</h2>
        <p className="mode-description">
          {activeTab === 'add' 
            ? 'Déposez une paire de tokens pour fournir de la liquidité et gagner des frais de trading' 
            : 'Retirez vos tokens et arrêtez de fournir de la liquidité pour cette paire'}
        </p>
      </div>

      {/* Test Tokens Button */}
      <div className="test-tokens-section">
        <button 
          className="mint-btn"
          onClick={handleMintTokens}
          disabled={isLoading}
        >
          {isLoading ? 'Minting...' : 'Get Test Tokens'}
        </button>
      </div>

      {/* Pool Information avec indicateur de ratio */}
      <div className="pool-info">
        <div className="info-row">
          <span className="info-label">Pool Rate</span>
          <span className="info-value">1 TKA = {formatNumber(poolInfo.rate)} TKB</span>
        </div>
        <div className="info-row">
          <span className="info-label">Your Pool Share</span>
          <span className="info-value">{formatNumber(poolInfo.share)}%</span>
        </div>
        {activeTab === 'add' && Number(amount1) > 0 && (
          <div className="info-row ratio-indicator">
            <span className="info-label">Ratio Status</span>
            <span className={`info-value ${poolInfo.optimalRatio ? 'optimal' : 'suboptimal'}`}>
              {poolInfo.optimalRatio ? '✓ Optimal' : '⚠️ Ajustement nécessaire'}
            </span>
          </div>
        )}
      </div>

      {/* Token Input Section avec boutons Max */}
      <div className="token-input-section">
        <div className="input-group">
          <div className="input-header">
            <span>{activeTab === 'add' ? 'Montant à déposer' : 'Montant à retirer'}</span>
            <span className="balance">
              Balance: {formatNumber(balances.tokenA)} TKA
              {activeTab === 'add' && (
                <button 
                  className="max-button" 
                  onClick={() => handleSetMaxAmount(true)}
                  disabled={isLoading}
                >
                  Max
                </button>
              )}
            </span>
          </div>
          <input
            type="number"
            value={amount1}
            onChange={(e) => handleAmountChange(e.target.value, true)}
            placeholder="0.0"
            disabled={isLoading || activeTab === 'remove'}
          />
          {activeTab === 'add' && (
            <button
              className="approve-btn"
              onClick={handleApproveAll}
              disabled={isApproving || !amount1 || !amount2}
            >
              {isApproving ? 'Approbation...' : 'Approuver TKA et TKB'}
            </button>
          )}
        </div>

        {activeTab === 'add' && (
          <div className="input-group">
            <div className="input-header">
              <span>Montant équivalent (basé sur le ratio du pool)</span>
              <span className="balance">
                Balance: {formatNumber(balances.tokenB)} TKB
                <button 
                  className="max-button" 
                  onClick={() => handleSetMaxAmount(false)}
                  disabled={isLoading}
                >
                  Max
                </button>
              </span>
            </div>
            <input
              type="number"
              value={amount2}
              onChange={(e) => handleAmountChange(e.target.value, false)}
              placeholder="0.0"
              disabled={isLoading}
            />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="liquidity-actions">
        <button 
          className="action-btn"
          onClick={activeTab === 'add' ? handleDeposit : handleWithdraw}
          disabled={isLoading || !amount1 || (activeTab === 'add' && !amount2)}
        >
          {isLoading ? 'Processing...' : (activeTab === 'add' ? 'Déposer les tokens' : 'Retirer les tokens')}
          <span className="btn-glow"></span>
        </button>
      </div>

      {/* Position Summary */}
      <div className="position-summary">
        <h3 className="summary-title">Your Position</h3>
        <div className="summary-grid">
          <div className="summary-item">
            <span className="item-label">Pooled TokenA</span>
            <span className="item-value">{position.tokenAAmount} TKA</span>
          </div>
          <div className="summary-item">
            <span className="item-label">Pooled TokenB</span>
            <span className="item-value">{position.tokenBAmount} TKB</span>
          </div>
          <div className="summary-item">
            <span className="item-label">Pool Share</span>
            <span className="item-value">{position.poolShare}%</span>
          </div>
          <div className="summary-item">
            <span className="item-label">Earned Fees</span>
            <span className="item-value positive">+{formatNumber(feesA)} TKA / +{formatNumber(feesB)} TKB</span>
          </div>
        </div>
      </div>

      <div className="fees-display">
        <h3>Collected Fees</h3>
        <div className="fees-grid">
          <div className="fee-item">
            <span className="fee-label">TokenA:</span>
            <span className="fee-amount">{formatNumber(feesA)}</span>
          </div>
          <div className="fee-item">
            <span className="fee-label">TokenB:</span>
            <span className="fee-amount">{formatNumber(feesB)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiquidityActions;