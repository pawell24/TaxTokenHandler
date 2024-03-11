// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./UniswapTaxToken.sol";

contract Fair is UniswapTaxToken {
    constructor(
        address uniswapAddress
    )
        UniswapTaxToken(uniswapAddress, 50, 888_000_000)
        ERC20("0xFair", "FAIR")
    {}
}
