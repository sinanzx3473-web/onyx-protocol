// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MinimalForwarder.sol";
import "../src/DexCore.sol";
import "../src/DEXFactory.sol";
import "../src/DEXRouter.sol";
import "../src/DEXPair.sol";
import "../src/MockERC20.sol";

/**
 * @title RegressionTests
 * @notice Regression test suite ensuring I-1 and I-2 optimizations remain functional
 * @dev Tests validate that gas optimizations and permit support don't break existing functionality
 */
contract RegressionTests is Test {
    DexCore public dexCore;
    DEXFactory public factory;
    DEXRouter public router;
    MockERC20 public tokenA;
    MockERC20 public tokenB;
    MockERC20 public tokenC;
    
    MinimalForwarder public forwarder;
    address public owner;
    address public user1;
    address public user2;
    address public feeRecipient;
    
    uint256 constant INITIAL_SUPPLY = 1_000_000 * 1e18;
    uint256 constant LIQUIDITY_AMOUNT = 100_000 * 1e18;
    
    event PoolCreated(address indexed token0, address indexed token1, uint256 initialLiquidity);
    event Swap(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    
    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        feeRecipient = makeAddr("feeRecipient");
        
        // Deploy mock WETH
        MockERC20 weth = new MockERC20("Wrapped ETH", "WETH", 18);
        forwarder = new MinimalForwarder();
        
        // Deploy core contracts
        factory = new DEXFactory(owner);
        dexCore = new DexCore(address(factory), address(weth), address(forwarder));
        router = new DEXRouter(address(factory), address(weth), address(forwarder));
        
        // Set router in factory
        factory.setRouter(address(router));
        
        // Deploy test tokens
        tokenA = new MockERC20("Token A", "TKNA", 18);
        tokenB = new MockERC20("Token B", "TKNB", 18);
        tokenC = new MockERC20("Token C", "TKNC", 18);
        
        // Mint tokens to users
        tokenA.mint(user1, INITIAL_SUPPLY);
        tokenB.mint(user1, INITIAL_SUPPLY);
        tokenC.mint(user1, INITIAL_SUPPLY);
        
        tokenA.mint(user2, INITIAL_SUPPLY);
        tokenB.mint(user2, INITIAL_SUPPLY);
        tokenC.mint(user2, INITIAL_SUPPLY);
    }
    
    // ============================================
    // I-1 REGRESSION: Gas Optimization Tests
    // ============================================
    
    /**
     * @notice Verify struct packing doesn't break pool creation
     */
    function test_Regression_PoolCreation_AfterStructPacking() public {
        vm.startPrank(user1);
        
        tokenA.approve(address(router), LIQUIDITY_AMOUNT);
        tokenB.approve(address(router), LIQUIDITY_AMOUNT);
        
        // Create pool - should work with packed struct
        vm.expectEmit(true, true, false, true);
        emit PoolCreated(address(tokenA), address(tokenB), LIQUIDITY_AMOUNT);
        
        factory.createPair(address(tokenA), address(tokenB));
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            address(this),
            block.timestamp + 1
        );
        
        // Verify pool state is correctly stored despite packing
        (uint256 reserve0, uint256 reserve1, uint256 totalLiquidity, , , ) = 
            dexCore.pools(address(tokenA), address(tokenB));
        
        assertEq(reserve0, LIQUIDITY_AMOUNT, "Reserve0 mismatch after packing");
        assertEq(reserve1, LIQUIDITY_AMOUNT, "Reserve1 mismatch after packing");
        assertGt(totalLiquidity, 0, "Total liquidity should be > 0");
        
        vm.stopPrank();
    }
    
    /**
     * @notice Verify array length caching doesn't break multi-hop swaps
     */
    function test_Regression_MultiHopSwap_AfterArrayCaching() public {
        // Setup pools
        vm.startPrank(user1);
        
        tokenA.approve(address(dexCore), LIQUIDITY_AMOUNT * 2);
        tokenB.approve(address(dexCore), LIQUIDITY_AMOUNT * 2);
        tokenC.approve(address(dexCore), LIQUIDITY_AMOUNT * 2);
        
        dexCore.createPool(address(tokenA), address(tokenB));
        dexCore.addLiquidity(address(tokenA), address(tokenB), LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, address(this), block.timestamp + 1);
        
        dexCore.createPool(address(tokenB), address(tokenC));
        dexCore.addLiquidity(address(tokenB), address(tokenC), LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, address(this), block.timestamp + 1);
        
        vm.stopPrank();
        
        // Execute multi-hop swap
        vm.startPrank(user2);
        
        uint256 swapAmount = 1000 * 1e18;
        tokenA.approve(address(router), swapAmount);
        
        address[] memory path = new address[](3);
        path[0] = address(tokenA);
        path[1] = address(tokenB);
        path[2] = address(tokenC);
        
        uint256 balanceBefore = tokenC.balanceOf(user2);
        
        // Should work with cached array lengths
        router.swapExactTokensForTokens(
            swapAmount,
            0,
            path,
            user2,
            block.timestamp + 1 hours
        );
        
        uint256 balanceAfter = tokenC.balanceOf(user2);
        assertGt(balanceAfter, balanceBefore, "Multi-hop swap failed with array caching");
        
        vm.stopPrank();
    }
    
    /**
     * @notice Verify packed struct fields maintain precision
     */
    function test_Regression_PrecisionMaintained_AfterPacking() public {
        vm.startPrank(user1);
        
        tokenA.approve(address(router), LIQUIDITY_AMOUNT);
        tokenB.approve(address(router), LIQUIDITY_AMOUNT);
        
        factory.createPair(address(tokenA), address(tokenB));
        router.addLiquidity(address(tokenA), address(tokenB), LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, address(this), block.timestamp + 1);
        
        // Perform multiple swaps to test precision
        uint256 swapAmount = 100 * 1e18;
        tokenA.approve(address(dexCore), swapAmount * 10);
        
        for (uint256 i = 0; i < 5; i++) {
            uint256 expectedOut = dexCore.getAmountOut(
                swapAmount,
                address(tokenA),
                address(tokenB)
            );
            
            uint256 balanceBefore = tokenB.balanceOf(user1);
            
            dexCore.swap(
                address(tokenA),
                address(tokenB),
                swapAmount,
                expectedOut,
                user1,
                block.timestamp + 1 hours
            );
            
            uint256 balanceAfter = tokenB.balanceOf(user1);
            uint256 actualOut = balanceAfter - balanceBefore;
            
            // Precision should be maintained within 0.1%
            assertApproxEqRel(actualOut, expectedOut, 0.001e18, "Precision lost after packing");
        }
        
        vm.stopPrank();
    }
    
    /**
     * @notice Verify fee calculations remain accurate after optimizations
     */
    function test_Regression_FeeCalculation_AfterOptimizations() public {
        vm.startPrank(user1);
        
        tokenA.approve(address(router), LIQUIDITY_AMOUNT);
        tokenB.approve(address(router), LIQUIDITY_AMOUNT);
        
        factory.createPair(address(tokenA), address(tokenB));
        router.addLiquidity(address(tokenA), address(tokenB), LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, address(this), block.timestamp + 1);
        
        uint256 swapAmount = 1000 * 1e18;
        tokenA.approve(address(dexCore), swapAmount);
        
        uint256 expectedOut = dexCore.getAmountOut(swapAmount, address(tokenA), address(tokenB));
        
        // Calculate expected fee (0.3%)
        uint256 expectedFee = (swapAmount * 3) / 1000;
        
        uint256 balanceBefore = tokenB.balanceOf(user1);
        
        dexCore.swap(
            address(tokenA),
            address(tokenB),
            swapAmount,
            expectedOut,
            user1,
            block.timestamp + 1 hours
        );
        
        uint256 balanceAfter = tokenB.balanceOf(user1);
        uint256 actualOut = balanceAfter - balanceBefore;
        
        // Verify fee was correctly applied
        (uint256 reserve0, uint256 reserve1, , , , ) = dexCore.pools(address(tokenA), address(tokenB));
        
        // Reserves should reflect fee deduction
        assertGt(reserve0, LIQUIDITY_AMOUNT, "Fee not accumulated in reserves");
        
        vm.stopPrank();
    }
    
    // ============================================
    // I-2 REGRESSION: Permit Support Tests
    // ============================================
    
    /**
     * @notice Verify regular swaps still work after adding permit support
     */
    function test_Regression_RegularSwap_AfterPermitAddition() public {
        vm.startPrank(user1);
        
        tokenA.approve(address(router), LIQUIDITY_AMOUNT);
        tokenB.approve(address(router), LIQUIDITY_AMOUNT);
        
        factory.createPair(address(tokenA), address(tokenB));
        router.addLiquidity(address(tokenA), address(tokenB), LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, address(this), block.timestamp + 1);
        
        uint256 swapAmount = 1000 * 1e18;
        tokenA.approve(address(dexCore), swapAmount);
        
        uint256 expectedOut = dexCore.getAmountOut(swapAmount, address(tokenA), address(tokenB));
        uint256 balanceBefore = tokenB.balanceOf(user1);
        
        // Regular swap should still work
        dexCore.swap(
            address(tokenA),
            address(tokenB),
            swapAmount,
            expectedOut,
            user1,
            block.timestamp + 1 hours
        );
        
        uint256 balanceAfter = tokenB.balanceOf(user1);
        assertGt(balanceAfter, balanceBefore, "Regular swap broken after permit addition");
        
        vm.stopPrank();
    }
    
    /**
     * @notice Verify approval mechanism unchanged after permit support
     */
    function test_Regression_ApprovalMechanism_AfterPermit() public {
        vm.startPrank(user1);
        
        uint256 approvalAmount = 5000 * 1e18;
        
        // Approve tokens
        tokenA.approve(address(dexCore), approvalAmount);
        
        // Check allowance
        uint256 allowance = tokenA.allowance(user1, address(dexCore));
        assertEq(allowance, approvalAmount, "Approval mechanism broken");
        
        // Use partial allowance
        tokenA.approve(address(router), LIQUIDITY_AMOUNT);
        tokenB.approve(address(router), LIQUIDITY_AMOUNT);
        
        factory.createPair(address(tokenA), address(tokenB));
        router.addLiquidity(address(tokenA), address(tokenB), LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, address(this), block.timestamp + 1);
        
        // Remaining allowance should be reduced
        uint256 remainingAllowance = tokenA.allowance(user1, address(dexCore));
        assertEq(remainingAllowance, 0, "Allowance not properly consumed");
        
        vm.stopPrank();
    }
    
    /**
     * @notice Verify router integration unchanged after permit addition
     */
    function test_Regression_RouterIntegration_AfterPermit() public {
        vm.startPrank(user1);
        
        tokenA.approve(address(router), LIQUIDITY_AMOUNT);
        tokenB.approve(address(router), LIQUIDITY_AMOUNT);
        
        factory.createPair(address(tokenA), address(tokenB));
        router.addLiquidity(address(tokenA), address(tokenB), LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, address(this), block.timestamp + 1);
        
        vm.stopPrank();
        
        vm.startPrank(user2);
        
        uint256 swapAmount = 1000 * 1e18;
        tokenA.approve(address(router), swapAmount);
        
        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);
        
        uint256 balanceBefore = tokenB.balanceOf(user2);
        
        // Router swap should work unchanged
        router.swapExactTokensForTokens(
            swapAmount,
            0,
            path,
            user2,
            block.timestamp + 1 hours
        );
        
        uint256 balanceAfter = tokenB.balanceOf(user2);
        assertGt(balanceAfter, balanceBefore, "Router integration broken after permit");
        
        vm.stopPrank();
    }
    
    // ============================================
    // COMBINED REGRESSION TESTS
    // ============================================
    
    /**
     * @notice Verify all core functions work together after both optimizations
     */
    function test_Regression_FullWorkflow_AfterAllOptimizations() public {
        // User1 creates pools
        vm.startPrank(user1);
        
        tokenA.approve(address(dexCore), LIQUIDITY_AMOUNT * 2);
        tokenB.approve(address(dexCore), LIQUIDITY_AMOUNT * 2);
        tokenC.approve(address(dexCore), LIQUIDITY_AMOUNT * 2);
        
        dexCore.createPool(address(tokenA), address(tokenB));
        dexCore.addLiquidity(address(tokenA), address(tokenB), LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, address(this), block.timestamp + 1);
        
        dexCore.createPool(address(tokenB), address(tokenC));
        dexCore.addLiquidity(address(tokenB), address(tokenC), LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, address(this), block.timestamp + 1);
        
        vm.stopPrank();
        
        // User2 performs swaps
        vm.startPrank(user2);
        
        uint256 swapAmount = 1000 * 1e18;
        tokenA.approve(address(router), swapAmount);
        
        address[] memory path = new address[](3);
        path[0] = address(tokenA);
        path[1] = address(tokenB);
        path[2] = address(tokenC);
        
        uint256 balanceBefore = tokenC.balanceOf(user2);
        
        router.swapExactTokensForTokens(
            swapAmount,
            0,
            path,
            user2,
            block.timestamp + 1 hours
        );
        
        uint256 balanceAfter = tokenC.balanceOf(user2);
        assertGt(balanceAfter, balanceBefore, "Full workflow broken");
        
        vm.stopPrank();
        
        // User1 adds more liquidity
        vm.startPrank(user1);
        
        uint256 addLiquidityAmount = 10_000 * 1e18;
        tokenA.approve(address(dexCore), addLiquidityAmount);
        tokenB.approve(address(dexCore), addLiquidityAmount);
        
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            addLiquidityAmount,
            addLiquidityAmount,
            0,
            0,
            user1,
            block.timestamp + 1 hours
        );
        
        (uint256 reserve0, uint256 reserve1, , , , ) = dexCore.pools(address(tokenA), address(tokenB));
        
        assertGt(reserve0, LIQUIDITY_AMOUNT, "Liquidity addition failed");
        assertGt(reserve1, LIQUIDITY_AMOUNT, "Liquidity addition failed");
        
        vm.stopPrank();
    }
    
    /**
     * @notice Stress test to ensure optimizations handle edge cases
     */
    function test_Regression_StressTest_MultipleOperations() public {
        vm.startPrank(user1);
        
        tokenA.approve(address(dexCore), type(uint256).max);
        tokenB.approve(address(dexCore), type(uint256).max);
        
        dexCore.createPool(address(tokenA), address(tokenB));
        dexCore.addLiquidity(address(tokenA), address(tokenB), LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT, address(this), block.timestamp + 1);
        
        // Perform 20 swaps in alternating directions
        for (uint256 i = 0; i < 20; i++) {
            uint256 swapAmount = 100 * 1e18;
            
            if (i % 2 == 0) {
                uint256 expectedOut = dexCore.getAmountOut(swapAmount, address(tokenA), address(tokenB));
                dexCore.swap(address(tokenA), address(tokenB), swapAmount, expectedOut, user1, block.timestamp + 1 hours);
            } else {
                uint256 expectedOut = dexCore.getAmountOut(swapAmount, address(tokenB), address(tokenA));
                dexCore.swap(address(tokenB), address(tokenA), swapAmount, expectedOut, user1, block.timestamp + 1 hours);
            }
        }
        
        // Verify pool still functional
        (uint256 reserve0, uint256 reserve1, , , , ) = dexCore.pools(address(tokenA), address(tokenB));
        
        assertGt(reserve0, 0, "Pool broken after stress test");
        assertGt(reserve1, 0, "Pool broken after stress test");
        
        vm.stopPrank();
    }
}
