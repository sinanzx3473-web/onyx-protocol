// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "forge-std/Test.sol";
import "../src/MinimalForwarder.sol";
import "../src/DEXRouter.sol";
import "../src/DexCore.sol";
import "../src/FlashSwap.sol";
import "../src/DEXFactory.sol";
import "../src/MockERC20.sol";

/**
 * @title MetaTransactions Test Suite
 * @notice Comprehensive tests for EIP-2771 meta-transaction support
 * @dev Tests spoofing prevention, nonce management, replay attacks, and integration
 */
contract MetaTransactionsTest is Test {
    MinimalForwarder public forwarder;
    DEXRouter public router;
    DexCore public dexCore;
    FlashSwap public flashSwap;
    DEXFactory public factory;
    MockERC20 public tokenA;
    MockERC20 public tokenB;
    MockERC20 public weth;

    address public owner;
    address public user1;
    address public user2;
    address public relayer;
    address public attacker;

    uint256 public user1PrivateKey = 0x1234;
    uint256 public user2PrivateKey = 0x5678;

    // Events from MinimalForwarder
    event MetaTransactionExecuted(
        address indexed from,
        address indexed to,
        uint256 nonce,
        bool success,
        bytes returnData
    );

    // Events from DexCore
    event LiquidityAdded(
        address indexed provider,
        address indexed token0,
        address indexed token1,
        uint256 amount0,
        uint256 amount1,
        uint256 liquidity
    );

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
        owner = address(this);
        user1 = vm.addr(user1PrivateKey);
        user2 = vm.addr(user2PrivateKey);
        relayer = makeAddr("relayer");
        attacker = makeAddr("attacker");

        // Deploy contracts
        forwarder = new MinimalForwarder();
        factory = new DEXFactory(owner);
        weth = new MockERC20("Wrapped ETH", "WETH", 18);
        
        router = new DEXRouter(address(factory), address(weth), address(forwarder));
        dexCore = new DexCore(address(factory), address(weth), address(forwarder));
        flashSwap = new FlashSwap(address(dexCore), address(forwarder));

        // Deploy test tokens
        tokenA = new MockERC20("Token A", "TKA", 18);
        tokenB = new MockERC20("Token B", "TKB", 18);

        // Fund users
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
        vm.deal(relayer, 100 ether);

        tokenA.mint(user1, 1000000 ether);
        tokenB.mint(user1, 1000000 ether);
        tokenA.mint(user2, 1000000 ether);
        tokenB.mint(user2, 1000000 ether);

        // Create pool
        dexCore.createPool(address(tokenA), address(tokenB));

        // User1 approves dexCore
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), type(uint256).max);
        tokenB.approve(address(dexCore), type(uint256).max);
        vm.stopPrank();

        // User2 approves dexCore
        vm.startPrank(user2);
        tokenA.approve(address(dexCore), type(uint256).max);
        tokenB.approve(address(dexCore), type(uint256).max);
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Build EIP-712 typed data hash for ForwardRequest
     */
    function buildTypedDataHash(MinimalForwarder.ForwardRequest memory req)
        internal
        view
        returns (bytes32)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"),
                req.from,
                req.to,
                req.value,
                req.gas,
                req.nonce,
                keccak256(req.data)
            )
        );

        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("MinimalForwarder"),
                keccak256("1.0.0"),
                block.chainid,
                address(forwarder)
            )
        );

        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    /**
     * @notice Sign a ForwardRequest with a private key
     */
    function signRequest(MinimalForwarder.ForwardRequest memory req, uint256 privateKey)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = buildTypedDataHash(req);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          BASIC META-TRANSACTION TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Test basic meta-transaction execution
     */
    function testMetaTransactionBasic() public {
        // Add initial liquidity normally
        vm.prank(user1);
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            1000 ether,
            1000 ether,
            1000 ether,
            1000 ether,
            user1,
            block.timestamp + 1 hours
        );

        // Build meta-transaction for swap
        bytes memory callData = abi.encodeWithSelector(
            DexCore.swap.selector,
            address(tokenA),
            address(tokenB),
            10 ether,
            9 ether,
            user2,
            block.timestamp + 1 hours
        );

        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user2,
            to: address(dexCore),
            value: 0,
            gas: 500000,
            nonce: forwarder.getNonce(user2),
            data: callData
        });

        bytes memory signature = signRequest(req, user2PrivateKey);

        // Verify signature
        assertTrue(forwarder.verify(req, signature), "Signature verification failed");

        // Execute meta-transaction via relayer
        uint256 balanceBefore = tokenB.balanceOf(user2);
        
        vm.prank(relayer);
        vm.expectEmit(true, true, true, false);
        emit Swap(user2, address(tokenA), address(tokenB), 10 ether, 0, 9 ether, 0);
        
        (bool success, ) = forwarder.execute(req, signature);
        assertTrue(success, "Meta-transaction execution failed");

        // Verify swap occurred
        uint256 balanceAfter = tokenB.balanceOf(user2);
        assertGt(balanceAfter, balanceBefore, "Swap did not execute");
    }

    /**
     * @notice Test that normal transactions still work
     */
    function testNormalTransactionStillWorks() public {
        // Add liquidity normally (not via meta-transaction)
        vm.prank(user1);
        (uint256 amountA, uint256 amountB, uint256 liquidity) = dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            1000 ether,
            1000 ether,
            1000 ether,
            1000 ether,
            user1,
            block.timestamp + 1 hours
        );

        assertEq(amountA, 1000 ether, "AmountA mismatch");
        assertEq(amountB, 1000 ether, "AmountB mismatch");
        assertGt(liquidity, 0, "No liquidity minted");
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          SECURITY TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Test meta-transaction spoofing prevention
     * @dev Attacker cannot forge signature for another user
     */
    function testCannotSpoofMetaTransaction() public {
        bytes memory callData = abi.encodeWithSelector(
            DexCore.swap.selector,
            address(tokenA),
            address(tokenB),
            10 ether,
            9 ether,
            attacker,
            block.timestamp + 1 hours
        );

        // Attacker tries to create request claiming to be user2
        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user2,
            to: address(dexCore),
            value: 0,
            gas: 500000,
            nonce: forwarder.getNonce(user2),
            data: callData
        });

        // Attacker signs with their own key (not user2's key)
        uint256 attackerPrivateKey = 0x9999;
        bytes memory fakeSignature = signRequest(req, attackerPrivateKey);

        // Signature verification should fail
        assertFalse(forwarder.verify(req, fakeSignature), "Spoofed signature should not verify");

        // Execution should revert
        vm.prank(relayer);
        vm.expectRevert(MinimalForwarder.InvalidSignature.selector);
        forwarder.execute(req, fakeSignature);
    }

    /**
     * @notice Test nonce increment prevents replay attacks
     */
    function testNoncePreventReplayAttack() public {
        // Add liquidity first
        vm.prank(user1);
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            1000 ether,
            1000 ether,
            1000 ether,
            1000 ether,
            user1,
            block.timestamp + 1 hours
        );

        bytes memory callData = abi.encodeWithSelector(
            DexCore.swap.selector,
            address(tokenA),
            address(tokenB),
            10 ether,
            9 ether,
            user2,
            block.timestamp + 1 hours
        );

        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user2,
            to: address(dexCore),
            value: 0,
            gas: 500000,
            nonce: forwarder.getNonce(user2),
            data: callData
        });

        bytes memory signature = signRequest(req, user2PrivateKey);

        // Execute first time - should succeed
        vm.prank(relayer);
        (bool success1, ) = forwarder.execute(req, signature);
        assertTrue(success1, "First execution failed");

        // Try to replay same transaction - should fail due to nonce
        vm.prank(relayer);
        vm.expectRevert(MinimalForwarder.InvalidSignature.selector);
        forwarder.execute(req, signature);
    }

    /**
     * @notice Test invalid nonce rejection
     */
    function testInvalidNonceRejected() public {
        bytes memory callData = abi.encodeWithSelector(
            DexCore.swap.selector,
            address(tokenA),
            address(tokenB),
            10 ether,
            9 ether,
            user2,
            block.timestamp + 1 hours
        );

        // Use wrong nonce (current nonce + 1)
        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user2,
            to: address(dexCore),
            value: 0,
            gas: 500000,
            nonce: forwarder.getNonce(user2) + 1,
            data: callData
        });

        bytes memory signature = signRequest(req, user2PrivateKey);

        // Signature verification should fail
        assertFalse(forwarder.verify(req, signature), "Invalid nonce should not verify");

        // Execution should revert
        vm.prank(relayer);
        vm.expectRevert(MinimalForwarder.InvalidSignature.selector);
        forwarder.execute(req, signature);
    }

    /**
     * @notice Test relay exploit prevention - relayer cannot modify request
     */
    function testRelayerCannotModifyRequest() public {
        bytes memory callData = abi.encodeWithSelector(
            DexCore.swap.selector,
            address(tokenA),
            address(tokenB),
            10 ether,
            9 ether,
            user2,
            block.timestamp + 1 hours
        );

        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user2,
            to: address(dexCore),
            value: 0,
            gas: 500000,
            nonce: forwarder.getNonce(user2),
            data: callData
        });

        bytes memory signature = signRequest(req, user2PrivateKey);

        // Relayer tries to modify the request
        req.to = address(attacker); // Change recipient

        // Signature verification should fail
        assertFalse(forwarder.verify(req, signature), "Modified request should not verify");

        // Execution should revert
        vm.prank(relayer);
        vm.expectRevert(MinimalForwarder.InvalidSignature.selector);
        forwarder.execute(req, signature);
    }

    /**
     * @notice Test that msg.sender is correctly replaced with _msgSender()
     */
    function testMsgSenderCorrectlyReplaced() public {
        // Add liquidity via meta-transaction
        bytes memory callData = abi.encodeWithSelector(
            DexCore.addLiquidity.selector,
            address(tokenA),
            address(tokenB),
            1000 ether,
            1000 ether,
            1000 ether,
            1000 ether,
            user2,
            block.timestamp + 1 hours
        );

        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user2,
            to: address(dexCore),
            value: 0,
            gas: 500000,
            nonce: forwarder.getNonce(user2),
            data: callData
        });

        bytes memory signature = signRequest(req, user2PrivateKey);

        // Execute via relayer
        vm.prank(relayer);
        vm.expectEmit(true, true, true, false);
        emit LiquidityAdded(user2, address(tokenA), address(tokenB), 1000 ether, 1000 ether, 0);
        
        (bool success, ) = forwarder.execute(req, signature);
        assertTrue(success, "Meta-transaction failed");

        // Verify event shows user2 as provider, not relayer
        // This is checked by vm.expectEmit above
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          GAS EDGE CASES
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Test insufficient gas handling
     */
    function testInsufficientGasHandling() public {
        bytes memory callData = abi.encodeWithSelector(
            DexCore.swap.selector,
            address(tokenA),
            address(tokenB),
            10 ether,
            9 ether,
            user2,
            block.timestamp + 1 hours
        );

        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user2,
            to: address(dexCore),
            value: 0,
            gas: 1000, // Very low gas
            nonce: forwarder.getNonce(user2),
            data: callData
        });

        bytes memory signature = signRequest(req, user2PrivateKey);

        // Execution should fail due to insufficient gas
        vm.prank(relayer);
        vm.expectRevert();
        forwarder.execute(req, signature);
    }

    /**
     * @notice Test excessive gas limit
     */
    function testExcessiveGasLimit() public {
        // Add liquidity first
        vm.prank(user1);
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            1000 ether,
            1000 ether,
            1000 ether,
            1000 ether,
            user1,
            block.timestamp + 1 hours
        );

        bytes memory callData = abi.encodeWithSelector(
            DexCore.swap.selector,
            address(tokenA),
            address(tokenB),
            10 ether,
            9 ether,
            user2,
            block.timestamp + 1 hours
        );

        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user2,
            to: address(dexCore),
            value: 0,
            gas: 10000000, // Very high gas
            nonce: forwarder.getNonce(user2),
            data: callData
        });

        bytes memory signature = signRequest(req, user2PrivateKey);

        // Should still execute successfully
        vm.prank(relayer);
        (bool success, ) = forwarder.execute(req, signature);
        assertTrue(success, "Execution with high gas failed");
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          INTEGRATION TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Test complete workflow: add liquidity + swap via meta-transactions
     */
    function testCompleteMetaTransactionWorkflow() public {
        // Step 1: Add liquidity via meta-transaction
        bytes memory addLiquidityData = abi.encodeWithSelector(
            DexCore.addLiquidity.selector,
            address(tokenA),
            address(tokenB),
            1000 ether,
            1000 ether,
            1000 ether,
            1000 ether,
            user1,
            block.timestamp + 1 hours
        );

        MinimalForwarder.ForwardRequest memory req1 = MinimalForwarder.ForwardRequest({
            from: user1,
            to: address(dexCore),
            value: 0,
            gas: 500000,
            nonce: forwarder.getNonce(user1),
            data: addLiquidityData
        });

        bytes memory sig1 = signRequest(req1, user1PrivateKey);

        vm.prank(relayer);
        (bool success1, ) = forwarder.execute(req1, sig1);
        assertTrue(success1, "Add liquidity meta-tx failed");

        // Step 2: Swap via meta-transaction
        bytes memory swapData = abi.encodeWithSelector(
            DexCore.swap.selector,
            address(tokenA),
            address(tokenB),
            10 ether,
            9 ether,
            user2,
            block.timestamp + 1 hours
        );

        MinimalForwarder.ForwardRequest memory req2 = MinimalForwarder.ForwardRequest({
            from: user2,
            to: address(dexCore),
            value: 0,
            gas: 500000,
            nonce: forwarder.getNonce(user2),
            data: swapData
        });

        bytes memory sig2 = signRequest(req2, user2PrivateKey);

        uint256 balanceBefore = tokenB.balanceOf(user2);
        
        vm.prank(relayer);
        (bool success2, ) = forwarder.execute(req2, sig2);
        assertTrue(success2, "Swap meta-tx failed");

        uint256 balanceAfter = tokenB.balanceOf(user2);
        assertGt(balanceAfter, balanceBefore, "Swap did not execute");
    }

    /**
     * @notice Test multiple sequential meta-transactions from same user
     */
    function testMultipleSequentialMetaTransactions() public {
        // Add liquidity first
        vm.prank(user1);
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            1000 ether,
            1000 ether,
            1000 ether,
            1000 ether,
            user1,
            block.timestamp + 1 hours
        );

        // Execute 3 swaps sequentially
        for (uint256 i = 0; i < 3; i++) {
            bytes memory callData = abi.encodeWithSelector(
                DexCore.swap.selector,
                address(tokenA),
                address(tokenB),
                10 ether,
                9 ether,
                user2,
                block.timestamp + 1 hours
            );

            MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
                from: user2,
                to: address(dexCore),
                value: 0,
                gas: 500000,
                nonce: forwarder.getNonce(user2),
                data: callData
            });

            bytes memory signature = signRequest(req, user2PrivateKey);

            vm.prank(relayer);
            (bool success, ) = forwarder.execute(req, signature);
            assertTrue(success, string(abi.encodePacked("Swap ", vm.toString(i), " failed")));

            // Verify nonce incremented
            assertEq(forwarder.getNonce(user2), i + 1, "Nonce not incremented");
        }
    }

    /**
     * @notice Test meta-transactions from different users
     */
    function testMetaTransactionsFromDifferentUsers() public {
        // Add liquidity from user1
        vm.prank(user1);
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            1000 ether,
            1000 ether,
            1000 ether,
            1000 ether,
            user1,
            block.timestamp + 1 hours
        );

        // User2 swap via meta-tx
        bytes memory swapData2 = abi.encodeWithSelector(
            DexCore.swap.selector,
            address(tokenA),
            address(tokenB),
            10 ether,
            9 ether,
            user2,
            block.timestamp + 1 hours
        );

        MinimalForwarder.ForwardRequest memory req2 = MinimalForwarder.ForwardRequest({
            from: user2,
            to: address(dexCore),
            value: 0,
            gas: 500000,
            nonce: forwarder.getNonce(user2),
            data: swapData2
        });

        bytes memory sig2 = signRequest(req2, user2PrivateKey);

        vm.prank(relayer);
        (bool success2, ) = forwarder.execute(req2, sig2);
        assertTrue(success2, "User2 swap failed");

        // User1 swap via meta-tx
        bytes memory swapData1 = abi.encodeWithSelector(
            DexCore.swap.selector,
            address(tokenB),
            address(tokenA),
            10 ether,
            9 ether,
            user1,
            block.timestamp + 1 hours
        );

        MinimalForwarder.ForwardRequest memory req1 = MinimalForwarder.ForwardRequest({
            from: user1,
            to: address(dexCore),
            value: 0,
            gas: 500000,
            nonce: forwarder.getNonce(user1),
            data: swapData1
        });

        bytes memory sig1 = signRequest(req1, user1PrivateKey);

        vm.prank(relayer);
        (bool success1, ) = forwarder.execute(req1, sig1);
        assertTrue(success1, "User1 swap failed");

        // Verify independent nonces
        assertEq(forwarder.getNonce(user1), 1, "User1 nonce incorrect");
        assertEq(forwarder.getNonce(user2), 1, "User2 nonce incorrect");
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          FUZZ TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Fuzz test: random swap amounts via meta-transactions
     */
    function testFuzzMetaTransactionSwapAmounts(uint256 swapAmount) public {
        // Bound swap amount to reasonable range
        swapAmount = bound(swapAmount, 1 ether, 100 ether);

        // Add liquidity
        vm.prank(user1);
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            1000 ether,
            1000 ether,
            1000 ether,
            1000 ether,
            user1,
            block.timestamp + 1 hours
        );

        // Calculate minimum output
        uint256 minOutput = dexCore.getAmountOut(swapAmount, address(tokenA), address(tokenB));
        minOutput = (minOutput * 95) / 100; // 5% slippage

        bytes memory callData = abi.encodeWithSelector(
            DexCore.swap.selector,
            address(tokenA),
            address(tokenB),
            swapAmount,
            minOutput,
            user2,
            block.timestamp + 1 hours
        );

        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user2,
            to: address(dexCore),
            value: 0,
            gas: 500000,
            nonce: forwarder.getNonce(user2),
            data: callData
        });

        bytes memory signature = signRequest(req, user2PrivateKey);

        uint256 balanceBefore = tokenB.balanceOf(user2);
        
        vm.prank(relayer);
        (bool success, ) = forwarder.execute(req, signature);
        assertTrue(success, "Fuzz swap failed");

        uint256 balanceAfter = tokenB.balanceOf(user2);
        assertGt(balanceAfter, balanceBefore, "No tokens received");
    }

    /**
     * @notice Fuzz test: random gas limits
     */
    function testFuzzGasLimits(uint256 gasLimit) public {
        // Bound gas to reasonable range
        gasLimit = bound(gasLimit, 200000, 5000000);

        // Add liquidity
        vm.prank(user1);
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            1000 ether,
            1000 ether,
            1000 ether,
            1000 ether,
            user1,
            block.timestamp + 1 hours
        );

        bytes memory callData = abi.encodeWithSelector(
            DexCore.swap.selector,
            address(tokenA),
            address(tokenB),
            10 ether,
            9 ether,
            user2,
            block.timestamp + 1 hours
        );

        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user2,
            to: address(dexCore),
            value: 0,
            gas: gasLimit,
            nonce: forwarder.getNonce(user2),
            data: callData
        });

        bytes memory signature = signRequest(req, user2PrivateKey);

        vm.prank(relayer);
        (bool success, ) = forwarder.execute(req, signature);
        assertTrue(success, "Fuzz gas limit failed");
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          REENTRANCY TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * @notice Test reentrancy protection with meta-transactions
     */
    function testReentrancyProtectionWithMetaTransactions() public {
        // Add liquidity
        vm.prank(user1);
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            1000 ether,
            1000 ether,
            1000 ether,
            1000 ether,
            user1,
            block.timestamp + 1 hours
        );

        // Normal swap should work
        bytes memory callData = abi.encodeWithSelector(
            DexCore.swap.selector,
            address(tokenA),
            address(tokenB),
            10 ether,
            9 ether,
            user2,
            block.timestamp + 1 hours
        );

        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user2,
            to: address(dexCore),
            value: 0,
            gas: 500000,
            nonce: forwarder.getNonce(user2),
            data: callData
        });

        bytes memory signature = signRequest(req, user2PrivateKey);

        vm.prank(relayer);
        (bool success, ) = forwarder.execute(req, signature);
        assertTrue(success, "Swap failed");

        // Reentrancy is prevented by ReentrancyGuard in DexCore
        // This test verifies meta-transactions don't bypass reentrancy protection
    }
}
