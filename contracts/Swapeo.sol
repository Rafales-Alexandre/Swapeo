// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract Swapeo is ReentrancyGuard {
    address public owner;
    IUniswapV2Router public uniswapRouter;
    uint256 public dexFeeBP = 30;
    uint256 public forwardFeeBP = 50;
    mapping(address => uint256) public poolLiquidity;
    mapping(address => mapping(address => uint256)) public lpBalances;
    uint256 public swapCount;
    event LiquidityDeposited(address indexed provider, address indexed token, uint256 amount);
    event LiquidityWithdrawn(address indexed provider, address indexed token, uint256 amount);
    event SwapExecuted(address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, bool forwarded);

    constructor(address _uniswapRouter) {
        owner = msg.sender;
        uniswapRouter = IUniswapV2Router(_uniswapRouter);
    }

    function depositLiquidity(address token, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        poolLiquidity[token] += amount;
        lpBalances[msg.sender][token] += amount;
        emit LiquidityDeposited(msg.sender, token, amount);
    }

    function withdrawLiquidity(address token, uint256 amount) external nonReentrant {
        require(lpBalances[msg.sender][token] >= amount, "Insufficient liquidity provided");
        poolLiquidity[token] -= amount;
        lpBalances[msg.sender][token] -= amount;
        require(IERC20(token).transfer(msg.sender, amount), "Transfer failed");
        emit LiquidityWithdrawn(msg.sender, token, amount);
    }

    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut) external nonReentrant {
        require(amountIn > 0, "AmountIn must be > 0");
        require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), "Transfer failed");
        uint256 amountOut;
        bool forwarded = false;
        if (poolLiquidity[tokenOut] >= minAmountOut) {
            amountOut = _getAmountOut(amountIn, poolLiquidity[tokenIn], poolLiquidity[tokenOut], dexFeeBP);
            poolLiquidity[tokenIn] += amountIn;
            poolLiquidity[tokenOut] -= amountOut;
        } else {
            IERC20(tokenIn).approve(address(uniswapRouter), amountIn);
            address[] memory path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;
            uint256 fee = (amountIn * forwardFeeBP) / 10000;
            uint256 amountInForSwap = amountIn - fee;
            require(IERC20(tokenIn).transfer(owner, fee), "Fee transfer failed");
            uint256 deadline = block.timestamp + 300;
            uint[] memory amounts = uniswapRouter.swapExactTokensForTokens(amountInForSwap, minAmountOut, path, msg.sender, deadline);
            amountOut = amounts[amounts.length - 1];
            forwarded = true;
        }
        swapCount++;
        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, forwarded);
    }

    function _getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut, uint256 feeBP) internal pure returns (uint256) {
        uint256 amountInWithFee = amountIn * (10000 - feeBP);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 10000) + amountInWithFee;
        return numerator / denominator;
    }
}
