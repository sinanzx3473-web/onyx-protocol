// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PriceOracle.sol";

/**
 * @title PriceOracle Test Suite
 * @notice Comprehensive tests for TWAP oracle manipulation resistance
 */
contract PriceOracleTest is Test {
    PriceOracle public oracle;
    
    address public constant TOKEN0 = address(0x1);
    address public constant TOKEN1 = address(0x2);
    
    uint256 public constant INITIAL_RESERVE0 = 1000 ether;
    uint256 public constant INITIAL_RESERVE1 = 2000 ether;
    
    event PriceDeviationAlert(
        address indexed token0,
        address indexed token1,
        uint256 currentPrice,
        uint256 lastTWAP,
        uint256 deviation
    );
    
    event PriceUpdated(
        address indexed token0,
        address indexed token1,
        uint256 price0Cumulative,
        uint256 price1Cumulative,
        uint32 blockTimestamp,
        uint32 blockNumber
    );

    function setUp() public {
        oracle = new PriceOracle();
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          BASIC FUNCTIONALITY TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function testInitialUpdate() public {
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, INITIAL_RESERVE1);
        
        PriceOracle.PriceData memory data = oracle.getPriceData(TOKEN0, TOKEN1);
        
        assertEq(data.price0Cumulative, 0, "Initial cumulative should be 0");
        assertEq(data.price1Cumulative, 0, "Initial cumulative should be 0");
        assertEq(data.blockTimestampLast, uint32(block.timestamp % 2**32));
        assertEq(data.blockNumberLast, uint32(block.number));
    }

    function testCannotUpdateSameBlock() public {
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, INITIAL_RESERVE1);
        
        vm.expectRevert(PriceOracle.SameBlockUpdate.selector);
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, INITIAL_RESERVE1);
    }

    function testUpdateAccumulatesPrices() public {
        // First update
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, INITIAL_RESERVE1);
        
        // Advance time by 10 minutes
        vm.warp(block.timestamp + 10 minutes);
        vm.roll(block.number + 1);
        
        // Second update
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, INITIAL_RESERVE1);
        
        PriceOracle.PriceData memory data = oracle.getPriceData(TOKEN0, TOKEN1);
        
        // Price0 = reserve1 / reserve0 = 2000 / 1000 = 2e18
        // Cumulative = 2e18 * 600 seconds = 1200e18
        assertGt(data.price0Cumulative, 0, "Cumulative should accumulate");
        assertGt(data.price1Cumulative, 0, "Cumulative should accumulate");
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                      MINIMUM OBSERVATION WINDOW TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function testConsultRequiresMinimumWindow() public {
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, INITIAL_RESERVE1);
        
        vm.warp(block.timestamp + 10 minutes);
        vm.roll(block.number + 1);
        
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, INITIAL_RESERVE1);
        
        // Should revert with window < 10 minutes
        vm.expectRevert(PriceOracle.WindowTooShort.selector);
        oracle.consult(TOKEN0, TOKEN1, 5 minutes);
    }

    function testConsultSucceedsWithMinimumWindow() public {
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, INITIAL_RESERVE1);
        
        vm.warp(block.timestamp + 10 minutes);
        vm.roll(block.number + 1);
        
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, INITIAL_RESERVE1);
        
        vm.warp(block.timestamp + 1 minutes);
        
        // Should succeed with window >= 10 minutes
        (uint256 price0Avg, uint256 price1Avg) = oracle.consult(TOKEN0, TOKEN1, 10 minutes);
        
        assertGt(price0Avg, 0, "Price0 average should be > 0");
        assertGt(price1Avg, 0, "Price1 average should be > 0");
    }

    function testConsultRequiresSufficientTimeElapsed() public {
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, INITIAL_RESERVE1);
        
        vm.warp(block.timestamp + 5 minutes);
        vm.roll(block.number + 1);
        
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, INITIAL_RESERVE1);
        
        // Only 5 minutes elapsed, but requesting 10 minute window
        vm.expectRevert(PriceOracle.WindowTooShort.selector);
        oracle.consult(TOKEN0, TOKEN1, 10 minutes);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                      PRICE DEVIATION CIRCUIT BREAKER TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function testPriceDeviationCircuitBreaker() public {
        // Initial update
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, INITIAL_RESERVE1);
        
        // Advance time by 10 minutes
        vm.warp(block.timestamp + 10 minutes);
        vm.roll(block.number + 1);
        
        // Try to update with 15% price deviation (exceeds 10% threshold)
        // Original price: 2000/1000 = 2
        // New price: 2300/1000 = 2.3 (15% increase)
        uint256 newReserve1 = INITIAL_RESERVE1 * 115 / 100; // 15% increase
        
        vm.expectRevert(PriceOracle.PriceDeviationTooHigh.selector);
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, newReserve1);
    }

    function testPriceDeviationWithinThreshold() public {
        // Initial update
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, INITIAL_RESERVE1);
        
        // Advance time by 10 minutes
        vm.warp(block.timestamp + 10 minutes);
        vm.roll(block.number + 1);
        
        // Update with 8% price deviation (within 10% threshold)
        uint256 newReserve1 = INITIAL_RESERVE1 * 108 / 100; // 8% increase
        
        // Should succeed
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, newReserve1);
        
        PriceOracle.PriceData memory data = oracle.getPriceData(TOKEN0, TOKEN1);
        assertGt(data.price0Cumulative, 0, "Should update successfully");
    }

    function testPriceDeviationAlertEmitted() public {
        // Initial update
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, INITIAL_RESERVE1);
        
        // Advance time by 10 minutes
        vm.warp(block.timestamp + 10 minutes);
        vm.roll(block.number + 1);
        
        // Update with 12% price deviation (exceeds 10% threshold)
        uint256 newReserve1 = INITIAL_RESERVE1 * 112 / 100; // 12% increase
        
        // Expect PriceDeviationAlert event before revert
        vm.expectEmit(true, true, false, false);
        emit PriceDeviationAlert(TOKEN0, TOKEN1, 0, 0, 0); // Values will be calculated
        
        vm.expectRevert(PriceOracle.PriceDeviationTooHigh.selector);
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, newReserve1);
    }

    function testPriceDeviationAlertOnlyBeforeMinWindow() public {
        // Initial update
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, INITIAL_RESERVE1);
        
        // Advance time by 5 minutes (less than MIN_TWAP_PERIOD)
        vm.warp(block.timestamp + 5 minutes);
        vm.roll(block.number + 1);
        
        // Update with 12% price deviation
        uint256 newReserve1 = INITIAL_RESERVE1 * 112 / 100;
        
        // Should emit alert but NOT revert (before MIN_TWAP_PERIOD)
        vm.expectEmit(true, true, false, false);
        emit PriceDeviationAlert(TOKEN0, TOKEN1, 0, 0, 0);
        
        // Should succeed (no revert)
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, newReserve1);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                      MANIPULATION RESISTANCE TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function testCannotManipulatePriceInSingleBlock() public {
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, INITIAL_RESERVE1);
        
        // Try to manipulate price in same block
        vm.expectRevert(PriceOracle.SameBlockUpdate.selector);
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0 * 2, INITIAL_RESERVE1);
    }

    function testCannotManipulatePriceWithLargeDeviation() public {
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, INITIAL_RESERVE1);
        
        vm.warp(block.timestamp + 10 minutes);
        vm.roll(block.number + 1);
        
        // Try to double the price (100% deviation)
        vm.expectRevert(PriceOracle.PriceDeviationTooHigh.selector);
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, INITIAL_RESERVE1 * 2);
    }

    function testGradualPriceChangesAllowed() public {
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, INITIAL_RESERVE1);
        
        // Gradually increase price by 5% every 10 minutes (within threshold)
        for (uint256 i = 1; i <= 5; i++) {
            vm.warp(block.timestamp + 10 minutes);
            vm.roll(block.number + 1);
            
            uint256 newReserve1 = INITIAL_RESERVE1 * (100 + i * 5) / 100;
            oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, newReserve1);
        }
        
        PriceOracle.PriceData memory data = oracle.getPriceData(TOKEN0, TOKEN1);
        assertGt(data.price0Cumulative, 0, "Should allow gradual changes");
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          FUZZ TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function testFuzzPriceDeviationThreshold(uint256 deviationBps) public {
        vm.assume(deviationBps <= 10000); // Max 100% deviation
        
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, INITIAL_RESERVE1);
        
        vm.warp(block.timestamp + 10 minutes);
        vm.roll(block.number + 1);
        
        uint256 newReserve1 = INITIAL_RESERVE1 * (10000 + deviationBps) / 10000;
        
        if (deviationBps > 1000) { // > 10% deviation
            vm.expectRevert(PriceOracle.PriceDeviationTooHigh.selector);
        }
        
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, newReserve1);
    }

    function testFuzzTimeWindow(uint32 timeWindow) public {
        vm.assume(timeWindow > 0 && timeWindow < 365 days);
        
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, INITIAL_RESERVE1);
        
        vm.warp(block.timestamp + timeWindow);
        vm.roll(block.number + 1);
        
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, INITIAL_RESERVE1);
        
        vm.warp(block.timestamp + 1 minutes);
        
        if (timeWindow < 10 minutes) {
            vm.expectRevert(PriceOracle.WindowTooShort.selector);
        }
        
        oracle.consult(TOKEN0, TOKEN1, 10 minutes);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          EDGE CASES
    // ═══════════════════════════════════════════════════════════════════════════════

    function testCannotUpdateWithZeroReserves() public {
        vm.expectRevert(PriceOracle.InvalidReserves.selector);
        oracle.update(TOKEN0, TOKEN1, 0, INITIAL_RESERVE1);
        
        vm.expectRevert(PriceOracle.InvalidReserves.selector);
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, 0);
    }

    function testCannotConsultWithoutHistoricalData() public {
        vm.expectRevert(PriceOracle.NoHistoricalData.selector);
        oracle.consult(TOKEN0, TOKEN1, 10 minutes);
    }

    function testPriceOverflowHandling() public {
        // Test with very large reserves to check overflow handling
        uint256 largeReserve = type(uint112).max;
        
        oracle.update(TOKEN0, TOKEN1, largeReserve, largeReserve);
        
        vm.warp(block.timestamp + 10 minutes);
        vm.roll(block.number + 1);
        
        // Should handle overflow gracefully (unchecked arithmetic)
        oracle.update(TOKEN0, TOKEN1, largeReserve, largeReserve);
        
        PriceOracle.PriceData memory data = oracle.getPriceData(TOKEN0, TOKEN1);
        assertGt(data.price0Cumulative, 0, "Should handle large values");
    }

    function testMultiplePairTracking() public {
        address token2 = address(0x3);
        address token3 = address(0x4);
        
        // Update pair 1
        oracle.update(TOKEN0, TOKEN1, INITIAL_RESERVE0, INITIAL_RESERVE1);
        
        vm.roll(block.number + 1);
        
        // Update pair 2
        oracle.update(token2, token3, INITIAL_RESERVE0 * 2, INITIAL_RESERVE1 * 2);
        
        // Verify both pairs tracked independently
        PriceOracle.PriceData memory data1 = oracle.getPriceData(TOKEN0, TOKEN1);
        PriceOracle.PriceData memory data2 = oracle.getPriceData(token2, token3);
        
        assertEq(data1.blockNumberLast, 1);
        assertEq(data2.blockNumberLast, 2);
    }
}
