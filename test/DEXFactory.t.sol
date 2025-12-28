// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/DEXFactory.sol";
import "../src/DEXPair.sol";
import "../src/MockERC20.sol";

contract DEXFactoryTest is Test {
    DEXFactory factory;
    MockERC20 tokenA;
    MockERC20 tokenB;
    MockERC20 tokenC;
    
    address owner;
    address user1;
    address feeSetter;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint256 pairCount);

    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        feeSetter = makeAddr("feeSetter");

        factory = new DEXFactory(feeSetter);

        tokenA = new MockERC20("Token A", "TKA", 18);
        tokenB = new MockERC20("Token B", "TKB", 18);
        tokenC = new MockERC20("Token C", "TKC", 18);
    }

    // ============ Happy Path Tests ============

    function testInitialState() public view {
        assertEq(factory.allPairsLength(), 0);
        assertEq(factory.feeTo(), address(0));
        assertEq(factory.feeToSetter(), feeSetter);
    }

    function testCreatePair() public {
        address pair = factory.createPair(address(tokenA), address(tokenB));
        
        assertTrue(pair != address(0));
        assertEq(factory.allPairsLength(), 1);
        assertEq(factory.allPairs(0), pair);
        
        address retrievedPair = factory.getPair(address(tokenA), address(tokenB));
        assertEq(retrievedPair, pair);
        
        // Check reverse mapping
        assertEq(factory.getPair(address(tokenB), address(tokenA)), pair);
    }

    function testCreatePairEmitsEvent() public {
        (address token0, address token1) = address(tokenA) < address(tokenB)
            ? (address(tokenA), address(tokenB))
            : (address(tokenB), address(tokenA));

        vm.expectEmit(true, true, false, false);
        emit PairCreated(token0, token1, address(0), 1);
        
        factory.createPair(address(tokenA), address(tokenB));
    }

    function testCreateMultiplePairs() public {
        address pair1 = factory.createPair(address(tokenA), address(tokenB));
        address pair2 = factory.createPair(address(tokenA), address(tokenC));
        address pair3 = factory.createPair(address(tokenB), address(tokenC));

        assertEq(factory.allPairsLength(), 3);
        assertTrue(pair1 != pair2);
        assertTrue(pair2 != pair3);
        assertTrue(pair1 != pair3);
    }

    function testPairTokensSorted() public {
        address pair = factory.createPair(address(tokenA), address(tokenB));
        DEXPair pairContract = DEXPair(pair);

        address token0 = address(pairContract.token0());
        address token1 = address(pairContract.token1());

        assertTrue(token0 < token1);
        
        if (address(tokenA) < address(tokenB)) {
            assertEq(token0, address(tokenA));
            assertEq(token1, address(tokenB));
        } else {
            assertEq(token0, address(tokenB));
            assertEq(token1, address(tokenA));
        }
    }

    function testSetFeeTo() public {
        address newFeeTo = makeAddr("newFeeTo");
        
        vm.prank(feeSetter);
        factory.setFeeTo(newFeeTo);
        
        assertEq(factory.feeTo(), newFeeTo);
    }

    function testSetFeeToSetter() public {
        address newFeeSetter = makeAddr("newFeeSetter");
        
        vm.prank(feeSetter);
        factory.setFeeToSetter(newFeeSetter);
        
        assertEq(factory.feeToSetter(), newFeeSetter);
    }

    // ============ Edge Case Tests ============

    function testCreatePairReverseOrder() public {
        address pair1 = factory.createPair(address(tokenA), address(tokenB));
        
        // Creating with reversed order should fail (pair already exists)
        vm.expectRevert(DEXFactory.PairExists.selector);
        factory.createPair(address(tokenB), address(tokenA));
    }

    function testGetPairNonExistent() public view {
        address pair = factory.getPair(address(tokenA), address(tokenB));
        assertEq(pair, address(0));
    }

    // ============ Revert Tests ============

    function testCreatePairIdenticalTokens() public {
        vm.expectRevert(DEXFactory.IdenticalAddresses.selector);
        factory.createPair(address(tokenA), address(tokenA));
    }

    function testCreatePairZeroAddress() public {
        vm.expectRevert(DEXFactory.ZeroAddress.selector);
        factory.createPair(address(0), address(tokenB));
    }

    function testCreatePairAlreadyExists() public {
        factory.createPair(address(tokenA), address(tokenB));
        
        vm.expectRevert(DEXFactory.PairExists.selector);
        factory.createPair(address(tokenA), address(tokenB));
    }

    function testSetFeeToUnauthorized() public {
        vm.prank(user1);
        vm.expectRevert(DEXFactory.Forbidden.selector);
        factory.setFeeTo(user1);
    }

    function testSetFeeToSetterUnauthorized() public {
        vm.prank(user1);
        vm.expectRevert(DEXFactory.Forbidden.selector);
        factory.setFeeToSetter(user1);
    }

    function testSetFeeToSetterZeroAddress() public {
        vm.prank(feeSetter);
        vm.expectRevert("Invalid fee setter");
        factory.setFeeToSetter(address(0));
    }

    // ============ Access Control Tests ============

    function testOnlyFeeSetterCanSetFeeTo() public {
        address newFeeTo = makeAddr("newFeeTo");
        
        // Should fail from non-feeSetter
        vm.prank(user1);
        vm.expectRevert(DEXFactory.Forbidden.selector);
        factory.setFeeTo(newFeeTo);
        
        // Should succeed from feeSetter
        vm.prank(feeSetter);
        factory.setFeeTo(newFeeTo);
        assertEq(factory.feeTo(), newFeeTo);
    }

    function testOnlyFeeSetterCanSetFeeToSetter() public {
        address newFeeSetter = makeAddr("newFeeSetter");
        
        // Should fail from non-feeSetter
        vm.prank(user1);
        vm.expectRevert(DEXFactory.Forbidden.selector);
        factory.setFeeToSetter(newFeeSetter);
        
        // Should succeed from feeSetter
        vm.prank(feeSetter);
        factory.setFeeToSetter(newFeeSetter);
        assertEq(factory.feeToSetter(), newFeeSetter);
    }

    function testFeeSetterTransfer() public {
        address newFeeSetter = makeAddr("newFeeSetter");
        address finalFeeSetter = makeAddr("finalFeeSetter");
        
        // Transfer from original to new
        vm.prank(feeSetter);
        factory.setFeeToSetter(newFeeSetter);
        
        // Original feeSetter should no longer have access
        vm.prank(feeSetter);
        vm.expectRevert(DEXFactory.Forbidden.selector);
        factory.setFeeToSetter(finalFeeSetter);
        
        // New feeSetter should have access
        vm.prank(newFeeSetter);
        factory.setFeeToSetter(finalFeeSetter);
        assertEq(factory.feeToSetter(), finalFeeSetter);
    }

    // ============ State Transition Tests ============

    function testAllPairsArray() public {
        address pair1 = factory.createPair(address(tokenA), address(tokenB));
        address pair2 = factory.createPair(address(tokenA), address(tokenC));
        address pair3 = factory.createPair(address(tokenB), address(tokenC));

        assertEq(factory.allPairs(0), pair1);
        assertEq(factory.allPairs(1), pair2);
        assertEq(factory.allPairs(2), pair3);
        assertEq(factory.allPairsLength(), 3);
    }

    function testPairMappingBidirectional() public {
        address pair = factory.createPair(address(tokenA), address(tokenB));
        
        assertEq(factory.getPair(address(tokenA), address(tokenB)), pair);
        assertEq(factory.getPair(address(tokenB), address(tokenA)), pair);
    }

    // ============ Fuzz Tests ============

    function testFuzzCreatePair(address token0, address token1) public {
        vm.assume(token0 != address(0));
        vm.assume(token1 != address(0));
        vm.assume(token0 != token1);
        vm.assume(token0.code.length == 0);
        vm.assume(token1.code.length == 0);

        // Deploy mock tokens at the addresses
        MockERC20 mockToken0 = new MockERC20("Token0", "TK0", 18);
        MockERC20 mockToken1 = new MockERC20("Token1", "TK1", 18);

        address pair = factory.createPair(address(mockToken0), address(mockToken1));
        
        assertTrue(pair != address(0));
        assertEq(factory.allPairsLength(), 1);
    }

    // ============ Integration Tests ============

    function testFactoryPairIntegration() public {
        // Create pair
        address pairAddress = factory.createPair(address(tokenA), address(tokenB));
        DEXPair pair = DEXPair(pairAddress);

        // Verify pair properties
        assertEq(address(pair.factory()), address(factory));
        assertTrue(address(pair.token0()) != address(0));
        assertTrue(address(pair.token1()) != address(0));

        // Add liquidity to pair
        tokenA.mint(address(this), 10 ether);
        tokenB.mint(address(this), 10 ether);

        (address token0, address token1) = address(tokenA) < address(tokenB)
            ? (address(tokenA), address(tokenB))
            : (address(tokenB), address(tokenA));

        MockERC20(token0).transfer(address(pair), 10 ether);
        MockERC20(token1).transfer(address(pair), 10 ether);
        
        uint256 liquidity = pair.mint(address(this));
        assertTrue(liquidity > 0);
    }

    function testMultiplePairsIndependence() public {
        // Create multiple pairs
        address pair1 = factory.createPair(address(tokenA), address(tokenB));
        address pair2 = factory.createPair(address(tokenA), address(tokenC));

        // Add liquidity to pair1
        tokenA.mint(address(this), 20 ether);
        tokenB.mint(address(this), 20 ether);
        tokenC.mint(address(this), 20 ether);

        (address token0_1, address token1_1) = address(tokenA) < address(tokenB)
            ? (address(tokenA), address(tokenB))
            : (address(tokenB), address(tokenA));

        MockERC20(token0_1).transfer(pair1, 10 ether);
        MockERC20(token1_1).transfer(pair1, 10 ether);
        DEXPair(pair1).mint(address(this));

        // Verify pair2 is unaffected
        (uint112 reserve0, uint112 reserve1,) = DEXPair(pair2).getReserves();
        assertEq(reserve0, 0);
        assertEq(reserve1, 0);
    }
}
