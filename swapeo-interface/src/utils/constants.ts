export const CONTRACT_ADDRESS: string = "0xb09ECEF8DDeb626b9E37C6bD7f047C4782975fB8";

export const API_BASE_URL = "http://localhost:3001/api";

export const TOKENS = {
  TOKEN_A: "0x5B4af503D9999a18Bf0d7Fc120b25eCAb51705e2",
  TOKEN_B: "0xED62D69D3c1e661136A8dA5D313C962639c97C09",
  TOKEN_A_OLD: "0x63404C358a26F640CF6FBfEadef0170F65289102",
  TOKEN_B_OLD: "0xdb655C51ccD702e14C598a2c8689B7c6c83f9F8a"
} as const;

export const TOKEN_OPTIONS = [
  { address: TOKENS.TOKEN_A, label: "TokenA" },
  { address: TOKENS.TOKEN_B, label: "TokenB" },
  { address: TOKENS.TOKEN_A_OLD, label: "TokenA (Old)" },
  { address: TOKENS.TOKEN_B_OLD, label: "TokenB (Old)" }
] as const;

export const TRANSACTION_STATUS = {
  IDLE: "idle",
  PENDING: "pending",
  SUCCESS: "success",
  ERROR: "error"
} as const;

export const ERROR_MESSAGES = {
  INVALID_AMOUNT: "Veuillez entrer un montant valide",
  SAME_TOKENS: "Impossible d'échanger le même token",
  INSUFFICIENT_BALANCE: "Solde insuffisant",
  FILL_ALL_FIELDS: "Veuillez remplir tous les champs avec des montants valides",
  NO_LIQUIDITY: "Aucune liquidité disponible pour cette paire"
} as const;
