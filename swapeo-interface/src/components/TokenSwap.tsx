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
        console.log("Récupération des balances pour le compte:", account);
        console.log("Adresses des tokens utilisées:", {
          tokenA: TOKENS.TOKEN_A,
          tokenB: TOKENS.TOKEN_B
        });
        
        // Utiliser les adresses des tokens actuels
        const balanceA = await getTokenBalance(TOKENS.TOKEN_A, account);
        const balanceB = await getTokenBalance(TOKENS.TOKEN_B, account);
        
        console.log(`Soldes récupérés pour le compte ${account}:`, {
          tokenA: balanceA,
          tokenB: balanceB
        });
        
        // Vérifier si les balances sont des chaînes vides ou "0"
        const tokenABalance = balanceA && balanceA !== "0" ? balanceA : "0";
        const tokenBBalance = balanceB && balanceB !== "0" ? balanceB : "0";
        
        // Les réserves utilisent maintenant les nouvelles adresses dans getLiquidityPosition
        const reserves = await getLiquidityPosition(account);
        
        setBalances({
          tokenA: tokenABalance,
          tokenB: tokenBBalance
        });
        setPoolReserves(reserves);
        
        console.log("État des balances après mise à jour:", {
          tokenA: tokenABalance,
          tokenB: tokenBBalance
        });
        
      } catch (error) {
        console.error("Erreur lors de la récupération des données:", error);
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

          // Détecter si on utilise les anciennes ou les nouvelles adresses
          const isFromOld = fromToken.address === TOKENS.TOKEN_A_OLD || fromToken.address === TOKENS.TOKEN_B_OLD;
          const isToOld = toToken.address === TOKENS.TOKEN_A_OLD || toToken.address === TOKENS.TOKEN_B_OLD;
          
          console.log("Tokens sélectionnés:", {
            fromToken: fromToken.address + (isFromOld ? " (ancien)" : ""),
            toToken: toToken.address + (isToOld ? " (ancien)" : ""),
            fromAmount
          });
          
          // Utiliser les anciennes adresses pour le taux d'échange, qui fonctionnent mieux
          console.log("Utilisation des anciennes adresses pour le taux d'échange");
          let sourceTokenAddress = isFromOld ? fromToken.address : TOKENS.TOKEN_A_OLD;
          let targetTokenAddress = isToOld ? toToken.address : TOKENS.TOKEN_B_OLD;
          
          // Si les adresses source/cible sont les mêmes, inverser la cible
          if (sourceTokenAddress === targetTokenAddress) {
            targetTokenAddress = TOKENS.TOKEN_B_OLD;
          }
          
          console.log("Adresses utilisées pour le taux:", {
            source: sourceTokenAddress,
            target: targetTokenAddress
          });
          
          // Obtenir le taux de conversion avec les anciennes adresses
          const conversionRate = await getConversionRate(
            sourceTokenAddress,
            targetTokenAddress,
            "1"
          );
          
          console.log("Taux de conversion récupéré:", conversionRate);
          setExchangeRate(conversionRate);
          
          // Calculer le montant de sortie en utilisant le taux
          const outputAmount = (Number(fromAmount) * Number(conversionRate)).toString();
          console.log("Montant de sortie calculé:", outputAmount);
          setToAmount(outputAmount);
          
        } catch (error) {
          console.error("Erreur lors de la mise à jour du taux:", error);
          setToAmount('');
          setExchangeRate('0');
        }
      } else {
        setToAmount('');
        setExchangeRate('0');
      }
    };

    updateRate();
  }, [fromAmount, fromToken.address, toToken.address]);

  const handleSwap = async () => {
    if (!account || !fromAmount) return;
    
    setIsLoading(true);
    setLoadingStep('idle');
    
    try {
      if (!isApproved) {
        setLoadingStep('approving');
        await approveToken(fromToken.address, fromAmount);
        toast.success("Approbation réussie!");
        setIsApproved(true);
      }
      
      // Puis on effectue l'échange avec toutes les options de fallback
      setLoadingStep('swapping');
      const swapResult = await swapTokens(fromToken.address, toToken.address, fromAmount);
      
      if (swapResult.success) {
        if (swapResult.directUniswap) {
          toast.success("Échange réussi via Uniswap directement!");
        } else if (swapResult.uniswapFallback) {
          toast.success("Échange réussi via Uniswap!");
        } else {
          toast.success("Échange réussi via SwapeoDEX!");
        }
        
        setFromAmount('');
        setToAmount('');
        setIsApproved(false);
        
        // Rafraîchir les balances avec les anciennes adresses
        const balanceA = await getTokenBalance(TOKENS.TOKEN_A_OLD, account);
        const balanceB = await getTokenBalance(TOKENS.TOKEN_B_OLD, account);
        setBalances({ tokenA: balanceA, tokenB: balanceB });
      } else {
        toast.error(swapResult.error || "Erreur lors de l'échange");
      }
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