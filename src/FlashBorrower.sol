// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC3156FlashBorrower.sol";
import "@openzeppelin/contracts/interfaces/IERC3156FlashLender.sol";

/**
 * @title FlashBorrower
 * @notice Example flash loan borrower contract implementing ERC-3156
 * @dev Demonstrates how to execute flash loans from DEXPair
 */
contract FlashBorrower is IERC3156FlashBorrower {
    using SafeERC20 for IERC20;

    /// @notice Flash loan lender (DEXPair)
    IERC3156FlashLender public immutable lender;
    
    /// @notice Owner of this contract
    address public immutable owner;

    /// @notice Emitted when flash loan is executed
    event FlashLoanExecuted(address indexed token, uint256 amount, uint256 fee);

    /// @notice Thrown when caller is not the lender
    error UnauthorizedLender();
    
    /// @notice Thrown when caller is not the owner
    error UnauthorizedCaller();
    
    /// @notice Thrown when initiator is not this contract
    error UnauthorizedInitiator();

    /**
     * @notice Initializes the flash borrower
     * @param _lender Flash loan lender address (DEXPair)
     */
    constructor(address _lender) {
        require(_lender != address(0), "Invalid lender");
        lender = IERC3156FlashLender(_lender);
        owner = msg.sender;
    }

    /**
     * @notice ERC-3156 flash loan callback
     * @param initiator Address that initiated the flash loan
     * @param token Token being borrowed
     * @param amount Amount borrowed
     * @param fee Fee to pay
     * @param data Arbitrary data passed from flash loan call
     * @return Success hash
     */
    function onFlashLoan(
        address initiator,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external override returns (bytes32) {
        if (msg.sender != address(lender)) revert UnauthorizedLender();
        if (initiator != address(this)) revert UnauthorizedInitiator();

        // Custom flash loan logic goes here
        // Example: arbitrage, liquidation, collateral swap, etc.
        
        // Decode custom data if needed
        // (uint256 param1, address param2) = abi.decode(data, (uint256, address));

        emit FlashLoanExecuted(token, amount, fee);

        // Transfer loan + fee back to lender
        IERC20(token).safeTransfer(address(lender), amount + fee);

        return keccak256("ERC3156FlashBorrower.onFlashLoan");
    }

    /**
     * @notice Executes a flash loan
     * @param token Token to borrow
     * @param amount Amount to borrow
     * @param data Custom data to pass to callback
     */
    function executeFlashLoan(
        address token,
        uint256 amount,
        bytes calldata data
    ) external {
        if (msg.sender != owner) revert UnauthorizedCaller();
        
        uint256 fee = lender.flashFee(token, amount);
        uint256 repayment = amount + fee;
        
        // Ensure this contract has enough tokens to repay
        // In production, this would come from arbitrage profits or other sources
        require(IERC20(token).balanceOf(address(this)) >= repayment, "Insufficient balance for repayment");
        
        lender.flashLoan(this, token, amount, data);
    }

    /**
     * @notice Withdraws tokens from this contract
     * @param token Token to withdraw
     * @param amount Amount to withdraw
     */
    function withdraw(address token, uint256 amount) external {
        if (msg.sender != owner) revert UnauthorizedCaller();
        IERC20(token).safeTransfer(owner, amount);
    }

    /**
     * @notice Returns maximum flash loan amount available
     * @param token Token to check
     * @return Maximum amount
     */
    function maxFlashLoan(address token) external view returns (uint256) {
        return lender.maxFlashLoan(token);
    }

    /**
     * @notice Returns flash loan fee for an amount
     * @param token Token to check
     * @param amount Amount to borrow
     * @return Fee amount
     */
    function flashFee(address token, uint256 amount) external view returns (uint256) {
        return lender.flashFee(token, amount);
    }
}
