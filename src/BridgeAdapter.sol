// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./DexCore.sol";

/**
 * @title BridgeAdapter
 * @notice Cross-chain message handler for executing swaps initiated on other chains
 * @dev Prevents replay attacks and enforces authorized bridge calls only
 */
contract BridgeAdapter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice DexCore contract for executing swaps
    DexCore public immutable dexCore;

    /// @notice Authorized bridge contract address
    address public bridge;
    
    /// @notice Pending bridge address for timelock
    address public pendingBridge;
    
    /// @notice Timestamp when bridge update can be executed
    uint256 public bridgeUpdateTime;
    
    /// @notice Timelock delay for bridge updates (2 days)
    uint256 public constant BRIDGE_UPDATE_DELAY = 2 days;

    /// @notice Mapping to track processed message IDs (replay protection)
    mapping(bytes32 => bool) public processedMessages;

    /// @notice Cross-chain swap message structure
    struct CrossChainSwapMessage {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOutMin;
        address recipient;
        uint256 deadline;
    }

    /// @notice Emitted when cross-chain swap is executed
    event CrossChainSwapExecuted(
        bytes32 indexed messageId,
        address indexed recipient,
        address tokenOut,
        uint256 amountOut
    );

    /// @notice Emitted when bridge address is updated
    event BridgeUpdated(address indexed oldBridge, address indexed newBridge);
    
    /// @notice Emitted when bridge update is proposed
    event BridgeUpdateProposed(address indexed newBridge, uint256 executeTime);
    
    /// @notice Emitted when bridge update is cancelled
    event BridgeUpdateCancelled(address indexed cancelledBridge);

    /// @notice Thrown when caller is not authorized bridge
    error UnauthorizedBridge();

    /// @notice Thrown when message already processed
    error MessageAlreadyProcessed();

    /// @notice Thrown when address is zero
    error ZeroAddress();
    
    /// @notice Thrown when timelock not expired
    error TimelockNotExpired();
    
    /// @notice Thrown when no pending update
    error NoPendingUpdate();
    
    /// @notice Thrown when invalid token
    error InvalidToken();
    
    /// @notice Thrown when invalid amount
    error InvalidAmount();
    
    /// @notice Thrown when deadline expired
    error DeadlineExpired();

    /**
     * @notice Initializes BridgeAdapter
     * @dev Validates both addresses are not zero
     * @param _dexCore Address of DexCore contract (cannot be zero)
     * @param initialOwner Address of the contract owner (cannot be zero)
     * @custom:security Owner can update bridge address with 2-day timelock
     */
    constructor(address _dexCore, address initialOwner) Ownable(initialOwner) {
        if (_dexCore == address(0)) revert ZeroAddress();
        if (initialOwner == address(0)) revert ZeroAddress();
        dexCore = DexCore(_dexCore);
    }

    /**
     * @notice Propose bridge contract address update (step 1 of 2-step timelock)
     * @dev Requires 2-day timelock before execution to prevent abrupt bridge changes
     * @param _bridge Address of the new bridge contract (cannot be zero)
     * @custom:security Owner-only, emits BridgeUpdateProposed for transparency
     */
    function proposeBridgeUpdate(address _bridge) external onlyOwner {
        if (_bridge == address(0)) revert ZeroAddress();
        
        pendingBridge = _bridge;
        bridgeUpdateTime = block.timestamp + BRIDGE_UPDATE_DELAY;
        
        emit BridgeUpdateProposed(_bridge, bridgeUpdateTime);
    }
    
    /**
     * @notice Execute bridge contract address update (step 2 of 2-step timelock)
     * @dev Can only be called after 2-day timelock period has elapsed
     * @custom:security Prevents unauthorized bridge changes, emits BridgeUpdated event
     */
    function executeBridgeUpdate() external onlyOwner {
        if (pendingBridge == address(0)) revert NoPendingUpdate();
        if (block.timestamp < bridgeUpdateTime) revert TimelockNotExpired();
        
        address oldBridge = bridge;
        bridge = pendingBridge;
        pendingBridge = address(0);
        bridgeUpdateTime = 0;
        
        emit BridgeUpdated(oldBridge, bridge);
    }
    
    /**
     * @notice Cancel pending bridge update
     */
    function cancelBridgeUpdate() external onlyOwner {
        if (pendingBridge == address(0)) revert NoPendingUpdate();
        
        address cancelled = pendingBridge;
        pendingBridge = address(0);
        bridgeUpdateTime = 0;
        
        emit BridgeUpdateCancelled(cancelled);
    }

    /**
     * @notice Execute cross-chain swap from inbound bridge message
     * @dev Implements replay protection and validates all message parameters
     * @param messageId Unique message identifier for replay protection (prevents double-execution)
     * @param messageData Encoded CrossChainSwapMessage data (tokenIn, tokenOut, amounts, recipient, deadline)
     * @return amountOut Actual output amount received from swap
     * @custom:security Only authorized bridge can call, reentrancy protected, replay protected
     * @custom:flow Bridge → BridgeAdapter → DexCore → Recipient
     * @custom:gas-cost Approximately 180,000 gas plus DexCore swap cost
     */
    function executeCrossChainSwap(
        bytes32 messageId,
        bytes calldata messageData
    ) external nonReentrant returns (uint256 amountOut) {
        // CHECKS: Only authorized bridge can call
        if (msg.sender != bridge) revert UnauthorizedBridge();

        // Replay protection - prevent duplicate message execution
        if (processedMessages[messageId]) revert MessageAlreadyProcessed();
        processedMessages[messageId] = true;

        // Decode message data
        CrossChainSwapMessage memory message = abi.decode(messageData, (CrossChainSwapMessage));
        
        // Validate all message parameters
        if (message.tokenIn == address(0) || message.tokenOut == address(0)) revert InvalidToken();
        if (message.recipient == address(0)) revert ZeroAddress();
        if (message.amountIn == 0) revert InvalidAmount();
        if (message.deadline < block.timestamp) revert DeadlineExpired();

        // INTERACTIONS: Transfer tokens from bridge to this contract (assumes bridge holds tokens)
        IERC20(message.tokenIn).safeTransferFrom(msg.sender, address(this), message.amountIn);

        // Approve DexCore to spend tokens
        IERC20(message.tokenIn).safeIncreaseAllowance(address(dexCore), message.amountIn);

        // Execute swap through DexCore (tokens sent directly to recipient)
        // DexCore handles slippage protection and deadline validation
        amountOut = dexCore.swap(
            message.tokenIn,
            message.tokenOut,
            message.amountIn,
            message.amountOutMin,
            message.recipient,
            message.deadline
        );

        emit CrossChainSwapExecuted(
            messageId,
            message.recipient,
            message.tokenOut,
            amountOut
        );
    }

    /**
     * @notice Check if message has been processed
     * @param messageId Message ID to check
     * @return Processed status
     */
    function isMessageProcessed(bytes32 messageId) external view returns (bool) {
        return processedMessages[messageId];
    }
}
