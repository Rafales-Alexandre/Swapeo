import { API_BASE_URL } from './constants';

// Type pour les statistiques du DEX
interface DexStats {
  availableTokens: Array<{
    address: string;
    balance: string;
  }>;
  swapCount: number;
  users: string[];
  liquidityProviders: string[];
}

// Fonction pour gérer les erreurs de l'API
const handleApiError = (error: any) => {
  console.error('API Error:', error);
  throw new Error(error.response?.data?.error || 'Une erreur est survenue');
};

// Récupérer les tokens disponibles et leurs balances
export const getAvailableTokens = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/tokens`);
    if (!response.ok) throw new Error('Erreur lors de la récupération des tokens');
    return await response.json();
  } catch (error) {
    handleApiError(error);
  }
};

// Récupérer le nombre total de swaps
export const getSwapCount = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/swaps/count`);
    if (!response.ok) throw new Error('Erreur lors de la récupération du nombre de swaps');
    return await response.json();
  } catch (error) {
    handleApiError(error);
  }
};

// Récupérer la liste des utilisateurs
export const getUsers = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/users`);
    if (!response.ok) throw new Error('Erreur lors de la récupération des utilisateurs');
    return await response.json();
  } catch (error) {
    handleApiError(error);
  }
};

// Récupérer la liste des fournisseurs de liquidité
export const getLiquidityProviders = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/liquidity-providers`);
    if (!response.ok) throw new Error('Erreur lors de la récupération des fournisseurs de liquidité');
    return await response.json();
  } catch (error) {
    handleApiError(error);
  }
};

// Récupérer toutes les statistiques en une seule requête
export const getDexStats = async (): Promise<DexStats> => {
  try {
    const response = await fetch(`${API_BASE_URL}/stats`);
    if (!response.ok) {
      throw new Error('Failed to fetch stats');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching stats:', error);
    return {
      availableTokens: [],
      swapCount: 0,
      users: [],
      liquidityProviders: []
    };
  }
}; 