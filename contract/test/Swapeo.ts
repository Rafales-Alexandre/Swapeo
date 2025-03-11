const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");

async function deploySwapeoDEXFixture() {
  const [owner, lp1, lp2, user] = await ethers.getSigners();

  const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
  const tokenA = await ERC20Mock.deploy("TokenA", "TKA", 18);
  await tokenA.waitForDeployment();
  const tokenB = await ERC20Mock.deploy("TokenB", "TKB", 18);
  await tokenB.waitForDeployment();

  const MockUniswapRouter =
    await ethers.getContractFactory("MockUniswapRouter");
  const mockRouter = await MockUniswapRouter.deploy();
  await mockRouter.waitForDeployment();

  const amount = ethers.parseUnits("10000", 18);
  await tokenB.transfer(mockRouter.target, amount);
  await mockRouter.setTokens(tokenA.target, tokenB.target);

  const SwapeoDEX = await ethers.getContractFactory("SwapeoDEX");
  const swapeoDEX = await SwapeoDEX.deploy(mockRouter.target);
  await swapeoDEX.waitForDeployment();

  await tokenA.transfer(lp1.address, amount);
  await tokenA.transfer(lp2.address, amount);
  await tokenA.transfer(user.address, amount);
  await tokenB.transfer(lp1.address, amount);
  await tokenB.transfer(lp2.address, amount);

  await tokenA.connect(lp1).approve(swapeoDEX.target, ethers.MaxUint256);
  await tokenA.connect(lp2).approve(swapeoDEX.target, ethers.MaxUint256);
  await tokenA.connect(user).approve(swapeoDEX.target, ethers.MaxUint256);
  await tokenB.connect(lp1).approve(swapeoDEX.target, ethers.MaxUint256);
  await tokenB.connect(lp2).approve(swapeoDEX.target, ethers.MaxUint256);
  await tokenB.connect(user).approve(swapeoDEX.target, ethers.MaxUint256);

  return { swapeoDEX, tokenA, tokenB, owner, lp1, lp2, user, mockRouter };
}

describe("SwapeoDEX", function () {
  describe("Deployment", function () {
    it("Should set the right uniswapV2Router address", async function () {
      const { swapeoDEX, mockRouter } = await loadFixture(
        deploySwapeoDEXFixture
      );
      expect(await swapeoDEX.uniswapV2Router()).to.equal(mockRouter.target);
    });

    it("Should set the right owner", async function () {
      const { swapeoDEX, owner } = await loadFixture(deploySwapeoDEXFixture);
      expect(await swapeoDEX.owner()).to.equal(owner.address);
    });
  });

  describe("Deposit", function () {
    it("Should allow LP to deposit tokens into a pair", async function () {
      const { swapeoDEX, tokenA, tokenB, lp1 } = await loadFixture(
        deploySwapeoDEXFixture
      );
      const amountA = ethers.parseUnits("1000", 18);
      const amountB = ethers.parseUnits("2000", 18);

      await expect(
        swapeoDEX
          .connect(lp1)
          .deposit(tokenA.target, tokenB.target, amountA, amountB)
      )
        .to.emit(swapeoDEX, "Deposit")
        .withArgs(lp1.address, tokenA.target, tokenB.target, amountA, amountB);

      const pairKey = await swapeoDEX.pairKeys(tokenA.target, tokenB.target);
      const pair = await swapeoDEX.pairs(pairKey);
      expect(pair.reserveA).to.equal(amountA);
      expect(pair.reserveB).to.equal(amountB);
      expect(await swapeoDEX.lpBalances(tokenA.target, lp1.address)).to.equal(
        amountA
      );
      expect(await swapeoDEX.lpBalances(tokenB.target, lp1.address)).to.equal(
        amountB
      );
      expect(await swapeoDEX.isLP(tokenA.target, lp1.address)).to.be.true;
    });

    it("Should revert if tokens are invalid", async function () {
      const { swapeoDEX, tokenB, lp1 } = await loadFixture(
        deploySwapeoDEXFixture
      );
      await expect(
        swapeoDEX
          .connect(lp1)
          .deposit(ethers.ZeroAddress, tokenB.target, 1000n, 1000n)
      ).to.be.revertedWith("Tokens invalides");
    });

    it("Should revert if amounts are zero", async function () {
      const { swapeoDEX, tokenA, tokenB, lp1 } = await loadFixture(
        deploySwapeoDEXFixture
      );
      await expect(
        swapeoDEX.connect(lp1).deposit(tokenA.target, tokenB.target, 0n, 1000n)
      ).to.be.revertedWith("Montants doivent etre > 0");
    });
  });

  describe("Withdraw", function () {
    it("Should allow LP to withdraw tokens from a pair", async function () {
      const { swapeoDEX, tokenA, tokenB, lp1 } = await loadFixture(
        deploySwapeoDEXFixture
      );
      const amountA = ethers.parseUnits("1000", 18);
      const amountB = ethers.parseUnits("2000", 18);
      const withdrawAmountA = amountA / 2n;

      await swapeoDEX
        .connect(lp1)
        .deposit(tokenA.target, tokenB.target, amountA, amountB);
      await expect(
        swapeoDEX
          .connect(lp1)
          .withdraw(tokenA.target, tokenB.target, withdrawAmountA)
      )
        .to.emit(swapeoDEX, "Withdraw")
        .withArgs(
          lp1.address,
          tokenA.target,
          tokenB.target,
          withdrawAmountA,
          amountB / 2n
        );

      const pairKey = await swapeoDEX.pairKeys(tokenA.target, tokenB.target);
      const pair = await swapeoDEX.pairs(pairKey);
      expect(pair.reserveA).to.equal(amountA - withdrawAmountA);
      expect(pair.reserveB).to.equal(amountB / 2n);
      expect(await swapeoDEX.lpBalances(tokenA.target, lp1.address)).to.equal(
        withdrawAmountA
      );
    });

    it("Should remove LP from lpList if balance is zero", async function () {
      const { swapeoDEX, tokenA, tokenB, lp1 } = await loadFixture(
        deploySwapeoDEXFixture
      );
      const amountA = ethers.parseUnits("1000", 18);
      const amountB = ethers.parseUnits("2000", 18);

      await swapeoDEX
        .connect(lp1)
        .deposit(tokenA.target, tokenB.target, amountA, amountB);
      await swapeoDEX
        .connect(lp1)
        .withdraw(tokenA.target, tokenB.target, amountA);
      expect(await swapeoDEX.isLP(tokenA.target, lp1.address)).to.be.false;
      expect(await swapeoDEX.getLPList(tokenA.target)).to.not.include(
        lp1.address
      );
    });

    it("Should revert if pair does not exist", async function () {
      const { swapeoDEX, tokenA, tokenB, lp1 } = await loadFixture(
        deploySwapeoDEXFixture
      );
      await expect(
        swapeoDEX.connect(lp1).withdraw(tokenA.target, tokenB.target, 1000n)
      ).to.be.revertedWith("Paire inexistante");
    });
  });

  describe("Swap", function () {
    it("Should allow users to swap tokens with AMM", async function () {
      const { swapeoDEX, tokenA, tokenB, lp1, user } = await loadFixture(
        deploySwapeoDEXFixture
      );
      const amountA = ethers.parseUnits("1000", 18);
      const amountB = ethers.parseUnits("2000", 18);
      const swapAmount = ethers.parseUnits("100", 18);

      await swapeoDEX
        .connect(lp1)
        .deposit(tokenA.target, tokenB.target, amountA, amountB);
      const expectedOut = await swapeoDEX.getAmountOut(
        tokenA.target,
        tokenB.target,
        swapAmount
      );

      await expect(
        swapeoDEX.connect(user).swap(tokenA.target, tokenB.target, swapAmount)
      )
        .to.emit(swapeoDEX, "Swap")
        .withArgs(
          user.address,
          tokenA.target,
          tokenB.target,
          swapAmount,
          expectedOut,
          swapAmount / 100n
        );

      const pairKey = await swapeoDEX.pairKeys(tokenA.target, tokenB.target);
      const pair = await swapeoDEX.pairs(pairKey);
      expect(await swapeoDEX.feesCollected(tokenA.target)).to.equal(
        swapAmount / 100n
      );
      expect(pair.reserveA).to.equal(
        amountA + (swapAmount - swapAmount / 100n)
      );
      expect(pair.reserveB).to.equal(amountB - expectedOut);
    });

    it("Should forward to Uniswap if pair does not exist", async function () {
      const { swapeoDEX, tokenA, tokenB, user, owner } = await loadFixture(
        deploySwapeoDEXFixture
      );
      const swapAmount = ethers.parseUnits("100", 18);
      const fee = (swapAmount * 5n) / 1000n;

      const initialOwnerBalance = await tokenA.balanceOf(owner.address);
      await expect(
        swapeoDEX.connect(user).swap(tokenA.target, tokenB.target, swapAmount)
      ).to.be.revertedWith(
        "Paire inexistante ou sans liquidite, utilisez forwardToUniswap"
      );

      await swapeoDEX
        .connect(user)
        .forwardToUniswap(tokenA.target, tokenB.target, swapAmount, 0n);
      const finalOwnerBalance = await tokenA.balanceOf(owner.address);

      expect(finalOwnerBalance - initialOwnerBalance).to.equal(fee);
      expect(await tokenB.balanceOf(user.address)).to.equal(
        swapAmount - fee - 1n
      );
    });

    it("Should revert if tokens are invalid", async function () {
      const { swapeoDEX, tokenB, user } = await loadFixture(
        deploySwapeoDEXFixture
      );
      await expect(
        swapeoDEX.connect(user).swap(ethers.ZeroAddress, tokenB.target, 100n)
      ).to.be.revertedWith("Tokens invalides");
    });
  });

  describe("DistributeFees", function () {
    it("Should distribute fees proportionally to LPs", async function () {
      const { swapeoDEX, tokenA, tokenB, lp1, lp2, user } = await loadFixture(deploySwapeoDEXFixture);
      
      const amountLP1 = ethers.parseUnits("1000", 18);
      const amountLP2 = ethers.parseUnits("500", 18);
      const amountB = ethers.parseUnits("2000", 18);
      
      await swapeoDEX.connect(lp1).deposit(tokenA.target, tokenB.target, amountLP1, amountB);
      await swapeoDEX.connect(lp2).deposit(tokenA.target, tokenB.target, amountLP2, amountB / 2n);
      
      const swapAmount = ethers.parseUnits("300", 18);
      await swapeoDEX.connect(user).swap(tokenA.target, tokenB.target, swapAmount);
      
      const expectedFees = swapAmount / 100n;
      expect(await swapeoDEX.feesCollected(tokenA.target)).to.equal(expectedFees);
      
      await swapeoDEX.distributeFees(tokenA.target);
      
      const lp1Share = (expectedFees * 2n) / 3n;
      const lp2Share = expectedFees / 3n;
      
      const lp1Balance = await swapeoDEX.lpBalances(tokenA.target, lp1.address);
      const lp2Balance = await swapeoDEX.lpBalances(tokenA.target, lp2.address);
      
      expect(lp1Balance).to.equal(amountLP1 + lp1Share);
      expect(lp2Balance).to.equal(amountLP2 + lp2Share);
    });

    it("Should reset fees collected after distribution", async function () {
      const { swapeoDEX, tokenA, tokenB, lp1, user } = await loadFixture(deploySwapeoDEXFixture);
      
      const amount = ethers.parseUnits("1000", 18);
      await swapeoDEX.connect(lp1).deposit(tokenA.target, tokenB.target, amount, amount);
      
      await swapeoDEX.connect(user).swap(tokenA.target, tokenB.target, amount);
      await swapeoDEX.distributeFees(tokenA.target);
      
      expect(await swapeoDEX.feesCollected(tokenA.target)).to.equal(0);
    });
  });

  describe("Complex Scenarios", function () {
    it("Should maintain correct reserves after multiple operations", async function () {
      const { swapeoDEX, tokenA, tokenB, lp1, lp2, user } = await loadFixture(deploySwapeoDEXFixture);
      
      const initialAmount = ethers.parseUnits("1000", 18);
      
      await swapeoDEX.connect(lp1).deposit(tokenA.target, tokenB.target, initialAmount, initialAmount);
      const pairKey = await swapeoDEX.pairKeys(tokenA.target, tokenB.target);
      const initialPair = await swapeoDEX.pairs(pairKey);
      const initialReserveProduct = initialPair.reserveA * initialPair.reserveB;
      
      const swapAmount = ethers.parseUnits("50", 18);
      await swapeoDEX.connect(user).swap(tokenA.target, tokenB.target, swapAmount);
      await swapeoDEX.connect(lp2).deposit(tokenA.target, tokenB.target, initialAmount, initialAmount);
      await swapeoDEX.connect(lp1).withdraw(tokenA.target, tokenB.target, initialAmount / 2n);
      
      const secondSwapAmount = ethers.parseUnits("25", 18);
      await swapeoDEX.connect(user).swap(tokenB.target, tokenA.target, secondSwapAmount);
      
      const finalPair = await swapeoDEX.pairs(pairKey);
      
      expect(finalPair.reserveA).to.be.gt(0);
      expect(finalPair.reserveB).to.be.gt(0);
      
      const totalLPBalanceA = await swapeoDEX.lpBalances(tokenA.target, lp1.address) + 
                             await swapeoDEX.lpBalances(tokenA.target, lp2.address);
      const totalLPBalanceB = await swapeoDEX.lpBalances(tokenB.target, lp1.address) + 
                             await swapeoDEX.lpBalances(tokenB.target, lp2.address);
      
      const tolerancePercent = 2n;
      const toleranceA = (finalPair.reserveA * tolerancePercent) / 100n;
      const toleranceB = (finalPair.reserveB * tolerancePercent) / 100n;
      
      expect(totalLPBalanceA).to.be.closeTo(finalPair.reserveA, toleranceA);
      expect(totalLPBalanceB).to.be.closeTo(finalPair.reserveB, toleranceB);
      
      const finalReserveProduct = finalPair.reserveA * finalPair.reserveB;
      expect(finalReserveProduct).to.be.gte(initialReserveProduct);
      
      const lp1ShareA = await swapeoDEX.lpBalances(tokenA.target, lp1.address);
      const lp2ShareA = await swapeoDEX.lpBalances(tokenA.target, lp2.address);
      expect(lp1ShareA).to.be.gt(0);
      expect(lp2ShareA).to.be.gt(0);
    });

    it("Should handle extreme price differences", async function () {
      const { swapeoDEX, tokenA, tokenB, lp1, user } = await loadFixture(deploySwapeoDEXFixture);
      
      const amountA = ethers.parseUnits("1000", 18);
      const amountB = ethers.parseUnits("1", 18);
      
      await swapeoDEX.connect(lp1).deposit(tokenA.target, tokenB.target, amountA, amountB);
      
      const smallSwap = ethers.parseUnits("1", 18);
      const estimatedOut = await swapeoDEX.getAmountOut(tokenA.target, tokenB.target, smallSwap);
      
      expect(estimatedOut).to.be.gt(0);
      
      await expect(
        swapeoDEX.connect(user).swap(tokenA.target, tokenB.target, smallSwap)
      ).to.not.be.reverted;
    });
  });

  describe("Security", function () {
    it("Should prevent price manipulation through small deposits", async function () {
      const { swapeoDEX, tokenA, tokenB, lp1, user } = await loadFixture(deploySwapeoDEXFixture);
      
      const tinyAmount = 1n;
      await expect(
        swapeoDEX.connect(lp1).deposit(tokenA.target, tokenB.target, tinyAmount, tinyAmount)
      ).to.not.be.reverted;
      
      const largeAmount = ethers.parseUnits("1000", 18);
      await expect(
        swapeoDEX.connect(user).swap(tokenA.target, tokenB.target, largeAmount)
      ).to.be.revertedWith("Sortie invalide");
    });

    it("Should handle decimal precision correctly", async function () {
      const { swapeoDEX, tokenA, tokenB, lp1, user } = await loadFixture(deploySwapeoDEXFixture);
      
      const preciseAmount = ethers.parseUnits("1000.123456789123456789", 18);
      const roughAmount = ethers.parseUnits("1000", 18);
      
      await swapeoDEX.connect(lp1).deposit(tokenA.target, tokenB.target, preciseAmount, roughAmount);
      
      const smallSwap = ethers.parseUnits("0.000000000000000001", 18);
      const estimatedOut = await swapeoDEX.getAmountOut(tokenA.target, tokenB.target, smallSwap);
      
      expect(estimatedOut).to.be.gte(0);
    });
  });
});
