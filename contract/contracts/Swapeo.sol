// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

contract SwapeoDEX is ReentrancyGuard, Ownable {
    uint public swapFee = 3;
    uint public constant FEE_DENOMINATOR = 1000;

    uint constant ADDITIONAL_FEE_NUMERATOR = 5;
    uint constant ADDITIONAL_FEE_DENOMINATOR = 1000;

    uint public constant MINIMUM_LIQUIDITY = 10**3;

    struct Pair {
        address tokenA;
        address tokenB;
        uint112 reserveA;
        uint112 reserveB;
        uint32 blockTimestampLast;
        uint price0CumulativeLast;
        uint price1CumulativeLast;
        uint totalLiquidity;
    }

    mapping(bytes32 => Pair) public pairs;
    mapping(address => mapping(address => bytes32)) public pairKeys;
    mapping(bytes32 => mapping(address => uint256)) public lpBalances;
    mapping(bytes32 => address[]) public lpProviders;
    mapping(bytes32 => mapping(address => bool)) public isLPProvider;
    mapping(bytes32 => uint256) public feesCollected;

    IUniswapV2Router02 public uniswapV2Router;

  constructor(address _uniswapV2Router) Ownable(msg.sender) {
    require(_uniswapV2Router != address(0), "Invalid router");
    uniswapV2Router = IUniswapV2Router02(_uniswapV2Router);
}

    event Deposit(address indexed provider, address indexed tokenA, address indexed tokenB, uint256 amountA, uint256 amountB, uint256 liquidity);
    event Withdraw(address indexed provider, address indexed tokenA, address indexed tokenB, uint256 amountA, uint256 amountB, uint256 liquidity);
    event Swap(address indexed user, address indexed inputToken, address indexed outputToken, uint256 inputAmount, uint256 outputAmount, uint256 fee);
    event Sync(address indexed tokenA, address indexed tokenB, uint112 reserveA, uint112 reserveB);
    event FeesDistributed(bytes32 indexed pairKey, uint256 totalFees);
    event ForwardedToUniswap(address indexed inputToken, address indexed outputToken, uint256 amountIn, uint256 amountOut, uint256 additionalFee);


    function _getPairKey(address tokenA, address tokenB) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(tokenA < tokenB ? tokenA : tokenB, tokenA < tokenB ? tokenB : tokenA));
    }

    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    function _update(bytes32 pairKey, uint112 reserveA, uint112 reserveB) private {
        uint32 blockTimestamp = uint32(block.timestamp % 2**32);
        Pair storage pair = pairs[pairKey];
        uint32 timeElapsed = blockTimestamp - pair.blockTimestampLast;

        if (timeElapsed > 0 && reserveA != 0 && reserveB != 0) {
            pair.price0CumulativeLast += (uint(reserveB) * 2**112 / uint(reserveA)) * timeElapsed;
            pair.price1CumulativeLast += (uint(reserveA) * 2**112 / uint(reserveB)) * timeElapsed;
        }

        pair.reserveA = reserveA;
        pair.reserveB = reserveB;
        pair.blockTimestampLast = blockTimestamp;

        emit Sync(pair.tokenA, pair.tokenB, reserveA, reserveB);
    }

    function deposit(address tokenA, address tokenB, uint256 amountA, uint256 amountB) external nonReentrant {
        require(tokenA != address(0) && tokenB != address(0), "Invalid tokens");
        require(tokenA != tokenB, "Identical addresses");
        require(amountA > 0 && amountB > 0, "Invalid amounts");
        require(IERC20(tokenA).allowance(msg.sender, address(this)) >= amountA, "Insufficient allowance");
        require(IERC20(tokenB).allowance(msg.sender, address(this)) >= amountB, "Insufficient allowance");

        if (tokenA > tokenB) {
            (tokenA, tokenB) = (tokenB, tokenA);
            (amountA, amountB) = (amountB, amountA);
        }

        bytes32 pairKey = _getPairKey(tokenA, tokenB);
        Pair storage pair = pairs[pairKey];

        uint256 liquidity;

        if (pair.tokenA == address(0)) {
            pair.tokenA = tokenA;
            pair.tokenB = tokenB;
            pairKeys[tokenA][tokenB] = pairKey;
            pairKeys[tokenB][tokenA] = pairKey;

            liquidity = sqrt(amountA * amountB) - MINIMUM_LIQUIDITY;
        } else {
            require(pair.reserveA > 0 && pair.reserveB > 0, "Zero reserves");
            uint256 liquidityA = amountA * pair.totalLiquidity / pair.reserveA;
            uint256 liquidityB = amountB * pair.totalLiquidity / pair.reserveB;
            liquidity = liquidityA < liquidityB ? liquidityA : liquidityB;

            require(amountA * pair.reserveB == amountB * pair.reserveA, "Invalid ratio");
        }

        require(liquidity > 0, "Insufficient liquidity");

        IERC20(tokenA).transferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).transferFrom(msg.sender, address(this), amountB);

        _update(pairKey, uint112(pair.reserveA + amountA), uint112(pair.reserveB + amountB));

        pair.totalLiquidity += liquidity;
        lpBalances[pairKey][msg.sender] += liquidity;

        if (!isLPProvider[pairKey][msg.sender]) {
            isLPProvider[pairKey][msg.sender] = true;
            lpProviders[pairKey].push(msg.sender);
        }

        emit Deposit(msg.sender, tokenA, tokenB, amountA, amountB, liquidity);
    }

    function withdraw(address tokenA, address tokenB, uint256 liquidity) external nonReentrant {
        require(tokenA != address(0) && tokenB != address(0), "Invalid tokens");
        require(tokenA != tokenB, "Identical addresses");

        require(liquidity > 0, "Invalid amount");

      (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);


        bytes32 pairKey = _getPairKey(token0, token1);
        Pair storage pair = pairs[pairKey];
        require(pair.tokenA != address(0), "Pair not exists");
        require(lpBalances[pairKey][msg.sender] >= liquidity, "Insufficient LP balance");

        uint256 totalSupply = pair.totalLiquidity;
        uint256 amount0 = liquidity * pair.reserveA / totalSupply;
        uint256 amount1 = liquidity * pair.reserveB / totalSupply;

        require(amount0 > 0 && amount1 > 0, "Invalid amounts");

        lpBalances[pairKey][msg.sender] -= liquidity;
        pair.totalLiquidity -= liquidity;

        _update(pairKey, uint112(pair.reserveA - amount0), uint112(pair.reserveB - amount1));

        IERC20(pair.tokenA).transfer(msg.sender, amount0);
        IERC20(pair.tokenB).transfer(msg.sender, amount1);

        if (lpBalances[pairKey][msg.sender] == 0) {
            isLPProvider[pairKey][msg.sender] = false;
        }
         (uint256 amountA, uint256 amountB) = tokenA == pair.tokenA ? (amount0, amount1) : (amount1, amount0);

        emit Withdraw(msg.sender, tokenA, tokenB, amountA, amountB, liquidity);
    }

function getAmountOut(uint256 amountIn, address inputToken, address outputToken)
    public view returns (uint256)
{
    require(inputToken != address(0) && outputToken != address(0), "Invalid tokens");
    require(inputToken != outputToken, "Identical addresses");
    require(amountIn > 0, "Invalid amount");

    bytes32 pairKey = _getPairKey(inputToken, outputToken);
    Pair storage pair = pairs[pairKey];
    require(pair.tokenA != address(0), "Pair not exists");

    bool isTokenA = pair.tokenA == inputToken;
    uint256 reserveIn = isTokenA ? pair.reserveA : pair.reserveB;
    uint256 reserveOut = isTokenA ? pair.reserveB : pair.reserveA;

    require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");

    uint256 amountInWithFee = amountIn * (FEE_DENOMINATOR - swapFee);
    uint256 numerator = amountInWithFee * reserveOut;
    uint256 denominator = reserveIn * FEE_DENOMINATOR + amountInWithFee;
    uint256 amountOut = numerator / denominator;

    require(amountOut <= reserveOut, "Insufficient liquidity");

    return amountOut;
}

    function swap(address inputToken, address outputToken, uint256 amountIn, uint256 minAmountOut) external nonReentrant returns (uint256) {
        require(inputToken != address(0) && outputToken != address(0), "Invalid tokens");
        require(amountIn > 0, "Invalid amount");
        require(IERC20(inputToken).allowance(msg.sender, address(this)) >= amountIn, "Insufficient allowance");

        bytes32 pairKey = _getPairKey(inputToken, outputToken);
        Pair storage pair = pairs[pairKey];

        if (pair.tokenA == address(0) || pair.reserveA == 0 || pair.reserveB == 0) {
            revert("Use forwardToUniswap");
        }

        bool isTokenA = pair.tokenA == inputToken;
        uint256 reserveIn = isTokenA ? pair.reserveA : pair.reserveB;
        uint256 reserveOut = isTokenA ? pair.reserveB : pair.reserveA;

        uint256 amountOut = getAmountOut(amountIn, inputToken, outputToken);
        require(amountOut > 0 && amountOut <= reserveOut, "Invalid output");
        require(amountOut >= minAmountOut, "High slippage");

        uint256 feeAmount = amountIn * swapFee / FEE_DENOMINATOR;
        uint256 amountInMinusFee = amountIn - feeAmount;

        IERC20(inputToken).transferFrom(msg.sender, address(this), amountIn);
        IERC20(outputToken).transfer(msg.sender, amountOut);

        if (isTokenA) {
            _update(pairKey, uint112(pair.reserveA + amountInMinusFee), uint112(pair.reserveB - amountOut));
        } else {
            _update(pairKey, uint112(pair.reserveA - amountOut), uint112(pair.reserveB + amountInMinusFee));
        }

        feesCollected[pairKey] += feeAmount;

        emit Swap(msg.sender, inputToken, outputToken, amountIn, amountOut, feeAmount);
        return amountOut;
    }

    function distributeFees(address tokenA, address tokenB) external nonReentrant onlyOwner {
        if (tokenA > tokenB) {
            (tokenA, tokenB) = (tokenB, tokenA);
        }

        bytes32 pairKey = _getPairKey(tokenA, tokenB);
        Pair storage pair = pairs[pairKey];
        require(pair.tokenA != address(0), "Pair not exists");

        uint256 totalFees = feesCollected[pairKey];
        require(totalFees > 0, "No fees");
        require(pair.totalLiquidity > MINIMUM_LIQUIDITY, "No liquidity");

        feesCollected[pairKey] = 0;

        uint256 feesA = totalFees / 2;
        uint256 feesB = totalFees - feesA;

        _update(pairKey, uint112(pair.reserveA + feesA), uint112(pair.reserveB + feesB));

        emit FeesDistributed(pairKey, totalFees);
    }

    function forwardToUniswap(address inputToken, address outputToken, uint256 amount, uint256 minAmountOut)
        external nonReentrant returns (uint256)
    {
        require(inputToken != address(0) && outputToken != address(0), "Invalid tokens");
        require(amount > 0, "Invalid amount");
        require(IERC20(inputToken).allowance(msg.sender, address(this)) >= amount, "Insufficient allowance");

        IERC20(inputToken).transferFrom(msg.sender, address(this), amount);

        uint256 additionalFee = amount * ADDITIONAL_FEE_NUMERATOR / ADDITIONAL_FEE_DENOMINATOR;
        uint256 netAmount = amount - additionalFee;

        IERC20(inputToken).transfer(owner(), additionalFee);
        IERC20(inputToken).approve(address(uniswapV2Router), netAmount);

        address[] memory path = new address[](2);
        path[0] = inputToken;
        path[1] = outputToken;
        uint256[] memory amounts = uniswapV2Router.swapExactTokensForTokens(
            netAmount,
            minAmountOut,
            path,
            msg.sender,
            block.timestamp
        );

        IERC20(inputToken).approve(address(uniswapV2Router), 0);
        emit ForwardedToUniswap(inputToken, outputToken, netAmount, amounts[amounts.length - 1], additionalFee);
        return amounts[amounts.length - 1];
    }

    function getReserves(address tokenA, address tokenB) public view returns (uint112 reserveA, uint112 reserveB, uint32 blockTimestampLast) {
        bytes32 pairKey = _getPairKey(tokenA, tokenB);
        Pair storage pair = pairs[pairKey];
        return (pair.reserveA, pair.reserveB, pair.blockTimestampLast);
    }

    function getPairInfo(address tokenA, address tokenB) external view returns (
        address _tokenA,
        address _tokenB,
        uint112 _reserveA,
        uint112 _reserveB,
        uint256 _totalLiquidity,
        uint256 _feesCollected
    ) {
        bytes32 pairKey = _getPairKey(tokenA, tokenB);
        Pair storage pair = pairs[pairKey];
        return (
            pair.tokenA,
            pair.tokenB,
            pair.reserveA,
            pair.reserveB,
            pair.totalLiquidity,
            feesCollected[pairKey]
        );
    }

    function getLPProviders(address tokenA, address tokenB) external view returns (address[] memory activeProviders) {
        bytes32 pairKey = _getPairKey(tokenA, tokenB);
        return lpProviders[pairKey];
    }

    function getLPBalance(address user, address tokenA, address tokenB) external view returns (uint256) {
        bytes32 pairKey = _getPairKey(tokenA, tokenB);
        return lpBalances[pairKey][user];
    }
}

