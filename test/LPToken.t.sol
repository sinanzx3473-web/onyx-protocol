// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MinimalForwarder.sol";
import "../src/LPToken.sol";
import "../src/DexCore.sol";
import "../src/MockERC20.sol";

/**
 * @title LPTokenTest
 * @notice Comprehensive test suite for LPToken contract
 */
contract LPTokenTest is Test {
    LPToken public lpToken;
    DexCore public dexCore;
    MockERC20 public tokenA;
    MockERC20 public tokenB;
    MockERC20 public weth;
    MinimalForwarder public forwarder;
    
    address public owner;
    address public user1;
    address public user2;
    address public factory;
    
    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        factory = makeAddr("factory");
        
        // Deploy tokens
        tokenA = new MockERC20("Token A", "TKNA", 18);
        tokenB = new MockERC20("Token B", "TKNB", 18);
        weth = new MockERC20("Wrapped ETH", "WETH", 18);
        forwarder = new MinimalForwarder();
        
        // Deploy DexCore
        dexCore = new DexCore(factory, address(weth), address(forwarder));
        
        // Create pool to deploy LP token
        dexCore.createPool(address(tokenA), address(tokenB));
        
        (address token0, address token1) = address(tokenA) < address(tokenB) 
            ? (address(tokenA), address(tokenB)) 
            : (address(tokenB), address(tokenA));
        
        lpToken = LPToken(dexCore.lpTokens(token0, token1));
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          DEPLOYMENT & INITIALIZATION TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_Deployment_Success() public view {
        assertEq(lpToken.dexCore(), address(dexCore), "DexCore should be set");
        assertNotEq(lpToken.token0(), address(0), "Token0 should be set");
        assertNotEq(lpToken.token1(), address(0), "Token1 should be set");
    }
    
    function test_Deployment_TokensSorted() public view {
        assertTrue(lpToken.token0() < lpToken.token1(), "Tokens should be sorted");
    }
    
    function test_Deployment_NameAndSymbol() public view {
        string memory name = lpToken.name();
        string memory symbol = lpToken.symbol();
        
        assertGt(bytes(name).length, 0, "Name should be set");
        assertGt(bytes(symbol).length, 0, "Symbol should be set");
    }
    
    function test_Deployment_InitialSupply() public view {
        assertEq(lpToken.totalSupply(), 0, "Initial supply should be zero");
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          MINT FUNCTION TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_Mint_OnlyDexCore() public {
        vm.prank(user1);
        vm.expectRevert(LPToken.OnlyDexCore.selector);
        lpToken.mint(user1, 1000);
    }
    
    function test_Mint_RevertsOnZeroAmount() public {
        vm.prank(address(dexCore));
        vm.expectRevert(LPToken.ZeroAmount.selector);
        lpToken.mint(user1, 0);
    }
    
    function test_Mint_ToAddressZero() public {
        // Special case: minting to address(0) for MINIMUM_LIQUIDITY lock
        vm.prank(address(dexCore));
        lpToken.mint(address(0), 1000);
        
        assertEq(lpToken.totalSupply(), 1000, "Should mint to address(0)");
        assertEq(lpToken.balanceOf(address(0)), 1000, "Address(0) should have balance");
    }
    
    function test_Mint_ToUser() public {
        uint256 amount = 1000 ether;
        
        vm.prank(address(dexCore));
        lpToken.mint(user1, amount);
        
        assertEq(lpToken.balanceOf(user1), amount, "User should receive tokens");
        assertEq(lpToken.totalSupply(), amount, "Total supply should increase");
    }
    
    function test_Mint_MultipleTimes() public {
        vm.startPrank(address(dexCore));
        
        lpToken.mint(user1, 100 ether);
        lpToken.mint(user2, 200 ether);
        lpToken.mint(user1, 50 ether);
        
        vm.stopPrank();
        
        assertEq(lpToken.balanceOf(user1), 150 ether, "User1 balance should accumulate");
        assertEq(lpToken.balanceOf(user2), 200 ether, "User2 balance should be correct");
        assertEq(lpToken.totalSupply(), 350 ether, "Total supply should be sum");
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          BURN FUNCTION TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_Burn_OnlyDexCore() public {
        vm.prank(user1);
        vm.expectRevert(LPToken.OnlyDexCore.selector);
        lpToken.burn(user1, 1000);
    }
    
    function test_Burn_RevertsOnZeroAddress() public {
        vm.prank(address(dexCore));
        vm.expectRevert(LPToken.ZeroAddress.selector);
        lpToken.burn(address(0), 1000);
    }
    
    function test_Burn_RevertsOnZeroAmount() public {
        vm.prank(address(dexCore));
        vm.expectRevert(LPToken.ZeroAmount.selector);
        lpToken.burn(user1, 0);
    }
    
    function test_Burn_RevertsOnInsufficientBalance() public {
        vm.prank(address(dexCore));
        lpToken.mint(user1, 100 ether);
        
        vm.prank(address(dexCore));
        vm.expectRevert();
        lpToken.burn(user1, 200 ether);
    }
    
    function test_Burn_Success() public {
        uint256 mintAmount = 1000 ether;
        uint256 burnAmount = 400 ether;
        
        vm.startPrank(address(dexCore));
        lpToken.mint(user1, mintAmount);
        lpToken.burn(user1, burnAmount);
        vm.stopPrank();
        
        assertEq(lpToken.balanceOf(user1), mintAmount - burnAmount, "Balance should decrease");
        assertEq(lpToken.totalSupply(), mintAmount - burnAmount, "Total supply should decrease");
    }
    
    function test_Burn_CompleteBalance() public {
        uint256 amount = 1000 ether;
        
        vm.startPrank(address(dexCore));
        lpToken.mint(user1, amount);
        lpToken.burn(user1, amount);
        vm.stopPrank();
        
        assertEq(lpToken.balanceOf(user1), 0, "Balance should be zero");
        assertEq(lpToken.totalSupply(), 0, "Total supply should be zero");
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          ERC20 STANDARD TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_Transfer_Success() public {
        vm.prank(address(dexCore));
        lpToken.mint(user1, 1000 ether);
        
        vm.prank(user1);
        lpToken.transfer(user2, 400 ether);
        
        assertEq(lpToken.balanceOf(user1), 600 ether, "Sender balance should decrease");
        assertEq(lpToken.balanceOf(user2), 400 ether, "Recipient balance should increase");
    }
    
    function test_Transfer_RevertsOnInsufficientBalance() public {
        vm.prank(address(dexCore));
        lpToken.mint(user1, 100 ether);
        
        vm.prank(user1);
        vm.expectRevert();
        lpToken.transfer(user2, 200 ether);
    }
    
    function test_Approve_Success() public {
        vm.prank(user1);
        lpToken.approve(user2, 1000 ether);
        
        assertEq(lpToken.allowance(user1, user2), 1000 ether, "Allowance should be set");
    }
    
    function test_TransferFrom_Success() public {
        vm.prank(address(dexCore));
        lpToken.mint(user1, 1000 ether);
        
        vm.prank(user1);
        lpToken.approve(user2, 400 ether);
        
        vm.prank(user2);
        lpToken.transferFrom(user1, user2, 400 ether);
        
        assertEq(lpToken.balanceOf(user1), 600 ether, "Sender balance should decrease");
        assertEq(lpToken.balanceOf(user2), 400 ether, "Recipient balance should increase");
        assertEq(lpToken.allowance(user1, user2), 0, "Allowance should decrease");
    }
    
    function test_TransferFrom_RevertsOnInsufficientAllowance() public {
        vm.prank(address(dexCore));
        lpToken.mint(user1, 1000 ether);
        
        vm.prank(user1);
        lpToken.approve(user2, 100 ether);
        
        vm.prank(user2);
        vm.expectRevert();
        lpToken.transferFrom(user1, user2, 200 ether);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          EDGE CASE TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_MintAndBurn_Sequence() public {
        vm.startPrank(address(dexCore));
        
        lpToken.mint(user1, 100 ether);
        lpToken.mint(user2, 200 ether);
        lpToken.burn(user1, 50 ether);
        lpToken.mint(user1, 25 ether);
        lpToken.burn(user2, 100 ether);
        
        vm.stopPrank();
        
        assertEq(lpToken.balanceOf(user1), 75 ether, "User1 final balance");
        assertEq(lpToken.balanceOf(user2), 100 ether, "User2 final balance");
        assertEq(lpToken.totalSupply(), 175 ether, "Total supply should match");
    }
    
    function test_Transfer_ToSelf() public {
        vm.prank(address(dexCore));
        lpToken.mint(user1, 1000 ether);
        
        vm.prank(user1);
        lpToken.transfer(user1, 400 ether);
        
        assertEq(lpToken.balanceOf(user1), 1000 ether, "Balance should remain same");
    }
    
    function test_Approve_MaxUint256() public {
        vm.prank(user1);
        lpToken.approve(user2, type(uint256).max);
        
        assertEq(lpToken.allowance(user1, user2), type(uint256).max, "Max allowance");
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          FUZZ TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function testFuzz_Mint(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);
        
        vm.prank(address(dexCore));
        lpToken.mint(user1, amount);
        
        assertEq(lpToken.balanceOf(user1), amount, "Balance should match minted amount");
        assertEq(lpToken.totalSupply(), amount, "Total supply should match");
    }
    
    function testFuzz_Burn(uint256 mintAmount, uint256 burnAmount) public {
        mintAmount = bound(mintAmount, 1, type(uint128).max);
        burnAmount = bound(burnAmount, 1, mintAmount);
        
        vm.startPrank(address(dexCore));
        lpToken.mint(user1, mintAmount);
        lpToken.burn(user1, burnAmount);
        vm.stopPrank();
        
        assertEq(lpToken.balanceOf(user1), mintAmount - burnAmount, "Balance after burn");
        assertEq(lpToken.totalSupply(), mintAmount - burnAmount, "Supply after burn");
    }
    
    function testFuzz_Transfer(uint256 mintAmount, uint256 transferAmount) public {
        mintAmount = bound(mintAmount, 1, type(uint128).max);
        transferAmount = bound(transferAmount, 0, mintAmount);
        
        vm.prank(address(dexCore));
        lpToken.mint(user1, mintAmount);
        
        vm.prank(user1);
        lpToken.transfer(user2, transferAmount);
        
        assertEq(lpToken.balanceOf(user1), mintAmount - transferAmount, "Sender balance");
        assertEq(lpToken.balanceOf(user2), transferAmount, "Recipient balance");
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          GAS OPTIMIZATION TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_Gas_Mint() public {
        vm.prank(address(dexCore));
        uint256 gasBefore = gasleft();
        lpToken.mint(user1, 1000 ether);
        uint256 gasUsed = gasBefore - gasleft();
        
        assertLt(gasUsed, 100000, "Mint should be gas efficient");
    }
    
    function test_Gas_Burn() public {
        vm.prank(address(dexCore));
        lpToken.mint(user1, 1000 ether);
        
        vm.prank(address(dexCore));
        uint256 gasBefore = gasleft();
        lpToken.burn(user1, 500 ether);
        uint256 gasUsed = gasBefore - gasleft();
        
        assertLt(gasUsed, 100000, "Burn should be gas efficient");
    }
    
    function test_Gas_Transfer() public {
        vm.prank(address(dexCore));
        lpToken.mint(user1, 1000 ether);
        
        vm.prank(user1);
        uint256 gasBefore = gasleft();
        lpToken.transfer(user2, 400 ether);
        uint256 gasUsed = gasBefore - gasleft();
        
        assertLt(gasUsed, 100000, "Transfer should be gas efficient");
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                          INTEGRATION TESTS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    function test_Integration_MintBurnTransfer() public {
        // Mint to user1
        vm.prank(address(dexCore));
        lpToken.mint(user1, 1000 ether);
        
        // User1 transfers to user2
        vm.prank(user1);
        lpToken.transfer(user2, 300 ether);
        
        // Burn from user1
        vm.prank(address(dexCore));
        lpToken.burn(user1, 200 ether);
        
        // Mint to user2
        vm.prank(address(dexCore));
        lpToken.mint(user2, 100 ether);
        
        assertEq(lpToken.balanceOf(user1), 500 ether, "User1 final balance");
        assertEq(lpToken.balanceOf(user2), 400 ether, "User2 final balance");
        assertEq(lpToken.totalSupply(), 900 ether, "Total supply");
    }
}
