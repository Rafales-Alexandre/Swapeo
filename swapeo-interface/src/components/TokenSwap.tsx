import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getConversionRate, swapTokens, approveToken, getTokenBalance, getLiquidityPosition } from '../utils/contractServices';
import { TOKEN_OPTIONS, TOKENS } from '../utils/constants';
import './styles/TokenSwap.css';

type Token = {
  address: string;
  label: string;
};

const TokenSwap: React.FC<{ account: string }> = ({ account }) => {
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [exchangeRate, setExchangeRate] = useState('0');
  const [balances, setBalances] = useState({
    tokenA: '0',
    tokenB: '0'
  });
  const [poolReserves, setPoolReserves] = useState({
    tokenAAmount: '0',
    tokenBAmount: '0',
    poolShare: '0'
  });
  const [fromToken, setFromToken] = useState<Token>(TOKEN_OPTIONS[0]);
  const [toToken, setToToken] = useState<Token>(TOKEN_OPTIONS[1]);

  // Récupérer les balances des tokens et les réserves de la pool
  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Fetching data for account:", account);
        
        // Utiliser les anciennes adresses pour les balances
        const balanceA = await getTokenBalance(TOKENS.TOKEN_A_OLD, account);
        const balanceB = await getTokenBalance(TOKENS.TOKEN_B_OLD, account);
        
        console.log("Balances fetched:", {
          tokenA: balanceA,
          tokenB: balanceB
        });
        
        // Les réserves utilisent maintenant les nouvelles adresses dans getLiquidityPosition
        const reserves = await getLiquidityPosition(account);
        console.log("Pool reserves fetched:", reserves);
        
        setBalances({
          tokenA: balanceA,
          tokenB: balanceB
        });
        setPoolReserves(reserves);
        
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Erreur lors de la récupération des données");
      }
    };

    if (account) {
      fetchData();
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [account]);

  // Calculer le montant d'entrée maximum pour un montant de sortie donné
  const getMaxInputForOutput = (targetOutput: number, fromReserve: number, toReserve: number) => {
    return (targetOutput * fromReserve) / (toReserve - targetOutput);
  };

  // Calculer le montant de sortie estimé
  const getEstimatedOutput = (inputAmount: number) => {
    // Utiliser les nouvelles adresses pour les réserves
    const fromReserve = fromToken.address === TOKENS.TOKEN_A 
      ? Number(poolReserves.tokenAAmount) 
      : Number(poolReserves.tokenBAmount);
    
    const toReserve = toToken.address === TOKENS.TOKEN_A 
      ? Number(poolReserves.tokenAAmount) 
      : Number(poolReserves.tokenBAmount);

    const feeAmount = inputAmount * 0.01;
    const amountInNet = inputAmount - feeAmount;

    return (amountInNet * toReserve) / (fromReserve + amountInNet);
  };

  // Fonction pour valider le montant d'entrée
  const validateAmount = (amount: string) => {
    if (!amount || isNaN(Number(amount))) return false;
    
    const toReserveAmount = toToken.address === TOKENS.TOKEN_A 
      ? poolReserves.tokenAAmount 
      : poolReserves.tokenBAmount;

    const numAmount = Number(amount);
    const numToReserve = Number(toReserveAmount);

    const estimatedOutput = getEstimatedOutput(numAmount);
    if (estimatedOutput > numToReserve) {
      return false;
    }

    return true;
  };

  // Gestionnaire de changement du montant d'entrée
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAmount = e.target.value;
    
    if (!newAmount) {
      setFromAmount('');
      setToAmount('');
      return;
    }

    const numAmount = Number(newAmount);
    if (isNaN(numAmount)) return;

    const fromReserve = fromToken.address === TOKENS.TOKEN_A 
      ? Number(poolReserves.tokenAAmount) 
      : Number(poolReserves.tokenBAmount);
    
    const toReserve = toToken.address === TOKENS.TOKEN_A 
      ? Number(poolReserves.tokenAAmount) 
      : Number(poolReserves.tokenBAmount);

    // Permettre la saisie mais afficher un avertissement si pas de liquidité
    if (fromReserve === 0 || toReserve === 0) {
      setFromAmount(newAmount);
      setToAmount('0');
      toast.warn("Attention: Pas assez de liquidité dans la pool pour cet échange");
      return;
    }

    // Calculer le montant de sortie estimé
    const estimatedOutput = getEstimatedOutput(numAmount);

    if (estimatedOutput > toReserve * 0.95) {
      const maxOutput = toReserve * 0.95;
      const maxInput = getMaxInputForOutput(maxOutput, fromReserve, toReserve);
      
      setFromAmount(maxInput.toFixed(6));
      toast.info(`Montant ajusté au maximum possible pour recevoir ${(maxOutput).toFixed(6)} ${toToken.label}`);
    } else {
      setFromAmount(newAmount);
    }
  };

  // Mettre à jour le taux de conversion quand le montant change
  useEffect(() => {
    const updateRate = async () => {
      if (fromAmount && !isNaN(Number(fromAmount))) {
        try {
          if (!validateAmount(fromAmount)) {
            setToAmount('');
            setExchangeRate('0');
            return;
          }

          const rate = await getConversionRate(
            fromToken.address,
            toToken.address,
            fromAmount
          );
          setToAmount(rate);
          
          // Calculer le taux pour 1 token
          const baseRate = await getConversionRate(
            fromToken.address,
            toToken.address,
            "1"
          );
          setExchangeRate(baseRate);
        } catch (error) {
          console.error("Error updating rate:", error);
          setToAmount('');
          setExchangeRate('0');
        }
      } else {
        setToAmount('');
        setExchangeRate('0');
      }
    };
    updateRate();
  }, [fromAmount, fromToken, toToken, poolReserves]);

  const handleApprove = async () => {
    if (!fromAmount || isNaN(Number(fromAmount))) {
      toast.error("Veuillez entrer un montant valide");
      return;
    }

    setIsLoading(true);
    try {
      await approveToken(fromToken.address, fromAmount);
      toast.success("Approbation réussie!");
      setIsApproved(true);
    } catch (error: any) {
      console.error("Error approving:", error);
      toast.error(error.message || "Erreur lors de l'approbation");
      setIsApproved(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwap = async () => {
    if (!fromAmount || !toAmount || isNaN(Number(fromAmount))) {
      toast.error("Veuillez entrer des montants valides");
      return;
    }

    if (!isApproved) {
      toast.error("Veuillez d'abord approuver la transaction");
      return;
    }

    setIsLoading(true);
    try {
      console.log("Swapping tokens:", {
        fromToken: fromToken.label,
        toToken: toToken.label,
        amount: fromAmount
      });
      
      await swapTokens(fromToken.address, toToken.address, fromAmount);
      toast.success("Échange réussi!");
      setFromAmount('');
      setToAmount('');
      setIsApproved(false);
      
      // Rafraîchir les balances avec les anciennes adresses
      const balanceA = await getTokenBalance(TOKENS.TOKEN_A_OLD, account);
      const balanceB = await getTokenBalance(TOKENS.TOKEN_B_OLD, account);
      setBalances({ tokenA: balanceA, tokenB: balanceB });
    } catch (error: any) {
      console.error("Error swapping:", error);
      toast.error(error.message || "Erreur lors de l'échange");
    } finally {
      setIsLoading(false);
    }
  };

  const switchTokens = () => {
    setFromAmount('');
    setToAmount('');
    setIsApproved(false);
    const tempToken = { ...fromToken };
    setFromToken({ ...toToken });
    setToToken(tempToken);
  };

  const getBalance = (token: Token) => {
    return token.address === TOKENS.TOKEN_A_OLD ? balances.tokenA : balances.tokenB;
  };

  // Fonction pour formater les nombres avec 4 décimales maximum
  const formatNumber = (value: string | number) => {
    const num = typeof value === 'string' ? Number(value) : value;
    if (isNaN(num)) return '0';
    return num.toFixed(4).replace(/\.?0+$/, '');
  };

  return (
    <div className="token-exchange-container">
      {/* Pool Reserves Display */}
      <div className="pool-reserves-panel">
        <div className="reserves-display">
          <span className="reserves-label">Réserves de la Pool</span>
          <div className="reserves-values">
            <span>{formatNumber(poolReserves.tokenAAmount)} TokenA</span>
            <span>{formatNumber(poolReserves.tokenBAmount)} TokenB</span>
          </div>
        </div>
      </div>

      {/* User Balances Display */}
      <div className="pool-reserves-panel">
        <div className="reserves-display">
          <span className="reserves-label">Vos Balances</span>
          <div className="reserves-values">
            <span>{formatNumber(balances.tokenA)} TokenA</span>
            <span>/</span>
            <span>{formatNumber(balances.tokenB)} TokenB</span>
          </div>
        </div>
      </div>

      {/* Exchange Rate Display */}
      <div className="exchange-rate-panel">
        <div className="rate-display">
          <span className="rate-label">Taux d'échange </span>
          <span className="rate-value">1 {fromToken.label} = {formatNumber(exchangeRate)} {toToken.label}</span>
        </div>
      </div>

      {/* Token Input Panels */}
      <div className="token-panels">
        <div className="token-input-panel">
          <div className="panel-header">
            <span>Vous payez </span>
            <span className="balance-display">
              Balance: {formatNumber(getBalance(fromToken))} {fromToken.label}
            </span>
          </div>
          <div className="input-container">
            <input
              type="text"
              value={fromAmount}
              onChange={handleAmountChange}
              placeholder="0.0"
              className="amount-input"
              disabled={isLoading}
            />
            <button className="token-select-btn">
              {fromToken.label}
            </button>
          </div>
        </div>

        <div className="swap-direction-btn" onClick={switchTokens}>
          <span className="swap-icon">⇅</span>
        </div>

        <div className="token-input-panel">
          <div className="panel-header">
            <span>Vous recevez </span>
            <span className="balance-display">
              Balance: {formatNumber(getBalance(toToken))} {toToken.label}
              <span className="max-amount">
                (Max disponible: {formatNumber(toToken.address === TOKENS.TOKEN_A 
                  ? poolReserves.tokenAAmount 
                  : poolReserves.tokenBAmount)} {toToken.label})
              </span>
            </span>
          </div>
          <div className="input-container">
            <input
              type="text"
              value={toAmount}
              placeholder="0.0"
              className="amount-input"
              disabled={true}
            />
            <button className="token-select-btn">
              {toToken.label}
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button 
          className={`approve-btn ${isApproved ? 'approved' : ''}`}
          onClick={handleApprove}
          disabled={isLoading || !fromAmount || !validateAmount(fromAmount)}
        >
          {isLoading ? 'En cours...' : isApproved ? 'Approuvé ✓' : 'Approve'}
        </button>
        <button 
          className="swap-btn" 
          onClick={handleSwap}
          disabled={isLoading || !fromAmount || !toAmount || !isApproved || !validateAmount(fromAmount)}
        >
          {isLoading ? 'En cours...' : 'Swap'}
        </button>
      </div>

      {/* Transaction Details */}
      <div className="transaction-details">
        <div className="detail-item">
          <span>Minimum reçu </span>
          <span>{formatNumber(toAmount)} {toToken.label}</span>
        </div>
        <div className="detail-item">
          <span>Taux d'échange </span>
          <span>1 {fromToken.label} = {formatNumber(exchangeRate)} {toToken.label}</span>
        </div>
        <div className="detail-item">
          <span>Impact sur le prix </span>
          <span>{fromAmount && toAmount ? 
            formatNumber((Number(fromAmount) / Number(poolReserves.tokenAAmount)) * 100) 
            : '0'}%</span>
        </div>
      </div>
    </div>
  );
};

export default TokenSwap;