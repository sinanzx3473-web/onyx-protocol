// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MinimalForwarder.sol";
import "../src/DEXRouter.sol";
import "../src/DEXFactory.sol";
import "../src/DEXPair.sol";
import "../src/MockERC20.sol";

contract DEXRouterTest is Test {
    DEXFactory factory;
    DEXRouter router;
    MockERC20 tokenA;
    MockERC20 tokenB;
    MockERC20 tokenC;
    MockERC20 weth;
    MinimalForwarder public forwarder;
    
    address owner;
    address user1;
    address user2;

    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");

        // Deploy contracts
        factory = new DEXFactory(owner);
        weth = new MockERC20("Wrapped ETH", "WETH", 18);
        forwarder = new MinimalForwarder();
        router = new DEXRouter(address(factory), address(weth), address(forwarder));
        
        // Set router in factory
        factory.setRouter(address(router));

        // Deploy tokens
        tokenA = new MockERC20("Token A", "TKA", 18);
        tokenB = new MockERC20("Token B", "TKB", 18);
        tokenC = new MockERC20("Token C", "TKC", 18);

        // Mint tokens
        tokenA.mint(user1, 1000 ether);
        tokenB.mint(user1, 1000 ether);
        tokenC.mint(user1, 1000 ether);
        tokenA.mint(user2, 1000 ether);
        tokenB.mint(user2, 1000 ether);

        // Fund with ETH
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
    }

    // ============ Happy Path Tests ============

    function testAddLiquidityNewPair() public {
        uint256 amountA = 10 ether;
        uint256 amountB = 10 ether;

        vm.startPrank(user1);
        tokenA.approve(address(router), amountA);
        tokenB.approve(address(router), amountB);

        (uint256 actualA, uint256 actualB, uint256 liquidity) = router.addLiquidity(
            address(tokenA),
            address(tokenB),
            amountA,
            amountB,
            amountA,
            amountB,
            user1,
            block.timestamp + 1
        );
        vm.stopPrank();

        assertEq(actualA, amountA);
        assertEq(actualB, amountB);
        assertTrue(liquidity > 0);
        
        address pair = factory.getPair(address(tokenA), address(tokenB));
        assertTrue(pair != address(0));
    }

    function testAddLiquidityExistingPair() public {
        // First liquidity addition
        vm.startPrank(user1);
        tokenA.approve(address(router), 20 ether);
        tokenB.approve(address(router), 20 ether);
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            10 ether,
            10 ether,
            10 ether,
            10 ether,
            user1,
            block.timestamp + 1
        );

        // Second liquidity addition
        (uint256 actualA, uint256 actualB, uint256 liquidity) = router.addLiquidity(
            address(tokenA),
            address(tokenB),
            5 ether,
            5 ether,
            4 ether,
            4 ether,
            user1,
            block.timestamp + 1
        );
        vm.stopPrank();

        assertEq(actualA, 5 ether);
        assertEq(actualB, 5 ether);
        assertTrue(liquidity > 0);
    }

    function testRemoveLiquidity() public {
        // Add liquidity
        vm.startPrank(user1);
        tokenA.approve(address(router), 10 ether);
        tokenB.approve(address(router), 10 ether);
        (,, uint256 liquidity) = router.addLiquidity(
            address(tokenA),
            address(tokenB),
            10 ether,
            10 ether,
            10 ether,
            10 ether,
            user1,
            block.timestamp + 1
        );

        // Remove liquidity
        address pair = factory.getPair(address(tokenA), address(tokenB));
        DEXPair(pair).approve(address(router), liquidity);
        
        (uint256 amountA, uint256 amountB) = router.removeLiquidity(
            address(tokenA),
            address(tokenB),
            liquidity,
            9 ether,
            9 ether,
            user1,
            block.timestamp + 1
        );
        vm.stopPrank();

        assertTrue(amountA >= 9 ether);
        assertTrue(amountB >= 9 ether);
    }

    function testSwapExactTokensForTokens() public {
        // Add liquidity
        vm.startPrank(user1);
        tokenA.approve(address(router), 100 ether);
        tokenB.approve(address(router), 100 ether);
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            100 ether,
            100 ether,
            100 ether,
            user1,
            block.timestamp + 1
        );
        vm.stopPrank();

        // Swap
        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        vm.startPrank(user2);
        tokenA.approve(address(router), 1 ether);
        
        uint256 balanceBefore = tokenB.balanceOf(user2);
        uint256[] memory amounts = router.swapExactTokensForTokens(
            1 ether,
            0.9 ether,
            path,
            user2,
            block.timestamp + 1
        );
        uint256 balanceAfter = tokenB.balanceOf(user2);
        vm.stopPrank();

        assertEq(amounts[0], 1 ether);
        assertTrue(amounts[1] > 0.9 ether);
        assertEq(balanceAfter - balanceBefore, amounts[1]);
    }

    function testSwapTokensForExactTokens() public {
        // Add liquidity
        vm.startPrank(user1);
        tokenA.approve(address(router), 100 ether);
        tokenB.approve(address(router), 100 ether);
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            100 ether,
            100 ether,
            100 ether,
            user1,
            block.timestamp + 1
        );
        vm.stopPrank();

        // Swap
        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        vm.startPrank(user2);
        tokenA.approve(address(router), 2 ether);
        
        uint256 balanceBefore = tokenB.balanceOf(user2);
        uint256[] memory amounts = router.swapTokensForExactTokens(
            1 ether,
            2 ether,
            path,
            user2,
            block.timestamp + 1
        );
        uint256 balanceAfter = tokenB.balanceOf(user2);
        vm.stopPrank();

        assertEq(amounts[1], 1 ether);
        assertTrue(amounts[0] < 2 ether);
        assertEq(balanceAfter - balanceBefore, 1 ether);
    }

    function testMultiHopSwap() public {
        // Add liquidity for A-B pair
        vm.startPrank(user1);
        tokenA.approve(address(router), 200 ether);
        tokenB.approve(address(router), 200 ether);
        tokenC.approve(address(router), 100 ether);
        
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            100 ether,
            100 ether,
            100 ether,
            user1,
            block.timestamp + 1
        );

        // Add liquidity for B-C pair
        router.addLiquidity(
            address(tokenB),
            address(tokenC),
            100 ether,
            100 ether,
            100 ether,
            100 ether,
            user1,
            block.timestamp + 1
        );
        vm.stopPrank();
        
        // Verify pairs were created
        address pairAB = factory.getPair(address(tokenA), address(tokenB));
        address pairBC = factory.getPair(address(tokenB), address(tokenC));
        assertTrue(pairAB != address(0), "A-B pair should exist");
        assertTrue(pairBC != address(0), "B-C pair should exist");

        // Multi-hop swap A -> B -> C
        address[] memory path = new address[](3);
        path[0] = address(tokenA);
        path[1] = address(tokenB);
        path[2] = address(tokenC);

        vm.startPrank(user2);
        tokenA.approve(address(router), 1 ether);
        
        uint256 balanceBefore = tokenC.balanceOf(user2);
        uint256[] memory amounts = router.swapExactTokensForTokens(
            1 ether,
            0.8 ether,
            path,
            user2,
            block.timestamp + 1
        );
        uint256 balanceAfter = tokenC.balanceOf(user2);
        vm.stopPrank();

        assertEq(amounts[0], 1 ether);
        assertTrue(amounts[2] > 0.8 ether);
        assertEq(balanceAfter - balanceBefore, amounts[2]);
    }

    function testGetAmountsOut() public {
        // Add liquidity
        vm.startPrank(user1);
        tokenA.approve(address(router), 100 ether);
        tokenB.approve(address(router), 100 ether);
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            100 ether,
            100 ether,
            100 ether,
            user1,
            block.timestamp + 1
        );
        vm.stopPrank();

        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        uint256[] memory amounts = router.getAmountsOut(1 ether, path);
        
        assertEq(amounts[0], 1 ether);
        assertTrue(amounts[1] > 0.98 ether);
    }

    function testGetAmountsIn() public {
        // Add liquidity
        vm.startPrank(user1);
        tokenA.approve(address(router), 100 ether);
        tokenB.approve(address(router), 100 ether);
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            100 ether,
            100 ether,
            100 ether,
            user1,
            block.timestamp + 1
        );
        vm.stopPrank();

        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        uint256[] memory amounts = router.getAmountsIn(1 ether, path);
        
        assertEq(amounts[1], 1 ether);
        assertTrue(amounts[0] > 1 ether);
    }

    // ============ Edge Case Tests ============

    function testAddLiquidityWithImbalancedRatio() public {
        // Add initial liquidity
        vm.startPrank(user1);
        tokenA.approve(address(router), 100 ether);
        tokenB.approve(address(router), 100 ether);
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            10 ether,
            10 ether,
            10 ether,
            10 ether,
            user1,
            block.timestamp + 1
        );

        // Try to add imbalanced liquidity
        (uint256 actualA, uint256 actualB,) = router.addLiquidity(
            address(tokenA),
            address(tokenB),
            10 ether,
            5 ether,
            5 ether,
            5 ether,
            user1,
            block.timestamp + 1
        );
        vm.stopPrank();

        // Should adjust to maintain ratio
        assertEq(actualA, 5 ether);
        assertEq(actualB, 5 ether);
    }

    function testSwapWithHighSlippage() public {
        // Add liquidity
        vm.startPrank(user1);
        tokenA.approve(address(router), 10 ether);
        tokenB.approve(address(router), 10 ether);
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            10 ether,
            10 ether,
            10 ether,
            10 ether,
            user1,
            block.timestamp + 1
        );
        vm.stopPrank();

        // Large swap causing high slippage
        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        vm.startPrank(user2);
        tokenA.approve(address(router), 5 ether);
        
        uint256[] memory amounts = router.swapExactTokensForTokens(
            5 ether,
            0,
            path,
            user2,
            block.timestamp + 1
        );
        vm.stopPrank();

        // Should get less than 5 ether due to slippage
        assertTrue(amounts[1] < 5 ether);
    }

    // ============ Revert Tests ============

    function testAddLiquidityExpired() public {
        vm.startPrank(user1);
        tokenA.approve(address(router), 10 ether);
        tokenB.approve(address(router), 10 ether);

        vm.expectRevert(DEXRouter.Expired.selector);
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            10 ether,
            10 ether,
            10 ether,
            10 ether,
            user1,
            block.timestamp - 1
        );
        vm.stopPrank();
    }

    function testAddLiquidityInsufficientAAmount() public {
        // Add initial liquidity
        vm.startPrank(user1);
        tokenA.approve(address(router), 100 ether);
        tokenB.approve(address(router), 100 ether);
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            10 ether,
            10 ether,
            10 ether,
            10 ether,
            user1,
            block.timestamp + 1
        );

        // Try to add liquidity with insufficient A (will adjust B down, so expect InsufficientBAmount)
        vm.expectRevert(DEXRouter.InsufficientBAmount.selector);
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            5 ether,
            10 ether,
            5 ether,
            11 ether,
            user1,
            block.timestamp + 1
        );
        vm.stopPrank();
    }

    function testAddLiquidityInsufficientBAmount() public {
        // Add initial liquidity
        vm.startPrank(user1);
        tokenA.approve(address(router), 100 ether);
        tokenB.approve(address(router), 100 ether);
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            10 ether,
            10 ether,
            10 ether,
            10 ether,
            user1,
            block.timestamp + 1
        );

        // Try to add liquidity with insufficient B (will adjust A down, so expect InsufficientAAmount)
        vm.expectRevert(DEXRouter.InsufficientAAmount.selector);
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            10 ether,
            5 ether,
            11 ether,
            5 ether,
            user1,
            block.timestamp + 1
        );
        vm.stopPrank();
    }

    function testRemoveLiquidityInsufficientAAmount() public {
        // Add liquidity
        vm.startPrank(user1);
        tokenA.approve(address(router), 10 ether);
        tokenB.approve(address(router), 10 ether);
        (,, uint256 liquidity) = router.addLiquidity(
            address(tokenA),
            address(tokenB),
            10 ether,
            10 ether,
            10 ether,
            10 ether,
            user1,
            block.timestamp + 1
        );

        address pair = factory.getPair(address(tokenA), address(tokenB));
        DEXPair(pair).approve(address(router), liquidity);

        vm.expectRevert(DEXRouter.InsufficientAAmount.selector);
        router.removeLiquidity(
            address(tokenA),
            address(tokenB),
            liquidity,
            100 ether,
            9 ether,
            user1,
            block.timestamp + 1
        );
        vm.stopPrank();
    }

    function testRemoveLiquidityInsufficientBAmount() public {
        // Add liquidity
        vm.startPrank(user1);
        tokenA.approve(address(router), 10 ether);
        tokenB.approve(address(router), 10 ether);
        (,, uint256 liquidity) = router.addLiquidity(
            address(tokenA),
            address(tokenB),
            10 ether,
            10 ether,
            10 ether,
            10 ether,
            user1,
            block.timestamp + 1
        );

        address pair = factory.getPair(address(tokenA), address(tokenB));
        DEXPair(pair).approve(address(router), liquidity);

        vm.expectRevert(DEXRouter.InsufficientBAmount.selector);
        router.removeLiquidity(
            address(tokenA),
            address(tokenB),
            liquidity,
            9 ether,
            100 ether,
            user1,
            block.timestamp + 1
        );
        vm.stopPrank();
    }

    function testSwapInsufficientOutputAmount() public {
        // Add liquidity
        vm.startPrank(user1);
        tokenA.approve(address(router), 100 ether);
        tokenB.approve(address(router), 100 ether);
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            100 ether,
            100 ether,
            100 ether,
            user1,
            block.timestamp + 1
        );
        vm.stopPrank();

        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        vm.startPrank(user2);
        tokenA.approve(address(router), 1 ether);

        vm.expectRevert(DEXRouter.InsufficientOutputAmount.selector);
        router.swapExactTokensForTokens(
            1 ether,
            10 ether,
            path,
            user2,
            block.timestamp + 1
        );
        vm.stopPrank();
    }

    function testSwapExcessiveInputAmount() public {
        // Add liquidity
        vm.startPrank(user1);
        tokenA.approve(address(router), 100 ether);
        tokenB.approve(address(router), 100 ether);
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            100 ether,
            100 ether,
            100 ether,
            user1,
            block.timestamp + 1
        );
        vm.stopPrank();

        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        vm.startPrank(user2);
        tokenA.approve(address(router), 0.1 ether);

        vm.expectRevert(DEXRouter.ExcessiveInputAmount.selector);
        router.swapTokensForExactTokens(
            1 ether,
            0.1 ether,
            path,
            user2,
            block.timestamp + 1
        );
        vm.stopPrank();
    }

    function testSwapPairNotFound() public {
        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        vm.startPrank(user2);
        tokenA.approve(address(router), 1 ether);

        vm.expectRevert(DEXRouter.PairNotFound.selector);
        router.swapExactTokensForTokens(
            1 ether,
            0,
            path,
            user2,
            block.timestamp + 1
        );
        vm.stopPrank();
    }

    // ============ Fuzz Tests ============

    function testFuzzAddLiquidity(uint256 amountA, uint256 amountB) public {
        amountA = bound(amountA, 10000, 100 ether);
        amountB = bound(amountB, 10000, 100 ether);

        tokenA.mint(user1, amountA);
        tokenB.mint(user1, amountB);

        vm.startPrank(user1);
        tokenA.approve(address(router), amountA);
        tokenB.approve(address(router), amountB);

        (uint256 actualA, uint256 actualB, uint256 liquidity) = router.addLiquidity(
            address(tokenA),
            address(tokenB),
            amountA,
            amountB,
            0,
            0,
            user1,
            block.timestamp + 1
        );
        vm.stopPrank();

        assertTrue(actualA > 0);
        assertTrue(actualB > 0);
        assertTrue(liquidity > 0);
    }

    function testFuzzSwap(uint256 amountIn) public {
        amountIn = bound(amountIn, 0.01 ether, 5 ether);

        // Add liquidity
        vm.startPrank(user1);
        tokenA.approve(address(router), 100 ether);
        tokenB.approve(address(router), 100 ether);
        router.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            100 ether,
            100 ether,
            100 ether,
            user1,
            block.timestamp + 1
        );
        vm.stopPrank();

        // Swap
        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        tokenA.mint(user2, amountIn);
        vm.startPrank(user2);
        tokenA.approve(address(router), amountIn);
        
        uint256[] memory amounts = router.swapExactTokensForTokens(
            amountIn,
            0,
            path,
            user2,
            block.timestamp + 1
        );
        vm.stopPrank();

        assertTrue(amounts[1] > 0);
    }

    // ============ Integration Tests ============

    function testCompleteUserJourney() public {
        // User1 adds liquidity
        vm.startPrank(user1);
        tokenA.approve(address(router), 100 ether);
        tokenB.approve(address(router), 100 ether);
        (,, uint256 liquidity1) = router.addLiquidity(
            address(tokenA),
            address(tokenB),
            100 ether,
            100 ether,
            100 ether,
            100 ether,
            user1,
            block.timestamp + 1
        );
        vm.stopPrank();

        // User2 swaps
        address[] memory path = new address[](2);
        path[0] = address(tokenA);
        path[1] = address(tokenB);

        vm.startPrank(user2);
        tokenA.approve(address(router), 10 ether);
        router.swapExactTokensForTokens(
            10 ether,
            0,
            path,
            user2,
            block.timestamp + 1
        );
        vm.stopPrank();

        // User1 removes liquidity
        address pair = factory.getPair(address(tokenA), address(tokenB));
        vm.startPrank(user1);
        DEXPair(pair).approve(address(router), liquidity1);
        (uint256 amountA, uint256 amountB) = router.removeLiquidity(
            address(tokenA),
            address(tokenB),
            liquidity1,
            0,
            0,
            user1,
            block.timestamp + 1
        );
        vm.stopPrank();

        // User1 should have more tokens due to fees
        assertTrue(amountA + amountB > 200 ether);
    }
}
