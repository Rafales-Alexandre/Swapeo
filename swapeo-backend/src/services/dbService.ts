import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TokenModel, { IToken, ITokenData } from '../models/Token';
import SwapModel, { ISwap, ISwapData } from '../models/Swap';
import UserModel, { IUser } from '../models/User';
import LiquidityProviderModel, { ILiquidityProvider } from '../models/LiquidityProvider';

dotenv.config();

export class DBService {
  constructor() {
    this.connect();
  }

  // Connexion à MongoDB
  private async connect() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/swapeo';
    
    try {
      await mongoose.connect(mongoUri);
      console.log('Connecté à MongoDB');
    } catch (error) {
      console.error('Erreur de connexion à MongoDB:', error);
      process.exit(1);
    }
  }

  // Méthodes pour les tokens
  async addToken(tokenData: ITokenData) {
    try {
      // Utiliser findOneAndUpdate avec l'option upsert pour mettre à jour ou créer
      const token = await TokenModel.findOneAndUpdate(
        { address: tokenData.address.toLowerCase() },
        tokenData,
        { 
          upsert: true, 
          new: true,
          setDefaultsOnInsert: true 
        }
      );
      return token;
    } catch (error) {
      console.error('Erreur lors de l\'ajout du token:', error);
      throw error;
    }
  }

  async getTokens() {
    try {
      return await TokenModel.find();
    } catch (error) {
      console.error('Erreur lors de la récupération des tokens:', error);
      throw error;
    }
  }

  async updateTokenReserve(address: string, amount: string) {
    try {
      return await TokenModel.findOneAndUpdate(
        { address: address.toLowerCase() },
        { reserveAmount: amount },
        { new: true }
      );
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la réserve du token:', error);
      throw error;
    }
  }

  // Méthodes pour les swaps
  async addSwap(swapData: ISwapData) {
    try {
      const swapWithLowercase = {
        ...swapData,
        userAddress: swapData.userAddress.toLowerCase(),
        inputToken: swapData.inputToken.toLowerCase(), 
        outputToken: swapData.outputToken.toLowerCase()
      };

      const swap = new SwapModel(swapWithLowercase);
      await swap.save();

      // Mettre à jour ou créer l'utilisateur
      await this.updateUserForSwap(
        swapData.userAddress, 
        swapData.inputAmount
      );

      return swap;
    } catch (error) {
      // Si l'erreur est due à un doublon (même txHash), ignorez-la
      if (error instanceof mongoose.Error.ValidationError) {
        console.warn('Transaction déjà enregistrée:', swapData.txHash);
        return null;
      }
      console.error('Erreur lors de l\'ajout du swap:', error);
      throw error;
    }
  }

  async getSwapCount() {
    try {
      return await SwapModel.countDocuments();
    } catch (error) {
      console.error('Erreur lors du comptage des swaps:', error);
      throw error;
    }
  }

  // Méthodes pour les utilisateurs
  private async updateUserForSwap(address: string, amount: string) {
    const lowerAddress = address.toLowerCase();
    try {
      const user = await UserModel.findOne({ address: lowerAddress });
      
      if (user) {
        // Mettre à jour l'utilisateur existant
        user.swapCount += 1;
        
        // Ajouter le volume (en chaîne de caractères, sans ethers.js)
        const currentVolumeBN = BigInt(user.totalVolume);
        const amountBN = BigInt(amount);
        const newVolume = (currentVolumeBN + amountBN).toString();
        user.totalVolume = newVolume;
        
        user.lastInteraction = new Date();
        await user.save();
      } else {
        // Créer un nouvel utilisateur
        await UserModel.create({
          address: lowerAddress,
          swapCount: 1,
          totalVolume: amount,
          firstInteraction: new Date(),
          lastInteraction: new Date()
        });
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
      throw error;
    }
  }

  async getUsers() {
    try {
      return await UserModel.find();
    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs:', error);
      throw error;
    }
  }

  // Méthodes pour les fournisseurs de liquidité
  async addLiquidityProvider(providerData: {
    address: string;
    tokenAAddress: string;
    tokenBAddress: string;
    tokenAAmount: string;
    tokenBAmount: string;
  }) {
    const { address, tokenAAddress, tokenBAddress, tokenAAmount, tokenBAmount } = providerData;
    const lowerAddress = address.toLowerCase();
    const lowerTokenA = tokenAAddress.toLowerCase(); 
    const lowerTokenB = tokenBAddress.toLowerCase();

    try {
      const provider = await LiquidityProviderModel.findOne({
        address: lowerAddress,
        tokenAAddress: lowerTokenA,
        tokenBAddress: lowerTokenB
      });

      if (provider) {
        // Mettre à jour le fournisseur existant (sans ethers.js)
        const tokenALiquidityBN = BigInt(provider.totalTokenALiquidity);
        const tokenBLiquidityBN = BigInt(provider.totalTokenBLiquidity);
        const tokenAAmountBN = BigInt(tokenAAmount);
        const tokenBAmountBN = BigInt(tokenBAmount);
        
        const newTokenALiquidity = (tokenALiquidityBN + tokenAAmountBN).toString();
        const newTokenBLiquidity = (tokenBLiquidityBN + tokenBAmountBN).toString();
        
        provider.totalTokenALiquidity = newTokenALiquidity;
        provider.totalTokenBLiquidity = newTokenBLiquidity;
        provider.lastDeposit = new Date();
        
        await provider.save();
        return provider;
      } else {
        // Créer un nouveau fournisseur
        const newProvider = await LiquidityProviderModel.create({
          address: lowerAddress,
          tokenAAddress: lowerTokenA,
          tokenBAddress: lowerTokenB,
          totalTokenALiquidity: tokenAAmount,
          totalTokenBLiquidity: tokenBAmount,
          feesEarned: '0',
          firstDeposit: new Date(),
          lastDeposit: new Date()
        });
        
        return newProvider;
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout du fournisseur de liquidité:', error);
      throw error;
    }
  }

  async getLiquidityProviders() {
    try {
      return await LiquidityProviderModel.find();
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
  ) {
    const lowerAddress = address.toLowerCase();
    const lowerTokenA = tokenAAddress.toLowerCase();
    const lowerTokenB = tokenBAddress.toLowerCase();

    try {
      const provider = await LiquidityProviderModel.findOne({
        address: lowerAddress,
        tokenAAddress: lowerTokenA,
        tokenBAddress: lowerTokenB
      });

      if (!provider) {
        console.warn('Fournisseur de liquidité non trouvé');
        return null;
      }

      // Soustraire les montants (sans ethers.js)
      const tokenALiquidityBN = BigInt(provider.totalTokenALiquidity);
      const tokenBLiquidityBN = BigInt(provider.totalTokenBLiquidity);
      const tokenAAmountBN = BigInt(tokenAAmount);
      const tokenBAmountBN = BigInt(tokenBAmount);
      
      const newTokenALiquidity = (tokenALiquidityBN - tokenAAmountBN).toString();
      const newTokenBLiquidity = (tokenBLiquidityBN - tokenBAmountBN).toString();

      // Si l'un des montants devient négatif, c'est une erreur
      if (BigInt(newTokenALiquidity) < BigInt(0) || BigInt(newTokenBLiquidity) < BigInt(0)) {
        throw new Error('Liquidité insuffisante pour le retrait');
      }

      // Si la liquidité est réduite à zéro, supprimer l'enregistrement
      if (newTokenALiquidity === '0' && newTokenBLiquidity === '0') {
        await LiquidityProviderModel.deleteOne({
          address: lowerAddress,
          tokenAAddress: lowerTokenA,
          tokenBAddress: lowerTokenB
        });
        return null;
      }

      // Sinon, mettre à jour les montants
      provider.totalTokenALiquidity = newTokenALiquidity;
      provider.totalTokenBLiquidity = newTokenBLiquidity;
      await provider.save();
      
      return provider;
    } catch (error) {
      console.error('Erreur lors du retrait de liquidité:', error);
      throw error;
    }
  }
} 