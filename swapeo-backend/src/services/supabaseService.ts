import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { ITokenData } from '../models/Token';
import { ISwapData } from '../models/Swap';
import { IUserData } from '../models/User';
import { ILiquidityProviderData } from '../models/LiquidityProvider';

dotenv.config();

// Type de base pour une entité avec ID
type WithId<T> = T & { id: number };

export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Variables d\'environnement SUPABASE_URL et/ou SUPABASE_KEY non définies');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // ====================== Méthodes pour les tokens ======================

  async addToken(tokenData: ITokenData): Promise<WithId<ITokenData>> {
    try {
      // Vérifier si le token existe déjà
      const { data: existingToken } = await this.supabase
        .from('tokens')
        .select('*')
        .eq('address', tokenData.address.toLowerCase())
        .single();

      if (existingToken) {
        // Mettre à jour le token existant
        const { data, error } = await this.supabase
          .from('tokens')
          .update({
            symbol: tokenData.symbol,
            name: tokenData.name,
            reserveamount: tokenData.reserveAmount
          })
          .eq('address', tokenData.address.toLowerCase())
          .select()
          .single();

        if (error) throw error;
        return this.mapTokenFromSupabase(data);
      } else {
        // Insérer un nouveau token
        const { data, error } = await this.supabase
          .from('tokens')
          .insert({
            address: tokenData.address.toLowerCase(),
            symbol: tokenData.symbol,
            name: tokenData.name,
            reserveamount: tokenData.reserveAmount || '0'
          })
          .select()
          .single();

        if (error) throw error;
        return this.mapTokenFromSupabase(data);
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout du token:', error);
      throw error;
    }
  }

  async getTokens(): Promise<WithId<ITokenData>[]> {
    try {
      const { data, error } = await this.supabase
        .from('tokens')
        .select('*');

      if (error) throw error;
      return data.map(this.mapTokenFromSupabase);
    } catch (error) {
      console.error('Erreur lors de la récupération des tokens:', error);
      throw error;
    }
  }

  async updateTokenReserve(address: string, amount: string): Promise<WithId<ITokenData>> {
    try {
      const { data, error } = await this.supabase
        .from('tokens')
        .update({ reserveamount: amount })
        .eq('address', address.toLowerCase())
        .select()
        .single();

      if (error) throw error;
      return this.mapTokenFromSupabase(data);
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la réserve du token:', error);
      throw error;
    }
  }

  // Mapper les champs de supabase vers notre modèle
  private mapTokenFromSupabase(token: any): WithId<ITokenData> {
    return {
      id: token.id,
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      reserveAmount: token.reserveamount
    };
  }

  // ====================== Méthodes pour les swaps ======================

  async addSwap(swapData: ISwapData): Promise<WithId<ISwapData>> {
    try {
      // Vérifier si le swap existe déjà (par txHash)
      const { data: existingSwap } = await this.supabase
        .from('swaps')
        .select('*')
        .eq('txhash', swapData.txHash)
        .single();

      if (existingSwap) {
        console.warn('Transaction déjà enregistrée:', swapData.txHash);
        return this.mapSwapFromSupabase(existingSwap);
      }

      // Insérer le nouveau swap
      const { data, error } = await this.supabase
        .from('swaps')
        .insert({
          txhash: swapData.txHash,
          useraddress: swapData.userAddress.toLowerCase(),
          inputtoken: swapData.inputToken.toLowerCase(),
          outputtoken: swapData.outputToken.toLowerCase(),
          inputamount: swapData.inputAmount,
          outputamount: swapData.outputAmount,
          fee: swapData.fee || '0',
          timestamp: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Mettre à jour ou créer l'utilisateur
      await this.updateUserForSwap(
        swapData.userAddress.toLowerCase(),
        swapData.inputAmount
      );

      return this.mapSwapFromSupabase(data);
    } catch (error) {
      console.error('Erreur lors de l\'ajout du swap:', error);
      throw error;
    }
  }

  async getSwapCount(): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('swaps')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Erreur lors du comptage des swaps:', error);
      throw error;
    }
  }

  // Mapper les champs de supabase vers notre modèle
  private mapSwapFromSupabase(swap: any): WithId<ISwapData> {
    return {
      id: swap.id,
      txHash: swap.txhash,
      userAddress: swap.useraddress,
      inputToken: swap.inputtoken,
      outputToken: swap.outputtoken,
      inputAmount: swap.inputamount,
      outputAmount: swap.outputamount,
      fee: swap.fee
    };
  }

  // ====================== Méthodes pour les utilisateurs ======================

  private async updateUserForSwap(address: string, amount: string): Promise<WithId<IUserData>> {
    try {
      // Vérifier si l'utilisateur existe déjà
      const { data: existingUser } = await this.supabase
        .from('users')
        .select('*')
        .eq('address', address)
        .single();

      if (existingUser) {
        // Mettre à jour l'utilisateur existant
        const newSwapCount = existingUser.swapcount + 1;
        
        // Utiliser Number au lieu de BigInt
        const currentVolume = Number(existingUser.totalvolume);
        const amountValue = Number(amount);
        const newVolume = (currentVolume + amountValue).toString();

        const { data, error } = await this.supabase
          .from('users')
          .update({
            swapcount: newSwapCount,
            totalvolume: newVolume,
            lastinteraction: new Date().toISOString()
          })
          .eq('address', address)
          .select()
          .single();

        if (error) throw error;
        return this.mapUserFromSupabase(data);
      } else {
        // Créer un nouvel utilisateur
        const now = new Date().toISOString();
        const { data, error } = await this.supabase
          .from('users')
          .insert({
            address: address,
            swapcount: 1,
            totalvolume: amount,
            firstinteraction: now,
            lastinteraction: now
          })
          .select()
          .single();

        if (error) throw error;
        return this.mapUserFromSupabase(data);
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
      throw error;
    }
  }

  async getUsers(): Promise<WithId<IUserData>[]> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*');

      if (error) throw error;
      return data.map(this.mapUserFromSupabase);
    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs:', error);
      throw error;
    }
  }

  // Mapper les champs de supabase vers notre modèle
  private mapUserFromSupabase(user: any): WithId<IUserData> {
    return {
      id: user.id,
      address: user.address,
      swapCount: user.swapcount,
      totalVolume: user.totalvolume,
      firstInteraction: new Date(user.firstinteraction),
      lastInteraction: new Date(user.lastinteraction)
    };
  }

  // ====================== Méthodes pour les fournisseurs de liquidité ======================

  async addLiquidityProvider(providerData: {
    address: string;
    tokenAAddress: string;
    tokenBAddress: string;
    tokenAAmount: string;
    tokenBAmount: string;
  }): Promise<WithId<ILiquidityProviderData>> {
    const { address, tokenAAddress, tokenBAddress, tokenAAmount, tokenBAmount } = providerData;
    const lowerAddress = address.toLowerCase();
    const lowerTokenA = tokenAAddress.toLowerCase();
    const lowerTokenB = tokenBAddress.toLowerCase();

    try {
      // Vérifier si le fournisseur existe déjà pour cette paire
      const { data: existingProvider } = await this.supabase
        .from('liquidity_providers')
        .select('*')
        .eq('address', lowerAddress)
        .eq('tokenaaddress', lowerTokenA)
        .eq('tokenbaddress', lowerTokenB)
        .single();

      if (existingProvider) {
        // Mettre à jour le fournisseur existant
        console.log("Montants reçus:", {
          existingA: existingProvider.totaltokenaliquidity,
          existingB: existingProvider.totaltokenbliquidity,
          newA: tokenAAmount,
          newB: tokenBAmount
        });
        
        try {
          // Utiliser Number au lieu de BigInt pour gérer les décimaux
          const existingTokenALiquidity = Number(existingProvider.totaltokenaliquidity);
          const existingTokenBLiquidity = Number(existingProvider.totaltokenbliquidity);
          const newTokenAAmount = Number(tokenAAmount);
          const newTokenBAmount = Number(tokenBAmount);

          // Calculer les nouveaux montants et les convertir en chaînes
          const newTokenALiquidity = (existingTokenALiquidity + newTokenAAmount).toString();
          const newTokenBLiquidity = (existingTokenBLiquidity + newTokenBAmount).toString();

          const { data, error } = await this.supabase
            .from('liquidity_providers')
            .update({
              totaltokenaliquidity: newTokenALiquidity,
              totaltokenbliquidity: newTokenBLiquidity,
              lastdeposit: new Date().toISOString()
            })
            .eq('id', existingProvider.id)
            .select()
            .single();

          if (error) throw error;
          return this.mapLiquidityProviderFromSupabase(data);
        } catch (error) {
          console.error('Erreur lors de la mise à jour du fournisseur de liquidité:', error);
          throw error;
        }
      } else {
        // Créer un nouveau fournisseur de liquidité
        const now = new Date().toISOString();
        const { data, error } = await this.supabase
          .from('liquidity_providers')
          .insert({
            address: lowerAddress,
            tokenaaddress: lowerTokenA,
            tokenbaddress: lowerTokenB,
            totaltokenaliquidity: tokenAAmount,
            totaltokenbliquidity: tokenBAmount,
            feesearned: '0',
            firstdeposit: now,
            lastdeposit: now
          })
          .select()
          .single();

        if (error) throw error;
        return this.mapLiquidityProviderFromSupabase(data);
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout du fournisseur de liquidité:', error);
      throw error;
    }
  }

  async getLiquidityProviders(): Promise<WithId<ILiquidityProviderData>[]> {
    try {
      const { data, error } = await this.supabase
        .from('liquidity_providers')
        .select('*');

      if (error) throw error;
      return data.map(this.mapLiquidityProviderFromSupabase);
    } catch (error) {
      console.error('Erreur lors de la récupération des fournisseurs de liquidité:', error);
      throw error;
    }
  }

  async removeLiquidityProvider(
    address: string,
    tokenAAddress: string,
    tokenBAddress: string,
    tokenAAmount: string,
    tokenBAmount: string
  ): Promise<WithId<ILiquidityProviderData> | null> {
    const lowerAddress = address.toLowerCase();
    const lowerTokenA = tokenAAddress.toLowerCase();
    const lowerTokenB = tokenBAddress.toLowerCase();

    try {
      // Vérifier si le fournisseur existe
      const { data: existingProvider } = await this.supabase
        .from('liquidity_providers')
        .select('*')
        .eq('address', lowerAddress)
        .eq('tokenaaddress', lowerTokenA)
        .eq('tokenbaddress', lowerTokenB)
        .single();

      if (!existingProvider) {
        console.warn('Fournisseur de liquidité non trouvé');
        return null;
      }

      // Calculer les nouveaux montants avec Number au lieu de BigInt
      const existingTokenALiquidity = Number(existingProvider.totaltokenaliquidity);
      const existingTokenBLiquidity = Number(existingProvider.totaltokenbliquidity);
      const withdrawTokenAAmount = Number(tokenAAmount);
      const withdrawTokenBAmount = Number(tokenBAmount);

      const newTokenALiquidity = existingTokenALiquidity - withdrawTokenAAmount;
      const newTokenBLiquidity = existingTokenBLiquidity - withdrawTokenBAmount;

      // Vérifier si les montants sont valides
      if (newTokenALiquidity < 0 || newTokenBLiquidity < 0) {
        throw new Error('Liquidité insuffisante pour le retrait');
      }

      // Si la liquidité est réduite à zéro, supprimer l'enregistrement
      if (newTokenALiquidity === 0 && newTokenBLiquidity === 0) {
        const { error } = await this.supabase
          .from('liquidity_providers')
          .delete()
          .eq('id', existingProvider.id);

        if (error) throw error;
        return null;
      }

      // Sinon, mettre à jour les montants
      const { data, error } = await this.supabase
        .from('liquidity_providers')
        .update({
          totaltokenaliquidity: newTokenALiquidity.toString(),
          totaltokenbliquidity: newTokenBLiquidity.toString()
        })
        .eq('id', existingProvider.id)
        .select()
        .single();

      if (error) throw error;
      return this.mapLiquidityProviderFromSupabase(data);
    } catch (error) {
      console.error('Erreur lors du retrait de liquidité:', error);
      throw error;
    }
  }

  // Mapper les champs de supabase vers notre modèle
  private mapLiquidityProviderFromSupabase(provider: any): WithId<ILiquidityProviderData> {
    return {
      id: provider.id,
      address: provider.address,
      tokenAAddress: provider.tokenaaddress,
      tokenBAddress: provider.tokenbaddress,
      totalTokenALiquidity: provider.totaltokenaliquidity,
      totalTokenBLiquidity: provider.totaltokenbliquidity,
      feesEarned: provider.feesearned,
      firstDeposit: new Date(provider.firstdeposit),
      lastDeposit: new Date(provider.lastdeposit)
    };
  }
} 