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
  const [loadingStep, setLoadingStep] = useState<'idle' | 'approving' | 'swapping'>('idle');
  const [isApproved, setIsApproved] = useState(false);
  const [exchangeRate, setExchangeRate] = useState('0');
  const [isSwapping, setIsSwapping] = useState(false);
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
        
        // Utiliser les anciennes adresses pour les balances
        const balanceA = await getTokenBalance(TOKENS.TOKEN_A_OLD, account);
        const balanceB = await getTokenBalance(TOKENS.TOKEN_B_OLD, account);
        
        
        // Les réserves utilisent maintenant les nouvelles adresses dans getLiquidityPosition
        const reserves = await getLiquidityPosition(account);
        
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

  const handleSwap = async () => {
    if (!fromAmount || !toAmount || isNaN(Number(fromAmount))) {
      toast.error("Veuillez entrer des montants valides");
      return;
    }

    setIsLoading(true);
    try {
      // Si les tokens ne sont pas approuvés, on les approuve d'abord
      if (!isApproved) {
        setLoadingStep('approving');
        await approveToken(fromToken.address, fromAmount);
        toast.success("Approbation réussie!");
        setIsApproved(true);
      }
      
      // Puis on effectue l'échange
      setLoadingStep('swapping');
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
      console.error("Error during swap process:", error);
      toast.error(error.message || "Erreur lors de l'opération");
    } finally {
      setIsLoading(false);
      setLoadingStep('idle');
    }
  };

  const switchTokens = () => {
    setIsSwapping(true);
    setFromAmount('');
    setToAmount('');
    setIsApproved(false);
    const tempToken = { ...fromToken };
    setFromToken({ ...toToken });
    setToToken(tempToken);
    
    // Retirer la classe d'animation après la fin de l'animation
    setTimeout(() => {
      setIsSwapping(false);
    }, 300);
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
    <div className="token-swap-container">
      <div className={`token-input-container ${isSwapping ? 'swapping' : ''}`}>
        <div className="token-input-header">
          <div className="token-select" data-tooltip="Sélectionner le token d'entrée">
            <span>{fromToken.label}</span>
          </div>
        </div>
        <div className="input-with-max">
          <input
            type="text"
            className="token-input"
            placeholder="0.0"
            value={fromAmount}
            onChange={handleAmountChange}
            disabled={isLoading}
          />
          <button 
            className="max-button"
            onClick={() => handleAmountChange({ target: { value: getBalance(fromToken) } } as React.ChangeEvent<HTMLInputElement>)}
            data-tooltip="Utiliser le solde maximum"
          >
            MAX
          </button>
        </div>
      </div>

      <div className="swap-arrow" onClick={switchTokens}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M7 10L12 5L17 10M17 14L12 19L7 14" />
        </svg>
      </div>

      <div className={`token-input-container ${isSwapping ? 'swapping' : ''}`}>
        <div className="token-input-header">
          <div className="token-select" data-tooltip="Sélectionner le token de sortie">
            <span>{toToken.label}</span>
          </div>
        </div>
        <input
          type="text"
          className="token-input"
          placeholder="0.0"
          value={toAmount}
          readOnly
          disabled={isLoading}
        />
      </div>

      {exchangeRate !== '0' && (
        <div className="exchange-rate">
          1 {fromToken.label} = {formatNumber(exchangeRate)} {toToken.label}
        </div>
      )}

      <div className="swap-actions">
        <button
          className={`swap-button ${isLoading ? 'loading' : ''}`}
          onClick={handleSwap}
          disabled={isLoading || !fromAmount}
        >
          {isLoading 
            ? (loadingStep === 'approving' ? 'Approbation en cours...' : 'Échange en cours...')
            : 'Échanger'}
        </button>
      </div>

      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <div className="loading-message">
            {loadingStep === 'approving' ? 'Approbation de la transaction...' : 'Échange en cours...'}
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenSwap;