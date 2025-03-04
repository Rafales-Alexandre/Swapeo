// ignition/modules/SwapeoDEX.ts
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("SwapeoDEX", (m) => {
  // Déployer le MockUniswapRouter
  const mockUniswapRouter = m.contract("MockUniswapRouter");

  // Déployer SwapeoDEX avec l’adresse du MockUniswapRouter
  const swapeoDEX = m.contract("SwapeoDEX", [mockUniswapRouter]);

  // Déployer les tokens ERC20 avec des identifiants uniques
  const tokenA = m.contract("ERC20Mock", ["TokenA", "TKA", 18], { id: "TokenA" });
  const tokenB = m.contract("ERC20Mock", ["TokenB", "TKB", 18], { id: "TokenB" });

  return {
    mockUniswapRouter,
    swapeoDEX,
    tokenA,
    tokenB,
  };
});