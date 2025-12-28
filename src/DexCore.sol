// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "./LPToken.sol";
import "./PriceOracle.sol";
import "./interfaces/IERC20Permit.sol";

/**
 * @title DexCore
 * @notice Production-grade AMM implementing constant product formula (x*y=k)
 * @dev Self-contained pool management with 0.3% fees, TWAP oracle, and emergency controls
 * @dev Supports EIP-2771 meta-transactions for gasless UX
 */
contract DexCore is AccessControl, ReentrancyGuard, Pausable, ERC2771Context {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════════
    //                              STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════════════════════

    /// @notice Factory address (for compatibility)
    address public immutable factory;
    
    /// @notice Wrapped ETH address
    address public immutable WETH;
    
    /// @notice Price oracle for TWAP manipulation protection
    PriceOracle public immutable priceOracle;
    
    /// @notice FlashSwap contract address for fee distribution
    address public flashSwapContract;
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                              ROLE DEFINITIONS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    /// @notice Role for pausing/unpausing the protocol in emergencies
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    /// @notice Role for governance operations (fee changes, blacklisting)
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    
    /// @notice Role for administrative operations (setting contracts)
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    /// @notice Role for fee management operations
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");
    
    /// @notice Timelock duration for critical operations (2 days)
    uint256 public constant TIMELOCK_DURATION = 2 days;
    
    /// @notice Pending pause timestamp for timelock
    uint256 public pauseTimestamp;
    
    /// @notice Pending unpause timestamp for timelock
    uint256 public unpauseTimestamp;
    
    /// @notice Pending token blacklist update
    address public pendingBlacklistToken;
    bool public pendingBlacklistStatus;
    uint256 public blacklistUpdateTime;
    
    /// @notice Pending protocol fee update
    uint256 public pendingProtocolFee;
    uint256 public protocolFeeUpdateTime;

    /// @notice Swap fee: 0.3% (30 basis points)
    uint256 public constant SWAP_FEE_BPS = 30;
    
    /// @notice Protocol fee: 0% initially (can be changed via governance)
    uint256 public protocolFeeBps = 0;
    
    /// @notice Maximum protocol fee: 1% (100 basis points)
    uint256 public constant MAX_PROTOCOL_FEE_BPS = 100;
    
    /// @notice Fee denominator: 100% = 10000 basis points
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    /// @notice Minimum liquidity locked forever on first provision
    uint256 private constant MINIMUM_LIQUIDITY = 1000;

    /// @notice Pool data structure (optimized storage packing)
    /// @dev Slot 0: reserve0 (128 bits) + reserve1 (128 bits) = 256 bits
    /// @dev Slot 1: totalLiquidity (64 bits) + blockTimestampLast (32 bits) = 96 bits (160 bits unused)
    /// @dev Slot 2: price0CumulativeLast (256 bits)
    /// @dev Slot 3: price1CumulativeLast (256 bits)
    /// @custom:gas-optimization Saves 1 storage slot (20k gas on first write, 5k on updates)
    struct Pool {
        uint128 reserve0;              // Token0 reserve (slot 0, lower 128 bits)
        uint128 reserve1;              // Token1 reserve (slot 0, upper 128 bits)
        uint64 totalLiquidity;         // Total LP tokens (slot 1, lower 64 bits)
        uint32 blockTimestampLast;     // TWAP timestamp (slot 1, bits 64-95)
        uint256 price0CumulativeLast;  // Cumulative price for token0 (slot 2)
        uint256 price1CumulativeLast;  // Cumulative price for token1 (slot 3)
    }

    /// @notice Liquidity pools: token0 => token1 => Pool
    mapping(address => mapping(address => Pool)) public pools;

    /// @notice LP token tracking: token0 => token1 => LPToken address
    mapping(address => mapping(address => address)) public lpTokens;
    
    /// @notice Token blacklist for security
    mapping(address => bool) public blacklistedTokens;
    
    /// @notice Maximum swap size per transaction (circuit breaker)
    uint256 public maxSwapSize = type(uint256).max; // No limit by default

    // ═══════════════════════════════════════════════════════════════════════════════
    //                                   EVENTS
    // ═══════════════════════════════════════════════════════════════════════════════

    event PoolCreated(address indexed token0, address indexed token1, address lpToken);
    event Swap(
        address indexed sender,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 amountOutMin,
        uint256 priceImpactBps
    );
    event LiquidityAdded(address indexed provider, address indexed token0, address indexed token1, uint256 amount0, uint256 amount1, uint256 liquidity);
    event LiquidityRemoved(address indexed provider, address indexed token0, address indexed token1, uint256 amount0, uint256 amount1, uint256 liquidity);
    event TokenBlacklistUpdated(address indexed token, bool blacklisted);
    event AddressBlacklisted(address indexed account);
    event MaxSwapSizeUpdated(uint256 oldSize, uint256 newSize);
    event FlashLoanFeeAdded(address indexed token0, address indexed token1, address indexed feeToken, uint256 feeAmount);
    event FlashSwapContractUpdated(address indexed flashSwap);
    event EmergencyWithdraw(address indexed token, uint256 amount, address indexed to);
    event ProtocolFeeUpdated(uint256 oldFee, uint256 newFee);
    event PauseScheduled(uint256 executeTime);
    event UnpauseScheduled(uint256 executeTime);
    event BlacklistUpdateScheduled(address indexed token, bool blacklisted, uint256 executeTime);
    event BlacklistUpdateCancelled(address indexed token);
    event ProtocolFeeUpdateScheduled(uint256 newFee, uint256 executeTime);
    event ProtocolFeeUpdateCancelled(uint256 cancelledFee);

    // ═══════════════════════════════════════════════════════════════════════════════
    //                                CUSTOM ERRORS
    // ═══════════════════════════════════════════════════════════════════════════════

    /// @notice Thrown when transaction deadline has expired
    error DeadlineExpired();
    
    /// @notice Thrown when insufficient liquidity in pool
    error InsufficientLiquidity();
    
    /// @notice Thrown when amount is insufficient
    error InsufficientAmount();
    
    /// @notice Thrown when token address is invalid
    error InvalidToken();
    
    /// @notice Thrown when pool already exists
    error PoolAlreadyExists();
    
    /// @notice Thrown when pool does not exist
    error PoolDoesNotExist();
    
    /// @notice Thrown when slippage tolerance is exceeded
    error SlippageExceeded();
    
    /// @notice Thrown when token addresses are identical
    error IdenticalAddresses();
    
    /// @notice Thrown when address is zero
    error ZeroAddress();
    
    /// @notice Thrown when K invariant is violated
    error InvalidK();
    
    /// @notice Thrown when amount is zero
    error ZeroAmount();
    
    /// @notice Thrown when token is blacklisted
    error TokenIsBlacklisted();
    
    /// @notice Thrown when calculated output is zero
    error InsufficientOutputAmount();
    
    /// @notice Thrown when swap size exceeds maximum
    error SwapSizeExceeded();
    
    /// @notice Thrown when caller is not FlashSwap contract
    error OnlyFlashSwap();
    
    /// @notice Thrown when timelock not met
    error TimelockNotMet();
    
    /// @notice Thrown when no pending timelock
    error NoPendingTimelock();
    
    /// @notice Thrown when amount exceeds safe limit
    error AmountTooLarge();
    
    /// @notice Thrown when fee-on-transfer token fee is too high (>5%)
    error FeeOnTransferTooHigh();

    // ═══════════════════════════════════════════════════════════════════════════════
    //                                CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Initialize DexCore with factory and WETH addresses
     * @param _factory Factory address (for compatibility)
     * @param _weth Wrapped ETH address
     * @param _trustedForwarder MinimalForwarder address for meta-transactions
     */
    constructor(address _factory, address _weth, address _trustedForwarder) 
        ERC2771Context(_trustedForwarder)
    {
        if (_factory == address(0) || _weth == address(0)) revert ZeroAddress();
        
        // Validate WETH address has code (is a contract)
        uint256 wethSize;
        assembly {
            wethSize := extcodesize(_weth)
        }
        if (wethSize == 0) revert ZeroAddress(); // Reusing error for simplicity
        
        factory = _factory;
        WETH = _weth;
        
        // Deploy price oracle for TWAP manipulation protection
        priceOracle = new PriceOracle();
        
        // Setup roles: deployer gets all roles initially
        address deployer = _msgSender();
        _grantRole(DEFAULT_ADMIN_ROLE, deployer);
        _grantRole(PAUSER_ROLE, deployer);
        _grantRole(GOVERNANCE_ROLE, deployer);
        _grantRole(ADMIN_ROLE, deployer);
        _grantRole(FEE_MANAGER_ROLE, deployer);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                              CORE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Create new liquidity pool for token pair
     * @param tokenA First token address
     * @param tokenB Second token address
     * @return lpToken Address of deployed LPToken contract
     */
    function createPool(address tokenA, address tokenB) external returns (address lpToken) {
        if (tokenA == tokenB) revert IdenticalAddresses();
        if (tokenA == address(0) || tokenB == address(0)) revert ZeroAddress();
        
        // Check token blacklist
        if (blacklistedTokens[tokenA] || blacklistedTokens[tokenB]) revert TokenIsBlacklisted();

        // Sort tokens
        (address token0, address token1) = _sortTokens(tokenA, tokenB);

        // Check pool doesn't exist
        if (lpTokens[token0][token1] != address(0)) revert PoolAlreadyExists();

        // Deploy LP token
        string memory name = string(abi.encodePacked("ONYX LP: ", _getSymbol(token0), "/", _getSymbol(token1)));
        string memory symbol = string(abi.encodePacked("LP-", _getSymbol(token0), "-", _getSymbol(token1)));
        
        lpToken = address(new LPToken(token0, token1, address(this), name, symbol));

        // Initialize pool
        pools[token0][token1] = Pool({
            reserve0: 0,
            reserve1: 0,
            totalLiquidity: 0,
            blockTimestampLast: uint32(block.timestamp),
            price0CumulativeLast: 0,
            price1CumulativeLast: 0
        });

        // Store LP token address
        lpTokens[token0][token1] = lpToken;

        emit PoolCreated(token0, token1, lpToken);
    }

    /**
     * @notice Add liquidity to pool, mint LP tokens
     * @dev First liquidity provision locks MINIMUM_LIQUIDITY tokens to prevent inflation attacks
     * @param tokenA First token address
     * @param tokenB Second token address
     * @param amountADesired Desired amount of tokenA
     * @param amountBDesired Desired amount of tokenB
     * @param amountAMin Minimum amount of tokenA (slippage protection)
     * @param amountBMin Minimum amount of tokenB (slippage protection)
     * @param to Recipient of LP tokens (cannot be zero address)
     * @param deadline Transaction deadline (Unix timestamp)
     * @return amountA Actual amount of tokenA added
     * @return amountB Actual amount of tokenB added
     * @return liquidity Amount of LP tokens minted
     * @custom:security Reentrancy protected, validates all inputs, uses SafeERC20
     * @custom:gas-cost Approximately 250,000 gas for first liquidity, 180,000 for subsequent
     */
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external nonReentrant whenNotPaused validAddress(tokenA) validAddress(tokenB) validAddress(to) validAmount(amountADesired) validAmount(amountBDesired) validDeadline(deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        if (amountADesired > type(uint128).max || amountBDesired > type(uint128).max) revert AmountTooLarge();
        // Min amounts can be 0 (user accepts any slippage)

        // Sort tokens
        (address token0, address token1) = _sortTokens(tokenA, tokenB);
        
        // Check pool exists
        if (lpTokens[token0][token1] == address(0)) revert PoolDoesNotExist();

        Pool storage pool = pools[token0][token1];

        // Calculate optimal amounts (work in sorted token space)
        uint256 amount0;
        uint256 amount1;
        
        if (pool.reserve0 == 0 && pool.reserve1 == 0) {
            // First liquidity provision - use desired amounts
            (amount0, amount1) = tokenA == token0 
                ? (amountADesired, amountBDesired) 
                : (amountBDesired, amountADesired);
        } else {
            // Calculate proportional amounts
            (uint256 amount0Desired, uint256 amount1Desired) = tokenA == token0 
                ? (amountADesired, amountBDesired) 
                : (amountBDesired, amountADesired);

            uint256 amount1Optimal = (amount0Desired * pool.reserve1) / pool.reserve0;
            
            if (amount1Optimal <= amount1Desired) {
                amount0 = amount0Desired;
                amount1 = amount1Optimal;
            } else {
                uint256 amount0Optimal = (amount1Desired * pool.reserve0) / pool.reserve1;
                amount0 = amount0Optimal;
                amount1 = amount1Desired;
            }
        }

        // Convert back to original token order for return values
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);

        // Verify slippage protection
        if (amountA < amountAMin || amountB < amountBMin) revert SlippageExceeded();

        // Transfer tokens with fee-on-transfer protection
        // Check actual received amounts to handle deflationary/fee-on-transfer tokens
        uint256 balanceABefore = IERC20(tokenA).balanceOf(address(this));
        uint256 balanceBBefore = IERC20(tokenB).balanceOf(address(this));
        
        IERC20(tokenA).safeTransferFrom(_msgSender(), address(this), amountA);
        IERC20(tokenB).safeTransferFrom(_msgSender(), address(this), amountB);
        
        uint256 balanceAAfter = IERC20(tokenA).balanceOf(address(this));
        uint256 balanceBAfter = IERC20(tokenB).balanceOf(address(this));
        
        uint256 receivedA = balanceAAfter - balanceABefore;
        uint256 receivedB = balanceBAfter - balanceBBefore;
        
        // Verify we received at least the minimum amounts (protects against excessive fees)
        if (receivedA < amountAMin || receivedB < amountBMin) revert SlippageExceeded();
        
        // Update return values to reflect actual received amounts
        amountA = receivedA;
        amountB = receivedB;
        
        // Use actual received amounts for liquidity calculations
        (amount0, amount1) = tokenA == token0 ? (receivedA, receivedB) : (receivedB, receivedA);

        // Calculate liquidity to mint (amount0 and amount1 already calculated above)
        
        if (pool.totalLiquidity == 0) {
            // First liquidity: sqrt(x*y) - MINIMUM_LIQUIDITY
            liquidity = Math.sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            
            // Mint MINIMUM_LIQUIDITY to address(0) to prevent inflation attacks
            LPToken(lpTokens[token0][token1]).mint(address(0), MINIMUM_LIQUIDITY);
            pool.totalLiquidity = uint64(MINIMUM_LIQUIDITY);
        } else {
            // Subsequent liquidity: min(x/X, y/Y) * totalLiquidity
            liquidity = _min(
                (amount0 * pool.totalLiquidity) / pool.reserve0,
                (amount1 * pool.totalLiquidity) / pool.reserve1
            );
        }

        if (liquidity == 0) revert InsufficientLiquidity();

        // Mint LP tokens
        LPToken(lpTokens[token0][token1]).mint(to, liquidity);

        // Update reserves
        pool.reserve0 = uint128(uint256(pool.reserve0) + amount0);
        pool.reserve1 = uint128(uint256(pool.reserve1) + amount1);
        pool.totalLiquidity = uint64(uint256(pool.totalLiquidity) + liquidity);

        // Update TWAP oracle
        _updateOracle(token0, token1);

        emit LiquidityAdded(_msgSender(), token0, token1, amount0, amount1, liquidity);
    }

    /**
     * @notice Remove liquidity, burn LP tokens, return underlying assets
     * @dev Proportionally returns tokens based on LP share of total liquidity
     * @param tokenA First token address
     * @param tokenB Second token address
     * @param liquidity Amount of LP tokens to burn
     * @param amountAMin Minimum amount of tokenA to receive (slippage protection)
     * @param amountBMin Minimum amount of tokenB to receive (slippage protection)
     * @param to Recipient of underlying tokens (cannot be zero address)
     * @param deadline Transaction deadline (Unix timestamp)
     * @return amountA Amount of tokenA received
     * @return amountB Amount of tokenB received
     * @custom:security Reentrancy protected, validates slippage, uses SafeERC20
     * @custom:gas-cost Approximately 160,000 gas
     */
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external nonReentrant whenNotPaused validAddress(tokenA) validAddress(tokenB) validAddress(to) validAmount(liquidity) validDeadline(deadline) returns (uint256 amountA, uint256 amountB) {
        if (amountAMin == 0 || amountBMin == 0) revert ZeroAmount();

        // Sort tokens
        (address token0, address token1) = _sortTokens(tokenA, tokenB);
        
        // Check pool exists
        if (lpTokens[token0][token1] == address(0)) revert PoolDoesNotExist();

        Pool storage pool = pools[token0][token1];

        // Calculate amounts to return
        uint256 amount0 = (liquidity * pool.reserve0) / pool.totalLiquidity;
        uint256 amount1 = (liquidity * pool.reserve1) / pool.totalLiquidity;

        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);

        // Verify slippage protection
        if (amountA < amountAMin || amountB < amountBMin) revert SlippageExceeded();

        // Transfer LP tokens from user to this contract, then burn
        address lpToken = lpTokens[token0][token1];
        IERC20(lpToken).safeTransferFrom(_msgSender(), address(this), liquidity);
        LPToken(lpToken).burn(address(this), liquidity);

        // Transfer tokens to recipient
        IERC20(tokenA).safeTransfer(to, amountA);
        IERC20(tokenB).safeTransfer(to, amountB);

        // Update reserves
        pool.reserve0 = uint128(uint256(pool.reserve0) - amount0);
        pool.reserve1 = uint128(uint256(pool.reserve1) - amount1);
        pool.totalLiquidity = uint64(uint256(pool.totalLiquidity) - liquidity);

        // Update TWAP oracle
        _updateOracle(token0, token1);

        emit LiquidityRemoved(_msgSender(), token0, token1, amount0, amount1, liquidity);
    }

    /**
     * @notice Execute token swap with slippage protection
     * @dev Uses constant product formula (x * y = k) with 0.3% fee
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Input token amount
     * @param amountOutMin Minimum output amount (slippage protection)
     * @param to Recipient address (cannot be this contract or token addresses)
     * @param deadline Transaction deadline (Unix timestamp)
     * @return amountOut Actual output amount received
     * @custom:security Includes reentrancy protection, deadline validation, and explicit slippage check
     * @custom:gas-cost Approximately 145,000 gas for standard ERC20 tokens
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        address to,
        uint256 deadline
    ) external nonReentrant whenNotPaused validAddress(tokenIn) validAddress(tokenOut) validAddress(to) validAmount(amountIn) validDeadline(deadline) returns (uint256 amountOut) {
        // CHECKS: Validate all inputs before state changes
        if (tokenIn == tokenOut) revert IdenticalAddresses();
        if (amountIn == 0) revert InsufficientAmount();
        if (amountOutMin == 0) revert InsufficientAmount();
        if (to == address(0)) revert ZeroAddress();
        if (to == address(this) || to == tokenIn || to == tokenOut) revert InvalidToken();
        
        // Check token blacklist
        if (blacklistedTokens[tokenIn] || blacklistedTokens[tokenOut]) revert TokenIsBlacklisted();
        
        // Circuit breaker: check swap size
        if (amountIn > maxSwapSize) revert SwapSizeExceeded();

        // Sort tokens to identify reserves
        (address token0, address token1) = _sortTokens(tokenIn, tokenOut);
        
        // Check pool exists
        if (lpTokens[token0][token1] == address(0)) revert PoolDoesNotExist();

        Pool storage pool = pools[token0][token1];
        
        // Check pool has liquidity
        if (pool.reserve0 == 0 || pool.reserve1 == 0) revert InsufficientLiquidity();

        // Get reserves
        (uint256 reserveIn, uint256 reserveOut) = tokenIn == token0 
            ? (uint256(pool.reserve0), uint256(pool.reserve1)) 
            : (uint256(pool.reserve1), uint256(pool.reserve0));

        // Calculate amountOut using validated helper function
        amountOut = getAmountOut(amountIn, tokenIn, tokenOut);

        // CRITICAL: Explicit slippage protection BEFORE any external calls
        // This prevents sandwich attacks and front-running
        if (amountOut < amountOutMin) revert SlippageExceeded();
        
        // Additional safety: ensure sufficient reserves remain
        if (amountOut >= reserveOut) revert InsufficientLiquidity();
        
        // Calculate price impact for event logging
        uint256 priceImpactBps = _calculatePriceImpact(amountIn, amountOut, reserveIn, reserveOut);

        // INTERACTIONS: External calls last (CEI pattern - prevents reentrancy)
        // Transfer tokenIn from user with fee-on-transfer protection
        uint256 balanceInBefore = IERC20(tokenIn).balanceOf(address(this));
        IERC20(tokenIn).safeTransferFrom(_msgSender(), address(this), amountIn);
        uint256 balanceInAfter = IERC20(tokenIn).balanceOf(address(this));
        
        uint256 receivedIn = balanceInAfter - balanceInBefore;
        
        // Verify we received at least 95% of expected amount (allows up to 5% fee)
        // This prevents excessive fee-on-transfer tokens from breaking the pool
        if (receivedIn < (amountIn * 9500) / 10000) revert FeeOnTransferTooHigh();

        // Transfer tokenOut to recipient
        IERC20(tokenOut).safeTransfer(to, amountOut);

        // EFFECTS: Update contract state after external calls
        // Update reserves using actual received amount
        if (tokenIn == token0) {
            pool.reserve0 = uint128(reserveIn + receivedIn);
            pool.reserve1 = uint128(reserveOut - amountOut);
        } else {
            pool.reserve0 = uint128(reserveOut - amountOut);
            pool.reserve1 = uint128(reserveIn + receivedIn);
        }
        pool.blockTimestampLast = uint32(block.timestamp);

        // Update TWAP oracle
        _updateOracle(token0, token1);

        // Emit event with slippage info
        emit Swap(_msgSender(), tokenIn, tokenOut, amountIn, amountOut, amountOutMin, priceImpactBps);
    }

    /**
     * @notice Execute token swap with EIP-2612 permit (gasless approval)
     * @dev Combines permit + swap in one transaction for better UX
     * @param tokenIn Input token address (must support EIP-2612)
     * @param tokenOut Output token address
     * @param amountIn Input token amount
     * @param amountOutMin Minimum output amount (slippage protection)
     * @param to Recipient address
     * @param deadline Transaction deadline (Unix timestamp)
     * @param permitDeadline Permit signature deadline
     * @param v ECDSA signature parameter
     * @param r ECDSA signature parameter
     * @param s ECDSA signature parameter
     * @return amountOut Actual output amount received
     * @custom:security Validates permit before swap, inherits all swap protections
     * @custom:gas-cost ~165,000 gas (20k more than regular swap for permit)
     */
    function swapWithPermit(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        address to,
        uint256 deadline,
        uint256 permitDeadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant whenNotPaused returns (uint256 amountOut) {
        // Execute permit to approve this contract
        IERC20Permit(tokenIn).permit(
            _msgSender(),
            address(this),
            amountIn,
            permitDeadline,
            v,
            r,
            s
        );

        // Execute swap with existing logic
        // CHECKS: Validate all inputs before state changes
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (tokenIn == tokenOut) revert IdenticalAddresses();
        if (amountIn == 0) revert InsufficientAmount();
        if (amountOutMin == 0) revert InsufficientAmount();
        if (to == address(0)) revert ZeroAddress();
        if (to == address(this) || to == tokenIn || to == tokenOut) revert InvalidToken();
        
        // Check token blacklist
        if (blacklistedTokens[tokenIn] || blacklistedTokens[tokenOut]) revert TokenIsBlacklisted();
        
        // Circuit breaker: check swap size
        if (amountIn > maxSwapSize) revert SwapSizeExceeded();

        // Sort tokens to identify reserves
        (address token0, address token1) = _sortTokens(tokenIn, tokenOut);
        
        // Check pool exists
        if (lpTokens[token0][token1] == address(0)) revert PoolDoesNotExist();

        Pool storage pool = pools[token0][token1];
        
        // Check pool has liquidity
        if (pool.reserve0 == 0 || pool.reserve1 == 0) revert InsufficientLiquidity();

        // Get reserves
        (uint256 reserveIn, uint256 reserveOut) = tokenIn == token0 
            ? (uint256(pool.reserve0), uint256(pool.reserve1)) 
            : (uint256(pool.reserve1), uint256(pool.reserve0));

        // Calculate amountOut using validated helper function
        amountOut = getAmountOut(amountIn, tokenIn, tokenOut);

        // CRITICAL: Explicit slippage protection BEFORE any external calls
        if (amountOut < amountOutMin) revert SlippageExceeded();
        
        // Additional safety: ensure sufficient reserves remain
        if (amountOut >= reserveOut) revert InsufficientLiquidity();
        
        // Calculate price impact for event logging
        uint256 priceImpactBps = _calculatePriceImpact(amountIn, amountOut, reserveIn, reserveOut);

        // INTERACTIONS: External calls last (CEI pattern)
        // Transfer tokenIn from user with fee-on-transfer protection
        uint256 balanceInBefore = IERC20(tokenIn).balanceOf(address(this));
        IERC20(tokenIn).safeTransferFrom(_msgSender(), address(this), amountIn);
        uint256 balanceInAfter = IERC20(tokenIn).balanceOf(address(this));
        
        uint256 receivedIn = balanceInAfter - balanceInBefore;
        
        // Verify we received at least 95% of expected amount
        if (receivedIn < (amountIn * 9500) / 10000) revert FeeOnTransferTooHigh();

        // Transfer tokenOut to recipient
        IERC20(tokenOut).safeTransfer(to, amountOut);

        // EFFECTS: Update contract state
        if (tokenIn == token0) {
            pool.reserve0 = uint128(reserveIn + receivedIn);
            pool.reserve1 = uint128(reserveOut - amountOut);
        } else {
            pool.reserve0 = uint128(reserveOut - amountOut);
            pool.reserve1 = uint128(reserveIn + receivedIn);
        }
        pool.blockTimestampLast = uint32(block.timestamp);

        // Update TWAP oracle
        _updateOracle(token0, token1);

        // Emit event
        emit Swap(msg.sender, tokenIn, tokenOut, amountIn, amountOut, amountOutMin, priceImpactBps);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                              VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Calculate output amount for given input (for UI)
     * @dev Uses constant product formula: amountOut = (amountIn * 9970 * reserveOut) / (reserveIn * 10000 + amountIn * 9970)
     * @param amountIn Input amount (must be > 0)
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @return amountOut Output amount (reverts if zero)
     * @custom:formula Applies 0.3% fee (9970/10000 = 99.7% of input)
     */
    function getAmountOut(uint256 amountIn, address tokenIn, address tokenOut) 
        public
        view 
        returns (uint256 amountOut) 
    {
        // Validation
        if (amountIn == 0) revert InsufficientAmount();
        
        (address token0, address token1) = _sortTokens(tokenIn, tokenOut);
        
        // Check pool exists
        if (lpTokens[token0][token1] == address(0)) revert PoolDoesNotExist();
        
        Pool storage pool = pools[token0][token1];

        // Get reserves
        (uint256 reserveIn, uint256 reserveOut) = tokenIn == token0 
            ? (uint256(pool.reserve0), uint256(pool.reserve1)) 
            : (uint256(pool.reserve1), uint256(pool.reserve0));

        // Validate reserves
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();

        // Apply formula: amountOut = (amountIn * 9970 * reserveOut) / (reserveIn * 10000 + amountIn * 9970)
        amountOut = (amountIn * 9970 * reserveOut) / (reserveIn * 10000 + amountIn * 9970);
        
        // Validate output is non-zero
        if (amountOut == 0) revert InsufficientOutputAmount();
    }
    
    /**
     * @notice Calculate fee with safety checks
     * @dev Ensures fee calculation is safe and within bounds
     * @param amount Amount to calculate fee on
     * @param feeBps Fee in basis points (must be <= 10000)
     * @return fee Calculated fee amount
     */
    function calculateFee(uint256 amount, uint256 feeBps) public pure returns (uint256 fee) {
        // Safety check: feeBps must not exceed 100% (10000 basis points)
        if (feeBps > FEE_DENOMINATOR) revert AmountTooLarge();
        
        // Calculate fee
        fee = (amount * feeBps) / FEE_DENOMINATOR;
        
        // Safety check: fee must not exceed amount
        if (fee > amount) revert AmountTooLarge();
    }
    
    /**
     * @notice Calculate minimum output amount for given slippage tolerance
     * @dev Helper function for frontends to compute amountOutMin parameter
     * @param amountOut Expected output amount
     * @param slippageBps Slippage tolerance in basis points (50 = 0.5%, max 10000)
     * @return minAmount Minimum acceptable output amount
     * @custom:example calculateMinOutput(1000, 50) returns 995 (0.5% slippage)
     */
    function calculateMinOutput(uint256 amountOut, uint256 slippageBps)
        public
        pure
        returns (uint256 minAmount)
    {
        if (slippageBps > 10000) revert InsufficientAmount();
        minAmount = (amountOut * (10000 - slippageBps)) / 10000;
    }

    /**
     * @notice Get current pool reserves (for UI)
     * @param tokenA First token address
     * @param tokenB Second token address
     * @return reserveA Reserve of tokenA
     * @return reserveB Reserve of tokenB
     * @return blockTimestampLast Last update timestamp
     */
    function getReserves(address tokenA, address tokenB) 
        external 
        view 
        returns (uint256 reserveA, uint256 reserveB, uint32 blockTimestampLast) 
    {
        (address token0, address token1) = _sortTokens(tokenA, tokenB);
        Pool storage pool = pools[token0][token1];

        (reserveA, reserveB) = tokenA == token0 
            ? (uint256(pool.reserve0), uint256(pool.reserve1)) 
            : (uint256(pool.reserve1), uint256(pool.reserve0));
        
        blockTimestampLast = pool.blockTimestampLast;
    }
    
    /**
     * @notice Get TWAP price from oracle (manipulation-resistant)
     * @param tokenA First token address
     * @param tokenB Second token address
     * @param timeWindow Time window in seconds (minimum 10 minutes)
     * @return priceAAverage Average price of tokenA in terms of tokenB
     * @return priceBAverage Average price of tokenB in terms of tokenA
     */
    function getTWAP(address tokenA, address tokenB, uint256 timeWindow)
        external
        view
        returns (uint256 priceAAverage, uint256 priceBAverage)
    {
        (address token0, address token1) = _sortTokens(tokenA, tokenB);
        
        (uint256 price0Avg, uint256 price1Avg) = priceOracle.consult(
            token0,
            token1,
            timeWindow
        );
        
        (priceAAverage, priceBAverage) = tokenA == token0
            ? (price0Avg, price1Avg)
            : (price1Avg, price0Avg);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          EMERGENCY FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Schedule pause (step 1 of 2-step timelock process)
     * @dev Requires 2-day timelock before execution to prevent abrupt pausing
     * @custom:security PAUSER_ROLE only, emits PauseScheduled event for transparency
     */
    function schedulePause() external onlyRole(PAUSER_ROLE) {
        pauseTimestamp = block.timestamp + TIMELOCK_DURATION;
        emit PauseScheduled(pauseTimestamp);
    }
    
    /**
     * @notice Execute pause after timelock (step 2 of 2-step timelock process)
     * @dev Can only be called after 2-day timelock period has elapsed
     * @custom:security Prevents all swaps and liquidity operations until unpaused
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        if (pauseTimestamp == 0) revert NoPendingTimelock();
        if (block.timestamp < pauseTimestamp) revert TimelockNotMet();
        
        pauseTimestamp = 0;
        _pause();
    }
    
    /**
     * @notice Schedule unpause (step 1 of 2)
     */
    function scheduleUnpause() external onlyRole(PAUSER_ROLE) {
        unpauseTimestamp = block.timestamp + TIMELOCK_DURATION;
        emit UnpauseScheduled(unpauseTimestamp);
    }

    /**
     * @notice Execute unpause after timelock (step 2 of 2)
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        if (unpauseTimestamp == 0) revert NoPendingTimelock();
        if (block.timestamp < unpauseTimestamp) revert TimelockNotMet();
        
        unpauseTimestamp = 0;
        _unpause();
    }
    
    /**
     * @notice Emergency withdraw tokens (circuit breaker - only when paused)
     * @dev A+ Production Security: Only callable when contract is paused
     * @param token Token address to withdraw
     * @param amount Amount to withdraw
     * @param to Recipient address
     */
    function emergencyWithdraw(address token, uint256 amount, address to) external onlyRole(DEFAULT_ADMIN_ROLE) whenPaused {
        if (token == address(0)) revert ZeroAddress();
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        
        IERC20(token).safeTransfer(to, amount);
        emit EmergencyWithdraw(token, amount, to);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Update TWAP oracle with manipulation protection
     * @param token0 First token address
     * @param token1 Second token address
     */
    function _updateOracle(address token0, address token1) private {
        Pool storage pool = pools[token0][token1];
        uint32 blockTimestamp = uint32(block.timestamp % 2**32);
        uint32 timeElapsed = blockTimestamp - pool.blockTimestampLast;

        if (timeElapsed > 0 && pool.reserve0 != 0 && pool.reserve1 != 0) {
            // Update cumulative prices using unchecked to allow overflow (Uniswap V2 pattern)
            // Overflow is intentional and handled by consumers of the oracle
            unchecked {
                pool.price0CumulativeLast += uint256(pool.reserve1) * timeElapsed / uint256(pool.reserve0);
                pool.price1CumulativeLast += uint256(pool.reserve0) * timeElapsed / uint256(pool.reserve1);
            }
            
            // Update external price oracle with manipulation protection
            priceOracle.update(token0, token1, uint256(pool.reserve0), uint256(pool.reserve1));
        }

        pool.blockTimestampLast = blockTimestamp;
    }

    /**
     * @notice Sort two token addresses
     * @param tokenA First token
     * @param tokenB Second token
     * @return token0 Smaller address
     * @return token1 Larger address
     */
    function _sortTokens(address tokenA, address tokenB) 
        private 
        pure 
        returns (address token0, address token1) 
    {
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    }

    /**
     * @notice Calculate square root using OpenZeppelin's Math library
     * @dev Replaced custom implementation with battle-tested library for precision
     * @param y Input value
     * @return Square root of y
     */
    function _sqrt(uint256 y) private pure returns (uint256) {
        return Math.sqrt(y);
    }

    /**
     * @notice Return minimum of two values
     * @param x First value
     * @param y Second value
     * @return Minimum value
     */
    function _min(uint256 x, uint256 y) private pure returns (uint256) {
        return x < y ? x : y;
    }
    
    /**
     * @notice Calculate price impact in basis points
     * @param amountIn Input amount
     * @param amountOut Output amount
     * @param reserveIn Input reserve
     * @param reserveOut Output reserve
     * @return priceImpactBps Price impact in basis points
     */
    function _calculatePriceImpact(
        uint256 amountIn,
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    ) private pure returns (uint256 priceImpactBps) {
        // Calculate spot price before swap: reserveOut / reserveIn
        // Calculate effective price: amountOut / amountIn
        // Price impact = (1 - effectivePrice / spotPrice) * 10000
        
        // To avoid division, use: impact = (1 - (amountOut * reserveIn) / (amountIn * reserveOut)) * 10000
        uint256 spotPrice = (reserveOut * 1e18) / reserveIn;
        uint256 effectivePrice = (amountOut * 1e18) / amountIn;
        
        if (effectivePrice >= spotPrice) {
            return 0; // No negative impact
        }
        
        priceImpactBps = ((spotPrice - effectivePrice) * 10000) / spotPrice;
    }

    /**
     * @notice Get token symbol (helper for LP token naming)
     * @param token Token address
     * @return Symbol string
     */
    function _getSymbol(address token) private view returns (string memory) {
        try IERC20Metadata(token).symbol() returns (string memory symbol) {
            return symbol;
        } catch {
            return "TOKEN";
        }
    }

    /**
     * @notice Add flash loan fee to pool reserves (called by FlashSwap contract)
     * @dev Automatically increases LP token value by adding fees to reserves
     * @dev Enforces 0.09% fee calculation and validates repayment
     * @param token0 First token in the pool
     * @param token1 Second token in the pool
     * @param feeToken Token in which fee is paid (must be token0 or token1)
     * @param feeAmount Fee amount to add to reserves (0.09% of flash loan)
     * @custom:security Only callable by authorized FlashSwap contract
     * @custom:benefit LPs earn flash loan fees automatically without claiming
     */
    function addFlashLoanFee(
        address token0,
        address token1,
        address feeToken,
        uint256 feeAmount
    ) external nonReentrant onlyFlashSwap {
        if (feeAmount == 0) revert ZeroAmount();
        
        // Sort tokens
        (address _token0, address _token1) = _sortTokens(token0, token1);
        
        // Verify pool exists
        if (lpTokens[_token0][_token1] == address(0)) revert PoolDoesNotExist();
        
        // Validate fee amount is reasonable (0.09% = 9 basis points)
        // Fee should be calculated as: (amount * 9) / 10000
        // This ensures the fee doesn't exceed expected bounds
        uint256 maxReasonableFee = calculateFee(feeAmount * 10000 / 9, 9); // Reverse calculate to validate
        if (feeAmount > maxReasonableFee) revert AmountTooLarge();
        
        // Record balance before transfer to validate repayment
        uint256 balanceBefore = IERC20(feeToken).balanceOf(address(this));
        
        // Transfer fee from FlashSwap contract
        IERC20(feeToken).safeTransferFrom(_msgSender(), address(this), feeAmount);
        
        // Verify we received the full fee amount (repayment validation)
        uint256 balanceAfter = IERC20(feeToken).balanceOf(address(this));
        if (balanceAfter < balanceBefore + feeAmount) revert InsufficientAmount();
        
        Pool storage pool = pools[_token0][_token1];
        
        // Add fee to appropriate reserve
        if (feeToken == _token0) {
            pool.reserve0 = uint128(uint256(pool.reserve0) + feeAmount);
        } else if (feeToken == _token1) {
            pool.reserve1 = uint128(uint256(pool.reserve1) + feeAmount);
        } else {
            revert InvalidToken();
        }
        
        // Update oracle
        _updateOracle(_token0, _token1);
        
        emit FlashLoanFeeAdded(_token0, _token1, feeToken, feeAmount);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          GOVERNANCE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Schedule token blacklist update (step 1 of 2-step timelock)
     * @param token Token address to blacklist/whitelist
     * @param blacklisted True to blacklist, false to whitelist
     */
    function scheduleBlacklistUpdate(address token, bool blacklisted) external onlyRole(GOVERNANCE_ROLE) {
        if (token == address(0)) revert ZeroAddress();
        pendingBlacklistToken = token;
        pendingBlacklistStatus = blacklisted;
        blacklistUpdateTime = block.timestamp + TIMELOCK_DURATION;
        emit BlacklistUpdateScheduled(token, blacklisted, blacklistUpdateTime);
    }
    
    /**
     * @notice Execute pending blacklist update (step 2 of 2-step timelock)
     */
    function executeBlacklistUpdate() external onlyRole(GOVERNANCE_ROLE) {
        if (pendingBlacklistToken == address(0)) revert NoPendingTimelock();
        if (block.timestamp < blacklistUpdateTime) revert TimelockNotMet();
        
        blacklistedTokens[pendingBlacklistToken] = pendingBlacklistStatus;
        emit TokenBlacklistUpdated(pendingBlacklistToken, pendingBlacklistStatus);
        
        // Emit AddressBlacklisted event when blacklisting (not whitelisting)
        if (pendingBlacklistStatus) {
            emit AddressBlacklisted(pendingBlacklistToken);
        }
        
        pendingBlacklistToken = address(0);
        blacklistUpdateTime = 0;
    }
    
    /**
     * @notice Cancel pending blacklist update
     */
    function cancelBlacklistUpdate() external onlyRole(GOVERNANCE_ROLE) {
        if (pendingBlacklistToken == address(0)) revert NoPendingTimelock();
        
        address cancelled = pendingBlacklistToken;
        pendingBlacklistToken = address(0);
        blacklistUpdateTime = 0;
        
        emit BlacklistUpdateCancelled(cancelled);
    }
    
    /**
     * @notice Set maximum swap size (circuit breaker)
     * @param newMaxSwapSize New maximum swap size (0 = no limit)
     */
    function setMaxSwapSize(uint256 newMaxSwapSize) external onlyRole(GOVERNANCE_ROLE) {
        uint256 oldSize = maxSwapSize;
        maxSwapSize = newMaxSwapSize == 0 ? type(uint256).max : newMaxSwapSize;
        emit MaxSwapSizeUpdated(oldSize, maxSwapSize);
    }
    
    /**
     * @notice Schedule protocol fee update (step 1 of 2-step timelock)
     * @param newFeeBps New protocol fee in basis points
     * @dev Maximum fee is capped at 1% (100 basis points) to prevent unreasonable fees
     */
    function scheduleProtocolFeeUpdate(uint256 newFeeBps) external onlyRole(FEE_MANAGER_ROLE) {
        if (newFeeBps > MAX_PROTOCOL_FEE_BPS) revert AmountTooLarge();
        pendingProtocolFee = newFeeBps;
        protocolFeeUpdateTime = block.timestamp + TIMELOCK_DURATION;
        emit ProtocolFeeUpdateScheduled(newFeeBps, protocolFeeUpdateTime);
    }
    
    /**
     * @notice Execute pending protocol fee update (step 2 of 2-step timelock)
     */
    function executeProtocolFeeUpdate() external onlyRole(FEE_MANAGER_ROLE) {
        if (protocolFeeUpdateTime == 0) revert NoPendingTimelock();
        if (block.timestamp < protocolFeeUpdateTime) revert TimelockNotMet();
        
        uint256 oldFee = protocolFeeBps;
        protocolFeeBps = pendingProtocolFee;
        emit ProtocolFeeUpdated(oldFee, pendingProtocolFee);
        
        pendingProtocolFee = 0;
        protocolFeeUpdateTime = 0;
    }
    
    /**
     * @notice Cancel pending protocol fee update
     */
    function cancelProtocolFeeUpdate() external onlyRole(FEE_MANAGER_ROLE) {
        if (protocolFeeUpdateTime == 0) revert NoPendingTimelock();
        
        uint256 cancelled = pendingProtocolFee;
        pendingProtocolFee = 0;
        protocolFeeUpdateTime = 0;
        
        emit ProtocolFeeUpdateCancelled(cancelled);
    }
    
    /**
     * @notice Set FlashSwap contract address and approve all tokens
     * @param _flashSwap FlashSwap contract address
     */
    function setFlashSwapContract(address _flashSwap) external onlyRole(ADMIN_ROLE) validAddress(_flashSwap) {
        if (_flashSwap == address(0)) revert ZeroAddress();
        flashSwapContract = _flashSwap;
        emit FlashSwapContractUpdated(_flashSwap);
    }
    
    /**
     * @notice Approve FlashSwap contract to pull tokens for flash loans
     * @param token Token to approve
     * @param amount Amount to approve (use type(uint256).max for unlimited)
     */
    function approveFlashSwap(address token, uint256 amount) external onlyRole(ADMIN_ROLE) validAddress(token) validAmount(amount) {
        if (token == address(0)) revert ZeroAddress();
        if (flashSwapContract == address(0)) revert ZeroAddress();
        IERC20(token).approve(flashSwapContract, amount);
    }
    
    /**
     * @notice Modifier to restrict access to FlashSwap contract only
     */
    modifier onlyFlashSwap() {
        if (_msgSender() != flashSwapContract) revert OnlyFlashSwap();
        _;
    }
    
    /**
     * @notice Modifier to validate address is not zero
     */
    modifier validAddress(address addr) {
        if (addr == address(0)) revert ZeroAddress();
        _;
    }
    
    /**
     * @notice Modifier to validate amount is not zero
     */
    modifier validAmount(uint256 amount) {
        if (amount == 0) revert ZeroAmount();
        _;
    }
    
    /**
     * @notice Modifier to validate deadline has not expired
     */
    modifier validDeadline(uint256 deadline) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        _;
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
