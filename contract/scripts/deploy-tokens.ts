import { ethers } from "hardhat";

async function main() {
  console.log("Déploiement des tokens ERC20...");

  const initialSupply = ethers.parseEther("1000000"); // 1 million de tokens avec 18 décimales

  // Déploiement de TokenA
  const TokenA = await ethers.getContractFactory("ERC20Mock");
  const tokenA = await TokenA.deploy("TokenA", "TKA", initialSupply);
  await tokenA.waitForDeployment();
  console.log("TokenA déployé à l'adresse:", await tokenA.getAddress());

  // Déploiement de TokenB
  const TokenB = await ethers.getContractFactory("ERC20Mock");
  const tokenB = await TokenB.deploy("TokenB", "TKB", initialSupply);
  await tokenB.waitForDeployment();
  console.log("TokenB déployé à l'adresse:", await tokenB.getAddress());

  console.log("Déploiement terminé !");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 