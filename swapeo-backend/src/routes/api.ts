import express from 'express';
import { getTokens, getSwapCount, getUsers, getLiquidityProviders } from '../controllers/dexController';

const router = express.Router();

// Token routes
router.get('/tokens', getTokens);

// Swap statistics
router.get('/swaps/count', getSwapCount);

// User routes
router.get('/users', getUsers);

// Liquidity provider routes
router.get('/liquidity-providers', getLiquidityProviders);

export default router; 