const { ethers } = require("hardhat");

async function main() {
  const receiverAddress = "0xcb0214add202a410d1d8c6f8fd2233676adbe9da";
  const tokenAAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const tokenBAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const amountA = ethers.parseEther("1000"); // 1000 TokenA
  const amountB = ethers.parseEther("5000"); // 5000 TokenB

  const [signer] = await ethers.getSigners();
  const tokenA = await ethers.getContractAt("IERC20", tokenAAddress, signer);
  const tokenB = await ethers.getContractAt("IERC20", tokenBAddress, signer);

  await tokenA.transfer(receiverAddress, amountA);
  console.log(`Minted ${ethers.formatEther(amountA)} TokenA to ${receiverAddress}`);
  await tokenB.transfer(receiverAddress, amountB);
  console.log(`Minted ${ethers.formatEther(amountB)} TokenB to ${receiverAddress}`);

  console.log("TokenA balance:", ethers.formatEther(await tokenA.balanceOf(receiverAddress)));
  console.log("TokenB balance:", ethers.formatEther(await tokenB.balanceOf(receiverAddress)));
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});