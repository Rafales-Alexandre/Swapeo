export const CONTRACT_ADDRESS: string = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

export const TOKENS = {
  TOKEN_A: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  TOKEN_B: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
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
