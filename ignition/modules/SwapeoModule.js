const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const SwapeoModule = buildModule("SwapeoModule", (m) => {
  // Déployer d'abord le contrat UniswapV2RouterMock
  const uniswapRouterMock = m.contract("UniswapV2RouterMock");
  
  // Déployer ensuite le contrat Swapeo en lui passant l'adresse du routeur mock
  const swapeo = m.contract("Swapeo", {
    args: [uniswapRouterMock.address],
  });

  // Tu peux retourner ici les contrats déployés pour référence ultérieure si besoin
  return { uniswapRouterMock, swapeo };
});

module.exports = SwapeoModule;
