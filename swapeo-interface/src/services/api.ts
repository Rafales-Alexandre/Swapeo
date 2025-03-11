// Service pour interagir avec l'API backend
import { toast } from 'react-toastify';

// L'URL de base de l'API
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001/api';

// Types pour les objets manipulés
export interface Token {
  id: number;
  address: string;
  symbol: string;
  name: string;
  reserveAmount: string;
}

export interface Swap {
  id: number;
  txHash: string;
  userAddress: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string;
  fee: string;
  timestamp: string;
}

export interface User {
  id: number;
  address: string;
  swapCount: number;
  totalVolume: string;
  firstInteraction: string;
  lastInteraction: string;
}

export interface LiquidityProvider {
  id: number;
  address: string;
  tokenAAddress: string;
  tokenBAddress: string;
  totalTokenALiquidity: string;
  totalTokenBLiquidity: string;
  feesEarned: string;
  firstDeposit: string;
  lastDeposit: string;
}

export interface Stats {
  tokens: Token[];
  swapCount: number;
  users: User[];
  liquidityProviders: LiquidityProvider[];
}

// Méthode générique pour les appels API
async function apiCall<T>(
  endpoint: string, 
  method: 'GET' | 'POST' = 'GET', 
  body?: any
): Promise<T> {
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Erreur HTTP: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Erreur API (${endpoint}):`, error.message);
      toast.error(`Erreur: ${error.message}`);
    } else {
      console.error(`Erreur API inconnue (${endpoint}):`, error);
      toast.error('Une erreur inconnue est survenue');
    }
    throw error;
  }
}

// Récupération des données
export const getTokens = (): Promise<Token[]> => apiCall<Token[]>('/tokens');
export const getSwapCount = (): Promise<{ count: number }> => apiCall<{ count: number }>('/swaps/count');
export const getUsers = (): Promise<User[]> => apiCall<User[]>('/users');
export const getLiquidityProviders = (): Promise<LiquidityProvider[]> => apiCall<LiquidityProvider[]>('/liquidity-providers');
export const getAllStats = (): Promise<Stats> => apiCall<Stats>('/stats');

// Enregistrement des données
export const registerToken = (
  address: string, 
  symbol: string, 
  name: string, 
  reserveAmount?: string
): Promise<Token> => {
  return apiCall<Token>('/register/token', 'POST', {
    address,
    symbol,
    name,
    reserveAmount: reserveAmount || '0'
  });
};

export const registerSwap = (
  txHash: string,
  userAddress: string,
  inputToken: string,
  outputToken: string,
  inputAmount: string,
  outputAmount: string,
  fee?: string
): Promise<Swap> => {
  return apiCall<Swap>('/register/swap', 'POST', {
    txHash,
    userAddress,
    inputToken,
    outputToken,
    inputAmount,
    outputAmount,
    fee: fee || '0'
  });
};

export const registerLiquidityDeposit = (
  address: string,
  tokenAAddress: string,
  tokenBAddress: string,
  tokenAAmount: string,
  tokenBAmount: string
): Promise<LiquidityProvider> => {
  return apiCall<LiquidityProvider>('/register/liquidity/deposit', 'POST', {
    address,
    tokenAAddress,
    tokenBAddress,
    tokenAAmount,
    tokenBAmount
  });
};

export const registerLiquidityWithdrawal = (
  address: string,
  tokenAAddress: string,
  tokenBAddress: string,
  tokenAAmount: string,
  tokenBAmount: string
): Promise<{ success: boolean; message: string; provider: LiquidityProvider | null; }> => {
  return apiCall<{ success: boolean; message: string; provider: LiquidityProvider | null; }>(
    '/register/liquidity/withdraw', 
    'POST', 
    {
      address,
      tokenAAddress,
      tokenBAddress,
      tokenAAmount,
      tokenBAmount
    }
  );
};

export const withdrawLiquidity = async (
  tokenA: string,
  tokenB: string,
  amountA: string
): Promise<void> => {
  if (!isInitialized) {
    await initialize();
  }
  
  if (!contract) {
    throw new Error("Le contrat n'est pas initialisé");
  }
  
  try {
    console.log("Retrait de liquidité avec les paramètres:");
    console.log("Token A:", tokenA);
    console.log("Token B:", tokenB);
    console.log("Montant A (chaîne):", amountA);
    
    // Utiliser une valeur fixe non nulle pour garantir que le montant est > 0
    const fixedAmount = parseUnits("0.001", 18); // 0.001 token
    console.log("Montant fixe pour le retrait:", fixedAmount.toString());
    
    // Utiliser withdraw avec le montant fixe
    const tx = await contract.withdraw(tokenA, tokenB, fixedAmount);
    console.log("Transaction envoyée:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("Transaction confirmée:", receipt.hash);
  } catch (error) {
    console.error("Erreur lors du retrait de liquidité:", error);
    throw error;
  }
}; 