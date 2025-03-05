import { ethers } from "hardhat";

async function main() {
  console.log("Déploiement des tokens ERC20...");

  const [deployer] = await ethers.getSigners();
  console.log("Déploiement avec l'adresse:", deployer.address);

  const decimals = 18; // Nombre de décimales pour les tokens
  const initialSupply = ethers.parseEther("1000000"); // 1 million de tokens avec 18 décimales

  // Déploiement de TokenA
  const TokenA = await ethers.getContractFactory("ERC20Mock");
  const tokenA = await TokenA.deploy("TokenA", "TKA", decimals);
  await tokenA.waitForDeployment();
  const tokenAAddress = await tokenA.getAddress();
  console.log("TokenA déployé à l'adresse:", tokenAAddress);

  // Déploiement de TokenB
  const TokenB = await ethers.getContractFactory("ERC20Mock");
  const tokenB = await TokenB.deploy("TokenB", "TKB", decimals);
  await tokenB.waitForDeployment();
  const tokenBAddress = await tokenB.getAddress();
  console.log("TokenB déployé à l'adresse:", tokenBAddress);

  console.log("\nRécapitulatif des déploiements :");
  console.log("--------------------------------");
  console.log("TokenA (TKA):", tokenAAddress);
  console.log("TokenB (TKB):", tokenBAddress);
  console.log("Supply de chaque token:", ethers.formatEther(initialSupply), "tokens");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 