// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title MinimalForwarder
 * @notice EIP-2771 compliant forwarder for gasless meta-transactions
 * @dev Verifies signatures and forwards calls to trusted contracts
 */
contract MinimalForwarder is EIP712 {
    using ECDSA for bytes32;

    /// @notice Request structure for meta-transactions
    struct ForwardRequest {
        address from;      // Original sender
        address to;        // Target contract
        uint256 value;     // ETH value to send
        uint256 gas;       // Gas limit for execution
        uint256 nonce;     // Nonce for replay protection
        bytes data;        // Calldata to forward
    }

    /// @notice Nonces for replay protection
    mapping(address => uint256) private _nonces;

    /// @notice Emitted when a meta-transaction is executed
    event MetaTransactionExecuted(
        address indexed from,
        address indexed to,
        uint256 nonce,
        bool success,
        bytes returnData
    );

    /// @notice Thrown when signature is invalid
    error InvalidSignature();

    /// @notice Thrown when execution fails
    error ExecutionFailed(bytes returnData);

    /// @notice Thrown when nonce is invalid
    error InvalidNonce();

    /**
     * @notice Initialize forwarder with EIP-712 domain
     */
    constructor() EIP712("MinimalForwarder", "1.0.0") {}

    /**
     * @notice Get current nonce for an address
     * @param from Address to query
     * @return Current nonce
     */
    function getNonce(address from) public view returns (uint256) {
        return _nonces[from];
    }

    /**
     * @notice Verify a forward request signature
     * @param req Forward request
     * @param signature EIP-712 signature
     * @return True if signature is valid
     */
    function verify(ForwardRequest calldata req, bytes calldata signature) public view returns (bool) {
        address signer = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256("ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"),
                    req.from,
                    req.to,
                    req.value,
                    req.gas,
                    req.nonce,
                    keccak256(req.data)
                )
            )
        ).recover(signature);

        return _nonces[req.from] == req.nonce && signer == req.from;
    }

    /**
     * @notice Execute a meta-transaction
     * @param req Forward request
     * @param signature EIP-712 signature
     * @return success Execution success status
     * @return returnData Return data from execution
     */
    function execute(ForwardRequest calldata req, bytes calldata signature)
        public
        payable
        returns (bool success, bytes memory returnData)
    {
        // Verify signature
        if (!verify(req, signature)) revert InvalidSignature();

        // Increment nonce
        _nonces[req.from]++;

        // Execute call with appended sender address (EIP-2771)
        // Append the original sender address to calldata
        bytes memory data = abi.encodePacked(req.data, req.from);

        // Execute the call
        (success, returnData) = req.to.call{gas: req.gas, value: req.value}(data);

        // Emit event
        emit MetaTransactionExecuted(req.from, req.to, req.nonce, success, returnData);

        // Revert if execution failed
        if (!success) revert ExecutionFailed(returnData);
    }
}
