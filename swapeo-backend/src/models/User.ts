import mongoose, { Schema, Document } from 'mongoose';

// Interface pour les données de l'utilisateur sans les propriétés Mongoose
export interface IUserData {
  address: string;
  swapCount: number;
  totalVolume: string;
  firstInteraction: Date;
  lastInteraction: Date;
}

// Interface pour le document Mongoose complet
export interface IUser extends Document, IUserData {}

const UserSchema: Schema = new Schema({
  address: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true 
  },
  swapCount: { 
    type: Number, 
    default: 0 
  },
  totalVolume: { 
    type: String, 
    default: '0' 
  },
  firstInteraction: { 
    type: Date, 
    default: Date.now 
  },
  lastInteraction: { 
    type: Date, 
    default: Date.now 
  }
});

export default mongoose.model<IUser>('User', UserSchema); 