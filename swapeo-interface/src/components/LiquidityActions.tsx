import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { depositLiquidity, withdrawLiquidity, getCollectedFees, approveToken, mintTestTokens, getLiquidityPosition, getConversionRate, getTokenBalance } from '../utils/contractServices';
import { TOKEN_OPTIONS } from '../utils/constants';
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
    share: '0'
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
        // Récupérer le taux de change (1 TokenA = X TokenB)
        const rate = await getConversionRate(
          TOKEN_OPTIONS[0].address,
          TOKEN_OPTIONS[1].address,
          "1"
        );

        // Utiliser la position déjà récupérée pour le share
        setPoolInfo({
          rate,
          share: position.poolShare
        });
      } catch (error) {
        console.error("Error fetching pool info:", error);
      }
    };

    fetchPoolInfo();
    const interval = setInterval(fetchPoolInfo, 30000);
    return () => clearInterval(interval);
  }, [position.poolShare]);

  useEffect(() => {
    const fetchBalances = async () => {
      try {
        const balanceA = await getTokenBalance(TOKEN_OPTIONS[0].address, account);
        const balanceB = await getTokenBalance(TOKEN_OPTIONS[1].address, account);

        setBalances({
          tokenA: balanceA,
          tokenB: balanceB
        });
      } catch (error) {
        console.error("Error fetching balances:", error);
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

  const handleDeposit = async () => {
    const amountValidation1 = validateAmount(amount1);
    const amountValidation2 = validateAmount(amount2);
    const tokenValidation = validateTokenPair(amount1, amount2);

    if (!amountValidation1.isValid || !amountValidation2.isValid || !tokenValidation.isValid) {
      toast.error(amountValidation1.error || amountValidation2.error || tokenValidation.error);
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
      toast.success('Liquidity deposited successfully!');
      setAmount1('');
      setAmount2('');
    } catch (error) {
      toast.error(`Deposit failed: ${(error as Error).message}`);
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
    <div className="liquidity-matrix-container">
      {/* Tab Navigation */}
      <div className="matrix-tabs">
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

      {/* Pool Information */}
      <div className="pool-info">
        <div className="info-row">
          <span className="info-label">Pool Rate</span>
          <span className="info-value">1 TKA = {formatNumber(poolInfo.rate)} TKB</span>
        </div>
        <div className="info-row">
          <span className="info-label">Your Pool Share</span>
          <span className="info-value">{formatNumber(poolInfo.share)}%</span>
        </div>
      </div>

      {/* Token Input Section */}
      <div className="token-input-section">
        <div className="input-group">
          <div className="input-header">
            <span>{activeTab === 'add' ? 'Montant à déposer' : 'Montant à retirer'}</span>
            <span className="balance">Balance: {formatNumber(balances.tokenA)} TKA</span>
          </div>
          <div className="matrix-input">
            <input
              type="text"
              value={amount1}
              onChange={(e) => setAmount1(e.target.value)}
              placeholder="0.0"
            />
            <button className="token-selector">
              <span className="token-icon">TKA</span>
            </button>
          </div>
        </div>

        {activeTab === 'add' && (
          <>
            <div className="plus-indicator">+</div>

            <div className="input-group">
              <div className="input-header">
                <span>Montant à déposer</span>
                <span className="balance">Balance: {formatNumber(balances.tokenB)} TKB</span>
              </div>
              <div className="matrix-input">
                <input
                  type="text"
                  value={amount2}
                  onChange={(e) => setAmount2(e.target.value)}
                  placeholder="0.0"
                />
                <button className="token-selector">
                  TKB
                  <span className="dropdown-icon">▼</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Action Buttons */}
      <div className="matrix-actions">
        <button 
          className="approve-btn"
          onClick={() => {
            handleApprove(TOKEN_OPTIONS[0].address, amount1);
            handleApprove(TOKEN_OPTIONS[1].address, amount2);
          }}
          disabled={isApproving || !amount1 || !amount2}
        >
          {isApproving ? 'Approving...' : 'Approve Tokens'}
          <span className="btn-glow"></span>
        </button>
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