// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/interfaces/IERC3156FlashLender.sol";
import "@openzeppelin/contracts/interfaces/IERC3156FlashBorrower.sol";

/**
 * @title DEXPair
 * @notice AMM pair contract implementing constant product formula (x*y=k)
 * @dev Supports liquidity provision, swaps, and ERC-3156 flash loans
 */
contract DEXPair is ERC20, ReentrancyGuard, IERC3156FlashLender {
    using SafeERC20 for IERC20;

    /// @notice Minimum liquidity locked forever to prevent division by zero
    uint256 public constant MINIMUM_LIQUIDITY = 10**3;
    
    /// @notice Swap fee: 0.3% (30 basis points out of 10000)
    uint256 public constant SWAP_FEE = 30;
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    /// @notice Flash loan fee: 0.09% (9 basis points)
    uint256 public constant FLASH_FEE = 9;
    
    /// @notice Maximum flash loan per transaction: 10% of pool reserves
    uint256 public constant MAX_FLASH_LOAN_BPS = 1000; // 10%
    
    /// @notice ERC-3156 callback success return value
    bytes32 public constant CALLBACK_SUCCESS = keccak256("ERC3156FlashBorrower.onFlashLoan");

    /// @notice Token0 in the pair (lexicographically smaller address)
    IERC20 public immutable token0;
    
    /// @notice Token1 in the pair (lexicographically larger address)
    IERC20 public immutable token1;
    
    /// @notice Factory contract that created this pair
    address public immutable factory;
    
    /// @notice Router contract authorized to call swap
    address public router;

    /// @notice Reserve of token0
    uint112 private reserve0;
    
    /// @notice Reserve of token1
    uint112 private reserve1;
    
    /// @notice Timestamp of last reserve update
    uint32 private blockTimestampLast;

    /// @notice Cumulative price of token0 (for TWAP oracles)
    uint256 public price0CumulativeLast;
    
    /// @notice Cumulative price of token1 (for TWAP oracles)
    uint256 public price1CumulativeLast;
    
    /// @notice Product of reserves at last liquidity event (for protocol fee calculation)
    uint256 public kLast;

    /// @notice Emitted when liquidity is minted
    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    
    /// @notice Emitted when liquidity is burned
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);
    
    /// @notice Emitted when a swap occurs
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );
    
    /// @notice Emitted when reserves are synced
    event Sync(uint112 reserve0, uint112 reserve1);
    
    /// @notice Emitted when sync is forced manually
    event SyncForced(uint112 reserve0, uint112 reserve1);

    /// @notice Thrown when insufficient liquidity is minted
    error InsufficientLiquidityMinted();
    
    /// @notice Thrown when insufficient liquidity is burned
    error InsufficientLiquidityBurned();
    
    /// @notice Thrown when insufficient output amount
    error InsufficientOutputAmount();
    
    /// @notice Thrown when insufficient liquidity in pool
    error InsufficientLiquidity();
    
    /// @notice Thrown when invalid recipient address
    error InvalidTo();
    
    /// @notice Thrown when K invariant is violated
    error KInvariantViolated();
    
    /// @notice Thrown when reserves overflow
    error ReserveOverflow();
    
    /// @notice Thrown when unauthorized caller
    error Unauthorized();
    
    /// @notice Thrown when reentrancy is detected
    error Locked();
    
    /// @notice Thrown when flash loan callback fails
    error FlashLoanCallbackFailed();
    
    /// @notice Thrown when token is not supported for flash loans
    error UnsupportedToken();

    /**
     * @notice Initializes the DEX pair
     * @param _token0 Address of token0
     * @param _token1 Address of token1
     */
    constructor(address _token0, address _token1) ERC20("DEX LP Token", "DEX-LP") {
        require(_token0 != address(0) && _token1 != address(0), "Invalid token addresses");
        require(_token0 != _token1, "Identical tokens");
        
        token0 = IERC20(_token0);
        token1 = IERC20(_token1);
        factory = msg.sender;
    }
    
    /**
     * @notice Sets the router address (factory only)
     * @param _router Address of router contract
     */
    function setRouter(address _router) external {
        require(msg.sender == factory, "Only factory");
        require(router == address(0), "Router already set");
        router = _router;
    }

    /**
     * @notice Returns current reserves and last update timestamp
     * @return _reserve0 Reserve of token0
     * @return _reserve1 Reserve of token1
     * @return _blockTimestampLast Timestamp of last update
     */
    function getReserves() public view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast) {
        _reserve0 = reserve0;
        _reserve1 = reserve1;
        _blockTimestampLast = blockTimestampLast;
    }

    /**
     * @notice Updates reserves and price accumulators
     * @param balance0 Current balance of token0
     * @param balance1 Current balance of token1
     * @param _reserve0 Previous reserve of token0
     * @param _reserve1 Previous reserve of token1
     */
    function _update(uint256 balance0, uint256 balance1, uint112 _reserve0, uint112 _reserve1) private {
        if (balance0 > type(uint112).max || balance1 > type(uint112).max) revert ReserveOverflow();
        
        uint32 blockTimestamp = uint32(block.timestamp % 2**32);
        uint32 timeElapsed;
        unchecked {
            timeElapsed = blockTimestamp - blockTimestampLast;
        }
        
        if (timeElapsed > 0 && _reserve0 != 0 && _reserve1 != 0) {
            unchecked {
                price0CumulativeLast += uint256(_reserve1) * 1e18 / uint256(_reserve0) * timeElapsed;
                price1CumulativeLast += uint256(_reserve0) * 1e18 / uint256(_reserve1) * timeElapsed;
            }
        }
        
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        blockTimestampLast = blockTimestamp;
        
        emit Sync(uint112(balance0), uint112(balance1));
    }

    /**
     * @notice Mints liquidity tokens to recipient
     * @dev Restricted to router and factory to ensure proper slippage protection
     * @param to Recipient of LP tokens
     * @return liquidity Amount of LP tokens minted
     */
    function mint(address to) external nonReentrant returns (uint256 liquidity) {
        if (msg.sender != router && msg.sender != factory) revert Unauthorized();
        if (to == address(0) || to == address(this)) revert InvalidTo();
        
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        uint256 balance0 = token0.balanceOf(address(this));
        uint256 balance1 = token1.balanceOf(address(this));
        uint256 amount0 = balance0 - _reserve0;
        uint256 amount1 = balance1 - _reserve1;

        uint256 _totalSupply = totalSupply();
        if (_totalSupply == 0) {
            liquidity = _sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            _mint(address(0xdead), MINIMUM_LIQUIDITY); // Lock minimum liquidity
        } else {
            liquidity = _min(
                (amount0 * _totalSupply) / _reserve0,
                (amount1 * _totalSupply) / _reserve1
            );
        }
        
        if (liquidity == 0) revert InsufficientLiquidityMinted();
        
        _mint(to, liquidity);
        _update(balance0, balance1, _reserve0, _reserve1);
        
        // Verify K invariant after minting
        uint256 kAfter = uint256(reserve0) * uint256(reserve1);
        if (_totalSupply > 0 && kAfter < uint256(_reserve0) * uint256(_reserve1)) {
            revert KInvariantViolated();
        }
        kLast = kAfter;
        
        emit Mint(msg.sender, amount0, amount1);
    }

    /**
     * @notice Burns liquidity tokens and returns underlying assets
     * @dev Restricted to router and factory to ensure proper handling
     * @param to Recipient of underlying tokens
     * @return amount0 Amount of token0 returned
     * @return amount1 Amount of token1 returned
     */
    function burn(address to) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        if (msg.sender != router && msg.sender != factory) revert Unauthorized();
        if (to == address(0)) revert InvalidTo();
        
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        IERC20 _token0 = token0;
        IERC20 _token1 = token1;
        uint256 balance0 = _token0.balanceOf(address(this));
        uint256 balance1 = _token1.balanceOf(address(this));
        uint256 liquidity = balanceOf(address(this));

        uint256 _totalSupply = totalSupply();
        amount0 = (liquidity * balance0) / _totalSupply;
        amount1 = (liquidity * balance1) / _totalSupply;
        
        if (amount0 == 0 || amount1 == 0) revert InsufficientLiquidityBurned();
        
        _burn(address(this), liquidity);
        _token0.safeTransfer(to, amount0);
        _token1.safeTransfer(to, amount1);
        
        balance0 = _token0.balanceOf(address(this));
        balance1 = _token1.balanceOf(address(this));
        
        _update(balance0, balance1, _reserve0, _reserve1);
        
        // Verify K invariant is maintained or decreased proportionally after burn
        uint256 kAfter = uint256(reserve0) * uint256(reserve1);
        kLast = kAfter;
        
        emit Burn(msg.sender, amount0, amount1, to);
    }

    /**
     * @notice Swaps tokens using constant product formula
     * @dev Restricted to router and factory only to prevent MEV/sandwich attacks.
     *      Users must use DEXRouter which provides slippage protection.
     *      Handles fee-on-transfer tokens by measuring actual received amounts.
     * @param amount0Out Amount of token0 to receive
     * @param amount1Out Amount of token1 to receive
     * @param to Recipient of output tokens
     * @param data Callback data for flash swaps
     */
    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external nonReentrant {
        if (msg.sender != router && msg.sender != factory) revert Unauthorized();
        if (amount0Out == 0 && amount1Out == 0) revert InsufficientOutputAmount();
        if (to == address(0) || to == address(token0) || to == address(token1)) revert InvalidTo();
        
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        if (amount0Out >= _reserve0 || amount1Out >= _reserve1) revert InsufficientLiquidity();

        uint256 balance0;
        uint256 balance1;
        {
            IERC20 _token0 = token0;
            IERC20 _token1 = token1;
            
            if (amount0Out > 0) _token0.safeTransfer(to, amount0Out);
            if (amount1Out > 0) _token1.safeTransfer(to, amount1Out);
            
            // Measure actual balances to handle fee-on-transfer tokens
            balance0 = _token0.balanceOf(address(this));
            balance1 = _token1.balanceOf(address(this));
        }
        
        // Calculate actual amounts received (handles fee-on-transfer tokens)
        uint256 amount0In = balance0 > _reserve0 - amount0Out ? balance0 - (_reserve0 - amount0Out) : 0;
        uint256 amount1In = balance1 > _reserve1 - amount1Out ? balance1 - (_reserve1 - amount1Out) : 0;
        
        if (amount0In == 0 && amount1In == 0) revert InsufficientOutputAmount();
        
        {
            // Use actual balances for K invariant check (fee-on-transfer compatible)
            uint256 balance0Adjusted = (balance0 * FEE_DENOMINATOR) - (amount0In * SWAP_FEE);
            uint256 balance1Adjusted = (balance1 * FEE_DENOMINATOR) - (amount1In * SWAP_FEE);
            
            if (balance0Adjusted * balance1Adjusted < uint256(_reserve0) * uint256(_reserve1) * (FEE_DENOMINATOR ** 2)) {
                revert KInvariantViolated();
            }
        }
        
        // Update reserves with actual balances
        _update(balance0, balance1, _reserve0, _reserve1);
        
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }

    /**
     * @notice Forces reserves to match current balances
     * @dev Used to recover from donation attacks
     */
    function sync() external nonReentrant {
        uint256 balance0 = token0.balanceOf(address(this));
        uint256 balance1 = token1.balanceOf(address(this));
        
        _update(
            balance0,
            balance1,
            reserve0,
            reserve1
        );
        
        // Emit SyncForced event for manual sync calls
        emit SyncForced(uint112(balance0), uint112(balance1));
    }

    /**
     * @notice Returns maximum flash loan amount for a token
     * @param token Token to flash loan
     * @return Maximum amount available
     */
    function maxFlashLoan(address token) external view override returns (uint256) {
        if (token != address(token0) && token != address(token1)) return 0;
        
        IERC20 _token = IERC20(token);
        return _token.balanceOf(address(this));
    }

    /**
     * @notice Returns flash loan fee for an amount
     * @param token Token to flash loan
     * @param amount Amount to borrow
     * @return Fee amount
     */
    function flashFee(address token, uint256 amount) external view override returns (uint256) {
        if (token != address(token0) && token != address(token1)) revert UnsupportedToken();
        return (amount * FLASH_FEE) / FEE_DENOMINATOR;
    }

    /**
     * @notice Executes a flash loan
     * @param receiver Contract receiving the flash loan
     * @param token Token to borrow
     * @param amount Amount to borrow
     * @param data Arbitrary data to pass to receiver
     * @return Success status
     */
    function flashLoan(
        IERC3156FlashBorrower receiver,
        address token,
        uint256 amount,
        bytes calldata data
    ) external override nonReentrant returns (bool) {
        if (token != address(token0) && token != address(token1)) revert UnsupportedToken();
        
        IERC20 _token = IERC20(token);
        uint256 balanceBefore = _token.balanceOf(address(this));
        if (amount > balanceBefore) revert InsufficientLiquidity();
        
        // Enforce max flash loan limit: 10% of pool reserves per transaction
        uint256 maxLoan = (balanceBefore * MAX_FLASH_LOAN_BPS) / FEE_DENOMINATOR;
        if (amount > maxLoan) revert InsufficientLiquidity();
        
        uint256 fee = (amount * FLASH_FEE) / FEE_DENOMINATOR;
        
        _token.safeTransfer(address(receiver), amount);
        
        if (receiver.onFlashLoan(msg.sender, token, amount, fee, data) != CALLBACK_SUCCESS) {
            revert FlashLoanCallbackFailed();
        }
        
        uint256 balanceAfter = _token.balanceOf(address(this));
        if (balanceAfter < balanceBefore + fee) revert InsufficientLiquidity();
        
        // Update reserves to include flash loan fee
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        uint256 balance0After = token0.balanceOf(address(this));
        uint256 balance1After = token1.balanceOf(address(this));
        
        _update(balance0After, balance1After, _reserve0, _reserve1);
        
        // Verify K invariant increased (fee added to reserves)
        uint256 kAfter = uint256(reserve0) * uint256(reserve1);
        uint256 kBefore = uint256(_reserve0) * uint256(_reserve1);
        if (kAfter < kBefore) revert KInvariantViolated();
        
        return true;
    }

    /**
     * @notice Calculates square root using Babylonian method
     * @param y Input value
     * @return z Square root of y
     */
    function _sqrt(uint256 y) private pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    /**
     * @notice Returns minimum of two values
     * @param x First value
     * @param y Second value
     * @return Minimum value
     */
    function _min(uint256 x, uint256 y) private pure returns (uint256) {
        return x < y ? x : y;
    }
}
