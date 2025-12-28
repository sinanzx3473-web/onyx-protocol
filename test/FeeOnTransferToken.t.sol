// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MinimalForwarder.sol";
import "../src/DexCore.sol";
import "../src/MockFeeOnTransferToken.sol";
import "../src/MockERC20.sol";

/**
 * @title FeeOnTransferTokenTest
 * @notice Comprehensive tests for fee-on-transfer token compatibility
 */
contract FeeOnTransferTokenTest is Test {
    DexCore public dexCore;
    MockFeeOnTransferToken public feeToken;
    MockERC20 public normalToken;
    MinimalForwarder public forwarder;
    
    address public owner = address(this);
    address public user = address(0x1);
    address public feeRecipient = address(0x2);
    
    uint256 constant INITIAL_BALANCE = 1000000 * 1e18;

    function setUp() public {
        // Deploy DexCore
        address factory = address(0x123);
        address weth = address(0x456);
        vm.etch(weth, "0x00"); // Mock WETH contract
        forwarder = new MinimalForwarder();
        dexCore = new DexCore(factory, weth, address(forwarder));
        
        // Deploy normal token
        normalToken = new MockERC20("Normal Token", "NORM", 18);
        normalToken.mint(user, INITIAL_BALANCE);
        
        // Deploy fee-on-transfer token with 3% fee
        feeToken = new MockFeeOnTransferToken("Fee Token", "FEE", 300, feeRecipient); // 3% fee
        feeToken.mint(user, INITIAL_BALANCE);
        
        // Create pool
        dexCore.createPool(address(feeToken), address(normalToken));
        
        // Approve DexCore
        vm.startPrank(user);
        feeToken.approve(address(dexCore), type(uint256).max);
        normalToken.approve(address(dexCore), type(uint256).max);
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          ADD LIQUIDITY TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function test_AddLiquidity_WithFeeOnTransferToken_3Percent() public {
        vm.startPrank(user);
        
        uint256 feeAmount = 1000 * 1e18;
        uint256 normalAmount = 1000 * 1e18;
        
        // Calculate expected received amount (97% after 3% fee)
        uint256 expectedReceived = (feeAmount * 9700) / 10000;
        
        // Add liquidity
        (uint256 amountA, uint256 amountB, uint256 liquidity) = dexCore.addLiquidity(
            address(feeToken),
            address(normalToken),
            feeAmount,
            normalAmount,
            0, // No minimum for first liquidity
            0,
            user,
            block.timestamp + 1000
        );
        
        vm.stopPrank();
        
        // Verify actual amounts used match received amounts
        assertEq(amountA, expectedReceived, "Fee token amount should be actual received");
        assertEq(amountB, normalAmount, "Normal token amount should be full");
        
        // Verify reserves reflect actual received amounts
        (uint256 reserveA, uint256 reserveB,) = dexCore.getReserves(address(feeToken), address(normalToken));
        assertEq(reserveA, expectedReceived, "Reserve should be actual received amount");
        assertEq(reserveB, normalAmount, "Reserve should be full normal amount");
        
        // Verify liquidity minted correctly
        assertTrue(liquidity > 0, "Liquidity should be minted");
    }

    function test_AddLiquidity_WithFeeOnTransferToken_SlippageProtection() public {
        vm.startPrank(user);
        
        uint256 feeAmount = 1000 * 1e18;
        uint256 normalAmount = 1000 * 1e18;
        
        // Set minimum amounts that expect full transfer (will fail due to fee)
        uint256 minFeeAmount = feeAmount; // Expects 100%, but will receive 97%
        
        // Should revert because received amount < minimum
        vm.expectRevert(DexCore.SlippageExceeded.selector);
        dexCore.addLiquidity(
            address(feeToken),
            address(normalToken),
            feeAmount,
            normalAmount,
            minFeeAmount, // Too high - expects no fee
            0,
            user,
            block.timestamp + 1000
        );
        
        vm.stopPrank();
    }

    function test_AddLiquidity_WithFeeOnTransferToken_AcceptableSlippage() public {
        vm.startPrank(user);
        
        uint256 feeAmount = 1000 * 1e18;
        uint256 normalAmount = 1000 * 1e18;
        
        // Set minimum that accounts for 3% fee
        uint256 minFeeAmount = (feeAmount * 9700) / 10000; // 97%
        
        // Should succeed
        (uint256 amountA, uint256 amountB, uint256 liquidity) = dexCore.addLiquidity(
            address(feeToken),
            address(normalToken),
            feeAmount,
            normalAmount,
            minFeeAmount,
            0,
            user,
            block.timestamp + 1000
        );
        
        vm.stopPrank();
        
        assertEq(amountA, minFeeAmount, "Should receive expected amount after fee");
        assertTrue(liquidity > 0, "Liquidity should be minted");
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                              SWAP TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function test_Swap_WithFeeOnTransferToken_3Percent() public {
        // First add liquidity
        vm.startPrank(user);
        dexCore.addLiquidity(
            address(feeToken),
            address(normalToken),
            10000 * 1e18,
            10000 * 1e18,
            0,
            0,
            user,
            block.timestamp + 1000
        );
        
        // Now swap fee token for normal token
        uint256 swapAmount = 100 * 1e18;
        uint256 expectedReceived = (swapAmount * 9700) / 10000; // 97% after fee
        
        // Calculate expected output (using actual received amount)
        uint256 amountOut = dexCore.getAmountOut(expectedReceived, address(feeToken), address(normalToken));
        
        // Execute swap
        uint256 actualOut = dexCore.swap(
            address(feeToken),
            address(normalToken),
            swapAmount,
            1, // Minimum output
            user,
            block.timestamp + 1000
        );
        
        vm.stopPrank();
        
        // Verify swap succeeded
        assertTrue(actualOut > 0, "Should receive output tokens");
    }

    function test_Swap_WithFeeOnTransferToken_ExcessiveFee_Reverts() public {
        // Add initial liquidity
        vm.startPrank(user);
        dexCore.addLiquidity(
            address(feeToken),
            address(normalToken),
            10000 * 1e18,
            10000 * 1e18,
            0,
            0,
            user,
            block.timestamp + 1000
        );
        vm.stopPrank();
        
        // Change fee to 6% (exceeds 5% limit)
        feeToken.setTransferFee(600); // 6%
        
        vm.startPrank(user);
        
        uint256 swapAmount = 100 * 1e18;
        
        // Should revert due to excessive fee
        vm.expectRevert(DexCore.FeeOnTransferTooHigh.selector);
        dexCore.swap(
            address(feeToken),
            address(normalToken),
            swapAmount,
            1,
            user,
            block.timestamp + 1000
        );
        
        vm.stopPrank();
    }

    function test_Swap_WithFeeOnTransferToken_ExactlyAtLimit() public {
        // Add initial liquidity
        vm.startPrank(user);
        dexCore.addLiquidity(
            address(feeToken),
            address(normalToken),
            10000 * 1e18,
            10000 * 1e18,
            0,
            0,
            user,
            block.timestamp + 1000
        );
        vm.stopPrank();
        
        // Set fee to exactly 5% (at limit)
        feeToken.setTransferFee(500); // 5%
        
        vm.startPrank(user);
        
        uint256 swapAmount = 100 * 1e18;
        
        // Should succeed (exactly at 95% threshold)
        uint256 amountOut = dexCore.swap(
            address(feeToken),
            address(normalToken),
            swapAmount,
            1,
            user,
            block.timestamp + 1000
        );
        
        vm.stopPrank();
        
        assertTrue(amountOut > 0, "Swap should succeed at 5% fee limit");
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          RESERVE UPDATE TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function test_Reserves_UpdatedWithActualReceivedAmounts() public {
        vm.startPrank(user);
        
        uint256 feeAmount = 1000 * 1e18;
        uint256 normalAmount = 1000 * 1e18;
        uint256 expectedReceived = (feeAmount * 9700) / 10000; // 97%
        
        // Add liquidity
        dexCore.addLiquidity(
            address(feeToken),
            address(normalToken),
            feeAmount,
            normalAmount,
            0,
            0,
            user,
            block.timestamp + 1000
        );
        
        // Check reserves
        (uint256 reserveA, uint256 reserveB,) = dexCore.getReserves(address(feeToken), address(normalToken));
        
        vm.stopPrank();
        
        // Reserves should reflect actual received amounts
        assertEq(reserveA, expectedReceived, "Fee token reserve incorrect");
        assertEq(reserveB, normalAmount, "Normal token reserve incorrect");
        
        // Verify contract actually holds these amounts
        assertEq(feeToken.balanceOf(address(dexCore)), expectedReceived, "Contract balance mismatch");
        assertEq(normalToken.balanceOf(address(dexCore)), normalAmount, "Contract balance mismatch");
    }

    function test_MultipleSwaps_ReservesStayAccurate() public {
        // Add initial liquidity
        vm.startPrank(user);
        dexCore.addLiquidity(
            address(feeToken),
            address(normalToken),
            10000 * 1e18,
            10000 * 1e18,
            0,
            0,
            user,
            block.timestamp + 1000
        );
        
        // Perform multiple swaps
        for (uint i = 0; i < 5; i++) {
            dexCore.swap(
                address(feeToken),
                address(normalToken),
                100 * 1e18,
                1,
                user,
                block.timestamp + 1000
            );
        }
        
        vm.stopPrank();
        
        // Verify reserves match actual balances
        (uint256 reserveA, uint256 reserveB,) = dexCore.getReserves(address(feeToken), address(normalToken));
        
        assertEq(feeToken.balanceOf(address(dexCore)), reserveA, "Reserves should match balance after swaps");
        assertEq(normalToken.balanceOf(address(dexCore)), reserveB, "Reserves should match balance after swaps");
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          EDGE CASE TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function test_ZeroFeeToken_WorksNormally() public {
        // Create token with 0% fee
        MockFeeOnTransferToken zeroFeeToken = new MockFeeOnTransferToken("Zero Fee", "ZERO", 0, feeRecipient);
        zeroFeeToken.mint(user, INITIAL_BALANCE);
        
        dexCore.createPool(address(zeroFeeToken), address(normalToken));
        
        vm.startPrank(user);
        zeroFeeToken.approve(address(dexCore), type(uint256).max);
        
        // Should work exactly like normal token
        (uint256 amountA, uint256 amountB, uint256 liquidity) = dexCore.addLiquidity(
            address(zeroFeeToken),
            address(normalToken),
            1000 * 1e18,
            1000 * 1e18,
            1000 * 1e18, // Expect full amount
            1000 * 1e18,
            user,
            block.timestamp + 1000
        );
        
        vm.stopPrank();
        
        assertEq(amountA, 1000 * 1e18, "Should receive full amount with 0% fee");
        assertEq(amountB, 1000 * 1e18, "Should receive full amount");
    }

    function testFuzz_DifferentFeePercentages(uint256 feeBps) public {
        // Limit fee to 0-5% (0-500 bps)
        feeBps = bound(feeBps, 0, 500);
        
        // Create token with random fee
        MockFeeOnTransferToken randomFeeToken = new MockFeeOnTransferToken(
            "Random Fee",
            "RAND",
            feeBps,
            feeRecipient
        );
        randomFeeToken.mint(user, INITIAL_BALANCE);
        
        dexCore.createPool(address(randomFeeToken), address(normalToken));
        
        vm.startPrank(user);
        randomFeeToken.approve(address(dexCore), type(uint256).max);
        
        uint256 amount = 1000 * 1e18;
        uint256 expectedReceived = (amount * (10000 - feeBps)) / 10000;
        
        // Add liquidity with appropriate minimum
        (uint256 amountA,,) = dexCore.addLiquidity(
            address(randomFeeToken),
            address(normalToken),
            amount,
            amount,
            expectedReceived,
            0,
            user,
            block.timestamp + 1000
        );
        
        vm.stopPrank();
        
        // Verify received amount matches expected
        assertEq(amountA, expectedReceived, "Received amount should match expected after fee");
    }
}
