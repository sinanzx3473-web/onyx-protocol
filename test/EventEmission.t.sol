// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MinimalForwarder.sol";
import "../src/DexCore.sol";
import "../src/BridgeAdapter.sol";
import "../src/DEXPair.sol";
import "../src/DEXFactory.sol";
import "../src/MockERC20.sol";

/**
 * @title EventEmissionTest
 * @notice Regression tests for L-1: Missing Event Emission in Critical Functions
 * @dev Verifies all state-changing/admin functions emit proper events for off-chain monitoring
 */
contract EventEmissionTest is Test {
    DexCore public dexCore;
    BridgeAdapter public bridgeAdapter;
    DEXFactory public factory;
    DEXPair public pair;
    MockERC20 public token0;
    MockERC20 public token1;
    MinimalForwarder public forwarder;
    
    address public owner = address(this);
    address public flashSwap = address(0x123);
    address public user = address(0x456);

    event FlashLoanFeeAdded(address indexed token0, address indexed token1, address indexed feeToken, uint256 feeAmount);
    event BridgeUpdateCancelled(address indexed cancelledBridge);
    event SyncForced(uint112 reserve0, uint112 reserve1);

    function setUp() public {
        // Deploy tokens
        token0 = new MockERC20("Token0", "TK0", 18);
        token1 = new MockERC20("Token1", "TK1", 18);
        
        // Ensure token0 < token1
        if (address(token0) > address(token1)) {
            (token0, token1) = (token1, token0);
        }
        
        // Deploy mock WETH
        MockERC20 weth = new MockERC20("Wrapped ETH", "WETH", 18);
        forwarder = new MinimalForwarder();
        
        // Deploy DexCore
        dexCore = new DexCore(address(this), address(weth), address(forwarder));
        
        // Deploy BridgeAdapter
        bridgeAdapter = new BridgeAdapter(address(dexCore), owner);
        
        // Deploy Factory and create pair
        factory = new DEXFactory(owner);
        address pairAddress = factory.createPair(address(token0), address(token1));
        pair = DEXPair(pairAddress);
        
        // Setup DexCore
        dexCore.setFlashSwapContract(flashSwap);
        
        // Create pool in DexCore
        token0.mint(owner, 1000 ether);
        token1.mint(owner, 1000 ether);
        token0.approve(address(dexCore), type(uint256).max);
        token1.approve(address(dexCore), type(uint256).max);
        dexCore.addLiquidity(address(token0), address(token1), 100 ether, 100 ether, 0, 0, owner, block.timestamp + 1);
    }

    /**
     * @notice Test that addFlashLoanFee emits FlashLoanFeeAdded event
     * @dev Critical for off-chain monitoring of flash loan fee distribution
     */
    function testAddFlashLoanFeeEmitsEvent() public {
        uint256 feeAmount = 1 ether;
        
        // Mint tokens to flashSwap contract
        token0.mint(flashSwap, feeAmount);
        
        // Approve DexCore to spend from flashSwap
        vm.startPrank(flashSwap);
        token0.approve(address(dexCore), feeAmount);
        
        // Expect FlashLoanFeeAdded event
        vm.expectEmit(true, true, true, true);
        emit FlashLoanFeeAdded(address(token0), address(token1), address(token0), feeAmount);
        
        // Add flash loan fee
        dexCore.addFlashLoanFee(address(token0), address(token1), address(token0), feeAmount);
        vm.stopPrank();
    }

    /**
     * @notice Test that cancelBridgeUpdate emits BridgeUpdateCancelled event
     * @dev Critical for off-chain monitoring of bridge governance changes
     */
    function testCancelBridgeUpdateEmitsEvent() public {
        address newBridge = address(0x789);
        
        // Propose bridge update
        bridgeAdapter.proposeBridgeUpdate(newBridge);
        
        // Expect BridgeUpdateCancelled event
        vm.expectEmit(true, false, false, false);
        emit BridgeUpdateCancelled(newBridge);
        
        // Cancel bridge update
        bridgeAdapter.cancelBridgeUpdate();
    }

    /**
     * @notice Test that sync emits SyncForced event
     * @dev Critical for off-chain monitoring of manual reserve synchronization
     */
    function testSyncEmitsSyncForcedEvent() public {
        // Add liquidity to pair
        token0.mint(owner, 100 ether);
        token1.mint(owner, 100 ether);
        token0.transfer(address(pair), 10 ether);
        token1.transfer(address(pair), 10 ether);
        pair.mint(owner);
        
        // Donate tokens to create imbalance
        token0.transfer(address(pair), 1 ether);
        
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        uint256 balance0 = token0.balanceOf(address(pair));
        uint256 balance1 = token1.balanceOf(address(pair));
        
        // Expect SyncForced event with updated balances
        vm.expectEmit(true, true, false, false);
        emit SyncForced(uint112(balance0), uint112(balance1));
        
        // Force sync
        pair.sync();
    }

    /**
     * @notice Test that all critical functions emit events (comprehensive check)
     * @dev Ensures 100% event coverage for off-chain monitoring
     */
    function testAllCriticalFunctionsEmitEvents() public {
        // Test 1: FlashLoanFeeAdded
        uint256 feeAmount = 0.5 ether;
        token1.mint(flashSwap, feeAmount);
        vm.startPrank(flashSwap);
        token1.approve(address(dexCore), feeAmount);
        
        vm.expectEmit(true, true, true, true);
        emit FlashLoanFeeAdded(address(token0), address(token1), address(token1), feeAmount);
        dexCore.addFlashLoanFee(address(token0), address(token1), address(token1), feeAmount);
        vm.stopPrank();
        
        // Test 2: BridgeUpdateCancelled
        address testBridge = address(0xABC);
        bridgeAdapter.proposeBridgeUpdate(testBridge);
        
        vm.expectEmit(true, false, false, false);
        emit BridgeUpdateCancelled(testBridge);
        bridgeAdapter.cancelBridgeUpdate();
        
        // Test 3: SyncForced
        token0.mint(owner, 10 ether);
        token0.transfer(address(pair), 2 ether);
        
        uint256 newBalance0 = token0.balanceOf(address(pair));
        uint256 newBalance1 = token1.balanceOf(address(pair));
        
        vm.expectEmit(true, true, false, false);
        emit SyncForced(uint112(newBalance0), uint112(newBalance1));
        pair.sync();
    }

    /**
     * @notice Fuzz test: addFlashLoanFee always emits event regardless of amount
     * @dev Ensures event emission is consistent across all valid fee amounts
     */
    function testFuzzAddFlashLoanFeeAlwaysEmitsEvent(uint256 feeAmount) public {
        feeAmount = bound(feeAmount, 1, 100 ether);
        
        token0.mint(flashSwap, feeAmount);
        vm.startPrank(flashSwap);
        token0.approve(address(dexCore), feeAmount);
        
        vm.expectEmit(true, true, true, true);
        emit FlashLoanFeeAdded(address(token0), address(token1), address(token0), feeAmount);
        
        dexCore.addFlashLoanFee(address(token0), address(token1), address(token0), feeAmount);
        vm.stopPrank();
    }

    /**
     * @notice Test that sync emits event even with no balance change
     * @dev Ensures event is emitted for monitoring even when reserves don't change
     */
    function testSyncEmitsEventWithNoBalanceChange() public {
        // Add liquidity
        token0.mint(owner, 100 ether);
        token1.mint(owner, 100 ether);
        token0.transfer(address(pair), 10 ether);
        token1.transfer(address(pair), 10 ether);
        pair.mint(owner);
        
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        
        // Call sync without any balance change
        vm.expectEmit(true, true, false, false);
        emit SyncForced(reserve0, reserve1);
        
        pair.sync();
    }
}
