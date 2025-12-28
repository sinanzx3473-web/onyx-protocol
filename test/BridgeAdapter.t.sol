// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MinimalForwarder.sol";
import "../src/BridgeAdapter.sol";
import "../src/DexCore.sol";
import "../src/DEXFactory.sol";
import "../src/MockERC20.sol";

/**
 * @title BridgeAdapterTest
 * @notice Comprehensive test suite for BridgeAdapter contract
 */
contract BridgeAdapterTest is Test {
    BridgeAdapter public bridgeAdapter;
    DexCore public dexCore;
    DEXFactory public factory;
    MockERC20 public tokenA;
    MockERC20 public tokenB;
    MockERC20 public weth;
    MinimalForwarder public forwarder;
    
    address public owner;
    address public user1;
    address public user2;
    address public bridgeContract;
    
    // Events to test
    event CrossChainSwapExecuted(
        bytes32 indexed messageId,
        address indexed recipient,
        address tokenOut,
        uint256 amountOut
    );
    
    event BridgeUpdated(address indexed oldBridge, address indexed newBridge);
    event BridgeUpdateProposed(address indexed newBridge, uint256 executeTime);
    
    function setUp() public {
        owner = address(this);
        user1 = address(0x1);
        user2 = address(0x2);
        bridgeContract = address(0x999);
        
        // Deploy contracts
        factory = new DEXFactory(owner);
        weth = new MockERC20("Wrapped ETH", "WETH", 18);
        forwarder = new MinimalForwarder();
        dexCore = new DexCore(address(factory), address(weth), address(forwarder));
        bridgeAdapter = new BridgeAdapter(address(dexCore), owner);
        tokenA = new MockERC20("Token A", "TKA", 18);
        tokenB = new MockERC20("Token B", "TKB", 18);
        
        // Mint tokens
        tokenA.mint(address(this), 10000 ether);
        tokenB.mint(address(this), 10000 ether);
        tokenA.mint(user1, 1000 ether);
        tokenB.mint(user1, 1000 ether);
        tokenA.mint(bridgeContract, 1000 ether);
        tokenB.mint(bridgeContract, 1000 ether);
        
        // Setup liquidity in DexCore
        _setupLiquidity(1000 ether, 1000 ether);
    }
    
    function _setupLiquidity(uint256 amount0, uint256 amount1) internal {
        // Create pool
        dexCore.createPool(address(tokenA), address(tokenB));
        
        // Approve tokens
        tokenA.approve(address(dexCore), amount0);
        tokenB.approve(address(dexCore), amount1);
        
        // Add liquidity
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            amount0,
            amount1,
            (amount0 * 99) / 100,
            (amount1 * 99) / 100,
            address(this),
            block.timestamp + 1 hours
        );
    }
    
    // ============ Happy Path Tests ============
    
    function testExecuteCrossChainSwap() public {
        // Setup bridge
        bridgeAdapter.proposeBridgeUpdate(bridgeContract);
        vm.warp(block.timestamp + 2 days + 1);
        bridgeAdapter.executeBridgeUpdate();
        
        bytes32 messageId = keccak256("message1");
        uint256 amountIn = 50 ether;
        
        // Encode message data
        BridgeAdapter.CrossChainSwapMessage memory message = BridgeAdapter.CrossChainSwapMessage({
            tokenIn: address(tokenA),
            tokenOut: address(tokenB),
            amountIn: amountIn,
            amountOutMin: 0,
            recipient: user1,
            deadline: block.timestamp + 1 hours
        });
        bytes memory messageData = abi.encode(message);
        
        uint256 balanceBefore = tokenB.balanceOf(user1);
        
        // Execute from bridge contract
        vm.startPrank(bridgeContract);
        tokenA.approve(address(bridgeAdapter), amountIn);
        
        vm.expectEmit(true, true, false, false);
        emit CrossChainSwapExecuted(messageId, user1, address(tokenB), 0);
        
        uint256 amountOut = bridgeAdapter.executeCrossChainSwap(messageId, messageData);
        vm.stopPrank();
        
        uint256 balanceAfter = tokenB.balanceOf(user1);
        
        assertGt(amountOut, 0, "Should receive output tokens");
        assertEq(balanceAfter - balanceBefore, amountOut, "Balance should increase by output amount");
    }
    
    function testProposeBridgeUpdate() public {
        address newBridge = address(0x888);
        
        vm.expectEmit(true, false, false, true);
        emit BridgeUpdateProposed(newBridge, block.timestamp + 2 days);
        
        bridgeAdapter.proposeBridgeUpdate(newBridge);
        
        assertEq(bridgeAdapter.pendingBridge(), newBridge, "Pending bridge should be set");
        assertGt(bridgeAdapter.bridgeUpdateTime(), block.timestamp, "Update time should be in future");
    }
    
    function testExecuteBridgeUpdate() public {
        address newBridge = address(0x888);
        
        bridgeAdapter.proposeBridgeUpdate(newBridge);
        
        // Fast forward past timelock
        vm.warp(block.timestamp + 2 days + 1);
        
        vm.expectEmit(true, true, false, false);
        emit BridgeUpdated(address(0), newBridge);
        
        bridgeAdapter.executeBridgeUpdate();
        
        assertEq(bridgeAdapter.bridge(), newBridge, "Bridge should be updated");
        assertEq(bridgeAdapter.pendingBridge(), address(0), "Pending bridge should be cleared");
        assertEq(bridgeAdapter.bridgeUpdateTime(), 0, "Update time should be cleared");
    }
    
    function testCancelBridgeUpdate() public {
        address newBridge = address(0x888);
        
        bridgeAdapter.proposeBridgeUpdate(newBridge);
        assertEq(bridgeAdapter.pendingBridge(), newBridge, "Should have pending bridge");
        
        bridgeAdapter.cancelBridgeUpdate();
        
        assertEq(bridgeAdapter.pendingBridge(), address(0), "Should have no pending bridge");
        assertEq(bridgeAdapter.bridgeUpdateTime(), 0, "Update time should be cleared");
    }
    
    function testIsMessageProcessed() public {
        // Setup bridge
        bridgeAdapter.proposeBridgeUpdate(bridgeContract);
        vm.warp(block.timestamp + 2 days + 1);
        bridgeAdapter.executeBridgeUpdate();
        
        bytes32 messageId = keccak256("message1");
        
        assertFalse(
            bridgeAdapter.isMessageProcessed(messageId),
            "Message should not be processed initially"
        );
        
        // Execute swap
        BridgeAdapter.CrossChainSwapMessage memory message = BridgeAdapter.CrossChainSwapMessage({
            tokenIn: address(tokenA),
            tokenOut: address(tokenB),
            amountIn: 10 ether,
            amountOutMin: 0,
            recipient: user1,
            deadline: block.timestamp + 1 hours
        });
        bytes memory messageData = abi.encode(message);
        
        vm.startPrank(bridgeContract);
        tokenA.approve(address(bridgeAdapter), 10 ether);
        bridgeAdapter.executeCrossChainSwap(messageId, messageData);
        vm.stopPrank();
        
        assertTrue(
            bridgeAdapter.isMessageProcessed(messageId),
            "Message should be processed after execution"
        );
    }
    
    // ============ Error Cases ============
    
    function testRevertUnauthorizedBridge() public {
        bytes32 messageId = keccak256("message1");
        
        BridgeAdapter.CrossChainSwapMessage memory message = BridgeAdapter.CrossChainSwapMessage({
            tokenIn: address(tokenA),
            tokenOut: address(tokenB),
            amountIn: 10 ether,
            amountOutMin: 0,
            recipient: user1,
            deadline: block.timestamp + 1 hours
        });
        bytes memory messageData = abi.encode(message);
        
        vm.expectRevert(BridgeAdapter.UnauthorizedBridge.selector);
        bridgeAdapter.executeCrossChainSwap(messageId, messageData);
    }
    
    function testRevertMessageAlreadyProcessed() public {
        // Setup bridge
        bridgeAdapter.proposeBridgeUpdate(bridgeContract);
        vm.warp(block.timestamp + 2 days + 1);
        bridgeAdapter.executeBridgeUpdate();
        
        bytes32 messageId = keccak256("message1");
        
        BridgeAdapter.CrossChainSwapMessage memory message = BridgeAdapter.CrossChainSwapMessage({
            tokenIn: address(tokenA),
            tokenOut: address(tokenB),
            amountIn: 10 ether,
            amountOutMin: 0,
            recipient: user1,
            deadline: block.timestamp + 1 hours
        });
        bytes memory messageData = abi.encode(message);
        
        vm.startPrank(bridgeContract);
        tokenA.approve(address(bridgeAdapter), 10 ether);
        bridgeAdapter.executeCrossChainSwap(messageId, messageData);
        
        // Try to process again
        tokenA.approve(address(bridgeAdapter), 10 ether);
        vm.expectRevert(BridgeAdapter.MessageAlreadyProcessed.selector);
        bridgeAdapter.executeCrossChainSwap(messageId, messageData);
        vm.stopPrank();
    }
    
    function testRevertProposeBridgeUpdateZeroAddress() public {
        vm.expectRevert(BridgeAdapter.ZeroAddress.selector);
        bridgeAdapter.proposeBridgeUpdate(address(0));
    }
    
    function testRevertExecuteBridgeUpdateNoPending() public {
        vm.expectRevert(BridgeAdapter.NoPendingUpdate.selector);
        bridgeAdapter.executeBridgeUpdate();
    }
    
    function testRevertExecuteBridgeUpdateTimelockNotExpired() public {
        bridgeAdapter.proposeBridgeUpdate(address(0x888));
        
        vm.expectRevert(BridgeAdapter.TimelockNotExpired.selector);
        bridgeAdapter.executeBridgeUpdate();
    }
    
    function testRevertCancelBridgeUpdateNoPending() public {
        vm.expectRevert(BridgeAdapter.NoPendingUpdate.selector);
        bridgeAdapter.cancelBridgeUpdate();
    }
    
    function testRevertInvalidToken() public {
        // Setup bridge
        bridgeAdapter.proposeBridgeUpdate(bridgeContract);
        vm.warp(block.timestamp + 2 days + 1);
        bridgeAdapter.executeBridgeUpdate();
        
        bytes32 messageId = keccak256("message1");
        
        BridgeAdapter.CrossChainSwapMessage memory message = BridgeAdapter.CrossChainSwapMessage({
            tokenIn: address(0),
            tokenOut: address(tokenB),
            amountIn: 10 ether,
            amountOutMin: 0,
            recipient: user1,
            deadline: block.timestamp + 1 hours
        });
        bytes memory messageData = abi.encode(message);
        
        vm.prank(bridgeContract);
        vm.expectRevert(BridgeAdapter.InvalidToken.selector);
        bridgeAdapter.executeCrossChainSwap(messageId, messageData);
    }
    
    function testRevertInvalidAmount() public {
        // Setup bridge
        bridgeAdapter.proposeBridgeUpdate(bridgeContract);
        vm.warp(block.timestamp + 2 days + 1);
        bridgeAdapter.executeBridgeUpdate();
        
        bytes32 messageId = keccak256("message1");
        
        BridgeAdapter.CrossChainSwapMessage memory message = BridgeAdapter.CrossChainSwapMessage({
            tokenIn: address(tokenA),
            tokenOut: address(tokenB),
            amountIn: 0,
            amountOutMin: 0,
            recipient: user1,
            deadline: block.timestamp + 1 hours
        });
        bytes memory messageData = abi.encode(message);
        
        vm.prank(bridgeContract);
        vm.expectRevert(BridgeAdapter.InvalidAmount.selector);
        bridgeAdapter.executeCrossChainSwap(messageId, messageData);
    }
    
    function testRevertDeadlineExpired() public {
        // Setup bridge
        bridgeAdapter.proposeBridgeUpdate(bridgeContract);
        vm.warp(block.timestamp + 2 days + 1);
        bridgeAdapter.executeBridgeUpdate();
        
        bytes32 messageId = keccak256("message1");
        
        BridgeAdapter.CrossChainSwapMessage memory message = BridgeAdapter.CrossChainSwapMessage({
            tokenIn: address(tokenA),
            tokenOut: address(tokenB),
            amountIn: 10 ether,
            amountOutMin: 0,
            recipient: user1,
            deadline: block.timestamp - 1
        });
        bytes memory messageData = abi.encode(message);
        
        vm.prank(bridgeContract);
        vm.expectRevert(BridgeAdapter.DeadlineExpired.selector);
        bridgeAdapter.executeCrossChainSwap(messageId, messageData);
    }
    
    function testRevertZeroRecipient() public {
        // Setup bridge
        bridgeAdapter.proposeBridgeUpdate(bridgeContract);
        vm.warp(block.timestamp + 2 days + 1);
        bridgeAdapter.executeBridgeUpdate();
        
        bytes32 messageId = keccak256("message1");
        
        BridgeAdapter.CrossChainSwapMessage memory message = BridgeAdapter.CrossChainSwapMessage({
            tokenIn: address(tokenA),
            tokenOut: address(tokenB),
            amountIn: 10 ether,
            amountOutMin: 0,
            recipient: address(0),
            deadline: block.timestamp + 1 hours
        });
        bytes memory messageData = abi.encode(message);
        
        vm.prank(bridgeContract);
        vm.expectRevert(BridgeAdapter.ZeroAddress.selector);
        bridgeAdapter.executeCrossChainSwap(messageId, messageData);
    }
    
    // ============ Access Control Tests ============
    
    function testOnlyOwnerCanProposeBridgeUpdate() public {
        vm.prank(user1);
        vm.expectRevert();
        bridgeAdapter.proposeBridgeUpdate(address(0x888));
    }
    
    function testOnlyOwnerCanExecuteBridgeUpdate() public {
        bridgeAdapter.proposeBridgeUpdate(address(0x888));
        vm.warp(block.timestamp + 2 days + 1);
        
        vm.prank(user1);
        vm.expectRevert();
        bridgeAdapter.executeBridgeUpdate();
    }
    
    function testOnlyOwnerCanCancelBridgeUpdate() public {
        bridgeAdapter.proposeBridgeUpdate(address(0x888));
        
        vm.prank(user1);
        vm.expectRevert();
        bridgeAdapter.cancelBridgeUpdate();
    }
    
    // ============ Integration Tests ============
    
    function testFullBridgeUpdateFlow() public {
        address newBridge = address(0x888);
        
        // Step 1: Propose
        bridgeAdapter.proposeBridgeUpdate(newBridge);
        assertEq(bridgeAdapter.pendingBridge(), newBridge);
        
        // Step 2: Wait for timelock
        vm.warp(block.timestamp + 2 days + 1);
        
        // Step 3: Execute
        bridgeAdapter.executeBridgeUpdate();
        assertEq(bridgeAdapter.bridge(), newBridge);
        assertEq(bridgeAdapter.pendingBridge(), address(0));
    }
    
    function testMultipleCrossChainSwaps() public {
        // Setup bridge
        bridgeAdapter.proposeBridgeUpdate(bridgeContract);
        vm.warp(block.timestamp + 2 days + 1);
        bridgeAdapter.executeBridgeUpdate();
        
        vm.startPrank(bridgeContract);
        
        // Execute multiple swaps
        for (uint256 i = 0; i < 3; i++) {
            bytes32 messageId = keccak256(abi.encodePacked("message", i));
            
            BridgeAdapter.CrossChainSwapMessage memory message = BridgeAdapter.CrossChainSwapMessage({
                tokenIn: address(tokenA),
                tokenOut: address(tokenB),
                amountIn: 1 ether,
                amountOutMin: 0,
                recipient: user1,
                deadline: block.timestamp + 1 hours
            });
            bytes memory messageData = abi.encode(message);
            
            tokenA.approve(address(bridgeAdapter), 1 ether);
            uint256 amountOut = bridgeAdapter.executeCrossChainSwap(messageId, messageData);
            
            assertGt(amountOut, 0, "Should receive tokens");
            assertTrue(bridgeAdapter.isMessageProcessed(messageId), "Message should be processed");
        }
        
        vm.stopPrank();
    }
    
    function testFuzzExecuteCrossChainSwap(uint256 amountIn) public {
        // Bound amount to reasonable values (higher minimum for bridge fees)
        amountIn = bound(amountIn, 1 ether, 100 ether);
        
        // Setup bridge
        bridgeAdapter.proposeBridgeUpdate(bridgeContract);
        vm.warp(block.timestamp + 2 days + 1);
        bridgeAdapter.executeBridgeUpdate();
        
        // Mint tokens to bridge
        tokenA.mint(bridgeContract, amountIn);
        
        bytes32 messageId = keccak256(abi.encodePacked("fuzz", amountIn));
        
        BridgeAdapter.CrossChainSwapMessage memory message = BridgeAdapter.CrossChainSwapMessage({
            tokenIn: address(tokenA),
            tokenOut: address(tokenB),
            amountIn: amountIn,
            amountOutMin: 0,
            recipient: user1,
            deadline: block.timestamp + 1 hours
        });
        bytes memory messageData = abi.encode(message);
        
        vm.startPrank(bridgeContract);
        tokenA.approve(address(bridgeAdapter), amountIn);
        uint256 amountOut = bridgeAdapter.executeCrossChainSwap(messageId, messageData);
        vm.stopPrank();
        
        assertGt(amountOut, 0, "Should receive output tokens");
    }
}
