// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PriceOracle.sol";
import "../src/DexCore.sol";
import "../src/MockERC20.sol";

/**
 * @title OracleHardeningTests
 * @notice Test suite for M-1 oracle hardening improvements
 * @dev Validates minimum observation window, price deviation circuit breaker, and edge cases
 */
contract OracleHardeningTests is Test {
    PriceOracle public oracle;
    MockERC20 public tokenA;
    MockERC20 public tokenB;
    
    address public owner;
    address public updater;
    
    uint256 constant INITIAL_RESERVE = 100_000 * 1e18;
    uint256 constant SMALL_RESERVE = 1000 * 1e18;
    
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
        owner = address(this);
        updater = makeAddr("updater");
        
        oracle = new PriceOracle();
        tokenA = new MockERC20("Token A", "TKNA", 18);
        tokenB = new MockERC20("Token B", "TKNB", 18);
    }
    
    // ============================================
    // MINIMUM OBSERVATION WINDOW TESTS
    // ============================================
    
    /**
     * @notice Test that consult reverts with window < MIN_TWAP_PERIOD
     */
    function test_Oracle_RevertOnShortWindow() public {
        // Initialize oracle
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, INITIAL_RESERVE);
        
        // Fast forward 5 minutes (less than MIN_TWAP_PERIOD of 10 minutes)
        vm.warp(block.timestamp + 5 minutes);
        
        // Should revert with WindowTooShort
        vm.expectRevert(PriceOracle.WindowTooShort.selector);
        oracle.consult(address(tokenA), address(tokenB), 5 minutes);
    }
    
    /**
     * @notice Test that consult succeeds with window >= MIN_TWAP_PERIOD
     */
    function test_Oracle_SucceedOnValidWindow() public {
        // Initialize oracle
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, INITIAL_RESERVE);
        
        // Fast forward 10 minutes (exactly MIN_TWAP_PERIOD)
        vm.warp(block.timestamp + 10 minutes);
        vm.roll(block.number + 1);
        
        // Update again to accumulate price data
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, INITIAL_RESERVE);
        
        // Fast forward another 10 minutes
        vm.warp(block.timestamp + 10 minutes);
        
        // Should succeed
        (uint256 price0, uint256 price1) = oracle.consult(
            address(tokenA),
            address(tokenB),
            10 minutes
        );
        
        assertGt(price0, 0, "Price0 should be > 0");
        assertGt(price1, 0, "Price1 should be > 0");
    }
    
    /**
     * @notice Test that consult reverts if insufficient time has elapsed
     */
    function test_Oracle_RevertOnInsufficientTimeElapsed() public {
        // Initialize oracle
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, INITIAL_RESERVE);
        
        // Fast forward 5 minutes
        vm.warp(block.timestamp + 5 minutes);
        vm.roll(block.number + 1);
        
        // Update again
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, INITIAL_RESERVE);
        
        // Try to consult with 10 minute window but only 5 minutes elapsed
        vm.expectRevert(PriceOracle.WindowTooShort.selector);
        oracle.consult(address(tokenA), address(tokenB), 10 minutes);
    }
    
    /**
     * @notice Test minimum window enforcement with 30-minute window
     */
    function test_Oracle_EnforceMinimumWindow_30Minutes() public {
        // Initialize oracle
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, INITIAL_RESERVE);
        
        // Fast forward 30 minutes
        vm.warp(block.timestamp + 30 minutes);
        vm.roll(block.number + 1);
        
        // Update again
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, INITIAL_RESERVE);
        
        // Fast forward another 30 minutes
        vm.warp(block.timestamp + 30 minutes);
        
        // Should succeed with 30-minute window
        (uint256 price0, uint256 price1) = oracle.consult(
            address(tokenA),
            address(tokenB),
            30 minutes
        );
        
        assertGt(price0, 0, "Price0 should be > 0");
        assertGt(price1, 0, "Price1 should be > 0");
    }
    
    // ============================================
    // PRICE DEVIATION CIRCUIT BREAKER TESTS
    // ============================================
    
    /**
     * @notice Test that large price deviation triggers circuit breaker
     */
    function test_Oracle_CircuitBreaker_LargeDeviation() public {
        // Initialize oracle with balanced reserves
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, INITIAL_RESERVE);
        
        // Fast forward past MIN_TWAP_PERIOD
        vm.warp(block.timestamp + 15 minutes);
        vm.roll(block.number + 1);
        
        // Update with normal price
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, INITIAL_RESERVE);
        
        // Fast forward again
        vm.warp(block.timestamp + 15 minutes);
        vm.roll(block.number + 1);
        
        // Try to update with 15% price deviation (> 10% threshold)
        // New price: 1.15x the original
        uint256 newReserve1 = (INITIAL_RESERVE * 115) / 100;
        
        // Should revert with PriceDeviationTooHigh
        vm.expectRevert(PriceOracle.PriceDeviationTooHigh.selector);
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, newReserve1);
    }
    
    /**
     * @notice Test that acceptable price deviation does not trigger circuit breaker
     */
    function test_Oracle_CircuitBreaker_AcceptableDeviation() public {
        // Initialize oracle
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, INITIAL_RESERVE);
        
        // Fast forward past MIN_TWAP_PERIOD
        vm.warp(block.timestamp + 15 minutes);
        vm.roll(block.number + 1);
        
        // Update with normal price
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, INITIAL_RESERVE);
        
        // Fast forward again
        vm.warp(block.timestamp + 15 minutes);
        vm.roll(block.number + 1);
        
        // Update with 5% price deviation (< 10% threshold)
        uint256 newReserve1 = (INITIAL_RESERVE * 105) / 100;
        
        // Should succeed
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, newReserve1);
        
        PriceOracle.PriceData memory data = oracle.getPriceData(address(tokenA), address(tokenB));
        assertGt(data.price0Cumulative, 0, "Price should be updated");
    }
    
    /**
     * @notice Test PriceDeviationAlert event emission
     */
    function test_Oracle_EmitPriceDeviationAlert() public {
        // Initialize oracle
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, INITIAL_RESERVE);
        
        // Fast forward past MIN_TWAP_PERIOD
        vm.warp(block.timestamp + 15 minutes);
        vm.roll(block.number + 1);
        
        // Update with normal price
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, INITIAL_RESERVE);
        
        // Fast forward again
        vm.warp(block.timestamp + 15 minutes);
        vm.roll(block.number + 1);
        
        // Update with large deviation - should emit event before reverting
        uint256 newReserve1 = (INITIAL_RESERVE * 120) / 100;
        
        vm.expectEmit(true, true, false, false);
        emit PriceDeviationAlert(
            address(tokenA),
            address(tokenB),
            0, // Will be calculated
            0, // Will be calculated
            0  // Will be calculated
        );
        
        vm.expectRevert(PriceOracle.PriceDeviationTooHigh.selector);
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, newReserve1);
    }
    
    /**
     * @notice Test that deviation within MIN_TWAP_PERIOD only alerts, doesn't revert
     */
    function test_Oracle_AlertOnly_WithinMinWindow() public {
        // Initialize oracle
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, INITIAL_RESERVE);
        
        // Fast forward 5 minutes (< MIN_TWAP_PERIOD)
        vm.warp(block.timestamp + 5 minutes);
        vm.roll(block.number + 1);
        
        // Update with large deviation - should only alert, not revert
        uint256 newReserve1 = (INITIAL_RESERVE * 120) / 100;
        
        // Should emit alert event
        vm.expectEmit(true, true, false, false);
        emit PriceDeviationAlert(
            address(tokenA),
            address(tokenB),
            0,
            0,
            0
        );
        
        // Should NOT revert
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, newReserve1);
    }
    
    /**
     * @notice Test extreme price deviation (50%)
     */
    function test_Oracle_CircuitBreaker_ExtremeDeviation() public {
        // Initialize oracle
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, INITIAL_RESERVE);
        
        // Fast forward past MIN_TWAP_PERIOD
        vm.warp(block.timestamp + 20 minutes);
        vm.roll(block.number + 1);
        
        // Update with normal price
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, INITIAL_RESERVE);
        
        // Fast forward again
        vm.warp(block.timestamp + 20 minutes);
        vm.roll(block.number + 1);
        
        // Try 50% deviation
        uint256 newReserve1 = (INITIAL_RESERVE * 150) / 100;
        
        vm.expectRevert(PriceOracle.PriceDeviationTooHigh.selector);
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, newReserve1);
    }
    
    // ============================================
    // ZERO LIQUIDITY TESTS
    // ============================================
    
    /**
     * @notice Test that zero reserve0 reverts
     */
    function test_Oracle_RevertOnZeroReserve0() public {
        vm.expectRevert(PriceOracle.InvalidReserves.selector);
        oracle.update(address(tokenA), address(tokenB), 0, INITIAL_RESERVE);
    }
    
    /**
     * @notice Test that zero reserve1 reverts
     */
    function test_Oracle_RevertOnZeroReserve1() public {
        vm.expectRevert(PriceOracle.InvalidReserves.selector);
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, 0);
    }
    
    /**
     * @notice Test that both zero reserves revert
     */
    function test_Oracle_RevertOnBothZeroReserves() public {
        vm.expectRevert(PriceOracle.InvalidReserves.selector);
        oracle.update(address(tokenA), address(tokenB), 0, 0);
    }
    
    /**
     * @notice Test consult with no historical data
     */
    function test_Oracle_RevertOnNoHistoricalData() public {
        vm.expectRevert(PriceOracle.NoHistoricalData.selector);
        oracle.consult(address(tokenA), address(tokenB), 10 minutes);
    }
    
    // ============================================
    // EDGE CASE TESTS
    // ============================================
    
    /**
     * @notice Test same-block update prevention
     */
    function test_Oracle_PreventSameBlockUpdate() public {
        // First update
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, INITIAL_RESERVE);
        
        // Try second update in same block
        vm.expectRevert(PriceOracle.SameBlockUpdate.selector);
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, INITIAL_RESERVE);
    }
    
    /**
     * @notice Test PriceUpdated event emission
     */
    function test_Oracle_EmitPriceUpdated() public {
        vm.expectEmit(true, true, false, false);
        emit PriceUpdated(
            address(tokenA),
            address(tokenB),
            0,
            0,
            uint32(block.timestamp),
            uint32(block.number)
        );
        
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, INITIAL_RESERVE);
    }
    
    /**
     * @notice Test multiple updates over time build correct TWAP
     */
    function test_Oracle_TWAPAccumulation() public {
        // Initial update
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, INITIAL_RESERVE);
        
        // Update every 5 minutes for 30 minutes
        for (uint256 i = 1; i <= 6; i++) {
            vm.warp(block.timestamp + 5 minutes);
            vm.roll(block.number + 1);
            
            oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, INITIAL_RESERVE);
        }
        
        // Consult should work with 30-minute window
        vm.warp(block.timestamp + 5 minutes);
        
        (uint256 price0, uint256 price1) = oracle.consult(
            address(tokenA),
            address(tokenB),
            30 minutes
        );
        
        // Prices should be equal since reserves were constant
        assertApproxEqRel(price0, 1e18, 0.01e18, "Price0 should be ~1.0");
        assertApproxEqRel(price1, 1e18, 0.01e18, "Price1 should be ~1.0");
    }
    
    /**
     * @notice Test gradual price changes don't trigger circuit breaker
     */
    function test_Oracle_GradualPriceChanges() public {
        // Initialize
        oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, INITIAL_RESERVE);
        
        uint256 currentReserve1 = INITIAL_RESERVE;
        
        // Gradually increase price by 2% every 15 minutes (total 12% over 90 minutes)
        for (uint256 i = 0; i < 6; i++) {
            vm.warp(block.timestamp + 15 minutes);
            vm.roll(block.number + 1);
            
            // Increase by 2%
            currentReserve1 = (currentReserve1 * 102) / 100;
            
            // Should not revert - each step is within 10% of TWAP
            oracle.update(address(tokenA), address(tokenB), INITIAL_RESERVE, currentReserve1);
        }
        
        PriceOracle.PriceData memory data = oracle.getPriceData(address(tokenA), address(tokenB));
        assertGt(data.price0Cumulative, 0, "Price should accumulate");
    }
    
    /**
     * @notice Test very small reserves (low liquidity scenario)
     */
    function test_Oracle_SmallReserves() public {
        uint256 smallReserve = 100 * 1e18; // $100 worth
        
        oracle.update(address(tokenA), address(tokenB), smallReserve, smallReserve);
        
        vm.warp(block.timestamp + 15 minutes);
        vm.roll(block.number + 1);
        
        oracle.update(address(tokenA), address(tokenB), smallReserve, smallReserve);
        
        vm.warp(block.timestamp + 15 minutes);
        
        (uint256 price0, uint256 price1) = oracle.consult(
            address(tokenA),
            address(tokenB),
            10 minutes
        );
        
        assertGt(price0, 0, "Should work with small reserves");
        assertGt(price1, 0, "Should work with small reserves");
    }
}
