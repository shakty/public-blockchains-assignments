// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

// Import BaseAssignment.sol
import "../BaseAssignment.sol";

// Create contract > define Contract Name
contract StateChannel is BaseAssignment {
    // Define state variables
    address sender;
    address receiver;
    address funder;

    // Helper
    uint256 public timeout;

    string state = "waiting";

    // ## INSPIRED BY:
    //    - https://programtheblockchain.com/posts/2018/02/17/signing-and-verifying-messages-in-ethereum/

    // Make sure to set the validator address in the BaseAssignment constructor
    constructor(address _validator) BaseAssignment(_validator) {}

    bool internal locked;
    modifier reentrancyGuard() {
        require(!locked);
        locked = true;
        _;
        locked = false;
    }

    function openChannel(address _sender, address _receiver) public payable {
        require(compareStrings(state, "waiting"), "A Channel is still open");

        sender = _sender;
        receiver = _receiver;
        funder = msg.sender;
        state = "open";
    }

    function openChannelTimeout(
        address _sender,
        address _receiver,
        uint256 _timeout
    ) public payable {
        require(compareStrings(state, "waiting"), "A Channel is still open");

        sender = _sender;
        receiver = _receiver;
        funder = msg.sender;
        state = "timed_open";

        // Set timeout
        timeout = getBlockNumber() + _timeout;
    }

    function verifyPaymentMsg(uint256 _ethAmount, bytes memory _signature)
        public
        view
        returns (bool)
    {
        // Recreate message
        bytes32 message = prefixed(
            keccak256(abi.encodePacked(_ethAmount, address(this)))
        );

        if (recoverSigner(message, _signature) != sender) return false;

        if (_ethAmount >= address(this).balance) return false;

        return true;
    }

    function closeChannel(uint256 _ethAmount, bytes memory _signature) public {
         require(
            compareStrings(state, "open") ||
                compareStrings(state, "timed_open"),
            "Channel is not open"
        );

        require(msg.sender == receiver, "Not authorized to close channel");

        require(verifyPaymentMsg(_ethAmount, _signature), "Invalid signature");

        // payable(receiver).transfer(_ethAmount);
        (bool sent, ) = payable(receiver).call{value: _ethAmount}("");
        require(sent, "Failed to send Ether");

        // Reset state variables
        sender = address(0);
        receiver = address(0);
        state = "waiting";
    }

    function closeChannelNoReentrancy(
        uint256 _ethAmount,
        bytes memory _signature
    ) public reentrancyGuard {
        require(
            compareStrings(state, "open") ||
                compareStrings(state, "timed_open"),
            "Channel is not open"
        );

        require(msg.sender == receiver, "Not authorized to close channel");

        require(verifyPaymentMsg(_ethAmount, _signature), "Invalid signature");

        (bool sent, ) = payable(receiver).call{value: _ethAmount}("");
        require(sent, "Failed to send Ether");

        // Reset state variables
        sender = address(0);
        receiver = address(0);
        state = "waiting";
    }

    function expireChannel() public {
        require(
            msg.sender == sender ||
                isValidator(msg.sender) ||
                msg.sender == funder,
            "Not authorized to expire channel"
        );

        require(
            compareStrings(state, "timed_open"),
            "Channel is not 'timed_open' or opened in normal 'open' mode."
        );

        require(getBlockNumber() > timeout, "Channel is not expired");

        payable(funder).transfer(address(this).balance);

        // Reset state variables
        sender = address(0);
        receiver = address(0);
        state = "waiting";
    }

    function forceReset() public {
        require(
            msg.sender == sender || isValidator(msg.sender),
            "Not authorized to reset channel"
        );

        // Reset state variables
        sender = address(0);
        receiver = address(0);
        state = "waiting";
    }

    // Signature methods

    function splitSignature(bytes memory sig)
        internal
        pure
        returns (
            uint8,
            bytes32,
            bytes32
        )
    {
        require(sig.length == 65);

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            // first 32 bytes, after the length prefix
            r := mload(add(sig, 32))
            // second 32 bytes
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(sig, 96)))
        }

        return (v, r, s);
    }

    function recoverSigner(bytes32 message, bytes memory sig)
        internal
        pure
        returns (address)
    {
        uint8 v;
        bytes32 r;
        bytes32 s;

        (v, r, s) = splitSignature(sig);

        return ecrecover(message, v, r, s);
    }

    // Builds a prefixed hash to mimic the behavior of eth_sign.
    function prefixed(bytes32 hash) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
            );
    }

    /*=============================================
    =            HELPER            =
    =============================================*/

    function compareStrings(string memory a, string memory b)
        private
        pure
        returns (bool)
    {
        return (keccak256(abi.encodePacked((a))) ==
            keccak256(abi.encodePacked((b))));
    }

    /*=====  End of HELPER  ======*/
}
