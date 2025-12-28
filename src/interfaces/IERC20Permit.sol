// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IERC20Permit
 * @notice Interface for EIP-2612 permit functionality
 * @dev Allows gasless approvals via off-chain signatures
 */
interface IERC20Permit {
    /**
     * @notice Sets approval via signature
     * @param owner Token owner address
     * @param spender Spender address
     * @param value Approval amount
     * @param deadline Signature expiration timestamp
     * @param v ECDSA signature parameter
     * @param r ECDSA signature parameter
     * @param s ECDSA signature parameter
     */
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    /**
     * @notice Returns the current nonce for an owner
     * @param owner Token owner address
     * @return Current nonce value
     */
    function nonces(address owner) external view returns (uint256);

    /**
     * @notice Returns the domain separator for EIP-712
     * @return Domain separator hash
     */
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}
