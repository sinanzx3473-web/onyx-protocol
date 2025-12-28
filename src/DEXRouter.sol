// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "./DEXFactory.sol";
import "./DEXPair.sol";

/**
 * @title DEXRouter
 * @notice Router contract for multi-hop swaps and liquidity operations
 * @dev Provides user-friendly interface for interacting with DEX pairs
 * @dev Supports EIP-2771 meta-transactions for gasless UX
 */
contract DEXRouter is ReentrancyGuard, Pausable, Ownable, ERC2771Context {
    using SafeERC20 for IERC20;

    /// @notice Factory contract address
    DEXFactory public immutable factory;
    
    /// @notice WETH contract address for ETH wrapping
    address public immutable WETH;

    /// @notice Thrown when deadline has passed
    error Expired();
    
    /// @notice Thrown when insufficient output amount
    error InsufficientOutputAmount();
    
    /// @notice Thrown when insufficient input amount
    error InsufficientInputAmount();
    
    /// @notice Thrown when invalid path
    error InvalidPath();
    
    /// @notice Thrown when pair doesn't exist
    error PairNotFound();
    
    /// @notice Thrown when excessive input amount required
    error ExcessiveInputAmount();
    
    /// @notice Thrown when insufficient A amount
    error InsufficientAAmount();
    
    /// @notice Thrown when insufficient B amount
    error InsufficientBAmount();

    /**
     * @notice Ensures deadline has not passed
     * @param deadline Transaction deadline timestamp
     */
    modifier ensure(uint256 deadline) {
        if (block.timestamp > deadline) revert Expired();
        _;
    }

    /**
     * @notice Initializes the router
     * @param _factory Factory contract address
     * @param _WETH WETH contract address
     * @param _trustedForwarder MinimalForwarder address for meta-transactions
     */
    constructor(address _factory, address _WETH, address _trustedForwarder) 
        Ownable(msg.sender) 
        ERC2771Context(_trustedForwarder) 
    {
        require(_factory != address(0) && _WETH != address(0), "Invalid addresses");
        factory = DEXFactory(_factory);
        WETH = _WETH;
    }

    /**
     * @notice Pause all router operations (emergency use)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause router operations
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Adds liquidity to a token pair
     * @param tokenA First token address
     * @param tokenB Second token address
     * @param amountADesired Desired amount of tokenA
     * @param amountBDesired Desired amount of tokenB
     * @param amountAMin Minimum amount of tokenA
     * @param amountBMin Minimum amount of tokenB
     * @param to Recipient of LP tokens
     * @param deadline Transaction deadline
     * @return amountA Actual amount of tokenA added
     * @return amountB Actual amount of tokenB added
     * @return liquidity Amount of LP tokens minted
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
    ) external ensure(deadline) nonReentrant whenNotPaused returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        (amountA, amountB) = _addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin);
        
        address pair = _pairFor(tokenA, tokenB);
        IERC20(tokenA).safeTransferFrom(_msgSender(), pair, amountA);
        IERC20(tokenB).safeTransferFrom(_msgSender(), pair, amountB);
        
        liquidity = DEXPair(pair).mint(to);
    }

    /**
     * @notice Removes liquidity from a token pair
     * @param tokenA First token address
     * @param tokenB Second token address
     * @param liquidity Amount of LP tokens to burn
     * @param amountAMin Minimum amount of tokenA to receive
     * @param amountBMin Minimum amount of tokenB to receive
     * @param to Recipient of underlying tokens
     * @param deadline Transaction deadline
     * @return amountA Amount of tokenA received
     * @return amountB Amount of tokenB received
     */
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external ensure(deadline) nonReentrant whenNotPaused returns (uint256 amountA, uint256 amountB) {
        address pair = _pairFor(tokenA, tokenB);
        
        IERC20(pair).safeTransferFrom(_msgSender(), pair, liquidity);
        (uint256 amount0, uint256 amount1) = DEXPair(pair).burn(to);
        
        (address token0,) = _sortTokens(tokenA, tokenB);
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
        
        if (amountA < amountAMin) revert InsufficientAAmount();
        if (amountB < amountBMin) revert InsufficientBAmount();
    }

    /**
     * @notice Swaps exact tokens for tokens
     * @param amountIn Exact input amount
     * @param amountOutMin Minimum output amount
     * @param path Array of token addresses representing swap path
     * @param to Recipient of output tokens
     * @param deadline Transaction deadline
     * @return amounts Array of amounts for each step in path
     */
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) nonReentrant whenNotPaused returns (uint256[] memory amounts) {
        amounts = _getAmountsOut(amountIn, path);
        if (amounts[amounts.length - 1] < amountOutMin) revert InsufficientOutputAmount();
        
        IERC20(path[0]).safeTransferFrom(_msgSender(), _pairFor(path[0], path[1]), amounts[0]);
        _swap(amounts, path, to);
    }

    /**
     * @notice Swaps tokens for exact tokens
     * @param amountOut Exact output amount
     * @param amountInMax Maximum input amount
     * @param path Array of token addresses representing swap path
     * @param to Recipient of output tokens
     * @param deadline Transaction deadline
     * @return amounts Array of amounts for each step in path
     */
    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) nonReentrant whenNotPaused returns (uint256[] memory amounts) {
        amounts = _getAmountsIn(amountOut, path);
        if (amounts[0] > amountInMax) revert ExcessiveInputAmount();
        
        IERC20(path[0]).safeTransferFrom(_msgSender(), _pairFor(path[0], path[1]), amounts[0]);
        _swap(amounts, path, to);
    }

    /**
     * @notice Calculates optimal amounts for adding liquidity
     * @param tokenA First token address
     * @param tokenB Second token address
     * @param amountADesired Desired amount of tokenA
     * @param amountBDesired Desired amount of tokenB
     * @param amountAMin Minimum amount of tokenA
     * @param amountBMin Minimum amount of tokenB
     * @return amountA Optimal amount of tokenA
     * @return amountB Optimal amount of tokenB
     */
    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin
    ) private returns (uint256 amountA, uint256 amountB) {
        address pair = factory.getPair(tokenA, tokenB);
        
        if (pair == address(0)) {
            factory.createPair(tokenA, tokenB);
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            (uint112 reserve0, uint112 reserve1,) = DEXPair(pair).getReserves();
            (address token0,) = _sortTokens(tokenA, tokenB);
            (uint256 reserveA, uint256 reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
            
            if (reserveA == 0 && reserveB == 0) {
                (amountA, amountB) = (amountADesired, amountBDesired);
            } else {
                uint256 amountBOptimal = _quote(amountADesired, reserveA, reserveB);
                if (amountBOptimal <= amountBDesired) {
                    if (amountBOptimal < amountBMin) revert InsufficientBAmount();
                    (amountA, amountB) = (amountADesired, amountBOptimal);
                } else {
                    uint256 amountAOptimal = _quote(amountBDesired, reserveB, reserveA);
                    assert(amountAOptimal <= amountADesired);
                    if (amountAOptimal < amountAMin) revert InsufficientAAmount();
                    (amountA, amountB) = (amountAOptimal, amountBDesired);
                }
            }
        }
    }

    /**
     * @notice Executes multi-hop swap
     * @param amounts Array of amounts for each step
     * @param path Array of token addresses
     * @param _to Final recipient
     */
    function _swap(uint256[] memory amounts, address[] memory path, address _to) private {
        uint256 pathLength = path.length;
        for (uint256 i; i < pathLength - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0,) = _sortTokens(input, output);
            uint256 amountOut = amounts[i + 1];
            
            (uint256 amount0Out, uint256 amount1Out) = input == token0 
                ? (uint256(0), amountOut) 
                : (amountOut, uint256(0));
            
            address to = i < path.length - 2 ? _pairFor(output, path[i + 2]) : _to;
            
            DEXPair(_pairFor(input, output)).swap(amount0Out, amount1Out, to, new bytes(0));
        }
    }

    /**
     * @notice Calculates output amounts for exact input
     * @param amountIn Input amount
     * @param path Swap path
     * @return amounts Output amounts for each step
     */
    function _getAmountsOut(uint256 amountIn, address[] memory path) private view returns (uint256[] memory amounts) {
        uint256 pathLength = path.length; // Cache array length
        if (pathLength < 2 || pathLength > 5) revert InvalidPath();
        amounts = new uint256[](pathLength);
        amounts[0] = amountIn;
        
        for (uint256 i; i < pathLength - 1; i++) {
            (uint112 reserveIn, uint112 reserveOut) = _getReserves(path[i], path[i + 1]);
            amounts[i + 1] = _getAmountOut(amounts[i], reserveIn, reserveOut);
        }
    }

    /**
     * @notice Calculates input amounts for exact output
     * @param amountOut Output amount
     * @param path Swap path
     * @return amounts Input amounts for each step
     */
    function _getAmountsIn(uint256 amountOut, address[] memory path) private view returns (uint256[] memory amounts) {
        uint256 pathLength = path.length; // Cache array length
        if (pathLength < 2 || pathLength > 5) revert InvalidPath();
        amounts = new uint256[](pathLength);
        amounts[pathLength - 1] = amountOut;
        
        for (uint256 i = pathLength - 1; i > 0; i--) {
            (uint112 reserveIn, uint112 reserveOut) = _getReserves(path[i - 1], path[i]);
            amounts[i - 1] = _getAmountIn(amounts[i], reserveIn, reserveOut);
        }
    }

    /**
     * @notice Calculates output amount for given input
     * @param amountIn Input amount
     * @param reserveIn Input reserve
     * @param reserveOut Output reserve
     * @return amountOut Output amount
     */
    function _getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) private pure returns (uint256 amountOut) {
        if (amountIn == 0) revert InsufficientInputAmount();
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientInputAmount();
        
        uint256 amountInWithFee = amountIn * 997; // 0.3% fee
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    /**
     * @notice Calculates input amount for given output
     * @param amountOut Output amount
     * @param reserveIn Input reserve
     * @param reserveOut Output reserve
     * @return amountIn Input amount
     */
    function _getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut) private pure returns (uint256 amountIn) {
        if (amountOut == 0) revert InsufficientOutputAmount();
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientInputAmount();
        
        uint256 numerator = reserveIn * amountOut * 1000;
        uint256 denominator = (reserveOut - amountOut) * 997;
        amountIn = (numerator / denominator) + 1;
    }

    /**
     * @notice Quotes equivalent amount based on reserves
     * @param amountA Amount of tokenA
     * @param reserveA Reserve of tokenA
     * @param reserveB Reserve of tokenB
     * @return amountB Equivalent amount of tokenB
     */
    function _quote(uint256 amountA, uint256 reserveA, uint256 reserveB) private pure returns (uint256 amountB) {
        if (amountA == 0) revert InsufficientInputAmount();
        if (reserveA == 0 || reserveB == 0) revert InsufficientInputAmount();
        amountB = (amountA * reserveB) / reserveA;
    }

    /**
     * @notice Returns pair address for two tokens
     * @param tokenA First token
     * @param tokenB Second token
     * @return pair Pair address
     */
    function _pairFor(address tokenA, address tokenB) private view returns (address pair) {
        pair = factory.getPair(tokenA, tokenB);
        if (pair == address(0)) revert PairNotFound();
    }

    /**
     * @notice Sorts two token addresses
     * @param tokenA First token
     * @param tokenB Second token
     * @return token0 Smaller address
     * @return token1 Larger address
     */
    function _sortTokens(address tokenA, address tokenB) private pure returns (address token0, address token1) {
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    }

    /**
     * @notice Gets reserves for a token pair
     * @param tokenA First token
     * @param tokenB Second token
     * @return reserveA Reserve of tokenA
     * @return reserveB Reserve of tokenB
     */
    function _getReserves(address tokenA, address tokenB) private view returns (uint112 reserveA, uint112 reserveB) {
        (address token0,) = _sortTokens(tokenA, tokenB);
        (uint112 reserve0, uint112 reserve1,) = DEXPair(_pairFor(tokenA, tokenB)).getReserves();
        (reserveA, reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
    }

    /**
     * @notice Returns output amounts for exact input (public view)
     * @param amountIn Input amount
     * @param path Swap path
     * @return amounts Output amounts
     */
    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts) {
        return _getAmountsOut(amountIn, path);
    }

    /**
     * @notice Returns input amounts for exact output (public view)
     * @param amountOut Output amount
     * @param path Swap path
     * @return amounts Input amounts
     */
    function getAmountsIn(uint256 amountOut, address[] calldata path) external view returns (uint256[] memory amounts) {
        return _getAmountsIn(amountOut, path);
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
