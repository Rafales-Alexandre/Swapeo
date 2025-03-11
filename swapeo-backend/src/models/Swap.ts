import mongoose, { Schema, Document } from 'mongoose';

// Interface pour les données du swap sans les propriétés Mongoose
export interface ISwapData {
  txHash: string;
  userAddress: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string;
  fee: string;
}

// Interface pour le document Mongoose complet
export interface ISwap extends Document, ISwapData {
  timestamp: Date;
}

const SwapSchema: Schema = new Schema({
  txHash: { 
    type: String, 
    required: true, 
    unique: true 
  },
  userAddress: { 
    type: String, 
    required: true, 
    lowercase: true 
  },
  inputToken: { 
    type: String, 
    required: true, 
    lowercase: true 
  },
  outputToken: { 
    type: String, 
    required: true, 
    lowercase: true 
  },
  inputAmount: { 
    type: String, 
    required: true 
  },
  outputAmount: { 
    type: String, 
    required: true 
  },
  fee: { 
    type: String, 
    required: true 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  }
});

export default mongoose.model<ISwap>('Swap', SwapSchema); 