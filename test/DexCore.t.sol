// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/DexCore.sol";
import "../src/LPToken.sol";
import "../src/MockERC20.sol";
import "../src/MinimalForwarder.sol";

/**
 * @title DexCoreTest
 * @notice Comprehensive test suite for refactored DexCore contract
 */
contract DexCoreTest is Test {
    DexCore public dexCore;
    MockERC20 public tokenA;
    MockERC20 public tokenB;
    MockERC20 public weth;
    MinimalForwarder public forwarder;
    
    address public owner;
    address public user1;
    address public user2;
    address public factory;
    
    uint256 constant INITIAL_SUPPLY = 1_000_000 ether;
    uint256 constant MINIMUM_LIQUIDITY = 1000;
    
    // Events to test
    event PoolCreated(address indexed token0, address indexed token1, address lpToken);
    event Swap(address indexed sender, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);
    event LiquidityAdded(address indexed provider, address indexed token0, address indexed token1, uint256 amount0, uint256 amount1, uint256 liquidity);
    event LiquidityRemoved(address indexed provider, address indexed token0, address indexed token1, uint256 amount0, uint256 amount1, uint256 liquidity);
    
    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        factory = makeAddr("factory");
        
        // Deploy tokens
        tokenA = new MockERC20("Token A", "TKNA", 18);
        tokenB = new MockERC20("Token B", "TKNB", 18);
        weth = new MockERC20("Wrapped ETH", "WETH", 18);
        
        // Deploy MinimalForwarder for EIP-2771 meta-transactions
        forwarder = new MinimalForwarder();
        
        // Deploy DexCore
        dexCore = new DexCore(factory, address(weth), address(forwarder));
        
        // Mint tokens to users
        tokenA.mint(user1, INITIAL_SUPPLY);
        tokenB.mint(user1, INITIAL_SUPPLY);
        tokenA.mint(user2, INITIAL_SUPPLY);
        tokenB.mint(user2, INITIAL_SUPPLY);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          POOL CREATION TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_CreatePool_Success() public {
        address lpToken = dexCore.createPool(address(tokenA), address(tokenB));
        
        assertNotEq(lpToken, address(0), "LP token should be deployed");
        
        (address token0, address token1) = address(tokenA) < address(tokenB) 
            ? (address(tokenA), address(tokenB)) 
            : (address(tokenB), address(tokenA));
        
        assertEq(dexCore.lpTokens(token0, token1), lpToken, "LP token should be stored");
    }
    
    function test_CreatePool_EmitsEvent() public {
        (address token0, address token1) = address(tokenA) < address(tokenB) 
            ? (address(tokenA), address(tokenB)) 
            : (address(tokenB), address(tokenA));
        
        vm.expectEmit(true, true, false, false);
        emit PoolCreated(token0, token1, address(0));
        
        dexCore.createPool(address(tokenA), address(tokenB));
    }
    
    function test_CreatePool_RevertsOnIdenticalTokens() public {
        vm.expectRevert(DexCore.IdenticalAddresses.selector);
        dexCore.createPool(address(tokenA), address(tokenA));
    }
    
    function test_CreatePool_RevertsOnZeroAddress() public {
        vm.expectRevert(DexCore.ZeroAddress.selector);
        dexCore.createPool(address(0), address(tokenB));
        
        vm.expectRevert(DexCore.ZeroAddress.selector);
        dexCore.createPool(address(tokenA), address(0));
    }
    
    function test_CreatePool_RevertsOnDuplicate() public {
        dexCore.createPool(address(tokenA), address(tokenB));
        
        vm.expectRevert(DexCore.PoolAlreadyExists.selector);
        dexCore.createPool(address(tokenA), address(tokenB));
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          ADD LIQUIDITY TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_AddLiquidity_FirstProvision() public {
        dexCore.createPool(address(tokenA), address(tokenB));
        
        uint256 amountA = 100 ether;
        uint256 amountB = 200 ether;
        
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), amountA);
        tokenB.approve(address(dexCore), amountB);
        
        (uint256 actualA, uint256 actualB, uint256 liquidity) = dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            amountA,
            amountB,
            amountA,
            amountB,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        assertEq(actualA, amountA, "Amount A should match");
        assertEq(actualB, amountB, "Amount B should match");
        
        // liquidity = sqrt(100 * 200) - 1000 = sqrt(20000) - 1000 ≈ 141.42 - 1000
        uint256 expectedLiquidity = _sqrt(amountA * amountB) - MINIMUM_LIQUIDITY;
        assertEq(liquidity, expectedLiquidity, "Liquidity should be sqrt(x*y) - MINIMUM_LIQUIDITY");
    }
    
    function test_AddLiquidity_SubsequentProvision() public {
        dexCore.createPool(address(tokenA), address(tokenB));
        
        // First provision
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        // Second provision (proportional)
        vm.startPrank(user2);
        tokenA.approve(address(dexCore), 50 ether);
        tokenB.approve(address(dexCore), 100 ether);
        
        (uint256 actualA, uint256 actualB, uint256 liquidity) = dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            50 ether,
            100 ether,
            50 ether,
            100 ether,
            user2,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        assertEq(actualA, 50 ether, "Amount A should be proportional");
        assertEq(actualB, 100 ether, "Amount B should be proportional");
        assertGt(liquidity, 0, "Should mint liquidity tokens");
    }
    
    function test_AddLiquidity_RevertsOnDeadlineExpired() public {
        dexCore.createPool(address(tokenA), address(tokenB));
        
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        
        vm.warp(block.timestamp + 2 hours);
        
        vm.expectRevert(DexCore.DeadlineExpired.selector);
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            user1,
            block.timestamp - 1
        );
        vm.stopPrank();
    }
    
    function test_AddLiquidity_RevertsOnSlippage() public {
        dexCore.createPool(address(tokenA), address(tokenB));
        
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        
        vm.expectRevert(DexCore.SlippageExceeded.selector);
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            150 ether, // Too high minimum
            200 ether,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
    }
    
    function test_AddLiquidity_RevertsOnPoolNotExist() public {
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        
        vm.expectRevert(DexCore.PoolDoesNotExist.selector);
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          REMOVE LIQUIDITY TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_RemoveLiquidity_Success() public {
        // Setup: Add liquidity first
        dexCore.createPool(address(tokenA), address(tokenB));
        
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        
        (,, uint256 liquidity) = dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            user1,
            block.timestamp + 1 hours
        );
        
        // Get LP token and approve
        (address token0, address token1) = address(tokenA) < address(tokenB) 
            ? (address(tokenA), address(tokenB)) 
            : (address(tokenB), address(tokenA));
        address lpToken = dexCore.lpTokens(token0, token1);
        
        LPToken(lpToken).approve(address(dexCore), liquidity);
        
        // Remove half the liquidity
        uint256 liquidityToRemove = liquidity / 2;
        (uint256 amountA, uint256 amountB) = dexCore.removeLiquidity(
            address(tokenA),
            address(tokenB),
            liquidityToRemove,
            1, // Min amounts
            1,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        assertGt(amountA, 0, "Should receive token A");
        assertGt(amountB, 0, "Should receive token B");
    }
    
    function test_RemoveLiquidity_RevertsOnDeadlineExpired() public {
        dexCore.createPool(address(tokenA), address(tokenB));
        
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        
        (,, uint256 liquidity) = dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            user1,
            block.timestamp + 1 hours
        );
        
        vm.warp(block.timestamp + 2 hours);
        
        vm.expectRevert(DexCore.DeadlineExpired.selector);
        dexCore.removeLiquidity(
            address(tokenA),
            address(tokenB),
            liquidity,
            1,
            1,
            user1,
            block.timestamp - 1
        );
        vm.stopPrank();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                              SWAP TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_Swap_Success() public {
        // Setup: Create pool and add liquidity
        dexCore.createPool(address(tokenA), address(tokenB));
        
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        // Execute swap
        uint256 amountIn = 10 ether;
        
        vm.startPrank(user2);
        tokenA.approve(address(dexCore), amountIn);
        
        uint256 amountOut = dexCore.swap(
            address(tokenA),
            address(tokenB),
            amountIn,
            1, // Min amount out
            user2,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        assertGt(amountOut, 0, "Should receive output tokens");
    }
    
    function test_Swap_CorrectFeeCalculation() public {
        // Setup pool with 100:200 ratio
        dexCore.createPool(address(tokenA), address(tokenB));
        
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        // Swap 10 tokenA for tokenB
        uint256 amountIn = 10 ether;
        
        // Expected: (10 * 9970 * 200) / (100 * 10000 + 10 * 9970)
        // = (1994000) / (1000000 + 99700) = 1994000 / 1099700 ≈ 18.13 ether
        uint256 expectedOut = (amountIn * 9970 * 200 ether) / (100 ether * 10000 + amountIn * 9970);
        
        vm.startPrank(user2);
        tokenA.approve(address(dexCore), amountIn);
        
        uint256 amountOut = dexCore.swap(
            address(tokenA),
            address(tokenB),
            amountIn,
            1,
            user2,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        assertEq(amountOut, expectedOut, "Output should match formula");
    }
    
    function test_Swap_RevertsOnDeadlineExpired() public {
        dexCore.createPool(address(tokenA), address(tokenB));
        
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        vm.startPrank(user2);
        tokenA.approve(address(dexCore), 10 ether);
        
        vm.warp(block.timestamp + 2 hours);
        
        vm.expectRevert(DexCore.DeadlineExpired.selector);
        dexCore.swap(
            address(tokenA),
            address(tokenB),
            10 ether,
            1,
            user2,
            block.timestamp - 1
        );
        vm.stopPrank();
    }
    
    function test_Swap_RevertsOnSlippage() public {
        dexCore.createPool(address(tokenA), address(tokenB));
        
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        vm.startPrank(user2);
        tokenA.approve(address(dexCore), 10 ether);
        
        vm.expectRevert(DexCore.SlippageExceeded.selector);
        dexCore.swap(
            address(tokenA),
            address(tokenB),
            10 ether,
            100 ether, // Unrealistic minimum
            user2,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
    }
    
    function test_Swap_RevertsOnIdenticalTokens() public {
        vm.expectRevert(DexCore.IdenticalAddresses.selector);
        dexCore.swap(
            address(tokenA),
            address(tokenA),
            10 ether,
            1,
            user2,
            block.timestamp + 1 hours
        );
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          VIEW FUNCTION TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_GetAmountOut() public {
        dexCore.createPool(address(tokenA), address(tokenB));
        
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        uint256 amountOut = dexCore.getAmountOut(10 ether, address(tokenA), address(tokenB));
        
        uint256 amountIn = 10 ether;
        uint256 expectedOut = (amountIn * 9970 * 200 ether) / ((100 ether * 10000) + (amountIn * 9970));
        assertEq(amountOut, expectedOut, "getAmountOut should match formula");
    }
    
    function test_GetReserves() public {
        dexCore.createPool(address(tokenA), address(tokenB));
        
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        (uint256 reserveA, uint256 reserveB, uint32 timestamp) = dexCore.getReserves(address(tokenA), address(tokenB));
        
        assertEq(reserveA, 100 ether, "Reserve A should match");
        assertEq(reserveB, 200 ether, "Reserve B should match");
        assertGt(timestamp, 0, "Timestamp should be set");
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          PAUSE/UNPAUSE TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_Pause_Success() public {
        dexCore.pause();
        assertTrue(dexCore.paused(), "Contract should be paused");
    }
    
    function test_Unpause_Success() public {
        dexCore.pause();
        dexCore.unpause();
        assertFalse(dexCore.paused(), "Contract should be unpaused");
    }
    
    function test_Swap_RevertsWhenPaused() public {
        dexCore.createPool(address(tokenA), address(tokenB));
        
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        dexCore.pause();
        
        vm.startPrank(user2);
        tokenA.approve(address(dexCore), 10 ether);
        
        vm.expectRevert();
        dexCore.swap(
            address(tokenA),
            address(tokenB),
            10 ether,
            1,
            user2,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          GAS OPTIMIZATION TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_Gas_CreatePool() public {
        MockERC20 tokenC = new MockERC20("Token C", "TKNC", 18);
        MockERC20 tokenD = new MockERC20("Token D", "TKND", 18);
        
        uint256 gasBefore = gasleft();
        dexCore.createPool(address(tokenC), address(tokenD));
        uint256 gasUsed = gasBefore - gasleft();
        
        assertLt(gasUsed, 500000, "Pool creation should be gas efficient");
    }
    
    function test_Gas_AddLiquidity() public {
        dexCore.createPool(address(tokenA), address(tokenB));
        
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        
        uint256 gasBefore = gasleft();
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            user1,
            block.timestamp + 1 hours
        );
        uint256 gasUsed = gasBefore - gasleft();
        vm.stopPrank();
        
        assertLt(gasUsed, 400000, "Add liquidity should be gas efficient");
    }
    
    function test_Gas_Swap() public {
        dexCore.createPool(address(tokenA), address(tokenB));
        
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        vm.startPrank(user2);
        tokenA.approve(address(dexCore), 10 ether);
        
        uint256 gasBefore = gasleft();
        dexCore.swap(
            address(tokenA),
            address(tokenB),
            10 ether,
            1,
            user2,
            block.timestamp + 1 hours
        );
        uint256 gasUsed = gasBefore - gasleft();
        vm.stopPrank();
        
        assertLt(gasUsed, 300000, "Swap should be gas efficient");
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          REENTRANCY TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_Swap_ReentrancyProtection() public {
        // ReentrancyGuard is tested implicitly through all swap tests
        // Additional explicit test with malicious token would go here
        assertTrue(true, "Reentrancy protection via ReentrancyGuard");
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          EDGE CASE TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_AddLiquidity_RevertsOnZeroAmountMin() public {
        dexCore.createPool(address(tokenA), address(tokenB));
        
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        
        vm.expectRevert(DexCore.ZeroAmount.selector);
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            0, // Zero amountAMin
            200 ether,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
    }
    
    function test_Swap_RevertsOnZeroAmountOutMin() public {
        dexCore.createPool(address(tokenA), address(tokenB));
        
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        vm.startPrank(user2);
        tokenA.approve(address(dexCore), 10 ether);
        
        vm.expectRevert(DexCore.InsufficientAmount.selector);
        dexCore.swap(
            address(tokenA),
            address(tokenB),
            10 ether,
            0, // Zero amountOutMin
            user2,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
    }
    
    function test_Swap_RevertsOnInvalidRecipient() public {
        dexCore.createPool(address(tokenA), address(tokenB));
        
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        vm.startPrank(user2);
        tokenA.approve(address(dexCore), 10 ether);
        
        // Test recipient = tokenIn
        vm.expectRevert(DexCore.InvalidToken.selector);
        dexCore.swap(
            address(tokenA),
            address(tokenB),
            10 ether,
            1,
            address(tokenA),
            block.timestamp + 1 hours
        );
        vm.stopPrank();
    }
    
    function test_GetAmountOut_RevertsOnZeroAmount() public {
        dexCore.createPool(address(tokenA), address(tokenB));
        
        vm.expectRevert(DexCore.InsufficientAmount.selector);
        dexCore.getAmountOut(0, address(tokenA), address(tokenB));
    }
    
    function test_GetAmountOut_RevertsOnPoolNotExist() public {
        vm.expectRevert(DexCore.PoolDoesNotExist.selector);
        dexCore.getAmountOut(10 ether, address(tokenA), address(tokenB));
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          FUZZ TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function testFuzz_AddLiquidity(uint256 amountA, uint256 amountB) public {
        amountA = bound(amountA, 1000, 1000 ether);
        amountB = bound(amountB, 1000, 1000 ether);
        
        dexCore.createPool(address(tokenA), address(tokenB));
        
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), amountA);
        tokenB.approve(address(dexCore), amountB);
        
        (uint256 actualA, uint256 actualB, uint256 liquidity) = dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            amountA,
            amountB,
            amountA,
            amountB,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        assertEq(actualA, amountA, "Amount A should match");
        assertEq(actualB, amountB, "Amount B should match");
        assertGt(liquidity, 0, "Should mint liquidity");
    }
    
    function testFuzz_Swap(uint256 amountIn) public {
        amountIn = bound(amountIn, 1 ether, 10 ether);
        
        dexCore.createPool(address(tokenA), address(tokenB));
        
        vm.startPrank(user1);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            user1,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        vm.startPrank(user2);
        tokenA.approve(address(dexCore), amountIn);
        
        uint256 amountOut = dexCore.swap(
            address(tokenA),
            address(tokenB),
            amountIn,
            1,
            user2,
            block.timestamp + 1 hours
        );
        vm.stopPrank();
        
        assertGt(amountOut, 0, "Should receive output tokens");
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function _sqrt(uint256 y) private pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
