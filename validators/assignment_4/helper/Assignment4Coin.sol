// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

// Import ERC721URIStorage.sol
import "../../../node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Import BaseConfig.sol
import "../../BaseConfig.sol";

contract Assignment4Coin is ERC20, BaseConfig {
    constructor(
        string memory name,
        string memory symbol,
        address _configContractAddress
    ) ERC20(name, symbol) {
        // Add smart contract to contract admin list with the name SBCoin_<coin_name>
        initAdmin(
            _configContractAddress,
            "SS23 Assignment 4 Validator Contract - Coin"
        );
    }

    function mint(address _recipient, uint256 _amount) public {
        require(
            getConfigStorage().isAdmin(msg.sender),
            "Assignment4Coin: only admin can burn!"
        );

        _mint(_recipient, _amount);
    }
}
