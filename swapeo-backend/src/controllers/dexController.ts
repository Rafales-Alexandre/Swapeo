import { Request, Response } from 'express';
import { SupabaseService } from '../services/supabaseService';

const supabaseService = new SupabaseService();

// Récupérer la liste des tokens disponibles
export const getTokens = async (req: Request, res: Response) => {
  try {
    const tokens = await supabaseService.getTokens();
    res.json(tokens);
  } catch (error) {
    console.error('Erreur lors de la récupération des tokens:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des tokens' });
  }
};

// Récupérer le nombre total de swaps
export const getSwapCount = async (req: Request, res: Response) => {
  try {
    const count = await supabaseService.getSwapCount();
    res.json({ count });
  } catch (error) {
    console.error('Erreur lors de la récupération du nombre de swaps:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du nombre de swaps' });
  }
};

// Récupérer la liste des utilisateurs
export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await supabaseService.getUsers();
    res.json(users);
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
  }
};

// Récupérer la liste des fournisseurs de liquidité
export const getLiquidityProviders = async (req: Request, res: Response) => {
  try {
    const providers = await supabaseService.getLiquidityProviders();
    res.json(providers);
  } catch (error) {
    console.error('Erreur lors de la récupération des fournisseurs de liquidité:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des fournisseurs de liquidité' });
  }
};

// Obtenir toutes les statistiques en une seule requête
export const getAllStats = async (req: Request, res: Response) => {
  try {
    const [tokens, swapCount, users, liquidityProviders] = await Promise.all([
      supabaseService.getTokens(),
      supabaseService.getSwapCount(),
      supabaseService.getUsers(),
      supabaseService.getLiquidityProviders()
    ]);

    res.json({
      tokens,
      swapCount,
      users,
      liquidityProviders
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
}; 