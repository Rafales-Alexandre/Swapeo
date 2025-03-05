export const CONTRACT_ADDRESS: string = "0xb09ECEF8DDeb626b9E37C6bD7f047C4782975fB8";

export const API_BASE_URL = "http://localhost:3001/api";

export const TOKENS = {
  TOKEN_A: "0x5B4af503D9999a18Bf0d7Fc120b25eCAb51705e2",
  TOKEN_B: "0xED62D69D3c1e661136A8dA5D313C962639c97C09"
} as const;

export const TOKEN_OPTIONS = [
  { address: TOKENS.TOKEN_A, label: "TokenA" },
  { address: TOKENS.TOKEN_B, label: "TokenB" }
] as const;

export const TRANSACTION_STATUS = {
  IDLE: "idle",
  PENDING: "pending",
  SUCCESS: "success",
  ERROR: "error"
} as const;

export const ERROR_MESSAGES = {
  INVALID_AMOUNT: "Please enter a valid amount",
  SAME_TOKENS: "Cannot swap the same token",
  INSUFFICIENT_BALANCE: "Insufficient balance",
  FILL_ALL_FIELDS: "Please fill all fields with valid amounts",
  NO_LIQUIDITY: "No liquidity available for this pair"
} as const;
