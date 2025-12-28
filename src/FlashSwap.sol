// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/interfaces/IERC3156FlashLender.sol";
import "@openzeppelin/contracts/interfaces/IERC3156FlashBorrower.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

/**
 * @notice Interface for DexCore to add flash loan fees to pool reserves
 */
interface IDexCore {
    function addFlashLoanFee(
        address token0,
        address token1,
        address feeToken,
        uint256 feeAmount
    ) external;
}

/**
 * @title FlashSwap
 * @notice ERC-3156 compliant flash loan contract with borrower approval system
 * @dev Implements flash loans with 0.09% fee and borrower whitelist
 * @dev Supports EIP-2771 meta-transactions for gasless UX
 */
contract FlashSwap is IERC3156FlashLender, AccessControl, ReentrancyGuard, ERC2771Context {
    using SafeERC20 for IERC20;

    /// @notice DexCore contract address
    address public immutable dexCore;
    
    /// @notice Mapping to track which pools a token belongs to
    /// @dev token => pairedToken address
    mapping(address => address) public tokenPools;
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                              ROLE DEFINITIONS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    /// @notice Role for governance operations (borrower approval, max loan limits)
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    
    /// @notice Role for administrative operations (pool registration)
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Flash loan fee: 0.09% (9 basis points)
    uint256 public constant FLASH_FEE_BPS = 9;
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    /// @notice Maximum flash loan per transaction: 10% of pool reserves
    uint256 public constant MAX_FLASH_LOAN_BPS = 1000; // 10%
    
    /// @notice Maximum flash loan per token (as percentage of reserves)
    mapping(address => uint256) public maxFlashLoanAmount;

    /// @notice ERC-3156 callback success return value
    bytes32 private constant CALLBACK_SUCCESS = keccak256("ERC3156FlashBorrower.onFlashLoan");

    /// @notice Mapping of approved borrowers
    mapping(address => bool) public approvedBorrowers;

    /// @notice Emitted when a flash loan is executed
    event FlashLoan(
        address indexed borrower,
        address indexed token,
        uint256 amount,
        uint256 fee
    );

    /// @notice Emitted when borrower is approved
    event BorrowerApproved(address indexed borrower);

    /// @notice Emitted when borrower is revoked
    event BorrowerRevoked(address indexed borrower);
    
    /// @notice Emitted when max flash loan is updated
    event MaxFlashLoanUpdated(address indexed token, uint256 maxAmount);

    /// @notice Thrown when borrower is not approved
    error UnauthorizedBorrower();

    /// @notice Thrown when callback fails
    error InvalidCallback();

    /// @notice Thrown when repayment is insufficient
    error InsufficientRepayment();

    /// @notice Thrown when token is not supported
    error InvalidToken();

    /// @notice Thrown when amount is invalid
    error InvalidAmount();
    
    /// @notice Thrown when no pool found for token
    error NoPoolFound();

    /**
     * @notice Initializes FlashSwap contract
     * @dev Validates DexCore address is not zero
     * @param _dexCore Address of the DexCore contract (cannot be zero)
     * @param _trustedForwarder MinimalForwarder address for meta-transactions
     * @custom:security Deployer gets all roles initially
     */
    constructor(address _dexCore, address _trustedForwarder) 
        ERC2771Context(_trustedForwarder)
    {
        if (_dexCore == address(0)) revert InvalidToken();
        dexCore = _dexCore;
        
        // Setup roles: deployer gets all roles initially
        address deployer = _msgSender();
        _grantRole(DEFAULT_ADMIN_ROLE, deployer);
        _grantRole(GOVERNANCE_ROLE, deployer);
        _grantRole(ADMIN_ROLE, deployer);
    }

    /**
     * @notice Execute flash loan with repayment check
     * @dev Implements ERC-3156 standard with 0.09% fee and borrower whitelist
     * @param receiver Contract receiving the flash loan (must be approved)
     * @param token Token to borrow (must have available liquidity in DexCore)
     * @param amount Amount to borrow (max 10% of reserves by default)
     * @param data Arbitrary data to pass to receiver callback
     * @return Success status (true if loan executed and repaid)
     * @custom:security Reentrancy protected, validates repayment before returning
     * @custom:fee 0.09% fee automatically distributed to LPs via DexCore
     * @custom:gas-cost Approximately 200,000 gas plus borrower callback cost
     */
    function flashLoan(
        IERC3156FlashBorrower receiver,
        address token,
        uint256 amount,
        bytes calldata data
    ) external override nonReentrant returns (bool) {
        // Validation
        if (!approvedBorrowers[address(receiver)]) revert UnauthorizedBorrower();
        if (amount == 0) revert InvalidAmount();
        
        // Check available liquidity from DexCore
        uint256 poolReserve = IERC20(token).balanceOf(dexCore);
        if (amount > poolReserve) revert InvalidAmount();
        
        // Enforce max flash loan limit: 10% of pool reserves per transaction
        uint256 maxLoan = maxFlashLoanAmount[token];
        if (maxLoan == 0) {
            // Default: 10% of pool reserves
            maxLoan = (poolReserve * MAX_FLASH_LOAN_BPS) / FEE_DENOMINATOR;
        }
        if (amount > maxLoan) revert InvalidAmount();

        // Calculate fee
        uint256 fee = flashFee(token, amount);

        IERC20 _token = IERC20(token);
        
        // CHECKS: Record balance before to detect repayment
        uint256 balanceBefore = _token.balanceOf(address(this));

        // INTERACTIONS: Transfer tokens from DexCore to THIS contract first (prevents reentrancy)
        // DexCore must approve FlashSwap to pull tokens
        IERC20(token).safeTransferFrom(dexCore, address(this), amount);
        
        // Then transfer to borrower
        _token.safeTransfer(address(receiver), amount);

        // Execute callback (borrower must repay to THIS contract)
        // Borrower performs arbitrary logic here and must repay amount + fee
        if (receiver.onFlashLoan(_msgSender(), token, amount, fee, data) != CALLBACK_SUCCESS) {
            revert InvalidCallback();
        }

        // EFFECTS: Verify repayment - borrower must have transferred amount + fee to this contract
        uint256 balanceAfter = _token.balanceOf(address(this));
        if (balanceAfter < balanceBefore + amount + fee) revert InsufficientRepayment();

        // Transfer principal back to DexCore
        _token.safeTransfer(dexCore, amount);

        // Find pool for this token and distribute fee to LPs
        address pairedToken = tokenPools[token]; // Get paired token
        
        // Enforce pool registration - revert if pool not found to prevent fee loss
        if (pairedToken == address(0)) revert NoPoolFound();
        
        // Approve DexCore to pull the fee
        _token.approve(dexCore, fee);
        
        // Call DexCore to add fee to pool reserves (increases LP value)
        IDexCore(dexCore).addFlashLoanFee(token, pairedToken, token, fee);

        emit FlashLoan(address(receiver), token, amount, fee);

        return true;
    }

    /**
     * @notice Approve a borrower for flash loans
     * @dev Only approved contracts can execute flash loans (whitelist security)
     * @param borrower Address of the borrower to approve (cannot be zero)
     * @custom:security GOVERNANCE_ROLE only, prevents unauthorized flash loan usage
     */
    function approveBorrower(address borrower) external onlyRole(GOVERNANCE_ROLE) {
        if (borrower == address(0)) revert InvalidToken();
        approvedBorrowers[borrower] = true;
        emit BorrowerApproved(borrower);
    }

    /**
     * @notice Revoke a borrower's flash loan privileges
     * @param borrower Address of the borrower to revoke
     */
    function revokeBorrower(address borrower) external onlyRole(GOVERNANCE_ROLE) {
        if (borrower == address(0)) revert InvalidToken();
        approvedBorrowers[borrower] = false;
        emit BorrowerRevoked(borrower);
    }

    /**
     * @notice Return maximum flash loan amount available for a token
     * @dev Returns total balance of token in DexCore (actual max may be lower due to limits)
     * @param token Token address
     * @return Maximum amount available for flash loan
     * @custom:note Actual max enforced is min(balance, maxFlashLoanAmount or 10% of reserves)
     */
    function maxFlashLoan(address token) external view override returns (uint256) {
        return IERC20(token).balanceOf(dexCore);
    }

    /**
     * @notice Calculate flash loan fee for an amount
     * @dev Implements ERC-3156 flashFee interface
     * @param token Token address (validated but not used in calculation)
     * @param amount Amount to borrow
     * @return Fee amount (0.09% of borrowed amount = 9 basis points)
     * @custom:formula fee = (amount * 9) / 10000
     */
    function flashFee(address token, uint256 amount) public view override returns (uint256) {
        // Validate token exists (prevent flash loans on non-existent tokens)
        if (token == address(0)) revert InvalidToken();
        return (amount * FLASH_FEE_BPS) / FEE_DENOMINATOR;
    }

    /**
     * @notice Register a pool for flash loan fee distribution
     * @dev Maps tokens to their paired token for fee distribution to correct pool
     * @param token0 First token in the pool (cannot be zero)
     * @param token1 Second token in the pool (cannot be zero)
     * @custom:security ADMIN_ROLE only, must match actual pools in DexCore
     * @custom:benefit Enables automatic LP fee distribution for flash loans
     */
    function registerPool(address token0, address token1) external onlyRole(ADMIN_ROLE) {
        if (token0 == address(0) || token1 == address(0)) revert InvalidToken();
        tokenPools[token0] = token1;
        tokenPools[token1] = token0;
    }

    /**
     * @notice Withdraw tokens (emergency only)
     * @param token Token address
     * @param amount Amount to withdraw
     */
    function withdraw(address token, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(0)) revert InvalidToken();
        if (amount == 0) revert InvalidAmount();
        IERC20(token).safeTransfer(_msgSender(), amount);
    }
    
    /**
     * @notice Set maximum flash loan amount for a token
     * @dev Circuit breaker to limit flash loan size per transaction
     * @param token Token address (cannot be zero)
     * @param maxAmount Maximum flash loan amount (0 = use default 10% of reserves)
     * @custom:security GOVERNANCE_ROLE only, prevents excessive flash loan sizes
     */
    function setMaxFlashLoan(address token, uint256 maxAmount) external onlyRole(GOVERNANCE_ROLE) {
        if (token == address(0)) revert InvalidToken();
        maxFlashLoanAmount[token] = maxAmount;
        emit MaxFlashLoanUpdated(token, maxAmount);
    }

    /**
     * @notice Check if borrower is approved
     * @param borrower Address to check
     * @return Approval status
     */
    function isBorrowerApproved(address borrower) external view returns (bool) {
        return approvedBorrowers[borrower];
    }

    /**
     * @notice Override _msgSender to support ERC2771Context
     * @dev Returns the actual sender from meta-transaction or msg.sender
     */
    function _msgSender() internal view virtual override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }

    /**
     * @notice Override _msgData to support ERC2771Context
     * @dev Returns the actual calldata from meta-transaction or msg.data
     */
    function _msgData() internal view virtual override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    /**
     * @notice Override _contextSuffixLength to support ERC2771Context
     * @dev Returns the length of the context suffix appended by the forwarder
     */
    function _contextSuffixLength() internal view virtual override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }
}
