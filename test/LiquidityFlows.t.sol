// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MinimalForwarder.sol";
import "../src/DexCore.sol";
import "../src/DEXFactory.sol";
import "../src/MockERC20.sol";

/**
 * @title LiquidityFlowsTest
 * @notice Comprehensive tests for liquidity management flows including edge cases
 */
contract LiquidityFlowsTest is Test {
    DexCore public dexCore;
    DEXFactory public factory;
    MockERC20 public weth;
    MinimalForwarder public forwarder;
    MockERC20 public tokenA;
    MockERC20 public tokenB;
    
    address public alice;
    address public bob;
    address public charlie;
    
    uint256 constant INITIAL_SUPPLY = 1_000_000 ether;
    
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
    
    function setUp() public {
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        charlie = makeAddr("charlie");
        
        // Deploy tokens
        weth = new MockERC20("Wrapped ETH", "WETH", 18);
        forwarder = new MinimalForwarder();
        tokenA = new MockERC20("Token A", "TKA", 18);
        tokenB = new MockERC20("Token B", "TKB", 18);
        
        // Deploy factory and core
        factory = new DEXFactory(address(this));
        dexCore = new DexCore(address(factory), address(weth), address(forwarder));
        
        // Mint tokens to users
        tokenA.mint(alice, INITIAL_SUPPLY);
        tokenB.mint(alice, INITIAL_SUPPLY);
        tokenA.mint(bob, INITIAL_SUPPLY);
        tokenB.mint(bob, INITIAL_SUPPLY);
        tokenA.mint(charlie, INITIAL_SUPPLY);
        tokenB.mint(charlie, INITIAL_SUPPLY);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          FIRST LIQUIDITY PROVISION TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_FirstLiquidityProvision() public {
        uint256 amountA = 100 ether;
        uint256 amountB = 200 ether;
        
        vm.startPrank(alice);
        tokenA.approve(address(dexCore), amountA);
        tokenB.approve(address(dexCore), amountB);
        
        // Create pool
        dexCore.createPool(address(tokenA), address(tokenB));
        
        // Add first liquidity
        (uint256 actualA, uint256 actualB, uint256 liquidity) = dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            amountA,
            amountB,
            amountA,
            amountB,
            alice,
            block.timestamp + 1
        );
        
        vm.stopPrank();
        
        // Verify amounts
        assertEq(actualA, amountA);
        assertEq(actualB, amountB);
        
        // Verify liquidity tokens minted (sqrt(100 * 200) = sqrt(20000) ≈ 141.42)
        assertGt(liquidity, 0);
        
        // Verify reserves
        (uint256 reserve0, uint256 reserve1, ) = dexCore.getReserves(address(tokenA), address(tokenB));
        assertEq(reserve0, amountA);
        assertEq(reserve1, amountB);
    }
    
    function test_FirstLiquidityWithMinimalAmounts() public {
        uint256 amountA = 1000; // Very small amount
        uint256 amountB = 2000;
        
        vm.startPrank(alice);
        tokenA.approve(address(dexCore), amountA);
        tokenB.approve(address(dexCore), amountB);
        
        dexCore.createPool(address(tokenA), address(tokenB));
        
        (uint256 actualA, uint256 actualB, uint256 liquidity) = dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            amountA,
            amountB,
            amountA,
            amountB,
            alice,
            block.timestamp + 1
        );
        
        vm.stopPrank();
        
        assertEq(actualA, amountA);
        assertEq(actualB, amountB);
        assertGt(liquidity, 0);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          MULTIPLE LP TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_MultipleLPsAddLiquidity() public {
        // Alice adds first liquidity
        vm.startPrank(alice);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        dexCore.createPool(address(tokenA), address(tokenB));
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            alice,
            block.timestamp + 1
        );
        vm.stopPrank();
        
        // Bob adds liquidity
        vm.startPrank(bob);
        tokenA.approve(address(dexCore), 50 ether);
        tokenB.approve(address(dexCore), 100 ether);
        
        (uint256 bobA, uint256 bobB, uint256 bobLiquidity) = dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            50 ether,
            100 ether,
            50 ether,
            100 ether,
            bob,
            block.timestamp + 1
        );
        vm.stopPrank();
        
        // Verify Bob's amounts match pool ratio
        assertEq(bobA, 50 ether);
        assertEq(bobB, 100 ether);
        assertGt(bobLiquidity, 0);
        
        // Charlie adds liquidity
        vm.startPrank(charlie);
        tokenA.approve(address(dexCore), 25 ether);
        tokenB.approve(address(dexCore), 50 ether);
        
        (uint256 charlieA, uint256 charlieB, uint256 charlieLiquidity) = dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            25 ether,
            50 ether,
            25 ether,
            50 ether,
            charlie,
            block.timestamp + 1
        );
        vm.stopPrank();
        
        assertEq(charlieA, 25 ether);
        assertEq(charlieB, 50 ether);
        assertGt(charlieLiquidity, 0);
        
        // Verify total reserves
        (uint256 reserve0, uint256 reserve1, ) = dexCore.getReserves(address(tokenA), address(tokenB));
        assertEq(reserve0, 175 ether); // 100 + 50 + 25
        assertEq(reserve1, 350 ether); // 200 + 100 + 50
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          REMOVE LIQUIDITY TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_RemovePartialLiquidity() public {
        // Alice adds liquidity
        vm.startPrank(alice);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        dexCore.createPool(address(tokenA), address(tokenB));
        
        (, , uint256 liquidity) = dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            alice,
            block.timestamp + 1
        );
        
        // Get LP token address
        address lpToken = dexCore.lpTokens(address(tokenA), address(tokenB));
        
        // Remove 50% of liquidity
        uint256 removeAmount = liquidity / 2;
        IERC20(lpToken).approve(address(dexCore), removeAmount);
        
        (uint256 amountA, uint256 amountB) = dexCore.removeLiquidity(
            address(tokenA),
            address(tokenB),
            removeAmount,
            0,
            0,
            alice,
            block.timestamp + 1
        );
        
        vm.stopPrank();
        
        // Should receive approximately 50% of deposited amounts
        assertApproxEqRel(amountA, 50 ether, 0.01e18); // 1% tolerance
        assertApproxEqRel(amountB, 100 ether, 0.01e18);
    }
    
    function test_RemoveAllLiquidity() public {
        // Alice adds liquidity
        vm.startPrank(alice);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        dexCore.createPool(address(tokenA), address(tokenB));
        
        (, , uint256 liquidity) = dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            alice,
            block.timestamp + 1
        );
        
        address lpToken = dexCore.lpTokens(address(tokenA), address(tokenB));
        IERC20(lpToken).approve(address(dexCore), liquidity);
        
        uint256 balanceABefore = tokenA.balanceOf(alice);
        uint256 balanceBBefore = tokenB.balanceOf(alice);
        
        (uint256 amountA, uint256 amountB) = dexCore.removeLiquidity(
            address(tokenA),
            address(tokenB),
            liquidity,
            0,
            0,
            alice,
            block.timestamp + 1
        );
        
        vm.stopPrank();
        
        // Should receive all deposited amounts back
        assertEq(tokenA.balanceOf(alice) - balanceABefore, amountA);
        assertEq(tokenB.balanceOf(alice) - balanceBBefore, amountB);
        
        // LP balance should be 0
        assertEq(IERC20(lpToken).balanceOf(alice), 0);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          EDGE CASE TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function testFail_AddZeroLiquidity() public {
        vm.startPrank(alice);
        dexCore.createPool(address(tokenA), address(tokenB));
        
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            0,
            0,
            0,
            0,
            alice,
            block.timestamp + 1
        );
        vm.stopPrank();
    }
    
    function test_DustPositionHandling() public {
        // Add very small liquidity
        uint256 dustAmount = 100; // 100 wei
        
        vm.startPrank(alice);
        tokenA.approve(address(dexCore), dustAmount);
        tokenB.approve(address(dexCore), dustAmount);
        dexCore.createPool(address(tokenA), address(tokenB));
        
        (uint256 actualA, uint256 actualB, uint256 liquidity) = dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            dustAmount,
            dustAmount,
            dustAmount,
            dustAmount,
            alice,
            block.timestamp + 1
        );
        
        vm.stopPrank();
        
        assertEq(actualA, dustAmount);
        assertEq(actualB, dustAmount);
        assertGt(liquidity, 0);
    }
    
    function test_AsymmetricalLiquidity() public {
        // First LP adds balanced liquidity
        vm.startPrank(alice);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        dexCore.createPool(address(tokenA), address(tokenB));
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            alice,
            block.timestamp + 1
        );
        vm.stopPrank();
        
        // Bob tries to add asymmetrical liquidity (more A than ratio)
        vm.startPrank(bob);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 100 ether);
        
        (uint256 bobA, uint256 bobB, uint256 bobLiquidity) = dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            100 ether,
            0, // Accept any amount
            0,
            bob,
            block.timestamp + 1
        );
        
        vm.stopPrank();
        
        // Should only use amounts that match pool ratio (1:2)
        // Bob provides 100A and 100B, but pool ratio is 1:2
        // So it should use 50A and 100B
        assertEq(bobA, 50 ether);
        assertEq(bobB, 100 ether);
        assertGt(bobLiquidity, 0);
    }
    
    function test_LiquidityAfterSwaps() public {
        // Alice adds initial liquidity
        vm.startPrank(alice);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        dexCore.createPool(address(tokenA), address(tokenB));
        dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            alice,
            block.timestamp + 1
        );
        vm.stopPrank();
        
        // Bob performs a swap
        vm.startPrank(bob);
        tokenA.approve(address(dexCore), 10 ether);
        dexCore.swap(
            address(tokenA),
            address(tokenB),
            10 ether,
            0,
            bob,
            block.timestamp + 1
        );
        vm.stopPrank();
        
        // Charlie adds liquidity after swap (pool ratio changed)
        vm.startPrank(charlie);
        tokenA.approve(address(dexCore), 50 ether);
        tokenB.approve(address(dexCore), 100 ether);
        
        (uint256 charlieA, uint256 charlieB, uint256 charlieLiquidity) = dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            50 ether,
            100 ether,
            0,
            0,
            charlie,
            block.timestamp + 1
        );
        
        vm.stopPrank();
        
        // Verify liquidity was added successfully
        assertGt(charlieA, 0);
        assertGt(charlieB, 0);
        assertGt(charlieLiquidity, 0);
    }
    
    function test_RemoveLiquidityWithSlippage() public {
        // Alice adds liquidity
        vm.startPrank(alice);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        dexCore.createPool(address(tokenA), address(tokenB));
        
        (, , uint256 liquidity) = dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            alice,
            block.timestamp + 1
        );
        
        address lpToken = dexCore.lpTokens(address(tokenA), address(tokenB));
        IERC20(lpToken).approve(address(dexCore), liquidity);
        
        // Remove with slippage protection (expect at least 95% of amounts)
        (uint256 amountA, uint256 amountB) = dexCore.removeLiquidity(
            address(tokenA),
            address(tokenB),
            liquidity,
            95 ether, // Min 95% of 100
            190 ether, // Min 95% of 200
            alice,
            block.timestamp + 1
        );
        
        vm.stopPrank();
        
        assertGe(amountA, 95 ether);
        assertGe(amountB, 190 ether);
    }
    
    function testFail_RemoveLiquiditySlippageTooHigh() public {
        // Alice adds liquidity
        vm.startPrank(alice);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        dexCore.createPool(address(tokenA), address(tokenB));
        
        (, , uint256 liquidity) = dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            alice,
            block.timestamp + 1
        );
        
        address lpToken = dexCore.lpTokens(address(tokenA), address(tokenB));
        IERC20(lpToken).approve(address(dexCore), liquidity);
        
        // Try to remove with unrealistic minimum amounts (should fail)
        dexCore.removeLiquidity(
            address(tokenA),
            address(tokenB),
            liquidity,
            150 ether, // Expecting more than deposited
            300 ether,
            alice,
            block.timestamp + 1
        );
        
        vm.stopPrank();
    }
    
    function test_PoolShareCalculation() public {
        // Alice adds 100 ether of each
        vm.startPrank(alice);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        dexCore.createPool(address(tokenA), address(tokenB));
        
        (, , uint256 aliceLiquidity) = dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            alice,
            block.timestamp + 1
        );
        vm.stopPrank();
        
        // Bob adds same amount
        vm.startPrank(bob);
        tokenA.approve(address(dexCore), 100 ether);
        tokenB.approve(address(dexCore), 200 ether);
        
        (, , uint256 bobLiquidity) = dexCore.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            200 ether,
            100 ether,
            200 ether,
            bob,
            block.timestamp + 1
        );
        vm.stopPrank();
        
        // Both should have equal liquidity tokens (50% share each)
        assertEq(aliceLiquidity, bobLiquidity);
        
        // Get total supply
        address lpToken = dexCore.lpTokens(address(tokenA), address(tokenB));
        uint256 totalSupply = IERC20(lpToken).totalSupply();
        
        // Each should have 50% of total supply
        assertApproxEqRel(aliceLiquidity * 2, totalSupply, 0.01e18);
    }
}
