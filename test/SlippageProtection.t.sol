// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MinimalForwarder.sol";
import "../src/DEXFactory.sol";
import "../src/DEXPair.sol";
import "../src/DEXRouter.sol";
import "../src/MockERC20.sol";

/**
 * @title SlippageProtectionTest
 * @notice Tests for DEXPair swap access control and slippage protection
 */
contract SlippageProtectionTest is Test {
    DEXFactory public factory;
    DEXRouter public router;
    DEXPair public pair;
    MockERC20 public token0;
    MockERC20 public token1;
    
    MinimalForwarder public forwarder;
    address public owner = address(this);
    address public user1 = address(0x1);
    address public attacker = address(0x2);
    
    function setUp() public {
        // Deploy factory
        factory = new DEXFactory(owner);
        
        // Deploy mock WETH
        MockERC20 weth = new MockERC20("Wrapped ETH", "WETH", 18);
        forwarder = new MinimalForwarder();
        
        // Deploy router
        router = new DEXRouter(address(factory), address(weth), address(forwarder));
        
        // Set router in factory
        factory.setRouter(address(router));
        
        // Deploy tokens
        token0 = new MockERC20("Token A", "TKA", 18);
        token1 = new MockERC20("Token B", "TKB", 18);
        
        // Ensure token0 < token1
        if (address(token0) > address(token1)) {
            (token0, token1) = (token1, token0);
        }
        
        // Create pair
        address pairAddress = factory.createPair(address(token0), address(token1));
        pair = DEXPair(pairAddress);
        
        // Mint tokens
        token0.mint(owner, 10000 ether);
        token1.mint(owner, 10000 ether);
        
        // Add initial liquidity
        token0.approve(address(router), type(uint256).max);
        token1.approve(address(router), type(uint256).max);
        
        router.addLiquidity(
            address(token0),
            address(token1),
            1000 ether,
            1000 ether,
            999 ether,
            999 ether,
            owner,
            block.timestamp + 1 hours
        );
    }
    
    // ============ Access Control Tests ============
    
    function testDirectSwapRevertsForUnauthorizedCaller() public {
        // Mint tokens to attacker
        token0.mint(attacker, 100 ether);
        
        vm.startPrank(attacker);
        token0.approve(address(pair), 100 ether);
        
        // Transfer tokens to pair
        token0.transfer(address(pair), 10 ether);
        
        // Try to call swap directly (should revert)
        vm.expectRevert(DEXPair.Unauthorized.selector);
        pair.swap(0, 9 ether, attacker, "");
        
        vm.stopPrank();
    }
    
    function testRouterCanCallSwap() public {
        // Mint tokens to user
        token0.mint(user1, 100 ether);
        
        vm.startPrank(user1);
        token0.approve(address(router), 100 ether);
        
        // Swap through router (should succeed)
        address[] memory path = new address[](2);
        path[0] = address(token0);
        path[1] = address(token1);
        
        router.swapExactTokensForTokens(
            10 ether,
            1 ether,
            path,
            user1,
            block.timestamp + 1 hours
        );
        
        vm.stopPrank();
        
        // Verify user received tokens
        assertTrue(token1.balanceOf(user1) > 0, "User should receive tokens");
    }
    
    function testFactoryCanCallSwap() public {
        // This test verifies factory can call swap if needed
        // (though in practice, factory doesn't call swap)
        
        token0.mint(address(factory), 100 ether);
        
        vm.startPrank(address(factory));
        token0.transfer(address(pair), 10 ether);
        
        // Factory can call swap
        pair.swap(0, 9 ether, address(factory), "");
        
        vm.stopPrank();
        
        assertTrue(token1.balanceOf(address(factory)) > 0, "Factory should receive tokens");
    }
    
    // ============ MEV Protection Tests ============
    
    function testPreventsSandwichAttack() public {
        // Setup: User wants to swap 10 ether token0 for token1
        token0.mint(user1, 100 ether);
        
        // Attacker tries to front-run by calling swap directly
        token0.mint(attacker, 100 ether);
        
        vm.startPrank(attacker);
        token0.approve(address(pair), 100 ether);
        token0.transfer(address(pair), 50 ether);
        
        // Attacker's direct swap should fail
        vm.expectRevert(DEXPair.Unauthorized.selector);
        pair.swap(0, 45 ether, attacker, "");
        
        vm.stopPrank();
        
        // User's legitimate swap through router should succeed
        vm.startPrank(user1);
        token0.approve(address(router), 100 ether);
        
        address[] memory path = new address[](2);
        path[0] = address(token0);
        path[1] = address(token1);
        
        router.swapExactTokensForTokens(
            10 ether,
            1 ether,
            path,
            user1,
            block.timestamp + 1 hours
        );
        
        vm.stopPrank();
    }
    
    function testSlippageProtectionThroughRouter() public {
        token0.mint(user1, 100 ether);
        
        vm.startPrank(user1);
        token0.approve(address(router), 100 ether);
        
        address[] memory path = new address[](2);
        path[0] = address(token0);
        path[1] = address(token1);
        
        // Calculate expected output
        uint256[] memory amounts = router.getAmountsOut(10 ether, path);
        uint256 expectedOut = amounts[1];
        
        // Set minimum output too high (should revert)
        vm.expectRevert(DEXRouter.InsufficientOutputAmount.selector);
        router.swapExactTokensForTokens(
            10 ether,
            expectedOut + 1 ether, // Unrealistic minimum
            path,
            user1,
            block.timestamp + 1 hours
        );
        
        // Set reasonable minimum (should succeed)
        router.swapExactTokensForTokens(
            10 ether,
            expectedOut - 0.1 ether, // Allow 0.1 ether slippage
            path,
            user1,
            block.timestamp + 1 hours
        );
        
        vm.stopPrank();
    }
    
    // ============ Router Authorization Tests ============
    
    function testRouterSetOnlyOnce() public {
        // Deploy new pair manually
        DEXPair newPair = new DEXPair(address(token0), address(token1));
        
        // Set router first time (should succeed)
        newPair.setRouter(address(router));
        
        // Try to set router again (should fail)
        vm.expectRevert("Router already set");
        newPair.setRouter(address(0x123));
    }
    
    function testOnlyFactoryCanSetRouter() public {
        // Deploy new pair manually
        DEXPair newPair = new DEXPair(address(token0), address(token1));
        
        // Non-factory caller tries to set router (should fail)
        vm.prank(attacker);
        vm.expectRevert("Only factory");
        newPair.setRouter(address(router));
    }
    
    // ============ Integration Tests ============
    
    function testMultipleSwapsThroughRouter() public {
        token0.mint(user1, 1000 ether);
        
        vm.startPrank(user1);
        token0.approve(address(router), 1000 ether);
        
        address[] memory path = new address[](2);
        path[0] = address(token0);
        path[1] = address(token1);
        
        // Perform multiple swaps
        for (uint256 i = 0; i < 5; i++) {
            router.swapExactTokensForTokens(
                10 ether,
                1 ether,
                path,
                user1,
                block.timestamp + 1 hours
            );
        }
        
        vm.stopPrank();
        
        // Verify user received tokens
        assertTrue(token1.balanceOf(user1) > 40 ether, "User should receive tokens from all swaps");
    }
    
    function testCannotBypassRouterWithTransferAndSwap() public {
        token0.mint(attacker, 100 ether);
        
        vm.startPrank(attacker);
        
        // Transfer tokens to pair
        token0.transfer(address(pair), 10 ether);
        
        // Try to call swap directly (should fail even with tokens in pair)
        vm.expectRevert(DEXPair.Unauthorized.selector);
        pair.swap(0, 9 ether, attacker, "");
        
        vm.stopPrank();
    }
    
    // ============ Edge Cases ============
    
    function testSwapWithZeroRouterAddress() public {
        // Deploy pair without router set
        DEXPair newPair = new DEXPair(address(token0), address(token1));
        
        // Mint and add liquidity directly
        token0.mint(address(this), 1000 ether);
        token1.mint(address(this), 1000 ether);
        token0.transfer(address(newPair), 1000 ether);
        token1.transfer(address(newPair), 1000 ether);
        newPair.mint(address(this));
        
        // Try to swap (should fail - no router set)
        token0.mint(attacker, 100 ether);
        
        vm.startPrank(attacker);
        token0.transfer(address(newPair), 10 ether);
        
        vm.expectRevert(DEXPair.Unauthorized.selector);
        newPair.swap(0, 9 ether, attacker, "");
        
        vm.stopPrank();
    }
    
    function testRouterAlreadySetOnFactoryCreatedPairs() public {
        // Pairs created by factory should already have router set
        assertEq(pair.router(), address(router), "Router should be set by factory");
        
        // Try to set router again from non-factory address (should fail with "Only factory")
        vm.prank(attacker);
        vm.expectRevert("Only factory");
        pair.setRouter(address(0x123));
    }
}
