// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title LPToken
 * @notice ERC20 token representing liquidity provider shares in a pool
 * @dev Minted/burned by DexCore contract only
 */
contract LPToken is ERC20 {
    /// @notice DexCore contract that controls minting/burning
    address public immutable dexCore;
    
    /// @notice Token pair this LP token represents
    address public immutable token0;
    address public immutable token1;
    
    /// @notice Thrown when caller is not DexCore
    error OnlyDexCore();
    
    /// @notice Thrown when attempting to burn from zero address
    error ZeroAddress();
    
    /// @notice Thrown when attempting to mint/burn zero amount
    error ZeroAmount();
    
    /**
     * @notice Initialize LP token for a specific pair
     * @param _token0 First token in pair (sorted)
     * @param _token1 Second token in pair (sorted)
     * @param _dexCore Address of DexCore contract
     */
    constructor(
        address _token0,
        address _token1,
        address _dexCore,
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) {
        token0 = _token0;
        token1 = _token1;
        dexCore = _dexCore;
    }
    
    /**
     * @notice Modifier to restrict access to DexCore only
     */
    modifier onlyDexCore() {
        if (msg.sender != dexCore) revert OnlyDexCore();
        _;
    }
    
    /**
     * @notice Mint LP tokens (only callable by DexCore)
     * @param to Recipient address (can be address(0) for MINIMUM_LIQUIDITY burn)
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyDexCore {
        if (amount == 0) revert ZeroAmount();
        
        // Special handling for MINIMUM_LIQUIDITY: mint to dead address instead of address(0)
        // OpenZeppelin's _mint doesn't allow minting to address(0)
        if (to == address(0)) {
            to = address(0xdead); // Burn address
        }
        
        _mint(to, amount);
    }
    
    /**
     * @notice Burn LP tokens (only callable by DexCore)
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount) external onlyDexCore {
        if (from == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        // balanceOf check is handled by _burn (will revert with ERC20InsufficientBalance)
        _burn(from, amount);
    }
}
