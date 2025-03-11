import mongoose, { Schema, Document } from 'mongoose';

// Interface pour les données du fournisseur de liquidité sans les propriétés Mongoose
export interface ILiquidityProviderData {
  address: string;
  totalTokenALiquidity: string;
  totalTokenBLiquidity: string;
  tokenAAddress: string;
  tokenBAddress: string;
  feesEarned: string;
  firstDeposit: Date;
  lastDeposit: Date;
}

// Interface pour le document Mongoose complet
export interface ILiquidityProvider extends Document, ILiquidityProviderData {}

const LiquidityProviderSchema: Schema = new Schema({
  address: { 
    type: String, 
    required: true,
    lowercase: true
  },
  tokenAAddress: {
    type: String,
    required: true,
    lowercase: true
  },
  tokenBAddress: {
    type: String,
    required: true,
    lowercase: true
  },
  totalTokenALiquidity: { 
    type: String, 
    default: '0' 
  },
  totalTokenBLiquidity: { 
    type: String, 
    default: '0' 
  },
  feesEarned: { 
    type: String, 
    default: '0' 
  },
  firstDeposit: { 
    type: Date, 
    default: Date.now 
  },
  lastDeposit: { 
    type: Date, 
    default: Date.now 
  }
});

// Index composé pour garantir l'unicité d'un fournisseur pour une paire de tokens
LiquidityProviderSchema.index(
  { address: 1, tokenAAddress: 1, tokenBAddress: 1 }, 
  { unique: true }
);

export default mongoose.model<ILiquidityProvider>('LiquidityProvider', LiquidityProviderSchema); 