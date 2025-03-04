export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const validateAmount = (amount: string): ValidationResult => {
  if (!amount || amount.trim() === "") {
    return { isValid: false, error: "Amount is required" };
  }

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return { isValid: false, error: "Amount must be a positive number" };
  }

  // Check for more than 18 decimal places (standard ERC20 limitation)
  const decimals = amount.includes(".") ? amount.split(".")[1].length : 0;
  if (decimals > 18) {
    return { isValid: false, error: "Amount cannot have more than 18 decimal places" };
  }

  return { isValid: true };
};

export const validateTokenPair = (tokenA: string, tokenB: string): ValidationResult => {
  if (!tokenA || !tokenB) {
    return { isValid: false, error: "Both tokens must be selected" };
  }

  if (tokenA === tokenB) {
    return { isValid: false, error: "Cannot select the same token" };
  }

  return { isValid: true };
}; 