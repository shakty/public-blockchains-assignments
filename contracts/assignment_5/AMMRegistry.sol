// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

// This file is a simplified version of the Registry for local testing.
// Check the validators/ folder for the full version.

abstract contract IExchange {
    // Get token address
    function getTokenAddress() public view virtual returns (address) {}
}

contract AMMRegistry {
    // mapping(tokenAddress => exchangeAddress) -> get exchange address by token address
    mapping(address => address) public tokenToExchange;

    event NewExchange(address indexed token, address indexed exchange);

    function registerAMM(address _exchangeAddress) public {
        require(_exchangeAddress != address(0), "invalid exchange address");
        require(
            tokenToExchange[_exchangeAddress] == address(0),
            "exchange already registered"
        );

        IExchange exchange = IExchange(_exchangeAddress);
        address tokenAddress = exchange.getTokenAddress();

        require(tokenAddress != address(0), "invalid token address");

        tokenToExchange[tokenAddress] = _exchangeAddress;

        emit NewExchange(tokenAddress, _exchangeAddress);
    }

    function getExchange(address _tokenAddress) public view returns (address) {
        return tokenToExchange[_tokenAddress];
    }
}