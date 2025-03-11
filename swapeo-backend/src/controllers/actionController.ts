import { Request, Response } from 'express';
import { SupabaseService } from '../services/supabaseService';
import { ITokenData } from '../models/Token';
import { ISwapData } from '../models/Swap';

const supabaseService = new SupabaseService();

// Enregistrer un nouveau token
export const registerToken = async (req: Request, res: Response) => {
  try {
    const { address, symbol, name, reserveAmount } = req.body;
    
    if (!address || !symbol || !name) {
      return res.status(400).json({ error: 'Adresse, symbole et nom du token requis' });
    }
    
    const tokenData: ITokenData = {
      address,
      symbol,
      name,
      reserveAmount: reserveAmount || '0'
    };
    
    const token = await supabaseService.addToken(tokenData);
    
    res.status(201).json(token);
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement du token:', error);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement du token' });
  }
};

// Enregistrer un swap
export const registerSwap = async (req: Request, res: Response) => {
  try {
    const { 
      txHash, 
      userAddress, 
      inputToken, 
      outputToken, 
      inputAmount, 
      outputAmount, 
      fee 
    } = req.body;
    
    if (!txHash || !userAddress || !inputToken || !outputToken || !inputAmount || !outputAmount) {
      return res.status(400).json({ 
        error: 'Tous les champs sont requis: txHash, userAddress, inputToken, outputToken, inputAmount, outputAmount' 
      });
    }
    
    const swapData: ISwapData = {
      txHash,
      userAddress,
      inputToken,
      outputToken,
      inputAmount,
      outputAmount,
      fee: fee || '0'
    };
    
    const swap = await supabaseService.addSwap(swapData);
    
    res.status(201).json(swap);
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement du swap:', error);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement du swap' });
  }
};

// Enregistrer un dépôt de liquidité
export const registerLiquidityDeposit = async (req: Request, res: Response) => {
  try {
    const { 
      address, 
      tokenAAddress, 
      tokenBAddress, 
      tokenAAmount, 
      tokenBAmount 
    } = req.body;
    
    console.log("Données reçues pour le dépôt:", {
      address, 
      tokenAAddress, 
      tokenBAddress, 
      tokenAAmount, 
      tokenBAmount
    });
    
    if (!address || !tokenAAddress || !tokenBAddress || !tokenAAmount || !tokenBAmount) {
      return res.status(400).json({ 
        error: 'Tous les champs sont requis: address, tokenAAddress, tokenBAddress, tokenAAmount, tokenBAmount' 
      });
    }
    
    // Vérifier que les montants sont des nombres valides
    try {
      if (isNaN(Number(tokenAAmount)) || isNaN(Number(tokenBAmount))) {
        return res.status(400).json({ 
          error: 'Les montants doivent être des nombres valides' 
        });
      }
      
      // Vérifier que les montants sont positifs
      if (Number(tokenAAmount) <= 0 || Number(tokenBAmount) <= 0) {
        return res.status(400).json({ 
          error: 'Les montants doivent être positifs' 
        });
      }
      
      // Nous n'utilisons plus BigInt, donc pas besoin de tester la conversion
    } catch (error) {
      console.error('Erreur lors de la validation des montants:', error);
      return res.status(400).json({ 
        error: 'Format de montant invalide. Assurez-vous d\'utiliser des chaînes numériques valides.' 
      });
    }
    
    const provider = await supabaseService.addLiquidityProvider({
      address,
      tokenAAddress,
      tokenBAddress,
      tokenAAmount,
      tokenBAmount
    });
    
    res.status(201).json(provider);
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement du dépôt de liquidité:', error);
    if (error instanceof Error) {
      res.status(500).json({ error: `Erreur lors de l'enregistrement du dépôt de liquidité: ${error.message}` });
    } else {
      res.status(500).json({ error: 'Erreur lors de l\'enregistrement du dépôt de liquidité' });
    }
  }
};

// Enregistrer un retrait de liquidité
export const registerLiquidityWithdrawal = async (req: Request, res: Response) => {
  try {
    const { 
      address, 
      tokenAAddress, 
      tokenBAddress, 
      tokenAAmount, 
      tokenBAmount 
    } = req.body;
    
    if (!address || !tokenAAddress || !tokenBAddress || !tokenAAmount || !tokenBAmount) {
      return res.status(400).json({ 
        error: 'Tous les champs sont requis: address, tokenAAddress, tokenBAddress, tokenAAmount, tokenBAmount' 
      });
    }
    
    const result = await supabaseService.removeLiquidityProvider(
      address,
      tokenAAddress,
      tokenBAddress,
      tokenAAmount,
      tokenBAmount
    );
    
    res.status(200).json({ 
      success: true, 
      message: 'Retrait de liquidité enregistré avec succès',
      provider: result
    });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement du retrait de liquidité:', error);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement du retrait de liquidité' });
  }
}; 