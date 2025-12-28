// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MinimalForwarder.sol";
import "../src/DEXPair.sol";
import "../src/DEXFactory.sol";
import "../src/DEXRouter.sol";
import "../src/MockFeeOnTransferToken.sol";
import "../src/MockERC20.sol";

/**
 * @title DEXPairFeeOnTransferTest
 * @notice Tests DEXPair compatibility with fee-on-transfer tokens
 */
contract DEXPairFeeOnTransferTest is Test {
    DEXFactory public factory;
    DEXRouter public router;
    DEXPair public pair;
    MockFeeOnTransferToken public feeToken;
    MockERC20 public normalToken;
    MinimalForwarder public forwarder;
    
    address public owner = address(this);
    address public user = address(0x1);
    address public feeRecipient = address(0x2);
    address public weth = address(0x456);
    
    uint256 constant INITIAL_BALANCE = 1000000 * 1e18;

    function setUp() public {
        vm.etch(weth, "0x00"); // Mock WETH
        
        // Deploy factory and router
        factory = new DEXFactory(owner);
        forwarder = new MinimalForwarder();
        router = new DEXRouter(address(factory), weth, address(forwarder));
        factory.setRouter(address(router));
        
        // Deploy tokens
        normalToken = new MockERC20("Normal Token", "NORM", 18);
        feeToken = new MockFeeOnTransferToken("Fee Token", "FEE", 300, feeRecipient); // 3% fee
        
        // Create pair
        address pairAddr = factory.createPair(address(feeToken), address(normalToken));
        pair = DEXPair(pairAddr);
        
        // Mint tokens to user
        normalToken.mint(user, INITIAL_BALANCE);
        feeToken.mint(user, INITIAL_BALANCE);
        
        // Approve router
        vm.startPrank(user);
        normalToken.approve(address(router), type(uint256).max);
        feeToken.approve(address(router), type(uint256).max);
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          MINT (ADD LIQUIDITY) TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function test_Mint_WithFeeOnTransferToken_MeasuresActualReceived() public {
        vm.startPrank(user);
        
        uint256 feeAmount = 1000 * 1e18;
        uint256 normalAmount = 1000 * 1e18;
        
        // Transfer tokens to pair
        feeToken.transfer(address(pair), feeAmount);
        normalToken.transfer(address(pair), normalAmount);
        
        // Calculate expected received (97% after 3% fee)
        uint256 expectedFeeReceived = (feeAmount * 9700) / 10000;
        
        // Mint liquidity
        uint256 liquidity = pair.mint(user);
        
        vm.stopPrank();
        
        // Verify reserves reflect actual received amounts
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        
        // Determine which token is token0
        address token0 = address(pair.token0());
        if (token0 == address(feeToken)) {
            assertEq(reserve0, expectedFeeReceived, "Fee token reserve should be actual received");
            assertEq(reserve1, normalAmount, "Normal token reserve should be full");
        } else {
            assertEq(reserve0, normalAmount, "Normal token reserve should be full");
            assertEq(reserve1, expectedFeeReceived, "Fee token reserve should be actual received");
        }
        
        assertTrue(liquidity > 0, "Liquidity should be minted");
    }

    function test_Mint_WithFeeOnTransferToken_KInvariantCorrect() public {
        vm.startPrank(user);
        
        uint256 feeAmount = 1000 * 1e18;
        uint256 normalAmount = 1000 * 1e18;
        
        // Transfer tokens to pair
        feeToken.transfer(address(pair), feeAmount);
        normalToken.transfer(address(pair), normalAmount);
        
        // Mint liquidity
        pair.mint(user);
        
        vm.stopPrank();
        
        // Verify K invariant uses actual balances
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        uint256 k = uint256(reserve0) * uint256(reserve1);
        
        // K should be based on actual received amounts
        uint256 expectedFeeReceived = (feeAmount * 9700) / 10000;
        uint256 expectedK = expectedFeeReceived * normalAmount;
        
        address token0 = address(pair.token0());
        if (token0 == address(feeToken)) {
            assertEq(k, expectedK, "K invariant should use actual received amounts");
        } else {
            assertEq(k, expectedK, "K invariant should use actual received amounts");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                              SWAP TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function test_Swap_WithFeeOnTransferToken_UsesActualReceived() public {
        // Add initial liquidity
        vm.startPrank(user);
        feeToken.transfer(address(pair), 10000 * 1e18);
        normalToken.transfer(address(pair), 10000 * 1e18);
        pair.mint(user);
        vm.stopPrank();
        
        // Get initial reserves
        (uint112 reserve0Before, uint112 reserve1Before,) = pair.getReserves();
        
        // Execute swap via router
        vm.startPrank(user);
        uint256 swapAmount = 100 * 1e18;
        
        address[] memory path = new address[](2);
        path[0] = address(feeToken);
        path[1] = address(normalToken);
        
        router.swapExactTokensForTokens(
            swapAmount,
            1, // Min output
            path,
            user,
            block.timestamp + 1000
        );
        
        vm.stopPrank();
        
        // Verify reserves updated with actual received amount
        (uint112 reserve0After, uint112 reserve1After,) = pair.getReserves();
        
        address token0 = address(pair.token0());
        if (token0 == address(feeToken)) {
            // Fee token reserve should increase by actual received (97%)
            uint256 expectedReceived = (swapAmount * 9700) / 10000;
            uint256 actualIncrease = reserve0After - reserve0Before;
            
            // Allow small variance due to rounding
            assertApproxEqRel(actualIncrease, expectedReceived, 0.01e18, "Reserve increase should match actual received");
        }
    }

    function test_Swap_WithFeeOnTransferToken_KInvariantMaintained() public {
        // Add initial liquidity
        vm.startPrank(user);
        feeToken.transfer(address(pair), 10000 * 1e18);
        normalToken.transfer(address(pair), 10000 * 1e18);
        pair.mint(user);
        vm.stopPrank();
        
        // Get initial K
        (uint112 reserve0Before, uint112 reserve1Before,) = pair.getReserves();
        uint256 kBefore = uint256(reserve0Before) * uint256(reserve1Before);
        
        // Execute swap
        vm.startPrank(user);
        address[] memory path = new address[](2);
        path[0] = address(feeToken);
        path[1] = address(normalToken);
        
        router.swapExactTokensForTokens(
            100 * 1e18,
            1,
            path,
            user,
            block.timestamp + 1000
        );
        vm.stopPrank();
        
        // Get final K
        (uint112 reserve0After, uint112 reserve1After,) = pair.getReserves();
        uint256 kAfter = uint256(reserve0After) * uint256(reserve1After);
        
        // K should increase (fees added to reserves)
        assertTrue(kAfter > kBefore, "K should increase after swap due to fees");
    }

    function test_Swap_WithFeeOnTransferToken_MultipleSwaps() public {
        // Add initial liquidity
        vm.startPrank(user);
        feeToken.transfer(address(pair), 10000 * 1e18);
        normalToken.transfer(address(pair), 10000 * 1e18);
        pair.mint(user);
        vm.stopPrank();
        
        address[] memory path = new address[](2);
        path[0] = address(feeToken);
        path[1] = address(normalToken);
        
        // Execute multiple swaps
        vm.startPrank(user);
        for (uint i = 0; i < 5; i++) {
            router.swapExactTokensForTokens(
                50 * 1e18,
                1,
                path,
                user,
                block.timestamp + 1000
            );
        }
        vm.stopPrank();
        
        // Verify reserves match actual balances
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        
        assertEq(pair.token0().balanceOf(address(pair)), reserve0, "Reserve0 should match balance");
        assertEq(pair.token1().balanceOf(address(pair)), reserve1, "Reserve1 should match balance");
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                              BURN TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function test_Burn_WithFeeOnTransferToken_ReturnsCorrectAmounts() public {
        // Add liquidity
        vm.startPrank(user);
        feeToken.transfer(address(pair), 1000 * 1e18);
        normalToken.transfer(address(pair), 1000 * 1e18);
        uint256 liquidity = pair.mint(user);
        vm.stopPrank();
        
        // Transfer LP tokens to pair for burning
        vm.prank(user);
        pair.transfer(address(pair), liquidity / 2);
        
        // Get reserves before burn
        (uint112 reserve0Before, uint112 reserve1Before,) = pair.getReserves();
        
        // Burn liquidity
        vm.prank(user);
        (uint256 amount0, uint256 amount1) = pair.burn(user);
        
        // Verify amounts returned are proportional to reserves
        assertTrue(amount0 > 0 && amount1 > 0, "Should return both tokens");
        
        // Verify reserves decreased correctly
        (uint112 reserve0After, uint112 reserve1After,) = pair.getReserves();
        assertEq(reserve0After, reserve0Before - amount0, "Reserve0 should decrease by amount0");
        assertEq(reserve1After, reserve1Before - amount1, "Reserve1 should decrease by amount1");
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                          EDGE CASE TESTS
    // ═══════════════════════════════════════════════════════════════════════════════

    function test_ZeroFeeToken_WorksNormally() public {
        // Create token with 0% fee
        MockFeeOnTransferToken zeroFeeToken = new MockFeeOnTransferToken("Zero Fee", "ZERO", 0, feeRecipient);
        zeroFeeToken.mint(user, INITIAL_BALANCE);
        
        // Create new pair
        address pairAddr = factory.createPair(address(zeroFeeToken), address(normalToken));
        DEXPair zeroPair = DEXPair(pairAddr);
        
        vm.startPrank(user);
        zeroFeeToken.approve(address(router), type(uint256).max);
        
        // Add liquidity
        uint256 amount = 1000 * 1e18;
        zeroFeeToken.transfer(address(zeroPair), amount);
        normalToken.transfer(address(zeroPair), amount);
        
        uint256 liquidity = zeroPair.mint(user);
        
        vm.stopPrank();
        
        // Verify full amounts in reserves
        (uint112 reserve0, uint112 reserve1,) = zeroPair.getReserves();
        
        address token0 = address(zeroPair.token0());
        if (token0 == address(zeroFeeToken)) {
            assertEq(reserve0, amount, "Should receive full amount with 0% fee");
        } else {
            assertEq(reserve1, amount, "Should receive full amount with 0% fee");
        }
        
        assertTrue(liquidity > 0, "Liquidity should be minted");
    }

    function testFuzz_DifferentFeePercentages(uint256 feeBps) public {
        // Limit fee to 0-5% (0-500 bps)
        feeBps = bound(feeBps, 0, 500);
        
        // Create token with random fee
        MockFeeOnTransferToken randomFeeToken = new MockFeeOnTransferToken(
            "Random Fee",
            "RAND",
            feeBps,
            feeRecipient
        );
        randomFeeToken.mint(user, INITIAL_BALANCE);
        
        // Create pair
        address pairAddr = factory.createPair(address(randomFeeToken), address(normalToken));
        DEXPair randomPair = DEXPair(pairAddr);
        
        vm.startPrank(user);
        randomFeeToken.approve(address(router), type(uint256).max);
        
        uint256 amount = 1000 * 1e18;
        uint256 expectedReceived = (amount * (10000 - feeBps)) / 10000;
        
        // Add liquidity
        randomFeeToken.transfer(address(randomPair), amount);
        normalToken.transfer(address(randomPair), amount);
        
        randomPair.mint(user);
        
        vm.stopPrank();
        
        // Verify reserves reflect actual received
        (uint112 reserve0, uint112 reserve1,) = randomPair.getReserves();
        
        address token0 = address(randomPair.token0());
        if (token0 == address(randomFeeToken)) {
            assertEq(reserve0, expectedReceived, "Reserve should match expected after fee");
        } else {
            assertEq(reserve1, expectedReceived, "Reserve should match expected after fee");
        }
    }

    function test_BalanceSync_AfterFeeOnTransferSwap() public {
        // Add initial liquidity
        vm.startPrank(user);
        feeToken.transfer(address(pair), 10000 * 1e18);
        normalToken.transfer(address(pair), 10000 * 1e18);
        pair.mint(user);
        vm.stopPrank();
        
        // Execute swap
        vm.startPrank(user);
        address[] memory path = new address[](2);
        path[0] = address(feeToken);
        path[1] = address(normalToken);
        
        router.swapExactTokensForTokens(
            100 * 1e18,
            1,
            path,
            user,
            block.timestamp + 1000
        );
        vm.stopPrank();
        
        // Force sync
        pair.sync();
        
        // Verify reserves still match balances
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        
        assertEq(pair.token0().balanceOf(address(pair)), reserve0, "Reserve0 should match balance after sync");
        assertEq(pair.token1().balanceOf(address(pair)), reserve1, "Reserve1 should match balance after sync");
    }
}
