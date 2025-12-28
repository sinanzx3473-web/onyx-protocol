// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MinimalForwarder.sol";
import "../src/DexCore.sol";
import "../src/DEXFactory.sol";
import "../src/FlashSwap.sol";
import "../src/GovernanceTimelock.sol";
import "../src/MockERC20.sol";

/**
 * @title GovernanceTimelockTest
 * @notice Comprehensive tests for role-based governance and timelock functionality
 */
contract GovernanceTimelockTest is Test {
    DexCore public dexCore;
    DEXFactory public factory;
    FlashSwap public flashSwap;
    GovernanceTimelock public timelock;
    MockERC20 public weth;
    MinimalForwarder public forwarder;
    MockERC20 public tokenA;
    MockERC20 public tokenB;
    
    address public deployer;
    address public multiSig;
    address public alice;
    address public bob;
    address public malicious;
    
    // Role identifiers
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    // Timelock roles
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant CANCELLER_ROLE = keccak256("CANCELLER_ROLE");
    
    uint256 public constant TIMELOCK_DELAY = 2 days;
    
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);
    event PauseScheduled(uint256 timestamp);
    event UnpauseScheduled(uint256 timestamp);
    event ProtocolFeeUpdateScheduled(uint256 newFeeBps, uint256 executeTime);
    event BlacklistUpdateScheduled(address indexed token, bool blacklisted, uint256 executeTime);
    
    function setUp() public {
        deployer = address(this);
        multiSig = makeAddr("multiSig");
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        malicious = makeAddr("malicious");
        
        // Deploy tokens
        weth = new MockERC20("Wrapped ETH", "WETH", 18);
        forwarder = new MinimalForwarder();
        tokenA = new MockERC20("Token A", "TKA", 18);
        tokenB = new MockERC20("Token B", "TKB", 18);
        
        // Deploy factory
        factory = new DEXFactory(deployer);
        
        // Deploy DexCore
        dexCore = new DexCore(address(factory), address(weth), address(forwarder));
        
        // Deploy FlashSwap
        flashSwap = new FlashSwap(address(dexCore), address(forwarder));
        
        // Deploy TimelockController
        address[] memory proposers = new address[](1);
        proposers[0] = multiSig;
        
        address[] memory executors = new address[](1);
        executors[0] = address(0); // Anyone can execute after delay
        
        timelock = new GovernanceTimelock(proposers, executors, deployer);
        
        // Setup initial liquidity
        tokenA.mint(alice, 1000 ether);
        tokenB.mint(alice, 1000 ether);
        
        vm.startPrank(alice);
        tokenA.approve(address(dexCore), type(uint256).max);
        tokenB.approve(address(dexCore), type(uint256).max);
        vm.stopPrank();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          ROLE-BASED ACCESS CONTROL TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_InitialRoles() public {
        // Deployer should have all roles initially
        assertTrue(dexCore.hasRole(DEFAULT_ADMIN_ROLE, deployer));
        assertTrue(dexCore.hasRole(PAUSER_ROLE, deployer));
        assertTrue(dexCore.hasRole(GOVERNANCE_ROLE, deployer));
        assertTrue(dexCore.hasRole(ADMIN_ROLE, deployer));
        
        assertTrue(factory.hasRole(DEFAULT_ADMIN_ROLE, deployer));
        assertTrue(factory.hasRole(GOVERNANCE_ROLE, deployer));
        assertTrue(factory.hasRole(ADMIN_ROLE, deployer));
        
        assertTrue(flashSwap.hasRole(DEFAULT_ADMIN_ROLE, deployer));
        assertTrue(flashSwap.hasRole(GOVERNANCE_ROLE, deployer));
        assertTrue(flashSwap.hasRole(ADMIN_ROLE, deployer));
    }
    
    function test_GrantRolesToMultiSig() public {
        // Grant roles to multi-sig
        dexCore.grantRole(PAUSER_ROLE, multiSig);
        dexCore.grantRole(GOVERNANCE_ROLE, multiSig);
        dexCore.grantRole(ADMIN_ROLE, multiSig);
        
        assertTrue(dexCore.hasRole(PAUSER_ROLE, multiSig));
        assertTrue(dexCore.hasRole(GOVERNANCE_ROLE, multiSig));
        assertTrue(dexCore.hasRole(ADMIN_ROLE, multiSig));
    }
    
    function test_RevokeDeployerRoles() public {
        // Grant roles to multi-sig first
        dexCore.grantRole(DEFAULT_ADMIN_ROLE, multiSig);
        dexCore.grantRole(PAUSER_ROLE, multiSig);
        dexCore.grantRole(GOVERNANCE_ROLE, multiSig);
        dexCore.grantRole(ADMIN_ROLE, multiSig);
        
        // Revoke deployer roles
        dexCore.revokeRole(PAUSER_ROLE, deployer);
        dexCore.revokeRole(GOVERNANCE_ROLE, deployer);
        dexCore.revokeRole(ADMIN_ROLE, deployer);
        
        assertFalse(dexCore.hasRole(PAUSER_ROLE, deployer));
        assertFalse(dexCore.hasRole(GOVERNANCE_ROLE, deployer));
        assertFalse(dexCore.hasRole(ADMIN_ROLE, deployer));
        
        // Multi-sig should still have roles
        assertTrue(dexCore.hasRole(PAUSER_ROLE, multiSig));
        assertTrue(dexCore.hasRole(GOVERNANCE_ROLE, multiSig));
        assertTrue(dexCore.hasRole(ADMIN_ROLE, multiSig));
    }
    
    function testFail_UnauthorizedPause() public {
        vm.prank(malicious);
        dexCore.schedulePause();
    }
    
    function testFail_UnauthorizedProtocolFeeUpdate() public {
        vm.prank(malicious);
        dexCore.scheduleProtocolFeeUpdate(50);
    }
    
    function testFail_UnauthorizedBlacklistUpdate() public {
        vm.prank(malicious);
        dexCore.scheduleBlacklistUpdate(address(tokenA), true);
    }
    
    function testFail_UnauthorizedFlashSwapApproval() public {
        vm.prank(malicious);
        flashSwap.approveBorrower(alice);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          TIMELOCK PAUSE/UNPAUSE TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_ScheduleAndExecutePause() public {
        // Schedule pause
        vm.expectEmit(true, true, true, true);
        emit PauseScheduled(block.timestamp + TIMELOCK_DELAY);
        dexCore.schedulePause();
        
        uint256 pauseTime = dexCore.pauseTimestamp();
        assertEq(pauseTime, block.timestamp + TIMELOCK_DELAY);
        
        // Try to execute before timelock - should fail
        vm.expectRevert();
        dexCore.pause();
        
        // Warp to after timelock
        vm.warp(block.timestamp + TIMELOCK_DELAY);
        
        // Execute pause
        dexCore.pause();
        assertTrue(dexCore.paused());
    }
    
    function test_ScheduleAndExecuteUnpause() public {
        // First pause the protocol
        dexCore.schedulePause();
        vm.warp(block.timestamp + TIMELOCK_DELAY);
        dexCore.pause();
        assertTrue(dexCore.paused());
        
        // Schedule unpause
        vm.expectEmit(true, true, true, true);
        emit UnpauseScheduled(block.timestamp + TIMELOCK_DELAY);
        dexCore.scheduleUnpause();
        
        uint256 unpauseTime = dexCore.unpauseTimestamp();
        assertEq(unpauseTime, block.timestamp + TIMELOCK_DELAY);
        
        // Try to execute before timelock - should fail
        vm.expectRevert();
        dexCore.unpause();
        
        // Warp to after timelock
        vm.warp(block.timestamp + TIMELOCK_DELAY);
        
        // Execute unpause
        dexCore.unpause();
        assertFalse(dexCore.paused());
    }
    
    function test_MultiSigCanSchedulePause() public {
        // Grant PAUSER_ROLE to multi-sig
        dexCore.grantRole(PAUSER_ROLE, multiSig);
        
        // Multi-sig schedules pause
        vm.prank(multiSig);
        dexCore.schedulePause();
        
        uint256 pauseTime = dexCore.pauseTimestamp();
        assertEq(pauseTime, block.timestamp + TIMELOCK_DELAY);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          TIMELOCK PROTOCOL FEE TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_ScheduleAndExecuteProtocolFeeUpdate() public {
        uint256 newFee = 50; // 0.5%
        
        // Schedule fee update
        vm.expectEmit(true, true, true, true);
        emit ProtocolFeeUpdateScheduled(newFee, block.timestamp + TIMELOCK_DELAY);
        dexCore.scheduleProtocolFeeUpdate(newFee);
        
        assertEq(dexCore.pendingProtocolFee(), newFee);
        assertEq(dexCore.protocolFeeUpdateTime(), block.timestamp + TIMELOCK_DELAY);
        
        // Try to execute before timelock - should fail
        vm.expectRevert();
        dexCore.executeProtocolFeeUpdate();
        
        // Warp to after timelock
        vm.warp(block.timestamp + TIMELOCK_DELAY);
        
        // Execute fee update
        dexCore.executeProtocolFeeUpdate();
        assertEq(dexCore.protocolFeeBps(), newFee);
    }
    
    function test_CancelProtocolFeeUpdate() public {
        uint256 newFee = 50;
        
        // Schedule fee update
        dexCore.scheduleProtocolFeeUpdate(newFee);
        assertEq(dexCore.pendingProtocolFee(), newFee);
        
        // Cancel update
        dexCore.cancelProtocolFeeUpdate();
        assertEq(dexCore.pendingProtocolFee(), 0);
        assertEq(dexCore.protocolFeeUpdateTime(), 0);
    }
    
    function testFail_ProtocolFeeExceedsMax() public {
        uint256 excessiveFee = 101; // 1.01% (max is 1%)
        dexCore.scheduleProtocolFeeUpdate(excessiveFee);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          TIMELOCK BLACKLIST TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_ScheduleAndExecuteBlacklistUpdate() public {
        // Schedule blacklist
        vm.expectEmit(true, true, true, true);
        emit BlacklistUpdateScheduled(address(tokenA), true, block.timestamp + TIMELOCK_DELAY);
        dexCore.scheduleBlacklistUpdate(address(tokenA), true);
        
        assertEq(dexCore.pendingBlacklistToken(), address(tokenA));
        assertTrue(dexCore.pendingBlacklistStatus());
        assertEq(dexCore.blacklistUpdateTime(), block.timestamp + TIMELOCK_DELAY);
        
        // Try to execute before timelock - should fail
        vm.expectRevert();
        dexCore.executeBlacklistUpdate();
        
        // Warp to after timelock
        vm.warp(block.timestamp + TIMELOCK_DELAY);
        
        // Execute blacklist
        dexCore.executeBlacklistUpdate();
        assertTrue(dexCore.blacklistedTokens(address(tokenA)));
    }
    
    function test_CancelBlacklistUpdate() public {
        // Schedule blacklist
        dexCore.scheduleBlacklistUpdate(address(tokenA), true);
        assertEq(dexCore.pendingBlacklistToken(), address(tokenA));
        
        // Cancel update
        dexCore.cancelBlacklistUpdate();
        assertEq(dexCore.pendingBlacklistToken(), address(0));
        assertEq(dexCore.blacklistUpdateTime(), 0);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          NON-TIMELOCKED OPERATIONS TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_ImmediateFlashBorrowerApproval() public {
        // Flash borrower approval should be immediate (no timelock)
        flashSwap.approveBorrower(alice);
        assertTrue(flashSwap.isBorrowerApproved(alice));
        
        // Revoke should also be immediate
        flashSwap.revokeBorrower(alice);
        assertFalse(flashSwap.isBorrowerApproved(alice));
    }
    
    function test_ImmediateMaxSwapSizeUpdate() public {
        // Max swap size update should be immediate (circuit breaker)
        uint256 newMaxSize = 100 ether;
        dexCore.setMaxSwapSize(newMaxSize);
        assertEq(dexCore.maxSwapSize(), newMaxSize);
    }
    
    function test_ImmediateFlashSwapContractUpdate() public {
        // Flash swap contract update should be immediate
        address newFlashSwap = makeAddr("newFlashSwap");
        dexCore.setFlashSwapContract(newFlashSwap);
        assertEq(dexCore.flashSwapContract(), newFlashSwap);
    }
    
    function test_ImmediatePoolRegistration() public {
        // Pool registration should be immediate
        flashSwap.registerPool(address(tokenA), address(tokenB));
        assertEq(flashSwap.tokenPools(address(tokenA)), address(tokenB));
        assertEq(flashSwap.tokenPools(address(tokenB)), address(tokenA));
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          EMERGENCY WITHDRAW TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_EmergencyWithdrawByAdmin() public {
        // Send some tokens to DexCore
        tokenA.mint(address(dexCore), 100 ether);
        
        uint256 balanceBefore = tokenA.balanceOf(deployer);
        
        // Emergency withdraw (bypasses timelock)
        dexCore.emergencyWithdraw(address(tokenA), 100 ether, deployer);
        
        uint256 balanceAfter = tokenA.balanceOf(deployer);
        assertEq(balanceAfter - balanceBefore, 100 ether);
    }
    
    function testFail_EmergencyWithdrawByNonAdmin() public {
        tokenA.mint(address(dexCore), 100 ether);
        
        vm.prank(malicious);
        dexCore.emergencyWithdraw(address(tokenA), 100 ether, malicious);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          GOVERNANCE WORKFLOW TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_CompleteGovernanceTransfer() public {
        // Step 1: Grant all roles to multi-sig
        dexCore.grantRole(DEFAULT_ADMIN_ROLE, multiSig);
        dexCore.grantRole(PAUSER_ROLE, multiSig);
        dexCore.grantRole(GOVERNANCE_ROLE, multiSig);
        dexCore.grantRole(ADMIN_ROLE, multiSig);
        
        factory.grantRole(DEFAULT_ADMIN_ROLE, multiSig);
        factory.grantRole(GOVERNANCE_ROLE, multiSig);
        factory.grantRole(ADMIN_ROLE, multiSig);
        
        flashSwap.grantRole(DEFAULT_ADMIN_ROLE, multiSig);
        flashSwap.grantRole(GOVERNANCE_ROLE, multiSig);
        flashSwap.grantRole(ADMIN_ROLE, multiSig);
        
        // Step 2: Revoke deployer roles (except DEFAULT_ADMIN for final cleanup)
        dexCore.revokeRole(PAUSER_ROLE, deployer);
        dexCore.revokeRole(GOVERNANCE_ROLE, deployer);
        dexCore.revokeRole(ADMIN_ROLE, deployer);
        
        factory.revokeRole(GOVERNANCE_ROLE, deployer);
        factory.revokeRole(ADMIN_ROLE, deployer);
        
        flashSwap.revokeRole(GOVERNANCE_ROLE, deployer);
        flashSwap.revokeRole(ADMIN_ROLE, deployer);
        
        // Verify multi-sig has all roles
        assertTrue(dexCore.hasRole(DEFAULT_ADMIN_ROLE, multiSig));
        assertTrue(dexCore.hasRole(PAUSER_ROLE, multiSig));
        assertTrue(dexCore.hasRole(GOVERNANCE_ROLE, multiSig));
        assertTrue(dexCore.hasRole(ADMIN_ROLE, multiSig));
        
        // Verify deployer lost operational roles
        assertFalse(dexCore.hasRole(PAUSER_ROLE, deployer));
        assertFalse(dexCore.hasRole(GOVERNANCE_ROLE, deployer));
        assertFalse(dexCore.hasRole(ADMIN_ROLE, deployer));
        
        // Step 3: Multi-sig can now perform governance actions
        vm.prank(multiSig);
        dexCore.schedulePause();
        
        uint256 pauseTime = dexCore.pauseTimestamp();
        assertEq(pauseTime, block.timestamp + TIMELOCK_DELAY);
    }
    
    function test_MultiSigCanCancelPendingOperations() public {
        // Grant roles to multi-sig
        dexCore.grantRole(GOVERNANCE_ROLE, multiSig);
        
        // Deployer schedules a fee update
        dexCore.scheduleProtocolFeeUpdate(50);
        assertEq(dexCore.pendingProtocolFee(), 50);
        
        // Multi-sig cancels it
        vm.prank(multiSig);
        dexCore.cancelProtocolFeeUpdate();
        
        assertEq(dexCore.pendingProtocolFee(), 0);
        assertEq(dexCore.protocolFeeUpdateTime(), 0);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          TIMELOCKCONTROLLER INTEGRATION TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_TimelockControllerDelay() public {
        assertEq(timelock.getMinDelay(), TIMELOCK_DELAY);
    }
    
    function test_TimelockControllerRoles() public {
        assertTrue(timelock.hasRole(PROPOSER_ROLE, multiSig));
        assertTrue(timelock.hasRole(EXECUTOR_ROLE, address(0))); // Anyone can execute
        assertTrue(timelock.hasRole(DEFAULT_ADMIN_ROLE, deployer));
    }
    
    function test_ScheduleOperationViaTimelock() public {
        // Grant GOVERNANCE_ROLE to timelock
        dexCore.grantRole(GOVERNANCE_ROLE, address(timelock));
        
        // Prepare operation: scheduleProtocolFeeUpdate(50)
        address target = address(dexCore);
        uint256 value = 0;
        bytes memory data = abi.encodeWithSelector(
            DexCore.scheduleProtocolFeeUpdate.selector,
            50
        );
        bytes32 predecessor = bytes32(0);
        bytes32 salt = keccak256("test");
        
        // Multi-sig schedules operation
        vm.prank(multiSig);
        timelock.schedule(target, value, data, predecessor, salt, TIMELOCK_DELAY);
        
        // Warp to after timelock
        vm.warp(block.timestamp + TIMELOCK_DELAY);
        
        // Anyone can execute
        timelock.execute(target, value, data, predecessor, salt);
        
        // Verify operation was executed
        assertEq(dexCore.pendingProtocolFee(), 50);
    }
}
