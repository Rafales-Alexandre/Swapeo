const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SwapeoDistributeFeesTest", function () {
  let swapeo;
  let tokenA;
  let tokenB;
  let addr1;
  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();

    const MockToken = await ethers.getContractFactory("ERC20Mock");
    tokenA = await MockToken.deploy("Token A", "TKA", 18);
    tokenB = await MockToken.deploy("Token B", "TKB", 18);

    const SwapeoDEX = await ethers.getContractFactory("SwapeoDEX");
    swapeo = await SwapeoDEX.deploy("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");

    await Promise.all([
      tokenA.waitForDeployment(),
      tokenB.waitForDeployment(),
      swapeo.waitForDeployment(),
    ]);

    await tokenA.approve(swapeo.target, ethers.parseEther("100"));
    await tokenB.approve(swapeo.target, ethers.parseEther("100"));

    await swapeo.deposit(tokenA.target, tokenB.target, ethers.parseEther("100"), ethers.parseEther("100"));

    await tokenA.transfer(addr1.address, ethers.parseEther("10"));
    await tokenA.connect(addr1).approve(swapeo.target, ethers.parseEther("10"));

    const amountIn = ethers.parseEther("1");
    const amountOutMin = await swapeo.getAmountOut(amountIn, tokenA.target, tokenB.target);
    await swapeo.connect(addr1).swap(tokenA.target, tokenB.target, amountIn, amountOutMin - amountOutMin / BigInt(100));
  });

  describe("Happy path", function () {
    it("test_distributeFees_succeedsAndUpdatesReserves", async function () {
      const [token0, token1] = tokenA.target.toLowerCase() < tokenB.target.toLowerCase()
        ? [tokenA.target, tokenB.target]
        : [tokenB.target, tokenA.target];

      const pairKey = ethers.keccak256(
        ethers.solidityPacked(["address", "address"], [token0, token1])
      );

      const pairBefore = await swapeo.getPairInfo(tokenA.target, tokenB.target);
      const totalFees = await swapeo.feesCollected(pairKey);
      expect(totalFees).to.be.gt(0);

      await expect(swapeo.distributeFees(tokenA.target, tokenB.target))
        .to.emit(swapeo, "FeesDistributed")
        .withArgs(pairKey, totalFees);

      const pairAfter = await swapeo.getPairInfo(tokenA.target, tokenB.target);

      expect(pairAfter._reserveA).to.be.gt(pairBefore._reserveA);
      expect(pairAfter._reserveB).to.be.gt(pairBefore._reserveB);

      const feesAfter = await swapeo.feesCollected(pairKey);
      expect(feesAfter).to.equal(0);

      const deltaA = pairAfter._reserveA - pairBefore._reserveA;
      const deltaB = pairAfter._reserveB - pairBefore._reserveB;

      const expectedA = totalFees / 2n;
      const expectedB = totalFees - expectedA;

      expect(deltaA).to.equal(expectedA);
      expect(deltaB).to.equal(expectedB);
    });
  });

  describe("Unhappy path", function () {
    it("test_distributeFees_revertsIfNotOwner", async function () {
      await expect(
        swapeo.connect(addr1).distributeFees(tokenA.target, tokenB.target)
      ).to.be.reverted;
    });

    it("test_distributeFees_revertsIfNoFees", async function () {
      const [token0, token1] = tokenA.target.toLowerCase() < tokenB.target.toLowerCase()
        ? [tokenA.target, tokenB.target]
        : [tokenB.target, tokenA.target];

      const pairKey = ethers.keccak256(
        ethers.solidityPacked(["address", "address"], [token0, token1])
      );

      await swapeo.distributeFees(tokenA.target, tokenB.target);

      await expect(
        swapeo.distributeFees(tokenA.target, tokenB.target)
      ).to.be.revertedWith("No fees");
    });

    it("test_distributeFees_revertsIfPairDoesNotExist", async function () {
      const MockToken = await ethers.getContractFactory("ERC20Mock");
      const tokenX = await MockToken.deploy("Token X", "TKX", 18);
      const tokenY = await MockToken.deploy("Token Y", "TKY", 18);
      await tokenX.waitForDeployment();
      await tokenY.waitForDeployment();

      await expect(
        swapeo.distributeFees(tokenX.target, tokenY.target)
      ).to.be.revertedWith("Pair not exists");
    });

    it("test_distributeFees_revertsWithOnlyOwnerError", async function () {
      await expect(
        swapeo.connect(addr1).distributeFees(tokenA.target, tokenB.target)
      ).to.be.revertedWithCustomError(swapeo, "OwnableUnauthorizedAccount");

    });
  });
});
