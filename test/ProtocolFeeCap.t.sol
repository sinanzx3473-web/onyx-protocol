// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MinimalForwarder.sol";
import "../src/DexCore.sol";
import "../src/MockERC20.sol";

/**
 * @title ProtocolFeeCapTest
 * @notice Tests for protocol fee cap enforcement (max 1%)
 */
contract ProtocolFeeCapTest is Test {
    DexCore public dex;
    MockERC20 public tokenA;
    MockERC20 public tokenB;
    
    MinimalForwarder public forwarder;
    address public owner = address(this);
    address public user = address(0x1);
    
    function setUp() public {
        // Deploy mock WETH first
        MockERC20 weth = new MockERC20("Wrapped ETH", "WETH", 18);
        forwarder = new MinimalForwarder();
        
        // Deploy contracts
        dex = new DexCore(address(0x1234), address(weth), address(forwarder));
        tokenA = new MockERC20("Token A", "TKA", 18);
        tokenB = new MockERC20("Token B", "TKB", 18);
        
        // Mint tokens
        tokenA.mint(user, 1000 ether);
        tokenB.mint(user, 1000 ether);
    }
    
    /**
     * @notice Test that MAX_PROTOCOL_FEE_BPS constant is set correctly to 100 (1%)
     */
    function test_MaxProtocolFeeConstant() public view {
        assertEq(dex.MAX_PROTOCOL_FEE_BPS(), 100, "Max protocol fee should be 100 bps (1%)");
    }
    
    /**
     * @notice Test setting protocol fee to valid values (0-100 bps)
     */
    function test_SetProtocolFeeValid() public {
        // Test 0%
        dex.scheduleProtocolFeeUpdate(0);
        vm.warp(block.timestamp + 2 days);
        dex.executeProtocolFeeUpdate();
        assertEq(dex.protocolFeeBps(), 0, "Protocol fee should be 0");
        
        // Test 0.5%
        dex.scheduleProtocolFeeUpdate(50);
        vm.warp(block.timestamp + 2 days);
        dex.executeProtocolFeeUpdate();
        assertEq(dex.protocolFeeBps(), 50, "Protocol fee should be 50 bps");
        
        // Test 1% (max)
        dex.scheduleProtocolFeeUpdate(100);
        vm.warp(block.timestamp + 2 days);
        dex.executeProtocolFeeUpdate();
        assertEq(dex.protocolFeeBps(), 100, "Protocol fee should be 100 bps");
    }
    
    /**
     * @notice Test that setting protocol fee above 1% reverts
     */
    function test_SetProtocolFeeAboveMaxReverts() public {
        vm.expectRevert(DexCore.AmountTooLarge.selector);
        dex.scheduleProtocolFeeUpdate(101);
    }
    
    /**
     * @notice Test that setting protocol fee to 10% (old max) reverts
     */
    function test_SetProtocolFeeOldMaxReverts() public {
        vm.expectRevert(DexCore.AmountTooLarge.selector);
        dex.scheduleProtocolFeeUpdate(1000); // Old 10% limit
    }
    
    /**
     * @notice Test that setting protocol fee to extreme values reverts
     */
    function test_SetProtocolFeeExtremeValuesRevert() public {
        vm.expectRevert(DexCore.AmountTooLarge.selector);
        dex.scheduleProtocolFeeUpdate(5000); // 50%
        
        vm.expectRevert(DexCore.AmountTooLarge.selector);
        dex.scheduleProtocolFeeUpdate(10000); // 100%
        
        vm.expectRevert(DexCore.AmountTooLarge.selector);
        dex.scheduleProtocolFeeUpdate(type(uint256).max);
    }
    
    /**
     * @notice Test that only owner can set protocol fee
     */
    function test_SetProtocolFeeOnlyOwner() public {
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", user));
        dex.scheduleProtocolFeeUpdate(50);
    }
    
    /**
     * @notice Test ProtocolFeeUpdated event emission
     */
    function test_ProtocolFeeUpdatedEvent() public {
        vm.expectEmit(true, true, true, true);
        dex.scheduleProtocolFeeUpdate(75);
        vm.warp(block.timestamp + 2 days);
        
        emit DexCore.ProtocolFeeUpdated(0, 75);
        dex.executeProtocolFeeUpdate();
    }
    
    /**
     * @notice Fuzz test: valid protocol fee values (0-100)
     */
    function testFuzz_SetProtocolFeeValid(uint256 feeBps) public {
        vm.assume(feeBps <= 100);
        
        dex.scheduleProtocolFeeUpdate(feeBps);
        vm.warp(block.timestamp + 2 days);
        dex.executeProtocolFeeUpdate();
        assertEq(dex.protocolFeeBps(), feeBps, "Protocol fee should match input");
    }
    
    /**
     * @notice Fuzz test: invalid protocol fee values (>100)
     */
    function testFuzz_SetProtocolFeeInvalid(uint256 feeBps) public {
        vm.assume(feeBps > 100);
        
        vm.expectRevert(DexCore.AmountTooLarge.selector);
        dex.scheduleProtocolFeeUpdate(feeBps);
    }
    
    /**
     * @notice Test that protocol fee cap prevents governance from setting unreasonable fees
     */
    function test_ProtocolFeeCapPreventsUnreasonableFees() public {
        // Attempt to set 2% fee (should fail)
        vm.expectRevert(DexCore.AmountTooLarge.selector);
        dex.scheduleProtocolFeeUpdate(200);
        
        // Verify fee remains at default
        assertEq(dex.protocolFeeBps(), 0, "Protocol fee should remain at default");
        
        // Set to max allowed (1%)
        dex.scheduleProtocolFeeUpdate(100);
        vm.warp(block.timestamp + 2 days);
        dex.executeProtocolFeeUpdate();
        assertEq(dex.protocolFeeBps(), 100, "Protocol fee should be at max");
        
        // Attempt to increase beyond max (should fail)
        vm.expectRevert(DexCore.AmountTooLarge.selector);
        dex.scheduleProtocolFeeUpdate(101);
        
        // Verify fee remains at max
        assertEq(dex.protocolFeeBps(), 100, "Protocol fee should remain at max");
    }
}
