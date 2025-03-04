// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

contract SwapeoDEX is ReentrancyGuard, Ownable {
    uint public swapFee = 1; // Frais de swap en pourcentage (1%)
    uint constant ADDITIONAL_FEE_NUMERATOR = 5; // 0,5% pour Uniswap
    uint constant ADDITIONAL_FEE_DENOMINATOR = 1000;

    // Structure pour les paires AMM
    struct Pair {
        address tokenA;
        address tokenB;
        uint256 reserveA;
        uint256 reserveB;
    }

    mapping(bytes32 => Pair) public pairs; // Stockage des paires par clé unique
    mapping(address => mapping(address => bytes32)) public pairKeys; // Index pour retrouver une paire
    mapping(address => mapping(address => uint256)) public lpBalances; // Balances LP par token et utilisateur
    mapping(address => address[]) public lpList; // Liste des LP par token
    mapping(address => mapping(address => bool)) public isLP; // Indicateur LP
    mapping(address => uint256) public feesCollected; // Frais collectés par token

    IUniswapV2Router02 public uniswapV2Router;

    constructor(address _uniswapV2Router) Ownable(msg.sender) {
        require(_uniswapV2Router != address(0), "Uniswap router invalide");
        uniswapV2Router = IUniswapV2Router02(_uniswapV2Router);
    }

    event Deposit(address indexed provider, address indexed tokenA, address indexed tokenB, uint256 amountA, uint256 amountB);
    event Withdraw(address indexed provider, address indexed tokenA, address indexed tokenB, uint256 amountA, uint256 amountB);
    event Swap(address indexed user, address indexed inputToken, address indexed outputToken, uint256 inputAmount, uint256 outputAmount, uint256 fee);
    event FeesDistributed(address indexed token, uint256 totalFees);
    event ForwardedToUniswap(address indexed inputToken, address indexed outputToken, uint256 amountIn, uint256 amountOut, uint256 additionalFee);

    // Générer une clé unique pour une paire
    function _getPairKey(address tokenA, address tokenB) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(tokenA < tokenB ? tokenA : tokenB, tokenA < tokenB ? tokenB : tokenA));
    }

    // Dépôt de liquidité pour une paire
    function deposit(address tokenA, address tokenB, uint256 amountA, uint256 amountB) external nonReentrant {
        require(tokenA != address(0) && tokenB != address(0), "Tokens invalides");
        require(amountA > 0 && amountB > 0, "Montants doivent etre > 0");
        require(IERC20(tokenA).allowance(msg.sender, address(this)) >= amountA, "Approbation insuffisante tokenA");
        require(IERC20(tokenB).allowance(msg.sender, address(this)) >= amountB, "Approbation insuffisante tokenB");

        bytes32 pairKey = _getPairKey(tokenA, tokenB);
        Pair storage pair = pairs[pairKey];

        if (pair.tokenA == address(0)) {
            pair.tokenA = tokenA < tokenB ? tokenA : tokenB;
            pair.tokenB = tokenA < tokenB ? tokenB : tokenA;
            pairKeys[tokenA][tokenB] = pairKey;
            pairKeys[tokenB][tokenA] = pairKey;
        }

        IERC20(tokenA).transferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).transferFrom(msg.sender, address(this), amountB);

        pair.reserveA += amountA;
        pair.reserveB += amountB;
        lpBalances[tokenA][msg.sender] += amountA;
        lpBalances[tokenB][msg.sender] += amountB;

        if (!isLP[tokenA][msg.sender]) {
            isLP[tokenA][msg.sender] = true;
            lpList[tokenA].push(msg.sender);
        }
        if (!isLP[tokenB][msg.sender]) {
            isLP[tokenB][msg.sender] = true;
            lpList[tokenB].push(msg.sender);
        }

        emit Deposit(msg.sender, tokenA, tokenB, amountA, amountB);
    }

    // Retrait de liquidité d’une paire
    function withdraw(address tokenA, address tokenB, uint256 amountARequested) external nonReentrant {
        require(tokenA != address(0) && tokenB != address(0), "Tokens invalides");
        require(amountARequested > 0, "Montant doit etre > 0");

        bytes32 pairKey = pairKeys[tokenA][tokenB];
        Pair storage pair = pairs[pairKey];
        require(pair.tokenA != address(0), "Paire inexistante");

        bool isTokenA = pair.tokenA == tokenA;
        uint256 reserveA = isTokenA ? pair.reserveA : pair.reserveB;
        uint256 reserveB = isTokenA ? pair.reserveB : pair.reserveA;

        uint256 userBalanceA = lpBalances[tokenA][msg.sender];
        require(userBalanceA >= amountARequested, "Solde LP insuffisant");

        uint256 amountBRequested = (amountARequested * reserveB) / reserveA;
        require(lpBalances[tokenB][msg.sender] >= amountBRequested, "Solde LP insuffisant pour tokenB");

        lpBalances[tokenA][msg.sender] -= amountARequested;
        lpBalances[tokenB][msg.sender] -= amountBRequested;
        pair.reserveA -= amountARequested;
        pair.reserveB -= amountBRequested;

        // Nettoyage de lpList si solde nul
        if (lpBalances[tokenA][msg.sender] == 0) {
            _removeLP(tokenA, msg.sender);
        }
        if (lpBalances[tokenB][msg.sender] == 0) {
            _removeLP(tokenB, msg.sender);
        }

        IERC20(tokenA).transfer(msg.sender, amountARequested);
        IERC20(tokenB).transfer(msg.sender, amountBRequested);

        emit Withdraw(msg.sender, tokenA, tokenB, amountARequested, amountBRequested);
    }

    // Helper pour supprimer un LP de lpList
    function _removeLP(address token, address lp) internal {
        address[] storage lps = lpList[token];
        for (uint256 i = 0; i < lps.length; i++) {
            if (lps[i] == lp) {
                lps[i] = lps[lps.length - 1];
                lps.pop();
                isLP[token][lp] = false;
                break;
            }
        }
    }

    // Estimation du montant de sortie
    function getAmountOut(address inputToken, address outputToken, uint256 amountIn) external view returns (uint256) {
        bytes32 pairKey = pairKeys[inputToken][outputToken];
        Pair storage pair = pairs[pairKey];
        if (pair.tokenA == address(0)) return 0; // Paire inexistante

        bool isTokenA = pair.tokenA == inputToken;
        uint256 reserveIn = isTokenA ? pair.reserveA : pair.reserveB;
        uint256 reserveOut = isTokenA ? pair.reserveB : pair.reserveA;

        if (reserveOut == 0) return 0;

        uint256 feeAmount = (amountIn * swapFee) / 100;
        uint256 amountInNet = amountIn - feeAmount;
        uint256 numerator = amountInNet * reserveOut;
        uint256 denominator = reserveIn + amountInNet;
        return numerator / denominator;
    }

    // Swap avec AMM ou redirection vers Uniswap
function swap(address inputToken, address outputToken, uint256 amountIn) external nonReentrant returns (uint256) {
    require(inputToken != address(0) && outputToken != address(0), "Tokens invalides");
    require(amountIn > 0, "Montant doit etre > 0");
    require(IERC20(inputToken).allowance(msg.sender, address(this)) >= amountIn, "Approbation insuffisante");

    bytes32 pairKey = pairKeys[inputToken][outputToken];
    Pair storage pair = pairs[pairKey];

    if (pair.tokenA == address(0) || pair.reserveA == 0 || pair.reserveB == 0) {
        // Ne pas appeler forwardToUniswap ici, mais indiquer que la paire manque
        revert("Paire inexistante ou sans liquidite, utilisez forwardToUniswap");
    }

    bool isTokenA = pair.tokenA == inputToken;
    uint256 reserveIn = isTokenA ? pair.reserveA : pair.reserveB;
    uint256 reserveOut = isTokenA ? pair.reserveB : pair.reserveA;

    uint256 feeAmount = (amountIn * swapFee) / 100;
    uint256 amountInNet = amountIn - feeAmount;
    uint256 amountOut = (amountInNet * reserveOut) / (reserveIn + amountInNet);

    require(amountOut > 0 && amountOut <= reserveOut, "Sortie invalide");

    IERC20(inputToken).transferFrom(msg.sender, address(this), amountIn);
    IERC20(outputToken).transfer(msg.sender, amountOut);

    if (isTokenA) {
        pair.reserveA += amountInNet;
        pair.reserveB -= amountOut;
    } else {
        pair.reserveB += amountInNet;
        pair.reserveA -= amountOut;
    }

    feesCollected[inputToken] += feeAmount;
    emit Swap(msg.sender, inputToken, outputToken, amountIn, amountOut, feeAmount);
    return amountOut;
}

    // Distribution des frais
    function distributeFees(address token) external nonReentrant onlyOwner {
        require(token != address(0), "Token invalide");
        uint256 totalFees = feesCollected[token];
        require(totalFees > 0, "Aucun fee a distribuer");

        uint256 totalLPLiquidity = 0;
        uint256 len = lpList[token].length;
        for (uint256 i = 0; i < len; i++) {
            totalLPLiquidity += lpBalances[token][lpList[token][i]];
        }
        require(totalLPLiquidity > 0, "Aucun fournisseur de liquidite");

        for (uint256 i = 0; i < len; i++) {
            address lp = lpList[token][i];
            uint256 lpShare = (totalFees * lpBalances[token][lp]) / totalLPLiquidity;
            lpBalances[token][lp] += lpShare;
            // Ne pas augmenter les réserves ici pour éviter de fausser l'AMM
        }

        feesCollected[token] = 0;
        emit FeesDistributed(token, totalFees);
    }

    // Forwarding vers Uniswap (accessible à tous)
    function forwardToUniswap(address inputToken, address outputToken, uint256 amount, uint256 minAmountOut) 
        public nonReentrant returns (uint256) 
    {
        require(inputToken != address(0) && outputToken != address(0), "Tokens invalides");
        require(amount > 0, "Montant doit etre > 0");
        require(IERC20(inputToken).allowance(msg.sender, address(this)) >= amount, "Approbation insuffisante");

        IERC20(inputToken).transferFrom(msg.sender, address(this), amount);

        uint256 additionalFee = (amount * ADDITIONAL_FEE_NUMERATOR) / ADDITIONAL_FEE_DENOMINATOR;
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

    function getLPList(address token) external view returns (address[] memory) {
        return lpList[token];
    }
}