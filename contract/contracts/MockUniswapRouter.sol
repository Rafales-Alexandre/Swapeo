// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title MockUniswapRouter - Simulateur de routeur Uniswap pour les tests
/// @author Équipe Swapeo
/// @notice Ce contrat simule le comportement d'un routeur Uniswap pour les tests
/// @dev Implémentation simplifiée pour les tests, ne doit pas être utilisé en production
contract MockUniswapRouter {
    /// @notice Adresse du premier token de la paire
    address public tokenA;
    
    /// @notice Adresse du second token de la paire
    address public tokenB;

    /// @notice Définit les adresses des tokens pour la simulation
    /// @param _tokenA Adresse du premier token
    /// @param _tokenB Adresse du second token
    function setTokens(address _tokenA, address _tokenB) external {
        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    /// @notice Simule un échange de tokens comme le ferait Uniswap
    /// @dev Simplement transfère les tokens avec une réduction de 1 unité pour simuler les frais
    /// @param amountIn Montant du token d'entrée
    /// @param /* amountOutMin */ Paramètre ignoré dans cette implémentation mock
    /// @param path Chemin d'échange (doit contenir exactement 2 adresses de tokens)
    /// @param to Adresse du destinataire des tokens de sortie
    /// @param /* deadline */ Paramètre ignoré dans cette implémentation mock
    /// @return amounts Tableau contenant les montants d'entrée et de sortie
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 /* amountOutMin */,
        address[] calldata path,
        address to,
        uint256 /* deadline */
    ) external returns (uint256[] memory amounts) {
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = amountIn - 1; // Simuler une sortie avec une réduction de 1 unité

        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        IERC20(path[1]).transfer(to, amounts[1]);
        return amounts;
    }
}