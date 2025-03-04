import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SwapeoDEXModule = buildModule("SwapeoDEXModule", (m) => {
  const uniswapV2RouterAddress = "0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3";

  const swapeoDEX = m.contract("SwapeoDEX", [uniswapV2RouterAddress], { force: true });

  return { swapeoDEX };
});

export default SwapeoDEXModule;