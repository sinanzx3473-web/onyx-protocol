// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MinimalForwarder.sol";
import "../src/DexCore.sol";
import "../src/DEXFactory.sol";
import "../src/DEXRouter.sol";
import "../src/DEXPair.sol";
import "../src/FlashSwap.sol";
import "../src/BridgeAdapter.sol";
import "../src/MockERC20.sol";
import "../src/FlashBorrower.sol";

/**
 * @title IntegrationTests
 * @notice Comprehensive integration tests covering multi-hop swaps, flash loans, and cross-chain scenarios
 * @dev Tests complex interactions between multiple contracts and edge cases
 */
contract IntegrationTests is Test {
    DexCore public dexCore;
    DEXFactory public factory;
    DEXRouter public router;
    FlashSwap public flashSwap;
    BridgeAdapter public bridgeAdapter;
    
    MockERC20 public tokenA;
    MockERC20 public tokenB;
    MockERC20 public tokenC;
    MockERC20 public tokenD;
    MockERC20 public weth;
    MinimalForwarder public forwarder;
    
    address public owner = address(this);
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public liquidityProvider = address(0x3);
    
    uint256 constant INITIAL_SUPPLY = 1_000_000 * 1e18;
    uint256 constant LIQUIDITY_AMOUNT = 100_000 * 1e18;

    event Swap(
        address indexed sender,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 amountOutMin,
        uint256 priceImpactBps
    );

    function setUp() public {
        // Deploy tokens
        tokenA = new MockERC20("Token A", "TKNA", 18);
        tokenB = new MockERC20("Token B", "TKNB", 18);
        tokenC = new MockERC20("Token C", "TKNC", 18);
        tokenD = new MockERC20("Token D", "TKND", 18);
        weth = new MockERC20("Wrapped ETH", "WETH", 18);
        forwarder = new MinimalForwarder();
        
        // Deploy core contracts
        factory = new DEXFactory(owner);
        dexCore = new DexCore(address(factory), address(weth), address(forwarder));
        router = new DEXRouter(address(factory), address(weth), address(forwarder));
        flashSwap = new FlashSwap(address(dexCore), address(forwarder));
        bridgeAdapter = new BridgeAdapter(address(dexCore), owner);
        
        // Set router in factory
        factory.setRouter(address(router));
        
        // Set FlashSwap contract in DexCore
        dexCore.setFlashSwapContract(address(flashSwap));
        
        // Mint tokens to users
        tokenA.mint(user1, INITIAL_SUPPLY);
        tokenB.mint(user1, INITIAL_SUPPLY);
        tokenC.mint(user1, INITIAL_SUPPLY);
        tokenD.mint(user1, INITIAL_SUPPLY);
        
        tokenA.mint(user2, INITIAL_SUPPLY);
        tokenB.mint(user2, INITIAL_SUPPLY);
        tokenC.mint(user2, INITIAL_SUPPLY);
        tokenD.mint(user2, INITIAL_SUPPLY);
        
        tokenA.mint(liquidityProvider, INITIAL_SUPPLY);
        tokenB.mint(liquidityProvider, INITIAL_SUPPLY);
        tokenC.mint(liquidityProvider, INITIAL_SUPPLY);
        tokenD.mint(liquidityProvider, INITIAL_SUPPLY);
        
        // Create pairs through factory
        factory.createPair(address(tokenA), address(tokenB));
        factory.createPair(address(tokenB), address(tokenC));
        factory.createPair(address(tokenC), address(tokenD));
        
        // Add liquidity to all pools via router
        vm.startPrank(liquidityProvider);
        
        // Pool A-B
        tokenA.approve(address(router), LIQUIDITY_AMOUNT);
        tokenB.approve(address(router), LIQUIDITY_AMOUNT);
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            0,
            0,
            liquidityProvider,
            block.timestamp + 1 hours
        );
        
        // Pool B-C
        tokenB.approve(address(router), LIQUIDITY_AMOUNT);
        tokenC.approve(address(router), LIQUIDITY_AMOUNT);
        router.addLiquidity(
            address(tokenB),
            address(tokenC),
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            0,
            0,
            liquidityProvider,
            block.timestamp + 1 hours
        );
        
        // Pool C-D
        tokenC.approve(address(router), LIQUIDITY_AMOUNT);
        tokenD.approve(address(router), LIQUIDITY_AMOUNT);
        router.addLiquidity(
            address(tokenC),
            address(tokenD),
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            0,
            0,
            liquidityProvider,
            block.timestamp + 1 hours
        );
        
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          MULTI-HOP SWAP TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function test_MultiHopSwap_TwoHops() public {
        uint256 amountIn = 1000 * 1e18;
        
        vm.startPrank(user1);
        tokenA.approve(address(router), amountIn);
        
        address[] memory path = new address[](3);
        path[0] = address(tokenA);
        path[1] = address(tokenB);
        path[2] = address(tokenC);
        
        uint256 balanceBefore = tokenC.balanceOf(user1);
        
        router.swapExactTokensForTokens(
            amountIn,
            0,
            path,
            user1,
            block.timestamp + 1 hours
        );
        
        uint256 balanceAfter = tokenC.balanceOf(user1);
        
        assertGt(balanceAfter, balanceBefore, "Should receive tokenC");
        vm.stopPrank();
    }

    function test_MultiHopSwap_ThreeHops() public {
        uint256 amountIn = 1000 * 1e18;
        
        vm.startPrank(user1);
        tokenA.approve(address(router), amountIn);
        
        address[] memory path = new address[](4);
        path[0] = address(tokenA);
        path[1] = address(tokenB);
        path[2] = address(tokenC);
        path[3] = address(tokenD);
        
        uint256 balanceBefore = tokenD.balanceOf(user1);
        
        router.swapExactTokensForTokens(
            amountIn,
            0,
            path,
            user1,
            block.timestamp + 1 hours
        );
        
        uint256 balanceAfter = tokenD.balanceOf(user1);
        
        assertGt(balanceAfter, balanceBefore, "Should receive tokenD");
        vm.stopPrank();
    }

    function test_MultiHopSwap_PriceImpact() public {
        uint256 smallAmount = 100 * 1e18;
        uint256 largeAmount = 10000 * 1e18;
        
        address[] memory path = new address[](3);
        path[0] = address(tokenA);
        path[1] = address(tokenB);
        path[2] = address(tokenC);
        
        // Small swap
        vm.startPrank(user1);
        tokenA.approve(address(router), smallAmount);
        uint256[] memory smallAmounts = router.swapExactTokensForTokens(
            smallAmount,
            0,
            path,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        // Large swap
        vm.startPrank(user2);
        tokenA.approve(address(router), largeAmount);
        uint256[] memory largeAmounts = router.swapExactTokensForTokens(
            largeAmount,
            0,
            path,
            user2,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        // Large swap should have worse rate due to price impact
        uint256 smallRate = (smallAmounts[2] * 1e18) / smallAmounts[0];
        uint256 largeRate = (largeAmounts[2] * 1e18) / largeAmounts[0];
        
        assertLt(largeRate, smallRate, "Large swap should have worse rate");
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          FLASH LOAN + SWAP TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function test_FlashLoanAndSwap_Sequential() public {
        uint256 flashAmount = 10000 * 1e18;
        
        // Deploy flash borrower
        FlashBorrower borrower = new FlashBorrower(address(flashSwap));
        
        // Fund borrower with fee
        vm.startPrank(user1);
        tokenA.transfer(address(borrower), 100 * 1e18);
        vm.stopPrank();
        
        // Execute flash loan
        (address token0, address token1) = address(tokenA) < address(tokenB)
            ? (address(tokenA), address(tokenB))
            : (address(tokenB), address(tokenA));
        
        borrower.executeFlashLoan(address(tokenA), flashAmount, new bytes(0));
        
        // Now execute a regular swap
        vm.startPrank(user1);
        uint256 swapAmount = 1000 * 1e18;
        tokenA.approve(address(dexCore), swapAmount);
        
        dexCore.swap(
            address(tokenA),
            address(tokenB),
            swapAmount,
            1,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
    }

    function test_FlashLoanFeeDistribution() public {
        uint256 flashAmount = 10000 * 1e18;
        
        // Get initial reserves
        (uint256 reserve0Before, uint256 reserve1Before,) = dexCore.getReserves(address(tokenA), address(tokenB));
        
        // Deploy flash borrower
        FlashBorrower borrower = new FlashBorrower(address(flashSwap));
        
        // Fund borrower with fee
        vm.startPrank(user1);
        tokenA.transfer(address(borrower), 100 * 1e18);
        vm.stopPrank();
        
        // Execute flash loan
        (address token0, address token1) = address(tokenA) < address(tokenB)
            ? (address(tokenA), address(tokenB))
            : (address(tokenB), address(tokenA));
        
        borrower.executeFlashLoan(address(tokenA), flashAmount, new bytes(0));
        
        // Check reserves increased (fee added)
        (uint256 reserve0After, uint256 reserve1After,) = dexCore.getReserves(address(tokenA), address(tokenB));
        
        if (address(tokenA) == token0) {
            assertGt(reserve0After, reserve0Before, "Reserve should increase from flash loan fee");
        } else {
            assertGt(reserve1After, reserve1Before, "Reserve should increase from flash loan fee");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          CROSS-CHAIN SIMULATION TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function test_BridgeAdapter_ScheduleAndExecute() public {
        address newBridge = address(0x999);
        
        // Propose bridge update
        bridgeAdapter.proposeBridgeUpdate(newBridge);
        
        // Fast forward past timelock
        vm.warp(block.timestamp + 2 days + 1);
        
        // Execute update
        bridgeAdapter.executeBridgeUpdate();
        
        assertEq(bridgeAdapter.bridge(), newBridge, "Bridge should be updated");
    }

    function test_BridgeAdapter_CancelUpdate() public {
        address newBridge = address(0x999);
        
        // Propose bridge update
        bridgeAdapter.proposeBridgeUpdate(newBridge);
        
        // Cancel before execution
        bridgeAdapter.cancelBridgeUpdate();
        
        // Fast forward past timelock
        vm.warp(block.timestamp + 2 days + 1);
        
        // Should revert when trying to execute
        vm.expectRevert(BridgeAdapter.NoPendingUpdate.selector);
        bridgeAdapter.executeBridgeUpdate();
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          STRESS TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function test_MultipleUsersSimultaneousSwaps() public {
        uint256 swapAmount = 500 * 1e18;
        
        // User1 swaps A -> B
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), swapAmount);
        dexCore.swap(
            address(tokenA),
            address(tokenB),
            swapAmount,
            1,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        // User2 swaps B -> A (opposite direction)
        vm.startPrank(user2);
        tokenB.approve(address(dexCore), swapAmount);
        dexCore.swap(
            address(tokenB),
            address(tokenA),
            swapAmount,
            1,
            user2,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        // Both should succeed
        assertTrue(true, "Both swaps should complete");
    }

    function test_AddRemoveLiquidityDuringSwaps() public {
        uint256 swapAmount = 1000 * 1e18;
        uint256 liquidityAmount = 5000 * 1e18;
        
        // User1 swaps
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), swapAmount);
        dexCore.swap(
            address(tokenA),
            address(tokenB),
            swapAmount,
            1,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        // User2 adds liquidity
        vm.startPrank(user2);
        tokenA.approve(address(dexCore), liquidityAmount);
        tokenB.approve(address(dexCore), liquidityAmount);
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            liquidityAmount,
            liquidityAmount,
            0,
            0,
            user2,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        // User1 swaps again
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), swapAmount);
        dexCore.swap(
            address(tokenA),
            address(tokenB),
            swapAmount,
            1,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        assertTrue(true, "All operations should complete");
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          EDGE CASE TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function test_SwapWithMinimumAmount() public {
        uint256 minAmount = 1; // 1 wei
        
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), minAmount);
        
        vm.expectRevert(DexCore.InsufficientOutputAmount.selector);
        dexCore.swap(
            address(tokenA),
            address(tokenB),
            minAmount,
            1,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
    }

    function test_MultiHopSwap_MaxPath() public {
        // Create additional pool for 5-hop test
        dexCore.createPool(address(tokenD), address(weth));
        
        vm.startPrank(liquidityProvider);
        tokenD.approve(address(dexCore), LIQUIDITY_AMOUNT);
        weth.mint(liquidityProvider, LIQUIDITY_AMOUNT);
        weth.approve(address(dexCore), LIQUIDITY_AMOUNT);
        dexCore.addLiquidity(
            address(tokenD),
            address(weth),
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            0,
            0,
            liquidityProvider,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        // Test 5-hop swap (max allowed)
        uint256 amountIn = 100 * 1e18;
        
        vm.startPrank(user1);
        tokenA.approve(address(router), amountIn);
        
        address[] memory path = new address[](5);
        path[0] = address(tokenA);
        path[1] = address(tokenB);
        path[2] = address(tokenC);
        path[3] = address(tokenD);
        path[4] = address(weth);
        
        router.swapExactTokensForTokens(
            amountIn,
            0,
            path,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        assertTrue(weth.balanceOf(user1) > 0, "Should receive WETH after 5-hop swap");
    }

    function test_FlashLoanMaxAmount() public {
        // Get pool reserves
        (uint256 reserve0, uint256 reserve1,) = dexCore.getReserves(address(tokenA), address(tokenB));
        
        // Max flash loan is 10% of reserves
        uint256 maxFlashLoan = (reserve0 * 1000) / 10000;
        
        FlashBorrower borrower = new FlashBorrower(address(flashSwap));
        
        // Fund borrower with fee
        vm.startPrank(user1);
        tokenA.transfer(address(borrower), 1000 * 1e18);
        vm.stopPrank();
        
        (address token0, address token1) = address(tokenA) < address(tokenB)
            ? (address(tokenA), address(tokenB))
            : (address(tokenB), address(tokenA));
        
        // Should succeed with max amount
        borrower.executeFlashLoan(address(tokenA), maxFlashLoan, new bytes(0));
        
        // Should fail with amount > max
        vm.expectRevert();
        borrower.executeFlashLoan(address(tokenA), maxFlashLoan + 1, new bytes(0));
    }
}
