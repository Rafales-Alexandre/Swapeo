// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title ERC20Mock - Token ERC20 pour les tests
/// @author Équipe Swapeo
/// @notice Ce contrat implémente un token ERC20 simple pour les tests
/// @dev Hérite du contrat ERC20 d'OpenZeppelin et crée une offre initiale de tokens
contract ERC20Mock is ERC20 {
    /// @notice Crée un nouveau token ERC20 avec une offre initiale
    /// @dev Mint 1 million de tokens au déploieur du contrat
    /// @param name Nom du token
    /// @param symbol Symbole du token
    /// @param decimals Nombre de décimales du token
    constructor(string memory name, string memory symbol, uint8 decimals) ERC20(name, symbol) {
        _mint(msg.sender, 1000000 * (10 ** decimals)); // Mint initial supply
    }
}
