const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("Swapeo", function () {
  let owner, lp, user;
  let ownerAddress, lpAddress, userAddress;
  let swapeo, tokenA, tokenB, uniswapRouterMock;
  let swapeoAddress, tokenAAddress, tokenBAddress;

  before(async function () {
    [owner, lp, user, ...addrs] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    lpAddress = await lp.getAddress();
    userAddress = await user.getAddress();
  });

  beforeEach(async function () {
    // Déployer les tokens ERC20Mock
    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    tokenA = await ERC20Mock.deploy("Token A", "TKA", ownerAddress, ethers.parseEther("1000000"));
    await tokenA.waitForDeployment();
    tokenAAddress = await tokenA.getAddress();

    tokenB = await ERC20Mock.deploy("Token B", "TKB", ownerAddress, ethers.parseEther("1000000"));
    await tokenB.waitForDeployment();
    tokenBAddress = await tokenB.getAddress();

    // Transférer des tokens aux LP et à l'utilisateur
    await tokenA.transfer(lpAddress, ethers.parseEther("100000"));
    await tokenB.transfer(lpAddress, ethers.parseEther("100000"));
    await tokenA.transfer(userAddress, ethers.parseEther("100000"));
    await tokenB.transfer(userAddress, ethers.parseEther("100000"));

    // Déployer le mock du routeur UniswapV2
    const UniswapV2RouterMock = await ethers.getContractFactory("UniswapV2RouterMock");
    uniswapRouterMock = await UniswapV2RouterMock.deploy();
    await uniswapRouterMock.waitForDeployment();
    const uniswapRouterAddress = await uniswapRouterMock.getAddress();

    // Déployer le contrat Swapeo
    const Swapeo = await ethers.getContractFactory("Swapeo");
    swapeo = await Swapeo.deploy(uniswapRouterAddress);
    await swapeo.waitForDeployment();
    swapeoAddress = await swapeo.getAddress();
  });

  describe("depositLiquidity", function () {
    it("devrait déposer de la liquidité normalement", async function () {
      const depositAmount = ethers.parseEther("1000");
      await tokenA.connect(lp).approve(swapeoAddress, depositAmount);

      await expect(swapeo.connect(lp).depositLiquidity(tokenAAddress, depositAmount))
        .to.emit(swapeo, "LiquidityDeposited")
        .withArgs(lpAddress, tokenAAddress, depositAmount);

      expect(await swapeo.poolLiquidity(tokenAAddress)).to.equal(depositAmount);
      expect(await swapeo.lpBalances(lpAddress, tokenAAddress)).to.equal(depositAmount);
    });

    it("devrait revert si le montant est zéro", async function () {
      await expect(swapeo.connect(lp).depositLiquidity(tokenAAddress, 0))
        .to.be.revertedWith("Amount must be > 0");
    });
  });

  describe("withdrawLiquidity", function () {
    beforeEach(async function () {
      const depositAmount = ethers.parseEther("1000");
      await tokenA.connect(lp).approve(swapeoAddress, depositAmount);
      await swapeo.connect(lp).depositLiquidity(tokenAAddress, depositAmount);
    });

    it("devrait retirer de la liquidité normalement", async function () {
      const withdrawAmount = ethers.parseEther("500");

      await expect(swapeo.connect(lp).withdrawLiquidity(tokenAAddress, withdrawAmount))
        .to.emit(swapeo, "LiquidityWithdrawn")
        .withArgs(lpAddress, tokenAAddress, withdrawAmount);

      expect(await swapeo.poolLiquidity(tokenAAddress)).to.equal(ethers.parseEther("500"));
      expect(await swapeo.lpBalances(lpAddress, tokenAAddress)).to.equal(ethers.parseEther("500"));
    });

    it("devrait revert si le montant à retirer dépasse la liquidité déposée", async function () {
      const withdrawAmount = ethers.parseEther("1500");
      await expect(swapeo.connect(lp).withdrawLiquidity(tokenAAddress, withdrawAmount))
        .to.be.revertedWith("Insufficient liquidity provided");
    });
  });

  describe("swap", function () {
    describe("Swap interne (liquidité suffisante)", function () {
      beforeEach(async function () {
        await tokenA.connect(lp).approve(swapeoAddress, ethers.parseEther("1000"));
        await tokenB.connect(lp).approve(swapeoAddress, ethers.parseEther("2000"));
        await swapeo.connect(lp).depositLiquidity(tokenAAddress, ethers.parseEther("1000"));
        await swapeo.connect(lp).depositLiquidity(tokenBAddress, ethers.parseEther("2000"));
      });

      it("devrait exécuter un swap interne normalement", async function () {
        const swapAmount = ethers.parseEther("100");
        await tokenA.connect(user).approve(swapeoAddress, swapAmount);

        await expect(swapeo.connect(user).swap(tokenAAddress, tokenBAddress, swapAmount, 1))
          .to.emit(swapeo, "SwapExecuted")
          .withArgs(userAddress, tokenAAddress, tokenBAddress, swapAmount, anyValue, false);
      });

      it("devrait revert si le montant à swapper est zéro", async function () {
        await expect(swapeo.connect(user).swap(tokenAAddress, tokenBAddress, 0, 1))
          .to.be.revertedWith("AmountIn must be > 0");
      });
    });

    describe("Swap forwardé (liquidité interne insuffisante)", function () {
      beforeEach(async function () {
        await tokenA.connect(lp).approve(swapeoAddress, ethers.parseEther("1000"));
        await swapeo.connect(lp).depositLiquidity(tokenAAddress, ethers.parseEther("1000"));
      });

      it("devrait forwarder le swap vers UniswapV2 si la liquidité de tokenB est insuffisante", async function () {
        const swapAmount = ethers.parseEther("100");
        await tokenA.connect(user).approve(swapeoAddress, swapAmount);

        await expect(swapeo.connect(user).swap(tokenAAddress, tokenBAddress, swapAmount, 1))
          .to.emit(swapeo, "SwapExecuted")
          .withArgs(userAddress, tokenAAddress, tokenBAddress, swapAmount, anyValue, true);
      });
    });
  });
});
