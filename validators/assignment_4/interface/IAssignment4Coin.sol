// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

// Import ERC721URIStorage.sol
import "../../../node_modules/@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Import BaseAssignment.sol
import "../../IBaseAssignment.sol";

// Create contract > define Contract Name
abstract contract IAssignment4Coin is ERC20, IBaseAssignment {
    function mint(address _recipient, uint256 _amount) public virtual;
}
