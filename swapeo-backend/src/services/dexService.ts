import { ethers } from 'ethers';
import dotenv from 'dotenv';
import SwapeoDEX_ABI from '../utils/SwapeoDEX_ABI.json';

dotenv.config();

// ABI minimal pour les fonctions ERC20 dont nous avons besoin
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)"
];

interface Token {
  address: string;
  symbol: string;
  name: string;
}

interface User {
  address: string;
  swapCount: number;
}

interface LiquidityProvider {
  address: string;
  totalLiquidity: string;
}

// Types pour les événements
interface DepositEvent {
  provider: string;
  tokenA: string;
  tokenB: string;
  amountA: bigint;
  amountB: bigint;
}

interface SwapEvent {
  user: string;
  inputToken: string;
  outputToken: string;
  inputAmount: bigint;
  outputAmount: bigint;
  fee: bigint;
}

// Définition du type pour l'ABI
type ContractABI = ethers.InterfaceAbi;

export class DexService {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;

  constructor() {
    const providerUrl = process.env.PROVIDER_URL || 'http://localhost:8545';
    
    // Configuration du provider avec des options spécifiques
    this.provider = new ethers.JsonRpcProvider(providerUrl, {
      chainId: 31337, // Hardhat local network
      name: 'localhost'
    });
    
    const contractAddress = process.env.CONTRACT_ADDRESS || '';
    if (!contractAddress) {
      console.warn('Attention: CONTRACT_ADDRESS non définie dans le fichier .env');
    }

    this.contract = new ethers.Contract(contractAddress, SwapeoDEX_ABI, this.provider);
  }

  private async getTokenInfo(address: string): Promise<{ name: string; symbol: string }> {
    try {
      const tokenContract = new ethers.Contract(address, ERC20_ABI, this.provider);
      const [name, symbol] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol()
      ]);
      return { name, symbol };
    } catch (error) {
      console.warn(`Erreur lors de la récupération des informations du token ${address}:`, error);
      return { name: 'Unknown Token', symbol: 'UNKNOWN' };
    }
  }

  async getAvailableTokens(): Promise<Token[]> {
    try {
      const filter = this.contract.filters.Deposit();
      const events = await this.contract.queryFilter(filter);
      
      const tokenAddresses = new Set<string>();
      events.forEach(event => {
        if (event && 'args' in event) {
          const args = event.args as unknown as DepositEvent;
          tokenAddresses.add(args.tokenA);
          tokenAddresses.add(args.tokenB);
        }
      });

      // Récupération des informations pour chaque token
      const tokens = await Promise.all(
        Array.from(tokenAddresses).map(async (address) => {
          const { name, symbol } = await this.getTokenInfo(address);
          return {
            address,
            symbol,
            name
          };
        })
      );

      return tokens;
    } catch (error) {
      console.error('Erreur lors de la récupération des tokens:', error);
      throw error;
    }
  }

  async getSwapCount(): Promise<number> {
    try {
      // On compte les événements Swap
      const filter = this.contract.filters.Swap();
      const events = await this.contract.queryFilter(filter);
      return events.length;
    } catch (error) {
      console.error('Erreur lors du comptage des swaps:', error);
      throw error;
    }
  }

  async getUsers(): Promise<User[]> {
    try {
      // On récupère tous les événements Swap
      const filter = this.contract.filters.Swap();
      const events = await this.contract.queryFilter(filter);
      
      // On crée un Map pour compter les swaps par utilisateur
      const userSwaps = new Map<string, number>();
      events.forEach(event => {
        if (event && 'args' in event) {
          const args = event.args as unknown as SwapEvent;
          userSwaps.set(args.user, (userSwaps.get(args.user) || 0) + 1);
        }
      });

      // On convertit le Map en tableau d'objets User
      const users: User[] = Array.from(userSwaps.entries()).map(([address, count]) => ({
        address,
        swapCount: count
      }));

      return users;
    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs:', error);
      throw error;
    }
  }

  async getLiquidityProviders(): Promise<LiquidityProvider[]> {
    try {
      // On récupère les événements Deposit
      const filter = this.contract.filters.Deposit();
      const events = await this.contract.queryFilter(filter);
      
      // On crée un Map pour suivre la liquidité totale par fournisseur
      const providerLiquidity = new Map<string, bigint>();
      
      events.forEach(event => {
        if (event && 'args' in event) {
          const args = event.args as unknown as DepositEvent;
          const totalAmount = args.amountA + args.amountB;
          
          providerLiquidity.set(
            args.provider,
            (providerLiquidity.get(args.provider) || BigInt(0)) + totalAmount
          );
        }
      });

      // On convertit le Map en tableau d'objets LiquidityProvider
      const providers: LiquidityProvider[] = Array.from(providerLiquidity.entries())
        .map(([address, amount]) => ({
          address,
          totalLiquidity: amount.toString()
        }));

      return providers;
    } catch (error) {
      console.error('Erreur lors de la récupération des fournisseurs de liquidité:', error);
      throw error;
    }
  }
} 