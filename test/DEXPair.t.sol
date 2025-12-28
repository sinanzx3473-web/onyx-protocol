// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/DEXPair.sol";
import "../src/DEXFactory.sol";
import "../src/MockERC20.sol";
import "../src/FlashBorrower.sol";

contract DEXPairTest is Test {
    DEXFactory factory;
    DEXPair pair;
    MockERC20 tokenA;
    MockERC20 tokenB;
    address token0;
    address token1;
    
    address owner;
    address user1;
    address user2;
    address liquidityProvider;

    // Events from DEXPair
    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );
    event Sync(uint112 reserve0, uint112 reserve1);

    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        liquidityProvider = makeAddr("liquidityProvider");

        // Deploy factory
        factory = new DEXFactory(owner);
        
        // Set factory as router for testing (allows direct swap calls)
        factory.setRouter(address(factory));

        // Deploy tokens
        tokenA = new MockERC20("Token A", "TKA", 18);
        tokenB = new MockERC20("Token B", "TKB", 18);

        // Sort tokens
        (token0, token1) = address(tokenA) < address(tokenB) 
            ? (address(tokenA), address(tokenB)) 
            : (address(tokenB), address(tokenA));

        // Create pair
        address pairAddress = factory.createPair(address(tokenA), address(tokenB));
        pair = DEXPair(pairAddress);

        // Mint tokens to test accounts
        tokenA.mint(liquidityProvider, 1000 ether);
        tokenB.mint(liquidityProvider, 1000 ether);
        tokenA.mint(user1, 100 ether);
        tokenB.mint(user1, 100 ether);
        tokenA.mint(user2, 100 ether);
        tokenB.mint(user2, 100 ether);

        // Fund test accounts with ETH
        vm.deal(owner, 100 ether);
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
        vm.deal(liquidityProvider, 100 ether);
    }

    // ============ Happy Path Tests ============

    function testInitialState() public view {
        assertEq(address(pair.token0()), token0);
        assertEq(address(pair.token1()), token1);
        assertEq(address(pair.factory()), address(factory));
        assertEq(pair.totalSupply(), 0);
        
        (uint112 reserve0, uint112 reserve1, uint32 timestamp) = pair.getReserves();
        assertEq(reserve0, 0);
        assertEq(reserve1, 0);
        assertEq(timestamp, 0);
    }

    function testMintInitialLiquidity() public {
        uint256 amount0 = 10 ether;
        uint256 amount1 = 10 ether;

        vm.startPrank(liquidityProvider);
        MockERC20(token0).transfer(address(pair), amount0);
        MockERC20(token1).transfer(address(pair), amount1);

        vm.expectEmit(true, false, false, true);
        emit Mint(liquidityProvider, amount0, amount1);

        uint256 liquidity = pair.mint(liquidityProvider);
        vm.stopPrank();

        uint256 expectedLiquidity = _sqrt(amount0 * amount1) - pair.MINIMUM_LIQUIDITY();
        assertEq(liquidity, expectedLiquidity);
        assertEq(pair.balanceOf(liquidityProvider), expectedLiquidity);
        assertEq(pair.totalSupply(), _sqrt(amount0 * amount1));
    }

    function testMintAdditionalLiquidity() public {
        // Initial liquidity
        vm.startPrank(liquidityProvider);
        MockERC20(token0).transfer(address(pair), 10 ether);
        MockERC20(token1).transfer(address(pair), 10 ether);
        pair.mint(liquidityProvider);

        // Additional liquidity
        MockERC20(token0).transfer(address(pair), 5 ether);
        MockERC20(token1).transfer(address(pair), 5 ether);
        uint256 liquidity = pair.mint(liquidityProvider);
        vm.stopPrank();

        assertTrue(liquidity > 0);
    }

    function testBurnLiquidity() public {
        // Add liquidity
        vm.startPrank(liquidityProvider);
        MockERC20(token0).transfer(address(pair), 10 ether);
        MockERC20(token1).transfer(address(pair), 10 ether);
        uint256 liquidity = pair.mint(liquidityProvider);

        // Burn liquidity
        pair.transfer(address(pair), liquidity);
        
        vm.expectEmit(true, false, false, true);
        emit Burn(liquidityProvider, 10 ether - 1000, 10 ether - 1000, liquidityProvider);
        
        (uint256 amount0, uint256 amount1) = pair.burn(liquidityProvider);
        vm.stopPrank();

        assertTrue(amount0 > 0);
        assertTrue(amount1 > 0);
        assertEq(pair.balanceOf(liquidityProvider), 0);
    }

    function testSwapToken0ForToken1() public {
        // Add liquidity
        vm.startPrank(liquidityProvider);
        MockERC20(token0).transfer(address(pair), 10 ether);
        MockERC20(token1).transfer(address(pair), 10 ether);
        pair.mint(liquidityProvider);
        vm.stopPrank();

        // Swap
        uint256 amountIn = 1 ether;
        uint256 expectedOut = _getAmountOut(amountIn, 10 ether, 10 ether);

        vm.startPrank(user1);
        MockERC20(token0).transfer(address(pair), amountIn);
        vm.stopPrank();
        
        // Call swap from factory (authorized)
        vm.prank(address(factory));
        vm.expectEmit(true, false, false, true);
        emit Swap(address(factory), amountIn, 0, 0, expectedOut, user1);
        
        pair.swap(0, expectedOut, user1, "");

        assertEq(MockERC20(token1).balanceOf(user1), 100 ether + expectedOut);
    }

    function testSwapToken1ForToken0() public {
        // Add liquidity
        vm.startPrank(liquidityProvider);
        MockERC20(token0).transfer(address(pair), 10 ether);
        MockERC20(token1).transfer(address(pair), 10 ether);
        pair.mint(liquidityProvider);
        vm.stopPrank();

        // Swap
        uint256 amountIn = 1 ether;
        uint256 expectedOut = _getAmountOut(amountIn, 10 ether, 10 ether);

        vm.startPrank(user1);
        MockERC20(token1).transfer(address(pair), amountIn);
        vm.stopPrank();
        
        // Call swap from factory (authorized)
        vm.prank(address(factory));
        pair.swap(expectedOut, 0, user1, "");

        assertEq(MockERC20(token0).balanceOf(user1), 100 ether + expectedOut);
    }

    function testMultipleSwaps() public {
        // Add liquidity
        vm.startPrank(liquidityProvider);
        MockERC20(token0).transfer(address(pair), 100 ether);
        MockERC20(token1).transfer(address(pair), 100 ether);
        pair.mint(liquidityProvider);
        vm.stopPrank();

        // Multiple swaps
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(user1);
            MockERC20(token0).transfer(address(pair), 1 ether);
            
            (uint112 r0, uint112 r1,) = pair.getReserves();
            uint256 amountOut = _getAmountOut(1 ether, r0, r1);
            
            vm.prank(address(factory));
            pair.swap(0, amountOut, user1, "");
        }

        assertTrue(MockERC20(token1).balanceOf(user1) > 100 ether);
    }

    function testSync() public {
        // Add liquidity
        vm.startPrank(liquidityProvider);
        MockERC20(token0).transfer(address(pair), 10 ether);
        MockERC20(token1).transfer(address(pair), 10 ether);
        pair.mint(liquidityProvider);
        vm.stopPrank();

        // Donate tokens (simulating donation attack)
        MockERC20(token0).mint(address(pair), 5 ether);

        vm.expectEmit(false, false, false, true);
        emit Sync(15 ether, 10 ether);
        
        pair.sync();

        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        assertEq(reserve0, 15 ether);
        assertEq(reserve1, 10 ether);
    }

    // ============ Flash Loan Tests ============

    function testFlashLoanSuccess() public {
        // Add liquidity
        vm.startPrank(liquidityProvider);
        MockERC20(token0).transfer(address(pair), 100 ether);
        MockERC20(token1).transfer(address(pair), 100 ether);
        pair.mint(liquidityProvider);
        vm.stopPrank();

        // Deploy flash borrower
        FlashBorrower borrower = new FlashBorrower(address(pair));

        // Fund borrower with enough tokens to repay loan + fee
        uint256 loanAmount = 10 ether;
        uint256 fee = pair.flashFee(token0, loanAmount);
        // Borrower needs loan amount + fee to repay
        MockERC20(token0).mint(address(borrower), loanAmount + fee);

        // Execute flash loan
        vm.prank(address(this));
        borrower.executeFlashLoan(token0, loanAmount, "");

        // Verify fee was collected (pair should have original + fee, borrower used the loan)
        assertTrue(MockERC20(token0).balanceOf(address(pair)) >= 100 ether + fee);
    }

    function testFlashLoanMaxAmount() public {
        vm.startPrank(liquidityProvider);
        MockERC20(token0).transfer(address(pair), 100 ether);
        MockERC20(token1).transfer(address(pair), 100 ether);
        pair.mint(liquidityProvider);
        vm.stopPrank();

        uint256 maxLoan = pair.maxFlashLoan(token0);
        assertEq(maxLoan, 100 ether);
    }

    function testFlashLoanFeeCalculation() public {
        uint256 amount = 100 ether;
        uint256 fee = pair.flashFee(token0, amount);
        uint256 expectedFee = (amount * 9) / 10000; // 0.09%
        assertEq(fee, expectedFee);
    }

    // ============ Edge Case Tests ============

    function testMinimumLiquidity() public {
        vm.startPrank(liquidityProvider);
        MockERC20(token0).transfer(address(pair), 10000);
        MockERC20(token1).transfer(address(pair), 10000);
        pair.mint(liquidityProvider);
        vm.stopPrank();

        assertEq(pair.balanceOf(address(0xdead)), pair.MINIMUM_LIQUIDITY());
    }

    function testSwapWithZeroReserves() public {
        vm.prank(user1);
        MockERC20(token0).transfer(address(pair), 1 ether);
        
        vm.prank(address(factory));
        vm.expectRevert(DEXPair.InsufficientLiquidity.selector);
        pair.swap(0, 1 ether, user1, "");
    }

    function testSwapExceedingReserves() public {
        vm.startPrank(liquidityProvider);
        MockERC20(token0).transfer(address(pair), 10 ether);
        MockERC20(token1).transfer(address(pair), 10 ether);
        pair.mint(liquidityProvider);
        vm.stopPrank();

        vm.prank(user1);
        MockERC20(token0).transfer(address(pair), 1 ether);
        
        vm.prank(address(factory));
        vm.expectRevert(DEXPair.InsufficientLiquidity.selector);
        pair.swap(0, 11 ether, user1, "");
    }

    function testPriceImpact() public {
        // Add liquidity
        vm.startPrank(liquidityProvider);
        MockERC20(token0).transfer(address(pair), 100 ether);
        MockERC20(token1).transfer(address(pair), 100 ether);
        pair.mint(liquidityProvider);
        vm.stopPrank();

        // Small swap
        vm.prank(user1);
        MockERC20(token0).transfer(address(pair), 1 ether);
        
        (uint112 r0, uint112 r1,) = pair.getReserves();
        uint256 smallOut = _getAmountOut(1 ether, r0, r1);
        
        vm.prank(address(factory));
        pair.swap(0, smallOut, user1, "");

        // Large swap (higher price impact)
        vm.prank(user2);
        MockERC20(token0).transfer(address(pair), 10 ether);
        
        (r0, r1,) = pair.getReserves();
        uint256 largeOut = _getAmountOut(10 ether, r0, r1);
        
        vm.prank(address(factory));
        pair.swap(0, largeOut, user2, "");

        // Large swap should have worse rate
        assertTrue(largeOut < smallOut * 10);
    }

    // ============ Revert Tests ============

    function testMintInsufficientLiquidity() public {
        vm.startPrank(liquidityProvider);
        MockERC20(token0).transfer(address(pair), 1);
        MockERC20(token1).transfer(address(pair), 1);
        
        vm.expectRevert();
        pair.mint(liquidityProvider);
        vm.stopPrank();
    }

    function testMintToZeroAddress() public {
        vm.startPrank(liquidityProvider);
        MockERC20(token0).transfer(address(pair), 10 ether);
        MockERC20(token1).transfer(address(pair), 10 ether);
        
        vm.expectRevert(DEXPair.InvalidTo.selector);
        pair.mint(address(0));
        vm.stopPrank();
    }

    function testMintToPairAddress() public {
        vm.startPrank(liquidityProvider);
        MockERC20(token0).transfer(address(pair), 10 ether);
        MockERC20(token1).transfer(address(pair), 10 ether);
        
        vm.expectRevert(DEXPair.InvalidTo.selector);
        pair.mint(address(pair));
        vm.stopPrank();
    }

    function testBurnInsufficientLiquidity() public {
        vm.expectRevert();
        pair.burn(liquidityProvider);
    }

    function testBurnToZeroAddress() public {
        vm.startPrank(liquidityProvider);
        MockERC20(token0).transfer(address(pair), 10 ether);
        MockERC20(token1).transfer(address(pair), 10 ether);
        uint256 liquidity = pair.mint(liquidityProvider);
        pair.transfer(address(pair), liquidity);
        
        vm.expectRevert(DEXPair.InvalidTo.selector);
        pair.burn(address(0));
        vm.stopPrank();
    }

    function testSwapZeroOutput() public {
        vm.prank(address(factory));
        vm.expectRevert(DEXPair.InsufficientOutputAmount.selector);
        pair.swap(0, 0, user1, "");
    }

    function testSwapToTokenAddress() public {
        vm.startPrank(liquidityProvider);
        MockERC20(token0).transfer(address(pair), 10 ether);
        MockERC20(token1).transfer(address(pair), 10 ether);
        pair.mint(liquidityProvider);
        vm.stopPrank();

        vm.prank(user1);
        MockERC20(token0).transfer(address(pair), 1 ether);
        
        vm.prank(address(factory));
        vm.expectRevert(DEXPair.InvalidTo.selector);
        pair.swap(0, 0.9 ether, token0, "");
    }

    function testSwapKInvariantViolation() public {
        vm.startPrank(liquidityProvider);
        MockERC20(token0).transfer(address(pair), 10 ether);
        MockERC20(token1).transfer(address(pair), 10 ether);
        pair.mint(liquidityProvider);
        vm.stopPrank();

        // Try to swap without sending tokens (from factory)
        vm.prank(address(factory));
        vm.expectRevert(DEXPair.InsufficientOutputAmount.selector);
        pair.swap(0, 1 ether, user1, "");
    }

    function testFlashLoanUnsupportedToken() public {
        address randomToken = makeAddr("randomToken");
        
        vm.expectRevert(DEXPair.UnsupportedToken.selector);
        pair.flashFee(randomToken, 1 ether);
    }

    function testFlashLoanInsufficientLiquidity() public {
        FlashBorrower borrower = new FlashBorrower(address(pair));
        
        vm.expectRevert();
        borrower.executeFlashLoan(token0, 1 ether, "");
    }

    // ============ Fuzz Tests ============

    function testFuzzMint(uint256 amount0, uint256 amount1) public {
        amount0 = bound(amount0, 10000, 1000000 ether);
        amount1 = bound(amount1, 10000, 1000000 ether);

        MockERC20(token0).mint(liquidityProvider, amount0);
        MockERC20(token1).mint(liquidityProvider, amount1);

        vm.startPrank(liquidityProvider);
        MockERC20(token0).transfer(address(pair), amount0);
        MockERC20(token1).transfer(address(pair), amount1);
        uint256 liquidity = pair.mint(liquidityProvider);
        vm.stopPrank();

        assertTrue(liquidity > 0);
    }

    function testFuzzSwap(uint256 amountIn) public {
        amountIn = bound(amountIn, 0.001 ether, 5 ether);

        // Add liquidity
        vm.startPrank(liquidityProvider);
        MockERC20(token0).transfer(address(pair), 100 ether);
        MockERC20(token1).transfer(address(pair), 100 ether);
        pair.mint(liquidityProvider);
        vm.stopPrank();

        // Swap
        MockERC20(token0).mint(user1, amountIn);
        vm.prank(user1);
        MockERC20(token0).transfer(address(pair), amountIn);
        
        (uint112 r0, uint112 r1,) = pair.getReserves();
        uint256 amountOut = _getAmountOut(amountIn, r0, r1);
        
        vm.prank(address(factory));
        pair.swap(0, amountOut, user1, "");

        assertTrue(MockERC20(token1).balanceOf(user1) > 100 ether);
    }

    // ============ Gas Benchmarking ============

    function testGasSwap() public {
        vm.startPrank(liquidityProvider);
        MockERC20(token0).transfer(address(pair), 100 ether);
        MockERC20(token1).transfer(address(pair), 100 ether);
        pair.mint(liquidityProvider);
        vm.stopPrank();

        vm.prank(user1);
        MockERC20(token0).transfer(address(pair), 1 ether);
        
        (uint112 r0, uint112 r1,) = pair.getReserves();
        uint256 amountOut = _getAmountOut(1 ether, r0, r1);
        
        vm.prank(address(factory));
        uint256 gasBefore = gasleft();
        pair.swap(0, amountOut, user1, "");
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas used for swap", gasUsed);
        assertTrue(gasUsed < 150000, "Swap gas exceeds 150k");
    }

    function testGasMint() public {
        vm.startPrank(liquidityProvider);
        MockERC20(token0).transfer(address(pair), 10 ether);
        MockERC20(token1).transfer(address(pair), 10 ether);
        
        uint256 gasBefore = gasleft();
        pair.mint(liquidityProvider);
        uint256 gasUsed = gasBefore - gasleft();
        vm.stopPrank();

        emit log_named_uint("Gas used for mint", gasUsed);
    }

    // ============ Helper Functions ============

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

    function _getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) private pure returns (uint256) {
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        return numerator / denominator;
    }
}
