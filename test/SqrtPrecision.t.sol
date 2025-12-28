// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MinimalForwarder.sol";
import "../src/DexCore.sol";
import "../src/MockERC20.sol";

/**
 * @title SqrtPrecisionTest
 * @notice Tests for sqrt precision using OpenZeppelin Math library
 * @dev Validates LP share calculations have no rounding errors or overflow
 */
contract SqrtPrecisionTest is Test {
    DexCore public dex;
    MockERC20 public tokenA;
    MockERC20 public tokenB;
    MockERC20 public weth;
    MinimalForwarder public forwarder;
    
    address public user = address(0x1);
    
    function setUp() public {
        // Deploy contracts
        weth = new MockERC20("Wrapped ETH", "WETH", 18);
        forwarder = new MinimalForwarder();
        dex = new DexCore(address(0x1234), address(weth), address(forwarder));
        tokenA = new MockERC20("Token A", "TKA", 18);
        tokenB = new MockERC20("Token B", "TKB", 18);
        
        // Mint tokens to user
        tokenA.mint(user, 1000000 ether);
        tokenB.mint(user, 1000000 ether);
        
        // Create pool
        dex.createPool(address(tokenA), address(tokenB));
    }
    
    /**
     * @notice Test sqrt precision with small amounts
     */
    function test_SqrtPrecisionSmallAmounts() public {
        uint256 amount0 = 10000;
        uint256 amount1 = 10000;
        
        vm.startPrank(user);
        tokenA.approve(address(dex), amount0);
        tokenB.approve(address(dex), amount1);
        
        (,, uint256 liquidity) = dex.addLiquidity(
            address(tokenA),
            address(tokenB),
            amount0,
            amount1,
            0,
            0,
            user,
            block.timestamp + 1
        );
        
        // sqrt(10000 * 10000) = 10000, minus MINIMUM_LIQUIDITY (1000) = 9000
        assertEq(liquidity, 9000, "Should receive correct liquidity for small amounts");
        vm.stopPrank();
    }
    
    /**
     * @notice Test sqrt precision with large amounts
     */
    function test_SqrtPrecisionLargeAmounts() public {
        uint256 amount0 = 1000000 ether;
        uint256 amount1 = 1000000 ether;
        
        vm.startPrank(user);
        tokenA.approve(address(dex), amount0);
        tokenB.approve(address(dex), amount1);
        
        (,, uint256 liquidity) = dex.addLiquidity(
            address(tokenA),
            address(tokenB),
            amount0,
            amount1,
            0,
            0,
            user,
            block.timestamp + 1
        );
        
        // sqrt(1000000e18 * 1000000e18) = 1000000e18
        assertEq(liquidity, 1000000 ether - 1000, "Liquidity should match sqrt calculation");
        vm.stopPrank();
    }
    
    /**
     * @notice Test sqrt precision with unbalanced amounts
     */
    function test_SqrtPrecisionUnbalancedAmounts() public {
        uint256 amount0 = 100 ether;
        uint256 amount1 = 10000 ether;
        
        vm.startPrank(user);
        tokenA.approve(address(dex), amount0);
        tokenB.approve(address(dex), amount1);
        
        (,, uint256 liquidity) = dex.addLiquidity(
            address(tokenA),
            address(tokenB),
            amount0,
            amount1,
            0,
            0,
            user,
            block.timestamp + 1
        );
        
        // sqrt(100e18 * 10000e18) = sqrt(1000000e36) = 1000e18
        assertEq(liquidity, 1000 ether - 1000, "Liquidity should match sqrt of product");
        vm.stopPrank();
    }
    
    /**
     * @notice Test sqrt with perfect squares
     */
    function test_SqrtPerfectSquares() public {
        // Test perfect square: 100 ether * 100 ether = 10000 ether^2, sqrt = 100 ether
        MockERC20 token0 = new MockERC20("Token0", "TK0", 18);
        MockERC20 token1 = new MockERC20("Token1", "TK1", 18);
        
        uint256 amount = 100 ether;
        token0.mint(user, amount);
        token1.mint(user, amount);
        
        dex.createPool(address(token0), address(token1));
        
        vm.startPrank(user);
        token0.approve(address(dex), amount);
        token1.approve(address(dex), amount);
        
        (,, uint256 liquidity) = dex.addLiquidity(
            address(token0),
            address(token1),
            amount,
            amount,
            0,
            0,
            user,
            block.timestamp + 1
        );
        
        // sqrt(100e18 * 100e18) = 100e18, minus MINIMUM_LIQUIDITY (1000)
        assertEq(liquidity, 100 ether - 1000, "Perfect square sqrt should be exact");
        vm.stopPrank();
    }
    
    /**
     * @notice Test sqrt doesn't overflow with maximum values
     */
    function test_SqrtNoOverflow() public {
        // Use large but safe values (not max uint256 to avoid overflow in multiplication)
        uint256 amount0 = 1e30; // Very large amount
        uint256 amount1 = 1e30;
        
        tokenA.mint(user, amount0);
        tokenB.mint(user, amount1);
        
        vm.startPrank(user);
        tokenA.approve(address(dex), amount0);
        tokenB.approve(address(dex), amount1);
        
        // Should not revert with overflow
        (,, uint256 liquidity) = dex.addLiquidity(
            address(tokenA),
            address(tokenB),
            amount0,
            amount1,
            0,
            0,
            user,
            block.timestamp + 1
        );
        
        assertGt(liquidity, 0, "Should handle large amounts without overflow");
        vm.stopPrank();
    }
    
    /**
     * @notice Test sqrt with edge case: amount = 1
     */
    function test_SqrtEdgeCaseOne() public {
        uint256 amount0 = 1;
        uint256 amount1 = 1;
        
        vm.startPrank(user);
        tokenA.approve(address(dex), amount0);
        tokenB.approve(address(dex), amount1);
        
        // sqrt(1) = 1, but MINIMUM_LIQUIDITY is 1000, so this should revert
        vm.expectRevert();
        dex.addLiquidity(
            address(tokenA),
            address(tokenB),
            amount0,
            amount1,
            0,
            0,
            user,
            block.timestamp + 1
        );
        vm.stopPrank();
    }
    
    /**
     * @notice Test subsequent liquidity additions use proportional formula correctly
     */
    function test_SqrtPrecisionSubsequentAdditions() public {
        // First addition
        uint256 amount0 = 1000 ether;
        uint256 amount1 = 1000 ether;
        
        vm.startPrank(user);
        tokenA.approve(address(dex), amount0 * 3);
        tokenB.approve(address(dex), amount1 * 3);
        
        dex.addLiquidity(
            address(tokenA),
            address(tokenB),
            amount0,
            amount1,
            0,
            0,
            user,
            block.timestamp + 1
        );
        
        // Add more liquidity with same ratio
        (,, uint256 liquidity2) = dex.addLiquidity(
            address(tokenA),
            address(tokenB),
            amount0,
            amount1,
            0,
            0,
            user,
            block.timestamp + 1
        );
        
        // Third addition with same ratio should give consistent results
        (,, uint256 liquidity3) = dex.addLiquidity(
            address(tokenA),
            address(tokenB),
            amount0,
            amount1,
            0,
            0,
            user,
            block.timestamp + 1
        );
        
        // All subsequent additions should be non-zero and use proportional formula
        assertGt(liquidity2, 0, "Second liquidity should be non-zero");
        assertGt(liquidity3, 0, "Third liquidity should be non-zero");
        // liquidity2 and liquidity3 should be equal (same ratio, same amount)
        assertEq(liquidity2, liquidity3, "Equal ratio additions should give equal liquidity");
        vm.stopPrank();
    }
    
    /**
     * @notice Fuzz test: sqrt precision across random amounts
     */
    function testFuzz_SqrtPrecision(uint128 amount0, uint128 amount1) public {
        // Bound amounts to reasonable range
        amount0 = uint128(bound(amount0, 10000, type(uint128).max / 2));
        amount1 = uint128(bound(amount1, 10000, type(uint128).max / 2));
        
        // Create new pool for fuzz test
        MockERC20 token0 = new MockERC20("Token0", "TK0", 18);
        MockERC20 token1 = new MockERC20("Token1", "TK1", 18);
        
        token0.mint(user, amount0);
        token1.mint(user, amount1);
        
        dex.createPool(address(token0), address(token1));
        
        vm.startPrank(user);
        token0.approve(address(dex), amount0);
        token1.approve(address(dex), amount1);
        
        // Should not revert and should return non-zero liquidity
        (,, uint256 liquidity) = dex.addLiquidity(
            address(token0),
            address(token1),
            amount0,
            amount1,
            0,
            0,
            user,
            block.timestamp + 1
        );
        
        assertGt(liquidity, 0, "Should receive liquidity for any valid amounts");
        vm.stopPrank();
    }
    
    /**
     * @notice Test LP token balance matches liquidity calculation
     */
    function test_LPTokenBalanceMatchesLiquidity() public {
        uint256 amount0 = 1000 ether;
        uint256 amount1 = 1000 ether;
        
        vm.startPrank(user);
        tokenA.approve(address(dex), amount0);
        tokenB.approve(address(dex), amount1);
        
        (,, uint256 liquidity) = dex.addLiquidity(
            address(tokenA),
            address(tokenB),
            amount0,
            amount1,
            0,
            0,
            user,
            block.timestamp + 1
        );
        
        // Get LP token address (sorted)
        (address token0, address token1) = address(tokenA) < address(tokenB) 
            ? (address(tokenA), address(tokenB)) 
            : (address(tokenB), address(tokenA));
        address lpToken = dex.lpTokens(token0, token1);
        uint256 lpBalance = IERC20(lpToken).balanceOf(user);
        
        assertEq(lpBalance, liquidity, "LP token balance should match returned liquidity");
        vm.stopPrank();
    }
}
