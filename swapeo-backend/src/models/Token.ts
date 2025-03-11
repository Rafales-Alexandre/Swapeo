import mongoose, { Schema, Document } from 'mongoose';

// Interface pour les données du token sans les propriétés Mongoose
export interface ITokenData {
  address: string;
  symbol: string;
  name: string;
  reserveAmount: string;
}

// Interface pour le document Mongoose complet
export interface IToken extends Document, ITokenData {
  createdAt: Date;
  updatedAt: Date;
}

const TokenSchema: Schema = new Schema(
  {
    address: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true 
    },
    symbol: { 
      type: String, 
      required: true 
    },
    name: { 
      type: String, 
      required: true 
    },
    reserveAmount: { 
      type: String, 
      default: '0' 
    }
  },
  { 
    timestamps: true 
  }
);

export default mongoose.model<IToken>('Token', TokenSchema); 