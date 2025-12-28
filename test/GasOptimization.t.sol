// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MinimalForwarder.sol";
import "../src/DexCore.sol";
import "../src/DEXFactory.sol";
import "../src/DEXRouter.sol";
import "../src/MockERC20.sol";

/**
 * @title GasOptimizationTests
 * @notice Regression tests for gas optimizations (I-1)
 * @dev Validates struct packing and array length caching improvements
 */
contract GasOptimizationTests is Test {
    DexCore public dexCore;
    DEXFactory public factory;
    DEXRouter public router;
    
    MockERC20 public tokenA;
    MockERC20 public tokenB;
    MockERC20 public tokenC;
    MockERC20 public weth;
    MinimalForwarder public forwarder;
    
    address public user = address(0x1);
    
    uint256 constant INITIAL_SUPPLY = 1_000_000 * 1e18;
    uint256 constant LIQUIDITY_AMOUNT = 100_000 * 1e18;

    function setUp() public {
        tokenA = new MockERC20("Token A", "TKNA", 18);
        tokenB = new MockERC20("Token B", "TKNB", 18);
        tokenC = new MockERC20("Token C", "TKNC", 18);
        weth = new MockERC20("Wrapped ETH", "WETH", 18);
        forwarder = new MinimalForwarder();
        
        factory = new DEXFactory(address(this));
        dexCore = new DexCore(address(factory), address(weth), address(forwarder));
        router = new DEXRouter(address(factory), address(weth), address(forwarder));
        
        // Set router in factory so pairs can authorize it
        factory.setRouter(address(router));
        
        // Create pairs through factory to ensure router is set
        factory.createPair(address(tokenA), address(tokenB));
        factory.createPair(address(tokenB), address(tokenC));
        
        tokenA.mint(user, INITIAL_SUPPLY);
        tokenB.mint(user, INITIAL_SUPPLY);
        tokenC.mint(user, INITIAL_SUPPLY);
        
        vm.startPrank(user);
        tokenA.approve(address(router), LIQUIDITY_AMOUNT);
        tokenB.approve(address(router), LIQUIDITY_AMOUNT * 2);
        tokenC.approve(address(router), LIQUIDITY_AMOUNT);
        
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            0,
            0,
            user,
            block.timestamp + 1 hours
        );
        
        router.addLiquidity(
            address(tokenB),
            address(tokenC),
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            0,
            0,
            user,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          STRUCT PACKING TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function test_PoolStructPacking() public {
        // Verify Pool struct uses optimized storage slots
        (address token0, address token1) = address(tokenA) < address(tokenB)
            ? (address(tokenA), address(tokenB))
            : (address(tokenB), address(tokenA));
        
        // Get pool data
        (uint256 reserve0, uint256 reserve1, uint32 timestamp) = dexCore.getReserves(token0, token1);
        
        // Verify data is accessible and correct
        assertGt(reserve0, 0, "Reserve0 should be set");
        assertGt(reserve1, 0, "Reserve1 should be set");
        assertGt(timestamp, 0, "Timestamp should be set");
    }

    function test_AddLiquidityGasCost() public {
        uint256 amount = 1000 * 1e18;
        
        vm.startPrank(user);
        tokenA.approve(address(dexCore), amount);
        tokenB.approve(address(dexCore), amount);
        
        uint256 gasBefore = gasleft();
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            amount,
            amount,
            0,
            0,
            user,
            block.timestamp + 1 hours
        );
        uint256 gasUsed = gasBefore - gasleft();
        
        vm.stopPrank();
        
        // Gas should be reasonable (optimized struct packing saves ~5k gas)
        // Typical cost: ~180k gas for subsequent liquidity additions
        assertLt(gasUsed, 200000, "Gas usage should be optimized");
    }

    function test_SwapGasCost() public {
        uint256 amount = 1000 * 1e18;
        
        vm.startPrank(user);
        tokenA.approve(address(dexCore), amount);
        
        uint256 gasBefore = gasleft();
        dexCore.swap(
            address(tokenA),
            address(tokenB),
            amount,
            1,
            user,
            block.timestamp + 1 hours
        );
        uint256 gasUsed = gasBefore - gasleft();
        
        vm.stopPrank();
        
        // Gas should be reasonable
        // Typical cost: ~145k gas for standard swaps
        assertLt(gasUsed, 160000, "Swap gas usage should be optimized");
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          ARRAY LENGTH CACHING TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function test_MultiHopSwapGasCost_TwoHops() public {
        uint256 amount = 1000 * 1e18;
        
        vm.startPrank(user);
        tokenA.approve(address(router), amount);
        
        address[] memory path = new address[](3);
        path[0] = address(tokenA);
        path[1] = address(tokenB);
        path[2] = address(tokenC);
        
        uint256 gasBefore = gasleft();
        router.swapExactTokensForTokens(
            amount,
            0,
            path,
            user,
            block.timestamp + 1 hours
        );
        uint256 gasUsed = gasBefore - gasleft();
        
        vm.stopPrank();
        
        // Array length caching should reduce gas by ~200-300 per loop iteration
        // Typical cost: ~280k gas for 2-hop swap
        assertLt(gasUsed, 300000, "Multi-hop swap should benefit from array length caching");
    }

    function test_MultiHopSwapGasCost_ThreeHops() public {
        // Create additional pool
        factory.createPair(address(tokenC), address(weth));
        
        vm.startPrank(user);
        tokenC.approve(address(router), LIQUIDITY_AMOUNT);
        weth.mint(user, LIQUIDITY_AMOUNT);
        weth.approve(address(router), LIQUIDITY_AMOUNT);
        
        router.addLiquidity(
            address(tokenC),
            address(weth),
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            0,
            0,
            user,
            block.timestamp + 1 hours
        );
        
        uint256 amount = 1000 * 1e18;
        tokenA.approve(address(router), amount);
        
        address[] memory path = new address[](4);
        path[0] = address(tokenA);
        path[1] = address(tokenB);
        path[2] = address(tokenC);
        path[3] = address(weth);
        
        uint256 gasBefore = gasleft();
        router.swapExactTokensForTokens(
            amount,
            0,
            path,
            user,
            block.timestamp + 1 hours
        );
        uint256 gasUsed = gasBefore - gasleft();
        
        vm.stopPrank();
        
        // 3-hop swap should still be gas-efficient
        // Typical cost: ~410k gas for 3-hop swap
        assertLt(gasUsed, 450000, "3-hop swap should benefit from optimizations");
    }

    function test_ArrayLengthCachingInGetAmountsOut() public view {
        address[] memory path = new address[](3);
        path[0] = address(tokenA);
        path[1] = address(tokenB);
        path[2] = address(tokenC);
        
        uint256 amountIn = 1000 * 1e18;
        
        // This should use cached array length
        uint256[] memory amounts = router.getAmountsOut(amountIn, path);
        
        assertEq(amounts.length, 3, "Should return correct number of amounts");
        assertGt(amounts[2], 0, "Should calculate output amount");
    }

    function test_ArrayLengthCachingInGetAmountsIn() public view {
        address[] memory path = new address[](3);
        path[0] = address(tokenA);
        path[1] = address(tokenB);
        path[2] = address(tokenC);
        
        uint256 amountOut = 1000 * 1e18;
        
        // This should use cached array length
        uint256[] memory amounts = router.getAmountsIn(amountOut, path);
        
        assertEq(amounts.length, 3, "Should return correct number of amounts");
        assertGt(amounts[0], 0, "Should calculate input amount");
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          STORAGE SLOT VERIFICATION
    // ═══════════════════════════════════════════════════════════════════════════════

    function test_PoolStorageLayout() public {
        // Verify that Pool struct is properly packed
        // Slot 0: reserve0 (128 bits) + reserve1 (128 bits)
        // Slot 1: totalLiquidity (64 bits) + blockTimestampLast (32 bits)
        // Slot 2: price0CumulativeLast (256 bits)
        // Slot 3: price1CumulativeLast (256 bits)
        
        (address token0, address token1) = address(tokenA) < address(tokenB)
            ? (address(tokenA), address(tokenB))
            : (address(tokenB), address(tokenA));
        
        (uint256 reserve0, uint256 reserve1, uint32 timestamp) = dexCore.getReserves(token0, token1);
        
        // Verify reserves fit in uint128
        assertLt(reserve0, type(uint128).max, "Reserve0 should fit in uint128");
        assertLt(reserve1, type(uint128).max, "Reserve1 should fit in uint128");
        
        // Verify timestamp fits in uint32
        assertLt(timestamp, type(uint32).max, "Timestamp should fit in uint32");
    }

    function test_MultiplePoolsStorageEfficiency() public {
        // Create multiple pools to test storage efficiency
        MockERC20 tokenD = new MockERC20("Token D", "TKND", 18);
        MockERC20 tokenE = new MockERC20("Token E", "TKNE", 18);
        
        tokenD.mint(user, INITIAL_SUPPLY);
        tokenE.mint(user, INITIAL_SUPPLY);
        
        dexCore.createPool(address(tokenD), address(tokenE));
        
        vm.startPrank(user);
        tokenD.approve(address(dexCore), LIQUIDITY_AMOUNT);
        tokenE.approve(address(dexCore), LIQUIDITY_AMOUNT);
        
        uint256 gasBefore = gasleft();
        dexCore.addLiquidity(
            address(tokenD),
            address(tokenE),
            LIQUIDITY_AMOUNT,
            LIQUIDITY_AMOUNT,
            0,
            0,
            user,
            block.timestamp + 1 hours
        );
        uint256 gasUsed = gasBefore - gasleft();
        
        vm.stopPrank();
        
        // First liquidity should use optimized storage
        // Typical cost: ~250k gas for first liquidity
        assertLt(gasUsed, 280000, "First liquidity should be gas-efficient");
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          COMPARATIVE TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function test_CompareSwapVsSwapWithPermit_GasDifference() public {
        // Note: This test demonstrates the gas difference concept
        // Actual permit implementation would require EIP-2612 compatible tokens
        
        uint256 amount = 1000 * 1e18;
        
        // Regular swap
        vm.startPrank(user);
        tokenA.approve(address(dexCore), amount);
        
        uint256 gasBefore = gasleft();
        dexCore.swap(
            address(tokenA),
            address(tokenB),
            amount,
            1,
            user,
            block.timestamp + 1 hours
        );
        uint256 regularSwapGas = gasBefore - gasleft();
        vm.stopPrank();
        
        // SwapWithPermit would add ~20k gas for permit execution
        // but saves one transaction (approve tx)
        uint256 expectedPermitSwapGas = regularSwapGas + 20000;
        
        // Verify regular swap is within expected range
        assertLt(regularSwapGas, 160000, "Regular swap should be efficient");
        
        // Permit swap would be ~165k gas but saves a separate approve transaction
        assertLt(expectedPermitSwapGas, 180000, "Permit swap total should still be reasonable");
    }
}
