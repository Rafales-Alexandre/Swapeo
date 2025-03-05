import { Request, Response } from 'express';
import { DexService } from '../services/dexService';

const dexService = new DexService();

// Get list of available tokens
export const getTokens = async (req: Request, res: Response) => {
  try {
    const tokens = await dexService.getAvailableTokens();
    res.json(tokens);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des tokens' });
  }
};

// Get total number of swaps
export const getSwapCount = async (req: Request, res: Response) => {
  try {
    const count = await dexService.getSwapCount();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération du nombre de swaps' });
  }
};

// Get list of users who have interacted with the protocol
export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await dexService.getUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
  }
};

// Get list of liquidity providers
export const getLiquidityProviders = async (req: Request, res: Response) => {
  try {
    const providers = await dexService.getLiquidityProviders();
    res.json(providers);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des fournisseurs de liquidité' });
  }
};

// Get all stats in one request
export const getAllStats = async (req: Request, res: Response) => {
  try {
    const [availableTokens, swapCount, users, liquidityProviders] = await Promise.all([
      dexService.getAvailableTokens(),
      dexService.getSwapCount(),
      dexService.getUsers(),
      dexService.getLiquidityProviders()
    ]);

    res.json({
      availableTokens,
      swapCount,
      users,
      liquidityProviders
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
}; 