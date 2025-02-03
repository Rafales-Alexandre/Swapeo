// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

contract UniswapV2RouterMock {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata /* path */,
        address to,
        uint /* deadline */
    ) external returns (uint[] memory amounts) {
        amounts = new uint[](2);
        amounts[0] = amountIn;
        amounts[1] = amountIn; // Pour simplifier, on renvoie amountIn en sortie
    }
}
