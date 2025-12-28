// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MinimalForwarder.sol";
import "../src/DexCore.sol";
import "../src/FlashSwap.sol";
import "../src/BridgeAdapter.sol";
import "../src/MockERC20.sol";

/**
 * @title LowSeverityFixes Test Suite
 * @notice Comprehensive tests for all low-severity security improvements
 */
contract LowSeverityFixesTest is Test {
    DexCore public dexCore;
    FlashSwap public flashSwap;
    BridgeAdapter public bridgeAdapter;
    MockERC20 public tokenA;
    MockERC20 public tokenB;
    MockERC20 public weth;
    MinimalForwarder public forwarder;
    
    address public owner;
    address public user1;
    address public user2;
    
    event EmergencyWithdraw(address indexed token, uint256 amount, address indexed to);
    event ProtocolFeeUpdated(uint256 oldFee, uint256 newFee);
    event MaxFlashLoanUpdated(address indexed token, uint256 maxAmount);
    event BridgeUpdated(address indexed oldBridge, address indexed newBridge);
    event PauseScheduled(uint256 executeTime);
    event UnpauseScheduled(uint256 executeTime);
    
    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        
        // Deploy mock tokens
        tokenA = new MockERC20("Token A", "TKA", 18);
        tokenB = new MockERC20("Token B", "TKB", 18);
        weth = new MockERC20("Wrapped ETH", "WETH", 18);
        forwarder = new MinimalForwarder();
        
        // Deploy contracts
        dexCore = new DexCore(address(this), address(weth), address(forwarder));
        flashSwap = new FlashSwap(address(dexCore), address(forwarder));
        bridgeAdapter = new BridgeAdapter(address(dexCore), owner);
        
        // Setup
        dexCore.setFlashSwapContract(address(flashSwap));
        
        // Create pool
        dexCore.createPool(address(tokenA), address(tokenB));
        
        // Mint tokens
        tokenA.mint(owner, 1000000 ether);
        tokenB.mint(owner, 1000000 ether);
        tokenA.mint(user1, 1000000 ether);
        tokenB.mint(user1, 1000000 ether);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          LOW-1: MISSING EVENTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_EmergencyWithdrawEvent() public {
        // Add liquidity first
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 100 ether);
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            100 ether,
            0,
            0,
            owner,
            block.timestamp + 1 hours
        );
        
        // Emergency withdraw should emit event
        vm.expectEmit(true, true, false, true);
        emit EmergencyWithdraw(address(tokenA), 10 ether, user1);
        
        dexCore.emergencyWithdraw(address(tokenA), 10 ether, user1);
        
        assertEq(tokenA.balanceOf(user1), 1000000 ether + 10 ether);
    }
    
    function test_ProtocolFeeUpdatedEvent() public {
        // Schedule protocol fee update
        dexCore.scheduleProtocolFeeUpdate(100);
        
        // Warp to after timelock
        vm.warp(block.timestamp + 2 days);
        
        vm.expectEmit(false, false, false, true);
        emit ProtocolFeeUpdated(0, 100);
        
        dexCore.executeProtocolFeeUpdate();
    }
    
    function test_MaxFlashLoanUpdatedEvent() public {
        vm.expectEmit(true, false, false, true);
        emit MaxFlashLoanUpdated(address(tokenA), 1000 ether);
        
        flashSwap.setMaxFlashLoan(address(tokenA), 1000 ether);
    }
    
    function test_BridgeUpdatedEvent() public {
        address newBridge = makeAddr("newBridge");
        
        // Propose update
        bridgeAdapter.proposeBridgeUpdate(newBridge);
        
        // Fast forward past timelock
        vm.warp(block.timestamp + 2 days + 1);
        
        // Execute should emit event
        vm.expectEmit(true, true, false, false);
        emit BridgeUpdated(address(0), newBridge);
        
        bridgeAdapter.executeBridgeUpdate();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                      LOW-2: TIMELOCK MECHANISM
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_PauseRequiresTimelock() public {
        // Schedule pause
        vm.expectEmit(false, false, false, true);
        emit PauseScheduled(block.timestamp + 2 days);
        dexCore.schedulePause();
        
        // Try to pause immediately - should fail
        vm.expectRevert(DexCore.TimelockNotMet.selector);
        dexCore.pause();
        
        // Fast forward past timelock
        vm.warp(block.timestamp + 2 days + 1);
        
        // Now pause should work
        dexCore.pause();
        assertTrue(dexCore.paused());
    }
    
    function test_UnpauseRequiresTimelock() public {
        // First pause the contract
        dexCore.schedulePause();
        vm.warp(block.timestamp + 2 days + 1);
        dexCore.pause();
        
        // Schedule unpause
        vm.expectEmit(false, false, false, true);
        emit UnpauseScheduled(block.timestamp + 2 days);
        dexCore.scheduleUnpause();
        
        // Try to unpause immediately - should fail
        vm.expectRevert(DexCore.TimelockNotMet.selector);
        dexCore.unpause();
        
        // Fast forward past timelock
        vm.warp(block.timestamp + 2 days + 1);
        
        // Now unpause should work
        dexCore.unpause();
        assertFalse(dexCore.paused());
    }
    
    function test_CannotPauseWithoutScheduling() public {
        vm.expectRevert(DexCore.NoPendingTimelock.selector);
        dexCore.pause();
    }
    
    function test_CannotUnpauseWithoutScheduling() public {
        vm.expectRevert(DexCore.NoPendingTimelock.selector);
        dexCore.unpause();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                  LOW-3: INPUT VALIDATION IMPROVEMENTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_AddLiquidityRejectsLargeAmounts() public {
        uint256 tooLarge = uint256(type(uint128).max) + 1;
        
        tokenA.approve(address(dexCore), tooLarge);
        tokenB.approve(address(dexCore), tooLarge);
        
        vm.expectRevert(DexCore.AmountTooLarge.selector);
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            tooLarge,
            100 ether,
            0,
            0,
            owner,
            block.timestamp + 1 hours
        );
    }
    
    function test_SwapRejectsSwapToSelf() public {
        // Add liquidity
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 100 ether);
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            100 ether,
            0,
            0,
            owner,
            block.timestamp + 1 hours
        );
        
        tokenA.approve(address(dexCore), 1 ether);
        
        vm.expectRevert(DexCore.InvalidToken.selector);
        dexCore.swap(
            address(tokenA),
            address(tokenB),
            1 ether,
            0.9 ether,
            address(dexCore), // Swap to DEX itself - should fail
            block.timestamp + 1 hours
        );
    }
    
    function test_SwapRejectsSwapToTokenContracts() public {
        // Add liquidity
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 100 ether);
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            100 ether,
            0,
            0,
            owner,
            block.timestamp + 1 hours
        );
        
        tokenA.approve(address(dexCore), 1 ether);
        
        vm.expectRevert(DexCore.InvalidToken.selector);
        dexCore.swap(
            address(tokenA),
            address(tokenB),
            1 ether,
            0.9 ether,
            address(tokenA), // Swap to tokenIn - should fail
            block.timestamp + 1 hours
        );
    }
    
    function test_FlashLoanEnforcesMaxLimit() public {
        // Add liquidity
        tokenA.approve(address(dexCore), 1000 ether);
        tokenB.approve(address(dexCore), 1000 ether);
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            1000 ether,
            1000 ether,
            0,
            0,
            owner,
            block.timestamp + 1 hours
        );
        
        // Register pool
        flashSwap.registerPool(address(tokenA), address(tokenB));
        
        // Set max flash loan to 50 ether
        flashSwap.setMaxFlashLoan(address(tokenA), 50 ether);
        
        // Create mock borrower
        MockFlashBorrower borrower = new MockFlashBorrower();
        flashSwap.approveBorrower(address(borrower));
        
        // Try to borrow more than max - should fail
        vm.expectRevert(FlashSwap.InvalidAmount.selector);
        flashSwap.flashLoan(
            IERC3156FlashBorrower(address(borrower)),
            address(tokenA),
            100 ether, // More than 50 ether limit
            ""
        );
    }
    
    function test_ProtocolFeeRejectsExcessiveFee() public {
        // Try to schedule fee > 10%
        vm.expectRevert(DexCore.AmountTooLarge.selector);
        dexCore.scheduleProtocolFeeUpdate(1001); // 10.01%
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                  LOW-4: ZERO-ADDRESS CHECKS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_ConstructorRejectsZeroFactory() public {
        vm.expectRevert(DexCore.ZeroAddress.selector);
        new DexCore(address(0), address(weth), address(forwarder));
    }
    
    function test_ConstructorRejectsZeroWETH() public {
        vm.expectRevert(DexCore.ZeroAddress.selector);
        new DexCore(address(this), address(0), address(forwarder));
    }
    
    function test_FlashSwapConstructorRejectsZeroDexCore() public {
        vm.expectRevert(FlashSwap.InvalidToken.selector);
        new FlashSwap(address(0), address(forwarder));
    }
    
    function test_BridgeAdapterConstructorRejectsZeroDexCore() public {
        vm.expectRevert(BridgeAdapter.ZeroAddress.selector);
        new BridgeAdapter(address(0), owner);
    }
    
    function test_BridgeAdapterConstructorRejectsZeroOwner() public {
        vm.expectRevert(BridgeAdapter.ZeroAddress.selector);
        new BridgeAdapter(address(dexCore), address(0));
    }
    
    function test_EmergencyWithdrawRejectsZeroToken() public {
        vm.expectRevert(DexCore.ZeroAddress.selector);
        dexCore.emergencyWithdraw(address(0), 100 ether, user1);
    }
    
    function test_EmergencyWithdrawRejectsZeroRecipient() public {
        vm.expectRevert(DexCore.ZeroAddress.selector);
        dexCore.emergencyWithdraw(address(tokenA), 100 ether, address(0));
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                  LOW-5: SAFE ERC20 OPERATIONS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_SafeERC20HandlesTransferFailures() public {
        // Create a token that returns false on transfer
        FalseReturningToken badToken = new FalseReturningToken();
        
        // Try to emergency withdraw - SafeERC20 should revert
        vm.expectRevert();
        dexCore.emergencyWithdraw(address(badToken), 100 ether, user1);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                      INTEGRATION TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_CompleteTimelockWorkflow() public {
        // 1. Schedule pause
        dexCore.schedulePause();
        
        // 2. Wait for timelock
        vm.warp(block.timestamp + 2 days + 1);
        
        // 3. Execute pause
        dexCore.pause();
        assertTrue(dexCore.paused());
        
        // 4. Verify operations are blocked
        tokenA.approve(address(dexCore), 1 ether);
        tokenB.approve(address(dexCore), 1 ether);
        vm.expectRevert();
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            1 ether,
            1 ether,
            0,
            0,
            owner,
            block.timestamp + 1 hours
        );
        
        // 5. Schedule unpause
        dexCore.scheduleUnpause();
        
        // 6. Wait for timelock
        vm.warp(block.timestamp + 2 days + 1);
        
        // 7. Execute unpause
        dexCore.unpause();
        assertFalse(dexCore.paused());
        
        // 8. Verify operations work again
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            1 ether,
            1 ether,
            0,
            0,
            owner,
            block.timestamp + 1 hours
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
//                          MOCK CONTRACTS
// ═══════════════════════════════════════════════════════════════════════════════

contract MockFlashBorrower is IERC3156FlashBorrower {
    function onFlashLoan(
        address,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata
    ) external returns (bytes32) {
        // Approve repayment
        IERC20(token).approve(msg.sender, amount + fee);
        return keccak256("ERC3156FlashBorrower.onFlashLoan");
    }
}

contract FalseReturningToken {
    function transfer(address, uint256) external pure returns (bool) {
        return false;
    }
    
    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }
    
    function balanceOf(address) external pure returns (uint256) {
        return 1000 ether;
    }
}
