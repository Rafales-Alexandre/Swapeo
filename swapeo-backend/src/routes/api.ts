import express from 'express';
import { getTokens, getSwapCount, getUsers, getLiquidityProviders, getAllStats } from '../controllers/dexController';
import {
  registerSwap,
  registerLiquidityDeposit,
  registerLiquidityWithdrawal,
  registerToken
} from '../controllers/actionController';

const router = express.Router();

// Token routes
router.get('/tokens', getTokens);

// Swap statistics
router.get('/swaps/count', getSwapCount);

// User routes
router.get('/users', getUsers);

// Liquidity provider routes
router.get('/liquidity-providers', getLiquidityProviders);

// Get all stats
router.get('/stats', getAllStats);

// Routes pour enregistrer les actions
router.post('/register/swap', registerSwap);
router.post('/register/liquidity/deposit', registerLiquidityDeposit);
router.post('/register/liquidity/withdraw', registerLiquidityWithdrawal);
router.post('/register/token', registerToken);

export default router; 