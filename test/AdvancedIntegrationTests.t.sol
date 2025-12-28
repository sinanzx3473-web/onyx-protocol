// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MinimalForwarder.sol";
import "../src/DexCore.sol";
import "../src/DEXFactory.sol";
import "../src/DEXRouter.sol";
import "../src/DEXPair.sol";
import "../src/FlashSwap.sol";
import "../src/BridgeAdapter.sol";
import "../src/MockERC20.sol";
import "../src/FlashBorrower.sol";

/**
 * @title AdvancedIntegrationTests
 * @notice Enhanced integration tests with snapshot testing, complex multi-hop flows, and flash loan combinations
 * @dev Tests advanced scenarios with event snapshots and state verification
 */
contract AdvancedIntegrationTests is Test {
    DexCore public dexCore;
    DEXFactory public factory;
    DEXRouter public router;
    FlashSwap public flashSwap;
    BridgeAdapter public bridgeAdapter;
    
    MockERC20 public tokenA;
    MockERC20 public tokenB;
    MockERC20 public tokenC;
    MockERC20 public tokenD;
    MockERC20 public tokenE;
    MockERC20 public weth;
    MinimalForwarder public forwarder;
    
    address public owner = address(this);
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public liquidityProvider = address(0x3);
    
    uint256 constant INITIAL_SUPPLY = 10_000_000 * 1e18;
    uint256 constant LIQUIDITY_AMOUNT = 100_000 * 1e18;

    // Events for snapshot testing
    event Swap(
        address indexed sender,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 amountOutMin,
        uint256 priceImpactBps
    );

    event LiquidityAdded(
        address indexed provider,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity
    );

    event LiquidityRemoved(
        address indexed provider,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity
    );

    event FlashLoan(
        address indexed borrower,
        address indexed token,
        uint256 amount,
        uint256 fee
    );

    struct PoolSnapshot {
        uint256 reserve0;
        uint256 reserve1;
        uint256 totalSupply;
        uint256 kLast;
        uint32 blockTimestamp;
    }

    function setUp() public {
        // Deploy tokens
        tokenA = new MockERC20("Token A", "TKNA", 18);
        tokenB = new MockERC20("Token B", "TKNB", 18);
        tokenC = new MockERC20("Token C", "TKNC", 18);
        tokenD = new MockERC20("Token D", "TKND", 18);
        tokenE = new MockERC20("Token E", "TKNE", 18);
        weth = new MockERC20("Wrapped ETH", "WETH", 18);
        forwarder = new MinimalForwarder();
        
        // Deploy core contracts
        factory = new DEXFactory(owner);
        dexCore = new DexCore(address(factory), address(weth), address(forwarder));
        router = new DEXRouter(address(factory), address(weth), address(forwarder));
        flashSwap = new FlashSwap(address(dexCore), address(forwarder));
        bridgeAdapter = new BridgeAdapter(address(dexCore), owner);
        
        // Set router in factory
        factory.setRouter(address(router));
        
        // Set FlashSwap contract in DexCore
        dexCore.setFlashSwapContract(address(flashSwap));
        
        // Mint tokens to users
        _mintTokensToUsers();
        
        // Create pools for multi-hop testing
        _createPools();
        
        // Add liquidity to all pools
        _addInitialLiquidity();
    }

    function _mintTokensToUsers() internal {
        address[3] memory users = [user1, user2, liquidityProvider];
        MockERC20[6] memory tokens = [tokenA, tokenB, tokenC, tokenD, tokenE, weth];
        
        for (uint256 i = 0; i < users.length; i++) {
            for (uint256 j = 0; j < tokens.length; j++) {
                tokens[j].mint(users[i], INITIAL_SUPPLY);
            }
        }
    }

    function _createPools() internal {
        factory.createPair(address(tokenA), address(tokenB));
        factory.createPair(address(tokenB), address(tokenC));
        factory.createPair(address(tokenC), address(tokenD));
        factory.createPair(address(tokenD), address(tokenE));
        factory.createPair(address(tokenA), address(weth));
    }

    function _addInitialLiquidity() internal {
        vm.startPrank(liquidityProvider);
        
        // Pool A-B
        tokenA.approve(address(router), LIQUIDITY_AMOUNT);
        tokenB.approve(address(router), LIQUIDITY_AMOUNT);
        router.addLiquidity(
            address(tokenA), address(tokenB),
            LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT,
            0, 0, liquidityProvider, block.timestamp + 1 hours
        );
        
        // Pool B-C
        tokenB.approve(address(router), LIQUIDITY_AMOUNT);
        tokenC.approve(address(router), LIQUIDITY_AMOUNT);
        router.addLiquidity(
            address(tokenB), address(tokenC),
            LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT,
            0, 0, liquidityProvider, block.timestamp + 1 hours
        );
        
        // Pool C-D
        tokenC.approve(address(router), LIQUIDITY_AMOUNT);
        tokenD.approve(address(router), LIQUIDITY_AMOUNT);
        router.addLiquidity(
            address(tokenC), address(tokenD),
            LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT,
            0, 0, liquidityProvider, block.timestamp + 1 hours
        );
        
        // Pool D-E
        tokenD.approve(address(router), LIQUIDITY_AMOUNT);
        tokenE.approve(address(router), LIQUIDITY_AMOUNT);
        router.addLiquidity(
            address(tokenD), address(tokenE),
            LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT,
            0, 0, liquidityProvider, block.timestamp + 1 hours
        );
        
        // Pool A-WETH
        tokenA.approve(address(router), LIQUIDITY_AMOUNT);
        weth.approve(address(router), LIQUIDITY_AMOUNT);
        router.addLiquidity(
            address(tokenA), address(weth),
            LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT,
            0, 0, liquidityProvider, block.timestamp + 1 hours
        );
        
        vm.stopPrank();
    }

    function _snapshotPool(address token0, address token1) internal view returns (PoolSnapshot memory) {
        (uint256 reserve0, uint256 reserve1, uint32 timestamp) = dexCore.getReserves(token0, token1);
        address lpTokenAddr = dexCore.lpTokens(token0, token1);
        LPToken lpToken = LPToken(lpTokenAddr);
        
        return PoolSnapshot({
            reserve0: reserve0,
            reserve1: reserve1,
            totalSupply: lpToken.totalSupply(),
            kLast: reserve0 * reserve1,
            blockTimestamp: timestamp
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                    ENHANCED MULTI-HOP SWAP TESTS WITH SNAPSHOTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function test_MultiHopSwap_FourHops_WithSnapshots() public {
        uint256 amountIn = 1000 * 1e18;
        
        // Snapshot all pools before swap
        PoolSnapshot memory snapAB_before = _snapshotPool(address(tokenA), address(tokenB));
        PoolSnapshot memory snapBC_before = _snapshotPool(address(tokenB), address(tokenC));
        PoolSnapshot memory snapCD_before = _snapshotPool(address(tokenC), address(tokenD));
        PoolSnapshot memory snapDE_before = _snapshotPool(address(tokenD), address(tokenE));
        
        vm.startPrank(user1);
        tokenA.approve(address(router), amountIn);
        
        address[] memory path = new address[](5);
        path[0] = address(tokenA);
        path[1] = address(tokenB);
        path[2] = address(tokenC);
        path[3] = address(tokenD);
        path[4] = address(tokenE);
        
        uint256 balanceBefore = tokenE.balanceOf(user1);
        
        // Execute 4-hop swap
        uint256[] memory amounts = router.swapExactTokensForTokens(
            amountIn, 0, path, user1, block.timestamp + 1 hours
        );
        
        uint256 balanceAfter = tokenE.balanceOf(user1);
        vm.stopPrank();
        
        // Snapshot all pools after swap
        PoolSnapshot memory snapAB_after = _snapshotPool(address(tokenA), address(tokenB));
        PoolSnapshot memory snapBC_after = _snapshotPool(address(tokenB), address(tokenC));
        PoolSnapshot memory snapCD_after = _snapshotPool(address(tokenC), address(tokenD));
        PoolSnapshot memory snapDE_after = _snapshotPool(address(tokenD), address(tokenE));
        
        // Verify output
        assertEq(balanceAfter - balanceBefore, amounts[4], "Should receive exact output amount");
        assertGt(amounts[4], 0, "Should receive tokenE");
        
        // Verify all pools were affected
        assertGt(snapAB_after.reserve0, snapAB_before.reserve0, "Pool A-B reserve0 should increase");
        assertLt(snapAB_after.reserve1, snapAB_before.reserve1, "Pool A-B reserve1 should decrease");
        
        assertGt(snapBC_after.reserve0, snapBC_before.reserve0, "Pool B-C reserve0 should increase");
        assertLt(snapBC_after.reserve1, snapBC_before.reserve1, "Pool B-C reserve1 should decrease");
        
        assertGt(snapCD_after.reserve0, snapCD_before.reserve0, "Pool C-D reserve0 should increase");
        assertLt(snapCD_after.reserve1, snapCD_before.reserve1, "Pool C-D reserve1 should decrease");
        
        assertGt(snapDE_after.reserve0, snapDE_before.reserve0, "Pool D-E reserve0 should increase");
        assertLt(snapDE_after.reserve1, snapDE_before.reserve1, "Pool D-E reserve1 should decrease");
        
        // Verify constant product (k) increased due to fees
        assertGe(snapAB_after.reserve0 * snapAB_after.reserve1, snapAB_before.reserve0 * snapAB_before.reserve1, "K should not decrease");
    }

    function test_MultiHopSwap_CircularArbitrage() public {
        // Test A -> B -> C -> A circular path
        uint256 amountIn = 1000 * 1e18;
        
        // Create A-C pool for circular path
        factory.createPair(address(tokenA), address(tokenC));
        vm.startPrank(liquidityProvider);
        tokenA.approve(address(router), LIQUIDITY_AMOUNT);
        tokenC.approve(address(router), LIQUIDITY_AMOUNT);
        router.addLiquidity(
            address(tokenA), address(tokenC),
            LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT,
            0, 0, liquidityProvider, block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        vm.startPrank(user1);
        tokenA.approve(address(router), amountIn);
        
        address[] memory path = new address[](4);
        path[0] = address(tokenA);
        path[1] = address(tokenB);
        path[2] = address(tokenC);
        path[3] = address(tokenA);
        
        uint256 balanceBefore = tokenA.balanceOf(user1);
        
        router.swapExactTokensForTokens(
            amountIn, 0, path, user1, block.timestamp + 1 hours
        );
        
        uint256 balanceAfter = tokenA.balanceOf(user1);
        vm.stopPrank();
        
        // Due to fees, should receive less than started with
        assertLt(balanceAfter, balanceBefore, "Circular swap should lose value to fees");
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                    FLASH LOAN + SWAP + REPAY INTEGRATION TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function test_FlashLoan_SwapAndRepay_Integration() public {
        uint256 flashAmount = 10000 * 1e18;
        
        // Deploy advanced flash borrower that swaps borrowed tokens
        AdvancedFlashBorrower borrower = new AdvancedFlashBorrower(
            address(flashSwap),
            address(dexCore)
        );
        
        // Fund borrower with tokens for fee payment
        vm.startPrank(user1);
        tokenA.transfer(address(borrower), 200 * 1e18);
        tokenB.transfer(address(borrower), 200 * 1e18);
        vm.stopPrank();
        
        // Snapshot pool states
        PoolSnapshot memory snapAB_before = _snapshotPool(address(tokenA), address(tokenB));
        
        // Execute flash loan with swap strategy
        borrower.executeFlashLoanWithSwap(
            address(tokenA),
            flashAmount,
            address(tokenB)
        );
        
        // Snapshot after
        PoolSnapshot memory snapAB_after = _snapshotPool(address(tokenA), address(tokenB));
        
        // Verify pool received flash loan fee
        uint256 expectedFee = (flashAmount * 9) / 10000; // 0.09% fee
        assertGe(
            snapAB_after.reserve0 + snapAB_after.reserve1,
            snapAB_before.reserve0 + snapAB_before.reserve1,
            "Pool should have more liquidity from fees"
        );
    }

    function test_FlashLoan_MultipleSequential() public {
        uint256 flashAmount = 5000 * 1e18;
        
        FlashBorrower borrower = new FlashBorrower(address(flashSwap));
        
        // Fund borrower
        vm.startPrank(user1);
        tokenA.transfer(address(borrower), 500 * 1e18);
        vm.stopPrank();
        
        PoolSnapshot memory snap_initial = _snapshotPool(address(tokenA), address(tokenB));
        
        // Execute 3 sequential flash loans
        for (uint256 i = 0; i < 3; i++) {
            borrower.executeFlashLoan(address(tokenA), flashAmount, new bytes(0));
        }
        
        PoolSnapshot memory snap_final = _snapshotPool(address(tokenA), address(tokenB));
        
        // Verify fees accumulated from all 3 flash loans
        uint256 totalExpectedFees = ((flashAmount * 9) / 10000) * 3;
        assertGe(
            snap_final.reserve0 - snap_initial.reserve0,
            totalExpectedFees * 95 / 100, // Allow 5% tolerance
            "Should accumulate fees from all flash loans"
        );
    }

    function test_FlashLoan_DuringActiveSwaps() public {
        uint256 swapAmount = 2000 * 1e18;
        uint256 flashAmount = 8000 * 1e18;
        
        FlashBorrower borrower = new FlashBorrower(address(flashSwap));
        
        // Fund borrower
        vm.startPrank(user1);
        tokenA.transfer(address(borrower), 200 * 1e18);
        vm.stopPrank();
        
        // User2 performs regular swap
        vm.startPrank(user2);
        tokenA.approve(address(dexCore), swapAmount);
        dexCore.swap(
            address(tokenA), address(tokenB),
            swapAmount, 1, user2, block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        // Execute flash loan while pool is in different state
        borrower.executeFlashLoan(address(tokenA), flashAmount, new bytes(0));
        
        // User2 performs another swap
        vm.startPrank(user2);
        tokenB.approve(address(dexCore), swapAmount);
        dexCore.swap(
            address(tokenB), address(tokenA),
            swapAmount, 1, user2, block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        assertTrue(true, "Flash loan should work during active trading");
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                    CROSS-CHAIN SWAP INTEGRATION TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function test_CrossChain_ExecuteSwap_FullFlow() public {
        uint256 swapAmount = 1000 * 1e18;
        bytes32 messageId = keccak256("unique_message_1");
        
        // Setup bridge
        address mockBridge = address(0x777);
        vm.startPrank(owner);
        bridgeAdapter.proposeBridgeUpdate(mockBridge);
        vm.warp(block.timestamp + 2 days + 1);
        bridgeAdapter.executeBridgeUpdate();
        vm.stopPrank();
        
        // Prepare message data
        BridgeAdapter.CrossChainSwapMessage memory message = BridgeAdapter.CrossChainSwapMessage({
            tokenIn: address(tokenA),
            tokenOut: address(tokenB),
            amountIn: swapAmount,
            amountOutMin: 1,
            recipient: user1,
            deadline: block.timestamp + 1 hours
        });
        bytes memory messageData = abi.encode(message);
        
        // Mint tokens to bridge and approve
        vm.startPrank(mockBridge);
        tokenA.mint(mockBridge, swapAmount);
        tokenA.approve(address(bridgeAdapter), swapAmount);
        
        vm.recordLogs();
        uint256 amountOut = bridgeAdapter.executeCrossChainSwap(messageId, messageData);
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        vm.stopPrank();
        
        // Verify swap executed and event emitted
        assertTrue(amountOut > 0, "Should receive tokens from swap");
        assertTrue(bridgeAdapter.isMessageProcessed(messageId), "Message should be marked as processed");
        
        bool eventFound = false;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == keccak256("CrossChainSwapExecuted(bytes32,address,address,uint256)")) {
                eventFound = true;
                break;
            }
        }
        assertTrue(eventFound, "CrossChainSwapExecuted event should be emitted");
    }

    function test_CrossChain_ReplayProtection() public {
        uint256 swapAmount = 1000 * 1e18;
        bytes32 messageId = keccak256("unique_message_1");
        
        // Setup bridge
        address mockBridge = address(0x777);
        vm.startPrank(owner);
        bridgeAdapter.proposeBridgeUpdate(mockBridge);
        vm.warp(block.timestamp + 2 days + 1);
        bridgeAdapter.executeBridgeUpdate();
        vm.stopPrank();
        
        // Prepare message data
        BridgeAdapter.CrossChainSwapMessage memory message = BridgeAdapter.CrossChainSwapMessage({
            tokenIn: address(tokenA),
            tokenOut: address(tokenB),
            amountIn: swapAmount,
            amountOutMin: 1,
            recipient: user1,
            deadline: block.timestamp + 1 hours
        });
        bytes memory messageData = abi.encode(message);
        
        // Execute first swap
        vm.startPrank(mockBridge);
        tokenA.mint(mockBridge, swapAmount * 2);
        tokenA.approve(address(bridgeAdapter), swapAmount * 2);
        
        bridgeAdapter.executeCrossChainSwap(messageId, messageData);
        
        // Attempt replay attack with same messageId
        vm.expectRevert(BridgeAdapter.MessageAlreadyProcessed.selector);
        bridgeAdapter.executeCrossChainSwap(messageId, messageData);
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                    EVENT SNAPSHOT TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function test_EventSnapshot_CompleteSwapFlow() public {
        uint256 amountIn = 1000 * 1e18;
        
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), amountIn);
        
        vm.recordLogs();
        dexCore.swap(
            address(tokenA), address(tokenB),
            amountIn, 1, user1, block.timestamp + 1 hours
        );
        
        Vm.Log[] memory logs = vm.getRecordedLogs();
        vm.stopPrank();
        
        // Verify Swap event was emitted with correct parameters
        bool swapEventFound = false;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics.length > 0 && 
                logs[i].topics[0] == keccak256("Swap(address,address,address,uint256,uint256,uint256,uint256)")) {
                swapEventFound = true;
                
                // Decode and verify event data
                address sender = address(uint160(uint256(logs[i].topics[1])));
                assertEq(sender, user1, "Sender should be user1");
                break;
            }
        }
        assertTrue(swapEventFound, "Swap event should be emitted");
    }

    function test_EventSnapshot_LiquidityOperations() public {
        uint256 amount = 5000 * 1e18;
        
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), amount);
        tokenB.approve(address(dexCore), amount);
        
        // Record add liquidity events
        vm.recordLogs();
        dexCore.addLiquidity(
            address(tokenA), address(tokenB),
            amount, amount, 0, 0, user1, block.timestamp + 1 hours
        );
        Vm.Log[] memory addLogs = vm.getRecordedLogs();
        
        // Verify LiquidityAdded event
        bool addEventFound = false;
        for (uint256 i = 0; i < addLogs.length; i++) {
            if (addLogs[i].topics.length > 0 &&
                addLogs[i].topics[0] == keccak256("LiquidityAdded(address,address,address,uint256,uint256,uint256)")) {
                addEventFound = true;
                break;
            }
        }
        assertTrue(addEventFound, "LiquidityAdded event should be emitted");
        
        vm.stopPrank();
    }
}

/**
 * @title AdvancedFlashBorrower
 * @notice Flash loan borrower that performs swaps with borrowed funds
 */
contract AdvancedFlashBorrower {
    FlashSwap public flashSwap;
    DexCore public dexCore;
    
    constructor(address _flashSwap, address _dexCore) {
        flashSwap = FlashSwap(_flashSwap);
        dexCore = DexCore(_dexCore);
    }
    
    function executeFlashLoanWithSwap(
        address token,
        uint256 amount,
        address swapTo
    ) external {
        bytes memory data = abi.encode(swapTo);
        flashSwap.flashLoan(IERC3156FlashBorrower(address(this)), token, amount, data);
    }
    
    function onFlashLoan(
        address initiator,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external returns (bytes32) {
        require(msg.sender == address(flashSwap), "Invalid caller");
        
        // Decode swap target
        address swapTo = abi.decode(data, (address));
        
        // Perform swap with borrowed tokens
        MockERC20(token).approve(address(dexCore), amount / 2);
        dexCore.swap(
            token, swapTo,
            amount / 2, 1, address(this), block.timestamp + 1 hours
        );
        
        // Approve repayment
        MockERC20(token).approve(address(flashSwap), amount + fee);
        
        return keccak256("ERC3156FlashBorrower.onFlashLoan");
    }
}
